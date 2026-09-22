import { config, type StateConfig } from '$lib/stores/config.svelte';
import { game } from '$lib/stores/game.svelte';
import { memory } from '$lib/stores/memory.svelte';
import { longTerm } from '$lib/stores/longterm.svelte';
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
import { getGreeting, getFailBubble, type FailKind } from '$lib/i18n/game-content.svelte';
import { voiceInput } from '$lib/audio/voice-input.svelte';
import {
  chat as apiChat,
  speak as apiSpeak,
  translate as apiTranslate,
  formatHistoryReply,
  MODE_PLAY_FX,
} from '$lib/api';
import {
  splitDialogue,
  spokenText,
  translationText,
  labelForBeat,
  npcPromptBlock,
  type DialogueBeat,
} from '$lib/api/npc-dialogue';
import { VoiceCache, isFav, toggleFav } from '$lib/audio/voicecache';
import { TypewriterController } from '$lib/typewriter';

const RPG_MODES: Record<string, number> = { chat: 1, story: 1, immersive: 1 };

const tlApiKeyMissing = 'API key is not configured';
const tlNoStamina = 'Not enough stamina…!';
const tlNetworkError = (em: string) => `Network error: ${em}`;
const tlNoShip = 'No ship, no leaving Kurken Island (finish Main Quest 8)';
const tlTravel = (label: string) => `Travel: ${label}`;
const tlRestSafely = 'Rested safely at home — stamina fully restored!';
const tlYouSailed = 'You sailed! The world map is open';
const tlAuthFailed = 'LLM Authentication failed (check API Key)';
const tlModelNotSupported = 'LLM Model not supported (check model name in Settings)';
const tlTimeout = 'Timed out: endpoint never answered (check base URL & model name)';
const tlNetError = 'Could not reach base URL (check address & CORS)';
const tlNoVoiceToReplay = 'No voice to replay';
const tlVoiceNotInCache = 'Voice clip no longer in cache';
const tlNoVoiceToFav = 'No voice to favorite';
const tlFavAdded = 'Added to favorites ★';
const tlFavRemoved = 'Removed from favorites';
// prettier-ignore
const ErrorMessages = {
  get nokey() { return tlApiKeyMissing },
  get auth() { return tlAuthFailed },
  get model() { return tlModelNotSupported },
  get timeout() { return tlTimeout },
  get net() { return tlNetError },
} as Record<FailKind, string>;

export class TalkLoopController {
  speaking = $state(false);
  isThinking = $state(false);
  displayText = $state('');
  recentPages = $state<string[]>([]);
  activePageIdx = $state(0);
  retryVisible = $state(false);
  lastUserText = $state('');
  currentSpeaker = $state('');
  translationDisplay = $state('');
  currentBeats = $state<DialogueBeat[]>([]);
  lastVoiceKey = $state('');
  lastVoiceUrl = $state('');

  audio: HTMLAudioElement | null = null;
  private _voiceCtx: AudioContext | null = null;
  private _voiceAnalyser: AnalyserNode | null = null;
  private _activeVoiceUrl: string | null = null;
  private _epoch = 0;

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

    voiceInput.setSpeaker(() => this.speaking);
    voiceInput.setInterrupt(() => this.interrupt());
    voiceInput.setSink((transcript) => {
      this.say(transcript);
    });
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
    if (!config.get('app')?.vibration) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  }

  /* --------------------------------------------------- Prompt Contexts */
  private peopleBlock(st: StateConfig): string {
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

    const app = config.get('app');
    const npcBlock = npcPromptBlock(
      { stage: stageId, day },
      {
        npcFrequency: app.npcFrequency,
        translate: Langs.reply() !== Langs.ui(),
      }
    );
    if (npcBlock) {
      lines.push('', npcBlock);
    }
    return lines.join('\n');
  }

  private clockBlock(st: StateConfig): string {
    const app = config.get('app');
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

  private sceneContext(): string {
    const st = config.get('state');
    const parts = [world.promptBlock(st), this.peopleBlock(st), this.clockBlock(st)];
    return parts.filter(Boolean).join('\n\n');
  }

  private rpgContext(): string {
    const st = config.get('state');
    const mode = String(st.mode || 'chat');
    if (!RPG_MODES[mode]) return '';
    return [game.promptBlock(), quests.promptBlock()].filter(Boolean).join('\n\n');
  }

  private applySceneDelta(d: Record<string, unknown>): void {
    if (!d || typeof d !== 'object') return;
    const scene = (d.scene && typeof d.scene === 'object' ? d.scene : {}) as Record<string, unknown>;

    const sleep = d.sleep === true || d.sleep === 'true' || d.sleep === 1 || scene.sleep === true;
    if (sleep) {
      this.sleepHome();
      return;
    }

    const raw = (d.current_stage || d.stage || d.map_move || scene.current_stage) as string | undefined;
    const s = config.get('state');
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
          Number(config.get('app')?.flowSpeed) || 1
        );
      }

      config.setState({
        gameHour: cur,
        gameClockAt: nowMs,
      });
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

  private failKind(err: unknown): FailKind {
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'timeout' || code === 'net') return code as FailKind;

    const m = String((err as Error)?.message || err || '');
    if (m === 'NO_KEY' || /NO_KEY|needKey/i.test(m)) return 'nokey';
    if (/401|403|unauthor|invalid[_ ]api[_ ]key|forbidden/i.test(m)) return 'auth';
    if (/model|not found|unsupported/i.test(m)) return 'model';
    if (/timeout|timed out/i.test(m)) return 'timeout';
    if (/failed to fetch|networkerror|econnrefused|cors/i.test(m)) return 'net';
    return 'other';
  }

  private async prepareSpeech(text: string, emotion?: string): Promise<string | null> {
    const st = config.get('state');
    const app = config.get('app');
    const tts = config.get('tts');

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

    const targetEmotion = emotion || avatarService.currentEmotion || 'neutral';

    try {
      const url = await apiSpeak(speakText, ttsL, String(st.mode || 'chat'), targetEmotion);
      if (url) {
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
      }
      return url;
    } catch {
      return null;
    }
  }

  /* --------------------------------------------------- Talk Loop Turn */
  async say(text: string): Promise<void> {
    const st = config.get('state');
    const llm = config.get('llm');

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

    const epoch = ++this._epoch;
    this.pauseVoice();
    this.typewriter.cancel();

    this.lastUserText = text;
    this.retryVisible = false;
    this.speaking = true;
    this.isThinking = true;
    welcome.mark('talk');

    try {
      const reply = await apiChat(session.history, text, {
        mode: String(st.mode || 'chat'),
        style: String(st.style || 'normal'),
        rpgContext: this.rpgContext(),
        sceneSection: this.sceneContext(),
        nsfwSection: nsfw.screenFact(),
        memoryBlock: [memory.promptBlock(), longTerm.promptBlock(text)].filter(Boolean).join('\n\n'),
        onPressure: () => memory.notifyPressure(),
      });

      if (this._epoch !== epoch) return;

      this.isThinking = false;
      session.pushHistory({ role: 'user', content: text });
      session.remember('user', text);
      session.remember('ryza', reply.text);
      memory.ingest(text, reply.text);
      longTerm.note('user', text);
      longTerm.note('assistant', reply.text);

      if (reply.state && typeof reply.state === 'object') {
        game.applyDelta(reply.state as Record<string, unknown>, 'llm');
        this.applySceneDelta(reply.state as Record<string, unknown>);
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

      const beats = splitDialogue(reply.text);
      this.currentBeats = beats;
      let mine = spokenText(beats) || reply.text;
      const app = config.get('app');
      const showOriginal = app.showOriginal !== false;
      const trans = translationText(beats);
      this.translationDisplay = trans;

      const others = beats.filter((b) => b.speaker !== 'ryza');
      if (!showOriginal && trans) {
        mine = '';
      }

      this.currentSpeaker = beats[0]?.name || '';
      this.pushPage(reply.text);
      voiceInput.noteAssistantSpeech(mine || reply.text);

      // Pre-fetch TTS speech in the background while typewriter renders (Ryza's lines only)
      const targetEmotion = reply.emotion || avatarService.currentEmotion || 'neutral';
      const speechPromise = mine ? this.prepareSpeech(mine, targetEmotion) : Promise.resolve(null);

      const showOthers = () => {
        let i = 0;
        const next = () => {
          if (this._epoch !== epoch) return;
          if (i >= others.length) return;
          const b = others[i++];
          const lab = labelForBeat(b, Langs.ui());
          this.currentSpeaker = lab;
          // @wc-ignore
          const chunk = lab ? `${lab}：${b.text}` : b.text;
          this.typewriter.start(chunk, () => {
            if (i < others.length) next();
          });
        };
        next();
      };

      if (mine) {
        this.typewriter.start(mine, async () => {
          if (this._epoch !== epoch) return;
          this.speaking = false;
          try {
            const audioUrl = await speechPromise;
            if (this._epoch !== epoch) return;
            if (audioUrl) {
              const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
              this.playUrl(audioUrl, fx);
            }
          } catch {}
          if (others.length) {
            showOthers();
          }
        });
      } else if (others.length) {
        showOthers();
      }

      // Advance talk quest if not reported in state
      const stateObj = reply.state as Record<string, unknown> | undefined;
      if (!stateObj?.quest) {
        quests.progressEvent('talk');
      }
    } catch (err: unknown) {
      if (this._epoch !== epoch) return;
      this.isThinking = false;
      this.speaking = false;
      const em = (err as Error)?.message || 'UNKNOWN';
      const kind = this.failKind(err);
      if (kind !== 'nokey') this.retryVisible = true;
      toast.err(ErrorMessages[kind] ?? tlNetworkError(em));
      const fallback = getFailBubble(kind);
      this.displayText = fallback;
      this.pushPage(fallback);
    }
  }

  async speakThen(text: string, emotion?: string): Promise<void> {
    const targetEmotion = emotion || avatarService.currentEmotion || 'neutral';
    const url = await this.prepareSpeech(text, targetEmotion);
    if (!url) return;
    const st = config.get('state');
    const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
    this.playUrl(url, fx);
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
    this.playUrl(url, fx);
  }

  interrupt(): void {
    this._epoch++;
    this.pauseVoice();
    this.typewriter.cancel();
    this.isThinking = false;
    this.speaking = false;
    avatarService.setTalking(false);
    voiceInput.noteAssistantSpeechEnded('user-barge-in');
  }

  retryLast(): void {
    if (this.lastUserText) this.say(this.lastUserText);
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
    this.playUrl(url, fx);
  }

  playUrl(url: string, fx?: { rate?: number; gain?: number } | null): void {
    this._ensureVoiceGraph();
    if (this._voiceCtx && this._voiceCtx.state === 'suspended') {
      this._voiceCtx.resume().catch(() => {});
    }

    if (!this.audio) return;
    const a = this.audio;

    if (this._activeVoiceUrl && this._activeVoiceUrl !== url) {
      try {
        URL.revokeObjectURL(this._activeVoiceUrl);
      } catch {}
    }
    this._activeVoiceUrl = url;

    a.src = url;

    const app = config.get('app');
    const baseVol = Number(app.volume != null ? app.volume : 0.9);
    a.volume = Math.max(0, Math.min(1, baseVol * (fx?.gain || 1)));
    a.playbackRate = fx?.rate || 1;

    voiceInput.noteAssistantSpeechStarted();

    a.onended = () => {
      a.playbackRate = 1;
      avatarService.setTalking(false);
      voiceInput.noteAssistantSpeechEnded();
      if (this._activeVoiceUrl === url) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        this._activeVoiceUrl = null;
      }
    };

    avatarService.setTalking(true);
    a.play().catch(() => {
      avatarService.setTalking(false);
      voiceInput.noteAssistantSpeechEnded();
    });
    this.buzz();
  }

  playFile(path: string, vol?: number, force?: boolean): void {
    if (!force && config.get('app')?.voice === false) return;
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
    const base = Number(config.get('app')?.volume != null ? config.get('app')?.volume : 0.9);
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

  pauseVoice(): void {
    if (this.audio) {
      try {
        this.audio.pause();
      } catch {}
    }
    avatarService.setTalking(false);
    voiceInput.noteAssistantSpeechEnded();
  }

  /* --------------------------------------------------- Greeting & Pages */
  greet(): void {
    const st = config.get('state');
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

    const st = config.get('state');
    config.setState('stage', stageId);
    if (avatarService.shouldResetPosture()) {
      config.setState('posture', 'posture_standing');
    }

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
    const st = config.get('state');
    const fromStage = String(st.stage || HOME_STAGE);
    let tod = String(st.tod || 'aft');
    config.setState('stage', HOME_STAGE);

    if (world.llmDrivesClock()) {
      tod = 'mor';
      config.setState({
        tod: 'mor',
        gameHour: world.todStartHour('mor'),
        gameClockAt: Date.now(),
      });
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
}

export const talkLoop = new TalkLoopController();
export default talkLoop;
