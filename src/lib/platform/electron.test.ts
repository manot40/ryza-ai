import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isElectron,
  getRyzaShell,
  isTopmost,
  setTopmost,
  minimizeWindow,
  closeWindow,
  initElectronShell,
  type RyzaShell,
} from './electron';

describe('electron platform shim', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('detects when not running in Electron (window undefined or no ryzaShell)', async () => {
    vi.stubGlobal('window', {});
    expect(isElectron()).toBe(false);
    expect(getRyzaShell()).toBeNull();
    expect(await isTopmost()).toBe(false);
    expect(await setTopmost(true)).toBe(false);
  });

  it('detects when running in Electron and interacts with ryzaShell', async () => {
    let topmostState = false;
    const mockShell: RyzaShell = {
      isTopmost: vi.fn(async () => topmostState),
      setTopmost: vi.fn(async (top: boolean) => {
        topmostState = top;
        return topmostState;
      }),
      minimize: vi.fn(),
      close: vi.fn(),
    };

    const mockClassList = {
      classes: new Set<string>(),
      add(cls: string) {
        this.classes.add(cls);
      },
      contains(cls: string) {
        return this.classes.has(cls);
      },
    };

    vi.stubGlobal('window', { ryzaShell: mockShell });
    vi.stubGlobal('document', { body: { classList: mockClassList } });

    expect(isElectron()).toBe(true);
    expect(getRyzaShell()).toBe(mockShell);

    expect(await isTopmost()).toBe(false);
    expect(await setTopmost(true)).toBe(true);
    expect(mockShell.setTopmost).toHaveBeenCalledWith(true);
    expect(await isTopmost()).toBe(true);

    minimizeWindow();
    expect(mockShell.minimize).toHaveBeenCalledTimes(1);

    closeWindow();
    expect(mockShell.close).toHaveBeenCalledTimes(1);

    initElectronShell();
    expect(mockClassList.contains('shell-electron')).toBe(true);
  });
});
