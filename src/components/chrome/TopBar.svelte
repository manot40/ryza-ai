<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { world } from '$lib/stores/world.svelte';
  
  import { Button } from '$components/ui/button';
  import TodToggle from '$components/TodToggle.svelte';
  import VoiceToggle from '$lib/fx/voice-toggle.svelte';
  

  interface Props {
    onOpenDrawer: () => void;
    onOpenSideMenu: () => void;
    onSelectView: (view: string) => void;
  }

  let { onOpenDrawer, onOpenSideMenu, onSelectView }: Props = $props();

  const appState = $derived(config.section('state') || {});
  const app = $derived(config.section('app') || {});

  const isVoiceActive = $derived(appState.style !== 'text' && app.voice !== false);

  const modeLabels: Record<string, string> = {
    chat: 'Free Talk',
    story: 'Story',
    asmr: 'ASMR',
    immersive: 'Immersive',
  };

  function toggleVoiceStyle() {
    const nextStyle = appState.style === 'text' ? 'normal' : 'text';
    config.set('state.style', nextStyle);
  }
</script>

<header
  class="absolute top-0 left-0 right-0 z-30 flex h-14 items-center justify-between px-3 pointer-events-auto bg-linear-to-b from-background/80 via-background/40 to-transparent"
>
  <div class="flex items-center gap-1">
    <Button
      variant="outline"
      size="icon"
      class="h-9 w-9 rounded-full bg-card/60 backdrop-blur-md border-border/50 text-foreground/90 hover:bg-card/90 shadow-sm"
      aria-label="Open Navigation"
      onclick={onOpenDrawer}
    >
      <span class="text-base leading-none">☰</span>
    </Button>

    <Button
      variant="outline"
      size="sm"
      class="h-7 rounded-full bg-card/60 backdrop-blur-md border-border/40 px-3 text-xs font-medium text-foreground/80 hover:bg-card/90 shadow-sm gap-1"
      onclick={() => onSelectView('world')}
    >
      <span>📍</span>
      <span class="truncate max-w-22.5 sm:max-w-30">
        {world.stageName(appState.stage) || appState.stage || 'Hideout'}
      </span>
    </Button>

    <TodToggle class="h-7 bg-card/60 backdrop-blur-md font-medium text-foreground/80 hover:bg-card/90 shadow-sm gap-1" />

    <Button
      is="div"
      variant="outline"
      size="sm"
      class="hidden sm:inline-flex h-7 rounded-full bg-card/60 backdrop-blur-md border-border/40 px-2.5 text-xs font-medium text-gold/90 hover:bg-card/60 hover:text-initial shadow-sm"
    >
      <span>{modeLabels[appState.mode || 'chat'] || 'Free Talk'}</span>
    </Button>
  </div>

  <div class="flex items-center gap-1">
    <Button
      variant="outline"
      size="icon"
      class="size-9 rounded-full bg-card/60 backdrop-blur-md border-border/50 text-foreground/90 hover:bg-card/90 shadow-sm p-0"
      aria-label="Toggle Voice"
      onclick={toggleVoiceStyle}
    >
      <VoiceToggle active={isVoiceActive} size={20} class="-ml-2" />
    </Button>

    <Button
      variant="outline"
      size="icon"
      class="size-9 rounded-full bg-card/60 backdrop-blur-md border-border/50 text-foreground/90 hover:bg-card/90 shadow-sm"
      aria-label="Quick Actions"
      onclick={onOpenSideMenu}
    >
      <span class="text-base font-bold leading-none">»</span>
    </Button>
  </div>
</header>
