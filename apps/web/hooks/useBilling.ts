"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useSupabase } from "@/components/supabase-provider";
import { trackFunnel } from "@/lib/funnel";
import { readAttribution } from "@/lib/attribution";
import {
  getPlans,
  getBillingInfo,
  invalidateBilling,
  type Plan,
  type BillingInfo,
} from "@/lib/api/billing";

export function useBilling() {
  const { user, fetchUserProfile } = useSupabase();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [plansRes, infoRes] = await Promise.allSettled([getPlans(), getBillingInfo()]);
    if (plansRes.status === "fulfilled") setPlans(plansRes.value);
    if (infoRes.status === "fulfilled") setBillingInfo(infoRes.value);
    if (plansRes.status === "rejected" || infoRes.status === "rejected") {
      toast.error("Failed to load billing details");
    }
    setLoading(false);
  }, []);

  /** Re-read from the server rather than the cached window — billing just changed. */
  const refresh = useCallback(async () => {
    invalidateBilling();
    await loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const subscribe = useCallback(async (planId: string, interval: "monthly" | "annual" = "monthly") => {
    setCheckoutLoading(planId);

    // Purchase intent is recorded HERE rather than at each button, so every route
    // into checkout is counted: billing settings, the subtitles upgrade card, the
    // video-generation upgrade card, and anything added later. Previously only the
    // marketing pricing cards fired it, which is why the admin funnel showed tiers
    // with more checkouts than clicks. `checkout_started` is recorded server-side
    // and already counted every route, so the two steps now agree.
    const planName = plans.find((p) => p.id === planId)?.name;
    if (planName) trackFunnel("plan_clicked", planName);

    try {
      const { url } = await api.post<{ url: string }>(
        "/api/v1/billing/checkout",
        {
          planId,
          affiliateCode: readAttribution("affiliate_ref"),
          promoCode: readAttribution("promo_code"),
          interval,
          origin:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
        { requireAuth: true },
      );
      if (url) window.location.href = url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      toast.error(message);
    } finally {
      setCheckoutLoading(null);
    }
  }, [plans]);

  const cancelSubscription = useCallback(async () => {
    setCancelLoading(true);
    try {
      await api.post("/api/v1/billing/cancel", {}, { requireAuth: true });
      toast.success("Subscription cancelled", {
        description: "You have been switched to the free plan.",
      });
      await refresh();
      // Refresh the shared profile so the header credit badge updates immediately.
      if (user?.id) await fetchUserProfile(user.id);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to cancel subscription";
      toast.error(message);
    } finally {
      setCancelLoading(false);
    }
  }, [refresh, user?.id, fetchUserProfile]);

  return {
    plans,
    billingInfo,
    loading,
    checkoutLoading,
    portalLoading,
    cancelLoading,
    subscribe,
    cancelSubscription,
    refresh,
  };
}
