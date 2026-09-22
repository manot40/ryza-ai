import { describe, it, expect } from 'vitest';
import { getCamParams, REF_ZOOM, REF_H } from './camera';

describe('camera module', () => {
  it('derives default camera parameters when postureCam is null', () => {
    const params = getCamParams('posture_sitting', false, null, 1000, 2000);
    expect(params.zoom).toBe(REF_ZOOM);
    expect(params.panX).toBe(0);
    expect(params.panY).toBe(900);
    expect(params.worldH).toBeCloseTo(REF_H * 1.45, 1);
    expect(params.worldW).toBeCloseTo(params.worldH * 0.5, 1);
    expect(params.left).toBeCloseTo(-params.worldW / 2, 1);
    expect(params.bottom).toBeCloseTo(900 - params.worldH / 2, 1);
  });

  it('applies standing posture scaling factor', () => {
    const params = getCamParams('posture_standing', false, null, 1000, 2000);
    expect(params.worldH).toBeCloseTo(REF_H * 1.53, 1);
  });

  it('adjusts zoom and pan for asmr mode', () => {
    const catalog = {
      posture_sitting: {
        base: {
          cameraZoom: 1.93,
          cameraPanX: 0,
          cameraPanY: 900,
        },
        asmr: {
          cameraZoom: 3.5,
          cameraPanX: 50,
        },
      },
    };
    const params = getCamParams('posture_sitting', true, catalog, 1000, 2000);
    expect(params.zoom).toBe(3.5);
    expect(params.panX).toBe(50);
    expect(params.panY).toBeGreaterThan(900);
  });
});
