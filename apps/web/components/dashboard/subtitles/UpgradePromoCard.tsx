"use client";

import { Gem, ArrowUpRight, Loader2 } from "lucide-react";
import { useBilling } from "@/hooks/useBilling";

/**
 * Recommends the NEXT plan up from the user's current one (Starter→Creator,
 * Creator→Pro, …). Renders nothing while loading or when already on the top tier.
 */
export function UpgradePromoCard() {
    const { plans, billingInfo, loading, subscribe, checkoutLoading } = useBilling();

    if (loading) return null;

    const currentName = billingInfo?.currentPlan?.name ?? "Starter";
    const tiers = plans
        .filter((p) => p.is_active)
        .sort((a, b) => a.price_monthly - b.price_monthly);

    const currentIdx = tiers.findIndex((p) => p.name === currentName);
    // Next paid tier above the current plan (fall back to the first paid tier if the
    // current plan isn't found in the active list).
    const nextPlan = currentIdx >= 0 ? tiers[currentIdx + 1] : tiers.find((p) => p.price_monthly > 0);

    if (!nextPlan) return null; // already on the highest tier

    const isLoadingThis = checkoutLoading === nextPlan.id;

    return (
        <div className="group relative bg-slate-900 rounded-3xl p-8 text-white overflow-hidden shadow-xl shadow-slate-200">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-violet-600/30 rounded-full blur-3xl group-hover:bg-violet-500/40 transition-colors duration-500"></div>
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
                <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-6">
                    <Gem className="h-6 w-6 text-violet-300" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Upgrade to {nextPlan.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                    {nextPlan.tagline ?? `Get ${nextPlan.credits_monthly.toLocaleString()} credits/month and longer, larger uploads.`}
                </p>
                <button
                    onClick={() => subscribe(nextPlan.id)}
                    disabled={isLoadingThis}
                    className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all transform active:scale-[0.98] disabled:opacity-60"
                >
                    {isLoadingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            Upgrade to {nextPlan.name}
                            <ArrowUpRight className="h-4 w-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
