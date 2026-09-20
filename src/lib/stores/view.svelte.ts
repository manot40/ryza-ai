// @wc-ignore-file

import { sound } from '$lib/audio/sound';

export const VIEWS = [
  'talk',
  'world',
  'quest',
  'daily',
  'alarm',
  'chara',
  'skin',
  'memory',
  'settings',
  'welcome',
] as const;

export type AppView = (typeof VIEWS)[number];

export class ViewStore {
  activeView = $state<AppView>('talk');
  drawerOpen = $state(false);
  sideMenuOpen = $state(false);

  setView(view: AppView | (string & {})) {
    this.activeView = view as AppView;
    this.drawerOpen = false;
    this.sideMenuOpen = false;
    sound.setRoute(view === 'world' ? 'world' : 'talk');
  }
}

export const viewStore = new ViewStore();
export default viewStore;
