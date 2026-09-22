<script lang="ts">
  import { onMount } from 'svelte';
  import { isElectron, isTopmost, setTopmost, minimizeWindow, closeWindow } from '$lib/platform/electron';
  import { Button } from '$components/ui/button';

  let hasElectron = $state(false);
  let topmost = $state(false);

  onMount(async () => {
    hasElectron = isElectron();
    if (hasElectron) {
      topmost = await isTopmost();
    }
  });

  async function toggleTopmost() {
    const next = !topmost;
    const res = await setTopmost(next);
    topmost = res;
  }
</script>

{#if hasElectron}
  <div id="winctl" class="flex items-center gap-1 ml-2">
    <Button
      variant={topmost ? 'default' : 'outline'}
      size="icon"
      class="size-7 rounded-md text-xs {topmost
        ? 'bg-gold text-background'
        : 'bg-card/70 border-border/40 text-foreground/80'}"
      title="Pin on Top"
      onclick={toggleTopmost}>
      📌
    </Button>
    <Button
      variant="outline"
      size="icon"
      class="size-7 rounded-md text-xs bg-card/70 border-border/40 text-foreground/80 hover:bg-card"
      title="Minimize"
      onclick={minimizeWindow}>
      —
    </Button>
    <Button
      variant="outline"
      size="icon"
      class="size-7 rounded-md text-xs bg-card/70 border-border/40 text-foreground/80 hover:bg-destructive hover:text-destructive-foreground"
      title="Close"
      onclick={closeWindow}>
      ✕
    </Button>
  </div>
{/if}
