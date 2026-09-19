import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NsfwStore } from './nsfw.svelte';

describe('NsfwStore', () => {
  let nsfw: NsfwStore;
  let mockAvatar: { setAtlasVariant: ReturnType<typeof vi.fn<(variant: string) => void>> };

  beforeEach(() => {
    nsfw = new NsfwStore();
    mockAvatar = {
      setAtlasVariant: vi.fn<(variant: string) => void>(),
    };
    nsfw.setAvatarHandle(mockAvatar);
  });

  it('starts inactive by default', () => {
    expect(nsfw.active()).toBe(false);
    expect(nsfw.screenFact()).toBe('いまの画面：普段の服を着ている。');
  });

  it('applies nsfw variant and calls avatar handle', () => {
    nsfw.apply(true);
    expect(nsfw.active()).toBe(true);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('nsfw');
    expect(nsfw.screenFact()).toBe('いまの画面：肌が見えている（服は脱いだあと）。');

    nsfw.apply(false);
    expect(nsfw.active()).toBe(false);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('default');
  });

  it('resets to inactive', () => {
    nsfw.apply(true);
    expect(nsfw.active()).toBe(true);

    nsfw.reset();
    expect(nsfw.active()).toBe(false);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('default');
  });

  it('updates state via onTurn reply payload', () => {
    nsfw.onTurn({ nsfw: true });
    expect(nsfw.active()).toBe(true);

    // Omitted or undefined nsfw does not toggle the current state
    nsfw.onTurn({});
    expect(nsfw.active()).toBe(true);

    nsfw.onTurn({ nsfw: false });
    expect(nsfw.active()).toBe(false);
  });
});
