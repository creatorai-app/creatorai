"use client";

import { useCallback, useState } from "react";
import * as motion from "motion/react-m";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import {
  Loader2, Play, Download, UploadCloud, ArrowLeft, CheckCircle2,
  Mic, Languages, FileAudio, FileVideo, ArrowUpRight, Type,
  Clapperboard, Music, RotateCw, Plus, List, Lock, HelpCircle, Coins,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@repo/ui/sheet";
import { useDubbing } from "@/hooks/useDubbing";
import { useAISetupGate } from "@/hooks/useAISetupGate";
import { supportedLanguages, dubbableLanguages, accentsFor, formatDubDuration, formatUploadLimit } from "@repo/validation";
import { downloadFile } from "@/lib/download";
import { GenerationProgress, type GenerationProgressStep } from "@/components/dashboard/common/GenerationProgress";
import { DubbingHowItWorks } from "@/components/dashboard/dubbing/DubbingHowItWorks";
import { DubbingVoiceAnimation } from "@/components/dashboard/dubbing/DubbingVoiceAnimation";
import { DubbingMediaPlayer } from "@/components/dashboard/dubbing/DubbingMediaPlayer";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

/** "2:34" / "1:02:40": the clip length, next to what it will cost. */
function formatClock(seconds: number): string {
  const total = Math.round(seconds);
  const parts = [Math.floor(total / 60) % 60, total % 60];
  if (total >= 3600) parts.unshift(Math.floor(total / 3600));
  return parts.map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, "0"))).join(":");
}

/** Paid-only gate — dark card mirroring VideoUpgradeCard's visual language. */
function DubbingUpgradeCard() {
  const router = useRouter();
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="group relative bg-slate-900 rounded-3xl p-8 sm:p-10 text-white overflow-hidden shadow-xl shadow-slate-200 dark:shadow-none">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-violet-600/30 rounded-full blur-3xl group-hover:bg-violet-500/40 transition-colors duration-500" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-6">
            <Mic className="h-6 w-6 text-violet-300" />
          </div>
          <h3 className="text-2xl font-bold mb-3">Dub longer clips on a paid plan</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Clone a voice and dub audio or video into 29 languages while keeping the original
            voice. Dubbing is available on every plan. Starter covers 500MB and 45 minutes per
            clip; a paid plan takes that to 3GB and 3 hours.
          </p>
          <button
            onClick={() => router.push("/pricing")}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-900 font-bold px-8 py-4 rounded-2xl hover:bg-slate-50 transition-all transform active:scale-[0.98]"
          >
            View Plans <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/** Icon-only button with a tooltip — used for the result-card toolbar. */
function IconAction({
  label, onClick, disabled, primary, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={primary ? "default" : "outline"}
          size="icon"
          onClick={onClick}
          disabled={disabled}
          className={primary ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function NewDubbing() {
  const router = useRouter();
  const {
    fileInputRef,
    mediaFile,
    mediaDuration,
    isVideo,
    targetLanguage,
    setTargetLanguage,
    targetAccent,
    setTargetAccent,
    mediaName,
    setMediaName,
    dubbedResult,
    progress,
    isLoading,
    allowed,
    accessLoading,
    maxDurationSeconds,
    maxUploadBytes,
    estimatedCredits,
    canCancel,
    cancelDub,
    handleFileChange,
    handleFileSelect,
    resetForm,
    handleDubMedia,
  } = useDubbing();

  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const gate = useAISetupGate();

  // Two independent gates. Setup (channel + training) is checked first because
  // that's the order the API enforces — OnboardedGuard runs before the plan and
  // credit checks, so showing the upgrade card first would be a lie.
  const planLocked = allowed === false;
  const locked = gate.locked || planLocked;
  const handleGenerate = () => {
    if (gate.locked) {
      gate.requestUnlock();
      return;
    }
    if (planLocked) {
      setShowUpgrade(true);
      return;
    }
    handleDubMedia();
  };

  const selectedLanguageLabel = supportedLanguages.find((l) => l.value === targetLanguage)?.label;
  const accentOptions = accentsFor(targetLanguage);
  const isComplete = !!dubbedResult && progress.state === "completed";

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isLoading) return;
      void handleFileSelect(e.dataTransfer.files?.[0]);
    },
    [handleFileSelect, isLoading],
  );

  const handleDownload = useCallback(async () => {
    if (!dubbedResult?.dubbedUrl) return;
    setIsDownloading(true);
    try {
      const ext = isVideo ? "mp4" : "mp3";
      const filename = `dubbed_${isVideo ? "video" : "audio"}_${dubbedResult.targetLanguage}.${ext}`;
      await downloadFile(dubbedResult.dubbedUrl, filename);
    } catch {
      toast.error("Download failed", { description: "Please try again" });
    } finally {
      setIsDownloading(false);
    }
  }, [dubbedResult, isVideo]);

  // Stepped states for the animated progress bar (AI Studio pattern).
  const DUB_STEPS: GenerationProgressStep[] = [
    { label: "Queued", icon: Loader2, threshold: 0 },
    { label: "Translating", icon: Languages, threshold: 16 },
    { label: "Cloning", icon: Mic, threshold: 40 },
    { label: isVideo ? "Rendering" : "Finalizing", icon: isVideo ? Clapperboard : Music, threshold: 82 },
    { label: "Done", icon: CheckCircle2, threshold: 100 },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="container py-8 relative"
    >
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-purple-400/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header — icon-only back button on the left */}
      <motion.div variants={itemVariants} className="mb-8 flex items-center gap-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push("/dashboard/dubbing")}
                className="shrink-0"
                aria-label="Back to Dubbings"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Dubbings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mic className="h-6 w-6 sm:h-7 sm:w-7 text-purple-500" />
            New Dubbing
          </h1>
          <p className="hidden sm:block text-slate-600 dark:text-slate-400 mt-1 text-base">
            Upload an audio or video file and dub it into another language in the original voice.
          </p>
        </div>
      </motion.div>

      {gate.banner && <div className="mb-8">{gate.banner}</div>}

      {accessLoading ? (
        <motion.div variants={itemVariants} className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </motion.div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <motion.div variants={itemVariants}>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <GenerationProgress
                    progress={Math.round(progress.progress)}
                    statusMessage={progress.message || "Starting…"}
                    title="Dubbing in Progress"
                    icon={Mic}
                    steps={DUB_STEPS}
                    hint={isVideo ? "Rendering video can take a few minutes" : "This usually takes under a minute"}
                    onStop={canCancel ? cancelDub : undefined}
                    stopLabel="Cancel Dubbing"
                  />
                </motion.div>
              ) : isComplete ? (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          Dubbing Complete
                        </CardTitle>
                        <CardDescription className="mt-1.5">
                          Dubbed into {selectedLanguageLabel}. Preview, regenerate or download below.
                        </CardDescription>
                      </div>

                      {/* Icon toolbar — before the preview */}
                      <TooltipProvider delayDuration={0}>
                        <div className="flex items-center gap-2 shrink-0">
                          <IconAction label="Back to list" onClick={() => router.push("/dashboard/dubbing")}>
                            <List className="h-4 w-4" />
                          </IconAction>
                          <IconAction label="Dub another file" onClick={resetForm}>
                            <Plus className="h-4 w-4" />
                          </IconAction>
                          <IconAction label="Regenerate" onClick={handleDubMedia}>
                            <RotateCw className="h-4 w-4" />
                          </IconAction>
                          <IconAction label={`Download ${isVideo ? "video" : "audio"}`} onClick={handleDownload} disabled={isDownloading} primary>
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </IconAction>
                        </div>
                      </TooltipProvider>
                    </CardHeader>
                    <CardContent>
                      <DubbingMediaPlayer
                        url={dubbedResult!.dubbedUrl!}
                        isVideo={isVideo}
                        title={mediaName || `Dubbed ${isVideo ? "video" : "audio"}`}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgba(168,85,247,0.10)] hover:border-purple-500/40">
                    {/* Hero band, in place of a text header: it is the one thing on the
                        page that explains what a dub is without being read. */}
                    <div className="relative border-b border-purple-100 dark:border-purple-900/40 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900 px-6 pt-6 pb-5 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHowItWorks(true)}
                        className="absolute right-3 top-3 text-slate-600 hover:text-purple-700 dark:text-slate-400 dark:hover:text-purple-300"
                      >
                        <HelpCircle className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">How it works</span>
                      </Button>

                      <DubbingVoiceAnimation />
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-2">
                        One voice, every language
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Clone the speaker and re-voice their content, no re-recording.
                      </p>
                    </div>

                    <CardContent className="space-y-6 pt-6">
                      {/* Media Name */}
                      <div className="space-y-2">
                        <Label htmlFor="media-name" className="flex items-center gap-1.5">
                          <Type className="h-4 w-4" />
                          Media Name
                        </Label>
                        <Input
                          id="media-name"
                          placeholder="Enter a name for your dubbed media"
                          value={mediaName}
                          onChange={(e) => setMediaName(e.target.value)}
                          maxLength={100}
                        />
                      </div>

                      {/* Animated upload drop zone */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          <UploadCloud className="h-4 w-4" />
                          Upload Audio or Video File
                        </Label>

                        <Label
                          htmlFor="media-upload"
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleDrop}
                          className={`group relative flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed py-12 px-6 transition-all duration-300 ${isDragging
                            ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 scale-[1.01]"
                            : mediaFile
                              ? "border-purple-300 bg-purple-50/40 dark:bg-purple-900/10"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 hover:bg-purple-50/60 dark:hover:bg-purple-900/10 hover:border-purple-300"
                            }`}
                        >
                          {/* What the dub will cost, as soon as the file's length is known.
                              pointer-events-none so it never swallows a click meant for the
                              drop zone underneath it. */}
                          {mediaFile && mediaDuration !== null && (
                            <div className="pointer-events-none absolute right-3 top-3 text-right">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm dark:border-purple-800 dark:bg-slate-900 dark:text-purple-300">
                                <Coins className="h-3.5 w-3.5" />
                                {estimatedCredits !== null ? `~${estimatedCredits.toLocaleString()} credits` : "Pricing…"}
                              </span>
                              <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                                {formatClock(mediaDuration)} of media
                              </span>
                            </div>
                          )}

                          <motion.div
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.94 }}
                            className={`h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300 ${mediaFile ? "bg-purple-600" : "bg-slate-900 dark:bg-slate-700 group-hover:bg-purple-600"
                              }`}
                          >
                            {mediaFile ? (
                              isVideo ? <FileVideo className="h-7 w-7 text-white" /> : <FileAudio className="h-7 w-7 text-white" />
                            ) : (
                              <UploadCloud className="h-7 w-7 text-white" />
                            )}
                          </motion.div>

                          <div className="text-center">
                            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 break-all">
                              {mediaFile ? mediaFile.name : isDragging ? "Drop your file here" : "Drag & drop your file"}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {mediaFile ? (
                                `${(mediaFile.size / (1024 * 1024)).toFixed(2)} MB · click to change`
                              ) : (
                                <>or <span className="text-purple-600 dark:text-purple-400 font-medium underline underline-offset-2">browse files</span></>
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                            <span>MP3 · WAV · MP4 · MOV</span>
                            <span className="hidden sm:inline w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                            {/* The plan's real caps, not generic ones: a Starter user needs to
                                know their limit before picking a file, not after. */}
                            <span>Max {formatUploadLimit(maxUploadBytes)} · {formatDubDuration(maxDurationSeconds)} per clip</span>
                          </div>
                        </Label>
                        {estimatedCredits !== null && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            An estimate. The final charge is settled against the length our provider
                            measures, so a shorter clip refunds the difference.
                          </p>
                        )}
                        <Input
                          ref={fileInputRef}
                          id="media-upload"
                          type="file"
                          accept="audio/*,video/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>

                      {/* Target Language */}
                      <div className="space-y-2">
                        <Label htmlFor="target-language" className="flex items-center gap-1.5">
                          <Languages className="h-4 w-4" />
                          Target Language
                        </Label>
                        {/* Clear the accent too: it belongs to the old language, and
                            most languages (Bengali included) offer none at all. */}
                        <Select
                          value={targetLanguage}
                          onValueChange={(value) => { setTargetLanguage(value); setTargetAccent(""); }}
                        >
                          <SelectTrigger id="target-language">
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                          <SelectContent>
                            {dubbableLanguages.map((lang) => (
                              <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Only rendered for languages that have accents worth choosing. */}
                      {accentOptions.length > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="target-accent" className="flex items-center gap-1.5">
                            <Languages className="h-4 w-4" />
                            Accent <span className="text-xs font-normal text-slate-500">(optional)</span>
                          </Label>
                          <Select value={targetAccent} onValueChange={setTargetAccent}>
                            <SelectTrigger id="target-accent">
                              <SelectValue placeholder="Default accent" />
                            </SelectTrigger>
                            <SelectContent>
                              {accentOptions.map((accent) => (
                                <SelectItem key={accent.value} value={accent.value}>{accent.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter>
                      <Button
                        onClick={handleGenerate}
                        size="lg"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white transition-all active:scale-[0.98]"
                        disabled={!locked && (!mediaFile || !targetLanguage || !mediaName.trim())}
                      >
                        {gate.locked ? (
                          <><Lock className="mr-2 h-4 w-4" /> {gate.step === "connect" ? "Connect your channel to dub" : "Train your AI to dub"}</>
                        ) : planLocked ? (
                          <><Lock className="mr-2 h-4 w-4" /> Unlock audio dubbing</>
                        ) : (
                          <><Play className="mr-2 h-4 w-4" /> Dub {selectedLanguageLabel ? `to ${selectedLanguageLabel}` : "Media"}</>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Upgrade to unlock audio dubbing</DialogTitle>
          <DubbingUpgradeCard />
        </DialogContent>
      </Dialog>

      <Sheet open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="mb-6 pr-8">
            <SheetTitle>How does audio dubbing work?</SheetTitle>
            <SheetDescription>
              Four steps from an upload to a finished track in the original voice.
            </SheetDescription>
          </SheetHeader>
          <DubbingHowItWorks />
        </SheetContent>
      </Sheet>

      {gate.modal}
    </motion.div>
  );
}
