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
    expect(config.get('state').welcome.talk).toBe(true);

    for (const step of WELCOME_STEPS) {
      welcome.mark(step.id);
    }
    expect(welcome.allDone()).toBe(true);
  });

  it('manages 3-step groups and activity counters', () => {
    expect(welcome.groups).toHaveLength(3);
    const step1 = welcome.groups[0];
    const step2 = welcome.groups[1];

    expect(welcome.isOpen(step1)).toBe(true);
    expect(welcome.isOpen(step2)).toBe(false);

    welcome.bumpDay(3);
    expect(welcome.isOpen(step2)).toBe(true);

    welcome.markActivity('touch', 1);
    expect(welcome.activity('touch')).toBe(1);

    expect(welcome.groupDone(step1)).toBe(false);
  });
});
