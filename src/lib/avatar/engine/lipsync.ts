import type { SpineLayer, ProjectConfig } from './types';

export interface EnvelopeData {
  samples: number[];
  duration: number;
  window: number;
  t: number;
}

export class LipSyncController {
  private _env: EnvelopeData | null = null;
  private _analyser: AnalyserNode | null = null;
  private _dataArray: Uint8Array<ArrayBuffer> | null = null;
  private _lipOpen = 0;
  private _lipHold = 0;

  reset(): void {
    this._env = null;
    this._analyser = null;
    this._dataArray = null;
    this._lipOpen = 0;
    this._lipHold = 0;
  }

  setAnalyser(analyser: AnalyserNode | null): void {
    this._analyser = analyser;
    if (analyser) {
      this._dataArray = new Uint8Array(analyser.fftSize);
    } else {
      this._dataArray = null;
    }
  }

  setEnvelope(env: { envelope: number[]; durationMs?: number; windowMs?: number } | null): void {
    if (!env || !env.envelope?.length) {
      this._env = null;
      return;
    }
    this._env = {
      samples: env.envelope,
      duration: (Number(env.durationMs) || 0) / 1000,
      window: (Number(env.windowMs) || 20) / 1000,
      t: 0,
    };
  }

  clearEnvelope(): void {
    this._env = null;
  }

  private _voiceDb(): number | null {
    if (!this._analyser || !this._dataArray) return null;
    this._analyser.getByteTimeDomainData(this._dataArray);
    let sum = 0;
    for (let i = 0; i < this._dataArray.length; i++) {
      const v = (this._dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this._dataArray.length);
    return 20 * Math.log10(Math.max(1e-6, rms));
  }

  update(
    dt: number,
    L: SpineLayer | null,
    talking: boolean,
    pc: ProjectConfig | undefined,
    onStopTalking?: () => void
  ): void {
    if (!L?.state) return;
    const closure = pc?.lipSyncClosure || {};
    let target = 0;

    if (talking) {
      if (this._env) {
        this._env.t += dt;
        const i = this._env.window > 0 ? Math.floor(this._env.t / this._env.window) : 0;
        const amp = this._env.samples[Math.min(i, this._env.samples.length - 1)] || 0;
        target = Math.max(0, amp);
        if (this._env.duration > 0 && this._env.t >= this._env.duration) {
          this._env = null;
          onStopTalking?.();
        }
      } else {
        const db = this._voiceDb();
        if (db != null && closure.opennessMappingEnabled !== false) {
          let lo = Number(closure.opennessFloorDb);
          if (!(lo < 0) && lo !== 0) lo = -40;
          let hi = Number(closure.opennessCeilingDb);
          if (!(hi > lo)) hi = -3;
          target = (db - lo) / (hi - lo);
        } else {
          target = 0;
        }
      }
    }

    if (target < 0) target = 0;
    if (target > 1) target = 1;
    target *= Number(closure.opennessOutputScale) || 1;

    const ms =
      (this._lipOpen < target ? closure.opennessAttackMs : closure.opennessReleaseMs) ||
      (this._lipOpen < target ? 20 : 60);
    const k = 1 - Math.exp(-dt / Math.max(0.008, ms / 1000));

    if (closure.minHoldMs && target < this._lipOpen - (closure.dipThreshold || 0.1) && this._lipHold > 0) {
      this._lipHold -= dt;
    } else {
      this._lipOpen += (target - this._lipOpen) * k;
      if (target >= this._lipOpen) {
        this._lipHold = (closure.minHoldMs || 50) / 1000;
      }
    }

    const lipTr = L.state.getCurrent(4);
    if (!lipTr || !talking) return;

    if (closure.enabled !== false && lipTr.animation) {
      lipTr.timeScale = 0;
      lipTr.trackTime = this._lipOpen * lipTr.animation.duration * 0.98;
    } else {
      lipTr.timeScale = 0.25 + this._lipOpen * 2.2;
    }
  }
}
