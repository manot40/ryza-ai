import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameStore, GAME_KEY, GAME_DEFAULTS } from './game.svelte';
import { ITEMS, BAGS, BAG_UPGRADE_COST } from './game-items';
import { config } from './config.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('GameStore', () => {
  let mockStorage: LocalStorageMock;
  let game: GameStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
    game = new GameStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('initialization and defaults', () => {
    it('initializes with default values', () => {
      expect(game.level()).toBe(1);
      expect(game.max()).toBe(60); // 50 + 1 * 10
      expect(game.stamina).toBe(60);
      expect(game.money).toBe(30);
      expect(game.bagYou).toBe('normal');
      expect(game.bagRyza).toBe('normal');
    });

    it('loads stored state from localStorage', () => {
      mockStorage.setItem(
        GAME_KEY,
        JSON.stringify({
          exp_total: 120,
          stamina: 45,
          money: 500,
          bagYou: 'large',
          bagRyza: 'normal',
          inventory: [{ id: 'uni', count: 5 }],
          ryza_inventory: [],
          met_charas: ['klaus'],
          met_pairs: [],
          memory: [],
          flags: { test: true },
          sailed: true,
        })
      );

      const loaded = new GameStore();
      expect(loaded.exp_total).toBe(120);
      expect(loaded.stamina).toBe(45);
      expect(loaded.money).toBe(500);
      expect(loaded.bagYou).toBe('large');
      expect(loaded.sailed).toBe(true);
      expect(loaded.countItem('you', 'uni')).toBe(5);
      expect(loaded.flag('test')).toBe(true);
    });
  });

  describe('stamina & economy', () => {
    it('spends and restores stamina correctly', () => {
      expect(game.spend(20)).toBe(true);
      expect(game.stamina).toBe(40);

      expect(game.spend(50)).toBe(false); // not enough stamina
      expect(game.stamina).toBe(40);

      game.restore(15);
      expect(game.stamina).toBe(55);

      game.restore(20);
      expect(game.stamina).toBe(game.max()); // capped at max
    });

    it('refills stamina to max', () => {
      game.spend(30);
      game.refill();
      expect(game.stamina).toBe(game.max());
    });

    it('adds and spends money', () => {
      game.addMoney(100);
      expect(game.money).toBe(130);
      expect(game.canPay(100)).toBe(true);
      expect(game.canPay(200)).toBe(false);

      game.addMoney(-50);
      expect(game.money).toBe(80);

      game.addMoney(-200);
      expect(game.money).toBe(0); // does not drop below 0
    });

    it('levels up with exp', () => {
      expect(game.level()).toBe(1);
      // level = 1 + floor(sqrt(exp / 30))
      // For level 2, need exp >= 30
      const leveled = game.addExp(30);
      expect(leveled).toBe(true);
      expect(game.level()).toBe(2);
      expect(game.max()).toBe(70);
    });
  });

  describe('inventory and bags', () => {
    it('adds and removes items', () => {
      game.addItem('you', 'apple', 3);
      expect(game.countItem('you', 'apple')).toBe(3);

      game.addItem('you', 'apple', 2);
      expect(game.countItem('you', 'apple')).toBe(5);

      const ok = game.removeItem('you', 'apple', 2);
      expect(ok).toBe(true);
      expect(game.countItem('you', 'apple')).toBe(3);

      const fail = game.removeItem('you', 'apple', 10);
      expect(fail).toBe(false);
      expect(game.countItem('you', 'apple')).toBe(3);
    });

    it('enforces bag capacity', () => {
      const cap = game.bagCap('you');
      expect(cap).toBe(BAGS.normal);

      // Fill bag to capacity with unique items
      const itemKeys = Object.keys(ITEMS);
      for (let i = 0; i < cap; i++) {
        game.addItem('you', itemKeys[i], 1);
      }
      expect(game.bagUsed('you')).toBe(cap);

      // Adding existing item stacks
      const existingKey = itemKeys[0];
      const initialCount = game.countItem('you', existingKey);
      game.addItem('you', existingKey, 1);
      expect(game.countItem('you', existingKey)).toBe(initialCount + 1);
    });

    it('upgrades bag when money is sufficient', () => {
      const upgradeCost = BAG_UPGRADE_COST.large;
      game.addMoney(upgradeCost);
      expect(game.bagYou).toBe('normal');

      const ok = game.upgradeBag('you');
      expect(ok).toBe(true);
      expect(game.bagYou).toBe('large');
      expect(game.bagCap('you')).toBe(BAGS.large);
    });
  });

  describe('applyDelta reducer', () => {
    it('applies state delta correctly', () => {
      const delta = {
        stamina: -10,
        money: 50,
        exp: 20,
        flags: { talked_with_ryza: true },
        inventory_add: [{ id: 'uni', n: 2 }],
        meet_charas: [{ id: 'klaudia', name: 'クラウディア' }],
      };

      game.applyDelta(delta);
      expect(game.stamina).toBe(50);
      expect(game.money).toBe(80);
      expect(game.exp_total).toBe(20);
      expect(game.flag('talked_with_ryza')).toBe(true);
      expect(game.countItem('you', 'uni')).toBe(2);
      expect(game.met_charas).toContain('klaudia');
    });

    it('applies absolute stamina/money values if specified', () => {
      game.applyDelta({ stamina_set: 35, money_set: 200 });
      expect(game.stamina).toBe(35);
      expect(game.money).toBe(200);
    });
  });

  describe('cheat mode behavior', () => {
    it('ignores stamina cost and money deduction when cheat is on', () => {
      config.set('app.cheat', true);
      expect(game.spend(9999)).toBe(true);
      expect(game.canAct(9999)).toBe(true);
      expect(game.canPay(9999)).toBe(true);
    });
  });

  describe('snapshots', () => {
    it('snapshots and restores state correctly', () => {
      game.addMoney(100);
      game.addItem('you', 'apple', 5);
      const snap = game.snapshot();

      game.addMoney(500);
      game.addItem('you', 'relic', 1);

      game.restoreSnapshot(snap);
      expect(game.money).toBe(130);
      expect(game.countItem('you', 'apple')).toBe(5);
      expect(game.countItem('you', 'relic')).toBe(0);
    });
  });
});
