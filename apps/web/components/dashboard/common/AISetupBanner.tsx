"use client";

import { useState } from "react";
import Link from "next/link";
import { Youtube, Brain, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useSupabase } from "@/components/supabase-provider";
import { connectYoutubeChannel } from "@/lib/connectYT";

export type SetupStep = "connect" | "train";

/**
 * Inline notice telling the user what setup this feature still needs, shown
 * before they invest effort in a form they can't submit. Only ever surfaces the
 * *next* step — connecting the channel, then training — because training is
 * itself gated on a connected channel, so naming both at once is noise.
 *
 * Pairs with AISetupModal, which is the same information at the moment of the
 * blocked click. Render this near the top of a feature page; render the modal once.
 */
export function AISetupBanner({ step }: { step: SetupStep }) {
  const { supabase, user, profile } = useSupabase();
  const [connecting, setConnecting] = useState(false);

  const isConnect = step === "connect";
  const Icon = isConnect ? Youtube : Brain;

  const copy = isConnect
    ? {
        eyebrow: "Step 1 of 2",
        title: "Connect your YouTube channel to use this feature",
        body: "Linking your channel lets the AI learn your voice, style and niche. It takes about a minute.",
        cta: "Connect channel",
      }
    : {
        eyebrow: "Step 2 of 2",
        title: "Train your AI to use this feature",
        body: "Your channel is connected. Training builds your personal model so everything sounds like you.",
        cta: "Start training",
      };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50 via-white to-white p-5 sm:p-6 dark:border-purple-900/40 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-400/15 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
          <Icon className="h-6 w-6" />
        </span>

        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
            {copy.eyebrow}
          </span>
          <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-50">
            {copy.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {copy.body}
          </p>
          {/* Free run is once per account and keyed off free_training_used, which
              survives a disconnect — same source the dashboard onboarding uses. */}
          {!isConnect && !profile?.free_training_used && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
              <Sparkles className="h-3.5 w-3.5" />
              Your first training is free. No credits charged.
            </p>
          )}
        </div>

        {isConnect ? (
          <button
            onClick={() => connectYoutubeChannel({ supabase, user, setIsConnectingYoutube: setConnecting })}
            disabled={connecting}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-purple-700 active:scale-[0.98] disabled:opacity-60 sm:w-auto"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {copy.cta} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <Link
            href="/dashboard/train"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-purple-700 active:scale-[0.98] sm:w-auto"
          >
            {copy.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
