import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Langs, LANG_NAMES, TTS_LANGS, ALL_LANGS } from './langs';
import { config } from '$lib/stores/config.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('langs module', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new LocalStorageMock());
    config._resetForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('membership & constants', () => {
    it('restricts ALL_LANGS strictly to auto, en, ja, zh, id', () => {
      const codes = ALL_LANGS.map((item) => item.v);
      expect(codes).toEqual(['auto', 'en', 'ja', 'zh', 'id']);
      expect(Langs.ALL).toBe(ALL_LANGS);
    });

    it('defines expected display names in LANG_NAMES', () => {
      expect(LANG_NAMES).toEqual({
        zh: '简体中文',
        ja: '日本語',
        en: 'English',
        id: 'Bahasa Indonesia',
      });
    });

    it('defines expected TTS language types in TTS_LANGS', () => {
      expect(TTS_LANGS).toEqual({
        zh: 'Chinese',
        ja: 'Japanese',
        en: 'English',
        id: 'Auto',
      });
    });
  });

  describe('4-axis language resolution', () => {
    it('resolves ui() to app.lang or fallback en', () => {
      expect(Langs.ui()).toBe('en');
      config.setApp('lang', 'ja');
      expect(Langs.ui()).toBe('ja');
    });

    it('resolves voice() to ui() when auto, or explicit language', () => {
      config.setApp('lang', 'zh');
      config.setVoice('lang', 'auto');
      expect(Langs.voice()).toBe('zh');

      config.setVoice('lang', 'ja');
      expect(Langs.voice()).toBe('ja');
    });

    it('resolves llm() to ui() when auto, or explicit language', () => {
      config.setApp('lang', 'ja');
      config.setLLM('lang', 'auto');
      expect(Langs.llm()).toBe('ja');

      config.setLLM('lang', 'en');
      expect(Langs.llm()).toBe('en');
    });

    it('resolves tts() to llm() when auto, or explicit language (cascading)', () => {
      config.setApp('lang', 'zh');
      config.setLLM('lang', 'auto');
      config.setTTS('lang', 'auto');
      expect(Langs.tts()).toBe('zh');

      config.setLLM('lang', 'ja');
      expect(Langs.tts()).toBe('ja');

      config.setTTS('lang', 'en');
      expect(Langs.tts()).toBe('en');
    });
  });

  describe('helpers', () => {
    it('name() returns display name or raw key fallback', () => {
      expect(Langs.name('zh')).toBe('简体中文');
      expect(Langs.name('ja')).toBe('日本語');
      expect(Langs.name('en')).toBe('English');
      expect(Langs.name('id')).toBe('Bahasa Indonesia');
      expect(Langs.name('custom')).toBe('custom');
    });

    it('ttsLangType() returns DashScope type or Auto fallback', () => {
      expect(Langs.ttsLangType('zh')).toBe('Chinese');
      expect(Langs.ttsLangType('ja')).toBe('Japanese');
      expect(Langs.ttsLangType('en')).toBe('English');
      expect(Langs.ttsLangType('id')).toBe('Auto');
      expect(Langs.ttsLangType('custom')).toBe('Auto');
    });
  });
});
