// Fitting Cypher's dubbed turns back into the time their lines had in the source.
//
// A translation rarely takes as long to say as the original. Each synthesized turn is
// trimmed of silence and measured, then, in order: sped up (atempo, up to
// CYPHER_MAX_TEMPO), shortened by Gemini and spoken again if it still overruns by more
// than SHORTEN_THRESHOLD_SECONDS, and whatever overrun remains is left to
// placeOnTimeline, which pushes the next turn back and re-anchors once there is room.
// The last turns are compressed so the dub never runs past the end of the source.
// Everything here is pure: the processor runs ffmpeg and the TTS calls.

export const DEFAULT_MAX_TEMPO = 1.15;
// Past this, speech sounds rushed whatever the language; an env value is clamped to it.
const HARD_MAX_TEMPO = 1.5;
/** Overrun (after the tempo cap) worth one Gemini rewrite and a second synthesis. */
export const SHORTEN_THRESHOLD_SECONDS = 0.3;
/** A clip this many times longer than its text should take has run away (hallucinated). */
export const RUNAWAY_FACTOR = 2.5;
/** How far a runaway clip may spill past its slot once it is cut down. */
export const RUNAWAY_SPILL_SECONDS = 0.5;

/** CYPHER_MAX_TEMPO, clamped to [1, 1.5]; the default when unset or not a number. */
export function maxTempoFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.CYPHER_MAX_TEMPO);
  if (!env.CYPHER_MAX_TEMPO || !Number.isFinite(value)) return DEFAULT_MAX_TEMPO;
  return Math.min(HARD_MAX_TEMPO, Math.max(1, value));
}

// Rough seconds per character at a natural pace, by script. Han and kana are a syllable
// each; Hangul a syllable block; everything else counts letters. Only used to tell a
// runaway clip from a long one, so it errs generous.
const SECONDS_PER_CHAR: [RegExp, number][] = [
  [/\p{Script=Han}/u, 0.22],
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, 0.14],
  [/\p{Script=Hangul}/u, 0.17],
  [/[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u, 0.09],
];
const SECONDS_PER_OTHER_CHAR = 0.07;

/** About how long `text` takes to say at a natural pace, in seconds. */
export function expectedSpeechSeconds(text: string): number {
  let seconds = 0.3;
  for (const char of text) {
    if (/\s|\p{P}/u.test(char)) continue;
    seconds += SECONDS_PER_CHAR.find(([pattern]) => pattern.test(char))?.[1] ?? SECONDS_PER_OTHER_CHAR;
  }
  return seconds;
}

/** True when a clip is far longer than its text could take: the model kept talking. */
export function isRunaway(rawSeconds: number, text: string): boolean {
  return rawSeconds > RUNAWAY_FACTOR * expectedSpeechSeconds(text) + 1;
}

export interface FitPlan {
  /** Speed-up to apply with atempo; 1 means none. */
  tempo: number;
  /** Ask Gemini for a shorter line and synthesize it again. */
  shorten: boolean;
  /** What the shorter line should take at a natural pace, when `shorten`. */
  targetSeconds?: number;
}

/**
 * What to do with a turn that takes `rawSeconds` (silence trimmed) and has
 * `availableSeconds` before the next one: nothing, a speed-up within the cap, or one
 * shortening (only if the turn has not been shortened already) when even the cap leaves
 * more than SHORTEN_THRESHOLD_SECONDS over. Otherwise the capped speed-up, and the rest
 * spills into the gap after it.
 */
export function planFit({
  rawSeconds,
  availableSeconds,
  maxTempo,
  shortened,
}: {
  rawSeconds: number;
  availableSeconds: number;
  maxTempo: number;
  shortened: boolean;
}): FitPlan {
  if (rawSeconds <= availableSeconds || availableSeconds <= 0) return { tempo: 1, shorten: false };
  const needed = rawSeconds / availableSeconds;
  if (needed <= maxTempo) return { tempo: roundTempo(needed), shorten: false };
  const overrun = rawSeconds / maxTempo - availableSeconds;
  if (!shortened && overrun > SHORTEN_THRESHOLD_SECONDS) {
    return { tempo: 1, shorten: true, targetSeconds: Math.max(0.5, availableSeconds) };
  }
  return { tempo: maxTempo, shorten: false };
}

/** Tempo to 3 decimals, rounded up so the result never lands a hair over its slot. */
function roundTempo(tempo: number): number {
  return Math.ceil(tempo * 1000) / 1000;
}

export interface TailFit {
  /** Extra speed-up per clip on top of its own tempo (1 for most). */
  factors: number[];
  /** Where each clip starts once the tail is compressed. */
  offsets: number[];
  /** Cut the finished track here when compressing was not enough; null when it fits. */
  truncateAt: number | null;
}

/**
 * Keep the dub inside the source: if the placed clips would end after `totalSeconds`,
 * speed up the last clips (latest first, each up to `maxTempo` counting the tempo it
 * already has) until they fit, and if even that is not enough, say where to cut.
 * Clips in a gap do not help, so the walk goes back only as far as it pays off.
 */
export function compressTail(
  clips: { start: number; duration: number; tempo: number }[],
  totalSeconds: number,
  maxTempo: number,
): TailFit {
  const factors = clips.map(() => 1);
  const place = () => placeClips(clips.map((c, i) => ({ start: c.start, duration: c.duration / factors[i] })));
  let offsets = place();
  const endOf = (os: number[]) => (clips.length ? os[os.length - 1] + clips[clips.length - 1].duration / factors[clips.length - 1] : 0);

  for (let i = clips.length - 1; i >= 0 && endOf(offsets) > totalSeconds + 1e-6; i--) {
    const room = maxTempo / Math.max(1, clips[i].tempo);
    if (room <= 1) continue;
    // Just enough for this clip to absorb the overrun, within its room.
    const overrun = endOf(offsets) - totalSeconds;
    const current = clips[i].duration / factors[i];
    const wanted = current / Math.max(0.05, current - overrun);
    factors[i] = roundTempo(Math.min(room, Math.max(1, wanted)));
    offsets = place();
  }

  const end = endOf(offsets);
  return { factors, offsets, truncateAt: end > totalSeconds + 1e-6 ? totalSeconds : null };
}

/** Same rule as placeOnTimeline: original time, or straight after the clip before. */
function placeClips(clips: { start: number; duration: number }[]): number[] {
  let cursor = 0;
  return clips.map(({ start, duration }) => {
    const at = Math.max(start, cursor);
    cursor = at + duration;
    return at;
  });
}
