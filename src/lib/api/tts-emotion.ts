import { EMOTIONS, type Emotion } from './tags';
import {
  isFishOrMiniMax,
  isIrodoriModel,
  isMiniMaxModel,
  isOpenAiAudioFamily,
  isQwenFamily,
  isVoicevoxFamily,
} from './model-detect';

export interface EmotionContext {
  text: string;
  emotion?: string;
  attitude?: string;
  mode?: string;
  lang?: string;
  model?: string;
  provider: string;
}

export interface EmotionAdaptation {
  /** Modified speech text if model requires inline cues */
  text?: string;
  /** Augmented or generated natural language style/system instruction */
  instruction?: string;
  /** Key-value pairs to merge into request payload (e.g., { emotion: 'happy' }) */
  payload?: Record<string, unknown>;
  /** Acoustic modifier for VOICEVOX / Aivis audio_query result */
  queryModifier?: (query: Record<string, unknown>) => void;
}

export interface TtsEmotionStrategy {
  readonly id: string;
  matches(provider: string, model?: string): boolean;
  adapt(ctx: EmotionContext, baseInstruction?: string): EmotionAdaptation;
}

/** Canonical emotion normalization mapping aliases/synonyms to standard Emotion */
export function normalizeEmotion(raw?: string): Emotion {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  if ((EMOTIONS as readonly string[]).includes(s)) {
    return s as Emotion;
  }
  const ALIASES: Record<string, Emotion> = {
    smile: 'happy',
    joy: 'happy',
    cheerful: 'happy',
    chuckle: 'laughing',
    giggle: 'laughing',
    smug: 'tease',
    prank: 'tease',
    surprised: 'tease',
    embarrassed: 'shy',
    blush: 'shy',
    love: 'cuddle',
    hug: 'cuddle',
    sweet: 'cuddle',
    sorrow: 'sad',
    gloomy: 'sad',
    sob: 'crying',
    tearful: 'crying',
    mad: 'angry',
    rage: 'angry',
    calm: 'neutral',
  };
  return ALIASES[s] || 'neutral';
}

/** Localized natural language directives for instruction-following models */
const EMOTION_PROMPTS: Record<'ja' | 'zh' | 'en', Record<Emotion, string>> = {
  ja: {
    happy: '明るく楽しそうに、弾んだ声で',
    laughing: '思わず笑いがこぼれるように楽しそうに',
    tease: 'ちょっといたずらっぽく、からかうように',
    shy: '照れくさそうに、少し恥ずかしそうに',
    cuddle: '優しく甘えるように、柔らかい声で',
    sad: '悲しそうに、切ない声で',
    crying: '泣きそうになりながら、消え入りそうな声で',
    angry: '少し怒りを込めて、むっとした強めの口調で',
    neutral: '自然で落ち着いた普段の調子で',
  },
  zh: {
    happy: '用欢快开心的语气',
    laughing: '带着忍不住的笑意，开怀地',
    tease: '带着戏谑调侃的小调皮语气',
    shy: '害羞腼腆、略显不好意思的语气',
    cuddle: '温柔撒娇、亲近柔和的语气',
    sad: '用悲伤难过、低落的语气',
    crying: '带着哭腔、委屈抽泣的语气',
    angry: '带着恼怒生气、微嗔略冲的语气',
    neutral: '自然平和的日常语气',
  },
  en: {
    happy: 'cheerfully, in an upbeat and joyful tone',
    laughing: 'with a chuckle and infectious laughter',
    tease: 'playfully teasing, with mischievous warmth',
    shy: 'shyly and bashfully, slightly hesitant',
    cuddle: 'sweetly and affectionately, in a gentle warm voice',
    sad: 'sadly, with a mournful and sorrowful voice',
    crying: 'teary-eyed and distressed, on the verge of tears',
    angry: 'with irritation and a firm angry tone',
    neutral: 'in a calm, natural everyday tone',
  },
};

export function getEmotionPrompt(emotion: string | undefined, lang: string = 'ja'): string {
  const norm = normalizeEmotion(emotion);
  if (norm === 'neutral') return '';
  const l = (lang || 'ja').toLowerCase().slice(0, 2);
  const table = l === 'zh' ? EMOTION_PROMPTS.zh : l === 'en' ? EMOTION_PROMPTS.en : EMOTION_PROMPTS.ja;
  return table[norm] || EMOTION_PROMPTS.ja[norm] || '';
}

function combineInstruction(base?: string, addition?: string): string {
  const b = String(base || '').trim();
  const a = String(addition || '').trim();
  if (b && a) return `${b} ${a}`;
  return b || a;
}

/** Fish Audio / MiniMax strategy: outputs payload.emotion for MiniMax or prompt for instruction models */
export const MiniMaxFishStrategy: TtsEmotionStrategy = {
  id: 'minimax-fish',
  matches: isFishOrMiniMax,
  adapt(ctx: EmotionContext, baseInstruction?: string): EmotionAdaptation {
    const norm = normalizeEmotion(ctx.emotion);
    const isMiniMax = isMiniMaxModel(ctx.model);

    const out: EmotionAdaptation = {};
    if (isMiniMax) {
      const map: Record<Emotion, string> = {
        happy: 'happy',
        laughing: 'happy',
        tease: 'surprised',
        shy: 'calm',
        cuddle: 'calm',
        sad: 'sad',
        crying: 'sad',
        angry: 'angry',
        neutral: 'calm',
      };
      out.payload = { emotion: map[norm] || 'calm' };
    }

    const prompt = getEmotionPrompt(norm, ctx.lang || 'ja');
    if (prompt) {
      out.instruction = combineInstruction(baseInstruction, prompt);
    } else if (baseInstruction) {
      out.instruction = baseInstruction;
    }
    return out;
  },
};

/** Qwen / CosyVoice / Qwen-Audio strategy: appends localized tone directive to instruction */
export const QwenCosyVoiceStrategy: TtsEmotionStrategy = {
  id: 'qwen-cosyvoice',
  matches(provider: string, model?: string) {
    return isQwenFamily(provider, model);
  },
  adapt(ctx: EmotionContext, baseInstruction?: string): EmotionAdaptation {
    const prompt = getEmotionPrompt(ctx.emotion, ctx.lang || 'ja');
    return {
      instruction: combineInstruction(baseInstruction, prompt),
    };
  },
};

/** OpenAI Chat Completions Audio strategy: injects emotion directive into system instruction */
export const OpenAiAudioStrategy: TtsEmotionStrategy = {
  id: 'openai-audio',
  matches(provider: string, model?: string) {
    return isOpenAiAudioFamily(provider, model);
  },
  adapt(ctx: EmotionContext, baseInstruction?: string): EmotionAdaptation {
    const prompt = getEmotionPrompt(ctx.emotion, ctx.lang || 'en');
    const instruction = combineInstruction(
      baseInstruction ||
        'You are a text-to-speech engine. Output ONLY the audio for the user input without preamble.',
      prompt ? `Tone/emotion directive: ${prompt}.` : ''
    );
    return { instruction };
  },
};

/** Irodori TTS strategy: concise Japanese style directives for audio.cpp instruction option */
export const IrodoriStrategy: TtsEmotionStrategy = {
  id: 'irodori-tts',
  matches(_provider: string, model?: string) {
    return isIrodoriModel(model);
  },
  adapt(ctx: EmotionContext, baseInstruction?: string): EmotionAdaptation {
    const norm = normalizeEmotion(ctx.emotion);
    const map: Record<Emotion, string> = {
      happy: '元気に',
      laughing: '楽しそうに笑いながら',
      tease: 'いたずらっぽくからかって',
      shy: '照れながら',
      cuddle: '甘えるように優しく',
      sad: '悲しそうに',
      crying: '泣きそうに',
      angry: '怒って',
      neutral: '',
    };
    const directive = map[norm] || '';
    return {
      instruction: combineInstruction(baseInstruction, directive),
    };
  },
};

/** VOICEVOX / AivisSpeech strategy: adjusts audio_query acoustic parameters */
export const VoicevoxStrategy: TtsEmotionStrategy = {
  id: 'voicevox',
  matches(provider: string) {
    return isVoicevoxFamily(provider);
  },
  adapt(ctx: EmotionContext): EmotionAdaptation {
    const norm = normalizeEmotion(ctx.emotion);
    return {
      queryModifier(query: Record<string, unknown>) {
        if (norm === 'neutral') return;

        const num = (k: string, d: number) => (typeof query[k] === 'number' ? (query[k] as number) : d);

        let intonation = num('intonationScale', 1.0);
        let speed = num('speedScale', 1.0);
        let pitch = num('pitchScale', 0.0);
        let volume = num('volumeScale', 1.0);

        switch (norm) {
          case 'happy':
            intonation = Number((intonation * 1.15).toFixed(2));
            speed = Number((speed * 1.04).toFixed(2));
            break;
          case 'laughing':
            intonation = Number((intonation * 1.2).toFixed(2));
            speed = Number((speed * 1.05).toFixed(2));
            break;
          case 'tease':
            intonation = Number((intonation * 1.1).toFixed(2));
            pitch = Number((pitch + 0.03).toFixed(2));
            break;
          case 'shy':
            intonation = Number((intonation * 0.95).toFixed(2));
            speed = Number((speed * 0.96).toFixed(2));
            pitch = Number((pitch + 0.02).toFixed(2));
            break;
          case 'cuddle':
            intonation = Number((intonation * 0.92).toFixed(2));
            speed = Number((speed * 0.95).toFixed(2));
            pitch = Number((pitch - 0.02).toFixed(2));
            break;
          case 'sad':
            intonation = Number((intonation * 0.85).toFixed(2));
            speed = Number((speed * 0.94).toFixed(2));
            pitch = Number((pitch - 0.04).toFixed(2));
            break;
          case 'crying':
            intonation = Number((intonation * 0.8).toFixed(2));
            speed = Number((speed * 0.9).toFixed(2));
            pitch = Number((pitch - 0.06).toFixed(2));
            break;
          case 'angry':
            intonation = Number((intonation * 1.25).toFixed(2));
            volume = Number((volume * 1.1).toFixed(2));
            speed = Number((speed * 1.04).toFixed(2));
            break;
        }

        query.intonationScale = intonation;
        query.speedScale = speed;
        query.pitchScale = pitch;
        query.volumeScale = volume;
      },
    };
  },
};

/** Default / Fallback strategy */
export const DefaultEmotionStrategy: TtsEmotionStrategy = {
  id: 'default',
  matches() {
    return true;
  },
  adapt(ctx: EmotionContext, baseInstruction?: string): EmotionAdaptation {
    const prompt = getEmotionPrompt(ctx.emotion, ctx.lang || 'ja');
    return {
      instruction: combineInstruction(baseInstruction, prompt),
    };
  },
};

/** Ordered list of strategies checked in sequence */
const STRATEGIES: TtsEmotionStrategy[] = [
  IrodoriStrategy,
  MiniMaxFishStrategy,
  VoicevoxStrategy,
  QwenCosyVoiceStrategy,
  OpenAiAudioStrategy,
  DefaultEmotionStrategy,
];

/** Resolve appropriate emotion adaptation for a given provider, model, and context */
export function resolveEmotionAdaptation(ctx: EmotionContext, baseInstruction?: string): EmotionAdaptation {
  const strategy = STRATEGIES.find((s) => s.matches(ctx.provider, ctx.model)) || DefaultEmotionStrategy;
  return strategy.adapt(ctx, baseInstruction);
}
