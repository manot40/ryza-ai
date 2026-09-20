import { describe, it, expect } from 'vitest';
import {
  isMixHashValid,
  hasPoseBones,
  calcPoseDistance,
  getMixRange,
  calcOverlayMix,
  calcMixDuration,
} from './distance-mix';

describe('distance-mix module', () => {
  it('validates skeleton mix hash compatibility', () => {
    expect(isMixHashValid(null, 'abc')).toBe(false);
    expect(isMixHashValid({ sourceHash: '' }, 'abc')).toBe(false);

    // Identical hash
    expect(isMixHashValid({ sourceHash: '0123456789abcdef' }, '0123456789abcdef')).toBe(true);

    // Swapped halves
    const hash = '12345678abcdef01';
    const swapped = 'abcdef0112345678';
    expect(isMixHashValid({ sourceHash: hash }, swapped)).toBe(true);

    // Prefix / Suffix match
    expect(isMixHashValid({ sourceHash: 'abcdef01' }, '0000abcdef01')).toBe(true);
    expect(isMixHashValid({ sourceHash: '0000abcdef01' }, 'abcdef01')).toBe(true);
  });

  it('checks if pose bones exist', () => {
    expect(hasPoseBones('idle', undefined)).toBe(false);
    expect(hasPoseBones('idle', { animPoses: {} })).toBe(false);
    expect(hasPoseBones('idle', { animPoses: { idle: {} } })).toBe(false);
    expect(hasPoseBones('idle', { animPoses: { idle: { bone1: [0, 0] } } })).toBe(true);
  });

  it('calculates euclidean average pose distance excluding control bones', () => {
    const bag = {
      animPoses: {
        poseA: {
          bone1: [0, 0],
          bone2: [10, 20],
          control_aim: [100, 100], // Should be filtered out
        },
        poseB: {
          bone1: [3, 4], // distance 5
          bone2: [10, 20], // distance 0
          control_aim: [0, 0],
        },
      },
    };
    // bone1 dist = 5, bone2 dist = 0, average = 2.5
    const dist = calcPoseDistance('poseA', 'poseB', bag);
    expect(dist).toBeCloseTo(2.5, 4);
  });

  it('derives mix ranges and overlay mixes', () => {
    expect(getMixRange(null)).toEqual({ min: 0.4, max: 0.4 });
    expect(getMixRange({ mixDurationMin: 0.3, mixDurationMax: 0.8 })).toEqual({ min: 0.3, max: 0.8 });

    const overlay = calcOverlayMix({ mixDurationMin: 0.5 }, { mixDurationSaturationRatio: 0.2 });
    expect(overlay).toBeCloseTo(0.1, 4);

    const defaultOverlay = calcOverlayMix(null, null);
    expect(defaultOverlay).toBeCloseTo(0.04, 4);
  });

  it('calculates mix duration between base poses', () => {
    const bag = {
      animPoses: {
        p1: { b: [0, 0] },
        p2: { b: [10, 0] },
      },
    };
    const dur = calcMixDuration(
      'p1',
      'p2',
      { mixDurationMin: 0.2, mixDurationMax: 1.0 },
      bag,
      '',
      { mixDurationSaturationRatio: 0.1 },
      () => []
    );
    expect(dur).toBeGreaterThanOrEqual(0.02);
    expect(dur).toBeLessThanOrEqual(1.0);
  });
});
