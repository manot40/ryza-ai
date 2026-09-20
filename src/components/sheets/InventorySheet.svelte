<script lang="ts">
  import * as Sheet from '$components/ui/sheet';
  import Header from '$components/views/Header.svelte';
  import { Button } from '$components/ui/button';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { itemName } from '$lib/stores/game-items';
  import { toast } from '$lib/stores/toast.svelte';
  import { sound } from '$lib/audio/sound';
  import {
    getBagUpgradeGoldToast,
    getBagUpgradedToast,
    getBagUpgradeFailedToast,
  } from '$lib/i18n/game-content';

  let currentBag = $derived(overlayStore.invBag);
  let items = $derived(game.bagList(currentBag));
  let used = $derived(game.bagUsed(currentBag));
  let cap = $derived(game.bagCap(currentBag));

  let nextBagTier = $derived.by(() => {
    const order = game.BAG_ORDER;
    const cur = currentBag === 'ryza' ? game.s.bagRyza : game.s.bagYou;
    const idx = order.indexOf(cur);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  });

  let upgradeCost = $derived.by(() => {
    return nextBagTier ? game.BAG_UPGRADE_COST[nextBagTier] || 0 : 0;
  });

  function switchBag(bag: 'you' | 'ryza') {
    overlayStore.invBag = bag;
  }

  function handleUpgrade() {
    if (!nextBagTier) return;
    if (!game.canPay(upgradeCost)) {
      toast.show(getBagUpgradeGoldToast(), true);
      return;
    }
    const targetTier = nextBagTier;
    const ok = game.upgradeBag(currentBag);
    if (ok) {
      sound.se('quest_clear');
      toast.show(getBagUpgradedToast(targetTier));
    } else {
      toast.show(getBagUpgradeFailedToast(), true);
    }
  }
</script>

<Sheet.Root bind:open={overlayStore.invSheetOpen}>
  <Sheet.Content
    side="bottom"
    class="w-full max-w-xl mx-auto bg-background/95 border border-border/60 rounded-t-2xl"
    showCloseButton={false}>
    <Header title="Inventory" />

    <div class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[70vh]">
      <!-- Bag Tabs -->
      <div class="flex gap-2">
        <Button
          variant={currentBag === 'you' ? 'default' : 'outline'}
          size="sm"
          class="flex-1 h-8 rounded-full text-xs {currentBag === 'you'
            ? 'bg-gold text-background font-semibold hover:bg-gold/90'
            : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'}"
          onclick={() => switchBag('you')}>
          Your Bag
        </Button>
        <Button
          variant={currentBag === 'ryza' ? 'default' : 'outline'}
          size="sm"
          class="flex-1 h-8 rounded-full text-xs {currentBag === 'ryza'
            ? 'bg-gold text-background font-semibold hover:bg-gold/90'
            : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'}"
          onclick={() => switchBag('ryza')}>
          Ryza's Bag
        </Button>
      </div>

      <!-- Items List -->
      <div class="flex flex-col gap-1.5 pr-1">
        {#if items.length === 0}
          <div class="py-8 text-center text-xs text-muted-foreground">Bag is empty</div>
        {:else}
          {#each items as item}
            <div
              class="flex items-center justify-between p-2 rounded-xl bg-card/60 border border-border/30 text-xs">
              <span class="font-medium text-foreground">{itemName(item.id)}</span>
              <span class="text-muted-foreground font-mono">×{item.count || 1}</span>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Capacity & Upgrade Footer -->
      <div class="flex items-center justify-between pt-2 border-t border-border/30 text-xs">
        <span class="text-muted-foreground">
          Capacity: <b class="text-foreground">{used}</b>
          / {cap}
        </span>

        {#if nextBagTier}
          <Button
            variant="outline"
            size="sm"
            class="h-7 px-3 rounded-full text-xs font-medium border-gold/40 bg-gold/10 hover:bg-gold/20 text-gold"
            onclick={handleUpgrade}>
            Upgrade Bag ({upgradeCost} G)
          </Button>
        {/if}
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>
