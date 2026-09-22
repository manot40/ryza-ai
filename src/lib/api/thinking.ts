import type { LlmConfig } from '$lib/stores/config.svelte';

export interface ModelEntry {
  id: string;
  context: number;
  thinking: boolean;
  efforts: string[];
  style?: string;
  [key: string]: unknown;
}

export type ModelMeta = Partial<ModelEntry>;

export const EFFORT_RANK: Record<string, number> = {
  default: -1,
  off: 0,
  none: 0,
  disabled: 0,
  low: 1,
  minimal: 1,
  min: 1,
  medium: 2,
  mid: 2,
  high: 3,
  xhigh: 4,
  max: 5,
};

export const EFFORT_UI = ['default', 'off', 'low', 'medium', 'high', 'max'] as const;
export type EffortUi = (typeof EFFORT_UI)[number];

export const QWEN_BUDGET: Record<string, number> = {
  low: 512,
  medium: 2048,
  high: 8192,
  max: 32768,
};

export function normalizeEffort(v?: string | null): string {
  const s = String(v == null ? '' : v)
    .toLowerCase()
    .trim();
  if (!s) return 'default';
  if (s === 'none' || s === 'disabled' || s === 'false') return 'off';
  if (s === 'minimal' || s === 'min') return 'low';
  if (s === 'mid') return 'medium';
  if (s === 'extra-high' || s === 'extra_high' || s === 'extra high') return 'xhigh';
  return Object.prototype.hasOwnProperty.call(EFFORT_RANK, s) ? s : 'default';
}

export function effortRank(v?: string | null): number {
  const n = normalizeEffort(v);
  return EFFORT_RANK[n] != null ? EFFORT_RANK[n] : -1;
}

export function mapEffort(wanted?: string | null, available?: string[]): string | null {
  const w = normalizeEffort(wanted);
  if (w === 'default') return null;
  const list: string[] = [];
  if (Array.isArray(available)) {
    available.forEach((tok) => {
      if (tok == null || tok === '') return;
      const s = String(tok);
      if (!list.includes(s)) list.push(s);
    });
  }
  if (!list.length) return null;

  for (let i = 0; i < list.length; i++) {
    if (normalizeEffort(list[i]) === w) return list[i];
  }

  const wr = effortRank(w);
  if (wr < 0) return null;

  let best: string | null = null;
  let bestD = 1e9;
  let bestR = -1;

  for (let i = 0; i < list.length; i++) {
    const tok = list[i];
    const r = effortRank(tok);
    if (r < 0) continue;
    const d = Math.abs(r - wr);
    if (d < bestD || (d === bestD && r > bestR)) {
      bestD = d;
      bestR = r;
      best = tok;
    }
  }
  return best;
}

export function parseEffortList(m: unknown): string[] {
  if (!m || typeof m !== 'object') return [];
  const rec = m as Record<string, unknown>;
  const out: string[] = [];
  function add(v: unknown) {
    if (v == null || v === '') return;
    const s = String(v);
    if (!out.includes(s)) out.push(s);
  }
  const raw =
    rec.reasoning_options || rec.reasoning_effort_options || rec.supported_reasoning_efforts || rec.efforts;
  if (typeof raw === 'string') add(raw);
  if (Array.isArray(raw)) {
    raw.forEach((o) => {
      if (o == null) return;
      if (typeof o === 'string') add(o);
      else if (typeof o === 'object' && o !== null) {
        const obj = o as Record<string, unknown>;
        if (Array.isArray(obj.values) && (obj.type === 'effort' || !obj.type)) {
          obj.values.forEach(add);
        }
      }
    });
  }
  return out;
}

export function guessEffortList(id: string, style: string): string[] {
  id = String(id || '').toLowerCase();
  if (style === 'glm' || /glm-?5/.test(id)) return ['low', 'high', 'max'];
  if (style === 'qwen') return ['off', 'low', 'medium', 'high', 'max'];
  if (style === 'openai' || style === 'openrouter' || /^(o1|o3|o4|gpt-5)/.test(id) || /gpt-5/.test(id)) {
    return ['none', 'low', 'medium', 'high', 'xhigh'];
  }
  return [];
}

export function protocolEffortList(style: string, meta: ModelMeta | null | undefined, id: string): string[] {
  if (meta && meta.efforts && meta.efforts.length) return meta.efforts;
  return guessEffortList(id, style);
}

export function guessContext(id?: string | null): number {
  id = String(id || '').toLowerCase();
  if (/gpt-5|gpt-4\.1|o3|o4|o1/.test(id)) return 200000;
  if (/gpt-4o|gpt-4-turbo|chatgpt-4o/.test(id)) return 128000;
  if (/gpt-3\.5/.test(id)) return 16385;
  if (/claude/.test(id)) return 200000;
  if (/gemini/.test(id)) return 128000;
  if (/deepseek/.test(id)) return 65536;
  if (/qwen3|qwen2\.5|qwen2/.test(id)) return 32768;
  if (/qwen/.test(id)) return 32768;
  if (/llama-?3\.1|llama3\.1/.test(id)) return 131072;
  if (/mistral|mixtral/.test(id)) return 32768;
  return 0;
}

export function parseContextField(m: unknown): number {
  if (!m || typeof m !== 'object') return 0;
  const rec = m as Record<string, unknown>;
  const limit = rec.limit && typeof rec.limit === 'object' ? (rec.limit as Record<string, unknown>) : null;
  const topProvider =
    rec.top_provider && typeof rec.top_provider === 'object'
      ? (rec.top_provider as Record<string, unknown>)
      : null;
  const meta = rec.meta && typeof rec.meta === 'object' ? (rec.meta as Record<string, unknown>) : null;
  const arch =
    rec.architecture && typeof rec.architecture === 'object'
      ? (rec.architecture as Record<string, unknown>)
      : null;
  const n = Number(
    rec.context_length ||
      rec.max_model_len ||
      rec.context_window ||
      rec.max_context ||
      (limit && (limit.context || limit.context_length)) ||
      (topProvider && topProvider.context_length) ||
      (meta && (meta.n_ctx || meta.max_model_len)) ||
      (arch && arch.context_length) ||
      0
  );
  return n > 1024 ? Math.floor(n) : 0;
}

export function parseModelEntry(m: unknown): ModelEntry | null {
  if (!m) return null;
  const rec =
    typeof m === 'string' ? { id: m } : typeof m === 'object' ? (m as Record<string, unknown>) : null;
  if (!rec) return null;
  const id = String(rec.id || rec.name || '');
  if (!id) return null;

  let params = rec.supported_parameters || rec.supported_params || [];
  if (typeof params === 'string') params = [params];

  let thinking = false;
  if (Array.isArray(params)) {
    thinking =
      params.includes('reasoning') ||
      params.includes('include_reasoning') ||
      params.includes('reasoning_effort') ||
      params.includes('enable_thinking');
  }
  const arch =
    rec.architecture && typeof rec.architecture === 'object'
      ? (rec.architecture as Record<string, unknown>)
      : null;
  if (arch && arch.instruct_type === 'deepseek-r1') thinking = true;
  if (rec.reasoning === true || rec.thinking === true) thinking = true;

  const efforts = parseEffortList(rec);
  if (efforts.length) thinking = true;

  const ro = rec.reasoning_options;
  if (Array.isArray(ro)) {
    ro.forEach((o) => {
      if (typeof o === 'object' && o !== null && (o as Record<string, unknown>).type === 'toggle') {
        thinking = true;
      }
    });
  }

  return {
    id,
    context: parseContextField(rec) || guessContext(id),
    thinking,
    efforts,
  };
}

export function detectThinkingStyle(
  llm?: Partial<LlmConfig> | null,
  meta?: ModelMeta | null,
  modelId?: string
): string {
  const style = llm?.thinkingStyle || 'auto';
  if (style && style !== 'auto') return style;
  const url = String(llm?.baseUrl || '');
  const id = String(modelId || llm?.model || meta?.id || '');
  if (meta?.style && meta.style !== 'auto') return meta.style;
  if (/openrouter\.ai/i.test(url)) return 'openrouter';
  if (/dashscope|aliyuncs/i.test(url)) return 'qwen';
  if (/bigmodel\.cn|zhipuai/i.test(url) || /glm-?5/i.test(id)) return 'glm';
  if (/qwq|qwen.*think/i.test(id)) return 'qwen';
  if (meta?.thinking) return /openrouter/i.test(url) ? 'openrouter' : 'openai';
  if (/^(o1|o3|o4|gpt-5)/i.test(id) || /reasoner|r1|qwq/i.test(id)) {
    return /qwen|dashscope/i.test(url + id) ? 'qwen' : 'openai';
  }
  return 'none';
}

export function qwenBudget(mapped: string): number {
  let n = normalizeEffort(mapped);
  if (n === 'off' || n === 'default') return 0;
  if (n === 'xhigh') n = 'max';
  return QWEN_BUDGET[n] || QWEN_BUDGET.medium;
}

export function attachThinking<T extends Record<string, unknown>>(
  body: T,
  llm?: Partial<LlmConfig> | null,
  meta?: ModelMeta | null
): T {
  const mode = llm?.thinking || 'auto';
  const id = String(llm?.model || body.model || meta?.id || '');
  const style = detectThinkingStyle(llm, meta, id);
  let wanted = normalizeEffort(llm?.thinkingEffort);
  if (mode === 'off') wanted = 'off';
  if (style === 'none') return body;

  const available = protocolEffortList(style, meta, id);
  const mapped = mapEffort(wanted, available);

  if (wanted === 'default') {
    if (mode !== 'on') return body;
    if (style === 'qwen') {
      (body as Record<string, unknown>).enable_thinking = true;
      return body;
    }
    if (style === 'glm') {
      (body as Record<string, unknown>).thinking = { type: 'enabled' };
      return body;
    }
    return body;
  }

  if (style === 'openai') {
    if (mapped) (body as Record<string, unknown>).reasoning_effort = mapped;
    return body;
  }
  if (style === 'openrouter') {
    if (mapped) (body as Record<string, unknown>).reasoning = { effort: mapped };
    return body;
  }
  if (style === 'qwen') {
    if (wanted === 'off' || normalizeEffort(mapped) === 'off') {
      (body as Record<string, unknown>).enable_thinking = false;
      return body;
    }
    (body as Record<string, unknown>).enable_thinking = true;
    const budget = qwenBudget(mapped || wanted);
    if (budget > 0) (body as Record<string, unknown>).thinking_budget = budget;
    return body;
  }
  if (style === 'glm') {
    (body as Record<string, unknown>).thinking = { type: 'enabled' };
    if (mapped) (body as Record<string, unknown>).reasoning_effort = mapped;
    return body;
  }
  return body;
}

export function estTokens(s?: string | null): number {
  s = String(s || '');
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c > 127 ? 1.15 : 0.35;
  }
  return Math.ceil(n);
}

export function estMessages(msgs: Array<{ role: string; content?: string | null }>): number {
  let t = 0;
  for (let i = 0; i < msgs.length; i++) {
    t += 8 + estTokens(msgs[i] && msgs[i].content);
  }
  return t;
}

export function resolvedContext(llm?: Partial<LlmConfig> | null, modelMeta?: ModelMeta | null): number {
  const n = Number(llm?.contextWindow);
  if (n > 1024) return Math.floor(n);
  if (modelMeta && modelMeta.id === llm?.model && modelMeta.context && modelMeta.context > 1024) {
    return modelMeta.context;
  }
  return guessContext(llm?.model) || 32768;
}
