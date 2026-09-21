// @wc-ignore-file
import { config } from './config.svelte';
import { game } from './game.svelte';
import { getWorldName } from '$lib/i18n/game-content.svelte';

export const TODS = ['mor', 'aft', 'eve', 'ngt'] as const;
export type Tod = (typeof TODS)[number];

export type MapLevel = 'areas' | 'fields' | 'stages';

export interface WorldStage {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface WorldField {
  id: string;
  name: string;
  stages: WorldStage[];
  [key: string]: unknown;
}

export interface WorldArea {
  id: string;
  name: string;
  fields: WorldField[];
  [key: string]: unknown;
}

export interface WorldHierarchy {
  areas: WorldArea[];
  [key: string]: unknown;
}

export interface NpcBase {
  stageId?: string;
  fieldId?: string;
  pct?: number;
  [key: string]: unknown;
}

export interface NpcMove {
  area?: number;
  field?: number;
  stage?: number;
  [key: string]: unknown;
}

export interface NpcCompanion {
  id: string;
  pct?: number;
  [key: string]: unknown;
}

export interface NpcDef {
  id: string;
  name: string;
  resolveOrder?: number;
  bases?: NpcBase[];
  move?: NpcMove;
  companions?: NpcCompanion[];
  note?: string;
  [key: string]: unknown;
}

export interface NpcPlacementDoc {
  npcs: NpcDef[];
  [key: string]: unknown;
}

export type StageBackgroundMap = Record<string, string>;
export type ScenesDoc = Record<string, unknown>;

export interface StageInfo {
  area: string;
  areaId: string;
  field: string;
  fieldId: string;
  stage: string;
  stageId: string;
}

export interface NpcPresence {
  id: string;
  name: string;
  note: string;
  stageId?: string;
  stage?: string;
  where?: string[];
}

export interface WorldCatalogs {
  hierarchy: WorldHierarchy;
  npcs: NpcPlacementDoc;
  stageMap: StageBackgroundMap;
  scenes: ScenesDoc;
}

export const TALK_ALIASES: Record<string, string> = {
  home: 'stage_01_001_04',
  おうち: 'stage_01_001_04',
  うち: 'stage_01_001_04',
  回家: 'stage_01_001_04',
  家里: 'stage_01_001_04',
  回家睡觉: 'stage_01_001_04',
  莱莎的家: 'stage_01_001_04',
  ライザの家: 'stage_01_001_04',
  塔奥家: 'stage_01_002_01',
  タオの家: 'stage_01_002_01',
  tao: 'stage_01_002_01',
};

export class WorldStore {
  hierarchy = $state<WorldHierarchy | null>(null);
  npcs = $state<NpcPlacementDoc | null>(null);
  stageMap = $state<StageBackgroundMap | null>(null);
  scenes = $state<ScenesDoc | null>(null);

  mapLevel = $state<MapLevel>('areas');
  mapAreaId = $state<string | null>(null);
  mapFieldId = $state<string | null>(null);

  readonly TALK_ALIASES = TALK_ALIASES;

  private _placeCache: Record<number, Record<string, string>> = {};

  async init(catalogs?: Partial<WorldCatalogs>): Promise<this> {
    if (catalogs && catalogs.hierarchy && catalogs.npcs && catalogs.stageMap) {
      this.hierarchy = catalogs.hierarchy;
      this.npcs = catalogs.npcs;
      this.stageMap = catalogs.stageMap;
      this.scenes = catalogs.scenes || {};
      this._placeCache = {};
      return this;
    }

    try {
      const [hRes, nRes, sRes, scRes] = await Promise.all([
        fetch('/assets/_index/world_hierarchy.json').then((r) => r.json()),
        fetch('/assets/_index/npc_placement.json').then((r) => r.json()),
        fetch('/assets/_index/stage_background_map.json').then((r) => r.json()),
        fetch('/assets/_index/scenes.json')
          .then((r) => r.json())
          .catch(() => ({})),
      ]);
      this.hierarchy = hRes as WorldHierarchy;
      this.npcs = nRes as NpcPlacementDoc;
      this.stageMap = sRes as StageBackgroundMap;
      this.scenes = scRes as ScenesDoc;
      this._placeCache = {};
    } catch {
      // Offline / SSR / test fallback
    }
    return this;
  }

  areas(): WorldArea[] {
    return this.hierarchy?.areas || [];
  }

  fields(areaId: string): WorldField[] {
    const a = this.areas().find((x) => x.id === areaId);
    return a ? a.fields : [];
  }

  findField(fieldId: string): { area: WorldArea; field: WorldField } | null {
    for (const a of this.areas()) {
      for (const f of a.fields) {
        if (f.id === fieldId) return { area: a, field: f };
      }
    }
    return null;
  }

  allStages(): StageInfo[] {
    const out: StageInfo[] = [];
    for (const a of this.areas()) {
      for (const f of a.fields) {
        for (const s of f.stages) {
          out.push({
            area: getWorldName(a.id, a.name),
            areaId: a.id,
            field: getWorldName(f.id, f.name),
            fieldId: f.id,
            stage: getWorldName(s.id, s.name),
            stageId: s.id,
          });
        }
      }
    }
    return out;
  }

  areaName(areaId: string): string {
    const a = this.areas().find((x) => x.id === areaId);
    return getWorldName(areaId, a?.name || areaId);
  }

  fieldName(fieldId: string): string {
    const hit = this.findField(fieldId);
    return getWorldName(fieldId, hit?.field.name || fieldId);
  }

  stageName(stageId?: string | null): string {
    if (!stageId) return '';
    const s = this.find(stageId);
    return getWorldName(stageId, s?.stage || stageId);
  }

  find(stageId?: string | null): StageInfo | null {
    if (!stageId) return null;
    return this.allStages().find((s) => s.stageId === stageId) || null;
  }

  areaOf(stageId?: string | null): string | null {
    const s = this.find(stageId);
    return s ? s.areaId : null;
  }

  stagesInField(fieldId: string): WorldStage[] {
    const hit = this.findField(fieldId);
    return hit ? hit.field.stages.slice() : [];
  }

  backgroundFor(stageId: string): string {
    return this.stageMap ? this.stageMap[stageId] || stageId : stageId;
  }

  todLabel(tod: Tod | string): string {
    const labels: Record<string, string> = {
      mor: '朝',
      aft: '昼',
      eve: '夕',
      ngt: '夜',
    };
    return labels[tod] || tod;
  }

  nextTod(tod: Tod | string): Tod {
    const idx = (TODS as readonly string[]).indexOf(tod);
    return TODS[(idx + 1) % TODS.length];
  }

  hourToTod(h: number): Tod {
    const normalized = ((Math.floor(Number(h)) % 24) + 24) % 24;
    if (normalized < 5) return 'ngt';
    if (normalized < 11) return 'mor';
    if (normalized < 17) return 'aft';
    if (normalized < 20) return 'eve';
    return 'ngt';
  }

  llmDrivesClock(): boolean {
    try {
      return Boolean(config.section('app')?.timeMode === 'flow');
    } catch {
      return false;
    }
  }

  todStartHour(tod: Tod | string): number {
    const map: Record<string, number> = { mor: 6, aft: 12, eve: 17, ngt: 21 };
    return map[tod] != null ? map[tod] : 12;
  }

  flowHour(gameHour: number, gameClockAt: number, nowMs: number, speed?: number): number {
    let h = Number(gameHour);
    if (!(h >= 0 && h < 24)) h = 12;
    const at = Number(gameClockAt);
    if (!(at > 0)) return h;
    const realMin = Math.max(0, (Number(nowMs) - at) / 60000);
    let sp = Number(speed);
    if (!(sp > 0)) sp = 60;
    h = h + (realMin * sp) / 60;
    return ((h % 24) + 24) % 24;
  }

  _hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return (h % 10000) / 100;
  }

  _pick<T>(arr: T[], seed: string): T | null {
    if (!arr || !arr.length) return null;
    const i = Math.floor((this._hash(seed) / 100) * arr.length) % arr.length;
    return arr[i];
  }

  _weightedBase(bases: NpcBase[], seed: string): NpcBase {
    let total = 0;
    for (let i = 0; i < bases.length; i++) total += Number(bases[i].pct) || 0;
    if (total <= 0) return bases[0];
    const r = this._hash(seed);
    let acc = 0;
    for (let i = 0; i < bases.length; i++) {
      acc += (Number(bases[i].pct) || 0) * (100 / total);
      if (r < acc) return bases[i];
    }
    return bases[bases.length - 1];
  }

  _stageFromBase(base: NpcBase, npcId: string, day: number): string | null {
    if (base.stageId) return base.stageId;
    if (base.fieldId) {
      const sts = this.stagesInField(base.fieldId);
      const s = this._pick(sts, 'base|' + npcId + '|' + day + '|' + base.fieldId);
      return s ? s.id : null;
    }
    return null;
  }

  _drift(homeId: string | null, move: NpcMove | undefined, npcId: string, day: number): string {
    if (!homeId) return '';
    const home = this.find(homeId);
    if (!home) return homeId;
    const area = Number(move?.area) || 0;
    const field = Number(move?.field) || 0;
    const stage = Number(move?.stage) || 0;
    let r = this._hash('move|' + npcId + '|' + day);

    if (r < area) {
      const others = this.allStages().filter((s) => s.areaId !== home.areaId);
      const pick = this._pick(others, 'area|' + npcId + '|' + day);
      return pick ? pick.stageId : homeId;
    }
    r -= area;
    if (r < field) {
      const others = this.allStages().filter((s) => s.areaId === home.areaId && s.fieldId !== home.fieldId);
      const pick = this._pick(others, 'field|' + npcId + '|' + day);
      return pick ? pick.stageId : homeId;
    }
    r -= field;
    if (r < stage) {
      const others = this.stagesInField(home.fieldId).filter((s) => s.id !== homeId);
      const pick = this._pick(others, 'stage|' + npcId + '|' + day);
      return pick ? pick.id : homeId;
    }
    return homeId;
  }

  placement(day: number = 1): Record<string, string> {
    if (this._placeCache[day]) return this._placeCache[day];
    const loc: Record<string, string> = {};
    const list = ((this.npcs && this.npcs.npcs) || []).slice().sort((a, b) => {
      return (a.resolveOrder || 0) - (b.resolveOrder || 0);
    });

    list.forEach((n) => {
      const bases = n.bases || [];
      if (!bases.length) return;
      const home = this._stageFromBase(this._weightedBase(bases, 'home|' + n.id + '|' + day), n.id, day);
      loc[n.id] = this._drift(home, n.move, n.id, day);
    });

    list.forEach((n) => {
      const order = n.resolveOrder || 0;
      (n.companions || []).forEach((c) => {
        const roll = this._hash('comp|' + n.id + '|' + c.id + '|' + day);
        const other = list.find((x) => x.id === c.id);
        const otherOrder = other ? other.resolveOrder || 0 : 0;
        if (roll < (c.pct || 0) && loc[n.id] && otherOrder <= order) {
          loc[c.id] = loc[n.id];
        }
      });
    });

    this._placeCache[day] = loc;
    return loc;
  }

  npcsAt(stageId: string, day: number = 1): NpcPresence[] {
    const loc = this.placement(day);
    const byId: Record<string, NpcDef> = {};
    ((this.npcs && this.npcs.npcs) || []).forEach((n) => {
      byId[n.id] = n;
    });
    const out: NpcPresence[] = [];
    Object.keys(loc).forEach((id) => {
      if (loc[id] !== stageId) return;
      const n = byId[id];
      if (n) out.push({ id: n.id, name: this.npcName(n.id), note: n.note || '' });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  npcsInField(fieldId: string, day: number = 1): NpcPresence[] {
    const loc = this.placement(day);
    const byId: Record<string, NpcDef> = {};
    ((this.npcs && this.npcs.npcs) || []).forEach((n) => {
      byId[n.id] = n;
    });
    const seen: Record<string, boolean> = {};
    const out: NpcPresence[] = [];
    Object.keys(loc).forEach((id) => {
      const info = this.find(loc[id]);
      if (!info || info.fieldId !== fieldId) return;
      if (seen[id]) return;
      seen[id] = true;
      const n = byId[id];
      if (n) {
        out.push({
          id: n.id,
          name: this.npcName(n.id),
          note: n.note || '',
          stageId: loc[id],
          stage: info.stage,
        });
      }
    });
    return out;
  }

  npcsInArea(areaId: string, day: number = 1): NpcPresence[] {
    const out: Record<string, NpcPresence> = {};
    this.fields(areaId).forEach((f) => {
      this.npcsInField(f.id, day).forEach((n) => {
        if (!out[n.id]) {
          out[n.id] = { id: n.id, name: n.name, note: n.note || '', where: [] };
        }
        out[n.id].where?.push(`${f.name}（${n.stage}）`);
      });
    });
    return Object.keys(out)
      .map((k) => out[k])
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  iconFor(npcId: string): string {
    const key = npcId.replace(/^npc_/, '');
    const aliases: Record<string, string> = {
      empel: 'ampel',
      klaudia: 'claudia',
      patricia: 'patrizia',
    };
    return '/assets/images/chara_icons/' + (aliases[key] || key) + '.png';
  }

  npcName(npcId: string): string {
    const hit = ((this.npcs && this.npcs.npcs) || []).find((n) => n.id === npcId);
    return hit ? hit.name : npcId;
  }

  placeLabel(_id: string, base: string): string {
    return base;
  }

  isTod(t: string): boolean {
    return (TODS as readonly string[]).includes(t);
  }

  _fold(s?: string | null): string {
    return String(s || '')
      .toLowerCase()
      .replace(/[\s'"’`・·。，、]/g, '');
  }

  _labels(id: string, base: string): string[] {
    const out: string[] = [];
    const seen: Record<string, boolean> = {};
    function add(v?: string) {
      const str = String(v || '').trim();
      if (!str || seen[str]) return;
      seen[str] = true;
      out.push(str);
    }
    add(base);
    add(id);
    add(this.placeLabel(id, base));
    return out;
  }

  resolveStage(token?: string | null): string | null {
    const q = String(token || '').trim();
    if (!q || !this.hierarchy) return null;
    const alias = this.TALK_ALIASES[this._fold(q)];
    if (alias && this.find(alias)) return alias;
    if (this.find(q)) return q;
    const field = this.findField(q);
    if (field && field.field.stages && field.field.stages[0]) {
      return field.field.stages[0].id;
    }
    const area = this.areas().find((a) => a.id === q);
    if (area && area.fields && area.fields[0] && area.fields[0].stages[0]) {
      return area.fields[0].stages[0].id;
    }
    const nq = this._fold(q);
    if (nq.length < 2) return null;
    let best: string | null = null;
    let bestScore = 0;
    this.areas().forEach((a) => {
      a.fields.forEach((f) => {
        f.stages.forEach((s) => {
          const labels = this._labels(s.id, s.name)
            .concat(this._labels(f.id, f.name))
            .concat(this._labels(a.id, a.name));
          labels.forEach((lab) => {
            const nl = this._fold(lab);
            if (!nl) return;
            let score = 0;
            if (nl === nq) score = 3;
            else if (nl.includes(nq)) score = 2;
            else if (nq.includes(nl) && nl.length >= 4) score = 1;
            if (score > bestScore) {
              bestScore = score;
              best = s.id;
            }
          });
        });
      });
    });
    return best;
  }

  promptBlock(st?: { stage?: string; tod?: string }): string {
    const here = this.find(st?.stage);
    if (!here) return '';
    const L: string[] = ['## いまの場所'];
    L.push(
      `- いま：${this.placeLabel(here.stageId, here.stage)}（${here.stageId}）／${this.placeLabel(here.fieldId, here.field)}／${this.placeLabel(here.areaId, here.area)}`
    );
    L.push(`- 時間帯：${st?.tod || 'aft'}（mor=朝 aft=昼 eve=夕 ngt=夜）`);
    if (!game.sailed) {
      L.push('- 船ができるまでクーケン島（area_01）以外は行けない。');
    }
    L.push('- 行ける場所（stage 欄用）：');
    this.areas().forEach((a) => {
      if (this.locked(a.id)) return;
      a.fields.forEach((f) => {
        const bits = f.stages.map((s) => {
          const labs = this._labels(s.id, s.name).filter((x) => x !== s.id);
          return `${s.id} ${labs.join('/')}`;
        });
        L.push(`  ${this.placeLabel(f.id, f.name)}：${bits.join('；')}`);
      });
    });
    return L.join('\n');
  }

  locked(areaId: string): boolean {
    return !game.sailed && areaId !== 'area_01';
  }
}

export const world = new WorldStore();
export const World = world;
export default world;
