import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypewriterController } from './typewriter';

describe('TypewriterController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('progressively types characters at specified speed', () => {
    const updates: string[] = [];
    let done = false;

    const tw = new TypewriterController({
      speed: 20,
      onUpdate: (t) => updates.push(t),
      onDone: () => {
        done = true;
      },
    });

    tw.start('Hello');
    expect(tw.isTyping).toBe(true);
    expect(updates).toEqual([]);

    // 1st char
    vi.advanceTimersByTime(20);
    expect(updates).toEqual(['H']);
    expect(tw.currentText).toBe('H');

    // 2nd char
    vi.advanceTimersByTime(20);
    expect(updates).toEqual(['H', 'He']);

    // Advance remainder
    vi.advanceTimersByTime(60);
    expect(updates).toEqual(['H', 'He', 'Hel', 'Hell', 'Hello']);
    expect(done).toBe(true);
    expect(tw.isTyping).toBe(false);
  });

  it('immediately completes on finish()', () => {
    const updates: string[] = [];
    let done = false;

    const tw = new TypewriterController({
      speed: 50,
      onUpdate: (t) => updates.push(t),
      onDone: () => {
        done = true;
      },
    });

    tw.start('Antigravity');
    vi.advanceTimersByTime(50);
    expect(tw.currentText).toBe('A');

    tw.finish();
    expect(tw.currentText).toBe('Antigravity');
    expect(done).toBe(true);
    expect(tw.isTyping).toBe(false);
    expect(updates[updates.length - 1]).toBe('Antigravity');
  });

  it('cancels pending timeouts and supersedes earlier runs', () => {
    const updates: string[] = [];
    let done1 = false;
    let done2 = false;

    const tw = new TypewriterController({
      speed: 10,
      onUpdate: (t) => updates.push(t),
    });

    tw.start('Old');
    vi.advanceTimersByTime(10);
    expect(updates).toEqual(['O']);

    tw.start('New');
    vi.advanceTimersByTime(30);
    expect(updates).toEqual(['O', 'N', 'Ne', 'New']);
    expect(tw.currentText).toBe('New');
  });

  it('handles empty string gracefully', () => {
    let done = false;
    let updatedText = 'init';

    const tw = new TypewriterController({
      onUpdate: (t) => {
        updatedText = t;
      },
      onDone: () => {
        done = true;
      },
    });

    tw.start('');
    expect(updatedText).toBe('');
    expect(done).toBe(true);
    expect(tw.isTyping).toBe(false);
  });
});
