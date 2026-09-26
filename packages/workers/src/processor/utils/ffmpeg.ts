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
// ffprobe ships in the same package as ffmpeg, so PATH normally has both; FFPROBE_PATH
// is the escape hatch for a machine where it does not.
const FFPROBE_CANDIDATES = [process.env.FFPROBE_PATH, 'ffprobe'].filter(Boolean) as string[];
let resolvedFfmpeg: string | null = null;
let resolvedFfprobe: string | null = null;

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

/**
 * How long the media at `url` actually runs, straight from the container metadata.
 *
 * ffprobe reads the header over HTTP with range requests, so a 2GB MP4 costs a few KB
 * here rather than a download. This is the only independent reading of the source
 * length the pipeline gets, because `durationSeconds` comes from the browser. It is what
 * the plan cap and the final price are settled against.
 *
 * Returns null when the container declares no duration; the caller then falls back to
 * the client's figure rather than failing a dub over a missing header.
 */
export async function probeDurationSeconds(url: string): Promise<number | null> {
  const { stdout } = await runBinary(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', url],
  );
  const seconds = Number(stdout.trim());
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** Run ffmpeg from the first candidate that exists, remembering which one worked. */
async function runFfmpeg(args: string[]): Promise<void> {
  await runBinary('ffmpeg', args);
}

/** Try each candidate path for a binary in turn, caching the one that ran. */
async function runBinary(tool: 'ffmpeg' | 'ffprobe', args: string[]): Promise<{ stdout: string }> {
  const resolved = tool === 'ffmpeg' ? resolvedFfmpeg : resolvedFfprobe;
  const candidates = resolved ? [resolved] : tool === 'ffmpeg' ? FFMPEG_CANDIDATES : FFPROBE_CANDIDATES;

  for (const [index, binary] of candidates.entries()) {
    try {
      const { stdout } = await execFileAsync(binary, args, {
        timeout: FFMPEG_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (tool === 'ffmpeg') resolvedFfmpeg = binary;
      else resolvedFfprobe = binary;
      return { stdout: String(stdout ?? '') };
    } catch (error: any) {
      // Not installed under that name — try the next one before giving up.
      if (error?.code === 'ENOENT' && index < candidates.length - 1) continue;
      if (error?.code === 'ENOENT') {
        throw new Error(
          `${tool} is not installed (tried ${candidates.join(', ')}). The dubbing pipeline measures ` +
          'and assembles media locally and needs it. Set FFMPEG_PATH or install ffmpeg.',
        );
      }
      // ffmpeg says what went wrong on the last lines of stderr; the rest is banner noise.
      const detail = String(error?.stderr || error?.message || '').trim().slice(-400);
      throw new Error(`${tool} failed while processing the dub: ${detail}`);
    }
  }

  throw new Error(`${tool} is not installed`);
}
