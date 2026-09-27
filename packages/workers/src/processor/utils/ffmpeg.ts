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
export async function muxDubbedAudio(paths: { audioPath: string; videoPath: string; outputPath: string }): Promise<void> {
  await runFfmpeg(muxArgs(paths));
}

export function muxArgs({ audioPath, videoPath, outputPath }: { audioPath: string; videoPath: string; outputPath: string }): string[] {
  return [
    '-y', '-i', videoPath, '-i', audioPath,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-af', 'apad', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', outputPath,
  ];
}

// Voice samples are cut at Chatterbox's own rate (S3GEN_SR, 24 kHz): the decoder prompt
// is taken at that rate, so a 16 kHz sample would throw away what it could use. The
// frozen Modal app downsamples to 16 kHz anyway; the v2 service keeps it.
export const VOICE_SAMPLE_RATE = 24000;

/**
 * A mono clip of the speaker for Chatterbox to clone from, from the start of the source:
 * the fallback when no speaker has enough clean speech of their own. ffmpeg reads the URL
 * with range requests and stops at `seconds`.
 */
export async function extractVoiceReference(inputUrl: string, outputPath: string, seconds: number): Promise<void> {
  await runFfmpeg(['-y', '-i', inputUrl, '-t', String(seconds), '-vn', '-ac', '1', '-ar', String(VOICE_SAMPLE_RATE), outputPath]);
}

/**
 * silencedetect settings per kind of audio. The mix has music and room noise under the
 * speech, so its floor is high (-35 dB) and only a clear 0.3 s gap counts as a pause.
 * A separated vocal stem is near silent between phrases, so a lower floor (-40 dB) keeps
 * quiet speech in, and a shorter gap (0.25 s) finds the breaths between sentences.
 */
export const SPEECH_DETECT_PRESETS = {
  mix: { noiseDb: -35, minPauseSeconds: 0.3 },
  vocals: { noiseDb: -40, minPauseSeconds: 0.25 },
} as const;
export type SpeechDetectPreset = keyof typeof SPEECH_DETECT_PRESETS;

export function silenceDetectArgs(input: string, preset: SpeechDetectPreset): string[] {
  const { noiseDb, minPauseSeconds } = SPEECH_DETECT_PRESETS[preset];
  return ['-hide_banner', '-nostats', '-i', input, '-vn', '-af', `silencedetect=noise=${noiseDb}dB:d=${minPauseSeconds}`, '-f', 'null', '-'];
}

/**
 * Where the source has sound: ffmpeg's silence detector, one pass over the audio. Every
 * pause below the preset's floor splits it. This is the dub's clock: each transcript
 * line is placed on these stretches (see alignToSpeech).
 */
export async function detectSpeech(input: string, totalSeconds: number, preset: SpeechDetectPreset = 'mix'): Promise<Span[]> {
  const { stderr } = await runBinary('ffmpeg', silenceDetectArgs(input, preset));
  return speechFromSilenceLog(stderr, totalSeconds);
}

/** A stretch of the source as mono WAV at the voice sample rate: one line, for a voice sample. */
export async function cutAudioClip(inputUrl: string, start: number, duration: number, outputPath: string): Promise<void> {
  await runFfmpeg([
    '-y', '-ss', start.toFixed(2), '-t', duration.toFixed(2), '-i', inputUrl, '-vn', '-ac', '1', '-ar', String(VOICE_SAMPLE_RATE), outputPath,
  ]);
}

/** A window of the source at 44.1 kHz FLAC, channels kept: what stem separation is sent. */
export function stemInputArgs(input: string, start: number, duration: number, output: string): string[] {
  return ['-y', '-ss', String(start), '-t', String(duration), '-i', input, '-vn', '-ar', '44100', '-c:a', 'flac', output];
}

export async function cutStemInput(input: string, start: number, duration: number, output: string): Promise<void> {
  await runFfmpeg(stemInputArgs(input, start, duration, output));
}

/**
 * One separated stem as 44.1 kHz FLAC of EXACTLY the window's length (padded or cut), so
 * the windows' stems join end to end in step with the source. `raw` is for a stem that
 * came back as headerless PCM (the `pcm_*` output formats).
 */
export function stemToFlacArgs({
  input,
  output,
  durationSeconds,
  raw,
}: {
  input: string;
  output: string;
  durationSeconds: number;
  raw?: { sampleRate: number; channels: number };
}): string[] {
  return [
    '-y',
    ...(raw ? ['-f', 's16le', '-ar', String(raw.sampleRate), '-ac', String(raw.channels)] : []),
    '-i', input,
    '-af', `apad,atrim=0:${durationSeconds.toFixed(3)}`,
    '-ar', '44100', '-c:a', 'flac', output,
  ];
}

export async function stemToFlac(opts: Parameters<typeof stemToFlacArgs>[0]): Promise<void> {
  await runFfmpeg(stemToFlacArgs(opts));
}

/** Join FLAC pieces listed in a concat file into one FLAC. */
export async function concatFlac(inputPaths: string[], listPath: string, outputPath: string): Promise<void> {
  await fs.writeFile(listPath, concatList(inputPaths));
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'flac', outputPath]);
}

/** True when ffprobe can read the file as audio (a stem with a real header). */
export async function hasAudioHeader(input: string): Promise<boolean> {
  try {
    const { stdout } = await runBinary('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', input]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** A window of the source as 16 kHz mono FLAC (small, lossless) for the speaker analysis and forced alignment. */
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

const PCM_INPUT = ['-f', 's16le', '-ar', String(DUB_PCM_SAMPLE_RATE), '-ac', '1'];
// Leading and trailing silence off a synthesized turn: silenceremove on the start, then
// the same on the reversed audio for the end. 50 ms of the silence is kept at each edge.
const TRIM_SILENCE =
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,' +
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse';

/**
 * A synthesized turn (raw PCM) trimmed of silence at both ends and, when `tempo` > 1,
 * sped up without changing pitch (atempo). Raw PCM out, so its byte count is its length.
 */
export function fitTurnArgs({ input, output, tempo, trim = true }: { input: string; output: string; tempo: number; trim?: boolean }): string[] {
  const filters = [...(trim ? [TRIM_SILENCE] : []), ...(tempo > 1.0005 ? [`atempo=${tempo.toFixed(3)}`] : [])];
  return ['-y', ...PCM_INPUT, '-i', input, ...(filters.length ? ['-af', filters.join(',')] : []), ...PCM_INPUT, output];
}

export async function fitTurn(opts: Parameters<typeof fitTurnArgs>[0]): Promise<void> {
  await runFfmpeg(fitTurnArgs(opts));
}

/** EBU R128 integrated loudness of `input`: the ffmpeg arguments and the parsed result. */
export function loudnessArgs(input: string, rawPcm = false): string[] {
  return ['-hide_banner', '-nostats', ...(rawPcm ? PCM_INPUT : []), '-i', input, '-vn', '-af', 'ebur128', '-f', 'null', '-'];
}

/**
 * The integrated loudness (LUFS) from ebur128's summary, or null for audio too quiet to
 * gate (silence reads as -70 LUFS), where matching to it would mean a huge gain.
 */
export function parseIntegratedLoudness(log: string): number | null {
  const summary = log.slice(log.lastIndexOf('Summary:'));
  const match = /I:\s+(-?[\d.]+) LUFS/.exec(summary);
  const lufs = match ? Number(match[1]) : NaN;
  return Number.isFinite(lufs) && lufs > -60 ? lufs : null;
}

export async function measureLoudness(input: string, rawPcm = false): Promise<number | null> {
  const { stderr } = await runBinary('ffmpeg', loudnessArgs(input, rawPcm));
  return parseIntegratedLoudness(stderr);
}

// The finished track: 44.1 kHz stereo when there is a background to keep, peaks held
// just under full scale. alimiter's own auto-levelling is off (level=false): it would
// otherwise raise the whole mix and undo the loudness match.
const LIMITER = 'alimiter=limit=0.891:level=false';
// Loudness matching moves the dub by at most this much either way; a bigger gap means
// one of the two readings is off, and a sane mix beats an exact match.
const MAX_GAIN_DB = 20;

/**
 * The finished dubbed track: the assembled speech (raw PCM) at `gainDb`, over the
 * background stem when there is one (amix without normalisation, so neither is ducked),
 * limited, cut to the source's length, and encoded as MP3.
 */
export function mixArgs({
  speech,
  background,
  gainDb,
  totalSeconds,
  output,
}: {
  speech: string;
  background?: string | null;
  gainDb: number;
  totalSeconds: number;
  output: string;
}): string[] {
  const gain = `volume=${Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, gainDb)).toFixed(2)}dB`;
  const encode = ['-t', totalSeconds.toFixed(3), '-c:a', 'libmp3lame', '-q:a', '2', output];
  if (!background) {
    return ['-y', ...PCM_INPUT, '-i', speech, '-af', `${gain},${LIMITER}`, ...encode];
  }
  return [
    '-y', ...PCM_INPUT, '-i', speech, '-i', background,
    '-filter_complex',
    `[0:a]aresample=44100,${gain},aformat=channel_layouts=stereo[speech];` +
      `[1:a]aresample=44100,aformat=channel_layouts=stereo[bed];` +
      `[speech][bed]amix=inputs=2:duration=longest:normalize=0,${LIMITER}[out]`,
    '-map', '[out]', '-ar', '44100', ...encode,
  ];
}

export async function mixDub(opts: Parameters<typeof mixArgs>[0]): Promise<void> {
  await runFfmpeg(mixArgs(opts));
}

/** The assembled raw track as the MP3 every dubbed track is stored as. */
export async function dubPcmToMp3(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(['-y', ...PCM_INPUT, '-i', inputPath, '-c:a', 'libmp3lame', '-q:a', '2', outputPath]);
}

/** Any audio or video file's sound as MP3 (ElevenLabs may hand back either). */
export async function toMp3(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(['-y', '-i', inputPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', outputPath]);
}

/** Join WAV clips end to end into one 16-bit WAV (a speaker's voice sample). */
export async function concatWavs(inputPaths: string[], listPath: string, outputPath: string): Promise<void> {
  await fs.writeFile(listPath, concatList(inputPaths));
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'pcm_s16le', outputPath]);
}

/** concat-demuxer syntax: forward slashes, and a quote inside a quoted path is '\''. */
export function concatList(inputPaths: string[]): string {
  return inputPaths.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
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

/**
 * Channel count of a headerless 16-bit PCM file of known length: its bytes against what
 * one channel of that length takes. Stems come back as mono or stereo; anything that is
 * neither reads as the nearer of the two.
 */
export function rawChannelsFor(bytes: number, seconds: number, sampleRate = 44100): 1 | 2 {
  const perChannel = seconds * sampleRate * 2;
  if (perChannel <= 0) return 1;
  return bytes / perChannel >= 1.5 ? 2 : 1;
}

export async function rawChannels(file: string, seconds: number, sampleRate = 44100): Promise<1 | 2> {
  return rawChannelsFor((await fs.stat(file)).size, seconds, sampleRate);
}

/** Cut a dubbed turn's raw PCM to at most `seconds`, on a whole sample. */
export async function truncatePcm(file: string, seconds: number): Promise<void> {
  const bytes = Math.floor((Math.max(0, seconds) * DUB_PCM_BYTES_PER_SECOND) / 2) * 2;
  if ((await fs.stat(file)).size > bytes) await fs.truncate(file, bytes);
}
