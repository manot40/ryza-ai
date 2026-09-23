/**
 * Model-aware inline text emotion-hint factory.
 *
 * Some TTS engines read emotion cues directly from the input *text* rather
 * than from API parameters or instructions. When a line is machine-translated
 * (see `translate()` in `index.ts`), the translator's system prompt needs to
 * know which inline markers the downstream TTS engine understands so it can
 * weave them into the translated line.
 *
 * Design: instead of dictating a rigid prepend/append instruction, the prompt
 * hands the translator the engine's documented marker vocabulary plus Ryza's
 * current emotion, and lets it place cues naturally — mid-sentence tone
 * shifts, leading delivery tokens, layered cues — per each engine's official
 * guidance. `applyTextEmotionHint()` is only a light fallback: it inserts the
 * canonical marker when the translator emitted none, and never rewrites
 * markers the translator already placed.
 *
 * Marker rules per engine (verified against official docs, 2026-09):
 * - Irodori TTS (audio.cpp): emoji as the emotion vehicle.
 * - Higgs Audio v3 (Boson AI): `<|emotion:…|>` special tokens; delivery
 *   tokens lead the turn, positional freedom otherwise.
 *   https://docs.boson.ai/models/higgs-audio-tts/tags
 * - OmniVoice (k2-fsa): fixed non-verbal tag set (`[laughter]`, `[sigh]`, …);
 *   no general emotion control.
 *   https://github.com/k2-fsa/OmniVoice
 * - Fish Audio S2 / S2.1-Pro: `[bracket]` cues with free-form natural
 *   language; sentence-level cues best at sentence start; layering allowed
 *   (S1 legacy uses parentheses).
 *   https://docs.fish.audio/developer-guide/core-features/emotions.md
 *
 * `matches()` dispatch is REUSED via `model-detect.ts` (shared with
 * `tts-emotion.ts`) — no provider/model regex duplication here.
 */

import { EMOTIONS, type Emotion } from './tags';
import { normalizeEmotion } from './tts-emotion';
import { DefaultEmotionStrategy, IrodoriStrategy } from './tts-emotion';
import {
  isHiggsModel,
  isIrodoriModel,
  isOmniVoiceModel,
  isQwenFamily,
  isOpenAiAudioFamily,
  isVoicevoxFamily,
  strategyMatches,
  isMiniMaxModel,
  isFishOrMiniMax,
} from './model-detect';

export type EmotionHintPlacement = 'prepend' | 'append';

export interface TextEmotionHint {
  /** Ryza's normalized emotion for this line */
  readonly emotion: Emotion;
  /** Canonical marker for the current emotion — used only by the fallback pass */
  readonly marker: string;
  /** Engine's conventional marker placement — fallback only, the LLM has freedom */
  readonly placement: EmotionHintPlacement;
  /** Documented marker vocabulary the engine understands */
  readonly vocabulary: readonly string[];
  /** Freedom-oriented system-prompt guidance for the translator */
  readonly promptSection: string;
}

/* ------------------------------------------------------------- Vocabulary */

/** Irodori TTS: emotion → emoji */
const IRODORI_EMOJI: Partial<Record<Emotion, string>> = {
  happy: '😊',
  laughing: '😆',
  tease: '😏',
  shy: '😳',
  cuddle: '🥰',
  sad: '😢',
  crying: '😭',
  angry: '😠',
  neutral: undefined,
};

/** Full documented Irodori emoji set, offered to the translator */
const IRODORI_VOCAB: readonly string[] = ['😊', '😆', '😏', '😳', '🥰', '😢', '😭', '😠'];

/**
 * Higgs Audio: emotion → `<|emotion:…|>` special token (documented set only;
 * unsupported emotions map to `undefined` and yield no hint).
 */
const HIGGS_TOKEN: Partial<Record<Emotion, string>> = {
  happy: 'elation',
  laughing: 'amusement',
  tease: 'amusement',
  shy: 'shame',
  cuddle: 'affection',
  sad: 'sadness',
  crying: 'sadness',
  angry: 'anger',
  neutral: undefined,
};

/** Full documented Higgs emotion token list */
const HIGGS_VOCAB: readonly string[] = [
  'elation',
  'amusement',
  'enthusiasm',
  'determination',
  'pride',
  'contentment',
  'affection',
  'relief',
  'contemplation',
  'confusion',
  'surprise',
  'awe',
  'longing',
  'arousal',
  'anger',
  'fear',
  'disgust',
  'bitterness',
  'sadness',
  'shame',
  'helplessness',
];

/**
 * OmniVoice: emotion → documented non-verbal tag. The engine has no general
 * emotion control, so only laughter/sigh map; everything else is intentionally
 * left unhinted.
 */
const OMNIVOICE_TAG: Partial<Record<Emotion, string>> = {
  laughing: 'laughter',
  sad: 'sigh',
  crying: 'sigh',
  neutral: undefined,
};

/** Full documented OmniVoice non-verbal tag set */
const OMNIVOICE_VOCAB: readonly string[] = [
  '[laughter]',
  '[sigh]',
  '[confirmation-en]',
  '[question-en]',
  '[question-ah]',
  '[question-oh]',
  '[question-ei]',
  '[question-yi]',
  '[surprise-ah]',
  '[surprise-oh]',
  '[surprise-wa]',
  '[surprise-yo]',
  '[dissatisfaction-hnn]',
];

/** Fish Audio S2: emotion → documented bracket cue name */
const FISH_S2_TAG: Partial<Record<Emotion, string>> = {
  happy: 'happy',
  laughing: 'laughing',
  tease: 'sarcastic',
  shy: 'embarrassed',
  cuddle: 'delighted',
  sad: 'sad',
  crying: 'sobbing',
  angry: 'angry',
  neutral: undefined,
};

/** Example Fish S2 cue vocabulary shown to the translator (free-form allowed) */
const FISH_S2_VOCAB: readonly string[] = [
  '[happy]',
  '[delighted]',
  '[laughing]',
  '[sad]',
  '[sobbing]',
  '[angry]',
  '[sarcastic]',
  '[embarrassed]',
  '[whispering]',
  '[soft tone]',
];

/* --------------------------------------------------------- Hint builder */

const HIGGS_PROMPT =
  'It reads inline <|emotion:...|> tokens embedded in the text: {VOCAB}. ' +
  'Ryza is currently feeling {EMOTION}; the canonical token is {MARKER}. ' +
  'Place tokens where the tone naturally shifts — lead the line with one when the whole line is emotional, ' +
  'or insert one mid-sentence for a change of feeling. Use as few or as many as the line needs (usually one), ' +
  'and omit them entirely if the words already carry the feeling. Never translate or reword the tokens.';

const OMNIVOICE_PROMPT =
  'It supports inline non-verbal tags embedded in the text: {VOCAB}. It has no general emotion tags. ' +
  'Ryza is currently feeling {EMOTION}; the canonical tag is {MARKER}. ' +
  'Only insert a tag where the line naturally contains that sound (a laugh, a sigh, an interjection), ' +
  'placed right where the sound would occur, and leave lines without any such moment completely untouched. ' +
  'Never translate or reword the tags.';

const FISH_S2_PROMPT =
  'It reads [bracket] cues with free-form natural-language descriptions embedded in the text, e.g. {VOCAB}. ' +
  'Ryza is currently feeling {EMOTION}; the canonical cue is {MARKER}. ' +
  'Sentence-level cues usually work best at the beginning of the sentence they control; you may layer up to three cues; ' +
  'place [emphasis] right before the word to stress. Use your judgment — skip cues entirely when the line is short ' +
  'or already expressive. Never translate or reword the cues.';

const IRODORI_PROMPT =
  'It conveys emotion through emoji embedded in the text, e.g. {VOCAB}. ' +
  'Ryza is currently feeling {EMOTION}; the canonical emoji is {MARKER}. ' +
  'Place the emoji where it feels natural — typically appended after the phrase it colors, ' +
  'usually once per line — and skip it when the line does not warrant one.';

function renderPrompt(
  template: string,
  hint: Omit<TextEmotionHint, 'promptSection'>,
  engine: string
): string {
  return `The translated line will be spoken by ${engine}. ${template}`
    .replace('{VOCAB}', hint.vocabulary.join(', '))
    .replace('{EMOTION}', `"${hint.emotion}"`)
    .replace('{MARKER}', hint.marker)
    .replace('{MARKER}', hint.marker);
}

/**
 * Build the inline emotion hint for a given TTS engine + emotion, or `null`
 * when the engine needs no inline hinting (or the emotion is neutral /
 * unsupported for that engine).
 */
export function buildTextEmotionHint(ctx: {
  emotion?: string;
  provider: string;
  model?: string;
}): TextEmotionHint | null {
  const model = String(ctx.model || '');
  const provider = String(ctx.provider || '');
  const norm: Emotion = normalizeEmotion(ctx.emotion);
  if (norm === 'neutral') return null;

  /* Irodori TTS — emoji as the emotion vehicle */
  if (strategyMatches(IrodoriStrategy, provider, model) || isIrodoriModel(model)) {
    const emoji = IRODORI_EMOJI[norm];
    if (!emoji) return null;
    const base: Omit<TextEmotionHint, 'promptSection'> = {
      emotion: norm,
      marker: emoji,
      placement: 'append',
      vocabulary: IRODORI_VOCAB,
    };
    return { ...base, promptSection: renderPrompt(IRODORI_PROMPT, base, model || 'irodori-tts') };
  }

  /* Higgs Audio — `<|emotion:…|>` tokens */
  if (isHiggsModel(provider, model)) {
    const token = HIGGS_TOKEN[norm];
    if (!token) return null;
    const base: Omit<TextEmotionHint, 'promptSection'> = {
      emotion: norm,
      marker: `<|emotion:${token}|>`,
      placement: 'prepend',
      vocabulary: HIGGS_VOCAB.map((t) => `<|emotion:${t}|>`),
    };
    return { ...base, promptSection: renderPrompt(HIGGS_PROMPT, base, model || 'Higgs Audio') };
  }

  /* OmniVoice — fixed non-verbal tag set */
  if (isOmniVoiceModel(provider, model)) {
    const tag = OMNIVOICE_TAG[norm];
    if (!tag) return null;
    const base: Omit<TextEmotionHint, 'promptSection'> = {
      emotion: norm,
      marker: `[${tag}]`,
      placement: 'prepend',
      vocabulary: OMNIVOICE_VOCAB,
    };
    return { ...base, promptSection: renderPrompt(OMNIVOICE_PROMPT, base, model || 'OmniVoice') };
  }

  /* Fish Audio S2 — `[bracket]` cues (legacy S1 / MiniMax excluded) */
  if (isFishOrMiniMax(provider, model)) {
    const tag = FISH_S2_TAG[norm];
    if (!tag) return null;
    const base: Omit<TextEmotionHint, 'promptSection'> = {
      emotion: norm,
      marker: `[${tag}]`,
      placement: 'append',
      vocabulary: FISH_S2_VOCAB,
    };
    return { ...base, promptSection: renderPrompt(FISH_S2_PROMPT, base, model || 'Fish Audio S2') };
  }

  /* Engines handled purely via instructions / payloads / acoustic params */
  if (isQwenFamily(provider, model) || isOpenAiAudioFamily(provider, model) || isVoicevoxFamily(provider)) {
    return null;
  }

  /* Default strategy = catch-all; unknown engines get no inline hinting */
  if (strategyMatches(DefaultEmotionStrategy, provider, model)) return null;
  return null;
}

/* ------------------------------------------------- Fallback post-pass */

function escapeMarker(marker: string): string {
  return marker.replace(/[.*+?^${}()|[\]\\|<>]/g, '\\$&');
}

/**
 * Light deterministic fallback: when the translator emitted NONE of the
 * engine's known markers, insert the canonical marker for the current emotion
 * at the engine's conventional placement. When the translator already placed
 * any marker (anywhere, any count — its creative freedom), the line is
 * returned untouched.
 */
export function applyTextEmotionHint(text: string, hint: TextEmotionHint | null): string {
  const line = String(text || '').trim();
  if (!line || !hint) return line;

  const anyKnown = hint.vocabulary.some((marker) => new RegExp(escapeMarker(marker)).test(line));
  if (anyKnown) return line;

  return hint.placement === 'prepend'
    ? `${hint.marker}${line ? ` ${line}` : ''}`
    : `${line ? `${line} ` : ''}${hint.marker}`;
}

/** All canonical emotion names, re-exported for consumers/tests */
export const TEXT_EMOTION_IDS = EMOTIONS;
