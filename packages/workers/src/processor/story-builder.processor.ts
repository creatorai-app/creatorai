import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
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
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';

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

const BLUEPRINT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    structuredBlueprint: {
      type: 'object',
      properties: {
        hook: {
          type: 'object',
          properties: {
            curiosityStatement: { type: 'string', description: 'A statement that sparks curiosity in the first 5 seconds' },
            promise: { type: 'string', description: 'What the viewer will gain by watching' },
            stakes: { type: 'string', description: 'What is at risk or why this matters now' },
            openingLine: { type: 'string', description: 'Exact opening script line' },
            visualSuggestion: { type: 'string', description: 'What viewer should see during hook (0-15 sec)' },
            emotionalTrigger: { type: 'string', description: 'Primary emotion targeted' },
          },
          required: ['curiosityStatement', 'promise', 'stakes', 'openingLine', 'visualSuggestion', 'emotionalTrigger'],
        },
        contextSetup: {
          type: 'object',
          properties: {
            problem: { type: 'string', description: 'The core problem or question (15-45 sec)' },
            whyItMatters: { type: 'string', description: 'Why the viewer should care about this now' },
            backgroundInfo: { type: 'string', description: 'Essential context to understand the topic' },
          },
          required: ['problem', 'whyItMatters', 'backgroundInfo'],
        },
        escalationSegments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              segmentNumber: { type: 'number' },
              title: { type: 'string' },
              microHook: { type: 'string', description: 'Mini-hook to re-engage attention at start of segment' },
              insight: { type: 'string', description: 'Core insight or value delivered' },
              transitionTension: { type: 'string', description: 'How this segment creates tension leading into the next' },
              estimatedDuration: { type: 'string' },
            },
            required: ['segmentNumber', 'title', 'microHook', 'insight', 'transitionTension', 'estimatedDuration'],
          },
          minItems: 3,
        },
        climax: {
          type: 'object',
          properties: {
            biggestInsight: { type: 'string', description: 'The most impactful revelation' },
            unexpectedTwist: { type: 'string', description: 'Surprising angle or counter-intuitive point' },
            coreValueMoment: { type: 'string', description: 'The deeper meaning or takeaway' },
          },
          required: ['biggestInsight', 'unexpectedTwist', 'coreValueMoment'],
        },
        resolution: {
          type: 'object',
          properties: {
            closeLoop: { type: 'string', description: 'How the opening promise is fulfilled' },
            reinforceTransformation: { type: 'string', description: 'Restate what viewer now knows/can do' },
            softCTA: { type: 'string', description: 'Natural call-to-action that fits the narrative' },
          },
          required: ['closeLoop', 'reinforceTransformation', 'softCTA'],
        },
      },
      required: ['hook', 'contextSetup', 'escalationSegments', 'climax', 'resolution'],
    },
    tensionMapping: {
      type: 'object',
      properties: {
        retentionScore: { type: 'number', description: 'Overall predicted retention 0-10' },
        curiosityLoops: { type: 'number', description: 'Number of curiosity loops planted' },
        emotionalPeaks: { type: 'number', description: 'Number of emotional high points' },
        predictedDropRisk: { type: 'string', description: 'low, medium, or high' },
        sectionScores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section: { type: 'string' },
              curiosityDensity: { type: 'number', description: '0-10 score' },
              emotionalShift: { type: 'number', description: '0-10 score' },
              informationSpike: { type: 'number', description: '0-10 score' },
              overallScore: { type: 'number', description: '0-10 score' },
            },
            required: ['section', 'curiosityDensity', 'emotionalShift', 'informationSpike', 'overallScore'],
          },
        },
      },
      required: ['retentionScore', 'curiosityLoops', 'emotionalPeaks', 'predictedDropRisk', 'sectionScores'],
    },
    retentionBeats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['timestamp', 'type', 'description'],
      },
      minItems: 4,
    },
    openLoops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          setup: { type: 'string' },
          payoffTimestamp: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['setup', 'payoffTimestamp', 'description'],
      },
      minItems: 2,
    },
    patternInterrupts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['timestamp', 'type', 'description'],
      },
      minItems: 4,
    },
    emotionalArc: {
      type: 'object',
      properties: {
        structure: { type: 'string' },
        beats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phase: { type: 'string' },
              emotion: { type: 'string' },
              timestamp: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['phase', 'emotion', 'timestamp', 'description'],
          },
          minItems: 4,
        },
      },
      required: ['structure', 'beats'],
    },
    ctaPlacement: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          type: { type: 'string' },
          script: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['timestamp', 'type', 'script', 'rationale'],
      },
      minItems: 2,
    },
    storyPacing: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              duration: { type: 'string' },
              pace: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['name', 'duration', 'pace', 'description'],
          },
          minItems: 4,
        },
      },
      required: ['overview', 'sections'],
    },
    fullOutline: {
      type: 'string',
      description: 'Complete production outline incorporating all blueprint sections. Modular, not free-flow. Min 300 words.',
    },
    detectedContentType: {
      type: 'string',
      description: 'AI-detected best content type for this topic if different from user selection',
    },
  },
  required: [
    'structuredBlueprint', 'tensionMapping', 'retentionBeats', 'openLoops',
    'patternInterrupts', 'emotionalArc', 'ctaPlacement', 'storyPacing', 'fullOutline',
  ],
} as const;

@Processor('story-builder', { concurrency: 3 })
export class StoryBuilderProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryBuilderProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor() {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
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
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: BLUEPRINT_RESPONSE_SCHEMA,
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

      try {
        await this.updateJobStatus(storyJobId, 'failed', error.message?.slice(0, 5000));
      } catch (updateErr: any) {
        this.logger.error(`Failed to persist failed status for story job ${storyJobId}: ${updateErr?.message}`);
      }

      throw error;
    }
  }

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

    return `You are an expert YouTube content strategist specializing in story structure and retention optimization. Generate a comprehensive, MODULAR (not free-flow) story blueprint.

**Video Topic:** ${videoTopic}
**Structure Template:** ${contentLabel}
**Story Mode:** ${storyModeLabel}
**Video Duration:** ${durationLabel}
**Audience Level:** ${audienceLevel}
${targetAudience ? `**Target Audience:** ${targetAudience}` : ''}
${tone ? `**Desired Tone:** ${tone}` : ''}
${additionalContext ? `**Additional Context:** ${additionalContext}` : ''}
${ideationContext ? `**Idea Context from Ideation:** ${ideationContext}` : ''}
${creatorSection}

STORY MODE "${storyModeLabel}" means:
- Cinematic: Dramatic visuals, slow reveals, epic tone, wide establishing shots
- High-Energy: Fast cuts, bold statements, rapid pacing, high intensity
- Documentary: Facts-first, interviews-style, measured pacing, authoritative
- Conversational: Casual, direct-to-camera, personal, relatable, as if talking to a friend
- Dramatic: Tension-heavy, cliffhangers, emotional peaks, suspenseful reveals
- Minimal: Clean, simple, essential info only, no fluff, elegant pacing

STRUCTURE TEMPLATE "${contentLabel}" shapes the escalation segments:
- Educational Breakdown: Progressive complexity, concept stacking
- Commentary: Opinion-led, reaction-driven, hot takes with evidence
- Documentary: Evidence gathering → reveal → impact → implications
- Case Study: Setup → investigation → findings → lessons → application
- Personal Story: Situation → struggle → turning point → transformation
- Listicle: Ranked items with escalating value, each standalone
- Tutorial: Setup → step-by-step → common mistakes → pro tips

REQUIREMENTS:
1. **Structured Blueprint** must be MODULAR with:
   - Hook (0-15 sec): curiosity statement, promise, stakes
   - Context Setup (15-45 sec): problem, why it matters
   - Escalation: 3-5 segments, each with micro-hook, insight, transition tension
   - Climax: biggest insight, unexpected twist, core value moment
   - Resolution + Callback: close loop, reinforce transformation, soft CTA

2. **Tension Mapping** must calculate:
   - retentionScore (0-10 overall)
   - curiosityLoops count
   - emotionalPeaks count
   - predictedDropRisk (low/medium/high)
   - Per-section scores for curiosityDensity, emotionalShift, informationSpike (each 0-10)

3. Retention beats (4-6), open loops (2-4), pattern interrupts (4-6), emotional arc (4-6 phases), CTAs (2-3, never first 30s), pacing sections (4-6)

4. fullOutline must be modular and detailed (300+ words), not free-flow text

5. If the chosen content type doesn't fit the topic well, suggest a better one in detectedContentType

6. All timestamps must be realistic for ${durationLabel}`;
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
