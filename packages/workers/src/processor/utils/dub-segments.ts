// A turn is the unit a dub resumes from: each one is one TTS call, stored as it
// finishes. 300 characters is the chunk the Modal app splits text into itself, so a turn
// is never glued together from several sentences with no pause between them, and it is
// short enough to be fitted into the time its line had in the source. The Cypher TTS v2
// service refuses anything longer (services/cypher-tts), so the two must move together.
export const TURN_MAX_CHARS = 300;

// Latin/Devanagari/Arabic sentence ends are followed by a space; CJK ones are not.
const SENTENCE_BREAK = /(?<=[.!?।؟۔])\s+|(?<=[。！？])/;
// Where to break a sentence that is too long on its own, best first: a space, then a
// clause mark (CJK has no spaces, Thai separates clauses with them).
const SOFT_BREAKS = [' ', '，', '、', '；', '：', ',', ';', ':'];

/**
 * Split a translation into segments of whole sentences, each at most `maxChars`.
 * Deterministic: the same text always yields the same segments, which is what lets a
 * resumed dub trust the segment numbers it saved last time.
 */
export function splitIntoSegments(text: string, maxChars: number = TURN_MAX_CHARS): string[] {
  const sentences = text
    .trim()
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => (s.length > maxChars ? hardSplit(s, maxChars) : [s]));

  const segments: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const joined = current ? `${current} ${sentence}` : sentence;
    if (joined.length <= maxChars) {
      current = joined;
    } else {
      segments.push(current);
      current = sentence;
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * A sentence longer than a segment: break at a space, else after a clause mark (for
 * unspaced scripts), else anywhere.
 */
function hardSplit(sentence: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > maxChars) {
    let cut = -1;
    for (const mark of SOFT_BREAKS) {
      const at = rest.lastIndexOf(mark, maxChars - (mark === ' ' ? 0 : 1));
      if (at > 0) {
        cut = mark === ' ' ? at : at + 1;
        break;
      }
    }
    if (cut <= 0) cut = maxChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/** One stretch of speech from the speaker analysis, in seconds from the start of the source. */
export interface Utterance {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

/** A stretch of the source with sound in it, between two pauses. */
export interface Span {
  start: number;
  end: number;
}

const MIN_SPEECH_SECONDS = 0.15;

/**
 * Turn ffmpeg's silencedetect log into the stretches of speech between the silences.
 * Shorter than MIN_SPEECH_SECONDS is a click, not speech.
 */
export function speechFromSilenceLog(log: string, totalSeconds: number): Span[] {
  const silences: Span[] = [];
  let open: number | null = null;
  for (const line of log.split(/\r?\n/)) {
    const start = /silence_start: (-?[\d.]+)/.exec(line);
    const end = /silence_end: ([\d.]+)/.exec(line);
    if (start) open = Math.max(0, Number(start[1]));
    if (end) {
      silences.push({ start: open ?? 0, end: Number(end[1]) });
      open = null;
    }
  }
  // A silence still open at the end of the file runs to its end.
  if (open !== null) silences.push({ start: open, end: totalSeconds });

  const speech: Span[] = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start - cursor >= MIN_SPEECH_SECONDS) speech.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (totalSeconds - cursor >= MIN_SPEECH_SECONDS) speech.push({ start: cursor, end: totalSeconds });
  return speech;
}

/**
 * Cut the source into analysis windows of about `targetSeconds`, each boundary moved to
 * the longest pause within `slackSeconds` of where it would fall, so no word is split
 * between two windows.
 */
export function planWindows(speech: Span[], totalSeconds: number, targetSeconds: number, slackSeconds = 60): Span[] {
  const pauses = speech.slice(1).map((s, i) => ({ at: (speech[i].end + s.start) / 2, length: s.start - speech[i].end }));
  const windows: Span[] = [];
  let cursor = 0;
  while (totalSeconds - cursor > targetSeconds + slackSeconds) {
    const ideal = cursor + targetSeconds;
    const nearby = pauses.filter((p) => Math.abs(p.at - ideal) <= slackSeconds);
    const boundary = nearby.length ? nearby.reduce((a, b) => (b.length > a.length ? b : a)).at : ideal;
    windows.push({ start: cursor, end: boundary });
    cursor = boundary;
  }
  windows.push({ start: cursor, end: totalSeconds });
  return windows;
}

/** One line of the transcript, before it has a place on the timeline. */
export interface Line {
  speaker: string;
  text: string;
}

/**
 * Give each transcript line its real place on the timeline.
 *
 * Gemini is reliable about who said what, in order, but its timestamps drift (tens of
 * seconds over a few minutes), so timing comes from the audio instead. Consecutive lines
 * of one speaker are taken as one turn, and the stretches of speech are split into
 * consecutive groups, one per turn, choosing the split whose group lengths best match each
 * turn's share of the text. Every turn boundary then sits on a real pause, which is where
 * speakers change. Within a turn, its sentences are spread over the turn's own speech by
 * their share of the text. With fewer pauses than turns (fast back-and-forth, or music
 * under the speech), every line is spread over the whole speech time that way instead.
 */
export function alignToSpeech(lines: Line[], speech: Span[]): Utterance[] {
  if (!lines.length || !speech.length) return [];

  const turns: Line[][] = [];
  for (const line of lines) {
    const last = turns[turns.length - 1];
    if (last && last[0].speaker === line.speaker) last.push(line);
    else turns.push([line]);
  }
  if (turns.length > speech.length) return spreadOverSpeech(lines, speech);

  const groups = partitionSpeech(turns.map((t) => textWeight(t)), speech);
  return turns.flatMap((turn, i) => spreadOverSpeech(turn, speech.slice(groups[i][0], groups[i][1])));
}

function textWeight(lines: Line[]): number {
  return lines.reduce((sum, l) => sum + Math.max(1, l.text.length), 0);
}

/**
 * Split the spans into `weights.length` consecutive non-empty groups whose shares of the
 * speech time best match the weights' shares (least squares). Returns [from, to) per group.
 *
 * ponytail: O(turns x spans^2) dynamic programme. A 10-minute window is a few hundred of
 * each, well under a second; windows are what keep it that size.
 */
function partitionSpeech(weights: number[], spans: Span[]): [number, number][] {
  const n = weights.length;
  const m = spans.length;
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const prefix = [0];
  for (const s of spans) prefix.push(prefix[prefix.length - 1] + (s.end - s.start));
  const totalSpeech = prefix[m];

  // best[i][j]: lowest cost of giving the first i groups the first j spans.
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  const choice: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  best[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    const want = weights[i - 1] / totalWeight;
    // Group i takes spans [k, j); every group needs at least one span, and so must the rest.
    for (let j = i; j <= m - (n - i); j++) {
      for (let k = i - 1; k < j; k++) {
        if (best[i - 1][k] === Infinity) continue;
        const cost = best[i - 1][k] + ((prefix[j] - prefix[k]) / totalSpeech - want) ** 2;
        if (cost < best[i][j]) {
          best[i][j] = cost;
          choice[i][j] = k;
        }
      }
    }
  }

  const groups: [number, number][] = new Array(n);
  let j = m;
  for (let i = n; i >= 1; i--) {
    const k = choice[i][j];
    groups[i - 1] = [k, j];
    j = k;
  }
  return groups;
}

/** Place each line along the speech time of `spans` by its share of the text. */
function spreadOverSpeech(lines: Line[], spans: Span[]): Utterance[] {
  const totalSpeech = spans.reduce((sum, s) => sum + (s.end - s.start), 0);
  const totalWeight = textWeight(lines);
  // A line that begins exactly where one stretch ends begins at the next one, not in the
  // pause between them; a line that ends there ends with the first.
  const at = (speechOffset: number, isStart: boolean) => {
    let left = speechOffset;
    for (const [i, s] of spans.entries()) {
      const d = s.end - s.start;
      const inside = isStart && i < spans.length - 1 ? left < d - 1e-9 : left <= d + 1e-9;
      if (inside) return s.start + Math.min(Math.max(left, 0), d);
      left -= d;
    }
    return spans[spans.length - 1].end;
  };
  let done = 0;
  return lines.map((line) => {
    const start = at((done / totalWeight) * totalSpeech, true);
    done += Math.max(1, line.text.length);
    return { ...line, start, end: at((done / totalWeight) * totalSpeech, false) };
  });
}

/**
 * What one TTS call speaks: one speaker, placed at `start` on the source timeline.
 * `end` is where its source lines end, and `available` the time it has before the next
 * turn starts (or the source ends): what a fitted turn must fit in. `lines` are the
 * utterance indices it speaks.
 */
export interface Turn {
  speaker: string;
  start: number;
  end: number;
  available: number;
  text: string;
  lines: number[];
}

// Lines by the same speaker this close together are spoken in one call; a longer pause
// keeps its own placement so the silence survives into the dub.
export const TURN_MAX_GAP_SECONDS = 1.5;
// No turn is given less than this, even when the next speaker cuts in.
const MIN_AVAILABLE_SECONDS = 0.3;

/**
 * Group translated lines into turns. Consecutive lines from one speaker become one TTS
 * call (fewer calls, more natural delivery), capped at `maxChars`; a change of speaker or
 * a pause over TURN_MAX_GAP_SECONDS starts a new turn. A line longer than a turn is split
 * at sentence and clause breaks, each piece given its share of the line's time. Lines
 * with no translation are skipped. Deterministic, so a resumed dub can trust the turn
 * numbers it stored.
 */
export function buildTurns(
  utterances: Utterance[],
  translation: string[],
  totalSeconds: number,
  maxChars: number = TURN_MAX_CHARS,
): Turn[] {
  const merged: Omit<Turn, 'available'>[] = [];
  utterances.forEach((u, i) => {
    const text = (translation[i] ?? '').trim();
    if (!text) return;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.speaker === u.speaker &&
      u.start - last.end <= TURN_MAX_GAP_SECONDS &&
      last.text.length + 1 + text.length <= maxChars
    ) {
      last.text = `${last.text} ${text}`;
      last.end = Math.max(last.end, u.end);
      last.lines.push(i);
      return;
    }
    merged.push({ speaker: u.speaker, start: u.start, end: u.end, text, lines: [i] });
  });

  const pieces = merged.flatMap((turn) => {
    if (turn.text.length <= maxChars) return [turn];
    const parts = splitIntoSegments(turn.text, maxChars);
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const span = Math.max(0, turn.end - turn.start);
    let done = 0;
    return parts.map((text) => {
      const start = turn.start + (span * done) / total;
      done += text.length;
      return { ...turn, text, start, end: turn.start + (span * done) / total };
    });
  });

  return pieces.map((turn, i) => ({
    ...turn,
    available: Math.max(MIN_AVAILABLE_SECONDS, (pieces[i + 1]?.start ?? Math.max(totalSeconds, turn.end)) - turn.start),
  }));
}

/**
 * Where each dubbed clip starts in the finished track: at its original time when it can,
 * otherwise straight after the clip before it, so a translation that runs long pushes the
 * next line later instead of talking over it.
 */
export function placeOnTimeline(clips: { start: number; duration: number }[]): number[] {
  let cursor = 0;
  return clips.map(({ start, duration }) => {
    const at = Math.max(start, cursor);
    cursor = at + duration;
    return at;
  });
}

// Trimmed off both ends of a line so the cut does not catch the next speaker.
const REFERENCE_EDGE_SECONDS = 0.15;
const REFERENCE_MIN_LINE_SECONDS = 1;
// A line that starts or ends this close to someone else's is likely to overlap it.
const REFERENCE_OVERLAP_GUARD_SECONDS = 0.3;

/** One speaker's lines that are safe to clone from: long enough, and clear of everyone else. */
function cleanSpeech(utterances: Utterance[]): { speaker: string; start: number; duration: number }[] {
  return utterances
    .filter((u) =>
      !utterances.some(
        (v) =>
          v.speaker !== u.speaker &&
          v.start < u.end + REFERENCE_OVERLAP_GUARD_SECONDS &&
          v.end > u.start - REFERENCE_OVERLAP_GUARD_SECONDS,
      ),
    )
    .map((u) => ({ speaker: u.speaker, start: u.start + REFERENCE_EDGE_SECONDS, duration: u.end - u.start - 2 * REFERENCE_EDGE_SECONDS }))
    .filter((l) => l.duration >= REFERENCE_MIN_LINE_SECONDS);
}

/**
 * The stretches of one speaker's own speech to clone their voice from: their longest
 * clean lines, trimmed at the edges, until about `targetSeconds` of audio. Returned BEST
 * FIRST, not in time order: Chatterbox builds its prompt from the first 6 to 10 seconds
 * of the sample and only averages the rest into the speaker embedding, so the longest
 * clean line has to lead. Lines near another speaker's are left out (likely overlap).
 */
export function pickReferenceLines(
  utterances: Utterance[],
  speaker: string,
  targetSeconds = 45,
): { start: number; duration: number }[] {
  const lines = cleanSpeech(utterances)
    .filter((l) => l.speaker === speaker)
    .sort((a, b) => b.duration - a.duration || a.start - b.start);

  const picked: { start: number; duration: number }[] = [];
  let total = 0;
  for (const { start, duration } of lines) {
    if (total >= targetSeconds) break;
    picked.push({ start, duration });
    total += duration;
  }
  return picked;
}

/**
 * Whose voice each speaker is dubbed in. A speaker with enough clean speech keeps their
 * own; one with less than `minSeconds` (a one-word interjection, a misattributed cough,
 * someone who only ever talks over others) borrows the voice of whoever speaks the most,
 * since a clone from a second of audio sounds like no one. Returns null when nobody has
 * enough speech to clone.
 */
export function assignVoices(utterances: Utterance[], minSeconds = 3): Record<string, string> | null {
  const speech = new Map<string, number>();
  for (const line of cleanSpeech(utterances)) {
    speech.set(line.speaker, (speech.get(line.speaker) ?? 0) + line.duration);
  }
  const speakers = [...new Set(utterances.map((u) => u.speaker))];
  const ranked = [...speech.entries()].sort((a, b) => b[1] - a[1]);
  const dominant = ranked[0]?.[1] >= minSeconds ? ranked[0][0] : null;
  if (!dominant) return null;

  return Object.fromEntries(
    speakers.map((s) => [s, (speech.get(s) ?? 0) >= minSeconds ? s : dominant]),
  );
}

/**
 * Cypher's timeline: every line with its source time, its translation, and where its
 * dub actually plays. A turn speaks several lines, so its placed span is shared out
 * among them by their share of its text; a line split over several turns runs from the
 * first piece's start to the last one's end. A line with no translation has no dub time.
 */
export function cypherTimeline(
  utterances: Utterance[],
  translation: string[],
  turns: Pick<Turn, 'lines'>[],
  placed: { start: number; end: number }[],
): { id: string; speaker: string; start: number; end: number; sourceText: string; translation: string | null; dubStart?: number; dubEnd?: number }[] {
  const dubbed = new Map<number, { start: number; end: number }>();
  turns.forEach((turn, t) => {
    const span = placed[t];
    if (!span) return;
    const weights = turn.lines.map((i) => Math.max(1, (translation[i] ?? '').trim().length));
    const total = weights.reduce((a, b) => a + b, 0);
    let done = 0;
    turn.lines.forEach((i, k) => {
      const start = span.start + ((span.end - span.start) * done) / total;
      done += weights[k];
      const end = turn.lines.length === 1 ? span.end : span.start + ((span.end - span.start) * done) / total;
      const seen = dubbed.get(i);
      dubbed.set(i, seen ? { start: Math.min(seen.start, start), end: Math.max(seen.end, end) } : { start, end });
    });
  });
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return utterances.map((u, i) => {
    const text = (translation[i] ?? '').trim();
    const dub = dubbed.get(i);
    return {
      id: String(i),
      speaker: u.speaker,
      start: round(u.start),
      end: round(u.end),
      sourceText: u.text,
      translation: text || null,
      ...(dub ? { dubStart: round(dub.start), dubEnd: round(dub.end) } : {}),
    };
  });
}
