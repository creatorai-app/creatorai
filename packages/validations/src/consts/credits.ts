export const TOKENS_PER_CREDIT = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Margin policy (single source of truth for how features are priced in credits)
//
// Every feature must clear TARGET_GROSS_MARGIN at the LOWEST price a credit sells
// for across active plans (CREDIT_FLOOR_USD). After the plan recalibration
// (Scale trimmed to 100k credits) the floor is ~$0.006/credit (Business/Scale).
// So a credit may cost us at most MAX_COGS_PER_CREDIT_USD in vendor spend.
//
// Multipliers below are DERIVED from this rule using real 2026 vendor rates:
//   Gemini 3.5 Flash  $1.50/M in, $9/M out  → ~$0.006 / 1k tokens (40/60 blend)
//   Gemini 2.5 Flash Image  $0.039 / image
//   Gemini Omni Flash video  $0.10 / second
//   ElevenLabs dubbing  $0.50 / min = $0.0083 / second
// See docs / the business-model doc for the full working. All are env-overridable.
// ─────────────────────────────────────────────────────────────────────────────
export const TARGET_GROSS_MARGIN = 0.8;
export const CREDIT_FLOOR_USD = 0.006; // lowest plan $/credit after recalibration
export const MAX_COGS_PER_CREDIT_USD = CREDIT_FLOOR_USD * (1 - TARGET_GROSS_MARGIN); // $0.0012

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
export const TRAIN_AI_CREDIT_MULTIPLIER = 6; // input-heavy → margin runs higher than 80%

// Thumbnails bill PER IMAGE, not per token: an image costs $0.039 flat, which the
// text-token rate can't capture. creditsForCost(0.039) = 33 credits/image ⇒ ~82%.
export const THUMBNAIL_CREDIT_MULTIPLIER = 33; // credits per generated image

// Video (Omni) billed per SECOND: creditsForCost(0.10) = 84 ⇒ an 8s clip = 680 credits.
export const VIDEO_GENERATION_CREDIT_MULTIPLIER = 85;

// Dubbing billed per SECOND of source audio ($0.0083/s): creditsForCost(0.0083) = 7,
// but we keep 15/sec (already ~91% margin) as a headroom buffer on clone-time variance.
export const DUBBING_CREDIT_MULTIPLIER = 15;

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
export function calculateDubbingCreditsByDuration(
  durationSeconds: number,
  multiplier = DUBBING_CREDIT_MULTIPLIER,
): number {
  return Math.max(multiplier, Math.ceil(durationSeconds) * multiplier);
}

// Precheck floor before enqueue: enough for one second at the given rate.
export function getMinimumCreditsForDubbing(multiplier = DUBBING_CREDIT_MULTIPLIER): number {
  return multiplier;
}

export function hasEnoughCredits(userCredits: number, requiredCredits: number): boolean {
  return userCredits >= requiredCredits;
}

export function getMinimumCreditsForGemini(multiplier = SCRIPT_CREDIT_MULTIPLIER): number {
  return Math.max(1, multiplier);
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
