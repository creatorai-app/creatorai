"use client";

import { useEffect, useState } from "react";
import * as motion from "motion/react-m";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { Switch } from "@repo/ui/switch";
import { Skeleton } from "@repo/ui/skeleton";
import { Sparkles, Loader2, ArrowLeft, Lock } from "lucide-react";
import IdeationProgress from "@/components/dashboard/research/IdeationProgress";
import { useIdeation } from "@/hooks/useIdeation";
import { useAISetupGate } from "@/hooks/useAISetupGate";
import { useCurrentPlan } from "@/hooks/useCurrentPlan";
import Link from "next/link";

const NICHE_EXAMPLES = [
  "AI tools for small business owners",
  "Budget travel hacks for solo travelers",
  "Home workouts for busy professionals",
];

const HOW_IT_WORKS_STEPS = [
  "Choose Auto mode or set a niche focus.",
  "Add optional context for audience or constraints.",
  "Generate ideas and review the best opportunities.",
];

export default function NewIdeationPage() {
  const router = useRouter();
  // Every plan has the same idea capabilities, usage is bounded only by credits.
  const { maxIdeas, loading: planLoading } = useCurrentPlan();
  const gate = useAISetupGate();
  const [customCount, setCustomCount] = useState("3");
  const {
    context, setContext,
    nicheFocus, setNicheFocus,
    setIdeaCount,
    autoMode, setAutoMode,
    isGenerating,
    progress,
    statusMessage,
    generatedResult,
    activeJobDbId,
    aiTrained, credits, isLoadingProfile,
    handleGenerate,
  } = useIdeation();

  useEffect(() => {
    if (planLoading) return;
    const def = Math.min(3, maxIdeas);
    setIdeaCount(def);
    setCustomCount(String(def));
  }, [planLoading, maxIdeas, setIdeaCount, setCustomCount]);

  useEffect(() => {
    if (generatedResult && activeJobDbId) {
      router.push(`/dashboard/research/${activeJobDbId}`);
    }
  }, [generatedResult, activeJobDbId, router]);

  const handleCustomCountChange = (value: string) => {
    setCustomCount(value);
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= maxIdeas) {
      setIdeaCount(parsed);
    }
  };

  const handleGenerateClick = () => {
    const parsed = parseInt(customCount, 10);
    const count = Number.isNaN(parsed)
      ? 1
      : Math.min(maxIdeas, Math.max(1, parsed));
    setIdeaCount(count);
    setCustomCount(String(count));
    handleGenerate(count);
  };

  const showHowItWorks = !isLoadingProfile && !planLoading && aiTrained;

  let content: React.ReactNode;

  if (isLoadingProfile || planLoading) {
    content = (
      <motion.div
        className="max-w-xl mx-auto space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </motion.div>
    );
  } else if (generatedResult && activeJobDbId) {
    content = null;
  } else {
    content = (
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="max-w-xl mx-auto"
          >
            <IdeationProgress progress={progress} statusMessage={statusMessage} />
          </motion.div>
        ) : (
          <motion.div
            key="form"
            className="max-w-xl mx-auto space-y-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <motion.div
              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3"
              whileHover={{ borderColor: "rgba(147, 51, 234, 0.3)" }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
              >
                <Label className="text-sm font-medium">Auto mode</Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI picks topics from your channel and trends
                </p>
              </motion.div>
              <Switch checked={autoMode} onCheckedChange={setAutoMode} />
            </motion.div>

            {!autoMode && (
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <Label htmlFor="nicheFocus">Niche focus</Label>
                <Input
                  id="nicheFocus"
                  placeholder="e.g. AI tools for developers"
                  value={nicheFocus}
                  onChange={(e) => setNicheFocus(e.target.value)}
                  maxLength={200}
                />
                <motion.div
                  className="flex flex-wrap gap-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.05 } },
                  }}
                >
                  {NICHE_EXAMPLES.map((example) => (
                    <motion.button
                      key={example}
                      type="button"
                      variants={{
                        hidden: { opacity: 0, scale: 0.95 },
                        visible: { opacity: 1, scale: 1 },
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setNicheFocus(example)}
                      className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                    >
                      {example}
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="context">Additional context <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea
                id="context"
                placeholder="Audience, constraints, or direction..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                maxLength={1000}
                rows={2}
                className="resize-none"
              />
            </div>

            <motion.div className="space-y-2">
              <Label>Number of ideas</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={maxIdeas}
                  value={customCount}
                  onChange={(e) => handleCustomCountChange(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-slate-500">of {maxIdeas} max</span>
              </div>
            </motion.div>

            <motion.div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <p className="text-sm text-slate-500">
                {credits} credits <span className="text-xs">(min. 2)</span>
              </p>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={gate.locked ? gate.requestUnlock : handleGenerateClick}
                  disabled={gate.locked ? false : (isGenerating || credits < 2 || (!autoMode && !nicheFocus.trim()))}
                  className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900"
                >
                  {gate.locked ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" /> Unlock to generate
                    </>
                  ) : isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Generate
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      className="container py-8 h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="mb-8">
        <Link
          href="/dashboard/research"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Generate ideas</h1>
        <p className="text-sm text-slate-500 mt-1">
          AI finds trends and niche gaps tailored to your channel
        </p>
      </div>

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {showHowItWorks && (
          <motion.div
            className="lg:col-span-4 lg:sticky lg:top-8 rounded-lg border border-slate-200 dark:border-slate-800 p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">How it works</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <li key={step}>- {step}</li>
              ))}
            </ul>
          </motion.div>
        )}

        <div className={showHowItWorks ? "lg:col-span-8" : "lg:col-span-12"}>
          {content}
        </div>
      </motion.div>
      {gate.modal}
    </motion.div>
  );
}
