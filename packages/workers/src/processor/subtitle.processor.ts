import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, reportError, SupabaseClient } from '@repo/supabase';
import {
  calculateSubtitleCredits,
  dubLanguageLabel,
  SUBTITLE_AUTO_DETECT,
  SUBTITLE_CANCEL_PREFIX,
  SUBTITLE_CREDIT_MULTIPLIER,
  SUBTITLE_RESPONSE_SCHEMA,
  TOKENS_PER_CREDIT,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';
import { getGenAI, GEMINI_TEXT_MODEL, extractResponseText } from './utils/genai';

interface SubtitleJobData {
  userId: string;
  subtitleId: string;
  bullJobId: string;
  videoGsUri: string;
  mimeType: string;
  /** A language code, or 'auto'. */
  language: string;
  /** A language code, or 'same' for no translation. */
  targetLanguage: string;
}

export class SubtitleCancelledError extends Error {
  constructor() {
    super('Subtitle generation cancelled by user');
    this.name = 'SubtitleCancelledError';
  }
}

@Processor('subtitle', { concurrency: 2 })
export class SubtitleProcessor extends WorkerHost {
  private readonly logger = new Logger(SubtitleProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor(@InjectQueue('subtitle') private readonly queue: Queue) {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = getGenAI();
  }

  /** Throws SubtitleCancelledError if the API flagged this job for cancellation. */
  private async throwIfCancelled(bullJobId: string): Promise<void> {
    const client = await this.queue.client;
    const cancelled = await client.get(`${SUBTITLE_CANCEL_PREFIX}${bullJobId}`);
    if (cancelled) {
      await client.del(`${SUBTITLE_CANCEL_PREFIX}${bullJobId}`);
      throw new SubtitleCancelledError();
    }
  }

  async process(job: Job<SubtitleJobData>): Promise<{ lineCount: number }> {
    const { userId, subtitleId, bullJobId, videoGsUri, mimeType, language, targetLanguage } = job.data;

    await job.updateProgress(0);
    await job.log('Starting subtitle generation...');

    try {
      await this.updateJob(subtitleId, { status: 'processing' });
      await this.throwIfCancelled(bullJobId);

      await job.updateProgress(10);
      const isAutoDetect = language === SUBTITLE_AUTO_DETECT;
      const translateTo = targetLanguage === 'same' ? null : dubLanguageLabel(targetLanguage);
      await job.log(
        translateTo
          ? `Transcribing ${isAutoDetect ? 'auto-detected audio' : dubLanguageLabel(language)} and translating to ${translateTo}...`
          : `Transcribing ${isAutoDetect ? 'auto-detected audio' : dubLanguageLabel(language)}...`,
      );

      const prompt = this.buildPrompt(isAutoDetect ? null : dubLanguageLabel(language), translateTo);

      // Vertex reads the media straight out of GCS by its gs:// URI — no inline bytes, so
      // the ceiling is GCS's 2GB object limit rather than the ~50MB inline one.
      const response = await this.genAI.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { fileData: { fileUri: videoGsUri, mimeType } }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: SUBTITLE_RESPONSE_SCHEMA,
        },
      });

      await this.throwIfCancelled(bullJobId);
      await job.updateProgress(75);

      const totalTokens = response?.usageMetadata?.totalTokenCount ?? 0;
      const { text, reason } = extractResponseText(response);
      if (!text) throw new Error(`AI returned no subtitles: ${reason}`);

      const parsed = JSON.parse(text);
      const lines = parsed.subtitles;
      if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error('AI returned no subtitle lines');
      }

      await job.updateProgress(85);
      await job.log(`Saving ${lines.length} subtitle lines... (${totalTokens} tokens)`);

      const tokensPerCredit = this.getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
      const subtitleMultiplier = this.getEnvNumber('SUBTITLE_CREDIT_MULTIPLIER', SUBTITLE_CREDIT_MULTIPLIER);
      const creditsConsumed = calculateSubtitleCredits(
        { totalTokens },
        { tokensPerCredit, multiplier: subtitleMultiplier },
      );

      const { data: updated, error: updateError } = await this.supabase
        .from('subtitle_jobs')
        .update({
          status: 'done',
          subtitles_json: lines,
          detected_language: parsed.detected_language,
          title: (parsed.title as string | undefined)?.slice(0, 60) ?? null,
          credits_consumed: creditsConsumed,
          total_tokens: totalTokens,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subtitleId)
        .select('id')
        .single();

      if (updateError || !updated) {
        this.logger.error(`subtitle_jobs completion update failed for id=${subtitleId}: ${updateError?.message ?? 'no rows updated'}`);
        throw new Error(`subtitle_jobs update failed: ${updateError?.message ?? 'row not found or RLS blocked'}`);
      }

      const { error: creditError } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsConsumed,
      });

      if (creditError) {
        this.logger.warn(`Credit deduction failed for user ${userId} (${creditsConsumed} credits): ${creditError.message}`);
        await job.log(`Warning: credit deduction failed — ${creditError.message}`);
      }

      await job.updateProgress(100);
      await job.log('Subtitles generated successfully!');

      return { lineCount: lines.length };
    } catch (error: any) {
      const isCancelled = error instanceof SubtitleCancelledError;
      await job.log(isCancelled ? 'Cancelled by user' : `Fatal error: ${error.message}`);

      if (!isCancelled) {
        this.logger.error(`Subtitle job ${job.id} failed: ${error.message}`, error.stack);
        void reportError(this.supabase, {
          source: 'worker',
          feature: 'subtitle',
          userId,
          error,
          context: { jobId: job.id, subtitleId, language, targetLanguage },
        });
      }

      try {
        await this.updateJob(subtitleId, {
          status: 'failed',
          error_message: error.message?.slice(0, 5000),
        });
      } catch (updateErr: any) {
        this.logger.error(`Failed to persist failed status for subtitle job ${subtitleId}: ${updateErr?.message}`);
      }

      throw error;
    }
  }

  /**
   * `sourceLabel` null means auto-detect; `translateTo` null means leave the transcript in
   * the language it was spoken in.
   */
  private buildPrompt(sourceLabel: string | null, translateTo: string | null): string {
    return `You are an expert, highly-accurate subtitle transcription service.
Transcribe the provided video and generate precise, time-stamped subtitles.

**LANGUAGE:** ${sourceLabel ? `Transcribe the audio in ${sourceLabel}.` : 'Automatically detect the language being spoken and transcribe in that language.'}

**TRANSLATION:** ${translateTo ? `After transcription, translate every subtitle line to ${translateTo}, keeping the original timestamps. The subtitle text must be in ${translateTo}, not the original language, and must keep the meaning and tone of the original speech.` : 'Provide subtitles in the detected language. Do not translate.'}

**RULES:**
1. "detected_language" is the full English name of the language spoken in the audio (e.g. "English", "Spanish", "Hindi").
2. Timestamps use the exact HH:MM:SS.mmm format.
3. Include correct punctuation so the lines read naturally.
4. Do not emit entries for silence.
5. Transcribe significant non-speech sounds in brackets, e.g. [MUSIC], [LAUGHTER], [APPLAUSE].
6. Transcribe verbatim. Do not paraphrase or correct the speaker's grammar.
7. Keep every line SHORT: 1-2 short sentences, 5-10 words, readable in 2-3 seconds. Break longer sentences across several entries with their own timestamps.
8. "title" is a short descriptive summary of the video, at most 60 characters.`;
  }

  private async updateJob(subtitleId: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.from('subtitle_jobs').update(patch).eq('id', subtitleId);
    if (error) throw new Error(`subtitle_jobs update failed: ${error.message}`);
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
