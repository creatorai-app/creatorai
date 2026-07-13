"use client"

import { Gem, ArrowUpRight, Loader2, Check } from "lucide-react"
import { useBilling } from "@/hooks/useBilling"
import { VIDEO_GENERATION_PLANS } from "@repo/validation"

/**
 * Video generation is a paid feature (Pro/Business/Scale). Offers the cheapest
 * video-enabled plan the user isn't already on.
 */
export function VideoUpgradeCard() {
  const { plans, loading, subscribe, checkoutLoading } = useBilling()

  if (loading) return null

  const videoPlans = plans
    .filter((p) => p.is_active && VIDEO_GENERATION_PLANS.includes(p.name.toLowerCase() as never))
    .sort((a, b) => a.price_monthly - b.price_monthly)

  const target = videoPlans[0]
  if (!target) return null

  const isLoadingThis = checkoutLoading === target.id

  return (
    <div className="group relative bg-slate-900 rounded-3xl p-8 text-white overflow-hidden shadow-xl shadow-slate-200 dark:shadow-none">
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-violet-600/30 rounded-full blur-3xl group-hover:bg-violet-500/40 transition-colors duration-500" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl" />
      <div className="relative z-10">
        <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-6">
          <Gem className="h-6 w-6 text-violet-300" />
        </div>
        <h3 className="text-2xl font-bold mb-3">Video generation is a {videoPlans.map((p) => p.name).join(" & ")} feature</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          AI video generation with Gemini Omni Flash runs at real studio cost, so it&apos;s a paid feature.
          Upgrade to {target.name} to turn prompts, images and references into fully generated video clips.
        </p>
        <ul className="space-y-2 mb-8 text-sm text-slate-300">
          {videoPlans.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-violet-300" />
              {p.name} — {p.credits_monthly.toLocaleString()} credits/month
            </li>
          ))}
        </ul>
        <button
          onClick={() => subscribe(target.id)}
          disabled={isLoadingThis}
          className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all transform active:scale-[0.98] disabled:opacity-60"
        >
          {isLoadingThis ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>Upgrade to {target.name}<ArrowUpRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  )
}
