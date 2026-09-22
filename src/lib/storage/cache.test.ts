import { describe, it, expect, beforeEach } from 'vitest';
import { CacheStore } from './cache';

describe('CacheStore', () => {
  let store: CacheStore;

  beforeEach(() => {
    store = new CacheStore('test-cache');
  });

  it('stores and retrieves data with in-memory fallback', async () => {
    const text = 'Hello Ryza!';
    const blob = new Blob([text], { type: 'text/plain' });

    const ok = await store.set('msg_1', blob);
    expect(ok).toBe(true);

    const exists = await store.has('msg_1');
    expect(exists).toBe(true);

    const res = await store.get('msg_1');
    expect(res).not.toBeNull();
    const loadedText = await res!.text();
    expect(loadedText).toBe(text);

    const blobRes = await store.getBlob('msg_1');
    expect(blobRes).not.toBeNull();
    expect(await blobRes!.text()).toBe(text);
  });

  it('lists keys and deletes items', async () => {
    await store.set('key_a', 'data_a');
    await store.set('key_b', 'data_b');

    const keys = await store.keys();
    expect(keys).toContain('key_a');
    expect(keys).toContain('key_b');

    const deleted = await store.delete('key_a');
    expect(deleted).toBe(true);
    expect(await store.has('key_a')).toBe(false);

    const remainingKeys = await store.keys();
    expect(remainingKeys).not.toContain('key_a');
    expect(remainingKeys).toContain('key_b');
  });

  it('clears cache bucket', async () => {
    await store.set('item_1', 'val_1');
    await store.clear();
    expect(await store.has('item_1')).toBe(false);
    expect(await store.keys()).toHaveLength(0);
  });
});
