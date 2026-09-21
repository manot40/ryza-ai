import { describe, it, expect, beforeAll } from 'vitest';
import { loadLocales, runWithLocale } from 'wuchale/load-utils/server';
import { key, loadCatalog, loadCount } from '../../locales/main.loader.server.svelte.js';
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
  getGreeting,
  getDailyBonusNudge,
  getWorldLockedToast,
  getSailedToast,
  getNoApiKeyToast,
  getNoStaminaToast,
  getNetworkErrorToast,
  getMoveToast,
  getRestFullToast,
  getSaveSlotToast,
  getLoadSlotToast,
  getQuestClearedToast,
  getNoActiveQuestLine,
  getBagUpgradeGoldToast,
  getBagUpgradedToast,
  getBagUpgradeFailedToast,
  getDailyRewardLabel,
} from './game-content.svelte';

function t<T>(locale: string, fn: () => T): Promise<T> {
  return runWithLocale(locale, fn);
}

describe('game-content localization module', () => {
  beforeAll(async () => {
    await loadLocales(key, loadCount, loadCatalog, ['en', 'ja', 'zh', 'id']);
  });

  it('retrieves quest translations for chain quests across all languages', async () => {
    expect(await t('en', () => getQuestTitle(1))).toBe('Let’s Talk First');
    expect(await t('ja', () => getQuestTitle(1))).toBe('まずは会話をしてみよう');
    expect(await t('zh', () => getQuestTitle(1))).toBe('先来聊聊天吧');
    expect(await t('id', () => getQuestTitle(1))).toBe('Mari Mengobrol Dulu');

    expect(await t('en', () => getQuestGoal(1))).toBe('Talk to Ryza 4 times');
    expect(await t('ja', () => getQuestGoal(1))).toBe('ライザと4回話す');
    expect(await t('zh', () => getQuestGoal(1))).toBe('和莱莎聊4次');
    expect(await t('id', () => getQuestGoal(1))).toBe('Bicara dengan Ryza 4 kali');
  });

  it('retrieves pool quest translations', async () => {
    expect(await t('en', () => getPoolQuestTitle(1))).toBe('A New Recipe');
    expect(await t('ja', () => getPoolQuestTitle(1))).toBe('新しいレシピ');
    expect(await t('zh', () => getPoolQuestTitle(1))).toBe('新配方');
    expect(await t('id', () => getPoolQuestTitle(1))).toBe('Resep Baru');
  });

  it('retrieves quest obstacles and praises', async () => {
    expect(await t('en', () => getQuestObstacle('gather'))).toBe('Good stuff grows deeper in, apparently.');
    expect(await t('ja', () => getQuestObstacle('gather'))).toBe(
      'いい素材は少し奥まで入らないと採れないみたい。'
    );
    expect(await t('en', () => getQuestPraise(0))).toBe('Amazing, you cleared it!');
    expect(await t('id', () => getQuestPraise(0))).toBe('Luar biasa, selamat telah menyelesaikannya!');
  });

  it('retrieves item names across languages', async () => {
    expect(await t('en', () => getItemName('emeralia'))).toBe('Emeralia Grass');
    expect(await t('ja', () => getItemName('emeralia'))).toBe('エメラリア草');
    expect(await t('zh', () => getItemName('emeralia'))).toBe('翡翠草');
    expect(await t('id', () => getItemName('emeralia'))).toBe('Rumput Emeralia');

    expect(await t('en', () => getItemName('apple'))).toBe('Stamina Apple');
    expect(await t('id', () => getItemName('apple'))).toBe('Apel Stamina');
  });

  it('retrieves recipe names', async () => {
    expect(await t('en', () => getRecipeName('bottle'))).toBe('Healing Bottle');
    expect(await t('zh', () => getRecipeName('bottle'))).toBe('回复瓶');
    expect(await t('id', () => getRecipeName('bottle'))).toBe('Botol Pemulih');
  });

  it('retrieves world place names (areas, fields, stages)', async () => {
    expect(await t('en', () => getWorldName('area_01'))).toBe('Kurken Island Area');
    expect(await t('ja', () => getWorldName('area_01'))).toBe('クーケン島周辺地域');
    expect(await t('zh', () => getWorldName('area_01'))).toBe('库肯岛周边地区');
    expect(await t('id', () => getWorldName('area_01'))).toBe('Daerah Sekitar Pulau Kurken');

    expect(await t('en', () => getWorldName('field_01_001'))).toBe('Kurken Island');
    expect(await t('en', () => getWorldName('field_01_002'))).toBe('Pixie Forest');
    expect(await t('id', () => getWorldName('field_01_002'))).toBe('Hutan Pixie');

    expect(await t('en', () => getWorldName('stage_01_001_04'))).toBe('Ryza’s Home');
    expect(await t('zh', () => getWorldName('stage_01_001_04'))).toBe('莱莎的家');
    expect(await t('id', () => getWorldName('stage_01_001_04'))).toBe('Rumah Ryza');
  });

  it('falls back gracefully to fallback or key for unknown ids', async () => {
    expect(await t('en', () => getWorldName('unknown_place', 'Fallback Place'))).toBe('Fallback Place');
    expect(await t('en', () => getItemName('unknown_item', 'Fallback Item'))).toBe('Fallback Item');
    expect(await t('en', () => getItemName('unknown_item'))).toBe('unknown_item');
  });

  it('retrieves greetings across languages and days', () => {
    expect(getGreeting(1, 'ja')).toBe('……やあ、会えたね。');
    expect(getGreeting(5, 'ja')).toBe('……今日も、会えたね。');
    expect(getGreeting(1, 'en')).toBe('…Hey, there you are.');
    expect(getGreeting(5, 'en')).toBe('…There you are again today.');
    expect(getGreeting(1, 'zh')).toBe('……呀，见到你啦。');
    expect(getGreeting(5, 'zh')).toBe('……今天也，见到你啦。');
    expect(getGreeting(1, 'id')).toBe('…Hei, kamu di sini ya.');
    expect(getGreeting(5, 'id')).toBe('…Hari ini juga, kita bertemu lagi ya.');
  });

  it('retrieves daily bonus nudge across languages', async () => {
    expect(await t('en', () => getDailyBonusNudge())).toBe('Daily login bonus is available!');
    expect(await t('ja', () => getDailyBonusNudge())).toBe('デイリーログインボーナスが届いています！');
    expect(await t('zh', () => getDailyBonusNudge())).toBe('每日登录奖励已送达！');
    expect(await t('id', () => getDailyBonusNudge())).toBe('Bonus login harian telah tersedia!');
  });

  it('retrieves world locked toast across languages', async () => {
    expect(await t('en', () => getWorldLockedToast())).toBe(
      'No ship, no leaving Kurken Island (finish Main Quest 8)'
    );
    expect(await t('ja', () => getWorldLockedToast())).toBe(
      '船がないとクーケン島の外へは出られない（メイン8をクリア！）'
    );
    expect(await t('zh', () => getWorldLockedToast())).toBe(
      '还没有船，去不了库肯岛以外（完成主线8「造船出海」）'
    );
    expect(await t('id', () => getWorldLockedToast())).toBe(
      'Belum punya kapal, belum bisa meninggalkan Pulau Kurken (selesaikan Misi Utama 8)'
    );
  });

  it('retrieves sailed toast across languages', async () => {
    expect(await t('en', () => getSailedToast())).toBe('You sailed! The world map is open');
    expect(await t('ja', () => getSailedToast())).toBe('出航成功！世界の扉が開いたよ');
    expect(await t('zh', () => getSailedToast())).toBe('出航成功！世界地图已解锁');
    expect(await t('id', () => getSailedToast())).toBe('Berhasil berlayar! Peta dunia telah terbuka');
  });

  it('retrieves error and status toasts across languages', async () => {
    expect(await t('en', () => getNoApiKeyToast())).toBe('API key is not configured');
    expect(await t('ja', () => getNoApiKeyToast())).toBe('APIキーが設定されていません');
    expect(await t('zh', () => getNoApiKeyToast())).toBe('未配置 API 密钥');
    expect(await t('id', () => getNoApiKeyToast())).toBe('Kunci API belum dikonfigurasi');

    expect(await t('en', () => getNoStaminaToast())).toBe('Not enough stamina…!');
    expect(await t('ja', () => getNoStaminaToast())).toBe('元気が足りません…！');

    expect(await t('en', () => getNetworkErrorToast('timeout'))).toBe('Network error: timeout');
    expect(await t('ja', () => getNetworkErrorToast('timeout'))).toBe('通信エラー: timeout');

    expect(await t('en', () => getMoveToast('Stage 1'))).toBe('Travel: Stage 1');
    expect(await t('ja', () => getMoveToast('ステージ1'))).toBe('移動：ステージ1');

    expect(await t('en', () => getRestFullToast())).toBe('Rested safely at home — stamina fully restored!');
    expect(await t('ja', () => getRestFullToast())).toBe('安全なおうちで眠って、元気が満タンになった！');

    expect(await t('en', () => getSaveSlotToast(1))).toBe('Game saved to slot 1');
    expect(await t('ja', () => getSaveSlotToast(1))).toBe('スロット 1 にセーブしました');

    expect(await t('en', () => getLoadSlotToast(2))).toBe('Game loaded from slot 2');
    expect(await t('zh', () => getLoadSlotToast(2))).toBe('已从存档槽 2 读取');

    expect(await t('en', () => getQuestClearedToast())).toBe('Quest cleared! Reward claimed.');
    expect(await t('en', () => getQuestClearedToast({ exp: 30, money: 20 }))).toBe(
      'Quest cleared! Claimed +30 EXP, +20 G.'
    );
    expect(await t('ja', () => getQuestClearedToast({ exp: 30, money: 20 }))).toBe(
      'クエストクリア！ +30 EXP / +20 G を獲得しました'
    );

    expect(await t('en', () => getNoActiveQuestLine())).toBe(
      'No active quest right now. Let’s ask for a new objective.'
    );
    expect(await t('ja', () => getNoActiveQuestLine())).toBe(
      '今はクエストなし。新しいお題を考えてもらおう。'
    );

    expect(await t('en', () => getBagUpgradeGoldToast())).toBe('Not enough Gold to upgrade bag!');
    expect(await t('ja', () => getBagUpgradeGoldToast())).toBe(
      'ゴールドが足りなくてバッグを拡張できません！'
    );

    expect(await t('en', () => getBagUpgradedToast('large'))).toBe(
      'Bag upgraded to LARGE! Capacity increased.'
    );
    expect(await t('ja', () => getBagUpgradedToast('large'))).toBe(
      'バッグをLARGEに拡張しました！容量が増加しました。'
    );

    expect(await t('en', () => getBagUpgradeFailedToast())).toBe('Failed to upgrade bag.');
    expect(await t('id', () => getBagUpgradeFailedToast())).toBe('Gagal meningkatkan tas.');
  });

  it('formats daily reward labels across languages', async () => {
    expect(await t('en', () => getDailyRewardLabel({ kind: 'stamina' }))).toBe('Full Stamina Recovery');
    expect(await t('ja', () => getDailyRewardLabel({ kind: 'stamina' }))).toBe('スタミナ全回復');

    expect(await t('en', () => getDailyRewardLabel({ kind: 'money', amount: 120 }))).toBe('120 Gold');
    expect(await t('ja', () => getDailyRewardLabel({ kind: 'money', amount: 120 }))).toBe('120G');

    expect(await t('en', () => getDailyRewardLabel({ kind: 'item', id: 'wasser', n: 3 }))).toBe(
      'Distilled Water ×3'
    );
    expect(await t('ja', () => getDailyRewardLabel({ kind: 'item', id: 'wasser', n: 3 }))).toBe('蒸留水 ×3');

    expect(await t('en', () => getDailyRewardLabel({ kind: 'big', money: 300, exp: 100 }))).toBe(
      '300 Gold + EXP +100 + Full Heal'
    );
    expect(await t('zh', () => getDailyRewardLabel({ kind: 'big', money: 300, exp: 100 }))).toBe(
      '300 金币 + EXP +100 + 完全回复'
    );

    expect(await t('en', () => getDailyRewardLabel({ kind: 'chest', money: 500, item: 'relic' }))).toBe(
      'Treasure Chest: 500 Gold + Ancient Relic'
    );
    expect(await t('ja', () => getDailyRewardLabel({ kind: 'chest', money: 500, item: 'relic' }))).toBe(
      '宝箱：500G + 古代の遺物'
    );
  });
});
