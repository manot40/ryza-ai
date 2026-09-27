import { config } from '$lib/stores/config.svelte';
import { game } from '$lib/stores/game.svelte';
import { quests } from '$lib/stores/quests.svelte';
import { world } from '$lib/stores/world.svelte';
import { session, HOME_STAGE } from '$lib/stores/session.svelte';
import { overlayStore } from '$lib/stores/overlay.svelte';
import { viewStore } from '$lib/stores/view.svelte';
import { toast } from '$lib/stores/toast.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { sound } from '$lib/audio/sound';

const tlNoShip = 'No ship, no leaving Kurken Island (finish Main Quest 8)';
const tlTravel = (label: string) => `Travel: ${label}`;
const tlRestSafely = 'Rested safely at home — stamina fully restored!';
const tlYouSailed = 'You sailed! The world map is open';

export class StageNavigator {
  gotoStage(stageId: string): void {
    const areaId = world.areaOf(stageId);
    if (areaId && world.locked(areaId)) {
      toast.err(tlNoShip);
      return;
    }

    const st = config.get('state');
    config.setState('stage', stageId);
    if (avatarService.shouldResetPosture()) {
      config.setState('posture', 'posture_standing');
    }

    const tod = String(st.tod || 'aft');
    avatarService.loadScene(stageId, tod);
    sound.setPlace(stageId, tod, world.backgroundFor(stageId));
    sound.setRoute('talk');

    const place = world.find(stageId);
    if (place) {
      toast.show(tlTravel(world.placeLabel(stageId, place.stage)));
    }

    const npcs = world.npcsAt(stageId, Number(st.day) || 1);
    const names = game.meetCharas(npcs);
    if (names.length) {
      // @wc-ignore
      game.remember(names.join('、') + ' と出会った。');
    }

    quests.progressEvent('explore');
    viewStore.setView('talk');
  }

  sleepHome(): void {
    const st = config.get('state');
    const fromStage = String(st.stage || HOME_STAGE);
    let tod = String(st.tod || 'aft');
    config.setState('stage', HOME_STAGE);

    if (world.llmDrivesClock()) {
      tod = 'mor';
      config.setState({
        tod: 'mor',
        gameHour: world.todStartHour('mor'),
        gameClockAt: Date.now(),
      });
    }

    avatarService.loadScene(HOME_STAGE, tod);
    sound.setPlace(HOME_STAGE, tod, world.backgroundFor(HOME_STAGE));
    game.refill();
    // @wc-ignore
    game.remember('安全なおうちでぐっすり眠った。');
    if (fromStage !== HOME_STAGE) {
      quests.progressEvent('explore');
    }
    overlayStore.closeFaint();
    viewStore.setView('talk');
    toast.show(tlRestSafely);
  }

  onSailed(): void {
    // @wc-ignore
    game.remember('船でクーケン島を出航した！');
    toast.show(tlYouSailed);
    viewStore.setView('world');
  }

  showFaint(): void {
    overlayStore.showFaint();
    avatarService.setEmotion('crying', 'deny');
  }

  applySceneDelta(d: Record<string, unknown>): void {
    if (!d || typeof d !== 'object') return;
    const scene = (d.scene && typeof d.scene === 'object' ? d.scene : {}) as Record<string, unknown>;

    const sleep = d.sleep === true || d.sleep === 'true' || d.sleep === 1 || scene.sleep === true;
    if (sleep) {
      this.sleepHome();
      return;
    }

    const raw = (d.current_stage || d.stage || d.map_move || scene.current_stage) as string | undefined;
    const s = config.get('state');
    const fromStage = String(s.stage || HOME_STAGE);
    const fromTod = String(s.tod || 'aft');
    let dest = fromStage;

    if (raw != null && String(raw).trim()) {
      const id = world.resolveStage(String(raw).trim());
      if (id) {
        const area = world.areaOf(id);
        if (area && world.locked(area)) {
          toast.err(tlNoShip);
        } else {
          dest = id;
        }
      }
    }

    let nextTod = fromTod;
    if (world.llmDrivesClock()) {
      const tod = (d.tod || d.time_bucket || scene.time_bucket) as string | undefined;
      const gh = Number(d.game_hour != null ? d.game_hour : NaN);
      const adv = Number(
        d.time_advance != null ? d.time_advance : d.advance_hours != null ? d.advance_hours : NaN
      );

      let cur = Number(s.gameHour);
      if (!(cur >= 0 && cur < 24)) cur = 12;
      const nowMs = Date.now();

      if (!isNaN(gh)) cur = ((gh % 24) + 24) % 24;
      else if (!isNaN(adv)) cur = (((cur + adv) % 24) + 24) % 24;
      else if (tod && world.isTod(tod) && tod !== fromTod) cur = world.todStartHour(tod);
      else {
        cur = world.flowHour(
          cur,
          Number(s.gameClockAt) || nowMs,
          nowMs,
          Number(config.get('app')?.flowSpeed) || 1
        );
      }

      config.setState({
        gameHour: cur,
        gameClockAt: nowMs,
      });
      nextTod = world.hourToTod(cur);
    }

    if (fromTod === 'ngt' && nextTod === 'mor' && dest === HOME_STAGE) {
      game.refill();
      // @wc-ignore
      game.remember('安全なおうちでぐっすり眠った。');
      toast.show(tlRestSafely);
    }

    if (nextTod !== fromTod) {
      session.setTod(nextTod);
    }

    if (dest !== fromStage) {
      this.gotoStage(dest);
    }
  }
}

export const stageNav = new StageNavigator();
export default stageNav;
