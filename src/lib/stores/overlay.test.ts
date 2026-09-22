import { describe, it, expect, beforeEach } from 'vitest';
import { OverlayStore } from './overlay.svelte';

describe('OverlayStore', () => {
  let store: OverlayStore;

  beforeEach(() => {
    store = new OverlayStore();
  });

  it('initializes with all sheets and overlays closed', () => {
    expect(store.modeSheetOpen).toBe(false);
    expect(store.invSheetOpen).toBe(false);
    expect(store.statusSheetOpen).toBe(false);
    expect(store.npcSheetOpen).toBe(false);
    expect(store.langSheetOpen).toBe(false);
    expect(store.faintOpen).toBe(false);
    expect(store.alarmOpen).toBe(false);
    expect(store.questClearOpen).toBe(false);
  });

  it('opens and closes specific sheets', () => {
    store.openSheet('mode');
    expect(store.modeSheetOpen).toBe(true);

    store.closeSheet('mode');
    expect(store.modeSheetOpen).toBe(false);

    store.openSheet('inv', { invBag: 'ryza' });
    expect(store.invSheetOpen).toBe(true);
    expect(store.invBag).toBe('ryza');

    store.openSheet('npc', { npcStageId: 'stage_test' });
    expect(store.npcSheetOpen).toBe(true);
    expect(store.npcStageId).toBe('stage_test');
  });

  it('closes all sheets at once', () => {
    store.openSheet('mode');
    store.openSheet('status');
    store.closeAllSheets();
    expect(store.modeSheetOpen).toBe(false);
    expect(store.statusSheetOpen).toBe(false);
  });

  it('manages faint overlay state', () => {
    store.showFaint();
    expect(store.faintOpen).toBe(true);
    store.closeFaint();
    expect(store.faintOpen).toBe(false);
  });

  it('manages alarm overlay state and payload', () => {
    store.showAlarm({ time: '08:00', type: 'wake' });
    expect(store.alarmOpen).toBe(true);
    expect(store.alarmData).toEqual({ time: '08:00', type: 'wake' });

    store.closeAlarm();
    expect(store.alarmOpen).toBe(false);
    expect(store.alarmData).toBeNull();
  });

  it('manages quest clear overlay state and payload', () => {
    store.showQuestClear({ title: 'Alchemy Test', praise: 'Great job!' });
    expect(store.questClearOpen).toBe(true);
    expect(store.questClearData).toEqual({ title: 'Alchemy Test', praise: 'Great job!' });

    store.closeQuestClear();
    expect(store.questClearOpen).toBe(false);
    expect(store.questClearData).toBeNull();
  });
});
