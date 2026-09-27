import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { config, type LlmConfig } from '$lib/stores/config.svelte';
import { Langs } from '$lib/i18n/langs';
import {
  localProxy,
  upstreamUrl,
  requestGet,
  apiErrorMessage,
  isTransportError,
  createTransportError,
} from './http';
import {
  parseModelEntry,
  attachThinking,
  estMessages,
  resolvedContext as resolveContextFromThinking,
  type ModelEntry,
} from './thinking';
import { buildSystemPrompt, withTurnCue } from './prompt';
import { parseTaggedReply, type TaggedReply, type ScreenTagState } from './tags';

let modelMeta: ModelEntry | null = null;

export function resolvedContext(): number {
  return resolveContextFromThinking(config.get('llm'), modelMeta);
}

export function replyLang(): string {
  return Langs.llm() || 'ja';
}

const providerCache = new Map<string, OpenAICompatibleProvider>();

export function clearProviderCache(): void {
  providerCache.clear();
}

export function getLlmProvider(llmConfig: LlmConfig = config.get('llm')): OpenAICompatibleProvider {
  if (!llmConfig.apiKey) throw new Error('NO_KEY');
  const baseUrl = (llmConfig.baseUrl || '').replace(/\/+$/, '');
  const cacheKey = `${baseUrl}|${llmConfig.apiKey}`;

  let provider = providerCache.get(cacheKey);
  if (!provider) {
    provider = createOpenAICompatible({
      name: 'openai-compatible',
      baseURL: baseUrl,
      apiKey: llmConfig.apiKey,
      headers: llmConfig.apiKey ? { 'api-key': llmConfig.apiKey } : undefined,
      async fetch(input, init) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const res = await fetch(localProxy(url), init);

        // Normalize plain mock responses in tests that provide json() without body ReadableStream
        if (res && !res.body && typeof res.json === 'function') {
          const jsonVal = await res.json();
          const str = JSON.stringify(jsonVal);
          const encoder = new TextEncoder();
          (res as { body: unknown }).body = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(str));
              controller.close();
            },
          });
          res.json = () => Promise.resolve(jsonVal);
          res.text = () => Promise.resolve(str);
        }

        return res;
      },
      transformRequestBody: (body) => attachThinking(body, config.get('llm'), modelMeta),
    });
    providerCache.set(cacheKey, provider);
  }
  return provider;
}

export function normalizeLlmError(err: unknown): Error {
  if (!err) return new Error('Unknown error');
  if (isTransportError(err)) return err;

  const errorObj = err as {
    statusCode?: number;
    responseBody?: string;
    data?: unknown;
    message?: string;
    name?: string;
  };

  if (typeof errorObj.statusCode === 'number') {
    let parsed: unknown = null;
    try {
      parsed = errorObj.responseBody ? JSON.parse(errorObj.responseBody) : errorObj.data;
    } catch {}
    const msg = apiErrorMessage(parsed, errorObj.statusCode, errorObj.responseBody);
    return new Error(msg);
  }

  const msg = String(errorObj.message || '');
  const name = String(errorObj.name || '');
  if (name === 'TimeoutError' || /timeout|timed out|abort/i.test(msg)) {
    return createTransportError('timeout');
  }
  if (/fetch|network|connect/i.test(msg)) {
    return createTransportError('net');
  }
  return err instanceof Error ? err : new Error(msg);
}

export interface ChatOptions {
  mode?: string;
  style?: string;
  lang?: string;
  rpgContext?: string;
  nsfwSection?: string;
  sceneSection?: string;
  memoryBlock?: string;
  onPressure?: () => void;
  tagState?: ScreenTagState;
}

export interface PreparedTurnContext {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export function prepareTurnContext(
  history: Array<{ role: string; content?: string }>,
  userText: string,
  opts: ChatOptions = {}
): PreparedTurnContext {
  const llm = config.get('llm');
  const st = config.get('state');
  const outLang = opts.lang || replyLang();
  const system = buildSystemPrompt({
    mode: opts.mode || st.mode,
    style: opts.style || st.style,
    rpgContext: opts.rpgContext || '',
    outLang,
    nsfwSection: opts.nsfwSection || '',
    sceneSection: opts.sceneSection || '',
    memorySection: opts.memoryBlock || '',
    tagState: opts.tagState,
  });

  const keep = Math.max(0, (llm.historyTurns || 12) * 2);
  let hist = (history || []).slice(-keep);
  const ctx = resolvedContext();
  const reserve = Math.max(256, Number(llm.maxTokens) || 400) + 96;
  const budget = Math.max(1024, ctx - reserve);

  function pack(h: Array<{ role: string; content?: string }>) {
    return [
      { role: 'system', content: system },
      ...h,
      { role: 'user', content: withTurnCue(userText, opts.tagState) },
    ];
  }

  let used = estMessages(pack(hist));
  while (hist.length > 2 && used > budget) {
    hist = hist.slice(2);
    used = estMessages(pack(hist));
  }

  if (used > budget * 0.85 && opts.onPressure) {
    try {
      opts.onPressure();
    } catch {}
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...hist.map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: String(m.content || ''),
    })),
    { role: 'user', content: withTurnCue(userText, opts.tagState) },
  ];

  return {
    systemPrompt: system,
    messages,
  };
}

export async function chat(
  history: Array<{ role: string; content?: string }>,
  userText: string,
  opts: ChatOptions = {}
): Promise<TaggedReply> {
  const llm = config.get('llm');
  if (!llm.apiKey) throw new Error('NO_KEY');

  const { systemPrompt, messages } = prepareTurnContext(history, userText, opts);
  const provider = getLlmProvider(llm);

  try {
    const { text } = await generateText({
      model: provider.chatModel(llm.model),
      system: systemPrompt,
      messages,
      temperature: Number(llm.temperature) || 0.9,
      maxOutputTokens: Number(llm.maxTokens) || 400,
    });
    return parseTaggedReply(text);
  } catch (err: unknown) {
    throw normalizeLlmError(err);
  }
}

export async function complete(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; timeout?: number } = {}
): Promise<string> {
  const llm = config.get('llm');
  if (!llm.apiKey) throw new Error('NO_KEY');

  const provider = getLlmProvider(llm);
  try {
    const { text } = await generateText({
      model: provider.chatModel(llm.model),
      system: String(system || ''),
      prompt: String(user || ''),
      temperature: opts.temperature != null ? opts.temperature : 0.2,
      maxOutputTokens: opts.maxTokens || 280,
      abortSignal: opts.timeout ? AbortSignal.timeout(opts.timeout) : AbortSignal.timeout(60000),
    });
    return text.trim();
  } catch (err: unknown) {
    throw normalizeLlmError(err);
  }
}

export async function listModels(): Promise<ModelEntry[]> {
  const llm = config.get('llm');
  const url = localProxy(upstreamUrl(llm.baseUrl, '/models'));
  if (!llm.apiKey) throw new Error('NO_KEY');
  if (!llm.baseUrl) throw new Error('NO_URL');

  const j = (await requestGet(url, llm.apiKey, 20000)) as Record<string, unknown>;
  const raw =
    (j && typeof j === 'object' && (j.data || j.models || (typeof j.data == 'object' && j.data))) || [];
  if (!Array.isArray(raw)) return [];

  const out: ModelEntry[] = [];
  raw.forEach((m: unknown) => {
    const e = parseModelEntry(m);
    if (e) out.push(e);
  });
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cur = out.find((e) => e.id === llm.model);
  modelMeta = cur || out[0] || null;
  return out;
}

export type { ModelEntry } from './thinking';
