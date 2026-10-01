// Word-level timing for Cypher's lines, from ElevenLabs forced alignment.
//
// alignToSpeech places lines on the pauses in the audio, which is exact at speaker
// changes and approximate inside a turn. Forced alignment instead times every word of
// the transcript against the audio. Each analysis window is aligned on its own: its
// audio (the vocal stem when there is one) and its lines joined by newlines. The words
// come back in order, so they are mapped back to lines by token order; unspaced scripts
// (Chinese, Japanese, Thai and the like) are mapped by character instead.
//
// The result is only used when every line of the window was found in it and the
// overall loss is under CYPHER_ALIGNMENT_MAX_LOSS; otherwise the window keeps its
// pause-based placement.

export interface AlignedUnit {
  text: string;
  start: number;
  end: number;
}

export interface ForcedAlignment {
  words: AlignedUnit[];
  characters: AlignedUnit[];
  loss: number;
}

/**
 * Starting point, to tune from the losses the worker logs. ElevenLabs documents `loss` as
 * the average alignment loss over all characters, lower being better, without a scale.
 */
export const DEFAULT_ALIGNMENT_MAX_LOSS = 1.5;

export function alignmentMaxLossFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.CYPHER_ALIGNMENT_MAX_LOSS);
  return env.CYPHER_ALIGNMENT_MAX_LOSS && Number.isFinite(value) && value > 0 ? value : DEFAULT_ALIGNMENT_MAX_LOSS;
}

const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/** True when a text is mostly in a script written without spaces between words. */
export function isUnspacedText(text: string): boolean {
  const letters = [...text].filter((c) => /[\p{L}\p{N}]/u.test(c));
  if (!letters.length) return false;
  return letters.filter((c) => UNSPACED.test(c)).length / letters.length > 0.3;
}

/** Lowercased, compatibility-folded, letters and digits only: how units are compared. */
function norm(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** A text's comparable units: words for spaced scripts, characters for unspaced ones. */
function textUnits(text: string, byCharacter: boolean): string[] {
  if (byCharacter) return [...norm(text)];
  return text.split(/\s+/).map(norm).filter(Boolean);
}

// How far ahead to look for a unit before calling it a mismatch.
const RESYNC_WINDOW = 5;
// The share of a line's units that must be found for the line to count as mapped.
const MIN_LINE_MATCH = 0.5;

export interface LineMapping {
  /** Per line, in seconds relative to the aligned audio, or null when it was not found. */
  spans: ({ start: number; end: number } | null)[];
  /** Every line with something to say was found. */
  complete: boolean;
}

/**
 * Map an alignment back onto the lines it was made from. Units are matched in order,
 * skipping ahead a little on either side to get past a word the aligner split or merged
 * differently. A line counts as found when at least half its units matched; its span
 * runs from its first matched unit to its last. A line with nothing to say (only
 * punctuation) is given the point where the line before it ended.
 */
export function mapAlignmentToLines(lines: string[], alignment: Pick<ForcedAlignment, 'words' | 'characters'>): LineMapping {
  const byCharacter = isUnspacedText(lines.join(' '));
  const source = byCharacter ? alignment.characters : alignment.words;
  const aligned = (source ?? [])
    .map((u) => ({ key: byCharacter ? [...norm(u.text)] : [norm(u.text)], start: u.start, end: u.end }))
    .flatMap((u) => u.key.filter(Boolean).map((key) => ({ key, start: u.start, end: u.end })));

  const perLine = lines.map((line) => textUnits(line, byCharacter));
  const flat = perLine.flatMap((units, line) => units.map((key) => ({ key, line })));
  const hits: (AlignedUnit | null)[] = flat.map(() => null);

  let i = 0;
  let j = 0;
  while (i < flat.length && j < aligned.length) {
    if (flat[i].key === aligned[j].key) {
      hits[i] = { text: flat[i].key, start: aligned[j].start, end: aligned[j].end };
      i++;
      j++;
      continue;
    }
    const aheadInAlignment = aligned.slice(j + 1, j + 1 + RESYNC_WINDOW).findIndex((u) => u.key === flat[i].key);
    if (aheadInAlignment >= 0) {
      j += aheadInAlignment + 1;
      continue;
    }
    const aheadInText = flat.slice(i + 1, i + 1 + RESYNC_WINDOW).findIndex((u) => u.key === aligned[j].key);
    if (aheadInText >= 0) {
      i += aheadInText + 1;
      continue;
    }
    i++;
    j++;
  }

  let offset = 0;
  let previousEnd = 0;
  let complete = true;
  const spans = perLine.map((units) => {
    const lineHits = hits.slice(offset, offset + units.length).filter((h): h is AlignedUnit => !!h);
    offset += units.length;
    if (!units.length) return { start: previousEnd, end: previousEnd };
    if (lineHits.length < Math.max(1, Math.ceil(units.length * MIN_LINE_MATCH))) {
      complete = false;
      return null;
    }
    const span = { start: lineHits[0].start, end: Math.max(lineHits[0].start, lineHits[lineHits.length - 1].end) };
    previousEnd = span.end;
    return span;
  });
  return { spans, complete };
}
