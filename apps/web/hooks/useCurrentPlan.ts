"use client";

import { useState, useEffect, useMemo } from "react";
import { getBillingInfo } from "@/lib/api/billing";
import {
  getIdeationLimitsForPlan,
  hasIdeationComparisonMetrics,
  type IdeationPlanName,
} from "@repo/validation";

export function useCurrentPlan() {
  const [planName, setPlanName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBillingInfo()
      .then((data) => setPlanName(data.currentPlan?.name ?? "Starter"))
      .catch(() => setPlanName("Starter"))
      .finally(() => setLoading(false));
  }, []);

  const ideationLimits = useMemo(
    () => getIdeationLimitsForPlan(planName ?? "Starter"),
    [planName],
  );

  return {
    planName,
    loading,
    isStarter: !loading && planName === "Starter",
    maxIdeas: ideationLimits.maxIdeas,
    // Every feature is available on every plan, always true now, kept so the
    // metrics link in the research view renders for everyone.
    hasComparisonMetrics: !loading && hasIdeationComparisonMetrics(planName),
    ideationLimits,
    planTier: (planName ?? "Starter") as IdeationPlanName,
  };
}
