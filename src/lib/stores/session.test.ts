import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionStore, SAVE_KEY, CHAT_HISTORY_KEY, type SaveSlotSnapshot } from './session.svelte';
import { config } from './config.svelte';
import { game } from './game.svelte';
import { memory } from './memory.svelte';
import { longMem } from './longmem.svelte';
import { world } from './world.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('SessionStore', () => {
  let mockStorage: LocalStorageMock;
  let session: SessionStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
    game.reset();
    memory.reset();
    longMem.reset();
    session = new SessionStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Turn History & Clear Sync', () => {
    it('manages turn history and persists to localStorage', () => {
      session.pushHistory({ role: 'user', content: 'Turn 1' });
      session.pushHistory({ role: 'assistant', content: 'Turn 1 answer', voiceKey: 'v_voice_1' });
      expect(session.history).toHaveLength(2);
      expect(session.history[1].voiceKey).toBe('v_voice_1');
      expect(session.history[0].id).toBeDefined();
      expect(session.history[0].at).toBeDefined();

      const raw = mockStorage.getItem(CHAT_HISTORY_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(2);
      expect(parsed[1].voiceKey).toBe('v_voice_1');
    });

    it('clearHistory clears session.history, memory.pending, and longMem.pending', () => {
      session.pushHistory({ role: 'user', content: 'Turn 1' });
      memory.ingest('Turn 1 user', 'Turn 1 reply');
      longMem.note('user', 'Long term note');

      expect(session.history).toHaveLength(1);
      expect(memory.pending.length).toBeGreaterThan(0);
      expect(longMem.pending.length).toBeGreaterThan(0);

      session.clearHistory();

      expect(session.history).toHaveLength(0);
      expect(mockStorage.getItem(CHAT_HISTORY_KEY)).toBe('[]');
      expect(memory.pending).toHaveLength(0);
      expect(longMem.pending).toHaveLength(0);
    });
  });

  describe('Save Slots', () => {
    it('initializes with 3 slots padded with null', () => {
      const slots = session.loadSlots();
      expect(slots).toHaveLength(3);
      expect(slots[0]).toBeNull();
      expect(slots[1]).toBeNull();
      expect(slots[2]).toBeNull();
    });

    it('saves and loads snapshots to slot index', () => {
      config.setState('stage', 'stage_01_001_04');
      config.setState('day', 3);
      session.pushHistory({ role: 'user', content: 'Saved history' });
      memory.add('Saved card', 'session');
      longMem.add('Saved fact');

      const ok = session.saveSlot(1);
      expect(ok).toBe(true);

      const slots = session.loadSlots();
      expect(slots[1]).not.toBeNull();
      expect(slots[1]?.day).toBe(3);
      expect(slots[1]?.history[0].content).toBe('Saved history');
      expect(slots[1]?.memory?.sessions).toHaveLength(1);
      expect(slots[1]?.longmem?.entries).toHaveLength(1);

      // Change active state
      config.setState('day', 99);
      session.clearHistory();
      memory.reset();
      longMem.reset();
      expect(session.history).toHaveLength(0);
      expect(memory.sessions).toHaveLength(0);
      expect(longMem.entries).toHaveLength(0);

      // Load slot 1
      const loadOk = session.loadSlot(1);
      expect(loadOk).toBe(true);
      expect(config.get('state').day).toBe(3);
      expect(session.history[0].content).toBe('Saved history');
      expect(memory.sessions).toHaveLength(1);
      expect(longMem.entries).toHaveLength(1);
    });

    it('rejects invalid slot index', () => {
      expect(session.saveSlot(-1)).toBe(false);
      expect(session.saveSlot(3)).toBe(false);
      expect(session.loadSlot(-1)).toBe(false);
      expect(session.loadSlot(3)).toBe(false);
    });

    it('handles localStorage quota exception gracefully', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const ok = session.saveSlot(0);
      expect(ok).toBe(false);

      setItemSpy.mockRestore();
    });

    it('rejects incomplete snapshot on load', () => {
      // @ts-expect-error test invalid snapshot shape
      expect(session.applySnapshot(null)).toBe(false);
      // @ts-expect-error test invalid snapshot shape
      expect(session.applySnapshot({ at: Date.now() })).toBe(false);
    });
  });

  describe('Clock & Day Cycle', () => {
    it('tickDay increments state.day on date rollover', () => {
      config.setState('day', 1);
      config.setState('lastDayDate', 'Yesterday Date');

      session.tickDay();
      expect(config.get('state').day).toBe(2);
      expect(config.get('state').lastDayDate).toBe(new Date().toDateString());

      // Calling again on the same day does not double-increment
      session.tickDay();
      expect(config.get('state').day).toBe(2);
    });

    it('tickTime respects real time mode and updates tod', () => {
      config.setApp('timeMode', 'real');
      session.tickTime();
      const expectedTod = world.hourToTod(new Date().getHours());
      expect(config.get('state').tod).toBe(expectedTod);
    });

    it('tickTime respects manual mode without changing tod', () => {
      config.setApp('timeMode', 'manual');
      config.setState('tod', 'ngt');
      session.tickTime();
      expect(config.get('state').tod).toBe('ngt');
    });

    it('refills stamina when transition from ngt to mor at home', () => {
      config.setState('stage', 'stage_01_001_04');
      config.setState('tod', 'ngt');
      game.spend(30, 'test');
      expect(game.stamina).toBeLessThan(game.max());

      session.setTod('mor');
      expect(config.get('state').tod).toBe('mor');
      expect(game.stamina).toBe(game.max());
    });
  });
});
