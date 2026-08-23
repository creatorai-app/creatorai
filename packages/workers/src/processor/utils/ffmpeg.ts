import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

// A dub is at most one upload's worth of media; a remux that has not finished in this
// long is stuck, not slow.
const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;

// Where ffmpeg comes from: an explicit override first, otherwise whatever is on PATH —
// the worker image installs it (Dockerfile.worker), and FFMPEG_PATH covers the dev
// machines that have it somewhere else. Same env var the API's ffmpeg-config.ts reads.
const FFMPEG_CANDIDATES = [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean) as string[];
let resolvedFfmpeg: string | null = null;

/**
 * Lay a dubbed audio track over the original media.
 *
 * With `videoPath`, the picture is copied through untouched (no re-encode, so cost is
 * IO not CPU) and only the new audio is written. Without one, the track is transcoded
 * to MP3 — both because the dubbed track arrives as FLAC and because the signed GCS PUT
 * URL for an audio dub is bound to `audio/mpeg`.
 *
 * ffmpeg comes from the worker image (see Dockerfile.worker).
 */
export async function muxDubbedAudio({
  audioPath,
  videoPath,
  outputPath,
}: {
  audioPath: string;
  videoPath?: string;
  outputPath: string;
}): Promise<void> {
  const args = videoPath
    ? ['-y', '-i', videoPath, '-i', audioPath,
       '-map', '0:v:0', '-map', '1:a:0',
       '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
       '-shortest', outputPath]
    : ['-y', '-i', audioPath, '-c:a', 'libmp3lame', '-q:a', '2', outputPath];

  await runFfmpeg(args);
}

/** Run ffmpeg from the first candidate that exists, remembering which one worked. */
async function runFfmpeg(args: string[]): Promise<void> {
  const candidates = resolvedFfmpeg ? [resolvedFfmpeg] : FFMPEG_CANDIDATES;

  for (const [index, binary] of candidates.entries()) {
    try {
      await execFileAsync(binary, args, { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 });
      resolvedFfmpeg = binary;
      return;
    } catch (error: any) {
      // Not installed under that name — try the next one before giving up.
      if (error?.code === 'ENOENT' && index < candidates.length - 1) continue;
      if (error?.code === 'ENOENT') {
        throw new Error(
          `ffmpeg is not installed (tried ${candidates.join(', ')}). Dubs into languages that ` +
          'run on the dubbing_v1 model are assembled locally and need it — set FFMPEG_PATH or install ffmpeg.',
        );
      }
      // ffmpeg says what went wrong on the last lines of stderr; the rest is banner noise.
      const detail = String(error?.stderr || error?.message || '').trim().slice(-400);
      throw new Error(`ffmpeg failed while assembling the dub: ${detail}`);
    }
  }
}
