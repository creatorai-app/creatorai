import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSupabaseClient, getSupabaseServiceEnv, reportError, SupabaseClient } from '@repo/supabase';
import { Thumbnail } from "@repo/validation";
import { GoogleGenAI } from '@google/genai';
import { getGenAI } from './utils/genai';
import {
  validateInputs,
  validateEnvironment,
  fetchChannelData,
  manageYouTubeToken,
  fetchVideoData,
  analyzeChannel,
  generateStyleEmbeddings,
  saveStyleData,
  extractChannelIntelligence,
  selectVideosForTraining,
  resolveTrainingCharge,
} from './utils/train-ai';

const CANCEL_PREFIX = 'train-ai:cancel:';

class TrainingCancelledError extends Error {
  constructor() {
    super('AI memory build cancelled by user');
    this.name = 'TrainingCancelledError';
  }
}

interface TrainAiJobData {
  userId: string;
  videoUrls: string[];
  isRetraining?: boolean;
}

@Processor('train-ai', { concurrency: 1 })
export class TrainAiProcessor extends WorkerHost {
  private readonly logger = new Logger(TrainAiProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('train-ai') private readonly queue: Queue,
  ) {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);

    this.genAI = getGenAI();
  }

  private async throwIfCancelled(jobId: string): Promise<void> {
    const client = await this.queue.client;
    const cancelled = await client.get(`${CANCEL_PREFIX}${jobId}`);
    if (cancelled) {
      await client.del(`${CANCEL_PREFIX}${jobId}`);
      throw new TrainingCancelledError();
    }
  }

  async process(job: Job<TrainAiJobData>): Promise<void> {
    const { userId, videoUrls, isRetraining } = job.data;

    await job.updateProgress(0);
    await job.log('Job queued and validations starting...');

    let totalConsumedTokens = 0;

    try {
      await validateInputs(userId, videoUrls);
      await validateEnvironment();

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(10);
      await job.log('Fetching channel and token...');

      const channelData = await fetchChannelData(this.supabase, userId);
      const { accessToken } = await manageYouTubeToken(this.supabase, userId, channelData);

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(20);
      await job.log('Fetching video data...');

      const allVideoData = await fetchVideoData(videoUrls, accessToken, channelData.channel_id);

      // Cap what we analyse (most-viewed wins) so cost stays bounded no matter how
      // many videos were selected or how long they are.
      const { videos: videoData, urls: analysedUrls } = selectVideosForTraining(allVideoData, videoUrls);

      // Settle affordability BEFORE spending anything at Gemini. Throws
      // "Insufficient credits." for a retrain the user cannot cover; the first
      // training is free and always passes.
      await this.throwIfCancelled(job.id!);
      const charge = await resolveTrainingCharge(this.supabase, userId, videoData.length);
      await job.log(
        charge.isFirstTraining
          ? 'Your first memory build is free. No credits will be charged.'
          : 'Credits reserved for rebuilding your AI memory.',
      );

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(35);
      await job.log('Watching your videos and analyzing style...');

      // ONE call: style + transcripts + hooks + channel intelligence, with the video
      // clips actually attached (see analyzeChannel).
      const { styleAnalysis, transcripts, aiIntelligence, totalStyleTokens } =
        await analyzeChannel(this.genAI, channelData, videoData, analysedUrls);

      totalConsumedTokens += totalStyleTokens;

      const thumbnails: Thumbnail[] = videoData.map((v) => ({
        videoId: v.id,
        thumbnailUrl: v.thumbnailUrl,
      }));

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(70);
      await job.log('Extracting channel intelligence...');

      // Local aggregation over the FULL selection (not just the analysed clips) —
      // averages and cadence are better with every video the user picked.
      const channelIntelligence = extractChannelIntelligence(allVideoData, transcripts, aiIntelligence);

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(80);
      await job.log('Generating embeddings...');

      // Both vectors in one batched embedContent call.
      const { embedding, topicEmbedding } = await generateStyleEmbeddings(
        this.genAI,
        styleAnalysis,
        channelIntelligence,
        channelData,
      );

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(85);
      await job.log('Saving data...');

      await saveStyleData(
        this.supabase,
        userId,
        styleAnalysis,
        embedding,
        videoUrls,
        transcripts,
        thumbnails,
        totalConsumedTokens,
        channelIntelligence,
        topicEmbedding,
        charge,
      );

      await job.updateProgress(100);
      this.logger.log(`Train AI completed for ${userId}, retraining: ${isRetraining}`);
    } catch (error) {
      const isCancelled = error instanceof TrainingCancelledError;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      await job.log(isCancelled ? 'AI memory build cancelled by user' : `Error: ${errorMessage}`);
      this.logger.warn(`Job ${job.id} ${isCancelled ? 'cancelled' : 'failed'}: ${errorMessage}`, errorStack);

      if (!isCancelled) {
        void reportError(this.supabase, {
          source: 'worker',
          feature: 'train-ai',
          userId,
          error,
          context: { jobId: job.id, videoCount: videoUrls?.length ?? 0, isRetraining },
        });
      }

      throw error;
    }
  }

  // processVideoAssets lived here: one generateContent call per video that interpolated
  // the YouTube URL into a text prompt and asked for a transcript. Nothing was ever
  // attached, so Gemini invented the transcript from the title and description — up to
  // 30k output tokens of fiction per video, which every downstream style profile was
  // then built on. analyzeChannel attaches the real clips and returns the transcripts
  // in the same response, so this whole loop is gone.
}