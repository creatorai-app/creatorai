"use client";

import { useState } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { AISetupModal } from "@/components/dashboard/common/AISetupModal";

/**
 * Gate for generation actions. `locked` is true until the user has connected a
 * YouTube channel AND trained their AI. Render `modal` once in the page and wire
 * `requestUnlock` to the generate button's onClick when locked.
 */
export function useAISetupGate() {
  const { profile } = useSupabase();
  const [open, setOpen] = useState(false);

  const locked = !(profile?.youtube_connected === true && profile?.ai_trained === true);

  return {
    locked,
    requestUnlock: () => setOpen(true),
    modal: <AISetupModal open={open} onOpenChange={setOpen} />,
  };
}
