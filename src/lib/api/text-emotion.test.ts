import { describe, it, expect } from 'vitest';
import { buildTextEmotionHint, applyTextEmotionHint, type TextEmotionHint } from './text-emotion';

describe('buildTextEmotionHint', () => {
  it('returns null for neutral emotion regardless of engine', () => {
    expect(buildTextEmotionHint({ emotion: 'neutral', provider: 'fish', model: 's2-pro' })).toBeNull();
    expect(buildTextEmotionHint({ emotion: undefined, provider: 'fish', model: 's2-pro' })).toBeNull();
    expect(buildTextEmotionHint({ emotion: 'neutral', provider: 'openai', model: 'irodori-tts' })).toBeNull();
  });

  it('Irodori TTS: canonical emoji marker, full emoji vocabulary (reuses IrodoriStrategy.matches)', () => {
    const hint = buildTextEmotionHint({ emotion: 'happy', provider: 'openai', model: 'irodori-tts' });
    expect(hint).not.toBeNull();
    expect(hint!.emotion).toBe('happy');
    expect(hint!.marker).toBe('😊');
    expect(hint!.vocabulary).toContain('😏');
    expect(hint!.promptSection).toContain('irodori-tts');
    expect(hint!.promptSection).toContain('"happy"');
  });

  it('Higgs Audio: canonical <|emotion:elation|> token + full documented vocabulary', () => {
    const hint = buildTextEmotionHint({
      emotion: 'happy',
      provider: 'boson',
      model: 'higgs-audio-v3-tts',
    });
    expect(hint).not.toBeNull();
    expect(hint!.marker).toBe('<|emotion:elation|>');
    expect(hint!.vocabulary).toContain('<|emotion:amusement|>');
    expect(hint!.vocabulary).toContain('<|emotion:sadness|>');
    expect(hint!.promptSection).toContain('higgs-audio-v3-tts');
    expect(hint!.promptSection).toContain('canonical token');
  });

  it('Higgs Audio: matches by model name alone, laughing → amusement', () => {
    const hint = buildTextEmotionHint({ emotion: 'laughing', provider: 'openai', model: 'higgs-tts-3' });
    expect(hint!.marker).toBe('<|emotion:amusement|>');
  });

  it('OmniVoice: [laughter] tag with documented non-verbal vocabulary', () => {
    const hint = buildTextEmotionHint({ emotion: 'laughing', provider: 'openai', model: 'omnivoice' });
    expect(hint).not.toBeNull();
    expect(hint!.marker).toBe('[laughter]');
    expect(hint!.vocabulary).toContain('[sigh]');
    expect(hint!.promptSection).toContain('no general emotion tags');
  });

  it('OmniVoice: no general emotion control — happy is unhinted', () => {
    expect(buildTextEmotionHint({ emotion: 'happy', provider: 'openai', model: 'omnivoice' })).toBeNull();
  });

  it('Fish Audio S2: [happy] cue with free-form vocabulary and layering guidance', () => {
    const hint = buildTextEmotionHint({ emotion: 'happy', provider: 'fish', model: 's2-pro' });
    expect(hint).not.toBeNull();
    expect(hint!.emotion).toBe('happy');
    expect(hint!.marker).toBe('[happy]');
    expect(hint!.vocabulary).toContain('[laughing]');
    expect(hint!.promptSection).toContain('layer up to three');
    expect(hint!.promptSection).toContain('s2-pro');
  });

  it('Fish Audio S2.1: canonical cue for crying is [sobbing]', () => {
    const hint = buildTextEmotionHint({ emotion: 'crying', provider: 'fish', model: 's2.1-pro-free' });
    expect(hint!.marker).toBe('[sobbing]');
  });

  it('Fish Audio legacy S1 models get no inline hint', () => {
    expect(buildTextEmotionHint({ emotion: 'happy', provider: 'fish', model: 'fishaudio-s1' })).toBeNull();
    expect(
      buildTextEmotionHint({ emotion: 'happy', provider: 'fish', model: 'fishaudio-s21pro-flash' })
    ).not.toBeNull();
  });

  it('MiniMax models route through Fish S2 bracket cues regardless of provider', () => {
    const fishMinimax = buildTextEmotionHint({ emotion: 'happy', provider: 'fish', model: 'minimax-2.8-hd' });
    expect(fishMinimax).not.toBeNull();
    expect(fishMinimax!.marker).toBe('[happy]');
    expect(fishMinimax!.placement).toBe('append');

    const otherMinimax = buildTextEmotionHint({
      emotion: 'happy',
      provider: 'openai',
      model: 'minimax-tts-01',
    });
    expect(otherMinimax).not.toBeNull();
    expect(otherMinimax!.marker).toBe('[happy]');
  });

  it('Qwen / VOICEVOX / unknown engines get no inline hinting', () => {
    expect(buildTextEmotionHint({ emotion: 'happy', provider: 'qwen', model: 'qwen3-tts-flash' })).toBeNull();
    expect(buildTextEmotionHint({ emotion: 'happy', provider: 'voicevox', model: undefined })).toBeNull();
    expect(
      buildTextEmotionHint({ emotion: 'happy', provider: 'openai', model: 'gpt-4o-mini-tts' })
    ).toBeNull();
  });
});

describe('applyTextEmotionHint', () => {
  const fishHint: TextEmotionHint = {
    emotion: 'happy',
    marker: '[happy]',
    placement: 'append',
    vocabulary: ['[happy]', '[laughing]', '[sad]', '[whispering]'],
    promptSection: '',
  };
  const higgsHint: TextEmotionHint = {
    emotion: 'happy',
    marker: '<|emotion:elation|>',
    placement: 'prepend',
    vocabulary: ['<|emotion:elation|>', '<|emotion:amusement|>'],
    promptSection: '',
  };

  it('inserts canonical marker only when the translator emitted none', () => {
    expect(applyTextEmotionHint('素敵だね！', fishHint)).toBe('素敵だね！ [happy]');
    expect(applyTextEmotionHint('やっほー！', higgsHint)).toBe('<|emotion:elation|> やっほー！');
  });

  it('leaves translator-placed markers untouched (any position, any count)', () => {
    expect(applyTextEmotionHint('最高 [happy] だね [happy]', fishHint)).toBe('最高 [happy] だね [happy]');
    expect(applyTextEmotionHint('はい [whispering] こっち', fishHint)).toBe('はい [whispering] こっち');
    expect(applyTextEmotionHint('<|emotion:elation|> やっほー！', higgsHint)).toBe(
      '<|emotion:elation|> やっほー！'
    );
  });

  it('returns input unchanged when hint is null or text empty', () => {
    expect(applyTextEmotionHint('plain', null)).toBe('plain');
    expect(applyTextEmotionHint('', fishHint)).toBe('');
  });
});
