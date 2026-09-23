import { config } from './config.svelte';
import { game } from './game.svelte';
import { memory, type MemorySnapshot } from './memory.svelte';
import { longMem, type LongMemSnapshot } from './longmem.svelte';
import { daily } from './daily.svelte';
import { alarm, type AlarmItem } from './alarm.svelte';
import { quests } from './quests.svelte';
import { world } from './world.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { sound } from '$lib/audio/sound';
import { toast } from './toast.svelte';

export const SAVE_KEY = 'ryza.saves.v1';
export const CHAT_HISTORY_KEY = 'ryza.chathistory.v1';
export const HOME_STAGE = 'stage_01_001_04';

const tlDailyBonusAvailable = 'Daily login bonus is available!';
const tlGameSaved = (index: number) => `Game saved to slot ${index + 1}`;
const tlGameLoaded = (index: number) => `Game loaded from slot ${index + 1}`;
const tlKurkenIsland = 'Kurken Island';
const tlRestSafely = 'Rested safely at home — stamina fully restored!';
const tlSlotSaveFail =
  'Could not write the save: this device is out of storage (clear an older slot, or shorten the chat first)';
const tlSlotLoadFail = 'That save could not be read (its contents are incomplete)';

export interface HistoryEntry {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  at?: number;
  voiceKey?: string;
}

export interface SaveSlotSnapshot {
  at: number;
  day: number;
  label: string;
  settings: Record<string, unknown>;
  history: HistoryEntry[];
  memory: MemorySnapshot | null;
  longmem: LongMemSnapshot | null;
  game: unknown;
  daily: unknown;
  alarms: unknown[];
}

export class SessionStore {
  history = $state<HistoryEntry[]>([]);
  slots = $state<Array<SaveSlotSnapshot | null>>([null, null, null]);

  dailyAvailable = $derived(daily.available());

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.loadHistory();
      this.loadSlots();
    }
  }

  /* --------------------------------------------------- Chat History Persistence */
  loadHistory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      this.history = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch {
      this.history = [];
    }
  }

  saveHistory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(this.history));
    } catch {}
  }

  /* --------------------------------------------------- Turn History */
  pushHistory(entry: HistoryEntry): void {
    const fullEntry: HistoryEntry = {
      id: entry.id || `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      at: entry.at || Date.now(),
      ...entry,
    };
    this.history = [...this.history, fullEntry];
    this.saveHistory();
  }

  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    memory.clearPending();
    longMem.clearPending();
  }

  /* --------------------------------------------------- Save Slots */
  loadSlots(): Array<SaveSlotSnapshot | null> {
    if (typeof localStorage === 'undefined') return [null, null, null];
    let loaded: Array<SaveSlotSnapshot | null> = [];
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      loaded = raw ? (JSON.parse(raw) as Array<SaveSlotSnapshot | null>) : [];
    } catch {
      loaded = [];
    }
    while (loaded.length < 3) loaded.push(null);
    this.slots = loaded.slice(0, 3);
    return this.slots;
  }

  writeSlots(slots: Array<SaveSlotSnapshot | null>): boolean {
    while (slots.length < 3) slots.push(null);
    this.slots = slots.slice(0, 3);
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.slots));
      return true;
    } catch {
      toast.err(tlSlotSaveFail);
      return false;
    }
  }

  createSnapshot(): SaveSlotSnapshot {
    const st = config.get('state');
    const place = world.find(st.stage);
    let dailyRaw: unknown = null;
    if (typeof localStorage !== 'undefined') {
      try {
        dailyRaw = JSON.parse(localStorage.getItem('ryza.daily.v1') || 'null');
      } catch {}
    }

    return {
      at: Date.now(),
      day: Number(st.day) || 1,
      label: place ? `${place.area} / ${place.stage}` : st.stage || tlKurkenIsland,
      settings: JSON.parse(config.exportJSON()),
      history: [...this.history],
      memory: memory.snapshot(),
      longmem: longMem.snapshot(),
      game: game.snapshot(),
      daily: dailyRaw,
      alarms: [...alarm.items],
    };
  }

  applySnapshot(snap: SaveSlotSnapshot): boolean {
    if (!snap || !snap.settings) {
      toast.err(tlSlotLoadFail);
      return false;
    }

    config.importJSON(JSON.stringify(snap.settings));
    this.history = snap.history ? [...snap.history] : [];
    this.saveHistory();

    if (snap.memory) memory.restore(snap.memory);
    if (snap.longmem) longMem.restore(snap.longmem);
    if (snap.game) game.restoreSnapshot(snap.game);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          'ryza.daily.v1',
          JSON.stringify(snap.daily || { lastDate: '', streak: 0, claimedDays: [] })
        );
      } catch {}
    }
    daily.load();
    quests.ensure();

    alarm.items = Array.isArray(snap.alarms) ? (snap.alarms as AlarmItem[]) : [];
    alarm.save();

    const st = config.get('state');
    if (st.skin) avatarService.loadSkin(st.skin);
    if (st.stage) avatarService.loadScene(st.stage, st.tod || 'aft');

    sound.setPlace(st.stage, st.tod, world.backgroundFor(st.stage));
    sound.setRoute('talk');
    return true;
  }

  saveSlot(index: number): boolean {
    if (index < 0 || index >= 3) return false;
    const current = this.loadSlots();
    current[index] = this.createSnapshot();
    if (!this.writeSlots(current)) return false;
    toast.show(tlGameSaved(index + 1));
    return true;
  }

  loadSlot(index: number): boolean {
    if (index < 0 || index >= 3) return false;
    const current = this.loadSlots();
    const snap = current[index];
    if (!snap) return false;
    if (!this.applySnapshot(snap)) return false;
    toast.show(tlGameLoaded(index + 1));
    return true;
  }

  /* --------------------------------------------------- Clock & Day Cycle */
  tickDay(): void {
    const st = config.get('state');
    const today = new Date().toDateString();

    if (st.lastDayDate && st.lastDayDate !== today) {
      config.setState('day', (Number(st.day) || 1) + 1);
    }
    if (st.lastDayDate !== today) {
      config.setState('lastDayDate', today);
    }
    daily.load();
  }

  setTod(tod: string): void {
    if (!world.isTod(tod)) return;
    const s = config.get('state');
    const prev = s.tod;
    if (tod === prev) return;

    config.setState('tod', tod);

    if (prev === 'ngt' && tod === 'mor' && s.stage === HOME_STAGE) {
      game.refill();
      // @wc-ignore
      game.remember('安全なおうちでぐっすり眠った。');
      toast.show(tlRestSafely);
    }

    avatarService.loadScene(s.stage, tod);
    sound.setPlace(s.stage, tod, world.backgroundFor(s.stage));
  }

  tickTime(): void {
    const app = config.get('app');
    const s = config.get('state');
    const mode = app.timeMode || 'real';
    if (mode === 'manual') return;

    const now = Date.now();
    if ((Number(s.todManualUntil) || 0) > now) return;

    let target: string | null = null;
    if (mode === 'real') {
      target = world.hourToTod(new Date().getHours());
    } else {
      const curHour = Number(s.gameHour);
      const startHour = Number.isFinite(curHour) ? curHour : 12;
      const nh = world.flowHour(startHour, s.gameClockAt, now, app.flowSpeed);
      config.setState({
        gameHour: nh,
        gameClockAt: now,
      });
      target = world.hourToTod(nh);
    }

    if (target && target !== s.tod) {
      this.setTod(target);
    }
  }

  dailyNudge(): void {
    daily.load();
    if (daily.available()) {
      setTimeout(() => {
        toast.show(tlDailyBonusAvailable);
      }, 3200);
    }
  }

  init(): void {
    this.loadHistory();
    this.loadSlots();
    this.tickDay();
    this.tickTime();
  }
}

export const session = new SessionStore();
export default session;
