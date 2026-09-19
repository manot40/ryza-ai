import { describe, it, expect, beforeEach } from 'vitest';
import { world, TODS } from './world.svelte';
import type { WorldHierarchy, NpcPlacementDoc, StageBackgroundMap, ScenesDoc } from './world.svelte';
import { game } from './game.svelte';

const mockHierarchy: WorldHierarchy = {
  areas: [
    {
      id: 'area_01',
      name: 'クーケン島周辺地域',
      fields: [
        {
          id: 'field_01_001',
          name: 'クーケン島',
          stages: [
            { id: 'stage_01_001_01', name: '尖塔の貯水池' },
            { id: 'stage_01_001_04', name: 'ライザの家' },
            { id: 'stage_01_001_06', name: '憩いの広場' },
          ],
        },
      ],
    },
    {
      id: 'area_02',
      name: 'クレリア地方',
      fields: [
        {
          id: 'field_02_001',
          name: '採掘街道',
          stages: [{ id: 'stage_02_001_01', name: '旧採掘場跡' }],
        },
      ],
    },
  ],
};

const mockNpcs: NpcPlacementDoc = {
  npcs: [
    {
      id: 'npc_ryza',
      name: 'ライザ',
      resolveOrder: 1,
      bases: [{ stageId: 'stage_01_001_04', pct: 100 }],
      move: { area: 0, field: 0, stage: 0 },
    },
    {
      id: 'npc_lent',
      name: 'レント',
      resolveOrder: 2,
      bases: [{ stageId: 'stage_01_001_01', pct: 100 }],
      move: { area: 0, field: 0, stage: 0 },
    },
  ],
};

const mockStageBgMap: StageBackgroundMap = {
  stage_01_001_04: 'bg_ryza_home',
  stage_01_001_01: 'bg_reservoir',
};

const mockScenes: ScenesDoc = {
  bg_ryza_home: { name: 'Home' },
};

describe('WorldStore', () => {
  beforeEach(async () => {
    await world.init({
      hierarchy: mockHierarchy,
      npcs: mockNpcs,
      stageMap: mockStageBgMap,
      scenes: mockScenes,
    });
  });

  it('initializes catalogs properly', () => {
    expect(world.hierarchy).toEqual(mockHierarchy);
    expect(world.npcs).toEqual(mockNpcs);
    expect(world.stageMap).toEqual(mockStageBgMap);
    expect(world.scenes).toEqual(mockScenes);
  });

  it('computes time of day correctly from hour', () => {
    expect(world.hourToTod(6)).toBe('mor');
    expect(world.hourToTod(10)).toBe('mor');
    expect(world.hourToTod(11)).toBe('aft');
    expect(world.hourToTod(16)).toBe('aft');
    expect(world.hourToTod(17)).toBe('eve');
    expect(world.hourToTod(19)).toBe('eve');
    expect(world.hourToTod(20)).toBe('ngt');
    expect(world.hourToTod(4)).toBe('ngt');
  });

  it('returns matching todStartHour and tod labels', () => {
    expect(world.todStartHour('mor')).toBe(6);
    expect(world.todStartHour('aft')).toBe(12);
    expect(world.todStartHour('eve')).toBe(17);
    expect(world.todStartHour('ngt')).toBe(21);
    expect(world.todLabel('mor')).toBe('朝');
    expect(world.nextTod('mor')).toBe('aft');
    expect(world.nextTod('ngt')).toBe('mor');
  });

  it('computes flowHour correctly', () => {
    // 12:00 at time 100000, current time is 60,000ms later (160000)
    // with speed 60 (1 real min = 1 game hour), flowHour should be 13
    const h = world.flowHour(12, 100000, 160000, 60);
    expect(h).toBe(13);
  });

  it('retrieves placement for day and npcsAt stage', () => {
    const loc = world.placement(1);
    expect(loc['npc_ryza']).toBe('stage_01_001_04');
    expect(loc['npc_lent']).toBe('stage_01_001_01');

    const ryzaHomeNpcs = world.npcsAt('stage_01_001_04', 1);
    expect(ryzaHomeNpcs.length).toBe(1);
    expect(ryzaHomeNpcs[0].id).toBe('npc_ryza');

    const dockNpcs = world.npcsAt('unknown_stage', 1);
    expect(dockNpcs).toEqual([]);
  });

  it('resolves stage metadata and lock state', () => {
    const stage = world.find('stage_01_001_04');
    expect(stage).toBeDefined();
    expect(stage?.areaId).toBe('area_01');
    expect(stage?.fieldId).toBe('field_01_001');
    expect(stage?.stageId).toBe('stage_01_001_04');

    // Alias resolution
    expect(world.resolveStage('home')).toBe('stage_01_001_04');
    expect(world.resolveStage('ライザの家')).toBe('stage_01_001_04');

    // Lock states: area_01 is always unlocked; area_02 requires sailed
    game.sailed = false;
    expect(world.locked('area_01')).toBe(false);
    expect(world.locked('area_02')).toBe(true);

    game.sailed = true;
    expect(world.locked('area_02')).toBe(false);
  });

  it('generates prompt block with current stage info', () => {
    const block = world.promptBlock({ stage: 'stage_01_001_04', tod: 'mor' });
    expect(block).toContain('## いまの場所');
    expect(block).toContain('stage_01_001_04');
    expect(block).toContain('時間帯：mor');
  });

  it('calculates deterministic FNV-1a hash', () => {
    const h1 = world._hash('test-seed-1');
    const h2 = world._hash('test-seed-1');
    const h3 = world._hash('test-seed-2');
    expect(typeof h1).toBe('number');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});
