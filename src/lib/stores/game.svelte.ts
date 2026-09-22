// @wc-ignore-file
import { clamp, createEmitter } from '$lib/util';
import { config } from './config.svelte';
import { ITEMS, BAGS, BAG_ORDER, BAG_UPGRADE_COST, APPLE_SLOTS, itemName, type BagSize } from './game-items';

export const GAME_KEY = 'ryza.game.v1';

export interface ItemStack {
  id: string;
  count: number;
}

export interface GameMemoryEntry {
  at: number;
  text: string;
}

export interface ItemDeltaEntry {
  id?: string;
  count?: number;
  n?: number;
  [key: string]: unknown;
}

export interface CharaDeltaEntry {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface GameDelta {
  stamina_set?: number;
  stamina_delta?: number;
  stamina?: number;
  exp_delta?: number;
  exp?: number;
  money_set?: number;
  money_delta?: number;
  money?: number;
  inventory_added?: Array<string | ItemDeltaEntry>;
  inventory_add?: Array<string | ItemDeltaEntry>;
  ryza_inventory_added?: Array<string | ItemDeltaEntry>;
  ryza_inventory_add?: Array<string | ItemDeltaEntry>;
  inventory_removed?: Array<string | ItemDeltaEntry>;
  inventory_remove?: Array<string | ItemDeltaEntry>;
  ryza_inventory_removed?: Array<string | ItemDeltaEntry>;
  ryza_inventory_remove?: Array<string | ItemDeltaEntry>;
  met_chara_add?: Array<string | CharaDeltaEntry>;
  meet_charas?: Array<string | CharaDeltaEntry>;
  memory_add?: string[];
  flags?: Record<string, unknown>;
  quest?: unknown;
  sleep?: boolean;
  current_stage?: string;
  stage?: string;
  tod?: string;
  time_advance?: number;
  [key: string]: unknown;
}

export interface GameState {
  exp_total: number;
  stamina: number;
  money: number;
  bagYou: BagSize;
  bagRyza: BagSize;
  inventory: ItemStack[];
  ryza_inventory: ItemStack[];
  met_charas: string[];
  met_pairs: string[];
  memory: GameMemoryEntry[];
  flags: Record<string, unknown>;
  sailed: boolean;
  quest?: unknown;
  welcome_activity?: Record<string, number>;
}

export const GAME_DEFAULTS: GameState = {
  exp_total: 0,
  stamina: -1,
  money: 30,
  bagYou: 'normal',
  bagRyza: 'normal',
  welcome_activity: {},
  inventory: [
    { id: 'emeralia', count: 3 },
    { id: 'wasser', count: 2 },
  ],
  ryza_inventory: [
    { id: 'emeralia', count: 2 },
    { id: 'uni', count: 1 },
    { id: 'wasser', count: 3 },
    { id: 'honey', count: 1 },
  ],
  met_charas: [],
  met_pairs: [],
  memory: [],
  flags: {},
  sailed: false,
};

function levelForExp(exp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, Number(exp) || 0) / 30));
}

function staminaMaxForExpTotal(exp: number): number {
  return Math.min(140, 50 + levelForExp(exp) * 10);
}

function sanitizeList(list: unknown): ItemStack[] {
  const out: ItemStack[] = [];
  (Array.isArray(list) ? list : []).forEach((it: unknown) => {
    if (!it) return;
    const id =
      typeof it === 'string'
        ? it
        : typeof it === 'object' && 'id' in it
          ? String((it as { id: unknown }).id || '')
          : '';
    if (!id) return;
    const rawCount =
      typeof it === 'object' && it !== null
        ? 'count' in it
          ? (it as { count: unknown }).count
          : 'n' in it
            ? (it as { n: unknown }).n
            : undefined
        : undefined;
    const count = Math.max(1, Math.min(99, parseInt(String(rawCount != null ? rawCount : 1), 10) || 1));
    const seen = out.find((x) => x.id === id);
    if (seen) seen.count = Math.min(99, seen.count + count);
    else out.push({ id, count });
  });
  return out;
}

function countOf(list: ItemStack[], id: string): number {
  let t = 0;
  list.forEach((x) => {
    if (x.id === id) t += x.count;
  });
  return t;
}

type GameEvents = {
  stamina: [];
  money: [];
  inventory: [];
  exp: [number];
  met: [string[]];
  memory: [string];
  flags: [string, unknown];
  delta: [GameDelta | Record<string, unknown>];
  reset: [];
};

export class GameStore {
  readonly KEY = GAME_KEY;
  readonly ITEMS = ITEMS;
  readonly BAGS = BAGS;
  readonly BAG_ORDER = BAG_ORDER;
  readonly BAG_UPGRADE_COST = BAG_UPGRADE_COST;
  readonly APPLE_SLOTS = APPLE_SLOTS;

  exp_total = $state<number>(0);
  stamina = $state<number>(50);
  money = $state<number>(30);
  bagYou = $state<BagSize>('normal');
  bagRyza = $state<BagSize>('normal');
  inventory = $state<ItemStack[]>([]);
  ryza_inventory = $state<ItemStack[]>([]);
  met_charas = $state<string[]>([]);
  met_pairs = $state<string[]>([]);
  memory = $state<GameMemoryEntry[]>([]);
  flags = $state<Record<string, unknown>>({});
  sailed = $state<boolean>(false);
  quest = $state<unknown>(null);
  welcome_activity = $state<Record<string, number>>({});
  _onQuestDelta?: (delta: unknown, origin: string) => void;

  private emitter = createEmitter<GameEvents>();

  constructor() {
    this.load();
  }

  get s(): GameState {
    return {
      exp_total: this.exp_total,
      stamina: this.stamina,
      money: this.money,
      bagYou: this.bagYou,
      bagRyza: this.bagRyza,
      inventory: this.inventory,
      ryza_inventory: this.ryza_inventory,
      met_charas: this.met_charas,
      met_pairs: this.met_pairs,
      memory: this.memory,
      flags: this.flags,
      sailed: this.sailed,
      quest: this.quest,
      welcome_activity: this.welcome_activity,
    };
  }

  load(): GameState {
    let raw: Partial<GameState> | null = null;
    if (typeof localStorage !== 'undefined') {
      try {
        raw = JSON.parse(localStorage.getItem(GAME_KEY) || 'null');
      } catch {}
    }
    const merged = Object.assign(JSON.parse(JSON.stringify(GAME_DEFAULTS)), raw || {});

    this.exp_total =
      typeof merged.exp_total === 'number' && isFinite(merged.exp_total) ? merged.exp_total : 0;
    this.money = typeof merged.money === 'number' && isFinite(merged.money) ? merged.money : 0;
    this.inventory = sanitizeList(merged.inventory);
    this.ryza_inventory = sanitizeList(merged.ryza_inventory);
    this.met_charas = Array.isArray(merged.met_charas) ? merged.met_charas : [];
    this.met_pairs = Array.isArray(merged.met_pairs) ? merged.met_pairs : [];
    this.memory = Array.isArray(merged.memory) ? merged.memory : [];
    this.flags = merged.flags && typeof merged.flags === 'object' ? merged.flags : {};
    this.sailed = Boolean(merged.sailed);
    this.welcome_activity =
      merged.welcome_activity && typeof merged.welcome_activity === 'object'
        ? (merged.welcome_activity as Record<string, number>)
        : {};
    this.bagYou = BAGS[merged.bagYou] ? merged.bagYou : 'normal';
    this.bagRyza = BAGS[merged.bagRyza] ? merged.bagRyza : 'normal';
    this.quest = merged.quest || null;

    if (merged.stamina == null || merged.stamina < 0 || merged.stamina > this.max()) {
      this.stamina = this.max();
    } else {
      this.stamina = merged.stamina;
    }

    return this.s;
  }

  save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(GAME_KEY, JSON.stringify(this.s));
    } catch {}
  }

  on<K extends keyof GameEvents>(event: K, fn: (...args: GameEvents[K]) => void) {
    return this.emitter.on(event, fn);
  }

  emit<K extends keyof GameEvents>(event: K, ...args: GameEvents[K]) {
    this.emitter.emit(event, ...args);
  }

  reset(): void {
    this.exp_total = GAME_DEFAULTS.exp_total;
    this.money = GAME_DEFAULTS.money;
    this.bagYou = GAME_DEFAULTS.bagYou;
    this.bagRyza = GAME_DEFAULTS.bagRyza;
    this.inventory = sanitizeList(GAME_DEFAULTS.inventory);
    this.ryza_inventory = sanitizeList(GAME_DEFAULTS.ryza_inventory);
    this.met_charas = [];
    this.met_pairs = [];
    this.memory = [];
    this.flags = {};
    this.sailed = false;
    this.quest = null;
    this.stamina = this.max();
    this.save();
    this.emit('reset');
  }

  cheat(): boolean {
    return Boolean(config.get('app')?.cheat);
  }

  level(): number {
    return levelForExp(this.exp_total);
  }

  max(): number {
    return staminaMaxForExpTotal(this.exp_total);
  }

  expIntoLevel(): { into: number; span: number } {
    const e = this.exp_total;
    const lower = 30 * Math.pow(this.level() - 1, 2);
    const upper = 30 * Math.pow(this.level(), 2);
    return { into: e - lower, span: Math.max(1, upper - lower) };
  }

  appleSize(): number {
    return Math.ceil(this.max() / APPLE_SLOTS);
  }

  apples(): { filled: number; slots: number; size: number } {
    const size = this.appleSize();
    let filled = Math.ceil(this.stamina / size);
    if (this.cheat()) filled = APPLE_SLOTS;
    return { filled: Math.min(APPLE_SLOTS, filled), slots: APPLE_SLOTS, size };
  }

  turnCost(mode?: string, style?: string): number {
    if (this.cheat()) return 0;
    let c = 1;
    if (mode === 'story' || mode === 'immersive') c = 2;
    if (mode === 'asmr') c = 3;
    if (style !== 'text') c += 1;
    return c;
  }

  canAct(cost?: number): boolean {
    return this.cheat() || this.stamina >= Math.max(0, Number(cost) || 0);
  }

  spend(cost: number, _reason?: string): boolean {
    const c = Math.max(0, Number(cost) || 0);
    if (!c || this.cheat()) return true;
    if (this.stamina < c) return false;
    this.stamina -= c;
    this.save();
    this.emit('stamina');
    return true;
  }

  restore(amount: number): void {
    this.stamina = clamp(this.stamina + (Number(amount) || 0), 0, this.max());
    this.save();
    this.emit('stamina');
  }

  refill(): void {
    this.stamina = this.max();
    this.save();
    this.emit('stamina');
  }

  faint(): boolean {
    return !this.cheat() && this.stamina <= 0;
  }

  addMoney(n: number): void {
    const delta = Number(n) || 0;
    if (this.cheat() && delta < 0) return;
    this.money = Math.max(0, Math.round(this.money + delta));
    this.save();
    this.emit('money');
  }

  canPay(cost: number): boolean {
    const c = Math.max(0, Number(cost) || 0);
    return this.cheat() || this.money >= c;
  }

  addExp(n: number): boolean {
    const before = this.level();
    this.exp_total = Math.max(0, Math.round(this.exp_total + (Number(n) || 0)));
    const after = this.level();
    if (after > before) {
      this.stamina = clamp(this.stamina + 10 * (after - before), 0, this.max());
      this.remember(`Lv${after} reached!`);
    }
    this.save();
    this.emit('exp', this.exp_total);
    return after > before;
  }

  bagList(which: 'you' | 'ryza'): ItemStack[] {
    return which === 'ryza' ? this.ryza_inventory : this.inventory;
  }

  bagCap(which: 'you' | 'ryza'): number {
    return BAGS[which === 'ryza' ? this.bagRyza : this.bagYou] || BAGS.normal;
  }

  bagUsed(which: 'you' | 'ryza'): number {
    return this.bagList(which).length;
  }

  addItem(which: 'you' | 'ryza', id: string, count: number = 1): boolean {
    id = String(id || '').trim();
    if (!id) return false;
    const list = this.bagList(which);
    const slot = list.find((x) => x.id === id);
    if (slot) {
      slot.count = Math.min(99, slot.count + count);
    } else {
      if (list.length >= this.bagCap(which)) {
        if (list.length) list[0].count = Math.min(99, list[0].count + count);
        else return false;
      } else {
        list.push({ id, count });
      }
    }
    this.save();
    this.emit('inventory');
    return true;
  }

  removeItem(which: 'you' | 'ryza', id: string, count: number = 1): boolean {
    const needed = Math.max(1, count);
    const list = this.bagList(which);
    const have = countOf(list, id);
    if (have < needed) return false;

    let left = needed;
    const out: ItemStack[] = [];
    list.forEach((x) => {
      if (x.id === id && left > 0) {
        const take = Math.min(left, x.count);
        left -= take;
        if (x.count - take > 0) out.push({ id: x.id, count: x.count - take });
        return;
      }
      out.push(x);
    });

    if (which === 'ryza') this.ryza_inventory = out;
    else this.inventory = out;

    this.save();
    this.emit('inventory');
    return true;
  }

  countItem(which: 'you' | 'ryza', id: string): number {
    return countOf(this.bagList(which), id);
  }

  upgradeBag(which: 'you' | 'ryza'): boolean {
    const cur = which === 'ryza' ? this.bagRyza : this.bagYou;
    const idx = BAG_ORDER.indexOf(cur);
    if (idx < 0 || idx >= BAG_ORDER.length - 1) return false;
    const next = BAG_ORDER[idx + 1];
    const cost = BAG_UPGRADE_COST[next] || 0;
    if (!this.canPay(cost)) return false;
    this.addMoney(-cost);
    if (which === 'ryza') this.bagRyza = next;
    else this.bagYou = next;
    this.save();
    this.emit('inventory');
    return true;
  }

  meetCharas(npcList?: Array<{ id: string; name?: string }>): string[] {
    const added: string[] = [];
    (npcList || []).forEach((n) => {
      if (!n || !n.id) return;
      if (!this.met_charas.includes(n.id)) {
        this.met_charas.push(n.id);
        added.push(n.name || n.id);
      }
    });

    const list = npcList || [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const pair = [list[i].id, list[j].id].sort().join('|');
        if (!this.met_pairs.includes(pair)) this.met_pairs.push(pair);
      }
    }

    if (added.length) {
      this.save();
      this.emit('met', added);
    }
    return added;
  }

  remember(line?: string | null): void {
    const text = String(line || '').trim();
    if (!text) return;
    this.memory.push({ at: Date.now(), text: text.slice(0, 120) });
    if (this.memory.length > 80) this.memory = this.memory.slice(-80);
    this.save();
    this.emit('memory', text);
  }

  flag<T = unknown>(k: string, defaultValue?: T): T {
    const v = this.flags[k];
    return v === undefined ? (defaultValue as T) : (v as T);
  }

  setFlag(k: string, v: unknown): void {
    this.flags[k] = v;
    this.save();
    this.emit('flags', k, v);
  }

  applyDelta(d?: GameDelta | Record<string, unknown> | null, origin?: string): string[] {
    if (!d || typeof d !== 'object') return [];
    const applied: string[] = [];
    const num = (v: unknown) => {
      const n = Number(v);
      return isFinite(n) ? Math.round(n) : 0;
    };

    if (d.stamina_set != null) {
      this.stamina = clamp(num(d.stamina_set), 0, this.max());
      this.save();
      this.emit('stamina');
      applied.push('stamina=' + this.stamina);
    } else {
      const staminaDelta = d.stamina_delta != null ? d.stamina_delta : d.stamina;
      if (staminaDelta != null) {
        const sd = num(staminaDelta);
        if (sd > 0) {
          this.restore(Math.min(sd, this.max()));
          applied.push('stamina+' + sd);
        } else if (sd < 0 && !this.cheat()) {
          this.stamina = clamp(this.stamina + sd, 0, this.max());
          this.save();
          this.emit('stamina');
          applied.push('stamina' + sd);
        }
      }
    }

    if (d.exp_delta != null || d.exp != null) {
      const ed = clamp(num(d.exp_delta != null ? d.exp_delta : d.exp), -500, 500);
      this.addExp(ed);
      applied.push(`exp${ed >= 0 ? '+' : ''}${ed}`);
    }

    if (d.money_set != null) {
      this.money = Math.max(0, num(d.money_set));
      this.save();
      this.emit('money');
      applied.push('money=' + this.money);
    } else if (d.money_delta != null || d.money != null) {
      const md = clamp(num(d.money_delta != null ? d.money_delta : d.money), -2000, 2000);
      this.addMoney(md);
      applied.push(`money${md >= 0 ? '+' : ''}${md}`);
    }

    const addedPairs: Array<[string[], 'you' | 'ryza']> = [
      [['inventory_added', 'inventory_add'], 'you'],
      [['ryza_inventory_added', 'ryza_inventory_add'], 'ryza'],
    ];
    addedPairs.forEach(([keys, which]) => {
      const foundKey = keys.find((k) => Array.isArray((d as Record<string, unknown>)[k]));
      const items = (foundKey ? (d as Record<string, unknown>)[foundKey] : []) as unknown[];
      items.forEach((it: unknown) => {
        if (!it || (typeof it !== 'string' && typeof it !== 'object')) return;
        const id = typeof it === 'string' ? it : String((it as ItemDeltaEntry).id || '');
        const count =
          typeof it === 'object' ? Number((it as ItemDeltaEntry).count || (it as ItemDeltaEntry).n || 1) : 1;
        if (id && this.addItem(which, id, count)) {
          applied.push(`${keys[0]}:${id}`);
        }
      });
    });

    const removedPairs: Array<[string[], 'you' | 'ryza']> = [
      [['inventory_removed', 'inventory_remove'], 'you'],
      [['ryza_inventory_removed', 'ryza_inventory_remove'], 'ryza'],
    ];
    removedPairs.forEach(([keys, which]) => {
      const foundKey = keys.find((k) => Array.isArray((d as Record<string, unknown>)[k]));
      const items = (foundKey ? (d as Record<string, unknown>)[foundKey] : []) as unknown[];
      items.forEach((it: unknown) => {
        if (!it || (typeof it !== 'string' && typeof it !== 'object')) return;
        const id = typeof it === 'string' ? it : String((it as ItemDeltaEntry).id || '');
        const count =
          typeof it === 'object' ? Number((it as ItemDeltaEntry).count || (it as ItemDeltaEntry).n || 1) : 1;
        if (id && this.removeItem(which, id, count)) {
          applied.push(`${keys[0]}:${id}`);
        }
      });
    });

    const metList = (
      Array.isArray(d.met_chara_add) ? d.met_chara_add : Array.isArray(d.meet_charas) ? d.meet_charas : null
    ) as unknown[] | null;
    if (metList) {
      this.meetCharas(
        metList.map((x: unknown) =>
          typeof x === 'string'
            ? { id: x, name: x }
            : typeof x === 'object' && x !== null && 'id' in x
              ? {
                  id: String((x as { id: unknown }).id),
                  name: String((x as { name?: unknown }).name || (x as { id: unknown }).id),
                }
              : { id: String(x), name: String(x) }
        )
      );
      applied.push('met');
    }

    if (Array.isArray(d.memory_add)) {
      (d.memory_add as unknown[]).forEach((m: unknown) => this.remember(String(m)));
      applied.push('memory');
    }

    if (d.flags && typeof d.flags === 'object') {
      Object.assign(this.flags, d.flags);
      this.save();
      applied.push('flags');
    }

    if (d.quest && typeof this._onQuestDelta === 'function') {
      this._onQuestDelta(d.quest, origin || 'remote');
      applied.push('quest');
    }

    this.emit('delta', d);
    return applied;
  }

  promptBlock(): string {
    const L: string[] = [];
    const invBrief = (list: ItemStack[]) => {
      if (!list.length) return '（空）';
      return list.map((x) => `${itemName(x.id)}×${x.count}`).join('、');
    };

    L.push('## ゲーム状態');
    L.push(`- レベル ${this.level()}（累計経験値 ${this.exp_total}）`);
    L.push(
      `- スタミナ ${this.cheat() ? '∞' : `${this.stamina}/${this.max()}`}：活動や戦闘で減る。ゼロだとあたしは気絶しちゃう。`
    );
    L.push(`- 所持金 ${this.cheat() ? '∞' : `${this.money}G`}（この世界のお金）`);
    L.push(`- あなたのバッグ：${invBrief(this.inventory)}`);
    L.push(`- あたしのバッグ：${invBrief(this.ryza_inventory)}`);
    L.push(`- 出会った人々 ${this.met_charas.length} 人`);
    if (this.memory.length) {
      L.push(
        `- 記憶（抜粋）：${this.memory
          .slice(-6)
          .map((m) => m.text)
          .join(' / ')}`
      );
    }
    return L.join('\n');
  }

  snapshot(): GameState {
    return JSON.parse(JSON.stringify(this.s));
  }

  restoreSnapshot(snap?: Partial<GameState> | null): void {
    if (!snap) return;
    const merged = Object.assign(JSON.parse(JSON.stringify(GAME_DEFAULTS)), snap);
    this.exp_total = merged.exp_total;
    this.stamina = merged.stamina;
    this.money = merged.money;
    this.bagYou = merged.bagYou;
    this.bagRyza = merged.bagRyza;
    this.inventory = sanitizeList(merged.inventory);
    this.ryza_inventory = sanitizeList(merged.ryza_inventory);
    this.met_charas = merged.met_charas || [];
    this.met_pairs = merged.met_pairs || [];
    this.memory = merged.memory || [];
    this.flags = merged.flags || {};
    this.sailed = Boolean(merged.sailed);
    this.quest = merged.quest || null;
    this.save();
    this.emit('reset');
  }
}

export const game = new GameStore();
export const Game = game;
export default game;
