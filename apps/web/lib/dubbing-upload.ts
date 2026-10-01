import type { DubUploadState } from "@repo/validation";
import { api } from "@/lib/api-client";

// Browser side of a dub's uploads (docs/dubbing-resumable-uploads.md). The audio goes
// into a GCS resumable session, the original video into a parallel multipart upload.
// Everything that decides where to resume from lives in GCS and is read through the
// API, so a closed tab loses nothing but the File handle, which the user picks again.

const PART_CONCURRENCY = 4;
const PART_ATTEMPTS = 4;
const AUDIO_ATTEMPTS = 4;

const auth = { requireAuth: true } as const;

/** Identifies the picked file well enough to refuse a different one on resume. */
export function fileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/**
 * Pull the audio track out of a video without re-encoding it, so only a few MB have to
 * upload before dubbing can start. Returns null when the browser cannot (an unusual
 * container or codec); the caller then uploads the whole file as the audio.
 */
export async function extractAudioTrack(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ blob: Blob; contentType: string } | null> {
  const {
    Input, BlobSource, ALL_FORMATS, Output, BufferTarget, Mp4OutputFormat, WebMOutputFormat, Conversion,
  } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    // Opus and Vorbis live in WebM; everything else (AAC above all) copies into MP4.
    const webm = track.codec === "opus" || track.codec === "vorbis";
    const output = new Output({
      format: webm ? new WebMOutputFormat() : new Mp4OutputFormat(),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({ input, output, video: { discard: true }, showWarnings: false });
    if (!conversion.isValid) return null;
    conversion.onProgress = (fraction) => onProgress?.(fraction);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) return null;
    const contentType = webm ? "audio/webm" : "audio/mp4";
    return { blob: new Blob([buffer], { type: contentType }), contentType };
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}

class UploadAbortedError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "AbortError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * PUT a blob with upload progress. XHR rather than fetch because fetch still reports no
 * upload progress; resolves with the status instead of throwing on non-2xx, since GCS
 * answers an unfinished resumable upload with 308.
 */
function putBlob(
  url: string,
  body: Blob,
  opts: { headers?: Record<string, string>; signal?: AbortSignal; onProgress?: (loaded: number) => void },
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new UploadAbortedError());
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (e) => opts.onProgress?.(e.loaded);
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new UploadAbortedError());
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));

export function getUploadState(projectId: string) {
  return api.get<DubUploadState & { sessionUri: string | null }>(`/api/v1/dubbing/${projectId}/upload`, auth);
}

/** A fresh audio session; `size` when a resume re-extracted the track. */
export async function newAudioSession(projectId: string, size?: number): Promise<string> {
  const { sessionUri } = await api.post<{ sessionUri: string }>(
    `/api/v1/dubbing/${projectId}/upload/audio-session`, size ? { size } : {}, auth,
  );
  return sessionUri;
}

/**
 * Send the audio into its resumable session in one request (fastest, per GCS), and on a
 * dropped connection continue from the byte GCS says it has, not from zero. An expired
 * session, or a re-extracted track that may differ by a byte, starts a fresh session.
 */
export async function uploadDubAudio(opts: {
  projectId: string;
  sessionUri: string | null;
  blob: Blob;
  /** Bytes GCS already holds from an earlier attempt; only safe for the identical blob. */
  offset?: number;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}): Promise<void> {
  const { projectId, blob, signal, onProgress } = opts;
  let sessionUri = opts.sessionUri ?? (await newAudioSession(projectId));
  let offset = opts.offset ?? 0;

  for (let attempt = 0; attempt < AUDIO_ATTEMPTS; attempt++) {
    try {
      const body = offset ? blob.slice(offset) : blob;
      const headers: Record<string, string> = offset
        ? { "Content-Range": `bytes ${offset}-${blob.size - 1}/${blob.size}` }
        : {};
      const status = await putBlob(sessionUri, body, {
        headers,
        signal,
        onProgress: (loaded) => onProgress?.((offset + loaded) / blob.size),
      });
      if (status === 200 || status === 201) return;
      if (status === 404 || status === 410) {
        sessionUri = await newAudioSession(projectId);
        offset = 0;
        continue;
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
    }
    await backoff(attempt);
    const state = await getUploadState(projectId);
    if (state.audio.complete) return;
    if (state.sessionUri) {
      sessionUri = state.sessionUri;
      offset = state.audio.uploadedBytes;
    } else {
      sessionUri = await newAudioSession(projectId);
      offset = 0;
    }
  }
  throw new Error("The audio upload kept failing. Check your connection and resume the upload.");
}

export function startDub(projectId: string): Promise<{ jobId: string }> {
  return api.post<{ jobId: string }>(`/api/v1/dubbing/${projectId}/start`, {}, auth);
}

/**
 * Upload the parts GCS does not have yet, PART_CONCURRENCY at a time, each on a URL
 * signed just before it is sent. Then have the API stitch them. Returns the mux job id
 * when the dubbed audio was already waiting on this video, else null.
 */
export async function uploadDubVideo(opts: {
  projectId: string;
  file: File;
  partSize: number;
  partCount: number;
  uploadedParts: number[];
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}): Promise<string | null> {
  const { projectId, file, partSize, partCount, signal, onProgress } = opts;
  const done = new Set(opts.uploadedParts);
  const queue = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
  const partBytes = (n: number) => Math.min(partSize, file.size - (n - 1) * partSize);

  let completedBytes = [...done].reduce((sum, n) => sum + partBytes(n), 0);
  const inFlight = new Map<number, number>();
  const report = () => {
    const sending = [...inFlight.values()].reduce((a, b) => a + b, 0);
    onProgress?.((completedBytes + sending) / file.size);
  };
  report();

  const sendPart = async (n: number) => {
    const blob = file.slice((n - 1) * partSize, (n - 1) * partSize + partBytes(n));
    for (let attempt = 0; attempt < PART_ATTEMPTS; attempt++) {
      try {
        const { url } = await api.post<{ url: string }>(
          `/api/v1/dubbing/${projectId}/upload/video-part`, { partNumber: n }, auth,
        );
        const status = await putBlob(url, blob, {
          signal,
          onProgress: (loaded) => { inFlight.set(n, loaded); report(); },
        });
        if (status >= 200 && status < 300) {
          inFlight.delete(n);
          completedBytes += blob.size;
          report();
          return;
        }
      } catch (error) {
        if (isAbortError(error)) throw error;
      }
      inFlight.delete(n);
      await backoff(attempt);
    }
    throw new Error("The video upload kept failing. Check your connection and resume the upload.");
  };

  // One lane failing for good stops the others pulling new parts; what already landed
  // stays in GCS for the resume.
  let failed = false;
  const lanes = Array.from({ length: Math.min(PART_CONCURRENCY, queue.length) }, async () => {
    for (let n = queue.shift(); n !== undefined && !failed; n = queue.shift()) {
      try {
        await sendPart(n);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });
  await Promise.all(lanes);

  const { jobId } = await api.post<{ jobId: string | null }>(
    `/api/v1/dubbing/${projectId}/upload/video-complete`, {}, auth,
  );
  return jobId;
}
