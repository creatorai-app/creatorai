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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import { Sparkles, Loader2, ArrowLeft, Lock, Wand2, Compass, Bot, Lightbulb } from "lucide-react";
import IdeationProgress from "@/components/dashboard/research/IdeationProgress";
import { useIdeation } from "@/hooks/useIdeation";
import { useAISetupGate } from "@/hooks/useAISetupGate";
import { useCurrentPlan } from "@/hooks/useCurrentPlan";
import Link from "next/link";

// Same three-step card style as AI Studio's HowItWorksGuide.
const HOW_IT_WORKS_STEPS = [
  { step: 1, title: "Set a direction", desc: "Turn on Auto mode, or name the niche you want ideas for.", icon: Compass },
  { step: 2, title: "AI finds the gaps", desc: "We scan trends and competitors for openings your channel can win.", icon: Bot },
  { step: 3, title: "Pick your winners", desc: "Review scored ideas and take the best ones straight into a script.", icon: Lightbulb },
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
    isGenerating, isSurprising, surpriseNiche,
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
            <motion.label
              htmlFor="autoMode"
              className={`flex items-center gap-4 rounded-xl border px-4 py-4 cursor-pointer transition-colors ${
                autoMode
                  ? "border-purple-300 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-900/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-900"
              }`}
              whileTap={{ scale: 0.995 }}
              transition={{ duration: 0.2 }}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  autoMode
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Auto mode</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  AI picks topics from your channel and trends
                </span>
              </span>
              <Switch id="autoMode" checked={autoMode} onCheckedChange={setAutoMode} />
            </motion.label>

            {!autoMode && (
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="nicheFocus">Niche focus</Label>
                  {/* Surprise me — on-brand niche from the creator's trained style. */}
                  <motion.button
                    type="button"
                    onClick={surpriseNiche}
                    disabled={isSurprising || isGenerating}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="group relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
                  >
                    {isSurprising ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <motion.span
                        animate={{ rotate: [0, -12, 12, 0] }}
                        transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.8 }}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </motion.span>
                    )}
                    Surprise me
                  </motion.button>
                </div>
                <Input
                  id="nicheFocus"
                  placeholder="e.g. AI tools for developers"
                  value={nicheFocus}
                  onChange={(e) => setNicheFocus(e.target.value)}
                  maxLength={200}
                />
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

      {gate.banner && <div className="mb-8">{gate.banner}</div>}

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {showHowItWorks && (
          <motion.div
            className="lg:col-span-4 lg:sticky lg:top-8 rounded-lg border border-slate-200 dark:border-slate-800 px-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Accordion type="single" collapsible defaultValue="how-it-works" className="w-full">
              <AccordionItem value="how-it-works" className="border-b-0">
                <AccordionTrigger className="font-semibold">How does ideation work?</AccordionTrigger>
                <AccordionContent className="pt-4">
                  <div className="space-y-6">
                    {HOW_IT_WORKS_STEPS.map(({ step, title, desc, icon: Icon }) => (
                      <div key={step} className="flex items-start gap-4">
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="pt-0.5">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
