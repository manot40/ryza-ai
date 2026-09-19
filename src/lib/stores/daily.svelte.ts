// @wc-ignore-file
import { clamp, createEmitter } from '$lib/util';
import { game } from './game.svelte';
import { itemName } from './game-items';

export const DAILY_KEY = 'ryza.daily.v1';
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export interface DailyReward {
  day: number;
  kind: 'stamina' | 'money' | 'item' | 'exp' | 'big' | 'chest';
  amount?: number | 'full';
  money?: number;
  exp?: number;
  id?: string;
  item?: string;
  n?: number;
  text: string;
}

export const REWARDS: ReadonlyArray<DailyReward> = [
  { day: 1, kind: 'stamina', amount: 'full', text: 'スタミナ全回復' },
  { day: 2, kind: 'money', amount: 120, text: '120G' },
  { day: 3, kind: 'item', id: 'wasser', n: 3, text: '蒸留水×3' },
  { day: 4, kind: 'exp', amount: 60, text: 'EXP+60' },
  { day: 5, kind: 'big', money: 300, exp: 100, text: '300G + EXP+100 + 全回復' },
  { day: 6, kind: 'item', id: 'apple', n: 1, text: 'スタミナリンゴ×1' },
  { day: 7, kind: 'chest', money: 500, item: 'relic', text: '宝箱：500G + 古代の遺物' },
];

export interface DailyState {
  lastDate: string;
  streak: number;
  claimedDays: number[];
}

export function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

export function isoWeekIndex(d: Date = new Date()): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // 0 = Mon, 6 = Sun
}

export interface ClaimResult {
  ok: boolean;
  day?: number;
  text?: string;
  reason?: string;
}

type DailyEvents = {
  claim: [ClaimResult];
};

export class DailyStore {
  s = $state<DailyState>({
    lastDate: '',
    streak: 0,
    claimedDays: [],
  });

  private emitter = createEmitter<DailyEvents>();

  constructor() {
    this.load();
  }

  load(): DailyState {
    let raw: unknown = null;
    if (typeof localStorage !== 'undefined') {
      try {
        raw = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
      } catch {}
    }
    const parsed = raw && typeof raw === 'object' ? (raw as Partial<DailyState>) : {};
    const merged: DailyState = Object.assign({ lastDate: '', streak: 0, claimedDays: [] }, parsed);

    // streak breaks if the gap is more than one day
    if (merged.lastDate && merged.lastDate !== todayStr() && merged.lastDate !== yesterdayStr()) {
      merged.streak = 0;
      merged.claimedDays = [];
    }

    this.s.lastDate = merged.lastDate;
    this.s.streak = merged.streak;
    this.s.claimedDays = Array.isArray(merged.claimedDays) ? merged.claimedDays : [];
    return this.s;
  }

  save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify(this.s));
    } catch {}
  }

  on<K extends keyof DailyEvents>(event: K, fn: (...args: DailyEvents[K]) => void) {
    return this.emitter.on(event, fn);
  }

  emit<K extends keyof DailyEvents>(event: K, ...args: DailyEvents[K]) {
    this.emitter.emit(event, ...args);
  }

  available(): boolean {
    return this.s.lastDate !== todayStr();
  }

  streak(): number {
    return this.s.streak | 0;
  }

  weekDayIdx(): number {
    return isoWeekIndex();
  }

  rewardFor(idx: number): DailyReward {
    return REWARDS[clamp(idx, 0, 6)];
  }

  claim(idxOverride?: number): ClaimResult {
    this.load();
    if (!this.available()) {
      return { ok: false, reason: 'done' };
    }

    const idx = idxOverride != null ? clamp(Math.floor(idxOverride), 0, 6) : clamp(this.streak(), 0, 6);

    const r = this.rewardFor(idx);
    const msgs: string[] = [];

    switch (r.kind) {
      case 'stamina':
        game.refill();
        msgs.push(r.text);
        break;
      case 'money':
        game.addMoney(r.amount as number);
        msgs.push(r.text);
        break;
      case 'exp':
        game.addExp(r.amount as number);
        msgs.push(r.text);
        break;
      case 'item':
        game.addItem('you', r.id!, r.n || 1);
        const inm = itemName(r.id!) || r.id;
        msgs.push(`${inm}×${r.n || 1}`);
        break;
      case 'big':
        game.addMoney(r.money!);
        game.addExp(r.exp!);
        game.refill();
        msgs.push(r.text);
        break;
      case 'chest':
        game.addMoney(r.money!);
        game.addItem('you', r.item!, 1);
        msgs.push(r.text);
        break;
    }

    this.s.streak = this.available() ? this.streak() + 1 : this.streak();
    this.s.lastDate = todayStr();
    if (!this.s.claimedDays.includes(idx)) {
      this.s.claimedDays.push(idx);
    }
    this.save();

    game.remember(`連続ログイン ${this.streak()} 日目：${msgs.join('、')}`);

    const res: ClaimResult = {
      ok: true,
      day: idx + 1,
      text: msgs.join('、'),
    };
    this.emit('claim', res);
    return res;
  }

  reset(): void {
    this.s.lastDate = '';
    this.s.streak = 0;
    this.s.claimedDays = [];
    this.save();
  }
}

export const daily = new DailyStore();
export const Daily = daily;
export default daily;
