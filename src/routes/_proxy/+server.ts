import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import version from '../../../config/version.json';

const UA = `RyzaChat/${version.version}`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

  if (!target.startsWith('https://')) {
    return new Response('proxy target must be https', { status: 400 });
  }

  const headers = new Headers({ 'User-Agent': UA });
  const timeoutMs = method === 'POST' ? 180_000 : 120_000;

  const auth = request.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);

  const apiKey = request.headers.get('api-key');
  if (apiKey) headers.set('api-key', apiKey);

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
