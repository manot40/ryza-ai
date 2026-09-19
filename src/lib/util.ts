export function clamp(v: number, lo: number, hi: number): number {
  v = Number(v);
  if (v !== v) v = lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function pad3(n: number): string {
  n = Math.floor(Number(n) || 0);
  if (n < 10) return '00' + n;
  if (n < 100) return '0' + n;
  return String(n);
}

export function hashHex(h: string | number | null | undefined): string {
  let s = String(h == null ? '' : h)
    .trim()
    .toLowerCase();
  if (!s) return '';
  const m = /^(-?)([0-9a-f]{8})(-?)([0-9a-f]{8})$/.exec(s);
  if (m) {
    let va = parseInt(m[2], 16),
      vb = parseInt(m[4], 16);
    if (m[1] === '-') va = (0x100000000 - va) >>> 0;
    if (m[3] === '-') vb = (0x100000000 - vb) >>> 0;
    return ('00000000' + va.toString(16)).slice(-8) + ('00000000' + vb.toString(16)).slice(-8);
  }
  s = s.replace(/[^0-9a-f]/g, '');
  if (!s) return '';
  while (s.length < 16) s = '0' + s;
  return s.slice(-16);
}

export function swapHashHalves(h: string): string {
  h = hashHex(h);
  if (h.length < 16) return h;
  return h.slice(8) + h.slice(0, 8);
}

export function weighted<T>(items: T[], weightOf?: (item: T) => number): T | null {
  let sum = 0;
  if (!items || !items.length) return null;
  for (let i = 0; i < items.length; i++) {
    const w = weightOf ? weightOf(items[i]) : Number((items[i] as any).weight) || 0;
    sum += w > 0 ? w : 0;
  }
  if (!(sum > 0)) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    const w = weightOf ? weightOf(items[i]) : Number((items[i] as any).weight) || 0;
    r -= w > 0 ? w : 0;
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function createEmitter<T extends Record<string, any[]>>() {
  const listeners = new Map<keyof T, Set<(...args: any[]) => void>>();
  return {
    on<K extends keyof T>(event: K, fn: (...args: T[K]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn as any);
      return () => listeners.get(event)!.delete(fn as any);
    },
    emit<K extends keyof T>(event: K, ...args: T[K]) {
      const set = listeners.get(event);
      if (set) for (const fn of set) fn(...args);
    },
  };
}
