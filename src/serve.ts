import { createStaticRoutes } from '~/libs/static';

const UA = 'RyzaChat/1.2.13';
const CORS = new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, api-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
});

const web = await createStaticRoutes('./web');
const server = Bun.serve({
  port: Bun.env.PORT || 3000,
  hostname: Bun.env.HOST || 'localhost',
  routes: {
    ...web,
    '/_proxy': {
      GET: proxyHandler,
      POST: proxyHandler,
      OPTIONS: CORS,
    },
    '/config/providers.json': new Response(Bun.file('./config/providers.json')),
  },
});

async function proxyHandler(req: Bun.BunRequest<'/_proxy'>): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const target = url.searchParams.get('u') || '';

  if (!target.startsWith('https://')) {
    return new Response('proxy target must be https', { status: 400 });
  }

  const headers = new Headers({ 'User-Agent': UA });
  const timeoutMs = method === 'POST' ? 180_000 : 120_000;

  const auth = req.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);

  const apiKey = req.headers.get('api-key');
  if (apiKey) headers.set('api-key', apiKey);

  if (method === 'POST') {
    headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
  }

  try {
    const upstreamRes = await fetch(target, {
      method,
      headers,
      body: method === 'POST' ? await req.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const contentType =
      upstreamRes.headers.get('content-type') ||
      (method === 'POST' ? 'application/json' : 'application/octet-stream');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    return Response.json({ error: { message } }, { status: 502 });
  }
}

console.info(`Ryza AI Serving at http://${server.hostname}:${server.port}`);
