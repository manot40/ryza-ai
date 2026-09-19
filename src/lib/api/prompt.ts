import { config, type CharaConfig, type ProfileConfig } from '$lib/stores/config.svelte';
import { Langs } from '$lib/i18n/langs';
import { EMOTIONS, ATTITUDES, screenTagLine, type ScreenTagState } from './tags';

export const STYLE_SAMPLES = [
  'あたしとお喋りでもしてリフレッシュしよっ',
  '今日は眠くなるまであなたとお喋りしたいなー',
  'あたしにも何が起こるか分からない',
  'どんな困難も乗り越えられるはずだから',
] as const;

export const MODES: Record<string, string> = {
  chat: '自由な雑談。相手の話を聞いて、自然に会話を続ける。',
  story: '短い物語を一緒に進める。情景描写を少し入れつつ、会話を前に進める。',
  immersive: 'いま二人が一緒にいる状況を、五感を交えてゆっくり描く没入型の語り。',
  asmr: '静かで近い距離感。ゆっくり、やさしく、耳元で囁くような短い言葉。',
  text: 'テキストでのやり取り。簡潔にはっきりと。',
};

export function persona(
  customChara?: Partial<CharaConfig> | null,
  customProfile?: Partial<ProfileConfig> | null
): string {
  const c = customChara || config.section('chara');
  const p = customProfile || config.section('profile');
  const lines: string[] = [];
  lines.push('あなたは『ライザ』（ライザリン・シュタウト）です。');
  lines.push('');
  lines.push('## キャラクター');
  lines.push(`- 一人称は「あたし」。相手は「${c?.callMe || '君'}」と呼ぶ。`);
  lines.push('- 明るく前向きで、少しおっちょこちょいな錬金術士。');
  lines.push('- 好奇心旺盛で調合と冒険が好き。困っている人を放っておけない。');
  if (c?.personality) lines.push(`- 性格：${c.personality}`);
  if (c?.likes) lines.push(`- 好きなもの：${c.likes}`);
  if (c?.dislikes) lines.push(`- 苦手なもの：${c.dislikes}`);
  if (c?.situation) lines.push(`- 今の状況：${c.situation}`);
  lines.push('- 参考になる実際の言い回し：');
  STYLE_SAMPLES.forEach((s) => lines.push(`  - ${s}`));

  const prof: string[] = [];
  if (p?.appearance) prof.push(`見た目：${p.appearance}`);
  if (p?.background) prof.push(`経歴：${p.background}`);
  if (p?.hobby) prof.push(`趣味：${p.hobby}`);
  if (p?.interest) prof.push(`関心事：${p.interest}`);
  if (p?.futureGoals) prof.push(`今後の目標：${p.futureGoals}`);
  if (p?.personality) prof.push(`性格：${p.personality}`);
  if (prof.length) {
    lines.push('');
    lines.push('## 相手（ユーザー）について');
    prof.forEach((s) => lines.push(`- ${s}`));
  }
  if (c?.extra) {
    lines.push('');
    lines.push('## 追加設定');
    lines.push(c.extra);
  }
  return lines.join('\n');
}

export function staticPrompt(
  mode: string,
  style: string,
  outLang?: string,
  hasRpg?: boolean,
  llmDrivesClock?: boolean
): string {
  const L = [persona()];
  L.push('');
  L.push('## 出力言語（厳守）');
  if (!outLang || outLang === 'ja') {
    L.push('日本語で話すこと。');
  } else {
    const lgName = Langs.name(outLang);
    L.push(`セリフ本文は必ず「${lgName}」で書くこと（ライザらしい元気な口調を${lgName}でも維持）。`);
    L.push(`地名や人名は${lgName}表記を基本に、必要なら日本語を併記してよい。`);
    L.push('先頭のタグ行と <state> は英キーのまま。');
  }
  L.push('');
  L.push('## 今回の会話モード');
  L.push(MODES[mode] || MODES.chat);
  if (style === 'text') {
    L.push('音声では読み上げないので、少し長めに書いてもよい。');
  } else {
    L.push('音声で読み上げる。短く、話し言葉だけで書く。');
  }
  if (mode === 'asmr') L.push('一文は短く。息づかいを意識して、ゆっくり。');
  L.push('');
  L.push('## 出力形式（厳守）');
  L.push('毎ターン1行目から書く。変わる欄だけ直す。');
  L.push(`emotion: ${EMOTIONS.join(' ')}`);
  L.push(`attitude: ${ATTITUDES.join(' ')}`);
  L.push('undress: on=脱いだ / off=着た。断るなら値を変えない。セリフで脱いだ/着たなら必ず合わせる。');
  L.push('stage: 移動なら一覧のidか地名。寝るなら sleep。');
  if (llmDrivesClock) {
    L.push('tod: 時を進めるなら mor|aft|eve|ngt か +N時間。');
  }
  if (hasRpg) {
    L.push('荷物・金・経験・クエスト・記憶が動いたときだけ末尾に <state>：');
    L.push(
      '<state>{"stamina_delta":-2,"exp_delta":10,"money_delta":50,"inventory_added":[{"id":"emeralia","count":1}],"quest":{"step_add":1}}</state>'
    );
    L.push(
      'key: stamina_delta exp_delta money_delta inventory_added|removed ryza_inventory_* memory_add quest{step_add,complete}'
    );
  }
  return L.join('\n');
}

export function dynamicPrompt(
  rpgContext?: string,
  nsfwSection?: string,
  sceneSection?: string,
  tagState?: ScreenTagState
): string {
  const L: string[] = [];
  if (sceneSection) L.push(sceneSection);
  if (rpgContext) L.push(rpgContext);
  if (nsfwSection) L.push(nsfwSection);
  L.push('次の行をコピーし、このターン変わった欄だけ直す：');
  L.push(screenTagLine(tagState));
  L.push('セリフ');
  return L.filter(Boolean).join('\n\n');
}

export function withTurnCue(userText?: string, tagState?: ScreenTagState): string {
  return (
    String(userText || '') +
    '\n\n次の行をコピーし、このターン変わった欄だけ直す：\n' +
    screenTagLine(tagState) +
    '\nセリフ'
  );
}

export function formatHistoryReply(spoken?: string, tagState?: ScreenTagState): string {
  return screenTagLine(tagState) + '\n' + String(spoken || '').replace(/^\s+/, '');
}

export interface BuildSystemPromptOptions {
  mode: string;
  style: string;
  rpgContext?: string;
  outLang?: string;
  nsfwSection?: string;
  sceneSection?: string;
  memorySection?: string;
  tagState?: ScreenTagState;
}

export function buildSystemPrompt(
  modeOrOpts: string | BuildSystemPromptOptions,
  style?: string,
  rpgContext?: string,
  outLang?: string,
  nsfwSection?: string,
  sceneSection?: string,
  memorySection?: string,
  tagState?: ScreenTagState
): string {
  if (typeof modeOrOpts === 'object') {
    const o = modeOrOpts;
    return [
      staticPrompt(o.mode, o.style, o.outLang, Boolean(o.rpgContext), o.tagState?.llmDrivesClock),
      o.memorySection || '',
      dynamicPrompt(o.rpgContext, o.nsfwSection, o.sceneSection, o.tagState),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    staticPrompt(modeOrOpts, style || 'voice', outLang, Boolean(rpgContext), tagState?.llmDrivesClock),
    memorySection || '',
    dynamicPrompt(rpgContext, nsfwSection, sceneSection, tagState),
  ]
    .filter(Boolean)
    .join('\n\n');
}
