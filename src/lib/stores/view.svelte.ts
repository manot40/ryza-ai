// @wc-ignore-file

export type AppView =
  | 'talk'
  | 'world'
  | 'quest'
  | 'daily'
  | 'alarm'
  | 'chara'
  | 'skin'
  | 'memory'
  | 'settings'
  | 'welcome';

export class ViewStore {
  activeView = $state<AppView>('talk');
  drawerOpen = $state(false);
  sideMenuOpen = $state(false);

  setView(view: AppView | string) {
    this.activeView = view as AppView;
    this.drawerOpen = false;
    this.sideMenuOpen = false;
  }
}

export const viewStore = new ViewStore();
export default viewStore;
