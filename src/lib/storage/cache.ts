export interface CacheSetOptions {
  cacheName?: string;
  contentType?: string;
  headers?: Record<string, string>;
}

export class CacheStore {
  private _defaultCache: string;
  private _memoryStore: Map<string, Map<string, { blob: Blob; contentType: string }>> = new Map();

  constructor(defaultCache = 'ryza-cache-v1') {
    this._defaultCache = defaultCache;
  }

  private hasNativeCache(): boolean {
    return typeof caches !== 'undefined';
  }

  private toUrl(key: string): string {
    const base = typeof location !== 'undefined' && location.origin ? location.origin : 'https://ryza.local';
    return new URL(`/api/cache/${encodeURIComponent(key)}`, base).href;
  }

  async open(cacheName?: string): Promise<Cache | null> {
    if (!this.hasNativeCache()) return null;
    try {
      return await caches.open(cacheName || this._defaultCache);
    } catch {
      return null;
    }
  }

  async get(key: string, cacheName?: string): Promise<Response | null> {
    const name = cacheName || this._defaultCache;
    if (!this.hasNativeCache()) {
      const bucket = this._memoryStore.get(name);
      const entry = bucket?.get(key);
      if (!entry) return null;
      return new Response(entry.blob, {
        headers: { 'Content-Type': entry.contentType },
      });
    }

    try {
      const cache = await this.open(name);
      if (!cache) return null;
      const res = await cache.match(this.toUrl(key));
      return res || null;
    } catch {
      return null;
    }
  }

  async getBlob(key: string, cacheName?: string): Promise<Blob | null> {
    const res = await this.get(key, cacheName);
    if (!res) return null;
    try {
      return await res.blob();
    } catch {
      return null;
    }
  }

  async set(
    key: string,
    data: Blob | Response | ArrayBuffer | Uint8Array | string,
    options?: CacheSetOptions
  ): Promise<boolean> {
    const name = options?.cacheName || this._defaultCache;
    const contentType =
      options?.contentType || (data instanceof Blob ? data.type : '') || 'application/octet-stream';

    let blob: Blob;
    if (data instanceof Response) {
      try {
        blob = await data.blob();
      } catch {
        return false;
      }
    } else if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof Uint8Array) {
      blob = new Blob([data.buffer as ArrayBuffer], { type: contentType });
    } else if (data instanceof ArrayBuffer) {
      blob = new Blob([data], { type: contentType });
    } else {
      blob = new Blob([String(data)], { type: contentType });
    }

    if (!this.hasNativeCache()) {
      if (!this._memoryStore.has(name)) {
        this._memoryStore.set(name, new Map());
      }
      this._memoryStore.get(name)!.set(key, { blob, contentType });
      return true;
    }

    try {
      const cache = await this.open(name);
      if (!cache) return false;

      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Length': String(blob.size),
        ...(options?.headers || {}),
      };

      const res = new Response(blob, { headers });
      await cache.put(this.toUrl(key), res);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string, cacheName?: string): Promise<boolean> {
    const name = cacheName || this._defaultCache;
    if (!this.hasNativeCache()) {
      const bucket = this._memoryStore.get(name);
      return bucket ? bucket.delete(key) : false;
    }

    try {
      const cache = await this.open(name);
      if (!cache) return false;
      return await cache.delete(this.toUrl(key));
    } catch {
      return false;
    }
  }

  async has(key: string, cacheName?: string): Promise<boolean> {
    const res = await this.get(key, cacheName);
    return res !== null;
  }

  async keys(cacheName?: string): Promise<string[]> {
    const name = cacheName || this._defaultCache;
    if (!this.hasNativeCache()) {
      const bucket = this._memoryStore.get(name);
      return bucket ? Array.from(bucket.keys()) : [];
    }

    try {
      const cache = await this.open(name);
      if (!cache) return [];
      const requests = await cache.keys();
      const prefix = '/api/cache/';
      return requests
        .map((req) => {
          try {
            const path = new URL(req.url).pathname;
            if (path.includes(prefix)) {
              return decodeURIComponent(path.slice(path.indexOf(prefix) + prefix.length));
            }
            return req.url;
          } catch {
            return req.url;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async clear(cacheName?: string): Promise<boolean> {
    const name = cacheName || this._defaultCache;
    if (!this.hasNativeCache()) {
      this._memoryStore.delete(name);
      return true;
    }

    try {
      return await caches.delete(name);
    } catch {
      return false;
    }
  }
}

export const cacheStore = new CacheStore();
export default cacheStore;
