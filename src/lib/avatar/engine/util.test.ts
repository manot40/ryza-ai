import { describe, it, expect, vi, afterEach } from 'vitest';
import { clamp, lerp, pad3, hashHex, swapHashHalves, weighted, createEmitter } from './util';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('clamp', () => {
  it('passes through values within the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
    expect(clamp(3.5, -1, 7)).toBe(3.5);
  });

  it('returns lo when the value is below lo', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(-100, -5, 5)).toBe(-5);
  });

  it('returns hi when the value is above hi', () => {
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(999, -5, 5)).toBe(5);
  });

  it('coerces NaN input to lo (legacy behavior)', () => {
    expect(clamp(NaN, 7, 20)).toBe(7);
    expect(clamp(Number('abc'), 2, 9)).toBe(2);
  });
});

describe('lerp', () => {
  it('returns a when t is 0', () => {
    expect(lerp(2, 8, 0)).toBe(2);
  });

  it('returns b when t is 1', () => {
    expect(lerp(2, 8, 1)).toBe(8);
  });

  it('returns the midpoint when t is 0.5', () => {
    expect(lerp(2, 8, 0.5)).toBe(5);
  });

  it('returns a + (b - a) * t for t = 0.25', () => {
    expect(lerp(2, 10, 0.25)).toBe(2 + (10 - 2) * 0.25);
    expect(lerp(2, 10, 0.25)).toBe(4);
  });
});

describe('pad3', () => {
  it('zero-pads small integers to three digits', () => {
    expect(pad3(0)).toBe('000');
    expect(pad3(5)).toBe('005');
    expect(pad3(42)).toBe('042');
    expect(pad3(100)).toBe('100');
    expect(pad3(999)).toBe('999');
  });

  it('floors non-integer numbers before padding', () => {
    expect(pad3(7.9)).toBe('007');
    expect(pad3(99.999)).toBe('099');
  });

  it('coerces non-number input to 0', () => {
    expect(pad3(NaN)).toBe('000');
    expect(pad3('abc' as unknown as number)).toBe('000');
    expect(pad3(undefined as unknown as number)).toBe('000');
  });
});

describe('hashHex', () => {
  it('returns empty string for empty / null / undefined input', () => {
    expect(hashHex('')).toBe('');
    expect(hashHex(null)).toBe('');
    expect(hashHex(undefined)).toBe('');
    expect(hashHex('   ')).toBe('');
  });

  it('passes through a plain 16-char hex string', () => {
    expect(hashHex('d57e54cde24854da')).toBe('d57e54cde24854da');
  });

  it('converts signed halves to unsigned via 0x100000000 - val', () => {
    expect(hashHex('-2a81ab33-1db7ab26')).toBe('d57e54cde24854da');
  });

  it('handles a single leading sign on the first half', () => {
    expect(hashHex('-2a81ab33e24854da')).toBe('d57e54cde24854da');
  });

  it('strips non-hex characters (and lowercases)', () => {
    expect(hashHex('D5 7E 54 CD E2 48 54 DA')).toBe('d57e54cde24854da');
    expect(hashHex('d5:7e:54:cd:e2:48:54:da')).toBe('d57e54cde24854da');
  });

  it('left-pads short hex to 16 characters', () => {
    expect(hashHex('abc')).toBe('0000000000000abc');
    expect(hashHex('ff')).toBe('00000000000000ff');
  });
});

describe('swapHashHalves', () => {
  it('swaps the two 8-char halves of a 16-char hash', () => {
    expect(swapHashHalves('d57e54cde24854da')).toBe('e24854dad57e54cd');
  });

  it('normalizes via hashHex before swapping', () => {
    expect(swapHashHalves('-2a81ab33-1db7ab26')).toBe('e24854dad57e54cd');
    expect(swapHashHalves('D5 7E 54 CD E2 48 54 DA')).toBe('e24854dad57e54cd');
  });

  it('returns the normalized value as-is when shorter than 16 chars', () => {
    expect(swapHashHalves('')).toBe('');
    expect(swapHashHalves(null as unknown as string)).toBe('');
  });
});

describe('weighted', () => {
  it('returns null for an empty array', () => {
    expect(weighted([])).toBeNull();
    expect(weighted(null as unknown as never[])).toBeNull();
  });

  it('returns the single item when there is only one', () => {
    const only = { tag: 'only' };
    expect(weighted([only])).toBe(only);
  });

  it('falls back to uniform random when all weights are zero', () => {
    const items = [{ tag: 'a' }, { tag: 'b' }, { tag: 'c' }];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(weighted(items)).toBe(items[1]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(weighted(items)).toBe(items[0]);
  });

  it('respects a weightOf callback deterministically', () => {
    const items = [{ tag: 'a' }, { tag: 'b' }, { tag: 'c' }];
    const weightOf = (i: { tag: string }) => 1;

    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(weighted(items, weightOf)).toBe(items[0]);

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(weighted(items, weightOf)).toBe(items[1]);

    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(weighted(items, weightOf)).toBe(items[2]);
  });

  it('uses the default item.weight property when no callback is given', () => {
    const items = [
      { name: 'a', weight: 0 },
      { name: 'b', weight: 5 },
      { name: 'c', weight: 0 },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(weighted(items)).toBe(items[1]);
  });

  it('treats non-positive weights as zero', () => {
    const items = [{ tag: 'a' }, { tag: 'b' }];
    const weightOf = (i: { tag: string }) => (i.tag === 'a' ? -5 : 3);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(weighted(items, weightOf)).toBe(items[1]);
  });
});

describe('createEmitter', () => {
  it('calls a registered listener with the emitted args', () => {
    const emitter = createEmitter<{ foo: [string, number] }>();
    const fn = vi.fn();
    emitter.on('foo', fn);
    emitter.emit('foo', 'hello', 42);
    expect(fn).toHaveBeenCalledWith('hello', 42);
  });

  it('returns an unsubscribe function from on()', () => {
    const emitter = createEmitter<{ foo: [string, number] }>();
    const fn = vi.fn();
    const off = emitter.on('foo', fn);
    expect(typeof off).toBe('function');
    off();
    emitter.emit('foo', 'hello', 42);
    expect(fn).not.toHaveBeenCalled();
  });

  it('is a no-op when emitting an event with no listeners', () => {
    const emitter = createEmitter<{ foo: [string, number] }>();
    expect(() => emitter.emit('foo', 'x', 1)).not.toThrow();
  });

  it('calls every registered listener', () => {
    const emitter = createEmitter<{ foo: [string, number] }>();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    emitter.on('foo', a);
    emitter.on('foo', b);
    emitter.on('foo', c);
    emitter.emit('foo', 'hi', 7);
    expect(a).toHaveBeenCalledWith('hi', 7);
    expect(b).toHaveBeenCalledWith('hi', 7);
    expect(c).toHaveBeenCalledWith('hi', 7);
  });

  it('stops calling a listener after its specific unsubscribe', () => {
    const emitter = createEmitter<{ foo: [string, number] }>();
    const a = vi.fn();
    const b = vi.fn();
    const offA = emitter.on('foo', a);
    emitter.on('foo', b);
    offA();
    emitter.emit('foo', 'x', 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith('x', 1);
  });
});
