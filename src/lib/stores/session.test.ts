import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionStore, MEM_KEY, SAVE_KEY, type SaveSlotSnapshot } from './session.svelte';
import { config } from './config.svelte';
import { game } from './game.svelte';
import { memory } from './memory.svelte';
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
    session = new SessionStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Diary & Turn History', () => {
    it('appends to diary, persists to localStorage, and caps at 400 entries', () => {
      session.remember('user', 'First question');
      session.remember('ryza', 'First reply');

      expect(session.diary).toHaveLength(2);
      expect(session.diary[0].who).toBe('user');
      expect(session.diary[0].text).toBe('First question');
      expect(session.diary[1].who).toBe('ryza');

      const saved = JSON.parse(mockStorage.getItem(MEM_KEY) || '[]');
      expect(saved).toHaveLength(2);

      // Overfill beyond 400
      for (let i = 0; i < 410; i++) {
        session.remember('user', `Message ${i}`);
      }
      expect(session.diary).toHaveLength(400);
      expect(session.diary[session.diary.length - 1].text).toBe('Message 409');
    });

    it('loads existing diary from localStorage', () => {
      mockStorage.setItem(
        MEM_KEY,
        JSON.stringify([
          { who: 'user', text: 'Hello', at: 1000 },
          { who: 'ryza', text: 'Hi!', at: 2000 },
        ])
      );
      session.loadDiary();
      expect(session.diary).toHaveLength(2);
      expect(session.diary[0].text).toBe('Hello');
    });

    it('clears diary', () => {
      session.remember('user', 'test');
      expect(session.diary).toHaveLength(1);
      session.clearDiary();
      expect(session.diary).toHaveLength(0);
      expect(mockStorage.getItem(MEM_KEY)).toBe('[]');
    });

    it('manages turn history', () => {
      session.pushHistory({ role: 'user', content: 'Turn 1' });
      session.pushHistory({ role: 'assistant', content: 'Turn 1 answer' });
      expect(session.history).toHaveLength(2);

      session.clearHistory();
      expect(session.history).toHaveLength(0);
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
      config.set('state.stage', 'stage_01_001_04');
      config.set('state.day', 3);
      session.pushHistory({ role: 'user', content: 'Saved history' });
      session.remember('ryza', 'Saved diary');

      const ok = session.saveSlot(1);
      expect(ok).toBe(true);

      const slots = session.loadSlots();
      expect(slots[1]).not.toBeNull();
      expect(slots[1]?.day).toBe(3);
      expect(slots[1]?.history[0].content).toBe('Saved history');

      // Change active state
      config.set('state.day', 99);
      session.clearHistory();
      expect(session.history).toHaveLength(0);

      // Load slot 1
      const loadOk = session.loadSlot(1);
      expect(loadOk).toBe(true);
      expect(config.section('state').day).toBe(3);
      expect(session.history[0].content).toBe('Saved history');
    });

    it('rejects invalid slot index', () => {
      expect(session.saveSlot(-1)).toBe(false);
      expect(session.saveSlot(3)).toBe(false);
      expect(session.loadSlot(-1)).toBe(false);
      expect(session.loadSlot(3)).toBe(false);
    });
  });

  describe('Clock & Day Cycle', () => {
    it('tickDay increments state.day on date rollover', () => {
      config.set('state.day', 1);
      config.set('state.lastDayDate', 'Yesterday Date');

      session.tickDay();
      expect(config.section('state').day).toBe(2);
      expect(config.section('state').lastDayDate).toBe(new Date().toDateString());

      // Calling again on the same day does not double-increment
      session.tickDay();
      expect(config.section('state').day).toBe(2);
    });

    it('tickTime respects real time mode and updates tod', () => {
      config.set('app.timeMode', 'real');
      session.tickTime();
      const expectedTod = world.hourToTod(new Date().getHours());
      expect(config.section('state').tod).toBe(expectedTod);
    });

    it('tickTime respects manual mode without changing tod', () => {
      config.set('app.timeMode', 'manual');
      config.set('state.tod', 'ngt');
      session.tickTime();
      expect(config.section('state').tod).toBe('ngt');
    });

    it('refills stamina when transition from ngt to mor at home', () => {
      config.set('state.stage', 'stage_01_001_04');
      config.set('state.tod', 'ngt');
      game.spend(30, 'test');
      expect(game.stamina).toBeLessThan(game.max());

      session.setTod('mor');
      expect(config.section('state').tod).toBe('mor');
      expect(game.stamina).toBe(game.max());
    });
  });
});
