import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import {
  calculateThumbnailCredits,
  THUMBNAIL_CREDIT_MULTIPLIER,
  TOKENS_PER_CREDIT,
  type ThumbnailRatio,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';

const BUCKET = 'thumbnails';
const MODEL = 'gemini-2.5-flash-image';

interface ThumbnailJobData {
  userId: string;
  thumbnailJobId: string;
  bullJobId: string;
  prompt: string;
  ratio: ThumbnailRatio;
  generateCount: number;
  referenceImageUrl?: string;
  faceImageUrl?: string;
  videoLink?: string;
  personalized: boolean;
}

interface StyleData {
  tone: string;
  visual_style: string;
  style_analysis: string;
  themes: string;
  pacing: string;
  recommendations: Record<string, string>;
  thumbnails?: Array<{ videoId: string; thumbnailUrl: string }>;
}

@Processor('thumbnail', { concurrency: 2 })
export class ThumbnailProcessor extends WorkerHost {
  private readonly logger = new Logger(ThumbnailProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor() {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
  }

  async process(job: Job<ThumbnailJobData>): Promise<{ imageUrls: string[] }> {
    const {
      userId, thumbnailJobId, bullJobId, prompt, ratio,
      generateCount, referenceImageUrl, faceImageUrl, videoLink, personalized,
    } = job.data;

    await job.updateProgress(0);
    await job.log('Starting thumbnail generation...');

    try {
      await this.updateJob(thumbnailJobId, { status: 'processing' });

      await job.updateProgress(5);
      const contextParts: any[] = [];

      if (personalized) {
        await job.log('Loading creator style profile...');
        contextParts.push(...await this.buildStyleParts(userId));
      }

      if (referenceImageUrl) {
        const img = await this.fetchAsInlineData(referenceImageUrl);
        if (img) {
          contextParts.push({ text: 'Reference image — match this style/composition:' }, img);
        }
      }

      if (faceImageUrl) {
        const img = await this.fetchAsInlineData(faceImageUrl);
        if (img) {
          contextParts.push({ text: 'Person/face — feature this person prominently:' }, img);
        }
      }

      await job.updateProgress(15);

      const videoContext = videoLink
        ? `\nThis thumbnail is for a YouTube video: ${videoLink}. Reflect the video's themes.`
        : '';

      const count = Math.min(generateCount || 3, 4);
      await job.log(`Generating ${count} thumbnail variations in parallel...`);

      const variationHints = [
        'Use bold close-up framing with dramatic lighting.',
        'Use a wider composition with dynamic angles and depth.',
        'Use a minimalist layout with strong typography and contrast.',
        'Use an energetic composition with vibrant split-tone colors.',
      ];

      const generateOne = async (index: number): Promise<{ url: string; tokens: number } | null> => {
        const hint = variationHints[index % variationHints.length];
        const textPrompt = `Expert YouTube thumbnail designer. Generate ONE high-quality, unique thumbnail image.

The image MUST be in ${ratio} aspect ratio (${this.ratioDimensions(ratio)}). This is critical — do not deviate.
Optimized for YouTube click-through rate.
Bold vibrant colors, dramatic composition, high contrast, cinematic lighting.
Variation directive: ${hint}
${videoContext}

${prompt}`;

        const parts: any[] = [{ text: textPrompt }, ...contextParts];

        const result: any = await this.genAI.models.generateContent({
          model: MODEL,
          contents: [{ role: 'user', parts }],
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(({ imageConfig: { aspectRatio: ratio } }) as any),
          },
        });

        const tokens: number = result?.usageMetadata?.totalTokenCount ?? 0;

        const imageData = result?.candidates?.[0]?.content?.parts
          ?.find((p: any) => p.inlineData?.data);

        if (!imageData) return null;

        const { data: b64, mimeType } = imageData.inlineData;
        const buffer = Buffer.from(b64, 'base64');
        const ext = mimeType?.includes('png') ? 'png' : 'jpg';
        const storagePath = `${userId}/jobs/${bullJobId}/generated/thumb_${index}.${ext}`;

        const { error: uploadError } = await this.supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, { contentType: mimeType || 'image/png' });

        if (uploadError) {
          this.logger.warn(`Upload failed for variation ${index}: ${uploadError.message}`);
          return null;
        }

        const { data: { publicUrl } } = this.supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        return { url: publicUrl, tokens };
      };

      const results = await Promise.allSettled(
        Array.from({ length: count }, (_, i) => generateOne(i)),
      );

      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<{ url: string; tokens: number } | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((v): v is { url: string; tokens: number } => v !== null);

      const imageUrls = succeeded.map(s => s.url);
      const totalConsumedTokens = succeeded.reduce((sum, s) => sum + s.tokens, 0);

      if (imageUrls.length === 0) throw new Error('All thumbnail variations failed to generate');

      await job.updateProgress(90);
      await job.log(`${imageUrls.length}/${count} thumbnails generated. Saving...`);

      const tokensPerCredit = this.getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
      const thumbnailMultiplier = this.getEnvNumber(
        'THUMBNAIL_CREDIT_MULTIPLIER',
        THUMBNAIL_CREDIT_MULTIPLIER,
      );
      const creditsToDeduct = calculateThumbnailCredits(
        { totalTokens: totalConsumedTokens },
        { tokensPerCredit, multiplier: thumbnailMultiplier },
      );
      this.logger.log(
        `Job ${bullJobId}: generated=${imageUrls.length}, tokens=${totalConsumedTokens}, tokensPerCredit=${tokensPerCredit}, multiplier=${thumbnailMultiplier}, credits=${creditsToDeduct}`,
      );

      const { error: creditError } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsToDeduct,
      });

      if (creditError) {
        this.logger.error(`Credit deduction failed for user ${userId}: ${creditError.message}`);
        await this.updateJob(thumbnailJobId, { status: 'failed', error_message: 'Insufficient credits' });
        throw new Error('Insufficient credits. Please upgrade your plan.');
      }
      this.logger.log(`Job ${bullJobId}: credits deducted successfully`);

      await this.updateJob(thumbnailJobId, {
        status: 'completed',
        image_urls: imageUrls,
        credits_consumed: creditsToDeduct,
      });
      this.logger.log(`Job ${bullJobId}: thumbnail_jobs row marked completed`);
      await job.updateProgress(100);
      await job.log(`Done! ${imageUrls.length} thumbnails, ${totalConsumedTokens} tokens consumed, ${creditsToDeduct} credits deducted.`);

      return { imageUrls };
    } catch (error: any) {
      await job.log(`Fatal error: ${error.message}`);
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      try {
        await this.updateJob(thumbnailJobId, {
          status: 'failed',
          error_message: error.message?.slice(0, 5000),
        });
      } catch (updateError: any) {
        this.logger.error(
          `Job ${job.id}: failed to persist failed status for thumbnail job ${thumbnailJobId}: ${updateError?.message}`,
          updateError?.stack,
        );
      }
      throw error;
    }
  }

  private async buildStyleParts(userId: string): Promise<any[]> {
    const parts: any[] = [];

    const { data: style } = await this.supabase
      .from('user_style')
      .select('tone, visual_style, style_analysis, themes, pacing, recommendations, thumbnails')
      .eq('user_id', userId)
      .single();

    if (!style) return parts;

    const s = style as StyleData;
    const styleText = [
      'CREATOR STYLE (match this visual identity):',
      s.visual_style ? `Visual: ${s.visual_style}` : '',
      s.style_analysis ? `Overall: ${s.style_analysis}` : '',
      s.tone ? `Tone: ${s.tone}` : '',
      s.themes ? `Themes: ${s.themes}` : '',
      s.recommendations?.thumbnails ? `Tips: ${s.recommendations.thumbnails}` : '',
    ].filter(Boolean).join('\n');

    parts.push({ text: styleText });

    // Past channel thumbnails as visual style references (up to 3)
    if (s.thumbnails?.length) {
      for (const thumb of s.thumbnails.slice(0, 3)) {
        const img = await this.fetchAsInlineData(thumb.thumbnailUrl);
        if (img) {
          parts.push({ text: 'Past channel thumbnail (style ref):' }, img);
        }
      }
    }

    return parts;
  }

  private async fetchAsInlineData(url: string): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: res.headers.get('content-type') || 'image/png',
        },
      };
    } catch {
      return null;
    }
  }

  private ratioDimensions(ratio: ThumbnailRatio): string {
    const map: Record<ThumbnailRatio, string> = {
      '16:9': 'wide landscape, e.g. 1280×720',
      '9:16': 'tall portrait, e.g. 720×1280',
      '1:1': 'square, e.g. 1024×1024',
      '4:3': 'landscape, e.g. 1024×768',
    };
    return map[ratio] || 'landscape';
  }

  private async updateJob(jobId: string, fields: Record<string, any>) {
    const { data, error } = await this.supabase
      .from('thumbnail_jobs')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update thumbnail_jobs id=${jobId}. fields=${Object.keys(fields).join(', ')} error=${error?.message ?? 'no rows updated (RLS or missing row)'}`,
      );
      throw new Error(`thumbnail_jobs update failed: ${error?.message ?? 'row not found or RLS blocked'}`);
    }
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
