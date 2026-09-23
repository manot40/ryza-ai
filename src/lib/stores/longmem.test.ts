import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  longMem,
  isProtected,
  scoreEntry,
  parseConsolidation,
  ENTRY_LIMIT,
  LONGMEM_KEY,
} from './longmem.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('longMem store', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    longMem.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('isProtected and scoring', () => {
    it('identifies protected categories and high importance', () => {
      const e1 = {
        id: '1',
        date: '2026-09-21',
        category: 'promise',
        importance: 3,
        summary: 'Promised to visit Kurken',
        status: 'active' as const,
        keywords: ['kurken'],
      };
      expect(isProtected(e1)).toBe(true);

      const e2 = {
        id: '2',
        date: '2026-09-21',
        category: 'general',
        importance: 5,
        summary: 'Great victory',
        status: 'active' as const,
        keywords: ['victory'],
      };
      expect(isProtected(e2)).toBe(true);

      const e3 = {
        id: '3',
        date: '2026-09-21',
        category: 'general',
        importance: 2,
        summary: 'Walk in the square',
        status: 'active' as const,
        keywords: ['walk'],
      };
      expect(isProtected(e3)).toBe(false);
    });

    it('scores entries higher with matching cue keywords', () => {
      const e = {
        id: '1',
        date: '2026-09-21',
        category: 'alchemy',
        importance: 3,
        summary: 'Synthesized Bomb',
        status: 'active' as const,
        keywords: ['bomb', 'synthesis'],
      };
      const baseScore = scoreEntry(e, '');
      const boostedScore = scoreEntry(e, 'Let us make a bomb');
      expect(boostedScore).toBeGreaterThan(baseScore);
    });
  });

  describe('enforceLimit and folding', () => {
    it('folds excess entries into digest while keeping protected ones', () => {
      for (let i = 0; i < ENTRY_LIMIT + 5; i++) {
        longMem.add(`Memory item ${i}`, {
          importance: i === 0 ? 5 : 2,
          category: i === 0 ? 'promise' : 'general',
          date: `2026-09-${String(i + 1).padStart(2, '0')}`,
        });
      }
      expect(longMem.entries.length).toBe(ENTRY_LIMIT);
      expect(longMem.digest.length).toBeGreaterThan(0);
      expect(longMem.entries.find((e) => e.category === 'promise')).toBeDefined();
    });
  });

  describe('parseConsolidation', () => {
    it('parses JSON with markdown fences or plain JSON', () => {
      const json = JSON.stringify({
        digest: 'Ryza traveled the island with the user.',
        entries: [
          {
            date: '2026-09-21',
            category: 'adventure',
            importance: 4,
            summary: 'Explored sunken mine',
            keywords: ['mine'],
          },
        ],
      });
      const parsed = parseConsolidation(`\`\`\`json\n${json}\n\`\`\``);
      expect(parsed?.digest).toBe('Ryza traveled the island with the user.');
      expect(parsed?.entries).toHaveLength(1);
    });
  });

  describe('snapshot and restore', () => {
    it('takes snapshot and restores correctly', () => {
      longMem.digest = 'Snapshot digest';
      longMem.add('Saved entry', { date: '2026-09-21', category: 'general' });
      longMem.note('user', 'Pending question', { noConsolidate: true });

      const snap = longMem.snapshot();
      expect(snap.digest).toBe('Snapshot digest');
      expect(snap.entries).toHaveLength(1);
      expect(snap.pending).toHaveLength(1);

      longMem.reset();
      expect(longMem.digest).toBe('');
      expect(longMem.entries).toHaveLength(0);
      expect(longMem.pending).toHaveLength(0);

      longMem.restore(snap);
      expect(longMem.digest).toBe('Snapshot digest');
      expect(longMem.entries).toHaveLength(1);
      expect(longMem.pending).toHaveLength(1);
      expect(mockStorage.getItem(LONGMEM_KEY)).not.toBeNull();
    });

    it('clearPending clears pending turns and persists', () => {
      longMem.note('user', 'Pending note', { noConsolidate: true });
      expect(longMem.pending).toHaveLength(1);
      longMem.clearPending();
      expect(longMem.pending).toHaveLength(0);
    });
  });

  describe('promptBlock', () => {
    it('generates prompt block with digest and selected entries', () => {
      longMem.digest = 'Together we explored Kurken.';
      longMem.add('Found a treasure chest', { date: '2026-09-21', keywords: ['chest'] });

      const block = longMem.promptBlock('chest');
      expect(block).toContain('## 長期記憶（概略）');
      expect(block).toContain('Together we explored Kurken.');
      expect(block).toContain('## 長期記憶（出来事）');
      expect(block).toContain('Found a treasure chest');
    });
  });
});
