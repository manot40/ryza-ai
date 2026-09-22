import { describe, it, expect, beforeEach } from 'vitest';
import { Echo, remember, looksLikeEcho, lcsRatio, normalize, reset } from './echo';

describe('Echo suppression', () => {
  beforeEach(() => {
    reset();
  });

  it('normalizes strings by keeping alphanumeric characters and converting to lowercase', () => {
    expect(normalize('Hello, World! 123')).toBe('helloworld123');
    expect(normalize('こんにちは！ライザです。')).toBe('こんにちはライザです');
  });

  it('calculates LCS ratio correctly', () => {
    expect(lcsRatio('abc', 'abc')).toBe(1.0);
    expect(lcsRatio('abc', 'def')).toBe(0.0);
    expect(lcsRatio('abcdef', 'abcxyz')).toBeCloseTo((2 * 3) / 12, 2);
  });

  it('detects when transcript matches recently spoken assistant text', () => {
    const speech = '今日はクーケン島を冒険しに行こうよ！楽しみだね。';
    remember(speech, 10000);

    // Exact match
    expect(looksLikeEcho('今日はクーケン島を冒険しに行こうよ！楽しみだね。', 12000)).toBe(true);

    // Minor typo / omission above threshold
    expect(looksLikeEcho('今日はクーケン島を冒険しに行こうよ楽しみだね', 12000)).toBe(true);

    // Completely different user speech
    expect(looksLikeEcho('こんにちは、ライザ！今日の調合は何にする？', 12000)).toBe(false);

    // Outdated speech beyond lookback window
    expect(looksLikeEcho('今日はクーケン島を冒険しに行こうよ！楽しみだね。', 35000)).toBe(false);
  });

  it('ignores strings shorter than MIN_TRANSCRIPT_CHARS', () => {
    remember('はい、わかりました。', 1000);
    expect(looksLikeEcho('はい', 1500)).toBe(false);
  });
});
