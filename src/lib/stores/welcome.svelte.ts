// @wc-ignore-file
import { config, type StateWelcomeConfig } from './config.svelte';

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

export class WelcomeStore {
  get steps(): ReadonlyArray<WelcomeStep> {
    return WELCOME_STEPS;
  }

  mark(id: keyof StateWelcomeConfig | string): void {
    const w = config.section('state')?.welcome;
    if (w && id in w && w[id as keyof StateWelcomeConfig]) return;
    config.set(`state.welcome.${id}`, true);
  }

  done(id: keyof StateWelcomeConfig | string): boolean {
    const w = config.section('state')?.welcome;
    return Boolean(w && id in w && w[id as keyof StateWelcomeConfig]);
  }

  allDone(): boolean {
    return WELCOME_STEPS.every((s) => this.done(s.id));
  }
}

export const welcome = new WelcomeStore();
export const Welcome = welcome;
export default welcome;
