<script lang="ts">
  import { onMount } from 'svelte';
  import { world } from '$lib/stores/world.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { avatarService } from '$lib/avatar/avatar-service.svelte';

  import Header from './Header.svelte';
  import TodToggle from '$components/TodToggle.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardContent } from '$components/ui/card';

  const appState = $derived(config.section('state') || {});
  const currentStageId = $derived(appState.stage || 'stage_01_001_04');
  const currentTod = $derived(appState.tod || 'aft');

  let selectedAreaId = $state('');

  onMount(async () => {
    if (!world.hierarchy) {
      await world.init();
    }
    const myArea = world.areaOf(currentStageId);
    if (myArea) {
      selectedAreaId = myArea;
    } else if (world.areas().length > 0) {
      selectedAreaId = world.areas()[0].id;
    }
  });

  const areas = $derived(world.areas());
  const fields = $derived(selectedAreaId ? world.fields(selectedAreaId) : []);
  const npcsHere = $derived(world.npcsAt(currentStageId, appState.day || 1));

  function handleSelectStage(stageId: string) {
    config.set('state.stage', stageId);
    avatarService.loadScene(stageId, currentTod);
    viewStore.setView('talk');
  }
</script>

<!-- View Header -->
<Header title="World Map">
  <Button
    variant="outline"
    size="sm"
    class="h-7 px-2.5 rounded-full text-xs font-medium border-border/40 bg-card/60 hover:bg-card text-foreground/80 gap-1"
    onclick={() => overlayStore.openSheet('npc', { npcStageId: currentStageId })}>
    <span>👥</span>
    <span>People</span>
  </Button>
  <TodToggle />
</Header>

<!-- Area Tabs / Strip -->
<div class="flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-border/30 bg-muted/20">
  {#each areas as area}
    <Button
      variant={selectedAreaId === area.id ? 'default' : 'outline'}
      size="sm"
      class="h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap {selectedAreaId === area.id
        ? 'bg-gold text-background font-semibold hover:bg-gold/90'
        : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'}"
      onclick={() => (selectedAreaId = area.id)}>
      {world.areaName(area.id)}
    </Button>
  {/each}
</div>

<!-- Main Content: Fields and Stages Grid -->
<div class="flex-1 overflow-y-auto p-4 space-y-4" style="max-height: 75dvh;">
  {#each fields as field}
    <div class="space-y-2">
      <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        {world.fieldName(field.id)}
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {#each field.stages as stage}
          {@const isCurrent = stage.id === currentStageId}
          <Card
            class="border-border/50 bg-card/75 hover:bg-card transition cursor-pointer {isCurrent
              ? 'ring-1 ring-gold bg-gold/10'
              : ''}"
            onclick={() => handleSelectStage(stage.id)}>
            <CardContent class="p-3 flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-sm font-semibold {isCurrent ? 'text-gold' : 'text-foreground'}">
                  {world.stageName(stage.id)}
                </span>
                <span class="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {stage.id}
                </span>
              </div>

              {#if isCurrent}
                <span
                  class="text-xs font-bold text-gold px-2 py-0.5 rounded-full bg-gold/20 border border-gold/40">
                  Here
                </span>
              {:else}
                <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground">Travel</Button>
              {/if}
            </CardContent>
          </Card>
        {/each}
      </div>
    </div>
  {/each}

  <!-- NPCs currently here -->
  {#if npcsHere.length > 0}
    <div class="mt-6 pt-4 border-t border-border/40 space-y-2">
      <h3 class="text-xs font-semibold text-gold uppercase tracking-wider px-1">People Here</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {#each npcsHere as npc}
          <div class="flex items-center gap-2.5 bg-card/60 border border-border/40 rounded-lg p-2.5">
            <span class="text-base">👤</span>
            <div class="flex flex-col">
              <span class="text-xs font-medium text-foreground">{world.npcName(npc.id)}</span>
              {#if npc.note}
                <span class="text-[10px] text-muted-foreground">{npc.note}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
