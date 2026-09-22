// @wc-ignore-file
import { config } from './config.svelte';
import { toast } from './toast.svelte';

export const VARIANT = 'nsfw';

export interface AvatarVariantHandle {
  setAtlasVariant(variant: 'nsfw' | 'default' | string, cb?: () => void): void;
  takeVariantMiss?(): { skin: string; variant: string } | null;
}

export class NsfwStore {
  readonly VARIANT = VARIANT;
  private _on = $state<boolean>(false);
  private _enabled = $state<boolean>(false);
  private avatarHandle: AvatarVariantHandle | null = null;
  private _sink: ((variant: string) => void) | null = null;

  constructor() {
    this.restore();
  }

  setAvatarHandle(handle: AvatarVariantHandle | null): void {
    this.avatarHandle = handle;
  }

  setSink(fn: ((variant: string) => void) | null): void {
    this._sink = typeof fn === 'function' ? fn : null;
  }

  active(): boolean {
    return this._on;
  }

  enabled(): boolean {
    return this._enabled;
  }

  enable(flag: boolean): void {
    this._enabled = Boolean(flag);
    try {
      config.setApp('nsfwEnabled', this._enabled);
    } catch {}
    if (!this._enabled && this._on) {
      this.apply(false);
    }
  }

  setEnabled(on: boolean): void {
    this.enable(on);
  }

  restore(): void {
    try {
      const app = config.get('app') as { nsfwEnabled?: boolean } | undefined;
      this._enabled = Boolean(app?.nsfwEnabled);
    } catch {}
    this.apply(this._enabled && this._on);
  }

  apply(on: boolean): void {
    this._on = Boolean(on) && this._enabled;
    const variantName = this._on ? VARIANT : 'default';

    const onDone = () => {
      const miss = this.avatarHandle?.takeVariantMiss?.();
      if (miss) {
        toast.show(
          'This outfit has no alternate texture (the assets may be missing — run scripts/restore_media.py)'
        );
      }
    };

    if (this._sink) {
      try {
        this._sink(variantName);
      } catch {}
    }

    if (this.avatarHandle && typeof this.avatarHandle.setAtlasVariant === 'function') {
      if (typeof this.avatarHandle.takeVariantMiss === 'function') {
        this.avatarHandle.setAtlasVariant(variantName, onDone);
      } else {
        this.avatarHandle.setAtlasVariant(variantName);
      }
    } else if (typeof window !== 'undefined') {
      const globalAvatar = (window as unknown as { Avatar?: AvatarVariantHandle }).Avatar;
      if (globalAvatar && typeof globalAvatar.setAtlasVariant === 'function') {
        globalAvatar.setAtlasVariant(variantName, onDone);
      }
    }
  }

  reset(): void {
    this.apply(false);
  }

  screenFact(): string {
    return this._on ? 'いまの画面：肌が見えている（服は脱いだあと）。' : 'いまの画面：普段の服を着ている。';
  }

  onTurn(reply?: { nsfw?: boolean | null } | null): void {
    const flag = reply && typeof reply.nsfw === 'boolean' ? reply.nsfw : null;
    if (flag === true) this.apply(true);
    else if (flag === false) this.apply(false);
  }
}

export const nsfw = new NsfwStore();
export const Nsfw = nsfw;
export default nsfw;
