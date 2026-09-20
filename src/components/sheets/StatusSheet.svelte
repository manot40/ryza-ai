<script lang="ts">
  import * as Sheet from '$components/ui/sheet';
  import Header from '$components/views/Header.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { quests } from '$lib/stores/quests.svelte';
  import { world } from '$lib/stores/world.svelte';

  const exp = $derived(game.expIntoLevel());
  const apples = $derived(game.apples());
  const activeQuest = $derived(quests.active());
  const metNames = $derived.by(() => {
    return game.s.met_charas
      .slice(-8)
      .reverse()
      .map((id) => world.npcName(id) || id)
      .join('、');
  });
  const recentMemories = $derived(game.s.memory.slice(-5).reverse());
</script>

<Sheet.Root bind:open={overlayStore.statusSheetOpen}>
  <Sheet.Content
    side="bottom"
    class="w-full max-w-xl mx-auto bg-background/95 border border-border/60 rounded-t-2xl"
    showCloseButton={false}>
    <Header title="Adventure Status" />

    <div class="flex-1 overflow-y-auto p-4 space-y-3 max-h-[70vh] text-xs">
      <!-- General Stats Card -->
      <div class="p-3 rounded-xl bg-card/60 border border-border/40 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Level</span>
          <span class="font-bold text-gold text-sm">Lv.{game.level()}</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Stamina</span>
          <div class="flex items-center gap-1.5">
            <div class="flex items-center gap-0.5">
              {#each Array(apples.slots) as _, i}
                <img
                  src="/assets/icons/{i < apples.filled ? 'stamina_apple_filled' : 'stamina_apple_empty'}.svg"
                  alt=""
                  class="w-3.5 h-3.5" />
              {/each}
            </div>
            <span class="font-medium text-foreground">
              {game.cheat() ? '∞' : `${game.s.stamina}/${game.max()}`}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">EXP Progress</span>
          <span class="font-medium text-foreground">
            {exp.into} / {exp.span} (Total: {game.s.exp_total})
          </span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Gold</span>
          <span class="font-medium text-gold font-mono">
            {game.cheat() ? '∞' : `${game.s.money.toLocaleString()} G`}
          </span>
        </div>
      </div>

      <!-- Quest & World Progress -->
      <div class="p-3 rounded-xl bg-card/60 border border-border/40 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Active Quest</span>
          {#if activeQuest}
            <span class="font-medium text-gold truncate max-w-[200px]">
              {quests.title(activeQuest)} ({activeQuest.step}/{activeQuest.need})
            </span>
          {:else}
            <span class="text-muted-foreground">None</span>
          {/if}
        </div>

        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">People Met</span>
          <span class="font-medium text-foreground">{game.s.met_charas.length}</span>
        </div>
        {#if metNames}
          <div class="text-[11px] text-muted-foreground/80 pl-1">
            {metNames}
          </div>
        {/if}

        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Ship Construction</span>
          <span class="font-medium text-foreground">
            {game.flag('ship_parts', 0)} / 4 {game.s.sailed ? '⛵' : ''}
          </span>
        </div>
      </div>

      <!-- Recent Memories -->
      <div class="p-3 rounded-xl bg-card/60 border border-border/40 flex flex-col gap-2">
        <span class="font-semibold text-foreground">Memories</span>
        {#if recentMemories.length === 0}
          <div class="text-muted-foreground text-center py-2">No memories recorded yet</div>
        {:else}
          <div class="flex flex-col gap-1.5">
            {#each recentMemories as mem}
              <div class="p-1.5 rounded-lg bg-background/50 border border-border/20 text-muted-foreground">
                {mem.text}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>
