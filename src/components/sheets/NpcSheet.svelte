<script lang="ts">
  import * as Sheet from '$components/ui/sheet';
  import Header from '$components/views/Header.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { world } from '$lib/stores/world.svelte';
  import { game } from '$lib/stores/game.svelte';

  const appState = $derived(config.section('state') || {});
  const currentStageId = $derived(overlayStore.npcStageId || appState.stage || 'stage_01_001_04');
  const stageName = $derived(world.stageName(currentStageId) || currentStageId);
  const npcs = $derived(world.npcsAt(currentStageId, appState.day || 1));
</script>

<Sheet.Root bind:open={overlayStore.npcSheetOpen}>
  <Sheet.Content
    side="bottom"
    class="w-full max-w-xl mx-auto bg-background/95 border border-border/60 rounded-t-2xl"
    showCloseButton={false}>
    <Header title="People in {stageName}" />

    <div class="flex-1 overflow-y-auto p-4 space-y-3 max-h-[70vh] text-xs">
      {#if npcs.length === 0}
        <div class="py-8 text-center text-muted-foreground">No one is around here right now.</div>
      {:else}
        {#each npcs as npc}
          {@const hasMet = game.s.met_charas.includes(npc.id)}
          <div class="flex items-center gap-3 p-2.5 rounded-xl bg-card/60 border border-border/30">
            <img
              src={world.iconFor(npc.id)}
              alt={npc.name}
              class="w-10 h-10 rounded-full border border-border/40 object-cover bg-muted/40"
              onerror={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.visibility = 'hidden';
              }} />
            <div class="flex flex-col flex-1">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-foreground">{npc.name}</span>
                {#if !hasMet}
                  <span class="text-[10px] px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full">
                    Unmet
                  </span>
                {/if}
              </div>
              {#if npc.note}
                <span class="text-[11px] text-muted-foreground mt-0.5">{npc.note}</span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
