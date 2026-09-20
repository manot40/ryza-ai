// @wc-ignore-file

export type SheetType = 'mode' | 'inv' | 'status' | 'npc' | 'lang';

export interface AlarmOverlayData {
  time: string;
  type: string;
  volume?: number;
  vibrate?: boolean;
  audioSrc?: string;
}

export interface QuestClearOverlayData {
  title: string;
  praise?: string;
}

export class OverlayStore {
  // Sheets
  modeSheetOpen = $state(false);
  invSheetOpen = $state(false);
  statusSheetOpen = $state(false);
  npcSheetOpen = $state(false);
  langSheetOpen = $state(false);

  // Sheet parameters
  invBag = $state<'you' | 'ryza'>('you');
  npcStageId = $state<string | null>(null);

  // Overlays
  faintOpen = $state(false);
  alarmOpen = $state(false);
  alarmData = $state<AlarmOverlayData | null>(null);
  questClearOpen = $state(false);
  questClearData = $state<QuestClearOverlayData | null>(null);

  openSheet(type: SheetType, extra?: { invBag?: 'you' | 'ryza'; npcStageId?: string }): void {
    if (extra?.invBag) this.invBag = extra.invBag;
    if (extra?.npcStageId !== undefined) this.npcStageId = extra.npcStageId;

    if (type === 'mode') this.modeSheetOpen = true;
    else if (type === 'inv') this.invSheetOpen = true;
    else if (type === 'status') this.statusSheetOpen = true;
    else if (type === 'npc') this.npcSheetOpen = true;
    else if (type === 'lang') this.langSheetOpen = true;
  }

  closeSheet(type?: SheetType): void {
    if (!type) {
      this.closeAllSheets();
      return;
    }
    if (type === 'mode') this.modeSheetOpen = false;
    else if (type === 'inv') this.invSheetOpen = false;
    else if (type === 'status') this.statusSheetOpen = false;
    else if (type === 'npc') this.npcSheetOpen = false;
    else if (type === 'lang') this.langSheetOpen = false;
  }

  closeAllSheets(): void {
    this.modeSheetOpen = false;
    this.invSheetOpen = false;
    this.statusSheetOpen = false;
    this.npcSheetOpen = false;
    this.langSheetOpen = false;
  }

  showFaint(): void {
    this.faintOpen = true;
  }

  closeFaint(): void {
    this.faintOpen = false;
  }

  showAlarm(data: AlarmOverlayData): void {
    this.alarmData = data;
    this.alarmOpen = true;
  }

  closeAlarm(): void {
    this.alarmOpen = false;
    this.alarmData = null;
  }

  showQuestClear(data: QuestClearOverlayData): void {
    this.questClearData = data;
    this.questClearOpen = true;
  }

  closeQuestClear(): void {
    this.questClearOpen = false;
    this.questClearData = null;
  }
}

export const overlayStore = new OverlayStore();
export default overlayStore;
