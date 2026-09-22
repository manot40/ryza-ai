import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NsfwStore } from './nsfw.svelte';
import { LocalStorageMock } from '../../../tests/utils';

describe('NsfwStore', () => {
  let nsfw: NsfwStore;
  let mockAvatar: { setAtlasVariant: ReturnType<typeof vi.fn<(variant: string) => void>> };
  let mockSink: ReturnType<typeof vi.fn<(variant: string) => void>>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', new LocalStorageMock());
    nsfw = new NsfwStore();
    mockAvatar = {
      setAtlasVariant: vi.fn<(variant: string) => void>(),
    };
    mockSink = vi.fn<(variant: string) => void>();
    nsfw.setAvatarHandle(mockAvatar);
    nsfw.setSink(mockSink);
  });

  it('starts inactive and disabled by default', () => {
    expect(nsfw.active()).toBe(false);
    expect(nsfw.enabled()).toBe(false);
    expect(nsfw.screenFact()).toBe('いまの画面：普段の服を着ている。');
  });

  it('blocks apply(true) and onTurn when permission is disabled', () => {
    nsfw.apply(true);
    expect(nsfw.active()).toBe(false);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('default');

    nsfw.onTurn({ nsfw: true });
    expect(nsfw.active()).toBe(false);
  });

  it('applies nsfw variant when permission is enabled', () => {
    nsfw.setEnabled(true);
    expect(nsfw.enabled()).toBe(true);

    nsfw.apply(true);
    expect(nsfw.active()).toBe(true);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('nsfw');
    expect(mockSink).toHaveBeenCalledWith('nsfw');
    expect(nsfw.screenFact()).toBe('いまの画面：肌が見えている（服は脱いだあと）。');

    nsfw.apply(false);
    expect(nsfw.active()).toBe(false);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('default');
  });

  it('immediately disables atlas when setEnabled(false) is called while active', () => {
    nsfw.setEnabled(true);
    nsfw.apply(true);
    expect(nsfw.active()).toBe(true);

    nsfw.setEnabled(false);
    expect(nsfw.active()).toBe(false);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('default');
  });

  it('resets to inactive', () => {
    nsfw.setEnabled(true);
    nsfw.apply(true);
    expect(nsfw.active()).toBe(true);

    nsfw.reset();
    expect(nsfw.active()).toBe(false);
    expect(mockAvatar.setAtlasVariant).toHaveBeenCalledWith('default');
  });

  it('updates state via onTurn reply payload when enabled', () => {
    nsfw.setEnabled(true);
    nsfw.onTurn({ nsfw: true });
    expect(nsfw.active()).toBe(true);

    // Omitted or undefined nsfw does not toggle the current state
    nsfw.onTurn({});
    expect(nsfw.active()).toBe(true);

    nsfw.onTurn({ nsfw: false });
    expect(nsfw.active()).toBe(false);
  });

  it('notifies user when variant texture is missing', () => {
    const toastSpy = vi.fn();
    const mockAvatarWithMiss = {
      setAtlasVariant: vi.fn((variant: string, cb?: () => void) => cb?.()),
      takeVariantMiss: vi.fn().mockReturnValueOnce({ skin: 'skn_01', variant: 'nsfw' }),
    };
    nsfw.setAvatarHandle(mockAvatarWithMiss);
    nsfw.setEnabled(true);

    nsfw.apply(true);
    expect(mockAvatarWithMiss.takeVariantMiss).toHaveBeenCalled();
  });
});
