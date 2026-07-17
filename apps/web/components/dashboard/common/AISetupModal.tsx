"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Youtube, Brain, Check, ArrowUpRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/dialog";
import { useSupabase } from "@/components/supabase-provider";
import { connectYoutubeChannel } from "@/lib/connectYT";

/**
 * Shown when a user tries to generate before completing setup. Users can explore
 * every feature freely; the generate action is gated on connecting a YouTube
 * channel and training the AI. The CTA adapts to whichever step is still pending.
 */
export function AISetupModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { supabase, user, profile } = useSupabase();
  const [connecting, setConnecting] = useState(false);

  const connected = profile?.youtube_connected === true;
  const trained = profile?.ai_trained === true;

  const steps = [
    { key: "connect", label: "Connect your YouTube channel", icon: Youtube, done: connected },
    { key: "train", label: "Train your personal AI model", icon: Brain, done: trained },
  ];

  const handleConnect = () =>
    connectYoutubeChannel({ supabase, user, setIsConnectingYoutube: setConnecting });

  const goTrain = () => {
    onOpenChange(false);
    router.push("/dashboard/train");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-none bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Finish setting up your AI</DialogTitle>
        <div className="group relative bg-slate-900 rounded-3xl p-8 text-white overflow-hidden shadow-xl">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-violet-600/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-6">
              <Brain className="h-6 w-6 text-violet-300" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Finish setting up your AI</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              This feature is powered by your personalized AI. Connect your channel and train your
              model to start generating content tailored to your unique style.
            </p>

            <ul className="space-y-3 mb-8">
              {steps.map((s) => (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
                      s.done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {s.done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  </span>
                  <span className={s.done ? "text-slate-400 line-through" : "text-slate-100"}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>

            {!connected ? (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Youtube className="h-4 w-4" /> Connect YouTube channel
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goTrain}
                className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                Go to AI Training <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
