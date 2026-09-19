import { config } from '$lib/stores/config.svelte';

export type SupportedUiLocale = 'en' | 'ja' | 'zh' | 'id';
export type LocaleCode = 'auto' | SupportedUiLocale;

export interface LangOption {
  v: LocaleCode;
  k: string;
}

export const LANG_NAMES: Record<string, string> = {
  zh: '简体中文',
  ja: '日本語',
  en: 'English',
  id: 'Bahasa Indonesia',
};

export const TTS_LANGS: Record<string, string> = {
  zh: 'Chinese',
  ja: 'Japanese',
  en: 'English',
  id: 'Auto',
};

export const ALL_LANGS: readonly LangOption[] = [
  { v: 'auto', k: 'lang.auto' },
  { v: 'en', k: 'lang.en' },
  { v: 'ja', k: 'lang.ja' },
  { v: 'zh', k: 'lang.zh' },
  { v: 'id', k: 'lang.id' },
] as const;

export const Langs = {
  ui(): string {
    return (config.section('app') || {}).lang || 'en';
  },
  voice(): string {
    const v = (config.section('voice') || {}).lang || 'auto';
    return v === 'auto' ? Langs.ui() : v;
  },
  llm(): string {
    const v = (config.section('llm') || {}).lang || 'auto';
    return v === 'auto' ? Langs.ui() : v;
  },
  tts(): string {
    const v = (config.section('tts') || {}).lang || 'auto';
    return v === 'auto' ? Langs.llm() : v;
  },
  name(lg: string): string {
    return LANG_NAMES[lg] || lg;
  },
  ttsLangType(lg: string): string {
    return TTS_LANGS[lg] || 'Auto';
  },
  ALL: ALL_LANGS,
};

export default Langs;
