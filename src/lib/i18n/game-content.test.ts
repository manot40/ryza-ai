import { describe, it, expect } from 'vitest';
import {
  getQuestTitle,
  getQuestDesc,
  getQuestGoal,
  getPoolQuestTitle,
  getQuestObstacle,
  getQuestPraise,
  getItemName,
  getRecipeName,
  getWorldName,
} from './game-content';

describe('game-content localization module', () => {
  it('retrieves quest translations for chain quests across all languages', () => {
    expect(getQuestTitle(1, '', 'en')).toBe('Let’s Talk First');
    expect(getQuestTitle(1, '', 'ja')).toBe('まずは会話をしてみよう');
    expect(getQuestTitle(1, '', 'zh')).toBe('先来聊聊天吧');
    expect(getQuestTitle(1, '', 'id')).toBe('Mari Mengobrol Dulu');

    expect(getQuestGoal(1, '', 'en')).toBe('Talk to Ryza 4 times');
    expect(getQuestGoal(1, '', 'ja')).toBe('ライザと4回話す');
    expect(getQuestGoal(1, '', 'zh')).toBe('和莱莎聊4次');
    expect(getQuestGoal(1, '', 'id')).toBe('Bicara dengan Ryza 4 kali');
  });

  it('retrieves pool quest translations', () => {
    expect(getPoolQuestTitle(1, '', 'en')).toBe('A New Recipe');
    expect(getPoolQuestTitle(1, '', 'ja')).toBe('新しいレシピ');
    expect(getPoolQuestTitle(1, '', 'zh')).toBe('新配方');
    expect(getPoolQuestTitle(1, '', 'id')).toBe('Resep Baru');
  });

  it('retrieves quest obstacles and praises', () => {
    expect(getQuestObstacle('gather', '', 'en')).toBe('Good stuff grows deeper in, apparently.');
    expect(getQuestObstacle('gather', '', 'ja')).toBe('いい素材は少し奥まで入らないと採れないみたい。');
    expect(getQuestPraise(0, '', 'en')).toBe('Amazing, you cleared it!');
    expect(getQuestPraise(0, '', 'id')).toBe('Luar biasa, selamat telah menyelesaikannya!');
  });

  it('retrieves item names across languages', () => {
    expect(getItemName('emeralia', '', 'en')).toBe('Emeralia Grass');
    expect(getItemName('emeralia', '', 'ja')).toBe('エメラリア草');
    expect(getItemName('emeralia', '', 'zh')).toBe('翡翠草');
    expect(getItemName('emeralia', '', 'id')).toBe('Rumput Emeralia');

    expect(getItemName('apple', '', 'en')).toBe('Stamina Apple');
    expect(getItemName('apple', '', 'id')).toBe('Apel Stamina');
  });

  it('retrieves recipe names', () => {
    expect(getRecipeName('bottle', '', 'en')).toBe('Healing Bottle');
    expect(getRecipeName('bottle', '', 'zh')).toBe('回复瓶');
    expect(getRecipeName('bottle', '', 'id')).toBe('Botol Pemulih');
  });

  it('retrieves world place names (areas, fields, stages)', () => {
    expect(getWorldName('area_01', '', 'en')).toBe('Kurken Island Area');
    expect(getWorldName('area_01', '', 'ja')).toBe('クーケン島周辺地域');
    expect(getWorldName('area_01', '', 'zh')).toBe('库肯岛周边地区');
    expect(getWorldName('area_01', '', 'id')).toBe('Daerah Sekitar Pulau Kurken');

    expect(getWorldName('field_01_001', '', 'en')).toBe('Kurken Island');
    expect(getWorldName('field_01_002', '', 'en')).toBe('Pixie Forest');
    expect(getWorldName('field_01_002', '', 'id')).toBe('Hutan Pixie');

    expect(getWorldName('stage_01_001_04', '', 'en')).toBe('Ryza’s Home');
    expect(getWorldName('stage_01_001_04', '', 'zh')).toBe('莱莎的家');
    expect(getWorldName('stage_01_001_04', '', 'id')).toBe('Rumah Ryza');
  });

  it('falls back gracefully to fallback or key for unknown ids', () => {
    expect(getWorldName('unknown_place', 'Fallback Place', 'en')).toBe('Fallback Place');
    expect(getItemName('unknown_item', 'Fallback Item', 'en')).toBe('Fallback Item');
    expect(getItemName('unknown_item', undefined, 'en')).toBe('unknown_item');
  });
});
