import { clamp, weighted } from '../../util';
import type {
  SpineLayer,
  SpineSkeletonData,
  SpineAnimationState,
  SpineTrackEntry,
  MotionGroup,
  OccupancyKind,
  GestureData,
  ProjectConfig,
  ArmInOutPartConfig,
  EmotionProfile,
  IntensityProfile,
} from './types';

export const ADD_TRACKS = [8, 9, 11, 12, 13, 14] as const;

export const FALLBACK_IDLE = [
  'motion_A_001_idle',
  'motion_A_002_idle',
  'motion_A_005_idle',
  'motion_A_006_idle',
  'motion_A_024_idle',
  'motion_A_025_idle',
];

export function pickAnim(data: SpineSkeletonData | null | undefined, name?: string | null): string | null {
  if (!name || !data) return null;
  if (data.findAnimation(name)) return name;
  if (!/_idle$/.test(name) && data.findAnimation(`${name}_idle`)) return `${name}_idle`;
  if (!/_active$/.test(name) && data.findAnimation(`${name}_active`)) return `${name}_active`;
  const stripped = name.replace(/_(idle|active)$/, '');
  if (stripped !== name && data.findAnimation(stripped)) return stripped;
  return null;
}

export function isEntryLive(tr: SpineTrackEntry | null | undefined): boolean {
  if (!tr || !tr.animation) return false;
  if (/^<empty>/i.test(tr.animation.name || '')) return false;
  return tr.animation.duration > 0;
}

export function isTrackBusy(state: SpineAnimationState | null | undefined, idx: number): boolean {
  if (!state) return false;
  const tr = state.getCurrent(idx);
  if (!tr) return false;
  if (isEntryLive(tr)) return true;
  if (tr.mixingFrom && isEntryLive(tr.mixingFrom)) return true;
  return false;
}

export function getOccupancyKind(g: MotionGroup | null | undefined): OccupancyKind | '' {
  const o = String(g?.OccupancyLetters || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (o === 'I') return 'legL';
  if (o === 'J') return 'legR';
  if (o === 'C') return 'leg';
  if (o === 'FG' || o === 'GF' || o === 'B' || /[BFG]/.test(o)) return 'arm';
  if (o.includes('E') || o.includes('H')) return 'torso';
  return '';
}

export function getLayerTracks(kind: OccupancyKind): number[] {
  if (kind === 'torso') return [11, 12];
  if (kind === 'leg') return [13, 14];
  if (kind === 'legL') return [13];
  if (kind === 'legR') return [14];
  return [8, 9];
}

export class MotionController {
  armG: MotionGroup | null = null;
  torsoG: MotionGroup | null = null;
  legG: MotionGroup | null = null;
  legLG: MotionGroup | null = null;
  legRG: MotionGroup | null = null;

  addMuted = false;
  private _mutedSnap: Record<string, MotionGroup | null> | null = null;
  private _typeMap: Record<string, string[]> | null = null;
  private _exitMixCache: Record<string, number> = {};

  reset(): void {
    this.armG = null;
    this.torsoG = null;
    this.legG = null;
    this.legLG = null;
    this.legRG = null;
    this.addMuted = false;
    this._mutedSnap = null;
    this._typeMap = null;
    this._exitMixCache = {};
  }

  layerGet(kind: OccupancyKind): MotionGroup | null {
    if (kind === 'torso') return this.torsoG;
    if (kind === 'leg') return this.legG;
    if (kind === 'legL') return this.legLG;
    if (kind === 'legR') return this.legRG;
    return this.armG;
  }

  layerSet(kind: OccupancyKind, g: MotionGroup | null): void {
    if (kind === 'torso') this.torsoG = g;
    else if (kind === 'leg') this.legG = g;
    else if (kind === 'legL') this.legLG = g;
    else if (kind === 'legR') this.legRG = g;
    else this.armG = g;
  }

  animTypeMap(gesture: GestureData | null): Record<string, string[]> {
    if (this._typeMap) return this._typeMap;
    const map: Record<string, string[]> = {};
    const profiles = gesture?.emotionalGesture?.EmotionProfilesV4;
    if (profiles) {
      for (const em in profiles) {
        if (!Object.prototype.hasOwnProperty.call(profiles, em)) continue;
        const ip = profiles[em]?.intensityProfiles || {};
        for (const k in ip) {
          if (!Object.prototype.hasOwnProperty.call(ip, k)) continue;
          const poses = ip[k]?.basePoses || [];
          for (const p of poses) {
            if (p?.id && p.poseTypeIds?.length) {
              map[p.id] = p.poseTypeIds;
            }
          }
        }
      }
    }
    this._typeMap = map;
    return map;
  }

  poseTypesOf(animId: string, gesture: GestureData | null, intensity: IntensityProfile | null): string[] {
    const mapped = this.animTypeMap(gesture)[animId];
    if (mapped && mapped.length) return mapped;
    const poses = intensity?.basePoses || [];
    for (const p of poses) {
      if (p?.id === animId && p.poseTypeIds?.length) return p.poseTypeIds;
    }
    return ['posetype_01_freehand'];
  }

  pickPoseType(prev: string, gesture: GestureData | null): string {
    const sets = gesture?.emotionalGesture?.PoseTypeSets || [];
    const cand = sets.filter((s) => s.previousId === prev);
    if (!cand.length) return prev || 'posetype_01_freehand';
    const pick = weighted(cand, (s) => Number(s.weight) || 0);
    return pick?.newId || prev || 'posetype_01_freehand';
  }

  idlesForType(
    data: SpineSkeletonData | null | undefined,
    poseType: string,
    sittingId: string,
    intensity: IntensityProfile | null,
    gesture: GestureData | null
  ): { name: string; w: number }[] {
    const sit = sittingId || 'sitting_normal';
    const poses = intensity?.basePoses || [];
    const sitOk = (p: { applicableSittingIds?: string[] }) => {
      const sits = p?.applicableSittingIds;
      if (sits && sits.length && !sits.includes(sit)) return false;
      return true;
    };

    const typed = poses
      .filter((p) => {
        if (!p || !p.id || !pickAnim(data, p.id) || !sitOk(p)) return false;
        const ids = p.poseTypeIds || this.animTypeMap(gesture)[p.id] || [];
        if (!poseType) return true;
        return ids.length > 0 && ids.includes(poseType);
      })
      .map((p) => {
        const w = Number(p.weight);
        return { name: pickAnim(data, p.id)!, w: w > 0 ? w : 1 };
      })
      .filter((x) => Boolean(x.name));

    if (typed.length) return typed;
    if (poseType && poseType !== 'posetype_01_freehand') {
      return this.idlesForType(data, 'posetype_01_freehand', sittingId, intensity, gesture);
    }
    return FALLBACK_IDLE.map((n) => {
      const hit = pickAnim(data, n);
      return hit ? { name: hit, w: 1 } : null;
    }).filter(Boolean) as { name: string; w: number }[];
  }

  private _ioClip(
    data: SpineSkeletonData | null | undefined,
    activeName: string | undefined,
    phase: 'in' | 'out',
    pc?: ProjectConfig
  ): string | null {
    if (!activeName) return null;
    const cfg = pc?.armInOutPartConfig || {};
    const dir = cfg.samePartDetourDirection || pc?.samePartDetourDirection || 'up';
    const base = String(activeName).replace(/_active$/, '');
    return (
      pickAnim(data, `${base}_${phase}_${dir}`) ||
      pickAnim(data, `${base}_${phase}_up`) ||
      pickAnim(data, `${base}_${phase}_down`)
    );
  }

  private _groupApplies(g: MotionGroup | null, idleName: string, sittingId: string): boolean {
    if (!g) return false;
    const sit = sittingId || 'sitting_normal';
    if (g.ApplicableSittingIDs) {
      const sits = String(g.ApplicableSittingIDs)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (sits.length && !sits.includes(sit)) return false;
    }
    if (!g.ApplicablePoseIds) return true;
    const ids = String(g.ApplicablePoseIds)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return !ids.length || ids.includes(idleName);
  }

  private _rankBlend(prev: MotionGroup | null, next: MotionGroup | null, pc?: ProjectConfig): number {
    let fallback = Number(next?.BlendTime);
    if (!(fallback > 0)) fallback = 0.6;
    const cfg = pc?.armInOutPartConfig || {};
    const by = cfg.byGroupId || {};
    const pos = cfg.rankPositions || {};

    const rp = (gid: string | undefined, side: 'left' | 'right'): number => {
      if (!gid) return 0;
      const rec = by[gid];
      const r = rec?.[side];
      if (r == null) return 0;
      return Number(pos[String(r)]) || 0;
    };

    const nid = next?.GroupId;
    const pid = prev?.GroupId;
    if (!nid || !by[nid]) return fallback;

    const dist = Math.max(
      Math.abs(rp(nid, 'left') - rp(pid, 'left')),
      Math.abs(rp(nid, 'right') - rp(pid, 'right'))
    );
    let lo = Number(cfg.minSeconds);
    if (!(lo > 0)) lo = 0.4;
    let hi = Number(cfg.maxSeconds);
    if (!(hi > lo)) hi = 1;
    let ref = Number(cfg.pairStartDelayReferenceDistance);
    if (!(ref > 0)) ref = 0.35;
    return lo + Math.min(1, dist / ref) * (hi - lo);
  }

  private _pairDelay(pc?: ProjectConfig): number {
    const cfg = pc?.armInOutPartConfig || {};
    let lo = Number(cfg.pairStartDelayMinSeconds);
    let hi = Number(cfg.pairStartDelayMaxSeconds);
    if (!(lo > 0)) lo = 0.2;
    if (!(hi > lo)) hi = lo + 0.15;
    return lo + Math.random() * (hi - lo);
  }

  private _sameAnims(a: MotionGroup | null, b: MotionGroup | null): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (a.AnimName_1 || '') === (b.AnimName_1 || '') && (a.AnimName_2 || '') === (b.AnimName_2 || '');
  }

  pickLayerGroup(
    kind: OccupancyKind,
    idleName: string,
    poseType: string,
    preferRest: boolean,
    gesture: GestureData | null,
    sittingId: string,
    intensity: IntensityProfile | null,
    data: SpineSkeletonData | null | undefined
  ): MotionGroup | null {
    const pc = gesture?.projectConfig;
    const cfg = pc?.armInOutPartConfig || {};
    const by = cfg.idleGroupIds?.byPosture || {};
    const restId = kind === 'arm' ? by[sittingId] || cfg.idleGroupIds?.default || '' : '';

    const resolvable = (g: MotionGroup): boolean => {
      if (!data) return true;
      return Boolean(pickAnim(data, g.AnimName_1) || pickAnim(data, g.AnimName_2));
    };

    const allGroups = gesture?.emotionalGesture?.MotionGroups || [];
    if (preferRest && restId) {
      const rest = allGroups.filter(
        (g) =>
          g.GroupId === restId &&
          getOccupancyKind(g) === kind &&
          this._groupApplies(g, idleName, sittingId) &&
          resolvable(g)
      );
      if (rest.length) {
        return weighted(rest, (g) => Number(g.VariantWeight) || 1);
      }
    }

    const armWeights = intensity?.armGroupWeightsByPoseType?.[poseType] || intensity?.armGroupWeights || {};
    const torsoWeights = intensity?.armGroupWeightsByPoseType?.[poseType] || {}; // fallback

    const weights = kind === 'torso' ? torsoWeights : kind === 'leg' ? null : armWeights;
    const groups = allGroups.filter((g) => {
      if (getOccupancyKind(g) !== kind || !this._groupApplies(g, idleName, sittingId)) return false;
      if (!resolvable(g)) return false;
      if (weights) return Number(weights[g.GroupId]) > 0;
      return (Number(g.GroupWeight) || 0) > 0;
    });

    const pick = weighted(groups, (g) => {
      const w = weights ? Number(weights[g.GroupId]) || 0 : Number(g.GroupWeight) || 0;
      return w * (Number(g.VariantWeight) || 1);
    });
    if (pick) return pick;

    if (restId) {
      return (
        allGroups.find((g) => g.GroupId === restId && getOccupancyKind(g) === kind && resolvable(g)) || null
      );
    }
    return null;
  }

  private _stampAdd(tr: SpineTrackEntry | null, mix: number, alpha: number, speed: number): void {
    if (!tr) return;
    tr.mixDuration = mix;
    tr.alpha = alpha;
    tr.timeScale = speed;
    const spineObj = (window as unknown as { spine?: { MixBlend?: { replace: unknown } } }).spine;
    if (spineObj?.MixBlend) {
      tr.mixBlend = spineObj.MixBlend.replace;
    }
  }

  private _queueAddTrack(
    track: number,
    activeName: string | undefined,
    alpha: number | undefined,
    speed: number | undefined,
    blend: number,
    leaving: string | null,
    startDelay: number,
    L: SpineLayer,
    pc?: ProjectConfig
  ): void {
    const data = L.data;
    const st = L.state;
    if (!st) return;

    const act = pickAnim(data, activeName);
    const route = pc?.enableArmInOutRouting !== false;
    const inn = route ? this._ioClip(data, activeName, 'in', pc) : null;
    const out = route && leaving ? this._ioClip(data, leaving, 'out', pc) : null;
    const mix = Number(blend) > 0 ? Number(blend) : 0.6;
    const a = Number(alpha) > 0 ? Number(alpha) : 1;
    const ts = Number(speed) > 0 ? Number(speed) : 1;
    const delay = Number(startDelay) > 0 ? Number(startDelay) : 0;
    const cur = st.getCurrent(track);
    const hold = delay > 0 && isEntryLive(cur);

    const enqueue = (name: string, loop: boolean, first: boolean) => {
      let tr: SpineTrackEntry;
      if (first && hold && cur) {
        cur.loop = false;
        cur.trackEnd = cur.trackTime + delay;
        tr = st.addAnimation(track, name, loop, 0);
      } else if (first) {
        tr = st.setAnimation(track, name, loop);
      } else {
        tr = st.addAnimation(track, name, loop, 0);
      }
      this._stampAdd(tr, mix, a, ts);
      return tr;
    };

    if (out) {
      enqueue(out, false, true);
      if (inn) enqueue(inn, false, false);
      if (act) enqueue(act, true, false);
      else st.addEmptyAnimation(track, mix, 0);
      return;
    }
    if (inn) {
      enqueue(inn, false, true);
      if (act) enqueue(act, true, false);
      return;
    }
    if (act) {
      enqueue(act, true, true);
      return;
    }
    if (hold && cur) {
      cur.loop = false;
      cur.trackEnd = cur.trackTime + delay;
      st.addEmptyAnimation(track, mix, 0);
    } else {
      st.setEmptyAnimation(track, mix);
    }
  }

  applyLayer(
    tracks: number[],
    group: MotionGroup | null,
    prev: MotionGroup | null,
    immediate: boolean,
    L: SpineLayer,
    pc?: ProjectConfig
  ): void {
    const t0 = tracks[0];
    const t1 = tracks.length > 1 ? tracks[1] : null;
    if (!L.state) return;

    if (!group) {
      L.state.setEmptyAnimation(t0, immediate ? 0 : 0.45);
      if (t1 != null) L.state.setEmptyAnimation(t1, immediate ? 0 : 0.45);
      return;
    }
    if (!immediate && this._sameAnims(prev, group)) return;

    let leaving1: string | null = null;
    let leaving2: string | null = null;
    if (prev && prev.GroupId !== group.GroupId) {
      leaving1 = prev.AnimName_1 || null;
      leaving2 = prev.AnimName_2 || null;
    }
    const blend = immediate ? 0 : this._rankBlend(prev, group, pc);
    this._queueAddTrack(t0, group.AnimName_1, group.Alpha1, group.Speed1, blend, leaving1, 0, L, pc);
    if (t1 == null) return;
    if (group.AnimName_2) {
      this._queueAddTrack(
        t1,
        group.AnimName_2,
        group.Alpha2 || group.Alpha1,
        group.Speed2 || group.Speed1,
        blend,
        leaving2,
        immediate ? 0 : this._pairDelay(pc),
        L,
        pc
      );
    } else {
      L.state.setEmptyAnimation(t1, immediate ? 0 : blend);
    }
  }

  muteAdditives(on: boolean, L: SpineLayer, idleName: string, poseType: string, pc?: ProjectConfig): void {
    if (!L?.state || on === this.addMuted) return;
    this.addMuted = on;

    if (on) {
      this._mutedSnap = {
        arm: this.armG,
        torso: this.torsoG,
        leg: this.legG,
        legL: this.legLG,
        legR: this.legRG,
      };
      for (const t of ADD_TRACKS) {
        L.state.setEmptyAnimation(t, 0.18);
      }
      return;
    }

    const snap = this._mutedSnap;
    this._mutedSnap = null;
    const restore = (kind: OccupancyKind): MotionGroup | null => {
      const g = snap?.[kind];
      if (g) {
        this.applyLayer(getLayerTracks(kind), g, null, false, L, pc);
        this.layerSet(kind, g);
        return g;
      }
      this.layerSet(kind, null);
      return null;
    };

    restore('arm');
    restore('torso');
    if (restore('leg')) {
      this.layerSet('legL', null);
      this.layerSet('legR', null);
    } else {
      restore('legL');
      restore('legR');
    }
  }

  syncAdditives(
    idleName: string,
    poseType: string,
    immediate: boolean,
    preferRest: boolean,
    keepIfOk: boolean,
    L: SpineLayer,
    gesture: GestureData | null,
    sittingId: string,
    intensity: IntensityProfile | null
  ): void {
    if (!L?.state || this.addMuted) return;
    const pc = gesture?.projectConfig;

    const syncKind = (kind: OccupancyKind, rest: boolean): MotionGroup | null => {
      const cur = this.layerGet(kind);
      let pick: MotionGroup | null = null;
      if (keepIfOk && cur && getOccupancyKind(cur) === kind && this._groupApplies(cur, idleName, sittingId)) {
        pick = cur;
      } else {
        pick = this.pickLayerGroup(kind, idleName, poseType, rest, gesture, sittingId, intensity, L.data);
      }
      if (pick !== cur || immediate) {
        this.applyLayer(getLayerTracks(kind), pick, cur, immediate, L, pc);
        this.layerSet(kind, pick);
      }
      return pick;
    };

    syncKind('arm', preferRest);
    syncKind('torso', false);
    const both = syncKind('leg', false);
    if (both) {
      this.layerSet('legL', null);
      this.layerSet('legR', null);
    } else {
      syncKind('legL', false);
      syncKind('legR', false);
    }
  }

  pokeUnmuteReady(state: SpineAnimationState | null | undefined): boolean {
    if (!state) return false;
    if (isTrackBusy(state, 1)) return false;
    const tr = state.getCurrent(6);
    if (!tr || !tr.mixingFrom || !isEntryLive(tr.mixingFrom)) return true;
    if (!/<empty>/i.test(tr.animation?.name || '')) return false;
    const dur = Math.max(1e-6, Number(tr.mixDuration) || 0.3);
    return (Number(tr.mixTime) || 0) / dur >= 0.6;
  }

  pokeExitMix(anim: { name: string; duration: number } | null | undefined, pc?: ProjectConfig): number {
    const base = Number(pc?.tapReactionExitMix) > 0 ? Number(pc?.tapReactionExitMix) : 0.3;
    if (!anim?.duration) return base;
    if (this._exitMixCache[anim.name] != null) return this._exitMixCache[anim.name];
    // Dynamic calculation with safe bounds
    const mix = clamp(base, base, 0.65);
    this._exitMixCache[anim.name] = mix;
    return mix;
  }
}
