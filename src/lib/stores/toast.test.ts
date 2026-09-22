import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastStore } from './toast.svelte';

describe('ToastStore', () => {
  let store: ToastStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ToastStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('adds an info toast and auto-dismisses after 2400ms', () => {
    const id = store.show('Hello island!');
    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toEqual({ id, message: 'Hello island!', isErr: false });

    vi.advanceTimersByTime(2300);
    expect(store.items).toHaveLength(1);

    vi.advanceTimersByTime(200);
    expect(store.items).toHaveLength(0);
  });

  it('adds an error toast and auto-dismisses after 4200ms', () => {
    const id = store.err('Failed to connect');
    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toEqual({ id, message: 'Failed to connect', isErr: true });

    vi.advanceTimersByTime(2500);
    expect(store.items).toHaveLength(1);

    vi.advanceTimersByTime(1800);
    expect(store.items).toHaveLength(0);
  });

  it('allows manual dismissal', () => {
    const id1 = store.show('Message 1');
    const id2 = store.show('Message 2');
    expect(store.items).toHaveLength(2);

    store.dismiss(id1);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].id).toBe(id2);
  });

  it('allows clearing all toasts', () => {
    store.show('One');
    store.show('Two');
    expect(store.items).toHaveLength(2);

    store.clear();
    expect(store.items).toHaveLength(0);
  });
});
