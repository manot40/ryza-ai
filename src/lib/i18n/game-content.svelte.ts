import { Langs } from './langs';

// Trigger wuchale module runtime init
const _gameContentScope = 'Ryza Game Content';

export type ContentLocale = 'en' | 'ja' | 'zh' | 'id';

export function resolveContentLocale(): ContentLocale {
  const lang = Langs.ui();
  if (lang === 'zh' || lang === 'zh-tw') return 'zh';
  if (lang === 'ja') return 'ja';
  if (lang === 'id') return 'id';
  return 'en';
}

// ---------------------------------------------------------------------------
// Phase 2: Questline Content
// ---------------------------------------------------------------------------

function getChainQuest(no: number): { title: string; desc: string; goal: string } | null {
  switch (no) {
    case 1: {
      // @wc-context: quest_chain_1
      const title = 'Let’s Talk First';
      // @wc-context: quest_chain_1
      const desc = 'Chat with Ryza and get used to each other.';
      // @wc-context: quest_chain_1
      const goal = 'Talk to Ryza 4 times';
      return { title, desc, goal };
    }
    case 2: {
      // @wc-context: quest_chain_2
      const title = 'Explore the Island';
      // @wc-context: quest_chain_2
      const desc = 'Open the world map and travel somewhere else.';
      // @wc-context: quest_chain_2
      const goal = 'Move to another stage twice';
      return { title, desc, goal };
    }
    case 3: {
      // @wc-context: quest_chain_3
      const title = 'Gathering Adventure';
      // @wc-context: quest_chain_3
      const desc = 'Collect adventuring materials. Fill that bag!';
      // @wc-context: quest_chain_3
      const goal = 'Gather 3 materials';
      return { title, desc, goal };
    }
    case 4: {
      // @wc-context: quest_chain_4
      const title = 'First Synthesis';
      // @wc-context: quest_chain_4
      const desc = 'Try alchemy with the materials you gathered!';
      // @wc-context: quest_chain_4
      const goal = 'Craft successfully once';
      return { title, desc, goal };
    }
    case 5: {
      // @wc-context: quest_chain_5
      const title = 'Monster in the Way';
      // @wc-context: quest_chain_5
      const desc = 'A monster showed up. Break through with crafted items.';
      // @wc-context: quest_chain_5
      const goal = 'Win one battle';
      return { title, desc, goal };
    }
    case 6: {
      // @wc-context: quest_chain_6
      const title = 'A Day Running the Shop';
      // @wc-context: quest_chain_6
      const desc = 'Set out spare items and earn some pocket money.';
      // @wc-context: quest_chain_6
      const goal = 'Sell items at the shop';
      return { title, desc, goal };
    }
    case 7: {
      // @wc-context: quest_chain_7
      const title = 'Gather Ship Parts';
      // @wc-context: quest_chain_7
      const desc = '"First, get a ship." It apparently needs 4 parts.';
      // @wc-context: quest_chain_7
      const goal = 'Collect 4 ship parts';
      return { title, desc, goal };
    }
    case 8: {
      // @wc-context: quest_chain_8
      const title = 'Set Sail, Free!';
      // @wc-context: quest_chain_8
      const desc = 'Finish the ship and leave Kurken Island! The world map opens.';
      // @wc-context: quest_chain_8
      const goal = 'Pay 200G and sail';
      return { title, desc, goal };
    }
    default:
      return null;
  }
}

function getPoolQuest(no: number): { title: string; desc: string; goal: string } | null {
  switch (no) {
    case 1: {
      // @wc-context: quest_pool_1
      const title = 'A New Recipe';
      // @wc-context: quest_pool_1
      const desc = 'Dream up a synthesis you have never tried.';
      // @wc-context: quest_pool_1
      const goal = 'Craft successfully once';
      return { title, desc, goal };
    }
    case 2: {
      // @wc-context: quest_pool_2
      const title = 'Spring Materials';
      // @wc-context: quest_pool_2
      const desc = 'Search near the waterfall pool at the spring.';
      // @wc-context: quest_pool_2
      const goal = 'Gather 2 materials';
      return { title, desc, goal };
    }
    case 3: {
      // @wc-context: quest_pool_3
      const title = 'Stargazing';
      // @wc-context: quest_pool_3
      const desc = 'Walk together to the star-viewing height at night.';
      // @wc-context: quest_pool_3
      const goal = 'Move to a night stage';
      return { title, desc, goal };
    }
    case 4: {
      // @wc-context: quest_pool_4
      const title = 'Ruined Village Resident';
      // @wc-context: quest_pool_4
      const desc = 'Deal with whatever bothers you in the forgotten ruins.';
      // @wc-context: quest_pool_4
      const goal = 'Win one battle';
      return { title, desc, goal };
    }
    case 5: {
      // @wc-context: quest_pool_5
      const title = 'Street Vendor Day';
      // @wc-context: quest_pool_5
      const desc = 'How about a little business at the harbor plaza?';
      // @wc-context: quest_pool_5
      const goal = 'Sell items at the shop';
      return { title, desc, goal };
    }
    case 6: {
      // @wc-context: quest_pool_6
      const title = 'Memory Lane';
      // @wc-context: quest_pool_6
      const desc = 'Recall the day we first met, slowly.';
      // @wc-context: quest_pool_6
      const goal = 'Talk to Ryza 3 times';
      return { title, desc, goal };
    }
    case 7: {
      // @wc-context: quest_pool_7
      const title = 'Snack Hunt';
      // @wc-context: quest_pool_7
      const desc = 'Gather sweet ingredients for my snack.';
      // @wc-context: quest_pool_7
      const goal = 'Gather 2 materials';
      return { title, desc, goal };
    }
    case 8: {
      // @wc-context: quest_pool_8
      const title = 'Ruins Expedition';
      // @wc-context: quest_pool_8
      const desc = 'Let’s look deeper into the sealed sanctuary.';
      // @wc-context: quest_pool_8
      const goal = 'Move to another stage';
      return { title, desc, goal };
    }
    default:
      return null;
  }
}

export function getQuestTitle(no: number, fallback?: string): string {
  const q = getChainQuest(no);
  return q?.title || fallback || '';
}

export function getQuestDesc(no: number, fallback?: string): string {
  const q = getChainQuest(no);
  return q?.desc || fallback || '';
}

export function getQuestGoal(no: number, fallback?: string): string {
  const q = getChainQuest(no);
  return q?.goal || fallback || '';
}

export function getPoolQuestTitle(no: number, fallback?: string): string {
  const q = getPoolQuest(no);
  return q?.title || fallback || '';
}

export function getPoolQuestDesc(no: number, fallback?: string): string {
  const q = getPoolQuest(no);
  return q?.desc || fallback || '';
}

export function getPoolQuestGoal(no: number, fallback?: string): string {
  const q = getPoolQuest(no);
  return q?.goal || fallback || '';
}

export function getQuestObstacle(type: string, fallback?: string): string {
  switch (type) {
    case 'gather':
      // @wc-context: quest_obstacle
      return 'Good stuff grows deeper in, apparently.';
    case 'craft':
      // @wc-context: quest_obstacle
      return 'Synthesis fails easy — gather spare materials first.';
    case 'battle':
      // @wc-context: quest_obstacle
      return 'Um, if something too strong shows up we can run… probably.';
    case 'shop':
      // @wc-context: quest_obstacle
      return 'Not sure it will sell, but worth a try!';
    case 'build':
      // @wc-context: quest_obstacle
      return 'Every part is huge. One trip won’t carry them.';
    case 'explore':
      // @wc-context: quest_obstacle
      return 'The roads have felt a bit odd lately.';
    case 'sail':
      // @wc-context: quest_obstacle
      return 'Sailing costs money. Let’s earn some at the shop.';
    case 'talk':
      return '';
    default:
      return fallback || '';
  }
}

export function getQuestPraise(idx: number, fallback?: string): string {
  const praises = [
    // @wc-context: quest_praise
    'Amazing, you cleared it!',
    // @wc-context: quest_praise
    'Let’s keep going with the next quest',
    // @wc-context: quest_praise
    'Awesome! What adventure next?',
  ];
  return praises[Math.abs(idx) % praises.length] || fallback || '';
}

export function getQuestClearedToast(reward?: { exp: number; money: number }): string {
  if (reward) {
    return `Quest cleared! Claimed +${reward.exp} EXP, +${reward.money} G.`;
  }
  return 'Quest cleared! Reward claimed.';
}

export function getNoActiveQuestLine(): string {
  return 'No active quest right now. Let’s ask for a new objective.';
}

export function getQuestClearedMemory(title: string, reward: { exp: number; money: number }): string {
  return `Cleared "${title}"! +${reward.exp}EXP / +${reward.money}G`;
}

// ---------------------------------------------------------------------------
// Phase 3: Dynamic-Key Content (Items, Recipes, World Names)
// ---------------------------------------------------------------------------

export function getItemName(id: string, fallback?: string): string {
  switch (id) {
    case 'emeralia':
      // @wc-context: item
      return 'Emeralia Grass';
    case 'uni':
      // @wc-context: item
      return 'Sea Urchin';
    case 'wasser':
      // @wc-context: item
      return 'Distilled Water';
    case 'honey':
      // @wc-context: item
      return 'Forest Honey';
    case 'shell':
      // @wc-context: item
      return 'Radiant Shell';
    case 'ore':
      // @wc-context: item
      return 'Magic Ore Shard';
    case 'mushroom':
      // @wc-context: item
      return 'Vitality Mushroom';
    case 'driftwood':
      // @wc-context: item
      return 'Driftwood Log';
    case 'ironwood':
      // @wc-context: item
      return 'Ironwood Grain';
    case 'cloth':
      // @wc-context: item
      return 'Sailcloth Scrap';
    case 'bottle':
      // @wc-context: item
      return 'Healing Bottle';
    case 'bomb':
      // @wc-context: item
      return 'Bomb Vial';
    case 'charm':
      // @wc-context: item
      return 'Guardian Charm Ring';
    case 'relic':
      // @wc-context: item
      return 'Ancient Relic';
    case 'apple':
      // @wc-context: item
      return 'Stamina Apple';
    default:
      return fallback || id;
  }
}

export function getRecipeName(outId: string, fallback?: string): string {
  switch (outId) {
    case 'bottle':
      // @wc-context: recipe
      return 'Healing Bottle';
    case 'bomb':
      // @wc-context: recipe
      return 'Bomb Vial';
    case 'charm':
      // @wc-context: recipe
      return 'Guardian Charm Ring';
    default:
      return fallback || outId;
  }
}

export function getWorldName(id: string, fallback?: string): string {
  switch (id) {
    // Areas
    case 'area_01':
      // @wc-context: world
      return 'Kurken Island Area';
    case 'area_02':
      // @wc-context: world
      return 'Cleria Region';
    case 'area_03':
      // @wc-context: world
      return 'Nemed Region';
    case 'area_04':
      // @wc-context: world
      return 'Underworld Orim';
    case 'area_05':
      // @wc-context: world
      return 'Royal Capital Area';

    // Fields
    case 'field_01_001':
      // @wc-context: world
      return 'Kurken Island';
    case 'field_01_002':
      // @wc-context: world
      return 'Pixie Forest';
    case 'field_01_003':
      // @wc-context: world
      return 'Traveler’s Road';
    case 'field_01_004':
      // @wc-context: world
      return 'Sunken Mine';
    case 'field_01_005':
      // @wc-context: world
      return 'Hidden Cove';
    case 'field_01_006':
      // @wc-context: world
      return 'Meteor Castle';
    case 'field_01_007':
      // @wc-context: world
      return 'Weissberg Volcano';
    case 'field_01_008':
      // @wc-context: world
      return 'Maple Delta';
    case 'field_01_009':
      // @wc-context: world
      return 'Liese Gorge';
    case 'field_01_010':
      // @wc-context: world
      return 'Pynnor Holy Tower';
    case 'field_01_011':
      // @wc-context: world
      return 'Forgotten Village';
    case 'field_01_012':
      // @wc-context: world
      return 'Old Mansion';
    case 'field_01_013':
      // @wc-context: world
      return 'Kark Isles';
    case 'field_01_014':
      // @wc-context: world
      return 'Code of the Universe';

    case 'field_02_001':
      // @wc-context: world
      return 'Mining Highway';
    case 'field_02_002':
      // @wc-context: world
      return 'Sardonica';
    case 'field_02_003':
      // @wc-context: world
      return 'Astrard Heights';
    case 'field_02_004':
      // @wc-context: world
      return 'Magic Stone Path';
    case 'field_02_005':
      // @wc-context: world
      return 'Scintilla Mine';

    case 'field_03_001':
      // @wc-context: world
      return 'Poluta Hills';
    case 'field_03_002':
      // @wc-context: world
      return 'Nemed Great Forest';
    case 'field_03_003':
      // @wc-context: world
      return 'Flower Road Farmland';
    case 'field_03_004':
      // @wc-context: world
      return 'Dragon Tail Mountain Path';
    case 'field_03_005':
      // @wc-context: world
      return 'Abandoned Mountain Temple';

    case 'field_04_001':
      // @wc-context: world
      return 'Urdis Sanctuary';
    case 'field_04_002':
      // @wc-context: world
      return 'Bird’s Pass';
    case 'field_04_003':
      // @wc-context: world
      return 'Eternity’s Coffer';

    case 'field_05_001':
      // @wc-context: world
      return 'Capital Outskirts';
    case 'field_05_002':
      // @wc-context: world
      return 'Ashra-am Baird';
    case 'field_05_003':
      // @wc-context: world
      return 'Windcall Valley';
    case 'field_05_004':
      // @wc-context: world
      return 'Capital South';
    case 'field_05_005':
      // @wc-context: world
      return 'Northern Lands';
    case 'field_05_006':
      // @wc-context: world
      return 'Dragon’s Coffin';
    case 'field_05_007':
      // @wc-context: world
      return 'Ancient Mana Workshop';
    case 'field_05_008':
      // @wc-context: world
      return 'Maiden’s Tomb';
    case 'field_05_009':
      // @wc-context: world
      return 'Submerged City';
    case 'field_05_010':
      // @wc-context: world
      return 'Mirage Land';
    case 'field_05_012':
      // @wc-context: world
      return 'Valley of Dragon Bones';

    // Notable stages
    case 'stage_01_001_01':
      // @wc-context: world
      return 'Spire Reservoir';
    case 'stage_01_001_02':
      // @wc-context: world
      return 'Magic Stone Lighthouse';
    case 'stage_01_001_04':
      // @wc-context: world
      return 'Ryza’s Home';
    case 'stage_01_001_05':
      // @wc-context: world
      return 'Goat Pasture';
    case 'stage_01_001_06':
      // @wc-context: world
      return 'Resting Plaza';
    case 'stage_01_001_08':
      // @wc-context: world
      return 'Waterfall Basin';
    case 'stage_01_002_01':
      // @wc-context: world
      return 'Secret Hideout Front';
    case 'stage_01_002_02':
      // @wc-context: world
      return 'Floral Circle';
    case 'stage_01_002_03':
      // @wc-context: world
      return 'Lantern Tree';
    case 'stage_01_002_04':
      // @wc-context: world
      return 'Stump Stage';
    case 'stage_01_003_01':
      // @wc-context: world
      return 'Opposite Shore Beach';
    case 'stage_01_003_02':
      // @wc-context: world
      return 'Giant Weasel Flower Garden';
    case 'stage_01_003_03':
      // @wc-context: world
      return 'Old Road Ruins';
    case 'stage_01_003_04':
      // @wc-context: world
      return 'Fork Tree';
    case 'stage_01_003_05':
      // @wc-context: world
      return 'Altar of the Rare Ones';
    case 'stage_01_013_02':
      // @wc-context: world
      return 'Star-viewing Heights';
    default:
      return fallback || id;
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Daily Reward Formatter
// ---------------------------------------------------------------------------

export interface DailyRewardDesc {
  kind: string;
  amount?: number | 'full';
  money?: number;
  exp?: number;
  id?: string;
  item?: string;
  n?: number;
  text?: string;
}

export function getDailyRewardLabel(r: DailyRewardDesc): string {
  switch (r.kind) {
    case 'stamina':
      return 'Full Stamina Recovery';
    case 'money':
      return `${r.amount} Gold`;
    case 'item': {
      const name = getItemName(r.id || '');
      return `${name} ×${r.n || 1}`;
    }
    case 'exp':
      return `EXP +${r.amount}`;
    case 'big':
      return `${r.money} Gold + EXP +${r.exp} + Full Heal`;
    case 'chest': {
      const relic = getItemName(r.item || 'relic');
      return `Treasure Chest: ${r.money} Gold + ${relic}`;
    }
    default:
      return r.text || '';
  }
}

// ---------------------------------------------------------------------------
// Out of scope (LLM Character Language Dimension)
// ---------------------------------------------------------------------------

// @wc-ignore
export function getGreeting(day: number, lang?: string): string {
  const target = lang || Langs.llm();
  const isMultiDay = day > 1;
  if (target === 'zh' || target === 'zh-tw') {
    return isMultiDay ? '……今天也，见到你啦。' : '……呀，见到你啦。';
  }
  if (target === 'ja') {
    return isMultiDay ? '……今日も、会えたね。' : '……やあ、会えたね。';
  }
  if (target === 'id') {
    return isMultiDay ? '…Hari ini juga, kita bertemu lagi ya.' : '…Hei, kamu di sini ya.';
  }
  return isMultiDay ? '…There you are again today.' : '…Hey, there you are.';
}

// ---------------------------------------------------------------------------
// Legacy / Compatibility Accessors (Phase 1 Toasts)
// ---------------------------------------------------------------------------

export function getDailyBonusNudge(): string {
  return 'Daily login bonus is available!';
}

export function getWorldLockedToast(): string {
  return 'No ship, no leaving Kurken Island (finish Main Quest 8)';
}

export function getSailedToast(): string {
  return 'You sailed! The world map is open';
}

export function getNoApiKeyToast(): string {
  return 'API key is not configured';
}

export function getNoStaminaToast(): string {
  return 'Not enough stamina…!';
}

export function getNetworkErrorToast(msg: string): string {
  return `Network error: ${msg}`;
}

export function getMoveToast(place: string): string {
  return `Travel: ${place}`;
}

export function getRestFullToast(): string {
  return 'Rested safely at home — stamina fully restored!';
}

export function getSaveSlotToast(slot: number): string {
  return `Game saved to slot ${slot}`;
}

export function getLoadSlotToast(slot: number): string {
  return `Game loaded from slot ${slot}`;
}

export function getBagUpgradeGoldToast(): string {
  return 'Not enough Gold to upgrade bag!';
}

export function getBagUpgradedToast(tier: string): string {
  const up = tier.toUpperCase();
  return `Bag upgraded to ${up}! Capacity increased.`;
}

export function getBagUpgradeFailedToast(): string {
  return 'Failed to upgrade bag.';
}
