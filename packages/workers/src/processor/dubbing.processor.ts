import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import {
  calculateDubbingCreditsByDuration,
  DUBBING_CREDIT_MULTIPLIER,
  DUBBING_CANCEL_PREFIX,
  supportedLanguages,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';
import { getGenAI, GEMINI_TEXT_MODEL } from './utils/genai';

// The clone step (Modal GPU) can run for a few minutes — cap the wait so a hung
// request fails the job instead of pinning a worker slot forever.
const MODAL_TIMEOUT_MS = 10 * 60 * 1000;

class DubbingCancelledError extends Error {
  constructor() {
    super('Dubbing cancelled by user');
    this.name = 'DubbingCancelledError';
  }
}

interface DubJobData {
  userId: string;
  projectId: string;
  bullJobId: string;
  inputGsUri: string;   // gs:// — Vertex transcribes/translates directly from this
  inputUrl: string;     // public GCS URL — the clone service fetches the reference from this
  mimeType: string;
  isVideo: boolean;
  targetLanguage: string;
  durationSeconds: number;
  outputPutUrl: string;       // signed PUT URL — Modal uploads the dubbed file straight to GCS
  outputContentType: string;  // must match the URL's signed Content-Type (video/mp4 | audio/wav)
  outputPublicUrl: string;    // public GCS URL of the result, recorded once Modal confirms upload
}

@Processor('dubbing', { concurrency: 2 })
export class DubbingProcessor extends WorkerHost {
  private readonly logger = new Logger(DubbingProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor(@InjectQueue('dubbing') private readonly queue: Queue) {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = getGenAI();
  }

  /** Cancellation flag set by POST /dubbing/stop/:jobId — checked between stages. */
  private async throwIfCancelled(jobId: string): Promise<void> {
    const client = await this.queue.client;
    const cancelled = await client.get(`${DUBBING_CANCEL_PREFIX}${jobId}`);
    if (cancelled) {
      await client.del(`${DUBBING_CANCEL_PREFIX}${jobId}`);
      throw new DubbingCancelledError();
    }
  }

  async process(job: Job<DubJobData>): Promise<{ dubbedUrl: string }> {
    const {
      userId, projectId, inputGsUri, inputUrl, mimeType, isVideo, targetLanguage, durationSeconds,
      outputPutUrl, outputContentType, outputPublicUrl,
    } = job.data;

    await job.updateProgress(0);
    await job.log('Starting dubbing...');

    try {
      const modalUrl = process.env.MODAL_API_URL;
      if (!modalUrl) throw new Error('MODAL_API_URL is not configured');

      await this.throwIfCancelled(job.id!);
      await this.updateJob(projectId, { status: 'processing' });
      await job.updateProgress(5);

      // targetLanguage is an ISO code (e.g. 'es'); Gemini wants the full name, the
      // clone model wants the code as its language_id.
      const languageLabel = supportedLanguages.find((l) => l.value === targetLanguage)?.label ?? targetLanguage;

      // 1. Transcribe + translate. Vertex reads the media straight from gs:// —
      //    no inline bytes, no Files API, no 50MB ceiling (same as subtitles).
      await job.log(`Transcribing and translating to ${languageLabel}...`);
      const translatedText = await this.transcribeAndTranslate(inputGsUri, mimeType, languageLabel);
      await job.updateProgress(30);

      // 2. Clone the voice + synthesize the translation (Modal GPU), then have Modal
      //    upload the result straight to GCS via the signed PUT URL — the worker never
      //    holds the file (a dubbed MP4 can be hundreds of MB). For a video input Modal
      //    muxes the dubbed audio over the original and stores an MP4; audio → a WAV.
      await this.throwIfCancelled(job.id!);
      await this.updateJob(projectId, { status: 'cloning' });
      await job.log(isVideo ? 'Cloning voice and rebuilding video...' : 'Cloning voice and generating dubbed audio...');
      await this.callModalDub(modalUrl, translatedText, inputUrl, isVideo, targetLanguage, outputPutUrl, outputContentType);
      await job.updateProgress(80);

      // 3. Modal already stored the result in GCS at the pre-signed location.
      // Last cancellation window — after this we charge credits and persist.
      await this.throwIfCancelled(job.id!);
      const dubbedUrl = outputPublicUrl;
      await job.updateProgress(90);

      // 4. Deduct duration-based credits — only after a successful clone.
      const multiplier = this.getEnvNumber('DUBBING_CREDIT_MULTIPLIER', DUBBING_CREDIT_MULTIPLIER);
      const creditsConsumed = calculateDubbingCreditsByDuration(durationSeconds, multiplier);

      const { error: creditError } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsConsumed,
      });
      if (creditError) {
        this.logger.error(`Credit deduction failed for user ${userId}: ${creditError.message}`);
        await this.updateJob(projectId, { status: 'failed', error_message: 'Insufficient credits' });
        throw new Error('Insufficient credits. Please upgrade your plan.');
      }

      await this.updateJob(projectId, {
        status: 'completed',
        dubbed_url: dubbedUrl,
        credits_consumed: creditsConsumed,
      });
      await job.updateProgress(100);
      await job.log(`Done! ${creditsConsumed} credits deducted.`);

      return { dubbedUrl };
    } catch (error: any) {
      const cancelled = error instanceof DubbingCancelledError;
      await job.log(cancelled ? 'Cancelled by user.' : `Fatal error: ${error.message}`);
      if (!cancelled) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      }
      try {
        await this.updateJob(projectId, { status: 'failed', error_message: error.message?.slice(0, 5000) });
      } catch (updateError: any) {
        this.logger.error(
          `Job ${job.id}: failed to persist failed status for dub ${projectId}: ${updateError?.message}`,
          updateError?.stack,
        );
      }
      throw error;
    }
  }

  private async transcribeAndTranslate(gsUri: string, mimeType: string, targetLanguage: string): Promise<string> {
    const result = await this.genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Transcribe the spoken audio from this file, then translate the full transcript into ${targetLanguage}. Return ONLY the translated text as a single continuous paragraph. No timestamps, no formatting, no labels — just the translated text.`,
            },
            { fileData: { fileUri: gsUri, mimeType } },
          ],
        },
      ],
    });

    const text = result.text?.trim();
    if (!text) throw new Error('Empty transcription/translation result from Gemini');
    return text;
  }

  /**
   * Modal contract: JSON { text, reference_url, is_video, language, output_put_url,
   * output_content_type } → Modal uploads the dubbed file straight to GCS via the signed
   * PUT URL and returns a small JSON ack. MODAL_API_URL is the exact URL `modal deploy`
   * printed for the /dub endpoint — Modal gives each web endpoint its own dedicated
   * hostname with no path routing, so we POST to modalUrl directly (no path appended).
   * Modal fetches reference_url (public GCS URL), extracts audio if is_video, clones the
   * voice, synthesizes `text` in `language`, muxes over the original video when is_video,
   * and PUTs the result to output_put_url. Keeping the bytes off the worker is the point:
   * the dubbed media never transits this process.
   */
  private async callModalDub(
    modalUrl: string,
    text: string,
    referenceUrl: string,
    isVideo: boolean,
    language: string,
    outputPutUrl: string,
    outputContentType: string,
  ): Promise<void> {
    const response = await fetch(modalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        reference_url: referenceUrl,
        is_video: isVideo,
        language,
        output_put_url: outputPutUrl,
        output_content_type: outputContentType,
      }),
      signal: AbortSignal.timeout(MODAL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Modal API error ${response.status}: ${errBody.slice(0, 500)}`);
    }
  }

  private async updateJob(projectId: string, fields: Record<string, any>) {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .update({ ...fields })
      .eq('project_id', projectId)
      .select('project_id')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update dubbing_projects project_id=${projectId}. fields=${Object.keys(fields).join(', ')} error=${error?.message ?? 'no rows updated (RLS or missing row)'}`,
      );
      throw new Error(`dubbing_projects update failed: ${error?.message ?? 'row not found or RLS blocked'}`);
    }
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
