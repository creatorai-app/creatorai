import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, reportError, SupabaseClient } from '@repo/supabase';
import {
  type VideoDuration,
  type ContentType,
  type StoryMode,
  type AudienceLevel,
  VIDEO_DURATION_LABELS,
  CONTENT_TYPE_LABELS,
  STORY_MODE_LABELS,
  AUDIENCE_LEVEL_LABELS,
  calculateStoryBuilderCredits,
  STORY_BUILDER_CREDIT_MULTIPLIER,
  TOKENS_PER_CREDIT,
  STORY_BLUEPRINT_RESPONSE_SCHEMA,
  buildStoryBlueprintPrompt,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';
import { getGenAI, GEMINI_TEXT_MODEL } from './utils/genai';

interface StoryBuilderJobData {
  userId: string;
  storyJobId: string;
  videoTopic: string;
  targetAudience: string;
  audienceLevel: AudienceLevel;
  videoDuration: VideoDuration;
  contentType: ContentType;
  storyMode: StoryMode;
  tone: string;
  additionalContext: string;
  personalized: boolean;
  ideationContext?: string;
}

interface UserStyleData {
  tone: string | null;
  vocabulary_level: string | null;
  pacing: string | null;
  themes: string | null;
  humor_style: string | null;
  structure: string | null;
  style_analysis: string | null;
  audience_engagement: string[] | null;
  recommendations: Record<string, string> | null;
  script_pacing: Record<string, any> | null;
  humor_frequency: string | null;
  direct_address_ratio: number | null;
  stats_usage: string | null;
  emotional_tone: string | null;
  avg_segment_length: number | null;
}

interface ChannelData {
  channel_name: string | null;
  channel_description: string | null;
  topic_details: any;
  default_language: string | null;
}

@Processor('story-builder', { concurrency: 3 })
export class StoryBuilderProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryBuilderProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor() {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = getGenAI();
  }

  async process(job: Job<StoryBuilderJobData>): Promise<{ result: any }> {
    const {
      userId, storyJobId, videoTopic, targetAudience, audienceLevel,
      videoDuration, contentType, storyMode, tone, additionalContext,
      personalized, ideationContext,
    } = job.data;

    let totalTokens = 0;
    await job.updateProgress(0);
    await job.log('Starting story structure generation...');

    try {
      await this.updateJobStatus(storyJobId, 'processing');
      await job.updateProgress(5);

      let styleData: UserStyleData | null = null;
      let channelData: ChannelData | null = null;

      if (personalized) {
        await job.log('Fetching your creator profile for personalized results...');
        const [styleResult, channelResult] = await Promise.all([
          this.supabase
            .from('user_style')
            .select('tone, vocabulary_level, pacing, themes, humor_style, structure, style_analysis, audience_engagement, recommendations, script_pacing, humor_frequency, direct_address_ratio, stats_usage, emotional_tone, avg_segment_length')
            .eq('user_id', userId)
            .single(),
          this.supabase
            .from('youtube_channels')
            .select('channel_name, channel_description, topic_details, default_language')
            .eq('user_id', userId)
            .single(),
        ]);

        if (!styleResult.error && styleResult.data) {
          styleData = styleResult.data as UserStyleData;
          await job.log('Creator style profile loaded (including pacing analysis)');
        }
        if (!channelResult.error && channelResult.data) {
          channelData = channelResult.data as ChannelData;
        }
      }

      await job.updateProgress(15);

      const prompt = this.buildPrompt(
        videoTopic, targetAudience, audienceLevel,
        VIDEO_DURATION_LABELS[videoDuration],
        CONTENT_TYPE_LABELS[contentType],
        STORY_MODE_LABELS[storyMode],
        tone, additionalContext, styleData, channelData, ideationContext,
      );

      await job.updateProgress(20);
      await job.log(styleData
        ? 'Generating personalized story blueprint with AI...'
        : 'Generating story blueprint with AI...');

      const response: any = await this.genAI.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: STORY_BLUEPRINT_RESPONSE_SCHEMA,
        },
      });

      totalTokens += response?.usageMetadata?.totalTokenCount ?? 0;

      await job.updateProgress(75);
      await job.log(`Parsing AI response (${totalTokens} tokens)...`);

      const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('AI returned an empty response');

      const result = JSON.parse(rawText);
      result.storyMode = storyMode;

      const tokensPerCredit = this.getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
      const storyBuilderMultiplier = this.getEnvNumber(
        'STORY_BUILDER_CREDIT_MULTIPLIER',
        STORY_BUILDER_CREDIT_MULTIPLIER,
      );
      const creditsConsumed = calculateStoryBuilderCredits(
        { totalTokens },
        { tokensPerCredit, multiplier: storyBuilderMultiplier },
      );

      await job.updateProgress(85);
      await job.log(`Saving results... (${creditsConsumed} credits)`);

      const { data: updated, error: updateError } = await this.supabase
        .from('story_builder_jobs')
        .update({
          status: 'completed',
          result,
          credits_consumed: creditsConsumed,
          total_tokens: totalTokens,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storyJobId)
        .select('id')
        .single();

      if (updateError || !updated) {
        this.logger.error(`story_builder_jobs completion update failed for id=${storyJobId}: ${updateError?.message ?? 'no rows updated'}`);
        throw new Error(`story_builder_jobs update failed: ${updateError?.message ?? 'row not found or RLS blocked'}`);
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
      await job.log('Story blueprint generated successfully!');

      return { result };
    } catch (error: any) {
      await job.log(`Fatal error: ${error.message}`);
      this.logger.error(`Story builder job ${job.id} failed: ${error.message}`, error.stack);

      void reportError(this.supabase, {
        source: 'worker',
        feature: 'story-builder',
        userId,
        error,
        context: { jobId: job.id, storyJobId, videoTopic, storyMode, contentType, videoDuration },
      });

      try {
        await this.updateJobStatus(storyJobId, 'failed', error.message?.slice(0, 5000));
      } catch (updateErr: any) {
        this.logger.error(`Failed to persist failed status for story job ${storyJobId}: ${updateErr?.message}`);
      }

      throw error;
    }
  }

  /**
   * Only the creator-profile block is built here. The rest of the prompt is
   * shared with the anonymous /tools sample so the two cannot drift.
   */
  private buildPrompt(
    videoTopic: string,
    targetAudience: string,
    audienceLevel: string,
    durationLabel: string,
    contentLabel: string,
    storyModeLabel: string,
    tone: string,
    additionalContext: string,
    styleData: UserStyleData | null,
    channelData: ChannelData | null,
    ideationContext?: string,
  ): string {
    const pacingSection = styleData?.script_pacing ? `
--- CREATOR'S SCRIPT PACING ANALYSIS ---
- Sentence Style: ${(styleData.script_pacing as any)?.sentenceStyle || 'N/A'}
- Humor Frequency: ${styleData.humor_frequency || 'N/A'}
- Direct Address vs Storytelling Ratio: ${styleData.direct_address_ratio != null ? `${Math.round(styleData.direct_address_ratio * 100)}% direct address` : 'N/A'}
- Use of Stats/Data: ${styleData.stats_usage || 'N/A'}
- Emotional Tone Baseline: ${styleData.emotional_tone || 'N/A'}
- Average Segment Length: ${styleData.avg_segment_length ? `~${Math.round(styleData.avg_segment_length)} seconds` : 'N/A'}
---` : '';

    const creatorSection = styleData ? `
--- CREATOR'S STYLE PROFILE ---
${channelData?.channel_name ? `- Channel: ${channelData.channel_name}` : ''}
${channelData?.channel_description ? `- Channel Description: ${channelData.channel_description}` : ''}
- Content Style: ${styleData.style_analysis || 'N/A'}
- Tone: ${styleData.tone || 'N/A'}
- Vocabulary: ${styleData.vocabulary_level || 'N/A'}
- Pacing: ${styleData.pacing || 'N/A'}
- Themes: ${styleData.themes || 'N/A'}
- Humor Style: ${styleData.humor_style || 'N/A'}
- Narrative Structure: ${styleData.structure || 'N/A'}
- Audience Engagement: ${styleData.audience_engagement?.join(', ') || 'N/A'}
${styleData.recommendations?.story_builder ? `- Story Builder Recs: ${styleData.recommendations.story_builder}` : ''}
${pacingSection}

IMPORTANT: Adapt ALL elements to match this creator's established style.
---` : '';

    return buildStoryBlueprintPrompt({
      videoTopic,
      durationLabel,
      contentLabel,
      storyModeLabel,
      audienceLevel,
      targetAudience,
      tone,
      additionalContext,
      ideationContext,
      creatorSection,
    });
  }

  private async updateJobStatus(jobId: string, status: string, errorMessage?: string) {
    const fields: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (errorMessage !== undefined) fields.error_message = errorMessage;

    const { data, error } = await this.supabase
      .from('story_builder_jobs')
      .update(fields)
      .eq('id', jobId)
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(`story_builder_jobs status update failed for id=${jobId}: ${error?.message ?? 'no rows updated'}`);
    }
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
