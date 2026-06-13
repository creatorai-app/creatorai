"use client";

import { Sparkles, Zap, ArrowRight } from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/dialog";
import Link from "next/link";

interface PremiumGateModalProps {
  open: boolean;
  onClose: () => void;
  featureLabel?: string;
}

const PERKS = [
  "Generate up to 3 ideas per run",
  "Comparison metrics: trends & keywords",
];

export default function PremiumGateModal({ open, onClose, featureLabel }: PremiumGateModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v: any) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-0">
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 px-6 pt-8 pb-10 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 mb-4">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-white">
                Unlock Premium
              </DialogTitle>
              <DialogDescription className="text-purple-100/90 text-sm">
                {featureLabel ? (
                  <>
                    <strong className="text-white">{featureLabel}</strong> requires a higher plan.
                  </>
                ) : (
                  "This feature requires a higher plan."
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-5 space-y-5">
          <div className="space-y-2.5">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Zap className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                {perk}
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-slate-400 dark:text-slate-500">
            Available on <span className="font-semibold text-purple-600 dark:text-purple-400">Creator+</span> and <span className="font-semibold text-purple-600 dark:text-purple-400">Enterprise</span> plans
          </p>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Maybe Later
            </Button>
            <Button asChild className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0 shadow-md shadow-purple-500/20">
              <Link href="/dashboard/settings?tab=billing" onClick={onClose}>
                Upgrade Now
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
