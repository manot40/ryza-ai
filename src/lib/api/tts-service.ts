import { config } from '$lib/stores/config.svelte';
import { Langs } from '$lib/i18n/langs';
import { Providers } from './providers';
import { resolveEmotionAdaptation } from './tts-emotion';
import type { ModelEntry } from './thinking';
import {
  isPlaceholderModel,
  localProxy,
  upstreamUrl,
  request,
  requestGet,
  requestAudio,
  requestForm,
  apiErrorMessage,
  type ResponseBlob,
} from './http';
import {
  ttsStyleFor,
  qwenApiRoot,
  qwenTtsKind,
  qwenTtsUrl,
  qwenDefaultVoice,
  qwenWantsInstructions,
  parseQwenModelList,
  fishApiRoot,
  fishApiStyle,
  fishTtsUrl,
  fishLanguage,
  fishWantsInstruction,
  fishSampleUrls,
  redactSecret,
  VOICE_BANK_TRANSCRIPT,
  FISH_MODERN_DEFAULT_MODEL,
  FISH_LEGACY_DEFAULT_MODEL,
  b64ToUrl,
  pcmToWav,
  fetchAsDataUrl,
  downloadUrl,
} from './tts';

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
  if (cred.id === 'qwen') return qwenSpeak(text, speechLang, currentMode, emotion);
  if (cred.id === 'fish') return fishSpeak(text, speechLang, currentMode, emotion);

  if (!cred.apiKey) throw new Error('NO_KEY');
  if (!tts.apiKey) throw new Error('NO_KEY');

  if (tts.provider === 'openai-speech') {
    return openaiSpeechSpeak(text, speechLang, currentMode, emotion);
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
    return b64ToUrl(data, tts.format === 'mp3' ? 'audio/mpeg' : 'audio/wav');
  }

  if (tts.mode === 'clone') {
    const dataUrl = await fetchAsDataUrl(tts.reference);
    return send(dataUrl);
  }
  return send(String(audio.voice));
}

async function openaiSpeechSpeak(
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
    return URL.createObjectURL(pcmToWav(buf, rate, ch, 16));
  }

  if (tts.mode === 'clone') {
    const isIrodori = Boolean(tts.modelClone?.startsWith('irodori-tts'));
    const isAudioCpp = tts.providerStyle === 'audio.cpp';
    const data = await fetchAsDataUrl(tts.reference, isAudioCpp);
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

async function qwenSpeak(text: string, lang?: string, mode?: string, emotion?: string): Promise<string> {
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
  if (data) return b64ToUrl(data, 'audio/wav');
  if (url) return downloadUrl(url, localProxy);
  throw new Error('Qwen TTS 未返回音频');
}

export async function qwenCloneVoice(): Promise<string> {
  const tts = config.get('tts');
  if (!tts.qwenApiKey) throw new Error('NO_KEY');
  const target = String(tts.qwenCloneTarget || 'qwen3-tts-vc-2026-01-22').trim();
  const dataUri = await fetchAsDataUrl(tts.reference);
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

let fishCloneWait: Promise<string> | null = null;

async function fishSpeak(text: string, lang?: string, mode?: string, emotion?: string): Promise<string> {
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

  if (fishCloneWait) return fishCloneWait.then(synth);
  fishCloneWait = fishCloneVoice().then(
    (vid) => {
      try {
        config.setTTS('fishVoice', vid);
      } catch {}
      fishCloneWait = null;
      return vid;
    },
    (err) => {
      fishCloneWait = null;
      throw err;
    }
  );
  return fishCloneWait.then(synth);
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
