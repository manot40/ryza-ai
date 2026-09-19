// @wc-ignore-file
import { clamp, createEmitter } from '$lib/util';
import { config } from './config.svelte';
import { game } from './game.svelte';
import { ITEMS, itemName, itemValue } from './game-items';
import { Api } from '$lib/api';

export interface QuestReward {
  exp: number;
  money: number;
}

export interface Quest {
  no: number;
  type: string;
  title: string;
  desc: string;
  goal: string;
  need: number;
  cost: number;
  step: number;
  complete: boolean;
  side: boolean;
  obstacle: string;
  reward: QuestReward;
  k?: string;
  activity?: string;
}

export interface QuestActionResult {
  ok: boolean;
  done?: boolean;
  line: string;
  refund?: boolean;
  spent?: boolean;
  faint?: boolean;
  sail?: boolean;
  quest?: Quest | null;
}

export interface QuestActionContext {
  [key: string]: unknown;
}

export interface QuestDelta {
  step_add?: number | string;
  advance?: number | string;
  progress?: number | string;
  desc?: string;
  goal?: string;
  obstacle?: string;
  activity?: string;
  complete?: boolean;
  clear?: boolean;
  [key: string]: unknown;
}

export const CHAIN: ReadonlyArray<Omit<Quest, 'step' | 'complete' | 'side' | 'obstacle' | 'reward'>> = [
  {
    no: 1,
    type: 'talk',
    title: 'まずは会話をしてみよう',
    desc: 'ライザと会話して、お互いのことにもっと慣れる。',
    goal: 'ライザと4回話す',
    need: 4,
    cost: 1,
  },
  {
    no: 2,
    type: 'explore',
    title: '島のあちこちを冒険',
    desc: 'ワールドマップを開いて、別の場所へ移動する。',
    goal: '別のステージへ2回移動',
    need: 2,
    cost: 2,
  },
  {
    no: 3,
    type: 'gather',
    title: '素材集めの冒険',
    desc: '冒険の材料集め。バッグに素材を詰めてこよう。',
    goal: '素材を3つ集める',
    need: 3,
    cost: 3,
  },
  {
    no: 4,
    type: 'craft',
    title: 'はじめての調合',
    desc: '集めた素材で、あたしと一緒に調合に挑戦！',
    goal: '調合を1回成功させる',
    need: 1,
    cost: 3,
  },
  {
    no: 5,
    type: 'battle',
    title: '進路を阻む魔物',
    desc: '冒険の途中で魔物が出た。調合アイテムも使って突破しよう。',
    goal: '戦闘に1回勝つ',
    need: 1,
    cost: 4,
  },
  {
    no: 6,
    type: 'shop',
    title: 'お店を一日経営してみよう',
    desc: 'いらないアイテムを並べて、お小遣い稼ぎ。',
    goal: 'お店でアイテムを売る',
    need: 1,
    cost: 4,
  },
  {
    no: 7,
    type: 'build',
    title: '船の材料を集めて造船',
    desc: '「まずは船を手に入れて」。船には部品が4つ必要らしい。',
    goal: '船の部品を4つそろえる',
    need: 4,
    cost: 5,
  },
  {
    no: 8,
    type: 'sail',
    title: '船で自由に旅へ出よう',
    desc: '造船を完成させて、クーケン島の外へ！世界地図が解放される。',
    goal: '資金200Gで出航する',
    need: 1,
    cost: 2,
  },
];

export const TYPE_ICON: Record<string, string> = {
  talk: 'chara',
  explore: 'world_map',
  gather: 'bag',
  craft: 'cauldron',
  battle: 'fire',
  shop: 'shop',
  build: 'asterisk',
  sail: 'quest_map_ai',
};

export const PRAISES = [
  'すごい、クリアおめでとう！',
  '次のクエストもがんばろう',
  'すごい！次はどんな冒険にする？',
];

export const POOL = [
  {
    type: 'craft',
    title: '新しいレシピ',
    desc: 'まだ作ったことのない調合を、ライザと考える。',
    goal: '調合を1回成功させる',
    need: 1,
    cost: 3,
  },
  {
    type: 'gather',
    title: '水源の材料',
    desc: '水源の絶壁まわりで、新しい材料を探す。',
    goal: '素材を2つ集める',
    need: 2,
    cost: 3,
  },
  {
    type: 'explore',
    title: '星を見に行こう',
    desc: '夜のカーク群島、星見の高台まで一緒に歩く。',
    goal: '夜のステージへ移動',
    need: 1,
    cost: 2,
  },
  {
    type: 'battle',
    title: '廃村の住人',
    desc: '忘れ去られた廃村で、邪魔するやつを退治する。',
    goal: '戦闘に1回勝つ',
    need: 1,
    cost: 4,
  },
  {
    type: 'shop',
    title: '移動販売の一日',
    desc: '港の広場でちょっと商売してみない？',
    goal: 'お店でアイテムを売る',
    need: 1,
    cost: 4,
  },
  {
    type: 'talk',
    title: '思い出話',
    desc: 'ふたりが初めて会った日のことを、ゆっくり思い出す。',
    goal: 'ライザと3回話す',
    need: 3,
    cost: 1,
  },
  {
    type: 'gather',
    title: 'おやつ探し',
    desc: '甘いものの材料を集めて、あたしのおやつを作る。',
    goal: '素材を2つ集める',
    need: 2,
    cost: 2,
  },
  {
    type: 'explore',
    title: '遺跡の探索',
    desc: '封印の祭殿の奥まで、一緒に見て回ろう。',
    goal: '別のステージへ移動',
    need: 1,
    cost: 3,
  },
];

export const AREA_LOOT: Record<string, string[]> = {
  area_01: ['emeralia', 'uni', 'wasser', 'honey', 'shell', 'mushroom', 'driftwood'],
  area_02: ['ore', 'wasser', 'shell', 'ironwood', 'emeralia'],
  area_03: ['honey', 'mushroom', 'ironwood', 'emeralia', 'cloth'],
  area_04: ['ore', 'cloth', 'charm', 'mushroom'],
  area_05: ['relic', 'cloth', 'ore', 'ironwood'],
};

export const RECIPES: Array<{ out: string; name: string; in: Array<[string, number]> }> = [
  {
    out: 'bottle',
    name: '回復のボトル',
    in: [
      ['emeralia', 1],
      ['wasser', 1],
    ],
  },
  {
    out: 'bomb',
    name: '爆弾瓶',
    in: [
      ['uni', 1],
      ['wasser', 1],
      ['ore', 1],
    ],
  },
  {
    out: 'charm',
    name: 'お守りの指輪',
    in: [
      ['relic', 1],
      ['cloth', 1],
    ],
  },
];

export const PART_ITEMS = ['driftwood', 'ironwood', 'cloth', 'ore'] as const;
export const PART_NAMES: Record<string, string> = {
  driftwood: '船底の竜骨材',
  ironwood: 'マストの堅木',
  cloth: '大きな帆布',
  ore: '魔石入りの留め金',
};

export const MONSTERS = [
  { i: 1, name: 'モコモコ', area: 1 },
  { i: 2, name: 'ビッグツノ', area: 1 },
  { i: 3, name: '溶岩カニ', area: 2 },
  { i: 4, name: '森の番人', area: 3 },
  { i: 5, name: '遺跡の守卫像', area: 4 },
  { i: 6, name: '星霜の竜', area: 5 },
];

function ctx_area(): string {
  const st = config.section('state') || {};
  const m = /^stage_(\d\d)_/.exec(st.stage || 'stage_01_001_04');
  return m ? 'area_' + m[1] : 'area_01';
}

type QuestEvents = {
  quest: [Quest | null];
  clear: [Quest];
};

export class QuestStore {
  readonly CHAIN = CHAIN;
  readonly PRAISES = PRAISES;
  readonly POOL = POOL;
  readonly AREA_LOOT = AREA_LOOT;
  readonly RECIPES = RECIPES;
  readonly PART_ITEMS = PART_ITEMS;
  readonly PART_NAMES = PART_NAMES;
  readonly MONSTERS = MONSTERS;

  private _pendingAdvance = false;
  private emitter = createEmitter<QuestEvents>();

  private actionHandlers: Record<string, (q: Quest, ctx: QuestActionContext) => QuestActionResult> = {
    talk: (q, ctx) => this.act_talk(q, ctx),
    explore: (q, ctx) => this.act_explore(q, ctx),
    gather: (q, ctx) => this.act_gather(q, ctx),
    craft: (q, ctx) => this.act_craft(q, ctx),
    battle: (q, ctx) => this.act_battle(q, ctx),
    shop: (q, ctx) => this.act_shop(q, ctx),
    build: (q, ctx) => this.act_build(q, ctx),
    sail: (q, ctx) => this.act_sail(q, ctx),
  };

  constructor() {
    game._onQuestDelta = (d: unknown, origin: string) => this.onQuestDelta(d as QuestDelta, origin);
  }

  on<K extends keyof QuestEvents>(event: K, fn: (...args: QuestEvents[K]) => void) {
    return this.emitter.on(event, fn);
  }

  emit<K extends keyof QuestEvents>(event: K, ...args: QuestEvents[K]) {
    this.emitter.emit(event, ...args);
  }

  active(): Quest | null {
    return (game.quest as Quest | null) || null;
  }

  ensure(): Quest {
    if (!game.quest) {
      this.startNo(Number(game.flag('quest_no', 0) || 0) + 1 || 1);
    }
    return game.quest as Quest;
  }

  isSide(q?: Quest | null): boolean {
    const target = q || this.active();
    return Boolean(target && target.no > 8);
  }

  startNo(no: number): Quest {
    const def = CHAIN[no - 1];
    let q: Quest;
    if (def) {
      q = {
        ...JSON.parse(JSON.stringify(def)),
        k: 'q.' + no,
        step: 0,
        complete: false,
        side: false,
        obstacle: this._obstacle(def.type),
        reward: { exp: 30 + Math.min(no, 8) * 15, money: 20 + Math.min(no, 8) * 20 },
      };
    } else {
      const pick = POOL[Math.floor(Math.random() * POOL.length)];
      q = {
        ...JSON.parse(JSON.stringify(pick)),
        k: 'pq.' + (1 + Math.floor(Math.random() * POOL.length)),
        no: 100 + (game.flag('side_done', 0) || 0),
        step: 0,
        complete: false,
        side: true,
        obstacle: this._obstacle(pick.type),
        reward: { exp: 30 + 8 * 15, money: 20 + 8 * 20 },
      };
    }
    game.setFlag('quest_no', no);
    game.quest = q;
    game.save();
    this.emit('quest', q);
    return q;
  }

  private _obstacle(type: string): string {
    const byType: Record<string, string> = {
      gather: 'いい素材は少し奥まで入らないと採れないみたい。',
      craft: '調合は失敗しやすいから、材料は余裕をもって集めとこ。',
      battle: 'あ、強いのが出たら逃げてもいいからね…たぶん。',
      shop: '売れるか微妙だけど、やってみないと分からない！',
      build: '部品はどれも大きくて、一回じゃ運べそうにない。',
      explore: '最近道の様子がちょっと変なんだよね。',
      talk: '',
      sail: '出航には資金も必要。お店で稼いでおこう。',
    };
    return byType[type] || '';
  }

  keyOf(q?: Quest | null): string {
    if (!q) return '';
    if (q.k) return q.k;
    return q.side ? '' : 'q.' + q.no;
  }

  titleOf(q?: Quest | null): string {
    return q?.title || '';
  }

  descOf(q?: Quest | null): string {
    return q?.desc || '';
  }

  goalOf(q?: Quest | null): string {
    return q?.goal || '';
  }

  async generate(useLLM: boolean): Promise<Quest> {
    const llm = config.section('llm');
    if (!useLLM || !llm?.apiKey) {
      return this.startNo(9);
    }

    try {
      const r = await Api.chat(
        [],
        [
          'ライザと遊ぶRPGクエストを1つ生成して。',
          '次のJSONだけ出力（説明不要）:',
          '{"type":"talk|explore|gather|craft|battle|shop","title":"...","desc":"...","goal":"...","need":2,"cost":3}',
          'type は talk/explore/gather/craft/battle/shop のいずれか1つ。',
          'need は2〜5、cost は1〜5。',
          'title/desc/goal は 日本語で書くこと。',
        ].join('\n'),
        { mode: 'chat', style: 'text' }
      );
      const m = /\{[\s\S]*\}/.exec(r.text || '');
      if (!m) throw new Error('bad quest json');
      const j = JSON.parse(m[0]);
      const qq = this.startNo(9);
      qq.type = j.type && TYPE_ICON[j.type] ? j.type : 'talk';
      qq.title = String(j.title || qq.title).slice(0, 40);
      qq.desc = String(j.desc || '').slice(0, 120);
      qq.goal = String(j.goal || qq.goal).slice(0, 60);
      qq.need = clamp(parseInt(j.need, 10) || 2, 1, 8);
      qq.cost = clamp(parseInt(j.cost, 10) || 3, 1, 6);
      qq.obstacle = this._obstacle(qq.type);
      game.quest = qq;
      game.save();
      this.emit('quest', qq);
      return qq;
    } catch {
      return this.startNo(9);
    }
  }

  progressEvent(what: string, amount: number = 1): Quest | null {
    const q = this.active() || this.ensure();
    if (!q || q.complete) return null;
    const hit = (what === 'talk' && q.type === 'talk') || (what === 'explore' && q.type === 'explore');
    if (!hit) return null;
    q.step = Math.min(q.need, (q.step | 0) + amount);
    if (q.step >= q.need) return this.clear();
    game.quest = q;
    game.save();
    this.emit('quest', q);
    return q;
  }

  advance(what: string, amount: number = 1): Quest | null {
    return this.progressEvent(what, amount);
  }

  takeChain(no: number): Quest {
    return this.startNo(no);
  }

  onQuestDelta(d: QuestDelta | null | undefined, _origin?: string): Quest | null {
    if (!d || typeof d !== 'object') return null;
    let q = this.active();
    if (!q) {
      this.ensure();
      q = this.active();
    }
    if (!q) return null;

    let touched = false;
    const stepAdd = d.step_add != null ? d.step_add : d.advance;
    if (stepAdd != null) {
      q.step = clamp((q.step | 0) + (parseInt(String(stepAdd), 10) || 0), 0, q.need);
      touched = true;
    }
    if (d.progress != null && stepAdd == null) {
      q.step = clamp(parseInt(String(d.progress), 10) || 0, 0, q.need);
      touched = true;
    }
    const textKeys: Array<'desc' | 'goal' | 'obstacle' | 'activity'> = [
      'desc',
      'goal',
      'obstacle',
      'activity',
    ];
    textKeys.forEach((k) => {
      const val = d[k];
      if (typeof val === 'string' && val) {
        q[k] = val.slice(0, 160);
        touched = true;
      }
    });

    if (touched) {
      game.quest = q;
      game.save();
      this.emit('quest', q);
    }
    if (d.complete === true || d.clear === true || q.step >= q.need) {
      if (!q.complete) this.clear();
    }
    return q;
  }

  clear(): Quest | null {
    const q = this.active();
    if (!q || q.complete) return q;
    q.complete = true;
    const reward = q.reward || { exp: 30, money: 20 };
    game.addExp(reward.exp);
    game.addMoney(reward.money);
    game.remember(`「${q.title}」をクリア！ +${reward.exp}EXP / +${reward.money}G`);

    const log =
      (game.flags.quest_log as Array<{ no: number; type: string; title: string; at: number }>) || [];
    log.push({ no: q.no, type: q.type, title: q.title, at: Date.now() });
    if (log.length > 40) log.splice(0, log.length - 40);
    game.flags.quest_log = log;

    if (q.no > 8) game.setFlag('side_done', Number(game.flag('side_done', 0) || 0) + 1);
    if (q.no === 8) game.sailed = true;

    game.quest = q;
    game.save();
    this._pendingAdvance = true;
    this.emit('clear', q);
    this.emit('quest', q);
    return q;
  }

  takeNext(): Quest {
    if (!this._pendingAdvance) {
      this.ensure();
      return this.active()!;
    }
    this._pendingAdvance = false;
    const prev = this.active();
    const no = prev ? prev.no + 1 : 1;
    return this.startNo(no > 8 ? 9 : no);
  }

  pendingAdvance(): boolean {
    return this._pendingAdvance;
  }

  doAction(actType?: string, ctx: QuestActionContext = {}): QuestActionResult {
    const q = this.active();
    if (!q || q.complete) {
      return { ok: false, line: '今はクエストなし。新しいお題を考えてもらおう。' };
    }
    if (!game.canAct(q.cost)) {
      return {
        ok: false,
        faint: true,
        line: '……お腹すいた。気絶しちゃう前に、安全なところで寝たいな…',
      };
    }

    const match = actType || q.type;
    if (match !== q.type) {
      return { ok: false, line: '今のクエストと違うことをしたかったの？' };
    }
    if (!game.spend(q.cost, 'quest')) {
      return { ok: false, faint: true, line: 'スタミナが足りないよ…' };
    }

    const fn = this.actionHandlers[q.type];
    const res = fn ? fn(q, ctx) : { ok: false, line: 'まだできないことみたい。' };
    if (res && res.ok) {
      game.quest = q;
      game.save();
      if (q.step >= q.need && !q.complete) this.clear();
      this.emit('quest', q);
    }
    return res;
  }

  act_talk(_q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    return { ok: false, line: 'これは会話で進むクエストだよ。あたしに話しかけて？' };
  }

  act_explore(_q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    return { ok: false, line: 'ワールドマップから移動するたびに進行するよ。' };
  }

  act_gather(q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    const area = ctx_area();
    const table = AREA_LOOT[area] || AREA_LOOT.area_01;
    const got: string[] = [];
    const n = 1 + (Math.random() < 0.45 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const id = table[Math.floor(Math.random() * table.length)];
      if (game.addItem('you', id, 1)) got.push(itemName(id));
    }
    if (!got.length) {
      return {
        ok: false,
        line: 'バッグがパンパン…いらないものを売らないと入らないよ。',
      };
    }
    q.step = Math.min(q.need, (q.step | 0) + got.length);
    game.addExp(6);
    const done = q.step >= q.need;
    const tail = done ? 'これで十分！' : `あと ${q.need - q.step} 個！`;
    return {
      ok: true,
      done,
      line: `わあい、${got.join('、')} が採れた！ ${tail}`,
    };
  }

  act_craft(q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    let made: (typeof RECIPES)[number] | null = null;
    let fail: (typeof RECIPES)[number] | null = null;
    for (let i = 0; i < RECIPES.length; i++) {
      const r = RECIPES[i];
      const haveAll = r.in.every(([id, count]) => game.countItem('you', id) >= count);
      if (haveAll) {
        made = r;
        break;
      }
      if (!fail) fail = r;
    }
    if (!made) {
      const need = fail
        ? fail.in.map(([id, count]) => `${itemName(id)}×${count}`).join('、')
        : itemName('emeralia');
      return {
        ok: false,
        refund: true,
        line: `うーん、${need} が足りないみたい。集めてこよっ。`,
      };
    }
    made.in.forEach(([id, count]) => game.removeItem('you', id, count));
    game.addItem('you', made.out, 1);
    q.step = Math.min(q.need, (q.step | 0) + 1);
    game.addExp(14);
    return {
      ok: true,
      done: q.step >= q.need,
      line: `せーの… できた！ ${itemName(made.out)}！ あたしの調合、上達してない？`,
    };
  }

  act_battle(q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    const areaMatch = /area_(\d+)/.exec(ctx_area());
    const area = Number(areaMatch ? areaMatch[1] : 1) || 1;
    const mobs = MONSTERS.filter((m) => m.area === area);
    const mi = Math.floor(Math.random() * (mobs.length || MONSTERS.length));
    const mob = (mobs.length ? mobs : MONSTERS)[mi];
    const mobName = mob.name;
    let odds = 0.3 + 0.06 * game.level();
    const tools: string[] = [];

    ['bomb', 'charm', 'bottle'].forEach((t) => {
      const n = game.countItem('you', t);
      if (t === 'bomb' && n > 0) {
        odds += 0.18;
        tools.push(itemName('bomb'));
        game.removeItem('you', t, 1);
      } else if (t === 'charm' && n > 0) {
        odds += 0.12;
      } else if (t === 'bottle' && n > 0 && game.stamina < game.max() / 2) {
        game.removeItem('you', t, 1);
        game.restore(ITEMS.bottle.stamina || 25);
        tools.push(itemName('bottle'));
      }
    });

    const win = Math.random() < clamp(odds, 0.1, 0.92);
    if (win) {
      const money = 20 + Math.floor(Math.random() * 40) + area * 10;
      game.addMoney(money);
      game.addExp(18 + area * 8);
      q.step = Math.min(q.need, (q.step | 0) + 1);
      return {
        ok: true,
        done: q.step >= q.need,
        line: `やった、${mobName} 倒した！ ${money}G 落としてったよ。${tools.length ? '（' + tools.join('・') + '）' : ''}`,
      };
    }
    game.addExp(5);
    return {
      ok: false,
      spent: true,
      done: false,
      line: `うぅ…${mobName}、強すぎだよ。また挑戦しよ。`,
    };
  }

  act_shop(q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    const list = game.inventory.slice().sort((a, b) => itemValue(a.id) - itemValue(b.id));
    const sold: string[] = [];
    let take = 0;
    for (let i = 0; i < list.length && sold.length < 3; i++) {
      const it = list[i];
      if (ITEMS[it.id]?.kind !== 'mat') continue;
      const n = Math.min(it.count, 2);
      if (!game.removeItem('you', it.id, n)) continue;
      take += n * Math.round(itemValue(it.id) * (1 + Math.random() * 0.6));
      sold.push(`${itemName(it.id)}×${n}`);
    }
    if (!sold.length) {
      return {
        ok: false,
        refund: true,
        line: '売れる在庫がないや…素材を集めてこよ？',
      };
    }
    game.addMoney(take);
    game.addExp(16);
    q.step = Math.min(q.need, (q.step | 0) + 1);
    return {
      ok: true,
      done: q.step >= q.need,
      line: `開店！ ${sold.join('、')} が売れて +${take}G。あたしたち、才能あるかも！`,
    };
  }

  act_build(q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    const partsDone = Number(game.flag('ship_parts', 0) || 0);
    if (partsDone >= 4) {
      return {
        ok: false,
        line: '部品はもうそろってる！ 次は「船で自由に旅へ出よう」だね。',
      };
    }
    const want = PART_ITEMS[partsDone];
    const have = game.countItem('you', want) + game.countItem('ryza', want);
    if (have <= 0) {
      return {
        ok: false,
        refund: true,
        line: `造船には ${PART_NAMES[want]}（${itemName(want)}）が必要みたい。探してこよ！`,
      };
    }
    if (!game.removeItem('you', want, 1)) game.removeItem('ryza', want, 1);
    game.setFlag('ship_parts', partsDone + 1);
    game.addExp(12);
    q.step = Math.min(q.need, partsDone + 1);
    return {
      ok: true,
      done: q.step >= q.need,
      line: `「${PART_NAMES[want]}」装着！ 船が形になってきた。あと ${4 - q.step} つ！`,
    };
  }

  act_sail(q: Quest, _ctx?: QuestActionContext): QuestActionResult {
    if (Number(game.flag('ship_parts', 0) || 0) < 4) {
      return { ok: false, refund: true, line: 'まだ部品が足りない！ 造船クエストに戻ろう。' };
    }
    if (!game.canPay(200)) {
      return {
        ok: false,
        refund: true,
        line: '出航に 200G 必要らしい。お店を開いて稼ごう！',
      };
    }
    game.addMoney(-200);
    q.step = q.need;
    const cleared = this.clear();
    return {
      ok: true,
      done: true,
      sail: true,
      quest: cleared,
      line: '出発の時間だ——！ クーケン島を離れて、自由な旅へ。世界の扉、開いたよ！',
    };
  }

  refundAction(res?: QuestActionResult | null): void {
    if (res && !res.ok && !res.spent && !res.faint) {
      const q = this.active();
      if (q) game.restore(q.cost);
    }
  }

  promptBlock(): string {
    const q = this.ensure();
    const L: string[] = [];
    L.push('## クエスト（進行度あたしと共有。達成したら <state> で教えて）');
    L.push(`- No.${q.no}「${q.title}」kind=${q.type}`);
    L.push(`  目標：${q.goal}（進行 ${q.step | 0}/${q.need}）`);
    L.push(`  詳細：${q.desc}${q.obstacle ? ` / 障害：${q.obstacle}` : ''}`);
    if (!game.sailed) {
      L.push('- まだクーケン島にいる。船（No.8）ができるまで世界地図の他エリアはロック。');
      L.push(`- 造船部品：${game.flag('ship_parts', 0) || 0}/4。`);
    } else {
      L.push('- 船を手に入れて世界へ出航済み。どのエリアにも行ける。');
    }
    return L.join('\n');
  }
}

export const quests = new QuestStore();
export const Quests = quests;
export default quests;
