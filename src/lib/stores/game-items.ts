import { getItemName } from '$lib/i18n/game-content.svelte';

export interface ItemDef {
  name: string;
  value: number;
  kind: 'mat' | 'part' | 'tool' | 'treasure';
  stamina?: number;
  battle?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  emeralia: { name: 'エメラリア草', value: 12, kind: 'mat' },
  uni: { name: 'うに', value: 18, kind: 'mat' },
  wasser: { name: '蒸留水', value: 6, kind: 'mat' },
  honey: { name: '森のはちみつ', value: 22, kind: 'mat' },
  shell: { name: '輝きの貝殻', value: 16, kind: 'mat' },
  ore: { name: '魔石鉱のかけら', value: 30, kind: 'mat' },
  mushroom: { name: '元気茸', value: 20, kind: 'mat' },
  driftwood: { name: '漂流WOOD', value: 25, kind: 'part' },
  ironwood: { name: '堅鉄の木目', value: 45, kind: 'part' },
  cloth: { name: '帆布布切れ', value: 35, kind: 'part' },
  bottle: { name: '回復のボトル', value: 60, kind: 'tool', stamina: 25 },
  bomb: { name: '爆弾瓶', value: 48, kind: 'tool', battle: 2 },
  charm: { name: 'お守りの指輪', value: 90, kind: 'tool', battle: 3 },
  relic: { name: '古代の遺物', value: 150, kind: 'treasure' },
  apple: { name: 'スタミナリンゴ', value: 40, kind: 'tool', stamina: 999 },
};

export const BAGS: Record<string, number> = {
  small: 6,
  normal: 12,
  large: 24,
  huge: 40,
};

export const BAG_ORDER = ['small', 'normal', 'large', 'huge'] as const;
export type BagSize = (typeof BAG_ORDER)[number];

export const BAG_UPGRADE_COST: Record<string, number> = {
  normal: 150,
  large: 600,
  huge: 1500,
};

export const APPLE_SLOTS = 5;

export function itemName(id: string): string {
  return getItemName(id, ITEMS[id]?.name || id);
}

export function itemValue(id: string): number {
  return ITEMS[id]?.value || 10;
}
