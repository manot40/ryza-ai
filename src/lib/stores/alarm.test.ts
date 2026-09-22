import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlarmStore, ALARM_KEY, todForHour } from './alarm.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('AlarmStore', () => {
  let mockStorage: LocalStorageMock;
  let alarm: AlarmStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    alarm = new AlarmStore();
  });

  afterEach(() => {
    alarm.stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('todForHour', () => {
    it('maps hours to time-of-day categories correctly', () => {
      expect(todForHour(3)).toBe('night');
      expect(todForHour(7)).toBe('morning');
      expect(todForHour(13)).toBe('daytime');
      expect(todForHour(19)).toBe('evening');
      expect(todForHour(23)).toBe('night');
    });
  });

  describe('CRUD operations', () => {
    it('adds an alarm with generated id and default properties', () => {
      const item = alarm.add({
        time: '07:30',
        type: 'goodMorning',
      });

      expect(item.id).toBeDefined();
      expect(item.time).toBe('07:30');
      expect(item.enabled).toBe(true);
      expect(item.snoozeMin).toBe(5);
      expect(item.volume).toBe(1);
      expect(item.vibrate).toBe(true);
      expect(alarm.items.length).toBe(1);
    });

    it('toggles an alarm', () => {
      const item = alarm.add({ time: '08:00' });
      expect(item.enabled).toBe(true);

      alarm.toggle(item.id);
      expect(alarm.get(item.id)?.enabled).toBe(false);

      alarm.toggle(item.id);
      expect(alarm.get(item.id)?.enabled).toBe(true);
    });

    it('updates an alarm', () => {
      const item = alarm.add({ time: '08:00' });
      alarm.update(item.id, { time: '08:30', style: 'whisper' });

      const updated = alarm.get(item.id);
      expect(updated?.time).toBe('08:30');
      expect(updated?.style).toBe('whisper');
    });

    it('removes an alarm', () => {
      const item = alarm.add({ time: '09:00' });
      expect(alarm.items.length).toBe(1);

      alarm.remove(item.id);
      expect(alarm.items.length).toBe(0);
      expect(alarm.get(item.id)).toBeNull();
    });
  });

  describe('snooze functionality', () => {
    it('sets _snoozeUntil based on snoozeMin', () => {
      const item = alarm.add({ time: '07:00', snoozeMin: 10 });
      alarm.snooze(item);

      expect(item._snoozeUntil).toBeDefined();
      expect(typeof item._snoozeUntil).toBe('string');
      expect(item._snoozeUntil).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('ticking and firing', () => {
    it('fires when time matches', () => {
      const onFire = vi.fn();
      const mockDate = new Date(2026, 0, 1, 7, 30); // 07:30

      const item = alarm.add({ time: '07:30', enabled: true });
      alarm.setVoiceBank(() => 'mock-clip-url');

      alarm._tick(onFire, mockDate);
      expect(onFire).toHaveBeenCalledWith(item, 'mock-clip-url');

      // Does not double fire in the same minute
      alarm._tick(onFire, mockDate);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('respects days of the week', () => {
      const onFire = vi.fn();
      // Suppose day is Monday (dow = 1)
      const mondayDate = new Date(2026, 0, 5, 8, 0); // Jan 5 2026 was Monday
      expect(mondayDate.getDay()).toBe(1);

      // Alarm only for Sunday (0)
      alarm.add({ time: '08:00', days: [0] });
      alarm._tick(onFire, mondayDate);
      expect(onFire).not.toHaveBeenCalled();

      // Alarm for Monday (1)
      const itemMon = alarm.add({ time: '08:00', days: [1] });
      alarm._tick(onFire, mondayDate);
      expect(onFire).toHaveBeenCalledWith(itemMon, null);
    });
  });

  describe('loadEnv', () => {
    it('loads envelope data from URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ durationMs: 1200, envelope: [0.1, 0.5] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const env = await alarm.loadEnv('assets/audio/alarm/sample.m4a');
      expect(env).toEqual({ durationMs: 1200, envelope: [0.1, 0.5] });
      expect(mockFetch).toHaveBeenCalledWith('assets/audio/alarm/sample.env.json');
    });
  });
});
