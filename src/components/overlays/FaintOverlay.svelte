<script lang="ts">
  import { Button } from '$components/ui/button';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { talkLoop } from '$lib/talk-loop.svelte';

  const isCheat = $derived(game.cheat());

  function handleCancel() {
    overlayStore.closeFaint();
  }

  function handleCheatRefill() {
    game.refill();
    overlayStore.closeFaint();
  }

  function handleSleepHome() {
    talkLoop.sleepHome();
  }
</script>

{#if overlayStore.faintOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
    <div
      class="w-full max-w-sm rounded-2xl bg-card border border-destructive/40 shadow-2xl p-6 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
      <img
        src="/assets/icons/stamina_apple_empty.svg"
        alt="Out of Stamina"
        class="w-16 h-16 drop-shadow-md animate-pulse" />

      <div class="flex flex-col gap-1.5">
        <h3 class="text-xl font-extrabold text-destructive tracking-wide">Out of Stamina...</h3>
        <p class="text-xs text-muted-foreground leading-relaxed px-2">
          When stamina hits zero, Ryza faints from exhaustion. Rest up in a safe place to restore your energy!
        </p>
      </div>

      <div class="flex flex-col w-full gap-2 mt-2">
        <Button
          class="w-full h-10 text-xs font-bold bg-gold text-background hover:bg-gold/90"
          onclick={handleSleepHome}>
          Go Home and Sleep
        </Button>

        {#if isCheat}
          <Button
            variant="outline"
            class="w-full h-9 text-xs border-gold/50 text-gold hover:bg-gold/10"
            onclick={handleCheatRefill}>
            Cheat: Full Refill
          </Button>
        {/if}

        <Button variant="ghost" class="w-full h-9 text-xs text-muted-foreground" onclick={handleCancel}>
          Dismiss
        </Button>
      </div>
    </div>
  </div>
{/if}
