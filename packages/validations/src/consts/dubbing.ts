
// Dubbing is a paid feature — every paid plan gets it; only Starter (free) is
// excluded. Gate by plan NAME: there is no tier column; the active plan is the
// most-recent active `subscriptions` row joined to `plans` (mirror canGenerateVideo).
export const DUBBING_PLANS = ['creator', 'pro', 'business', 'scale'] as const;

export function canDub(planName?: string | null): boolean {
  if (!planName) return false;
  return DUBBING_PLANS.includes(planName.toLowerCase() as (typeof DUBBING_PLANS)[number]);
}

// Redis key prefix for mid-run cancellation (train-ai pattern). The API sets the
// flag; the worker checks it between pipeline stages and aborts.
export const DUBBING_CANCEL_PREFIX = 'dubbing:cancel:';

export const supportedLanguages = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
  { value: 'nl', label: 'Dutch' },
  { value: 'fi', label: 'Finnish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hr', label: 'Croatian' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'no', label: 'Norwegian' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'sk', label: 'Slovak' },
  { value: 'es', label: 'Spanish' },
  { value: 'tr', label: 'Turkish' },
] as const;

export type SupportedLanguage = typeof supportedLanguages[number]['value'];

export const murfLocaleMap: Record<SupportedLanguage, string> = {
  en: 'en_US',
  zh: 'zh_CN',
  nl: 'nl_NL',
  fi: 'fi_FI',
  fr: 'fr_FR',
  de: 'de_DE',
  el: 'el_GR',
  hi: 'hi_IN',
  hr: 'hr_HR',
  id: 'id_ID',
  it: 'it_IT',
  ja: 'ja_JP',
  ko: 'ko_KR',
  no: 'no_NO',
  pl: 'pl_PL',
  pt: 'pt_BR',
  ro: 'ro_RO',
  ru: 'ru_RU',
  sk: 'sk_SK',
  es: 'es_ES',
  tr: 'tr_TR',
};
