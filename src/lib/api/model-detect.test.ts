import { describe, it, expect } from 'vitest';
import {
  isMiniMaxModel,
  isQwenFamily,
  isOpenAiAudioFamily,
  isIrodoriModel,
  isVoicevoxFamily,
  isHiggsModel,
  isOmniVoiceModel,
  isFishS2Model,
  strategyMatches,
} from './model-detect';

describe('isMiniMaxModel', () => {
  it('detects MiniMax engine models', () => {
    expect(isMiniMaxModel('minimax-2.8-hd')).toBe(true);
    expect(isMiniMaxModel('minimax-tts-01')).toBe(true);
    expect(isMiniMaxModel('MiniMax-Speech-02')).toBe(true);
  });

  it('rejects non-MiniMax models', () => {
    expect(isMiniMaxModel('s2.1-pro-free')).toBe(false);
    expect(isMiniMaxModel('fishaudio-s1')).toBe(false);
    expect(isMiniMaxModel('')).toBe(false);
    expect(isMiniMaxModel(undefined)).toBe(false);
  });
});

describe('isFishS2Model', () => {
  it('detects Fish S2 / S2.1 generation models', () => {
    expect(isFishS2Model('s2.1-pro-free')).toBe(true);
    expect(isFishS2Model('s2-pro')).toBe(true);
    expect(isFishS2Model('fishaudio-s21pro')).toBe(true);
    expect(isFishS2Model('fishaudio-s21pro-flash')).toBe(true);
    expect(isFishS2Model('fishaudio-s2pro')).toBe(true);
    expect(isFishS2Model('fishaudio-s2.1pro')).toBe(true);
    expect(isFishS2Model('s2.1')).toBe(true);
    expect(isFishS2Model('s21pro')).toBe(true);
    expect(isFishS2Model('fish-audio/s2.1-pro-free:free')).toBe(true);
    expect(isFishS2Model('openai/s2-pro')).toBe(true);
    expect(isFishS2Model('s2-pro:free')).toBe(true);
  });

  it('excludes legacy S1 and MiniMax models', () => {
    expect(isFishS2Model('fishaudio-s1')).toBe(false);
    expect(isFishS2Model('fish-audio/s1:free')).toBe(false);
    expect(isFishS2Model('minimax-2.8-hd')).toBe(false);
    expect(isFishS2Model(undefined)).toBe(false);
  });

  it('does not false-positive on s2-adjacent words', () => {
    expect(isFishS2Model('s2professional')).toBe(false);
    expect(isFishS2Model('s2panish')).toBe(false);
    expect(isFishS2Model('s2x')).toBe(false);
    expect(isFishS2Model('gpts2-pro')).toBe(false);
  });
});

describe('isQwenFamily', () => {
  it('matches the qwen provider outright', () => {
    expect(isQwenFamily('qwen', 'anything')).toBe(true);
    expect(isQwenFamily('qwen')).toBe(true);
  });

  it('matches cosyvoice / qwen-audio / qwen-tts models by name', () => {
    expect(isQwenFamily('openai', 'cosyvoice-v3.5-flash')).toBe(true);
    expect(isQwenFamily('fish', 'qwen-audio-3.0-tts-plus')).toBe(true);
    expect(isQwenFamily('fish', 'qwen3-tts-flash')).toBe(true);
  });

  it('rejects models outside the qwen family', () => {
    expect(isQwenFamily('qwenx', 'gpt-4o')).toBe(false);
    expect(isQwenFamily('openai', 'gpt-4o-mini-tts')).toBe(false);
  });
});

describe('isOpenAiAudioFamily', () => {
  it('matches the openai chat-completions provider', () => {
    expect(isOpenAiAudioFamily('openai', 'gpt-4o-mini-tts')).toBe(true);
    expect(isOpenAiAudioFamily('openai')).toBe(true);
  });

  it('never matches the /audio/speech endpoint style', () => {
    expect(isOpenAiAudioFamily('openai-speech', 'tts-1')).toBe(false);
    expect(isOpenAiAudioFamily('openai-speech', 'gpt-4o-audio-preview')).toBe(false);
  });

  it('matches gpt-4o audio models by name on other providers', () => {
    expect(isOpenAiAudioFamily('custom', 'gpt-4o-audio-preview')).toBe(true);
    expect(isOpenAiAudioFamily('custom', 'gpt-4o')).toBe(false);
  });
});

describe('isIrodoriModel', () => {
  it('detects irodori models case-insensitively', () => {
    expect(isIrodoriModel('irodori-tts')).toBe(true);
    expect(isIrodoriModel('Irodori-TTS-v2')).toBe(true);
    expect(isIrodoriModel('tts-1')).toBe(false);
  });
});

describe('isVoicevoxFamily', () => {
  it('matches voicevox and aivis providers only', () => {
    expect(isVoicevoxFamily('voicevox')).toBe(true);
    expect(isVoicevoxFamily('aivis')).toBe(true);
    expect(isVoicevoxFamily('qwen')).toBe(false);
    expect(isVoicevoxFamily('')).toBe(false);
  });
});

describe('isHiggsModel', () => {
  it('matches higgs or boson provider names', () => {
    expect(isHiggsModel('boson', '')).toBe(true);
    expect(isHiggsModel('higgs-cloud', '')).toBe(true);
  });

  it('matches higgs models by name on any provider', () => {
    expect(isHiggsModel('openai', 'higgs-audio-v3-tts')).toBe(true);
    expect(isHiggsModel('openai', 'higgs-tts-3')).toBe(true);
  });

  it('rejects unrelated engines', () => {
    expect(isHiggsModel('openai', 'gpt-4o-mini-tts')).toBe(false);
    expect(isHiggsModel('fish', 's2-pro')).toBe(false);
  });
});

describe('isOmniVoiceModel', () => {
  it('matches omnivoice by provider or model name', () => {
    expect(isOmniVoiceModel('omnivoice', '')).toBe(true);
    expect(isOmniVoiceModel('openai', 'omnivoice-base')).toBe(true);
    expect(isOmniVoiceModel('openai', 'OmniVoice-large')).toBe(true);
    expect(isOmniVoiceModel('openai', 'whisper-1')).toBe(false);
  });
});

describe('strategyMatches', () => {
  it('returns the strategy verdict', () => {
    expect(strategyMatches({ matches: () => true }, 'openai', 'x')).toBe(true);
    expect(strategyMatches({ matches: () => false }, 'openai', 'x')).toBe(false);
  });

  it('swallows exceptions and returns false', () => {
    expect(
      strategyMatches(
        {
          matches() {
            throw new Error('boom');
          },
        },
        'openai',
        'x'
      )
    ).toBe(false);
  });
});
