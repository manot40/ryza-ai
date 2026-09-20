<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { world } from '$lib/stores/world.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';

  import { Button } from '$components/ui/button';
  import TodToggle from '$components/TodToggle.svelte';
  import ElectronControls from './ElectronControls.svelte';
  import { ChevronsRightIcon, MenuIcon } from '@lucide/svelte';

  interface Props {
    onOpenDrawer: () => void;
    onOpenSideMenu: () => void;
    onSelectView: (view: string) => void;
  }

  let { onOpenDrawer, onOpenSideMenu, onSelectView }: Props = $props();

  const appState = $derived(config.section('state') || {});
  const modeLabels: Record<string, string> = {
    chat: 'Free Talk',
    story: 'Story',
    asmr: 'ASMR',
    immersive: 'Immersive',
  };
</script>

<header
  class="absolute top-0 left-0 right-0 z-30 flex h-14 items-center justify-between px-3 pointer-events-none bg-linear-to-b from-background/80 via-background/40 to-transparent">
  <div class="flex items-center gap-1 pointer-events-auto">
    <Button
      variant="outline"
      size="icon"
      class="size-10 rounded-md bg-card/60 backdrop-blur-md border-border/50 text-foreground/90 hover:bg-card/90 shadow-sm mr-3"
      aria-label="Open Navigation"
      onclick={onOpenDrawer}>
      <MenuIcon class="size-5" />
    </Button>

    <Button
      variant="outline"
      size="sm"
      class="h-7 rounded-full bg-card/60 backdrop-blur-md border-border/40 px-3 text-xs font-medium text-foreground/80 hover:bg-card/90 shadow-sm gap-1"
      onclick={() => onSelectView('world')}>
      <span>📍</span>
      <span class="truncate max-w-22.5 sm:max-w-30">
        {world.stageName(appState.stage) || appState.stage || 'Hideout'}
      </span>
    </Button>

    <TodToggle
      class="h-7 bg-card/60 backdrop-blur-md font-medium text-foreground/80 hover:bg-card/90 shadow-sm gap-1" />

    <Button
      variant="outline"
      size="sm"
      class="hidden sm:inline-flex h-7 rounded-full bg-card/60 backdrop-blur-md border-border/40 px-2.5 text-xs font-medium text-gold/90 hover:bg-card/80 shadow-sm cursor-pointer"
      onclick={() => overlayStore.openSheet('mode')}>
      <span>{modeLabels[appState.mode || 'chat'] || 'Free Talk'}</span>
    </Button>
  </div>

  <div class="flex items-center gap-1 pointer-events-auto">
    <Button
      variant="outline"
      size="icon"
      class="size-10 rounded-md bg-card/60 backdrop-blur-md border-border/50 text-foreground/90 hover:bg-card/90 shadow-sm"
      aria-label="Quick Actions"
      onclick={onOpenSideMenu}>
      <ChevronsRightIcon class="size-5" />
    </Button>

    <ElectronControls />
  </div>
</header>
