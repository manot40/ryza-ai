import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getScreenTagState,
  buildScopedStageBlock,
  buildPeopleBlock,
  buildClockBlock,
  buildRpgContext,
  buildTurnPromptPackage,
  VALID_ITEM_IDS,
} from './prompt-context';
import { config } from '$lib/stores/config.svelte';
import { game } from '$lib/stores/game.svelte';
import { world } from '$lib/stores/world.svelte';
import { quests } from '$lib/stores/quests.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';

const mockHierarchy = {
  areas: [
    {
      id: 'area_01',
      name: 'クーケン島周辺地域',
      fields: [
        {
          id: 'field_01_001',
          name: 'クーケン島',
          stages: [
            { id: 'stage_01_001_01', name: '尖塔の貯水池' },
            { id: 'stage_01_001_04', name: 'ライザの家' },
          ],
        },
      ],
    },
    {
      id: 'area_02',
      name: 'クレリア地方',
      fields: [
        {
          id: 'field_02_001',
          name: '採掘街道',
          stages: [{ id: 'stage_02_001_01', name: '旧採掘場跡' }],
        },
      ],
    },
  ],
};

describe('prompt-context', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    config._resetForTest();
    game.reset();
    await world.init({
      hierarchy: mockHierarchy,
      npcs: { npcs: [] },
      stageMap: {},
      scenes: {},
    });
  });

  describe('getScreenTagState', () => {
    it('extracts avatar emotion, attitude, stage, and tod', () => {
      avatarService.setEmotion('happy', 'agree');
      config.setState('stage', 'stage_01_001_04');
      config.setState('tod', 'mor');

      const tagState = getScreenTagState();
      expect(tagState.emotion).toBe('happy');
      expect(tagState.attitude).toBe('agree');
      expect(tagState.stage).toBe('stage_01_001_04');
      expect(tagState.tod).toBe('mor');
    });
  });

  describe('buildScopedStageBlock', () => {
    it('scopes stage list to current area instead of dumping all world areas', () => {
      config.setState('stage', 'stage_01_001_04');
      const block = buildScopedStageBlock({ stage: 'stage_01_001_04', tod: 'mor' });

      expect(block).toContain('## いまの場所');
      expect(block).toContain('stage_01_001_04');
      // Should not contain stages from outside area_01 when in area_01
      expect(block).not.toContain('stage_02_001_01');
      expect(block).not.toContain('stage_03_001_01');
    });
  });

  describe('buildClockBlock', () => {
    it('formats current day and time of day label', () => {
      config.setState('day', 3);
      config.setState('tod', 'aft');

      const clock = buildClockBlock(config.get('state'));
      expect(clock).toContain('同伴 3日目');
    });
  });

  describe('buildRpgContext', () => {
    it('includes player stats, active quest, and valid item IDs', () => {
      const rpg = buildRpgContext(config.get('state'));

      expect(rpg).toContain('## ゲーム状態');
      expect(rpg).toContain('レベル');
      expect(rpg).toContain('スタミナ');
      expect(rpg).toContain('所持金');
      expect(rpg).toContain('## クエスト');
      expect(rpg).toContain('有効なアイテムID:');
      VALID_ITEM_IDS.slice(0, 5).forEach((id) => {
        expect(rpg).toContain(id);
      });
    });
  });

  describe('buildTurnPromptPackage', () => {
    it('assembles complete turn prompt package with screen tag line', () => {
      const pkg = buildTurnPromptPackage('Hello Ryza!');

      expect(pkg.rpgContext).toBeTruthy();
      expect(pkg.sceneSection).toBeTruthy();
      expect(pkg.tagState).toBeDefined();
      expect(pkg.screenTagLine).toMatch(/^\[emotion:[^\]]+\]$/);
    });
  });
});
