// Every feature is available on every plan — plans differ only by their monthly
// credit allowance, never by feature locks. Ideation therefore grants the same
// capabilities (idea count + comparison metrics) to all plans; actual usage is
// bounded only by a user's available credits.
export interface IdeationLimits {
  maxIdeas: number;
  comparisonMetrics: boolean;
}

const UNLOCKED_LIMITS: IdeationLimits = { maxIdeas: 20, comparisonMetrics: true };

export const IDEATION_PLAN_LIMITS: Record<string, IdeationLimits> = {
  Starter: UNLOCKED_LIMITS,
  Creator: UNLOCKED_LIMITS,
  Pro: UNLOCKED_LIMITS,
  Business: UNLOCKED_LIMITS,
  Scale: UNLOCKED_LIMITS,
};

export type IdeationPlanName = keyof typeof IDEATION_PLAN_LIMITS;

export const IDEATION_ABSOLUTE_MAX_IDEAS = 20;

export function getIdeationLimitsForPlan(_planName?: string | null): IdeationLimits {
  // Uniform across all plans — no feature gating.
  return UNLOCKED_LIMITS;
}

export function hasIdeationComparisonMetrics(_planName?: string | null): boolean {
  return UNLOCKED_LIMITS.comparisonMetrics;
}
