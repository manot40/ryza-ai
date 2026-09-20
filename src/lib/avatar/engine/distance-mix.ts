import { hashHex, swapHashHalves } from '../../util';
import type { MixDurationPoses, EmotionProfile, ProjectConfig } from './types';

export function isMixHashValid(bag: MixDurationPoses | undefined | null, liveSkelHash: string): boolean {
  if (!bag?.sourceHash || !liveSkelHash) return false;
  const src = hashHex(bag.sourceHash);
  const live = hashHex(liveSkelHash);
  if (!src || !live) return false;
  if (src === live) return true;
  if (swapHashHalves(src) === live) return true;
  if (src.slice(-live.length) === live || live.slice(-src.length) === src) return true;
  return false;
}

export function hasPoseBones(name: string, bag: MixDurationPoses | undefined | null): boolean {
  const poses = bag?.animPoses;
  const p = poses?.[name];
  if (!p) return false;
  for (const k in p) {
    if (Object.prototype.hasOwnProperty.call(p, k) && p[k] && p[k].length >= 2) {
      return true;
    }
  }
  return false;
}

export function calcPoseDistance(
  fromName: string,
  toName: string,
  bag: MixDurationPoses | undefined | null
): number {
  const poses = bag?.animPoses;
  const pa = poses?.[fromName];
  const pb = poses?.[toName];
  if (!pa || !pb) return 0;

  let sum = 0;
  let n = 0;
  for (const bone in pa) {
    if (!Object.prototype.hasOwnProperty.call(pa, bone)) continue;
    if (/control_|_IK|template_|aim_|roll_/i.test(bone)) continue;
    const a = pa[bone];
    const b = pb[bone];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    sum += Math.hypot(a[0] - b[0], a[1] - b[1]);
    n++;
  }
  return n > 0 ? sum / n : 0;
}

export function getMixRange(profile: EmotionProfile | undefined | null): { min: number; max: number } {
  let a = Number(profile?.mixDurationMin);
  if (!(a > 0)) a = 0.4;
  let b = Number(profile?.mixDurationMax);
  if (!(b > 0)) b = a;
  if (b < a) b = a;
  return { min: a, max: b };
}

export function calcOverlayMix(
  profile: EmotionProfile | undefined | null,
  pc: ProjectConfig | undefined | null
): number {
  const r = getMixRange(profile);
  let sat = Number(pc?.mixDurationSaturationRatio);
  if (!(sat > 0)) sat = 0.1;
  return r.min * sat;
}

export function calcMixDuration(
  fromName: string,
  toName: string,
  profile: EmotionProfile | undefined | null,
  bag: MixDurationPoses | undefined | null,
  liveSkelHash: string,
  pc: ProjectConfig | undefined | null,
  poseTypesOf: (animId: string) => string[]
): number {
  const r = getMixRange(profile);
  let sat = Number(pc?.mixDurationSaturationRatio);
  if (!(sat > 0)) sat = 0.1;
  const close = r.min * sat;
  if (!fromName || !toName || fromName === toName) return close;

  if (isMixHashValid(bag, liveSkelHash) || (hasPoseBones(fromName, bag) && hasPoseBones(toName, bag))) {
    const dist = calcPoseDistance(fromName, toName, bag);
    const t = 1 - Math.exp(-dist / 180);
    return close + t * (r.max - close);
  }

  const fromTypes = poseTypesOf(fromName);
  const toTypes = poseTypesOf(toName);
  const same = fromTypes.some((t) => toTypes.includes(t));
  if (same) {
    return close + Math.random() * (r.min * (1 - sat));
  }
  return r.min + Math.random() * (r.max - r.min);
}
