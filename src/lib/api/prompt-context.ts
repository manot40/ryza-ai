import { config, type StateConfig } from '$lib/stores/config.svelte';
import { game, type ItemStack } from '$lib/stores/game.svelte';
import { quests } from '$lib/stores/quests.svelte';
import { world } from '$lib/stores/world.svelte';
import { memory } from '$lib/stores/memory.svelte';
import { longMem } from '$lib/stores/longmem.svelte';
import { nsfw } from '$lib/stores/nsfw.svelte';
import { avatarService } from '$lib/avatar/avatar-service.svelte';
import { HOME_STAGE } from '$lib/stores/session.svelte';
import { Langs } from '$lib/i18n/langs';
import { ITEMS, itemName } from '$lib/stores/game-items';
import { EMOTIONS, ATTITUDES, screenTagLine, type ScreenTagState } from './tags';
import { persona, MODES, buildSystemPrompt } from './prompt';
import { npcPromptBlock } from './npc-dialogue';

const RPG_MODES: Record<string, number> = { chat: 1, story: 1, immersive: 1 };

export const VALID_ITEM_IDS = Object.keys(ITEMS);

export function getScreenTagState(): ScreenTagState {
  const st = config.get('state');
  return {
    emotion: avatarService.currentEmotion,
    attitude: avatarService.currentAttitude,
    nsfw: nsfw.active(),
    stage: String(st.stage || HOME_STAGE),
    tod: String(st.tod || 'aft'),
    llmDrivesClock: world.llmDrivesClock(),
  };
}

export function buildScopedStageBlock(st?: { stage?: string; tod?: string }): string {
  const currentStage = st?.stage || HOME_STAGE;
  const here = world.find(currentStage);
  if (!here) return '';

  const L: string[] = ['## いまの場所'];
  L.push(
    `- いま：${world.placeLabel(here.stageId, here.stage)}（${here.stageId}）／${world.placeLabel(here.fieldId, here.field)}／${world.placeLabel(here.areaId, here.area)}`
  );
  L.push(`- 時間帯：${st?.tod || 'aft'}（mor=朝 aft=昼 eve=夕 ngt=夜）`);

  if (!game.sailed) {
    L.push('- 船ができるまでクーケン島（area_01）以外は行けない。');
  }

  L.push('- 行ける場所（stage 欄用・現在エリア周辺）：');

  const currentAreaId = here.areaId || 'area_01';
  const areasToList = world.areas().filter((a) => a.id === currentAreaId);

  // If outside area_01, always also provide home stage option
  if (currentAreaId !== 'area_01') {
    L.push(`  おうち（自室）：${HOME_STAGE}（寝る時は sleep）`);
  }

  areasToList.forEach((a) => {
    a.fields.forEach((f) => {
      const bits = f.stages.map((s) => {
        return `${s.id} ${world.placeLabel(s.id, s.name)}`;
      });
      L.push(`  ${world.placeLabel(f.id, f.name)}：${bits.join('；')}`);
    });
  });

  return L.join('\n');
}

export function buildPeopleBlock(st: StateConfig): string {
  if (!world.npcs) return '';
  // @wc-ignore
  const lines = ['## この世界の人々（ライザ以外）'];
  const stageId = String(st.stage || HOME_STAGE);
  const day = Number(st.day) || 1;
  const here = world.npcsAt(stageId, day);

  // prettier-ignore
  // @wc-ignore
  lines.push('- いま同じ場所にいる人：' + (here.length ? here.map((n) => world.npcName(n.id) + (n.note ? `（${n.note}）` : '')).join('、') : 'いない'));

  const known: Record<string, { id: string; note?: string }> = {};
  (world.npcs.npcs || []).forEach((n) => {
    known[n.id] = n;
  });

  const metCharas = game.met_charas || [];
  const met = metCharas
    .map((id: string) => known[id])
    .filter((n): n is { id: string; note?: string } => Boolean(n))
    .slice(0, 16);

  if (met.length) {
    // prettier-ignore
    // @wc-ignore
    lines.push('- これまでに会った人：' + met.map((n) => world.npcName(n.id) + (n.note ? `（${n.note}）` : '')).join('、'));
  }

  const app = config.get('app');
  const npcBlock = npcPromptBlock(
    { stage: stageId, day },
    {
      npcFrequency: app.npcFrequency,
      translate: Langs.reply() !== Langs.ui(),
    }
  );
  if (npcBlock) {
    lines.push('', npcBlock);
  }
  return lines.join('\n');
}

export function buildClockBlock(st: StateConfig): string {
  const app = config.get('app');
  const mode = app.timeMode || 'real';
  const hour =
    mode === 'flow'
      ? Math.floor(Number(st.gameHour) || 12)
      : mode === 'manual'
        ? world.todStartHour(String(st.tod || 'aft'))
        : new Date().getHours();

  // @wc-ignore
  return `## 現在時刻\n- 同伴 ${st.day || 1}日目／${world.todLabel(String(st.tod || 'aft'))}（約${hour}時）`;
}

export function buildSceneContext(st: StateConfig): string {
  const parts = [buildScopedStageBlock(st), buildPeopleBlock(st), buildClockBlock(st)];
  return parts.filter(Boolean).join('\n\n');
}

export function buildRpgContext(st: StateConfig): string {
  const mode = String(st.mode || 'chat');
  if (!RPG_MODES[mode]) return '';

  const L: string[] = [];
  const invBrief = (list: ItemStack[]) => {
    if (!list.length) return '（空）';
    return list.map((x) => `${itemName(x.id)}×${x.count}`).join('、');
  };

  L.push('## ゲーム状態');
  L.push(`- レベル ${game.level()}（累計経験値 ${game.exp_total}）`);
  L.push(
    `- スタミナ ${game.cheat() ? '∞' : `${game.stamina}/${game.max()}`}：活動や探索で減る。ゼロだと気絶。`
  );
  L.push(`- 所持金 ${game.cheat() ? '∞' : `${game.money}G`}`);
  L.push(`- あなたのバッグ：${invBrief(game.inventory)}`);
  L.push(`- あたしのバッグ：${invBrief(game.ryza_inventory)}`);

  // Active quest block
  const q = quests.ensure();
  L.push('## クエスト（進行度あたしと共有。達成したら <state> で教えて）');
  L.push(`- No.${q.no}「${quests.titleOf(q)}」kind=${q.type}`);
  L.push(`  目標：${quests.goalOf(q)}（進行 ${q.step | 0}/${q.need}）`);
  const obs = quests.obstacleOf(q);
  L.push(`  詳細：${quests.descOf(q)}${obs ? ` / 障害：${obs}` : ''}`);

  if (!game.sailed) {
    L.push('- まだクーケン島にいる。船（No.8）ができるまで世界地図の他エリアはロック。');
    L.push(`- 造船部品：${game.flag('ship_parts', 0) || 0}/4。`);
  } else {
    L.push('- 船を手に入れて世界へ出航済み。どのエリアにも行ける。');
  }

  // Schema rule
  L.push('## ゲーム状態の変動（<state>）');
  L.push(
    'アイテム入手・消費、経験値、お金、クエスト進行があった場合のみ、末尾に <state>...</state> を出力：'
  );
  L.push(`- 有効なアイテムID: ${VALID_ITEM_IDS.join(', ')}`);
  L.push('- スタミナ変動: 通常 -1〜-3、戦闘 -5〜-10（安易にマイナスにしすぎない）');
  L.push(
    '例: <state>{"stamina_delta":-2,"exp_delta":15,"money_delta":20,"inventory_added":[{"id":"honey","count":1}],"quest":{"step_add":1}}</state>'
  );

  return L.join('\n');
}

export interface TurnPromptPackage {
  rpgContext: string;
  sceneSection: string;
  nsfwSection: string;
  memoryBlock: string;
  tagState: ScreenTagState;
  screenTagLine: string;
}

export function buildTurnPromptPackage(userText: string): TurnPromptPackage {
  const st = config.get('state');
  const tagState = getScreenTagState();

  return {
    rpgContext: buildRpgContext(st),
    sceneSection: buildSceneContext(st),
    nsfwSection: nsfw.screenFact(),
    memoryBlock: [memory.promptBlock(), longMem.promptBlock(userText)].filter(Boolean).join('\n\n'),
    tagState,
    screenTagLine: screenTagLine(tagState),
  };
}
