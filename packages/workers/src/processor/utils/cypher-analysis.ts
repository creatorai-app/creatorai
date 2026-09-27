import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { extractResponseText, GEMINI_TEXT_MODEL } from './genai';
import type { Line, Span, Utterance } from './dub-segments';

// Cypher's speaker analysis. Chatterbox clones one voice per call and knows nothing about
// who is talking, so before dubbing, Gemini listens to the source and returns who said
// what, in order. It is not asked when: measured against known timings its timestamps
// drift by tens of seconds over a few minutes, so the timing comes from the audio itself
// (see alignToSpeech). The source is analysed in windows cut at pauses, each told the
// speakers heard so far so one person keeps one id across the whole recording.

export const ANALYSIS_WINDOW_SECONDS = 600;
const MAX_OUTPUT_TOKENS = 32_768;
const TRANSLATION_BATCH = 80;
// Translated lines of the previous batch shown to the next one, so a batch boundary does
// not reset names, register or who "he" is.
const TRANSLATION_CONTEXT_LINES = 5;

/**
 * What an analysis has been through. 1: speech map, windows, Gemini's speakers and lines
 * placed on pauses. 2 adds the stem separation and forced alignment stages. A stored
 * analysis below the current version runs only the stages it lacks: the Gemini windows
 * it already paid for are kept.
 */
export const ANALYSIS_VERSION = 2;

export interface Speaker {
  id: string;
  description: string;
  /** Set when this speaker is dubbed in another speaker's voice (too little speech to clone). */
  voiceOf?: string | null;
}

/**
 * The source split into its voices and everything else (ElevenLabs stem separation), done
 * window by window. `vocals` and `background` are object names in the dubbing bucket once
 * every window is in. `failed` and `skipped` mean Cypher runs on the mixed audio, as it
 * did before stems existed.
 */
export interface StemsState {
  status: 'running' | 'done' | 'failed' | 'skipped';
  windowsDone: number;
  format?: string | null;
  vocals?: string | null;
  background?: string | null;
  reason?: string | null;
}

/** Word-level timing per window: forced alignment where it held up, pauses otherwise. */
export interface AlignmentState {
  windowsDone: number;
  windows: { timingSource: 'forced_alignment' | 'pauses'; loss?: number | null; reason?: string | null }[];
}

/** Stored on dubbing_projects.analysis and extended window by window, stage by stage. */
export interface SourceAnalysis {
  /** Missing on analyses stored before versioning: those are version 1. */
  version?: number;
  speakers: Speaker[];
  utterances: Utterance[];
  /** Where the source has sound, from ffmpeg's silence detector. The analysis's clock. */
  speech: Span[];
  /** What `speech` was detected on: the vocal stem when there is one. */
  speechSource?: 'vocals' | 'mix';
  windows: Span[];
  windowsDone: number;
  complete: boolean;
  stems?: StemsState | null;
  alignment?: AlignmentState | null;
  /** Integrated loudness the dubbed speech is matched to, and what it was measured on. */
  loudness?: { lufs: number | null; measuredOn: 'vocals' | 'mix' } | null;
}

export function analysisVersion(analysis: SourceAnalysis | null | undefined): number {
  return analysis?.version ?? 1;
}

const WINDOW_SCHEMA = {
  type: 'object',
  properties: {
    speakers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, description: { type: 'string' } },
        required: ['id', 'description'],
      },
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: { speaker: { type: 'string' }, text: { type: 'string' } },
        required: ['speaker', 'text'],
      },
    },
  },
  required: ['speakers', 'lines'],
};

const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: { lines: { type: 'array', items: { type: 'string' } } },
  required: ['lines'],
};

async function generateJson<T>(genAI: GoogleGenAI, parts: any[], schema: object, what: string): Promise<T> {
  const result = await genAI.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
      temperature: 0,
      // Transcription and translation, not reasoning: left to itself a 3.x model spends
      // the output budget thinking and returns thought parts with no answer.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: false },
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });
  const extracted = extractResponseText(result);
  if (extracted.text === null) throw new Error(`Gemini returned no ${what}: ${extracted.reason}.`);
  return JSON.parse(extracted.text) as T;
}

/** Who says what, in order, in one window of the source. */
export async function analyzeWindow(
  genAI: GoogleGenAI,
  gsUri: string,
  mimeType: string,
  knownSpeakers: Speaker[],
  sourceLanguageLabel?: string | null,
): Promise<{ speakers: Speaker[]; lines: Line[] }> {
  const language = sourceLanguageLabel ? `\n\nThe recording is in ${sourceLanguageLabel}.` : '';
  const roster = knownSpeakers.length
    ? `Speakers heard earlier in the recording. Reuse these ids whenever the same person speaks again:\n${knownSpeakers
        .map((s) => `${s.id}: ${s.description}`)
        .join('\n')}`
    : 'No speakers have been heard yet.';

  const prompt = `This audio is one part of a recording that will be dubbed into another language, with each person re-voiced separately. Transcribe it and say who is speaking.${language}

${roster}

Return:
- speakers: every person who speaks in THIS part. Reuse a known id when it is the same voice. Give a new person the next unused id (S1, S2, S3, ...). description: a short note that tells the voice apart, for example "adult man, deep voice, host".
- lines: everything said, in order, from the start of this part to its very end. speaker is the id; text is exactly what was said, in the original language. Start a new line whenever the speaker changes and at every sentence end. Leave out music and noise.`;

  const result = await generateJson<{ speakers?: Speaker[]; lines?: Line[] }>(
    genAI,
    [{ text: prompt }, { fileData: { fileUri: gsUri, mimeType } }],
    WINDOW_SCHEMA,
    'speaker analysis',
  );
  return { speakers: result.speakers ?? [], lines: result.lines ?? [] };
}

/** Clean one window's lines: trimmed, no empty text, no missing speaker. */
export function cleanLines(lines: Line[]): Line[] {
  return lines
    .map((l) => ({ speaker: l.speaker?.trim() ?? '', text: l.text?.trim() ?? '' }))
    .filter((l) => l.speaker && l.text);
}

/**
 * Fold one window's result into the running analysis: new speakers are added (including
 * any that only appear on a line), and the window's placed lines appended in time order.
 */
export function mergeWindow(
  analysis: SourceAnalysis,
  speakers: Speaker[],
  utterances: Utterance[],
): SourceAnalysis {
  const all = [...analysis.speakers];
  const known = new Set(all.map((s) => s.id));
  const addSpeaker = (id: string, description = '') => {
    if (!id || known.has(id)) return;
    known.add(id);
    all.push({ id, description });
  };
  for (const s of speakers) addSpeaker(s.id?.trim(), s.description?.trim() ?? '');
  for (const u of utterances) addSpeaker(u.speaker);

  return {
    ...analysis,
    speakers: all,
    utterances: [...analysis.utterances, ...utterances].sort((a, b) => a.start - b.start),
  };
}

/** One line to translate: what was said, by whom, and how long it took to say. */
export interface LineToTranslate {
  text: string;
  speaker: string;
  seconds: number;
}

function keytermRule(keyterms: readonly string[]): string {
  return keyterms.length
    ? ` Keep these exactly as written, untranslated: ${keyterms.map((k) => JSON.stringify(k)).join(', ')}.`
    : '';
}

/** The translation prompt for one batch. Exported for the tests. */
export function translationPrompt({
  batch,
  languageLabel,
  keyterms,
  context,
}: {
  batch: LineToTranslate[];
  languageLabel: string;
  keyterms: readonly string[];
  context: { text: string; translation: string }[];
}): string {
  const lines = batch.map((l) => ({ speaker: l.speaker, seconds: Math.round(l.seconds * 10) / 10, text: l.text }));
  const before = context.length
    ? `\nFor context, the lines just before these and how they were translated (do not return them):\n${JSON.stringify(context)}\n`
    : '';
  return `Translate these lines from a recording into ${languageLabel} for dubbing. Each line will be spoken in its speaker's own cloned voice, in the time the original line took.

For every line:
- Make it fit its time: at a natural speaking pace in ${languageLabel} it should take about "seconds" to say. When a literal translation would run long, say the same thing more concisely rather than dropping meaning.
- Keep the meaning and the tone: casual stays casual, a joke stays a joke, a question stays a question.
- Keep names of people, brands, products and places as they are.${keytermRule(keyterms)}
- Never merge or split lines. Return exactly one translated line per input line, in the same order.
${before}
Lines (JSON array of {speaker, seconds, text}):
${JSON.stringify(lines)}`;
}

/**
 * Translate lines for dubbing, batch by batch, one translated line per input line. Each
 * line goes with its speaker and its length in seconds, so the translation can be made
 * to fit; each batch sees the last few lines of the one before. `onBatch` receives the
 * translation so far after every batch so it can be saved; a resumed run passes it back
 * as `done` and only the rest is translated.
 */
export async function translateLines(
  genAI: GoogleGenAI,
  lines: LineToTranslate[],
  languageLabel: string,
  done: string[],
  onBatch: (soFar: string[]) => Promise<void>,
  keyterms: readonly string[] = [],
): Promise<string[]> {
  const out = [...done];
  while (out.length < lines.length) {
    const batch = lines.slice(out.length, out.length + TRANSLATION_BATCH);
    const from = Math.max(0, out.length - TRANSLATION_CONTEXT_LINES);
    const context = out.slice(from).map((translation, i) => ({ text: lines[from + i].text, translation }));
    const prompt = translationPrompt({ batch, languageLabel, keyterms, context });

    let translated: string[] | undefined;
    for (let attempt = 1; attempt <= 2 && translated?.length !== batch.length; attempt++) {
      translated = (await generateJson<{ lines?: string[] }>(genAI, [{ text: prompt }], TRANSLATION_SCHEMA, 'translation')).lines;
    }
    if (translated?.length !== batch.length) {
      throw new Error(`Translation to ${languageLabel} came back with the wrong number of lines. Please retry.`);
    }
    out.push(...translated.map((l) => (typeof l === 'string' ? l.trim() : '')));
    await onBatch(out);
  }
  return out;
}

const SHORTEN_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
};

/**
 * A shorter way to say one dubbed line, for when even the speed-up cap leaves it
 * overrunning its slot. Same language, same meaning, names and keyterms kept. Returns the
 * original when Gemini offers nothing shorter.
 */
export async function shortenLine(
  genAI: GoogleGenAI,
  { text, targetSeconds, languageLabel, keyterms = [] }: { text: string; targetSeconds: number; languageLabel: string; keyterms?: readonly string[] },
): Promise<string> {
  const prompt = `This ${languageLabel} line is dubbed speech and it is too long for its slot. Rewrite it in ${languageLabel} so it takes about ${targetSeconds.toFixed(1)} seconds to say at a natural pace. Keep the meaning and the tone, and keep names of people, brands and products as they are.${keytermRule(keyterms)} Return only the rewritten line.

Line: ${JSON.stringify(text)}`;
  const result = await generateJson<{ text?: string }>(genAI, [{ text: prompt }], SHORTEN_SCHEMA, 'shortened line');
  const shorter = result.text?.trim();
  return shorter && shorter.length < text.length ? shorter : text;
}
