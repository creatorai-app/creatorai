// Ideas per run scale with the plan. Comparison metrics need more than one idea
// to compare, so Starter (one idea) goes without them.
export interface IdeationLimits {
  maxIdeas: number;
  comparisonMetrics: boolean;
}

const STARTER_LIMITS: IdeationLimits = { maxIdeas: 1, comparisonMetrics: false };
const CREATOR_LIMITS: IdeationLimits = { maxIdeas: 3, comparisonMetrics: true };
const PRO_LIMITS: IdeationLimits = { maxIdeas: 10, comparisonMetrics: true };

export const IDEATION_PLAN_LIMITS: Record<string, IdeationLimits> = {
  Starter: STARTER_LIMITS,
  Creator: CREATOR_LIMITS,
  Pro: PRO_LIMITS,
  Business: PRO_LIMITS,
  Scale: PRO_LIMITS,
};

export type IdeationPlanName = keyof typeof IDEATION_PLAN_LIMITS;

export const IDEATION_ABSOLUTE_MAX_IDEAS = 10;

/** Unknown or missing plan is Starter, matching the billing default. */
export function getIdeationLimitsForPlan(planName?: string | null): IdeationLimits {
  const key = Object.keys(IDEATION_PLAN_LIMITS).find((k) => k.toLowerCase() === planName?.toLowerCase());
  return key ? IDEATION_PLAN_LIMITS[key]! : STARTER_LIMITS;
}

export function hasIdeationComparisonMetrics(planName?: string | null): boolean {
  return getIdeationLimitsForPlan(planName).comparisonMetrics;
}

/** Thumbnail variations per run: one on Starter, three for A/B testing on every paid plan. */
export function maxThumbnailsForPlan(planName?: string | null): number {
  return getIdeationLimitsForPlan(planName) === STARTER_LIMITS ? 1 : 3;
}
