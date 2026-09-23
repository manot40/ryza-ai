// @wc-ignore-file
/**
 * longmem.svelte.ts — Long-term episodic memory: dated entries + compressed digest narrative.
 *
 * Distinct from rolling card memory (memory.svelte.ts):
 * - entries[]: precise facts with date, category, importance 1-5, keywords
 * - digest: chronological narrative prose capturing nuances
 * - protected categories (promise, confession, etc.) and importance 5 are never silently discarded
 */

export const LONGMEM_KEY = 'ryza.longmem.v1';
export const ENTRY_LIMIT = 40;
export const DIGEST_MAX = 1600;
export const DIGEST_PROMPT_MAX = 800;
export const SELECT_LIMIT = 12;
export const SUMMARY_MAX = 120;
export const KEYWORD_MAX = 8;
export const PENDING_MAX = 20;
export const DIALOGUE_MAX = 12000;

export const PROTECTED_CATEGORIES = [
  'promise',
  'confession',
  'deep_hurt',
  'relationship_turning_point',
  'major_life_event',
];

const RECENT_CUE = /昨天|前天|之前|上次|还记得|记得|remember|yesterday|昨日|前回|あの時/i;

export const CONSOLIDATE_SYS = [
  '你负责维护有限、可靠的长期记忆。只输出 JSON，不要 Markdown 或解释。',
  '格式：{"digest":"按时间顺序的概略散文","entries":[{"date":"YYYY-MM-DD",',
  '"category":"类别","importance":1,"summary":"简洁事实","status":"active",',
  '"keywords":["关键词"]}]}。',
  '合并旧记忆与近期对话并去重；同一事件更新原条目，不重复新增。',
  '只保留稳定偏好、重要经历、关系变化、未完成约定与未来确有价值的信息；',
  '普通寒暄、一次性客套、重复信息应删除。entries 最多 ' + ENTRY_LIMIT + ' 条。',
  '不适合单独成条但丢掉可惜的内容并进 digest（按时间顺序，≤ ' + DIGEST_MAX + ' 字）。',
  'importance 1-5。誓言/承诺用 promise，告白用 confession，深刻伤害用 deep_hurt，',
  '关系转折用 relationship_turning_point，重大人生事件用 major_life_event；',
  '这些类别必须设为 5，除非近期对话明确撤回或解决，否则不删。不要编造日期与细节。',
].join('\n');

export interface LongMemEntry {
  id: string;
  date: string;
  category: string;
  importance: number;
  summary: string;
  status: 'active' | 'retired';
  keywords: string[];
}

export interface LongMemTurn {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface LongMemSnapshot {
  v: number;
  updatedAt: string;
  digest: string;
  entries: LongMemEntry[];
  pending: LongMemTurn[];
}

function clip(s?: unknown, n: number = SUMMARY_MAX): string {
  return String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
}

function nowInfo(): { iso: string; day: string } {
  const d = new Date();
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return {
    iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
    day: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
  };
}

function validEntry(e: unknown): e is Partial<LongMemEntry> {
  return Boolean(
    e &&
    typeof e === 'object' &&
    typeof (e as { summary?: unknown }).summary === 'string' &&
    (e as { summary: string }).summary
  );
}

function normEntry(e: Partial<LongMemEntry>): LongMemEntry {
  return {
    id: e.id || 'e' + Math.random().toString(36).slice(2, 9),
    date: clip(e.date, 10) || nowInfo().day,
    category: clip(e.category, 32) || 'general',
    importance: Math.max(1, Math.min(5, parseInt(String(e.importance != null ? e.importance : 3), 10) || 3)),
    summary: clip(e.summary, SUMMARY_MAX),
    status: e.status === 'retired' ? 'retired' : 'active',
    keywords: (Array.isArray(e.keywords) ? e.keywords : [])
      .map((k) => clip(k, 16))
      .filter(Boolean)
      .slice(0, KEYWORD_MAX),
  };
}

function validTurn(t: unknown): t is LongMemTurn {
  return Boolean(
    t &&
    typeof t === 'object' &&
    ((t as LongMemTurn).role === 'user' || (t as LongMemTurn).role === 'assistant') &&
    typeof (t as LongMemTurn).text === 'string'
  );
}

export function isProtected(e: LongMemEntry): boolean {
  return PROTECTED_CATEGORIES.includes(e.category) || e.importance >= 5;
}

export function scoreEntry(e: LongMemEntry, cue?: string): number {
  let s = e.importance;
  if (e.status !== 'active') s -= 3;
  if (!cue) return s;
  const low = cue.toLowerCase();
  if (e.date && cue.includes(e.date)) s += 4;
  e.keywords.forEach((k) => {
    if (k && low.includes(k.toLowerCase())) s += 3;
  });
  if (e.summary && low.includes(e.summary.slice(0, 8).toLowerCase())) s += 3;
  if (RECENT_CUE.test(cue)) s += 1;
  return s;
}

function sameKey(e: Partial<LongMemEntry>): string {
  const t = String(e.summary || '')
    .replace(/[\s　]+/g, '')
    .replace(/[。、，．,.!！?？「」『』（）()【】\[\]:：;；…—~〜-]/g, '')
    .toLowerCase();
  return `${String(e.date || '')}#${t.slice(0, 14)}`;
}

export function parseConsolidation(
  text?: string
): { digest?: string; entries?: Partial<LongMemEntry>[] } | null {
  let s = String(text || '').trim();
  s = s
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try {
    return JSON.parse(s.slice(i, j + 1));
  } catch {
    return null;
  }
}

export type LLMConsolidator = (
  system: string,
  user: string,
  opts?: { maxTokens?: number }
) => Promise<string>;

export class LongMemStore {
  readonly KEY = LONGMEM_KEY;

  digest = $state('');
  entries = $state<LongMemEntry[]>([]);
  pending = $state<LongMemTurn[]>([]);
  updatedAt = $state('');

  private _llm: LLMConsolidator | null = null;

  constructor() {
    this.load();
  }

  setLLM(fn: LLMConsolidator | null): void {
    this._llm = fn;
  }

  load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (j && j.v === 1 && Array.isArray(j.entries)) {
        this.updatedAt = String(j.updatedAt || '');
        this.digest = clip(j.digest, DIGEST_MAX);
        this.entries = j.entries.filter(validEntry).map(normEntry);
        this.pending = (j.pending || []).filter(validTurn).slice(-PENDING_MAX);
      }
    } catch {}
  }

  persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const out: LongMemSnapshot = {
        v: 1,
        updatedAt: this.updatedAt,
        digest: clip(this.digest, DIGEST_MAX),
        entries: this.entries.slice(0, ENTRY_LIMIT).map(normEntry),
        pending: this.pending.slice(-PENDING_MAX),
      };
      localStorage.setItem(this.KEY, JSON.stringify(out));
    } catch {}
  }

  snapshot(): LongMemSnapshot {
    return {
      v: 1,
      updatedAt: this.updatedAt,
      digest: clip(this.digest, DIGEST_MAX),
      entries: JSON.parse(JSON.stringify(this.entries)),
      pending: JSON.parse(JSON.stringify(this.pending)),
    };
  }

  restore(snap?: Partial<LongMemSnapshot> | null): void {
    if (!snap || typeof snap !== 'object') {
      this.reset();
      return;
    }
    this.updatedAt = String(snap.updatedAt || '');
    this.digest = clip(snap.digest, DIGEST_MAX);
    this.entries = Array.isArray(snap.entries) ? snap.entries.filter(validEntry).map(normEntry) : [];
    this.pending = Array.isArray(snap.pending) ? snap.pending.filter(validTurn).slice(-PENDING_MAX) : [];
    this.persist();
  }

  enforceLimit(): number {
    if (this.entries.length <= ENTRY_LIMIT) return 0;
    const sorted = this.entries.slice().sort((a, b) => {
      const pa = isProtected(a) ? 1 : 0;
      const pb = isProtected(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.importance - a.importance || String(b.date).localeCompare(String(a.date));
    });
    const keep = sorted.slice(0, ENTRY_LIMIT);
    const fold = sorted.slice(ENTRY_LIMIT);
    this.entries = keep;
    if (fold.length) {
      const note = fold.map((e) => `${e.date} ${e.summary}`).join('；');
      this.digest = clip((this.digest ? this.digest + ' ' : '') + note, DIGEST_MAX);
    }
    return fold.length;
  }

  selectEntries(cue?: string, limit: number = SELECT_LIMIT): LongMemEntry[] {
    const live = this.entries.filter((e) => e.status === 'active');
    return live
      .map((e) => ({ e, s: scoreEntry(e, cue) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.e);
  }

  note(role: 'user' | 'assistant', text: string, opts?: { noConsolidate?: boolean }): boolean {
    const t = clip(text, 600);
    if (!t || (role !== 'user' && role !== 'assistant')) return false;
    this.pending.push({ role, text: t, at: nowInfo().iso });
    while (this.pending.length > PENDING_MAX) this.pending.shift();
    this.persist();
    if (!opts?.noConsolidate) this.maybeConsolidate();
    return true;
  }

  mergeConsolidation(obj: { digest?: string; entries?: Partial<LongMemEntry>[] } | null): boolean {
    if (!obj) return false;
    let added = 0;
    if (typeof obj.digest === 'string' && obj.digest.trim()) {
      this.digest = clip(obj.digest, DIGEST_MAX);
    }
    const incoming = (Array.isArray(obj.entries) ? obj.entries : []).filter(validEntry).map(normEntry);

    incoming.forEach((ne) => {
      let dup: LongMemEntry | null = null;
      const key = sameKey(ne);
      this.entries.forEach((e) => {
        if (dup) return;
        if (sameKey(e) === key) dup = e;
      });
      if (dup) {
        (dup as LongMemEntry).summary = ne.summary;
        (dup as LongMemEntry).importance = Math.max((dup as LongMemEntry).importance, ne.importance);
        (dup as LongMemEntry).category = ne.category;
        (dup as LongMemEntry).keywords = ne.keywords;
        (dup as LongMemEntry).status = ne.status;
      } else {
        this.entries.push(ne);
        added++;
      }
    });

    this.enforceLimit();
    this.updatedAt = nowInfo().iso;
    this.persist();
    return added > 0 || incoming.length > 0;
  }

  async consolidate(): Promise<unknown> {
    if (!this._llm) return null;
    let body = JSON.stringify({
      now: nowInfo().iso,
      previous: { digest: this.digest, entries: this.entries },
      dialogue: this.pending,
    });
    if (body.length > DIALOGUE_MAX) body = body.slice(0, DIALOGUE_MAX);

    try {
      const text = await this._llm(CONSOLIDATE_SYS, body, { maxTokens: 1200 });
      const obj = parseConsolidation(text);
      const pending = this.pending.slice();
      this.pending = [];
      if (!obj) {
        const note = pending.map((p) => `${p.role}: ${p.text}`).join(' | ');
        const fallback = note || '（本轮归纳未返回可用 JSON）';
        this.digest = clip((this.digest ? this.digest + ' ' : '') + fallback, DIGEST_MAX);
        this.persist();
        return null;
      }
      this.mergeConsolidation(obj);
      return obj;
    } catch {
      return null;
    }
  }

  maybeConsolidate(): Promise<unknown> {
    if (this.pending.length < PENDING_MAX) return Promise.resolve(null);
    return this.consolidate();
  }

  promptBlock(cue?: string): string {
    const L: string[] = [];
    const digest = clip(this.digest, DIGEST_PROMPT_MAX);
    if (digest) {
      L.push('## 長期記憶（概略）');
      L.push(digest);
    }
    const picked = this.selectEntries(cue, SELECT_LIMIT);
    if (picked.length) {
      L.push('## 長期記憶（出来事）');
      picked.forEach((e) => {
        L.push(`- [${e.date}] ${e.summary}`);
      });
    }
    return L.join('\n');
  }

  add(summary: string, opts?: Partial<LongMemEntry>): LongMemEntry | null {
    const ne = normEntry({
      date: opts?.date,
      category: opts?.category,
      importance: opts?.importance,
      summary,
      keywords: opts?.keywords,
    });
    if (!ne.summary) return null;
    this.entries.push(ne);
    this.enforceLimit();
    this.persist();
    return ne;
  }

  remove(id: string): boolean {
    const prev = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length === prev) return false;
    this.persist();
    return true;
  }

  protectedEntries(): LongMemEntry[] {
    return this.entries.filter(isProtected);
  }

  clearPending(): void {
    this.pending = [];
    this.persist();
  }

  reset(): void {
    this.digest = '';
    this.entries = [];
    this.pending = [];
    this.updatedAt = '';
    this.persist();
  }
}

export const longMem = new LongMemStore();
export const LongMem = longMem;
export const longmem = longMem;
export default longMem;
