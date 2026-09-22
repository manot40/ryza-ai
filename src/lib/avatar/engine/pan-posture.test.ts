import { describe, it, expect, beforeEach } from 'vitest';
import { AvatarEngine } from './avatar-engine';
import { config } from '$lib/stores/config.svelte';

describe('AvatarEngine pan and posture', () => {
  let engine: AvatarEngine;

  beforeEach(() => {
    engine = new AvatarEngine();
    engine.skinsIndex = [
      { id: 'crf_skn_002_0001_01', name: 'Default Sit', hasSpine: true, skel: 'skel1' },
      { id: 'crf_skn_002_0001_99', name: 'Default Stand', hasSpine: true, skel: 'skel2' },
      { id: 'crf_skn_002_0002_01', name: 'Bikini Sit', hasSpine: true, skel: 'skel3' }, // single posture
    ];
  });

  it('detects available outfit postures from skins index', () => {
    const dual = engine.outfitPostures('crf_skn_002_0001');
    expect(dual).toContain('posture_standing');
    expect(dual).toContain('posture_sitting');
    expect(dual).toHaveLength(2);

    const single = engine.outfitPostures('crf_skn_002_0002');
    expect(single).toEqual(['posture_sitting']);
  });

  it('determines if current outfit is posture-switchable', () => {
    config.setState('skin', 'crf_skn_002_0001_99');
    expect(engine.postureSwitchable()).toBe(true);

    config.setState('skin', 'crf_skn_002_0002_01');
    expect(engine.postureSwitchable()).toBe(false);
  });

  it('falls back postureKey correctly if current outfit lacks desired posture', () => {
    config.setState('skin', 'crf_skn_002_0002_01');
    config.setState('posture', 'posture_standing');
    // Skin 0002 only has posture_sitting, so postureKey should resolve to posture_sitting
    expect(engine.postureKey()).toBe('posture_sitting');
  });

  it('handles shouldResetPosture correctly', () => {
    config.setState('skin', 'crf_skn_002_0001_99');
    config.setState('posture', 'posture_standing');
    expect(engine.shouldResetPosture()).toBe(false);

    config.setState('posture', 'posture_sitting');
    expect(engine.shouldResetPosture()).toBe(true);
  });

  it('handles panBy and resets pan on zoomReset', () => {
    // Initial pan is (0, 0)
    expect(engine.charPan()).toEqual({ x: 0, y: 0 });

    // Mock _view for pan calculation
    (engine as unknown as { _view: unknown })._view = {
      left: -500,
      bottom: -1000,
      worldW: 1000,
      worldH: 2000,
      cssW: 500,
      cssH: 1000,
    };

    engine.panBy(50, -30);
    const pan = engine.charPan();
    expect(pan.x).toBeGreaterThan(0);
    expect(pan.y).toBeGreaterThan(0);

    // Pan should be clamped by PLAYER_PAN_LIMIT (0.35 * world span)
    engine.panBy(99999, 99999);
    const clamped = engine.charPan();
    expect(clamped.x).toBeLessThanOrEqual(1000 * 0.35);
    expect(clamped.y).toBeLessThanOrEqual(2000 * 0.35);

    // zoomReset should clear pan back to (0, 0)
    engine.zoomReset();
    expect(engine.charPan()).toEqual({ x: 0, y: 0 });
    expect(engine.playerZoom()).toBe(1.0);
  });
});
