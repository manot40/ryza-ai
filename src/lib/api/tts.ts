import type { TtsConfig } from '$lib/stores/config.svelte';
import { parseModelEntry, type ModelEntry } from './thinking';

export const QWEN_DEFAULT_BASE = 'https://dashscope.aliyuncs.com';

export const QWEN_TTS_MODELS = [
  'qwen3-tts-flash',
  'qwen3-tts-instruct-flash',
  'qwen3-tts-vc-2026-01-22',
  'qwen-audio-3.0-tts-flash',
  'qwen-audio-3.0-tts-plus',
  'cosyvoice-v3-flash',
  'cosyvoice-v3.5-flash',
  'cosyvoice-v3.5-plus',
] as const;

export const QWEN_TTS_VOICES = ['Cherry', 'Serena', 'Chelsie', 'Ethan', 'longanhuan_v3.6'] as const;

export const FISH_DEFAULT_BASE = 'https://fishaudio.org/api/open/v1';
export const FISH_MODERN_BASE = 'https://api.fish.audio';
export const FISH_MODERN_DEFAULT_MODEL = 's2.1-pro-free';
export const FISH_LEGACY_DEFAULT_MODEL = 'fishaudio-s21pro-flash';
export const FISH_DEFAULT_VOICE = '';
export const FISH_TTS_MODELS = [
  's2.1-pro-free',
  's2-pro',
  's1',
  'fishaudio-s21pro-flash',
  'fishaudio-s21pro',
  'fishaudio-s2pro',
  'fishaudio-s1',
  'minimax-2.8-turbo',
  'minimax-2.8-hd',
  'minimax-2.6-turbo',
  'minimax-2.6-hd',
  'qwen3-tts-flash',
  'qwen-audio-3.0-tts-plus',
  'qwen-audio-3.0-tts-flash',
  'cosyvoice-v3-flash',
  'doubao-tts-2.0',
] as const;

export const VOICE_BANK_TRANSCRIPT: Record<string, string> = {
  'assets/voice/ryza_wav/prologue_01.wav': 'これは、ライザの夢の世界。あなたと作る一夏の物語。',
  'assets/voice/ryza_wav/prologue_02.wav': 'この世界の主人公はあなた。',
  'assets/voice/ryza_wav/prologue_03.wav': '決まった道も世界もなくて、あなたの言葉が、そのまま物語になるの。',
  'assets/voice/ryza_wav/prologue_04.wav': '例えば、',
  'assets/voice/ryza_wav/prologue_05.wav': '私と一緒にお店を始めたり、',
  'assets/voice/ryza_wav/prologue_06.wav': 'いろんな人と出会い、一緒に冒険したり、',
  'assets/voice/ryza_wav/prologue_07.wav': 'アイテムを調合して億万長者を目指すことだって。',
  'assets/voice/ryza_wav/prologue_08.wav':
    'ただ、忘れないで。ここはあたしの夢の中。あたしにも何が起こるかわからない。危険な魔物に襲われることだってあるかも。',
  'assets/voice/ryza_wav/prologue_09.wav':
    'でも大丈夫。あなたの自由な発想で、どんな困難も乗り越えられるはずだから。',
};

export const MODE_TTS: Record<string, string> = {
  chat: '',
  story: '少し抑揚をつけ、語り聞かせるようなテンポで。情景が目に浮かぶように。',
  immersive: '今すぐそばで語りかけるように、優しくゆっくり、余韻を残す読み方で。',
  asmr: 'ASMRとして耳元でささやくように。ごく低速で、小さく、息混じりの柔らかなささやき声。文の区切りで長めに間を取る。',
  text: '',
};

export const MODE_PLAY_FX: Record<string, { rate: number; gain: number }> = {
  asmr: { rate: 0.93, gain: 0.82 },
  immersive: { rate: 0.97, gain: 0.95 },
};

export function ttsStyleFor(mode: string, tts?: Partial<TtsConfig> | null): string {
  const base = String(tts?.styleHint || '').trim();
  const over =
    tts?.modeHints && tts.modeHints[mode] != null ? String(tts.modeHints[mode]).trim() : MODE_TTS[mode] || '';
  return [base, over].filter(Boolean).join(' ');
}

export function qwenApiRoot(baseUrl?: string): string {
  let s = String(baseUrl || '').trim();
  if (!s) s = QWEN_DEFAULT_BASE;
  s = s.replace(/\/+$/, '');
  s = s.replace(/\/api\/v1\/services\/[^?#]*/i, '');
  s = s.replace(/\/compatible-mode\/v1$/i, '');
  s = s.replace(/\/compatible-mode$/i, '');
  s = s.replace(/\/api\/v1$/i, '');
  if (!/\/api\/v1$/i.test(s)) s = s.replace(/\/v1$/i, '');
  return s.replace(/\/+$/, '');
}

export function qwenTtsKind(model?: string): 'enroll' | 'speech' | 'multimodal' {
  const m = String(model || '').toLowerCase();
  if (/voice-enrollment|qwen-voice-enrollment|qwen-voice-design/.test(m)) {
    return 'enroll';
  }
  if (/cosyvoice|qwen-audio/.test(m)) return 'speech';
  return 'multimodal';
}

export function qwenTtsPath(model?: string): string {
  const k = qwenTtsKind(model);
  if (k === 'speech') return '/api/v1/services/audio/tts/SpeechSynthesizer';
  if (k === 'enroll') return '/api/v1/services/audio/tts/customization';
  return '/api/v1/services/aigc/multimodal-generation/generation';
}

export function qwenTtsUrl(baseUrl?: string, model?: string): string {
  return qwenApiRoot(baseUrl) + qwenTtsPath(model);
}

export function qwenHttpsUrl(url?: string): string {
  return String(url || '').replace(/^http:\/\//i, 'https://');
}

export function qwenDefaultVoice(model?: string, current?: string): string {
  const m = String(model || '').toLowerCase();
  const v = String(current || '').trim();
  const audioFamily = /qwen-audio|cosyvoice/.test(m);
  if (!v) return audioFamily ? 'longanhuan_v3.6' : 'Cherry';
  if (audioFamily && /^cherry$/i.test(v)) return 'longanhuan_v3.6';
  if (!audioFamily && /longanhuan/i.test(v) && /qwen3-tts|qwen-tts/.test(m)) {
    return 'Cherry';
  }
  return v;
}

export function qwenWantsInstructions(model?: string): boolean {
  const m = String(model || '').toLowerCase();
  if (/qwen3-tts-vc|qwen-tts-vc/.test(m)) return false;
  if (/instruct/.test(m)) return true;
  if (/qwen-audio/.test(m)) return true;
  if (/cosyvoice-v3\.5|cosyvoice-v3-flash/.test(m)) return true;
  return false;
}

export function isQwenHttpTtsModelId(id?: string): boolean {
  const s = String(id || '').toLowerCase();
  if (/realtime/.test(s)) return false;
  return /tts|cosyvoice|qwen-audio|speech|voice-enrollment|qwen-voice/.test(s);
}

export function parseQwenModelList(j: unknown): ModelEntry[] {
  const obj = typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : null;
  let raw: unknown[] = [];
  if (obj) {
    if (Array.isArray(obj.data)) raw = obj.data;
    else if (Array.isArray(obj.models)) raw = obj.models;
    else if (
      obj.output &&
      typeof obj.output === 'object' &&
      Array.isArray((obj.output as Record<string, unknown>).models)
    ) {
      raw = (obj.output as Record<string, unknown>).models as unknown[];
    }
  }
  const out: ModelEntry[] = [];
  const seen: Record<string, number> = {};
  raw.forEach((m) => {
    const e = parseModelEntry(m);
    if (!e || !e.id || seen[e.id] || !isQwenHttpTtsModelId(e.id)) return;
    seen[e.id] = 1;
    out.push(e);
  });
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

export function _b64ToUrl(b64: string, mime: string): string {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}

export function _pcmToWav(
  pcmBuffer: ArrayBuffer,
  sampleRate: number,
  channels: number,
  bitDepth: number
): Blob {
  const bytesPerSample = bitDepth / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const dataSize = pcmBuffer.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const src = new Uint8Array(pcmBuffer);
  const dst = new Uint8Array(buffer, 44);
  dst.set(src);

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function _fetchAsDataUrl(path: string, raw: boolean = false): Promise<string> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`无法读取参考音频：${path}`);
  const buf = await r.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  const b64 = btoa(s);
  if (raw) return b64;
  return `data:audio/wav;base64,${b64}`;
}

export async function _downloadUrl(
  url: string,
  localProxyFn: (u: string) => string,
  apiKey?: string
): Promise<string> {
  const headers = new Headers();
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
  const res = await fetch(localProxyFn(qwenHttpsUrl(url)), { headers });
  if (!res.ok) throw new Error(`音频下载失败 HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function fishApiRoot(baseUrl?: string): string {
  let s = String(baseUrl || '').trim();
  if (!s) return FISH_DEFAULT_BASE;
  s = s.replace(/\/+$/, '');
  s = s.replace(/\/speech\/tts\/jobs$/i, '');
  s = s.replace(/\/speech\/tts$/i, '');
  s = s.replace(/\/v1\/tts$/i, '');
  if (/api\.fish\.audio/i.test(s)) return FISH_MODERN_BASE;
  if (/^https?:\/\/fishaudio\.org$/i.test(s)) return FISH_DEFAULT_BASE;
  if (/^https?:\/\/fishaudio\.org\/v1$/i.test(s)) return FISH_DEFAULT_BASE;
  if (/\/api\/open\/v\d+$/i.test(s)) return s;
  if (/fishaudio\.org$/i.test(s)) return `${s}/api/open/v1`;
  return s;
}

export function fishApiStyle(root?: string): 'modern' | 'legacy' {
  return /api\.fish\.audio/i.test(String(root || '')) ? 'modern' : 'legacy';
}

export function fishTtsUrl(baseUrl?: string): string {
  const root = fishApiRoot(baseUrl);
  return fishApiStyle(root) === 'modern' ? `${root}/v1/tts` : `${root}/speech/tts`;
}

export function fishLanguage(lg?: string): string {
  const map: Record<string, string> = {
    ja: 'ja',
    zh: 'zh',
    'zh-tw': 'zh-TW',
    en: 'en',
    hi: 'hi',
    id: 'id',
    'pt-br': 'pt-BR',
  };
  return (lg && map[lg]) || '';
}

export function fishWantsInstruction(model?: string): boolean {
  return /qwen-audio/i.test(String(model || ''));
}

export function fishWantsEmotion(model?: string): boolean {
  return /minimax/i.test(String(model || ''));
}

export function fishEmotion(emotion?: string): string {
  const e = String(emotion || '');
  const map: Record<string, string> = {
    happy: 'happy',
    laughing: 'happy',
    tease: 'surprised',
    shy: 'calm',
    cuddle: 'calm',
    sad: 'sad',
    crying: 'sad',
    angry: 'angry',
    neutral: 'calm',
  };
  return map[e] || '';
}

export function fishSampleUrls(customReference?: string): string[] {
  const urls: string[] = [];
  const seen: Record<string, boolean> = {};
  function add(u?: string) {
    const s = String(u || '').trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    urls.push(s);
  }
  if (customReference) add(customReference);
  for (let i = 1; i <= 9; i++) {
    const n = i < 10 ? `0${i}` : `${i}`;
    add(`assets/voice/ryza_wav/prologue_${n}.wav`);
    add(`assets/audio/prologue/jp/prologue_${n}.m4a`);
  }
  return urls;
}

export function audioMimeFrom(buf: ArrayBuffer, contentType?: string): string {
  const ct = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (ct.startsWith('audio/')) return ct;
  if (ct.includes('mpeg')) return 'audio/mpeg';
  const u = new Uint8Array(buf || []);
  if (u.length >= 4 && u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46) {
    return 'audio/wav';
  }
  if (u.length >= 3 && u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) return 'audio/mpeg';
  if (u.length >= 2 && u[0] === 0xff && (u[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return '';
}

export function redactSecret(value: string, secret?: string): string {
  const out = String(value || '');
  const key = String(secret || '');
  return key ? out.split(key).join('[redacted]') : out;
}
