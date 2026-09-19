// Spine 2D Character and Stage Avatar Engine
/* eslint-disable @typescript-eslint/no-explicit-any */
import { clamp, lerp, weighted } from '../../util';
import { config } from '../../stores/config.svelte';
import { makeHost, makeLayer } from './host';
import { getCamParams, coverFor, REF_ZOOM, REF_H } from './camera';
import { RIM_VS, RIM_FS } from './shader';
import type { SpineHost, SpineLayer, CameraView, CamParams, SkinEntry } from './types';

const FALLBACK_LIP = 'facial_mouth_002_scrub_02';
const FALLBACK_IDLE = [
  'motion_A_001_idle',
  'motion_A_002_idle',
  'motion_A_005_idle',
  'motion_A_006_idle',
  'motion_A_024_idle',
  'motion_A_025_idle',
];

function pickAnim(data: any, name?: string | null): string | null {
  if (!name || !data) return null;
  if (data.findAnimation(name)) return name;
  if (!/_idle$/.test(name) && data.findAnimation(`${name}_idle`)) return `${name}_idle`;
  if (!/_active$/.test(name) && data.findAnimation(`${name}_active`)) return `${name}_active`;
  const stripped = name.replace(/_(idle|active)$/, '');
  if (stripped !== name && data.findAnimation(stripped)) return stripped;
  return null;
}

export class AvatarEngine {
  host: SpineHost | null = null;
  avatar: SpineLayer | null = null;
  scene: SpineLayer | null = null;

  gesture: any = null;
  postureCam: any = null;
  sceneConfig: any = null;
  skinsIndex: SkinEntry[] = [];

  private _loadedSkelId = '';
  private _atlasVariant = 'default';
  private _variantMiss: Record<string, number> = {};
  private _emotion = 'neutral';
  private _attitude = 'agree';
  private _talking = false;
  private _idleTimer = 0;
  private _idleGap = 6;
  private _blinkTimer = 0;
  private _last = 0;
  private _eyeOpen: string | null = null;
  private _eyeClosed: string | null = null;
  private _mouthIdle: string | null = null;
  private _lipSync = FALLBACK_LIP;

  _view: CameraView = { left: 0, bottom: 0, worldW: 1, worldH: 1, cssW: 1, cssH: 1 };
  private _viewAuth: CamParams | null = null;
  private _headLocal: number | null = null;
  private _midBind: { name: string; x: number; y: number } | null = null;
  private _env: { samples: number[]; duration: number; window: number; t: number } | null = null;
  private _look = { yaw: 0, pitch: 0, roll: 0, ty: 0, tp: 0, tr: 0, hold: 2, trans: 0.8, t: 0 };
  private _pointer = { x: 0, y: 0, on: false };
  private _ptrSm = { x: 0, y: 0 };
  private _ptrInit = false;
  private _lipOpen = 0;
  private _lipHold = 0;
  private _drivers: Record<string, any> | null = null;
  private _fxOn = false;
  private _fxKey = '';
  private _fft: Uint8Array | null = null;
  private _poseType = '';
  private _sittingId = 'sitting_normal';
  private _armG: any = null;
  private _torsoG: any = null;
  private _legG: any = null;
  private _legLG: any = null;
  private _legRG: any = null;
  private _addMuted = false;
  private _mutedSnap: any = null;
  private _hideChara = false;
  private _skelHash = '';
  private _lookHist: { t: number; y: number; p: number; r: number }[] = [];
  private _lookClock = 0;
  private _fbo: WebGLFramebuffer | null = null;
  private _fboTex: WebGLTexture | null = null;
  private _fboW = 0;
  private _fboH = 0;
  private _rimShader: any = null;
  private _quadBuf: WebGLBuffer | null = null;
  private _typeMap: Record<string, string[]> | null = null;
  private _lookMul = 1;
  private _faceRef: { x: number; y: number } | null = null;
  private _pokeMouthHold = false;
  private _fxPick: { key: string; names: string[] } | null = null;
  private _lookCyc: { band: string | null; spec: any; left: number } | null = null;
  private _ptrW = 0;
  private _ptrN = 0;
  private _dt = 0;
  private _blinkMode = 'blink';
  private _closedDur = 0;
  private _closedHold = 0;
  private _exprBand = '';
  private _rollSm = 0;
  private _tension = 0;
  private _exitMixCache: Record<string, number> | null = null;
  private _aimSm: Record<string, [number, number]> = {};
  private _panelFrac = 0;
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
    if (this._fbo && this.host?.gl) {
      this.host.gl.deleteFramebuffer(this._fbo);
      this._fbo = null;
    }
    if (this._fboTex && this.host?.gl) {
      this.host.gl.deleteTexture(this._fboTex);
      this._fboTex = null;
    }
    if (this._quadBuf && this.host?.gl) {
      this.host.gl.deleteBuffer(this._quadBuf);
      this._quadBuf = null;
    }
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
    const cfg = this.sceneConfig && this.sceneConfig.config;
    return (cfg && cfg.midgroundPostures) || [];
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
    else if (ov && typeof ov === 'object') add(ov[page] || ov[base] || ov['*']);
    add(`${dir}${base}${v}${ext}`);
    add(`${dir}${base}_${v}${ext}`);
    return out;
  }

  setAtlasVariant(name: string, cb?: () => void): void {
    this._atlasVariant = this._cleanVariant(name) ? this._cleanVariant(name) : 'default';
    this._applyAtlasVariant(cb);
  }

  private _disposeVariantTex(L: SpineLayer | null): void {
    if (!L || !L._atlasVarTex) return;
    L._atlasVarTex.forEach((t) => {
      if (t && t.dispose)
        try {
          t.dispose();
        } catch {}
    });
    L._atlasVarTex = null;
    L._atlasVarName = '';
  }

  private _loadPageImage(L: SpineLayer, url: string, cb: (tex: any) => void): void {
    const spineObj = (window as unknown as { spine?: any }).spine;
    if (!L || !url || typeof Image === 'undefined' || !spineObj || !spineObj.GLTexture) {
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

  private _tryPageUrls(L: SpineLayer, urls: string[], cb: (tex: any) => void): void {
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
      done();
      return;
    }
    if (L._atlasVarName === variant && L._atlasVarTex && L._atlasVarTex.length === pages.length) {
      for (let j = 0; j < pages.length; j++) {
        if (L._atlasVarTex[j]) pages[j].setTexture(L._atlasVarTex[j]);
      }
      done();
      return;
    }
    let pending = pages.length;
    const loaded = new Array(pages.length);
    let any = false;
    const finish = () => {
      pending--;
      if (pending > 0) return;
      if (!any) {
        done();
        return;
      }
      this._disposeVariantTex(L);
      L._atlasVarName = variant;
      L._atlasVarTex = loaded;
      for (let k = 0; k < pages.length; k++) {
        if (loaded[k]) pages[k].setTexture(loaded[k]);
      }
      done();
    };
    pages.forEach((page, idx) => {
      const urls = this.variantPageUrls(L._atlasUrl || '', page.name, variant);
      this._tryPageUrls(L, urls, (tex) => {
        if (tex) {
          loaded[idx] = tex;
          any = true;
        }
        finish();
      });
    });
  }

  private _camParams(postureKey?: string, asmr?: boolean): CamParams {
    const L = this.scene || this.avatar;
    return getCamParams(
      postureKey || this.postureKey(),
      asmr ?? this._asmrOn(),
      this.postureCam,
      L?.cssW || 0,
      L?.cssH || 0
    );
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
      win = { left, bottom, worldW: w, worldH: h } as CamParams;
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
    const spineObj = (window as unknown as { spine?: any }).spine;
    if (!spineObj) return;
    try {
      const sk = new spineObj.Skeleton(L.data);
      sk.updateWorldTransform(spineObj.Physics.pose);
      const b = sk.findBone('head');
      if (b) this._headLocal = b.worldY;
    } catch {}
  }

  private _placeCharacter(): void {
    const L = this.avatar;
    const S = this.scene;
    if (!L || !L.skeleton) return;
    const cam = this._camParams(this._loadedPosture());
    let x = cam.offsetX;
    let y = cam.offsetY;
    if (S && S.skeleton) {
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
    if (!L || !L.skeleton) return;
    const spineObj = (window as unknown as { spine?: any }).spine;
    if (!spineObj) return;
    try {
      L.skeleton.setToSetupPose();
      L.skeleton.updateWorldTransform(spineObj.Physics.none);
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
    const spineObj = (window as unknown as { spine?: any }).spine;
    if (!spineObj) {
      done(new Error('Spine WebGL runtime not loaded'));
      return;
    }
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
          const data = bin.readSkeletonData(a.require(skelUrl));
          L.data = data;
          L.skeleton = new spineObj.Skeleton(data);
          L.state = new spineObj.AnimationState(new spineObj.AnimationStateData(data));
          L.state.data.defaultMix = 0.12;
          L._cover = null;
          L._coverDone = false;
          if (L === this.avatar) {
            this._skelHash = String(data.hash || '').toLowerCase();
            L._atlas = atlas;
            L._atlasUrl = atlasUrl;
            L._atlasBaseTex = null;
          }
          L.ready = true;
          done(null);
        } catch (e: any) {
          done(e);
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
      L.ready = false;
      const gP = s.gesture ? fetch(s.gesture).then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null);
      gP.then((g) => {
        this.gesture = g;
        this._loadSpine(L, s.skel!, s.atlas!, (err) => {
          if (err) {
            cb?.(err);
            return;
          }
          this._loadedSkelId = s.id;
          this._sittingId = this._sittingFromPosture();
          this._measureHeadLocal();
          this.setEmotion(this._emotion, this._attitude, true);
          this._playWind();
          this.resize();
          if (this._cleanVariant(this._atlasVariant)) this._applyAtlasVariant();
          cb?.(null);
        });
      }).catch((e: any) => cb?.(e));
    };

    if (this.skinsIndex.length) apply(this.skinsIndex);
    else
      fetch('/assets/_index/skins.json')
        .then((r) => r.json())
        .then(apply)
        .catch((e: any) => cb?.(e));
  }

  loadScene(stageId: string, tod: string, cb?: (err: Error | null) => void): void {
    const L = this.scene;
    if (!L) return;
    fetch('/assets/_index/scenes.json')
      .then((r) => r.json())
      .then((scenes) => {
        const stage = scenes[stageId];
        const entry = stage && (stage[tod] || stage[Object.keys(stage)[0]]);
        if (!entry) throw new Error(`没有这个场景：${stageId}/${tod}`);
        L.ready = false;
        const cfgP = entry.config
          ? fetch(entry.config)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);
        return cfgP.then((cfg) => {
          this.sceneConfig = cfg;
          this._loadSpine(L, entry.skel, entry.atlas, (err) => {
            if (err) {
              cb?.(err);
              return;
            }
            const fade = pickAnim(L.data, 'anm_fade_in') || pickAnim(L.data, 'anm_fade_in_all');
            if (fade) {
              const tr = L.state.setAnimation(0, fade, false);
              tr.mixDuration = 0;
            }
            this._cacheMidBind(L);
            this.resize();
            const outfit = config.section('state')?.skin || 'crf_skn_002_0001';
            this.loadSkin(outfit, cb);
          });
        });
      })
      .catch((e: any) => cb?.(e));
  }

  private _pc(): any {
    return (this.gesture && this.gesture.projectConfig) || {};
  }

  private _profile(emotion: string): any {
    const g = this.gesture;
    const map = g?.emotionalGesture?.EmotionProfilesV4;
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

  private _intensity(prof: any): any {
    const ip = prof?.intensityProfiles;
    if (!ip) return null;
    return ip[this._intensityBand()] || ip.normal || ip.strong || ip.weak || null;
  }

  private _sittingFromPosture(): string {
    const p = this._loadedPosture() || '';
    if (/agura/i.test(p)) return 'sitting_agura';
    if (/stand/i.test(p)) return 'standing';
    return 'sitting_normal';
  }

  private _idlesForType(data: any, poseType: string): { name: string; w: number }[] {
    const sit = this._sittingId || 'sitting_normal';
    const prof = this._profile(this._emotion);
    const inten = this._intensity(prof);
    const poses = (inten && inten.basePoses) || [];
    const typed = poses
      .filter((p: any) => {
        if (!p || !p.id || !pickAnim(data, p.id)) return false;
        const sits = p.applicableSittingIds;
        if (sits && sits.length && !sits.includes(sit)) return false;
        const ids = p.poseTypeIds || [];
        if (!poseType) return true;
        return ids.length > 0 && ids.includes(poseType);
      })
      .map((p: any) => {
        const w = Number(p.weight);
        return { name: pickAnim(data, p.id)!, w: w > 0 ? w : 1 };
      })
      .filter((x: any) => Boolean(x.name));
    if (typed.length) return typed;
    return FALLBACK_IDLE.map((n) => {
      const hit = pickAnim(data, n);
      return hit ? { name: hit, w: 1 } : null;
    }).filter(Boolean) as { name: string; w: number }[];
  }

  private _playWind(): void {
    const L = this.avatar;
    if (!L || !L.data || !L.state) return;
    const spineObj = (window as unknown as { spine?: any }).spine;
    const prefix = this._pc().windAnimationPrefix || 'effect_wind';
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

  setEmotion(emotion: string, attitude: string, immediate?: boolean): void {
    this._emotion = emotion;
    this._attitude = attitude;
    const L = this.avatar;
    if (!L || !L.ready || !L.state) return;

    const prof = this._profile(emotion);
    const inten = this._intensity(prof);
    this._lipSync = prof?.lipSyncScrubClip || FALLBACK_LIP;

    const cur0 = L.state.getCurrent(0);
    if (!cur0 || !cur0.animation) {
      const idles = this._idlesForType(L.data, 'posetype_01_freehand');
      if (idles.length) {
        const pi = idles[0];
        if (pi?.name) {
          const tr0 = L.state.setAnimation(0, pi.name, true);
          tr0.mixDuration = 0;
        }
      }
    }

    this._applyFace(Boolean(immediate));
  }

  private _applyFace(immediate: boolean): void {
    const L = this.avatar;
    if (!L || !L.ready || !L.state) return;
    const st = L.state;
    const data = L.data;
    const inten = this._intensity(this._profile(this._emotion));
    const mixEye = immediate ? 0 : inten?.mixDurationEye || 0.25;
    const mixBrow = immediate ? 0 : inten?.mixDurationEyebrow || 0.25;

    this._eyeOpen = pickAnim(data, inten?.eyeBase);
    this._eyeClosed = pickAnim(data, this._pc().closedEyeAnimation);
    const brow = pickAnim(data, inten?.eyebrowBase);
    this._mouthIdle = pickAnim(data, inten?.mouthBase);

    if (this._eyeOpen) st.setAnimation(2, this._eyeOpen, true).mixDuration = mixEye;
    if (brow) st.setAnimation(3, brow, true).mixDuration = mixBrow;
    if (!this._talking && this._mouthIdle && !this._pokeMouthHold) {
      st.setAnimation(4, this._mouthIdle, true).mixDuration = immediate ? 0 : 0.25;
    }
  }

  setTalking(on: boolean): void {
    const L = this.avatar;
    this._talking = on;
    if (this._talking) this._tension = 1;
    if (!on) this._env = null;
    if (!L || !L.ready || !L.state) return;

    const lip = pickAnim(L.data, this._lipSync) || pickAnim(L.data, FALLBACK_LIP);
    if (this._talking && lip) {
      L.state.setAnimation(4, lip, true).mixDuration = 0.12;
    } else if (this._mouthIdle && !this._pokeMouthHold) {
      L.state.setAnimation(4, this._mouthIdle, true).mixDuration = 0.2;
    }
  }

  setTalkingEnvelope(env: { envelope: number[]; durationMs?: number; windowMs?: number }): void {
    this.setTalking(true);
    if (!env || !env.envelope || !env.envelope.length) return;
    this._env = {
      samples: env.envelope,
      duration: (Number(env.durationMs) || 0) / 1000,
      window: (Number(env.windowMs) || 20) / 1000,
      t: 0,
    };
  }

  setHidden(on: boolean): void {
    this._hideChara = Boolean(on);
  }

  poke(partName: string): string | null {
    const L = this.avatar;
    if (!L || !L.ready || !partName) return null;
    const reactions = this.gesture?.emotionalGesture?.TapReactions || [];
    const list = reactions.filter((r: any) => r.PartName === partName);
    if (!list.length) return null;
    const pick = list[Math.floor(Math.random() * list.length)];
    const anim = pickAnim(L.data, pick.OverlayID);
    if (!anim) return null;

    const enter = 0.15;
    L.state.setEmptyAnimation(4, 0.08);
    this._pokeMouthHold = true;
    const tr = L.state.setAnimation(6, anim, false);
    tr.mixDuration = enter;
    L.state.addEmptyAnimation(6, 0.3, 0);
    return pick.OverlayID;
  }

  hitPartAt(cssX: number, cssY: number): string | null {
    const L = this.avatar;
    if (!L || !L.ready || !L.skeleton) return null;
    const w = this.screenToWorld(cssX, cssY);
    // Basic hit bounds check against character center
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
    this._pointer.x = x;
    this._pointer.y = y;
    this._pointer.on = on;
  }

  private _loop(now: number): void {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._loop);
    const dt = this._last ? Math.min((now - this._last) / 1000, 0.05) : 0;
    this._last = now;

    const spineObj = (window as unknown as { spine?: any }).spine;
    if (!spineObj) return;

    if (this.scene && this.scene.ready && this.scene.skeleton) {
      this.scene.state.update(dt);
      this.scene.state.apply(this.scene.skeleton);
      this.scene.skeleton.update(dt);
      this.scene.skeleton.updateWorldTransform(spineObj.Physics.none);
    }

    if (this.avatar && this.avatar.ready && this.avatar.skeleton) {
      this._placeCharacter();
      this.avatar.state.update(dt);
      this.avatar.state.apply(this.avatar.skeleton);
      this.avatar.skeleton.update(dt);
      this.avatar.skeleton.updateWorldTransform(spineObj.Physics.update);
    }

    this._draw();
  }

  private _draw(): void {
    const host = this.host;
    if (!host || !host.gl) return;
    const gl = host.gl;
    const spineObj = (window as unknown as { spine?: any }).spine;

    gl.clearColor(0.16, 0.11, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    host.shader.bind();
    host.shader.setUniformi(spineObj.Shader.SAMPLER, 0);
    host.shader.setUniform4x4f(spineObj.Shader.MVP_MATRIX, host.mvp.values);

    if (this.scene && this.scene.ready && this.scene.skeleton) {
      host.sr.draw(host.batcher, this.scene.skeleton);
    }

    if (!this._hideChara && this.avatar && this.avatar.ready && this.avatar.skeleton) {
      host.sr.draw(host.batcher, this.avatar.skeleton);
    }

    host.shader.unbind();
  }
}
