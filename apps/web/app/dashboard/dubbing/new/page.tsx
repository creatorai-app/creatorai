"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import {
  Loader2, Play, Download, UploadCloud, ArrowLeft, CheckCircle2,
  Mic, Languages, FileAudio, FileVideo, Sparkles, ArrowUpRight, Type,
  Clapperboard, Music, RotateCw, Plus, List, Lock,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/dialog";
import { useDubbing } from "@/hooks/useDubbing";
import { supportedLanguages } from "@repo/validation";
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
          <h3 className="text-2xl font-bold mb-3">Audio dubbing is a paid feature</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Clone a voice and dub audio or video into 21 languages while keeping the original
            voice. It&apos;s included in Creator, Pro, Business and Scale — upgrade from Starter
            to start dubbing your media.
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
    isVideo,
    targetLanguage,
    setTargetLanguage,
    mediaName,
    setMediaName,
    dubbedResult,
    progress,
    isLoading,
    allowed,
    accessLoading,
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

  // UI stays explorable; the plan gate fires on the Dub action. Server enforces authoritatively.
  const locked = allowed === false;
  const handleGenerate = () => {
    if (locked) {
      setShowUpgrade(true);
      return;
    }
    handleDubMedia();
  };

  const selectedLanguageLabel = supportedLanguages.find((l) => l.value === targetLanguage)?.label;
  const isComplete = !!dubbedResult && progress.state === "completed";

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isLoading) return;
      handleFileSelect(e.dataTransfer.files?.[0]);
    },
    [handleFileSelect, isLoading],
  );

  const handleDownload = useCallback(async () => {
    if (!dubbedResult?.dubbedUrl) return;
    setIsDownloading(true);
    try {
      const ext = isVideo ? "mp4" : "wav";
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
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">
            Upload an audio or video file and dub it into another language in the original voice.
          </p>
        </div>
      </motion.div>

      {accessLoading ? (
        <motion.div variants={itemVariants} className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT — animated hero + how it works (stacks on top on mobile) */}
          <motion.div variants={itemVariants} className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8 space-y-6">
            <Card className="overflow-hidden border-purple-100 dark:border-purple-900/40 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900">
              <CardContent className="pt-6 pb-4 text-center">
                <DubbingVoiceAnimation />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-2">
                  One voice, every language
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Clone the speaker and re-voice their content, no re-recording.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-2">
                <DubbingHowItWorks />
              </CardContent>
            </Card>
          </motion.div>

          {/* RIGHT — form / progress / result */}
          <motion.div variants={itemVariants} className="lg:col-span-7 xl:col-span-8">
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
                  <Card className="transition-all duration-300 hover:shadow-[0_8px_30px_rgba(168,85,247,0.10)] hover:border-purple-500/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        Dub Your Media
                      </CardTitle>
                      <CardDescription>
                        Translate your audio or video into one of 21 languages while keeping the original voice characteristics.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
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
                            <span>Max 500MB · 45 min</span>
                          </div>
                        </Label>
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
                        <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                          <SelectTrigger id="target-language">
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                          <SelectContent>
                            {supportedLanguages.map((lang) => (
                              <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button
                        onClick={handleGenerate}
                        size="lg"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white transition-all active:scale-[0.98]"
                        disabled={!locked && (!mediaFile || !targetLanguage || !mediaName.trim())}
                      >
                        {locked ? (
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
    </motion.div>
  );
}
