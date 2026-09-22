import { describe, it, expect } from 'vitest';
import { ConfirmStore } from './confirm.svelte';

describe('ConfirmStore', () => {
  it('initializes in closed state with default text', () => {
    const store = new ConfirmStore();
    expect(store.isOpen).toBe(false);
    expect(store.title).toBe('');
    expect(store.confirmText).toBe('Confirm');
    expect(store.cancelText).toBe('Cancel');
    expect(store.destructive).toBe(false);
  });

  it('resolves true when confirmed', async () => {
    const store = new ConfirmStore();
    const askPromise = store.ask({
      title: 'Are you sure?',
      description: 'Dangerous operation',
      confirmText: 'Delete',
      destructive: true,
    });

    expect(store.isOpen).toBe(true);
    expect(store.title).toBe('Are you sure?');
    expect(store.description).toBe('Dangerous operation');
    expect(store.confirmText).toBe('Delete');
    expect(store.destructive).toBe(true);

    store.confirm();
    const result = await askPromise;

    expect(result).toBe(true);
    expect(store.isOpen).toBe(false);
  });

  it('resolves false when cancelled', async () => {
    const store = new ConfirmStore();
    const askPromise = store.ask('Simple confirmation');

    expect(store.isOpen).toBe(true);
    expect(store.title).toBe('Simple confirmation');

    store.cancel();
    const result = await askPromise;

    expect(result).toBe(false);
    expect(store.isOpen).toBe(false);
  });

  it('cancels preceding unresolved ask when asked again', async () => {
    const store = new ConfirmStore();
    const firstPromise = store.ask('First prompt');
    const secondPromise = store.ask('Second prompt');

    const firstResult = await firstPromise;
    expect(firstResult).toBe(false);

    store.confirm();
    const secondResult = await secondPromise;
    expect(secondResult).toBe(true);
  });
});
