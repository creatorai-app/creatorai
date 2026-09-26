import {
  CREDIT_FLOOR_USD,
  DUBBING_CREDIT_MULTIPLIER,
  IDEATION_CREDIT_MULTIPLIER,
  MAX_COGS_PER_CREDIT_USD,
  SCRIPT_CREDIT_MULTIPLIER,
  STARTER_DUBBING_CREDIT_MULTIPLIER,
  STORY_BUILDER_CREDIT_MULTIPLIER,
  SUBTITLE_CREDIT_MULTIPLIER,
  TARGET_GROSS_MARGIN,
  THUMBNAIL_CREDIT_MULTIPLIER,
  TOKENS_PER_CREDIT,
  TRAIN_AI_CREDIT_MULTIPLIER,
  TRAIN_AI_MAX_VIDEOS,
  VIDEO_GENERATION_CREDIT_MULTIPLIER,
  calculateCreditsFromTokens,
  calculateDubbingCreditsByDuration,
  calculateIdeationCredits,
  calculateStoryBuilderCredits,
  calculateSubtitleCredits,
  calculateThumbnailCreditsByCount,
  calculateVideoGenerationCredits,
  creditsForCost,
  dubbingHoursForPlan,
  dubbingMultiplierForPlan,
  estimateTrainingCredits,
  formatDubbingAllowance,
  formatUploadLimit,
  getMinimumCreditsForDubbing,
  getMinimumCreditsForGemini,
  getMinimumCreditsForIdeation,
  getMinimumCreditsForStoryBuilder,
  getMinimumCreditsForSubtitleRequest,
  getMinimumCreditsForThumbnailRequest,
  getMinimumCreditsForVideoGeneration,
  hasEnoughCredits,
  subtitleMaxDurationSeconds,
  subtitleUploadLimitBytes,
  SUBTITLE_FREE_UPLOAD_BYTES,
  SUBTITLE_PAID_UPLOAD_BYTES,
  SUBTITLE_FREE_MAX_DURATION_SECONDS,
  SUBTITLE_PAID_MAX_DURATION_SECONDS,
} from '@repo/validation';

/**
 * The pricing core every feature bills against. These are pure functions, and a
 * rounding slip in any of them is either revenue given away or a user charged
 * for work we did not do — so the edges are pinned here rather than discovered
 * in a billing report.
 */

describe('creditsForCost (margin policy)', () => {
  it('derives the per-credit COGS ceiling from the floor price and target margin', () => {
    expect(MAX_COGS_PER_CREDIT_USD).toBeCloseTo(CREDIT_FLOOR_USD * (1 - TARGET_GROSS_MARGIN), 10);
  });

  it('never prices a unit of work at zero credits, however cheap', () => {
    expect(creditsForCost(0)).toBe(1);
    expect(creditsForCost(0.000001)).toBe(1);
  });

  it('rounds up, so a fractional credit is never given away', () => {
    // Exactly one credit's worth of COGS plus a hair must cost two.
    expect(creditsForCost(MAX_COGS_PER_CREDIT_USD)).toBe(1);
    expect(creditsForCost(MAX_COGS_PER_CREDIT_USD * 1.01)).toBe(2);
  });

  it.each([
    [0.039, THUMBNAIL_CREDIT_MULTIPLIER, 'an image'],
    [0.1, VIDEO_GENERATION_CREDIT_MULTIPLIER, 'a second of video'],
  ])('the published multiplier for %s still clears the target margin', (cogs, multiplier) => {
    // The multipliers are hand-set (see the note on unpriced drift in credits.ts);
    // this asserts they have not drifted BELOW what the vendor rate costs us.
    expect(multiplier).toBeGreaterThanOrEqual(creditsForCost(cogs) * 0.75);
  });
});

describe('calculateCreditsFromTokens', () => {
  it('charges per started 1k-token block, not per token', () => {
    expect(calculateCreditsFromTokens({ totalTokens: 1 }, { multiplier: 1 })).toBe(1);
    expect(calculateCreditsFromTokens({ totalTokens: TOKENS_PER_CREDIT }, { multiplier: 1 })).toBe(1);
    expect(calculateCreditsFromTokens({ totalTokens: TOKENS_PER_CREDIT + 1 }, { multiplier: 1 })).toBe(2);
  });

  it('applies the multiplier after the block rounding', () => {
    expect(calculateCreditsFromTokens({ totalTokens: 1_500 }, { multiplier: 6 })).toBe(12);
  });

  it('charges the minimum for a call that reported no tokens', () => {
    // A zero-token response still cost a request; it must not be free.
    expect(calculateCreditsFromTokens({ totalTokens: 0 }, { multiplier: 6 })).toBe(1);
    expect(calculateCreditsFromTokens({ totalTokens: 0 }, { multiplier: 6, minimumCredits: 2 })).toBe(2);
  });

  it('honors an env-overridden tokens-per-credit rate', () => {
    expect(calculateCreditsFromTokens({ totalTokens: 1_000 }, { tokensPerCredit: 500, multiplier: 1 })).toBe(2);
  });
});

describe('per-feature token pricing', () => {
  it.each([
    ['subtitle', calculateSubtitleCredits, SUBTITLE_CREDIT_MULTIPLIER, 1],
    ['ideation', calculateIdeationCredits, IDEATION_CREDIT_MULTIPLIER, 2],
    ['story builder', calculateStoryBuilderCredits, STORY_BUILDER_CREDIT_MULTIPLIER, 2],
  ])('%s bills at its multiplier and never below its floor', (_name, calc, multiplier, floor) => {
    expect(calc({ totalTokens: 10_000 })).toBe(10 * multiplier);
    expect(calc({ totalTokens: 0 })).toBe(floor);
  });

  it.each([
    ['gemini/script', getMinimumCreditsForGemini, SCRIPT_CREDIT_MULTIPLIER],
    ['subtitle', getMinimumCreditsForSubtitleRequest, SUBTITLE_CREDIT_MULTIPLIER],
    ['ideation', getMinimumCreditsForIdeation, IDEATION_CREDIT_MULTIPLIER],
    ['story builder', getMinimumCreditsForStoryBuilder, STORY_BUILDER_CREDIT_MULTIPLIER],
  ])('the %s precheck floor matches its multiplier', (_name, floor, multiplier) => {
    expect(floor()).toBe(multiplier);
  });

  it('keeps the precheck floor above zero even if an env override sets a tiny multiplier', () => {
    expect(getMinimumCreditsForGemini(0)).toBe(1);
    expect(getMinimumCreditsForSubtitleRequest(0)).toBe(1);
    expect(getMinimumCreditsForIdeation(0)).toBe(2);
  });
});

describe('thumbnail pricing (per image)', () => {
  it('scales linearly with the batch size', () => {
    expect(calculateThumbnailCreditsByCount(4)).toBe(4 * THUMBNAIL_CREDIT_MULTIPLIER);
  });

  it('charges at least one credit for a degenerate zero-image request', () => {
    expect(calculateThumbnailCreditsByCount(0)).toBe(1);
  });

  it('prechecks the whole batch, not a single image', () => {
    expect(getMinimumCreditsForThumbnailRequest(3)).toBe(3 * THUMBNAIL_CREDIT_MULTIPLIER);
  });
});

describe('video generation pricing (per second)', () => {
  it.each([4, 6, 8])('charges %ss at the per-second rate', (seconds) => {
    expect(calculateVideoGenerationCredits(seconds)).toBe(seconds * VIDEO_GENERATION_CREDIT_MULTIPLIER);
  });

  it('rounds a partial second up to a whole one', () => {
    expect(calculateVideoGenerationCredits(4.1)).toBe(5 * VIDEO_GENERATION_CREDIT_MULTIPLIER);
  });

  it('bills a zero-length clip as one second rather than nothing', () => {
    expect(calculateVideoGenerationCredits(0)).toBe(VIDEO_GENERATION_CREDIT_MULTIPLIER);
  });

  it('prechecks one second of the cheapest clip', () => {
    expect(getMinimumCreditsForVideoGeneration()).toBe(VIDEO_GENERATION_CREDIT_MULTIPLIER);
  });
});

describe('dubbing pricing (per second, plan-dependent)', () => {
  it('treats a user with no plan as Starter, matching the clip cap', () => {
    expect(dubbingMultiplierForPlan(null)).toBe(STARTER_DUBBING_CREDIT_MULTIPLIER);
    expect(dubbingMultiplierForPlan(undefined)).toBe(STARTER_DUBBING_CREDIT_MULTIPLIER);
    expect(dubbingMultiplierForPlan('starter')).toBe(STARTER_DUBBING_CREDIT_MULTIPLIER);
    expect(dubbingMultiplierForPlan('STARTER')).toBe(STARTER_DUBBING_CREDIT_MULTIPLIER);
  });

  it.each(['Creator', 'Pro', 'Business', 'Scale'])('bills %s at the paid rate', (plan) => {
    expect(dubbingMultiplierForPlan(plan)).toBe(DUBBING_CREDIT_MULTIPLIER);
  });

  it('rounds the fractional paid rate up, since the balance column is an integer', () => {
    // 10 credits/min: a single second would otherwise cost 1/6 of a credit.
    expect(calculateDubbingCreditsByDuration(60)).toBe(10);
    expect(calculateDubbingCreditsByDuration(1)).toBe(1);
    expect(calculateDubbingCreditsByDuration(0)).toBe(getMinimumCreditsForDubbing());
  });

  it('rounds a partial second up before applying the rate', () => {
    expect(calculateDubbingCreditsByDuration(59.1, 3)).toBe(180);
  });

  it("makes Creator's 3,000 credits worth exactly five hours", () => {
    expect(dubbingHoursForPlan(3_000, 'Creator')).toBe(5);
  });

  it('shows a sub-hour allowance in minutes, where hours would read as nothing', () => {
    expect(formatDubbingAllowance(500, 'Starter')).toMatch(/min$/);
    expect(formatDubbingAllowance(3_000, 'Creator')).toBe('5.0 hrs');
  });

  it('never prechecks below a single credit', () => {
    expect(getMinimumCreditsForDubbing()).toBe(1);
    expect(getMinimumCreditsForDubbing(3)).toBe(3);
  });
});

describe('training cost estimate', () => {
  it('clamps the video count into the range the pipeline actually samples', () => {
    // Below 1 and above the cap both collapse onto the bounds, so the reservation
    // cannot be gamed by sending a silly count.
    expect(estimateTrainingCredits(0)).toBe(estimateTrainingCredits(1));
    expect(estimateTrainingCredits(50)).toBe(estimateTrainingCredits(TRAIN_AI_MAX_VIDEOS));
  });

  it('grows with each additional video, since each adds sampled input tokens', () => {
    expect(estimateTrainingCredits(3)).toBeGreaterThan(estimateTrainingCredits(1));
  });

  it('bills in whole credits at the training multiplier', () => {
    expect(estimateTrainingCredits(1) % TRAIN_AI_CREDIT_MULTIPLIER).toBe(0);
  });
});

describe('hasEnoughCredits', () => {
  it('lets a balance exactly equal to the cost through', () => {
    expect(hasEnoughCredits(100, 100)).toBe(true);
    expect(hasEnoughCredits(99, 100)).toBe(false);
  });

  it('refuses a negative balance', () => {
    expect(hasEnoughCredits(-1, 1)).toBe(false);
  });
});

describe('subtitle upload limits', () => {
  it('separates the free and paid ceilings on both size and length', () => {
    expect(subtitleUploadLimitBytes(false)).toBe(SUBTITLE_FREE_UPLOAD_BYTES);
    expect(subtitleUploadLimitBytes(true)).toBe(SUBTITLE_PAID_UPLOAD_BYTES);
    expect(subtitleMaxDurationSeconds(false)).toBe(SUBTITLE_FREE_MAX_DURATION_SECONDS);
    expect(subtitleMaxDurationSeconds(true)).toBe(SUBTITLE_PAID_MAX_DURATION_SECONDS);
  });

  it('formats a limit the way the rejection message reads it', () => {
    expect(formatUploadLimit(SUBTITLE_FREE_UPLOAD_BYTES)).toBe('100MB');
    expect(formatUploadLimit(SUBTITLE_PAID_UPLOAD_BYTES)).toBe('2GB');
    expect(formatUploadLimit(1.5 * 1024 * 1024 * 1024)).toBe('1.5GB');
  });
});
