import { describe, it, expect, vi } from 'vitest';
import type { TtsConfig, SttConfig } from '$lib/stores/config.svelte';
import { Providers, credentials, sttCredentials, speakLocal, isLocal } from './providers';
import { fishApiStyle, fishTtsUrl, fishLanguage, fishEmotion, redactSecret } from './tts';
import { fishErrorMessage } from './index';

describe('Providers Registry', () => {
  it('resolves active credentials per provider without cross-contamination', () => {
    const tts: Partial<TtsConfig> = {
      provider: 'qwen',
      baseUrl: 'https://openai.example.com',
      apiKey: 'openai-key',
      qwenBaseUrl: 'https://qwen.example.com',
      qwenApiKey: 'qwen-key',
      qwenModel: 'cosyvoice-v3-flash',
      qwenVoice: 'Cherry',
    };

    const creds = credentials(tts);
    expect(creds.id).toBe('qwen');
    expect(creds.baseUrl).toBe('https://qwen.example.com');
    expect(creds.apiKey).toBe('qwen-key');
    expect(creds.model).toBe('cosyvoice-v3-flash');
    expect(creds.voice).toBe('Cherry');
  });

  it('resolves stt credentials correctly for whisper', () => {
    const stt: Partial<SttConfig> = {
      provider: 'whisper',
      baseUrl: 'https://whisper.example.com',
      apiKey: 'whisper-key',
      model: 'whisper-large-v3',
    };

    const creds = sttCredentials(stt);
    expect(creds.id).toBe('whisper');
    expect(creds.baseUrl).toBe('https://whisper.example.com');
    expect(creds.apiKey).toBe('whisper-key');
    expect(creds.model).toBe('whisper-large-v3');
  });

  it('identifies local engines and runs speakLocal', async () => {
    expect(isLocal('voicevox')).toBe(true);
    expect(isLocal('aivis')).toBe(true);
    expect(isLocal('openai')).toBe(false);

    const mockFetch = vi.fn();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ mock: 'query' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['fake-wav'], { type: 'audio/wav' }),
      });

    // Mock createObjectURL
    const origCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:voicevox-audio');

    try {
      const creds = credentials({
        provider: 'voicevox',
        voicevoxBaseUrl: 'http://127.0.0.1:50021/',
        voicevoxVoice: '1',
      } as Partial<TtsConfig>);

      const url = await speakLocal(creds, {
        text: 'こんにちは',
        fetch: mockFetch as unknown as typeof fetch,
      });

      expect(url).toBe('blob:voicevox-audio');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain('/audio_query?text=');
      expect(mockFetch.mock.calls[1][0]).toContain('/synthesis?speaker=1');
    } finally {
      URL.createObjectURL = origCreateObjectURL;
    }
  });
});

describe('Fish Audio API helpers', () => {
  it('identifies modern vs legacy surfaces based on baseUrl', () => {
    expect(fishApiStyle('https://api.fish.audio')).toBe('modern');
    expect(fishApiStyle('https://fishaudio.org/api/open/v1')).toBe('legacy');

    expect(fishTtsUrl('https://api.fish.audio')).toBe('https://api.fish.audio/v1/tts');
    expect(fishTtsUrl('https://fishaudio.org/api/open/v1')).toBe(
      'https://fishaudio.org/api/open/v1/speech/tts'
    );
  });

  it('redacts secret keys and classifies errors', () => {
    const secret = 'sk-fish-secret-12345';
    expect(redactSecret(`Failed with key ${secret}`, secret)).toBe('Failed with key [redacted]');

    const err401 = fishErrorMessage(401, 'Unauthorized', secret, 'tts');
    expect(err401).toContain('API key 无效或缺失');

    const err403 = fishErrorMessage(403, 'Forbidden', secret, 'tts');
    expect(err403).toContain('权限不足');

    const err429 = fishErrorMessage(429, 'Rate limit', secret, 'tts');
    expect(err429).toContain('超出速率或额度限制');
  });

  it('maps emotions and language codes properly', () => {
    expect(fishLanguage('ja')).toBe('ja');
    expect(fishLanguage('zh-tw')).toBe('zh-TW');
    expect(fishEmotion('happy')).toBe('happy');
    expect(fishEmotion('sad')).toBe('sad');
    expect(fishEmotion('cuddle')).toBe('calm');
  });
});
