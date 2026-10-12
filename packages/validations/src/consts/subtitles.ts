import { supportedLanguages } from './dubbing';

/** Sentinels the UI sends instead of a language code. */
export const SUBTITLE_AUTO_DETECT = 'auto';
export const SUBTITLE_NO_TRANSLATION = 'same';

export const SUBTITLE_CANCEL_PREFIX = 'subtitle:cancel:';

/**
 * The languages Google documents for Gemini transcription, as base codes: the
 * "Supported languages" table on
 * https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe as of 11 Oct 2026,
 * with regional variants collapsed (en-US/en-GB/en-IN are one language to us) and the
 * doc's `cmn`/`nb` spelled the way our label table spells them (`zh`/`no`).
 *
 * Google publishes this table for gemini-3.5-transcribe, not for the general Flash model
 * subtitles currently run on, so treat it as the best-documented proxy rather than a
 * guarantee. It is the reason the subtitle list is shorter than the dubbing one: we only
 * offer a language some vendor doc actually names.
 */
export const SUBTITLE_TRANSCRIBE_LANGUAGES: readonly string[] = [
  'af', 'am', 'ar', 'hy', 'as', 'az', 'be', 'bn', 'bs', 'bg', 'rup', 'my', 'yue', 'ca',
  'ceb', 'km', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fa', 'fil', 'fi', 'fr', 'gl', 'ka',
  'de', 'el', 'gu', 'ha', 'he', 'hi', 'hu', 'is', 'id', 'it', 'ja', 'jv', 'kea', 'kn',
  'kk', 'ko', 'ky', 'lv', 'ln', 'lt', 'mk', 'ms', 'ml', 'mt', 'zh', 'mr', 'mn', 'ne',
  'no', 'or', 'pl', 'pt', 'pa', 'ro', 'ru', 'sr', 'sd', 'sk', 'sl', 'es', 'sw', 'sv',
  'tg', 'te', 'th', 'tr', 'uk', 'uz', 'vi',
];

/**
 * What the subtitle UI offers: the documented languages that also have a label in the
 * shared table. Seven documented codes (rup, km, kea, ln, mt, or, sr) have no label yet
 * and are excluded rather than rendered as a bare code. Public pages quote this count
 * from here, not by hand.
 */
export const subtitleLanguages = supportedLanguages.filter((l) =>
  SUBTITLE_TRANSCRIBE_LANGUAGES.includes(l.value),
);

/** The trust boundary: what the API will accept as a subtitle source language. */
export function isSupportedSubtitleLanguage(code: string): boolean {
  return code === SUBTITLE_AUTO_DETECT || subtitleLanguages.some((l) => l.value === code);
}

/** The trust boundary for the translation target, which may also be "leave it alone". */
export function isSupportedSubtitleTarget(code: string): boolean {
  return code === SUBTITLE_NO_TRANSLATION || subtitleLanguages.some((l) => l.value === code);
}

/**
 * The Gemini `responseJsonSchema` for a subtitle run. Structured output replaces parsing
 * a fenced JSON blob out of free text: a truncated array used to lose the whole run after
 * the tokens were already spent.
 */
export const SUBTITLE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    detected_language: {
      type: 'string',
      description: 'Full English name of the language spoken in the audio, e.g. "Spanish"',
    },
    title: {
      type: 'string',
      description: 'Short descriptive title for the video, max 60 characters',
    },
    subtitles: {
      type: 'array',
      description: 'Time-stamped subtitle lines in playback order',
      items: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'Start time as HH:MM:SS.mmm' },
          end: { type: 'string', description: 'End time as HH:MM:SS.mmm' },
          text: { type: 'string', description: 'The caption text, 5-10 words' },
        },
        required: ['start', 'end', 'text'],
      },
    },
  },
  required: ['detected_language', 'title', 'subtitles'],
} as const;
