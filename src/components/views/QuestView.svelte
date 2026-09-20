<script lang="ts">
  import { onMount } from 'svelte';
  import { quests, type Quest } from '$lib/stores/quests.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { Button } from '$components/ui/button';
  import { Progress } from '$components/ui/progress';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '$components/ui/card';

  let currentQuest = $state<Quest | null>(null);
  let isGenerating = $state(false);
  let actionMessage = $state('');

  function refresh() {
    currentQuest = quests.ensure();
  }

  onMount(() => {
    refresh();
  });

  async function handleAskRyza() {
    isGenerating = true;
    try {
      currentQuest = await quests.generate(true);
    } finally {
      isGenerating = false;
    }
  }

  function handleDoAction() {
    if (!currentQuest) return;
    const res = quests.doAction(currentQuest.type);
    actionMessage = res.line;
    refresh();
  }

  function handleTakeNext() {
    quests.takeNext();
    actionMessage = '';
    refresh();
  }

  const questLog = $derived(
    (game.flags.quest_log as Array<{ no: number; type: string; title: string; at: number }>) || []
  );
</script>

<div class="h-full w-full flex flex-col bg-background/90 backdrop-blur-md overflow-hidden">
  <!-- View Header -->
  <div class="flex items-center justify-between p-4 border-b border-border/40">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:text-foreground"
        onclick={() => viewStore.setView('talk')}>
        ✕
      </Button>
      <h2 class="text-lg font-bold text-gold">Quests</h2>
    </div>

    <Button
      variant="outline"
      size="sm"
      class="h-8 text-xs border-border/50 text-gold hover:bg-gold/10"
      disabled={isGenerating}
      onclick={handleAskRyza}>
      {isGenerating ? 'Thinking...' : 'Ask Ryza'}
    </Button>
  </div>

  <!-- Scrollable Quest Content -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    {#if currentQuest}
      <Card class="border-border/60 bg-card/85 shadow-lg">
        <CardHeader>
          <div class="flex items-center justify-between">
            <span
              class="text-xs font-semibold text-gold px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30">
              {currentQuest.side ? 'Side Quest' : `Main Quest #${currentQuest.no}`}
            </span>
            <span class="text-xs text-muted-foreground">
              Cost: {currentQuest.cost} Stamina
            </span>
          </div>
          <CardTitle class="text-base text-foreground font-bold mt-1">
            {quests.title(currentQuest)}
          </CardTitle>
          <CardDescription class="text-xs text-muted-foreground mt-0.5">
            {quests.desc(currentQuest)}
          </CardDescription>
        </CardHeader>

        <CardContent class="p-4 pt-2 space-y-3">
          <!-- Goal & Progress -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-foreground/90">{quests.goal(currentQuest)}</span>
              <span class="font-mono text-gold font-bold">
                {currentQuest.step} / {currentQuest.need}
              </span>
            </div>
            <Progress value={currentQuest.step} max={currentQuest.need} class="h-2.5 bg-muted/60" />
          </div>

          <!-- Rewards row -->
          <div class="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span>Rewards:</span>
            <span class="text-gold font-semibold">+{currentQuest.reward?.exp || 0} EXP</span>
            <span class="text-gold font-semibold">+{currentQuest.reward?.money || 0} G</span>
          </div>

          <!-- Action Feedback -->
          {#if actionMessage}
            <div
              class="p-2.5 rounded-md bg-muted/40 border border-border/40 text-xs text-foreground/90 leading-relaxed">
              {actionMessage}
            </div>
          {/if}
        </CardContent>

        <CardFooter class="p-4 pt-0 flex gap-2">
          {#if currentQuest.complete || currentQuest.step >= currentQuest.need}
            <Button
              class="w-full bg-leaf text-background font-bold hover:bg-leaf/90"
              onclick={handleTakeNext}>
              Claim Reward & Continue
            </Button>
          {:else if currentQuest.type === 'talk'}
            <Button
              class="w-full bg-gold text-background font-semibold hover:bg-gold/90"
              onclick={() => viewStore.setView('talk')}>
              Talk to Ryza
            </Button>
          {:else if currentQuest.type === 'explore'}
            <Button
              class="w-full bg-gold text-background font-semibold hover:bg-gold/90"
              onclick={() => viewStore.setView('world')}>
              Open World Map
            </Button>
          {:else}
            <Button
              class="w-full bg-gold text-background font-semibold hover:bg-gold/90"
              onclick={handleDoAction}>
              Take Action
            </Button>
          {/if}
        </CardFooter>
      </Card>
    {/if}

    <!-- Cleared Quests History -->
    {#if questLog.length > 0}
      <div class="space-y-2 pt-2">
        <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Recent Completed Quests
        </h3>
        <div class="space-y-1.5">
          {#each [...questLog].reverse().slice(0, 5) as item}
            <div
              class="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/40 text-xs">
              <span class="font-medium text-foreground/90">
                {quests.title({
                  no: item.no,
                  title: item.title,
                  side: item.no > 8,
                  type: item.type,
                } as Quest)}
              </span>
              <span class="text-leaf font-semibold">Completed</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
