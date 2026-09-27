import { promisify } from 'util';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import { speechFromSilenceLog, type Span } from './dub-segments';

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
 * Lay a dubbed audio track over the original video. The picture is copied through
 * untouched (no re-encode, so the cost is IO, not CPU) and only the new audio is written.
 * The track is padded with silence to the video's length: a dub ends at its last spoken
 * line, and without the padding a silent or music-only ending would be cut off.
 *
 * ffmpeg comes from the worker image (see Dockerfile.worker).
 */
export async function muxDubbedAudio({
  audioPath,
  videoPath,
  outputPath,
}: {
  audioPath: string;
  videoPath: string;
  outputPath: string;
}): Promise<void> {
  await runFfmpeg([
    '-y', '-i', videoPath, '-i', audioPath,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-af', 'apad', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', outputPath,
  ]);
}

/**
 * A short mono clip of the speaker for Chatterbox to clone from. The model conditions on
 * the first 10 s and averages its speaker embedding over whatever it is given, so a two
 * minute clip keeps the voice while every segment call downloads a few MB instead of the
 * whole source. ffmpeg reads the URL with range requests and stops at `seconds`.
 */
export async function extractVoiceReference(inputUrl: string, outputPath: string, seconds: number): Promise<void> {
  await runFfmpeg(['-y', '-i', inputUrl, '-t', String(seconds), '-vn', '-ac', '1', '-ar', '16000', outputPath]);
}

/**
 * Where the source has sound: ffmpeg's silence detector, one pass over the audio. Every
 * pause of at least `minPauseSeconds` below `noiseDb` splits it. This is the dub's clock:
 * each transcript line is placed on these stretches (see alignToSpeech).
 */
export async function detectSpeech(inputUrl: string, totalSeconds: number, noiseDb = -35, minPauseSeconds = 0.3): Promise<Span[]> {
  const { stderr } = await runBinary('ffmpeg', [
    '-hide_banner', '-nostats', '-i', inputUrl, '-vn',
    '-af', `silencedetect=noise=${noiseDb}dB:d=${minPauseSeconds}`, '-f', 'null', '-',
  ]);
  return speechFromSilenceLog(stderr, totalSeconds);
}

/** A stretch of the source as 16 kHz mono WAV: one speaker's line, for their voice sample. */
export async function cutAudioClip(inputUrl: string, start: number, duration: number, outputPath: string): Promise<void> {
  await runFfmpeg(['-y', '-ss', start.toFixed(2), '-t', duration.toFixed(2), '-i', inputUrl, '-vn', '-ac', '1', '-ar', '16000', outputPath]);
}

/** A window of the source as 16 kHz mono FLAC (small, lossless) for the speaker analysis. */
export async function cutAnalysisWindow(inputUrl: string, start: number, duration: number, outputPath: string): Promise<void> {
  await runFfmpeg(['-y', '-ss', String(start), '-t', String(duration), '-i', inputUrl, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'flac', outputPath]);
}

// Dubbed turns are kept as raw 16-bit mono PCM at this rate: every byte count is then an
// exact duration, which is what placing each turn on the timeline needs.
export const DUB_PCM_SAMPLE_RATE = 24000;
export const DUB_PCM_BYTES_PER_SECOND = DUB_PCM_SAMPLE_RATE * 2;

/** Whatever Modal returned (its WAV format is Chatterbox's choice) as raw PCM. */
export async function toDubPcm(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(['-y', '-i', inputPath, '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', String(DUB_PCM_SAMPLE_RATE), outputPath]);
}

/** The assembled raw track as the MP3 every dubbed track is stored as. */
export async function dubPcmToMp3(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(['-y', '-f', 's16le', '-ar', String(DUB_PCM_SAMPLE_RATE), '-ac', '1', '-i', inputPath, '-c:a', 'libmp3lame', '-q:a', '2', outputPath]);
}

/** Any audio or video file's sound as MP3 (ElevenLabs may hand back either). */
export async function toMp3(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(['-y', '-i', inputPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', outputPath]);
}

/** Join WAV clips end to end into one 16-bit WAV (a speaker's voice sample). */
export async function concatWavs(inputPaths: string[], listPath: string, outputPath: string): Promise<void> {
  // concat-demuxer syntax: forward slashes, and a quote inside a quoted path is '\''.
  const list = inputPaths.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, list);
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'pcm_s16le', outputPath]);
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
async function runBinary(tool: 'ffmpeg' | 'ffprobe', args: string[]): Promise<{ stdout: string; stderr: string }> {
  const resolved = tool === 'ffmpeg' ? resolvedFfmpeg : resolvedFfprobe;
  const candidates = resolved ? [resolved] : tool === 'ffmpeg' ? FFMPEG_CANDIDATES : FFPROBE_CANDIDATES;

  for (const [index, binary] of candidates.entries()) {
    try {
      const { stdout, stderr } = await execFileAsync(binary, args, {
        timeout: FFMPEG_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (tool === 'ffmpeg') resolvedFfmpeg = binary;
      else resolvedFfprobe = binary;
      return { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
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
