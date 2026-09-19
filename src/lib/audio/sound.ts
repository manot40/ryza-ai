import { clamp, lerp } from '../util';
import { config } from '../stores/config.svelte';
import { getVoiceLocale } from './voicebank';

export const BGM = {
  opening: 'assets/audio/bgm/bgm_opening.m4a',
  world: 'assets/audio/bgm/bgm_world_map.m4a',
} as const;

export const SE_FALLBACK: Record<string, string> = {
  quest_clear: 'assets/audio/se/se_quest_clear.m4a',
  skin_change: 'assets/audio/se/se_skin_change.m4a',
  touch_start: 'assets/audio/se/se_touch_start.m4a',
};

export type AudioRoute = 'title' | 'talk' | 'world' | 'prologue';

export interface SoundCatalogs {
  ambientFiles?: string[];
  tapFiles?: string[];
  seFiles?: string[];
}

function makeLoop(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  const a = new Audio();
  a.loop = true;
  a.preload = 'auto';
  a.crossOrigin = 'anonymous';
  return a;
}

function fadeVolume(el: HTMLAudioElement, to: number, ms: number = 280, done?: () => void): void {
  const from = Number(el.volume) || 0;
  const t0 = performance.now();
  const dur = Math.max(40, ms);
  const targetEl = el as HTMLAudioElement & { _fadeRaf?: number };

  if (targetEl._fadeRaf) cancelAnimationFrame(targetEl._fadeRaf);

  function step(now: number): void {
    const u = clamp((now - t0) / dur, 0, 1);
    targetEl.volume = clamp(lerp(from, to, u), 0, 1);
    if (u < 1) {
      targetEl._fadeRaf = requestAnimationFrame(step);
    } else {
      targetEl.volume = to;
      done?.();
    }
  }
  step(t0);
}

function pad3(num: number): string {
  return num < 10 ? `00${num}` : num < 100 ? `0${num}` : `${num}`;
}

export class SoundManager {
  bgm: HTMLAudioElement | null = makeLoop();
  amb: HTMLAudioElement | null = makeLoop();
  private _se: HTMLAudioElement | null = null;
  private _tap: HTMLAudioElement | null = null;

  ambientFiles: string[] = [];
  tapFiles: string[] = [];
  seFiles: string[] = [];

  private _loopSrc = { bgm: '', ambient: '' };
  private _sceneKeys: string[] = [];
  private _route: AudioRoute = 'title';
  private _stageId = '';
  private _tod = 'aft';
  private _bgId = '';
  private _unlocked = false;
  private _bindUnlock = false;
  private _unlocking: Promise<void> | null = null;

  init(catalogs?: SoundCatalogs): Promise<this> {
    if (typeof window === 'undefined') return Promise.resolve(this);
    this._listenUnlock();
    this._listenLifecycle();

    if (catalogs) {
      this.ambientFiles = catalogs.ambientFiles || [];
      this.tapFiles = catalogs.tapFiles || [];
      this.seFiles = catalogs.seFiles || [];
      return Promise.resolve(this);
    }

    return Promise.all([
      fetch('/assets/_index/ambient.json').then((r) => r.json()),
      fetch('/assets/_index/tap_voice.json').then((r) => r.json()),
      fetch('/assets/_index/se.json')
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([amb, tap, se]) => {
        this.ambientFiles = (amb as string[]) || [];
        this.tapFiles = (tap as string[]) || [];
        this.seFiles = (se as string[]) || [];
        return this;
      })
      .catch(() => this);
  }

  setCatalog(sceneKeys: string[]): void {
    this._sceneKeys = (sceneKeys || []).slice().sort();
  }

  setPlace(stageId?: string, tod?: string, bgId?: string): void {
    this._stageId = stageId || this._stageId;
    this._tod = tod || this._tod;
    this._bgId = bgId || this._bgId;
    if (this._route === 'talk' || this._route === 'world') {
      this._applyRoute();
    }
  }

  setRoute(kind: AudioRoute): void {
    if (!kind) return;
    this._route = kind;
    this._applyRoute();
  }

  private _listenUnlock(): void {
    if (this._bindUnlock || typeof document === 'undefined') return;
    this._bindUnlock = true;
    const once = (): void => {
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('keydown', once, true);
      this.unlock();
    };
    document.addEventListener('pointerdown', once, true);
    document.addEventListener('keydown', once, true);
  }

  private _listenLifecycle(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        try {
          this.bgm?.pause();
        } catch {}
        try {
          this.amb?.pause();
        } catch {}
      } else if (this._unlocked) {
        this._applyRoute();
      }
    });
  }

  unlock(): Promise<void> {
    if (this._unlocked) {
      this._applyRoute();
      return Promise.resolve();
    }
    if (this._unlocking) return this._unlocking;
    if (typeof Audio === 'undefined') {
      this._unlocked = true;
      return Promise.resolve();
    }

    const ping = new Audio(BGM.opening);
    ping.muted = true;
    ping.volume = 0;
    this._unlocking = ping
      .play()
      .then(() => {
        try {
          ping.pause();
          ping.removeAttribute('src');
        } catch {}
        this._unlocked = true;
        this._unlocking = null;
        this._applyRoute();
      })
      .catch(() => {
        this._unlocked = true;
        this._unlocking = null;
        this._applyRoute();
      });
    return this._unlocking;
  }

  private _gain(bus: 'bgm' | 'ambient' | 'voice' | 'se'): number {
    const app = config.section('app') || {};
    const ch = config.section('audio') || {};
    const master = Number(app.volume != null ? app.volume : 0.9);
    const g = Number(ch[bus] != null ? ch[bus] : 1);
    return clamp(master * g, 0, 1);
  }

  private _playLoop(
    el: HTMLAudioElement | null,
    src: string,
    bus: 'bgm' | 'ambient',
    duck: number = 1
  ): void {
    if (!el) return;
    const vol = this._gain(bus) * (duck != null ? duck : 1);
    const key = bus === 'bgm' ? 'bgm' : 'ambient';

    if (!src) {
      this._loopSrc[key] = '';
      if (!el.paused) {
        fadeVolume(el, 0, 220, () => {
          el.pause();
          el.removeAttribute('src');
        });
      } else {
        el.pause();
        el.removeAttribute('src');
      }
      return;
    }

    if (this._loopSrc[key] === src) {
      if (el.paused && this._unlocked) {
        const resume = el.play();
        if (resume && resume.catch) resume.catch(() => {});
      }
      fadeVolume(el, vol, 160);
      return;
    }

    this._loopSrc[key] = src;
    el.muted = false;
    el.src = src;
    el.volume = 0;
    if (!this._unlocked) return;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    fadeVolume(el, vol, 320);
  }

  private _ambientSrc(): string {
    const files = this.ambientFiles;
    if (!files.length) return '';
    const keys = this._sceneKeys;
    const bg = this._bgId || this._stageId;
    let idx = keys.length ? Math.max(0, keys.indexOf(bg)) : 0;
    if (idx < 0) idx = 0;

    const band = this._tod === 'ngt' || this._tod === 'eve' ? 'night' : 'day';
    const n = (idx % 47) + 1;
    let want = `amb_${pad3(n)}_${band}.m4a`;
    let hit = files.find((p) => p.includes(want));
    if (!hit) {
      want = `amb_${pad3(n)}_day.m4a`;
      hit = files.find((p) => p.includes(want));
    }
    if (!hit) hit = files[idx % files.length];
    return hit || '';
  }

  private _applyRoute(): void {
    const r = this._route;
    if (r === 'title') {
      this._playLoop(this.bgm, BGM.opening, 'bgm');
      this._playLoop(this.amb, '', 'ambient');
      return;
    }
    if (r === 'prologue') {
      this._playLoop(this.bgm, '', 'bgm');
      this._playLoop(this.amb, '', 'ambient');
      return;
    }
    if (r === 'world') {
      this._playLoop(this.bgm, BGM.world, 'bgm');
      this._playLoop(this.amb, this._ambientSrc(), 'ambient', 0.35);
      return;
    }
    // 'talk' and default: location ambient, no BGM
    this._playLoop(this.bgm, '', 'bgm');
    this._playLoop(this.amb, this._ambientSrc(), 'ambient');
  }

  applyVolumes(): void {
    if (!this.bgm || !this.amb) return;
    if (this._route === 'world') {
      this.bgm.volume = this._gain('bgm');
      this.amb.volume = this._gain('ambient') * 0.35;
    } else if (this._route === 'title') {
      this.bgm.volume = this._gain('bgm');
    } else {
      this.amb.volume = this._gain('ambient');
      this.bgm.volume = this._gain('bgm');
    }
  }

  se(name: string): void {
    if (typeof Audio === 'undefined') return;
    let src = SE_FALLBACK[name];
    if (!src && this.seFiles.length) {
      src = this.seFiles.find((p) => p.includes(`se_${name}`) || p.includes(`/${name}`)) || '';
    }
    if (!src) return;
    try {
      if (this._se) this._se.pause();
    } catch {}
    this._se = new Audio(src);
    this._se.volume = this._gain('se');
    this._se.play().catch(() => {});
  }

  tapVoice(overlayId?: string): void {
    if (typeof Audio === 'undefined') return;
    const loc = getVoiceLocale().tap;
    const style = config.section('state')?.mode === 'asmr' ? 'asmr' : 'normal';
    const key = (overlayId || '').replace(/_active$/, '').replace(/_idle$/, '');
    if (!key) return;

    let cands = this.tapFiles.filter(
      (p) => p.includes(`/${loc}/`) && p.includes(key) && p.includes(`_${style}_`)
    );
    if (!cands.length) {
      cands = this.tapFiles.filter((p) => p.includes('/jp/') && p.includes(key));
    }
    if (!cands.length) return;

    const src = cands[Math.floor(Math.random() * cands.length)];
    try {
      if (this._tap) this._tap.pause();
    } catch {}
    this._tap = new Audio(src);
    this._tap.volume = this._gain('voice');
    this._tap.play().catch(() => {});
  }

  prologue(n: number): string {
    const loc = getVoiceLocale().prologue;
    const pad = n < 10 ? `0${n}` : String(n);
    return `assets/audio/prologue/${loc}/prologue_${pad}.m4a`;
  }
}

export const sound = new SoundManager();
