import { audioMimeFrom, downloadUrl } from './tts';

const PLACEHOLDER_MODELS: Record<string, number> = {
  'tts-model': 1,
  'voice-clone-model': 1,
  'your-clone-model': 1,
  'your-preset-model': 1,
};

export function isPlaceholderModel(m?: string | null): boolean {
  return !m || Boolean(PLACEHOLDER_MODELS[m]);
}

export function upstreamUrl(baseUrl: string, path: string): string {
  return String(baseUrl || '').replace(/\/+$/, '') + path;
}

export function localProxy(target: string): string {
  if (!target || !/^https?:\/\//i.test(target)) return target;
  if (target.startsWith('/_proxy')) return target;
  return '/_proxy?u=' + encodeURIComponent(target);
}

export interface ResponseBlob extends Blob {
  _headers?: Headers;
}

export function apiErrorMessage(j: unknown, status: number, raw?: string): string {
  if (j && typeof j === 'object') {
    const rec = j as Record<string, unknown>;
    const err = rec.error;
    if (typeof err === 'string' && err) return err;
    if (err && typeof err === 'object') {
      const errRec = err as Record<string, unknown>;
      const em = String(errRec.message || errRec.msg || '');
      const ec = String(errRec.code || errRec.type || '');
      if (em) return (ec ? `${ec}: ` : '') + em;
      if (ec) return ec;
    }
    const msg = rec.message || rec.msg;
    const code = rec.code;
    if (msg && code && String(code) && String(code) !== '200') {
      return `${code}: ${msg}`;
    }
    if (msg) return String(msg);
  }
  const snippet = raw ? String(raw).replace(/\s+/g, ' ').slice(0, 180) : '';
  return `HTTP ${status}${snippet ? `: ${snippet}` : ''}`;
}

export interface TransportError extends Error {
  code: 'timeout' | 'net';
}

export function isTransportError(err: unknown): err is TransportError {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    ((err as { code: unknown }).code === 'timeout' || (err as { code: unknown }).code === 'net')
  );
}

export function createTransportError(code: 'timeout' | 'net', message?: string): TransportError {
  const defaultMsg =
    code === 'timeout'
      ? 'Timed out: the endpoint never answered (check the base URL and model name in Settings)'
      : 'Could not reach that base URL (wrong address, CORS refused, or the local server is not running)';
  const err = new Error(message || defaultMsg) as TransportError;
  err.code = code;
  return err;
}

export async function fetchTransport(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    if (isTransportError(err)) throw err;
    const name = (err as Error)?.name || '';
    const msg = String((err as Error)?.message || '');
    if (name === 'TimeoutError' || /timeout|timed out|abort/i.test(msg)) {
      throw createTransportError('timeout');
    }
    throw createTransportError('net');
  }
}

export async function request<T = unknown>(
  url: string,
  body: unknown,
  apiKey: string = '',
  timeoutMs: number = 120000
): Promise<T | ResponseBlob> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('api-key', apiKey);
  }

  const res = await fetchTransport(url, { body: JSON.stringify(body), method: 'POST', headers }, timeoutMs);
  if (!res.ok) throw new Error(apiErrorMessage(null, res.status, await res.text()));

  const mime = res.headers.get('content-type') || '';
  let result: T | ResponseBlob;
  if (mime.includes('application/json')) {
    result = (await res.json()) as T;
  } else {
    result = (await res.blob()) as ResponseBlob;
  }

  (result as ResponseBlob)._headers = res.headers;
  return result;
}

export async function requestGet<T = unknown>(
  url: string,
  apiKey: string = '',
  timeoutMs: number = 30000
): Promise<T | ResponseBlob> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('api-key', apiKey);
  }

  const res = await fetchTransport(url, { headers }, timeoutMs);
  if (!res.ok) throw new Error(apiErrorMessage(null, res.status, await res.text()));

  const mime = res.headers.get('content-type') || '';
  let result: T | ResponseBlob;
  if (mime.includes('application/json')) {
    result = (await res.json()) as T;
  } else {
    result = (await res.blob()) as ResponseBlob;
  }

  (result as ResponseBlob)._headers = res.headers;
  return result;
}

export async function requestAudio(
  url: string,
  body: unknown,
  apiKey: string = '',
  timeoutMs: number = 180000,
  extraHeaders?: Record<string, string>,
  errorMap?: (status: number, raw: string, apiKey: string) => string
): Promise<string> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('api-key', apiKey);
  }
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v);
    }
  }

  const res = await fetchTransport(url, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs);

  const buf = await res.arrayBuffer();
  const ct = res.headers.get('content-type') || '';
  const mime = audioMimeFrom(buf, ct);
  if (res.ok && mime) {
    return URL.createObjectURL(new Blob([buf], { type: mime }));
  }

  const raw = new TextDecoder('utf-8').decode(buf);
  let j: unknown = null;
  try {
    j = JSON.parse(raw);
  } catch {}

  if (
    res.ok &&
    j &&
    typeof j === 'object' &&
    ((j as { audio_url?: string }).audio_url || (j as { audioUrl?: string }).audioUrl)
  ) {
    const audioUrl = (j as { audio_url?: string }).audio_url || (j as { audioUrl?: string }).audioUrl;
    return downloadUrl(audioUrl!, localProxy, apiKey);
  }

  const msg = errorMap ? errorMap(res.status, raw, apiKey) : apiErrorMessage(j, res.status, raw);
  throw new Error(msg);
}

export async function requestForm<T = unknown>(
  url: string,
  form: FormData,
  apiKey: string = '',
  timeoutMs: number = 180000,
  errorMap?: (status: number, raw: string, apiKey: string) => string
): Promise<T> {
  const headers = new Headers();
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);

  const res = await fetchTransport(url, { method: 'POST', headers, body: form }, timeoutMs);

  const text = await res.text();
  let j: unknown = null;
  try {
    j = JSON.parse(text);
  } catch {}

  if (res.ok) return j as T;
  const msg = errorMap ? errorMap(res.status, text, apiKey) : apiErrorMessage(j, res.status, text);
  throw new Error(msg);
}
