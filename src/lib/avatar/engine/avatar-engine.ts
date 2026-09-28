import type {
  SpineLayer,
  CameraView,
  CamParams,
  SkinEntry,
  GestureData,
  PostureCameraCatalog,
  SceneConfigData,
  EmotionProfile,
  IntensityProfile,
  XYMap,
} from './types';

import {
  Application,
  Container,
  Assets,
  Texture,
  TextureSource,
  Ticker,
  RenderTexture,
  Sprite,
  Cache,
} from 'pixi.js';
import {
  Spine,
  Skeleton,
  Bone,
  BoundingBoxAttachment,
  MixBlend,
  Physics,
  SpineTexture,
  TextureAtlas,
} from '@esotericsoftware/spine-pixi-v8';

// External Store and Resources
import { config } from '$lib/stores/config.svelte';
import { computePanelFrac } from '$lib/fit-ui';
import { crfStore } from '../crfstore';

// Additions and Utilities
import { RimFilter } from './rim';
import { clamp, weighted } from './util';
import { getCamParams, coverFor } from './camera';
import { calcMixDuration, calcOverlayMix } from './distance-mix';

// Controllers
import { GazeController } from './gaze';
import { LipSyncController } from './lipsync';
import { EffectsController } from './effects';
import { BlinkingController } from './blinking';
import { MotionController, pickAnim, isTrackBusy } from './motion';

// Ensure Spine operates in native Y-up coordinates matching original authoring data and camera math
Skeleton.yDown = false;

type SkelArtifact = { skel: string; atlas: string; config?: string };

const FALLBACK_LIP = 'facial_mouth_002_scrub_02';

function pointInPoly(px: number, py: number, verts: number[]): boolean {
  let inside = false;
  const n = verts.length;
  for (let i = 0, j = n - 2; i < n; i += 2) {
    const xi = verts[i];
    const yi = verts[i + 1];
    const xj = verts[j];
    const yj = verts[j + 1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

let scenesDocCache: Record<string, Record<string, SkelArtifact>> | null = null;
let stageBackgroundMapCache: Record<string, string> | null = null;

async function getScenesAndStageMap(): Promise<{
  scenes: Record<string, Record<string, SkelArtifact>>;
  stageMap: Record<string, string>;
}> {
  if (!scenesDocCache || !stageBackgroundMapCache) {
    const [scRes, mapRes] = await Promise.all([
      scenesDocCache
        ? Promise.resolve(scenesDocCache)
        : fetch('/assets/_index/scenes.json')
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({})),
      stageBackgroundMapCache
        ? Promise.resolve(stageBackgroundMapCache)
        : fetch('/assets/_index/stage_background_map.json')
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({})),
    ]);
    if (scRes && Object.keys(scRes).length > 0) {
      scenesDocCache = scRes;
    }
    if (mapRes && Object.keys(mapRes).length > 0) {
      stageBackgroundMapCache = mapRes;
    }
  }
  return { scenes: scenesDocCache || {}, stageMap: stageBackgroundMapCache || {} };
}

export class AvatarEngine {
  app: Application | null = null;
  worldContainer: Container = new Container();
  sceneContainer: Container = new Container();
  avatarContainer: Container = new Container();

  avatar: SpineLayer | null = null;
  scene: SpineLayer | null = null;

  gesture: GestureData | null = null;
  postureCam: PostureCameraCatalog | null = null;
  sceneConfig: SceneConfigData | null = null;
  skinsIndex: SkinEntry[] = [];

  // Modular Subsystems
  motion = new MotionController();
  gaze = new GazeController();
  blinking = new BlinkingController();
  lipsync = new LipSyncController();
  effects = new EffectsController();
  rimTexture: RenderTexture | null = null;
  rimSprite: Sprite | null = null;
  rimFilter: RimFilter | null = null;

  // Stage states
  private loadedSkelId = '';
  private loadingSkelId = '';
  private loadedSceneKey = '';
  private loadingSceneKey = '';
  private atlasVariant = 'default';
  private loadedSceneSkel = '';
  private loadedSceneAtlas = '';

  // Frame delta for bound transformer
  private lastFrameDt = 0;
  // Active outfit MRU cache (keeps standing + sitting)
  private activeOutfitBase = '';
  private cachedOutfitAssets: Array<{ id: string; skel: string; atlas: string }> = [];
  private loadedVariantUrls: string[] = [];
  // Cached scene bone references
  private sceneMidBone: Bone | null = null;
  private sceneCharaRootBone: Bone | null = null;

  // Avatar emotion and animation states
  private emotion = 'neutral';
  private attitude = 'agree';
  private talking = false;
  private idleTimer = 0;
  private idleGap = 6;
  private eyeOpen: string | null = null;
  private eyeClosed: string | null = null;
  private mouthIdle: string | null = null;
  private lipSync = FALLBACK_LIP;
  private variantMiss: Record<string, number> = {};

  private view: CameraView = { left: 0, bottom: 0, worldW: 1, worldH: 1, cssW: 1, cssH: 1 };
  private viewAuth: CamParams | null = null;
  private headLocal: number | null = null;
  private midBind: { name: string; x: number; y: number } | null = null;
  private poseType = 'posetype_01_freehand';
  private sittingId = 'sitting_normal';
  private hideChara = false;
  private skelHash = '';
  private pokeMouthHold = false;
  private exprBand = '';
  private tension = 0;
  private running = false;
  private tick: ((ticker: Ticker) => void) | null = null;
  private cssW = 1;
  private cssH = 1;

  readonly PLAYER_ZOOM_MIN = 1.0;
  readonly PLAYER_ZOOM_MAX = 2.5;
  readonly PLAYER_ZOOM_STEP = 0.25;
  readonly PLAYER_PAN_LIMIT = 0.35;
  private charPanX = 0;
  private charPanY = 0;
  private _playerZoom = 1;
  private variantState: { variant: string; applied: boolean } = { variant: '', applied: false };
  private variantNoticed: Record<string, number> = {};

  takeVariantMiss(): { skin: string; variant: string } | null {
    const st = this.variantState || {};
    if (!st.variant || st.applied) return null;
    const key = `${this.loadedSkelId || ''}\0${st.variant}`;
    if (this.variantNoticed[key]) return null;
    this.variantNoticed[key] = 1;
    return { skin: this.loadedSkelId || '', variant: st.variant };
  }

  playerZoom(): number {
    return this._playerZoom || 1;
  }

  charPan(): XYMap {
    return { x: this.charPanX || 0, y: this.charPanY || 0 };
  }

  panBy(dxPx: number, dyPx: number): XYMap {
    const v = this.view;
    if (!v || !v.worldW || !v.cssW || !v.cssH) return this.charPan();
    const perX = v.worldW / v.cssW;
    const perY = v.worldH / v.cssH;
    this.charPanX = this.clampPan(this.charPanX + dxPx * perX, v.worldW);
    // Screen Y grows downwards, world Y upwards: sprite follows the pointer
    this.charPanY = this.clampPan(this.charPanY - dyPx * perY, v.worldH);
    this.placeCharacter();
    return this.charPan();
  }

  private clampPan(value: number, span: number): number {
    const lim = span * this.PLAYER_PAN_LIMIT;
    return Math.max(-lim, Math.min(lim, value || 0));
  }

  private clampCharPan(): void {
    const v = this.view;
    if (!v || !v.worldW) return;
    this.charPanX = this.clampPan(this.charPanX, v.worldW);
    this.charPanY = this.clampPan(this.charPanY, v.worldH);
  }

  zoomBy(delta: number): number {
    let z = this._playerZoom || 1;
    z = Math.max(this.PLAYER_ZOOM_MIN, Math.min(this.PLAYER_ZOOM_MAX, z + delta));
    if (z === this._playerZoom) return z;
    this._playerZoom = z;
    this.placeCharacter();
    return z;
  }

  zoomReset(): number {
    this._playerZoom = 1;
    this.charPanX = 0;
    this.charPanY = 0;
    this.placeCharacter();
    return 1;
  }

  async init(canvas: HTMLCanvasElement): Promise<this> {
    const parent = canvas.parentElement;
    const w = Math.max(1, Math.floor(parent?.clientWidth || canvas.clientWidth || window?.innerWidth || 800));
    const h = Math.max(
      1,
      Math.floor(parent?.clientHeight || canvas.clientHeight || window?.innerHeight || 600)
    );
    const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1) * this.cssZoom(canvas), 2.0);

    this.cssW = w;
    this.cssH = h;

    this.app = new Application();
    await this.app.init({
      canvas,
      width: w,
      height: h,
      preference: 'webgpu',
      autoDensity: true,
      antialias: true,
      resolution: dpr,
      background: 0x291c12,
      gcActive: true,
      gcMaxUnusedTime: 15_000,
      gcFrequency: 10_000,
    });

    this.worldContainer = new Container();
    this.sceneContainer = new Container();
    this.avatarContainer = new Container();

    this.worldContainer.addChild(this.sceneContainer);
    this.worldContainer.addChild(this.avatarContainer);
    this.app.stage.addChild(this.worldContainer);

    const rimResolution = Math.min(dpr * 0.5, 1.0);
    this.rimTexture = RenderTexture.create({
      width: w,
      height: h,
      resolution: rimResolution,
    });
    this.rimFilter = new RimFilter();
    this.rimFilter.blendMode = 'add';
    this.rimSprite = new Sprite(this.rimTexture);
    this.rimSprite.blendMode = 'add';
    this.rimSprite.filters = [this.rimFilter];
    this.rimSprite.filterArea = this.app.screen;
    this.rimSprite.visible = false;
    this.app.stage.addChild(this.rimSprite);

    this.scene = { spine: null, skeleton: null, state: null, data: null, ready: false };
    this.avatar = { spine: null, skeleton: null, state: null, data: null, ready: false };

    this.running = true;
    this.tick = (ticker: Ticker) => {
      if (!this.running) return;
      this.renderFrame(ticker.deltaMS / 1000);
    };
    this.app.ticker.add(this.tick);

    const [cam, skins] = await Promise.all([
      fetch('/assets/data/posture_camera.json')
        .then((r) => r.json())
        .catch(() => ({})),
      fetch('/assets/_index/skins.json')
        .then((r) => r.json())
        .catch(() => []),
    ]);

    this.postureCam = cam;
    this.skinsIndex = skins || [];
    return this;
  }

  destroy(): void {
    this.running = false;
    if (this.app) {
      if (this.tick) this.app.ticker.remove(this.tick);
      this.app.destroy({ removeView: false, releaseGlobalResources: true }, { children: true });
      this.app = null;
    }
    if (this.scene) {
      this.scene.ready = false;
      this.scene.spine = null;
      this.scene.skeleton = null;
      this.scene.state = null;
      this.scene.data = null;
    }
    this.sceneCharaRootBone = null;
    this.sceneMidBone = null;
    if (this.loadedSceneSkel) {
      this.unloadLayerAssets(this.loadedSceneSkel, this.loadedSceneAtlas, false);
      this.loadedSceneSkel = '';
      this.loadedSceneAtlas = '';
    }
    if (this.avatar) {
      this.avatar.ready = false;
      this.avatar.spine = null;
      this.avatar.skeleton = null;
      this.avatar.state = null;
      this.avatar.data = null;
      this.avatar._atlasBaseTex = null;
      this.avatar._atlasVarTex = null;
    }
    for (const cached of this.cachedOutfitAssets) {
      this.unloadLayerAssets(cached.skel, cached.atlas, true);
      crfStore.revokeUrls(cached.id);
    }
    this.cachedOutfitAssets = [];
    this.activeOutfitBase = '';
    for (const u of this.loadedVariantUrls) {
      Assets.unload(u).catch(() => {});
    }
    this.loadedVariantUrls = [];
    if (this.rimSprite) {
      this.rimSprite.destroy({ texture: false });
      this.rimSprite = null;
    }
    if (this.rimFilter) {
      this.rimFilter.destroy();
      this.rimFilter = null;
    }
    if (this.rimTexture) {
      this.rimTexture.destroy(true);
      this.rimTexture = null;
    }
    this.motion.reset();
    this.gaze.reset();
    this.blinking.reset();
    this.lipsync.reset();
    this.effects.reset();
    this.loadedSkelId = '';
    this.loadingSkelId = '';
    this.loadedSceneKey = '';
    this.loadingSceneKey = '';
  }

  cssZoom(el?: HTMLElement | HTMLCanvasElement | null): number {
    if (!el || !el.clientWidth || !el.getBoundingClientRect) return 1;
    const w = el.getBoundingClientRect().width;
    return (w > 0 && w / el.clientWidth) || 1;
  }

  resize(): void {
    if (!this.app || !this.app.renderer) return;
    const canvas = this.app.canvas;
    const parent = canvas.parentElement;
    const w = Math.max(1, Math.floor(parent?.clientWidth || canvas.clientWidth || window?.innerWidth || 1));
    const h = Math.max(
      1,
      Math.floor(parent?.clientHeight || canvas.clientHeight || window?.innerHeight || 1)
    );
    const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1) * this.cssZoom(canvas), 2.0);
    this.cssW = w;
    this.cssH = h;
    this.app.renderer.resize(w, h, dpr);
    if (this.rimTexture) {
      const rimResolution = Math.min(dpr * 0.5, 1.0);
      this.rimTexture.resize(w, h, rimResolution);
    }
    if (this.rimSprite) {
      this.rimSprite.filterArea = this.app.screen;
    }
    this.applyCamera();
  }

  outfitOf(id?: string): string {
    return String(id || 'crf_skn_002_0001').replace(/_(01|99)$/, '');
  }

  outfitPostures(outfitId?: string): string[] {
    let base = '';
    try {
      const id = outfitId == null ? config.get('state')?.skin : outfitId;
      base = this.outfitOf(id);
    } catch {
      base = this.outfitOf(outfitId);
    }
    const out: string[] = [];
    if (!base) return out;
    (this.skinsIndex || []).forEach((s) => {
      if (!s || !s.hasSpine || !s.skel) return;
      if (String(s.id).indexOf(base) !== 0) return;
      const m = /_(01|99)$/.exec(String(s.id));
      if (!m) return;
      const p = m[1] === '99' ? 'posture_standing' : 'posture_sitting';
      if (out.indexOf(p) < 0) out.push(p);
    });
    return out;
  }

  postureSwitchable(): boolean {
    return this.outfitPostures().length > 1;
  }

  shouldResetPosture(): boolean {
    return this.postureKey() !== 'posture_standing';
  }

  private _scenePostures(): string[] {
    const cfg = this.sceneConfig?.config as unknown as { midgroundPostures?: string[] } | undefined;
    return cfg?.midgroundPostures || [];
  }

  postureKey(): string {
    let want = 'posture_standing';
    try {
      const stored = config.get('state')?.posture;
      if (stored === 'posture_standing' || stored === 'posture_sitting') want = stored;
    } catch {}
    const have = this.outfitPostures();
    if (have.length && have.indexOf(want) < 0) {
      want = have.indexOf('posture_standing') >= 0 ? 'posture_standing' : have[0];
      console.log(want);
    }
    return want;
  }

  private loadedPosture(): string {
    const id = this.loadedSkelId || '';
    const m = /_(01|99)$/.exec(id);
    return m ? (m[1] === '99' ? 'posture_standing' : 'posture_sitting') : this.postureKey();
  }

  supportsBothPostures(): boolean {
    return this._scenePostures().length > 1;
  }

  private _primaryPosture(): string {
    const m = this._scenePostures();
    return m[0] || 'posture_standing';
  }

  private _asmrOn(): boolean {
    try {
      return config.get('state')?.mode === 'asmr';
    } catch {
      return false;
    }
  }

  resolveSkel(outfitId?: string): SkinEntry | null {
    const skins = this.skinsIndex || [];
    const outfit = this.outfitOf(outfitId);
    const wantSuf = this.postureKey() === 'posture_standing' ? '99' : '01';
    const otherSuf = wantSuf === '99' ? '01' : '99';
    const order = [
      `${outfit}_${wantSuf}`,
      `${outfit}_${otherSuf}`,
      `crf_skn_002_0001_${wantSuf}`,
      `crf_skn_002_0001_${otherSuf}`,
    ];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const hit = skins.find((x) => x.id === id && x.hasSpine && x.skel);
      if (hit) return hit;
    }
    return skins.find((x) => x.hasSpine && x.skel) || null;
  }

  private _cleanVariant(name?: string): string {
    const n = String(name || 'default').toLowerCase();
    if (!n || n === 'default' || n === 'off' || n === 'none') return '';
    return /^[a-z0-9_]{1,32}$/.test(n) ? n : '';
  }

  variantPageUrls(atlasUrl: string, pageName: string, variant: string): string[] {
    const v = this._cleanVariant(variant);
    if (!v) return [];
    const dir = String(atlasUrl || '').replace(/[^/]+$/, '');
    const page = String(pageName || '');
    const dot = page.lastIndexOf('.');
    const base = dot >= 0 ? page.slice(0, dot) : page;
    const ext = dot >= 0 ? page.slice(dot) : '.png';
    const out: string[] = [];
    const seen: Record<string, boolean> = {};
    function add(u?: string) {
      if (!u || seen[u]) return;
      seen[u] = true;
      out.push(u);
    }
    const s = this.skinsIndex.find((x) => x.id === this.loadedSkelId);
    const ov = s?.variants?.[v];
    if (typeof ov === 'string') add(ov);
    else if (ov && typeof ov === 'object') add((ov as Record<string, string>)[page]);
    add(`${dir}${base}${v}${ext}`);
    add(`${dir}${base}_${v}${ext}`);
    return out;
  }

  setAtlasVariant(name: string, cb?: () => void): void {
    this.atlasVariant = String(name || 'default').toLowerCase();
    this.applyAtlasVariant(cb);
  }

  private async applyAtlasVariant(cb?: () => void): Promise<void> {
    const L = this.avatar;
    const done = () => cb?.();
    if (!L || !L.spine || !L._atlas) {
      done();
      return;
    }
    const pages = L._atlas.pages || [];
    if (!pages.length) {
      done();
      return;
    }
    if (!L._atlasBaseTex) {
      L._atlasBaseTex = pages.map((p) => p.texture);
    }
    const variant = this._cleanVariant(this.atlasVariant);
    this.variantState = { variant, applied: false };
    if (!variant) {
      for (let i = 0; i < pages.length; i++) {
        if (L._atlasBaseTex[i]) {
          pages[i].setTexture(L._atlasBaseTex[i] as SpineTexture);
        }
      }
      L.spine.spineTexturesDirty = true;
      done();
      return;
    }
    if (L._atlasVarName === variant && L._atlasVarTex) {
      for (let i = 0; i < pages.length; i++) {
        if (L._atlasVarTex[i]) {
          pages[i].setTexture(L._atlasVarTex[i] as SpineTexture);
        }
      }
      L.spine.spineTexturesDirty = true;
      this.variantState.applied = true;
      done();
      return;
    }

    const newTex: Array<SpineTexture | null> = new Array(pages.length).fill(null);
    let any = false;

    for (let idx = 0; idx < pages.length; idx++) {
      const page = pages[idx];
      const urls = this.variantPageUrls(L._atlasUrl || '', page.name, variant);
      for (const url of urls) {
        const missKey = `${this.loadedSkelId || ''}\0${url}`;
        if (this.variantMiss[missKey]) continue;
        try {
          const tex = await Assets.load<Texture>(url);
          if (tex) {
            if (!this.loadedVariantUrls.includes(url)) {
              this.loadedVariantUrls.push(url);
            }
            tex.source.autoGenerateMipmaps = false;
            tex.source.scaleMode = 'linear';
            const spineTex = SpineTexture.from(tex.source);
            newTex[idx] = spineTex;
            any = true;
            break;
          }
        } catch {
          this.variantMiss[missKey] = 1;
        }
      }
    }

    if (any) {
      L._atlasVarTex = newTex;
      L._atlasVarName = variant;
      for (let i = 0; i < pages.length; i++) {
        if (newTex[i]) {
          pages[i].setTexture(newTex[i]!);
        }
      }
      L.spine.spineTexturesDirty = true;
      this.variantState.applied = true;
    }
    done();
  }

  private camParams(postureKey?: string, asmr?: boolean): CamParams {
    const isAsmr = asmr !== undefined ? asmr : this._asmrOn();
    const pk = postureKey || this.postureKey();
    const cssW = this.cssW || 1;
    const cssH = this.cssH || 1;
    return getCamParams(pk, isAsmr, this.postureCam, cssW, cssH);
  }

  private applyCamera(): void {
    if (!this.app || !this.cssW || !this.cssH) return;
    const active = this.camParams(this.loadedPosture());
    let win = this.supportsBothPostures() ? this.camParams(this._primaryPosture(), this._asmrOn()) : active;
    const cover = coverFor(this.scene);
    if (cover && cover.w > 0 && cover.h > 0) {
      const aspect = this.cssW / this.cssH;
      const frac = this.panelFrac || 0;
      const h = Math.min(win.worldH, Math.min(cover.h / Math.max(0.4, 1 - frac), cover.w / aspect));
      const w = h * aspect;
      let bottom = win.bottom;
      const floorY = cover.y0 - h * frac;
      if (bottom < floorY) bottom = floorY;
      if (bottom > cover.y1 - h) bottom = cover.y1 - h;
      let left = win.left + (win.worldW - w) / 2;
      if (left < cover.x0) left = cover.x0;
      if (cover.w >= w && left > cover.x1 - w) left = cover.x1 - w;
      win = { ...win, left, bottom, worldW: w, worldH: h };
    }

    this.view = {
      left: win.left,
      bottom: win.bottom,
      worldW: win.worldW,
      worldH: win.worldH,
      cssW: this.cssW,
      cssH: this.cssH,
    };
    this.viewAuth = active;
    this.clampCharPan();

    const scaleX = this.cssW / win.worldW;
    const scaleY = this.cssH / win.worldH;
    this.worldContainer.scale.set(scaleX, -scaleY);
    this.worldContainer.position.set(-win.left * scaleX, (win.bottom + win.worldH) * scaleY);

    this.placeCharacter();
  }

  private measureHeadLocal(): void {
    const L = this.avatar;
    this.headLocal = null;
    if (!L?.skeleton) return;
    try {
      L.skeleton.updateWorldTransform(Physics.pose);
      const b = L.skeleton.findBone('head');
      if (b) this.headLocal = b.worldY;
    } catch {}
  }

  private placeCharacter(): void {
    const L = this.avatar;
    const S = this.scene;
    if (!L?.skeleton) return;
    const cam = this.camParams(this.loadedPosture());
    let x = cam.offsetX;
    let y = cam.offsetY;
    if (S?.skeleton) {
      const bone = this.sceneCharaRootBone ?? S.skeleton.findBone('chara_root');
      if (bone) {
        x += bone.worldX;
        y += bone.worldY;
      }
      if (this.seatedOnMid() && this.midBind) {
        const mid = this.sceneMidBone ?? S.skeleton.findBone(this.midBind.name);
        if (mid) {
          x += mid.worldX - this.midBind.x;
          y += mid.worldY - this.midBind.y;
        }
      }
    }
    const v = this.view;
    const a = this.viewAuth;
    const k = v && v.worldH && a && a.worldH ? v.worldH / a.worldH : 1;
    let sx: number, sy: number;
    const sc = cam.scale * k;
    if (this.seatedOnMid()) {
      sx = x;
      sy = y;
    } else {
      sx = v && a ? v.left + (x - a.left) * k : x;
      sy = v && a ? v.bottom + (y - a.bottom) * k : y;
      if (this.headLocal != null && v && v.worldH > 0) {
        const target = this._asmrOn() ? 0.5 : this.loadedPosture() === 'posture_standing' ? 0.7 : 0.71;
        const frac = (sy + this.headLocal * sc - v.bottom) / v.worldH;
        if (Math.abs(frac - target) > 0.1) sy += (target - frac) * v.worldH;
      }
    }

    const zoom = this._playerZoom || 1;
    const finalSc = sc * zoom;
    const focalY = this.headLocal != null ? sy + this.headLocal * sc * 0.7 : v.bottom + v.worldH * 0.6;
    const finalX = sx + (this.charPanX || 0);
    const finalY = focalY + (sy - focalY) * zoom + (this.charPanY || 0);

    L.skeleton.x = finalX;
    L.skeleton.y = finalY;
    L.skeleton.scaleX = L.skeleton.scaleY = finalSc;
  }

  private seatedOnMid(): boolean {
    return this.loadedPosture() === 'posture_sitting' && Boolean(this.midBind?.name);
  }

  private cacheMidBind(L: SpineLayer): void {
    this.midBind = null;
    this.sceneCharaRootBone = null;
    this.sceneMidBone = null;
    if (!L?.skeleton) return;
    try {
      L.skeleton.setToSetupPose();
      L.skeleton.updateWorldTransform(Physics.none);
      this.sceneCharaRootBone = L.skeleton.findBone('chara_root');
      const b = L.skeleton.findBone('sofa_root');
      if (b) {
        this.midBind = { name: 'sofa_root', x: b.worldX, y: b.worldY };
        this.sceneMidBone = b;
      }
    } catch {
      this.midBind = null;
      this.sceneCharaRootBone = null;
      this.sceneMidBone = null;
    }
  }

  screenToWorld(cssX: number, cssY: number): XYMap {
    if (!this.worldContainer) {
      const v = this.view;
      return {
        x: v.left + (cssX / Math.max(1, v.cssW)) * v.worldW,
        y: v.bottom + ((v.cssH - cssY) / Math.max(1, v.cssH)) * v.worldH,
      };
    }
    const p = this.worldContainer.toLocal({ x: cssX, y: cssY });
    return { x: p.x, y: p.y };
  }

  private async unloadLayerAssets(skelUrl?: string, atlasUrl?: string, isAvatar?: boolean): Promise<void> {
    if (!skelUrl || !atlasUrl) return;
    try {
      const cacheKey = `${skelUrl}-${atlasUrl}-1`;
      if (Cache.has(cacheKey)) Cache.remove(cacheKey);

      await Assets.unload(atlasUrl);
      await Assets.unload(skelUrl);
    } catch {
      // Ignore if already unloaded or in use
    }
  }

  private onBeforeUpdateWorldTransforms = (): void => {
    const av = this.avatar?.spine;
    if (!av) return;
    this.effects.hideFxSlots(av.skeleton, this.effects.fxOn);
    this.gaze.apply(av.skeleton, this.gesture?.projectConfig, this.lastFrameDt, isTrackBusy(av.state, 1));
  };

  private async loadSpine(
    L: SpineLayer,
    skelUrl: string,
    atlasUrl: string,
    parentContainer: Container
  ): Promise<void> {
    L.ready = false;
    if (L.spine) {
      parentContainer.removeChild(L.spine);
      L.spine.destroy({ children: true });
      L.spine = null;
      L.skeleton = null;
      L.state = null;
      L.data = null;
    }

    if (L === this.avatar) {
      L._atlas = null;
      L._atlasUrl = '';
      L._atlasBaseTex = null;
      L._atlasVarTex = null;
      L._atlasVarName = '';
    }

    await Assets.load([skelUrl, atlasUrl]);

    const spine = Spine.from({
      skeleton: skelUrl,
      atlas: atlasUrl,
      autoUpdate: false,
    });

    spine.state.data.defaultMix = 0.12;
    parentContainer.addChild(spine);

    L.spine = spine;
    L.skeleton = spine.skeleton;
    L.state = spine.state;
    L.data = spine.skeleton.data;
    L._cover = null;
    L._coverDone = false;

    const atlas = Assets.get(atlasUrl) as TextureAtlas | undefined;
    if (atlas?.pages) {
      for (const page of atlas.pages) {
        const tex = (page.texture as unknown as { source?: TextureSource })?.source;
        if (tex) {
          tex.autoGenerateMipmaps = false;
          tex.scaleMode = 'linear';
        }
      }
    }

    if (L === this.avatar) {
      this.skelHash = String(L.data?.hash || '').toLowerCase();
      L._atlas = atlas || null;
      L._atlasUrl = atlasUrl;
      L._atlasBaseTex = null;
      spine.beforeUpdateWorldTransforms = this.onBeforeUpdateWorldTransforms;
    }

    L.ready = true;
  }

  loadSkin(skinId?: string, cb?: (err: Error | null) => void): void {
    const L = this.avatar;
    if (!L) return;
    const apply = (skins: SkinEntry[]) => {
      this.skinsIndex = skins || this.skinsIndex || [];
      const s = this.resolveSkel(skinId);
      if (!s || !s.hasSpine || !s.skel || !s.atlas) {
        cb?.(new Error('preview-only skin'));
        return;
      }
      if (this.loadedSkelId === s.id && L.ready) {
        cb?.(null);
        return;
      }
      if (this.loadingSkelId === s.id) {
        return;
      }
      this.loadingSkelId = s.id;
      L.ready = false;
      L.skeleton = null;
      L.state = null;
      L.data = null;
      if (L.spine) {
        this.avatarContainer.removeChild(L.spine);
        L.spine.destroy({ children: true });
        L.spine = null;
      }

      const gP = s.gesture ? fetch(s.gesture).then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null);
      gP.then(async (g) => {
        if (this.loadingSkelId !== s.id) return;
        this.gesture = g;

        // Manage outfit MRU cache
        const outfitBase = this.outfitOf(s.id);
        if (this.activeOutfitBase && this.activeOutfitBase !== outfitBase) {
          for (const cached of this.cachedOutfitAssets) {
            await this.unloadLayerAssets(cached.skel, cached.atlas, true);
            crfStore.revokeUrls(cached.id);
          }
          this.cachedOutfitAssets = [];
          for (const u of this.loadedVariantUrls) {
            Assets.unload(u).catch(() => {});
          }
          this.loadedVariantUrls = [];
        }
        this.activeOutfitBase = outfitBase;
        if (!this.cachedOutfitAssets.some((x) => x.id === s.id)) {
          this.cachedOutfitAssets.push({ id: s.id, skel: s.skel!, atlas: s.atlas! });
          while (this.cachedOutfitAssets.length > 2) {
            const evicted = this.cachedOutfitAssets.shift();
            if (evicted) {
              await this.unloadLayerAssets(evicted.skel, evicted.atlas, true);
              crfStore.revokeUrls(evicted.id);
            }
          }
        }

        this.motion.reset();
        this.gaze.reset();

        this.loadSpine(L, s.skel!, s.atlas!, this.avatarContainer)
          .then(() => {
            if (this.loadingSkelId !== s.id) return;
            this.loadedSkelId = s.id;
            this.loadingSkelId = '';
            this.sittingId = this.sittingFromPosture();
            this.measureHeadLocal();
            this.setEmotion(this.emotion, this.attitude, true);
            this.playWind();
            this.resize();
            if (this._cleanVariant(this.atlasVariant)) this.applyAtlasVariant();
            cb?.(null);
          })
          .catch((err: unknown) => {
            if (this.loadingSkelId !== s.id) return;
            this.loadingSkelId = '';
            cb?.(err instanceof Error ? err : new Error(String(err)));
          });
      }).catch((e: unknown) => {
        if (this.loadingSkelId === s.id) {
          this.loadingSkelId = '';
        }
        cb?.(e instanceof Error ? e : new Error(String(e)));
      });
    };

    if (this.skinsIndex.length) apply(this.skinsIndex);
    else
      fetch('/assets/_index/skins.json')
        .then((r) => r.json())
        .then(apply)
        .catch((e: unknown) => cb?.(e instanceof Error ? e : new Error(String(e))));
  }

  loadScene(stageId: string, tod: string, cb?: (err: Error | null) => void, skinId?: string): void {
    const L = this.scene;
    if (!L) return;

    getScenesAndStageMap()
      .then(({ scenes, stageMap }) => {
        const bgStageId = stageMap[stageId] || stageId;
        const sceneKey = `${bgStageId}/${tod}`;
        if (this.loadedSceneKey === sceneKey && L.ready) {
          cb?.(null);
          return;
        }
        if (this.loadingSceneKey === sceneKey) {
          return;
        }
        this.loadingSceneKey = sceneKey;
        L.ready = false;
        L.skeleton = null;
        L.state = null;
        L.data = null;
        if (L.spine) {
          this.sceneContainer.removeChild(L.spine);
          L.spine.destroy({ children: true });
          L.spine = null;
        }

        const stage = scenes[bgStageId] || scenes[stageId];
        const entry = stage && (stage[tod] || stage[Object.keys(stage)[0]]);
        if (!entry) throw new Error(`没有这个场景：${stageId} (bg: ${bgStageId})/${tod}`);
        const cfgP = entry.config
          ? fetch(entry.config)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);
        return cfgP.then(async (cfg) => {
          if (this.loadingSceneKey !== sceneKey) return;
          this.sceneConfig = cfg;

          // Unload previous scene assets if changed
          if (
            this.loadedSceneSkel &&
            (this.loadedSceneSkel !== entry.skel || this.loadedSceneAtlas !== entry.atlas)
          ) {
            await this.unloadLayerAssets(this.loadedSceneSkel, this.loadedSceneAtlas, false);
          }
          this.loadedSceneSkel = entry.skel;
          this.loadedSceneAtlas = entry.atlas;

          return this.loadSpine(L, entry.skel, entry.atlas, this.sceneContainer).then(() => {
            if (this.loadingSceneKey !== sceneKey) return;
            this.loadedSceneKey = sceneKey;
            this.loadingSceneKey = '';
            const fade = pickAnim(L.data, 'anm_fade_in') || pickAnim(L.data, 'anm_fade_in_all');
            if (fade && L.state) {
              const tr = L.state.setAnimation(0, fade, false);
              tr.mixDuration = 0;
            }
            this.applySceneConstraints(L, cfg);
            this.cacheMidBind(L);
            this.resize();
            const outfit = skinId || config.get('state')?.skin || 'crf_skn_002_0001';
            this.loadSkin(outfit, cb);
          });
        });
      })
      .catch((e: unknown) => {
        this.loadingSceneKey = '';
        cb?.(e instanceof Error ? e : new Error(String(e)));
      });
  }

  private applySceneConstraints(L: SpineLayer, cfg: SceneConfigData | null): void {
    const ov = cfg?.config?.constraintOverrides;
    if (!ov || !L?.skeleton) return;
    const list = L.skeleton.transformConstraints || [];
    const asMix = (v: unknown): number | null => {
      if (v == null) return null;
      const pct = Number(v);
      return pct > 1.5 ? pct / 100 : pct;
    };
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const n = c.data?.name || '';
      const o = ov[n];
      if (!o) continue;
      if (o.translateMixX != null) c.mixX = asMix(o.translateMixX) ?? c.mixX;
      if (o.translateMixY != null) c.mixY = asMix(o.translateMixY) ?? c.mixY;
      if (o.scaleMixX != null) c.mixScaleX = asMix(o.scaleMixX) ?? c.mixScaleX;
      if (o.scaleMixY != null) c.mixScaleY = asMix(o.scaleMixY) ?? c.mixScaleY;
    }
  }

  private profile(emotion: string): EmotionProfile | null {
    const map = this.gesture?.emotionalGesture?.EmotionProfilesV4;
    if (!map) return null;
    return map[emotion] || map.neutral || null;
  }

  private intensityBand(): string {
    if (this.talking || this.tension > 0.66) return 'strong';
    let mode = '';
    try {
      mode = config.get('state')?.mode;
    } catch {}
    return mode === 'asmr' ? 'weak' : 'normal';
  }

  private intensity(prof: EmotionProfile | null): IntensityProfile | null {
    const ip = prof?.intensityProfiles;
    if (!ip) return null;
    return ip[this.intensityBand()] || ip.normal || ip.strong || ip.weak || null;
  }

  private tensionBand(): string {
    const v = this.tension;
    return v > 0.66 ? 'high' : v > 0.33 ? 'mid' : 'low';
  }

  private tensionRate(band: string): number {
    const tc = this.gesture?.projectConfig?.tensionConfig;
    const dr = tc?.decayRates || {};
    let v = Number(dr[band]);
    if (!(v > 0)) v = Number(tc?.defaultDecayRate);
    if (!(v > 0)) v = 0.02;
    return clamp(v, 0.002, 0.5);
  }

  private sittingFromPosture(): string {
    const p = this.loadedPosture() || '';
    if (/agura/i.test(p)) return 'sitting_agura';
    if (/stand/i.test(p)) return 'standing';
    return 'sitting_normal';
  }

  private idleName(): string {
    const tr = this.avatar?.state?.getCurrent(0);
    return tr?.animation?.name || '';
  }

  private animTimeScale(): number {
    const prof = this.profile(this.emotion);
    let ts = Number(prof?.baseAnimTimeScale) || 1;
    const mul = this.gesture?.emotionalGesture?.performanceConfig?.intensitySpeedMultipliers;
    if (mul) {
      const band = this.intensityBand();
      if (band !== 'normal' && Number(mul[band]) > 0) ts *= Number(mul[band]);
    }
    return ts;
  }

  private playWind(): void {
    const L = this.avatar;
    if (!L?.data || !L.state) return;
    const prefix = this.gesture?.projectConfig?.windAnimationPrefix || 'effect_wind';
    const anims = L.data.animations || [];
    let name: string | null = null;
    for (let i = 0; i < anims.length; i++) {
      if (anims[i].name && anims[i].name.startsWith(prefix)) {
        name = anims[i].name;
        break;
      }
    }
    if (!name) return;
    const tr = L.state.setAnimation(10, name, true);
    tr.mixDuration = 0.4;
    tr.mixBlend = MixBlend.add;
  }

  private oneShots(emotion: string, attitude: string): string[] {
    const prof = this.profile(emotion);
    if (!prof) return [];
    const list = prof.fixedGestureBindingsByAttitude?.[attitude] || [];
    const picked = list.filter((x) => (x.weight || 0) > 0 && x.oneShotAnimation);
    const hit = weighted(picked, (x) => x.weight || 0);
    return hit?.oneShotAnimation ? [hit.oneShotAnimation] : [];
  }

  private rerollIdle(): void {
    const L = this.avatar;
    if (!L?.ready || !L.state) return;
    const cur = L.state.getCurrent(0);
    if (cur?.mixingFrom) return;
    if (isTrackBusy(L.state, 1) || isTrackBusy(L.state, 6)) return;

    const fromName = cur?.animation?.name || '';
    const prevType =
      this.poseType ||
      this.motion.poseTypesOf(fromName, this.gesture, this.intensity(this.profile(this.emotion)))[0] ||
      'posetype_01_freehand';
    const nextType = this.motion.pickPoseType(prevType, this.gesture);
    let idle = this.motion.idlesForType(
      L.data,
      nextType,
      this.sittingId,
      this.intensity(this.profile(this.emotion)),
      this.gesture
    );
    let finalType = nextType;
    if (!idle.length) {
      idle = this.motion.idlesForType(
        L.data,
        'posetype_01_freehand',
        this.sittingId,
        this.intensity(this.profile(this.emotion)),
        this.gesture
      );
      finalType = 'posetype_01_freehand';
    }
    if (!idle.length) {
      this.idleTimer = 0;
      return;
    }
    const pickIdle = weighted(idle, (x) => x.w);
    const name = pickIdle?.name;
    if (!name) {
      this.idleTimer = 0;
      return;
    }

    const inten = this.intensity(this.profile(this.emotion));
    const a = inten?.poseRerollIntervalMin || 5;
    const b = inten?.poseRerollIntervalMax || 8;
    this.idleGap = a + Math.random() * Math.max(0, b - a);
    this.idleTimer = 0;
    this.poseType = finalType;

    if (!this.talking) this.applyFace(false);
    const keep = finalType === prevType;
    if (fromName === name) {
      if (!keep) {
        this.motion.syncAdditives(
          name,
          finalType,
          false,
          false,
          false,
          L,
          this.gesture,
          this.sittingId,
          inten
        );
      }
      return;
    }

    const mix = calcMixDuration(
      fromName,
      name,
      this.profile(this.emotion),
      this.gesture?.emotionalGesture?.MixDurationPoses,
      this.skelHash,
      this.gesture?.projectConfig,
      (id) => this.motion.poseTypesOf(id, this.gesture, inten)
    );

    const tr = L.state.setAnimation(0, name, true);
    tr.mixDuration = mix;
    tr.timeScale = this.animTimeScale();
    this.motion.syncAdditives(name, finalType, false, false, keep, L, this.gesture, this.sittingId, inten);
  }

  get currentEmotion(): string {
    return this.emotion;
  }

  setEmotion(emotion: string, attitude: string, immediate?: boolean): void {
    const names = ['neutral', 'happy', 'laughing', 'tease', 'shy', 'cuddle', 'sad', 'crying', 'angry'];
    const atts = ['agree', 'deny', 'question'];
    if (names.includes(emotion)) this.emotion = emotion;
    if (atts.includes(attitude)) this.attitude = attitude;
    const L = this.avatar;
    if (!L?.ready || !L.state) return;

    const prof = this.profile(this.emotion);
    const inten = this.intensity(prof);
    const timeScale = this.animTimeScale();
    const sat = Number(this.gesture?.projectConfig?.mixDurationSaturationRatio) || 0.1;
    L.state.data.defaultMix = (Number(prof?.mixDurationMin) || 1) * sat;
    this.lipSync = prof?.lipSyncScrubClip || FALLBACK_LIP;

    const a = inten?.poseRerollIntervalMin || 5;
    const b = inten?.poseRerollIntervalMax || 8;
    this.idleGap = a + Math.random() * Math.max(0, b - a);
    this.sittingId = this.sittingFromPosture();

    const cur0 = L.state.getCurrent(0);
    const hasIdle = cur0?.animation?.name;
    if (!hasIdle) {
      const poseType = this.poseType || 'posetype_01_freehand';
      const idle = this.motion.idlesForType(L.data, poseType, this.sittingId, inten, this.gesture);
      if (idle.length) {
        const pi = weighted(idle, (x) => x.w);
        const idleName = pi?.name;
        if (idleName) {
          const tr0 = L.state.setAnimation(0, idleName, true);
          tr0.mixDuration = 0;
          tr0.timeScale = timeScale;
          this.poseType = this.motion.poseTypesOf(idleName, this.gesture, inten)[0] || poseType;
          this.motion.syncAdditives(
            idleName,
            this.poseType,
            true,
            true,
            false,
            L,
            this.gesture,
            this.sittingId,
            inten
          );
        }
      }
    } else {
      cur0.timeScale = timeScale;
    }

    const shots = this.oneShots(this.emotion, this.attitude)
      .map((n) => pickAnim(L.data, n))
      .filter(Boolean) as string[];
    if (shots.length && !immediate) {
      const tr = L.state.setAnimation(1, shots[0], false);
      tr.mixDuration = calcOverlayMix(prof, this.gesture?.projectConfig);
      tr.mixBlend = MixBlend.replace;
      let fade = Number(this.gesture?.projectConfig?.tapReactionExitMix);
      if (!(fade > 0)) fade = 0.3;
      L.state.addEmptyAnimation(1, fade, 0);
      this.motion.syncAdditives(
        hasIdle || this.idleName(),
        this.poseType,
        false,
        false,
        true,
        L,
        this.gesture,
        this.sittingId,
        inten
      );
    } else if (hasIdle) {
      this.motion.syncAdditives(
        hasIdle,
        this.poseType || this.motion.poseTypesOf(hasIdle, this.gesture, inten)[0],
        Boolean(immediate),
        false,
        !immediate,
        L,
        this.gesture,
        this.sittingId,
        inten
      );
    }

    this.applyFace(Boolean(immediate));
    this.exprBand = this.intensityBand();
    this.effects.syncFx(
      Boolean(immediate),
      L,
      this.emotion,
      this.exprBand,
      inten,
      this.gesture?.projectConfig
    );
    this.gaze.pickLook(prof, this.tensionBand(), this.gesture);
    this.blinking.blinkTimer = this.blinking.nextBlinkGap(prof?.tensionProfiles?.[this.tensionBand()]);
  }

  private applyFace(immediate: boolean): void {
    const L = this.avatar;
    if (!L?.ready || !L.state) return;
    const st = L.state;
    const data = L.data;
    const inten = this.intensity(this.profile(this.emotion));
    const mixEye = immediate ? 0 : inten?.mixDurationEye || 0.25;
    const mixBrow = immediate ? 0 : inten?.mixDurationEyebrow || 0.25;

    const sets = inten?.expressionSets || [];
    const live = sets.filter((s) => s.weight == null || Number(s.weight) > 0);
    const expr = live.length ? weighted(live, (s) => (Number(s.weight) > 0 ? Number(s.weight) : 1)) : null;

    const closedCfg = this.gesture?.projectConfig?.closedEyeAnimation;
    this.eyeOpen = pickAnim(data, expr?.eyeOpen) || pickAnim(data, inten?.eyeBase);
    this.eyeClosed = pickAnim(data, expr?.eyeClosed) || pickAnim(data, closedCfg);
    const brow = pickAnim(data, expr?.eyebrow) || pickAnim(data, inten?.eyebrowBase);
    this.mouthIdle = pickAnim(data, expr?.mouth) || pickAnim(data, inten?.mouthBase);

    if (this.eyeOpen) st.setAnimation(2, this.eyeOpen, true).mixDuration = mixEye;
    if (brow) st.setAnimation(3, brow, true).mixDuration = mixBrow;
    if (!this.talking && this.mouthIdle && !this.pokeMouthHold) {
      st.setAnimation(4, this.mouthIdle, true).mixDuration = immediate ? 0 : 0.25;
    }
  }

  setTalking(on: boolean): void {
    const L = this.avatar;
    this.talking = Boolean(on);
    if (this.talking) this.tension = 1;
    if (!on) this.lipsync.clearEnvelope();
    if (!L?.ready || !L.state) return;

    const lip = pickAnim(L.data, this.lipSync) || pickAnim(L.data, FALLBACK_LIP);
    if (this.talking) this.pokeMouthHold = false;
    if (this.talking && lip) {
      L.state.setAnimation(4, lip, true).mixDuration = 0.12;
    } else if (this.mouthIdle && !this.pokeMouthHold) {
      L.state.setAnimation(4, this.mouthIdle, true).mixDuration = 0.2;
    }

    const tr0 = L.state.getCurrent(0);
    if (tr0) tr0.timeScale = this.animTimeScale();

    const bandNow = this.intensityBand();
    const bandPrev = this.exprBand || bandNow;
    this.exprBand = bandNow;
    if (bandNow !== bandPrev) {
      this.applyFace(false);
    }
    const inten = this.intensity(this.profile(this.emotion));
    this.effects.syncFx(false, L, this.emotion, bandNow, inten, this.gesture?.projectConfig);
    if (this.talking) {
      this.gaze.lookAtUserNow(this.profile(this.emotion), this.tensionBand(), this.gesture?.projectConfig);
    }
    if (!this.motion.addMuted) {
      this.motion.syncAdditives(
        this.idleName(),
        this.poseType,
        false,
        false,
        true,
        L,
        this.gesture,
        this.sittingId,
        inten
      );
    }
  }

  setTalkingEnvelope(env: { envelope: number[]; durationMs?: number; windowMs?: number } | null): void {
    this.setTalking(true);
    this.lipsync.setEnvelope(env);
  }

  setAudioAnalyser(analyser: AnalyserNode | null): void {
    this.lipsync.setAnalyser(analyser);
  }

  setHidden(on: boolean): void {
    this.hideChara = Boolean(on);
    this.avatarContainer.visible = !this.hideChara;
  }

  isHidden(): boolean {
    return this.hideChara;
  }

  poke(partName: string): string | null {
    if (this.hideChara) return null;
    const L = this.avatar;
    if (!L?.ready || !L.state || !partName) return null;
    const reactions = this.gesture?.emotionalGesture?.TapReactions || [];
    const list = reactions.filter((r) => r.PartName === partName);
    if (!list.length) return null;
    const pick = list[Math.floor(Math.random() * list.length)];
    const anim = pickAnim(L.data, pick.OverlayID);
    if (!anim) return null;

    const pc = this.gesture?.projectConfig;
    let enter = Number(pc?.tapReactionEnterMix);
    if (!(enter >= 0)) enter = 0.2;
    if (enter === 0 && isTrackBusy(L.state, 6)) enter = 0.15;

    this.motion.muteAdditives(true, L, this.idleName(), this.poseType, pc);

    // Empty track 4 so mouth doesn't distort
    if (!this.talking) {
      L.state.setEmptyAnimation(4, 0.08);
      this.pokeMouthHold = true;
    }

    const tr = L.state.setAnimation(6, anim, false);
    tr.mixDuration = enter;
    const foundAnim = L.data?.findAnimation(anim);
    L.state.addEmptyAnimation(6, this.motion.pokeExitMix(foundAnim, pc, L.data), 0);
    return pick.OverlayID;
  }

  private restoreMouthAfterPoke(): void {
    if (!this.pokeMouthHold) return;
    if (isTrackBusy(this.avatar?.state, 6)) return;
    this.pokeMouthHold = false;
    if (this.talking || !this.avatar?.state || !this.mouthIdle) return;
    this.avatar.state.setAnimation(4, this.mouthIdle, true).mixDuration = 0.2;
  }

  hitPartAt(cssX: number, cssY: number): string | null {
    if (this.hideChara) return null;
    const L = this.avatar;
    if (!L?.ready || !L.skeleton) return null;
    const w = this.screenToWorld(cssX, cssY);

    const hitParts = this.gesture?.projectConfig?.hitPartNames || {
      BB_head: 'head',
      BB_body: 'body',
      BB_arm_L: 'arm_l',
      BB_arm_R: 'arm_r',
      BB_weast: 'weast',
      BB_breast: 'breast',
    };

    const priorities = ['head', 'breast', 'weast', 'arm_l', 'arm_r', 'body'];
    const hits: Record<string, boolean> = {};

    for (const slotName in hitParts) {
      let slot = L.skeleton.findSlot(slotName);
      if (!slot) {
        slot =
          L.skeleton.findSlot(slotName.toLowerCase()) ||
          L.skeleton.findSlot(slotName.toUpperCase()) ||
          L.skeleton.findSlot(slotName.replace('_L', '_l').replace('_R', '_r'));
      }
      if (!slot) continue;
      const att = slot.getAttachment();
      if (!att || !(att instanceof BoundingBoxAttachment) || !att.worldVerticesLength) continue;
      const verts: number[] = [];
      try {
        att.computeWorldVertices(slot, 0, att.worldVerticesLength, verts, 0, 2);
        let testVerts = verts;
        if (slotName === 'BB_head' && verts.length >= 8) {
          // Extend top edge of BB_head upwards to cover top hair ribbon accessories
          const headVerts = [...verts];
          headVerts[0] += (verts[0] - verts[6]) * 0.25;
          headVerts[1] += (verts[1] - verts[7]) * 0.25;
          headVerts[2] += (verts[2] - verts[4]) * 0.25;
          headVerts[3] += (verts[3] - verts[5]) * 0.25;
          testVerts = headVerts;
        }
        if (testVerts.length >= 6 && pointInPoly(w.x, w.y, testVerts)) {
          hits[hitParts[slotName]] = true;
        }
      } catch {}
    }

    for (const part of priorities) {
      if (hits[part]) return part;
    }

    // Bone-relative fallback for head (ensures hair/accessories taps reliably hit head)
    const headBone = L.skeleton.findBone('head');
    if (headBone) {
      const sc = Math.abs(L.skeleton.scaleY) || 1;
      const hdx = Math.abs(w.x - headBone.worldX);
      const hdy = w.y - headBone.worldY;
      if (hdx < 380 * sc && hdy >= -130 * sc && hdy <= 680 * sc) {
        return 'head';
      }
    }

    return null;
  }

  setPointer(x: number, y: number, on: boolean): void {
    this.gaze.setPointer(x, y, on);
  }

  private renderFrame(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);

    if (this.scene?.ready && this.scene.spine) {
      this.scene.spine.update(dt);
    }

    if (this.avatar?.ready && this.avatar.spine) {
      const av = this.avatar.spine;
      this.placeCharacter();
      this.gaze.update(
        dt,
        av.skeleton,
        this.gesture?.projectConfig,
        (x, y) => this.screenToWorld(x, y),
        isTrackBusy(av.state, 1),
        this.motion.pokeUnmuteReady(av.state)
      );
      this.lipsync.update(dt, this.avatar, this.talking, this.gesture?.projectConfig, () =>
        this.setTalking(false)
      );

      this.lastFrameDt = dt;
      if (av.beforeUpdateWorldTransforms !== this.onBeforeUpdateWorldTransforms) {
        av.beforeUpdateWorldTransforms = this.onBeforeUpdateWorldTransforms;
      }

      av.update(dt);
    }

    // Tension decay
    const tgtT = this.talking ? 1 : 0;
    const tBand = tgtT > this.tension ? 'high' : this.tensionBand();
    const tRate = this.tensionRate(tBand);
    const nk = 1 - Math.exp(-tRate * 60 * dt);
    this.tension += (tgtT - this.tension) * nk;

    // Idle reroll
    this.idleTimer += dt;
    if (this.idleTimer > this.idleGap && this.avatar?.ready) {
      this.rerollIdle();
    }

    // Additives unmute
    if (this.motion.addMuted && this.motion.pokeUnmuteReady(this.avatar?.state) && this.avatar) {
      this.motion.muteAdditives(
        false,
        this.avatar,
        this.idleName(),
        this.poseType,
        this.gesture?.projectConfig
      );
    }
    this.restoreMouthAfterPoke();

    // Natural blinking
    const prof = this.profile(this.emotion);
    const tps = prof?.tensionProfiles;
    const tp = (tBand && tps?.[tBand]) || tps?.low || tps?.high;
    this.blinking.update(
      dt,
      this.avatar,
      this.eyeOpen,
      this.eyeClosed,
      isTrackBusy(this.avatar?.state, 1),
      tp
    );

    // Update Rim Light Overlay (Pattern 1: Additive Overlay Sprite)
    if (this.app?.renderer && this.rimTexture && this.rimFilter && this.rimSprite) {
      const light = this.sceneConfig?.config?.light;
      let rimOn = !this.hideChara && Boolean(this.avatar?.ready) && light && light.rimEnabled !== false;
      try {
        if (config.get('app')?.rim === false) rimOn = false;
      } catch {}

      if (rimOn) {
        this.rimSprite.visible = false;
        const prevSceneVis = this.sceneContainer.visible;
        this.sceneContainer.visible = false;

        try {
          this.app.renderer.render({
            container: this.worldContainer,
            target: this.rimTexture,
            clear: true,
          });
        } finally {
          this.sceneContainer.visible = prevSceneVis;
        }

        this.rimSprite.visible = true;
        this.rimFilter.updateLight(this.cssW, this.cssH, light);
      } else {
        this.rimSprite.visible = false;
      }
    }
  }

  private get panelFrac(): number {
    return computePanelFrac(this.cssH);
  }
}
