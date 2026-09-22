import type { CamParams, PostureCameraCatalog, SpineLayer, SpineAttachment } from './types';

export const REF_ZOOM = 1.93;
export const REF_H = 1720;

export function getCamParams(
  postureKey: string,
  asmr: boolean,
  postureCam: PostureCameraCatalog | null,
  cssW: number,
  cssH: number
): CamParams {
  const pack = (postureCam && postureCam[postureKey]) || (postureCam && postureCam.posture_sitting) || {};
  const base = pack.base || {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    cameraZoom: REF_ZOOM,
    cameraPanX: 0,
    cameraPanY: 900,
  };
  let zoom = Number(base.cameraZoom);
  if (!(zoom > 0.2)) zoom = REF_ZOOM;
  let panX = Number(base.cameraPanX) || 0;
  let panY = Number(base.cameraPanY) || 0;

  const a = asmr && pack.asmr;
  if (a) {
    const az = Number(a.cameraZoom);
    if (az > 0.2) {
      panY += (az / zoom - 1) * 280;
      zoom = az;
    }
    if (a.cameraPanX != null) panX = Number(a.cameraPanX) || 0;
  }

  const tight = zoom / REF_ZOOM;
  if (tight > 1.05) panY = panY + (tight - 1) * 140;
  let worldH = REF_H / Math.max(0.45, tight);

  if (!a) {
    if (postureKey === 'posture_standing') worldH *= 1.53;
    else if (postureKey === 'posture_sitting') worldH *= 1.45;
  }

  const aspect = cssW && cssH ? cssW / cssH : 0.5;
  const worldW = worldH * aspect;

  return {
    offsetX: Number(base.offsetX) || 0,
    offsetY: Number(base.offsetY) || 0,
    scale: Number(base.scale) || 1,
    zoom,
    panX,
    panY,
    worldW,
    worldH,
    left: panX - worldW / 2,
    bottom: panY - worldH / 2,
  };
}

type SpineConstructor<T = unknown> = new (...args: unknown[]) => T;

interface SpineRuntimeGlobal {
  Physics: { none: unknown; pose: unknown };
  BoundingBoxAttachment: SpineConstructor;
  ClippingAttachment: SpineConstructor;
  PathAttachment: SpineConstructor;
  PointAttachment: SpineConstructor;
  RegionAttachment: SpineConstructor<SpineAttachment>;
}

export function coverFor(L: SpineLayer | null): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  w: number;
  h: number;
} | null {
  if (!L || !L.skeleton) return null;
  if (L._coverDone) return L._cover || null;

  const spineObj = (window as unknown as { spine?: SpineRuntimeGlobal }).spine;
  if (!spineObj) return null;

  let best: { x0: number; x1: number; y0: number; y1: number; w: number; h: number } | null = null;
  const slots = L.skeleton.slots;

  L.skeleton.updateWorldTransform(spineObj.Physics.none);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot.bone.active || !slot.data.visible) continue;
    const att = slot.getAttachment ? slot.getAttachment() : null;
    if (
      !att ||
      att instanceof spineObj.BoundingBoxAttachment ||
      att instanceof spineObj.ClippingAttachment ||
      att instanceof spineObj.PathAttachment ||
      att instanceof spineObj.PointAttachment
    )
      continue;

    const verts: number[] = [];
    try {
      if (att instanceof spineObj.RegionAttachment && att.computeWorldVertices) {
        att.computeWorldVertices(slot, verts, 0, 2);
      } else if (att.worldVerticesLength && att.computeWorldVertices) {
        att.computeWorldVertices(slot, 0, att.worldVerticesLength, verts, 0, 2);
      } else {
        continue;
      }
    } catch {
      continue;
    }

    const n = verts.length;
    if (n < 6) continue;

    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    for (let j = 0; j < n; j += 2) {
      if (!isFinite(verts[j]) || !isFinite(verts[j + 1])) {
        x1 = -1e9;
        break;
      }
      if (verts[j] < x0) x0 = verts[j];
      if (verts[j] > x1) x1 = verts[j];
      if (verts[j + 1] < y0) y0 = verts[j + 1];
      if (verts[j + 1] > y1) y1 = verts[j + 1];
    }

    if (!(x1 > x0) || !(y1 > y0)) {
      const aVal = slot.bone.a ?? 1;
      if (!(att instanceof spineObj.RegionAttachment) || !att.width || !att.height || !isFinite(aVal))
        continue;
      const hw = att.width / 2;
      const hh = att.height / 2;
      const bn = slot.bone;
      const corners = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ];
      x0 = y0 = 1e9;
      x1 = y1 = -1e9;
      for (let j = 0; j < 4; j++) {
        const px = corners[j][0] * (bn.a ?? 1) + corners[j][1] * (bn.b ?? 0) + bn.worldX;
        const py = corners[j][0] * (bn.c ?? 0) + corners[j][1] * (bn.d ?? 1) + bn.worldY;
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
      }
      if (!(x1 > x0) || !(y1 > y0)) continue;
    }

    if (!best || (x1 - x0) * (y1 - y0) > best.w * best.h) {
      best = { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
    }
  }

  L._coverDone = true;
  L._cover = best;
  return best;
}
