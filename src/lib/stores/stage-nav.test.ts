import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stageNav } from './stage-nav.svelte';
import { config } from './config.svelte';
import { game } from './game.svelte';
import { world } from './world.svelte';
import { quests } from './quests.svelte';
import { overlayStore } from './overlay.svelte';
import { viewStore } from './view.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';

describe('StageNavigator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config._resetForTest();
    game.reset();
    overlayStore.closeAllSheets();
    overlayStore.closeFaint();
    viewStore.setView('talk');
  });

  describe('gotoStage', () => {
    it('blocks navigation when island departure is locked and area is outside area_01', () => {
      vi.spyOn(world, 'areaOf').mockReturnValue('area_02');
      vi.spyOn(world, 'locked').mockReturnValue(true);
      const loadSceneSpy = vi.spyOn(avatarService, 'loadScene');

      stageNav.gotoStage('stage_02_001_01');

      expect(config.get('state').stage).not.toBe('stage_02_001_01');
      expect(loadSceneSpy).not.toHaveBeenCalled();
    });

    it('navigates to valid unlocked stage and updates viewStore to talk', () => {
      vi.spyOn(world, 'areaOf').mockReturnValue('area_01');
      vi.spyOn(world, 'locked').mockReturnValue(false);
      const loadSceneSpy = vi.spyOn(avatarService, 'loadScene');
      const progressSpy = vi.spyOn(quests, 'progressEvent');

      stageNav.gotoStage('stage_01_001_01');

      expect(config.get('state').stage).toBe('stage_01_001_01');
      expect(loadSceneSpy).toHaveBeenCalledWith('stage_01_001_01', expect.any(String));
      expect(progressSpy).toHaveBeenCalledWith('explore');
      expect(viewStore.activeView).toBe('talk');
    });
  });

  describe('sleepHome', () => {
    it('moves stage to home, refills stamina, and closes faint overlay', () => {
      game.spend(30, 'test');
      expect(game.stamina).toBeLessThan(game.max());
      overlayStore.showFaint();
      expect(overlayStore.faintOpen).toBe(true);

      stageNav.sleepHome();

      expect(config.get('state').stage).toBe('stage_01_001_04');
      expect(game.stamina).toBe(game.max());
      expect(overlayStore.faintOpen).toBe(false);
      expect(viewStore.activeView).toBe('talk');
    });
  });

  describe('onSailed and showFaint', () => {
    it('onSailed routes to world map view', () => {
      stageNav.onSailed();
      expect(viewStore.activeView).toBe('world');
    });

    it('showFaint opens faint overlay and sets crying emotion', () => {
      const setEmotionSpy = vi.spyOn(avatarService, 'setEmotion');
      stageNav.showFaint();

      expect(overlayStore.faintOpen).toBe(true);
      expect(setEmotionSpy).toHaveBeenCalledWith('crying', 'deny');
    });
  });

  describe('applySceneDelta', () => {
    it('triggers sleepHome when delta specifies sleep', () => {
      const sleepSpy = vi.spyOn(stageNav, 'sleepHome');
      stageNav.applySceneDelta({ sleep: true });
      expect(sleepSpy).toHaveBeenCalled();
    });

    it('navigates to new stage when stage delta is provided', () => {
      vi.spyOn(world, 'resolveStage').mockReturnValue('stage_01_001_01');
      const gotoSpy = vi.spyOn(stageNav, 'gotoStage');
      stageNav.applySceneDelta({ stage: 'stage_01_001_01' });
      expect(gotoSpy).toHaveBeenCalledWith('stage_01_001_01');
    });
  });
});
