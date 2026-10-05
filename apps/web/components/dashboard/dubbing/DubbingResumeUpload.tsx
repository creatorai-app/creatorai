"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Square, UploadCloud } from "lucide-react";
import { Button } from "@repo/ui/button";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  extractAudioTrack,
  fileFingerprint,
  getUploadState,
  isAbortError,
  newAudioSession,
  startDub,
  uploadDubAudio,
  uploadDubVideo,
} from "@/lib/dubbing-upload";

export type DubResumeUploadStatus = { phase: "audio" | "video"; label: string; percent: number };

/**
 * Finishes a dub whose uploads stopped (tab closed, connection dropped). The browser no
 * longer holds the file, so the user picks it again; what GCS already has is kept and
 * only the rest is sent. `status` is null while nothing is uploading.
 */
export function useDubResumeUpload(projectId: string, onProgressed: () => void) {
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<DubResumeUploadStatus | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!status) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const resume = useCallback(async (file: File) => {
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      setStatus({ phase: "audio", label: "Checking what already uploaded...", percent: 0 });
      const state = await getUploadState(projectId);
      if (state.fingerprint && state.fingerprint !== fileFingerprint(file)) {
        throw new Error("That is not the file this dub started with. Pick the same file.");
      }

      if (state.status === "uploading") {
        if (!state.audio.complete) {
          let blob: Blob = file;
          let sessionUri = state.sessionUri;
          let offset = state.audio.uploadedBytes;
          if (state.audio.extracted) {
            // The track is made again, and a remade track is sent from the start.
            const extracted = await extractAudioTrack(file, (f) =>
              setStatus({ phase: "audio", label: "Extracting audio...", percent: Math.round(f * 100) }));
            if (!extracted) throw new Error("This browser could not read the audio from that file.");
            blob = extracted.blob;
            sessionUri = await newAudioSession(projectId, blob.size);
            offset = 0;
          }
          await uploadDubAudio({
            projectId, sessionUri, blob, offset, signal: abort.signal,
            onProgress: (f) => setStatus({ phase: "audio", label: "Uploading audio...", percent: Math.round(f * 100) }),
          });
        }
        setStatus({ phase: "audio", label: "Starting your dub...", percent: 100 });
        await startDub(projectId);
        onProgressed();
      }

      if (state.video && state.video.status === "uploading") {
        await uploadDubVideo({
          projectId, file, ...state.video, signal: abort.signal,
          onProgress: (f) => setStatus({ phase: "video", label: "Uploading video...", percent: Math.round(f * 100) }),
        });
      }
      toast.success("Upload finished", { description: "Your dub picks up from here." });
      onProgressed();
    } catch (error) {
      if (isAbortError(error)) return;
      toast.error("Upload paused", { description: getApiErrorMessage(error, "Check your connection and try again.") });
    } finally {
      setStatus(null);
    }
  }, [projectId, onProgressed]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { status, resume, stop };
}

/**
 * Asks for the file the dub started with; the upload itself runs in useDubResumeUpload.
 * `banner` is the slim form shown under a running dub's progress card.
 */
export function DubbingResumeUpload({ onPick, onCancel, banner }: {
  onPick: (file: File) => void;
  /** Offered next to the picker on a dub that never started. */
  onCancel?: () => void;
  banner?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="audio/*,video/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onPick(file);
      }}
    />
  );

  if (banner) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
        <p>
          The video upload paused. Pick the same file to finish it; the parts already sent are kept.
        </p>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} className="shrink-0">
          <UploadCloud className="mr-2 h-4 w-4" /> Resume upload
        </Button>
        {input}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <UploadCloud className="mx-auto h-10 w-10 text-purple-500" />
      <div className="space-y-1">
        <p className="font-semibold text-slate-900 dark:text-slate-50">Finish uploading</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The upload for this dub has not finished. If it stopped, pick the same file you started with
          and only the parts that did not arrive are sent.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Button onClick={() => inputRef.current?.click()} className="bg-purple-600 text-white hover:bg-purple-700">
          <UploadCloud className="mr-2 h-4 w-4" /> Choose the file
        </Button>
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30"
          >
            <Square className="mr-1.5 h-3.5 w-3.5 fill-current" /> Cancel Dubbing
          </Button>
        )}
      </div>
      {input}
    </div>
  );
}
