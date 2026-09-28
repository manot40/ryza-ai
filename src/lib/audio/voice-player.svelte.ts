import { config } from '$lib/stores/config.svelte';
import { session } from '$lib/stores/session.svelte';
import { toast } from '$lib/stores/toast.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { alarm, todForHour } from '$lib/stores/alarm.svelte';
import { voiceBank } from '$lib/audio/voicebank';
import { voiceInput } from '$lib/audio/voice-input.svelte';
import { Langs } from '$lib/i18n/langs';
import { speak as apiSpeak, MODE_PLAY_FX } from '$lib/api';
import { translate as apiTranslate } from '$lib/api/translator';
import { stripActions } from '$lib/api/npc-dialogue';
import { VoiceCache, isFav, toggleFav } from '$lib/audio/voicecache';
import { createAnalyserGraph, type AnalyserGraph } from './analyser';

const tlNoVoiceToReplay = 'No voice to replay';
const tlVoiceNotInCache = 'Voice clip no longer in cache';
const tlNoVoiceToFav = 'No voice to favorite';
const tlFavAdded = 'Added to favorites ★';
const tlFavRemoved = 'Removed from favorites';

export class VoicePlayer {
  speaking = $state(false);
  lastVoiceKey = $state('');
  lastVoiceUrl = $state('');

  private audio: HTMLAudioElement | null = null;
  private voiceGraph: AnalyserGraph | null = null;
  private activeVoiceUrl: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.crossOrigin = 'anonymous';
    }
  }

  private ensureVoiceGraph(): void {
    if (this.voiceGraph || !this.audio || typeof window === 'undefined') return;
    const graph = createAnalyserGraph(this.audio, 512);
    if (graph) {
      this.voiceGraph = graph;
      avatarService.setAudioAnalyser(graph.analyser);
    }
  }

  buzz(ms: number | number[] = 18): void {
    if (!config.get('app')?.vibration) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  }

  async prepareSpeech(
    text: string,
    emotion?: string,
    opts?: { signal?: AbortSignal }
  ): Promise<string | null> {
    const st = config.get('state');
    const app = config.get('app');
    const tts = config.get('tts');

    if (app.voice === false || st.style === 'text' || tts.mode === 'off') {
      return null;
    }

    if (opts?.signal?.aborted) return null;

    const replyL = Langs.llm() || 'ja';
    const ttsL = Langs.tts() || replyL;
    const targetEmotion = emotion || avatarService.currentEmotion || 'neutral';

    /* Stage directions in *asterisks* are actions, not speech — never translate
       or voice them. Strip on input so the translator doesn't burn effort on
       them, and again on output in case it echoes them anyway. */
    const spoken = stripActions(text);
    let speakText = spoken;
    if (ttsL !== replyL && apiTranslate) {
      try {
        speakText = stripActions(await apiTranslate({ text: spoken, toLang: ttsL, emotion: targetEmotion }));
      } catch {}
    }

    if (opts?.signal?.aborted) return null;

    try {
      const url = await apiSpeak(speakText, ttsL, String(st.mode || 'chat'), targetEmotion);
      if (!url) return null;

      if (opts?.signal?.aborted) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        return null;
      }

      const key = `v${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        await VoiceCache.put(key, blob, { text: speakText });
      } catch {}

      this.lastVoiceKey = key;
      this.lastVoiceUrl = url;

      const lastTurn = session.history[session.history.length - 1];
      if (lastTurn && lastTurn.role === 'assistant') {
        lastTurn.voiceKey = key;
        session.saveHistory();
      }

      return url;
    } catch {
      return null;
    }
  }

  playUrl(url: string, fx?: { rate?: number; gain?: number } | null): Promise<void> {
    return new Promise((resolve) => {
      this.ensureVoiceGraph();
      if (this.voiceGraph?.ctx.state === 'suspended') {
        this.voiceGraph.ctx.resume().catch(() => {});
      }

      if (!this.audio) {
        resolve();
        return;
      }

      const a = this.audio;

      if (this.activeVoiceUrl && this.activeVoiceUrl !== url) {
        try {
          URL.revokeObjectURL(this.activeVoiceUrl);
        } catch {}
      }
      this.activeVoiceUrl = url;

      a.src = url;

      const app = config.get('app');
      const baseVol = Number(app.volume != null ? app.volume : 0.9);
      a.volume = Math.max(0, Math.min(1, baseVol * (fx?.gain || 1)));
      a.playbackRate = fx?.rate || 1;

      voiceInput.noteAssistantSpeechStarted();
      this.speaking = true;
      avatarService.engine.setTalking(true);

      const cleanup = () => {
        a.playbackRate = 1;
        avatarService.engine.setTalking(false);
        this.speaking = false;
        voiceInput.noteAssistantSpeechEnded();
        if (this.activeVoiceUrl === url) {
          try {
            URL.revokeObjectURL(url);
          } catch {}
          this.activeVoiceUrl = null;
        }
        a.onended = null;
        a.onerror = null;
        resolve();
      };

      a.onended = cleanup;
      a.onerror = cleanup;

      a.play().catch(() => {
        cleanup();
      });
      this.buzz();
    });
  }

  playFile(path: string, vol?: number, force?: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (!force && config.get('app')?.voice === false) {
        resolve();
        return;
      }

      this.ensureVoiceGraph();
      if (this.voiceGraph?.ctx.state === 'suspended') {
        this.voiceGraph.ctx.resume().catch(() => {});
      }

      if (!this.audio && typeof Audio !== 'undefined') {
        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.audio.crossOrigin = 'anonymous';
      }
      if (!this.audio) {
        resolve();
        return;
      }

      const a = this.audio;
      const resolvedPath = path.startsWith('/') ? path : `/${path}`;
      a.src = resolvedPath;
      const base = Number(config.get('app')?.volume != null ? config.get('app')?.volume : 0.9);
      a.volume = vol != null ? vol : base;

      avatarService.engine.setTalking(true);
      this.speaking = true;

      if (alarm.loadEnv) {
        alarm.loadEnv(resolvedPath).then((env) => {
          if (env) avatarService.engine.setTalkingEnvelope(env);
        });
      }

      const cleanup = () => {
        avatarService.engine.setTalking(false);
        this.speaking = false;
        a.onended = null;
        a.onerror = null;
        resolve();
      };

      a.onended = cleanup;
      a.onerror = cleanup;

      a.play().catch(() => {
        cleanup();
      });
      this.buzz();
    });
  }

  async playWellDone(): Promise<void> {
    if (!voiceBank.index) {
      await voiceBank.load();
    }
    const st = config.get('state');
    const style = st.mode === 'asmr' ? 'whisper' : 'normal';
    const tod = todForHour(new Date().getHours());
    const clip = voiceBank.pick('wellDone', style, tod);
    if (clip) {
      setTimeout(() => {
        this.playFile(clip);
      }, 500);
    }
  }

  async speakThen(text: string, emotion?: string): Promise<void> {
    const targetEmotion = emotion || avatarService.currentEmotion || 'neutral';
    const url = await this.prepareSpeech(text, targetEmotion);
    if (!url) return;
    const st = config.get('state');
    const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
    await this.playUrl(url, fx);
  }

  async replayLastVoice(): Promise<void> {
    if (!this.lastVoiceKey) {
      toast.show(tlNoVoiceToReplay);
      return;
    }
    const url = await VoiceCache.urlFor(this.lastVoiceKey);
    if (!url) {
      toast.show(tlVoiceNotInCache);
      return;
    }
    this.lastVoiceUrl = url;
    const st = config.get('state');
    const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
    await this.playUrl(url, fx);
  }

  favLastVoice(): void {
    if (!this.lastVoiceKey) {
      toast.show(tlNoVoiceToFav);
      return;
    }
    const isNowFav = toggleFav(this.lastVoiceKey);
    toast.show(isNowFav ? tlFavAdded : tlFavRemoved);
  }

  isLastVoiceFav(): boolean {
    return this.lastVoiceKey ? isFav(this.lastVoiceKey) : false;
  }

  async playVoiceKey(key: string): Promise<void> {
    if (!key) return;
    const url = await VoiceCache.urlFor(key);
    if (!url) {
      toast.show(tlVoiceNotInCache);
      return;
    }
    this.lastVoiceKey = key;
    this.lastVoiceUrl = url;
    const st = config.get('state');
    const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
    await this.playUrl(url, fx);
  }

  stop(): void {
    if (this.audio) {
      try {
        this.audio.pause();
      } catch {}
    }
    if (this.activeVoiceUrl) {
      try {
        URL.revokeObjectURL(this.activeVoiceUrl);
      } catch {}
      this.activeVoiceUrl = null;
    }
    this.speaking = false;
    avatarService.engine.setTalking(false);
    voiceInput.noteAssistantSpeechEnded();
  }

  pauseVoice(): void {
    this.stop();
  }
}

export const voicePlayer = new VoicePlayer();
export default voicePlayer;
