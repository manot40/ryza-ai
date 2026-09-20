<script lang="ts">
  import { onMount } from 'svelte';
  import { daily, REWARDS } from '$lib/stores/daily.svelte';
  import Header from './Header.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardContent } from '$components/ui/card';

  let streak = $state(0);
  let canClaim = $state(false);
  let claimedDays = $state<number[]>([]);
  let claimNotice = $state('');

  function refresh() {
    daily.load();
    streak = daily.streak();
    canClaim = daily.available();
    claimedDays = daily.s.claimedDays || [];
  }

  onMount(() => {
    refresh();
  });

  const rewardEnglishLabels = [
    'Full Stamina Recovery',
    '120 Gold',
    'Distilled Water ×3',
    'EXP +60',
    '300 Gold + EXP 100 + Full Heal',
    'Stamina Apple ×1',
    'Treasure Chest: 500 Gold + Relic',
  ];

  function handleClaim() {
    if (!canClaim) return;
    const res = daily.claim();
    if (res.ok) {
      claimNotice = `Claimed: ${res.text || 'Daily reward received!'}`;
      refresh();
    }
  }
</script>

<!-- View Header -->
<Header title="Daily Login">
  <div class="text-xs text-muted-foreground">
    Streak: <span class="font-bold text-gold">{streak}</span>
    Days
  </div>
</Header>

<!-- Scrollable 7-Day Calendar Grid -->
<div class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[70vh]">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
    {#each REWARDS as reward, idx}
      {@const isClaimed = claimedDays.includes(idx)}
      {@const isCurrent = canClaim && idx === streak % 7}
      <Card
        class="border-border/50 bg-card/75 transition relative overflow-hidden {isCurrent
          ? 'ring-2 ring-gold bg-gold/10'
          : ''} {isClaimed ? 'opacity-60' : ''}">
        <CardContent class="p-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm {isClaimed
                ? 'bg-muted text-muted-foreground'
                : isCurrent
                  ? 'bg-gold text-background'
                  : 'bg-card border border-border/60 text-foreground'}">
              {reward.day}
            </div>
            <div class="flex flex-col">
              <span class="text-xs font-semibold text-foreground">
                Day {reward.day}
              </span>
              <span class="text-xs text-muted-foreground mt-0.5">
                {rewardEnglishLabels[idx] || reward.text}
              </span>
            </div>
          </div>

          {#if isClaimed}
            <span class="text-xs font-bold text-leaf px-2 py-0.5 rounded-full bg-leaf/15">Claimed</span>
          {:else if isCurrent}
            <span class="text-xs font-bold text-gold animate-pulse">Ready!</span>
          {/if}
        </CardContent>
      </Card>
    {/each}
  </div>

  {#if claimNotice}
    <div
      class="p-3 rounded-md bg-leaf/20 border border-leaf/40 text-xs text-foreground font-medium text-center">
      {claimNotice}
    </div>
  {/if}
</div>

<!-- Claim Button Footer -->
<div class="p-4 border-t border-border/40 bg-card/40">
  <Button
    class="w-full h-11 text-base font-bold {canClaim
      ? 'bg-gold text-background hover:bg-gold/90 shadow-md'
      : 'bg-muted text-muted-foreground'}"
    disabled={!canClaim}
    onclick={handleClaim}>
    {canClaim ? "Claim Today's Reward" : 'Already Claimed Today'}
  </Button>
</div>
