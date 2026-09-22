<script lang="ts">
  import * as Sheet from '$components/ui/sheet';
  import Header from '$components/views/Header.svelte';
  import { Button } from '$components/ui/button';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { world } from '$lib/stores/world.svelte';
  import { viewStore } from '$lib/stores/view.svelte';

  const appState = $derived(config.get('state'));
  const isVoice = $derived(appState.style !== 'text');

  const modes = [
    { id: 'chat', label: 'Chat', icon: '/assets/icons/mode_chat.svg' },
    { id: 'story', label: 'Story', icon: '/assets/icons/mode_story.svg' },
    { id: 'immersive', label: 'Immersive', icon: '/assets/icons/mode_immersive.svg' },
    { id: 'asmr', label: 'ASMR', icon: '/assets/icons/mode_asmr.svg' },
    { id: 'text', label: 'Text', icon: '/assets/icons/mode_text.svg' },
  ];

  function selectMode(m: string) {
    config.setState('mode', m);
  }

  function selectStyle(s: string) {
    config.setState('style', s);
  }

  function goToWorld() {
    overlayStore.closeSheet('mode');
    viewStore.setView('world');
  }
</script>

<Sheet.Root bind:open={overlayStore.modeSheetOpen}>
  <Sheet.Content
    side="bottom"
    class="w-full max-w-xl mx-auto bg-background/95 border border-border/60 rounded-t-2xl"
    showCloseButton={false}>
    <Header title="Dialogue Mode" />

    <div class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[70vh]">
      <!-- Mode Selector Pills -->
      <div class="flex flex-col gap-2">
        <span class="text-xs font-semibold text-muted-foreground">Mode</span>
        <div class="flex flex-wrap gap-1.5">
          {#each modes as m}
            {@const isActive = (appState.mode || 'chat') === m.id}
            <Button
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              class="h-8 rounded-full px-3 text-xs gap-1.5 {isActive
                ? 'bg-gold text-background font-semibold hover:bg-gold/90'
                : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'}"
              onclick={() => selectMode(m.id)}>
              <img src={m.icon} alt="" class="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </Button>
          {/each}
        </div>
      </div>

      <!-- Style Selector Pills (Voice vs Text) -->
      <div class="flex flex-col gap-2">
        <span class="text-xs font-semibold text-muted-foreground">Output Style</span>
        <div class="flex gap-2">
          <Button
            variant={isVoice ? 'default' : 'outline'}
            size="sm"
            class="flex-1 h-8 rounded-full text-xs {isVoice
              ? 'bg-gold text-background font-semibold hover:bg-gold/90'
              : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'}"
            onclick={() => selectStyle('voice')}>
            🔊 Voice
          </Button>
          <Button
            variant={!isVoice ? 'default' : 'outline'}
            size="sm"
            class="flex-1 h-8 rounded-full text-xs {!isVoice
              ? 'bg-gold text-background font-semibold hover:bg-gold/90'
              : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'}"
            onclick={() => selectStyle('text')}>
            📝 Text Only
          </Button>
        </div>
      </div>

      <!-- Scene Context Chips & Map Link -->
      <div class="flex items-center justify-between pt-2 border-t border-border/30">
        <div class="flex items-center gap-1.5 text-xs text-foreground/80">
          <span class="px-2.5 py-1 rounded-full bg-card/80 border border-border/40 font-medium">
            📍 {world.stageName(appState.stage) || appState.stage || 'Hideout'}
          </span>
          <span class="px-2.5 py-1 rounded-full bg-card/80 border border-border/40 font-medium uppercase">
            🌤 {appState.tod || 'aft'}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2.5 rounded-full text-xs font-medium border-border/40 bg-card/60 hover:bg-card text-gold gap-1"
          onclick={goToWorld}>
          <img src="/assets/icons/world_map.svg" alt="" class="w-3.5 h-3.5" />
          <span>Map</span>
        </Button>
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>
