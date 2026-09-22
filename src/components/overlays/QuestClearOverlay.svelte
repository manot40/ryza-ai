<script lang="ts">
  import { Button } from '$components/ui/button';
  import Confetti from '$lib/fx/confetti.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { quests } from '$lib/stores/quests.svelte';
  import { talkLoop } from '$lib/talk-loop.svelte';

  const clearData = $derived(overlayStore.questClearData);

  function handleOk() {
    overlayStore.closeQuestClear();
    if (quests.pendingAdvance()) {
      quests.takeNext();
    }
    talkLoop.playWellDone();
  }
</script>

{#if overlayStore.questClearOpen && clearData}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <!-- Confetti Particle Explosion -->
    <Confetti class="pointer-events-none absolute inset-0 z-10" />

    <div
      class="relative z-20 w-full max-w-sm rounded-2xl bg-card border border-gold/50 shadow-2xl p-6 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
      <img
        src="/assets/icons/quest_clear_icon.svg"
        alt="Quest Cleared"
        class="w-16 h-16 drop-shadow-md animate-pulse" />

      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-extrabold text-gold tracking-wide">Quest Cleared!</h3>
        <p class="text-sm font-semibold text-foreground mt-1">
          {clearData.title}
        </p>
        <p class="text-xs text-muted-foreground italic mt-2 px-2 leading-relaxed">
          {clearData.praise || 'Incredible job! Another adventure well spent!'}
        </p>
      </div>

      <Button
        class="w-full h-10 mt-2 text-xs font-bold rounded-full bg-gold text-background hover:bg-gold/90 shadow-md"
        onclick={handleOk}>
        OK
      </Button>
    </div>
  </div>
{/if}
