// @wc-ignore-file
import { world, type NpcDef, type StageInfo } from '$lib/stores/world.svelte';
import { Langs } from '$lib/i18n/langs';
import { parseTaggedReply } from './tags';

export type SpeakerKind = 'ryza' | 'narrator' | 'translation' | 'npc';

export interface DialogueBeat {
  speaker: SpeakerKind;
  id: string;
  name: string;
  text: string;
}

export const FREQ: Record<string, string> = {
  restrained: 'NPCの参加は控えめに。本当に必要な時だけ1人まで。',
  normal: '話題に関係するNPCがいる時は、1人だけ自然に会話に加わってよい。',
  frequent: '適切なNPCを1人、2〜3ターンに一度は自然に会話に加える。',
  lively: '多くの返答で、最も関係のあるNPC1人（必要な時は2人）が自分から話しかける。',
};

const SPEAKER_PATTERNS: Array<{ kind: SpeakerKind; re: RegExp }> = [
  { kind: 'narrator', re: /^\s*(?:旁白|ナレーション|narrator|narasi|narração|वर्णन)\s*[:：]\s*/i },
  { kind: 'translation', re: /^\s*(?:译文|譯文|訳文|translation|terjemahan|tradução|अनुवाद)\s*[:：]\s*/i },
  { kind: 'ryza', re: /^\s*(?:莱莎(?:琳)?|ライザ(?:リン)?|ryza|ryza(?:lin)?)\s*[:：]\s*/i },
  { kind: 'npc', re: /^\s*角色\s*\[\s*([^\]\r\n]+?)\s*\]\s*[:：]\s*/ },
];

export function resolveNpcId(raw?: string): string {
  const s = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!s) return '';
  const want = s.startsWith('npc_') ? s : 'npc_' + s;
  const list = (world.npcs && world.npcs.npcs) || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === want) return want;
  }
  for (let j = 0; j < list.length; j++) {
    if (list[j].id === s) return s;
  }
  return '';
}

export function nameOfNpc(id?: string, fallback?: string): string {
  if (id && typeof world.npcName === 'function') {
    try {
      const n = world.npcName(id);
      if (n && n !== id) return n;
    } catch {
      // fall through
    }
  }
  return fallback || id || '';
}

/**
 * Split a reply into speaker beats.
 *
 * An unprefixed line belongs to Ryza.
 */
export function splitDialogue(text?: string): DialogueBeat[] {
  const body = String(text == null ? '' : text);
  if (!body.trim()) return [];
  const lines = body.split(/\r?\n/);
  const beats: DialogueBeat[] = [];
  let current: DialogueBeat | null = null;

  function push(kind: SpeakerKind, id: string, label: string, chunk: string) {
    if (current) beats.push(current);
    current = { speaker: kind, id, name: label, text: chunk };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched: SpeakerKind | null = null;
    let matchExec: RegExpExecArray | null = null;

    for (let s = 0; s < SPEAKER_PATTERNS.length; s++) {
      matchExec = SPEAKER_PATTERNS[s].re.exec(line);
      if (matchExec) {
        matched = SPEAKER_PATTERNS[s].kind;
        break;
      }
    }

    if (matched === 'narrator') {
      push('narrator', '', '', line.replace(SPEAKER_PATTERNS[0].re, ''));
      continue;
    }
    if (matched === 'translation') {
      push('translation', '', '', line.replace(SPEAKER_PATTERNS[1].re, ''));
      continue;
    }
    if (matched === 'ryza') {
      push('ryza', '', '', line.replace(SPEAKER_PATTERNS[2].re, ''));
      continue;
    }
    if (matched === 'npc' && matchExec) {
      const raw = matchExec[1];
      const id = resolveNpcId(raw);
      push('npc', id, nameOfNpc(id, String(raw).trim()), line.replace(SPEAKER_PATTERNS[3].re, ''));
      continue;
    }
    push('ryza', '', '', line);
  }

  if (current) beats.push(current);
  return beats.filter((b) => b.text.trim() !== '');
}

/**
 * Only Ryza's own words go to the synthesizer and emotion/attitude path.
 */
export function spokenText(beats: DialogueBeat[]): string {
  return beats
    .filter((b) => b.speaker === 'ryza')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

const TRANS_LABEL: Record<string, string> = {
  zh: '译文',
  'zh-tw': '譯文',
  ja: '訳文',
  en: 'Translation',
  hi: 'अनुवाद',
  id: 'Terjemahan',
  'pt-br': 'Tradução',
};

export function translationLabel(uiLang?: string): string {
  const lang = uiLang || Langs.ui() || 'zh';
  return TRANS_LABEL[lang] || TRANS_LABEL.zh;
}

export function labelForBeat(beat: DialogueBeat, uiLang?: string): string {
  if (beat.speaker === 'ryza') return '';
  if (beat.speaker === 'narrator') return '';
  if (beat.speaker === 'translation') return translationLabel(uiLang);
  return beat.name || beat.id || '';
}

/**
 * Strip square bracket machine cues like `[emotion]` or `[face:x]` in dialogue lines.
 */
export function stripCues(s?: string): string {
  const src = String(s == null ? '' : s);
  let out = '';
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src.charAt(i);
    if (c === '[') {
      depth++;
      continue;
    }
    if (c === ']') {
      if (depth > 0) {
        depth--;
        continue;
      }
    }
    if (depth === 0) out += c;
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Sanitize a raw dialogue / history line for display and TTS consumption.
 * Strips machine tags ([emotion:...|attitude:...|stage:...]), markdown code blocks,
 * thinking tags, state deltas, inline bracket cues, and speaker prefixes.
 */
export function sanitizeSpokenDialogue(text?: string): string {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return '';
  const parsed = parseTaggedReply(raw);
  const stripped = stripCues(parsed.text);
  const beats = splitDialogue(stripped);
  const spoken = spokenText(beats);
  return (spoken || stripped).trim();
}

/**
 * Whether the reply contains speaker labels (NPC / narrator / translation / ryza prefixes).
 */
export function hasSpeakerLabels(text?: string): boolean {
  const body = String(text == null ? '' : text);
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (let s = 0; s < SPEAKER_PATTERNS.length; s++) {
      if (SPEAKER_PATTERNS[s].re.test(lines[i])) return true;
    }
  }
  return false;
}

/**
 * Translation text only for display. Never spoken.
 */
export function translationText(beats: DialogueBeat[] | string): string {
  const list = Array.isArray(beats) ? beats : splitDialogue(beats);
  return list
    .filter((b) => b.speaker === 'translation')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Score a placement against current location and day.
 */
export function scoreOfNpc(npc: NpcDef, st: StageInfo, day: number): number {
  let here: string | null = null;
  try {
    const loc = world.placement(day);
    here = loc ? loc[npc.id] || null : null;
  } catch {
    here = null;
  }

  let score = 0;
  if (here && here === st.stageId) score = 120; // already in the room

  (npc.bases || []).forEach((b) => {
    const pct = Number(b.pct) || 0;
    let bs: StageInfo | null = null;
    if (b.stageId) {
      try {
        bs = world.find(b.stageId);
      } catch {
        bs = null;
      }
    }
    if (b.stageId === st.stageId) score = Math.max(score, pct * 100);
    else if (bs && st.fieldId && bs.fieldId === st.fieldId) score = Math.max(score, pct * 50);
    else if (bs && st.areaId && bs.areaId === st.areaId) score = Math.max(score, pct * 25);
  });

  const mv = npc.move || {};
  score += (Number(mv.stage) || 0) * 3 + (Number(mv.field) || 0) * 2 + (Number(mv.area) || 0);
  return score;
}

export const MIN_NPC_SCORE = 1;
export const MAX_NPC_CANDIDATES = 6;

export interface NpcCandidate {
  id: string;
  name: string;
  note: string;
  score: number;
  order: number;
}

export function getCandidates(
  stageId: string,
  day: number = 1,
  limit: number = MAX_NPC_CANDIDATES
): NpcCandidate[] {
  if (!world || !stageId) return [];
  const st = world.find(stageId);
  if (!st) return [];
  const list = (world.npcs && world.npcs.npcs) || [];
  const out: NpcCandidate[] = [];

  list.forEach((n) => {
    if (!n || !n.id) return;
    if (n.id.toLowerCase() === 'npc_ryza') return;
    const sc = scoreOfNpc(n, st, day);
    if (sc > MIN_NPC_SCORE) {
      out.push({
        id: n.id,
        name: nameOfNpc(n.id, n.name),
        note: n.note || '',
        score: sc,
        order: n.resolveOrder || 999,
      });
    }
  });

  out.sort((a, b) => b.score - a.score || a.order - b.order);
  return out.slice(0, limit);
}

export function npcFrequency(freqKey?: string): string {
  const key = freqKey || 'normal';
  return FREQ[key] || FREQ.normal;
}

export function npcPromptBlock(
  st: { stage?: string; day?: number },
  opts?: { npcFrequency?: string; translate?: boolean }
): string {
  if (!world || !st || !st.stage) return '';
  const cand = getCandidates(st.stage, st.day || 1);
  if (!cand.length) return '';
  const L = ['## この場面に登場しうる人物（ライザ以外）'];
  cand.forEach((c) => {
    L.push(`- ${c.id}：${c.name}${c.note ? `（${c.note}）` : ''}`);
  });
  L.push('');
  L.push(npcFrequency(opts?.npcFrequency));
  L.push('この回に登場する場合だけ、行頭に「角色[ID]：」を付けて本人の台詞を書く（IDは上の一覧のまま）。');
  L.push(
    'あなた自身（ライザ）の台詞は「莱莎：」、地の文は「旁白：」で始める。前置きのない行はライザの台詞として扱われる。'
  );
  L.push(
    '行は必ず話者で始めること。台詞が複数行にわたる場合も、続きの行に同じ話者を付け直す（付け忘れるとライザの台詞として扱われる）。'
  );
  L.push(
    'NPCや旁白には表情・動作・音声のタグを付けない（それらの資源は存在しない）。一度に登場させるのは1人、多くても2人まで。'
  );
  if (opts?.translate) {
    L.push('返答の言語がプレイヤーの表示言語と違う場合、ライザの台詞の直後に「译文：」で訳を1行添えてよい。');
    L.push('「译文：」の行は画面にだけ表示され、音声にはならない（原文が読まれる）。');
  }
  L.push('上の一覧に無い人物の設定を創作しない。名前と立場以上の細かい設定は渡されていない。');
  L.push('話題に挙がっただけの人物を、その場にいることにしない。');
  return L.join('\n');
}
