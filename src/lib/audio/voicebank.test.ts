import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceBankService, getVoiceLocale } from './voicebank';
import type { VoiceBankIndex } from './voicebank';

const mockIndex: VoiceBankIndex = {
  ja: {
    normal: {
      goodMorning: {
        morning: ['assets/audio/alarm/ja/normal/goodMorning/morning/1.m4a'],
      },
      task: {
        daytime: ['assets/audio/alarm/ja/normal/task/daytime/1.m4a'],
      },
    },
  },
  en: {
    normal: {
      goodMorning: {
        morning: ['assets/audio/alarm/en/normal/goodMorning/morning/1.m4a'],
      },
    },
  },
};

describe('voicebank', () => {
  let vb: VoiceBankService;

  beforeEach(async () => {
    vb = new VoiceBankService();
    await vb.load(mockIndex);
  });

  it('returns correct voice locale mapping', () => {
    expect(getVoiceLocale('ja')).toEqual({ alarm: 'ja', tap: 'jp', prologue: 'jp' });
    expect(getVoiceLocale('zh')).toEqual({ alarm: 'zh-tw', tap: 'zh-tw', prologue: 'zh-tw' });
    expect(getVoiceLocale('en')).toEqual({ alarm: 'en', tap: 'en', prologue: 'en' });
    expect(getVoiceLocale('unknown')).toEqual({ alarm: 'ja', tap: 'jp', prologue: 'jp' });
  });

  it('picks clips based on type, style, and tod', () => {
    const clip = vb.pick('goodMorning', 'normal', 'morning', 'ja');
    expect(clip).toBe('assets/audio/alarm/ja/normal/goodMorning/morning/1.m4a');
  });

  it('falls back to default tod if requested tod not found', () => {
    // 'night' not present in task, should fall back to daytime or first key
    const clip = vb.pick('task', 'normal', 'night', 'ja');
    expect(clip).toBe('assets/audio/alarm/ja/normal/task/daytime/1.m4a');
  });

  it('returns null if index is missing or key cannot be resolved', () => {
    const uninit = new VoiceBankService();
    expect(uninit.pick()).toBeNull();
    expect(vb.pick('nonexistent', 'normal', 'morning', 'ja')).toBe(
      'assets/audio/alarm/ja/normal/goodMorning/morning/1.m4a'
    ); // falls back to goodMorning
  });

  it('computes lipsync envelope path correctly', () => {
    expect(vb.envPath('assets/audio/alarm/ja/1.m4a')).toBe('assets/audio/alarm/ja/1.env.json');
    expect(vb.envPath(null)).toBeNull();
  });
});
