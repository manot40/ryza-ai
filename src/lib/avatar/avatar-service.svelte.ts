// @wc-ignore-file
import { config, nsfw } from '$lib/stores';
import { AvatarEngine } from './engine/avatar-engine';

type PendingRender = {
  tod: string;
  skinId?: string;
  stageId: string;
  cb?: (err: Error | null) => void;
};
type PendingSkin = Pick<PendingRender, 'skinId' | 'cb'>;

export class AvatarService {
  ready = $state(false);
  hidden = $state(false);
  engine = $state.raw(new AvatarEngine());

  private canvas: HTMLCanvasElement | null = null;
  private analyser: AnalyserNode | null = null;
  private lastEmotion = 'neutral';
  private lastAttitude = 'agree';

  private currentSkin = '';
  private currentStageTod = '';
  private pendingSkin: PendingSkin | null = null;
  private pendingScene: PendingRender | null = null;

  private resizeCb = () => this.engine.resize();
  private resizeObserver: ResizeObserver | null = null;

  get currentEmotion(): string {
    return this.engine.currentEmotion ?? this.lastEmotion;
  }

  get currentAttitude(): string {
    return this.lastAttitude;
  }

  async init(canvas: HTMLCanvasElement, container?: HTMLElement) {
    this.canvas = canvas;
    this.engine.setHidden(this.hidden);
    nsfw.setAvatarHandle({
      setAtlasVariant: this.engine.setAtlasVariant.bind(this.engine),
      takeVariantMiss: this.engine.takeVariantMiss.bind(this.engine),
    });

    if (this.analyser) this.engine.setAudioAnalyser(this.analyser);
    await this.engine.init(canvas);
    this.engine.resize();

    if (typeof ResizeObserver !== 'undefined' && container) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && (entry.contentRect.width > 0 || entry.contentRect.height > 0))
          // prettier-ignore
          this.engine.resize();
      });
      this.resizeObserver.observe(container);
    }

    this.ready = true;

    if (!this.pendingScene && !this.pendingSkin) {
      const { stage, tod, skin } = config.get('state');
      this.loadScene(stage || 'stage_01_001_01', tod || 'stage_01_001_01');
      this.loadSkin(skin || 'crf_skn_002_0001');
    } else {
      if (this.pendingScene) {
        const p = this.pendingScene;
        this.pendingScene = null;
        this.loadScene(p.stageId, p.tod, p.cb);
      }
      if (this.pendingSkin) {
        const p = this.pendingSkin;
        this.pendingSkin = null;
        if (p.skinId) this.loadSkin(p.skinId, p.cb);
      }
    }

    window.addEventListener('resize', this.resizeCb);
  }

  destroy() {
    this.pendingScene = null;
    this.pendingSkin = null;
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resizeCb);
    this.engine.destroy();
  }

  loadScene(newStageId: string, newTod: string, cb?: PendingRender['cb']) {
    const key = `${newStageId}/${newTod}`;
    const skinId = this.currentSkin || config.get('state').skin || 'crf_skn_002_0001';
    if (!this.ready) {
      this.pendingScene = { stageId: newStageId, tod: newTod, skinId, cb };
    } else if (this.currentStageTod !== key) {
      this.currentSkin = skinId;
      this.currentStageTod = key;
      this.engine.loadScene(newStageId, newTod, cb, skinId);
      config.setState('stage', newStageId);
      config.setState('tod', newTod);
    }
  }

  loadSkin(newSkinId: string, cb?: PendingRender['cb']) {
    if (!this.ready) {
      this.pendingSkin = { skinId: newSkinId, cb };
    } else if (this.currentSkin !== newSkinId) {
      this.currentSkin = newSkinId;
      this.engine.loadSkin(newSkinId, cb);
      config.setState('skin', newSkinId);
    }
  }

  getPending<T extends 'scene' | 'skin'>(type: T): (T extends 'scene' ? PendingRender : PendingSkin) | null {
    if (type === 'scene') return this.pendingScene;
    else return this.pendingSkin as null;
  }

  setAudioAnalyser(analyser: AnalyserNode | null) {
    this.analyser = analyser;
    this.engine.setAudioAnalyser(analyser);
  }

  setEmotion(emotion: string, attitude: string = 'agree', immediate?: boolean) {
    this.lastEmotion = emotion;
    this.lastAttitude = attitude || 'agree';
    this.engine.setEmotion(emotion, attitude, immediate);
  }

  setHidden(on: boolean): void {
    this.hidden = Boolean(on);
    this.engine.setHidden(this.hidden);
  }

  setPosture(posture: 'posture_standing' | 'posture_sitting', cb?: (err: Error | null) => void): void {
    if (posture !== 'posture_standing' && posture !== 'posture_sitting') return;
    config.setState('posture', posture);
    const skin = config.get('state')?.skin || 'crf_skn_002_0001';
    this.engine.loadSkin(skin, cb);
  }

  toggleChara(): boolean {
    this.setHidden(!this.hidden);
    return this.hidden;
  }

  zoomBy(delta: number): number {
    return this.engine.zoomBy(delta) ?? 1;
  }

  zoomReset(): number {
    return this.engine.zoomReset() ?? 1;
  }
}

export const avatarService = new AvatarService();
export default avatarService;
