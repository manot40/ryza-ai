import { describe, expect, it } from 'vitest';
import { computeFitUiZoom, computePanelFrac } from './fit-ui';

describe('computeFitUiZoom', () => {
  it('returns 1.0 when not in shell', () => {
    const res = computeFitUiZoom(800, 1200, false, 1);
    expect(res.zoom).toBe(1);
    expect(res.changed).toBe(false);

    const changedRes = computeFitUiZoom(800, 1200, false, 1.2);
    expect(changedRes.zoom).toBe(1);
    expect(changedRes.changed).toBe(true);
  });

  it('keeps current zoom if width or height is 0', () => {
    const res = computeFitUiZoom(0, 800, true, 1.1);
    expect(res.zoom).toBe(1.1);
    expect(res.changed).toBe(false);
  });

  it('scales down on small screens within lower bound 0.8', () => {
    // 300 / 420 = ~0.71 -> clamped to 0.8
    const res = computeFitUiZoom(300, 600, true, 1);
    expect(res.zoom).toBe(0.8);
    expect(res.changed).toBe(true);
  });

  it('scales up on large screens within upper bound 1.25', () => {
    // 1000 / 420 = ~2.38 -> clamped to 1.25
    const res = computeFitUiZoom(1000, 1500, true, 1);
    expect(res.zoom).toBe(1.25);
    expect(res.changed).toBe(true);
  });

  it('suppresses tiny changes <= 0.02 to avoid oscillation', () => {
    // 420 x 860 => ideal 1.0
    // If current is 1.01, diff is 0.01 <= 0.02 => no change
    const res = computeFitUiZoom(420, 860, true, 1.01);
    expect(res.zoom).toBe(1.01);
    expect(res.changed).toBe(false);

    // If current is 0.95, diff is 0.05 > 0.02 => updates to 1.0
    const res2 = computeFitUiZoom(420, 860, true, 0.95);
    expect(res2.zoom).toBe(1);
    expect(res2.changed).toBe(true);
  });
});

describe('computePanelFrac', () => {
  it('computes fraction with minimum 240px and maximum 340px capped at 0.55', () => {
    // Small vh (e.g. 400px): target is 240px. 240 / 400 = 0.60 -> capped at 0.55
    expect(computePanelFrac(400)).toBe(0.55);

    // Normal vh (e.g. 800px): 0.34 * 800 = 272px. 272 / 800 = 0.34
    expect(computePanelFrac(800)).toBeCloseTo(0.34, 4);

    // Tall vh (e.g. 1200px): 0.34 * 1200 = 408px -> clamped to 340px. 340 / 1200 = ~0.2833
    expect(computePanelFrac(1200)).toBeCloseTo(340 / 1200, 4);
  });
});
