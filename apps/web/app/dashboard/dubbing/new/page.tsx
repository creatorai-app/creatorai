"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as motion from "motion/react-m";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence } from "motion/react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import {
  Loader2, Play, UploadCloud, CheckCircle2, Mic, Languages,
  FileAudio, FileVideo, ArrowUpRight, RotateCw, List, Lock, HelpCircle, Clapperboard, Music,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@repo/ui/sheet";
import { useDubbing } from "@/hooks/useDubbing";
import { useAISetupGate } from "@/hooks/useAISetupGate";
import { supportedLanguages, dubbableLanguagesFor, formatDubDuration, formatUploadLimit, DUB_VIDEO_WAIT_HOURS } from "@repo/validation";
import { useSupabase } from "@/components/supabase-provider";
import { GenerationProgress, type GenerationProgressStep } from "@/components/dashboard/common/GenerationProgress";
import { DubbingResumeUpload, useDubResumeUpload } from "@/components/dashboard/dubbing/DubbingResumeUpload";
import { DubbingHowItWorks } from "@/components/dashboard/dubbing/DubbingHowItWorks";
import { DubEngineCards } from "@/components/dashboard/dubbing/DubEngineCards";
import { DubLanguageTargets } from "@/components/dashboard/dubbing/DubLanguageTargets";
import { DubSourceLanguage } from "@/components/dashboard/dubbing/DubSourceLanguage";
import { DubVoiceModePicker } from "@/components/dashboard/dubbing/DubVoiceMode";
import { DubOutputFormatPicker } from "@/components/dashboard/dubbing/DubOutputFormat";

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
            Dub audio or video into {supportedLanguages.length} languages in the original speakers&apos; voices,
            with Cypher (in-house dubbing, {dubbableLanguagesFor("cypher").length} languages) or ElevenLabs
            ({dubbableLanguagesFor("elevenlabs").length}). Dubbing is on every plan. Starter covers 500MB and
            45 minutes per clip in one language; a paid plan takes that to 3GB and 3 hours, in up to three
            languages at once.
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

export default function NewDubbingPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <NewDubbing />
    </Suspense>
  );
}

function NewDubbing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSupabase();
  // ?dub=<id> picks up an existing dub; &retry=1 resumes it if it failed.
  const dubId = searchParams.get("dub");
  // ?from=<id> dubs that dub's media again with new settings, without uploading it.
  const fromId = dubId ? null : searchParams.get("from");
  const retryRef = useRef(searchParams.get("retry") === "1");
  const {
    fileInputRef,
    mediaFile,
    mediaDuration,
    isVideo,
    engine,
    setEngine,
    targets,
    setTargets,
    sourceLanguage,
    setSourceLanguage,
    voiceMode,
    setVoiceMode,
    outputFormat,
    setOutputFormat,
    voiceModeEngines,
    maxLanguages,
    mediaName,
    setMediaName,
    projectId,
    progress,
    isLoading,
    allowed,
    accessLoading,
    maxDurationSeconds,
    maxUploadBytes,
    estimatedCredits,
    cancelDub,
    attached,
    attach,
    source,
    loadSource,
    handleRegenerate,
    videoUpload,
    resumeVideoUpload,
    handleFileChange,
    handleFileSelect,
    handleDubMedia,
  } = useDubbing();

  const reattach = useCallback(() => {
    if (dubId) void attach(dubId, retryRef.current);
  }, [dubId, attach]);
  const upload = useDubResumeUpload(dubId ?? "", reattach);

  useEffect(() => {
    if (!dubId || !session?.access_token) return;
    // A refresh must not retry, and charge, again.
    if (retryRef.current) router.replace(`/dashboard/dubbing/new?dub=${dubId}`);
    reattach();
    // Once per dub and sign-in: reattach is re-run by the upload and the poll, not by this.
  }, [dubId, session?.access_token]);

  useEffect(() => {
    if (!fromId || !session?.access_token) return;
    void loadSource(fromId).then((ok) => {
      if (ok) return;
      toast.error("Could not dub this media again", { description: "Its upload never finished, or it is no longer available." });
      router.replace("/dashboard/dubbing");
    });
    // Once per source and sign-in.
  }, [fromId, session?.access_token]);
  const sourceLoading = !!fromId && !source;

  // A dub waiting on a video uploading elsewhere moves on once that upload lands.
  const waitingElsewhere = !!dubId && attached?.status === "awaiting_video" && !upload.status;
  useEffect(() => {
    if (!waitingElsewhere) return;
    const iv = setInterval(reattach, 5000);
    return () => clearInterval(iv);
  }, [waitingElsewhere, reattach]);

  // This page only runs a dub. A finished one goes to its details page, as does one it
  // picked up that failed (or was cancelled), where the retry is offered.
  useEffect(() => {
    if (progress.state === "completed" && projectId) {
      router.replace(`/dashboard/dubbing/${projectId}`);
    } else if (dubId && progress.state === "failed") {
      // A dub that never started is discarded by a cancel, and one not found has no page.
      router.replace(attached && attached.status !== "uploading" ? `/dashboard/dubbing/${dubId}` : "/dashboard/dubbing");
    }
  }, [dubId, projectId, attached, progress.state, router]);

  // An audio-only dub of a video is finalized like any audio dub: nothing is rendered.
  const deliversVideo = isVideo && outputFormat === "mp4";

  // The upload stopped: the audio never landed, or the video is still partial.
  const needsFile = !!attached && attached.status !== "completed"
    && (attached.status === "uploading" || attached.videoStatus === "uploading");

  const stop = () => {
    upload.stop();
    void cancelDub();
  };

  // A picked-up dub that never started is waiting on its audio; one already running keeps its own progress.
  const progressView = attached?.status === "uploading" && upload.status
    ? { progress: 1 + (upload.status.percent * 14) / 100, message: `${upload.status.label} ${upload.status.percent}%` }
    : progress;
  const progressHint = videoUpload.state === "uploading"
    ? `Uploading your video alongside the dub: ${videoUpload.percent}%. Keep this tab open.`
    : upload.status?.phase === "video"
      ? `Uploading your video alongside the dub: ${upload.status.percent}%. Keep this tab open.`
      : needsFile && !upload.status
        ? `The dub finishes once the video upload does. Left unfinished for ${DUB_VIDEO_WAIT_HOURS} hours, it is cancelled and not charged.`
        : deliversVideo ? "Rendering video can take a few minutes" : "Longer clips are dubbed in segments and take a few minutes";
  const progressSteps: GenerationProgressStep[] = [
    { label: "Queued", icon: Loader2, threshold: 0 },
    { label: engine === "cypher" ? "Finding speakers" : "Translating", icon: Languages, threshold: 5 },
    { label: "Cloning", icon: Mic, threshold: 25 },
    { label: deliversVideo ? "Rendering" : "Finalizing", icon: deliversVideo ? Clapperboard : Music, threshold: 82 },
    { label: "Done", icon: CheckCircle2, threshold: 100 },
  ];

  const [isDragging, setIsDragging] = useState(false);
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
    if (source) void handleRegenerate();
    else void handleDubMedia();
  };

  const pickedLanguages = targets.filter((t) => t.language).map((t) => t.language);
  const showForm = !dubId && !accessLoading && !isLoading && !sourceLoading;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isLoading) return;
      void handleFileSelect(e.dataTransfer.files?.[0]);
    },
    [handleFileSelect, isLoading],
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative min-h-full bg-gradient-to-br from-purple-50 to-white px-4 py-8 dark:from-purple-950/30 dark:to-slate-900 sm:px-6 lg:px-8"
    >
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-purple-400/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <motion.div variants={itemVariants} className="mb-8 flex items-center gap-4">
        <h1 className="min-w-0 flex-1 truncate text-2xl sm:text-3xl font-bold tracking-tight">
          {dubId ? mediaName || "Dubbing" : fromId ? `Dub again${mediaName ? `: ${mediaName}` : ""}` : "New Dubbing"}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {showForm && (
            <Button variant="outline" onClick={() => setShowHowItWorks(true)} aria-label="How it works">
              <HelpCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">How it works</span>
            </Button>
          )}
          <Button asChild variant="outline" aria-label="My dubs">
            <Link href="/dashboard/dubbing">
              <List className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">My dubs</span>
            </Link>
          </Button>
          {showForm && (
            <Button
              onClick={handleGenerate}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!locked && (!(mediaFile || source) || !pickedLanguages.length || (!source && !mediaName.trim()))}
            >
              {locked ? <Lock className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {locked ? "Unlock dubbing" : "Dub media"}
            </Button>
          )}
        </div>
      </motion.div>

      {gate.banner && <div className="mb-8">{gate.banner}</div>}

      {accessLoading || (dubId && !attached) || sourceLoading || progress.state === "completed" ? (
        <motion.div variants={itemVariants} className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          <AnimatePresence mode="wait">
            {isLoading || upload.status ? (
              <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <GenerationProgress
                  progress={Math.round(progressView.progress)}
                  statusMessage={progressView.message || "Starting…"}
                  title="Dubbing in Progress"
                  icon={Mic}
                  steps={progressSteps}
                  hint={progressHint}
                  onStop={stop}
                  stopLabel="Cancel Dubbing"
                />
                {needsFile && !upload.status && (
                  <DubbingResumeUpload banner onPick={(file) => void upload.resume(file)} />
                )}
                {videoUpload.state === "failed" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      The video upload paused at {videoUpload.percent}%. The dub keeps going, and the parts
                      already sent are kept.
                    </p>
                    <Button size="sm" variant="outline" onClick={resumeVideoUpload} className="shrink-0">
                      <RotateCw className="mr-2 h-4 w-4" /> Resume upload
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : dubId ? (
              <motion.div key="resume" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {needsFile ? (
                  <DubbingResumeUpload
                    onPick={(file) => void upload.resume(file)}
                    onCancel={attached?.status === "uploading" ? stop : undefined}
                  />
                ) : (
                  // Settling into one of the states above, or on the way to the details page.
                  <div className="flex justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-x-10">
                <div className="space-y-6">
                  {source ? (
                    <div className="space-y-2">
                      <Label>Media</Label>
                      <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-4 dark:border-purple-900/50 dark:bg-purple-900/20">
                        {source.isVideo ? <FileVideo className="h-8 w-8 shrink-0 text-purple-600" /> : <FileAudio className="h-8 w-8 shrink-0 text-purple-600" />}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{source.mediaName || "Original media"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatClock(source.durationSeconds)} · {estimatedCredits !== null ? `~${estimatedCredits.toLocaleString()} credits` : "Pricing…"} · Already uploaded
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="media-name">Name</Label>
                        <Input
                          id="media-name"
                          placeholder="My video"
                          value={mediaName}
                          onChange={(e) => setMediaName(e.target.value)}
                          maxLength={100}
                          className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-purple-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="media-upload">File</Label>
                        <Label
                          htmlFor="media-upload"
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleDrop}
                          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center font-normal transition-colors ${isDragging || mediaFile
                            ? "border-purple-400 bg-purple-50/60 dark:bg-purple-900/20"
                            : "border-slate-200 bg-white/60 hover:border-purple-300 dark:border-slate-800 dark:bg-slate-900/40"
                            }`}
                        >
                          {mediaFile ? (
                            isVideo ? <FileVideo className="h-8 w-8 text-purple-600" /> : <FileAudio className="h-8 w-8 text-purple-600" />
                          ) : (
                            <UploadCloud className="h-8 w-8 text-slate-400" />
                          )}
                          <span className="break-all text-sm font-medium text-slate-900 dark:text-slate-100">
                            {mediaFile ? mediaFile.name : "Drop a file or click to browse"}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {mediaFile && mediaDuration !== null
                              ? `${formatClock(mediaDuration)} · ${estimatedCredits !== null ? `~${estimatedCredits.toLocaleString()} credits` : "Pricing…"}`
                              : maxUploadBytes !== null && maxDurationSeconds !== null
                                ? `Audio or video, up to ${formatUploadLimit(maxUploadBytes)} and ${formatDubDuration(maxDurationSeconds)}`
                                : "Audio or video"}
                          </span>
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
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Output</Label>
                    <DubOutputFormatPicker
                      value={outputFormat}
                      onChange={setOutputFormat}
                      allowVideo={source ? source.isVideo : !mediaFile || isVideo}
                      videoUnavailable={source?.isVideo && !source.hasVideo
                        ? "Only the audio of this video was uploaded, so it can be dubbed to audio only."
                        : undefined}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Engine</Label>
                    <DubEngineCards engine={engine} onSelect={setEngine} />
                  </div>

                  <div className="space-y-2">
                    <Label>Dub into</Label>
                    <DubLanguageTargets
                      engine={engine}
                      targets={targets}
                      onChange={setTargets}
                      max={maxLanguages}
                      sourceLanguage={sourceLanguage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Spoken language</Label>
                    <DubSourceLanguage value={sourceLanguage} onChange={setSourceLanguage} targets={pickedLanguages} />
                  </div>

                  {voiceModeEngines.includes(engine) && (
                    <div className="space-y-2">
                      <Label>Voice</Label>
                      <DubVoiceModePicker engine={engine} value={voiceMode} onChange={setVoiceMode} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
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
