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

export interface Speaker {
  id: string;
  description: string;
  /** Set when this speaker is dubbed in another speaker's voice (too little speech to clone). */
  voiceOf?: string | null;
}

/** Stored on dubbing_projects.analysis and extended window by window. */
export interface SourceAnalysis {
  speakers: Speaker[];
  utterances: Utterance[];
  /** Where the source has sound, from ffmpeg's silence detector. The analysis's clock. */
  speech: Span[];
  windows: Span[];
  windowsDone: number;
  complete: boolean;
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
): Promise<{ speakers: Speaker[]; lines: Line[] }> {
  const roster = knownSpeakers.length
    ? `Speakers heard earlier in the recording. Reuse these ids whenever the same person speaks again:\n${knownSpeakers
        .map((s) => `${s.id}: ${s.description}`)
        .join('\n')}`
    : 'No speakers have been heard yet.';

  const prompt = `This audio is one part of a recording that will be dubbed into another language, with each person re-voiced separately. Transcribe it and say who is speaking.

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

/**
 * Translate lines for dubbing, batch by batch, one translated line per input line.
 * `onBatch` receives the translation so far after every batch so it can be saved; a
 * resumed run passes it back as `done` and only the rest is translated.
 */
export async function translateLines(
  genAI: GoogleGenAI,
  lines: string[],
  languageLabel: string,
  done: string[],
  onBatch: (soFar: string[]) => Promise<void>,
): Promise<string[]> {
  const out = [...done];
  while (out.length < lines.length) {
    const batch = lines.slice(out.length, out.length + TRANSLATION_BATCH);
    const prompt = `Translate these lines from a recording into ${languageLabel} for dubbing. Keep each line's meaning and tone, and keep it about as long to say as the original. Return exactly one translated line per input line, in the same order.

Lines (JSON array):
${JSON.stringify(batch)}`;

    let translated: string[] | undefined;
    for (let attempt = 1; attempt <= 2 && translated?.length !== batch.length; attempt++) {
      translated = (await generateJson<{ lines?: string[] }>(genAI, [{ text: prompt }], TRANSLATION_SCHEMA, 'translation')).lines;
    }
    if (translated?.length !== batch.length) {
      throw new Error(`Translation to ${languageLabel} came back with the wrong number of lines. Please retry.`);
    }
    out.push(...translated.map((l) => l.trim()));
    await onBatch(out);
  }
  return out;
}
