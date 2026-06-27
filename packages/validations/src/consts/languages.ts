export interface Language {
  code: string;
  name: string;
}

export const profileLanguages: Language[] = [
  { code: "ar", name: "العربية (Arabic)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "en", name: "English" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "it", name: "Italiano (Italian)" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "ko", name: "한국어 (Korean)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "ru", name: "Русский (Russian)" },
  { code: "es", name: "Español (Spanish)" },
];
