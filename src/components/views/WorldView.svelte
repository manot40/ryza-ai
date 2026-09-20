<script lang="ts">
  import { onMount } from 'svelte';
  import { world } from '$lib/stores/world.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { talkLoop } from '$lib/talk-loop.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { getWorldLockedToast } from '$lib/i18n/game-content';

  import Header from './Header.svelte';
  import TodToggle from '$components/TodToggle.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardContent } from '$components/ui/card';

  const appState = $derived(config.section('state') || {});
  const currentStageId = $derived(appState.stage || 'stage_01_001_04');

  let selectedAreaId = $state('');

  onMount(async () => {
    if (!world.hierarchy) {
      await world.init();
    }
    const myArea = world.areaOf(currentStageId);
    if (myArea && !world.locked(myArea)) {
      selectedAreaId = myArea;
    } else {
      selectedAreaId = 'area_01';
    }
  });

  const areas = $derived(world.areas());
  const fields = $derived(selectedAreaId ? world.fields(selectedAreaId) : []);
  const npcsHere = $derived(world.npcsAt(currentStageId, appState.day || 1));

  function handleSelectStage(stageId: string) {
    const areaId = world.areaOf(stageId);
    if (areaId && world.locked(areaId)) {
      toast.err(getWorldLockedToast());
      return;
    }
    talkLoop.gotoStage(stageId);
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
    <span>Guests</span>
  </Button>
  <TodToggle />
</Header>

<!-- Area Tabs / Strip -->
<div class="flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-border/30 bg-muted/20">
  {#each areas as area}
    {@const isLocked = world.locked(area.id)}
    {@const areaGuests = world.npcsInArea(area.id, appState.day || 1)}
    <Button
      variant={selectedAreaId === area.id ? 'default' : 'outline'}
      size="sm"
      class="h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap gap-1 {selectedAreaId === area.id
        ? 'bg-gold text-background font-semibold hover:bg-gold/90'
        : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'} {isLocked ? 'opacity-50' : ''}"
      onclick={() => {
        if (isLocked) {
          toast.err(getWorldLockedToast());
          return;
        }
        selectedAreaId = area.id;
      }}>
      <span>{world.areaName(area.id)}</span>
      {#if isLocked}
        <span class="text-[10px]">🔒</span>
      {:else if areaGuests.length > 0}
        <span
          class="text-[10px] px-1 py-0.2 rounded-full {selectedAreaId === area.id
            ? 'bg-background/30 text-background'
            : 'bg-gold/20 text-gold'} font-mono">
          {areaGuests.length}
        </span>
      {/if}
    </Button>
  {/each}
</div>

<!-- Main Content: Fields and Stages Grid -->
<div class="flex-1 overflow-y-auto p-4 space-y-4" style="max-height: 75dvh;">
  {#each fields as field}
    {@const fieldGuests = world.npcsInField(field.id, appState.day || 1)}
    <div class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {world.fieldName(field.id)}
        </h3>
        {#if fieldGuests.length > 0}
          <div class="flex items-center gap-1 text-[11px] text-muted-foreground">
            <div class="flex items-center -space-x-1.5">
              {#each fieldGuests.slice(0, 3) as npc}
                <img
                  src={world.iconFor(npc.id)}
                  alt={world.npcName(npc.id)}
                  title={world.npcName(npc.id)}
                  class="w-4 h-4 rounded-full border border-background object-cover bg-muted ring-1 ring-gold/30"
                  onerror={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }} />
              {/each}
            </div>
            {#if fieldGuests.length > 3}
              <span class="text-[10px]">+{fieldGuests.length - 3}</span>
            {/if}
            <span class="text-[10px] text-muted-foreground/70">({fieldGuests.length})</span>
          </div>
        {/if}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {#each field.stages as stage}
          {@const isCurrent = stage.id === currentStageId}
          {@const isLocked = world.locked(selectedAreaId)}
          {@const stageGuests = world.npcsAt(stage.id, appState.day || 1)}
          <Card
            class="border-border/50 bg-card/75 hover:bg-card transition {isLocked
              ? 'opacity-60 cursor-not-allowed'
              : 'cursor-pointer'} {isCurrent ? 'ring-1 ring-gold bg-gold/10' : ''}"
            onclick={() => handleSelectStage(stage.id)}>
            <CardContent class="p-3 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-semibold truncate {isCurrent ? 'text-gold' : 'text-foreground'}">
                    {world.stageName(stage.id)}
                  </span>
                  <span class="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {stage.id}
                  </span>
                </div>

                {#if isCurrent}
                  <span
                    class="text-xs font-bold text-gold px-2 py-0.5 rounded-full bg-gold/20 border border-gold/40 shrink-0">
                    Here
                  </span>
                {:else if isLocked}
                  <span
                    class="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted/40 flex items-center gap-1 shrink-0">
                    <span>🔒</span>
                    <span>Locked</span>
                  </span>
                {:else}
                  <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground shrink-0">
                    Travel
                  </Button>
                {/if}
              </div>

              <!-- Guest Avatars on this Stage -->
              {#if stageGuests.length > 0}
                <div class="flex items-center gap-1.5 pt-1.5 border-t border-border/20">
                  <div class="flex items-center -space-x-2 shrink-0">
                    {#each stageGuests.slice(0, 3) as npc}
                      <img
                        src={world.iconFor(npc.id)}
                        alt={world.npcName(npc.id)}
                        title={world.npcName(npc.id) + (npc.note ? ` (${npc.note})` : '')}
                        class="w-6 h-6 rounded-full border-2 border-background object-cover bg-muted/50 ring-1 ring-gold/40 shadow-xs"
                        onerror={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }} />
                    {/each}
                  </div>
                  {#if stageGuests.length > 3}
                    <span class="text-[10px] text-muted-foreground font-medium shrink-0">
                      +{stageGuests.length - 3}
                    </span>
                  {/if}
                  <span class="text-[11px] text-muted-foreground/90 truncate">
                    {stageGuests.map((n) => world.npcName(n.id)).join('、')}
                  </span>
                </div>
              {/if}
            </CardContent>
          </Card>
        {/each}
      </div>
    </div>
  {/each}

  <!-- Guests currently at this stage -->
  {#if npcsHere.length > 0}
    <div class="mt-6 pt-4 border-t border-border/40 space-y-2.5">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-semibold text-gold uppercase tracking-wider flex items-center gap-1.5">
          <span>👥</span>
          <span>Guests Here ({npcsHere.length})</span>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onclick={() => overlayStore.openSheet('npc', { npcStageId: currentStageId })}>
          View Details
        </Button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {#each npcsHere as npc}
          {@const hasMet = game.s.met_charas.includes(npc.id)}
          <button
            type="button"
            class="flex items-center gap-2.5 bg-card/60 hover:bg-card/90 border border-border/40 rounded-lg p-2.5 text-left transition cursor-pointer"
            onclick={() => toast.show(`${world.npcName(npc.id)}${npc.note ? '：' + npc.note : ''}`)}>
            <img
              src={world.iconFor(npc.id)}
              alt={world.npcName(npc.id)}
              class="w-9 h-9 rounded-full border border-gold/40 object-cover bg-muted/40 shrink-0"
              onerror={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }} />
            <div class="flex flex-col flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-foreground truncate">{world.npcName(npc.id)}</span>
                {#if !hasMet}
                  <span class="text-[9px] px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full shrink-0">
                    ?
                  </span>
                {/if}
              </div>
              {#if npc.note}
                <span class="text-[10px] text-muted-foreground truncate">{npc.note}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
