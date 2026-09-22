import { cacheStore } from '$lib/storage/cache';

export interface VoiceClipRecord {
  key: string;
  at: number;
  bytes: number;
  text: string;
  url: string;
  blob: Blob | ArrayBuffer | Uint8Array;
}

export interface VoiceClipMeta {
  text?: string;
  url?: string;
}

export interface VoiceClipSummary {
  key: string;
  at: number;
  bytes: number;
  text: string;
  fav: boolean;
}

export interface VoiceCacheStats {
  count: number;
  bytes: number;
  favs: number;
  budget: number;
}

export interface VoiceMetaEntry {
  key: string;
  at: number;
  bytes: number;
  text: string;
  fav?: boolean;
}

export const VOICE_CACHE_NAME = 'ryza-voice-v1';
export const VOICE_META_KEY = 'ryza.voicemeta.v1';
export const DEFAULT_BUDGET = 16 * 1024 * 1024; // 16 MB
export const DEFAULT_KEEP = 50;

let _protect: ((key: string) => boolean) | null = null;

function loadMetaMap(): Record<string, VoiceMetaEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VOICE_META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VoiceMetaEntry>) : {};
  } catch {
    return {};
  }
}

function saveMetaMap(map: Record<string, VoiceMetaEntry>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(VOICE_META_KEY, JSON.stringify(map));
  } catch {}
}

export function isFav(key: string): boolean {
  const map = loadMetaMap();
  return Boolean(map[key]?.fav || (_protect && _protect(key)));
}

export function toggleFav(key: string): boolean {
  const map = loadMetaMap();
  const entry = map[key] || {
    key,
    at: Date.now(),
    bytes: 0,
    text: '',
    fav: false,
  };
  entry.fav = !entry.fav;
  map[key] = entry;
  saveMetaMap(map);
  return Boolean(entry.fav);
}

async function evict(budget = DEFAULT_BUDGET, keep = DEFAULT_KEEP): Promise<{ evicted: number }> {
  const map = loadMetaMap();
  const entries = Object.values(map);
  entries.sort((a, b) => (a.at || 0) - (b.at || 0));

  let totalBytes = entries.reduce((sum, item) => sum + (item.bytes || 0), 0);
  let totalCount = entries.length;
  let evicted = 0;

  for (const item of entries) {
    if (totalBytes <= budget && totalCount <= keep) break;
    if (isFav(item.key)) continue;

    await cacheStore.delete(item.key, VOICE_CACHE_NAME);
    delete map[item.key];
    totalBytes -= item.bytes || 0;
    totalCount--;
    evicted++;
  }

  if (evicted > 0) {
    saveMetaMap(map);
  }

  return { evicted };
}

export async function put(
  key: string,
  blob: Blob | ArrayBuffer | Uint8Array,
  meta?: VoiceClipMeta
): Promise<boolean> {
  if (!key || !blob) return false;

  const bytes = 'size' in blob ? blob.size : blob.byteLength || 0;
  const contentType = blob instanceof Blob && blob.type ? blob.type : 'audio/wav';

  const stored = await cacheStore.set(key, blob, {
    cacheName: VOICE_CACHE_NAME,
    contentType,
  });

  if (!stored) return false;

  const map = loadMetaMap();
  const existingFav = Boolean(map[key]?.fav);

  map[key] = {
    key: String(key),
    at: Date.now(),
    bytes,
    text: String(meta?.text || '').slice(0, 400),
    fav: existingFav,
  };

  saveMetaMap(map);
  await evict(DEFAULT_BUDGET, DEFAULT_KEEP);
  return true;
}

export async function getBlob(key: string): Promise<Blob | null> {
  if (!key) return null;
  return await cacheStore.getBlob(key, VOICE_CACHE_NAME);
}

export async function get(key: string): Promise<VoiceClipRecord | null> {
  if (!key) return null;
  const blob = await getBlob(key);
  if (!blob) return null;

  const map = loadMetaMap();
  const meta = map[key];

  return {
    key,
    at: meta?.at || Date.now(),
    bytes: meta?.bytes || blob.size,
    text: meta?.text || '',
    url: '',
    blob,
  };
}

export async function urlFor(key: string): Promise<string | null> {
  const blob = await getBlob(key);
  if (!blob) return null;
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function list(): Promise<VoiceClipSummary[]> {
  const map = loadMetaMap();
  const list = Object.values(map).map((v) => ({
    key: v.key,
    at: v.at,
    bytes: v.bytes,
    text: v.text,
    fav: Boolean(v.fav || (_protect && _protect(v.key))),
  }));

  list.sort((a, b) => (b.at || 0) - (a.at || 0));
  return list;
}

export async function clear(force = false): Promise<{ cleared: number }> {
  const map = loadMetaMap();
  const entries = Object.values(map);
  let cleared = 0;

  for (const entry of entries) {
    if (force || !isFav(entry.key)) {
      await cacheStore.delete(entry.key, VOICE_CACHE_NAME);
      delete map[entry.key];
      cleared++;
    }
  }

  saveMetaMap(map);
  return { cleared };
}

export async function stats(): Promise<VoiceCacheStats> {
  const l = await list();
  return {
    count: l.length,
    bytes: l.reduce((s, x) => s + (x.bytes || 0), 0),
    favs: l.filter((x) => x.fav).length,
    budget: DEFAULT_BUDGET,
  };
}

export const VoiceCache = {
  DEFAULT_BUDGET,
  DEFAULT_KEEP,
  VOICE_CACHE_NAME,
  VOICE_META_KEY,
  setProtector: (fn: ((key: string) => boolean) | null) => {
    _protect = fn;
  },
  put,
  get,
  getBlob,
  list,
  urlFor,
  toggleFav,
  isFav,
  clear,
  stats,
};

export default VoiceCache;
