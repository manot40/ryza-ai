import { config } from '$lib/stores/config.svelte';
import { game } from '$lib/stores/game.svelte';
import { memory } from '$lib/stores/memory.svelte';
import { longMem } from '$lib/stores/longmem.svelte';
import { quests } from '$lib/stores/quests.svelte';
import { welcome } from '$lib/stores/welcome.svelte';
import { nsfw } from '$lib/stores/nsfw.svelte';
import { session } from '$lib/stores/session.svelte';
import { viewStore } from '$lib/stores/view.svelte';
import { toast } from '$lib/stores/toast.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { voicePlayer } from '$lib/audio/voice-player.svelte';
import { stageNav } from '$lib/stores/stage-nav.svelte';
import { Langs } from '$lib/i18n/langs';
import { getGreeting, getFailBubble, type FailKind } from '$lib/i18n/game-content.svelte';
import { voiceInput } from '$lib/audio/voice-input.svelte';
import { streamChat as apiChat, formatHistoryReply, screenTagLine, MODE_PLAY_FX } from '$lib/api';
import {
  splitDialogue,
  spokenText,
  translationText,
  labelForBeat,
  stripCues,
  type DialogueBeat,
} from '$lib/api/npc-dialogue';
import { buildTurnPromptPackage, getScreenTagState } from '$lib/api/prompt-context';
import { TypewriterController } from '$lib/typewriter';

const tlApiKeyMissing = 'API key is not configured';
const tlNoStamina = 'Not enough stamina…!';
const tlNetworkError = (em: string) => `Network error: ${em}`;
const tlAuthFailed = 'LLM Authentication failed (check API Key)';
const tlModelNotSupported = 'LLM Model not supported (check model name in Settings)';
const tlTimeout = 'Timed out: endpoint never answered (check base URL & model name)';
const tlNetError = 'Could not reach base URL (check address & CORS)';

// prettier-ignore
const ErrorMessages = {
  get auth() { return tlAuthFailed },
  get model() { return tlModelNotSupported },
  get net() { return tlNetError },
  get nokey() { return tlApiKeyMissing },
  get timeout() { return tlTimeout },
} as Record<FailKind, string>;

export class TalkLoopController {
  isThinking = $state(false);
  displayText = $state('');
  recentPages = $state<string[]>([]);
  activePageIdx = $state(0);
  retryVisible = $state(false);
  lastUserText = $state('');
  currentSpeaker = $state('');
  translationDisplay = $state('');
  currentBeats = $state<DialogueBeat[]>([]);

  private epoch = 0;
  private turnAbort: AbortController | null = null;
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

    voiceInput.setSpeaker(() => voicePlayer.speaking || this.isThinking);
    voiceInput.setInterrupt(() => this.interrupt());
    voiceInput.setSink((transcript) => this.say(transcript));
  }

  /* --------------------------------------------------- Error Mapping */
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
      stageNav.showFaint();
      return;
    }

    const epoch = ++this.epoch;
    this.turnAbort?.abort();
    this.turnAbort = new AbortController();

    voicePlayer.stop();
    this.typewriter.cancel();

    this.lastUserText = text;
    this.retryVisible = false;
    this.isThinking = true;
    welcome.mark('talk');

    try {
      const promptPkg = buildTurnPromptPackage(text);
      const keep = Math.max(0, (llm.historyTurns || 12) * 2);
      const chatHistory = memory.cfg().enabled
        ? memory.toChatHistory(promptPkg.screenTagLine)
        : session.history.slice(-keep);

      const reply = await apiChat(chatHistory, text, {
        mode: String(st.mode || 'chat'),
        style: String(st.style || 'normal'),
        rpgContext: promptPkg.rpgContext,
        sceneSection: promptPkg.sceneSection,
        nsfwSection: promptPkg.nsfwSection,
        memoryBlock: promptPkg.memoryBlock,
        onPressure: () => memory.notifyPressure(),
        tagState: promptPkg.tagState,
        signal: this.turnAbort.signal,
        onFirstLineTags: (tags) => {
          if (this.epoch !== epoch) return;
          if (tags.emotion || tags.attitude) {
            avatarService.setEmotion(tags.emotion || 'smile', tags.attitude || 'agree');
          }
        },
      });

      if (this.epoch !== epoch) return;

      this.isThinking = false;
      session.pushHistory({ role: 'user', content: text });
      longMem.note('user', text);

      if (reply.state && typeof reply.state === 'object') {
        game.applyDelta(reply.state as Record<string, unknown>, 'llm');
        stageNav.applySceneDelta(reply.state as Record<string, unknown>);
      }
      game.spend(cost, 'talk');

      nsfw.onTurn(reply);

      if (reply.emotion || reply.attitude) {
        avatarService.setEmotion(reply.emotion || 'smile', reply.attitude || 'agree');
      }

      const tagState = getScreenTagState();
      memory.ingest(text, reply.text, screenTagLine(tagState));
      longMem.note('assistant', reply.text);

      session.pushHistory({
        role: 'assistant',
        content: formatHistoryReply(reply.text, tagState),
      });

      const beats = splitDialogue(reply.text);
      this.currentBeats = beats;
      let mine = stripCues(spokenText(beats) || reply.text);
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
      const speechPromise = mine
        ? voicePlayer.prepareSpeech(mine, targetEmotion, { signal: this.turnAbort.signal })
        : Promise.resolve(null);

      // Start audio concurrently as soon as synthesized audio is ready
      const audioPromise = speechPromise.then(async (url) => {
        if (this.epoch !== epoch || !url) return;
        const fx = MODE_PLAY_FX[String(st.mode || 'chat')] || null;
        await voicePlayer.playUrl(url, fx);
      });

      // Typewriter reveals text concurrently
      if (mine) {
        this.typewriter.start(mine, async () => {
          if (this.epoch !== epoch) return;
          if (others.length > 0) {
            await audioPromise;
            if (this.epoch === epoch) {
              await this.showOtherBeats(others, epoch);
            }
          }
        });
      } else if (others.length > 0) {
        await this.showOtherBeats(others, epoch);
      }

      // Advance talk quest if not reported in state
      const stateObj = reply.state as Record<string, unknown> | undefined;
      if (!stateObj?.quest) {
        quests.progressEvent('talk');
      }
    } catch (err: unknown) {
      if (this.epoch !== epoch) return;
      this.isThinking = false;
      const em = (err as Error)?.message || 'UNKNOWN';
      const kind = this.failKind(err);
      if (kind !== 'nokey') this.retryVisible = true;
      toast.err(ErrorMessages[kind] ?? tlNetworkError(em));
      const fallback = getFailBubble(kind);
      this.displayText = fallback;
      this.pushPage(fallback);
    }
  }

  private async showOtherBeats(others: DialogueBeat[], epoch: number): Promise<void> {
    for (const b of others) {
      if (this.epoch !== epoch) return;
      const lab = labelForBeat(b, Langs.ui());
      this.currentSpeaker = lab;
      // @wc-ignore
      const chunk = lab ? `${lab}：${b.text}` : b.text;
      await new Promise<void>((resolve) => {
        this.typewriter.start(chunk, () => resolve());
      });
    }
  }

  interrupt(): void {
    this.epoch++;
    this.turnAbort?.abort();
    this.turnAbort = null;
    voicePlayer.stop();
    this.typewriter.cancel();
    this.isThinking = false;
    avatarService.setTalking(false);
  }

  retryLast(): void {
    if (this.lastUserText) this.say(this.lastUserText);
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
}

export const talkLoop = new TalkLoopController();
export default talkLoop;
