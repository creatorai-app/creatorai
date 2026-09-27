"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Progress } from "@repo/ui/progress";
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

/**
 * Finishes a dub whose uploads stopped (tab closed, connection dropped). The browser no
 * longer holds the file, so the user picks it again; what GCS already has is kept and
 * only the rest is sent.
 */
export function DubbingResumeUpload({ projectId, onProgressed }: { projectId: string; onProgressed: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<{ label: string; percent: number } | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!status) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const resume = async (file: File) => {
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      setStatus({ label: "Checking what already uploaded...", percent: 0 });
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
              setStatus({ label: "Extracting audio...", percent: Math.round(f * 100) }));
            if (!extracted) throw new Error("This browser could not read the audio from that file.");
            blob = extracted.blob;
            sessionUri = await newAudioSession(projectId, blob.size);
            offset = 0;
          }
          await uploadDubAudio({
            projectId, sessionUri, blob, offset, signal: abort.signal,
            onProgress: (f) => setStatus({ label: "Uploading audio...", percent: Math.round(f * 100) }),
          });
        }
        setStatus({ label: "Starting your dub...", percent: 100 });
        await startDub(projectId);
        onProgressed();
      }

      if (state.video && state.video.status === "uploading") {
        await uploadDubVideo({
          projectId, file, ...state.video, signal: abort.signal,
          onProgress: (f) => setStatus({ label: "Uploading video...", percent: Math.round(f * 100) }),
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
  };

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

      {status ? (
        <div className="space-y-2" aria-live="polite">
          <Progress value={status.percent} />
          <p className="text-xs text-slate-500 dark:text-slate-400">{status.label} {status.percent}%</p>
          <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
            Pause
          </Button>
        </div>
      ) : (
        <Button onClick={() => inputRef.current?.click()} className="bg-purple-600 text-white hover:bg-purple-700">
          <UploadCloud className="mr-2 h-4 w-4" /> Choose the file
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void resume(file);
        }}
      />
    </div>
  );
}
