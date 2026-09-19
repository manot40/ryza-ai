import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { config, DEFAULTS, SETTINGS_KEY, applyMigrations, type Settings } from './config.svelte';
import { cloneDeep } from 'es-toolkit';
import { LocalStorageMock } from '../../../tests/utils';

describe('config store', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('DEFAULTS shape', () => {
    it('contains all required sections with expected initial defaults', () => {
      const data = config.get();
      expect(data.llm.model).toBe('gpt-4o-mini');
      expect(data.llm.temperature).toBe(0.9);
      expect(data.llm.maxTokens).toBe(400);
      expect(data.llm.historyTurns).toBe(12);
      expect(data.llm.thinking).toBe('auto');
      expect(data.llm.thinkingEffort).toBe('default');

      expect(data.memory.enabled).toBe(true);
      expect(data.memory.turnsPerSession).toBe(8);
      expect(data.memory.sessionCap).toBe(8);
      expect(data.memory.summaryCap).toBe(8);

      expect(data.tts.provider).toBe('openai');
      expect(data.tts.mode).toBe('clone');
      expect(data.tts.presetVoice).toBe('Chloe');
      expect(data.tts.qwenModel).toBe('qwen3-tts-flash');

      expect(data.voice.lang).toBe('auto');
      expect(data.app.lang).toBe('en');
      expect(data.app.volume).toBe(0.9);
      expect(data.app.cheat).toBe(false);

      expect(data.state.mode).toBe('chat');
      expect(data.state.skin).toBe('crf_skn_002_0001');
      expect(data.state.stage).toBe('stage_01_001_04');
      expect(data.state.posture).toBe('posture_standing');
      expect(data.state.welcome.talk).toBe(false);
    });

    it('returns slice via section()', () => {
      const llm = config.section('llm');
      expect(llm.model).toBe('gpt-4o-mini');
      const app = config.section('app');
      expect(app.lang).toBe('en');
    });
  });

  describe('set and persistence', () => {
    it('sets nested properties and persists to localStorage', () => {
      config.set('app.lang', 'ja');
      expect(config.section('app').lang).toBe('ja');

      const storedRaw = mockStorage.getItem(SETTINGS_KEY);
      expect(storedRaw).not.toBeNull();
      const stored = JSON.parse(storedRaw!);
      expect(stored.app.lang).toBe('ja');
    });

    it('creates nested objects if intermediate keys are missing', () => {
      config.set('tts.modeHints.chat', 'whisper');
      expect(config.section('tts').modeHints.chat).toBe('whisper');

      const stored = JSON.parse(mockStorage.getItem(SETTINGS_KEY)!);
      expect(stored.tts.modeHints.chat).toBe('whisper');
    });
  });

  describe('migrations', () => {
    it('strips _01 and _99 suffixes from skin', () => {
      const target = cloneDeep(DEFAULTS);
      target.state.skin = 'crf_skn_002_0001_99';
      applyMigrations(target);
      expect(target.state.skin).toBe('crf_skn_002_0001');

      target.state.skin = 'crf_skn_002_0001_01';
      applyMigrations(target);
      expect(target.state.skin).toBe('crf_skn_002_0001');
    });

    it('migrates qwen credentials when tts.provider is qwen', () => {
      const target = cloneDeep(DEFAULTS);
      target.tts.provider = 'qwen';
      target.tts.apiKey = 'dashscope-key';
      target.tts.baseUrl = 'https://dashscope.example.com';
      target.tts.qwenApiKey = '';
      target.tts.qwenBaseUrl = '';

      applyMigrations(target);

      expect(target.tts.qwenApiKey).toBe('dashscope-key');
      expect(target.tts.qwenBaseUrl).toBe('https://dashscope.example.com');
    });

    it('resets posture to standing if not postureMigrated, but preserves choice if already migrated', () => {
      const unmigrated = cloneDeep(DEFAULTS);
      unmigrated.state.posture = 'posture_sitting';
      delete unmigrated.state.postureMigrated;

      applyMigrations(unmigrated);
      expect(unmigrated.state.posture).toBe('posture_standing');
      expect(unmigrated.state.postureMigrated).toBe(true);

      const alreadyMigrated = cloneDeep(DEFAULTS);
      alreadyMigrated.state.posture = 'posture_sitting';
      alreadyMigrated.state.postureMigrated = true;

      applyMigrations(alreadyMigrated);
      expect(alreadyMigrated.state.posture).toBe('posture_sitting');
    });
  });

  describe('reset, exportJSON, importJSON, and eraseAll', () => {
    it('reset restores default values and persists', () => {
      config.set('app.lang', 'zh');
      config.set('llm.model', 'claude-3-opus');
      expect(config.section('app').lang).toBe('zh');

      config.reset();

      expect(config.section('app').lang).toBe('en');
      expect(config.section('llm').model).toBe('gpt-4o-mini');
      const stored = JSON.parse(mockStorage.getItem(SETTINGS_KEY)!);
      expect(stored.app.lang).toBe('en');
    });

    it('exportJSON returns valid JSON string', () => {
      const json = config.exportJSON();
      const parsed = JSON.parse(json);
      expect(parsed.llm.model).toBe('gpt-4o-mini');
    });

    it('importJSON parses, merges defaults, applies migrations, and persists', () => {
      const payload = {
        app: { lang: 'ja' },
        state: { skin: 'crf_skn_002_0001_99' },
      };

      config.importJSON(JSON.stringify(payload));

      expect(config.section('app').lang).toBe('ja');
      expect(config.section('state').skin).toBe('crf_skn_002_0001');
      expect(config.section('llm').model).toBe('gpt-4o-mini'); // Preserved default
      const stored = JSON.parse(mockStorage.getItem(SETTINGS_KEY)!);
      expect(stored.app.lang).toBe('ja');
    });

    it('eraseAll removes all ryza.* keys from localStorage and resets memory', () => {
      mockStorage.setItem('ryza.settings.v1', '{"test":1}');
      mockStorage.setItem('ryza.game.v1', '{"gold":100}');
      mockStorage.setItem('other.key', 'keep');

      config.set('app.lang', 'zh');
      config.eraseAll();

      expect(mockStorage.getItem('ryza.settings.v1')).toBeNull();
      expect(mockStorage.getItem('ryza.game.v1')).toBeNull();
      expect(mockStorage.getItem('other.key')).toBe('keep');
      expect(config.section('app').lang).toBe('en');
    });
  });

  describe('hydrate', () => {
    it('fetches /config/providers.json and populates empty settings', async () => {
      const providerData = {
        llm: {
          base_url: 'https://api.openai.com/v1',
          model: 'gpt-4o',
          api_key: 'sk-provider-key',
          temperature: 0.7,
        },
        tts: {
          base_url: 'https://tts.example.com/v1',
          api_key: 'tts-provider-key',
          model_clone: 'clone-v2',
          model_preset: 'preset-v2',
          reference_audio: 'assets/voice/ref.wav',
        },
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => providerData,
      });
      vi.stubGlobal('fetch', fetchMock);

      await config.hydrate();

      expect(fetchMock).toHaveBeenCalledWith('/config/providers.json');
      expect(config.section('llm').baseUrl).toBe('https://api.openai.com/v1');
      expect(config.section('llm').model).toBe('gpt-4o');
      expect(config.section('llm').apiKey).toBe('sk-provider-key');
      expect(config.section('llm').temperature).toBe(0.7);

      expect(config.section('tts').baseUrl).toBe('https://tts.example.com/v1');
      expect(config.section('tts').apiKey).toBe('tts-provider-key');
      expect(config.section('tts').modelClone).toBe('clone-v2');
      expect(config.section('tts').modelPreset).toBe('preset-v2');
      expect(config.section('tts').reference).toBe('assets/voice/ref.wav');

      const stored = JSON.parse(mockStorage.getItem(SETTINGS_KEY)!);
      expect(stored.llm.apiKey).toBe('sk-provider-key');
    });

    it('updates baseUrl if host differs from provider', async () => {
      config.set('llm.baseUrl', 'https://old-host.com/v1');
      config.set('llm.apiKey', 'custom-key');

      const providerData = {
        llm: {
          base_url: 'https://new-host.com/v1',
          model: 'gpt-4o',
          api_key: 'new-key',
        },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => providerData,
        })
      );

      await config.hydrate();

      // Because host mismatched, it updates
      expect(config.section('llm').baseUrl).toBe('https://new-host.com/v1');
    });

    it('handles 404 response gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
        })
      );

      await expect(config.hydrate()).resolves.toBeUndefined();
    });

    it('handles fetch error gracefully without throwing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await expect(config.hydrate()).resolves.toBeUndefined();
    });
  });
});
