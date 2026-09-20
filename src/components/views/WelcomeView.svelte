<script lang="ts">
  import { welcome } from '$lib/stores/welcome.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardContent } from '$components/ui/card';

  const missionDetails: Record<
    string,
    { title: string; desc: string; targetView: string }
  > = {
    talk: {
      title: 'First Conversation',
      desc: 'Have a friendly chat with Ryza in the secret hideout.',
      targetView: 'talk',
    },
    map: {
      title: 'Explore the Island',
      desc: 'Open the world map to explore Kurken Island and other areas.',
      targetView: 'world',
    },
    alarm: {
      title: 'Set an Alarm',
      desc: 'Schedule a voiced wake-up greeting with Ryza.',
      targetView: 'alarm',
    },
    skin: {
      title: 'Wardrobe & Costumes',
      desc: 'Visit the costume gallery and try out Ryza’s outfits.',
      targetView: 'skin',
    },
    quest: {
      title: 'First Quest',
      desc: 'Embark on an adventure and advance your main quest line.',
      targetView: 'quest',
    },
  };

  function handleAction(stepId: string, targetView: string) {
    welcome.mark(stepId);
    viewStore.setView(targetView);
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
      <h2 class="text-lg font-bold text-gold">Welcome Missions</h2>
    </div>

    <span class="text-xs text-muted-foreground">
      {#if welcome.allDone()}
        <span class="text-leaf font-bold">All Completed!</span>
      {:else}
        Tutorial Checklist
      {/if}
    </span>
  </div>

  <!-- Missions List -->
  <div class="flex-1 overflow-y-auto p-4 space-y-3">
    {#each welcome.steps as step}
      {@const info = missionDetails[step.id] || { title: step.id, desc: '', targetView: 'talk' }}
      {@const isDone = welcome.done(step.id)}
      <Card
        class="border-border/50 bg-card/75 shadow-sm transition hover:bg-card cursor-pointer {isDone ? 'border-leaf/30 bg-leaf/5' : ''}"
        onclick={() => handleAction(step.id, info.targetView)}
      >
        <CardContent class="p-3.5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full flex items-center justify-center {isDone ? 'bg-leaf/20 text-leaf' : 'bg-gold/15 text-gold'}">
              {#if isDone}
                ✓
              {:else}
                ★
              {/if}
            </div>

            <div class="flex flex-col">
              <span class="text-sm font-semibold {isDone ? 'text-foreground/70 line-through' : 'text-foreground'}">
                {info.title}
              </span>
              <span class="text-xs text-muted-foreground mt-0.5">
                {info.desc}
              </span>
            </div>
          </div>

          <div>
            {#if isDone}
              <span class="text-xs font-bold text-leaf px-2 py-0.5 rounded-full bg-leaf/15">
                Done
              </span>
            {:else}
              <Button size="sm" variant="outline" class="h-7 text-xs border-gold/50 text-gold hover:bg-gold/10">
                Go
              </Button>
            {/if}
          </div>
        </CardContent>
      </Card>
    {/each}
  </div>
</div>
