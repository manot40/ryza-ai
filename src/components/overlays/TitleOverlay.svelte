<script lang="ts">
  import Fire from '$lib/fx/fire.svelte';
  import { Button } from '$components/ui/button';
  import { onboarding } from '$lib/stores/onboarding.svelte';

  function handleStart() {
    onboarding.start();
  }
</script>

{#if !onboarding.isDone && onboarding.stage === 'title'}
  <div
    class="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-lg p-6 text-center select-none animate-in fade-in duration-300">
    <!-- Fire Sparkle Particle FX -->
    <div class="relative mb-2 flex items-center justify-center">
      <Fire width={140} height={140} />
    </div>

    <!-- Title & Subtitle -->
    <h1 class="text-3xl font-extrabold text-gold tracking-wider drop-shadow-md">ライザと話す</h1>
    <p class="text-sm font-medium text-muted-foreground mt-1 tracking-widest uppercase">Atelier Ryza</p>

    <!-- Start Button -->
    <div class="mt-8 w-full max-w-xs">
      <Button
        class="w-full h-12 text-base font-bold rounded-full bg-gold text-background hover:bg-gold/90 shadow-lg shadow-gold/20"
        onclick={handleStart}>
        Start
      </Button>
    </div>
  </div>
{/if}
