// @wc-ignore-file

export const ALARM_KEY = 'ryza.alarms.v1';
export const TYPES = ['goodMorning', 'playWithMe', 'task', 'wellDone'] as const;
export const STYLES = ['normal', 'whisper'] as const;
export const WEEK = ['日', '一', '二', '三', '四', '五', '六'] as const;

export type AlarmType = (typeof TYPES)[number];
export type AlarmStyle = (typeof STYLES)[number];

export interface AlarmItem {
  id: string;
  time: string; // 'HH:MM'
  enabled: boolean;
  days?: number[];
  snoozeMin?: number;
  volume?: number;
  vibrate?: boolean;
  type: AlarmType | string;
  style?: AlarmStyle | string;
  _snoozeUntil?: string | null;
}

export interface AudioEnvelope {
  durationMs: number;
  windowMs?: number;
  envelope: number[];
}

export type VoiceClip = string | { src: string; [key: string]: unknown };
export type VoicePicker = (type: string, style: string, tod: string) => VoiceClip | null;
export type EnvPathResolver = (clip: VoiceClip) => string | null;

export function todForHour(h: number): 'night' | 'morning' | 'daytime' | 'evening' {
  if (h < 5) return 'night';
  if (h < 11) return 'morning';
  if (h < 17) return 'daytime';
  if (h < 20) return 'evening';
  return 'night';
}

export interface NativeAlarmBridge {
  isSupported?: () => boolean;
  schedule?: (alarmsJson: string) => boolean | Promise<boolean>;
  list?: () => string | Promise<string>;
  cancel?: (id: string) => boolean | Promise<boolean>;
}

declare global {
  interface Window {
    RyzaAlarm?: NativeAlarmBridge;
    RyzaAlarmNative?: {
      onFire?: (id: string) => void;
      sync?: () => void;
    };
  }
}

export class AlarmStore {
  items = $state<AlarmItem[]>([]);
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _fired: Record<string, boolean> = {};
  private voicePicker: VoicePicker | null = null;
  private envPathResolver: EnvPathResolver | null = null;
  private _native: NativeAlarmBridge | null = null;
  private _onFireCb: ((a: AlarmItem, clip?: VoiceClip | null) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.RyzaAlarmNative = {
        onFire: (id: string) => {
          const item = this.get(id);
          if (item) {
            const h = parseInt(String(item.time || '07:00').slice(0, 2), 10);
            const clip = this.pickClip(item.type, item.style || 'normal', todForHour(isNaN(h) ? 7 : h));
            this._onFireCb?.(item, clip);
          }
        },
        sync: () => {
          this.load();
        },
      };

      if (window.RyzaAlarm) {
        this.setNative(window.RyzaAlarm);
      }
    }
    this.load();
  }

  setNative(bridge: NativeAlarmBridge | null): void {
    this._native = bridge;
    this.pushNative();
  }

  nativeReady(): boolean {
    try {
      return Boolean(this._native && (!this._native.isSupported || this._native.isSupported()));
    } catch {
      return false;
    }
  }

  private _clipFor(a: AlarmItem): string {
    const h = parseInt(String(a.time || '07:00').slice(0, 2), 10);
    const clip = this.pickClip(a.type, a.style || 'normal', todForHour(isNaN(h) ? 7 : h));
    return typeof clip === 'string' ? clip : (clip?.src as string) || '';
  }

  pushNative(): boolean {
    if (!this.nativeReady() || typeof this._native?.schedule !== 'function') return false;
    try {
      const payload = JSON.stringify(
        this.items.map((a) => ({
          id: a.id,
          time: a.time,
          days: a.days || [],
          enabled: a.enabled !== false,
          type: a.type,
          style: a.style || 'normal',
          snoozeMin: a.snoozeMin == null ? 5 : a.snoozeMin,
          volume: a.volume == null ? 1 : a.volume,
          vibrate: a.vibrate !== false,
          audio: this._clipFor(a),
        }))
      );
      this._native.schedule(payload);
      return true;
    } catch {
      return false;
    }
  }

  pickClip(type: string, style: string, tod: string): VoiceClip | null {
    if (this.voicePicker) {
      return this.voicePicker(type, style, tod);
    }
    if (typeof window !== 'undefined') {
      const vb = (
        window as unknown as {
          VoiceBank?: { pick?: (t: string, s: string, tod: string) => VoiceClip | null };
        }
      ).VoiceBank;
      if (vb && typeof vb.pick === 'function') {
        return vb.pick(type, style, tod);
      }
    }
    return null;
  }

  setVoiceBank(picker: VoicePicker, resolver?: EnvPathResolver): void {
    this.voicePicker = picker;
    if (resolver) this.envPathResolver = resolver;
  }

  load(): AlarmItem[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(ALARM_KEY);
        this.items = raw ? JSON.parse(raw) : [];
      } else {
        this.items = [];
      }
    } catch {
      this.items = [];
    }

    if (!this.items.length && this.nativeReady() && typeof this._native?.list === 'function') {
      try {
        const remote = JSON.parse(String(this._native.list() || '[]')) as AlarmItem[];
        if (Array.isArray(remote) && remote.length) {
          this.items = remote;
          this.save();
        }
      } catch {}
    }
    return this.items;
  }

  save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ALARM_KEY, JSON.stringify(this.items));
    } catch {}
    this.pushNative();
  }

  add(a: Partial<AlarmItem>): AlarmItem {
    const item: AlarmItem = {
      id: a.id || `a${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: a.time || '08:00',
      enabled: a.enabled !== false,
      days: Array.isArray(a.days) ? a.days : [],
      snoozeMin: a.snoozeMin == null ? 5 : a.snoozeMin,
      volume: a.volume == null ? 1 : a.volume,
      vibrate: a.vibrate == null ? true : a.vibrate,
      type: a.type || 'goodMorning',
      style: a.style || 'normal',
      _snoozeUntil: a._snoozeUntil || null,
    };
    this.items.push(item);
    this.save();
    return item;
  }

  remove(id: string): void {
    this.items = this.items.filter((x) => x.id !== id);
    this.save();
  }

  toggle(id: string): void {
    const item = this.items.find((x) => x.id === id);
    if (item) {
      item.enabled = !item.enabled;
      this.save();
    }
  }

  get(id: string): AlarmItem | null {
    return this.items.find((x) => x.id === id) || null;
  }

  update(id: string, patch: Partial<AlarmItem>): void {
    const item = this.items.find((x) => x.id === id);
    if (item) {
      Object.assign(item, patch);
      this.save();
    }
  }

  start(onFire?: (a: AlarmItem, clip?: VoiceClip | null) => void): void {
    this._onFireCb = onFire || null;
    this.stop();
    this._timer = setInterval(() => {
      this._tick(onFire);
    }, 5000);
    this._tick(onFire);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _tick(onFire?: (a: AlarmItem, clip?: VoiceClip | null) => void, now: Date = new Date()): void {
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const dow = now.getDay();
    const stamp = now.toDateString() + ' ' + hhmm;

    this.items.forEach((a) => {
      if (!a.enabled) return;
      const t = a._snoozeUntil || a.time;
      if (t !== hhmm) return;
      if (!a._snoozeUntil && Array.isArray(a.days) && a.days.length && !a.days.includes(dow)) {
        return;
      }
      if (this._fired[stamp + a.id]) return;
      this._fired[stamp + a.id] = true;
      a._snoozeUntil = null;
      this.save();

      // Screen WakeLock request on alarm ring
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        navigator.wakeLock
          .request('screen')
          .then((lock) => {
            setTimeout(() => {
              lock.release().catch(() => {});
            }, 30000);
          })
          .catch(() => {});
      }

      // Web Notification fallback
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Ryza Alarm', {
            body: a.type === 'goodMorning' ? 'Good morning! Time to wake up.' : 'Alarm ringing!',
            icon: '/favicon.ico',
          });
        } catch {}
      }

      const clip = this.pickClip(a.type, a.style || 'normal', todForHour(now.getHours()));
      onFire && onFire(a, clip);
    });
  }

  snooze(a: AlarmItem): void {
    const min = Math.max(1, parseInt(String(a.snoozeMin), 10) || 5);
    const d = new Date();
    d.setMinutes(d.getMinutes() + min);
    a._snoozeUntil = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    this.save();
  }

  async loadEnv(clip: VoiceClip): Promise<AudioEnvelope | null> {
    let p: string | null = null;
    if (this.envPathResolver) {
      p = this.envPathResolver(clip);
    } else if (typeof window !== 'undefined') {
      const vb = (window as unknown as { VoiceBank?: { envPath?: (c: VoiceClip) => string | null } })
        .VoiceBank;
      if (vb && typeof vb.envPath === 'function') {
        p = vb.envPath(clip);
      }
    }
    if (!p && typeof clip === 'string') {
      p = clip.replace(/\.[^.]+$/, '.env.json');
    }
    if (!p) return null;
    try {
      const r = await fetch(p);
      return r.ok ? ((await r.json()) as AudioEnvelope) : null;
    } catch {
      return null;
    }
  }
}

export const alarm = new AlarmStore();
export const Alarm = alarm;
export default alarm;
