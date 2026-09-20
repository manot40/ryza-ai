import { config } from '../stores/config.svelte';
import { Langs } from '../i18n/langs';

export type VoiceLocaleCategory = 'alarm' | 'tap' | 'prologue';

export interface VoiceLocaleConfig {
  alarm: string;
  tap: string;
  prologue: string;
}

export type VoiceBankIndex = Record<string, Record<string, Record<string, Record<string, string[]>>>>;

export function getVoiceLocale(langOverride?: string): VoiceLocaleConfig {
  const lang = langOverride || (typeof Langs !== 'undefined' ? Langs.voice() : undefined) || 'ja';

  const map: Record<string, VoiceLocaleConfig> = {
    zh: { alarm: 'zh-tw', tap: 'zh-tw', prologue: 'zh-tw' },
    'zh-tw': { alarm: 'zh-tw', tap: 'zh-tw', prologue: 'zh-tw' },
    en: { alarm: 'en', tap: 'en', prologue: 'en' },
    ja: { alarm: 'ja', tap: 'jp', prologue: 'jp' },
    hi: { alarm: 'hi', tap: 'hi-in', prologue: 'hi-in' },
    id: { alarm: 'id', tap: 'id-id', prologue: 'id-id' },
    'pt-br': { alarm: 'pt-br', tap: 'pt-br', prologue: 'pt-br' },
  };

  return map[lang] || map.ja;
}

export class VoiceBankService {
  index: VoiceBankIndex | null = null;

  async load(catalogs?: VoiceBankIndex): Promise<VoiceBankIndex | null> {
    if (catalogs) {
      this.index = catalogs;
      return this.index;
    }

    try {
      const res = await fetch('/assets/_index/voice_bank.json');
      const json = (await res.json()) as VoiceBankIndex;
      this.index = json;
      return json;
    } catch {
      return null;
    }
  }

  locale(langOverride?: string): string {
    return getVoiceLocale(langOverride).alarm;
  }

  pick(
    type: string = 'goodMorning',
    style: string = 'normal',
    tod: string = 'morning',
    langOverride?: string
  ): string | null {
    const idx = this.index;
    if (!idx) return null;

    const locName = this.locale(langOverride);
    const loc = idx[locName] || idx.ja || idx.en;
    if (!loc) return null;

    const s = loc[style] || loc.normal;
    if (!s) return null;

    const t = s[type] || s.goodMorning;
    if (!t) return null;

    const arr = t[tod] || t.daytime || t[Object.keys(t)[0]];
    if (!arr || !arr.length) return null;

    return arr[Math.floor(Math.random() * arr.length)];
  }

  envPath(clip?: string | null): string | null {
    if (!clip) return null;
    return clip.replace(/\.m4a$/i, '.env.json');
  }
}

export const voiceBank = new VoiceBankService();
