export const BOOTSTRAP_ONSET = 0.35;
export const MIN_ONSET = 0.2;
export const MAX_ONSET = 0.65;
export const BASELINE_ALPHA = 0.05;
export const MIN_SPEECH_MS = 200;
export const CANDIDATE_SILENCE_MS = 300;
export const PRE_ROLL_MS = 700;
export const TRAILING_MS = 400;
export const TARGET_RATE = 16000;
export const FRAME_MS = 50;

type TranscribeFn = (blob: Blob, opts: { lang: string }) => Promise<string>;
type NoticeFn = (code: string, isErr: boolean) => void;
type SinkFn = (text: string) => void;
type LangFn = () => string;
type OnsetFn = () => void;
type ClockFn = () => number;

let _transcribe: TranscribeFn | null = null;
let _notice: NoticeFn | null = null;
let _sink: SinkFn | null = null;
let _lang: LangFn | null = null;
let _ononset: OnsetFn | null = null;
let _now: ClockFn = () => Date.now();

let _want = false;
let _stream: MediaStream | null = null;
let _ctx: AudioContext | null = null;
let _node: AudioWorkletNode | ScriptProcessorNode | null = null;
let _src: MediaStreamAudioSourceNode | null = null;
let _rate = TARGET_RATE;
let _pcm: Int16Array[] = [];
let _pcmSamples = 0;
let _speaking = false;
let _voicedSince = 0;
let _silentSince = 0;
let _sentAt = 0;
let _busy = false;
let _level = 0;
let _baseline = 0;
let _lastTick = 0;

function emit(text: string) {
  if (_sink) {
    try {
      _sink(text);
    } catch {}
  }
}

function notice(code: string, isErr: boolean) {
  if (_notice) {
    try {
      _notice(code, Boolean(isErr));
    } catch {}
  }
}

function getLang(): string {
  try {
    return (_lang && _lang()) || 'ja';
  } catch {
    return 'ja';
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function frameLevel(frame: Float32Array | Int16Array, isInt16?: boolean): number {
  if (!frame || !frame.length) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const v = isInt16 ? frame[i] / 32768 : frame[i];
    sum += v * v;
  }
  return clamp01(Math.sqrt(sum / frame.length) * Math.SQRT2);
}

export function int16(frame: Float32Array): Int16Array {
  const out = new Int16Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    const v = frame[i] < -1 ? -1 : frame[i] > 1 ? 1 : frame[i];
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

export function wavBlob(frames: Int16Array[], rate: number): Blob {
  let total = 0;
  for (let i = 0; i < frames.length; i++) total += frames[i].length;
  const buf = new ArrayBuffer(44 + total * 2);
  const view = new DataView(buf);

  function str(off: number, s: string) {
    for (let j = 0; j < s.length; j++) view.setUint8(off + j, s.charCodeAt(j));
  }

  str(0, 'RIFF');
  view.setUint32(4, 36 + total * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, total * 2, true);

  let off = 44;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    for (let k = 0; k < f.length; k++, off += 2) {
      view.setInt16(off, f[k], true);
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export function pushFrame(frame: Float32Array | Int16Array, isInt16?: boolean): void {
  _pcm.push(isInt16 ? (frame as Int16Array) : int16(frame as Float32Array));
  _pcmSamples += _pcm.length ? _pcm[_pcm.length - 1].length : 0;
  const limit = Math.round((PRE_ROLL_MS + TRAILING_MS + CANDIDATE_SILENCE_MS * 2) / FRAME_MS) + 4;
  while (_pcm.length > limit) {
    const shifted = _pcm.shift();
    if (shifted) _pcmSamples -= shifted.length;
  }
}

export function closeUtterance(now: number): Blob | null {
  const keepFrom = Math.max(0, Math.round(PRE_ROLL_MS / FRAME_MS));
  const take = _pcm.slice(Math.max(0, _pcm.length - keepFrom - Math.round(TRAILING_MS / FRAME_MS)));
  _speaking = false;
  _voicedSince = 0;
  _silentSince = 0;
  if (!take.length) return null;
  const blob = wavBlob(take, _rate);
  _sentAt = now;
  if (!_transcribe) {
    notice('mic.noTranscriber', true);
    return null;
  }
  if (_busy) return null;
  _busy = true;
  const opts = { lang: getLang() };
  Promise.resolve()
    .then(() => _transcribe!(blob, opts))
    .then((text) => {
      _busy = false;
      const t = String(text ?? '').trim();
      if (!t) {
        notice('mic.empty', false);
        return;
      }
      emit(t);
    })
    .catch((e: unknown) => {
      _busy = false;
      const msg = e instanceof Error ? e.message : String(e);
      notice(`mic.error:${msg}`, true);
    });
  return blob;
}

export function feedLevel(level: number, now: number): Blob | null {
  level = clamp01(Number(level) || 0);
  _level = level;
  if (!_speaking || level < _baseline) {
    _baseline = _baseline * (1 - BASELINE_ALPHA) + level * BASELINE_ALPHA;
  }
  const threshold = _baseline > 0 ? clamp(_baseline * 2.2, MIN_ONSET, MAX_ONSET) : BOOTSTRAP_ONSET;
  const voiced = level >= threshold;

  if (voiced) {
    if (!_speaking) {
      if (!_voicedSince) _voicedSince = now;
      if (now - _voicedSince >= MIN_SPEECH_MS) {
        _speaking = true;
        _silentSince = 0;
        if (_ononset) {
          try {
            _ononset();
          } catch {}
        }
      }
    } else {
      _silentSince = 0;
    }
    return null;
  }

  if (!_speaking) {
    _voicedSince = 0;
    return null;
  }
  if (!_silentSince) {
    _silentSince = now;
    return null;
  }
  if (now - _silentSince < CANDIDATE_SILENCE_MS) return null;
  return closeUtterance(now);
}

const WORKLET_SRC = `
class RyzaTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("ryza-tap", RyzaTap);
`;

function onFrame(channel: Float32Array): void {
  if (!_want || !channel) return;
  pushFrame(channel, false);
  const now = _now();
  if (_lastTick && now - _lastTick < FRAME_MS) return;
  _lastTick = now;
  feedLevel(frameLevel(channel, false), now);
}

function startScriptProcessor(): Promise<boolean> {
  if (!_ctx || !_ctx.createScriptProcessor) return Promise.reject(new Error('NO_AUDIO_TAP'));
  const node = _ctx.createScriptProcessor(2048, 1, 1);
  _node = node;
  node.onaudioprocess = (ev: AudioProcessingEvent) => {
    onFrame(ev.inputBuffer.getChannelData(0));
  };
  _src?.connect(node);
  const mute = _ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute);
  mute.connect(_ctx.destination);
  return Promise.resolve(true);
}

async function startCapture(): Promise<boolean> {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (!md || !md.getUserMedia) throw new Error('NO_MIC_API');
  const stream = await md.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  _stream = stream;

  const AC =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : null;
  if (!AC) throw new Error('NO_AUDIO_CTX');
  try {
    _ctx = new AC({ sampleRate: TARGET_RATE });
  } catch {
    _ctx = new AC();
  }
  _rate = _ctx.sampleRate || TARGET_RATE;
  _src = _ctx.createMediaStreamSource(stream);

  const worklet = _ctx.audioWorklet && typeof window !== 'undefined' && 'AudioWorkletNode' in window;
  if (!worklet) return startScriptProcessor();

  const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
  try {
    await _ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(_ctx, 'ryza-tap');
    _node = node;
    node.port.onmessage = (ev: MessageEvent) => {
      onFrame(ev.data as Float32Array);
    };
    _src.connect(node);
    const mute = _ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute);
    mute.connect(_ctx.destination);
    return true;
  } catch {
    URL.revokeObjectURL(url);
    return startScriptProcessor();
  }
}

function teardown(): void {
  _lastTick = 0;
  _speaking = false;
  _voicedSince = 0;
  _silentSince = 0;
  _pcm = [];
  _pcmSamples = 0;
  _busy = false;
  try {
    if (_node) {
      if ('port' in _node && _node.port) _node.port.onmessage = null;
      if ('onaudioprocess' in _node) _node.onaudioprocess = null;
      _node.disconnect();
    }
  } catch {}
  try {
    if (_src) _src.disconnect();
  } catch {}
  try {
    if (_ctx) _ctx.close();
  } catch {}
  try {
    if (_stream) _stream.getTracks().forEach((t) => t.stop());
  } catch {}
  _node = null;
  _src = null;
  _ctx = null;
  _stream = null;
}

export function available(): boolean {
  return Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia);
}

export function isListening(): boolean {
  return Boolean(_want);
}

export function isSpeaking(): boolean {
  return Boolean(_speaking);
}

export function level(): number {
  return _level;
}

export function baseline(): number {
  return _baseline;
}

export async function start(): Promise<boolean> {
  if (_want) return true;
  if (!available()) {
    notice('mic.unsupported', true);
    return false;
  }
  _want = true;
  try {
    await startCapture();
    notice('mic.on', false);
    return true;
  } catch (e: unknown) {
    _want = false;
    teardown();
    const name = e instanceof Error ? e.name : '';
    const msg = e instanceof Error ? e.message : String(e);
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      notice('mic.denied', true);
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      notice('mic.nodevice', true);
    } else {
      notice(`mic.error:${name}:${msg}`, true);
    }
    return false;
  }
}

export function stop(): boolean {
  _want = false;
  teardown();
  notice('mic.off', false);
  return true;
}

export function toggle(): Promise<boolean> {
  return isListening() ? Promise.resolve(stop()) : start();
}

export const Stt = {
  MIN_SPEECH_MS,
  CANDIDATE_SILENCE_MS,
  TARGET_RATE,
  setTranscriber: (fn: TranscribeFn | null) => {
    _transcribe = fn;
  },
  setNotice: (fn: NoticeFn | null) => {
    _notice = fn;
  },
  setSink: (fn: SinkFn | null) => {
    _sink = fn;
  },
  setLang: (fn: LangFn | null) => {
    _lang = fn;
  },
  setClock: (fn: ClockFn | null) => {
    _now = fn || (() => Date.now());
  },
  setOnset: (fn: OnsetFn | null) => {
    _ononset = fn;
  },
  available,
  isListening,
  isSpeaking,
  level,
  baseline,
  start,
  stop,
  toggle,
  _feedLevel: feedLevel,
  _pushFrame: pushFrame,
  _frameLevel: frameLevel,
  _wavBlob: wavBlob,
  _close: closeUtterance,
  _state: () => ({
    speaking: _speaking,
    busy: _busy,
    frames: _pcm.length,
    samples: _pcmSamples,
    sentAt: _sentAt,
    want: _want,
  }),
  _reset: () => {
    _lastTick = 0;
    _speaking = false;
    _voicedSince = 0;
    _silentSince = 0;
    _pcm = [];
    _pcmSamples = 0;
    _busy = false;
    _want = false;
    _level = 0;
    _baseline = 0;
    _rate = TARGET_RATE;
  },
};

export default Stt;
