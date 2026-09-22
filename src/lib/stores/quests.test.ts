import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuestStore } from './quests.svelte';
import { game } from './game.svelte';
import { config } from './config.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('QuestStore', () => {
  let mockStorage: LocalStorageMock;
  let quests: QuestStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
    game.reset();
    quests = new QuestStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('quest chain initialization', () => {
    it('initializes with the first main chain quest', () => {
      const q = quests.ensure();
      expect(q).toBeDefined();
      expect(q.no).toBe(1);
      expect(q.type).toBe('talk');
      expect(q.need).toBe(4);
      expect(q.step).toBe(0);
      expect(q.complete).toBe(false);
    });

    it('advances quest progress with matching type', () => {
      quests.advance('talk', 2);
      let q = quests.active();
      expect(q!.step).toBe(2);
      expect(q!.complete).toBe(false);

      // Non-matching type does not advance
      quests.advance('gather', 1);
      q = quests.active();
      expect(q!.step).toBe(2);
    });

    it('completes quest when step reaches need and advances chain', () => {
      const initialMoney = game.money;
      const initialExp = game.exp_total;

      // Quest 1 needs 4 talk steps
      quests.advance('talk', 4);
      const q1 = quests.active();
      expect(q1!.complete).toBe(true);

      // Claiming / taking next quest
      quests.takeNext();
      const q2 = quests.active();
      expect(q2!.no).toBe(2);
      expect(q2!.type).toBe('explore');
      expect(game.money).toBeGreaterThan(initialMoney);
      expect(game.exp_total).toBeGreaterThan(initialExp);
    });

    it('advances quest on takeNext even if pendingAdvance was not set in memory', () => {
      const q = quests.ensure();
      q.step = q.need;
      q.complete = true;
      quests.takeNext();
      const nextQ = quests.active();
      expect(nextQ!.no).toBe(q.no + 1);
    });
  });

  describe('deterministic action engine', () => {
    it('handles act_gather by granting items and advancing gather quest', () => {
      // Advance to quest 3 (gather quest)
      quests.takeChain(3);
      const q = quests.active();
      expect(q!.type).toBe('gather');

      const res = quests.doAction('gather', { stage: 'stage_01_001_01' });
      expect(res.ok).toBe(true);
      expect(quests.active()!.step).toBeGreaterThan(0);
    });

    it('handles act_craft by consuming ingredients and advancing craft quest', () => {
      // Quest 4 is craft
      quests.takeChain(4);
      const q = quests.active();
      expect(q!.type).toBe('craft');

      // RECIPES[0] is uni_bomb: [['uni', 1], ['wasser', 1]]
      game.addItem('you', 'uni', 2);
      game.addItem('you', 'wasser', 2);

      const res = quests.doAction('craft');
      expect(res.ok).toBe(true);
      expect(quests.active()!.step).toBe(1);
      expect(quests.active()!.complete).toBe(true);
    });

    it('handles act_shop by removing materials, adding money, and advancing shop quest', () => {
      // Quest 6 is shop
      quests.takeChain(6);
      const q = quests.active();
      expect(q!.type).toBe('shop');

      game.addItem('you', 'emeralia', 3);
      const beforeMoney = game.money;

      const res = quests.doAction('shop');
      expect(res.ok).toBe(true);
      expect(game.money).toBeGreaterThan(beforeMoney);
      expect(quests.active()!.step).toBe(1);
    });
  });

  describe('onQuestDelta integration', () => {
    it('processes quest delta from LLM state block', () => {
      quests.onQuestDelta({ advance: 2, type: 'talk' });
      expect(quests.active()!.step).toBe(2);

      quests.onQuestDelta({ clear: true });
      expect(quests.active()!.complete).toBe(true);
    });
  });

  describe('ship parts & sailing unlock', () => {
    it('sets game.sailed to true when quest #8 is completed', () => {
      quests.takeChain(8);
      expect(game.sailed).toBe(false);

      quests.clear();
      expect(game.sailed).toBe(true);
    });

    it('advances explore quest on progressEvent explore', () => {
      quests.takeChain(2);
      const q = quests.active();
      expect(q!.type).toBe('explore');
      expect(q!.step).toBe(0);

      quests.progressEvent('explore', 1);
      expect(quests.active()!.step).toBe(1);

      quests.progressEvent('explore', 1);
      expect(quests.active()!.step).toBe(2);
      expect(quests.active()!.complete).toBe(true);
    });

    it('outputs promptBlock with localized quest title, goal, and sailing status', () => {
      quests.takeChain(1);
      const block = quests.promptBlock();
      expect(block).toContain('No.1');
      expect(block).toContain('クーケン島');
      expect(block).toContain('造船部品：0/4');

      game.sailed = true;
      const sailedBlock = quests.promptBlock();
      expect(sailedBlock).toContain('出航済み');
    });
  });
});
