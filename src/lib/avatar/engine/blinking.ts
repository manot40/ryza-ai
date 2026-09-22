import { weighted } from '../../util';
import type { SpineLayer, TensionProfile } from './types';

export class BlinkingController {
  blinkTimer = 0;
  private _blinkMode: 'blink' | 'blinkFast' | 'closed' = 'blink';
  private _closedDur = 0;
  private _closedHold = 0;

  reset(): void {
    this.blinkTimer = 0;
    this._blinkMode = 'blink';
    this._closedDur = 0;
    this._closedHold = 0;
  }

  nextBlinkGap(tensionProfile: TensionProfile | null | undefined): number {
    const entries = tensionProfile?.gaze?.eyeModeEntries;
    const cand = (entries || []).filter(
      (e) =>
        (Number(e.weight) || 0) > 0 && (e.mode === 'blink' || e.mode === 'blinkFast' || e.mode === 'closed')
    );
    const pick = weighted(cand, (e) => Number(e.weight) || 0);
    this._blinkMode = pick ? pick.mode : 'blink';
    this._closedDur = pick && pick.mode === 'closed' ? Number(pick.durationSeconds) || 1.5 : 0;

    if (!pick) return 2.4 + Math.random() * 3.2;

    let iv = Number(pick.intervalSeconds);
    if (!(iv > 0)) iv = pick.mode === 'blinkFast' ? 1.4 : pick.mode === 'closed' ? 5.5 : 3;
    let j = Number(pick.jitterSeconds);
    if (!(j > 0)) j = pick.mode === 'closed' ? 1.5 : 0;

    let gap = iv + (Math.random() * 2 - 1) * j;
    if (pick.mode === 'blinkFast') gap *= 0.55;
    return Math.max(0.45, gap);
  }

  update(
    dt: number,
    L: SpineLayer | null,
    eyeOpen: string | null,
    eyeClosed: string | null,
    isOneShotBusy: boolean,
    tensionProfile: TensionProfile | null | undefined
  ): void {
    if (this._closedHold > 0) this._closedHold -= dt;
    this.blinkTimer -= dt;

    if (
      this.blinkTimer <= 0 &&
      L?.ready &&
      L.state &&
      eyeOpen &&
      eyeClosed &&
      !isOneShotBusy &&
      !(this._closedHold > 0)
    ) {
      this.blinkTimer = this.nextBlinkGap(tensionProfile);
      const st = L.state;
      const fast = this._blinkMode === 'blinkFast';
      const blink = st.setAnimation(2, eyeClosed, false);
      blink.mixDuration = fast ? 0.03 : 0.04;

      const shut = this._blinkMode === 'closed' ? this._closedDur || 1.5 : 0;
      const back = st.addAnimation(2, eyeOpen, true, shut);
      back.mixDuration = fast ? 0.06 : 0.08;
      if (shut > 0) {
        this._closedHold = shut + back.mixDuration;
      }
    }
  }
}
