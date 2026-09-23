// @wc-ignore-file
import type {
  AppConfig,
  AudioConfig,
  CharaConfig,
  ConfigField,
  ConfigSetter,
  LlmConfig,
  MemoryConfig,
  ProfileConfig,
  Settings,
  StateConfig,
  SttConfig,
  TtsConfig,
  VoiceConfig,
} from './config.types';

import { destr } from 'destr';
import { cloneDeep, merge } from 'es-toolkit';

export const SETTINGS_KEY = 'ryza.settings.v1';

export const DEFAULTS: Settings = {
  /* ---- LLM (OpenAI-compatible) ---- */
  llm: {
    baseUrl: '',
    model: 'gpt-4o-mini',
    apiKey: '',
    temperature: 0.9,
    maxTokens: 400,
    historyTurns: 12,
    contextWindow: 0,
    thinking: 'auto',
    thinkingEffort: 'default',
    thinkingStyle: 'auto',
    lang: 'auto',
  },

  /* Two-layer conversation memory */
  memory: {
    enabled: true,
    turnsPerSession: 10,
    sessionCap: 8,
    summaryCap: 8,
  },

  /* Speech input: transcription endpoint */
  stt: {
    provider: 'whisper',
    baseUrl: '',
    apiKey: '',
    model: 'whisper-1',
    engine: 'auto',
  },

  /* ---- TTS providers ---- */
  tts: {
    provider: 'openai',
    providerStyle: 'default',
    baseUrl: '',
    apiKey: '',
    mode: 'clone',
    modelClone: 'voice-clone-model',
    modelPreset: 'tts-model',
    presetVoice: 'Chloe',
    format: 'wav',
    reference: 'assets/voice/ryza_wav/prologue_08.wav',
    styleHint: '明るく元気な若い女性の声。親しみやすい口調で。',
    modeHints: {},
    qwenBaseUrl: '',
    qwenApiKey: '',
    qwenModel: 'qwen3-tts-flash',
    qwenVoice: 'Cherry',
    qwenCloneTarget: 'qwen3-tts-vc-2026-01-22',
    fishBaseUrl: '',
    fishApiKey: '',
    fishModel: 's2.1-pro-free',
    fishVoice: '',
    voicevoxBaseUrl: 'http://127.0.0.1:50021/',
    voicevoxVoice: '0',
    aivisBaseUrl: 'http://127.0.0.1:10101/',
    aivisVoice: '0',
    lang: 'auto',
  },

  /* ---- language matrix ---- */
  voice: { lang: 'auto' },

  /* ---- character / persona ---- */
  chara: {
    personality: '明るく前向き、少しおっちょこちょいな錬金術士',
    likes: '調合、冒険、甘いもの',
    dislikes: 'じっとしていること',
    situation: 'クーケン島の自分の家で、君と一緒に過ごしている',
    callMe: '君',
    extra: '',
  },

  /* ---- player profile ---- */
  profile: {
    name: '',
    birthday: '',
    gender: '',
    appearance: '',
    background: '',
    hobby: '',
    interest: '',
    interestExtra: '',
    storyStart: '',
    futureGoals: '',
    personality: '',
  },

  audio: { bgm: 0.55, ambient: 0.45, voice: 1, se: 0.85 },

  /* ---- presentation ---- */
  app: {
    lang: 'en',
    voice: true,
    volume: 0.9,
    textSpeed: 30,
    vibration: true,
    fullscreen: false,
    rim: true,
    nsfwEnabled: false,
    showBubble: true,
    stt: 'off',
    autoSend: false,
    autoSendDelay: 2000,
    npcFrequency: 'normal',
    bargeIn: false,
    showOriginal: false,
    quickCollapsed: false,
    timeMode: 'real',
    flowSpeed: 60,
    cheat: false,
  },

  /* ---- session state ---- */
  state: {
    mode: 'chat',
    style: 'voice',
    skin: 'crf_skn_002_0001',
    stage: 'stage_01_001_04',
    tod: 'aft',
    posture: 'posture_standing',
    day: 1,
    welcome_day: 0,
    lastDayDate: '',
    gameHour: 12,
    gameClockAt: 0,
    todManualUntil: 0,
    onboardingDone: false,
    welcome: { talk: false, map: false, alarm: false, skin: false, quest: false },
  },
} satisfies Settings;

const isPatch = <T extends Settings[ConfigField]>(obj: keyof T | Partial<T>): obj is Partial<T> =>
  typeof obj === 'object' && obj !== null;

export function applyMigrations(target: Settings): void {
  if (target.state && target.state.skin) {
    target.state.skin = String(target.state.skin).replace(/_(01|99)$/, '');
  }
  /* One-time migration: qwen got its own baseUrl/apiKey */
  if (target.tts && target.tts.provider === 'qwen') {
    if (!target.tts.qwenApiKey && target.tts.apiKey) target.tts.qwenApiKey = target.tts.apiKey;
    if (!target.tts.qwenBaseUrl && target.tts.baseUrl) target.tts.qwenBaseUrl = target.tts.baseUrl;
  }
  /* One-time migration: fishVoice catalog reset */
  if (target.tts && target.tts.fishVoice === '2bc96959c27d41cc87d517b83569d43a') {
    target.tts.fishVoice = '';
  }
  /* One-time migration: `posture_sitting` default reset */
  if (target.state && !target.state.postureMigrated) {
    target.state.posture = 'posture_standing';
    target.state.postureMigrated = true;
  }
}

function loadInitial(): Settings {
  let stored: Record<string, unknown> = {};
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = destr<unknown>(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          stored = parsed as Record<string, unknown>;
        }
      }
    } catch {
      stored = {};
    }
  }
  const result = merge(cloneDeep(DEFAULTS), stored) as Settings;
  applyMigrations(result);
  return result;
}

let data = $state<Settings>(loadInitial());
let _hydrated: Promise<void> | null = null;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved = $state(Date.now());

function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    lastSaved = Date.now();
  } catch {
    // Ignore storage quota or access errors
  }
}

function save(immediate = false): void {
  lastSaved = Date.now();
  if (immediate) {
    flushSave();
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushSave();
  }, 300);
}

function get(): Settings;
function get<K extends ConfigField>(key: K): Settings[K];
function get(key?: ConfigField) {
  const snap = $state.snapshot(data);
  if (!key) return snap;
  return snap[key];
}

export function mutator<K extends ConfigField, P extends keyof Settings[K]>(
  key: K,
  prop: P,
  val: Settings[K][P]
): void;
export function mutator<K extends ConfigField>(key: K, patch: Partial<Settings[K]>): void;
export function mutator<K extends ConfigField, P extends keyof Settings[K]>(
  key: K,
  propOrPatch: P | Partial<Settings[K]>,
  val?: Settings[K][P]
): void {
  if (isPatch(propOrPatch)) data[key] = { ...data[key], ...propOrPatch };
  else data[key] = { ...data[key], [propOrPatch]: val };
  save();
}

const setLLM: ConfigSetter<LlmConfig> = (
  payload: keyof LlmConfig | Partial<LlmConfig>,
  value?: LlmConfig[keyof LlmConfig]
): void => {
  if (isPatch(payload)) mutator('llm', payload);
  else if (value !== undefined) mutator('llm', payload, value);
};
const setMemory: ConfigSetter<MemoryConfig> = (
  payload: keyof MemoryConfig | Partial<MemoryConfig>,
  value?: MemoryConfig[keyof MemoryConfig]
): void => {
  if (isPatch(payload)) mutator('memory', payload);
  else if (value !== undefined) mutator('memory', payload, value);
};
const setSTT: ConfigSetter<SttConfig> = (
  payload: keyof SttConfig | Partial<SttConfig>,
  value?: SttConfig[keyof SttConfig]
): void => {
  if (isPatch(payload)) mutator('stt', payload);
  else if (value !== undefined) mutator('stt', payload, value);
};
const setTTS: ConfigSetter<TtsConfig> = (
  payload: keyof TtsConfig | Partial<TtsConfig>,
  value?: TtsConfig[keyof TtsConfig]
): void => {
  if (isPatch(payload)) mutator('tts', payload);
  else if (value !== undefined) mutator('tts', payload, value);
};
const setVoice: ConfigSetter<VoiceConfig> = (
  payload: keyof VoiceConfig | Partial<VoiceConfig>,
  value?: VoiceConfig[keyof VoiceConfig]
): void => {
  if (isPatch(payload)) mutator('voice', payload);
  else if (value !== undefined) mutator('voice', payload, value);
};
const setChara: ConfigSetter<CharaConfig> = (
  payload: keyof CharaConfig | Partial<CharaConfig>,
  value?: CharaConfig[keyof CharaConfig]
): void => {
  if (isPatch(payload)) mutator('chara', payload);
  else if (value !== undefined) mutator('chara', payload, value);
};
const setProfile: ConfigSetter<ProfileConfig> = (
  payload: keyof ProfileConfig | Partial<ProfileConfig>,
  value?: ProfileConfig[keyof ProfileConfig]
): void => {
  if (isPatch(payload)) mutator('profile', payload);
  else if (value !== undefined) mutator('profile', payload, value);
};
const setAudio: ConfigSetter<AudioConfig> = (
  payload: keyof AudioConfig | Partial<AudioConfig>,
  value?: AudioConfig[keyof AudioConfig]
): void => {
  if (isPatch(payload)) mutator('audio', payload);
  else if (value !== undefined) mutator('audio', payload, value);
};
const setApp: ConfigSetter<AppConfig> = (
  payload: keyof AppConfig | Partial<AppConfig>,
  value?: AppConfig[keyof AppConfig]
): void => {
  if (isPatch(payload)) mutator('app', payload);
  else if (value !== undefined) mutator('app', payload, value);
};
const setState: ConfigSetter<StateConfig> = (
  payload: keyof StateConfig | Partial<StateConfig>,
  value?: StateConfig[keyof StateConfig]
): void => {
  if (isPatch(payload)) data.state = { ...data.state, ...payload };
  else if (value !== undefined) data.state = { ...data.state, [payload]: value };
  save();
};

export const config = {
  get,
  mutator,
  setLLM,
  setMemory,
  setSTT,
  setTTS,
  setVoice,
  setChara,
  setProfile,
  setAudio,
  setApp,
  setState,

  flushSave,
  save,

  get lastSaved(): number {
    return lastSaved;
  },

  reset(): void {
    const fresh = cloneDeep(DEFAULTS);
    for (const k of Object.keys(fresh) as ConfigField[]) {
      (data as Record<ConfigField, unknown>)[k] = fresh[k];
    }
    flushSave();
  },

  exportJSON(): string {
    return JSON.stringify(data, null, 2);
  },

  importJSON(text: string): void {
    const parsed = destr<Record<string, unknown>>(text);
    const patch = typeof parsed === 'object' && parsed !== null ? parsed : {};
    const merged = merge(cloneDeep(DEFAULTS), patch) as Settings;
    applyMigrations(merged);
    for (const k of Object.keys(merged) as ConfigField[]) {
      (data as Record<ConfigField, unknown>)[k] = merged[k];
    }
    flushSave();
  },

  eraseAll(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (typeof localStorage !== 'undefined') {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ryza.')) doomed.push(k);
      }
      for (const k of doomed) localStorage.removeItem(k);
    }

    const fresh = cloneDeep(DEFAULTS);
    for (const k of Object.keys(fresh) as ConfigField[]) {
      (data as Record<ConfigField, unknown>)[k] = fresh[k];
    }

    lastSaved = Date.now();
    _hydrated = Promise.resolve();
  },

  hydrate(): Promise<void> {
    if (_hydrated) return _hydrated;
    _hydrated = fetch('/config/providers.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        function hostOf(u?: string): string {
          try {
            return new URL(u || '').host;
          } catch {
            return '';
          }
        }
        if (p.llm) {
          const llmHostOk = p.llm.base_url && hostOf(data.llm.baseUrl) === hostOf(p.llm.base_url);
          if (!data.llm.apiKey || !llmHostOk) {
            if (p.llm.base_url) data.llm.baseUrl = p.llm.base_url;
            if (p.llm.model) data.llm.model = p.llm.model;
            if (p.llm.api_key) data.llm.apiKey = p.llm.api_key;
            if (p.llm.temperature != null) data.llm.temperature = p.llm.temperature;
          }
        }
        if (p.tts) {
          const ttsHostOk = p.tts.base_url && hostOf(data.tts.baseUrl) === hostOf(p.tts.base_url);
          if (!data.tts.apiKey || !ttsHostOk) {
            if (p.tts.base_url) data.tts.baseUrl = p.tts.base_url;
            if (p.tts.api_key) data.tts.apiKey = p.tts.api_key;
            if (p.tts.model_clone) data.tts.modelClone = p.tts.model_clone;
            if (p.tts.model_preset) data.tts.modelPreset = p.tts.model_preset;
            if (p.tts.reference_audio) data.tts.reference = p.tts.reference_audio;
          }
        }
        flushSave();
      })
      .catch(() => {});
    return _hydrated;
  },

  /** @internal */
  _resetForTest(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    _hydrated = null;
    const initial = loadInitial();
    for (const k of Object.keys(initial) as ConfigField[]) {
      (data as Record<ConfigField, unknown>)[k] = initial[k];
    }
    lastSaved = Date.now();
  },
};

export type * from './config.types';
export const Config = config;
export default config;
