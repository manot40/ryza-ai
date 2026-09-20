<script lang="ts">
  import { onMount } from 'svelte';
  import { memory } from '$lib/stores/memory.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { modal } from '$lib/stores/modal.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  let isFlushing = $state(false);

  onMount(() => {
    memory.load();
  });

  async function handleFlush() {
    isFlushing = true;
    try {
      await memory.flushNow();
    } finally {
      isFlushing = false;
    }
  }

  async function handleClearAll() {
    const ok = await modal.confirm(
      'Clear All Memories',
      'Are you sure you want to erase all conversation memories and summaries? This cannot be undone.',
      'Clear All',
      'Cancel'
    );
    if (ok) {
      memory.reset();
    }
  }

  function deleteCard(id: string, layer: 'session' | 'summary') {
    if (layer === 'summary') {
      memory.summaries = memory.summaries.filter((c) => c.id !== id);
    } else {
      memory.sessions = memory.sessions.filter((c) => c.id !== id);
    }
    memory.save();
  }
</script>

<div class="h-full w-full flex flex-col bg-background/90 backdrop-blur-md overflow-hidden">
  <!-- View Header -->
  <div class="flex items-center justify-between p-4 border-b border-border/40">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:text-foreground"
        onclick={() => viewStore.setView('talk')}
      >
        ✕
      </Button>
      <h2 class="text-lg font-bold text-gold">Memories</h2>
    </div>

    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs border-border/50 text-gold hover:bg-gold/10"
        disabled={isFlushing}
        onclick={handleFlush}
      >
        {isFlushing ? 'Folding...' : 'Fold Summary'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 text-xs text-destructive hover:bg-destructive/10"
        onclick={handleClearAll}
      >
        Clear All
      </Button>
    </div>
  </div>

  <!-- Content List -->
  <div class="flex-1 overflow-y-auto p-4 space-y-5">
    <!-- Long-term Summaries -->
    <div class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-semibold text-gold uppercase tracking-wider">
          Long-Term Summaries
        </h3>
        <span class="text-[11px] text-muted-foreground">
          {memory.summaries.length} saved
        </span>
      </div>

      {#if memory.summaries.length === 0}
        <div class="p-4 rounded-lg bg-card/40 border border-border/30 text-xs text-muted-foreground text-center">
          No long-term summaries yet. Conversations will fold here as you talk!
        </div>
      {:else}
        <div class="space-y-2">
          {#each memory.summaries as item}
            <Card class="border-border/50 bg-card/75 shadow-sm">
              <CardContent class="p-3 flex flex-col gap-2">
                <div class="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/20 pb-1.5">
                  <span class="px-2 py-0.5 rounded-full bg-gold/15 text-gold font-bold">
                    Summary ({item.n} turns)
                  </span>
                  <div class="flex items-center gap-2">
                    <span>{new Date(item.at).toLocaleDateString()}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 text-muted-foreground hover:text-destructive text-xs"
                      onclick={() => deleteCard(item.id, 'summary')}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
                <p class="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {item.text}
                </p>
              </CardContent>
            </Card>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Recent Session Turns -->
    <div class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Conversation Sessions
        </h3>
        <span class="text-[11px] text-muted-foreground">
          {memory.sessions.length} sessions
        </span>
      </div>

      {#if memory.sessions.length === 0}
        <div class="p-4 rounded-lg bg-card/40 border border-border/30 text-xs text-muted-foreground text-center">
          No active session cards.
        </div>
      {:else}
        <div class="space-y-2">
          {#each memory.sessions as item}
            <Card class="border-border/50 bg-card/75 shadow-sm">
              <CardContent class="p-3 flex flex-col gap-2">
                <div class="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/20 pb-1.5">
                  <span class="px-2 py-0.5 rounded-full bg-muted text-foreground/80 font-medium">
                    Session Window
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 text-muted-foreground hover:text-destructive text-xs"
                    onclick={() => deleteCard(item.id, 'session')}
                  >
                    ✕
                  </Button>
                </div>
                <p class="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {item.text}
                </p>
              </CardContent>
            </Card>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
