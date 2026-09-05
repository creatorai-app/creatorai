export const TOKENS_PER_CREDIT = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Margin policy (single source of truth for how features are priced in credits)
//
// Every feature must clear TARGET_GROSS_MARGIN at the LOWEST price a credit sells
// for across active plans (CREDIT_FLOOR_USD). So a credit may cost us at most
// MAX_COGS_PER_CREDIT_USD in vendor spend.
//
// What a credit actually sells for, per plan:
//   Creator          $24 / 3,000   = $0.00800
//   Creator annual   $19 / 3,000   = $0.00633
//   Pro              $49 / 8,000   = $0.006125
//   Pro annual       $39 / 8,000   = $0.004875  ← the floor
//   Business        $299 / 50,000  = $0.00598
//   Scale           $599 / 100,000 = $0.00599   (100k per 20260712 recalibration)
//
//
// Multipliers below are DERIVED from this rule using real 2026 vendor rates:
//   Gemini 3.5 Flash        $1.50/M in, $9/M out  → ~$0.006 / 1k tokens (40/60 blend)
//   Gemini 2.5 Flash Image  $0.039 / image
//   Gemini Omni Flash video $0.10 / second
//   ElevenLabs Dubbing API  ~$0.24 / min = $0.004 / second (Pro-tier overage rate)
// All are env-overridable.
//
// NOTE (unpriced drift, deliberate): correcting the floor from $0.006 to $0.004875
// means THUMBNAIL (33) and VIDEO_GENERATION (85) now clear ~76%, not 80%. Holding
// target would need 40 and 103. Left alone on purpose — that is a price rise for
// existing users, which is a business call, not a bug fix. The token-based text
// multipliers (6) still clear 79.5%, which is target within rounding.
// ─────────────────────────────────────────────────────────────────────────────
export const TARGET_GROSS_MARGIN = 0.8;
export const CREDIT_FLOOR_USD = 0.004875; // Pro annual: $39/mo ÷ 8,000 credits
export const MAX_COGS_PER_CREDIT_USD = CREDIT_FLOOR_USD * (1 - TARGET_GROSS_MARGIN); // $0.000975

/** Credits to charge for a unit of work costing `cogsUsd`, holding the target margin. */
export function creditsForCost(cogsUsd: number): number {
  return Math.max(1, Math.ceil(cogsUsd / MAX_COGS_PER_CREDIT_USD));
}

// Token-based features: credits = ceil(tokens / 1000) × multiplier. Text COGS is
// ~$0.006/1k tokens, and $0.006 / $0.0012 = 5, so a multiplier of 6 clears ~83%.
export const SCRIPT_CREDIT_MULTIPLIER = 6;
export const SUBTITLE_CREDIT_MULTIPLIER = 6;
export const IDEATION_CREDIT_MULTIPLIER = 6;
export const STORY_BUILDER_CREDIT_MULTIPLIER = 6;

// Train AI genuinely IS input-heavy: the run attaches ~3 × 150s of sampled video
// (low media resolution, 0.1 fps ⇒ ~46 tokens/sec) against ~5k tokens of structured
// output, so ~22k in / 5k out ⇒ ~$0.0029 per 1k tokens blended. creditsForCost gives
// 3; we keep 6 for consistency with the other text features, which runs ~90%.
// This only holds while the pipeline SAMPLES video — sending full videos at default
// resolution is ~6× the input tokens and blows past what one training should cost.
export const TRAIN_AI_CREDIT_MULTIPLIER = 6;

// The first training is free (see FREE_FIRST_TRAINING): it is the onboarding step
// that makes every other feature personalised, and a user who never trains gets
// generic output everywhere and churns. Retraining bills normally.
export const FREE_FIRST_TRAINING = true;

// Thumbnails bill PER IMAGE, not per token: an image costs $0.039 flat, which the
// text-token rate can't capture. creditsForCost(0.039) = 33 credits/image ⇒ ~82%.
export const THUMBNAIL_CREDIT_MULTIPLIER = 33; // credits per generated image

// Video (Omni) billed per SECOND: creditsForCost(0.10) = 84 ⇒ an 8s clip = 680 credits.
export const VIDEO_GENERATION_CREDIT_MULTIPLIER = 85;

// Dubbing runs on the ElevenLabs Dubbing API (transcribe + translate + clone + mux
// in one call). ElevenLabs bills ~2,000 of THEIR credits per source minute; at the
// Pro-tier overage rate that is ~$0.24/min = $0.004/second.
//
// 1/6 per second = 10 credits per minute, which makes Creator's fixed 3,000 credits
// worth exactly 5 hours of dubbing. Every other plan scales off the same rate:
//   Starter    500 cr →   50 min
//   Creator  3,000 cr →    5 h
//   Pro      8,000 cr →   13 h 20 m
//   Business 50,000 cr →  83 h 20 m
//   Scale   100,000 cr → 166 h 40 m
//
// GRANT-FUNDED PROMO — NOT sustainable at ElevenLabs list prices. 5 hours costs $72
// against Creator's $24, i.e. -200% margin. This is affordable only while the account
// sits on the ElevenLabs startup grant (~33M credits ≈ 16,500 min ≈ 275 h), where
// marginal COGS is $0. The grant is the budget: ~55 Creator users, or ~3 Business
// users, at FULL utilisation drain it entirely.
//
// When the grant ends, raise this via the DUBBING_CREDIT_MULTIPLIER env var (no
// deploy): 2.5 → 20 min/month at the 80% target, 5 → 10 min at 90%. Or move dubbing
// to the in-house pipeline, which has to land under ~$0.016/min for 5 hours to hold
// 80% margin at $24.
export const DUBBING_CREDIT_MULTIPLIER = 1 / 6;

// Starter is a TRIAL, not an allowance. The 60s per-clip cap (STARTER_MAX_DUB_SECONDS)
// is the deliberate shape of it, and at the paid rate its 500 credits would also buy
// 50 minutes of dubbing — free, uncapped by signup, and pure COGS. That is the fastest
// way to drain the grant: ~330 free accounts, versus 55 paying Creator users.
//
// Held at 3/sec, the pre-promo rate the tier was designed around: a 60s dub costs 180,
// so 500 credits buys the two full-length trial dubs and no more.
export const STARTER_DUBBING_CREDIT_MULTIPLIER = 3;

/**
 * Credits per second for a plan. Mirrors maxDubSecondsForPlan's convention exactly —
 * missing plan or 'starter' is Starter, everything else is paid — so the clip cap and
 * the price can never disagree about who is on the free tier.
 */
export function dubbingMultiplierForPlan(
  planName?: string | null,
  paidMultiplier: number = DUBBING_CREDIT_MULTIPLIER,
): number {
  if (!planName) return STARTER_DUBBING_CREDIT_MULTIPLIER;
  return planName.toLowerCase() === 'starter' ? STARTER_DUBBING_CREDIT_MULTIPLIER : paidMultiplier;
}

/** Hours of dubbing a credit allowance buys on a plan. Float, for display. */
export function dubbingHoursForPlan(
  credits: number,
  planName?: string | null,
  paidMultiplier: number = DUBBING_CREDIT_MULTIPLIER,
): number {
  return credits / dubbingMultiplierForPlan(planName, paidMultiplier) / 3600;
}

/**
 * Dubbing allowance as display copy. Starter lands at ~2.8 minutes, which reads as
 * nothing in hours, so sub-hour allowances are shown in minutes.
 */
export function formatDubbingAllowance(
  credits: number,
  planName?: string | null,
  paidMultiplier: number = DUBBING_CREDIT_MULTIPLIER,
): string {
  const hours = dubbingHoursForPlan(credits, planName, paidMultiplier);
  return hours < 1 ? `${(hours * 60).toFixed(1)} min` : `${hours.toFixed(1)} hrs`;
}

export const FeatureType = {
  SCRIPT_GENERATION: 'script_generation',
  THUMBNAIL_CREATION: 'thumbnail_creation',
  SUBTITLE_GENERATION: 'subtitle_generation',
  RESEARCH_TOPIC: 'research_topic',
  COURSE_MODULE: 'course_module',
  DUBBING: 'dubbing',
  AI_TRAINING: 'ai_training',
  STORY_BUILDER: 'story_builder',
  IDEATION: 'ideation',
  VIDEO_GENERATION: 'video_generation',
} as const;

export type FeatureType = (typeof FeatureType)[keyof typeof FeatureType];

export interface TokenBasedCreditParams {
  totalTokens: number;
}

export interface ExternalCreditParams {
  externalCreditsUsed: number;
  multiplier?: number;
}

export interface TokenCreditConfig {
  tokensPerCredit?: number;
  multiplier?: number;
  minimumCredits?: number;
}

export function calculateCreditsFromTokens(
  params: TokenBasedCreditParams,
  config?: TokenCreditConfig,
): number {
  const { totalTokens } = params;
  const tokensPerCredit = config?.tokensPerCredit ?? TOKENS_PER_CREDIT;
  const multiplier = config?.multiplier ?? 1;
  const minimumCredits = config?.minimumCredits ?? 1;
  const baseCredits = Math.ceil(totalTokens / tokensPerCredit);
  return Math.max(minimumCredits, baseCredits * multiplier);
}

/** @deprecated flat external-credit model — use calculateDubbingCreditsByDuration. */
export function calculateDubbingCredits(params: ExternalCreditParams): number {
  const { externalCreditsUsed, multiplier = 10 } = params;
  return externalCreditsUsed * multiplier;
}

// Duration-based (mirrors calculateVideoGenerationCredits): cost = seconds ×
// credits/sec, rounded up so a partial second still charges a full second.
//
// The outer ceil is load-bearing: profiles.credits is an INTEGER column, and a
// sub-1 multiplier (10 credits/min) makes seconds × rate fractional, which the
// balance RPC would truncate or reject. Round up, never to zero.
export function calculateDubbingCreditsByDuration(
  durationSeconds: number,
  multiplier = DUBBING_CREDIT_MULTIPLIER,
): number {
  return Math.max(
    getMinimumCreditsForDubbing(multiplier),
    Math.ceil(Math.ceil(durationSeconds) * multiplier),
  );
}

// Precheck floor before enqueue: enough for one second at the given rate, and never
// below a single credit — a dub is never free.
export function getMinimumCreditsForDubbing(multiplier = DUBBING_CREDIT_MULTIPLIER): number {
  return Math.max(1, Math.ceil(multiplier));
}

export function hasEnoughCredits(userCredits: number, requiredCredits: number): boolean {
  return userCredits >= requiredCredits;
}

export function getMinimumCreditsForGemini(multiplier = SCRIPT_CREDIT_MULTIPLIER): number {
  return Math.max(1, multiplier);
}

// ── Train AI ────────────────────────────────────────────────────────────────
// How much video the pipeline actually sends per source video. Two clipped windows
// (hook + a mid-video sample) rather than the whole thing: style is densest at the
// open, and this decouples our cost from the length the user picked. A 4-minute
// video and a 2-hour video cost exactly the same to train on.
export const TRAIN_AI_HOOK_WINDOW_SECONDS = 90;
export const TRAIN_AI_MID_WINDOW_SECONDS = 60;
export const TRAIN_AI_SECONDS_PER_VIDEO = TRAIN_AI_HOOK_WINDOW_SECONDS + TRAIN_AI_MID_WINDOW_SECONDS;

// Hard cap on videos analysed per run. Each video becomes 2 fileData parts, and
// Gemini limits video parts per request — 3 videos (6 parts) stays well inside it.
// More than 3 selected → we keep the 3 most-viewed (best style signal, bounded cost).
export const TRAIN_AI_MAX_VIDEOS = 3;

// Frame sampling rate. Default is 1 fps at 258 tokens/frame, which is ~89% of the
// bill spent on frames — but 9 of the 10 things we extract (tone, vocabulary, pacing,
// humour, structure, hooks, direct-address ratio, stats usage, emotional tone) live in
// the AUDIO. Only visual_style needs pictures, and that reads fine off a frame every
// 10s. Pair with mediaResolution=LOW, which drops frames to ~66 tokens.
export const TRAIN_AI_VIDEO_FPS = 0.1;

// Tokens/sec of sampled video at media_resolution=low + fps=0.1:
// ~66-token frames at 0.1 fps (≈7) + 32 audio + ~7 timestamps ≈ 46.
export const TRAIN_AI_TOKENS_PER_VIDEO_SECOND = 46;

// Structured output of the single analysis call: style block + transcripts + hooks
// + channel intelligence. Measured around 5k; 8k leaves room before we under-reserve.
const TRAIN_AI_ESTIMATED_OUTPUT_TOKENS = 8000;

// Hard ceiling for that call. On Gemini 3.x this budget covers thinking tokens too,
// so it sits well above the estimate — too low truncates mid-JSON.
export const TRAIN_AI_MAX_OUTPUT_TOKENS = 16000;

/**
 * What to require in the balance BEFORE the Gemini call runs — the pipeline used to
 * check credits only after every API call had already been paid for, so an
 * out-of-credit user burned full COGS and got charged nothing.
 *
 * Deliberately an over-estimate: reserving too much only means an edge-case user is
 * asked to top up, while reserving too little means we spend money we cannot bill.
 */
export function estimateTrainingCredits(
  videoCount: number,
  multiplier = TRAIN_AI_CREDIT_MULTIPLIER,
): number {
  const videos = Math.min(Math.max(videoCount, 1), TRAIN_AI_MAX_VIDEOS);
  const inputTokens = videos * TRAIN_AI_SECONDS_PER_VIDEO * TRAIN_AI_TOKENS_PER_VIDEO_SECOND;
  const totalTokens = inputTokens + TRAIN_AI_ESTIMATED_OUTPUT_TOKENS;
  return Math.ceil(totalTokens / TOKENS_PER_CREDIT) * multiplier;
}

export function getMinimumCreditsForIdeation(multiplier = IDEATION_CREDIT_MULTIPLIER): number {
  return Math.max(2, multiplier);
}

export function calculateIdeationCredits(
  params: TokenBasedCreditParams,
  config?: Omit<TokenCreditConfig, 'minimumCredits'>,
): number {
  return calculateCreditsFromTokens(params, {
    tokensPerCredit: config?.tokensPerCredit,
    multiplier: config?.multiplier ?? IDEATION_CREDIT_MULTIPLIER,
    minimumCredits: 2,
  });
}

export function getMinimumCreditsForStoryBuilder(multiplier = STORY_BUILDER_CREDIT_MULTIPLIER): number {
  return Math.max(2, multiplier);
}

export function calculateStoryBuilderCredits(
  params: TokenBasedCreditParams,
  config?: Omit<TokenCreditConfig, 'minimumCredits'>,
): number {
  return calculateCreditsFromTokens(params, {
    tokensPerCredit: config?.tokensPerCredit,
    multiplier: config?.multiplier ?? STORY_BUILDER_CREDIT_MULTIPLIER,
    minimumCredits: 2,
  });
}

/**
 * Thumbnails bill PER IMAGE — an image is a flat $0.039 vendor cost, so token-based
 * pricing (text rates) structurally under-charges it. `creditsPerImage` defaults to
 * THUMBNAIL_CREDIT_MULTIPLIER (= creditsForCost($0.039)).
 */
export function calculateThumbnailCreditsByCount(
  imageCount: number,
  creditsPerImage = THUMBNAIL_CREDIT_MULTIPLIER,
): number {
  return Math.max(1, imageCount * creditsPerImage);
}

/** @deprecated token-based thumbnail pricing under-captures per-image image cost — use calculateThumbnailCreditsByCount. */
export function calculateThumbnailCredits(
  params: TokenBasedCreditParams,
  config?: Omit<TokenCreditConfig, 'minimumCredits'>,
): number {
  return calculateCreditsFromTokens(params, {
    tokensPerCredit: config?.tokensPerCredit,
    multiplier: config?.multiplier ?? THUMBNAIL_CREDIT_MULTIPLIER,
    minimumCredits: 1,
  });
}

export function getMinimumCreditsForThumbnailRequest(
  generateCount: number,
  creditsPerImage = THUMBNAIL_CREDIT_MULTIPLIER,
): number {
  return Math.max(1, generateCount * creditsPerImage);
}

export function calculateSubtitleCredits(
  params: TokenBasedCreditParams,
  config?: Omit<TokenCreditConfig, 'minimumCredits'>,
): number {
  return calculateCreditsFromTokens(params, {
    tokensPerCredit: config?.tokensPerCredit,
    multiplier: config?.multiplier ?? SUBTITLE_CREDIT_MULTIPLIER,
    minimumCredits: 1,
  });
}

export function getMinimumCreditsForSubtitleRequest(multiplier = SUBTITLE_CREDIT_MULTIPLIER): number {
  return Math.max(1, multiplier);
}

// Duration-based, not token-based: cost = seconds × credits/sec. Rounded up so a
// partial second still charges a full second.
export function calculateVideoGenerationCredits(
  durationSeconds: number,
  multiplier = VIDEO_GENERATION_CREDIT_MULTIPLIER,
): number {
  return Math.max(multiplier, Math.ceil(durationSeconds) * multiplier);
}

// Precheck floor before enqueue: enough for one second of the cheapest clip.
export function getMinimumCreditsForVideoGeneration(multiplier = VIDEO_GENERATION_CREDIT_MULTIPLIER): number {
  return multiplier;
}
