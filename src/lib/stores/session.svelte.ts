import { config } from './config.svelte';
import { game } from './game.svelte';
import { memory } from './memory.svelte';
import { daily } from './daily.svelte';
import { alarm, type AlarmItem } from './alarm.svelte';
import { quests } from './quests.svelte';
import { world } from './world.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { sound } from '$lib/audio/sound';
import { toast } from './toast.svelte';

export const MEM_KEY = 'ryza.memory.v1';
export const SAVE_KEY = 'ryza.saves.v1';
export const HOME_STAGE = 'stage_01_001_04';

const tlDailyBonusAvailable = 'Daily login bonus is available!';
const tlGameSaved = (index: number) => `Game saved to slot ${index + 1}`;
const tlGameLoaded = (index: number) => `Game loaded from slot ${index + 1}`;
const tlKurkenIsland = 'Kurken Island';
const tlRestSafely = 'Rested safely at home — stamina fully restored!';

export interface DiaryEntry {
  who: 'user' | 'ryza';
  text: string;
  at: number;
}

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  at?: number;
}

export interface SaveSlotSnapshot {
  at: number;
  day: number;
  label: string;
  settings: Record<string, unknown>;
  history: HistoryEntry[];
  memory: DiaryEntry[];
  longmem: unknown;
  game: unknown;
  daily: unknown;
  alarms: unknown[];
}

export class SessionStore {
  history = $state<HistoryEntry[]>([]);
  diary = $state<DiaryEntry[]>([]);
  slots = $state<Array<SaveSlotSnapshot | null>>([null, null, null]);

  dailyAvailable = $derived(daily.available());

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.loadDiary();
      this.loadSlots();
    }
  }

  /* --------------------------------------------------- Diary Persistence */
  loadDiary(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(MEM_KEY);
      this.diary = raw ? (JSON.parse(raw) as DiaryEntry[]) : [];
    } catch {
      this.diary = [];
    }
  }

  saveDiary(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(MEM_KEY, JSON.stringify(this.diary));
    } catch {}
  }

  remember(who: 'user' | 'ryza', text: string): void {
    this.diary = [...this.diary, { who, text, at: Date.now() }];
    if (this.diary.length > 400) {
      this.diary = this.diary.slice(-400);
    }
    this.saveDiary();
  }

  clearDiary(): void {
    this.diary = [];
    this.saveDiary();
  }

  /* --------------------------------------------------- Turn History */
  pushHistory(entry: HistoryEntry): void {
    this.history = [...this.history, entry];
  }

  clearHistory(): void {
    this.history = [];
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

  writeSlots(slots: Array<SaveSlotSnapshot | null>): void {
    while (slots.length < 3) slots.push(null);
    this.slots = slots.slice(0, 3);
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.slots));
    } catch {}
  }

  createSnapshot(): SaveSlotSnapshot {
    const st = config.section('state') || {};
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
      memory: [...this.diary],
      longmem: memory.snapshot(),
      game: game.snapshot(),
      daily: dailyRaw,
      alarms: [...alarm.items],
    };
  }

  applySnapshot(snap: SaveSlotSnapshot): void {
    if (!snap || !snap.settings) return;

    config.importJSON(JSON.stringify(snap.settings));
    this.history = snap.history ? [...snap.history] : [];
    this.diary = snap.memory ? [...snap.memory] : [];
    this.saveDiary();

    if (snap.longmem) memory.restore(snap.longmem);
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

    const st = config.section('state') || {};
    if (st.skin) avatarService.loadSkin(st.skin);
    if (st.stage) avatarService.loadScene(st.stage, st.tod || 'aft');

    sound.setPlace(st.stage, st.tod, world.backgroundFor(st.stage));
    sound.setRoute('talk');
  }

  saveSlot(index: number): boolean {
    if (index < 0 || index >= 3) return false;
    const current = this.loadSlots();
    current[index] = this.createSnapshot();
    this.writeSlots(current);
    toast.show(tlGameSaved(index + 1));
    return true;
  }

  loadSlot(index: number): boolean {
    if (index < 0 || index >= 3) return false;
    const current = this.loadSlots();
    const snap = current[index];
    if (!snap) return false;
    this.applySnapshot(snap);
    toast.show(tlGameLoaded(index + 1));
    return true;
  }

  /* --------------------------------------------------- Clock & Day Cycle */
  tickDay(): void {
    const st = config.section('state') || {};
    const today = new Date().toDateString();

    if (st.lastDayDate && st.lastDayDate !== today) {
      config.set('state.day', (Number(st.day) || 1) + 1);
    }
    if (st.lastDayDate !== today) {
      config.set('state.lastDayDate', today);
    }
    daily.load();
  }

  setTod(tod: string): void {
    if (!world.isTod(tod)) return;
    const s = config.section('state') || {};
    const prev = s.tod;
    if (tod === prev) return;

    config.set('state.tod', tod);

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
    const app = config.section('app') || {};
    const s = config.section('state') || {};
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
      config.set('state.gameHour', nh);
      config.set('state.gameClockAt', now);
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
    this.loadDiary();
    this.loadSlots();
    this.tickDay();
    this.tickTime();
  }
}

export const session = new SessionStore();
export default session;
