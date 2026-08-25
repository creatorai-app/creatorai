"use client";

import { useState } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { AISetupModal } from "@/components/dashboard/common/AISetupModal";
import { AISetupBanner, type SetupStep } from "@/components/dashboard/common/AISetupBanner";

/**
 * Gate for generation actions. `locked` is true until the user has connected a
 * YouTube channel AND trained their AI.
 *
 * Two surfaces, same state:
 * - `banner` — render near the top of the page so the user learns what's missing
 *   *before* filling in a form they can't submit.
 * - `modal` — render once and wire `requestUnlock` to the generate button, for
 *   the user who goes ahead and clicks anyway.
 *
 * Both show only the next actionable step: training is itself gated on a
 * connected channel, so asking for both at once just makes the first one unclear.
 */
export function useAISetupGate() {
  const { profile } = useSupabase();
  const [open, setOpen] = useState(false);

  const connected = profile?.youtube_connected === true;
  const trained = profile?.ai_trained === true;
  const locked = !(connected && trained);

  const step: SetupStep | null = !connected ? "connect" : !trained ? "train" : null;

  return {
    locked,
    step,
    requestUnlock: () => setOpen(true),
    banner: step ? <AISetupBanner step={step} /> : null,
    modal: <AISetupModal open={open} onOpenChange={setOpen} />,
  };
}
