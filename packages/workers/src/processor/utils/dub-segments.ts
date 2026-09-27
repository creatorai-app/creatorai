// A segment is the unit a dub resumes from: each one is one Modal call, stored as it
// finishes. ~1500 chars is a couple of minutes of speech, small enough that a retry
// loses little and well inside Modal's per-request timeout.
export const DUB_SEGMENT_MAX_CHARS = 1500;

// Latin/Devanagari/Arabic sentence ends are followed by a space; CJK ones are not.
const SENTENCE_BREAK = /(?<=[.!?।؟۔])\s+|(?<=[。！？])/;

/**
 * Split a translation into segments of whole sentences, each at most `maxChars`.
 * Deterministic: the same text always yields the same segments, which is what lets a
 * resumed dub trust the segment numbers it saved last time.
 */
export function splitIntoSegments(text: string, maxChars: number = DUB_SEGMENT_MAX_CHARS): string[] {
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

/** A sentence longer than a segment: break on spaces, or anywhere for unspaced scripts. */
function hardSplit(sentence: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > maxChars) {
    const space = rest.lastIndexOf(' ', maxChars);
    const cut = space > 0 ? space : maxChars;
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

/** What one Modal call speaks: one speaker, placed at `start` on the source timeline. */
export interface Turn {
  speaker: string;
  start: number;
  text: string;
}

// Lines by the same speaker this close together are spoken in one call; a longer pause
// keeps its own placement so the silence survives into the dub.
const TURN_MAX_GAP_SECONDS = 1.5;

/**
 * Group translated lines into turns. Consecutive lines from one speaker become one Modal
 * call (fewer calls, more natural delivery), capped at `maxChars`; a change of speaker or
 * a real pause starts a new turn. Lines with no translation are skipped. Deterministic,
 * so a resumed dub can trust the turn numbers it stored.
 */
export function buildTurns(
  utterances: Utterance[],
  translation: string[],
  maxChars: number = DUB_SEGMENT_MAX_CHARS,
): Turn[] {
  const merged: (Turn & { end: number })[] = [];
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
      return;
    }
    merged.push({ speaker: u.speaker, start: u.start, end: u.end, text });
  });

  // A single line longer than a turn: its pieces share the start and are laid back to back.
  return merged.flatMap(({ speaker, start, text }) =>
    text.length > maxChars
      ? splitIntoSegments(text, maxChars).map((piece) => ({ speaker, start, text: piece }))
      : [{ speaker, start, text }],
  );
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

/**
 * The stretches of one speaker's own speech to clone their voice from: their longest
 * lines, trimmed at the edges, until about `targetSeconds` of audio. Returned in time order.
 */
export function pickReferenceLines(
  utterances: Utterance[],
  speaker: string,
  targetSeconds = 45,
): { start: number; duration: number }[] {
  const lines = utterances
    .filter((u) => u.speaker === speaker)
    .map((u) => ({ start: u.start + REFERENCE_EDGE_SECONDS, duration: u.end - u.start - 2 * REFERENCE_EDGE_SECONDS }))
    .filter((l) => l.duration >= REFERENCE_MIN_LINE_SECONDS)
    .sort((a, b) => b.duration - a.duration);

  const picked: { start: number; duration: number }[] = [];
  let total = 0;
  for (const line of lines) {
    if (total >= targetSeconds) break;
    picked.push(line);
    total += line.duration;
  }
  return picked.sort((a, b) => a.start - b.start);
}

/**
 * Whose voice each speaker is dubbed in. A speaker with enough clean speech keeps their
 * own; one with less than `minSeconds` (a one-word interjection, a misattributed cough)
 * borrows the voice of whoever speaks the most, since a clone from a second of audio
 * sounds like no one. Returns null when nobody has enough speech to clone.
 */
export function assignVoices(utterances: Utterance[], minSeconds = 3): Record<string, string> | null {
  const speech = new Map<string, number>();
  for (const line of pickableSpeech(utterances)) {
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

function pickableSpeech(utterances: Utterance[]) {
  return utterances
    .map((u) => ({ speaker: u.speaker, duration: u.end - u.start - 2 * REFERENCE_EDGE_SECONDS }))
    .filter((l) => l.duration >= REFERENCE_MIN_LINE_SECONDS);
}
