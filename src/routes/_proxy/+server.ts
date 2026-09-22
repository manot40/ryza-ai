import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import version from '../../../config/version.json';

const UA = `RyzaChat/${version.version}`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, api-key, model',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function isLoopbackHost(host: string): boolean {
  const h = String(host || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  for (let i = 1; i <= 4; i++) {
    if (Number(m[i]) > 255) return false;
  }
  return m[1] === '127';
}

function proxyTargetAllowed(target: string): boolean {
  let u: URL;
  try {
    u = new URL(String(target || ''));
  } catch {
    return false;
  }
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && isLoopbackHost(u.hostname);
}

export async function GET({ request, url }: RequestEvent) {
  return proxy(request, url);
}

export async function POST({ request, url }: RequestEvent) {
  return proxy(request, url);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

async function proxy(request: Request, url: URL): Promise<Response> {
  const method = request.method.toUpperCase();
  const target = url.searchParams.get('u') || '';

  if (!proxyTargetAllowed(target)) {
    return new Response('proxy target must be https (or http on loopback)', { status: 400 });
  }

  const headers = new Headers({ 'User-Agent': UA });
  const timeoutMs = method === 'POST' ? 180_000 : 120_000;

  const auth = request.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);

  const apiKey = request.headers.get('api-key');
  if (apiKey) headers.set('api-key', apiKey);

  const model = request.headers.get('model');
  if (model) headers.set('model', model);

  if (method === 'POST') {
    headers.set('Content-Type', request.headers.get('content-type') || 'application/json');
  }

  try {
    const upstreamRes = await fetch(target, {
      method,
      headers,
      body: method === 'POST' ? await request.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const contentType =
      upstreamRes.headers.get('content-type') ||
      (method === 'POST' ? 'application/json' : 'application/octet-stream');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: { message } }, { status: 502 });
  }
}
