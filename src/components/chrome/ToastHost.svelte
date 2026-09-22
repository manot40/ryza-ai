<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.items.length > 0}
  <div
    style="z-index: 9999;"
    class="pointer-events-none fixed top-6 inset-x-0 flex flex-col items-center gap-2 px-4 select-none">
    {#each toast.items as item (item.id)}
      <div
        class="pointer-events-auto max-w-xs text-xs font-semibold px-3.5 py-2 rounded-full backdrop-blur-md shadow-lg border transition-all duration-200 animate-in fade-in slide-in-from-top-2 {item.isErr
          ? 'bg-destructive/90 text-destructive-foreground border-destructive/50'
          : 'bg-card/90 text-foreground border-gold/40 shadow-gold/10'}">
        {item.message}
      </div>
    {/each}
  </div>
{/if}
