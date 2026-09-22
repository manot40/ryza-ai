// @wc-ignore-file
import { config, type StateWelcomeConfig } from './config.svelte';
import { game } from './game.svelte';

export interface WelcomeStep {
  id: keyof StateWelcomeConfig;
  icon: string;
  titleKey: string;
  descKey: string;
}

export const WELCOME_STEPS: ReadonlyArray<WelcomeStep> = [
  { id: 'talk', icon: 'icon_scroll', titleKey: 'wm.talk.title', descKey: 'wm.talk.desc' },
  { id: 'map', icon: 'icon_clock', titleKey: 'wm.map.title', descKey: 'wm.map.desc' },
  { id: 'alarm', icon: 'icon_chest', titleKey: 'wm.alarm.title', descKey: 'wm.alarm.desc' },
  { id: 'skin', icon: 'sparkle', titleKey: 'wm.skin.title', descKey: 'wm.skin.desc' },
  { id: 'quest', icon: 'icon_scroll', titleKey: 'wm.quest.title', descKey: 'wm.quest.desc' },
];

export interface WelcomeMission {
  id: string;
  activity: string;
  need: number;
}

export interface WelcomeGroup {
  id: string;
  title: string;
  day: number;
  missions: WelcomeMission[];
}

export const WM_GROUPS: WelcomeGroup[] = [
  {
    id: 'crf_msng_001',
    title: 'Step 1',
    day: 0,
    missions: [
      { id: 'crf_msn_001_0001', activity: 'mission_clear', need: 3 },
      { id: 'crf_msn_001_0002', activity: 'touch', need: 1 },
      { id: 'crf_msn_001_0003', activity: 'talk', need: 5 },
      { id: 'crf_msn_001_0004', activity: 'login_bonus', need: 1 },
    ],
  },
  {
    id: 'crf_msng_002',
    title: 'Step 2',
    day: 3,
    missions: [
      { id: 'crf_msn_002_0001', activity: 'mission_clear', need: 3 },
      { id: 'crf_msn_002_0002', activity: 'touch', need: 1 },
      { id: 'crf_msn_002_0003', activity: 'talk', need: 5 },
      { id: 'crf_msn_002_0004', activity: 'login_bonus', need: 3 },
    ],
  },
  {
    id: 'crf_msng_003',
    title: 'Step 3',
    day: 5,
    missions: [
      { id: 'crf_msn_003_0001', activity: 'mission_clear', need: 3 },
      { id: 'crf_msn_003_0002', activity: 'touch', need: 1 },
      { id: 'crf_msn_003_0003', activity: 'talk', need: 5 },
      { id: 'crf_msn_003_0004', activity: 'login_bonus', need: 5 },
    ],
  },
];

export const WM_GROUP_REWARD = { money: 300, exp: 40 };

export class WelcomeStore {
  readonly groups = WM_GROUPS;

  get steps(): ReadonlyArray<WelcomeStep> {
    return WELCOME_STEPS;
  }

  isOpen(g: WelcomeGroup): boolean {
    return this.dayCount() >= g.day;
  }

  activity(kind: string): number {
    const act = game.welcome_activity;
    return Number(act?.[kind] || 0);
  }

  markActivity(kind: string, count: number = 1): number {
    const n = Math.max(1, Number(count) || 1);
    if (!game.welcome_activity) {
      game.welcome_activity = {};
    }
    const current = Number(game.welcome_activity[kind] || 0);
    game.welcome_activity[kind] = current + n;
    game.save();
    return game.welcome_activity[kind];
  }

  dayCount(): number {
    try {
      return Number(config.get('state')?.welcome_day || 0);
    } catch {
      return 0;
    }
  }

  bumpDay(n: number): number {
    const cur = this.dayCount();
    const next = Math.max(cur, Number(n) || 0);
    if (next !== cur) {
      config.setState('welcome_day', next);
    }
    return next;
  }

  missionDone(m: WelcomeMission): boolean {
    return this.activity(m.activity) >= m.need;
  }

  groupDone(g: WelcomeGroup): boolean {
    return g.missions.every((m) => this.missionDone(m));
  }

  groupClaimed(g: WelcomeGroup): boolean {
    const c =
      (config.get('state') as unknown as { welcome_claimed?: Record<string, boolean> })?.welcome_claimed ||
      {};
    return Boolean(c[g.id]);
  }

  claimGroup(g: WelcomeGroup): { money: number; exp: number } | null {
    if (!this.groupDone(g) || this.groupClaimed(g)) return null;
    const c =
      (config.get('state') as unknown as { welcome_claimed?: Record<string, boolean> })?.welcome_claimed ||
      {};
    c[g.id] = true;
    config.setState('welcome_claimed', c);
    game.addMoney(WM_GROUP_REWARD.money);
    game.addExp(WM_GROUP_REWARD.exp);
    game.remember(`ウェルカムミッション ${g.title} クリア`);
    return WM_GROUP_REWARD;
  }

  // Backwards compatible milestone methods
  mark(id: keyof StateWelcomeConfig | string): void {
    const w = config.get('state')?.welcome;
    if (w && id in w && w[id as keyof StateWelcomeConfig]) return;
    const curWelcome = w || { talk: false, map: false, alarm: false, skin: false, quest: false };
    config.setState('welcome', { ...curWelcome, [id]: true });
  }

  milestone(id: string): void {
    this.mark(id);
  }

  done(id: keyof StateWelcomeConfig | string): boolean {
    const w = config.get('state')?.welcome;
    return Boolean(w && id in w && w[id as keyof StateWelcomeConfig]);
  }

  allDone(): boolean {
    return WELCOME_STEPS.every((s) => this.done(s.id));
  }
}

export const welcome = new WelcomeStore();
export const Welcome = welcome;
export default welcome;
