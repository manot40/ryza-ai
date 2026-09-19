import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET, POST, OPTIONS } from '../src/routes/_proxy/+server';
import version from '../config/version.json';

const EXPECTED_UA = `RyzaChat/${version.version}`;

const UPSTREAM = 'https://upstream.example.com/api';

function makeEvent(method: string, urlStr: string, init: RequestInit = {}): RequestEvent {
  const request = new Request('https://local.test/_proxy', { method, ...init });
  const url = new URL(urlStr);
  return { request, url } as unknown as RequestEvent;
}

describe('+server /_proxy', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('OPTIONS', () => {
    it('returns 204 with the expected CORS headers', async () => {
      const res = await OPTIONS();

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type, api-key');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('HTTPS-only validation', () => {
    it('GET rejects a non-https target with 400 and does not call fetch', async () => {
      const event = makeEvent(
        'GET',
        `https://local.test/_proxy?u=${encodeURIComponent('http://insecure.example.com')}`
      );
      const res = await GET(event);

      expect(res.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POST rejects a non-https target with 400 and does not call fetch', async () => {
      const event = makeEvent(
        'POST',
        `https://local.test/_proxy?u=${encodeURIComponent('http://insecure.example.com')}`
      );
      const res = await POST(event);

      expect(res.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('GET returns 400 when the u param is missing', async () => {
      const event = makeEvent('GET', 'https://local.test/_proxy');
      const res = await GET(event);

      expect(res.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('GET returns 400 when the u param is empty', async () => {
      const event = makeEvent('GET', 'https://local.test/_proxy?u=');
      const res = await GET(event);

      expect(res.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('header passthrough (GET)', () => {
    it('forwards the Authorization header and injects the User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } })
      );

      const event = makeEvent('GET', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`, {
        headers: { Authorization: 'Bearer secret-token' },
      });
      await GET(event);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [target, opts] = mockFetch.mock.calls[0];
      expect(target).toBe(UPSTREAM);
      const headers = (opts as RequestInit).headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer secret-token');
      expect(headers.get('User-Agent')).toBe(EXPECTED_UA);
    });

    it('forwards the api-key header', async () => {
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const event = makeEvent('GET', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`, {
        headers: { 'api-key': 'my-api-key' },
      });
      await GET(event);

      const [, opts] = mockFetch.mock.calls[0];
      const headers = (opts as RequestInit).headers as Headers;
      expect(headers.get('api-key')).toBe('my-api-key');
    });

    it('injects a User-Agent that starts with RyzaChat/', async () => {
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const event = makeEvent('GET', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`);
      await GET(event);

      const [, opts] = mockFetch.mock.calls[0];
      const headers = (opts as RequestInit).headers as Headers;
      expect(headers.get('User-Agent')).toMatch(/^RyzaChat\//);
    });
  });

  describe('successful forward', () => {
    it('GET returns the upstream status and body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('hello-from-upstream', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      );

      const event = makeEvent('GET', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`);
      const res = await GET(event);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/plain');
      expect(await res.text()).toBe('hello-from-upstream');
    });

    it('GET passes a signal option (timeout) to fetch', async () => {
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const event = makeEvent('GET', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`);
      await GET(event);

      const [, opts] = mockFetch.mock.calls[0];
      expect((opts as RequestInit).signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('POST body forwarding', () => {
    it('forwards POST method and body and returns the upstream response', async () => {
      const body = JSON.stringify({ prompt: 'hi' });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ reply: 'hey' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      );

      const event = makeEvent('POST', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      const res = await POST(event);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [target, opts] = mockFetch.mock.calls[0];
      expect(target).toBe(UPSTREAM);
      expect((opts as RequestInit).method).toBe('POST');
      const headers = (opts as RequestInit).headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      const sent = (opts as RequestInit).body as ArrayBuffer;
      expect(new TextDecoder().decode(sent)).toBe(body);

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ reply: 'hey' });
    });

    it('POST defaults Content-Type to application/json when the request omits it', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      const request = new Request('https://local.test/_proxy', {
        method: 'POST',
        body: new TextEncoder().encode('{}'),
      });
      request.headers.delete('content-type');
      const url = new URL(`https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`);
      await POST({ request, url } as unknown as RequestEvent);

      const [, opts] = mockFetch.mock.calls[0];
      const headers = (opts as RequestInit).headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('POST passes a signal option (timeout) to fetch', async () => {
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const event = makeEvent('POST', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`, {
        method: 'POST',
        body: '{}',
      });
      await POST(event);

      const [, opts] = mockFetch.mock.calls[0];
      expect((opts as RequestInit).signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('502 on fetch error', () => {
    it('GET returns 502 with an error JSON body when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network down'));

      const event = makeEvent('GET', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`);
      const res = await GET(event);

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: { message: 'network down' } });
    });

    it('POST returns 502 with an error JSON body when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('upstream gone'));

      const event = makeEvent('POST', `https://local.test/_proxy?u=${encodeURIComponent(UPSTREAM)}`, {
        method: 'POST',
        body: '{}',
      });
      const res = await POST(event);

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(json.error.message).toBe('upstream gone');
    });
  });
});
