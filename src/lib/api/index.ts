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
import { Providers } from './providers';
export {
  resolveEmotionAdaptation,
  normalizeEmotion,
  getEmotionPrompt,
  type EmotionContext,
  type EmotionAdaptation,
  type TtsEmotionStrategy,
} from './tts-emotion';
import { resolveEmotionAdaptation } from './tts-emotion';
export {
  buildTextEmotionHint,
  applyTextEmotionHint,
  type TextEmotionHint,
  type EmotionHintPlacement,
} from './text-emotion';
import { buildTextEmotionHint, applyTextEmotionHint } from './text-emotion';
import {
  QWEN_DEFAULT_BASE,
  QWEN_TTS_MODELS,
  QWEN_TTS_VOICES,
  FISH_DEFAULT_BASE,
  FISH_MODERN_BASE,
  FISH_MODERN_DEFAULT_MODEL,
  FISH_LEGACY_DEFAULT_MODEL,
  FISH_DEFAULT_VOICE,
  FISH_TTS_MODELS,
  fishApiRoot,
  fishApiStyle,
  fishTtsUrl,
  fishLanguage,
  fishWantsInstruction,
  fishWantsEmotion,
  fishEmotion,
  fishSampleUrls,
  audioMimeFrom,
  redactSecret,
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

export interface TransportError extends Error {
  code: 'timeout' | 'net';
}

export function isTransportError(err: unknown): err is TransportError {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    ((err as { code: unknown }).code === 'timeout' || (err as { code: unknown }).code === 'net')
  );
}

export function createTransportError(code: 'timeout' | 'net', message?: string): TransportError {
  const defaultMsg =
    code === 'timeout'
      ? 'Timed out: the endpoint never answered (check the base URL and model name in Settings)'
      : 'Could not reach that base URL (wrong address, CORS refused, or the local server is not running)';
  const err = new Error(message || defaultMsg) as TransportError;
  err.code = code;
  return err;
}

export async function fetchTransport(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    if (isTransportError(err)) throw err;
    const name = (err as Error)?.name || '';
    const msg = String((err as Error)?.message || '');
    if (name === 'TimeoutError' || /timeout|timed out|abort/i.test(msg)) {
      throw createTransportError('timeout');
    }
    throw createTransportError('net');
  }
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

  const res = await fetchTransport(
    url,
    {
      body: JSON.stringify(body),
      method: 'POST',
      headers,
    },
    timeoutMs
  );

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

  const res = await fetchTransport(url, { headers }, timeoutMs);
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

export async function requestAudio(
  url: string,
  body: unknown,
  apiKey: string = '',
  timeoutMs: number = 180000,
  extraHeaders?: Record<string, string>,
  errorMap?: (status: number, raw: string, apiKey: string) => string
): Promise<string> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('api-key', apiKey);
  }
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v);
    }
  }

  const res = await fetchTransport(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  const buf = await res.arrayBuffer();
  const ct = res.headers.get('content-type') || '';
  const mime = audioMimeFrom(buf, ct);
  if (res.ok && mime) {
    return URL.createObjectURL(new Blob([buf], { type: mime }));
  }

  const raw = new TextDecoder('utf-8').decode(buf);
  let j: unknown = null;
  try {
    j = JSON.parse(raw);
  } catch {}

  if (
    res.ok &&
    j &&
    typeof j === 'object' &&
    ((j as { audio_url?: string }).audio_url || (j as { audioUrl?: string }).audioUrl)
  ) {
    const audioUrl = (j as { audio_url?: string }).audio_url || (j as { audioUrl?: string }).audioUrl;
    return _downloadUrl(audioUrl!, localProxy, apiKey);
  }

  const msg = errorMap ? errorMap(res.status, raw, apiKey) : apiErrorMessage(j, res.status, raw);
  throw new Error(msg);
}

export async function requestForm<T = unknown>(
  url: string,
  form: FormData,
  apiKey: string = '',
  timeoutMs: number = 180000,
  errorMap?: (status: number, raw: string, apiKey: string) => string
): Promise<T> {
  const headers = new Headers();
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);

  const res = await fetchTransport(
    url,
    {
      method: 'POST',
      headers,
      body: form,
    },
    timeoutMs
  );

  const text = await res.text();
  let j: unknown = null;
  try {
    j = JSON.parse(text);
  } catch {}

  if (res.ok) return j as T;
  const msg = errorMap ? errorMap(res.status, text, apiKey) : apiErrorMessage(j, res.status, text);
  throw new Error(msg);
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
  return resolveContextFromThinking(config.get('llm'), _modelMeta);
}

export function replyLang(): string {
  return Langs.llm() || 'ja';
}

export interface TranslateOptions {
  text: string;
  toLang?: string;
  /** Emotion of the line; used to hint inline TTS emotion markers when supported */
  emotion?: string;
}

export async function translate(opts: TranslateOptions): Promise<string> {
  const { text, toLang, emotion } = opts;
  if (!text || !toLang || toLang === replyLang()) {
    return text;
  }
  const llm = config.get('llm');
  if (!llm.apiKey) return text;

  // Resolve the downstream TTS engine so the translator knows whether to
  // inline an emotion marker (Higgs/OmniVoice/Fish S2/Irodori).
  let hint = null;
  try {
    const tts = config.get('tts');
    const cred = Providers.credentials(tts);
    const model =
      cred.id === 'openai' && String(tts.mode || '') === 'clone' && tts.modelClone
        ? tts.modelClone
        : cred.model;
    hint = buildTextEmotionHint({ emotion, provider: cred.id, model });
  } catch {
    hint = null;
  }

  const hintBlock = hint ? `\n\n${hint.promptSection}` : '';

  try {
    const j = await request(
      localProxy(upstreamUrl(llm.baseUrl, '/chat/completions')),
      {
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: `You are a translator for a Japanese anime game character (Ryza, cheerful young alchemist). Translate her line into ${Langs.name(toLang)}, keeping the playful spoken tone, first-person feel and emotion. Output ONLY the translated line — no quotes, notes, linebreaks, or tags.${hintBlock}`,
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
    const translated = (c && String(c).trim()) || text;
    return applyTextEmotionHint(translated, hint);
  } catch {
    return text;
  }
}

export async function transcribe(blob: Blob, opts?: { lang?: string; timeout?: number }): Promise<string> {
  const cred = Providers.sttCredentials(config.get('stt'));
  if (!cred.baseUrl) throw new Error('NO_STT_URL');
  if (!blob || !blob.size) throw new Error('NO_AUDIO');

  const boundary = '----ryza' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const head: string[] = [];
  function field(name: string, value: string) {
    head.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  if (cred.model) field('model', cred.model);
  const iso = opts?.lang ? Langs.sttLang(opts.lang) : '';
  if (iso) field('language', iso);
  field('response_format', 'json');
  const headText =
    head.join('') +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="speech.wav"\r\nContent-Type: audio/wav\r\n\r\n`;
  const body = new Blob([headText, blob, `\r\n--${boundary}--\r\n`], {
    type: `multipart/form-data; boundary=${boundary}`,
  });

  const headers = new Headers();
  if (cred.apiKey) {
    headers.set('Authorization', `Bearer ${cred.apiKey}`);
    headers.set('api-key', cred.apiKey);
  }

  const res = await fetch(localProxy(upstreamUrl(cred.baseUrl, '/audio/transcriptions')), {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(opts?.timeout || 60000),
  });

  if (!res.ok) {
    const raw = await res.text();
    let j: unknown = null;
    try {
      j = JSON.parse(raw);
    } catch {}
    throw new Error(apiErrorMessage(j, res.status, raw));
  }

  const j = (await res.json()) as { text?: string };
  return String(j?.text || '').trim();
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
  const llm = config.get('llm');
  if (!llm.apiKey) throw new Error('NO_KEY');

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
  const llm = config.get('llm');
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
  const llm = config.get('llm');
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
  const tts = config.get('tts');
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

export async function speak(
  text: string,
  lang?: string,
  mode?: string,
  emotion?: string
): Promise<string | null> {
  const tts = config.get('tts');
  if (tts.mode === 'off') return null;
  const currentMode = mode || config.get('state')?.mode || 'chat';

  const cred = Providers.credentials(tts);
  const speechLang = lang || Langs.tts() || 'ja';
  if (cred.capabilities.local) {
    const adaptation = resolveEmotionAdaptation({
      text,
      emotion,
      mode: currentMode,
      lang: speechLang,
      model: cred.model,
      provider: cred.id,
    });
    return Providers.speakLocal(cred, {
      text,
      fetch,
      queryModifier: adaptation.queryModifier,
    });
  }
  if (cred.id === 'qwen') return _qwenSpeak(text, speechLang, currentMode, emotion);
  if (cred.id === 'fish') return _fishSpeak(text, speechLang, currentMode, emotion);

  if (!cred.apiKey) throw new Error('NO_KEY');
  if (!tts.apiKey) throw new Error('NO_KEY');

  if (tts.provider === 'openai-speech') {
    return _openaiSpeechSpeak(text, speechLang, currentMode, emotion);
  }

  const audio: Record<string, unknown> = { format: tts.format || 'wav' };
  if (tts.mode === 'clone') {
    audio.voice = 'pending';
  } else {
    audio.voice = cred.voice || 'Chloe';
  }

  const model = cred.model;
  if (isPlaceholderModel(model)) {
    throw new Error('NO_MODEL');
  }
  const styleHint = ttsStyleFor(currentMode, tts);
  const adaptation = resolveEmotionAdaptation(
    {
      text,
      emotion,
      mode: currentMode,
      lang: speechLang,
      model,
      provider: cred.id,
    },
    styleHint
  );
  const finalStyleHint = adaptation.instruction || styleHint;

  async function send(voiceField: string) {
    audio.voice = voiceField;
    const j = await request(
      localProxy(upstreamUrl(cred.baseUrl, '/chat/completions')),
      {
        model,
        messages: [
          { role: 'user', content: finalStyleHint },
          { role: 'assistant', content: text },
        ],
        audio,
      },
      cred.apiKey,
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

export async function _openaiSpeechSpeak(
  text: string,
  _lang?: string,
  _mode?: string,
  emotion?: string
): Promise<string> {
  const tts = config.get('tts');
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
    if (fmt !== 'pcm') return URL.createObjectURL(blob);

    const ct = (blob as ResponseBlob)._headers?.get('content-type') || '';
    // prettier-ignore
    let rate = 44100, ch = 1;
    const m1 = /rate=(\d+)/.exec(ct);
    if (m1) rate = parseInt(m1[1], 10);
    const m2 = /channels=(\d+)/.exec(ct);
    if (m2) ch = parseInt(m2[1], 10);

    const buf = await blob.arrayBuffer();
    return URL.createObjectURL(_pcmToWav(buf, rate, ch, 16));
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
        const adaptation = resolveEmotionAdaptation(
          {
            text,
            emotion,
            mode: _mode || 'chat',
            lang: _lang || 'ja',
            model: tts.modelClone,
            provider: 'openai-speech',
          },
          tts.styleHint
        );
        body.options = {
          instruction: adaptation.instruction || tts.styleHint || undefined,
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
    return send(body.response_format as string);
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

export async function _qwenSpeak(
  text: string,
  lang?: string,
  mode?: string,
  emotion?: string
): Promise<string> {
  const tts = config.get('tts');
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
    const adaptation = resolveEmotionAdaptation(
      {
        text,
        emotion,
        mode: mode || 'chat',
        lang: lg,
        model,
        provider: 'qwen',
      },
      style
    );
    const finalStyle = adaptation.instruction || style;
    if (finalStyle) {
      if (kind === 'speech') input.instruction = finalStyle;
      else input.instructions = finalStyle;
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
  const tts = config.get('tts');
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

export function fishErrorMessage(
  status: number,
  raw: string,
  apiKey: string,
  phase: 'tts' | 'clone'
): string {
  const label = phase === 'clone' ? '音色创建' : '语音合成';
  if (status === 401) return `Fish Audio：API key 无效或缺失（HTTP 401，${label}）`;
  if (status === 403) return `Fish Audio：权限不足、模型不可用或音色无权访问（HTTP 403，${label}）`;
  if (status === 429) return `Fish Audio：超出速率或额度限制（HTTP 429，${label}）`;
  let j: unknown = null;
  try {
    j = JSON.parse(String(raw || ''));
  } catch {}
  const detail = redactSecret(apiErrorMessage(j, status, raw), apiKey);
  return `Fish Audio ${label}失败${detail ? `：${detail}` : `（HTTP ${status}）`}`;
}

let _fishCloneWait: Promise<string> | null = null;

export async function _fishSpeak(
  text: string,
  lang?: string,
  mode?: string,
  emotion?: string
): Promise<string> {
  const tts = config.get('tts');
  if (!tts.fishApiKey) throw new Error('NO_KEY');
  const root = fishApiRoot(tts.fishBaseUrl);
  const style = fishApiStyle(root);

  async function synthModern(voice: string) {
    const body: Record<string, unknown> = {
      text,
      format: tts.format === 'mp3' ? 'mp3' : 'wav',
    };
    if (voice) body.reference_id = voice;
    const model = String(tts.fishModel || '').trim() || FISH_MODERN_DEFAULT_MODEL;
    const adaptation = resolveEmotionAdaptation(
      {
        text,
        emotion,
        mode: mode || 'chat',
        lang: lang || Langs.tts() || 'ja',
        model,
        provider: 'fish',
      },
      ttsStyleFor(mode || 'chat', tts)
    );
    if (adaptation.payload) {
      Object.assign(body, adaptation.payload);
    }
    return requestAudio(
      localProxy(fishTtsUrl(tts.fishBaseUrl)),
      body,
      tts.fishApiKey,
      180000,
      { model },
      (st, raw, key) => fishErrorMessage(st, raw, key, 'tts')
    );
  }

  async function synthLegacy(voice: string) {
    const model = String(tts.fishModel || '').trim() || FISH_LEGACY_DEFAULT_MODEL;
    const lg = lang || Langs.tts() || 'ja';
    const body: Record<string, unknown> = {
      text,
      voiceId: voice,
      reference_id: voice,
      modelId: model,
      format: tts.format === 'mp3' ? 'mp3' : 'wav',
    };
    const fishLang = fishLanguage(lg);
    if (fishLang) body.language = fishLang;
    const baseStyle = fishWantsInstruction(model) ? ttsStyleFor(mode || 'chat', tts) : undefined;
    const adaptation = resolveEmotionAdaptation(
      {
        text,
        emotion,
        mode: mode || 'chat',
        lang: lg,
        model,
        provider: 'fish',
      },
      baseStyle
    );
    if (adaptation.payload) {
      Object.assign(body, adaptation.payload);
    }
    if (adaptation.instruction && fishWantsInstruction(model)) {
      body.instruction = adaptation.instruction;
    }
    return requestAudio(
      localProxy(fishTtsUrl(tts.fishBaseUrl)),
      body,
      tts.fishApiKey,
      180000,
      undefined,
      (st, raw, key) => fishErrorMessage(st, raw, key, 'tts')
    );
  }

  const synth = style === 'modern' ? synthModern : synthLegacy;
  const voice = (mode === 'asmr' && tts.fishVoiceAsmr ? tts.fishVoiceAsmr : tts.fishVoice || '').trim();
  if (voice) return synth(voice);

  if (style === 'modern') {
    return synth('');
  }

  if (_fishCloneWait) return _fishCloneWait.then(synth);
  _fishCloneWait = fishCloneVoice().then(
    (vid) => {
      try {
        config.setTTS('fishVoice', vid);
      } catch {}
      _fishCloneWait = null;
      return vid;
    },
    (err) => {
      _fishCloneWait = null;
      throw err;
    }
  );
  return _fishCloneWait.then(synth);
}

export async function listFishVoices(): Promise<Array<{ id: string; title: string }>> {
  const tts = config.get('tts');
  if (!tts.fishApiKey) throw new Error('NO_KEY');
  const root = fishApiRoot(tts.fishBaseUrl);
  const modern = fishApiStyle(root) === 'modern';
  const url = modern
    ? `${root}/model?page_size=100&page_number=1`
    : `${root}/voices?pageSize=100&includePersonal=true`;
  const j = await requestGet<{ items?: Array<Record<string, unknown>> }>(
    localProxy(url),
    tts.fishApiKey,
    20000
  );
  const items = (j as { items?: Array<Record<string, unknown>> })?.items || [];
  const out: Array<{ id: string; title: string }> = [];
  const seen: Record<string, number> = {};
  items.forEach((it) => {
    if (!it) return;
    const id = String(it.voiceId || it.voice_id || it.id || it._id || '');
    if (!id || seen[id]) return;
    seen[id] = 1;
    out.push({ id, title: String(it.title || it.name || id) });
  });
  return out;
}

export async function fishCloneVoice(): Promise<string> {
  const tts = config.get('tts');
  if (!tts.fishApiKey) throw new Error('NO_KEY');
  if (fishApiStyle(fishApiRoot(tts.fishBaseUrl)) === 'modern') {
    throw new Error(
      'Fish Audio（api.fish.audio）不支持本地样本自动克隆——请在 fish.audio 里创建音色，把它的 id 填到「Fish 音色」'
    );
  }
  const sampleUrls = fishSampleUrls(tts.reference);
  const parts = await Promise.all(
    sampleUrls.map(async (url) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const blob = await r.blob();
        if (!blob || !blob.size) return null;
        return { blob, name: url.split('/').pop() || 'sample.wav' };
      } catch {
        return null;
      }
    })
  );
  const files = parts.filter(Boolean) as Array<{ blob: Blob; name: string }>;
  const wavs = files.filter((f) => /\.wav$/i.test(f.name));
  const chosenFiles = wavs.length ? wavs : files;
  if (!chosenFiles.length) {
    throw new Error('找不到本地莱莎原声（需要 assets/audio/prologue/jp/*.m4a 或 voice/ryza_wav/*.wav）');
  }

  const fd = new FormData();
  fd.append('name', 'ryza');
  fd.append('description', 'Local Ryza prologue clone');
  fd.append('visibility', 'private');
  fd.append('languages', JSON.stringify(['ja', 'zh', 'en']));
  chosenFiles.forEach((f) => {
    fd.append('audioFiles', f.blob, f.name);
  });

  const j = await requestForm<{ voiceId?: string; voice_id?: string }>(
    localProxy(`${fishApiRoot(tts.fishBaseUrl)}/voices`),
    fd,
    tts.fishApiKey,
    180000,
    (st, raw, key) => fishErrorMessage(st, raw, key, 'clone')
  );
  const vid = j?.voiceId || j?.voice_id;
  if (!vid) throw new Error(apiErrorMessage(j, 200, '') || '未返回 voiceId');
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
  FISH_DEFAULT_BASE,
  FISH_MODERN_BASE,
  FISH_MODERN_DEFAULT_MODEL,
  FISH_LEGACY_DEFAULT_MODEL,
  FISH_DEFAULT_VOICE,
  FISH_TTS_MODELS,
  _qwenApiRoot: qwenApiRoot,
  _qwenTtsUrl: qwenTtsUrl,
  _qwenHttpsUrl: qwenHttpsUrl,
  _qwenTtsKind: qwenTtsKind,
  _qwenDefaultVoice: qwenDefaultVoice,
  _fishApiRoot: fishApiRoot,
  _fishApiStyle: fishApiStyle,
  _fishTtsUrl: fishTtsUrl,
  _fishLanguage: fishLanguage,
  _fishWantsInstruction: fishWantsInstruction,
  _fishWantsEmotion: fishWantsEmotion,
  _fishEmotion: fishEmotion,
  ttsStyleFor: (mode: string) => ttsStyleFor(mode, config.get('tts')),
  replyLang,
  translate,
  transcribe,
  chat,
  complete,
  listModels,
  listQwenTtsModels,
  listFishVoices,
  speak,
  resolveEmotionAdaptation,
  buildTextEmotionHint,
  applyTextEmotionHint,
  _openaiSpeechSpeak,
  _qwenSpeak,
  _fishSpeak,
  _downloadUrl: (url: string, apiKey?: string) => _downloadUrl(url, localProxy, apiKey),
  qwenCloneVoice,
  fishCloneVoice,
  _b64ToUrl,
  _pcmToWav,
  _fetchAsDataUrl,
};

export default Api;
