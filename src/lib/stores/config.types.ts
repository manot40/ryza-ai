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

export interface SttConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  engine: 'auto' | 'webSpeech' | 'capture' | string;
}

export interface TtsConfig {
  provider: 'openai' | 'qwen' | 'fish' | 'voicevox' | 'aivis' | string;
  providerStyle?: string;
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
  fishBaseUrl: string;
  fishApiKey: string;
  fishModel: string;
  fishVoice: string;
  fishVoiceAsmr?: string;
  voicevoxBaseUrl?: string;
  voicevoxVoice?: string;
  aivisBaseUrl?: string;
  aivisVoice?: string;
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
  nsfwEnabled: boolean;
  showBubble: boolean;
  stt: string;
  autoSend: boolean;
  autoSendDelay: number;
  npcFrequency: string;
  bargeIn: boolean;
  showOriginal?: boolean;
  quickCollapsed?: boolean;
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
  welcome_day?: number;
  welcome_claimed?: Record<string, boolean>;
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
  stt: SttConfig;
  tts: TtsConfig;
  voice: VoiceConfig;
  chara: CharaConfig;
  profile: ProfileConfig;
  audio: AudioConfig;
  app: AppConfig;
  state: StateConfig;
}

export interface ConfigSetter<T extends Settings[ConfigField]> {
  (patch: Partial<T>): void;
  <P extends keyof T>(prop: P, value: T[P]): void;
}

export type ConfigField = keyof Settings;
