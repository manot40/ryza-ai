// @wc-ignore-file
import type Avatar from './Avatar.svelte';
import { nsfw } from '$lib/stores/nsfw.svelte';

export class AvatarService {
  instance = $state<Avatar | null>(null);
  hidden = $state(false);
  private _analyser: AnalyserNode | null = null;

  setInstance(inst: Avatar | null) {
    this.instance = inst;
    if (inst) {
      nsfw.setAvatarHandle({
        setAtlasVariant: (variant: string) => inst.setAtlasVariant(variant),
      });
      inst.setHidden(this.hidden);
      if (this._analyser) {
        inst.setAudioAnalyser(this._analyser);
      }
    }
  }

  setAudioAnalyser(analyser: AnalyserNode | null) {
    this._analyser = analyser;
    this.instance?.setAudioAnalyser(analyser);
  }

  setEmotion(emotion: string, attitude: string = 'agree', immediate?: boolean) {
    this.instance?.setEmotion(emotion, attitude, immediate);
  }

  setTalking(talking: boolean) {
    this.instance?.setTalking(talking);
  }

  setTalkingEnvelope(env: { envelope: number[]; durationMs?: number; windowMs?: number }) {
    this.instance?.setTalkingEnvelope(env);
  }

  loadScene(stageId: string, tod: string, cb?: (err: Error | null) => void) {
    this.instance?.loadScene(stageId, tod, cb);
  }

  loadSkin(skinId: string, cb?: (err: Error | null) => void) {
    this.instance?.loadSkin(skinId, cb);
  }

  poke(part: string): string | null {
    return this.instance?.poke(part) ?? null;
  }

  setHidden(on: boolean): void {
    this.hidden = Boolean(on);
    this.instance?.setHidden(this.hidden);
  }

  toggleChara(): boolean {
    this.setHidden(!this.hidden);
    return this.hidden;
  }
}

export const avatarService = new AvatarService();
export default avatarService;
