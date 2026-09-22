// @wc-ignore-file
import { config } from './config.svelte';
import { Api } from '$lib/api';

export const MEMORY_KEY = 'ryza.longmem.v1';
const TEXT_MAX = 2000;

export interface MemoryTurn {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

export interface MemoryCard {
  id: string;
  layer: 'session' | 'summary';
  text: string;
  at: number;
  n: number;
}

export interface MemorySnapshot {
  v: number;
  pending: MemoryTurn[];
  sessions: MemoryCard[];
  summaries: MemoryCard[];
}

function clampInt(v: unknown, d: number, lo: number, hi: number): number {
  const n = parseInt(String(v != null ? v : ''), 10);
  if (isNaN(n)) return d;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function uid(): string {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function clip(s?: string | null): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TEXT_MAX);
}

function createCard(layer: 'session' | 'summary', text: string, n: number): MemoryCard {
  return { id: uid(), layer, text: clip(text), at: Date.now(), n: n | 0 };
}

function validCard(c: unknown): c is MemoryCard {
  return Boolean(
    c &&
    typeof c === 'object' &&
    'id' in c &&
    'text' in c &&
    typeof (c as { id: unknown }).id === 'string' &&
    typeof (c as { text: unknown }).text === 'string'
  );
}

function fallbackText(items: Array<Partial<MemoryTurn & MemoryCard & { content?: string }>>): string {
  return items
    .map((it) => {
      if (it.text && !it.role) return it.text;
      const who = it.role === 'user' ? '君' : 'ライザ';
      return who + '：' + clip(it.content || it.text || '');
    })
    .join(' / ')
    .slice(0, 800);
}

function formatPending(pending: MemoryTurn[]): string {
  return pending
    .map((t) => {
      const who = t.role === 'user' ? '君' : 'ライザ';
      return who + '：' + clip(t.text);
    })
    .join('\n');
}

export type MemorySummarizer = (
  items: Array<MemoryTurn | MemoryCard>,
  kind: 'pending' | 'sessions' | 'summaries'
) => Promise<string> | string;

export class MemoryStore {
  readonly KEY = MEMORY_KEY;
  pending = $state<MemoryTurn[]>([]);
  sessions = $state<MemoryCard[]>([]);
  summaries = $state<MemoryCard[]>([]);

  private _busy: Promise<unknown> | false = false;
  private _summarizer: MemorySummarizer | null = null;

  constructor() {
    this.load();
  }

  cfg() {
    const m = config.get('memory');
    return {
      enabled: m.enabled !== false,
      turnsPerSession: clampInt(m.turnsPerSession, 8, 2, 32),
      sessionCap: clampInt(m.sessionCap, 8, 2, 24),
      summaryCap: clampInt(m.summaryCap, 8, 2, 24),
    };
  }

  load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        if (j && j.v === 1 && Array.isArray(j.sessions) && Array.isArray(j.summaries)) {
          this.pending = Array.isArray(j.pending) ? j.pending : [];
          this.sessions = j.sessions.filter(validCard);
          this.summaries = j.summaries.filter(validCard);
          return;
        }
      }
    } catch {}
    this.pending = [];
    this.sessions = [];
    this.summaries = [];
  }

  save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const state: MemorySnapshot = {
        v: 1,
        pending: this.pending,
        sessions: this.sessions,
        summaries: this.summaries,
      };
      localStorage.setItem(MEMORY_KEY, JSON.stringify(state));
    } catch {}
  }

  snapshot(): MemorySnapshot {
    return {
      v: 1,
      pending: JSON.parse(JSON.stringify(this.pending)),
      sessions: JSON.parse(JSON.stringify(this.sessions)),
      summaries: JSON.parse(JSON.stringify(this.summaries)),
    };
  }

  restore(snap?: Partial<MemorySnapshot> | null): void {
    if (!snap || typeof snap !== 'object') {
      this.reset();
      return;
    }
    this.pending = Array.isArray(snap.pending) ? snap.pending : [];
    this.sessions = Array.isArray(snap.sessions) ? snap.sessions.filter(validCard) : [];
    this.summaries = Array.isArray(snap.summaries) ? snap.summaries.filter(validCard) : [];
    this.save();
  }

  reset(): void {
    this.pending = [];
    this.sessions = [];
    this.summaries = [];
    this.save();
  }

  setSummarizer(fn: MemorySummarizer | null): void {
    this._summarizer = fn;
  }

  private async summarize(
    items: Array<MemoryTurn | MemoryCard>,
    kind: 'pending' | 'sessions' | 'summaries'
  ): Promise<string> {
    if (typeof this._summarizer === 'function') {
      try {
        return await Promise.resolve(this._summarizer(items, kind));
      } catch {
        return fallbackText(items);
      }
    }

    const body =
      kind === 'pending'
        ? formatPending(items as MemoryTurn[])
        : (items as MemoryCard[]).map((it) => '・' + it.text).join('\n');
    const sys =
      '会話記憶の要約者。与えられた内容を短い箇条書き1本にまとめる。' +
      '固有名詞・約束・感情の変化を残す。タグもJSONも出力しない。200字以内。';

    try {
      const t = await Api.complete(sys, body, { maxTokens: 280, temperature: 0.2 });
      return clip(t) || fallbackText(items);
    } catch {
      return fallbackText(items);
    }
  }

  private runQueue<T>(fn: () => Promise<T>): Promise<T> {
    if (this._busy) {
      return this._busy.then(() => fn());
    }
    const p = Promise.resolve()
      .then(fn)
      .finally(() => {
        this._busy = false;
      });
    this._busy = p;
    return p;
  }

  private async promoteSummaries(): Promise<boolean> {
    const c = this.cfg();
    if (this.summaries.length < c.summaryCap) return false;
    const batch = this.summaries.slice();
    const text = await this.summarize(batch, 'summaries');
    this.summaries = [createCard('summary', text, batch.length)];
    this.save();
    return true;
  }

  private async promoteSessions(): Promise<boolean> {
    const c = this.cfg();
    if (this.sessions.length < c.sessionCap) return false;
    const batch = this.sessions.slice();
    const text = await this.summarize(batch, 'sessions');
    this.sessions = [];
    this.summaries.push(createCard('summary', text, batch.length));
    this.save();
    await this.promoteSummaries();
    return true;
  }

  private async flushPending(): Promise<boolean> {
    if (!this.pending.length) return false;
    const batch = this.pending.slice();
    this.pending = [];
    this.save();

    const text = await this.summarize(batch, 'pending');
    this.sessions.push(createCard('session', text, Math.ceil(batch.length / 2)));
    this.save();
    await this.promoteSessions();
    return true;
  }

  private maybeRoll(): Promise<void> {
    const c = this.cfg();
    if (!c.enabled) return Promise.resolve();
    return this.runQueue(async () => {
      if (this.pending.length >= c.turnsPerSession * 2) {
        await this.flushPending();
      }
      await this.promoteSessions();
      await this.promoteSummaries();
    }).catch(() => {});
  }

  ingest(userText?: string | null, assistantText?: string | null): void {
    if (!this.cfg().enabled) return;
    const u = clip(userText);
    const a = clip(assistantText);
    if (!u && !a) return;
    if (u) this.pending.push({ role: 'user', text: u, at: Date.now() });
    if (a) this.pending.push({ role: 'assistant', text: a, at: Date.now() });
    this.save();
    this.maybeRoll();
  }

  flushNow(): Promise<void> {
    if (!this.cfg().enabled) return Promise.resolve();
    return this.runQueue(async () => {
      await this.flushPending();
      await this.promoteSessions();
      await this.promoteSummaries();
    }).catch(() => {});
  }

  notifyPressure(): void {
    this.flushNow();
  }

  list(
    layer?: 'session' | 'summary'
  ): MemoryCard[] | { pending: MemoryTurn[]; sessions: MemoryCard[]; summaries: MemoryCard[] } {
    if (layer === 'summary') return this.summaries.slice();
    if (layer === 'session') return this.sessions.slice();
    return {
      pending: this.pending.slice(),
      sessions: this.sessions.slice(),
      summaries: this.summaries.slice(),
    };
  }

  pendingTurns(): number {
    return Math.ceil(this.pending.length / 2);
  }

  get(id: string): MemoryCard | null {
    return this.summaries.find((c) => c.id === id) || this.sessions.find((c) => c.id === id) || null;
  }

  update(id: string, text: string): boolean {
    const c = this.get(id);
    if (!c) return false;
    c.text = clip(text);
    this.save();
    return true;
  }

  remove(id: string): boolean {
    const prev = this.summaries.length + this.sessions.length;
    this.summaries = this.summaries.filter((c) => c.id !== id);
    this.sessions = this.sessions.filter((c) => c.id !== id);
    if (this.summaries.length + this.sessions.length === prev) return false;
    this.save();
    return true;
  }

  add(text: string, layer: 'session' | 'summary' = 'session'): MemoryCard | null {
    const t = clip(text);
    if (!t) return null;
    const c = createCard(layer, t, 0);
    if (c.layer === 'summary') this.summaries.push(c);
    else this.sessions.push(c);
    this.save();
    this.maybeRoll();
    return c;
  }

  promptBlock(): string {
    if (!this.cfg().enabled) return '';
    if (!this.summaries.length && !this.sessions.length) return '';
    const L = ['## 長期記憶（下ほど新しい。事実だけ参照）'];
    this.summaries.forEach((c) => L.push('- ' + c.text));
    this.sessions.forEach((c) => L.push('- ' + c.text));
    return L.join('\n');
  }
}

export const memory = new MemoryStore();
export const Memory = memory;
export default memory;
