"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useBilling } from "@/hooks/useBilling";
import type { DashboardHomeProps } from "./types";
import { OnboardingDashboardView } from "./OnboardingDashboardView";
import { ConnectedDashboardView } from "./ConnectedDashboardView";

export function DashboardHome(props: DashboardHomeProps) {
  const { billingInfo } = useBilling();
  const currentPlanName = billingInfo?.currentPlan?.name ?? "Free";
  const subscription = billingInfo?.subscription;

  const isYoutubeConnected = props.profile?.youtube_connected === true;
  const isAiTrained = props.profile?.ai_trained === true;
  const isSetupComplete = isYoutubeConnected && isAiTrained;
  const progressValue = isYoutubeConnected ? (isAiTrained ? 100 : 50) : 0;

  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(
        <div className="font-semibold text-red-600">
          Oops! We couldn't connect your YouTube channel. Please try again.
        </div>,
        { className: "bg-red-50 border-red-600 text-red-900" },
      );
    }
  }, [searchParams]);

  // Compute shared metrics
  const creditsUsed = [
    ...props.data.scripts.map((s) => s.credits_consumed || 0),
    ...props.data.ideations.map((i) => i.credits_consumed || 0),
  ].reduce((a, b) => a + b, 0);
  
  const totalCredits = (creditsUsed + (props.profile?.credits || 0)) || 10000;
  const creditsPercentage = (creditsUsed / totalCredits) * 100;

  const sharedProps = {
    ...props,
    currentPlanName,
    subscription,
    creditsUsed,
    totalCredits,
    creditsPercentage,
    progressValue,
    isYoutubeConnected,
    isAiTrained
  };

  if (!isSetupComplete) {
    return <OnboardingDashboardView {...sharedProps} />;
  }

  return <ConnectedDashboardView {...sharedProps} />;
}
