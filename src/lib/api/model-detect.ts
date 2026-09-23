/**
 * Shared TTS engine / model detection helpers.
 *
 * Used by both `tts-emotion.ts` (API-level adaptation strategies) and
 * `text-emotion.ts` (inline text emotion-hint factory) so the model-family
 * regexes live in exactly one place.
 */

export function isFishOrMiniMax(provider: string, model?: string): boolean {
  const isFish2 = isFishS2Model(model);
  return isFish2 || isMiniMaxModel(model) || (provider === 'fish' && isFish2);
}

/** Whether the Fish-family model is a MiniMax engine */
export function isMiniMaxModel(model?: string): boolean {
  return /minimax/i.test(String(model || ''));
}

/** Qwen / CosyVoice / Qwen-Audio family (instruction-following) */
export function isQwenFamily(provider: string, model?: string): boolean {
  if (provider === 'qwen') return true;
  const m = String(model || '').toLowerCase();
  return /cosyvoice|qwen-audio|qwen3-tts|qwen-tts/.test(m);
}

/** OpenAI Chat Completions Audio family (not the /audio/speech endpoint) */
export function isOpenAiAudioFamily(provider: string, model?: string): boolean {
  if (provider === 'openai-speech') return false;
  if (provider === 'openai') return true;
  return /gpt-4o.*audio/.test(String(model || '').toLowerCase());
}

/** Irodori TTS (audio.cpp instruction option) */
export function isIrodoriModel(model?: string): boolean {
  return /irodori/i.test(String(model || ''));
}

/** VOICEVOX / AivisSpeech local engines (acoustic query params) */
export function isVoicevoxFamily(provider: string): boolean {
  const p = String(provider || '').toLowerCase();
  return p === 'voicevox' || p === 'aivis';
}

/** Higgs Audio (Boson AI) — inline `<|emotion:…|>` special tokens */
export function isHiggsModel(provider: string, model?: string): boolean {
  return /higgs|boson/i.test(String(provider || '')) || /higgs/i.test(String(model || ''));
}

/** OmniVoice (k2-fsa) — inline non-verbal `[laughter]`-style tags */
export function isOmniVoiceModel(provider: string, model?: string): boolean {
  return /omnivoice/i.test(String(provider || '')) || /omnivoice/i.test(String(model || ''));
}

/**
 * Fish Audio S2 / S2.1 generation models — inline `[bracket]` emotion cues.
 * Matches "s2", "s2.1", "s21", "s2pro", "s2-pro", "s21pro" bounded by
 * non-alphanumeric characters, so qualified model IDs work too (e.g.
 * `s2.1-pro-free`, `s2-pro`, `fishaudio-s21pro-flash`, `fishaudio-s2pro`,
 * `fish-audio/s2.1-pro-free:free`).
 * Legacy S1 and MiniMax models are excluded.
 */
export function isFishS2Model(model?: string): boolean {
  return /(^|[^a-z0-9])s2(?:\.1|1)?(?:pro)?(?:[^a-z0-9]|$)/i.test(String(model || ''));
}

/**
 * Safely evaluate a strategy's `matches` predicate (defensive against
 * strategies throwing during matching).
 */
export function strategyMatches(
  strategy: { matches(provider: string, model?: string): boolean },
  provider: string,
  model?: string
): boolean {
  try {
    return strategy.matches(provider, model);
  } catch {
    return false;
  }
}
