<script lang="ts">
  import { welcome, type WelcomeGroup } from '$lib/stores/welcome.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import Header from './Header.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardContent } from '$components/ui/card';

  let activeTab = $state<'steps' | 'milestones'>('steps');
  let selectedGroupIdx = $state(0);

  const groups = $derived(welcome.groups);
  const currentGroup = $derived(groups[selectedGroupIdx] || groups[0]);
  const isCurrentGroupOpen = $derived(welcome.isOpen(currentGroup));
  const isCurrentGroupDone = $derived(welcome.groupDone(currentGroup));
  const isCurrentGroupClaimed = $derived(welcome.groupClaimed(currentGroup));

  const missionTitles: Record<string, string> = {
    mission_clear: 'Clear Quests',
    touch: 'Interact with Ryza',
    talk: 'Chat Conversations',
    login_bonus: 'Claim Login Bonus',
  };

  const missionDescriptions: Record<string, string> = {
    mission_clear: 'Complete main or side quests',
    touch: 'Tap Ryza to interact with her',
    talk: 'Have friendly dialogue turns with Ryza',
    login_bonus: 'Collect daily calendar rewards',
  };

  const missionDetails: Record<string, { title: string; desc: string; targetView: string }> = {
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

  function handleClaim() {
    const reward = welcome.claimGroup(currentGroup);
    if (reward) {
      toast.show(`Claimed +${reward.money} Gold, +${reward.exp} EXP!`);
    }
  }

  function handleAction(stepId: string, targetView: string) {
    welcome.mark(stepId);
    viewStore.setView(targetView);
  }
</script>

<!-- View Header -->
<Header title="Welcome Missions">
  <div class="flex items-center gap-1 bg-muted/40 p-0.5 rounded-full border border-border/30">
    <Button
      variant="ghost"
      size="sm"
      class="h-6 px-2.5 text-xs rounded-full {activeTab === 'steps'
        ? 'bg-gold text-background font-semibold hover:bg-gold/90'
        : 'text-muted-foreground'}"
      onclick={() => (activeTab = 'steps')}>
      Steps
    </Button>
    <Button
      variant="ghost"
      size="sm"
      class="h-6 px-2.5 text-xs rounded-full {activeTab === 'milestones'
        ? 'bg-gold text-background font-semibold hover:bg-gold/90'
        : 'text-muted-foreground'}"
      onclick={() => (activeTab = 'milestones')}>
      Milestones
    </Button>
  </div>
</Header>

{#if activeTab === 'steps'}
  <!-- Step Navigation Strip -->
  <div class="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/20">
    {#each groups as g, idx}
      {@const open = welcome.isOpen(g)}
      {@const done = welcome.groupDone(g)}
      {@const claimed = welcome.groupClaimed(g)}
      <Button
        variant={selectedGroupIdx === idx ? 'default' : 'outline'}
        size="sm"
        class="h-8 px-3.5 rounded-full text-xs font-semibold gap-1.5 {selectedGroupIdx === idx
          ? 'bg-gold text-background hover:bg-gold/90'
          : 'bg-card/70 border-border/40 text-foreground/80 hover:bg-card'}"
        onclick={() => (selectedGroupIdx = idx)}>
        <span>{g.title}</span>
        {#if claimed}
          <span class="text-[10px] text-leaf">✓</span>
        {:else if done}
          <span class="text-[10px] text-gold">★</span>
        {:else if !open}
          <span class="text-[10px] opacity-60">🔒 D.{g.day}</span>
        {/if}
      </Button>
    {/each}
  </div>

  <div class="flex-1 overflow-y-auto p-4 space-y-3 max-h-[70vh]">
    {#if !isCurrentGroupOpen}
      <div class="p-8 text-center bg-card/40 rounded-xl border border-border/30 space-y-2">
        <div class="text-2xl">🔒</div>
        <div class="text-sm font-semibold text-foreground">Step Locked</div>
        <div class="text-xs text-muted-foreground">
          Unlocks on Day {currentGroup.day} of your journey. Keep visiting Ryza!
        </div>
      </div>
    {:else}
      <!-- Step Reward Banner -->
      <div
        class="p-3.5 rounded-xl bg-card/75 border border-border/50 flex items-center justify-between shadow-sm">
        <div class="flex flex-col">
          <span class="text-xs font-bold text-foreground">{currentGroup.title} Reward</span>
          <span class="text-[11px] text-muted-foreground mt-0.5">300 Gold & 40 EXP</span>
        </div>
        {#if isCurrentGroupClaimed}
          <span class="text-xs font-bold text-leaf px-3 py-1 rounded-full bg-leaf/15">Claimed</span>
        {:else if isCurrentGroupDone}
          <Button
            size="sm"
            class="h-7 text-xs bg-gold text-background hover:bg-gold/90 font-bold shadow-sm"
            onclick={handleClaim}>
            Claim Reward
          </Button>
        {:else}
          <span class="text-xs text-muted-foreground px-2 py-1">In Progress</span>
        {/if}
      </div>

      <!-- Missions in current group -->
      {#each currentGroup.missions as m}
        {@const actCount = welcome.activity(m.activity)}
        {@const done = welcome.missionDone(m)}
        <Card class="border-border/50 bg-card/75 shadow-sm {done ? 'border-leaf/30 bg-leaf/5' : ''}">
          <CardContent class="p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm {done
                  ? 'bg-leaf/20 text-leaf'
                  : 'bg-gold/15 text-gold'}">
                {#if done}
                  ✓
                {:else}
                  ★
                {/if}
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-semibold {done ? 'text-foreground/70' : 'text-foreground'}">
                  {missionTitles[m.activity] || m.activity}
                </span>
                <span class="text-xs text-muted-foreground mt-0.5">
                  {missionDescriptions[m.activity] || ''}
                </span>
              </div>
            </div>
            <div class="text-xs font-mono font-semibold {done ? 'text-leaf' : 'text-gold'}">
              {Math.min(actCount, m.need)} / {m.need}
            </div>
          </CardContent>
        </Card>
      {/each}
    {/if}
  </div>
{:else}
  <!-- Milestones List -->
  <div class="flex-1 overflow-y-auto p-4 space-y-3 max-h-[70vh]">
    {#each welcome.steps as step}
      {@const info = missionDetails[step.id] || { title: step.id, desc: '', targetView: 'talk' }}
      {@const isDone = welcome.done(step.id)}
      <Card
        class="border-border/50 bg-card/75 shadow-sm transition hover:bg-card cursor-pointer {isDone
          ? 'border-leaf/30 bg-leaf/5'
          : ''}"
        onclick={() => handleAction(step.id, info.targetView)}>
        <CardContent class="p-3.5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center {isDone
                ? 'bg-leaf/20 text-leaf'
                : 'bg-gold/15 text-gold'}">
              {#if isDone}
                ✓
              {:else}
                ★
              {/if}
            </div>

            <div class="flex flex-col">
              <span
                class="text-sm font-semibold {isDone
                  ? 'text-foreground/70 line-through'
                  : 'text-foreground'}">
                {info.title}
              </span>
              <span class="text-xs text-muted-foreground mt-0.5">
                {info.desc}
              </span>
            </div>
          </div>

          <div>
            {#if isDone}
              <span class="text-xs font-bold text-leaf px-2 py-0.5 rounded-full bg-leaf/15">Done</span>
            {:else}
              <Button
                size="sm"
                variant="outline"
                class="h-7 text-xs border-gold/50 text-gold hover:bg-gold/10">
                Go
              </Button>
            {/if}
          </div>
        </CardContent>
      </Card>
    {/each}
  </div>
{/if}
