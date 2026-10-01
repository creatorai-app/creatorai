"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  DubbedResult,
  DubbingProgress,
  DubUploadTargets,
  DEFAULT_DUB_ENGINE,
  DEFAULT_DUB_VOICE_MODE,
  DUB_JOB_STATUSES,
  accentsFor,
  isSupportedDubLanguage,
  type DubEngine,
  type DubResponse,
  type DubTarget,
  type DubVoiceMode,
  dubLanguageLabel,
  calculateDubbingCreditsByDuration,
  formatDubDuration,
  formatUploadLimit,
  maxDubBytesForPlan,
  maxDubSecondsForPlan,
  STARTER_MAX_DUB_BYTES,
  STARTER_MAX_DUB_SECONDS,
} from "@repo/validation";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { useSupabase } from "@/components/supabase-provider";
import { BACKEND_URL } from "@/lib/constants";
import { cancelDubbing, getDubbing, resumeDubbing } from "@/lib/api/getDubbings";
import {
  extractAudioTrack,
  fileFingerprint,
  getUploadState,
  isAbortError,
  startDub,
  uploadDubAudio,
  uploadDubVideo,
} from "@/lib/dubbing-upload";

const languageList = (codes: string[]) => codes.map(dubLanguageLabel).join(", ");

// BullMQ SSE state -> the UI's DubbingProgress state.
function mapState(state: string): DubbingProgress["state"] {
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  return "processing"; // waiting | active
}

// Read duration client-side — the API needs it to price the job (credits/sec).
function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      // Header-less VBR/WebM reports Infinity, which JSON.stringify sends as null and
      // the API then rejects as a missing duration — catch it here with a message that
      // says what to do about it.
      if (!Number.isFinite(el.duration) || el.duration <= 0) {
        reject(new Error("Could not read this file's length. Try re-exporting it as MP3 or MP4."));
        return;
      }
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(el.src);
      reject(new Error("Could not read media metadata. The file may be corrupt."));
    };
    el.src = URL.createObjectURL(file);
  });
}

export type VideoUploadState = { state: "idle" | "uploading" | "done" | "failed"; percent: number };

export function useDubbing() {
  const { session } = useSupabase();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  // Measured once, when the file is picked — so the plan cap is enforced before the
  // user fills in the rest of the form, not after they press Dub.
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [engine, setEngineState] = useState<DubEngine>(DEFAULT_DUB_ENGINE);
  // One output per language; rows with no language yet are dropped when sending.
  const [targets, setTargetsState] = useState<DubTarget[]>([]);
  // null: let the engine detect the source language.
  const [sourceLanguage, setSourceLanguageState] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<DubVoiceMode>(DEFAULT_DUB_VOICE_MODE);
  const [keyterms, setKeyterms] = useState<string[]>([]);
  const [mediaName, setMediaName] = useState("");
  const [dubbedResult, setDubbedResult] = useState<DubbedResult | null>(null);

  const [allowed, setAllowed] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  // The plan's ceilings and its credits-per-second, all resolved by the API so the
  // form prices and rejects a file exactly the way the server will. Seeded with the
  // Starter values so the form never advertises a limit wider than the cheapest plan
  // while /access is still in flight.
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(STARTER_MAX_DUB_SECONDS);
  const [maxUploadBytes, setMaxUploadBytes] = useState(STARTER_MAX_DUB_BYTES);
  // Each engine has its own per-second rate; null until /access answers.
  const [creditsPerSecond, setCreditsPerSecond] = useState<Record<DubEngine, number> | null>(null);
  const [maxLanguages, setMaxLanguages] = useState(1);
  // Where the voice mode does something; ElevenLabs always, Cypher once its v2 voices are live.
  const [voiceModeEngines, setVoiceModeEngines] = useState<DubEngine[]>(["elevenlabs"]);
  const [plan, setPlan] = useState<string | null>(null);

  // The job followed over SSE (null when none), and whether the user asked to cancel
  // (suppresses the generic failure toast).
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const cancelRequestedRef = useRef(false);

  // The dub the current run belongs to, and the background upload of its video.
  const [projectId, setProjectId] = useState<string | null>(null);
  const [videoUpload, setVideoUpload] = useState<VideoUploadState>({ state: "idle", percent: 0 });
  // An existing dub this page picked up (see `attach`), as it was last read.
  const [attached, setAttached] = useState<DubResponse | null>(null);
  const attachingRef = useRef<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [progress, setProgress] = useState<DubbingProgress>({
    state: "idle",
    progress: 0,
    message: "",
  });

  // Every plan can dub; Starter is limited on clip length and size instead.
  useEffect(() => {
    api
      .get<{
        allowed: boolean;
        plan: string | null;
        maxDurationSeconds: number;
        maxUploadBytes: number;
        maxLanguages: number;
        creditsPerSecond: Record<DubEngine, number>;
        voiceModeEngines?: DubEngine[];
      }>("/api/v1/dubbing/access", { requireAuth: true })
      .then((res) => {
        setAllowed(!!res.allowed);
        setPlan(res.plan ?? null);
        if (res.maxDurationSeconds) setMaxDurationSeconds(res.maxDurationSeconds);
        if (res.maxUploadBytes) setMaxUploadBytes(res.maxUploadBytes);
        if (res.creditsPerSecond) setCreditsPerSecond(res.creditsPerSecond);
        if (res.maxLanguages) setMaxLanguages(res.maxLanguages);
        if (res.voiceModeEngines) setVoiceModeEngines(res.voiceModeEngines);
      })
      .catch(() => setAllowed(false))
      .finally(() => setAccessLoading(false));
  }, []);

  // Closing the tab mid-upload loses nothing (the dub's page can pick it back up), but
  // the browser should still ask first.
  useEffect(() => {
    if (videoUpload.state !== "uploading") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [videoUpload.state]);

  useEffect(() => () => {
    uploadAbortRef.current?.abort();
    eventSourceRef.current?.close();
  }, []);

  // A target is never the source: picking a source drops it from the targets, and the
  // targets menu greys out the source (DubLanguageTargets).
  const setTargets = useCallback((next: DubTarget[]) => setTargetsState(next), []);
  const setSourceLanguage = useCallback((next: string | null) => {
    setSourceLanguageState(next);
    if (next) setTargetsState((current) => current.filter((t) => t.language !== next));
  }, []);

  // Switching engine keeps the languages the new one speaks, and only dialects it honours.
  const setEngine = useCallback((next: DubEngine) => {
    setEngineState(next);
    setTargetsState((current) =>
      current
        .filter((t) => !t.language || isSupportedDubLanguage(t.language, next))
        .map((t) => (t.accent && !accentsFor(t.language, next).some((a) => a.value === t.accent) ? { language: t.language } : t)),
    );
  }, []);

  const updateProgress = useCallback(
    (state: DubbingProgress["state"], value: number, message: string) => {
      setProgress({ state, progress: value, message });
    },
    [],
  );

  // Shared by the file input and the drag-and-drop zone.
  const handleFileSelect = useCallback(async (file: File | null | undefined) => {
    if (!file) return;

    if (!/^(audio|video)\//.test(file.type)) {
      toast.error("Unsupported file", { description: "Please upload an audio or video file." });
      return;
    }
    if (file.size > maxUploadBytes) {
      toast.error("File too large", {
        description: `Your plan accepts files up to ${formatUploadLimit(maxUploadBytes)}.`,
      });
      return;
    }

    let duration: number;
    try {
      duration = await getMediaDuration(file);
    } catch (error) {
      toast.error("Unreadable file", {
        description: error instanceof Error ? error.message : "The file may be corrupt.",
      });
      return;
    }

    if (duration > maxDurationSeconds) {
      toast.error("Clip is too long for your plan", {
        description: `Your plan dubs clips up to ${formatDubDuration(maxDurationSeconds)}. This one is ${formatDubDuration(Math.round(duration))}. Trim it, or upgrade for a longer limit.`,
      });
      return;
    }

    setIsVideo(file.type.startsWith("video/"));
    setMediaFile(file);
    setMediaDuration(duration);
    setDubbedResult(null);
    setProgress({ state: "idle", progress: 0, message: "" });
  }, [maxDurationSeconds, maxUploadBytes]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileSelect(e.target.files?.[0]);
    if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-selecting the same file
  }, [handleFileSelect]);

  const resetForm = useCallback(() => {
    uploadAbortRef.current?.abort();
    eventSourceRef.current?.close();
    setMediaFile(null);
    setMediaDuration(null);
    setTargetsState([]);
    setSourceLanguageState(null);
    setVoiceMode(DEFAULT_DUB_VOICE_MODE);
    setKeyterms([]);
    setMediaName("");
    setDubbedResult(null);
    setProjectId(null);
    setAttached(null);
    setVideoUpload({ state: "idle", percent: 0 });
    setProgress({ state: "idle", progress: 0, message: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /** Stream a job's status over SSE. Replaces any job followed before it. */
  const followJob = useCallback((jobId: string, dubProjectId: string) => {
    eventSourceRef.current?.close();
    cancelRequestedRef.current = false;
    setActiveJobId(jobId);

    const eventSource = new EventSource(`${BACKEND_URL}/api/v1/dubbing/status/${jobId}`);
    eventSourceRef.current = eventSource;
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        state: string;
        progress: number;
        message: string;
        finished: boolean;
        error?: string;
        awaitingVideo?: boolean;
      };

      if (!data.finished) {
        updateProgress(mapState(data.state), data.progress, data.message);
        return;
      }
      eventSource.close();
      setActiveJobId(null);

      if (data.state === "completed" && data.awaitingVideo) {
        // The dub is done; only the mux is left, and it runs once the video is in.
        updateProgress("processing", 90, "Dubbed audio ready. Finishing the video upload...");
      } else if (data.state === "completed") {
        // Every language's result lives on the dub itself; one may have failed on its own.
        void getDubbing(dubProjectId).then((dub) => {
          const outputs = dub?.outputs ?? [];
          setDubbedResult({ projectId: dubProjectId, outputs });
          updateProgress("completed", 100, "Dubbing complete!");
          const ready = outputs.filter((o) => o.status === "completed").map((o) => o.language);
          const failed = outputs.filter((o) => o.status === "failed").map((o) => o.language);
          if (failed.length) {
            toast.warning("Dubbing finished with a problem", {
              description: `${languageList(failed)} failed and was not charged. Retry it from the dub's page.`,
            });
          } else {
            toast.success("Dubbing complete 🎉", { description: `Your media was dubbed into ${languageList(ready)}.` });
          }
        });
      } else if (cancelRequestedRef.current || (data.error || "").includes("cancelled")) {
        uploadAbortRef.current?.abort();
        updateProgress("failed", 0, "Cancelled");
        toast.info("Dubbing cancelled", { description: "No credits were charged." });
      } else {
        updateProgress("failed", 0, data.error || data.message);
        toast.error("Dubbing failed", {
          description: `${data.error || data.message} You can retry it from the dub's page.`,
        });
      }
    };

    eventSource.onerror = () => {
      // A dropped connection reconnects on its own (an API restart, a network blip). Only
      // a refused one, which the browser gives up on, means the job can't be followed.
      if (eventSource.readyState !== EventSource.CLOSED) return;
      setActiveJobId(null);
      updateProgress("failed", 0, "Connection lost");
      toast.error("Connection lost", { description: "Your dub keeps running. Open it from your dubbings to follow it." });
    };
  }, [updateProgress]);

  /** Background upload of the original video; hands off to the mux job if one is waiting. */
  const runVideoUpload = useCallback(async (
    dubProjectId: string,
    file: File,
    plan: { partSize: number; partCount: number; uploadedParts: number[] },
    signal: AbortSignal,
  ) => {
    setVideoUpload({ state: "uploading", percent: 0 });
    try {
      const jobId = await uploadDubVideo({
        projectId: dubProjectId,
        file,
        ...plan,
        signal,
        onProgress: (fraction) => setVideoUpload({ state: "uploading", percent: Math.round(fraction * 100) }),
      });
      setVideoUpload({ state: "done", percent: 100 });
      if (jobId) followJob(jobId, dubProjectId);
    } catch (error) {
      if (isAbortError(error)) return;
      setVideoUpload((v) => ({ ...v, state: "failed" }));
      toast.error("Video upload paused", {
        description: getApiErrorMessage(error, "Check your connection, then resume the upload."),
      });
    }
  }, [followJob]);

  const handleDubMedia = useCallback(async () => {
    const picked = targets.filter((t) => t.language);
    const languages = picked.map((t) => t.language);
    if (!mediaFile || !languages.length || !mediaName.trim()) {
      if (!mediaFile) toast.error("No file uploaded");
      if (!languages.length) toast.error("No target language selected");
      if (!mediaName.trim()) toast.error("Please enter a name for your media");
      return;
    }
    if (languages.length > maxLanguages) {
      toast.error("Too many languages", { description: `Your plan dubs into up to ${maxLanguages} at once.` });
      return;
    }

    const abort = new AbortController();
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = abort;

    try {
      // Measured at file-select; re-read only if that somehow did not stick.
      const durationSeconds = mediaDuration ?? (await getMediaDuration(mediaFile));

      // Fail before the upload rather than after it — the server enforces this too,
      // this just saves the user the wait. Re-checked WITH the language, because the
      // dubbing_v1 route caps lower than the plan does.
      const durationCap = maxDubSecondsForPlan(plan, languages, engine);
      if (durationSeconds > durationCap) {
        throw new Error(
          `Your plan can dub ${languageList(languages)} clips up to ${formatDubDuration(durationCap)}. This one is ${formatDubDuration(Math.round(durationSeconds))}. Trim it, or upgrade for a longer limit.`,
        );
      }
      const sizeCap = maxDubBytesForPlan(plan, languages, engine);
      if (mediaFile.size > sizeCap) {
        throw new Error(
          `Your plan accepts ${languageList(languages)} files up to ${formatUploadLimit(sizeCap)}.`,
        );
      }

      // 1. Only the sound is needed to dub, so a video's audio track goes up first.
      updateProgress("uploading", 1, "Preparing your audio...");
      const extracted = isVideo
        ? await extractAudioTrack(mediaFile, (f) =>
            updateProgress("uploading", 1 + f * 4, `Extracting audio... ${Math.round(f * 100)}%`))
        : null;
      const contentType = mediaFile.type || (isVideo ? "video/mp4" : "audio/mpeg");
      const audio = extracted ?? { blob: mediaFile, contentType };

      // 2. Register the dub and open its uploads. Plan, size and balance are checked here.
      const targets = await api.post<DubUploadTargets>(
        "/api/v1/dubbing/uploads",
        {
          filename: mediaFile.name,
          contentType,
          fileSize: mediaFile.size,
          isVideo,
          durationSeconds,
          engine,
          targets: picked.map((t) => (t.accent ? { language: t.language, accent: t.accent } : { language: t.language })),
          ...(sourceLanguage ? { sourceLanguage } : {}),
          voiceMode,
          ...(keyterms.length ? { keyterms } : {}),
          mediaName: mediaName.trim(),
          fingerprint: fileFingerprint(mediaFile),
          audio: { contentType: audio.contentType, size: audio.blob.size, extracted: !!extracted },
        },
        { requireAuth: true, accessToken: session?.access_token },
      );
      setProjectId(targets.projectId);

      // 3. Audio into its resumable session.
      await uploadDubAudio({
        projectId: targets.projectId,
        sessionUri: targets.audio.sessionUri,
        blob: audio.blob,
        signal: abort.signal,
        onProgress: (f) => updateProgress("uploading", 5 + f * 10, `Uploading audio... ${Math.round(f * 100)}%`),
      });

      // 4. Start dubbing, and send the video while it runs.
      updateProgress("processing", 15, "Audio uploaded. Starting dubbing...");
      const { jobId } = await startDub(targets.projectId);
      if (targets.video) {
        void runVideoUpload(targets.projectId, mediaFile, { ...targets.video, uploadedParts: [] }, abort.signal);
      }
      followJob(jobId, targets.projectId);
    } catch (error) {
      if (isAbortError(error)) return;
      eventSourceRef.current?.close();
      setActiveJobId(null);
      const message = getApiErrorMessage(error, "Dubbing failed.");
      updateProgress("failed", 0, message);
      toast.error("Error dubbing media", { description: message });
    }
  }, [mediaFile, mediaDuration, targets, engine, sourceLanguage, voiceMode, keyterms, maxLanguages, isVideo, mediaName, session, updateProgress, plan, followJob, runVideoUpload]);

  /** Pick the video upload back up after it paused, sending only the missing parts. */
  const resumeVideoUpload = useCallback(async () => {
    if (!projectId || !mediaFile) return;
    try {
      const state = await getUploadState(projectId);
      if (!state.video) return;
      const abort = new AbortController();
      uploadAbortRef.current = abort;
      await runVideoUpload(projectId, mediaFile, state.video, abort.signal);
    } catch (error) {
      toast.error("Could not resume", { description: getApiErrorMessage(error, "Please try again.") });
    }
  }, [projectId, mediaFile, runVideoUpload]);

  /**
   * Pick up an existing dub, opened from its details page: load its settings and carry on
   * from wherever it is. A running job is followed; a failed one is resumed from where it
   * stopped when `retry` is set. A dub whose upload stopped is left for the page to ask
   * for the file again (see useDubResumeUpload), which calls this again once it is in.
   */
  const attach = useCallback(async (id: string, retry: boolean) => {
    // StrictMode and the upload's double callback can call this twice at once: one
    // retry is one charge.
    if (attachingRef.current === id) return;
    attachingRef.current = id;
    try {
      const dub = await getDubbing(id, session?.access_token);
      if (!dub) {
        updateProgress("failed", 0, "Dubbing not found");
        return;
      }
      setAttached(dub);
      setProjectId(id);
      // What the progress card and the result show; the form itself is not shown here.
      setIsVideo(dub.isVideo);
      setMediaName(dub.mediaName ?? "");
      setEngineState(dub.engine ?? DEFAULT_DUB_ENGINE);
      setTargetsState(dub.outputs.map((o) => ({ language: o.language })));

      if (dub.status === "completed") {
        setDubbedResult({ projectId: id, outputs: dub.outputs });
        updateProgress("completed", 100, "Dubbing complete!");
      } else if (DUB_JOB_STATUSES.includes(dub.status) && dub.jobId) {
        followJob(dub.jobId, id);
      } else if (dub.status === "awaiting_video") {
        updateProgress("processing", 90, "Dubbed audio ready. Finishing the video upload...");
      } else if (dub.status === "failed" && !retry) {
        updateProgress("failed", 0, dub.errorMessage ?? "Dubbing failed.");
      } else if (dub.status === "failed" && dub.videoStatus !== "uploading") {
        updateProgress("processing", 1, "Picking up from where it stopped...");
        try {
          const { jobId } = await resumeDubbing(id, session?.access_token);
          followJob(jobId, id);
        } catch (error) {
          const message = getApiErrorMessage(error, "Please try again.");
          updateProgress("failed", 0, message);
          toast.error("Could not retry", { description: message });
        }
      } else {
        // Its upload stopped, or a retry needs the video first: the page asks for the file.
        updateProgress("idle", 0, "");
      }
    } finally {
      attachingRef.current = null;
    }
  }, [session, followJob, updateProgress]);

  /**
   * Cancel the dub, whatever it is doing: a queued job is dropped, a running one stops at
   * its next step, a wait for the video ends, and one that never started is discarded.
   * Before the dub is registered there is only the local upload to stop.
   */
  const cancelDub = useCallback(async () => {
    uploadAbortRef.current?.abort();
    if (!projectId) {
      updateProgress("failed", 0, "Cancelled");
      return;
    }
    cancelRequestedRef.current = true;
    try {
      const res = await cancelDubbing(projectId, session?.access_token);
      toast.info(res.message);
      // A followed job reports its own end over SSE; nothing else will.
      if (!activeJobId) updateProgress("failed", 0, "Cancelled");
    } catch (error) {
      cancelRequestedRef.current = false;
      toast.error("Could not cancel", { description: getApiErrorMessage(error, "Please try again.") });
    }
  }, [projectId, activeJobId, session, updateProgress]);

  const isLoading = progress.state === "uploading" || progress.state === "processing";

  // What this dub will cost, priced the same way the API prices it. Null until both the
  // file's duration and the plan's rate are known: an estimate off a guessed rate would
  // be worse than none, since it is the number the user decides on.
  // Each language is its own dub, so the estimate scales with how many are picked.
  const languageCount = Math.max(1, targets.filter((t) => t.language).length);
  const estimatedCredits =
    mediaDuration !== null && creditsPerSecond !== null
      ? calculateDubbingCreditsByDuration(mediaDuration, creditsPerSecond[engine]) * languageCount
      : null;

  return {
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
    voiceModeEngines,
    keyterms,
    setKeyterms,
    maxLanguages,
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
    creditsPerSecond,
    attached,
    attach,
    videoUpload,
    resumeVideoUpload,
    cancelDub,
    handleFileChange,
    handleFileSelect,
    resetForm,
    handleDubMedia,
  };
}
