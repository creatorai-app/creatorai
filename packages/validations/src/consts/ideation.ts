export const IDEATION_PLAN_LIMITS = {
  Starter: { maxIdeas: 1, comparisonMetrics: false },
  'Creator+': { maxIdeas: 3, comparisonMetrics: true },
  Enterprise: { maxIdeas: 20, comparisonMetrics: true },
} as const;

export type IdeationPlanName = keyof typeof IDEATION_PLAN_LIMITS;

export const IDEATION_ABSOLUTE_MAX_IDEAS = 20;

export function getIdeationLimitsForPlan(planName: string | null | undefined) {
  if (planName && planName in IDEATION_PLAN_LIMITS) {
    return IDEATION_PLAN_LIMITS[planName as IdeationPlanName];
  }
  return IDEATION_PLAN_LIMITS.Starter;
}

export function hasIdeationComparisonMetrics(planName: string | null | undefined): boolean {
  return getIdeationLimitsForPlan(planName).comparisonMetrics;
}
