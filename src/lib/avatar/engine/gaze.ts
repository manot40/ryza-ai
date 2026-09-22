import { clamp, weighted } from '../../util';
import type {
  SpineSkeleton,
  SpineBone,
  GestureData,
  ProjectConfig,
  LookDriverSpec,
  TensionProfile,
  EmotionProfile,
} from './types';

export interface LookState {
  yaw: number;
  pitch: number;
  roll: number;
  fromY: number;
  fromP: number;
  fromR: number;
  ty: number;
  tp: number;
  tr: number;
  trans: number;
  hold: number;
  t: number;
  followers?: Array<{ part: string; scale?: number; delay?: number }>;
  eyeDrv?: boolean;
}

export interface LookHistoryItem {
  t: number;
  y: number;
  p: number;
  r: number;
}

export class GazeController {
  look: LookState = {
    yaw: 0,
    pitch: 0,
    roll: 0,
    fromY: 0,
    fromP: 0,
    fromR: 0,
    ty: 0,
    tp: 0,
    tr: 0,
    trans: 0.8,
    hold: 2,
    t: 0,
  };

  pointer = { x: 0, y: 0, on: false };
  private _ptrSm = { x: 0, y: 0 };
  private _ptrInit = false;
  private _ptrN = 0;
  private _ptrW = 0;
  private _rollSm = 0;
  private _lookClock = 0;
  private _lookHist: LookHistoryItem[] = [];
  private _lookMul = 1;
  private _faceRef: { x: number; y: number } | null = null;
  private _lookCyc: { band: string | null; spec: LookDriverSpec | null; left: number } | null = null;
  private _drivers: Record<string, LookDriverSpec> | null = null;
  private _aimSm: Record<string, [number, number]> = {};

  reset(): void {
    this.look = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      fromY: 0,
      fromP: 0,
      fromR: 0,
      ty: 0,
      tp: 0,
      tr: 0,
      trans: 0.8,
      hold: 2,
      t: 0,
    };
    this.pointer = { x: 0, y: 0, on: false };
    this._ptrSm = { x: 0, y: 0 };
    this._ptrInit = false;
    this._ptrN = 0;
    this._ptrW = 0;
    this._rollSm = 0;
    this._lookClock = 0;
    this._lookHist = [];
    this._lookMul = 1;
    this._faceRef = null;
    this._lookCyc = null;
    this._drivers = null;
    this._aimSm = {};
  }

  setPointer(x: number, y: number, on: boolean): void {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.on = on;
  }

  driverSpec(id: string, gesture: GestureData | null): LookDriverSpec | null {
    if (!this._drivers) {
      this._drivers = {};
      const defs = gesture?.emotionalGesture?.DriverDefs || [];
      for (const d of defs) {
        try {
          this._drivers[d.Id] = JSON.parse(d.Spec);
        } catch {}
      }
    }
    return id ? this._drivers[id] || null : null;
  }

  pickLook(profile: EmotionProfile | null, band: string, gesture: GestureData | null): void {
    const tps = profile?.tensionProfiles;
    let targetBand: string | null = band;
    if (tps && !tps[targetBand]) {
      targetBand = tps.low ? 'low' : 'high';
    } else if (!tps) {
      targetBand = null;
    }

    const tp = targetBand ? tps?.[targetBand] : null;
    const bindings = tp?.ambientBindings || [];

    let spec: LookDriverSpec | null = null;
    const cyc = this._lookCyc;
    if (cyc && cyc.band === targetBand && cyc.left > 0 && cyc.spec) {
      cyc.left--;
      spec = cyc.spec;
    } else {
      const cand = bindings.filter((x) => (x.weight || 0) > 0);
      const hit = weighted(cand.length ? cand : bindings, (x) => x.weight || 0);
      spec = hit ? this.driverSpec(hit.driverDefId, gesture) : null;
      let lo = Math.round(Number(hit?.repeatMin) || 1);
      let hi = Math.round(Number(hit?.repeatMax) || lo);
      if (!(lo > 0)) lo = 1;
      if (hi < lo) hi = lo;
      this._lookCyc = {
        band: targetBand,
        spec,
        left: lo + Math.floor(Math.random() * (hi - lo + 1)) - 1,
      };
    }

    if (!spec && bindings.length) {
      spec = this.driverSpec(bindings[0].driverDefId, gesture);
    }

    const look = this.look;
    look.fromY = look.yaw;
    look.fromP = look.pitch;
    look.fromR = look.roll;
    look.t = 0;

    if (!spec) {
      look.ty = 0;
      look.tp = 0;
      look.tr = 0;
      look.trans = 0.8;
      look.hold = 2;
      return;
    }

    const rnd = (a?: number, b?: number) => {
      const na = Number(a) || 0;
      const nb = Number(b) || 0;
      return na + Math.random() * (nb - na);
    };

    look.ty = rnd(spec.yawMin, spec.yawMax);
    look.tp = rnd(spec.pitchMin, spec.pitchMax);
    look.tr = rnd(spec.rollMin, spec.rollMax);
    look.trans = Math.max(0.05, rnd(spec.transitionMin, spec.transitionMax));
    look.hold = Math.max(0.2, rnd(spec.holdMin, spec.holdMax));
    look.followers = spec.followers || [];
    look.eyeDrv = spec.driver === 'eye';
  }

  lookAtUserNow(profile: EmotionProfile | null, band: string, pc?: ProjectConfig): void {
    const tps = profile?.tensionProfiles;
    const tp = (band && tps?.[band]) || tps?.low || tps?.high;
    const ge = tp?.gaze?.gazeEntries || [];
    const at = ge.find((e) => e.direction === 'lookAtUser' && (Number(e.weight) || 0) > 0);

    const gr = pc?.gazeReturnToFront || {};
    const ent = gr.entry || {};
    const sp = Number(ent.secondsPerDistance) > 0 ? Number(ent.secondsPerDistance) : 0.8;
    const mn = Number(ent.minSeconds) > 0 ? Number(ent.minSeconds) : 0.4;
    const mx = Number(ent.maxSeconds) >= mn ? Number(ent.maxSeconds) : Math.max(mn, 0.8);

    const look = this.look;
    const dist = Math.abs(look.yaw) + Math.abs(look.pitch) + Math.abs(look.roll);
    look.fromY = look.yaw;
    look.fromP = look.pitch;
    look.fromR = look.roll;
    look.ty = 0;
    look.tp = 0;
    look.tr = 0;
    look.trans = clamp(sp * Math.max(0.25, dist), mn, mx);
    look.hold = at && Number(at.holdSeconds) > 0 ? Number(at.holdSeconds) : 3;
    look.t = 0;
    look.eyeDrv = false;
    this._lookCyc = null;
  }

  update(
    dt: number,
    skeleton: SpineSkeleton | null,
    pc: ProjectConfig | undefined,
    screenToWorld: (x: number, y: number) => { x: number; y: number },
    isOneShotBusy: boolean,
    isPokeUnmuteReady: boolean
  ): void {
    const look = this.look;
    look.t += dt;
    const uRaw = look.trans > 0 ? Math.min(1, look.t / look.trans) : 1;
    const u = uRaw * uRaw * (3 - 2 * uRaw);

    look.yaw = look.fromY + (look.ty - look.fromY) * u;
    look.pitch = look.fromP + (look.tp - look.fromP) * u;
    look.roll = look.fromR + (look.tr - look.fromR) * u;

    const rfs =
      Number(this._lookCyc?.spec?.rollFollowSpeed) > 0 ? Number(this._lookCyc?.spec?.rollFollowSpeed) : 5;
    this._rollSm += (look.roll - this._rollSm) * (1 - Math.exp(-dt * rfs));

    this._lookClock += dt;
    this._lookHist.push({ t: this._lookClock, y: look.yaw, p: look.pitch, r: this._rollSm });
    while (this._lookHist.length > 1 && this._lookHist[0].t < this._lookClock - 2.8) {
      this._lookHist.shift();
    }

    const wantMul = isOneShotBusy && !isPokeUnmuteReady ? 0.15 : 1;
    const mulTau = wantMul > this._lookMul ? 0.3 : 0.18;
    this._lookMul += (wantMul - this._lookMul) * (1 - Math.exp(-dt / mulTau));

    const w = screenToWorld(this.pointer.x, this.pointer.y);
    const k = 1 - Math.exp(-dt / Math.max(0.02, Number(pc?.fingerTrackDelay) || 0.1));

    if (this.pointer.on && skeleton) {
      if (!this._ptrInit) {
        const fb = skeleton.findBone(pc?.fingerTrackCenterBone || 'rig_face') || skeleton.findBone('head');
        if (fb) {
          this._ptrSm.x = fb.worldX;
          this._ptrSm.y = fb.worldY;
          this._ptrN = 0;
        } else {
          this._ptrSm.x = w.x;
          this._ptrSm.y = w.y;
        }
        this._ptrInit = true;
      } else {
        this._ptrSm.x += (w.x - this._ptrSm.x) * k;
        this._ptrSm.y += (w.y - this._ptrSm.y) * k;
      }
    } else {
      this._ptrInit = false;
    }
  }

  private _lookAt(delay: number): { y: number; p: number; r: number } {
    const want = this._lookClock - (Number(delay) || 0);
    const h = this._lookHist;
    if (!h.length) return { y: this.look.yaw, p: this.look.pitch, r: this.look.roll };
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].t <= want) return { y: h[i].y, p: h[i].p, r: h[i].r };
    }
    return { y: h[0].y, p: h[0].p, r: h[0].r };
  }

  private _ptrRamp(n: number, thr: number, sc: number): number {
    const lo = thr * 0.6;
    const hi = thr * 1.4;
    if (!(hi > lo) || n <= lo) return 0;
    if (n >= hi) return sc;
    const u = (n - lo) / (hi - lo);
    return sc * (u * u * (3 - 2 * u));
  }

  apply(
    skeleton: SpineSkeleton | null,
    pc: ProjectConfig | undefined,
    dt: number,
    isOneShotBusy: boolean
  ): void {
    if (!skeleton) return;
    const look = this.look;
    const mul = this._lookMul;
    const yaw = look.yaw * mul;
    const pitch = look.pitch * mul;

    let fEyeX = 0;
    let fEyeY = 0;
    let fHeadX = 0;
    let fHeadY = 0;
    let fBodyX = 0;
    let fBodyY = 0;

    const maxR = Number(pc?.fingerTrackMaxRange) || 514;
    const on = this.pointer.on;
    const gr = pc?.gazeReturnToFront || {};
    const gcfg = on ? gr.entry || {} : gr.exit || {};
    let gmn = Number(gcfg.minSeconds);
    if (!(gmn > 0)) gmn = 0.4;
    let gmx = Number(gcfg.maxSeconds);
    if (!(gmx >= gmn)) gmx = Math.max(gmn, 0.8);
    let gsp = Number(gcfg.secondsPerDistance);
    if (!(gsp > 0)) gsp = 0.8;

    if (on) {
      const face = skeleton.findBone(pc?.fingerTrackCenterBone || 'rig_face') || skeleton.findBone('head');
      if (face) {
        let fx: number;
        let fy: number;
        if (isOneShotBusy) {
          if (!this._faceRef) this._faceRef = { x: face.worldX, y: face.worldY };
          fx = this._faceRef.x;
          fy = this._faceRef.y;
        } else {
          this._faceRef = { x: face.worldX, y: face.worldY };
          fx = face.worldX;
          fy = face.worldY;
        }

        let dx = this._ptrSm.x - fx;
        let dy = this._ptrSm.y - fy;
        const dist = Math.hypot(dx, dy);
        let n = maxR > 0 ? dist / maxR : 0;
        if (n > 1) {
          dx /= n;
          dy /= n;
          n = 1;
        }
        this._ptrN = n;
        fEyeX = dx;
        fEyeY = dy;
        fHeadX =
          dx *
          this._ptrRamp(
            n,
            Number(pc?.fingerTrackHeadThreshold) || 0.11,
            Number(pc?.fingerTrackHeadScale) || 0.7
          );
        fHeadY =
          dy *
          this._ptrRamp(
            n,
            Number(pc?.fingerTrackHeadThreshold) || 0.11,
            Number(pc?.fingerTrackHeadScale) || 0.7
          );
        fBodyX =
          dx *
          this._ptrRamp(
            n,
            Number(pc?.fingerTrackBodyThreshold) || 0.3,
            Number(pc?.fingerTrackBodyScale) || 0.55
          );
        fBodyY =
          dy *
          this._ptrRamp(
            n,
            Number(pc?.fingerTrackBodyThreshold) || 0.3,
            Number(pc?.fingerTrackBodyScale) || 0.55
          );
      }
    }

    const wantPtr = on ? 1 : 0;
    const sec = clamp(gsp * Math.max(0.25, this._ptrN), gmn, gmx);
    const dtL = dt > 0 ? dt : 0.016;
    this._ptrW += (wantPtr - this._ptrW) * (1 - Math.exp(-dtL / sec));
    if (!on && this._ptrW < 0.004) this._ptrW = 0;

    fEyeX *= this._ptrW * mul;
    fEyeY *= this._ptrW * mul;
    fHeadX *= this._ptrW * mul;
    fHeadY *= this._ptrW * mul;
    fBodyX *= this._ptrW * mul;
    fBodyY *= this._ptrW * mul;

    const unit = 110;
    let bodyScale = 0.55;
    let neckScale = 0.55;
    let bodyDelay = 0;
    let neckDelay = 0;
    let headDelay = 0;

    (look.followers || []).forEach((f) => {
      if (!f) return;
      const sc = Number(f.scale);
      if (f.part === 'body') {
        bodyScale = sc || sc === 0 ? sc : 0.55;
        bodyDelay = Number(f.delay) || 0;
      }
      if (f.part === 'neck') {
        neckScale = sc || sc === 0 ? sc : 0.55;
        neckDelay = Number(f.delay) || 0;
      }
      if (f.part === 'head') headDelay = Number(f.delay) || 0;
    });

    const scaleLook = (s: { y: number; p: number; r: number }, m: number) => ({
      y: s.y * m,
      p: s.p * m,
      r: s.r * m,
    });
    const headL = scaleLook(this._lookAt(headDelay), mul);
    const bodyL = scaleLook(this._lookAt(bodyDelay), mul);
    const neckL = scaleLook(this._lookAt(neckDelay), mul);

    const eyeDrv = Boolean(look.eyeDrv);
    const eyeK = eyeDrv ? 0.18 : 0.35;
    const headK = eyeDrv ? 0.18 : 1;

    const tgt: Record<string, [number, number]> = {
      eye: [yaw * eyeK * unit + fEyeX, -pitch * eyeK * unit * 0.85 + fEyeY],
      head: [headL.y * headK * unit + fHeadX, -headL.p * headK * unit * 0.85 + fHeadY],
      body: [
        bodyL.y * bodyScale * headK * unit + fBodyX,
        -bodyL.p * bodyScale * 0.8 * headK * unit * 0.85 + fBodyY,
      ],
      center: [yaw * 0.4 * headK * unit + fHeadX * 0.5, -pitch * 0.4 * headK * unit * 0.85 + fHeadY * 0.5],
      r_head: [headL.r * headK * 16, 0],
      r_neck: [neckL.r * neckScale * headK * 16 * neckScale, 0],
      r_body: [bodyL.r * bodyScale * headK * 16 * bodyScale * 0.6, 0],
    };
    if (!pc?.lockSittingAxis) {
      tgt.r_body2 = [bodyL.r * 0.2 * headK * 16 * 0.2, 0];
    }

    const aK = 1 - Math.exp(-dtL / 0.12);
    for (const k in tgt) {
      const t = tgt[k];
      if (!Number.isFinite(t[0]) || !Number.isFinite(t[1])) continue;
      let sm = this._aimSm[k];
      if (!sm || !Number.isFinite(sm[0]) || !Number.isFinite(sm[1])) {
        sm = this._aimSm[k] = [t[0], t[1]];
      } else {
        let dx = (t[0] - sm[0]) * aK;
        let dy = (t[1] - sm[1]) * aK;
        const cap = 600 * dtL;
        const mag = Math.hypot(dx, dy);
        if (mag > cap) {
          dx *= cap / mag;
          dy *= cap / mag;
        }
        sm[0] += dx;
        sm[1] += dy;
      }

      if (k.startsWith('r_')) {
        const rb = skeleton.findBone(`control_roll_${k.slice(2)}`);
        if (rb) rb.rotation += sm[0];
      } else {
        const ab = skeleton.findBone(`control_aim_${k}`);
        if (ab) {
          ab.x += sm[0];
          ab.y += sm[1];
        }
      }
    }
  }
}
