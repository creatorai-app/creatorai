import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import {
  calculateVideoGenerationCredits,
  VIDEO_GENERATION_CREDIT_MULTIPLIER,
  VIDEO_GEN_CANCEL_PREFIX,
  type VideoAspectRatio,
} from '@repo/validation';
import { GEMINI_VIDEO_MODEL } from './utils/genai';
import { runOmniVideo, type OmniTask, type OmniImageInput } from './utils/omni';
import { uploadVideoBuffer } from './utils/gcs';

// Redis flag the API sets to cancel an in-flight job (mirrors the train-ai pattern).
class VideoCancelledError extends Error {
  constructor() {
    super('Cancelled by you');
    this.name = 'VideoCancelledError';
  }
}

interface VideoJobData {
  userId: string;
  videoJobId: string;
  bullJobId: string;
  prompt: string;
  mode: OmniTask;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  // ponytail: input images ride in the job payload as base64 (≤3, capped ~5MB each).
  // Fine for this low-throughput paid feature; move to GCS staging if payloads bite.
  images?: OmniImageInput[];
  // Stateful edit: the source clip's Omni interaction id (previous_interaction_id).
  previousInteractionId?: string;
}

@Processor('video-generation', { concurrency: 2 })
export class VideoGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoGenerationProcessor.name);
  private readonly supabase: SupabaseClient;

  constructor(
    @InjectQueue('video-generation') private readonly queue: Queue,
  ) {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
  }

  /** Throws VideoCancelledError if the API flagged this job for cancellation. */
  private async throwIfCancelled(bullJobId: string): Promise<void> {
    const client = await this.queue.client;
    const cancelled = await client.get(`${VIDEO_GEN_CANCEL_PREFIX}${bullJobId}`);
    if (cancelled) {
      await client.del(`${VIDEO_GEN_CANCEL_PREFIX}${bullJobId}`);
      throw new VideoCancelledError();
    }
  }

  async process(job: Job<VideoJobData>): Promise<{ videoUrl: string }> {
    const {
      userId, videoJobId, prompt, mode,
      aspectRatio, durationSeconds, images, previousInteractionId,
    } = job.data;

    await job.updateProgress(0);
    await job.log('Starting video generation...');

    try {
      await this.updateJob(videoJobId, { status: 'processing', model: GEMINI_VIDEO_MODEL });

      if (!process.env.GCS_VIDEO_BUCKET) throw new Error('GCS_VIDEO_BUCKET is not configured');

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(10);
      await job.log(`Submitting to ${GEMINI_VIDEO_MODEL} (${mode}, ${durationSeconds}s, ${aspectRatio})...`);

      const bucket = process.env.GCS_VIDEO_BUCKET!;
      // One prefix per job; edits are separate jobs, so this never overwrites a source clip.
      const gcsOutputPrefix = `gs://${bucket}/${userId}/${videoJobId}/`;

      const result = await runOmniVideo({
        model: GEMINI_VIDEO_MODEL,
        task: mode,
        prompt,
        aspectRatio,
        durationSeconds,
        images,
        previousInteractionId,
        gcsOutputPrefix,
        onPoll: async (attempt) => {
          await this.throwIfCancelled(job.id!);
          // Creep 15 → 85 while the interaction runs.
          await job.updateProgress(Math.min(85, 15 + attempt * 3));
        },
      });
      const { interactionId } = result;

      // Honor a cancel that landed during generation: discard before we persist or charge.
      await this.throwIfCancelled(job.id!);

      await job.updateProgress(90);

      // URI delivery → Omni already wrote to GCS; inline → upload the returned bytes.
      let gsUri: string;
      let publicUrl: string;
      if (result.gsUri) {
        gsUri = result.gsUri;
        publicUrl = gsUri.replace(/^gs:\/\//, 'https://storage.googleapis.com/');
      } else {
        await job.log('Uploading generated video...');
        const uploaded = await uploadVideoBuffer(`${userId}/${videoJobId}.mp4`, result.buffer!);
        gsUri = uploaded.gsUri;
        publicUrl = uploaded.publicUrl;
      }

      await job.updateProgress(95);
      await job.log('Deducting credits...');

      const multiplier = this.getEnvNumber('VIDEO_GENERATION_CREDIT_MULTIPLIER', VIDEO_GENERATION_CREDIT_MULTIPLIER);
      const creditsToDeduct = calculateVideoGenerationCredits(durationSeconds, multiplier);

      const { error: creditError } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsToDeduct,
      });
      if (creditError) {
        this.logger.error(`Credit deduction failed for user ${userId}: ${creditError.message}`);
        await this.updateJob(videoJobId, { status: 'failed', error_message: 'Insufficient credits' });
        throw new Error('Insufficient credits. Please upgrade your plan.');
      }

      await this.updateJob(videoJobId, {
        status: 'completed',
        video_url: publicUrl,
        video_gs_uri: gsUri,
        interaction_id: interactionId,
        credits_consumed: creditsToDeduct,
      });
      await job.updateProgress(100);
      await job.log(`Done! ${durationSeconds}s video generated, ${creditsToDeduct} credits deducted.`);

      return { videoUrl: publicUrl };
    } catch (error: any) {
      const cancelled = error instanceof VideoCancelledError;
      await job.log(cancelled ? 'Cancelled by you' : `Fatal error: ${error.message}`);
      if (cancelled) this.logger.warn(`Job ${job.id} cancelled by user`);
      else this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      try {
        await this.updateJob(videoJobId, {
          status: cancelled ? 'cancelled' : 'failed',
          error_message: cancelled ? null : error.message?.slice(0, 5000),
        });
      } catch (updateError: any) {
        this.logger.error(
          `Job ${job.id}: failed to persist failed status for video job ${videoJobId}: ${updateError?.message}`,
          updateError?.stack,
        );
      }
      throw error;
    }
  }

  private async updateJob(jobId: string, fields: Record<string, any>) {
    const { data, error } = await this.supabase
      .from('video_generation_jobs')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update video_generation_jobs id=${jobId}. fields=${Object.keys(fields).join(', ')} error=${error?.message ?? 'no rows updated (RLS or missing row)'}`,
      );
      throw new Error(`video_generation_jobs update failed: ${error?.message ?? 'row not found or RLS blocked'}`);
    }
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
