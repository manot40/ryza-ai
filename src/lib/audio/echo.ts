export const LOOKBACK_MS = 20000;
export const LOOKBACK_CHARS = 1200;
export const MIN_TRANSCRIPT_CHARS = 6;
export const MIN_WINDOW_CHARS = 10;
export const THRESHOLD = 0.88;

interface RecentSpeech {
  text: string;
  at: number;
}

const _recent: RecentSpeech[] = [];

/**
 * Filter to Unicode letters and digits, converted to lowercase.
 */
export function normalize(s: unknown): string {
  let out = '';
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    if (/[\p{L}\p{N}]/u.test(c)) out += c.toLowerCase();
  }
  return out;
}

/**
 * Longest common subsequence length ratio between two strings (2 * LCS / (lenA + lenB)).
 */
export function lcsRatio(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Uint32Array(b.length + 1);
  let cur = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] =
        a.charCodeAt(i - 1) === b.charCodeAt(j - 1)
          ? prev[j - 1] + 1
          : prev[j] > cur[j - 1]
            ? prev[j]
            : cur[j - 1];
    }
    const t = prev;
    prev = cur;
    cur = t;
    cur.fill(0);
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}

function recentText(now: number): string {
  const cut = now - LOOKBACK_MS;
  let buf = '';
  for (let i = _recent.length - 1; i >= 0; i--) {
    if (_recent[i].at < cut) break;
    buf = _recent[i].text + '\n' + buf;
    if (buf.length >= LOOKBACK_CHARS) break;
  }
  if (buf.length > LOOKBACK_CHARS) buf = buf.slice(buf.length - LOOKBACK_CHARS);
  return buf;
}

function similar(enough: string, hay: string): boolean {
  if (lcsRatio(enough, normalize(hay)) >= THRESHOLD) return true;
  const n = enough.length;
  const win = Math.max(MIN_WINDOW_CHARS, n);
  if (hay.length <= win) return false;
  const step = Math.max(1, Math.floor(n / 4));
  for (let i = 0; i + win <= hay.length; i += step) {
    if (lcsRatio(enough, hay.slice(i, i + win)) >= THRESHOLD) return true;
  }
  return false;
}

export function remember(text: unknown, now?: number): void {
  const t = String(text ?? '').trim();
  if (!t) return;
  _recent.push({ text: t, at: now != null ? Number(now) : Date.now() });
  const cut = _recent[_recent.length - 1].at - LOOKBACK_MS;
  while (_recent.length && _recent[0].at < cut) _recent.shift();
}

export function looksLikeEcho(transcript: unknown, now?: number): boolean {
  const n = normalize(transcript);
  if (n.length < MIN_TRANSCRIPT_CHARS) return false;
  const hay = normalize(recentText(now != null ? Number(now) : Date.now()));
  if (hay.length < MIN_WINDOW_CHARS) return false;
  return similar(n, hay);
}

export function reset(): void {
  _recent.length = 0;
}

export function recentCount(): number {
  return _recent.length;
}

export const Echo = {
  LOOKBACK_MS,
  LOOKBACK_CHARS,
  MIN_TRANSCRIPT_CHARS,
  THRESHOLD,
  remember,
  looksLikeEcho,
  reset,
  recentCount,
  _normalize: normalize,
  _lcsRatio: lcsRatio,
};

export default Echo;
