import { weighted } from '../../util';
import { pickAnim } from './motion';
import type { SpineLayer, SpineSkeleton, IntensityProfile, ProjectConfig } from './types';

export class EffectsController {
  fxOn = false;
  private _fxKey = '';
  private _fxPick: { key: string; names: string[] } | null = null;

  reset(): void {
    this.fxOn = false;
    this._fxKey = '';
    this._fxPick = null;
  }

  effectNames(emotion: string, band: string, intensity: IntensityProfile | null): string[] {
    const memoKey = `${emotion}|${band}`;
    if (this._fxPick && this._fxPick.key === memoKey) {
      return this._fxPick.names;
    }
    const sets = intensity?.effectSets || [];
    const live = sets.filter(
      (s) => (s?.names || []).length > 0 && (s.weight == null || Number(s.weight) > 0)
    );
    const pick = weighted(live, (s) => (Number(s.weight) > 0 ? Number(s.weight) : 1));
    const names = pick ? (pick.names || []).slice() : [];
    this._fxPick = { key: memoKey, names };
    return names;
  }

  hideFxSlots(skeleton: SpineSkeleton | null, keepOn: boolean): void {
    if (!skeleton?.slots) return;
    for (let i = 0; i < skeleton.slots.length; i++) {
      const slot = skeleton.slots[i];
      const n = slot.data?.name || '';
      if (/nose_hi|cheek_line/.test(n)) {
        slot.setAttachment(null);
        continue;
      }
      if (!keepOn && /face_cheek|face_pale|face_tear|face_sweat|mouth_drool/.test(n)) {
        slot.setAttachment(null);
      }
    }
  }

  syncFx(
    immediate: boolean,
    L: SpineLayer | null,
    emotion: string,
    band: string,
    intensity: IntensityProfile | null,
    pc?: ProjectConfig
  ): void {
    if (!L?.ready || !L.state) return;
    const names = this.effectNames(emotion, band, intensity);
    const key = names.slice().sort().join(',');
    if (key === this._fxKey && !immediate) return;
    this._fxKey = key;

    const onMap = pc?.fxOnAnimNames || {};
    const offMap = pc?.fxOffAnimNames || {};
    const st = L.state;
    const data = L.data;
    const mix = immediate ? 0 : 0.28;

    if (!names.length) {
      this.fxOn = false;
      const clip = pickAnim(data, offMap.blush001) || pickAnim(data, 'facial_add_blush_000_off');
      if (clip) {
        const tr = st.setAnimation(5, clip, false);
        tr.mixDuration = mix;
      } else {
        st.setEmptyAnimation(5, mix);
      }
      st.setEmptyAnimation(7, mix);
      st.setEmptyAnimation(15, mix);
      st.setEmptyAnimation(16, mix);
      this.hideFxSlots(L.skeleton, false);
      return;
    }

    this.fxOn = true;
    const firstClip = pickAnim(data, onMap[names[0]] || names[0]);
    if (firstClip) {
      const tr = st.setAnimation(5, firstClip, true);
      tr.mixDuration = mix;
    } else {
      st.setEmptyAnimation(5, mix);
    }

    const extra = [7, 15, 16];
    let i = 1;
    for (; i < names.length && i - 1 < extra.length; i++) {
      const clip = pickAnim(data, onMap[names[i]] || names[i]);
      if (clip) {
        st.setAnimation(extra[i - 1], clip, true).mixDuration = mix;
      } else {
        st.setEmptyAnimation(extra[i - 1], mix);
      }
    }
    for (; i - 1 < extra.length; i++) {
      st.setEmptyAnimation(extra[i - 1], mix);
    }
  }
}
