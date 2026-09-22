import { config } from '$lib/stores/config.svelte';
import { Langs } from '$lib/i18n/langs';
import { toast } from '$lib/stores/toast.svelte';
import { Echo } from './echo';
import { Stt } from './stt';
import { transcribe as apiTranscribe } from '$lib/api';

const DEFAULT_TAG = 'ja-JP';
const COOLDOWN_MS = 800;
const MAX_RAPID_RESTARTS = 5;
const BARGE_CONFIRM_MS = 240;
const FIRST_SENTENCE_MS = 700;

const tlMicError = (err: string) => `Microphone error: ${err}`;
const tlMicDenied = 'Microphone access denied';
const tlSpeechUnavailable = 'Speech recognition unavailable';
const tlSpeechUnstable = 'Speech recognition unstable';
const tlSwitchToServer = 'Switched to server speech recognition';

export type VoiceInputEngine = 'auto' | 'webSpeech' | 'capture';
export type VoiceInputStatus = 'idle' | 'listening' | 'recognizing' | 'error';

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export class VoiceInputStore {
  isListening = $state(false);
  isSpeaking = $state(false);
  // @wc-ignore
  status = $state<VoiceInputStatus>('idle');
  lastTranscript = $state('');

  get supported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasWebSpeech = Boolean(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );
    const hasMedia = Boolean(navigator?.mediaDevices?.getUserMedia);
    return hasWebSpeech || hasMedia;
  }

  get state(): VoiceInputStatus {
    return this.status;
  }

  private _rec: SpeechRecognitionInstance | null = null;
  private _suppressedUntil = 0;
  private _restarts = 0;
  private _startedAt = 0;
  private _speakStartedAt = 0;
  private _bargeTimer: ReturnType<typeof setTimeout> | null = null;
  private _webSpeechDead = false;
  private _autoSendTimer: ReturnType<typeof setTimeout> | null = null;

  private _onSink: ((text: string) => void) | null = null;
  private _onInterrupt: (() => void) | null = null;
  private _speakerCheck: (() => boolean) | null = null;

  constructor() {
    Stt.setTranscriber(async (blob, opts) => {
      this.status = 'recognizing';
      try {
        const text = await apiTranscribe(blob, opts);
        return text;
      } finally {
        if (this.isListening) {
          this.status = 'listening';
        }
      }
    });

    Stt.setSink((text) => {
      this.accept(text);
    });

    Stt.setOnset(() => {
      this._onSpeechStart();
    });

    Stt.setLang(() => Langs.sttLang(Langs.ui()));
  }

  /* ------------------------------------------------ Ports & Handlers */
  setSink(fn: ((text: string) => void) | null): void {
    this._onSink = fn;
  }

  setInterrupt(fn: (() => void) | null): void {
    this._onInterrupt = fn;
  }

  setSpeaker(fn: (() => boolean) | null): void {
    this._speakerCheck = fn;
  }

  private _isAssistantSpeaking(): boolean {
    if (this._speakerCheck) {
      try {
        return this._speakerCheck();
      } catch {
        return false;
      }
    }
    return false;
  }

  private _armCooldown(): void {
    this._suppressedUntil = Date.now() + COOLDOWN_MS;
  }

  accept(text: unknown): boolean {
    const t = String(text ?? '').trim();
    if (!t) return false;
    const now = Date.now();
    if (this._isAssistantSpeaking()) {
      this._armCooldown();
      return false;
    }
    if (now < this._suppressedUntil) return false;
    if (Echo.looksLikeEcho(t, now)) return false;

    this.lastTranscript = t;
    if (this._onSink) {
      try {
        this._onSink(t);
      } catch {}
    }

    const app = config.get('app');
    if (app.autoSend) {
      const delay = Number(app.autoSendDelay) || 2000;
      if (this._autoSendTimer) clearTimeout(this._autoSendTimer);
      this._autoSendTimer = setTimeout(() => {
        this._autoSendTimer = null;
        // Broadcast trigger or send
      }, delay);
    }
    return true;
  }

  /* ------------------------------------------------ Speech Recognition (Web Speech) */
  private _getCtor(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    return (
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition ||
      null
    );
  }

  resolvedEngine(): 'webSpeech' | 'capture' | null {
    const sttCfg = config.get('stt');
    const pref = (sttCfg.engine || 'auto') as VoiceInputEngine;
    const hasRec = Boolean(this._getCtor()) && !this._webSpeechDead;
    const hasCap = Stt.available() && Boolean(sttCfg.baseUrl);

    if (pref === 'webSpeech') return hasRec ? 'webSpeech' : null;
    if (pref === 'capture') return hasCap ? 'capture' : null;
    if (hasRec) return 'webSpeech';
    return hasCap ? 'capture' : null;
  }

  isAvailable(): boolean {
    return Boolean(this.resolvedEngine());
  }

  private _buildWebSpeech(): SpeechRecognitionInstance | null {
    const Ctor = this._getCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    try {
      rec.lang = Langs.sttTag(Langs.ui()) || DEFAULT_TAG;
    } catch {}

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const res = ev.results;
      if (!res) return;
      for (let i = ev.resultIndex || 0; i < res.length; i++) {
        const r = res[i];
        if (!r || !r.isFinal) continue;
        const transcript = r[0]?.transcript;
        if (transcript) this.accept(transcript);
      }
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      const code = ev.error || '';
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.isListening = false;
        this.status = 'error';
        toast.err(tlMicDenied);
        return;
      }
      if (code === 'network' || code === 'language-not-supported') {
        this._webSpeechDead = true;
        try {
          this._rec?.stop();
        } catch {}
        if (this.resolvedEngine() === 'capture') {
          toast.show(tlSwitchToServer);
          const wasListening = this.isListening;
          this.isListening = false;
          if (wasListening) this.start();
          return;
        }
      }
      toast.err(tlMicError(code));
      this.status = 'error';
    };

    rec.onspeechstart = () => {
      this._onSpeechStart();
    };
    rec.onspeechend = () => {
      this._cancelBarge();
    };
    rec.onend = () => {
      if (!this.isListening) {
        this.status = 'idle';
        return;
      }
      const ranFor = Date.now() - this._startedAt;
      if (ranFor < 400) this._restarts++;
      else this._restarts = 0;
      if (this._restarts > MAX_RAPID_RESTARTS) {
        this.isListening = false;
        this.status = 'error';
        toast.err(tlSpeechUnstable);
        return;
      }
      try {
        rec.start();
        this._startedAt = Date.now();
      } catch {
        this.isListening = false;
        this.status = 'idle';
      }
    };
    return rec;
  }

  /* ------------------------------------------------ Lifecycle Controls */
  async start(): Promise<boolean> {
    const eng = this.resolvedEngine();
    if (!eng) {
      toast.err(tlSpeechUnavailable);
      this.status = 'error';
      return false;
    }
    if (this.isListening) return true;
    this.isListening = true;
    this.status = 'listening';
    this._restarts = 0;

    if (eng === 'capture') {
      const ok = await Stt.start();
      if (!ok && this.isListening) {
        this.isListening = false;
        this.status = 'error';
      }
      return ok;
    }

    try {
      this._rec = this._rec || this._buildWebSpeech();
      this._rec?.start();
      this._startedAt = Date.now();
    } catch (e: unknown) {
      this.isListening = false;
      this.status = 'error';
      const msg = e instanceof Error ? e.message : String(e);
      toast.err(tlMicError(msg));
    }
    return this.isListening;
  }

  stop(): boolean {
    this.isListening = false;
    this.status = 'idle';
    this._cancelBarge();
    try {
      this._rec?.stop();
    } catch {}
    try {
      Stt.stop();
    } catch {}
    return true;
  }

  async toggle(): Promise<boolean> {
    return this.isListening ? this.stop() : this.start();
  }

  /* ------------------------------------------------ Barge-in & Assistant Feedback */
  noteAssistantSpeech(text: unknown): boolean {
    const t = String(text ?? '');
    if (!t.trim()) return false;
    Echo.remember(t, Date.now());
    return true;
  }

  noteAssistantSpeechStarted(): void {
    this._speakStartedAt = Date.now();
  }

  noteAssistantSpeechEnded(reason?: string): void {
    this._cancelBarge();
    if (this.isListening && reason !== 'user-barge-in') {
      this._armCooldown();
    }
  }

  selfSpeechFor(): number {
    return this._speakStartedAt ? Date.now() - this._speakStartedAt : 0;
  }

  suppressFor(ms: number): void {
    const until = Date.now() + Math.max(0, Number(ms) || 0);
    if (until > this._suppressedUntil) {
      this._suppressedUntil = until;
    }
  }

  private _onSpeechStart(): void {
    const app = config.get('app');
    if (!app.bargeIn) return;
    if (!this._isAssistantSpeaking()) return;
    if (this.selfSpeechFor() < FIRST_SENTENCE_MS) return;
    if (this._bargeTimer) return;

    this._bargeTimer = setTimeout(() => {
      this._bargeTimer = null;
      if (!this._isAssistantSpeaking()) return;
      if (this._onInterrupt) {
        try {
          this._onInterrupt();
        } catch {}
      }
    }, BARGE_CONFIRM_MS);
  }

  private _cancelBarge(): void {
    if (!this._bargeTimer) return;
    clearTimeout(this._bargeTimer);
    this._bargeTimer = null;
  }
}

export const voiceInput = new VoiceInputStore();
export default voiceInput;
