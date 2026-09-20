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

  it('retrieves daily bonus nudge across languages', () => {
    expect(getDailyBonusNudge('en')).toBe('Daily login bonus is available!');
    expect(getDailyBonusNudge('ja')).toBe('デイリーログインボーナスが届いています！');
    expect(getDailyBonusNudge('zh')).toBe('每日登录奖励已送达！');
    expect(getDailyBonusNudge('id')).toBe('Bonus login harian telah tersedia!');
  });

  it('retrieves world locked toast across languages', () => {
    expect(getWorldLockedToast('en')).toBe('No ship, no leaving Kurken Island (finish Main Quest 8)');
    expect(getWorldLockedToast('ja')).toBe('船がないとクーケン島の外へは出られない（メイン8をクリア！）');
    expect(getWorldLockedToast('zh')).toBe('还没有船，去不了库肯岛以外（完成主线8「造船出海」）');
    expect(getWorldLockedToast('id')).toBe(
      'Belum punya kapal, belum bisa meninggalkan Pulau Kurken (selesaikan Misi Utama 8)'
    );
  });

  it('retrieves sailed toast across languages', () => {
    expect(getSailedToast('en')).toBe('You sailed! The world map is open');
    expect(getSailedToast('ja')).toBe('出航成功！世界の扉が開いたよ');
    expect(getSailedToast('zh')).toBe('出航成功！世界地图已解锁');
    expect(getSailedToast('id')).toBe('Berhasil berlayar! Peta dunia telah terbuka');
  });

  it('retrieves error and status toasts across languages', () => {
    expect(getNoApiKeyToast('en')).toBe('API key is not configured');
    expect(getNoApiKeyToast('ja')).toBe('APIキーが設定されていません');
    expect(getNoApiKeyToast('zh')).toBe('未配置 API 密钥');
    expect(getNoApiKeyToast('id')).toBe('Kunci API belum dikonfigurasi');

    expect(getNoStaminaToast('en')).toBe('Not enough stamina…!');
    expect(getNoStaminaToast('ja')).toBe('元気が足りません…！');

    expect(getNetworkErrorToast('timeout', 'en')).toBe('Network error: timeout');
    expect(getNetworkErrorToast('timeout', 'ja')).toBe('通信エラー: timeout');

    expect(getMoveToast('Stage 1', 'en')).toBe('Travel: Stage 1');
    expect(getMoveToast('ステージ1', 'ja')).toBe('移動：ステージ1');

    expect(getRestFullToast('en')).toBe('Rested safely at home — stamina fully restored!');
    expect(getRestFullToast('ja')).toBe('安全なおうちで眠って、元気が満タンになった！');

    expect(getSaveSlotToast(1, 'en')).toBe('Game saved to slot 1');
    expect(getSaveSlotToast(1, 'ja')).toBe('スロット 1 にセーブしました');

    expect(getLoadSlotToast(2, 'en')).toBe('Game loaded from slot 2');
    expect(getLoadSlotToast(2, 'zh')).toBe('已从存档槽 2 读取');

    expect(getQuestClearedToast(undefined, 'en')).toBe('Quest cleared! Reward claimed.');
    expect(getQuestClearedToast({ exp: 30, money: 20 }, 'en')).toBe('Quest cleared! Claimed +30 EXP, +20 G.');
    expect(getQuestClearedToast({ exp: 30, money: 20 }, 'ja')).toBe(
      'クエストクリア！ +30 EXP / +20 G を獲得しました'
    );

    expect(getNoActiveQuestLine('en')).toBe('No active quest right now. Let’s ask for a new objective.');
    expect(getNoActiveQuestLine('ja')).toBe('今はクエストなし。新しいお題を考えてもらおう。');

    expect(getBagUpgradeGoldToast('en')).toBe('Not enough Gold to upgrade bag!');
    expect(getBagUpgradeGoldToast('ja')).toBe('ゴールドが足りなくてバッグを拡張できません！');

    expect(getBagUpgradedToast('large', 'en')).toBe('Bag upgraded to LARGE! Capacity increased.');
    expect(getBagUpgradedToast('large', 'ja')).toBe('バッグをLARGEに拡張しました！容量が増加しました。');

    expect(getBagUpgradeFailedToast('en')).toBe('Failed to upgrade bag.');
    expect(getBagUpgradeFailedToast('id')).toBe('Gagal meningkatkan tas.');
  });

  it('formats daily reward labels across languages', () => {
    expect(getDailyRewardLabel({ kind: 'stamina' }, 'en')).toBe('Full Stamina Recovery');
    expect(getDailyRewardLabel({ kind: 'stamina' }, 'ja')).toBe('スタミナ全回復');

    expect(getDailyRewardLabel({ kind: 'money', amount: 120 }, 'en')).toBe('120 Gold');
    expect(getDailyRewardLabel({ kind: 'money', amount: 120 }, 'ja')).toBe('120G');

    expect(getDailyRewardLabel({ kind: 'item', id: 'wasser', n: 3 }, 'en')).toBe('Distilled Water ×3');
    expect(getDailyRewardLabel({ kind: 'item', id: 'wasser', n: 3 }, 'ja')).toBe('蒸留水 ×3');

    expect(getDailyRewardLabel({ kind: 'big', money: 300, exp: 100 }, 'en')).toBe(
      '300 Gold + EXP +100 + Full Heal'
    );
    expect(getDailyRewardLabel({ kind: 'big', money: 300, exp: 100 }, 'zh')).toBe(
      '300 金币 + EXP +100 + 完全回复'
    );

    expect(getDailyRewardLabel({ kind: 'chest', money: 500, item: 'relic' }, 'en')).toBe(
      'Treasure Chest: 500 Gold + Ancient Relic'
    );
    expect(getDailyRewardLabel({ kind: 'chest', money: 500, item: 'relic' }, 'ja')).toBe(
      '宝箱：500G + 古代の遺物'
    );
  });
});
