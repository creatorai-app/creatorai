import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import {
  calculateCreditsFromTokens,
  SCRIPT_CREDIT_MULTIPLIER,
  TOKENS_PER_CREDIT,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';

interface ScriptJobData {
  userId: string;
  scriptJobId: string;
  prompt: string;
  context: string;
  tone: string;
  language: string;
  duration: string;
  includeStorytelling: boolean;
  includeTimestamps: boolean;
  references: string;
  personalized: boolean;
  fileUrls: string[];
}

interface UserStyleData {
  tone: string | null;
  vocabulary_level: string | null;
  pacing: string | null;
  themes: string | null;
  humor_style: string | null;
  structure: string | null;
  style_analysis: string | null;
  recommendations: Record<string, string> | null;
}

interface ChannelData {
  channel_name: string | null;
  channel_description: string | null;
  topic_details: any;
  default_language: string | null;
}

const SCRIPT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Suggested script title' },
    script: { type: 'string', description: 'Full script in markdown format' },
  },
  required: ['title', 'script'],
} as const;

@Processor('script', { concurrency: 3 })
export class ScriptProcessor extends WorkerHost {
  private readonly logger = new Logger(ScriptProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor() {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
  }

  async process(job: Job<ScriptJobData>): Promise<{ title: string; script: string; creditsConsumed: number }> {
    const {
      userId, scriptJobId, prompt, context, tone, language,
      duration, includeStorytelling, includeTimestamps,
      references, personalized, fileUrls,
    } = job.data;

    await job.updateProgress(0);
    await job.log('Starting script generation...');

    try {
      await this.updateJobStatus(scriptJobId, 'processing');
      await job.updateProgress(5);

      let styleData: UserStyleData | null = null;
      let channelData: ChannelData | null = null;

      if (personalized) {
        await job.log('Loading creator profile for personalization...');
        const [styleResult, channelResult] = await Promise.all([
          this.supabase
            .from('user_style')
            .select('tone, vocabulary_level, pacing, themes, humor_style, structure, style_analysis, recommendations')
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
          await job.log('Creator style profile loaded');
        }
        if (!channelResult.error && channelResult.data) {
          channelData = channelResult.data as ChannelData;
        }
      }

      await job.updateProgress(15);
      await job.log('Building prompt...');

      const geminiPrompt = this.buildPrompt(
        prompt, context, tone, language, duration,
        includeStorytelling, includeTimestamps, references,
        styleData, channelData,
      );

      const parts: any[] = [{ text: geminiPrompt }];

      if (fileUrls.length > 0) {
        for (const url of fileUrls) {
          parts.push({ text: `Consider this uploaded reference file: ${url}` });
        }
      }

      await job.updateProgress(25);
      await job.log(styleData ? 'Generating personalized script with AI...' : 'Generating script with AI...');

      const response: any = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: SCRIPT_RESPONSE_SCHEMA,
        },
      });

      const totalTokens = response?.usageMetadata?.totalTokenCount ?? 0;

      await job.updateProgress(75);
      await job.log(`Parsing AI response (${totalTokens} tokens used)...`);

      const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('AI returned an empty response');

      const result = JSON.parse(rawText) as { title: string; script: string };

      const tokensPerCredit = this.getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
      const scriptMultiplier = this.getEnvNumber('SCRIPT_CREDIT_MULTIPLIER', SCRIPT_CREDIT_MULTIPLIER);
      const creditsConsumed = calculateCreditsFromTokens(
        { totalTokens },
        { tokensPerCredit, multiplier: scriptMultiplier, minimumCredits: 1 },
      );

      await job.updateProgress(85);
      await job.log(`Saving script... (${creditsConsumed} credits)`);

      await this.supabase
        .from('scripts')
        .update({
          title: result.title,
          content: result.script,
          status: 'completed',
          credits_consumed: creditsConsumed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scriptJobId);

      const { error: creditError } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsConsumed,
      });

      if (creditError) {
        this.logger.warn(`Credit deduction failed for user ${userId} (${creditsConsumed} credits): ${creditError.message}`);
        await job.log(`Warning: credit deduction failed — ${creditError.message}`);
      }

      await job.updateProgress(100);
      await job.log('Script generated successfully!');

      return { title: result.title, script: result.script, creditsConsumed };
    } catch (error: any) {
      await job.log(`Fatal error: ${error.message}`);
      this.logger.error(`Script job ${job.id} failed: ${error.message}`, error.stack);

      await this.supabase
        .from('scripts')
        .update({
          status: 'failed',
          error_message: error.message?.slice(0, 5000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', scriptJobId);

      throw error;
    }
  }

  private buildPrompt(
    prompt: string, context: string, tone: string, language: string,
    duration: string, includeStorytelling: boolean, includeTimestamps: boolean,
    references: string, styleData: UserStyleData | null, channelData: ChannelData | null,
  ): string {
    const creatorSection = styleData ? `
--- CREATOR'S STYLE PROFILE ---
${channelData?.channel_name ? `- Channel: ${channelData.channel_name}` : ''}
${channelData?.channel_description ? `- Channel Description: ${channelData.channel_description}` : ''}
- Content Style: ${styleData.style_analysis || 'N/A'}
- Typical Tone: ${styleData.tone || 'N/A'}
- Vocabulary Level: ${styleData.vocabulary_level || 'N/A'}
- Pacing: ${styleData.pacing || 'N/A'}
- Themes: ${styleData.themes || 'N/A'}
- Humor Style: ${styleData.humor_style || 'N/A'}
- Narrative Structure: ${styleData.structure || 'N/A'}
${styleData.recommendations?.script_generation ? `- Script Recommendations: ${styleData.recommendations.script_generation}` : ''}

IMPORTANT: Adapt the script to match this creator's established style, tone, and voice.
---
` : '';

    return `You are an expert YouTube script writer. Generate a compelling, engaging YouTube video script.

**Prompt:** ${prompt}
${context ? `**Additional Context:** ${context}` : ''}
**Tone:** ${tone}
**Language:** ${language}
**Target Duration:** ${duration} seconds
**Include Storytelling Elements:** ${includeStorytelling ? 'Yes' : 'No'}
**Include Timestamps:** ${includeTimestamps ? 'Yes' : 'No'}
${references ? `**Reference Links/Sources:** ${references}` : ''}
${creatorSection}
Guidelines:
- Generate a catchy, SEO-friendly title
- Write the full script in markdown format
- Match the target duration (approximately ${Math.round(parseInt(duration) / 60)} minutes)
- Include hooks, transitions, and a strong call-to-action
- If timestamps requested, add time markers
- If storytelling requested, weave narrative elements throughout
- Make it engaging, natural, and ready to read on camera`;
  }

  private async updateJobStatus(jobId: string, status: string) {
    await this.supabase
      .from('scripts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
