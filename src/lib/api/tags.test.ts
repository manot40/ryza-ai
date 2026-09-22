import { describe, it, expect } from 'vitest';
import {
  parseTaggedReply,
  extractState,
  screenTagLine,
  parseTagFields,
  isMachineTag,
  EMOTIONS,
  ATTITUDES,
  type TagFieldsDest,
} from './tags';

describe('api tags module', () => {
  describe('constants', () => {
    it('defines emotions and attitudes', () => {
      expect(EMOTIONS).toContain('happy');
      expect(EMOTIONS).toContain('sad');
      expect(ATTITUDES).toContain('agree');
      expect(ATTITUDES).toContain('deny');
    });
  });

  describe('extractState', () => {
    it('extracts JSON state block and returns stripped text', () => {
      const input = 'Hello Ryza!\n<state>{"stamina_delta": -2, "money_delta": 50}</state>';
      const res = extractState(input);
      expect(res.text).toBe('Hello Ryza!');
      expect(res.state).toEqual({ stamina_delta: -2, money_delta: 50 });
    });

    it('handles forgotten closing </state> tag', () => {
      const input = 'Wait for me!\n<state>{"exp_delta": 20}';
      const res = extractState(input);
      expect(res.text).toBe('Wait for me!');
      expect(res.state).toEqual({ exp_delta: 20 });
    });

    it('cleans JS comments and trailing commas inside state JSON', () => {
      const input = 'Text\n<state>{\n  // comment\n  "stamina_delta": 5,\n}</state>';
      const res = extractState(input);
      expect(res.text).toBe('Text');
      expect(res.state).toEqual({ stamina_delta: 5 });
    });

    it('returns null state on invalid JSON without throwing', () => {
      const input = 'Hello\n<state>not valid json</state>';
      const res = extractState(input);
      expect(res.text).toBe('Hello');
      expect(res.state).toBeNull();
    });

    it('returns original text when no state tag exists', () => {
      const input = 'Just plain conversation text.';
      const res = extractState(input);
      expect(res.text).toBe(input);
      expect(res.state).toBeNull();
    });
  });

  describe('isMachineTag & parseTagFields', () => {
    it('identifies machine tag patterns', () => {
      expect(isMachineTag('emotion:happy|attitude:agree')).toBe(true);
      expect(isMachineTag('undress:on')).toBe(true);
      expect(isMachineTag('stage:sleep')).toBe(true);
      expect(isMachineTag('Hello there, how are you?')).toBe(false);
    });

    it('parses tag fields with aliases and case insensitivity', () => {
      const dest: Partial<TagFieldsDest> = {};
      parseTagFields('emotion:Tease|attitude:Agree|undress:ON|stage:place_01|tod:MOr', dest);
      expect(dest.emotion).toBe('tease');
      expect(dest.attitude).toBe('agree');
      expect(dest.nsfw).toBe(true);
      expect(dest.stage).toBe('place_01');
      expect(dest.tod).toBe('mor');
    });

    it('handles nsfw as an alias for undress', () => {
      const dest: Partial<TagFieldsDest> = {};
      parseTagFields('nsfw:off', dest);
      expect(dest.nsfw).toBe(false);

      parseTagFields('nsfw:1', dest);
      expect(dest.nsfw).toBe(true);
    });

    it('handles keep/same/omit keywords by leaving value null', () => {
      const dest: Partial<TagFieldsDest> = { nsfw: true, stage: 'old' };
      parseTagFields('undress:keep|stage:same', dest);
      expect(dest.nsfw).toBeNull();
      expect(dest.stage).toBeNull();
    });

    it('parses sleep and time_advance tags', () => {
      const dest: Partial<TagFieldsDest> = {};
      parseTagFields('sleep:on|tod:+2', dest);
      expect(dest.stage).toBe('sleep');
      expect(dest.advance).toBe(2);
    });
  });

  describe('parseTaggedReply', () => {
    it('parses complete LLM response with tags, text, and state', () => {
      const raw =
        '[emotion:happy|attitude:agree|undress:off|stage:stage_01_001_04]\n' +
        'おはよう！今日もいい天気だね！\n' +
        '<state>{"stamina_delta": -1}</state>';

      const parsed = parseTaggedReply(raw);
      expect(parsed.emotion).toBe('happy');
      expect(parsed.attitude).toBe('agree');
      expect(parsed.nsfw).toBe(false);
      expect(parsed.text).toBe('おはよう！今日もいい天気だね！');
      expect(parsed.state).toEqual({
        stamina_delta: -1,
        current_stage: 'stage_01_001_04',
      });
    });

    it('strips <think> and <reasoning> blocks', () => {
      const raw =
        '<think>The user is greeting me warmly.</think>\n' +
        '[emotion:laughing|attitude:agree]\n' +
        'あはは、そうだね！';

      const parsed = parseTaggedReply(raw);
      expect(parsed.emotion).toBe('laughing');
      expect(parsed.text).toBe('あはは、そうだね！');
    });

    it('strips markdown code fences', () => {
      const raw = '```markdown\n' + '[emotion:shy]\n' + 'ちょっと照れるな…\n' + '```';

      const parsed = parseTaggedReply(raw);
      expect(parsed.emotion).toBe('shy');
      expect(parsed.text).toBe('ちょっと照れるな…');
    });
  });

  describe('screenTagLine', () => {
    it('produces formatted tag line from given state', () => {
      const line = screenTagLine({
        emotion: 'shy',
        attitude: 'agree',
        nsfw: true,
        stage: 'stage_02',
        tod: 'eve',
        llmDrivesClock: true,
      });
      expect(line).toBe('[emotion:shy|attitude:agree|undress:on|stage:stage_02|tod:eve]');
    });

    it('uses fallback defaults when parameters are omitted', () => {
      const line = screenTagLine();
      expect(line).toBe('[emotion:happy|attitude:agree|undress:off|stage:stage_01_001_04]');
    });
  });
});
