import { config } from '$lib/stores/config.svelte';
import { Langs } from '$lib/i18n/langs';
import {
  EMOTIONS,
  ATTITUDES,
  extractState,
  parseTaggedReply,
  screenTagLine,
  type TaggedReply,
  type ScreenTagState,
} from './tags';
import { buildSystemPrompt, formatHistoryReply, withTurnCue, persona, STYLE_SAMPLES, MODES } from './prompt';
import {
  EFFORT_UI,
  EFFORT_RANK,
  QWEN_BUDGET,
  normalizeEffort,
  effortRank,
  mapEffort,
  parseEffortList,
  guessEffortList,
  protocolEffortList,
  guessContext,
  parseModelEntry,
  detectThinkingStyle,
  qwenBudget,
  attachThinking,
  estTokens,
  estMessages,
  resolvedContext as resolveContextFromThinking,
  type ModelEntry,
} from './thinking';
import {
  QWEN_DEFAULT_BASE,
  QWEN_TTS_MODELS,
  QWEN_TTS_VOICES,
  VOICE_BANK_TRANSCRIPT,
  MODE_TTS,
  MODE_PLAY_FX,
  ttsStyleFor,
  qwenApiRoot,
  qwenTtsKind,
  qwenTtsPath,
  qwenTtsUrl,
  qwenHttpsUrl,
  qwenDefaultVoice,
  qwenWantsInstructions,
  isQwenHttpTtsModelId,
  parseQwenModelList,
  _b64ToUrl,
  _pcmToWav,
  _fetchAsDataUrl,
  _downloadUrl,
} from './tts';

export {
  EMOTIONS,
  ATTITUDES,
  extractState,
  parseTaggedReply,
  screenTagLine,
  type TaggedReply,
  type ScreenTagState,
  buildSystemPrompt,
  formatHistoryReply,
  withTurnCue,
  persona,
  STYLE_SAMPLES,
  MODES,
  EFFORT_UI,
  EFFORT_RANK,
  QWEN_BUDGET,
  normalizeEffort,
  effortRank,
  mapEffort,
  parseEffortList,
  guessEffortList,
  protocolEffortList,
  guessContext,
  parseModelEntry,
  detectThinkingStyle,
  qwenBudget,
  attachThinking,
  estTokens,
  estMessages,
  type ModelEntry,
  QWEN_DEFAULT_BASE,
  QWEN_TTS_MODELS,
  QWEN_TTS_VOICES,
  VOICE_BANK_TRANSCRIPT,
  MODE_TTS,
  MODE_PLAY_FX,
  ttsStyleFor,
  qwenApiRoot,
  qwenTtsKind,
  qwenTtsPath,
  qwenTtsUrl,
  qwenHttpsUrl,
  qwenDefaultVoice,
  qwenWantsInstructions,
  isQwenHttpTtsModelId,
  parseQwenModelList,
  _b64ToUrl,
  _pcmToWav,
  _fetchAsDataUrl,
  _downloadUrl,
};

const PLACEHOLDER_MODELS: Record<string, number> = {
  'tts-model': 1,
  'voice-clone-model': 1,
  'your-clone-model': 1,
  'your-preset-model': 1,
};

export function isPlaceholderModel(m?: string | null): boolean {
  return !m || Boolean(PLACEHOLDER_MODELS[m]);
}

export function upstreamUrl(baseUrl: string, path: string): string {
  return String(baseUrl || '').replace(/\/+$/, '') + path;
}

export function localProxy(target: string): string {
  if (!target || !/^https?:\/\//i.test(target)) return target;
  if (target.startsWith('/_proxy')) return target;
  return '/_proxy?u=' + encodeURIComponent(target);
}

export interface ResponseBlob extends Blob {
  _headers?: Headers;
}

export function apiErrorMessage(j: unknown, status: number, raw?: string): string {
  if (j && typeof j === 'object') {
    const rec = j as Record<string, unknown>;
    const err = rec.error;
    if (typeof err === 'string' && err) return err;
    if (err && typeof err === 'object') {
      const errRec = err as Record<string, unknown>;
      const em = String(errRec.message || errRec.msg || '');
      const ec = String(errRec.code || errRec.type || '');
      if (em) return (ec ? `${ec}: ` : '') + em;
      if (ec) return ec;
    }
    const msg = rec.message || rec.msg;
    const code = rec.code;
    if (msg && code && String(code) && String(code) !== '200') {
      return `${code}: ${msg}`;
    }
    if (msg) return String(msg);
  }
  const snippet = raw ? String(raw).replace(/\s+/g, ' ').slice(0, 180) : '';
  return `HTTP ${status}${snippet ? `: ${snippet}` : ''}`;
}

export async function request<T = unknown>(
  url: string,
  body: unknown,
  apiKey: string = '',
  timeoutMs: number = 120000
): Promise<T | ResponseBlob> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('api-key', apiKey);
  }

  const res = await fetch(url, {
    body: JSON.stringify(body),
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers,
  });

  if (!res.ok) {
    throw new Error(apiErrorMessage(null, res.status, await res.text()));
  }

  const mime = res.headers.get('content-type') || '';
  let result: T | ResponseBlob;
  if (mime.includes('application/json')) {
    result = (await res.json()) as T;
  } else {
    result = (await res.blob()) as ResponseBlob;
  }
  (result as { _headers?: Headers })._headers = res.headers;
  return result;
}

export async function requestGet<T = unknown>(
  url: string,
  apiKey: string = '',
  timeoutMs: number = 30000
): Promise<T | ResponseBlob> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('api-key', apiKey);
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers });
  if (!res.ok) {
    throw new Error(apiErrorMessage(null, res.status, await res.text()));
  }

  const mime = res.headers.get('content-type') || '';
  let result: T | ResponseBlob;
  if (mime.includes('application/json')) {
    result = (await res.json()) as T;
  } else {
    result = (await res.blob()) as ResponseBlob;
  }
  (result as { _headers?: Headers })._headers = res.headers;
  return result;
}

export function choiceText(j: unknown): string {
  if (!j || typeof j !== 'object') return '';
  const choices = (j as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const m = choices?.[0]?.message;
  if (!m) return '';
  const c = m.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .map((p) => {
        if (!p) return '';
        if (typeof p === 'string') return p;
        if (typeof p === 'object') {
          const rec = p as Record<string, unknown>;
          return String(rec.text || rec.content || '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

let _modelMeta: ModelEntry | null = null;

export function setModelMeta(m: ModelEntry | null): void {
  _modelMeta = m || null;
}

export function resolvedContext(): number {
  return resolveContextFromThinking(config.section('llm'), _modelMeta);
}

export function replyLang(): string {
  return Langs.llm() || 'ja';
}

export async function translate(text: string, toLang: string): Promise<string> {
  if (!text || !toLang || toLang === replyLang()) {
    return text;
  }
  const llm = config.section('llm');
  if (!llm.apiKey) return text;

  try {
    const j = await request(
      localProxy(upstreamUrl(llm.baseUrl, '/chat/completions')),
      {
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: `You are a translator for a Japanese anime game character (Ryza, cheerful young alchemist). Translate her line into ${Langs.name(toLang)}, keeping the playful spoken tone, first-person feel and emotion. Output ONLY the translated line — no quotes, notes, linebreaks, or tags.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: Math.max(80, llm.maxTokens || 400),
      },
      llm.apiKey,
      60000
    );
    const c = choiceText(j);
    return (c && String(c).trim()) || text;
  } catch {
    return text;
  }
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

export async function chat(
  history: Array<{ role: string; content?: string }>,
  userText: string,
  opts: ChatOptions = {}
): Promise<TaggedReply> {
  const llm = config.section('llm');
  if (!llm.apiKey) throw new Error('NO_KEY');

  const st = config.section('state');
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

  const body: Record<string, unknown> = {
    model: llm.model,
    messages: pack(hist),
    temperature: Number(llm.temperature) || 0.9,
    max_tokens: Number(llm.maxTokens) || 400,
  };
  attachThinking(body, llm, _modelMeta?.id === llm.model ? _modelMeta : null);

  const j = await request(localProxy(upstreamUrl(llm.baseUrl, '/chat/completions')), body, llm.apiKey);
  return parseTaggedReply(choiceText(j));
}

export async function complete(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; timeout?: number } = {}
): Promise<string> {
  const llm = config.section('llm');
  if (!llm.apiKey) throw new Error('NO_KEY');

  const j = await request(
    localProxy(upstreamUrl(llm.baseUrl, '/chat/completions')),
    {
      model: llm.model,
      messages: [
        { role: 'system', content: String(system || '') },
        { role: 'user', content: String(user || '') },
      ],
      temperature: opts.temperature != null ? opts.temperature : 0.2,
      max_tokens: opts.maxTokens || 280,
    },
    llm.apiKey,
    opts.timeout || 60000
  );
  return String(choiceText(j) || '').trim();
}

export async function listModels(): Promise<ModelEntry[]> {
  const llm = config.section('llm');
  if (!llm.apiKey) throw new Error('NO_KEY');
  if (!llm.baseUrl) throw new Error('NO_URL');

  const j = await requestGet(localProxy(upstreamUrl(llm.baseUrl, '/models')), llm.apiKey, 20000);
  const raw =
    (j &&
      typeof j === 'object' &&
      ((j as Record<string, unknown>).data ||
        (j as Record<string, unknown>).models ||
        ((j as Record<string, unknown>).data &&
          ((j as Record<string, unknown>).data as Record<string, unknown>).data))) ||
    [];
  if (!Array.isArray(raw)) return [];
  const out: ModelEntry[] = [];
  raw.forEach((m: unknown) => {
    const e = parseModelEntry(m);
    if (e) out.push(e);
  });
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cur = out.find((e) => e.id === llm.model);
  _modelMeta = cur || out[0] || null;
  return out;
}

export async function listQwenTtsModels(): Promise<ModelEntry[]> {
  const tts = config.section('tts');
  if (!tts.qwenApiKey) throw new Error('NO_KEY');
  const root = qwenApiRoot(tts.qwenBaseUrl);
  const urls = [`${root}/compatible-mode/v1/models`, `${root}/api/v1/models`];

  for (const u of urls) {
    try {
      const j = await requestGet(localProxy(u), tts.qwenApiKey, 20000);
      const list = parseQwenModelList(j);
      if (list.length) return list;
    } catch {}
  }
  return [];
}

export async function speak(text: string, lang?: string, mode?: string): Promise<string | null> {
  const tts = config.section('tts');
  if (tts.mode === 'off') return null;
  mode = mode || config.section('state')?.mode || 'chat';

  const provider = tts.provider || 'openai';
  if (provider === 'qwen') return _qwenSpeak(text, lang, mode);
  if (!tts.apiKey) throw new Error('NO_KEY');

  if (provider === 'openai-speech') {
    return _openaiSpeechSpeak(text, lang, mode);
  }

  const audio: Record<string, unknown> = { format: tts.format || 'wav' };
  audio.voice = tts.mode === 'clone' ? 'pending' : tts.presetVoice || 'Chloe';

  const model = tts.mode === 'clone' ? tts.modelClone : tts.modelPreset;
  if (isPlaceholderModel(model)) {
    throw new Error('NO_MODEL');
  }
  const styleHint = ttsStyleFor(mode, tts);

  async function send(voiceField: string) {
    audio.voice = voiceField;
    const j = await request(
      localProxy(upstreamUrl(tts.baseUrl, '/chat/completions')),
      {
        model,
        messages: [
          { role: 'user', content: styleHint },
          { role: 'assistant', content: text },
        ],
        audio,
      },
      tts.apiKey,
      180000
    );
    const data = (j as { choices?: Array<{ message?: { audio?: { data?: string } } }> })?.choices?.[0]
      ?.message?.audio?.data;
    if (!data) throw new Error('接口未返回音频');
    return _b64ToUrl(data, tts.format === 'mp3' ? 'audio/mpeg' : 'audio/wav');
  }

  if (tts.mode === 'clone') {
    const dataUrl = await _fetchAsDataUrl(tts.reference);
    return send(dataUrl);
  }
  return send(String(audio.voice));
}

export async function _openaiSpeechSpeak(text: string, _lang?: string, _mode?: string): Promise<string> {
  const tts = config.section('tts');
  if (!tts.apiKey) throw new Error('NO_KEY');

  const model = tts.mode === 'clone' ? tts.modelClone : tts.modelPreset;
  if (isPlaceholderModel(model)) {
    throw new Error('NO_MODEL');
  }

  const format = tts.format || 'pcm';
  const voice = tts.mode === 'clone' ? tts.cloneVoice || '' : tts.presetVoice || '';

  const body: Record<string, unknown> = {
    model,
    input: text,
    response_format: format,
  };
  if (voice) body.voice = voice;

  async function send(fmt?: string) {
    const url = localProxy(upstreamUrl(tts.baseUrl, '/audio/speech'));
    const blob = await request(url, body, tts.apiKey, 180000);
    if (!(blob instanceof Blob)) throw new Error('接口未返回音频');
    if (fmt === 'pcm') {
      const ct = (blob as ResponseBlob)._headers?.get('content-type') || '';
      let rate = 44100;
      let ch = 1;
      const m1 = /rate=(\d+)/.exec(ct);
      if (m1) rate = parseInt(m1[1], 10);
      const m2 = /channels=(\d+)/.exec(ct);
      if (m2) ch = parseInt(m2[1], 10);
      const buf = await blob.arrayBuffer();
      return URL.createObjectURL(_pcmToWav(buf, rate, ch, 16));
    }
    return URL.createObjectURL(blob);
  }

  if (tts.mode === 'clone') {
    const isIrodori = Boolean(tts.modelClone?.startsWith('irodori-tts'));
    const isAudioCpp = tts.providerStyle === 'audio.cpp';
    const data = await _fetchAsDataUrl(tts.reference, isAudioCpp);
    const transcript = VOICE_BANK_TRANSCRIPT[tts.reference];

    if (isAudioCpp) {
      body.voice_ref = { type: 'base64', data };
      body.response_format = 'wav';
      if (isIrodori) {
        body.options = {
          instruction: tts.styleHint || undefined,
          duration_scale: 1.05,
          num_inference_steps: 50,
        };
      }
      if (transcript && !isIrodori) body.reference_text = transcript;
    } else {
      body.response_format = format === 'wav' ? 'pcm' : format;
      const inputReferences: Array<Record<string, unknown>> = [
        { type: 'input_audio', input_audio: { data } },
      ];
      if (transcript) inputReferences.push({ type: 'text', text: transcript });
      body.input_references = inputReferences;
    }
    return send('wav');
  }
  return send();
}

interface QwenTtsResponse {
  output?: {
    audio?: { data?: string; url?: string };
  };
  [key: string]: unknown;
}

interface QwenEnrollResponse {
  output?: {
    voice_id?: string;
    voice?: string;
  };
  [key: string]: unknown;
}

export async function _qwenSpeak(text: string, lang?: string, mode?: string): Promise<string> {
  const tts = config.section('tts');
  if (!tts.qwenApiKey) throw new Error('NO_KEY');
  const lg = lang || Langs.tts() || 'ja';
  const langType = Langs.ttsLangType(lg);
  const model = String(tts.qwenModel || 'qwen3-tts-flash').trim() || 'qwen3-tts-flash';
  const kind = qwenTtsKind(model);
  const voice = qwenDefaultVoice(model, tts.qwenVoice);
  const input: Record<string, unknown> = { text, voice };

  if (kind === 'speech') {
    input.format = 'wav';
    input.sample_rate = 24000;
    if (/qwen-audio/i.test(model)) input.language_type = langType;
  } else {
    input.language_type = langType;
  }

  if (qwenWantsInstructions(model)) {
    const style = ttsStyleFor(mode || 'chat', tts);
    if (style) {
      if (kind === 'speech') input.instruction = style;
      else input.instructions = style;
    }
  }

  const j = await request<QwenTtsResponse>(
    localProxy(qwenTtsUrl(tts.qwenBaseUrl, model)),
    { model, input },
    tts.qwenApiKey,
    180000
  );
  const resObj = j instanceof Blob ? null : (j as QwenTtsResponse);
  const aud = resObj?.output?.audio;
  const data = aud && String(aud.data || '').trim();
  const url = aud?.url;
  if (data) return _b64ToUrl(data, 'audio/wav');
  if (url) return _downloadUrl(url, localProxy);
  throw new Error('Qwen TTS 未返回音频');
}

export async function qwenCloneVoice(): Promise<string> {
  const tts = config.section('tts');
  if (!tts.qwenApiKey) throw new Error('NO_KEY');
  const target = String(tts.qwenCloneTarget || 'qwen3-tts-vc-2026-01-22').trim();
  const dataUri = await _fetchAsDataUrl(tts.reference);
  const j = await request<QwenEnrollResponse>(
    localProxy(qwenTtsUrl(tts.qwenBaseUrl, 'voice-enrollment')),
    {
      model: 'voice-enrollment',
      input: {
        action: 'create_voice',
        target_model: target,
        prefix: 'ryza',
        preferred_name: 'ryza',
        url: dataUri,
      },
    },
    tts.qwenApiKey,
    120000
  );
  const resObj = j instanceof Blob ? null : (j as QwenEnrollResponse);
  const vid = resObj?.output?.voice_id || resObj?.output?.voice;
  if (!vid) throw new Error(apiErrorMessage(j, 200, '') || '未返回 voice_id');
  return vid;
}

export const Api = {
  EMOTIONS,
  ATTITUDES,
  MODE_TTS,
  MODE_PLAY_FX,
  EFFORT_UI,
  parseTaggedReply,
  buildSystemPrompt,
  screenTagLine,
  withTurnCue,
  formatHistoryReply,
  extractState,
  isPlaceholderModel,
  estTokens,
  guessContext,
  parseModelEntry,
  detectThinkingStyle,
  attachThinking,
  normalizeEffort,
  mapEffort,
  setModelMeta,
  resolvedContext,
  _localProxy: localProxy,
  QWEN_DEFAULT_BASE,
  QWEN_TTS_MODELS,
  QWEN_TTS_VOICES,
  _qwenApiRoot: qwenApiRoot,
  _qwenTtsUrl: qwenTtsUrl,
  _qwenHttpsUrl: qwenHttpsUrl,
  _qwenTtsKind: qwenTtsKind,
  _qwenDefaultVoice: qwenDefaultVoice,
  ttsStyleFor: (mode: string) => ttsStyleFor(mode, config.section('tts')),
  replyLang,
  translate,
  chat,
  complete,
  listModels,
  listQwenTtsModels,
  speak,
  _openaiSpeechSpeak,
  _qwenSpeak,
  _downloadUrl: (url: string) => _downloadUrl(url, localProxy),
  qwenCloneVoice,
  _b64ToUrl,
  _pcmToWav,
  _fetchAsDataUrl,
};

export default Api;
