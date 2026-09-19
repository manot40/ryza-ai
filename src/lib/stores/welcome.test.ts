import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WelcomeStore, WELCOME_STEPS } from './welcome.svelte';
import { config } from './config.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('WelcomeStore', () => {
  let mockStorage: LocalStorageMock;
  let welcome: WelcomeStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
    welcome = new WelcomeStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exposes the 5 welcome steps', () => {
    expect(welcome.steps.length).toBe(5);
    expect(welcome.steps.map((s) => s.id)).toEqual(['talk', 'map', 'alarm', 'skin', 'quest']);
  });

  it('marks steps as done and updates config store', () => {
    expect(welcome.done('talk')).toBe(false);
    expect(welcome.allDone()).toBe(false);

    welcome.mark('talk');
    expect(welcome.done('talk')).toBe(true);
    expect(config.section('state').welcome.talk).toBe(true);

    for (const step of WELCOME_STEPS) {
      welcome.mark(step.id);
    }
    expect(welcome.allDone()).toBe(true);
  });
});
