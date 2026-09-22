// @wc-ignore-file
/**
 * crfstore.ts — Custom costume (CRF) ZIP import into IndexedDB.
 *
 * Validates Spine 4.2 skeleton, atlas, png, and gesture file in a ZIP archive (<= 64MB).
 * Keeps images and assets in IndexedDB, small metadata in localStorage.
 */

const DB_NAME = 'ryza_crf';
const STORE_NAME = 'outfits';
const META_KEY = 'ryza.crf.imported.v1';
export const MAX_CRF_BYTES = 64 * 1024 * 1024;
export const MAX_CRF_ENTRIES = 64;

export interface CrfMetaEntry {
  id: string;
  base: string;
  imported: boolean;
  addedAt: number;
}

export interface CrfRecord {
  id: string;
  base: string;
  files: Record<string, Blob>;
  preview: null;
}

export interface CrfSkinEntry {
  id: string;
  chr: string;
  hasSpine: boolean;
  imported: boolean;
  preview: string | null;
  skel: string | null;
  atlas: string | null;
  gesture: string | null;
}

export interface ZipEntry {
  name: string;
  method: number;
  size: number;
  localOff: number;
}

export interface ParsedZip {
  entries: ZipEntry[];
  dv: DataView;
  buf: ArrayBuffer;
}

export interface ValidationResult {
  id: string;
  base: string;
  files: Record<string, Uint8Array>;
  gesture: Record<string, unknown>;
}

let _db: IDBDatabase | null = null;
const _urls: Record<string, Record<string, string>> = {};

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no indexedDB'));
  return new Promise((res, rej) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        _db = req.result;
        res(_db);
      };
      req.onerror = () => rej(req.error);
    } catch (e) {
      rej(e);
    }
  });
}

function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

export function getCrfMeta(): CrfMetaEntry[] {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '[]');
  } catch {
    return [];
  }
}

export function setCrfMeta(list: CrfMetaEntry[]): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(list));
  } catch {}
}

function u16(dv: DataView, o: number): number {
  return dv.getUint16(o, true);
}

function u32(dv: DataView, o: number): number {
  return dv.getUint32(o, true);
}

export function readZip(buf: ArrayBuffer): ParsedZip {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
    if (u32(dv, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP archive');
  const count = u16(dv, eocd + 10);
  const cdOff = u32(dv, eocd + 16);
  if (count > MAX_CRF_ENTRIES) throw new Error(`Too many ZIP entries (limit ${MAX_CRF_ENTRIES})`);
  const out: ZipEntry[] = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (u32(dv, p) !== 0x02014b50) throw new Error('ZIP central directory corrupted');
    const method = u16(dv, p + 10);
    const size = u32(dv, p + 24);
    const nameLen = u16(dv, p + 28);
    const extraLen = u16(dv, p + 30);
    const commentLen = u16(dv, p + 32);
    const localOff = u32(dv, p + 42);
    let name = '';
    for (let k = 0; k < nameLen; k++) name += String.fromCharCode(dv.getUint8(p + 46 + k));
    out.push({ name, method, size, localOff });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries: out, dv, buf };
}

export async function entryBytes(zip: ParsedZip, e: ZipEntry): Promise<Uint8Array> {
  const dv = zip.dv;
  const p = e.localOff;
  if (u32(dv, p) !== 0x04034b50) throw new Error('ZIP local header corrupted');
  const nameLen = u16(dv, p + 26);
  const extraLen = u16(dv, p + 28);
  const start = p + 30 + nameLen + extraLen;
  const slice = zip.buf.slice(start, start + e.size);
  if (e.method === 0) return new Uint8Array(slice);
  if (e.method !== 8) throw new Error(`Unsupported ZIP compression method: ${e.method}`);
  if (typeof DecompressionStream === 'undefined')
    throw new Error('DecompressionStream not supported in environment');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([slice]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

export function safeName(path?: string): string {
  const p = String(path || '').replace(/\\/g, '/');
  if (p.startsWith('/') || p.includes(':')) throw new Error('ZIP contains absolute path');
  const parts = p.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '..') throw new Error('ZIP contains parent path traversal');
  }
  return parts[parts.length - 1];
}

const OK_EXT = /\.(atlas|png|skel|json)$/i;

export function skeletonVersionOk(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 14) return false;
  const len = bytes[8];
  if (!(len >= 4 && len <= 32)) return false;
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[9 + i]);
  return s.startsWith('4.2.');
}

export function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (!bytes || bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

export function validateCrf(files: Record<string, Uint8Array>): ValidationResult {
  const names = Object.keys(files);
  const atlases = names.filter((n) => /\.atlas$/i.test(n));
  if (atlases.length !== 1) throw new Error('Must contain exactly 1 .atlas file (single-page atlas)');
  const base = atlases[0].replace(/\.atlas$/i, '');
  ['png', 'skel', 'json'].forEach((ext) => {
    const want = ext === 'json' ? base + '_gesture.json' : base + '.' + ext;
    if (!files[want]) throw new Error('Missing file: ' + want);
  });
  const atlasText = new TextDecoder().decode(files[base + '.atlas']);
  const pageLines = atlasText.split(/\r?\n/).filter((l) => /\.png\s*$/i.test(l.trim()));
  if (pageLines.length !== 1) throw new Error('Only single-page atlases are supported');
  if (pageLines[0].trim() !== base + '.png')
    throw new Error('Atlas texture name does not match png filename');

  const declared = /^size:\s*(\d+)\s*,\s*(\d+)/m.exec(atlasText);
  if (!declared) throw new Error('Atlas is missing size declaration');
  const png = pngSize(files[base + '.png']);
  if (!png) throw new Error('Texture is not a valid PNG');
  if (png.w !== Number(declared[1]) || png.h !== Number(declared[2])) {
    throw new Error(
      `PNG size ${png.w}x${png.h} does not match atlas declaration ${declared[1]}x${declared[2]}`
    );
  }
  if (!skeletonVersionOk(files[base + '.skel'])) throw new Error('Only Spine 4.2 skeletons are supported');

  let gesture: Record<string, unknown>;
  try {
    gesture = JSON.parse(new TextDecoder().decode(files[base + '_gesture.json']));
  } catch {
    throw new Error('Gesture file is not valid JSON');
  }
  if (!gesture || !gesture.emotionalGesture)
    throw new Error('Gesture file is missing emotionalGesture table');

  const id = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'imported';
  return { id, base, files, gesture };
}

export const crfStore = {
  MAX_BYTES: MAX_CRF_BYTES,
  MAX_ENTRIES: MAX_CRF_ENTRIES,

  parseZip: readZip,
  validate: validateCrf,
  skeletonVersionOk,
  pngSize,
  safeName,

  list(): CrfMetaEntry[] {
    return getCrfMeta();
  },

  async importZip(input: Blob | ArrayBuffer | Uint8Array): Promise<ValidationResult> {
    let ab: ArrayBuffer;
    if (input instanceof Blob) {
      ab = await input.arrayBuffer();
    } else if (input instanceof Uint8Array) {
      ab = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
    } else {
      ab = input;
    }

    if (ab.byteLength > MAX_CRF_BYTES) throw new Error('ZIP exceeds 64MB');
    const zip = readZip(ab);
    const picked: Array<{ name: string; entry: ZipEntry }> = [];
    let total = 0;
    zip.entries.forEach((e) => {
      const name = safeName(e.name);
      if (!OK_EXT.test(name)) return;
      if (picked.some((p) => p.name === name)) {
        throw new Error('ZIP contains duplicate file: ' + name);
      }
      total += e.size;
      if (total > MAX_CRF_BYTES) throw new Error('Extracted content exceeds 64MB');
      picked.push({ name, entry: e });
    });

    if (!picked.length) throw new Error('ZIP contains no valid assets');
    const list = await Promise.all(
      picked.map(async (p) => {
        const b = await entryBytes(zip, p.entry);
        return { name: p.name, bytes: b };
      })
    );

    const files: Record<string, Uint8Array> = {};
    list.forEach((x) => {
      files[x.name] = x.bytes;
    });
    const v = validateCrf(files);

    const store = await getStore('readwrite');
    await new Promise<void>((res, rej) => {
      const rec: CrfRecord = { id: v.id, base: v.base, files: {}, preview: null };
      Object.keys(files).forEach((n) => {
        rec.files[n] = new Blob([files[n].buffer as ArrayBuffer]);
      });
      const put = store.put(rec);
      put.onsuccess = () => res();
      put.onerror = () => rej(put.error);
    });

    const m = getCrfMeta().filter((x) => x.id !== v.id);
    m.push({ id: v.id, base: v.base, imported: true, addedAt: Date.now() });
    setCrfMeta(m);
    return v;
  },

  async remove(id: string): Promise<void> {
    const store = await getStore('readwrite');
    await new Promise<void>((res) => {
      const del = store.delete(id);
      del.onsuccess = () => res();
      del.onerror = () => res();
    });
    setCrfMeta(getCrfMeta().filter((x) => x.id !== id));
    Object.keys(_urls[id] || {}).forEach((k) => {
      try {
        URL.revokeObjectURL(_urls[id][k]);
      } catch {}
    });
    delete _urls[id];
  },

  async get(id: string): Promise<CrfRecord | null> {
    const store = await getStore('readonly');
    return new Promise((res, rej) => {
      const g = store.get(id);
      g.onsuccess = () => res((g.result as CrfRecord) || null);
      g.onerror = () => rej(g.error);
    });
  },

  async pageUrl(skinId: string, pageName: string): Promise<string | null> {
    const m = getCrfMeta();
    const hit = m.find((x) => x.id === skinId);
    if (!hit) return null;
    _urls[skinId] = _urls[skinId] || {};
    if (_urls[skinId][pageName]) return _urls[skinId][pageName];
    const rec = await this.get(skinId);
    if (!rec || !rec.files) return null;
    const f = rec.files[pageName] || rec.files[rec.base + '.png'];
    if (!f) return null;
    const url = URL.createObjectURL(f);
    _urls[skinId][pageName] = url;
    return url;
  },

  entryFor(rec: CrfRecord): CrfSkinEntry {
    const base = rec.base;
    _urls[rec.id] = _urls[rec.id] || {};
    function urlOf(name: string): string | null {
      if (!_urls[rec.id][name]) {
        const f = rec.files[name];
        if (!f) return null;
        _urls[rec.id][name] = URL.createObjectURL(f);
      }
      return _urls[rec.id][name];
    }
    return {
      id: rec.id,
      chr: 'crf_chr_002',
      hasSpine: true,
      imported: true,
      preview: urlOf(base + '.png'),
      skel: urlOf(base + '.skel'),
      atlas: urlOf(base + '.atlas'),
      gesture: urlOf(base + '_gesture.json'),
    };
  },

  async entries(): Promise<CrfSkinEntry[]> {
    const ids = getCrfMeta().map((x) => x.id);
    if (!ids.length) return [];
    const list = await Promise.all(
      ids.map(async (id) => {
        const rec = await crfStore.get(id);
        return rec ? crfStore.entryFor(rec) : null;
      })
    );
    return list.filter((x): x is CrfSkinEntry => Boolean(x));
  },
};

export const CrfStore = crfStore;
export default crfStore;
