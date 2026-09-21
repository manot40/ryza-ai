import { config, type StateConfig } from '$lib/stores/config.svelte';
import { game } from '$lib/stores/game.svelte';
import { memory } from '$lib/stores/memory.svelte';
import { quests } from '$lib/stores/quests.svelte';
import { welcome } from '$lib/stores/welcome.svelte';
import { world } from '$lib/stores/world.svelte';
import { nsfw } from '$lib/stores/nsfw.svelte';
import { session, HOME_STAGE } from '$lib/stores/session.svelte';
import { overlayStore } from '$lib/stores/overlay.svelte';
import { viewStore } from '$lib/stores/view.svelte';
import { toast } from '$lib/stores/toast.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { sound } from '$lib/audio/sound';
import { voiceBank } from '$lib/audio/voicebank';
import { alarm, todForHour } from '$lib/stores/alarm.svelte';
import { Langs } from '$lib/i18n/langs';
import { getGreeting } from '$lib/i18n/game-content.svelte';
import {
  chat as apiChat,
  speak as apiSpeak,
  translate as apiTranslate,
  formatHistoryReply,
  MODE_PLAY_FX,
} from '$lib/api';
import { TypewriterController } from '$lib/typewriter';

const RPG_MODES: Record<string, number> = { chat: 1, story: 1, immersive: 1 };

const tlApiKeyMissing = 'API key is not configured';
const tlNoStamina = 'Not enough stamina…!';
const tlNetworkError = (em: string) => `Network error: ${em}`;
const tlNoShip = 'No ship, no leaving Kurken Island (finish Main Quest 8)';
const tlTravel = (label: string) => `Travel: ${label}`;
const tlRestSafely = 'Rested safely at home — stamina fully restored!';
const tlYouSailed = 'You sailed! The world map is open';

export class TalkLoopController {
  speaking = $state(false);
  isThinking = $state(false);
  displayText = $state('');
  recentPages = $state<string[]>([]);
  activePageIdx = $state(0);
  retryVisible = $state(false);
  lastUserText = $state('');

  audio: HTMLAudioElement | null = null;
  private _voiceCtx: AudioContext | null = null;
  private _voiceAnalyser: AnalyserNode | null = null;

  typewriter: TypewriterController;

  constructor() {
    this.typewriter = new TypewriterController({
      speed: 28,
      onUpdate: (partial) => {
        this.displayText = partial;
      },
      onDone: () => {
        avatarService.setTalking(false);
      },
    });

    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.crossOrigin = 'anonymous';
    }
  }

  /* --------------------------------------------------- Audio & Lip-sync */
  private _ensureVoiceGraph(): void {
    if (this._voiceAnalyser || !this.audio || typeof window === 'undefined') return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    try {
      this._voiceCtx = new AC();
      const src = this._voiceCtx.createMediaElementSource(this.audio);
      const an = this._voiceCtx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      an.connect(this._voiceCtx.destination);
      this._voiceAnalyser = an;
      avatarService.setAudioAnalyser(an);
    } catch {}
  }

  buzz(ms: number | number[] = 18): void {
    if (!config.section('app')?.vibration) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  }

  /* --------------------------------------------------- Prompt Contexts */
  private _peopleBlock(st: StateConfig): string {
    if (!world.npcs) return '';
    // @wc-ignore
    const lines = ['## この世界の人々（ライザ以外）'];
    const stageId = String(st.stage || HOME_STAGE);
    const day = Number(st.day) || 1;
    const here = world.npcsAt(stageId, day);

    // prettier-ignore
    // @wc-ignore
    lines.push('- いま同じ場所にいる人：' + (here.length ? here.map((n) => world.npcName(n.id) + (n.note ? `（${n.note}）` : '')).join('、') : 'いない'));

    const known: Record<string, { id: string; note?: string }> = {};
    (world.npcs.npcs || []).forEach((n) => {
      known[n.id] = n;
    });

    const metCharas = game.met_charas || [];
    const met = metCharas
      .map((id: string) => known[id])
      .filter((n): n is { id: string; note?: string } => Boolean(n))
      .slice(0, 16);

    if (met.length) {
      // prettier-ignore
      // @wc-ignore
      lines.push('- これまでに会った人：' + met.map((n) => world.npcName(n.id) + (n.note ? `（${n.note}）` : '')).join('、'));
    }
    return lines.join('\n');
  }

  private _clockBlock(st: StateConfig): string {
    const app = config.section('app') || {};
    const mode = app.timeMode || 'real';
    const hour =
      mode === 'flow'
        ? Math.floor(Number(st.gameHour) || 12)
        : mode === 'manual'
          ? world.todStartHour(String(st.tod || 'aft'))
          : new Date().getHours();

    // @wc-ignore
    return `## 現在時刻\n- 同伴 ${st.day || 1}日目／${world.todLabel(String(st.tod || 'aft'))}（約${hour}時）`;
  }

  private _sceneContext(): string {
    const st = config.section('state') || {};
    const parts = [world.promptBlock(st), this._peopleBlock(st), this._clockBlock(st)];
    return parts.filter(Boolean).join('\n\n');
  }

  private _rpgContext(): string {
    const st = config.section('state') || {};
    const mode = String(st.mode || 'chat');
    if (!RPG_MODES[mode]) return '';
    return [game.promptBlock(), quests.promptBlock()].filter(Boolean).join('\n\n');
  }

  /* --------------------------------------------------- Talk Loop Turn */
  async say(text: string): Promise<void> {
    const st = config.section('state') || {};
    const llm = config.section('llm') || {};

    if (!llm.apiKey) {
      toast.err(tlApiKeyMissing);
      viewStore.setView('settings');
      return;
    }

    const cost = game.turnCost(String(st.mode || 'chat'), String(st.style || 'normal'));
    if (game.faint() || !game.canAct(cost)) {
      toast.err(tlNoStamina);
      this.showFaint();
      return;
    }

    this.lastUserText = text;
    this.retryVisible = false;
    this.speaking = true;
    this.isThinking = true;
    welcome.mark('talk');

    try {
      const reply = await apiChat(session.history, text, {
        mode: String(st.mode || 'chat'),
        style: String(st.style || 'normal'),
        rpgContext: this._rpgContext(),
        sceneSection: this._sceneContext(),
        nsfwSection: nsfw.screenFact(),
        memoryBlock: memory.promptBlock(),
        onPressure: () => memory.notifyPressure(),
      });

      this.isThinking = false;
      session.pushHistory({ role: 'user', content: text });
      session.remember('user', text);
      session.remember('ryza', reply.text);
      memory.ingest(text, reply.text);

      if (reply.state && typeof reply.state === 'object') {
        game.applyDelta(reply.state as Record<string, unknown>, 'llm');
        this._applySceneDelta(reply.state as Record<string, unknown>);
      }
      game.spend(cost, 'talk');

      nsfw.onTurn(reply);

      if (reply.emotion || reply.attitude) {
        avatarService.setEmotion(reply.emotion || 'smile', reply.attitude || 'agree');
      }

      session.pushHistory({
        role: 'assistant',
        content: formatHistoryReply(reply.text),
      });

      this.pushPage(reply.text);

      // Pre-fetch TTS speech in the background while typewriter renders
      const speechPromise = this.prepareSpeech(reply.text);

      this.typewriter.start(reply.text, async () => {
        this.speaking = false;
        try {
          const audioUrl = await speechPromise;
          if (audioUrl) {
            const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
            this.playUrl(audioUrl, fx);
          }
        } catch {}
      });

      // Advance talk quest if not reported in state
      const stateObj = reply.state as Record<string, unknown> | undefined;
      if (!stateObj?.quest) {
        quests.progressEvent('talk');
      }
    } catch (err: unknown) {
      this.isThinking = false;
      this.speaking = false;
      const em = (err as Error)?.message || 'UNKNOWN';
      if (em !== 'NO_KEY') this.retryVisible = true;
      toast.err(em === 'NO_KEY' ? tlApiKeyMissing : tlNetworkError(em));
      // @wc-ignore
      const fallback = '（……うまく聞こえなかった。もう一回言って？）';
      this.displayText = fallback;
      this.pushPage(fallback);
    }
  }

  retryLast(): void {
    if (this.lastUserText) {
      this.say(this.lastUserText);
    }
  }

  /* --------------------------------------------------- Speech & Audio */
  async prepareSpeech(text: string): Promise<string | null> {
    const st = config.section('state') || {};
    const app = config.section('app') || {};
    const tts = config.section('tts') || {};

    if (app.voice === false || st.style === 'text' || tts.mode === 'off') {
      return null;
    }

    const replyL = Langs.llm() || 'ja';
    const ttsL = Langs.tts() || replyL;

    let speakText = text;
    if (ttsL !== replyL && apiTranslate) {
      try {
        speakText = await apiTranslate(text, ttsL);
      } catch {}
    }

    try {
      return await apiSpeak(speakText, ttsL, String(st.mode || 'chat'));
    } catch {
      return null;
    }
  }

  async speakThen(text: string, emotion?: string): Promise<void> {
    const url = await this.prepareSpeech(text);
    if (!url) return;
    const st = config.section('state') || {};
    const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
    this.playUrl(url, fx);
  }

  playUrl(url: string, fx?: { rate?: number; gain?: number } | null): void {
    this._ensureVoiceGraph();
    if (this._voiceCtx && this._voiceCtx.state === 'suspended') {
      this._voiceCtx.resume().catch(() => {});
    }

    if (!this.audio) return;
    const a = this.audio;
    a.src = url;

    const app = config.section('app') || {};
    const baseVol = Number(app.volume != null ? app.volume : 0.9);
    a.volume = Math.max(0, Math.min(1, baseVol * (fx?.gain || 1)));
    a.playbackRate = fx?.rate || 1;

    a.onended = () => {
      a.playbackRate = 1;
      avatarService.setTalking(false);
      URL.revokeObjectURL(url);
    };

    avatarService.setTalking(true);
    a.play().catch(() => {
      avatarService.setTalking(false);
    });
    this.buzz();
  }

  playFile(path: string, vol?: number, force?: boolean): void {
    if (!force && config.section('app')?.voice === false) return;
    this._ensureVoiceGraph();
    if (this._voiceCtx && this._voiceCtx.state === 'suspended') {
      this._voiceCtx.resume().catch(() => {});
    }

    if (!this.audio && typeof Audio !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.crossOrigin = 'anonymous';
    }
    if (!this.audio) return;
    const a = this.audio;
    const resolvedPath = path.startsWith('/') ? path : `/${path}`;
    a.src = resolvedPath;
    const base = Number(config.section('app')?.volume != null ? config.section('app')?.volume : 0.9);
    a.volume = vol != null ? vol : base;

    avatarService.setTalking(true);
    this.speaking = true;
    if (alarm.loadEnv) {
      alarm.loadEnv(resolvedPath).then((env) => {
        if (env) avatarService.setTalkingEnvelope(env);
      });
    }

    a.onended = () => {
      avatarService.setTalking(false);
      this.speaking = false;
    };
    a.play().catch(() => {
      avatarService.setTalking(false);
      this.speaking = false;
    });
    this.buzz();
  }

  async playWellDone(): Promise<void> {
    if (!voiceBank.index) {
      await voiceBank.load();
    }
    const st = config.section('state') || {};
    const style = st.mode === 'asmr' ? 'whisper' : 'normal';
    const tod = todForHour(new Date().getHours());
    const clip = voiceBank.pick('wellDone', style, tod);
    if (clip) {
      setTimeout(() => {
        this.playFile(clip);
      }, 500);
    }
  }

  pauseVoice(): void {
    if (this.audio) {
      try {
        this.audio.pause();
      } catch {}
    }
    avatarService.setTalking(false);
  }

  /* --------------------------------------------------- Greeting & Pages */
  greet(): void {
    const st = config.section('state') || {};
    const day = Number(st.day) || 1;
    const line = getGreeting(day, Langs.llm());
    this.displayText = line;
    this.pushPage(line);
    avatarService.setEmotion('happy', 'agree');
  }

  pushPage(text: string): void {
    if (!text) return;
    if (this.recentPages[this.recentPages.length - 1] === text) return;
    this.recentPages = [...this.recentPages.slice(-4), text];
    this.activePageIdx = this.recentPages.length - 1;
    this.displayText = text;
  }

  selectPage(idx: number): void {
    if (this.typewriter.isTyping) {
      this.typewriter.finish();
    }
    if (idx >= 0 && idx < this.recentPages.length) {
      this.activePageIdx = idx;
      this.displayText = this.recentPages[idx];
    }
  }

  gotoStage(stageId: string): void {
    const areaId = world.areaOf(stageId);
    if (areaId && world.locked(areaId)) {
      toast.err(tlNoShip);
      return;
    }

    const st = config.section('state') || {};
    config.set('state.stage', stageId);

    const tod = String(st.tod || 'aft');
    avatarService.loadScene(stageId, tod);
    sound.setPlace(stageId, tod, world.backgroundFor(stageId));
    sound.setRoute('talk');

    const place = world.find(stageId);
    if (place) {
      toast.show(tlTravel(world.placeLabel(stageId, place.stage)));
    }

    const npcs = world.npcsAt(stageId, Number(st.day) || 1);
    const names = game.meetCharas(npcs);
    if (names.length) {
      // @wc-ignore
      game.remember(names.join('、') + ' と出会った。');
    }

    quests.progressEvent('explore');
    viewStore.setView('talk');
  }

  sleepHome(): void {
    const st = config.section('state') || {};
    const fromStage = String(st.stage || HOME_STAGE);
    let tod = String(st.tod || 'aft');
    config.set('state.stage', HOME_STAGE);

    if (world.llmDrivesClock()) {
      tod = 'mor';
      config.set('state.tod', 'mor');
      config.set('state.gameHour', world.todStartHour('mor'));
      config.set('state.gameClockAt', Date.now());
    }

    avatarService.loadScene(HOME_STAGE, tod);
    sound.setPlace(HOME_STAGE, tod, world.backgroundFor(HOME_STAGE));
    game.refill();
    // @wc-ignore
    game.remember('安全なおうちでぐっすり眠った。');
    if (fromStage !== HOME_STAGE) {
      quests.progressEvent('explore');
    }
    overlayStore.closeFaint();
    viewStore.setView('talk');
    toast.show(tlRestSafely);
  }

  onSailed(): void {
    // @wc-ignore
    game.remember('船でクーケン島を出航した！');
    toast.show(tlYouSailed);
    viewStore.setView('world');
  }

  showFaint(): void {
    overlayStore.showFaint();
    avatarService.setEmotion('crying', 'deny');
  }

  _applySceneDelta(d: Record<string, unknown>): void {
    if (!d || typeof d !== 'object') return;
    const scene = (d.scene && typeof d.scene === 'object' ? d.scene : {}) as Record<string, unknown>;

    const sleep = d.sleep === true || d.sleep === 'true' || d.sleep === 1 || scene.sleep === true;
    if (sleep) {
      this.sleepHome();
      return;
    }

    const raw = (d.current_stage || d.stage || d.map_move || scene.current_stage) as string | undefined;
    const s = config.section('state') || {};
    const fromStage = String(s.stage || HOME_STAGE);
    const fromTod = String(s.tod || 'aft');
    let dest = fromStage;

    if (raw != null && String(raw).trim()) {
      const id = world.resolveStage(String(raw).trim());
      if (id) {
        const area = world.areaOf(id);
        if (area && world.locked(area)) {
          toast.err(tlNoShip);
        } else {
          dest = id;
        }
      }
    }

    let nextTod = fromTod;
    if (world.llmDrivesClock()) {
      const tod = (d.tod || d.time_bucket || scene.time_bucket) as string | undefined;
      const gh = Number(d.game_hour != null ? d.game_hour : NaN);
      const adv = Number(
        d.time_advance != null ? d.time_advance : d.advance_hours != null ? d.advance_hours : NaN
      );

      let cur = Number(s.gameHour);
      if (!(cur >= 0 && cur < 24)) cur = 12;
      const nowMs = Date.now();

      if (!isNaN(gh)) cur = ((gh % 24) + 24) % 24;
      else if (!isNaN(adv)) cur = (((cur + adv) % 24) + 24) % 24;
      else if (tod && world.isTod(tod) && tod !== fromTod) cur = world.todStartHour(tod);
      else {
        cur = world.flowHour(
          cur,
          Number(s.gameClockAt) || nowMs,
          nowMs,
          Number(config.section('app')?.flowSpeed) || 1
        );
      }

      config.set('state.gameHour', cur);
      config.set('state.gameClockAt', nowMs);
      nextTod = world.hourToTod(cur);
    }

    if (fromTod === 'ngt' && nextTod === 'mor' && dest === HOME_STAGE) {
      game.refill();
      // @wc-ignore
      game.remember('安全なおうちでぐっすり眠った。');
      toast.show(tlRestSafely);
    }

    if (nextTod !== fromTod) {
      session.setTod(nextTod);
    }

    if (dest !== fromStage) {
      this.gotoStage(dest);
    }
  }
}

export const talkLoop = new TalkLoopController();
export default talkLoop;
