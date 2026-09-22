import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceCache, isFav, toggleFav, VOICE_META_KEY } from './voicecache';
import { LocalStorageMock } from '../../../tests/utils';

describe('VoiceCache', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('toggles and recognizes favorites in unified metadata', () => {
    expect(isFav('clip_1')).toBe(false);
    expect(toggleFav('clip_1')).toBe(true);
    expect(isFav('clip_1')).toBe(true);
    expect(toggleFav('clip_1')).toBe(false);
    expect(isFav('clip_1')).toBe(false);

    const raw = mockStorage.getItem(VOICE_META_KEY);
    expect(raw).not.toBeNull();
    const map = JSON.parse(raw!);
    expect(map.clip_1).toBeDefined();
    expect(map.clip_1.fav).toBe(false);
  });

  it('stores audio blobs and retrieves them', async () => {
    const blob = new Blob(['audio data simulation'], { type: 'audio/wav' });
    const ok = await VoiceCache.put('test_voice_1', blob, { text: 'おつかれさま！' });
    expect(ok).toBe(true);

    const rec = await VoiceCache.get('test_voice_1');
    expect(rec).not.toBeNull();
    expect(rec?.text).toBe('おつかれさま！');
    expect(rec?.bytes).toBe(blob.size);

    const list = await VoiceCache.list();
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('test_voice_1');
    expect(list[0].text).toBe('おつかれさま！');

    const stats = await VoiceCache.stats();
    expect(stats.count).toBe(1);
    expect(stats.bytes).toBe(blob.size);
  });

  it('clears un-favorited clips while preserving favorites', async () => {
    await VoiceCache.put('v_normal', new Blob(['123']), { text: 'normal' });
    await VoiceCache.put('v_fav', new Blob(['456']), { text: 'favorite' });
    VoiceCache.toggleFav('v_fav');

    const result = await VoiceCache.clear(false);
    expect(result.cleared).toBe(1);

    const remaining = await VoiceCache.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].key).toBe('v_fav');
  });
});
