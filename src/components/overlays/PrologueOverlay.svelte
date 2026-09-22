<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { onboarding } from '$lib/stores/onboarding.svelte';
  import { sound } from '$lib/audio/sound';
  import { config } from '$lib/stores/config.svelte';
  import { avatarService } from '$lib/avatar/avatar-service.svelte';

  let audioEl: HTMLAudioElement | null = null;

  function playCurrentStep() {
    if (typeof Audio === 'undefined') return;
    if (audioEl) {
      try {
        audioEl.pause();
      } catch {}
    }

    const src = sound.prologue(onboarding.prologueIndex);
    const audio = new Audio(src);
    audioEl = audio;
    audio.volume = Number(config.get('app')?.volume) || 0.9;
    avatarService.setTalking(true);

    audio.onended = () => {
      avatarService.setTalking(false);
    };

    audio.play().catch(() => {
      avatarService.setTalking(false);
    });
  }

  $effect(() => {
    if (!onboarding.isDone && onboarding.stage === 'prologue') {
      playCurrentStep();
    }
  });

  function handleTap() {
    if (audioEl) {
      try {
        audioEl.pause();
      } catch {}
    }
    avatarService.setTalking(false);
    onboarding.nextPrologue();
  }

  onDestroy(() => {
    if (audioEl) {
      try {
        audioEl.pause();
      } catch {}
    }
    avatarService.setTalking(false);
  });
</script>

{#if !onboarding.isDone && onboarding.stage === 'prologue'}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 flex flex-col items-center justify-between p-8 bg-gradient-to-b from-amber-950/70 via-purple-950/75 to-background/90 backdrop-blur-xs cursor-pointer select-none animate-in fade-in duration-300"
    onclick={handleTap}>
    <!-- Top Step Counter -->
    <div class="pt-6">
      <span
        class="px-4 py-1.5 rounded-full bg-background/60 border border-gold/30 text-gold font-bold text-sm tracking-wider shadow-md">
        Prologue {onboarding.prologueIndex} / 9
      </span>
    </div>

    <!-- Center Narrative Graphic or Atmosphere -->
    <div class="flex flex-col items-center gap-3 text-center px-4 max-w-sm">
      <p class="text-sm text-foreground/90 font-medium italic drop-shadow leading-relaxed">
        "A summer journey begins on the peaceful island of Kurken..."
      </p>
    </div>

    <!-- Bottom Tap Hint -->
    <div class="pb-8">
      <span class="text-xs text-muted-foreground/80 tracking-widest animate-pulse">
        Tap screen to continue
      </span>
    </div>
  </div>
{/if}
