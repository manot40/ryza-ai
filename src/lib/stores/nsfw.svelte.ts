// @wc-ignore-file

export const VARIANT = 'nsfw';

export interface AvatarVariantHandle {
  setAtlasVariant(variant: 'nsfw' | 'default' | string): void;
}

export class NsfwStore {
  readonly VARIANT = VARIANT;
  private _on = $state<boolean>(false);
  private avatarHandle: AvatarVariantHandle | null = null;

  setAvatarHandle(handle: AvatarVariantHandle | null): void {
    this.avatarHandle = handle;
  }

  active(): boolean {
    return this._on;
  }

  apply(on: boolean): void {
    this._on = Boolean(on);
    if (this.avatarHandle && typeof this.avatarHandle.setAtlasVariant === 'function') {
      this.avatarHandle.setAtlasVariant(this._on ? VARIANT : 'default');
    } else if (typeof window !== 'undefined') {
      const globalAvatar = (window as unknown as { Avatar?: AvatarVariantHandle }).Avatar;
      if (globalAvatar && typeof globalAvatar.setAtlasVariant === 'function') {
        globalAvatar.setAtlasVariant(this._on ? VARIANT : 'default');
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
