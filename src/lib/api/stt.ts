import { config } from '$lib/stores/config.svelte';
import { Langs } from '$lib/i18n/langs';
import { Providers } from './providers';
import { localProxy, upstreamUrl, apiErrorMessage } from './http';

export async function transcribe(blob: Blob, opts?: { lang?: string; timeout?: number }): Promise<string> {
  const cred = Providers.sttCredentials(config.get('stt'));
  if (!cred.baseUrl) throw new Error('NO_STT_URL');
  if (!blob || !blob.size) throw new Error('NO_AUDIO');

  const boundary = '----ryza' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const head: string[] = [];
  function field(name: string, value: string) {
    head.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  if (cred.model) field('model', cred.model);
  const iso = opts?.lang ? Langs.sttLang(opts.lang) : '';
  if (iso) field('language', iso);
  field('response_format', 'json');
  const headText =
    head.join('') +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="speech.wav"\r\nContent-Type: audio/wav\r\n\r\n`;
  const body = new Blob([headText, blob, `\r\n--${boundary}--\r\n`], {
    type: `multipart/form-data; boundary=${boundary}`,
  });

  const headers = new Headers();
  if (cred.apiKey) {
    headers.set('Authorization', `Bearer ${cred.apiKey}`);
    headers.set('api-key', cred.apiKey);
  }

  const res = await fetch(localProxy(upstreamUrl(cred.baseUrl, '/audio/transcriptions')), {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(opts?.timeout || 60000),
  });

  if (!res.ok) {
    const raw = await res.text();
    let j: unknown = null;
    try {
      j = JSON.parse(raw);
    } catch {}
    throw new Error(apiErrorMessage(j, res.status, raw));
  }

  const j = (await res.json()) as { text?: string };
  return String(j?.text || '').trim();
}
