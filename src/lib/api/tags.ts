export const EMOTIONS = [
  'neutral',
  'happy',
  'laughing',
  'tease',
  'shy',
  'cuddle',
  'sad',
  'crying',
  'angry',
] as const;

export const ATTITUDES = ['agree', 'deny', 'question'] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type Attitude = (typeof ATTITUDES)[number];

export interface ParsedState {
  stage?: string;
  current_stage?: string;
  sleep?: boolean;
  tod?: string;
  time_advance?: number;
  [key: string]: unknown;
}

export interface TagFieldsDest {
  emotion: Emotion | null;
  attitude: Attitude | null;
  nsfw: boolean | null;
  stage: string | null;
  tod: string | null;
  advance: number | null;
  [key: string]: unknown;
}

export interface TaggedReply {
  emotion: Emotion | null;
  attitude: Attitude | null;
  nsfw: boolean | null;
  text: string;
  state: ParsedState | null;
}

export interface ScreenTagState {
  emotion?: Emotion | string | null;
  attitude?: Attitude | string | null;
  nsfw?: boolean | null;
  stage?: string | null;
  tod?: 'mor' | 'aft' | 'eve' | 'ngt' | string | null;
  llmDrivesClock?: boolean;
}

const KEEP: Record<string, number> = { keep: 1, same: 1, omit: 1, here: 1 };

export function extractState(body: string): { text: string; state: ParsedState | null } {
  let state: ParsedState | null = null;
  let text = String(body || '');
  let m = /<state>\s*([\s\S]*?)\s*<\/state>/i.exec(text);
  if (!m) m = /<state>\s*([\s\S]*)$/i.exec(text); // forgotten closing tag

  if (m) {
    text = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
    try {
      const cleanJson = m[1].replace(/\/\/[^\n]*/g, '').replace(/,\s*([}\]])/g, '$1');
      state = JSON.parse(cleanJson);
    } catch {
      state = null;
    }
    if (state && (typeof state !== 'object' || Array.isArray(state))) state = null;
  }
  return { text, state };
}

export function parseTagFields(tag: string, dest: Partial<TagFieldsDest>): void {
  String(tag || '')
    .split(/[|｜,]/)
    .forEach((part) => {
      const m = /^\s*([A-Za-z_]+)\s*[:：]\s*(\S+)/.exec(part);
      if (!m) return;
      const k = m[1].toLowerCase();
      const v = m[2].replace(/[。．.]+$/, '').toLowerCase();
      if (k === 'emotion' && (EMOTIONS as readonly string[]).includes(v)) {
        dest.emotion = v as Emotion;
      } else if (k === 'attitude' && (ATTITUDES as readonly string[]).includes(v)) {
        dest.attitude = v as Attitude;
      } else if (k === 'undress' || k === 'nsfw') {
        if (KEEP[v]) dest.nsfw = null;
        else if (v === 'on' || v === '1' || v === 'true') dest.nsfw = true;
        else if (v === 'off' || v === '0' || v === 'false') dest.nsfw = false;
      } else if (k === 'stage' || k === 'place') {
        if (KEEP[v]) dest.stage = null;
        else dest.stage = v;
      } else if (k === 'tod') {
        if (KEEP[v]) dest.tod = null;
        else if (v === 'mor' || v === 'aft' || v === 'eve' || v === 'ngt') dest.tod = v;
        else if (/^\+?\d+/.test(v)) dest.advance = parseInt(v, 10);
      } else if (k === 'sleep') {
        if (v === 'on' || v === 'true' || v === '1' || v === 'yes') dest.stage = 'sleep';
      } else if (k === 'time_advance') {
        const n = parseInt(v, 10);
        if (!isNaN(n)) dest.advance = n;
      }
    });
}

export function isMachineTag(tag: string): boolean {
  return /(?:^|[|｜,\s])(?:emotion|attitude|undress|nsfw|stage|place|tod|sleep|time_advance)\s*[:：]/i.test(
    '|' + tag
  );
}

export function attachSceneTags(state: ParsedState | null, dest: Partial<TagFieldsDest>): ParsedState | null {
  const s: ParsedState = state && typeof state === 'object' && !Array.isArray(state) ? { ...state } : {};
  let hit = Boolean(state);
  if (dest.stage === 'sleep') {
    s.sleep = true;
    hit = true;
  } else if (dest.stage) {
    s.current_stage = dest.stage;
    hit = true;
  }
  if (dest.tod) {
    s.tod = dest.tod;
    hit = true;
  }
  if (dest.advance != null && !isNaN(dest.advance)) {
    s.time_advance = dest.advance;
    hit = true;
  }
  return hit ? s : null;
}

export function parseTaggedReply(text: string): TaggedReply {
  const dest: TagFieldsDest = {
    emotion: null,
    attitude: null,
    nsfw: null,
    stage: null,
    tod: null,
    advance: null,
  };
  let body = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim();
  body = body
    .replace(/^```[\w-]*\s*\n?/, '')
    .replace(/\n```\s*$/, '')
    .trim();
  body = body.replace(/^<think\b[^>]*>[\s\S]*?<\/think>\s*/i, '');
  body = body.replace(/^<reasoning\b[^>]*>[\s\S]*?<\/reasoning>\s*/i, '');

  let n = 0;
  while (n++ < 3 && body.charAt(0) === '[') {
    const end = body.indexOf(']');
    if (end === -1) break;
    const tag = body.slice(1, end);
    if (!isMachineTag(tag)) break;
    parseTagFields(tag, dest);
    body = body.slice(end + 1).replace(/^\s+/, '');
  }

  const ex = extractState(body);
  return {
    emotion: dest.emotion,
    attitude: dest.attitude,
    nsfw: dest.nsfw,
    text: ex.text,
    state: attachSceneTags(ex.state, dest),
  };
}

export function screenTagLine(tagState?: ScreenTagState): string {
  const emotion =
    tagState?.emotion && (EMOTIONS as readonly string[]).includes(tagState.emotion)
      ? tagState.emotion
      : 'happy';
  const attitude =
    tagState?.attitude && (ATTITUDES as readonly string[]).includes(tagState.attitude)
      ? tagState.attitude
      : 'agree';
  const undress = tagState?.nsfw ? 'on' : 'off';
  const stage = tagState?.stage || 'stage_01_001_04';
  const tod = tagState?.tod || 'aft';

  const parts = [`emotion:${emotion}`, `attitude:${attitude}`, `undress:${undress}`, `stage:${stage}`];
  if (tagState?.llmDrivesClock) parts.push(`tod:${tod}`);
  return `[${parts.join('|')}]`;
}
