import { describe, it, expect, beforeEach } from 'vitest';
import {
  splitDialogue,
  spokenText,
  translationText,
  hasSpeakerLabels,
  stripCues,
  sanitizeSpokenDialogue,
  resolveNpcId,
  nameOfNpc,
  labelForBeat,
  npcPromptBlock,
  getCandidates,
} from './npc-dialogue';
import { world } from '$lib/stores/world.svelte';

describe('npc-dialogue', () => {
  beforeEach(async () => {
    await world.init({
      hierarchy: {
        areas: [
          {
            id: 'area_01',
            name: 'Kurken Island',
            fields: [
              {
                id: 'field_01',
                name: 'Rasenboden',
                stages: [
                  { id: 'stage_01', name: 'Ryza Room' },
                  { id: 'stage_02', name: 'Square' },
                ],
              },
            ],
          },
        ],
      },
      npcs: {
        npcs: [
          { id: 'npc_ryza', name: 'Ryza' },
          { id: 'npc_tao', name: 'Tao', note: 'Bookworm', bases: [{ stageId: 'stage_01', pct: 0.8 }] },
          {
            id: 'npc_klaudia',
            name: 'Klaudia',
            note: 'Merchant daughter',
            bases: [{ stageId: 'stage_02', pct: 0.5 }],
          },
        ],
      },
      stageMap: {},
      scenes: {},
    });
  });

  describe('resolveNpcId and nameOfNpc', () => {
    it('resolves raw id to full placement id', () => {
      expect(resolveNpcId('tao')).toBe('npc_tao');
      expect(resolveNpcId('npc_tao')).toBe('npc_tao');
      expect(resolveNpcId('TAO')).toBe('npc_tao');
      expect(resolveNpcId('unknown_person')).toBe('');
    });

    it('returns npc name or fallback', () => {
      expect(nameOfNpc('npc_tao')).toBe('Tao');
      expect(nameOfNpc('unknown_id', 'Guest')).toBe('Guest');
    });
  });

  describe('stripCues', () => {
    it('removes square bracket machine cues', () => {
      expect(stripCues('Hello [happy] there!')).toBe('Hello there!');
      expect(stripCues('[action:wave] Nice to meet you [pose:stand]')).toBe('Nice to meet you');
      expect(stripCues('No tags here')).toBe('No tags here');
    });
  });

  describe('sanitizeSpokenDialogue', () => {
    it('strips system machine tags and state blocks from chat history', () => {
      const input =
        '[emotion:happy|attitude:agree|undress:off|stage:stage_01_001_04]\n元気だよ！\n<state>{"money_delta": 10}</state>';
      expect(sanitizeSpokenDialogue(input)).toBe('元気だよ！');
    });

    it('strips speaker prefixes and inline cues', () => {
      const input = '[emotion:shy|attitude:agree]\nライザ：[happy]ちょっと照れるな…[pose:stand]';
      expect(sanitizeSpokenDialogue(input)).toBe('ちょっと照れるな…');
    });

    it('handles clean dialogue without modification', () => {
      expect(sanitizeSpokenDialogue('おはよう！今日もがんばろうね。')).toBe('おはよう！今日もがんばろうね。');
      expect(sanitizeSpokenDialogue('')).toBe('');
    });
  });

  describe('splitDialogue', () => {
    it('defaults unprefixed lines to ryza', () => {
      const beats = splitDialogue('今日もいい天気だね！\n調合しようよ！');
      expect(beats).toHaveLength(2);
      expect(beats[0].speaker).toBe('ryza');
      expect(beats[0].text).toBe('今日もいい天気だね！');
      expect(beats[1].speaker).toBe('ryza');
    });

    it('parses multi-speaker dialogue beats', () => {
      const text = [
        '角色[tao]：ライザ、この本見てよ！',
        '莱莎：わあ、何の本？',
        '旁白：タオは古い羊皮紙を広げた。',
        '译文：Tao spread out an old parchment.',
      ].join('\n');

      const beats = splitDialogue(text);
      expect(beats).toHaveLength(4);
      expect(beats[0].speaker).toBe('npc');
      expect(beats[0].id).toBe('npc_tao');
      expect(beats[0].name).toBe('Tao');
      expect(beats[0].text).toBe('ライザ、この本見てよ！');

      expect(beats[1].speaker).toBe('ryza');
      expect(beats[1].text).toBe('わあ、何の本？');

      expect(beats[2].speaker).toBe('narrator');
      expect(beats[2].text).toBe('タオは古い羊皮紙を広げた。');

      expect(beats[3].speaker).toBe('translation');
      expect(beats[3].text).toBe('Tao spread out an old parchment.');
    });

    it('detects speaker labels', () => {
      expect(hasSpeakerLabels('角色[tao]：やあ')).toBe(true);
      expect(hasSpeakerLabels('ナレーション：風が吹いた')).toBe(true);
      expect(hasSpeakerLabels('ただの普通のセリフ')).toBe(false);
    });

    it('extracts spokenText and translationText', () => {
      const beats = splitDialogue('莱莎：錬金術最高！\n角色[tao]：うん！\n译文：Alchemy is great!');
      expect(spokenText(beats)).toBe('錬金術最高！');
      expect(translationText(beats)).toBe('Alchemy is great!');
    });

    it('formats label for beats', () => {
      const beats = splitDialogue('莱莎：A\n角色[tao]：B\n旁白：C\n译文：D');
      expect(labelForBeat(beats[0])).toBe('');
      expect(labelForBeat(beats[1])).toBe('Tao');
      expect(labelForBeat(beats[2])).toBe('');
      expect(labelForBeat(beats[3], 'en')).toBe('Translation');
      expect(labelForBeat(beats[3], 'ja')).toBe('訳文');
    });
  });

  describe('candidates and promptBlock', () => {
    it('scores candidates based on stage base', () => {
      const cand = getCandidates('stage_01', 1);
      expect(cand.length).toBeGreaterThan(0);
      expect(cand.find((c) => c.id === 'npc_tao')).toBeDefined();
      expect(cand.find((c) => c.id === 'npc_ryza')).toBeUndefined();
    });

    it('generates prompt block with candidate info and rules', () => {
      const block = npcPromptBlock({ stage: 'stage_01', day: 1 }, { translate: true });
      expect(block).toContain('## この場面に登場しうる人物（ライザ以外）');
      expect(block).toContain('npc_tao');
      expect(block).toContain('「角色[ID]：」');
      expect(block).toContain('「译文：」');
    });
  });
});
