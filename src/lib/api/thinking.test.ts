import { describe, it, expect } from 'vitest';
import {
  normalizeEffort,
  mapEffort,
  detectThinkingStyle,
  attachThinking,
  guessContext,
  estTokens,
  estMessages,
  parseModelEntry,
} from './thinking';

describe('api thinking module', () => {
  describe('normalizeEffort', () => {
    it('normalizes various effort aliases', () => {
      expect(normalizeEffort('')).toBe('default');
      expect(normalizeEffort('default')).toBe('default');
      expect(normalizeEffort('none')).toBe('off');
      expect(normalizeEffort('disabled')).toBe('off');
      expect(normalizeEffort('false')).toBe('off');
      expect(normalizeEffort('minimal')).toBe('low');
      expect(normalizeEffort('min')).toBe('low');
      expect(normalizeEffort('mid')).toBe('medium');
      expect(normalizeEffort('medium')).toBe('medium');
      expect(normalizeEffort('extra-high')).toBe('xhigh');
      expect(normalizeEffort('max')).toBe('max');
      expect(normalizeEffort('unknown-foo')).toBe('default');
    });
  });

  describe('mapEffort', () => {
    it('returns null for default effort or empty available options', () => {
      expect(mapEffort('default', ['low', 'high'])).toBeNull();
      expect(mapEffort('high', [])).toBeNull();
    });

    it('returns exact match if present in available list', () => {
      expect(mapEffort('medium', ['low', 'medium', 'high'])).toBe('medium');
      expect(mapEffort('low', ['off', 'low', 'max'])).toBe('low');
    });

    it('finds closest available rank when exact token is absent', () => {
      // xhigh (rank 4) -> closest in ['low' (1), 'high' (3)] is 'high'
      expect(mapEffort('xhigh', ['low', 'high'])).toBe('high');
      // medium (rank 2) in ['low' (1), 'max' (5)] -> d=1 to low, d=3 to max -> chooses low
      expect(mapEffort('medium', ['low', 'max'])).toBe('low');
    });
  });

  describe('detectThinkingStyle', () => {
    it('respects explicit setting when not auto', () => {
      expect(detectThinkingStyle({ thinkingStyle: 'qwen' })).toBe('qwen');
      expect(detectThinkingStyle({ thinkingStyle: 'openrouter' })).toBe('openrouter');
    });

    it('infers from URL and model ID when auto', () => {
      expect(detectThinkingStyle({ baseUrl: 'https://openrouter.ai/api/v1', thinkingStyle: 'auto' })).toBe(
        'openrouter'
      );

      expect(detectThinkingStyle({ baseUrl: 'https://dashscope.aliyuncs.com', thinkingStyle: 'auto' })).toBe(
        'qwen'
      );

      expect(detectThinkingStyle({ baseUrl: 'https://open.bigmodel.cn/api/paas/v4' })).toBe('glm');

      expect(detectThinkingStyle({ baseUrl: 'https://api.openai.com/v1', model: 'o1-mini' })).toBe('openai');
    });
  });

  describe('attachThinking', () => {
    it('attaches reasoning_effort for OpenAI', () => {
      const body: Record<string, unknown> = { model: 'o1' };
      attachThinking(body, {
        baseUrl: 'https://api.openai.com/v1',
        model: 'o1',
        thinking: 'on',
        thinkingEffort: 'medium',
      });
      expect(body.reasoning_effort).toBe('medium');
    });

    it('attaches reasoning object for OpenRouter', () => {
      const body: Record<string, unknown> = { model: 'anthropic/claude-3.7-sonnet' };
      attachThinking(body, {
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-3.7-sonnet',
        thinking: 'on',
        thinkingEffort: 'high',
      });
      expect(body.reasoning).toEqual({ effort: 'high' });
    });

    it('attaches enable_thinking and budget for Qwen', () => {
      const body: Record<string, unknown> = { model: 'qwq-32b' };
      attachThinking(body, {
        baseUrl: 'https://dashscope.aliyuncs.com',
        model: 'qwq-32b',
        thinking: 'on',
        thinkingEffort: 'low',
      });
      expect(body.enable_thinking).toBe(true);
      expect(body.thinking_budget).toBe(512);
    });

    it('disables thinking when effort is off', () => {
      const body: Record<string, unknown> = { model: 'qwq-32b' };
      attachThinking(body, {
        baseUrl: 'https://dashscope.aliyuncs.com',
        model: 'qwq-32b',
        thinking: 'off',
      });
      expect(body.enable_thinking).toBe(false);
    });
  });

  describe('token & context estimation', () => {
    it('estimates tokens with heavier weight for CJK characters', () => {
      const asciiTokens = estTokens('hello world');
      const cjkTokens = estTokens('こんにちは世界');
      expect(asciiTokens).toBeLessThan(cjkTokens);
    });

    it('estimates message array overhead', () => {
      const msgs = [
        { role: 'system', content: 'You are Ryza.' },
        { role: 'user', content: 'Hello!' },
      ];
      expect(estMessages(msgs)).toBeGreaterThan(16);
    });

    it('guesses context window from known model IDs', () => {
      expect(guessContext('gpt-4o')).toBe(128000);
      expect(guessContext('claude-3-5-sonnet')).toBe(200000);
      expect(guessContext('qwen-plus')).toBe(32768);
      expect(guessContext('unrecognized-model')).toBe(0);
    });

    it('parses model entries from /v1/models response', () => {
      const entry = parseModelEntry({
        id: 'qwen-max',
        max_model_len: 32768,
        supported_parameters: ['enable_thinking'],
      });
      expect(entry?.id).toBe('qwen-max');
      expect(entry?.context).toBe(32768);
      expect(entry?.thinking).toBe(true);
    });
  });
});
