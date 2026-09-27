import { generateText } from 'ai';
import { config } from '$lib/stores/config.svelte';
import { Langs } from '$lib/i18n/langs';
import { Providers } from '$lib/api/providers';
import { getEmotionPrompt, normalizeEmotion } from './tts-emotion';
import { buildTextEmotionHint, applyTextEmotionHint } from './text-emotion';
import { getLlmProvider } from './llm';

export interface TranslateOptions {
  text: string;
  toLang?: string;
  /** Emotion of the line; used to hint inline TTS emotion markers when supported */
  emotion?: string;
}

export class TranslationService {
  private cache = new Map<string, string>();
  private readonly maxCacheSize = 128;

  private makeCacheKey(text: string, toLang: string, emotion: string): string {
    return `${text.trim()}|${toLang}|${emotion || 'neutral'}`;
  }

  private setCache(key: string, value: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  private emotionSection(emotion?: string, toLang?: string): string {
    const norm = normalizeEmotion(emotion);
    if (!emotion || norm === 'neutral') return '';
    const directive = getEmotionPrompt(norm, toLang || 'en');
    const feel = directive ? ` — deliver the line ${directive}` : '';
    return ` She is currently feeling "${norm}"${feel}. Keep this feeling in the translation.`;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  hasCached(text: string, toLang: string, emotion?: string): boolean {
    return this.cache.has(this.makeCacheKey(text, toLang, emotion || 'neutral'));
  }

  async translate(opts: TranslateOptions): Promise<string> {
    const { text, toLang, emotion } = opts;
    const replyLang = Langs.llm() || 'ja';
    if (!text || !toLang || toLang === replyLang) {
      return text;
    }

    const cacheKey = this.makeCacheKey(text, toLang, emotion || 'neutral');
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      // Refresh LRU order
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }

    const llm = config.get('llm');
    if (!llm.apiKey) return text;

    let hint = null;
    try {
      const tts = config.get('tts');
      const cred = Providers.credentials(tts);
      const model =
        cred.id === 'openai' && String(tts.mode || '') === 'clone' && tts.modelClone
          ? tts.modelClone
          : cred.model;
      hint = buildTextEmotionHint({ emotion, provider: cred.id, model });
    } catch {
      hint = null;
    }

    const hintBlock = hint ? `\n\n${hint.promptSection}` : '';
    const emotionBlock = this.emotionSection(emotion, toLang);
    const actionBlock =
      ' Lines may contain stage directions wrapped in *asterisks*; they are actions, not speech — never include them in the translation.';

    // Use at least half of main LLM quota with floor 400
    const mainQuota = Number(llm.maxTokens) || 0;
    const maxTokens = Math.max(400, Math.floor(mainQuota / 2));

    try {
      const provider = getLlmProvider(llm);
      const { text: result } = await generateText({
        model: provider.chatModel(llm.model),
        system: `You are a translator for a Japanese anime game character (Ryza, cheerful young alchemist). Translate her line into ${Langs.name(toLang)}, keeping the playful spoken tone, first-person feel and emotion.${emotionBlock}${actionBlock} Output ONLY the translated line — no quotes, notes, linebreaks, or tags.${hintBlock}`,
        prompt: text,
        temperature: 0.3,
        maxOutputTokens: maxTokens,
        abortSignal: AbortSignal.timeout(20000),
      });

      const translated = (result && result.trim()) || text;
      const finalResult = applyTextEmotionHint(translated, hint);
      this.setCache(cacheKey, finalResult);
      return finalResult;
    } catch {
      return text;
    }
  }
}

export const translator = new TranslationService();

export async function translate(opts: TranslateOptions): Promise<string> {
  return translator.translate(opts);
}
