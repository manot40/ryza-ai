import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAndroid, computeImeAdjustment, ImeViewportTracker, imeViewport } from './ime-viewport';

describe('ime-viewport action and helpers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('isAndroid UA detection', () => {
    it('detects Android user agents', () => {
      expect(
        isAndroid(
          'Mozilla/5.0 (Linux; U; Android 14; en-us; Pixel 7 Build/UQ1A.240105.004) AppleWebKit/537.36'
        )
      ).toBe(true);
      expect(isAndroid('android')).toBe(true);
    });

    it('returns false for desktop and iOS user agents', () => {
      expect(
        isAndroid(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0'
        )
      ).toBe(false);
      expect(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15')).toBe(
        false
      );
      expect(isAndroid('')).toBe(false);
    });
  });

  describe('computeImeAdjustment', () => {
    it('returns empty styles when height is normal', () => {
      const adj = computeImeAdjustment(800, 800);
      expect(adj.isImeOpen).toBe(false);
      expect(adj.height).toBe('');
      expect(adj.top).toBe('');
      expect(adj.bottom).toBe('');
    });

    it('pins height and anchors to bottom when height is reduced by keyboard', () => {
      // 800 - 500 = 300 diff > 40 threshold
      const adj = computeImeAdjustment(800, 500);
      expect(adj.isImeOpen).toBe(true);
      expect(adj.height).toBe('800px');
      expect(adj.top).toBe('auto');
      expect(adj.bottom).toBe('0px');
    });

    it('ignores small jitter below threshold', () => {
      const adj = computeImeAdjustment(800, 780, 40); // 20 diff <= 40
      expect(adj.isImeOpen).toBe(false);
      expect(adj.height).toBe('');
    });
  });

  describe('ImeViewportTracker', () => {
    it('recalibrates baseline on width change (screen rotation)', () => {
      const tracker = new ImeViewportTracker(400, 800);
      const res = tracker.handleResize(800, 400);

      expect(res.changedBaseline).toBe(true);
      expect(tracker.lastW).toBe(800);
      expect(tracker.fullH).toBe(400);
      expect(res.adjustment.isImeOpen).toBe(false);
    });

    it('detects IME open when width unchanged and height drops', () => {
      const tracker = new ImeViewportTracker(400, 800);
      const res = tracker.handleResize(400, 480);

      expect(res.changedBaseline).toBe(false);
      expect(tracker.fullH).toBe(800);
      expect(res.adjustment.isImeOpen).toBe(true);
      expect(res.adjustment.height).toBe('800px');
    });

    it('recovers full height when keyboard closes', () => {
      const tracker = new ImeViewportTracker(400, 800);
      tracker.handleResize(400, 480);
      const res = tracker.handleResize(400, 800);

      expect(res.adjustment.isImeOpen).toBe(false);
      expect(res.adjustment.height).toBe('');
    });
  });

  describe('imeViewport action integration', () => {
    it('does nothing when not on Android', () => {
      const mockNode = { style: { height: '', top: '', bottom: '' } } as HTMLElement;
      vi.stubGlobal('navigator', { userAgent: 'Windows' });
      vi.stubGlobal('window', { innerWidth: 400, innerHeight: 800 });

      const action = imeViewport(mockNode);
      expect(typeof action.destroy).toBe('function');
      action.destroy();
    });

    it('attaches and handles resize when on Android', () => {
      const listeners: Record<string, () => void> = {};
      const mockNode = { style: { height: '', top: '', bottom: '' } } as HTMLElement;

      vi.stubGlobal('navigator', { userAgent: 'Android 14' });
      vi.stubGlobal('window', {
        innerWidth: 400,
        innerHeight: 800,
        addEventListener: vi.fn((ev: string, cb: () => void) => {
          listeners[ev] = cb;
        }),
        removeEventListener: vi.fn(),
      });

      const action = imeViewport(mockNode);
      expect(listeners['resize']).toBeDefined();

      // Simulate keyboard open
      (window as unknown as { innerHeight: number }).innerHeight = 450;
      listeners['resize']();

      expect(mockNode.style.height).toBe('800px');
      expect(mockNode.style.top).toBe('auto');
      expect(mockNode.style.bottom).toBe('0px');

      action.destroy();
    });
  });
});
