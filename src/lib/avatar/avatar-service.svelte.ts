// @wc-ignore-file
import type Avatar from './Avatar.svelte';
import { nsfw } from '$lib/stores/nsfw.svelte';
import { config } from '$lib/stores/config.svelte';

export class AvatarService {
  instance = $state<Avatar | null>(null);
  hidden = $state(false);
  private _analyser: AnalyserNode | null = null;

  setInstance(inst: Avatar | null) {
    this.instance = inst;
    if (inst) {
      nsfw.setAvatarHandle({
        setAtlasVariant: (variant: string, cb?: () => void) => inst.setAtlasVariant(variant, cb),
        takeVariantMiss: () => inst.takeVariantMiss(),
      });
      inst.setHidden(this.hidden);
      if (this._analyser) {
        inst.setAudioAnalyser(this._analyser);
      }
    }
  }

  setAtlasVariant(variant: string, cb?: () => void) {
    this.instance?.setAtlasVariant(variant, cb);
  }

  takeVariantMiss(): { skin: string; variant: string } | null {
    return this.instance?.takeVariantMiss() || null;
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

  zoomBy(delta: number): number {
    return this.instance?.zoomBy(delta) ?? 1;
  }

  zoomReset(): number {
    return this.instance?.zoomReset() ?? 1;
  }

  playerZoom(): number {
    return this.instance?.playerZoom() ?? 1;
  }

  panBy(dx: number, dy: number): { x: number; y: number } {
    return this.instance?.panBy(dx, dy) ?? { x: 0, y: 0 };
  }

  charPan(): { x: number; y: number } {
    return this.instance?.charPan() ?? { x: 0, y: 0 };
  }

  postureKey(): string {
    return this.instance?.postureKey() ?? 'posture_standing';
  }

  supportsBothPostures(): boolean {
    return this.instance?.supportsBothPostures() ?? false;
  }

  postureSwitchable(): boolean {
    return this.instance?.postureSwitchable() ?? true;
  }

  shouldResetPosture(): boolean {
    return this.instance?.shouldResetPosture() ?? false;
  }

  setPosture(posture: 'posture_standing' | 'posture_sitting', cb?: (err: Error | null) => void): void {
    if (posture !== 'posture_standing' && posture !== 'posture_sitting') return;
    config.setState('posture', posture);
    const skin = config.get('state')?.skin || 'crf_skn_002_0001';
    this.loadSkin(skin, cb);
  }
}

export const avatarService = new AvatarService();
export default avatarService;
