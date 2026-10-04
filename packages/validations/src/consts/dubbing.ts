
// Dubbing is available on EVERY plan including Starter — the gate is now duration,
// not access (see maxDubSecondsForPlan). Gate by plan NAME: there is no tier column;
// the active plan is the most-recent active `subscriptions` row joined to `plans`
// (mirror canGenerateVideo).
export const DUBBING_PLANS = ['starter', 'creator', 'pro', 'business', 'scale'] as const;

export function canDub(planName?: string | null): boolean {
  if (!planName) return false;
  return DUBBING_PLANS.includes(planName.toLowerCase() as (typeof DUBBING_PLANS)[number]);
}

/**
 * How long, and how large, a source file may be.
 *
 * Paid plans get 3GB and 180 minutes per source file. These were ElevenLabs' own API
 * ceilings and are now ours: a 3-hour clip is a long GPU run on Modal, and refusing it
 * here is strictly cheaper than after the browser has pushed the bytes and the credits
 * are reserved.
 *
 * Starter keeps 500MB / 45 min. That is an outer bound, not the shape of the trial:
 * its 500-credit grant runs out first (~2.8 min at the Starter rate), and initUpload
 * checks the balance before opening the upload, so a Starter user is told the clip
 * is unaffordable before uploading rather than after.
 *
 * Enforced server-side in DubbingService (initUpload + startDub) and re-checked in the
 * worker against ffprobe's reading of the source, because durationSeconds arrives from
 * the browser and cannot be trusted on its own.
 */
export const STARTER_MAX_DUB_SECONDS = 45 * 60;
export const STARTER_MAX_DUB_BYTES = 500 * 1024 * 1024;
export const PAID_MAX_DUB_SECONDS = 180 * 60;
export const PAID_MAX_DUB_BYTES = 3 * 1024 * 1024 * 1024;

// ElevenLabs' dubbing_v1 model (DUBBING_V1_LANGUAGES, below: Bengali only) has a smaller
// ceiling: 1GB / 45 min. A paid user picking Bengali on ElevenLabs is held to this instead.
export const DUBBING_V1_MAX_SECONDS = 45 * 60;
export const DUBBING_V1_MAX_BYTES = 1024 * 1024 * 1024;

/** Missing or unknown plan is treated as Starter, so the caps fail closed. */
function isStarterPlan(planName?: string | null): boolean {
  return !planName || planName.toLowerCase() === 'starter';
}

type TargetLanguages = string | readonly string[] | undefined;

/** Any target on the smaller dubbing_v1 route tightens the whole dub. */
function anyOnDubbingV1(targets: TargetLanguages): boolean {
  if (!targets) return false;
  return (typeof targets === 'string' ? [targets] : targets).some(usesDubbingV1);
}

/**
 * Longest source clip a plan may dub. The dubbing_v1 route's smaller cap only applies on
 * ElevenLabs; Cypher runs its own pipeline for every language it speaks. An unknown
 * engine is treated as ElevenLabs, so the cap fails closed.
 */
export function maxDubSecondsForPlan(
  planName?: string | null,
  targets?: TargetLanguages,
  engine: DubEngine = 'elevenlabs',
): number {
  const cap = isStarterPlan(planName) ? STARTER_MAX_DUB_SECONDS : PAID_MAX_DUB_SECONDS;
  return engine === 'elevenlabs' && anyOnDubbingV1(targets) ? Math.min(cap, DUBBING_V1_MAX_SECONDS) : cap;
}

/** Largest source file a plan may upload, on the same terms as maxDubSecondsForPlan. */
export function maxDubBytesForPlan(
  planName?: string | null,
  targets?: TargetLanguages,
  engine: DubEngine = 'elevenlabs',
): number {
  const cap = isStarterPlan(planName) ? STARTER_MAX_DUB_BYTES : PAID_MAX_DUB_BYTES;
  return engine === 'elevenlabs' && anyOnDubbingV1(targets) ? Math.min(cap, DUBBING_V1_MAX_BYTES) : cap;
}

/** True when `durationSeconds` is within the cap. Unknown plan -> treated as Starter. */
export function isDubDurationAllowed(
  planName: string | null | undefined,
  durationSeconds: number,
  targets?: TargetLanguages,
  engine: DubEngine = 'elevenlabs',
): boolean {
  return durationSeconds <= maxDubSecondsForPlan(planName, targets, engine);
}

/** True when `fileSize` is within the cap. Unknown plan -> treated as Starter. */
export function isDubSizeAllowed(
  planName: string | null | undefined,
  fileSize: number,
  targets?: TargetLanguages,
  engine: DubEngine = 'elevenlabs',
): boolean {
  return fileSize <= maxDubBytesForPlan(planName, targets, engine);
}

/**
 * How many languages one dub may target at once. Each language is its own output and is
 * charged as its own dub; the cap is about how far a single request may fan out.
 */
export function maxDubLanguagesForPlan(planName?: string | null): number {
  const plan = planName?.toLowerCase();
  if (plan === 'business' || plan === 'scale') return 3;
  if (plan === 'creator' || plan === 'pro') return 2;
  return 1;
}

/**
 * The two dubbing pipelines a creator picks between, on every plan.
 *   cypher:     our own pipeline (Gemini + Chatterbox on Modal). Detects the speakers
 *               and clones each one's voice itself.
 *   elevenlabs: the ElevenLabs Dubbing API, which detects speakers on its side.
 */
export const DUB_ENGINES = ['cypher', 'elevenlabs'] as const;
export type DubEngine = (typeof DUB_ENGINES)[number];
export const DEFAULT_DUB_ENGINE: DubEngine = 'cypher';

export const DUB_ENGINE_INFO: Record<DubEngine, { name: string; note?: string; description: string }> = {
  cypher: {
    name: 'Cypher',
    note: 'in-house dubbing',
    description: 'Our own pipeline. Finds every speaker and dubs each one in their own cloned voice.',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'ElevenLabs dubbing. Detects speakers automatically, with more languages and regional dialects.',
  },
};

/** "Cypher (in-house dubbing)" / "ElevenLabs" */
export function dubEngineLabel(engine: DubEngine): string {
  const { name, note } = DUB_ENGINE_INFO[engine];
  return note ? `${name} (${note})` : name;
}

/** "45 min" / "3 hrs" for limit copy. */
export function formatDubDuration(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  }
  return `${Math.round(seconds / 60)} min`;
}

// Redis key prefix for mid-run cancellation (train-ai pattern). The API sets the
// flag; the worker checks it between pipeline stages and aborts.
export const DUBBING_CANCEL_PREFIX = 'dubbing:cancel:';

// A video dub whose dubbed audio is done but whose video never finishes uploading is
// cancelled this long after it started waiting. Well inside the bucket's 7-day abort of
// unfinished uploads, so a retry still finds the parts already sent.
export const DUB_VIDEO_WAIT_HOURS = 24;

/**
 * Every language either engine dubs into, and the label for each: all of them on
 * ElevenLabs, and the 23 Chatterbox speaks on Cypher (see dubbableLanguagesFor).
 *
 * Also the label table for history: a dub recorded under an older backend keeps its row,
 * and the history pages look the code up here. Removing an entry would turn "Tamil" back
 * into "ta" on a dub that already exists.
 *
 * Base codes only. A region (en-GB, es-MX) is a dialect of its language, picked
 * separately (dialectsByLanguage), never a language of its own. Cantonese is the
 * exception ElevenLabs makes: `yue` is its own language on Dubbing v2.
 */
export const supportedLanguages = [
  { value: 'af', label: 'Afrikaans' },
  { value: 'ak', label: 'Akan' },
  { value: 'sq', label: 'Albanian' },
  { value: 'am', label: 'Amharic' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hy', label: 'Armenian' },
  { value: 'as', label: 'Assamese' },
  { value: 'az', label: 'Azerbaijani' },
  { value: 'eu', label: 'Basque' },
  { value: 'be', label: 'Belarusian' },
  { value: 'bn', label: 'Bengali' },
  { value: 'bs', label: 'Bosnian' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'my', label: 'Burmese' },
  { value: 'yue', label: 'Cantonese' },
  { value: 'ca', label: 'Catalan' },
  { value: 'ceb', label: 'Cebuano' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
  { value: 'hr', label: 'Croatian' },
  { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' },
  { value: 'dgo', label: 'Dogri' },
  { value: 'nl', label: 'Dutch' },
  { value: 'en', label: 'English' },
  { value: 'et', label: 'Estonian' },
  { value: 'fil', label: 'Filipino' },
  { value: 'fi', label: 'Finnish' },
  { value: 'fr', label: 'French' },
  { value: 'gl', label: 'Galician' },
  { value: 'ka', label: 'Georgian' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ha', label: 'Hausa' },
  { value: 'he', label: 'Hebrew' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'is', label: 'Icelandic' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'jv', label: 'Javanese' },
  { value: 'kn', label: 'Kannada' },
  { value: 'kk', label: 'Kazakh' },
  { value: 'ki', label: 'Kikuyu' },
  { value: 'rw', label: 'Kinyarwanda' },
  { value: 'rn', label: 'Kirundi' },
  { value: 'ko', label: 'Korean' },
  { value: 'ky', label: 'Kyrgyz' },
  { value: 'lv', label: 'Latvian' },
  { value: 'lt', label: 'Lithuanian' },
  { value: 'lg', label: 'Luganda' },
  { value: 'mk', label: 'Macedonian' },
  { value: 'ms', label: 'Malay' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'mr', label: 'Marathi' },
  { value: 'mn', label: 'Mongolian' },
  { value: 'ne', label: 'Nepali' },
  { value: 'no', label: 'Norwegian' },
  { value: 'fa', label: 'Persian' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'nso', label: 'Sepedi' },
  { value: 'st', label: 'Sesotho' },
  { value: 'sd', label: 'Sindhi' },
  { value: 'sk', label: 'Slovak' },
  { value: 'sl', label: 'Slovenian' },
  { value: 'es', label: 'Spanish' },
  { value: 'su', label: 'Sundanese' },
  { value: 'sw', label: 'Swahili' },
  { value: 'ss', label: 'Swati' },
  { value: 'sv', label: 'Swedish' },
  { value: 'tg', label: 'Tajik' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'th', label: 'Thai' },
  { value: 'bo', label: 'Tibetan' },
  { value: 'ts', label: 'Tsonga' },
  { value: 'tn', label: 'Tswana' },
  { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ur', label: 'Urdu' },
  { value: 'ug', label: 'Uyghur' },
  { value: 'uz', label: 'Uzbek' },
  { value: 've', label: 'Venda' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'war', label: 'Waray' },
  { value: 'cy', label: 'Welsh' },
  { value: 'wo', label: 'Wolof' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'zu', label: 'Zulu' },
] as const;

export type SupportedLanguage = typeof supportedLanguages[number]['value'];

/** "Tamil" for "ta", and the code itself for anything the table does not know. */
export function dubLanguageLabel(code: string): string {
  return supportedLanguages.find((l) => l.value === code)?.label ?? code;
}

/** True for any language in the label table: what a dub's source may be declared as. */
export function isKnownDubLanguage(code: string): boolean {
  return supportedLanguages.some((l) => l.value === code);
}

/**
 * What Chatterbox Multilingual (the model behind modal/dubbing_app.py) actually speaks:
 * 23 languages, per Resemble AI's model card. A `language_id` outside this set is not
 * refused with an error; it synthesizes something wrong-sounding instead, which is worse,
 * so the set is enforced here rather than discovered on the GPU.
 *
 * https://huggingface.co/ResembleAI/chatterbox
 */
export const CHATTERBOX_LANGUAGES: readonly string[] = [
  'ar', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi', 'it', 'ja',
  'ko', 'ms', 'nl', 'no', 'pl', 'pt', 'ru', 'sv', 'sw', 'tr', 'zh',
];

/**
 * The target languages of ElevenLabs Dubbing v2 (`model_id=dubbing_v2`), as base codes:
 * the whole v2 table on https://elevenlabs.io/docs/overview/capabilities/dubbing as of
 * 27 Sep 2026 (94 rows), less `cmn` ("Mandarin Chinese"), which would be a second entry
 * for `zh`. Every ElevenLabs dub runs on v2 except Bengali, which only v1 speaks
 * (DUBBING_V1_LANGUAGES).
 *
 * Adding a language is two lines: its code here and its label in `supportedLanguages`. A
 * code v2 does not speak is refused when the language target is created, after the
 * project has already been paid for, so only add what the table lists.
 */
export const ELEVENLABS_V2_LANGUAGES: readonly string[] = [
  'af', 'ak', 'sq', 'am', 'ar', 'hy', 'as', 'az', 'eu', 'be', 'bs', 'bg', 'my', 'yue',
  'ca', 'ceb', 'zh', 'hr', 'cs', 'da', 'dgo', 'nl', 'en', 'et', 'fil', 'fi', 'fr', 'gl',
  'ka', 'de', 'el', 'gu', 'ha', 'he', 'hi', 'hu', 'is', 'id', 'it', 'ja', 'jv', 'kn', 'kk',
  'ki', 'rw', 'rn', 'ko', 'ky', 'lv', 'lt', 'lg', 'mk', 'ms', 'ml', 'mr', 'mn', 'ne', 'no',
  'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'nso', 'st', 'sd', 'sk', 'sl', 'es', 'su', 'sw',
  'ss', 'sv', 'tg', 'ta', 'te', 'th', 'bo', 'ts', 'tn', 'tr', 'uk', 'ur', 'ug', 'uz', 've',
  'vi', 'war', 'cy', 'wo', 'yo', 'zu',
];

/**
 * Languages ElevenLabs dubs only on the older `dubbing_v1` model. Bengali is in the v1
 * table and not the v2 one, so it is the one language that still needs v1. Hebrew,
 * Norwegian and Swahili used to be here and are on v2 now, with its caps and its
 * cloning control.
 *
 * dubbing_v1 has a smaller ceiling (1GB / 45 min, DUBBING_V1_MAX_*), takes no dialect
 * tag and no cloning strength, and a project is fixed to one model, so a dub with
 * Bengali and another language becomes two ElevenLabs projects.
 */
export const DUBBING_V1_LANGUAGES: readonly string[] = ['bn'];

export function usesDubbingV1(code: string): boolean {
  return DUBBING_V1_LANGUAGES.includes(code);
}

/** The ElevenLabs model a target language is dubbed with. */
export type ElevenLabsDubbingModel = 'dubbing_v1' | 'dubbing_v2';

export function elevenLabsModelFor(code: string): ElevenLabsDubbingModel {
  return usesDubbingV1(code) ? 'dubbing_v1' : 'dubbing_v2';
}

const ELEVENLABS_LANGUAGES: readonly string[] = [...ELEVENLABS_V2_LANGUAGES, ...DUBBING_V1_LANGUAGES];

/**
 * The languages a creator can pick with each engine. ElevenLabs speaks every entry of
 * the label table; Cypher the 23 Chatterbox speaks. Public pages quote these counts from
 * here, not by hand.
 */
export function dubbableLanguagesFor(engine: DubEngine) {
  const offered = engine === 'elevenlabs' ? ELEVENLABS_LANGUAGES : CHATTERBOX_LANGUAGES;
  return supportedLanguages.filter((l) => offered.includes(l.value));
}

/** The trust boundary: what the API will accept as a dub target for an engine. */
export function isSupportedDubLanguage(code: string, engine: DubEngine = DEFAULT_DUB_ENGINE): boolean {
  return dubbableLanguagesFor(engine).some((l) => l.value === code);
}

/** One regional variety of a language, and the ElevenLabs Dubbing v2 tag that asks for it. */
export interface DubDialect {
  /** What `dubbing_outputs.accent` stores. Older rows hold the same values. */
  value: string;
  label: string;
  /** BCP-47 target tag: one of v2's supported dialects, or a base code. */
  tag: string;
}

/**
 * The dialects ElevenLabs Dubbing v2 can aim for, per language. These replaced the
 * experimental `target_accent` of the legacy route: v2 takes a region-qualified target
 * tag instead, and only for the dialects it lists (ar-EG, zh-TW, en-AU, en-CA, en-GB,
 * en-US, fr-CA, fr-FR, pt-BR, pt-PT, es-AR, es-CL, es-ES, es-MX). The stored values
 * are the old accent names where one existed, so dubs made before keep their meaning.
 * Cantonese is its own language (`yue`) on v2; the Chinese menu still offers it
 * because older dubs chose it here.
 */
export const dialectsByLanguage: Partial<Record<string, DubDialect[]>> = {
  en: [
    { value: 'american', label: 'American', tag: 'en-US' },
    { value: 'british', label: 'British', tag: 'en-GB' },
    { value: 'australian', label: 'Australian', tag: 'en-AU' },
    { value: 'canadian', label: 'Canadian', tag: 'en-CA' },
  ],
  es: [
    { value: 'castilian', label: 'Spain (Castilian)', tag: 'es-ES' },
    { value: 'latin american', label: 'Latin American (Mexico)', tag: 'es-MX' },
    { value: 'argentinian', label: 'Argentina', tag: 'es-AR' },
    { value: 'chilean', label: 'Chile', tag: 'es-CL' },
  ],
  pt: [
    { value: 'brazilian', label: 'Brazilian', tag: 'pt-BR' },
    { value: 'european', label: 'European', tag: 'pt-PT' },
  ],
  fr: [
    { value: 'french', label: 'France', tag: 'fr-FR' },
    { value: 'canadian', label: 'Canadian', tag: 'fr-CA' },
  ],
  zh: [
    { value: 'mandarin', label: 'Mandarin', tag: 'zh' },
    { value: 'taiwanese', label: 'Taiwan Mandarin', tag: 'zh-TW' },
    { value: 'cantonese', label: 'Cantonese', tag: 'yue' },
  ],
  ar: [
    { value: 'egyptian', label: 'Egyptian', tag: 'ar-EG' },
  ],
};

/**
 * Accents a dub could be made with once and no longer can. Indian English has no v2
 * dialect, so it left the menu; a stored `indian` keeps its label and dubs as plain
 * English on a retry.
 */
const RETIRED_ACCENTS: Partial<Record<string, DubDialect[]>> = {
  en: [{ value: 'indian', label: 'Indian', tag: 'en' }],
};

/** Every accent or dialect label ever stored, for history pages. */
export const accentsByLanguage: Partial<Record<string, { value: string; label: string }[]>> = Object.fromEntries(
  [...new Set([...Object.keys(dialectsByLanguage), ...Object.keys(RETIRED_ACCENTS)])].map((code) => [
    code,
    [...(dialectsByLanguage[code] ?? []), ...(RETIRED_ACCENTS[code] ?? [])].map(({ value, label }) => ({ value, label })),
  ]),
);

/** "British" for en/british, or null when the value is unknown. */
export function accentLabel(language: string, accent?: string | null): string | null {
  if (!accent) return null;
  return accentsByLanguage[language]?.find((a) => a.value === accent)?.label ?? null;
}

/**
 * The dialect menu for a language. Dialects are an ElevenLabs v2 control: Chatterbox
 * copies the accent of whoever is in the voice sample, and dubbing_v1 takes no region
 * tag, so both get no menu rather than a control that does nothing.
 */
export function accentsFor(language: string, engine: DubEngine = DEFAULT_DUB_ENGINE): { value: string; label: string }[] {
  if (engine !== 'elevenlabs' || usesDubbingV1(language)) return [];
  return (dialectsByLanguage[language] ?? []).map(({ value, label }) => ({ value, label }));
}

/**
 * The BCP-47 tag ElevenLabs is asked to dub a language into: the dialect's tag when a
 * stored accent names one, otherwise the base code. The single place a stored accent
 * becomes a target tag, so old rows (including the retired `indian`) keep working.
 */
export function elevenLabsTargetTag(language: string, accent?: string | null): string {
  if (!accent || usesDubbingV1(language)) return language;
  const all = [...(dialectsByLanguage[language] ?? []), ...(RETIRED_ACCENTS[language] ?? [])];
  return all.find((d) => d.value === accent)?.tag ?? language;
}

/**
 * How far a dubbed voice should stay from sounding like the original speaker. One
 * choice per dub, shown on the new-dub form, and turned into each engine's own control:
 * ElevenLabs' cloning strength (cloningStrengthFor) and Chatterbox's cfg_weight
 * (chatterboxParamsFor).
 */
export const DUB_VOICE_MODES = ['like_me', 'balanced', 'native'] as const;
export type DubVoiceMode = (typeof DUB_VOICE_MODES)[number];
export const DEFAULT_DUB_VOICE_MODE: DubVoiceMode = 'balanced';

export const DUB_VOICE_MODE_INFO: Record<DubVoiceMode, { label: string; help: Record<DubEngine, string> }> = {
  like_me: {
    label: 'Keep my voice and accent',
    help: {
      elevenlabs: 'Clones each speaker as closely as it can, accent included.',
      cypher: 'Copies each voice closely. Your accent carries over into the new language.',
    },
  },
  balanced: {
    label: 'Balanced',
    help: {
      elevenlabs: 'Keeps each voice recognisable while the new language still sounds natural.',
      cypher: 'Keeps each voice recognisable with a light accent. Right for most videos.',
    },
  },
  native: {
    label: 'Sound native',
    help: {
      elevenlabs: 'Loosens the clone so every speaker sounds like a native speaker.',
      cypher: 'Keeps the voice but drops the original accent, so speech sounds native.',
    },
  },
};

/**
 * Rough phonetic families, used only to say whether a source and a target are far apart
 * (cloningStrengthFor). A voice cloned hard across very different sound systems drags
 * the source's accent into the dub, so far pairs get a slightly looser clone.
 *
 * Groups, by script and region: Latin-script European (Germanic, Romance, West Slavic,
 * Baltic, Finno-Ugric, Turkish), Cyrillic, Arabic-script, Indic, CJK, Southeast Asian,
 * African. A language in no group (Greek, Hebrew, Armenian, Georgian, Tibetan) is
 * treated like an unknown source: no adjustment.
 */
export const DUB_LANGUAGE_GROUPS: Record<string, readonly string[]> = {
  latin_european: [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'sk', 'ro', 'hr',
    'hu', 'et', 'lv', 'lt', 'sl', 'ca', 'gl', 'eu', 'is', 'ga', 'cy', 'mt', 'lb', 'sq', 'bs', 'tr', 'af',
    'az', 'uz',
  ],
  cyrillic: ['ru', 'uk', 'bg', 'sr', 'mk', 'be', 'kk', 'ky', 'tg', 'mn'],
  arabic_script: ['ar', 'fa', 'ur', 'ps', 'sd', 'ug'],
  indic: ['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ne', 'or', 'as', 'si', 'dgo'],
  cjk: ['zh', 'yue', 'ja', 'ko'],
  southeast_asian: ['id', 'ms', 'fil', 'tl', 'vi', 'th', 'km', 'lo', 'my', 'jv', 'su', 'ceb', 'war'],
  african: [
    'sw', 'ha', 'yo', 'ig', 'zu', 'xh', 'am', 'so', 'sn', 'wo', 'ln', 'ny', 'ak', 'ki', 'rw', 'rn',
    'lg', 'nso', 'st', 'ss', 'ts', 'tn', 've',
  ],
};

/** A language's group, from a base code or a dialect tag ("es-MX" is Spanish). */
export function dubLanguageGroup(code?: string | null): string | null {
  const base = code?.toLowerCase().split('-')[0];
  if (!base) return null;
  return Object.entries(DUB_LANGUAGE_GROUPS).find(([, codes]) => codes.includes(base))?.[0] ?? null;
}

/**
 * ElevenLabs Dubbing v2 cloning strength (0 to 10, ElevenLabs' default 7) for a voice
 * mode and language pair.
 *
 * Starting values, to be tuned by ear: like_me 9, balanced 7 (ElevenLabs' own default),
 * native 4, one lower when source and target are in different groups
 * (DUB_LANGUAGE_GROUPS). An unknown source, or a language in no group, gets no
 * adjustment. Never sent to a dubbing_v1 project, which has no such control.
 */
export function cloningStrengthFor({
  voiceMode,
  sourceLanguage,
  targetLanguage,
}: {
  voiceMode: DubVoiceMode;
  sourceLanguage?: string | null;
  targetLanguage: string;
}): number {
  const base = voiceMode === 'like_me' ? 9 : voiceMode === 'native' ? 4 : 7;
  const from = dubLanguageGroup(sourceLanguage);
  const to = dubLanguageGroup(targetLanguage);
  const far = !!from && !!to && from !== to;
  return Math.min(10, Math.max(0, base - (far ? 1 : 0)));
}

/**
 * Chatterbox's generation controls for a voice mode, as the Cypher TTS v2 service takes
 * them. Per Chatterbox's README: a reference in another language than the target makes
 * the output inherit the reference's accent, and cfg_weight=0 removes that, so "Sound
 * native" is cfg_weight 0. The defaults (0.5 / 0.5) are what the README recommends for
 * most prompts. Only the v2 service reads these; the frozen Modal app takes none.
 */
export function chatterboxParamsFor({ voiceMode }: { voiceMode: DubVoiceMode }): { cfg_weight: number; exaggeration: number } {
  return { cfg_weight: voiceMode === 'native' ? 0 : 0.5, exaggeration: 0.5 };
}

/**
 * Names and terms the dub should keep as they are (brands, people, products). ElevenLabs
 * takes up to 1,000 per project; the form takes 50, which is plenty for one video and
 * keeps the translation prompt short on Cypher. Each term follows ElevenLabs' rules: at
 * most 50 characters and 5 words, none of `<>{}[]\`.
 */
export const DUB_KEYTERMS_MAX = 50;
export const DUB_KEYTERM_MAX_CHARS = 50;
export const DUB_KEYTERM_MAX_WORDS = 5;
const KEYTERM_FORBIDDEN = /[<>{}[\]\\]/;

/** Why a term would be refused, or null when it is fine. Checked after trimming. */
export function keytermProblem(term: string): string | null {
  const trimmed = term.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'A term cannot be empty';
  if (trimmed.length > DUB_KEYTERM_MAX_CHARS) return `Keep each term to ${DUB_KEYTERM_MAX_CHARS} characters`;
  if (trimmed.split(' ').length > DUB_KEYTERM_MAX_WORDS) return `Keep each term to ${DUB_KEYTERM_MAX_WORDS} words`;
  if (KEYTERM_FORBIDDEN.test(trimmed)) return 'Terms cannot contain < > { } [ ] or \\';
  return null;
}

/** Trimmed, inner spaces collapsed, empties dropped, duplicates removed (first one wins). */
export function normalizeKeyterms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const clean = term.trim().replace(/\s+/g, ' ');
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

// murfLocaleMap lived here — a locale table for Murf, which stopped powering dubbing
// two providers ago and had no readers left.

/** Everything a dub owns in GCS (sources and the worker's scratch files) sits under this prefix. */
export function dubProjectPrefix(userId: string, projectId: string): string {
  return `${userId}/dubbing/${projectId}/`;
}

/** Every dubbed file of a project sits under this prefix, one pair per language. */
export function dubOutputPrefix(projectId: string): string {
  return `dubbed/${projectId}/`;
}

/**
 * What a dub hands back, picked per dub: the video with the dubbed track (MP4), or the
 * track alone (MP3 or WAV). Only a video source can come back as a video. An audio-only
 * dub of a video never uploads the video at all: the audio track is all it needs.
 */
export const DUB_OUTPUT_FORMATS = ['mp4', 'mp3', 'wav'] as const;
export type DubOutputFormat = (typeof DUB_OUTPUT_FORMATS)[number];
export type DubAudioFormat = Exclude<DubOutputFormat, 'mp4'>;

export const DUB_OUTPUT_FORMAT_INFO: Record<DubOutputFormat, { label: string; help: string }> = {
  mp4: { label: 'Video (MP4)', help: 'Your video with the dubbed voices.' },
  mp3: { label: 'Audio only (MP3)', help: 'The dubbed track alone, compressed. Small and plays anywhere.' },
  wav: { label: 'Audio only (WAV)', help: 'The dubbed track alone, uncompressed. For editing; several times larger than MP3.' },
};

/** The format a dub was made in. Dubs from before the choice are MP4 for a video, MP3 otherwise. */
export function dubOutputFormatOf(dub: { outputFormat?: DubOutputFormat | null; isVideo: boolean }): DubOutputFormat {
  return dub.outputFormat ?? (dub.isVideo ? 'mp4' : 'mp3');
}

/** The dubbed track's format. A video dub's track is MP3: it is what gets muxed. */
export function dubAudioFormat(format?: DubOutputFormat | null): DubAudioFormat {
  return format === 'wav' ? 'wav' : 'mp3';
}

/**
 * Where one language's dub lands. Shared by the worker (writes it) and the API (deletes
 * it). The dubbed track is MP3 (WAV when the creator asked for it), whichever engine made
 * it; a video dub is that track muxed over the original. Dubs from before per-language
 * outputs sit at dubbed/<projectId>.(mp4|wav|mp3), which delete still cleans up.
 */
export function dubOutputObjects(projectId: string, language: string, audioFormat: DubAudioFormat = 'mp3') {
  const base = `${dubOutputPrefix(projectId)}${language}`;
  return {
    audio: { objectName: `${base}.${audioFormat}`, contentType: audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg' },
    video: { objectName: `${base}.mp4`, contentType: 'video/mp4' },
  };
}
