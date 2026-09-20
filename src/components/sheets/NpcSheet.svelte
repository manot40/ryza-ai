<script lang="ts">
  import * as Sheet from '$components/ui/sheet';
  import Header from '$components/views/Header.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { world } from '$lib/stores/world.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { toast } from '$lib/stores/toast.svelte';

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
    <Header title="Guests in {stageName}" />

    <div class="flex-1 overflow-y-auto p-4 space-y-3 max-h-[70vh] text-xs">
      {#if npcs.length === 0}
        <div class="py-8 text-center text-muted-foreground">No guests around here right now.</div>
      {:else}
        {#each npcs as npc}
          {@const hasMet = game.s.met_charas.includes(npc.id)}
          <button
            type="button"
            class="w-full flex items-center gap-3 p-2.5 rounded-xl bg-card/60 hover:bg-card/90 border border-border/30 text-left transition cursor-pointer"
            onclick={() => toast.show(`${world.npcName(npc.id)}${npc.note ? '：' + npc.note : ''}`)}>
            <img
              src={world.iconFor(npc.id)}
              alt={world.npcName(npc.id)}
              class="w-10 h-10 rounded-full border border-gold/40 object-cover bg-muted/40 shrink-0"
              onerror={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.visibility = 'hidden';
              }} />
            <div class="flex flex-col flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-foreground truncate">{world.npcName(npc.id)}</span>
                {#if !hasMet}
                  <span
                    class="text-[10px] px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full shrink-0">
                    Unmet
                  </span>
                {/if}
              </div>
              {#if npc.note}
                <span class="text-[11px] text-muted-foreground mt-0.5 truncate">{npc.note}</span>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
