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

export const STT_TAGS: Record<string, string> = {
  zh: 'zh-CN',
  'zh-tw': 'zh-TW',
  ja: 'ja-JP',
  en: 'en-US',
  hi: 'hi-IN',
  id: 'id-ID',
  'pt-br': 'pt-BR',
};

export const STT_ISO: Record<string, string> = {
  zh: 'zh',
  'zh-tw': 'zh',
  ja: 'ja',
  en: 'en',
  hi: 'hi',
  id: 'id',
  'pt-br': 'pt',
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
    return config.get('app').lang || 'en';
  },
  voice(): string {
    const v = config.get('voice').lang || 'auto';
    return v === 'auto' ? Langs.ui() : v;
  },
  llm(): string {
    const v = config.get('llm').lang || 'auto';
    return v === 'auto' ? Langs.ui() : v;
  },
  reply(): string {
    return this.llm();
  },
  tts(): string {
    const v = config.get('tts').lang || 'auto';
    return v === 'auto' ? Langs.llm() : v;
  },
  name(lg: string): string {
    return LANG_NAMES[lg] || lg;
  },
  ttsLangType(lg: string): string {
    return TTS_LANGS[lg] || 'Auto';
  },
  sttTag(lg: string): string {
    return STT_TAGS[lg] || lg || 'ja-JP';
  },
  STT_TAGS,
  sttLang(lg: string): string {
    return STT_ISO[lg] || lg || '';
  },
  STT_ISO,
  ALL: ALL_LANGS,
};

export default Langs;
