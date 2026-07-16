import { GoogleGenAI } from "@google/genai";
import { GEMINI_TEXT_MODEL, GEMINI_EMBEDDING_MODEL } from "./genai";
import { manageAccessToken, validateOAuthEnvironment } from "./token-manager";
import {
  ChannelData,
  ChannelIntelligence,
  StyleAnalysis,
  Thumbnail,
  Transcript,
  VideoData,
  calculateCreditsFromTokens,
  TOKENS_PER_CREDIT,
  TRAIN_AI_CREDIT_MULTIPLIER,
} from "@repo/validation";
import type { SupabaseClient } from "@repo/supabase";
import axios from "axios";
import { calculateRetryDelay, logError, shouldRetry } from "./error-handler";


// Validation functions
export async function validateInputs(userId: string, videoUrls: string[]): Promise<void> {
  if (!userId || !videoUrls || !Array.isArray(videoUrls) || videoUrls.length < 3) {
    throw new Error('Invalid input: userId and at least 3 video URLs required');
  }
}

export async function validateEnvironment(): Promise<void> {
  const envValidation = validateOAuthEnvironment();
  if (
    !envValidation.isValid ||
    !process.env.GOOGLE_CLOUD_PROJECT
  ) {
    throw new Error('Missing environment variables');
  }
}

// Fetch channel data
export async function fetchChannelData(supabase: SupabaseClient, userId: string): Promise<ChannelData> {
  const { data, error } = await supabase
    .from('youtube_channels')
    .select('channel_name, channel_id, provider_token, refresh_token, channel_description, custom_url, country, default_language, view_count, subscriber_count, video_count, topic_details')
    .eq('user_id', userId)
    .single();
  if (error || !data) {
    throw new Error('YouTube channel not found');
  }
  return data;
}

// Manage YouTube access token
export async function manageYouTubeToken(
  supabase: SupabaseClient,
  userId: string,
  channelData: ChannelData
): Promise<{ accessToken: string; tokenRefreshed: boolean }> {
  const tokenResult = await manageAccessToken(
    channelData.provider_token,
    channelData.refresh_token || '',
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
  if (!tokenResult.isValid) {
    throw new Error('YouTube connection expired. Please reconnect.');
  }
  if (tokenResult.tokenRefreshed) {
    await supabase
      .from('youtube_channels')
      .update({ provider_token: tokenResult.accessToken, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }
  return { accessToken: tokenResult.accessToken!, tokenRefreshed: tokenResult.tokenRefreshed };
}

// Fetch video data from YouTube API
export async function fetchVideoData(
  videoUrls: string[],
  accessToken: string,
  channelId: string,
  maxRetries = 3
): Promise<VideoData[]> {
  const videoIds = videoUrls
    .map(url => new URL(url).searchParams.get('v') || url.split('/').pop())
    .filter((id): id is string => Boolean(id));
  if (videoIds.length < 3) {
    throw new Error('At least 3 valid YouTube video URLs required');
  }

  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: { part: 'snippet,contentDetails,statistics,topicDetails', id: videoIds.join(','), mine: true },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 30000,
      });
      const videos = response.data.items;
      if (!videos || videos.length < 3) {
        throw new Error('Could not find at least 3 videos');
      }
      for (const video of videos) {
        if (video.snippet.channelId !== channelId) {
          throw new Error(`Video "${video.snippet.title}" does not belong to your channel`);
        }
      }
      return videos.map((item: Record<string, any>): VideoData => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        tags: item.snippet.tags || [],
        duration: item.contentDetails.duration,
        viewCount: parseInt(item.statistics.viewCount, 10) || 0,
        likeCount: parseInt(item.statistics.likeCount, 10) || 0,
        commentCount: parseInt(item.statistics.commentCount, 10) || 0,
        publishedAt: item.snippet.publishedAt,
        categoryId: item.snippet.categoryId,
        topicDetails: item.topicDetails || {},
        thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        defaultAudioLanguage: item.snippet.defaultAudioLanguage || "en",
      }));
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries || !shouldRetry(error, retryCount, maxRetries)) {
        logError('train-ai-youtube-api', error, { videoIds, retryCount });
        throw new Error('Failed to fetch video data');
      }
      await new Promise(resolve => setTimeout(resolve, calculateRetryDelay(retryCount)));
    }
  }
  throw new Error('Max retries reached for YouTube API');
}

export async function analyzeStyle(
  genAI: GoogleGenAI,
  channelData: ChannelData,
  videoData: VideoData[],
  videoUrls: string[],
  maxRetries = 3
): Promise<{
  styleAnalysis: StyleAnalysis;
  totalStyleTokens: number;
}> {
  const prompt = `
Analyze the following YouTube channel and video data to extract the creator's content style, which will be used for generating scripts, research topics, thumbnails, subtitles, audio conversions, and story structure blueprints.

Analyze these aspects:
- tone (e.g., conversational, formal), vocabulary level, pacing, themes, humor style, narrative structure, visual style, thumbnails and descriptions, audience engagement techniques
- **Script Pacing Analysis**: Determine sentence style (short punchy vs long flowing), average segment/section length in seconds, how often humor is used (rare/occasional/frequent/constant), ratio of direct address vs storytelling narration (0.0 to 1.0), how frequently stats/data points are cited, and the baseline emotional tone

Include a comprehensive narrative overview in the style_analysis field.

Channel Data:
- Name: ${channelData.channel_name}
- Description: ${channelData.channel_description || 'None'}
- Custom URL: ${channelData.custom_url || 'None'}
- Country: ${channelData.country || 'Unknown'}
- Default Language: ${channelData.default_language || 'Unknown'}
- View Count: ${channelData.view_count || 0}
- Subscriber Count: ${channelData.subscriber_count || 0}
- Video Count: ${channelData.video_count || 0}
- Topic Details: ${JSON.stringify(channelData.topic_details || {})}

Video Data:
${videoData.map((video, i) => `
Video ${i + 1}:
- URL: ${videoUrls[i]}
- Title: ${video.title}
- Description: ${video.description}
- Tags: ${video.tags.join(', ') || 'None'}
- Duration: ${video.duration}
- View Count: ${video.viewCount}
- Like Count: ${video.likeCount}
- Comment Count: ${video.commentCount}
- Published At: ${video.publishedAt}
- Category ID: ${video.categoryId}
- Topic Details: ${JSON.stringify(video.topicDetails)}
`).join('\n')}
`;

  // Define structured schema
  const schema = {
    type: "object",
    properties: {
      style_analysis: { type: "string" },
      tone: { type: "string" },
      vocabulary_level: { type: "string" },
      pacing: { type: "string" },
      themes: { type: "array", items: { type: "string" } },
      humor_style: { type: "string" },
      narrative_structure: { type: "string" },
      visual_style: { type: "string" },
      audience_engagement: { type: "array", items: { type: "string" } },
      recommendations: {
        type: "object",
        properties: {
          script_generation: { type: "string" },
          research_topics: { type: "string" },
          thumbnails: { type: "string" },
          subtitles: { type: "string" },
          audio_conversion: { type: "string" },
          story_builder: { type: "string" }
        },
        required: [
          "script_generation",
          "research_topics",
          "thumbnails",
          "subtitles",
          "audio_conversion",
          "story_builder"
        ]
      },
      script_pacing: {
        type: "object",
        description: "Detailed script pacing analysis for story builder",
        properties: {
          sentenceStyle: { type: "string", description: "short_punchy, mixed, or long_flowing" },
          avgSentencesPerSegment: { type: "number" },
          transitionStyle: { type: "string", description: "How the creator transitions between topics" },
        },
        required: ["sentenceStyle", "avgSentencesPerSegment", "transitionStyle"]
      },
      humor_frequency: { type: "string", description: "rare, occasional, frequent, or constant" },
      direct_address_ratio: { type: "number", description: "0.0 to 1.0 ratio of direct address vs storytelling" },
      stats_usage: { type: "string", description: "none, rare, moderate, heavy" },
      emotional_tone: { type: "string", description: "Baseline emotional tone e.g. optimistic, neutral, intense" },
      avg_segment_length: { type: "number", description: "Average segment/section length in seconds" }
    },
    required: [
      "style_analysis",
      "tone",
      "vocabulary_level",
      "pacing",
      "themes",
      "humor_style",
      "narrative_structure",
      "visual_style",
      "audience_engagement",
      "recommendations",
      "script_pacing",
      "humor_frequency",
      "direct_address_ratio",
      "stats_usage",
      "emotional_tone",
      "avg_segment_length"
    ]
  };

  let styleAnalysis: StyleAnalysis | null = null;
  let totalStyleTokens = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const model = GEMINI_TEXT_MODEL;

      const result = await genAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0
        }
      });

      styleAnalysis = JSON.parse(result.text) as StyleAnalysis;

      if (!styleAnalysis) {
        throw new Error(`Gemini failed to return structured Style Analysis data.`);
      }

      totalStyleTokens += result?.usageMetadata?.totalTokenCount ?? 0;

      if (styleAnalysis) break;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error('Failed to analyze content style');
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  return { styleAnalysis: styleAnalysis!, totalStyleTokens };
}


// Generate embedding with Gemini
export async function generateEmbedding(
  genAI: GoogleGenAI,
  styleAnalysis: StyleAnalysis,
  maxRetries = 3
): Promise<number[]> {

  const styleText = JSON.stringify(styleAnalysis);
  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      const response = await genAI.models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: styleText,
        config: {
          outputDimensionality: 1536,
          taskType: 'RETRIEVAL_DOCUMENT',
        }
      });

      if (!response?.embeddings) {
        throw new Error('Invalid embedding response');
      }
      const embeddingValues = response?.embeddings[0]?.values;
      if (!embeddingValues) {
        throw new Error('Invalid embedding response');
      }
      const norm = Math.sqrt(embeddingValues.reduce((sum: number, val: number) => sum + val * val, 0));
      return norm > 0 ? embeddingValues.map((val: number) => val / norm) : embeddingValues;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        logError('train-ai-embedding', error, { retryCount });
        throw new Error('Failed to generate embedding');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Max retries reached for embedding');
}

export async function generateTopicEmbedding(
  genAI: GoogleGenAI,
  intelligence: ChannelIntelligence,
  channelData: ChannelData,
  maxRetries = 3,
): Promise<number[]> {
  const topicText = [
    channelData.channel_description || '',
    ...(intelligence.topicClusters || []),
    ...(intelligence.topVideos?.slice(0, 10).map(v => v.title) || []),
    ...(intelligence.contentGaps || []),
  ].filter(Boolean).join(' | ');

  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      const response = await genAI.models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: topicText,
        config: { outputDimensionality: 1536, taskType: 'RETRIEVAL_DOCUMENT' },
      });
      const values = response?.embeddings?.[0]?.values;
      if (!values) throw new Error('Invalid topic embedding response');
      const norm = Math.sqrt(values.reduce((s: number, v: number) => s + v * v, 0));
      return norm > 0 ? values.map((v: number) => v / norm) : values;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        logError('train-ai-topic-embedding', error, { retryCount });
        return [];
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  return [];
}

export function extractChannelIntelligence(
  videoData: VideoData[],
  transcripts: Transcript[],
): ChannelIntelligence {
  const sorted = [...videoData].sort((a, b) => b.viewCount - a.viewCount);
  const top20 = sorted.slice(0, 20);

  const totalViews = videoData.reduce((s, v) => s + v.viewCount, 0);
  const totalLikes = videoData.reduce((s, v) => s + v.likeCount, 0);
  const totalComments = videoData.reduce((s, v) => s + v.commentCount, 0);
  const count = videoData.length || 1;

  const dates = videoData
    .map(v => new Date(v.publishedAt).getTime())
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);
  let uploadFrequencyDays = 7;
  if (dates.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i]! - dates[i - 1]!) / (1000 * 60 * 60 * 24));
    }
    uploadFrequencyDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  const titleWords = videoData.flatMap(v =>
    v.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  );
  const wordFreq = new Map<string, number>();
  titleWords.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  const titlePatterns = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  const hookPatterns: string[] = [];
  for (const t of transcripts) {
    const firstSegments = t.segments.filter(s => s.start < 15);
    if (firstSegments.length) {
      hookPatterns.push(firstSegments.map(s => s.text).join(' ').slice(0, 200));
    }
  }

  const tags = videoData.flatMap(v => v.tags.map(t => t.toLowerCase()));
  const tagFreq = new Map<string, number>();
  tags.forEach(t => tagFreq.set(t, (tagFreq.get(t) || 0) + 1));
  const topicClusters = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  return {
    topVideos: top20.map(v => ({
      id: v.id,
      title: v.title,
      views: v.viewCount,
      likes: v.likeCount,
      comments: v.commentCount,
    })),
    avgViews: Math.round(totalViews / count),
    avgLikes: Math.round(totalLikes / count),
    avgComments: Math.round(totalComments / count),
    titlePatterns,
    titleFingerprints: [],
    hookPatterns: hookPatterns.slice(0, 10),
    topicClusters,
    uploadFrequencyDays,
    bestFormats: [],
    contentGaps: [],
  };
}

export async function enrichChannelIntelligenceWithAI(
  genAI: GoogleGenAI,
  intelligence: ChannelIntelligence,
  channelData: ChannelData,
  maxRetries = 3,
): Promise<{ enriched: ChannelIntelligence; tokens: number }> {
  const prompt = `Analyze this YouTube channel's content patterns and identify:
1. bestFormats: What content formats work best (e.g., tutorial, listicle, breakdown, commentary, case study, reaction, how-to, comparison). Rank by likely performance.
2. contentGaps: Topics this channel's niche demands but the creator hasn't covered. Be specific.
3. titleFingerprints: Extract the recurring structural patterns in the creator's video titles as templates. Examples: "How to [X]", "[Number] Ways to [X]", "[X] vs [Y]", "Why [X] is [Y]", "The Truth About [X]", "I Tried [X] for [Time]". Return 5-10 patterns found.

Channel: ${channelData.channel_name || 'Unknown'}
Description: ${channelData.channel_description || 'None'}
Topics: ${JSON.stringify(channelData.topic_details || {})}
Top Videos: ${intelligence.topVideos.map(v => `"${v.title}" (${v.views} views)`).join(', ')}
Topic Clusters: ${intelligence.topicClusters.join(', ')}
Avg Views: ${intelligence.avgViews}`;

  const schema = {
    type: "object",
    properties: {
      bestFormats: { type: "array", items: { type: "string" } },
      contentGaps: { type: "array", items: { type: "string" } },
      titleFingerprints: { type: "array", items: { type: "string" }, description: "Structural title patterns like 'How to [X]', '[Number] Ways to [Y]'" },
    },
    required: ["bestFormats", "contentGaps", "titleFingerprints"],
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 },
      });
      const parsed = JSON.parse(result.text);
      return {
        enriched: {
          ...intelligence,
          bestFormats: parsed.bestFormats || [],
          contentGaps: parsed.contentGaps || [],
          titleFingerprints: parsed.titleFingerprints || [],
        },
        tokens: result?.usageMetadata?.totalTokenCount ?? 0,
      };
    } catch (error) {
      if (attempt === maxRetries) {
        logError('train-ai-channel-intelligence', error, { attempt });
        return { enriched: intelligence, tokens: 0 };
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  return { enriched: intelligence, tokens: 0 };
}

// Save style data to Supabase
export async function saveStyleData(
  supabase: SupabaseClient,
  userId: string,
  styleAnalysis: StyleAnalysis,
  embedding: number[],
  videoUrls: string[],
  transcripts: Transcript[],
  thumbnails: Thumbnail[],
  totalConsumedTokens: number,
  channelIntelligence?: ChannelIntelligence,
  topicEmbedding?: number[],
): Promise<void> {
  const tokensPerCredit = getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
  const trainAiMultiplier = getEnvNumber('TRAIN_AI_CREDIT_MULTIPLIER', TRAIN_AI_CREDIT_MULTIPLIER);
  const geminiCredits = calculateCreditsFromTokens(
    { totalTokens: totalConsumedTokens },
    { tokensPerCredit, multiplier: trainAiMultiplier, minimumCredits: 1 },
  );

  const { data: profile } = await supabase.from('profiles').select('credits').eq('user_id', userId).single();
  if (profile.credits < geminiCredits) {
    throw new Error('Insufficient credits, Please upgrade your plan.');
  }

  await supabase.from('profiles').update({ credits: profile.credits - geminiCredits, ai_trained: true }).eq('user_id', userId);

  const styleData: Record<string, any> = {
    user_id: userId,
    tone: styleAnalysis.tone,
    vocabulary_level: styleAnalysis.vocabulary_level,
    pacing: styleAnalysis.pacing,
    themes: Array.isArray(styleAnalysis.themes) ? styleAnalysis.themes.join(', ') : styleAnalysis.themes,
    humor_style: styleAnalysis.humor_style,
    structure: styleAnalysis.narrative_structure,
    visual_style: styleAnalysis.visual_style,
    audience_engagement: Array.isArray(styleAnalysis.audience_engagement)
      ? styleAnalysis.audience_engagement
      : [styleAnalysis.audience_engagement],
    video_urls: videoUrls,
    style_analysis: styleAnalysis.style_analysis,
    recommendations: styleAnalysis.recommendations,
    updated_at: new Date().toISOString(),
    content: JSON.stringify(styleAnalysis),
    embedding,
    transcripts,
    thumbnails,
    gemini_total_tokens: totalConsumedTokens,
    credits_consumed: geminiCredits,
  };

  if ((styleAnalysis as any).script_pacing) {
    styleData.script_pacing = (styleAnalysis as any).script_pacing;
  }
  if ((styleAnalysis as any).humor_frequency) {
    styleData.humor_frequency = (styleAnalysis as any).humor_frequency;
  }
  if ((styleAnalysis as any).direct_address_ratio != null) {
    styleData.direct_address_ratio = (styleAnalysis as any).direct_address_ratio;
  }
  if ((styleAnalysis as any).stats_usage) {
    styleData.stats_usage = (styleAnalysis as any).stats_usage;
  }
  if ((styleAnalysis as any).emotional_tone) {
    styleData.emotional_tone = (styleAnalysis as any).emotional_tone;
  }
  if ((styleAnalysis as any).avg_segment_length != null) {
    styleData.avg_segment_length = (styleAnalysis as any).avg_segment_length;
  }

  if (channelIntelligence) {
    styleData.channel_intelligence = channelIntelligence;
  }
  if (topicEmbedding?.length) {
    styleData.topic_embedding = topicEmbedding;
  }

  const { error } = await supabase.from('user_style').upsert(styleData, { onConflict: 'user_id' });
  if (error) {
    logError('train-ai-style-save', error, { userId });
    throw new Error('Failed to save style analysis');
  }
}

function getEnvNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}