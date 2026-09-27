
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

// The dubbing_v1 route (DUBBING_V1_LANGUAGES, below) is a different, smaller endpoint:
// 1GB / 45 min. A paid user picking one of those languages is held to this instead.
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
 * ElevenLabs; Cypher speaks some of the same languages on its own pipeline. An unknown
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
    description: 'ElevenLabs dubbing. Detects speakers automatically, with more languages and accents.',
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

/**
 * Every language either engine dubs into, and the label for each: 33, all of them on
 * ElevenLabs, and the 23 Chatterbox speaks on Cypher (see dubbableLanguagesFor).
 *
 * Also the label table for history: a dub recorded under an older backend keeps its row,
 * and the history pages look the code up here. Removing an entry would turn "Tamil" back
 * into "ta" on a dub that already exists.
 */
export const supportedLanguages = [
  { value: 'ar', label: 'Arabic' },
  { value: 'bn', label: 'Bengali' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'fil', label: 'Filipino' },
  { value: 'fr', label: 'French' },
  { value: 'he', label: 'Hebrew' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hr', label: 'Croatian' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ms', label: 'Malay' },
  { value: 'nl', label: 'Dutch' },
  { value: 'no', label: 'Norwegian' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'sk', label: 'Slovak' },
  { value: 'sv', label: 'Swedish' },
  { value: 'sw', label: 'Swahili' },
  { value: 'ta', label: 'Tamil' },
  { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
] as const;

export type SupportedLanguage = typeof supportedLanguages[number]['value'];

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
 * The languages a creator can pick with each engine. ElevenLabs speaks the whole table
 * (33); Cypher the 23 Chatterbox speaks, so ten entries (bn, bg, cs, fil, hr, id, ro, sk,
 * ta, uk) are ElevenLabs-only. Public pages quote these counts from here, not by hand.
 */
export function dubbableLanguagesFor(engine: DubEngine) {
  return engine === 'elevenlabs'
    ? supportedLanguages
    : supportedLanguages.filter((l) => CHATTERBOX_LANGUAGES.includes(l.value));
}

/** The trust boundary: what the API will accept as a dub target for an engine. */
export function isSupportedDubLanguage(code: string, engine: DubEngine = DEFAULT_DUB_ENGINE): boolean {
  return dubbableLanguagesFor(engine).some((l) => l.value === code);
}

/**
 * ElevenLabs languages outside the 29 the default /v1/dubbing route has served in
 * production. These go through the dubbing *project* API pinned to
 * `model_id=dubbing_v1`, which speaks what Eleven v3 speaks (88 languages per
 * ElevenLabs' docs, all four of these among them).
 *
 * Adding one is two lines: the entry in `supportedLanguages` above and its code here.
 * The cost is that dubbing_v1 has a smaller ceiling (1GB / 45 min) and ignores
 * `target_accent`, so a language with accents worth offering is better left on the
 * default route.
 */
export const DUBBING_V1_LANGUAGES: readonly string[] = ['bn', 'he', 'no', 'sw'];

export function usesDubbingV1(code: string): boolean {
  return DUBBING_V1_LANGUAGES.includes(code);
}

/**
 * Accents the dubbing API can aim for, per language. `target_accent` is marked
 * experimental upstream, so treat these as a preference rather than a guarantee —
 * a language with no entry simply offers the default accent.
 */
export const accentsByLanguage: Partial<Record<SupportedLanguage, { value: string; label: string }[]>> = {
  en: [
    { value: 'american', label: 'American' },
    { value: 'british', label: 'British' },
    { value: 'australian', label: 'Australian' },
    { value: 'indian', label: 'Indian' },
  ],
  es: [
    { value: 'castilian', label: 'Spain (Castilian)' },
    { value: 'latin american', label: 'Latin American' },
  ],
  pt: [
    { value: 'brazilian', label: 'Brazilian' },
    { value: 'european', label: 'European' },
  ],
  fr: [
    { value: 'french', label: 'France' },
    { value: 'canadian', label: 'Canadian' },
  ],
  zh: [
    { value: 'mandarin', label: 'Mandarin' },
    { value: 'cantonese', label: 'Cantonese' },
  ],
};

/**
 * Accents are an ElevenLabs control. Chatterbox reproduces the accent of whoever is in
 * the reference audio and takes no target accent, and the dubbing_v1 route ignores it, so
 * both get no menu rather than a control that does nothing.
 */
export function accentsFor(language: string, engine: DubEngine = DEFAULT_DUB_ENGINE): { value: string; label: string }[] {
  if (engine !== 'elevenlabs' || usesDubbingV1(language)) return [];
  return accentsByLanguage[language as SupportedLanguage] ?? [];
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
 * Where one language's dub lands. Shared by the worker (writes it) and the API (deletes
 * it). The dubbed track is always MP3, whichever engine made it; a video dub is that
 * track muxed over the original. Dubs from before per-language outputs sit at
 * dubbed/<projectId>.(mp4|wav|mp3), which delete still cleans up.
 */
export function dubOutputObjects(projectId: string, language: string) {
  const base = `${dubOutputPrefix(projectId)}${language}`;
  return {
    audio: { objectName: `${base}.mp3`, contentType: 'audio/mpeg' },
    video: { objectName: `${base}.mp4`, contentType: 'video/mp4' },
  };
}
