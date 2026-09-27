import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamChat } from './streaming';
import { config } from '$lib/stores/config.svelte';

function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
}

describe('streamChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config._resetForTest();
    config.setLLM({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      model: 'test-model',
    });
  });

  it('rejects if no apiKey is configured', async () => {
    config.setLLM({ apiKey: '' });
    await expect(streamChat([], 'hello')).rejects.toThrow('NO_KEY');
  });

  it('streams SSE chunks and extracts line-1 tags early', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"[emotion:happy, attitude:agree]"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\nこんにちは！"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"冒険に出かけよう！"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"<state>{\\"money_delta\\":10}</state>"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const stream = createMockReadableStream(chunks);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onFirstLineTags = vi.fn();
    const tokens: string[] = [];

    const reply = await streamChat([], 'おはよう', {
      onFirstLineTags,
      onToken: (t) => tokens.push(t),
    });

    expect(onFirstLineTags).toHaveBeenCalledTimes(1);
    expect(onFirstLineTags).toHaveBeenCalledWith(
      expect.objectContaining({
        emotion: 'happy',
        attitude: 'agree',
      })
    );

    expect(tokens.length).toBeGreaterThan(0);
    expect(reply.emotion).toBe('happy');
    expect(reply.attitude).toBe('agree');
    expect(reply.text).toBe('こんにちは！冒険に出かけよう！');
    expect(reply.state).toEqual({ money_delta: 10 });
  });

  it('falls back to non-streaming chat if fetch fails', async () => {
    const nonStreamingJson = {
      choices: [
        {
          message: {
            content: '[emotion:smile attitude:agree]\n通常レスポンス',
          },
        },
      ],
    };

    // First fetch for streaming rejects, fallback fetch for chat succeeds
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Streaming not supported'))
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => nonStreamingJson,
      });
    vi.stubGlobal('fetch', fetchMock);

    const reply = await streamChat([], 'テスト');
    expect(reply.text).toBe('通常レスポンス');
    expect(reply.emotion).toBe('happy'); // 'smile' maps to 'happy'
  });
});
