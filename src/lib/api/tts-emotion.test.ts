import { describe, it, expect } from 'vitest';
import {
  normalizeEmotion,
  getEmotionPrompt,
  resolveEmotionAdaptation,
  MiniMaxFishStrategy,
  QwenCosyVoiceStrategy,
  OpenAiAudioStrategy,
  IrodoriStrategy,
  VoicevoxStrategy,
} from './tts-emotion';

describe('normalizeEmotion', () => {
  it('preserves valid canonical emotions', () => {
    expect(normalizeEmotion('happy')).toBe('happy');
    expect(normalizeEmotion('sad')).toBe('sad');
    expect(normalizeEmotion('crying')).toBe('crying');
    expect(normalizeEmotion('angry')).toBe('angry');
    expect(normalizeEmotion('neutral')).toBe('neutral');
  });

  it('maps synonyms and aliases to standard emotions', () => {
    expect(normalizeEmotion('smile')).toBe('happy');
    expect(normalizeEmotion('joy')).toBe('happy');
    expect(normalizeEmotion('chuckle')).toBe('laughing');
    expect(normalizeEmotion('smug')).toBe('tease');
    expect(normalizeEmotion('blush')).toBe('shy');
    expect(normalizeEmotion('love')).toBe('cuddle');
    expect(normalizeEmotion('sob')).toBe('crying');
    expect(normalizeEmotion('mad')).toBe('angry');
  });

  it('defaults unknown or undefined to neutral', () => {
    expect(normalizeEmotion(undefined)).toBe('neutral');
    expect(normalizeEmotion('')).toBe('neutral');
    expect(normalizeEmotion('unrecognized_emotion_tag')).toBe('neutral');
  });
});

describe('getEmotionPrompt', () => {
  it('returns localized emotion prompts for ja, zh, and en', () => {
    expect(getEmotionPrompt('happy', 'ja')).toContain('明るく');
    expect(getEmotionPrompt('happy', 'zh')).toContain('欢快');
    expect(getEmotionPrompt('happy', 'en')).toContain('cheerfully');

    expect(getEmotionPrompt('sad', 'ja')).toContain('悲しそうに');
    expect(getEmotionPrompt('sad', 'zh')).toContain('悲伤');
    expect(getEmotionPrompt('sad', 'en')).toContain('sadly');
  });

  it('returns empty string for neutral emotion', () => {
    expect(getEmotionPrompt('neutral', 'ja')).toBe('');
    expect(getEmotionPrompt('calm', 'zh')).toBe('');
  });
});

describe('MiniMaxFishStrategy', () => {
  it('matches minimax models and fish provider', () => {
    expect(MiniMaxFishStrategy.matches('fish', 's2.1-pro-free')).toBe(true);
    expect(MiniMaxFishStrategy.matches('openai', 'minimax-tts-01')).toBe(true);
    expect(MiniMaxFishStrategy.matches('openai', 'gpt-4o')).toBe(false);
  });

  it('sets payload.emotion for MiniMax models', () => {
    const res = MiniMaxFishStrategy.adapt({
      text: 'Hello',
      emotion: 'happy',
      mode: 'chat',
      lang: 'ja',
      model: 'minimax-speech-01',
      provider: 'fish',
    });
    expect(res.payload?.emotion).toBe('happy');
  });

  it('maps tease to surprised and shy to calm for MiniMax payload', () => {
    const teaseRes = MiniMaxFishStrategy.adapt({
      text: 'Teasing you',
      emotion: 'tease',
      mode: 'chat',
      model: 'minimax',
      provider: 'fish',
    });
    expect(teaseRes.payload?.emotion).toBe('surprised');

    const shyRes = MiniMaxFishStrategy.adapt({
      text: 'Shy line',
      emotion: 'shy',
      mode: 'chat',
      model: 'minimax',
      provider: 'fish',
    });
    expect(shyRes.payload?.emotion).toBe('calm');
  });
});

describe('QwenCosyVoiceStrategy', () => {
  it('matches qwen provider and cosyvoice/qwen-audio models', () => {
    expect(QwenCosyVoiceStrategy.matches('qwen', 'qwen3-tts-flash')).toBe(true);
    expect(QwenCosyVoiceStrategy.matches('openai', 'cosyvoice-v3.5-flash')).toBe(true);
    expect(QwenCosyVoiceStrategy.matches('openai', 'qwen-audio-turbo')).toBe(true);
    expect(QwenCosyVoiceStrategy.matches('fish', 's2.1')).toBe(false);
  });

  it('appends localized Japanese emotion instruction to existing style', () => {
    const res = QwenCosyVoiceStrategy.adapt(
      {
        text: 'こんにちは！',
        emotion: 'happy',
        mode: 'chat',
        lang: 'ja',
        model: 'cosyvoice-v3.5',
        provider: 'qwen',
      },
      '親しみやすく'
    );
    expect(res.instruction).toContain('親しみやすく');
    expect(res.instruction).toContain('明るく楽しそうに');
  });

  it('appends localized Chinese emotion instruction when lang is zh', () => {
    const res = QwenCosyVoiceStrategy.adapt(
      {
        text: '你好！',
        emotion: 'sad',
        mode: 'chat',
        lang: 'zh',
        model: 'qwen3-tts-flash',
        provider: 'qwen',
      },
      '角色扮演'
    );
    expect(res.instruction).toContain('角色扮演');
    expect(res.instruction).toContain('用悲伤难过');
  });
});

describe('OpenAiAudioStrategy', () => {
  it('matches openai provider and gpt-4o-audio models', () => {
    expect(OpenAiAudioStrategy.matches('openai', 'gpt-4o-audio-preview')).toBe(true);
    expect(OpenAiAudioStrategy.matches('openai-speech', 'tts-1')).toBe(false);
  });

  it('augments system instruction with emotion directive', () => {
    const res = OpenAiAudioStrategy.adapt(
      {
        text: 'Hello!',
        emotion: 'happy',
        mode: 'chat',
        lang: 'en',
        model: 'gpt-4o-audio-preview',
        provider: 'openai',
      },
      'You are Ryza.'
    );
    expect(res.instruction).toContain('You are Ryza.');
    expect(res.instruction).toContain('cheerfully');
  });
});

describe('IrodoriStrategy', () => {
  it('matches irodori models', () => {
    expect(IrodoriStrategy.matches('openai-speech', 'irodori-tts-v1')).toBe(true);
    expect(IrodoriStrategy.matches('openai-speech', 'tts-1')).toBe(false);
  });

  it('generates concise Japanese instruction', () => {
    const res = IrodoriStrategy.adapt({
      text: 'えへへ',
      emotion: 'shy',
      mode: 'chat',
      lang: 'ja',
      model: 'irodori-tts',
      provider: 'openai-speech',
    });
    expect(res.instruction).toBe('照れながら');
  });
});

describe('VoicevoxStrategy', () => {
  it('matches voicevox and aivis providers', () => {
    expect(VoicevoxStrategy.matches('voicevox')).toBe(true);
    expect(VoicevoxStrategy.matches('aivis')).toBe(true);
    expect(VoicevoxStrategy.matches('qwen')).toBe(false);
  });

  it('modulates audio_query parameters for happy emotion', () => {
    const res = VoicevoxStrategy.adapt({
      text: 'やったー！',
      emotion: 'happy',
      mode: 'chat',
      lang: 'ja',
      provider: 'voicevox',
    });
    expect(res.queryModifier).toBeDefined();

    const query: Record<string, unknown> = {
      intonationScale: 1.0,
      speedScale: 1.0,
      pitchScale: 0.0,
      volumeScale: 1.0,
    };
    res.queryModifier!(query);

    expect(query.intonationScale).toBeGreaterThan(1.0);
    expect(query.speedScale).toBeGreaterThan(1.0);
  });

  it('modulates audio_query parameters for sad emotion', () => {
    const res = VoicevoxStrategy.adapt({
      text: 'そんな…',
      emotion: 'sad',
      mode: 'chat',
      lang: 'ja',
      provider: 'aivis',
    });
    const query: Record<string, unknown> = {
      intonationScale: 1.0,
      speedScale: 1.0,
      pitchScale: 0.0,
      volumeScale: 1.0,
    };
    res.queryModifier!(query);

    expect(query.intonationScale).toBeLessThan(1.0);
    expect(query.pitchScale).toBeLessThan(0.0);
  });

  it('leaves query unchanged for neutral emotion', () => {
    const res = VoicevoxStrategy.adapt({
      text: 'そうなんだ。',
      emotion: 'neutral',
      mode: 'chat',
      lang: 'ja',
      provider: 'voicevox',
    });
    const query: Record<string, unknown> = {
      intonationScale: 1.0,
      speedScale: 1.0,
    };
    res.queryModifier!(query);
    expect(query.intonationScale).toBe(1.0);
    expect(query.speedScale).toBe(1.0);
  });
});

describe('resolveEmotionAdaptation dispatcher', () => {
  it('dispatches to MiniMaxFishStrategy when provider is fish and model is minimax', () => {
    const res = resolveEmotionAdaptation({
      text: 'テスト',
      emotion: 'angry',
      mode: 'chat',
      lang: 'ja',
      model: 'minimax-tts',
      provider: 'fish',
    });
    expect(res.payload?.emotion).toBe('angry');
  });

  it('dispatches to QwenCosyVoiceStrategy when provider is qwen', () => {
    const res = resolveEmotionAdaptation(
      {
        text: 'テスト',
        emotion: 'cuddle',
        mode: 'chat',
        lang: 'ja',
        model: 'qwen3-tts-flash',
        provider: 'qwen',
      },
      'base'
    );
    expect(res.instruction).toContain('甘えるように');
  });
});
