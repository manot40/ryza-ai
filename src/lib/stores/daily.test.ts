import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DailyStore, DAILY_KEY, REWARDS, todayStr, yesterdayStr } from './daily.svelte';
import { game } from './game.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('DailyStore', () => {
  let mockStorage: LocalStorageMock;
  let daily: DailyStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    game.reset();
    daily = new DailyStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('availability and streak calculation', () => {
    it('is available when not claimed today', () => {
      expect(daily.available()).toBe(true);
      expect(daily.streak()).toBe(0);
    });

    it('returns rewards for each streak index', () => {
      expect(daily.rewardFor(0).kind).toBe('stamina');
      expect(daily.rewardFor(1).kind).toBe('money');
      expect(daily.rewardFor(6).kind).toBe('chest');
    });

    it('resets streak if last claimed date was more than 1 day ago', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const pastDateStr = `${pastDate.getFullYear()}-${pastDate.getMonth() + 1}-${pastDate.getDate()}`;

      mockStorage.setItem(
        DAILY_KEY,
        JSON.stringify({
          lastDate: pastDateStr,
          streak: 4,
          claimedDays: [0, 1, 2, 3],
        })
      );

      const d = new DailyStore();
      expect(d.streak()).toBe(0);
      expect(d.s.claimedDays).toEqual([]);
      expect(d.available()).toBe(true);
    });

    it('maintains streak if last claimed date was yesterday', () => {
      mockStorage.setItem(
        DAILY_KEY,
        JSON.stringify({
          lastDate: yesterdayStr(),
          streak: 2,
          claimedDays: [0, 1],
        })
      );

      const d = new DailyStore();
      expect(d.streak()).toBe(2);
      expect(d.available()).toBe(true);
    });
  });

  describe('claiming rewards', () => {
    it('claims reward and applies it to game', () => {
      // Day 1 reward is stamina refill
      game.spend(30);
      expect(game.stamina).toBeLessThan(game.max());

      const res = daily.claim();
      expect(res.ok).toBe(true);
      expect(res.day).toBe(1);
      expect(daily.streak()).toBe(1);
      expect(daily.available()).toBe(false);
      expect(game.stamina).toBe(game.max());
    });

    it('rejects duplicate claims on the same day', () => {
      const res1 = daily.claim();
      expect(res1.ok).toBe(true);

      const res2 = daily.claim();
      expect(res2.ok).toBe(false);
      expect(res2.reason).toBe('done');
    });

    it('claims money reward correctly with day override', () => {
      const beforeMoney = game.money;
      // Day 2 (index 1) is 120G
      const res = daily.claim(1);
      expect(res.ok).toBe(true);
      expect(game.money).toBe(beforeMoney + 120);
    });
  });
});
