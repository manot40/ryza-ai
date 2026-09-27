import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslationService, translator, translate } from './translator';
import { config } from '$lib/stores/config.svelte';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    config._resetForTest();
    service = new TranslationService();
  });

  it('returns original text if target language is empty or matches replyLang', async () => {
    config.setLLM('lang', 'ja');
    expect(await service.translate({ text: 'こんにちは', toLang: 'ja' })).toBe('こんにちは');
    expect(await service.translate({ text: 'こんにちは', toLang: '' })).toBe('こんにちは');
  });

  it('returns original text if apiKey is not configured', async () => {
    config.setLLM({ apiKey: '', lang: 'ja' });
    expect(await service.translate({ text: 'こんにちは', toLang: 'en' })).toBe('こんにちは');
  });

  it('translates text and stores in LRU cache', async () => {
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

    const res1 = await service.translate({ text: 'こんにちは', toLang: 'en' });
    expect(res1).toBe('Hello there!');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.getCacheSize()).toBe(1);

    // Second call should hit the cache without calling fetch
    const res2 = await service.translate({ text: 'こんにちは', toLang: 'en' });
    expect(res2).toBe('Hello there!');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allocates at least half of main LLM quota with floor 400', async () => {
    config.setLLM({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      lang: 'ja',
      maxTokens: 400,
    });

    const mockResponse = { choices: [{ message: { content: 'Short line' } }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    // Floor 400 when maxTokens is 400 (half is 200, but floor is 400)
    await service.translate({ text: 'Test', toLang: 'en' });
    let body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.max_tokens).toBe(400);

    // Half of quota when main quota is 1200 -> 600
    config.setLLM({ maxTokens: 1200 });
    await service.translate({ text: 'Another message', toLang: 'en' });
    body = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(body.max_tokens).toBe(600);
  });

  it('evicts oldest entry when cache capacity (128) is exceeded', async () => {
    config.setLLM({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      lang: 'ja',
    });

    const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(String(opts.body));
      const userText = body.messages[1].content;
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          choices: [{ message: { content: `Translated: ${userText}` } }],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    // Insert 128 items
    for (let i = 0; i < 128; i++) {
      await service.translate({ text: `Message ${i}`, toLang: 'en' });
    }
    expect(service.getCacheSize()).toBe(128);
    expect(service.hasCached('Message 0', 'en')).toBe(true);

    // Insert 129th item -> Message 0 should be evicted
    await service.translate({ text: 'Message 128', toLang: 'en' });
    expect(service.getCacheSize()).toBe(128);
    expect(service.hasCached('Message 0', 'en')).toBe(false);
    expect(service.hasCached('Message 128', 'en')).toBe(true);
  });

  it('falls back to original text on network or API failure without throwing', async () => {
    config.setLLM({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      lang: 'ja',
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const res = await service.translate({ text: 'オリジナル', toLang: 'en' });
    expect(res).toBe('オリジナル');
  });

  it('exports translator singleton and translate function', async () => {
    expect(translator).toBeInstanceOf(TranslationService);
    expect(typeof translate).toBe('function');
  });
});
