import type { TtsConfig, SttConfig } from '$lib/stores/config.svelte';

export interface ProviderCapabilities {
  instructions?: boolean;
  emotion?: boolean;
  clone?: boolean;
  local: boolean;
}

export interface ProviderCreds {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  modelClone?: string;
  voice?: string;
}

export interface ProviderRow {
  id: string;
  kind: 'tts' | 'stt';
  label: string;
  creds: ProviderCreds;
  capabilities: ProviderCapabilities;
  defaults?: Record<string, string>;
}

export interface ResolvedTtsCredentials {
  id: string;
  capabilities: ProviderCapabilities;
  baseUrl: string;
  apiKey: string;
  model: string;
  voice: string;
}

export interface ResolvedSttCredentials {
  id: string;
  capabilities: ProviderCapabilities;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const ROWS: ProviderRow[] = [
  {
    id: 'openai',
    kind: 'tts',
    label: 'settings.tts.provider.openai',
    creds: {
      baseUrl: 'tts.baseUrl',
      apiKey: 'tts.apiKey',
      model: 'tts.modelPreset',
      modelClone: 'tts.modelClone',
      voice: 'tts.presetVoice',
    },
    capabilities: { instructions: true, emotion: false, clone: true, local: false },
  },
  {
    id: 'qwen',
    kind: 'tts',
    label: 'settings.tts.provider.qwen',
    creds: {
      baseUrl: 'tts.qwenBaseUrl',
      apiKey: 'tts.qwenApiKey',
      model: 'tts.qwenModel',
      voice: 'tts.qwenVoice',
    },
    capabilities: { instructions: true, emotion: false, clone: true, local: false },
    defaults: { model: 'qwen3-tts-flash' },
  },
  {
    id: 'fish',
    kind: 'tts',
    label: 'settings.tts.provider.fish',
    creds: {
      baseUrl: 'tts.fishBaseUrl',
      apiKey: 'tts.fishApiKey',
      model: 'tts.fishModel',
      voice: 'tts.fishVoice',
    },
    capabilities: { instructions: true, emotion: true, clone: true, local: false },
    defaults: { model: 's2.1-pro-free' },
  },
  {
    id: 'voicevox',
    kind: 'tts',
    label: 'settings.tts.provider.voicevox',
    creds: { baseUrl: 'tts.voicevoxBaseUrl', voice: 'tts.voicevoxVoice' },
    defaults: { baseUrl: 'http://127.0.0.1:50021/', voice: '0' },
    capabilities: { instructions: false, emotion: false, clone: false, local: true },
  },
  {
    id: 'aivis',
    kind: 'tts',
    label: 'settings.tts.provider.aivis',
    creds: { baseUrl: 'tts.aivisBaseUrl', voice: 'tts.aivisVoice' },
    defaults: { baseUrl: 'http://127.0.0.1:10101/', voice: '0' },
    capabilities: { instructions: false, emotion: false, clone: false, local: true },
  },
  {
    id: 'whisper',
    kind: 'stt',
    label: 'settings.stt.provider.whisper',
    creds: { baseUrl: 'stt.baseUrl', apiKey: 'stt.apiKey', model: 'stt.model' },
    defaults: { model: 'whisper-1' },
    capabilities: { local: false },
  },
];

const BY_ID: Record<string, ProviderRow> = {};
ROWS.forEach((r) => {
  BY_ID[r.id] = r;
});

function pick(
  source: Record<string, unknown> | null | undefined,
  field: string | undefined,
  fallback?: string
): string {
  if (!field) return fallback ?? '';
  const key = field.split('.').pop() || '';
  const v = source ? source[key] : undefined;
  if (v == null || v === '') return fallback ?? '';
  return String(v);
}

async function voicevoxSpeak(
  row: ProviderRow,
  ctx: { text: string; fetch: typeof fetch; creds: ResolvedTtsCredentials }
): Promise<string> {
  let base = String(ctx.creds.baseUrl || '').trim();
  if (!base) {
    const err = new Error('NO_URL');
    (err as { provider?: string }).provider = row.id;
    throw err;
  }
  base = base.replace(/\/+$/, '') + '/';
  const style = String(ctx.creds.voice || '').trim() || '0';
  const text = encodeURIComponent(String(ctx.text || ''));

  function fail(what: string, status?: number): Error & { hint: string } {
    const e = Object.assign(new Error(`${row.id}: ${what}${status ? ` (HTTP ${status})` : ''}`), {
      hint: 'local-engine',
    });
    return e;
  }

  try {
    const qRes = await ctx.fetch(`${base}audio_query?text=${text}&speaker=${encodeURIComponent(style)}`, {
      method: 'POST',
    });
    if (!qRes.ok) throw fail('audio_query 失败', qRes.status);
    const query = await qRes.json();

    const sRes = await ctx.fetch(`${base}synthesis?speaker=${encodeURIComponent(style)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!sRes.ok) throw fail('synthesis 失败', sRes.status);
    const blob = await sRes.blob();
    return URL.createObjectURL(blob);
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && (e as { hint?: string }).hint === 'local-engine') {
      throw e;
    }
    const err = Object.assign(new Error(`${row.id}: 连不上本地引擎（未启动，或引擎未允许跨源调用）`), {
      hint: 'local-engine',
      cause: e,
    });
    throw err;
  }
}

export function getProvider(id: string): ProviderRow | null {
  return BY_ID[id] || null;
}

export function getProviderIds(kind?: 'tts' | 'stt'): string[] {
  return ROWS.filter((r) => !kind || r.kind === kind).map((r) => r.id);
}

export function credentials(tts?: Partial<TtsConfig> | null): ResolvedTtsCredentials {
  const row = (tts?.provider && BY_ID[tts.provider]) || BY_ID.openai;
  const c = row.creds;
  let model = pick(tts as Record<string, unknown>, c.model, row.defaults?.model);
  if (row.id === 'openai' && String(tts?.mode || '') === 'clone') {
    model = pick(tts as Record<string, unknown>, c.modelClone, model);
  }
  return {
    id: row.id,
    capabilities: row.capabilities,
    baseUrl: pick(tts as Record<string, unknown>, c.baseUrl, row.defaults?.baseUrl),
    apiKey: pick(tts as Record<string, unknown>, c.apiKey),
    model,
    voice: pick(tts as Record<string, unknown>, c.voice, row.defaults?.voice),
  };
}

export function sttCredentials(stt?: Partial<SttConfig> | null): ResolvedSttCredentials {
  const row =
    (stt?.provider && BY_ID[stt.provider]?.kind === 'stt' ? BY_ID[stt.provider] : null) ||
    ROWS.find((r) => r.kind === 'stt') ||
    ROWS[ROWS.length - 1];
  const c = row.creds;
  return {
    id: row.id,
    capabilities: row.capabilities,
    baseUrl: pick(stt as Record<string, unknown>, c.baseUrl, row.defaults?.baseUrl),
    apiKey: pick(stt as Record<string, unknown>, c.apiKey),
    model: pick(stt as Record<string, unknown>, c.model, row.defaults?.model),
  };
}

export async function speakLocal(
  creds: ResolvedTtsCredentials,
  ctx: { text: string; fetch?: typeof fetch }
): Promise<string> {
  const row = BY_ID[creds.id];
  if (!row || !row.capabilities.local) {
    const err = new Error('NOT_LOCAL');
    (err as { provider?: string }).provider = creds.id;
    throw err;
  }
  return voicevoxSpeak(row, { text: ctx.text, fetch: ctx.fetch || fetch, creds });
}

export function isLocal(id: string): boolean {
  const row = BY_ID[id];
  return Boolean(row?.capabilities?.local);
}

export const Providers = {
  rows: ROWS,
  get: getProvider,
  ids: getProviderIds,
  credentials,
  sttCredentials,
  speakLocal,
  isLocal,
};

export default Providers;
