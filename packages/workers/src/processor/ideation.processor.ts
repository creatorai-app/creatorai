import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import {
  type ChannelIntelligence,
  type IdeationIdea,
  type IdeationResult,
  type TrendSnapshot,
  type ChannelFit,
  calculateIdeationCredits,
  IDEATION_CREDIT_MULTIPLIER,
  TOKENS_PER_CREDIT,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

interface IdeationJobData {
  userId: string;
  ideationJobId: string;
  context: string;
  nicheFocus: string;
  ideaCount: number;
  autoMode: boolean;
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
  channel_intelligence: ChannelIntelligence | null;
}

interface ChannelData {
  channel_name: string | null;
  channel_description: string | null;
  topic_details: any;
  default_language: string | null;
  channel_id: string | null;
}

const TREND_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    trendingTopics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          momentum: { type: 'number', description: 'Score from 0-100 indicating trend velocity' },
        },
        required: ['topic', 'momentum'],
      },
    },
    saturatedTopics: { type: 'array', items: { type: 'string' } },
    earlySignals: { type: 'array', items: { type: 'string' }, description: 'Low volume + high velocity emerging trends' },
    nicheGaps: { type: 'array', items: { type: 'string' }, description: 'Under-served subtopics in this niche' },
    competitorInsights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          views: { type: 'number' },
          url: { type: 'string' },
        },
        required: ['title', 'views', 'url'],
      },
    },
  },
  required: ['trendingTopics', 'saturatedTopics', 'earlySignals', 'nicheGaps', 'competitorInsights'],
} as const;

const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string', description: 'Primary video title' },
          titleVariations: { type: 'array', items: { type: 'string' }, description: '2-3 alternative title options' },
          coreTopic: { type: 'string' },
          uniqueAngle: { type: 'string', description: 'What makes this different from existing content' },
          whyItWorks: { type: 'string', description: 'Trend insight + audience psychology explanation' },
          hookAngle: { type: 'string', description: 'First 15 second concept/opening' },
          targetKeywords: { type: 'array', items: { type: 'string' } },
          suggestedFormat: { type: 'string', description: 'Tutorial, Breakdown, Commentary, Case Study, Listicle, How-to, Comparison, Reaction' },
          talkingPoints: { type: 'array', items: { type: 'string' }, description: 'Key points to cover in the video' },
          referenceSignals: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, url: { type: 'string' } },
              required: ['title', 'url'],
            },
          },
          searchIntentSummary: { type: 'string', description: 'What viewers are searching for and why this meets their need' },
          opportunityScore: { type: 'number', description: 'Score 0-100 based on trend momentum, competition gap, and channel fit' },
          trendMomentum: { type: 'string', description: 'rising, stable, or declining' },
        },
        required: [
          'id', 'title', 'titleVariations', 'coreTopic', 'uniqueAngle', 'whyItWorks',
          'hookAngle', 'targetKeywords', 'suggestedFormat', 'talkingPoints',
          'referenceSignals', 'searchIntentSummary', 'opportunityScore', 'trendMomentum',
        ],
      },
    },
    channelFit: {
      type: 'object',
      properties: {
        bestFormats: { type: 'array', items: { type: 'string' } },
        contentGaps: { type: 'array', items: { type: 'string' } },
        titlePatterns: { type: 'array', items: { type: 'string' } },
      },
      required: ['bestFormats', 'contentGaps', 'titlePatterns'],
    },
  },
  required: ['ideas', 'channelFit'],
} as const;

const DIFFERENTIATION_SCHEMA = {
  type: 'object',
  properties: {
    refinedIdeas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          titleVariations: { type: 'array', items: { type: 'string' } },
          coreTopic: { type: 'string' },
          uniqueAngle: { type: 'string' },
          whyItWorks: { type: 'string' },
          hookAngle: { type: 'string' },
          targetKeywords: { type: 'array', items: { type: 'string' } },
          suggestedFormat: { type: 'string' },
          talkingPoints: { type: 'array', items: { type: 'string' } },
          referenceSignals: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, url: { type: 'string' } },
              required: ['title', 'url'],
            },
          },
          searchIntentSummary: { type: 'string' },
          opportunityScore: { type: 'number' },
          trendMomentum: { type: 'string' },
        },
        required: [
          'id', 'title', 'titleVariations', 'coreTopic', 'uniqueAngle', 'whyItWorks',
          'hookAngle', 'targetKeywords', 'suggestedFormat', 'talkingPoints',
          'referenceSignals', 'searchIntentSummary', 'opportunityScore', 'trendMomentum',
        ],
      },
    },
  },
  required: ['refinedIdeas'],
} as const;

@Processor('ideation', { concurrency: 2 })
export class IdeationProcessor extends WorkerHost {
  private readonly logger = new Logger(IdeationProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor() {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
  }

  async process(job: Job<IdeationJobData>): Promise<{ result: IdeationResult }> {
    const { userId, ideationJobId, context, nicheFocus, ideaCount, autoMode } = job.data;
    let totalTokens = 0;

    await job.updateProgress(0);
    await job.log('Starting ideation pipeline...');

    try {
      await this.updateJobStatus(ideationJobId, 'processing');

      // ── Stage 1: Load Channel Intelligence ──
      await job.updateProgress(5);
      await job.log('Loading channel intelligence...');

      const [styleResult, channelResult, pastJobsResult] = await Promise.all([
        this.supabase
          .from('user_style')
          .select('tone, vocabulary_level, pacing, themes, humor_style, structure, style_analysis, audience_engagement, recommendations, channel_intelligence')
          .eq('user_id', userId)
          .single(),
        this.supabase
          .from('youtube_channels')
          .select('channel_name, channel_description, topic_details, default_language, channel_id')
          .eq('user_id', userId)
          .single(),
        this.supabase
          .from('ideation_jobs')
          .select('result')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const styleData = (!styleResult.error && styleResult.data) ? styleResult.data as UserStyleData : null;
      const channelData = (!channelResult.error && channelResult.data) ? channelResult.data as ChannelData : null;
      const intelligence = styleData?.channel_intelligence || null;

      const pastIdeas = (pastJobsResult.data || [])
        .filter((j: any) => j.result?.ideas)
        .flatMap((j: any) => j.result.ideas.map((i: any) => i.title));

      await job.updateProgress(10);
      await job.log(intelligence ? 'Channel intelligence loaded' : 'No channel intelligence found — using basic profile');

      // ── Stage 2: Trend Intelligence ──
      await job.log('Gathering trend intelligence...');

      const nicheKeywords = this.buildNicheKeywords(nicheFocus, channelData, intelligence);
      let ytTrendingVideos: { title: string; views: number; url: string }[] = [];

      try {
        ytTrendingVideos = await this.fetchYouTubeTrending(nicheKeywords, channelData?.default_language || 'en');
        await job.log(`Found ${ytTrendingVideos.length} trending niche videos`);
      } catch (e) {
        await job.log('YouTube trending fetch failed — continuing with Gemini Search only');
      }

      await job.updateProgress(20);

      const trendPrompt = this.buildTrendPrompt(nicheKeywords, ytTrendingVideos, channelData, intelligence);
      const trendResult: any = await this.genAI.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: trendPrompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseJsonSchema: TREND_RESPONSE_SCHEMA,
        },
      });

      totalTokens += trendResult?.usageMetadata?.totalTokenCount ?? 0;
      const trendRawText = trendResult?.candidates?.[0]?.content?.parts?.[0]?.text ?? trendResult?.text;
      let trendSnapshot: TrendSnapshot;
      try {
        trendSnapshot = JSON.parse(trendRawText);
      } catch {
        trendSnapshot = { trendingTopics: [], saturatedTopics: [], earlySignals: [], nicheGaps: [], competitorInsights: [] };
        await job.log('Warning: trend parsing failed — using empty snapshot');
      }

      if (ytTrendingVideos.length && !trendSnapshot.competitorInsights?.length) {
        trendSnapshot.competitorInsights = ytTrendingVideos.slice(0, 10);
      }

      await job.updateProgress(40);
      await job.log(`Trend intelligence gathered: ${trendSnapshot.trendingTopics.length} trends, ${trendSnapshot.earlySignals.length} early signals`);

      // ── Stage 3: Idea Synthesis ──
      await job.log('Synthesizing ideas...');

      const synthesisPrompt = this.buildSynthesisPrompt(
        ideaCount, context, nicheFocus, autoMode,
        styleData, channelData, intelligence, trendSnapshot, pastIdeas,
      );

      const synthesisResult: any = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: IDEA_SCHEMA,
        },
      });

      totalTokens += synthesisResult?.usageMetadata?.totalTokenCount ?? 0;
      const synthesisRawText = synthesisResult?.candidates?.[0]?.content?.parts?.[0]?.text ?? synthesisResult?.text;
      let synthesisData: { ideas: IdeationIdea[]; channelFit: ChannelFit };
      try {
        synthesisData = JSON.parse(synthesisRawText);
      } catch {
        throw new Error('Failed to parse idea synthesis response');
      }

      await job.updateProgress(70);
      await job.log(`${synthesisData.ideas.length} ideas synthesized`);

      // ── Stage 4: Differentiation Check ──
      await job.log('Running differentiation check...');

      let finalIdeas = synthesisData.ideas;
      if (pastIdeas.length > 0 || trendSnapshot.competitorInsights.length > 0) {
        const diffPrompt = this.buildDifferentiationPrompt(
          synthesisData.ideas, pastIdeas, trendSnapshot,
        );

        const diffResult: any = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: diffPrompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: DIFFERENTIATION_SCHEMA,
          },
        });

        totalTokens += diffResult?.usageMetadata?.totalTokenCount ?? 0;
        const diffRawText = diffResult?.candidates?.[0]?.content?.parts?.[0]?.text ?? diffResult?.text;
        try {
          const diffData = JSON.parse(diffRawText);
          if (diffData.refinedIdeas?.length) {
            finalIdeas = diffData.refinedIdeas;
          }
        } catch {
          await job.log('Warning: differentiation parsing failed — using original ideas');
        }
      } else {
        await job.log('No past content for deduplication — skipping differentiation');
      }

      await job.updateProgress(85);
      await job.log('Differentiation complete');

      // ── Stage 5: Save & Deduct ──
      await job.log('Saving results and deducting credits...');

      const tokensPerCredit = this.getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
      const ideationMultiplier = this.getEnvNumber(
        'IDEATION_CREDIT_MULTIPLIER',
        IDEATION_CREDIT_MULTIPLIER,
      );
      const creditsConsumed = calculateIdeationCredits(
        { totalTokens },
        { tokensPerCredit, multiplier: ideationMultiplier },
      );

      const ideationResult: IdeationResult = {
        ideas: finalIdeas,
        trendSnapshot,
        channelFit: synthesisData.channelFit,
        metadata: {
          generatedAt: new Date().toISOString(),
          creditsConsumed,
          totalTokens,
        },
      };

      await this.supabase
        .from('ideation_jobs')
        .update({
          status: 'completed',
          result: ideationResult,
          trend_snapshot: trendSnapshot,
          credits_consumed: creditsConsumed,
          total_tokens: totalTokens,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ideationJobId);

      const { error: creditError } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsConsumed,
      });

      if (creditError) {
        this.logger.warn(`Credit deduction failed for user ${userId} (${creditsConsumed} credits): ${creditError.message}`);
        await job.log(`Warning: credit deduction failed — ${creditError.message}`);
      }

      await job.updateProgress(100);
      await job.log(`Ideation complete! ${finalIdeas.length} ideas generated. ${creditsConsumed} credits consumed.`);

      return { result: ideationResult };
    } catch (error: any) {
      await job.log(`Fatal error: ${error.message}`);
      this.logger.error(`Ideation job ${job.id} failed: ${error.message}`, error.stack);

      await this.supabase
        .from('ideation_jobs')
        .update({
          status: 'failed',
          error_message: error.message?.slice(0, 5000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ideationJobId);

      throw error;
    }
  }

  private buildNicheKeywords(
    nicheFocus: string,
    channelData: ChannelData | null,
    intelligence: ChannelIntelligence | null,
  ): string {
    const parts: string[] = [];
    if (nicheFocus) parts.push(nicheFocus);
    if (channelData?.channel_description) parts.push(channelData.channel_description.slice(0, 200));
    if (intelligence?.topicClusters?.length) parts.push(intelligence.topicClusters.slice(0, 5).join(', '));
    if (channelData?.topic_details) {
      const topics = channelData.topic_details?.topicCategories || channelData.topic_details;
      if (Array.isArray(topics)) parts.push(topics.join(', '));
    }
    return parts.join(' | ') || 'general content creation';
  }

  private async fetchYouTubeTrending(
    nicheKeywords: string,
    language: string,
  ): Promise<{ title: string; views: number; url: string }[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return [];

    const searchQuery = nicheKeywords.split('|')[0]?.trim().slice(0, 100) || 'trending';
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: searchQuery,
        type: 'video',
        order: 'viewCount',
        publishedAfter: thirtyDaysAgo,
        relevanceLanguage: language,
        maxResults: 15,
        key: apiKey,
      },
      timeout: 15000,
    });

    const videoIds = (searchRes.data.items || [])
      .map((item: any) => item.id?.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) return [];

    const videoRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'statistics,snippet', id: videoIds, key: apiKey },
      timeout: 15000,
    });

    return (videoRes.data.items || []).map((v: any) => ({
      title: v.snippet?.title || '',
      views: parseInt(v.statistics?.viewCount || '0', 10),
      url: `https://www.youtube.com/watch?v=${v.id}`,
    }));
  }

  private buildTrendPrompt(
    nicheKeywords: string,
    ytVideos: { title: string; views: number; url: string }[],
    channelData: ChannelData | null,
    intelligence: ChannelIntelligence | null,
  ): string {
    return `You are a YouTube trend analyst. Analyze current trends for this niche and return structured trend intelligence.

NICHE: ${nicheKeywords}
${channelData?.channel_name ? `CHANNEL: ${channelData.channel_name}` : ''}
${intelligence?.topicClusters?.length ? `CREATOR'S TOPIC CLUSTERS: ${intelligence.topicClusters.join(', ')}` : ''}

${ytVideos.length ? `RECENTLY VIRAL VIDEOS IN NICHE (last 30 days):
${ytVideos.map(v => `- "${v.title}" (${v.views.toLocaleString()} views) ${v.url}`).join('\n')}` : ''}

Research and return:
1. **trendingTopics**: Current trending topics in this niche with momentum score (0-100). Momentum = velocity of growth, not just volume. A topic going from 100 to 1000 searches has higher momentum than one stable at 50,000.
2. **saturatedTopics**: Topics that are overcrowded (high volume, many competitors, declining novelty). Creators should avoid these.
3. **earlySignals**: Emerging trends with low current volume but high growth velocity. These are the golden opportunities.
4. **nicheGaps**: Specific subtopics that audiences search for but few creators cover well.
5. **competitorInsights**: Recently viral videos in this niche with title, approximate views, and URL.

Search Google Trends, Reddit discussions, Twitter/X conversations, and YouTube for the most current data. Focus on velocity over volume.`;
  }

  private buildSynthesisPrompt(
    ideaCount: number,
    context: string,
    nicheFocus: string,
    autoMode: boolean,
    styleData: UserStyleData | null,
    channelData: ChannelData | null,
    intelligence: ChannelIntelligence | null,
    trendSnapshot: TrendSnapshot,
    pastIdeas: string[],
  ): string {
    const creatorDNA = styleData ? `
--- CREATOR DNA ---
Channel: ${channelData?.channel_name || 'Unknown'}
Description: ${channelData?.channel_description || 'N/A'}
Tone: ${styleData.tone || 'conversational'}
Vocabulary: ${styleData.vocabulary_level || 'general'}
Pacing: ${styleData.pacing || 'moderate'}
Themes: ${styleData.themes || 'N/A'}
Humor: ${styleData.humor_style || 'N/A'}
Structure: ${styleData.structure || 'N/A'}
Style Analysis: ${styleData.style_analysis || 'N/A'}
${intelligence ? `
Avg Views: ${intelligence.avgViews}
Best Formats: ${intelligence.bestFormats?.join(', ') || 'N/A'}
Title Patterns (common words): ${intelligence.titlePatterns?.slice(0, 10).join(', ') || 'N/A'}
Title Fingerprints (structural): ${intelligence.titleFingerprints?.join(', ') || 'N/A'}
Content Gaps: ${intelligence.contentGaps?.join(', ') || 'N/A'}
Upload Frequency: Every ${intelligence.uploadFrequencyDays} days
Top Videos: ${intelligence.topVideos?.slice(0, 5).map(v => `"${v.title}" (${v.views} views)`).join(', ') || 'N/A'}
` : ''}---` : '';

    const trendContext = `
--- TREND INTELLIGENCE ---
Trending Topics: ${trendSnapshot.trendingTopics.map(t => `${t.topic} (momentum: ${t.momentum})`).join(', ')}
Early Signals: ${trendSnapshot.earlySignals.join(', ') || 'None detected'}
Niche Gaps: ${trendSnapshot.nicheGaps.join(', ') || 'None detected'}
Saturated (AVOID): ${trendSnapshot.saturatedTopics.join(', ') || 'None'}
Competitor Viral: ${trendSnapshot.competitorInsights.slice(0, 5).map(c => `"${c.title}" (${c.views} views)`).join(', ') || 'None'}
---`;

    return `You are an expert YouTube content strategist. Generate exactly ${ideaCount} unique, high-potential video ideas.

${creatorDNA}
${trendContext}
${nicheFocus ? `NICHE FOCUS: ${nicheFocus}` : ''}
${context ? `ADDITIONAL CONTEXT: ${context}` : ''}
${autoMode ? 'MODE: Auto — pick the best opportunities based on channel data and trends.' : ''}
${pastIdeas.length ? `PREVIOUSLY GENERATED IDEAS (DO NOT REPEAT): ${pastIdeas.join(' | ')}` : ''}

RULES:
- Each idea must combine: Creator DNA + Niche Trends + Under-served subtopics + Unique angle + Format fit
- Prioritize early signals and niche gaps over saturated topics
- NEVER suggest topics from the "Saturated" list unless you have a genuinely unique micro-angle
- opportunityScore (0-100) should reflect: trend momentum (40%), competition gap (30%), channel fit (30%)
- trendMomentum must be "rising", "stable", or "declining"
- hookAngle: Describe a specific opening concept for the first 15 seconds
- referenceSignals: Include 2-3 real URLs to trending content, discussions, or data that support this idea
- suggestedFormat: Pick the best format for this specific idea (Tutorial, Breakdown, Commentary, Case Study, Listicle, How-to, Comparison, Reaction)
- talkingPoints: 5-8 key points that structure the video
- titleVariations: 2-3 alternative titles optimized for CTR. If Title Fingerprints are available, use those structural patterns (e.g., "How to [X]", "[Number] Ways to [Y]") to match the creator's proven title style.
- searchIntentSummary: What specific search queries this video answers

Also provide channelFit with bestFormats, contentGaps, and titlePatterns for this creator.`;
  }

  private buildDifferentiationPrompt(
    ideas: IdeationIdea[],
    pastIdeas: string[],
    trendSnapshot: TrendSnapshot,
  ): string {
    return `You are a content differentiation specialist. Review these video ideas and refine them to ensure maximum uniqueness.

GENERATED IDEAS:
${ideas.map((idea, i) => `${i + 1}. "${idea.title}" — ${idea.coreTopic} (Score: ${idea.opportunityScore})`).join('\n')}

${pastIdeas.length ? `CREATOR'S PAST IDEAS (check for overlap):
${pastIdeas.map(t => `- "${t}"`).join('\n')}` : ''}

RECENTLY VIRAL IN NICHE:
${trendSnapshot.competitorInsights.slice(0, 10).map(c => `- "${c.title}" (${c.views} views)`).join('\n')}

SATURATED TOPICS: ${trendSnapshot.saturatedTopics.join(', ')}

RULES:
1. If an idea overlaps with a past idea → change the angle significantly or replace it
2. If an idea matches a recently viral video → suggest a unique twist (contrarian take, deeper dive, different audience segment, updated data)
3. If a topic is saturated → add a micro-angle that narrows the audience but increases relevance
4. Ensure no two ideas are too similar to each other
5. Keep the same structure but refine titles, angles, hooks, and talking points
6. Adjust opportunityScore if the differentiation changed the idea's potential
7. Preserve all original fields — return the complete refined ideas

Return the refined ideas with all fields preserved.`;
  }

  private async updateJobStatus(jobId: string, status: string) {
    await this.supabase
      .from('ideation_jobs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
