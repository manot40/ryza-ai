// HTTP Transport & URL Routing
export {
  upstreamUrl,
  localProxy,
  apiErrorMessage,
  isTransportError,
  createTransportError,
  fetchTransport,
  type TransportError,
} from './http';

// LLM Services & Chat Completions
export {
  chat,
  complete,
  listModels,
  resolvedContext,
  replyLang,
  clearProviderCache,
  type ChatOptions,
  type ModelEntry,
} from './llm';

// Streaming
export { streamChat, type StreamChatOptions } from './streaming';

// Speech-to-Text
export { transcribe } from './stt';

// Text-to-Speech & Voice Services
export { speak, qwenCloneVoice, listQwenTtsModels, fishCloneVoice, fishErrorMessage } from './tts-service';

export { QWEN_TTS_VOICES, MODE_PLAY_FX } from './tts';

// Translation
export { translate, translator, TranslationService, type TranslateOptions } from './translator';

// Dialogue, Tags & Persona
export { screenTagLine, type TaggedReply, type ScreenTagState } from './tags';
export { formatHistoryReply } from './prompt';

// Providers Registry
export { Providers } from './providers';
