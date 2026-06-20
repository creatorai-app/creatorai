import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import { Thumbnail, Transcript, VideoData } from "@repo/validation";
import { GoogleGenAI } from '@google/genai';
import {
  validateInputs,
  validateEnvironment,
  fetchChannelData,
  manageYouTubeToken,
  fetchVideoData,
  analyzeStyle,
  generateEmbedding,
  generateTopicEmbedding,
  saveStyleData,
  extractChannelIntelligence,
  enrichChannelIntelligenceWithAI,
} from './utils/train-ai';

const CANCEL_PREFIX = 'train-ai:cancel:';

class TrainingCancelledError extends Error {
  constructor() {
    super('Training cancelled by user');
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

    this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
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

      const videoData = await fetchVideoData(videoUrls, accessToken, channelData.channel_id);

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(30);
      await job.log('Processing transcripts and thumbnails...');

      const { transcripts, thumbnails, totalVideoTokens } =
        await this.processVideoAssets(videoData, videoUrls);

      totalConsumedTokens += totalVideoTokens;

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(50);
      await job.log('Analyzing style and embedding...');

      const { styleAnalysis, totalStyleTokens } =
        await analyzeStyle(this.genAI, channelData, videoData, videoUrls);

      totalConsumedTokens += totalStyleTokens;

      await this.throwIfCancelled(job.id!);
      const embedding = await generateEmbedding(this.genAI, styleAnalysis);

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(70);
      await job.log('Extracting channel intelligence...');

      const baseIntelligence = extractChannelIntelligence(videoData, transcripts);
      const { enriched: channelIntelligence, tokens: intelTokens } =
        await enrichChannelIntelligenceWithAI(this.genAI, baseIntelligence, channelData);
      totalConsumedTokens += intelTokens;

      await this.throwIfCancelled(job.id!);
      await job.updateProgress(80);
      await job.log('Generating topic embedding...');

      const topicEmbedding = await generateTopicEmbedding(this.genAI, channelIntelligence, channelData);

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
      );

      await job.updateProgress(100);
      this.logger.log(`Train AI completed for ${userId}, retraining: ${isRetraining}`);
    } catch (error) {
      const isCancelled = error instanceof TrainingCancelledError;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      await job.log(isCancelled ? 'Training cancelled by user' : `Error: ${errorMessage}`);
      this.logger.warn(`Job ${job.id} ${isCancelled ? 'cancelled' : 'failed'}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async processVideoAssets(
    videos: VideoData[],
    videoUrls: string[],
  ): Promise<{
    transcripts: Transcript[];
    thumbnails: Thumbnail[];
    totalVideoTokens: number;
  }> {
    const transcripts: Transcript[] = [];
    const thumbnails: Thumbnail[] = [];
    let totalVideoTokens = 0;

    for (const [index, video] of videos.entries()) {
      const videoUrl = videoUrls[index];
      if (!videoUrl) {
        throw new Error(`Missing videoUrl for index ${index} (video id: ${video.id})`);
      }

      const prompt = `Analyze this YouTube video: ${videoUrl}. 
      Task: Transcribe the video into structured JSON. 
      Include the full text and timed segments.`;

      const schema = {
        type: "object",
        properties: {
          videoId: { type: "string" },
          transcriptText: { type: "string" },
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start: { type: "number" },
                end: { type: "number" },
                text: { type: "string" }
              },
              required: ["start", "end", "text"]
            }
          }
        },
        required: ["videoId", "transcriptText", "segments"],
      };

      const model = 'gemini-2.5-flash';

      const result: any = await this.genAI.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0,
          maxOutputTokens: 30000
        },
      });

      let parsed = JSON.parse(result.text);

      if (!parsed) {
        throw new Error(`Gemini failed to return structured data for video ${video.id}`);
      }

      transcripts.push({
        videoId: video.id,
        transcriptText: parsed.transcriptText,
        segments: parsed.segments,
      });

      thumbnails.push({ videoId: video.id, thumbnailUrl: video.thumbnailUrl });

      totalVideoTokens += result?.usageMetadata?.totalTokenCount ?? 0;
    }

    return { transcripts, thumbnails, totalVideoTokens };
  }
}