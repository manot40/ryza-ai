import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryStore, MEMORY_KEY } from './memory.svelte';
import { config } from './config.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('MemoryStore', () => {
  let mockStorage: LocalStorageMock;
  let memory: MemoryStore;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    config._resetForTest();
    memory = new MemoryStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initializes with empty state and loads valid cards from storage', () => {
    mockStorage.setItem(
      MEMORY_KEY,
      JSON.stringify({
        v: 1,
        pending: [{ role: 'user', text: 'hello', at: 1 }],
        sessions: [{ id: 's1', layer: 'session', text: 'Session 1', at: 1, n: 1 }],
        summaries: [{ id: 'm1', layer: 'summary', text: 'Summary 1', at: 1, n: 1 }],
      })
    );
    const loaded = new MemoryStore();
    expect(loaded.pending.length).toBe(1);
    expect(loaded.sessions.length).toBe(1);
    expect(loaded.sessions[0].text).toBe('Session 1');
    expect(loaded.summaries.length).toBe(1);
    expect(loaded.summaries[0].text).toBe('Summary 1');
  });

  it('ingests turns and batches them into pending', () => {
    memory.ingest('User line 1', 'Ryza line 1');
    // 1 user turn + 1 assistant turn = 2 items in pending
    expect(memory.pending.length).toBe(2);
    expect(memory.pendingTurns()).toBe(1);
    expect(memory.pending[0]).toEqual({
      role: 'user',
      text: 'User line 1',
      at: expect.any(Number),
    });
    expect(memory.pending[1]).toEqual({
      role: 'assistant',
      text: 'Ryza line 1',
      at: expect.any(Number),
    });
  });

  it('flushNow folds current pending turns into session immediately', async () => {
    const fakeSummarizer = vi.fn().mockResolvedValue('Folded pending turns');
    memory.setSummarizer(fakeSummarizer);

    memory.ingest('Hello', 'World');
    expect(memory.pending.length).toBe(2);

    await memory.flushNow();
    expect(memory.pending.length).toBe(0);
    expect(memory.sessions.length).toBe(1);
    expect(memory.sessions[0].text).toBe('Folded pending turns');
  });

  it('triggers summarizer when sessionCap is reached', async () => {
    const fakeSummarizer = vi.fn().mockImplementation((items, kind) => {
      return `Summary for ${kind}: ${items.length} items`;
    });
    memory.setSummarizer(fakeSummarizer);

    // Populate sessions up to sessionCap (default 8)
    for (let i = 1; i <= 8; i++) {
      memory.add(`Session card ${i}`, 'session');
    }
    expect(memory.sessions.length).toBe(8);

    // Ingest and flush one more session to trigger promoteSessions
    memory.ingest('Extra turn', 'Extra reply');
    await memory.flushNow();

    expect(fakeSummarizer).toHaveBeenCalled();
    expect(memory.summaries.length).toBeGreaterThan(0);
  });

  it('notifyPressure calls flushNow', async () => {
    const fakeSummarizer = vi.fn().mockResolvedValue('Emergency summarized');
    memory.setSummarizer(fakeSummarizer);

    memory.ingest('Pressure user', 'Pressure assistant');
    memory.notifyPressure();

    await new Promise((r) => setTimeout(r, 10));

    expect(memory.pending.length).toBe(0);
    expect(memory.sessions.length).toBe(1);
  });

  it('promptBlock formats memory correctly', () => {
    expect(memory.promptBlock()).toBe('');

    memory.add('Past event summary', 'summary');
    memory.add('Recent session block', 'session');
    const block = memory.promptBlock();
    expect(block).toContain('## 長期記憶（下ほど新しい。事実だけ参照）');
    expect(block).toContain('Past event summary');
    expect(block).toContain('Recent session block');
  });

  it('reset clears all memory arrays and storage', () => {
    memory.ingest('u', 'a');
    memory.add('sum', 'summary');
    memory.reset();

    expect(memory.pending).toEqual([]);
    expect(memory.sessions).toEqual([]);
    expect(memory.summaries).toEqual([]);
    const saved = JSON.parse(mockStorage.getItem(MEMORY_KEY) || '{}');
    expect(saved.sessions).toEqual([]);
  });
});
