// @wc-ignore-file
import { cloneDeep, merge } from 'es-toolkit';
import { destr } from 'destr';

export const SETTINGS_KEY = 'ryza.settings.v1';

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  historyTurns: number;
  contextWindow: number;
  thinking: 'auto' | 'off' | 'on';
  thinkingEffort: 'default' | 'off' | 'low' | 'medium' | 'high' | 'max';
  thinkingStyle: 'auto' | 'none' | 'openai' | 'openrouter' | 'qwen' | 'glm';
  lang: string;
}

export interface MemoryConfig {
  enabled: boolean;
  turnsPerSession: number;
  sessionCap: number;
  summaryCap: number;
}

export interface TtsConfig {
  provider: 'openai' | 'qwen' | string;
  providerStyle: string;
  baseUrl: string;
  apiKey: string;
  mode: 'clone' | 'preset' | 'off' | string;
  modelClone: string;
  modelPreset: string;
  presetVoice: string;
  cloneVoice?: string;
  format: string;
  reference: string;
  styleHint: string;
  modeHints: Record<string, string>;
  qwenBaseUrl: string;
  qwenApiKey: string;
  qwenModel: string;
  qwenVoice: string;
  qwenCloneTarget: string;
  lang: string;
}

export interface VoiceConfig {
  lang: string;
}

export interface CharaConfig {
  personality: string;
  likes: string;
  dislikes: string;
  situation: string;
  callMe: string;
  extra: string;
}

export interface ProfileConfig {
  name: string;
  birthday: string;
  gender: string;
  appearance: string;
  background: string;
  hobby: string;
  interest: string;
  interestExtra: string;
  storyStart: string;
  futureGoals: string;
  personality: string;
}

export interface AudioConfig {
  bgm: number;
  ambient: number;
  voice: number;
  se: number;
}

export interface AppConfig {
  lang: string;
  voice: boolean;
  volume: number;
  textSpeed: number;
  vibration: boolean;
  fullscreen: boolean;
  rim: boolean;
  showBubble: boolean;
  timeMode: 'real' | 'flow' | 'manual' | string;
  flowSpeed: number;
  cheat: boolean;
}

export interface StateWelcomeConfig {
  talk: boolean;
  map: boolean;
  alarm: boolean;
  skin: boolean;
  quest: boolean;
}

export interface StateConfig {
  mode: string;
  style: string;
  skin: string;
  stage: string;
  tod: string;
  posture: string;
  postureMigrated?: boolean;
  day: number;
  lastDayDate: string;
  gameHour: number;
  gameClockAt: number;
  todManualUntil: number;
  onboardingDone: boolean;
  welcome: StateWelcomeConfig;
}

export interface Settings {
  llm: LlmConfig;
  memory: MemoryConfig;
  tts: TtsConfig;
  voice: VoiceConfig;
  chara: CharaConfig;
  profile: ProfileConfig;
  audio: AudioConfig;
  app: AppConfig;
  state: StateConfig;
}

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
    turnsPerSession: 8,
    sessionCap: 8,
    summaryCap: 8,
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
    showBubble: true,
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
    lastDayDate: '',
    gameHour: 12,
    gameClockAt: 0,
    todManualUntil: 0,
    onboardingDone: false,
    welcome: { talk: false, map: false, alarm: false, skin: false, quest: false },
  },
} satisfies Settings;

export function applyMigrations(target: Settings): void {
  if (target.state && target.state.skin) {
    target.state.skin = String(target.state.skin).replace(/_(01|99)$/, '');
  }
  /* One-time migration: qwen got its own baseUrl/apiKey */
  if (target.tts && target.tts.provider === 'qwen') {
    if (!target.tts.qwenApiKey && target.tts.apiKey) target.tts.qwenApiKey = target.tts.apiKey;
    if (!target.tts.qwenBaseUrl && target.tts.baseUrl) target.tts.qwenBaseUrl = target.tts.baseUrl;
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

function save(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota or access errors
  }
}

export const config = {
  get(): Settings {
    return data;
  },

  section<K extends keyof Settings>(name: K): Settings[K] {
    return data[name];
  },

  set(path: string, value: unknown): void {
    const parts = path.split('.');
    let node: Record<string, unknown> = data as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof node[key] !== 'object' || node[key] === null) {
        node[key] = {};
      }
      node = node[key] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
    save();
  },

  save,

  reset(): void {
    const fresh = cloneDeep(DEFAULTS);
    for (const k of Object.keys(fresh) as (keyof Settings)[]) {
      (data as Record<keyof Settings, unknown>)[k] = fresh[k];
    }
    save();
  },

  exportJSON(): string {
    return JSON.stringify(data, null, 2);
  },

  importJSON(text: string): void {
    const parsed = destr<Record<string, unknown>>(text);
    const patch = typeof parsed === 'object' && parsed !== null ? parsed : {};
    const merged = merge(cloneDeep(DEFAULTS), patch) as Settings;
    applyMigrations(merged);
    for (const k of Object.keys(merged) as (keyof Settings)[]) {
      (data as Record<keyof Settings, unknown>)[k] = merged[k];
    }
    save();
  },

  eraseAll(): void {
    if (typeof localStorage !== 'undefined') {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ryza.')) doomed.push(k);
      }
      for (const k of doomed) {
        localStorage.removeItem(k);
      }
    }
    const fresh = cloneDeep(DEFAULTS);
    for (const k of Object.keys(fresh) as (keyof Settings)[]) {
      (data as Record<keyof Settings, unknown>)[k] = fresh[k];
    }
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
        save();
      })
      .catch(() => {});
    return _hydrated;
  },

  _resetForTest(): void {
    _hydrated = null;
    const initial = loadInitial();
    for (const k of Object.keys(initial) as (keyof Settings)[]) {
      (data as Record<keyof Settings, unknown>)[k] = initial[k];
    }
  },
};

export const Config = config;
export default config;
