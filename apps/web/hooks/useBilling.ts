"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useSupabase } from "@/components/supabase-provider";

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_annual_monthly: number | null;
  credits_monthly: number;
  features: string[];
  is_active: boolean;
  tagline: string | null;
  ls_variant_id: string | null;
  ls_variant_id_annual: string | null;
}

interface SubscriptionInfo {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
  lsSubscriptionId: string | null;
}

interface BillingInfo {
  currentPlan: Plan | null;
  subscription: SubscriptionInfo | null;
  credits: number;
}

export function useBilling() {
  const { user, fetchUserProfile } = useSupabase();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await api.get<Plan[]>("/api/v1/billing/plans");
      setPlans(data);
    } catch {
      toast.error("Failed to load plans");
    }
  }, []);

  const fetchBillingInfo = useCallback(async () => {
    try {
      const data = await api.get<BillingInfo>("/api/v1/billing/info", {
        requireAuth: true,
      });
      setBillingInfo(data);
    } catch {
      toast.error("Failed to load billing info");
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPlans(), fetchBillingInfo()]);
    setLoading(false);
  }, [fetchPlans, fetchBillingInfo]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const subscribe = useCallback(async (planId: string, interval: "monthly" | "annual" = "monthly") => {
    setCheckoutLoading(planId);
    try {
      let affiliateCode: string | undefined;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("affiliate_ref");
          if (raw) {
            const { code, ts } = JSON.parse(raw) as { code: string; ts: number };
            const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
            if (Date.now() - ts < THIRTY_DAYS) affiliateCode = code;
            else localStorage.removeItem("affiliate_ref");
          }
        } catch { /* ignore malformed data */ }
      }
      const { url } = await api.post<{ url: string }>(
        "/api/v1/billing/checkout",
        {
          planId,
          affiliateCode,
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
  }, []);

  const cancelSubscription = useCallback(async () => {
    setCancelLoading(true);
    try {
      await api.post("/api/v1/billing/cancel", {}, { requireAuth: true });
      toast.success("Subscription cancelled", {
        description: "You have been switched to the free plan.",
      });
      await loadAll();
      // Refresh the shared profile so the header credit badge updates immediately.
      if (user?.id) await fetchUserProfile(user.id);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to cancel subscription";
      toast.error(message);
    } finally {
      setCancelLoading(false);
    }
  }, [loadAll, user?.id, fetchUserProfile]);

  return {
    plans,
    billingInfo,
    loading,
    checkoutLoading,
    portalLoading,
    cancelLoading,
    subscribe,
    cancelSubscription,
    refresh: loadAll,
  };
}
