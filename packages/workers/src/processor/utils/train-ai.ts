import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";
import { GEMINI_TEXT_MODEL, GEMINI_EMBEDDING_MODEL, extractResponseText } from "./genai";
import { manageAccessToken, validateOAuthEnvironment } from "./token-manager";
import {
  ChannelData,
  ChannelIntelligence,
  StyleAnalysis,
  Thumbnail,
  Transcript,
  VideoData,
  calculateCreditsFromTokens,
  estimateTrainingCredits,
  TOKENS_PER_CREDIT,
  TRAIN_AI_CREDIT_MULTIPLIER,
  TRAIN_AI_HOOK_WINDOW_SECONDS,
  TRAIN_AI_MID_WINDOW_SECONDS,
  TRAIN_AI_SECONDS_PER_VIDEO,
  TRAIN_AI_MAX_VIDEOS,
  TRAIN_AI_VIDEO_FPS,
  TRAIN_AI_MAX_OUTPUT_TOKENS,
  FREE_FIRST_TRAINING,
} from "@repo/validation";
import type { SupabaseClient } from "@repo/supabase";
import axios from "axios";
import { calculateRetryDelay, logError, shouldRetry } from "./error-handler";


// Validation functions
// Every throw in this pipeline surfaces verbatim in the dashboard, so each one names
// what the user should do next rather than what broke internally.
export async function validateInputs(userId: string, videoUrls: string[]): Promise<void> {
  if (!userId) throw new Error('We could not identify your account. Please sign in again.');
  if (!Array.isArray(videoUrls) || videoUrls.length < 3) {
    throw new Error('Please select at least 3 videos from your channel to build your AI memory.');
  }
  const invalid = videoUrls.filter((url) => !extractYouTubeVideoId(url));
  if (invalid.length) {
    throw new Error(`${invalid.length} of the selected items are not valid YouTube video links. Please reselect your videos.`);
  }
}

export async function validateEnvironment(): Promise<void> {
  const envValidation = validateOAuthEnvironment();
  if (!envValidation.isValid || !process.env.GOOGLE_CLOUD_PROJECT) {
    logError('train-ai-env', new Error('Missing environment variables'), {
      oauth: envValidation.isValid,
      project: Boolean(process.env.GOOGLE_CLOUD_PROJECT),
    });
    throw new Error('Building AI memory is temporarily unavailable. Our team has been notified — please try again shortly.');
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
    throw new Error('No YouTube channel is connected to your account. Please connect your channel and try again.');
  }
  if (!data.channel_id) {
    throw new Error('Your connected YouTube channel is missing its ID. Please reconnect your channel.');
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

/** Handles watch?v=, youtu.be/, /shorts/ and /embed/ forms; null when it isn't one. */
export function extractYouTubeVideoId(url: string): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const fromQuery = parsed.searchParams.get('v');
    if (fromQuery) return fromQuery;
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    return last && /^[\w-]{11}$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

// Fetch video data from YouTube API
export async function fetchVideoData(
  videoUrls: string[],
  accessToken: string,
  channelId: string,
  maxRetries = 3
): Promise<VideoData[]> {
  const videoIds = videoUrls
    .map(extractYouTubeVideoId)
    .filter((id): id is string => Boolean(id));
  if (videoIds.length < 3) {
    throw new Error('Please select at least 3 valid YouTube videos from your channel.');
  }

  let videos: Record<string, any>[] | undefined;
  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: { part: 'snippet,contentDetails,statistics,topicDetails', id: videoIds.join(','), mine: true },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 30000,
      });
      videos = response.data.items;
      break;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries || !shouldRetry(error, retryCount, maxRetries)) {
        logError('train-ai-youtube-api', error, { videoIds, retryCount });
        throw new Error('We could not reach YouTube to load your videos. Please try again in a moment.');
      }
      await new Promise(resolve => setTimeout(resolve, calculateRetryDelay(retryCount)));
    }
  }

  // Checks below are the user's problem to fix, not transient — they must not retry.
  if (!videos?.length) {
    throw new Error('None of the selected videos could be found. They may have been deleted or made private.');
  }
  if (videos.length < videoIds.length) {
    const missing = videoIds.length - videos.length;
    throw new Error(`${missing} of the selected videos could not be loaded — they may be private or deleted. Please pick different videos.`);
  }
  if (videos.length < 3) {
    throw new Error('Please select at least 3 videos from your channel to build your AI memory.');
  }
  for (const video of videos) {
    if (video.snippet.channelId !== channelId) {
      throw new Error(`"${video.snippet.title}" is not from your connected channel. You can only build AI memory from your own videos.`);
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
}

/** YouTube returns ISO-8601 durations ("PT10M30S"). Returns seconds, 0 if unparseable. */
export function parseIsoDurationSeconds(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:([\d.]+)D)?T?(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
  );
}

/**
 * Turn one video into the clipped parts we actually send Gemini.
 *
 * The user can pick a video of ANY length — we never send all of it. Two windows:
 * the opening (hook, intro, topic setup — where style is densest) and a mid-video
 * sample (steady-state delivery, so we don't mistake the intro voice for the whole
 * channel). Short videos collapse to a single whole-video part.
 *
 * This is what decouples our cost from the user's choice: a 4-minute video and a
 * 2-hour video produce the same number of tokens.
 */
export function buildVideoParts(videoUrl: string, durationSeconds: number): Record<string, any>[] {
  const fps = TRAIN_AI_VIDEO_FPS;
  const clip = (startOffset: number, endOffset: number) => ({
    // Vertex rejects fileData without a mimeType; YouTube URIs take video/mp4.
    fileData: { fileUri: videoUrl, mimeType: 'video/mp4' },
    videoMetadata: { startOffset: `${Math.max(0, Math.floor(startOffset))}s`, endOffset: `${Math.ceil(endOffset)}s`, fps },
  });

  // Unknown or short duration → send it whole, still capped so a bad duration
  // reading can't turn into an unbounded bill.
  const cap = TRAIN_AI_SECONDS_PER_VIDEO;
  if (!durationSeconds || durationSeconds <= cap) {
    return [clip(0, Math.min(durationSeconds || cap, cap))];
  }

  const hookEnd = Math.min(TRAIN_AI_HOOK_WINDOW_SECONDS, durationSeconds);
  const midStart = Math.max(hookEnd, durationSeconds / 2 - TRAIN_AI_MID_WINDOW_SECONDS / 2);
  const midEnd = Math.min(midStart + TRAIN_AI_MID_WINDOW_SECONDS, durationSeconds);
  return [clip(0, hookEnd), clip(midStart, midEnd)];
}

/** More videos than we analyse → keep the most-viewed: best style signal, bounded cost. */
export function selectVideosForTraining(
  videoData: VideoData[],
  videoUrls: string[],
): { videos: VideoData[]; urls: string[] } {
  const paired = videoData.map((video, i) => ({ video, url: videoUrls[i] ?? '' }));
  if (paired.length <= TRAIN_AI_MAX_VIDEOS) {
    return { videos: paired.map((p) => p.video), urls: paired.map((p) => p.url) };
  }
  const top = [...paired].sort((a, b) => b.video.viewCount - a.video.viewCount).slice(0, TRAIN_AI_MAX_VIDEOS);
  return { videos: top.map((p) => p.video), urls: top.map((p) => p.url) };
}

/**
 * Every style field that must survive to the DB. Sourced from the `user_style` columns
 * downstream features read — a gap here means scripts/ideation/video-gen silently fall
 * back to "N/A" for that trait, which is how humor_style and narrative_structure went
 * unnoticed for so long.
 */
const REQUIRED_STYLE_FIELDS = [
  'style_analysis',
  'tone',
  'vocabulary_level',
  'pacing',
  'themes',
  'humor_style',
  'narrative_structure',
  'visual_style',
  'audience_engagement',
  'recommendations',
] as const;

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

export function assertStyleAnalysisComplete(styleAnalysis: StyleAnalysis): void {
  const missing = REQUIRED_STYLE_FIELDS.filter((field) =>
    isEmptyValue((styleAnalysis as unknown as Record<string, unknown>)[field]),
  );
  if (missing.length) {
    logError('train-ai-incomplete-style', new Error('Incomplete style analysis'), { missing });
    throw new Error(
      `The style analysis came back missing ${missing.join(', ')}. Nothing was saved — please train again.`,
    );
  }
}

/**
 * The only proof the video was actually read. If Gemini is handed a request it cannot
 * fulfil (a rejected fileData part, a private video) it still returns a well-formed
 * object filled from titles and descriptions — which is exactly the fabricated profile
 * this pipeline exists to avoid. Empty transcripts across every video means no audio
 * was ever transcribed.
 */
export function assertVideoWasActuallyRead(transcripts: Transcript[]): void {
  const withSpeech = transcripts.filter((t) => t.transcriptText.trim().length > 0);
  if (!withSpeech.length) {
    logError('train-ai-no-transcripts', new Error('No transcript content returned'), {
      videos: transcripts.length,
    });
    throw new Error(
      'We could not hear any speech in the selected videos, so the style profile would not reflect how you actually talk. Nothing was saved — pick videos where you speak on camera and train again.',
    );
  }
}

/**
 * The ONE analysis call. Replaces what used to be five round trips (three per-video
 * "transcriptions", a style pass, and a channel-intelligence pass).
 *
 * Two things changed and they matter:
 *
 * 1. The videos are actually ATTACHED now. The old code interpolated the YouTube URL
 *    into the prompt text, so Gemini never opened anything — it wrote a plausible
 *    transcript from the title and description, and every style profile downstream was
 *    built on invented text. Video comes in as fileData parts with videoMetadata.
 *
 * 2. Everything comes back in one schema. The separate transcription calls existed to
 *    feed `hookPatterns`, which is a 200-character slice — so we ask for the hooks
 *    directly instead of paying for three full transcripts to extract one field.
 */
export async function analyzeChannel(
  genAI: GoogleGenAI,
  channelData: ChannelData,
  videoData: VideoData[],
  videoUrls: string[],
  maxRetries = 3
): Promise<{
  styleAnalysis: StyleAnalysis;
  transcripts: Transcript[];
  aiIntelligence: Pick<ChannelIntelligence, 'bestFormats' | 'contentGaps' | 'titleFingerprints' | 'hookPatterns'>;
  totalStyleTokens: number;
}> {
  const prompt = `
You are watching clips from a YouTube creator's own videos. Analyze the channel and the ATTACHED VIDEO CLIPS to extract the creator's content style, which will be used for generating scripts, research topics, thumbnails, subtitles, audio conversions, and story structure blueprints.

For each video you are given up to two clips: the opening (hook and intro) and a sample from the middle of the video. Base your analysis on what the creator ACTUALLY says and shows in those clips — their real delivery, phrasing and on-screen style — not on the titles or descriptions alone.

Analyze these aspects:
- tone (e.g., conversational, formal), vocabulary level, pacing, themes, humor style, narrative structure, visual style, thumbnails and descriptions, audience engagement techniques
- **Script Pacing Analysis**: Determine sentence style (short punchy vs long flowing), average segment/section length in seconds, how often humor is used (rare/occasional/frequent/constant), ratio of direct address vs storytelling narration (0.0 to 1.0), how frequently stats/data points are cited, and the baseline emotional tone
- **Transcripts**: For each attached clip, transcribe what is actually spoken, with timed segments. Use the real spoken words — never invent dialogue. If a clip has no speech, return an empty segments array for it.
- **Hook patterns**: Quote how each video actually opens, verbatim, from the first seconds of the opening clip.
- **Channel intelligence**: bestFormats (which content formats work best for this channel, ranked), contentGaps (topics the niche demands that this creator has not covered — be specific), titleFingerprints (recurring structural patterns in their titles as reusable templates, e.g. "How to [X]", "[Number] Ways to [Y]", "Why [X] is [Y]"; return 5-10).

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
      avg_segment_length: { type: "number", description: "Average segment/section length in seconds" },

      // Folded in from the three per-video transcription calls this replaces.
      transcripts: {
        type: "array",
        description: "One entry per analysed video, transcribing the attached clips only",
        items: {
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
                  text: { type: "string" },
                },
                required: ["start", "end", "text"],
              },
            },
          },
          required: ["videoId", "transcriptText", "segments"],
        },
      },
      hook_patterns: {
        type: "array",
        description: "Verbatim openings, one per video, from the first seconds of each",
        items: { type: "string" },
      },

      // Folded in from enrichChannelIntelligenceWithAI.
      best_formats: { type: "array", items: { type: "string" } },
      content_gaps: { type: "array", items: { type: "string" } },
      title_fingerprints: {
        type: "array",
        items: { type: "string" },
        description: "Structural title patterns like 'How to [X]', '[Number] Ways to [Y]'",
      },
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
      "avg_segment_length",
      "transcripts",
      "hook_patterns",
      "best_formats",
      "content_gaps",
      "title_fingerprints"
    ]
  };

  // Clipped video parts — see buildVideoParts for why we sample rather than send whole
  // videos. mediaResolution LOW drops frames from ~258 to ~66 tokens each.
  const videoParts = videoData.flatMap((video, i) => {
    const url = videoUrls[i];
    return url ? buildVideoParts(url, parseIsoDurationSeconds(video.duration)) : [];
  });

  if (!videoParts.length) throw new Error('No analysable videos were selected for training.');

  let parsed: Record<string, any> | null = null;
  let totalStyleTokens = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }, ...videoParts] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0,
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
          // This is extraction, not reasoning. Left to itself a 3.x model spends the
          // output budget thinking and returns thought parts with no answer.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: false },
          maxOutputTokens: TRAIN_AI_MAX_OUTPUT_TOKENS,
        },
      });

      const extracted = extractResponseText(result);
      if (extracted.text === null) {
        throw new Error(`Gemini returned no style analysis — ${extracted.reason}.`);
      }

      parsed = JSON.parse(extracted.text) as Record<string, any>;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Gemini returned a malformed style analysis.');
      }

      totalStyleTokens += result?.usageMetadata?.totalTokenCount ?? 0;
      break;
    } catch (error) {
      logError('train-ai-analyze-channel', error, { attempt, videoParts: videoParts.length });
      if (attempt === maxRetries) {
        // Previously this degraded to a metadata-only pass, which saved a profile
        // built on no video at all and reported the job as complete. Failing is the
        // honest outcome: the profile is the product.
        throw new Error(
          'Could not analyse your videos. They must be public or unlisted on your channel — private or deleted videos cannot be read. Please pick different videos and train again.',
        );
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  const styleAnalysis = parsed as unknown as StyleAnalysis;

  // Match transcripts back to the videos they came from. The model echoes videoId, but
  // fall back to positional order so a mislabelled id doesn't drop the transcript.
  const rawTranscripts: any[] = Array.isArray(parsed?.transcripts) ? parsed!.transcripts : [];
  const transcripts: Transcript[] = videoData.map((video, i) => {
    const match =
      rawTranscripts.find((t) => t?.videoId === video.id) ?? rawTranscripts[i] ?? {};
    return {
      videoId: video.id,
      transcriptText: typeof match.transcriptText === 'string' ? match.transcriptText : '',
      segments: Array.isArray(match.segments) ? match.segments : [],
    };
  });

  assertStyleAnalysisComplete(styleAnalysis);
  assertVideoWasActuallyRead(transcripts);

  return {
    styleAnalysis,
    transcripts,
    aiIntelligence: {
      bestFormats: Array.isArray(parsed?.best_formats) ? parsed!.best_formats : [],
      contentGaps: Array.isArray(parsed?.content_gaps) ? parsed!.content_gaps : [],
      titleFingerprints: Array.isArray(parsed?.title_fingerprints) ? parsed!.title_fingerprints : [],
      hookPatterns: Array.isArray(parsed?.hook_patterns) ? parsed!.hook_patterns.slice(0, 10) : [],
    },
    totalStyleTokens,
  };
}


/** Unit-normalise so cosine similarity is a plain dot product downstream. */
function normalize(values: number[] | undefined): number[] {
  if (!values?.length) return [];
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? values.map((v) => v / norm) : values;
}

/**
 * Both embeddings in ONE embedContent call — the API takes an array of contents and
 * returns an embedding per entry, so the style vector and the topic vector no longer
 * need a round trip each.
 *
 * The style embedding is required (it is what personalises every downstream feature);
 * the topic embedding is best-effort and degrades to [] exactly as it did before.
 */
export async function generateStyleEmbeddings(
  genAI: GoogleGenAI,
  styleAnalysis: StyleAnalysis,
  intelligence: ChannelIntelligence,
  channelData: ChannelData,
  maxRetries = 3,
): Promise<{ embedding: number[]; topicEmbedding: number[] }> {
  const styleText = JSON.stringify(styleAnalysis);
  const topicText = [
    channelData.channel_description || '',
    ...(intelligence.topicClusters || []),
    ...(intelligence.topVideos?.slice(0, 10).map((v) => v.title) || []),
    ...(intelligence.contentGaps || []),
  ].filter(Boolean).join(' | ');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await genAI.models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: [styleText, topicText || styleText],
        config: { outputDimensionality: 1536, taskType: 'RETRIEVAL_DOCUMENT' },
      });

      const embedding = normalize(response?.embeddings?.[0]?.values);
      if (!embedding.length) throw new Error('Invalid embedding response');

      return {
        embedding,
        topicEmbedding: topicText ? normalize(response?.embeddings?.[1]?.values) : [],
      };
    } catch (error) {
      if (attempt === maxRetries) {
        logError('train-ai-embeddings', error, { attempt });
        throw new Error('Failed to generate embedding');
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Max retries reached for embedding');
}

/**
 * Local, zero-cost aggregation of the YouTube metadata (view/like averages, title word
 * frequency, upload cadence, tag clusters), merged with the AI-derived fields that now
 * arrive from analyzeChannel instead of their own separate call.
 */
export function extractChannelIntelligence(
  videoData: VideoData[],
  transcripts: Transcript[],
  aiIntelligence?: Partial<Pick<ChannelIntelligence, 'bestFormats' | 'contentGaps' | 'titleFingerprints' | 'hookPatterns'>>,
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

  // Hooks the model quoted directly win; fall back to slicing the transcript's first
  // 15 seconds, which is what this did before the analysis calls were merged.
  const hookPatterns: string[] = aiIntelligence?.hookPatterns?.length
    ? [...aiIntelligence.hookPatterns]
    : transcripts.flatMap((t) => {
        const firstSegments = t.segments.filter((s) => s.start < 15);
        return firstSegments.length ? [firstSegments.map((s) => s.text).join(' ').slice(0, 200)] : [];
      });

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
    titleFingerprints: aiIntelligence?.titleFingerprints ?? [],
    hookPatterns: hookPatterns.slice(0, 10),
    topicClusters,
    uploadFrequencyDays,
    bestFormats: aiIntelligence?.bestFormats ?? [],
    contentGaps: aiIntelligence?.contentGaps ?? [],
  };
}

// enrichChannelIntelligenceWithAI used to live here — a second generateContent call
// purely for bestFormats / contentGaps / titleFingerprints. Those three fields now
// come back in analyzeChannel's schema, so the call is gone rather than disabled.

/**
 * Decide what this training run will cost BEFORE any Gemini call runs.
 *
 * The old flow read the balance in saveStyleData, i.e. after every API call had already
 * been paid for: a user without enough credits burned the full vendor cost and was then
 * charged nothing, and each retry burned it again. This reserves up front instead.
 *
 * The first training is free — it is the onboarding step that makes every other feature
 * personalised, so charging for it is charging admission to the thing that makes the
 * product work. `profiles.free_training_used` is the flag (set true on the first success
 * and never reset), so a failed first attempt correctly stays free on retry, while
 * disconnecting and reconnecting a channel does NOT hand out a second free run —
 * `ai_trained` does reset on disconnect, which is why it cannot be the flag.
 */
export function isTrainingFree(profile: { free_training_used?: boolean | null }): boolean {
  return FREE_FIRST_TRAINING && !profile.free_training_used;
}

export async function resolveTrainingCharge(
  supabase: SupabaseClient,
  userId: string,
  videoCount: number,
): Promise<{ isFirstTraining: boolean; credits: number }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('credits, free_training_used')
    .eq('user_id', userId)
    .single();

  if (error || !profile) {
    logError('train-ai-profile-fetch', error, { userId });
    throw new Error('Could not load your account to charge for training.');
  }

  const isFirstTraining = isTrainingFree(profile);
  if (isFirstTraining) return { isFirstTraining: true, credits: profile.credits ?? 0 };

  const multiplier = getEnvNumber('TRAIN_AI_CREDIT_MULTIPLIER', TRAIN_AI_CREDIT_MULTIPLIER);
  const required = estimateTrainingCredits(videoCount, multiplier);
  const credits = profile.credits ?? 0;

  // Same "Insufficient credits." opening as the dubbing, thumbnail and video
  // processors — the dashboard keys its out-of-credits dialog off that prefix.
  if (credits < required) {
    throw new Error(
      `Insufficient credits. Retraining needs about ${required} credits but you have ${credits}. Please upgrade your plan and train again.`,
    );
  }

  return { isFirstTraining: false, credits };
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
  charge?: { isFirstTraining: boolean; credits: number },
): Promise<void> {
  const tokensPerCredit = getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
  const trainAiMultiplier = getEnvNumber('TRAIN_AI_CREDIT_MULTIPLIER', TRAIN_AI_CREDIT_MULTIPLIER);

  // Affordability was settled by resolveTrainingCharge before we spent anything; this
  // only bills the actual token usage. First training is on the house.
  const geminiCredits = charge?.isFirstTraining
    ? 0
    : calculateCreditsFromTokens(
        { totalTokens: totalConsumedTokens },
        { tokensPerCredit, multiplier: trainAiMultiplier, minimumCredits: 1 },
      );

  // Re-read rather than trusting the balance from the pre-check — a concurrent
  // generation may have spent credits while the analysis was running.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('user_id', userId)
    .single();
  if (profileError || !profile) {
    logError('train-ai-profile-fetch', profileError, { userId });
    throw new Error('Could not load your account to charge for training.');
  }

  const credits = profile.credits ?? 0;
  await supabase
    .from('profiles')
    // free_training_used is one-way: once the free run has landed it never goes back,
    // not even when the channel is disconnected (which does clear ai_trained).
    .update({ credits: Math.max(0, credits - geminiCredits), ai_trained: true, free_training_used: true })
    .eq('user_id', userId);

  const styleData: Record<string, any> = {
    user_id: userId,
    tone: styleAnalysis.tone,
    vocabulary_level: styleAnalysis.vocabulary_level,
    pacing: styleAnalysis.pacing,
    themes: Array.isArray(styleAnalysis.themes) ? styleAnalysis.themes.join(', ') : styleAnalysis.themes,
    humor_style: styleAnalysis.humor_style,
    // The table has BOTH columns and readers are split: script/ideation/story-builder
    // read `structure`, video-generation reads `narrative_structure`. Only `structure`
    // was ever written, so video-gen has always seen null. Write both.
    structure: styleAnalysis.narrative_structure,
    narrative_structure: styleAnalysis.narrative_structure,
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