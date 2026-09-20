// Spine 2D Character and Stage Avatar Engine
import { clamp, lerp, weighted } from '../../util';
import { config } from '../../stores/config.svelte';
import { makeHost, makeLayer } from './host';
import { getCamParams, coverFor, REF_ZOOM, REF_H } from './camera';
import { MotionController, pickAnim, isTrackBusy, FALLBACK_IDLE } from './motion';
import { GazeController } from './gaze';
import { BlinkingController } from './blinking';
import { LipSyncController } from './lipsync';
import { EffectsController } from './effects';
import { RimPass } from './rim';
import { calcMixDuration, calcOverlayMix } from './distance-mix';
import type {
  SpineHost,
  SpineLayer,
  CameraView,
  CamParams,
  SkinEntry,
  GestureData,
  PostureCameraCatalog,
  SceneConfigData,
  EmotionProfile,
  IntensityProfile,
  SpineSlot,
  SpineSkeleton,
  SpineAnimationState,
} from './types';

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

export class AvatarEngine {
  host: SpineHost | null = null;
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
  rim = new RimPass();

  private _loadedSkelId = '';
  private _loadingSkelId = '';
  private _loadedSceneKey = '';
  private _loadingSceneKey = '';
  private _atlasVariant = 'default';
  private _variantMiss: Record<string, number> = {};
  private _emotion = 'neutral';
  private _attitude = 'agree';
  private _talking = false;
  private _idleTimer = 0;
  private _idleGap = 6;
  private _last = 0;
  private _eyeOpen: string | null = null;
  private _eyeClosed: string | null = null;
  private _mouthIdle: string | null = null;
  private _lipSync = FALLBACK_LIP;

  _view: CameraView = { left: 0, bottom: 0, worldW: 1, worldH: 1, cssW: 1, cssH: 1 };
  private _viewAuth: CamParams | null = null;
  private _headLocal: number | null = null;
  private _midBind: { name: string; x: number; y: number } | null = null;
  private _poseType = 'posetype_01_freehand';
  private _sittingId = 'sitting_normal';
  private _hideChara = false;
  private _skelHash = '';
  private _pokeMouthHold = false;
  private _exprBand = '';
  private _tension = 0;
  private _faceRef: { x: number; y: number } | null = null;
  private _raf = 0;
  private _running = false;

  init(canvas: HTMLCanvasElement): Promise<this> {
    this.host = makeHost(canvas);
    if (!this.host) return Promise.resolve(this);

    this.scene = makeLayer(this.host);
    this.avatar = makeLayer(this.host);

    this._running = true;
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);

    return Promise.all([
      fetch('/assets/data/posture_camera.json')
        .then((r) => r.json())
        .catch(() => ({})),
      fetch('/assets/_index/skins.json')
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([cam, skins]) => {
        this.postureCam = cam;
        this.skinsIndex = skins || [];
        return this;
      })
      .catch(() => this);
  }

  destroy(): void {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.scene) {
      this.scene.ready = false;
      this.scene.skeleton = null;
      this.scene.state = null;
      this.scene.data = null;
      this.scene.assets?.removeAll();
    }
    if (this.avatar) {
      this.avatar.ready = false;
      this.avatar.skeleton = null;
      this.avatar.state = null;
      this.avatar.data = null;
      this._disposeVariantTex(this.avatar);
      this.avatar.assets?.removeAll();
    }
    this.rim.destroy(this.host?.gl || null);
    this.motion.reset();
    this.gaze.reset();
    this.blinking.reset();
    this.lipsync.reset();
    this.effects.reset();
    this._loadedSkelId = '';
    this._loadingSkelId = '';
    this._loadedSceneKey = '';
    this._loadingSceneKey = '';
  }

  _cssZoom(el?: HTMLElement | HTMLCanvasElement | null): number {
    if (!el || !el.clientWidth || !el.getBoundingClientRect) return 1;
    const w = el.getBoundingClientRect().width;
    return (w > 0 && w / el.clientWidth) || 1;
  }

  resize(): void {
    const host = this.host;
    if (!host) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1) * this._cssZoom(host.canvas);
    const w = Math.max(1, Math.floor(host.canvas.clientWidth));
    const h = Math.max(1, Math.floor(host.canvas.clientHeight));
    const bw = Math.max(1, Math.floor(w * dpr));
    const bh = Math.max(1, Math.floor(h * dpr));
    if (host.canvas.width !== bw || host.canvas.height !== bh) {
      host.canvas.width = bw;
      host.canvas.height = bh;
    }
    if (host.gl) host.gl.viewport(0, 0, bw, bh);
    [this.scene, this.avatar].forEach((L) => {
      if (!L) return;
      L.cssW = w;
      L.cssH = h;
      L.dpr = dpr;
    });
    this._applyCamera();
  }

  outfitOf(id?: string): string {
    return String(id || 'crf_skn_002_0001').replace(/_(01|99)$/, '');
  }

  private _scenePostures(): string[] {
    const cfg = this.sceneConfig?.config as unknown as { midgroundPostures?: string[] } | undefined;
    return cfg?.midgroundPostures || [];
  }

  postureKey(): string {
    if (!this.supportsBothPostures()) return 'posture_standing';
    try {
      const want = config.section('state')?.posture;
      if (want === 'posture_standing' || want === 'posture_sitting') return want;
    } catch {}
    return 'posture_standing';
  }

  private _loadedPosture(): string {
    const id = this._loadedSkelId || '';
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
      return config.section('state')?.mode === 'asmr';
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
    const s = this.skinsIndex.find((x) => x.id === this._loadedSkelId);
    const ov = s?.variants?.[v];
    if (typeof ov === 'string') add(ov);
    else if (ov && typeof ov === 'object') add((ov as Record<string, string>)[page]);
    add(`${dir}${base}${v}${ext}`);
    add(`${dir}${base}_${v}${ext}`);
    return out;
  }

  setAtlasVariant(name: string, cb?: () => void): void {
    this._atlasVariant = String(name || 'default').toLowerCase();
    this._applyAtlasVariant(cb);
  }

  private _disposeVariantTex(L: SpineLayer | null): void {
    if (!L || !L._atlasVarTex) return;
    L._atlasVarTex.forEach((t) => {
      const tex = t as { dispose?: () => void };
      if (tex && typeof tex.dispose === 'function') {
        try {
          tex.dispose();
        } catch {}
      }
    });
    L._atlasVarTex = null;
    L._atlasVarName = '';
  }

  private _loadPageImage(L: SpineLayer, url: string, cb: (tex: unknown) => void): void {
    const spineObj = (
      window as unknown as { spine?: { GLTexture: new (ctx: unknown, img: HTMLImageElement) => unknown } }
    ).spine;
    if (!L || !url || typeof Image === 'undefined' || !spineObj?.GLTexture) {
      cb(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        cb(new spineObj.GLTexture(L.ctx, img));
      } catch {
        cb(null);
      }
    };
    img.onerror = () => {
      cb(null);
    };
    img.src = url;
  }

  private _tryPageUrls(L: SpineLayer, urls: string[], cb: (tex: unknown) => void): void {
    let i = 0;
    const next = () => {
      if (i >= urls.length) {
        cb(null);
        return;
      }
      const url = urls[i++];
      const miss = `${this._loadedSkelId || ''}\0${url}`;
      if (this._variantMiss[miss]) {
        next();
        return;
      }
      this._loadPageImage(L, url, (tex) => {
        if (tex) {
          cb(tex);
          return;
        }
        this._variantMiss[miss] = 1;
        next();
      });
    };
    next();
  }

  private _applyAtlasVariant(cb?: () => void): void {
    const L = this.avatar;
    const done = () => cb?.();
    if (!L || !L._atlas || !L.ctx) {
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
    const variant = this._cleanVariant(this._atlasVariant);
    if (!variant) {
      for (let i = 0; i < pages.length; i++) {
        if (L._atlasBaseTex[i]) pages[i].setTexture(L._atlasBaseTex[i]);
      }
      this._disposeVariantTex(L);
      done();
      return;
    }
    if (L._atlasVarName === variant && L._atlasVarTex) {
      for (let i = 0; i < pages.length; i++) {
        pages[i].setTexture(L._atlasVarTex[i] || L._atlasBaseTex[i]);
      }
      done();
      return;
    }
    const newTex: unknown[] = new Array(pages.length).fill(null);
    let pending = pages.length;
    const finish = () => {
      this._disposeVariantTex(L);
      L._atlasVarTex = newTex;
      L._atlasVarName = variant;
      for (let i = 0; i < pages.length; i++) {
        pages[i].setTexture(newTex[i] || L._atlasBaseTex![i]);
      }
      done();
    };
    for (let idx = 0; idx < pages.length; idx++) {
      const page = pages[idx];
      const urls = this.variantPageUrls(L._atlasUrl || '', page.name, variant);
      this._tryPageUrls(L, urls, (tex) => {
        newTex[idx] = tex;
        if (--pending === 0) finish();
      });
    }
  }

  private _camParams(postureKey?: string, asmr?: boolean): CamParams {
    const isAsmr = asmr !== undefined ? asmr : this._asmrOn();
    const pk = postureKey || this.postureKey();
    const L = this.scene || this.avatar;
    const cssW = (L && L.cssW) || 1;
    const cssH = (L && L.cssH) || 1;
    return getCamParams(pk, isAsmr, this.postureCam, cssW, cssH);
  }

  private _applyCamera(): void {
    const host = this.host;
    const L = this.scene || this.avatar;
    if (!host || !L || !L.cssW || !L.cssH) return;
    const active = this._camParams(this._loadedPosture());
    let win = this.supportsBothPostures() ? this._camParams(this._primaryPosture(), this._asmrOn()) : active;
    const cover = coverFor(this.scene);
    if (cover && cover.w > 0 && cover.h > 0) {
      const aspect = L.cssW / L.cssH;
      const frac = this._panelFrac || 0;
      const h = Math.min(win.worldH, Math.min(cover.h / Math.max(0.4, 1 - frac), cover.w / aspect));
      const w = h * aspect;
      let bottom = win.bottom;
      const floorY = cover.y0 - h * frac;
      if (bottom < floorY) bottom = floorY;
      if (bottom > cover.y1 - h) bottom = cover.y1 - h;
      let left = win.left + (win.worldW - w) / 2;
      if (left < cover.x0) left = cover.x0;
      if (cover.w >= w && left > cover.x1 - w) left = cover.x1 - w;
      win = {
        ...win,
        left,
        bottom,
        worldW: w,
        worldH: h,
      };
    }
    this._view = {
      left: win.left,
      bottom: win.bottom,
      worldW: win.worldW,
      worldH: win.worldH,
      cssW: L.cssW,
      cssH: L.cssH,
    };
    this._viewAuth = active;
    host.mvp.ortho2d(win.left, win.bottom, win.worldW, win.worldH);
    if (host.gl) host.gl.viewport(0, 0, host.canvas.width, host.canvas.height);
    this._placeCharacter();
  }

  private _measureHeadLocal(): void {
    const L = this.avatar;
    this._headLocal = null;
    if (!L || !L.data) return;
    const spineObj = (
      window as unknown as {
        spine?: { Skeleton: new (d: unknown) => SpineSkeleton; Physics?: { pose: unknown } };
      }
    ).spine;
    if (!spineObj) return;
    try {
      const sk = new spineObj.Skeleton(L.data);
      sk.updateWorldTransform(spineObj.Physics?.pose);
      const b = sk.findBone('head');
      if (b) this._headLocal = b.worldY;
    } catch {}
  }

  private _placeCharacter(): void {
    const L = this.avatar;
    const S = this.scene;
    if (!L?.skeleton) return;
    const cam = this._camParams(this._loadedPosture());
    let x = cam.offsetX;
    let y = cam.offsetY;
    if (S?.skeleton) {
      const bone = S.skeleton.findBone('chara_root');
      if (bone) {
        x += bone.worldX;
        y += bone.worldY;
      }
      if (this._seatedOnMid() && this._midBind) {
        const mid = S.skeleton.findBone(this._midBind.name);
        if (mid) {
          x += mid.worldX - this._midBind.x;
          y += mid.worldY - this._midBind.y;
        }
      }
    }
    const v = this._view;
    const a = this._viewAuth;
    const k = v && v.worldH && a && a.worldH ? v.worldH / a.worldH : 1;
    let sx: number, sy: number;
    const sc = cam.scale * k;
    if (this._seatedOnMid()) {
      sx = x;
      sy = y;
    } else {
      sx = v && a ? v.left + (x - a.left) * k : x;
      sy = v && a ? v.bottom + (y - a.bottom) * k : y;
      if (this._headLocal != null && v && v.worldH > 0) {
        const target = this._asmrOn() ? 0.5 : this._loadedPosture() === 'posture_standing' ? 0.7 : 0.71;
        const frac = (sy + this._headLocal * sc - v.bottom) / v.worldH;
        if (Math.abs(frac - target) > 0.1) sy += (target - frac) * v.worldH;
      }
    }
    L.skeleton.x = sx;
    L.skeleton.y = sy;
    L.skeleton.scaleX = L.skeleton.scaleY = sc;
  }

  private _seatedOnMid(): boolean {
    return this._loadedPosture() === 'posture_sitting' && Boolean(this._midBind?.name);
  }

  private _cacheMidBind(L: SpineLayer): void {
    this._midBind = null;
    if (!L?.skeleton) return;
    const spineObj = (window as unknown as { spine?: { Physics?: { none: unknown } } }).spine;
    if (!spineObj) return;
    try {
      (L.skeleton as unknown as { setToSetupPose(): void }).setToSetupPose();
      L.skeleton.updateWorldTransform(spineObj.Physics?.none);
      const b = L.skeleton.findBone('sofa_root');
      if (b) this._midBind = { name: 'sofa_root', x: b.worldX, y: b.worldY };
    } catch {
      this._midBind = null;
    }
  }

  screenToWorld(cssX: number, cssY: number): { x: number; y: number } {
    const v = this._view;
    return {
      x: v.left + (cssX / Math.max(1, v.cssW)) * v.worldW,
      y: v.bottom + ((v.cssH - cssY) / Math.max(1, v.cssH)) * v.worldH,
    };
  }

  private _loadSpine(
    L: SpineLayer,
    skelUrl: string,
    atlasUrl: string,
    done: (err: Error | null) => void
  ): void {
    const spineObj = (
      window as unknown as {
        spine?: {
          AtlasAttachmentLoader: new (a: unknown) => unknown;
          SkeletonBinary: new (l: unknown) => { scale: number; readSkeletonData(bytes: unknown): unknown };
          Skeleton: new (d: unknown) => SpineSkeleton;
          AnimationState: new (d: unknown) => SpineAnimationState;
          AnimationStateData: new (d: unknown) => { defaultMix: number };
        };
      }
    ).spine;
    if (!spineObj) {
      done(new Error('Spine WebGL runtime not loaded'));
      return;
    }
    L.ready = false;
    L.skeleton = null;
    L.state = null;
    L.data = null;

    const a = L.assets;
    if (L === this.avatar) {
      this._disposeVariantTex(L);
      L._atlas = null;
      L._atlasUrl = '';
      L._atlasBaseTex = null;
    }
    a.removeAll();
    a.errors = {};
    a.loadBinary(skelUrl);
    a.loadTextureAtlas(atlasUrl);
    let tries = 0;
    const poll = () => {
      if (a.isLoadingComplete()) {
        if (a.hasErrors()) {
          done(new Error(`素材加载失败：${skelUrl}`));
          return;
        }
        try {
          const atlas = a.require(atlasUrl);
          const loader = new spineObj.AtlasAttachmentLoader(atlas);
          const bin = new spineObj.SkeletonBinary(loader);
          bin.scale = 1;
          const data = bin.readSkeletonData(a.require(skelUrl)) as unknown as SpineLayer['data'];
          L.data = data;
          L.skeleton = new spineObj.Skeleton(data);
          const animState = new spineObj.AnimationState(new spineObj.AnimationStateData(data));
          animState.data.defaultMix = 0.12;
          L.state = animState;
          L._cover = null;
          L._coverDone = false;
          if (L === this.avatar) {
            this._skelHash = String(data?.hash || '').toLowerCase();
            L._atlas = atlas as unknown as SpineLayer['_atlas'];
            L._atlasUrl = atlasUrl;
            L._atlasBaseTex = null;
          }
          L.ready = true;
          done(null);
        } catch (e: unknown) {
          L.ready = false;
          L.skeleton = null;
          L.state = null;
          L.data = null;
          done(e instanceof Error ? e : new Error(String(e)));
        }
        return;
      }
      if (++tries > 900) {
        done(new Error(`加载超时：${skelUrl}`));
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
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
      if (this._loadedSkelId === s.id && L.ready) {
        cb?.(null);
        return;
      }
      if (this._loadingSkelId === s.id) {
        return;
      }
      this._loadingSkelId = s.id;
      L.ready = false;
      L.skeleton = null;
      L.state = null;
      L.data = null;
      const gP = s.gesture ? fetch(s.gesture).then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null);
      gP.then((g) => {
        if (this._loadingSkelId !== s.id) return;
        this.gesture = g;
        this._loadSpine(L, s.skel!, s.atlas!, (err) => {
          if (this._loadingSkelId !== s.id) return;
          if (err) {
            this._loadingSkelId = '';
            cb?.(err);
            return;
          }
          this._loadedSkelId = s.id;
          this._loadingSkelId = '';
          this._sittingId = this._sittingFromPosture();
          this._measureHeadLocal();
          this.setEmotion(this._emotion, this._attitude, true);
          this._playWind();
          this.resize();
          if (this._cleanVariant(this._atlasVariant)) this._applyAtlasVariant();
          cb?.(null);
        });
      }).catch((e: unknown) => {
        if (this._loadingSkelId === s.id) {
          this._loadingSkelId = '';
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
    const sceneKey = `${stageId}/${tod}`;
    if (this._loadedSceneKey === sceneKey && L.ready) {
      cb?.(null);
      return;
    }
    if (this._loadingSceneKey === sceneKey) {
      return;
    }
    this._loadingSceneKey = sceneKey;
    L.ready = false;
    L.skeleton = null;
    L.state = null;
    L.data = null;
    fetch('/assets/_index/scenes.json')
      .then((r) => r.json())
      .then((scenes) => {
        if (this._loadingSceneKey !== sceneKey) return;
        const stage = scenes[stageId];
        const entry = stage && (stage[tod] || stage[Object.keys(stage)[0]]);
        if (!entry) throw new Error(`没有这个场景：${stageId}/${tod}`);
        const cfgP = entry.config
          ? fetch(entry.config)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);
        return cfgP.then((cfg) => {
          if (this._loadingSceneKey !== sceneKey) return;
          this.sceneConfig = cfg;
          this._loadSpine(L, entry.skel, entry.atlas, (err) => {
            if (this._loadingSceneKey !== sceneKey) return;
            if (err) {
              this._loadingSceneKey = '';
              cb?.(err);
              return;
            }
            this._loadedSceneKey = sceneKey;
            this._loadingSceneKey = '';
            const fade = pickAnim(L.data, 'anm_fade_in') || pickAnim(L.data, 'anm_fade_in_all');
            if (fade && L.state) {
              const tr = L.state.setAnimation(0, fade, false);
              tr.mixDuration = 0;
            }
            this._applySceneConstraints(L, cfg);
            this._cacheMidBind(L);
            this.resize();
            const outfit = skinId || config.section('state')?.skin || 'crf_skn_002_0001';
            this.loadSkin(outfit, cb);
          });
        });
      })
      .catch((e: unknown) => {
        if (this._loadingSceneKey === sceneKey) {
          this._loadingSceneKey = '';
        }
        cb?.(e instanceof Error ? e : new Error(String(e)));
      });
  }

  private _applySceneConstraints(L: SpineLayer, cfg: SceneConfigData | null): void {
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
      const n = (c.data && c.data.name) || c.name || '';
      const o = ov[n];
      if (!o) continue;
      if (o.translateMixX != null) c.mixX = asMix(o.translateMixX);
      if (o.translateMixY != null) c.mixY = asMix(o.translateMixY);
      if (o.scaleMixX != null) c.mixScaleX = asMix(o.scaleMixX);
      if (o.scaleMixY != null) c.mixScaleY = asMix(o.scaleMixY);
    }
  }

  private _profile(emotion: string): EmotionProfile | null {
    const map = this.gesture?.emotionalGesture?.EmotionProfilesV4;
    if (!map) return null;
    return map[emotion] || map.neutral || null;
  }

  private _intensityBand(): string {
    if (this._talking || this._tension > 0.66) return 'strong';
    let mode = '';
    try {
      mode = config.section('state')?.mode;
    } catch {}
    return mode === 'asmr' ? 'weak' : 'normal';
  }

  private _intensity(prof: EmotionProfile | null): IntensityProfile | null {
    const ip = prof?.intensityProfiles;
    if (!ip) return null;
    return ip[this._intensityBand()] || ip.normal || ip.strong || ip.weak || null;
  }

  private _tensionBand(): string {
    const v = this._tension;
    return v > 0.66 ? 'high' : v > 0.33 ? 'mid' : 'low';
  }

  private _tensionRate(band: string): number {
    const tc = this.gesture?.projectConfig?.tensionConfig;
    const dr = tc?.decayRates || {};
    let v = Number(dr[band]);
    if (!(v > 0)) v = Number(tc?.defaultDecayRate);
    if (!(v > 0)) v = 0.02;
    return clamp(v, 0.002, 0.5);
  }

  private _sittingFromPosture(): string {
    const p = this._loadedPosture() || '';
    if (/agura/i.test(p)) return 'sitting_agura';
    if (/stand/i.test(p)) return 'standing';
    return 'sitting_normal';
  }

  private _idleName(): string {
    const tr = this.avatar?.state?.getCurrent(0);
    return tr?.animation?.name || '';
  }

  private _animTimeScale(): number {
    const prof = this._profile(this._emotion);
    let ts = Number(prof?.baseAnimTimeScale) || 1;
    const mul = this.gesture?.emotionalGesture?.performanceConfig?.intensitySpeedMultipliers;
    if (mul) {
      const band = this._intensityBand();
      if (band !== 'normal' && Number(mul[band]) > 0) ts *= Number(mul[band]);
    }
    return ts;
  }

  private _playWind(): void {
    const L = this.avatar;
    if (!L?.data || !L.state) return;
    const spineObj = (window as unknown as { spine?: { MixBlend?: { add: unknown } } }).spine;
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
    if (spineObj?.MixBlend) tr.mixBlend = spineObj.MixBlend.add;
  }

  private _oneShots(emotion: string, attitude: string): string[] {
    const prof = this._profile(emotion);
    if (!prof) return [];
    const list = prof.fixedGestureBindingsByAttitude?.[attitude] || [];
    const picked = list.filter((x) => (x.weight || 0) > 0 && x.oneShotAnimation);
    const hit = weighted(picked, (x) => x.weight || 0);
    return hit?.oneShotAnimation ? [hit.oneShotAnimation] : [];
  }

  private _rerollIdle(): void {
    const L = this.avatar;
    if (!L?.ready || !L.state) return;
    const cur = L.state.getCurrent(0);
    if (cur?.mixingFrom) return;
    if (isTrackBusy(L.state, 1) || isTrackBusy(L.state, 6)) return;

    const fromName = cur?.animation?.name || '';
    const prevType =
      this._poseType ||
      this.motion.poseTypesOf(fromName, this.gesture, this._intensity(this._profile(this._emotion)))[0] ||
      'posetype_01_freehand';
    const nextType = this.motion.pickPoseType(prevType, this.gesture);
    let idle = this.motion.idlesForType(
      L.data,
      nextType,
      this._sittingId,
      this._intensity(this._profile(this._emotion)),
      this.gesture
    );
    let finalType = nextType;
    if (!idle.length) {
      idle = this.motion.idlesForType(
        L.data,
        'posetype_01_freehand',
        this._sittingId,
        this._intensity(this._profile(this._emotion)),
        this.gesture
      );
      finalType = 'posetype_01_freehand';
    }
    if (!idle.length) {
      this._idleTimer = 0;
      return;
    }
    const pickIdle = weighted(idle, (x) => x.w);
    const name = pickIdle?.name;
    if (!name) {
      this._idleTimer = 0;
      return;
    }

    const inten = this._intensity(this._profile(this._emotion));
    const a = inten?.poseRerollIntervalMin || 5;
    const b = inten?.poseRerollIntervalMax || 8;
    this._idleGap = a + Math.random() * Math.max(0, b - a);
    this._idleTimer = 0;
    this._poseType = finalType;

    if (!this._talking) this._applyFace(false);
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
          this._sittingId,
          inten
        );
      }
      return;
    }

    const mix = calcMixDuration(
      fromName,
      name,
      this._profile(this._emotion),
      this.gesture?.emotionalGesture?.MixDurationPoses,
      this._skelHash,
      this.gesture?.projectConfig,
      (id) => this.motion.poseTypesOf(id, this.gesture, inten)
    );

    const tr = L.state.setAnimation(0, name, true);
    tr.mixDuration = mix;
    tr.timeScale = this._animTimeScale();
    this.motion.syncAdditives(name, finalType, false, false, keep, L, this.gesture, this._sittingId, inten);
  }

  setEmotion(emotion: string, attitude: string, immediate?: boolean): void {
    const names = ['neutral', 'happy', 'laughing', 'tease', 'shy', 'cuddle', 'sad', 'crying', 'angry'];
    const atts = ['agree', 'deny', 'question'];
    if (names.includes(emotion)) this._emotion = emotion;
    if (atts.includes(attitude)) this._attitude = attitude;
    const L = this.avatar;
    if (!L?.ready || !L.state) return;

    const prof = this._profile(this._emotion);
    const inten = this._intensity(prof);
    const timeScale = this._animTimeScale();
    const sat = Number(this.gesture?.projectConfig?.mixDurationSaturationRatio) || 0.1;
    L.state.data.defaultMix = (Number(prof?.mixDurationMin) || 1) * sat;
    this._lipSync = prof?.lipSyncScrubClip || FALLBACK_LIP;

    const a = inten?.poseRerollIntervalMin || 5;
    const b = inten?.poseRerollIntervalMax || 8;
    this._idleGap = a + Math.random() * Math.max(0, b - a);
    this._sittingId = this._sittingFromPosture();

    const cur0 = L.state.getCurrent(0);
    const hasIdle = cur0?.animation?.name;
    if (!hasIdle) {
      const poseType = this._poseType || 'posetype_01_freehand';
      const idle = this.motion.idlesForType(L.data, poseType, this._sittingId, inten, this.gesture);
      if (idle.length) {
        const pi = weighted(idle, (x) => x.w);
        const idleName = pi?.name;
        if (idleName) {
          const tr0 = L.state.setAnimation(0, idleName, true);
          tr0.mixDuration = 0;
          tr0.timeScale = timeScale;
          this._poseType = this.motion.poseTypesOf(idleName, this.gesture, inten)[0] || poseType;
          this.motion.syncAdditives(
            idleName,
            this._poseType,
            true,
            true,
            false,
            L,
            this.gesture,
            this._sittingId,
            inten
          );
        }
      }
    } else {
      cur0.timeScale = timeScale;
    }

    const shots = this._oneShots(this._emotion, this._attitude)
      .map((n) => pickAnim(L.data, n))
      .filter(Boolean) as string[];
    if (shots.length && !immediate) {
      const tr = L.state.setAnimation(1, shots[0], false);
      tr.mixDuration = calcOverlayMix(prof, this.gesture?.projectConfig);
      const spineObj = (window as unknown as { spine?: { MixBlend?: { replace: unknown } } }).spine;
      if (spineObj?.MixBlend) tr.mixBlend = spineObj.MixBlend.replace;
      let fade = Number(this.gesture?.projectConfig?.tapReactionExitMix);
      if (!(fade > 0)) fade = 0.3;
      L.state.addEmptyAnimation(1, fade, 0);
      this.motion.syncAdditives(
        hasIdle || this._idleName(),
        this._poseType,
        false,
        false,
        true,
        L,
        this.gesture,
        this._sittingId,
        inten
      );
    } else if (hasIdle) {
      this.motion.syncAdditives(
        hasIdle,
        this._poseType || this.motion.poseTypesOf(hasIdle, this.gesture, inten)[0],
        Boolean(immediate),
        false,
        !immediate,
        L,
        this.gesture,
        this._sittingId,
        inten
      );
    }

    this._applyFace(Boolean(immediate));
    this._exprBand = this._intensityBand();
    this.effects.syncFx(
      Boolean(immediate),
      L,
      this._emotion,
      this._exprBand,
      inten,
      this.gesture?.projectConfig
    );
    this.gaze.pickLook(prof, this._tensionBand(), this.gesture);
    this.blinking.blinkTimer = this.blinking.nextBlinkGap(prof?.tensionProfiles?.[this._tensionBand()]);
  }

  private _applyFace(immediate: boolean): void {
    const L = this.avatar;
    if (!L?.ready || !L.state) return;
    const st = L.state;
    const data = L.data;
    const inten = this._intensity(this._profile(this._emotion));
    const mixEye = immediate ? 0 : inten?.mixDurationEye || 0.25;
    const mixBrow = immediate ? 0 : inten?.mixDurationEyebrow || 0.25;

    const sets = inten?.expressionSets || [];
    const live = sets.filter((s) => s.weight == null || Number(s.weight) > 0);
    const expr = live.length ? weighted(live, (s) => (Number(s.weight) > 0 ? Number(s.weight) : 1)) : null;

    const closedCfg = this.gesture?.projectConfig?.closedEyeAnimation;
    this._eyeOpen = pickAnim(data, expr?.eyeOpen) || pickAnim(data, inten?.eyeBase);
    this._eyeClosed = pickAnim(data, expr?.eyeClosed) || pickAnim(data, closedCfg);
    const brow = pickAnim(data, expr?.eyebrow) || pickAnim(data, inten?.eyebrowBase);
    this._mouthIdle = pickAnim(data, expr?.mouth) || pickAnim(data, inten?.mouthBase);

    if (this._eyeOpen) st.setAnimation(2, this._eyeOpen, true).mixDuration = mixEye;
    if (brow) st.setAnimation(3, brow, true).mixDuration = mixBrow;
    if (!this._talking && this._mouthIdle && !this._pokeMouthHold) {
      st.setAnimation(4, this._mouthIdle, true).mixDuration = immediate ? 0 : 0.25;
    }
  }

  setTalking(on: boolean): void {
    const L = this.avatar;
    this._talking = Boolean(on);
    if (this._talking) this._tension = 1;
    if (!on) this.lipsync.clearEnvelope();
    if (!L?.ready || !L.state) return;

    const lip = pickAnim(L.data, this._lipSync) || pickAnim(L.data, FALLBACK_LIP);
    if (this._talking) this._pokeMouthHold = false;
    if (this._talking && lip) {
      L.state.setAnimation(4, lip, true).mixDuration = 0.12;
    } else if (this._mouthIdle && !this._pokeMouthHold) {
      L.state.setAnimation(4, this._mouthIdle, true).mixDuration = 0.2;
    }

    const tr0 = L.state.getCurrent(0);
    if (tr0) tr0.timeScale = this._animTimeScale();

    const bandNow = this._intensityBand();
    const bandPrev = this._exprBand || bandNow;
    this._exprBand = bandNow;
    if (bandNow !== bandPrev) {
      this._applyFace(false);
    }
    const inten = this._intensity(this._profile(this._emotion));
    this.effects.syncFx(false, L, this._emotion, bandNow, inten, this.gesture?.projectConfig);
    if (this._talking) {
      this.gaze.lookAtUserNow(this._profile(this._emotion), this._tensionBand(), this.gesture?.projectConfig);
    }
    if (!this.motion.addMuted) {
      this.motion.syncAdditives(
        this._idleName(),
        this._poseType,
        false,
        false,
        true,
        L,
        this.gesture,
        this._sittingId,
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
    this._hideChara = Boolean(on);
  }

  isHidden(): boolean {
    return this._hideChara;
  }

  poke(partName: string): string | null {
    if (this._hideChara) return null;
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

    this.motion.muteAdditives(true, L, this._idleName(), this._poseType, pc);

    // Empty track 4 so mouth doesn't distort
    if (!this._talking) {
      L.state.setEmptyAnimation(4, 0.08);
      this._pokeMouthHold = true;
    }

    const tr = L.state.setAnimation(6, anim, false);
    tr.mixDuration = enter;
    const foundAnim = L.data?.findAnimation(anim);
    L.state.addEmptyAnimation(6, this.motion.pokeExitMix(foundAnim, pc), 0);
    return pick.OverlayID;
  }

  private _restoreMouthAfterPoke(): void {
    if (!this._pokeMouthHold) return;
    if (isTrackBusy(this.avatar?.state, 6)) return;
    this._pokeMouthHold = false;
    if (this._talking || !this.avatar?.state || !this._mouthIdle) return;
    this.avatar.state.setAnimation(4, this._mouthIdle, true).mixDuration = 0.2;
  }

  hitPartAt(cssX: number, cssY: number): string | null {
    if (this._hideChara) return null;
    const L = this.avatar;
    if (!L?.ready || !L.skeleton) return null;
    const w = this.screenToWorld(cssX, cssY);

    const hitParts = (this.gesture?.projectConfig?.hitPartNames as Record<string, string> | undefined) || {
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
      const slot = L.skeleton.findSlot(slotName);
      if (!slot) continue;
      const att = slot.getAttachment() as {
        worldVerticesLength?: number;
        computeWorldVertices?: (
          s: unknown,
          a: number,
          len: number,
          out: number[],
          o: number,
          st: number
        ) => void;
      };
      if (!att?.worldVerticesLength || !att.computeWorldVertices) continue;
      const verts: number[] = [];
      try {
        att.computeWorldVertices(slot, 0, att.worldVerticesLength, verts, 0, 2);
        if (verts.length >= 6 && pointInPoly(w.x, w.y, verts)) {
          hits[hitParts[slotName]] = true;
        }
      } catch {}
    }

    for (const part of priorities) {
      if (hits[part]) return part;
    }

    // Fallback hit radius test against character center
    const dx = Math.abs(w.x - L.skeleton.x);
    const dy = Math.abs(w.y - L.skeleton.y);
    if (dx < 300 && dy < 600) {
      if (w.y > L.skeleton.y + 350) return 'head';
      if (w.y > L.skeleton.y + 150) return 'breast';
      return 'body';
    }
    return null;
  }

  setPointer(x: number, y: number, on: boolean): void {
    this.gaze.setPointer(x, y, on);
  }

  private _loop(now: number): void {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._loop);
    const dt = this._last ? Math.min((now - this._last) / 1000, 0.05) : 0;
    this._last = now;

    const spineObj = (window as unknown as { spine?: { Physics?: { none: unknown; update: unknown } } })
      .spine;
    if (!spineObj) return;

    if (this.scene && this.scene.ready && this.scene.skeleton && this.scene.state) {
      this.scene.state.update(dt);
      this.scene.state.apply(this.scene.skeleton);
      this.scene.skeleton.update(dt);
      this.scene.skeleton.updateWorldTransform(spineObj.Physics?.none);
    }

    if (this.avatar && this.avatar.ready && this.avatar.skeleton && this.avatar.state) {
      this._placeCharacter();
      this.gaze.update(
        dt,
        this.avatar.skeleton,
        this.gesture?.projectConfig,
        (x, y) => this.screenToWorld(x, y),
        isTrackBusy(this.avatar.state, 1),
        this.motion.pokeUnmuteReady(this.avatar.state)
      );
      this.avatar.state.update(dt);
      this.lipsync.update(dt, this.avatar, this._talking, this.gesture?.projectConfig, () =>
        this.setTalking(false)
      );
      this.avatar.state.apply(this.avatar.skeleton);
      this.avatar.skeleton.update(dt);
      this.effects.hideFxSlots(this.avatar.skeleton, this.effects.fxOn);
      this.gaze.apply(
        this.avatar.skeleton,
        this.gesture?.projectConfig,
        dt,
        isTrackBusy(this.avatar.state, 1)
      );
      this.avatar.skeleton.updateWorldTransform(spineObj.Physics?.update);
    }

    // Tension decay
    const tgtT = this._talking ? 1 : 0;
    const tBand = tgtT > this._tension ? 'high' : this._tensionBand();
    const tRate = this._tensionRate(tBand);
    const nk = 1 - Math.exp(-tRate * 60 * dt);
    this._tension += (tgtT - this._tension) * nk;

    // Idle reroll
    this._idleTimer += dt;
    if (this._idleTimer > this._idleGap && this.avatar?.ready) {
      this._rerollIdle();
    }

    // Additives unmute
    if (this.motion.addMuted && this.motion.pokeUnmuteReady(this.avatar?.state) && this.avatar) {
      this.motion.muteAdditives(
        false,
        this.avatar,
        this._idleName(),
        this._poseType,
        this.gesture?.projectConfig
      );
    }
    this._restoreMouthAfterPoke();

    // Natural blinking
    const prof = this._profile(this._emotion);
    const tps = prof?.tensionProfiles;
    const tp = (tBand && tps?.[tBand]) || tps?.low || tps?.high;
    this.blinking.update(
      dt,
      this.avatar,
      this._eyeOpen,
      this._eyeClosed,
      isTrackBusy(this.avatar?.state, 1),
      tp
    );

    this._draw();
  }

  private _isSetupMul(n: string): boolean {
    return /nose_hi|cheek_line/.test(n);
  }

  private _isOverlayMul(n: string): boolean {
    return /face_cheek|face_pale|face_tear|face_sweat|mouth_drool/.test(n);
  }

  private _drawSkeleton(L: SpineLayer, pma: boolean): void {
    const host = this.host;
    if (!host || !L.ready || !L.skeleton) return;
    host.sr.premultipliedAlpha = Boolean(pma);
    host.batcher.begin(host.shader);
    host.sr.draw(host.batcher, L.skeleton);
    host.batcher.end();
  }

  private _drawLayer(L: SpineLayer | null): void {
    if (!L?.ready || !L.skeleton) return;
    const sk = L.skeleton;
    const savedBlend: Array<{ slot: SpineSlot; blend: number }> = [];
    const savedMul: Array<{ slot: SpineSlot; att: unknown }> = [];
    const savedA: Array<{ slot: SpineSlot; a: number }> = [];
    const savedSetup: Array<{ slot: SpineSlot; att: unknown }> = [];

    for (let i = 0; i < sk.slots.length; i++) {
      const slot = sk.slots[i];
      const n = (slot.data && slot.data.name) || '';
      if (this._isSetupMul(n)) {
        const att = slot.getAttachment();
        savedSetup.push({ slot, att });
        if (att) slot.setAttachment(null);
        continue;
      }
      if (slot.data?.blendMode === 2 && this._isOverlayMul(n)) {
        savedBlend.push({ slot, blend: slot.data.blendMode });
        slot.data.blendMode = 0;
        continue;
      }
      if (slot.data?.blendMode === 2) {
        const att = slot.getAttachment();
        savedMul.push({ slot, att });
        if (att) slot.setAttachment(null);
      }
    }

    try {
      this._drawSkeleton(L, false);
      for (let i = 0; i < savedMul.length; i++) {
        if (savedMul[i].att) savedMul[i].slot.setAttachment(savedMul[i].att);
      }
      if (savedMul.length) {
        for (let i = 0; i < sk.slots.length; i++) {
          const slot = sk.slots[i];
          const n = (slot.data && slot.data.name) || '';
          if (slot.data?.blendMode === 2 && !this._isSetupMul(n) && !this._isOverlayMul(n)) continue;
          savedA.push({ slot, a: slot.color.a });
          slot.color.a = 0;
        }
        this._drawSkeleton(L, true);
      }
    } finally {
      for (let i = 0; i < savedSetup.length; i++) {
        if (savedSetup[i].att) savedSetup[i].slot.setAttachment(savedSetup[i].att);
      }
      for (let i = 0; i < savedA.length; i++) savedA[i].slot.color.a = savedA[i].a;
      for (let i = 0; i < savedBlend.length; i++) {
        if (savedBlend[i].slot.data) {
          savedBlend[i].slot.data!.blendMode = savedBlend[i].blend;
        }
      }
    }
  }

  private _draw(): void {
    const host = this.host;
    if (!host || !host.gl) return;
    const gl = host.gl;
    const spineObj = (window as unknown as { spine?: { Shader: { SAMPLER: string; MVP_MATRIX: string } } })
      .spine;
    if (!spineObj) return;

    const light = this.sceneConfig?.config?.light;
    let rimOn = !this._hideChara && light && light.rimEnabled !== false;
    try {
      if (config.section('app')?.rim === false) rimOn = false;
    } catch {}

    gl.clearColor(0.16, 0.11, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    host.shader.bind();
    host.shader.setUniformi(spineObj.Shader.SAMPLER, 0);
    host.shader.setUniform4x4f(spineObj.Shader.MVP_MATRIX, host.mvp.values);

    this._drawLayer(this.scene);

    if (this._hideChara) {
      host.shader.unbind();
      return;
    }

    this._drawLayer(this.avatar);

    if (rimOn && this.rim.ensureFbo(host) && this.rim.fbo) {
      host.shader.unbind();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.rim.fbo);
      gl.viewport(0, 0, this.rim.fboWidth, this.rim.fboHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      host.shader.bind();
      host.shader.setUniformi(spineObj.Shader.SAMPLER, 0);
      host.shader.setUniform4x4f(spineObj.Shader.MVP_MATRIX, host.mvp.values);
      this._drawLayer(this.avatar);
      host.shader.unbind();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, host.canvas.width, host.canvas.height);
      this.rim.blit(host, light);
    } else {
      host.shader.unbind();
    }
  }

  private get _panelFrac(): number {
    return 0;
  }
}
