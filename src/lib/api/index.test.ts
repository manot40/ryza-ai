import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  localProxy,
  upstreamUrl,
  replyLang,
  translate,
  chat,
  complete,
  listModels,
  Api,
  createTransportError,
  isTransportError,
  fetchTransport,
} from './index';
import { config } from '$lib/stores/config.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('api index module', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new LocalStorageMock());
    config._resetForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('URL & Proxy routing', () => {
    it('constructs upstream URL by trimming slashes', () => {
      expect(upstreamUrl('https://api.openai.com/v1///', '/chat/completions')).toBe(
        'https://api.openai.com/v1/chat/completions'
      );
    });

    it('rewrites external https URLs to /_proxy?u=...', () => {
      const target = 'https://api.openai.com/v1/chat/completions';
      expect(localProxy(target)).toBe('/_proxy?u=' + encodeURIComponent(target));
    });

    it('preserves already-proxied or relative paths', () => {
      expect(localProxy('/_proxy?u=test')).toBe('/_proxy?u=test');
      expect(localProxy('/config/providers.json')).toBe('/config/providers.json');
    });
  });

  describe('replyLang', () => {
    it('returns configured LLM language or fallback', () => {
      config.setApp('lang', 'en');
      config.setLLM('lang', 'auto');
      expect(replyLang()).toBe('en');

      config.setLLM('lang', 'ja');
      expect(replyLang()).toBe('ja');
    });
  });

  describe('translate', () => {
    it('returns original text if target language is empty or matches replyLang', async () => {
      config.setLLM('lang', 'ja');
      expect(await translate('こんにちは', 'ja')).toBe('こんにちは');
      expect(await translate('こんにちは', '')).toBe('こんにちは');
    });

    it('invokes LLM translation when target language differs', async () => {
      config.setLLM({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        lang: 'ja',
      });

      const mockResponse = {
        choices: [{ message: { content: 'Hello there!' } }],
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await translate('こんにちは', 'en');
      expect(res).toBe('Hello there!');
    });
  });

  describe('chat & complete', () => {
    it('rejects chat when no API key is set', async () => {
      config.setLLM('apiKey', '');
      await expect(chat([], 'Hello')).rejects.toThrow('NO_KEY');
    });

    it('sends chat request, strips tags and returns TaggedReply', async () => {
      config.setLLM({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
      });

      const mockReply = {
        choices: [
          {
            message: {
              content: '[emotion:happy|attitude:agree]\n元気だよ！\n<state>{"money_delta": 10}</state>',
            },
          },
        ],
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockReply,
        })
      );

      const reply = await chat([], 'How are you?');
      expect(reply.emotion).toBe('happy');
      expect(reply.attitude).toBe('agree');
      expect(reply.text).toBe('元気だよ！');
      expect(reply.state?.money_delta).toBe(10);
    });

    it('performs minimal completion for summaries', async () => {
      config.setLLM({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
      });

      const mockReply = {
        choices: [{ message: { content: '・Summary of the day' } }],
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockReply,
        })
      );

      const res = await complete('Summarize', 'Turn 1, Turn 2');
      expect(res).toBe('・Summary of the day');
    });
  });

  describe('listModels', () => {
    it('fetches and sorts model list', async () => {
      config.setLLM({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
      });

      const mockData = {
        data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }],
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockData,
        })
      );

      const models = await listModels();
      expect(models.length).toBe(2);
      expect(models[0].id).toBe('gpt-3.5-turbo');
      expect(models[1].id).toBe('gpt-4o');
    });
  });

  describe('Transport Error classification', () => {
    it('creates transport errors with code and custom or default messages', () => {
      const err = createTransportError('timeout');
      expect(err.code).toBe('timeout');
      expect(isTransportError(err)).toBe(true);
      expect(err.message).toContain('Timed out');

      const netErr = createTransportError('net', 'Custom net error');
      expect(netErr.code).toBe('net');
      expect(isTransportError(netErr)).toBe(true);
      expect(netErr.message).toBe('Custom net error');

      expect(isTransportError(new Error('regular'))).toBe(false);
      expect(isTransportError(null)).toBe(false);
    });

    it('classifies TimeoutError into transport timeout', async () => {
      const timeoutError = new Error('The operation was aborted due to timeout');
      timeoutError.name = 'TimeoutError';
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

      await expect(fetchTransport('https://example.com', {}, 1000)).rejects.toMatchObject({
        code: 'timeout',
      });
    });

    it('classifies network connection failure into transport net', async () => {
      const netError = new TypeError('Failed to fetch');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(netError));

      await expect(fetchTransport('https://example.com', {}, 1000)).rejects.toMatchObject({
        code: 'net',
      });
    });
  });
});
