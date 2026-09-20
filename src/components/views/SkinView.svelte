<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { avatarService } from '$lib/avatar/avatar-service.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardContent } from '$components/ui/card';

  interface SkinItem {
    id: string;
    hasSpine?: boolean;
    preview?: string;
  }

  let skins = $state<SkinItem[]>([]);
  let loading = $state(true);

  const currentSkin = $derived(
    String(config.section('state')?.skin || 'crf_skn_002_0001').replace(/_(01|99)$/, '')
  );

  onMount(async () => {
    try {
      const res = await fetch('/assets/_index/skins.json');
      if (res.ok) {
        const raw: SkinItem[] = await res.json();
        const seen: Record<string, SkinItem> = {};
        const list: SkinItem[] = [];

        raw.forEach((s) => {
          const oid = String(s.id).replace(/_(01|99)$/, '');
          if (seen[oid]) {
            if (s.hasSpine) seen[oid].hasSpine = true;
            if (!seen[oid].preview && s.preview) seen[oid].preview = s.preview;
            return;
          }
          seen[oid] = { id: oid, hasSpine: Boolean(s.hasSpine), preview: s.preview };
          list.push(seen[oid]);
        });
        skins = list;
      }
    } catch {
      // Fallback default skins if index json is absent
      skins = [
        { id: 'crf_skn_002_0001', hasSpine: true },
        { id: 'crf_skn_002_0002', hasSpine: true },
        { id: 'crf_skn_002_0003', hasSpine: false },
      ];
    } finally {
      loading = false;
    }
  });

  function handleEquip(outfit: SkinItem) {
    if (!outfit.hasSpine) return;
    config.set('state.skin', outfit.id);
    avatarService.loadSkin(outfit.id);
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
        onclick={() => viewStore.setView('talk')}>
        ✕
      </Button>
      <h2 class="text-lg font-bold text-gold">Costumes</h2>
    </div>

    <span class="text-xs text-muted-foreground">
      {skins.length} Outfits
    </span>
  </div>

  <!-- Outfits Grid -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if loading}
      <div class="text-center py-12 text-sm text-muted-foreground">Loading costumes...</div>
    {:else if skins.length === 0}
      <div class="text-center py-12 text-sm text-muted-foreground">No costumes found.</div>
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {#each skins as outfit}
          {@const isEquipped = currentSkin === outfit.id}
          <Card
            class="border-border/50 bg-card/75 overflow-hidden transition relative py-0 gap-0 {isEquipped
              ? 'ring-2 ring-gold bg-gold/10'
              : ''} {!outfit.hasSpine ? 'opacity-50' : 'hover:bg-card cursor-pointer'}"
            onclick={() => handleEquip(outfit)}>
            <div class="relative bg-muted/40 aspect-7/9 grid place-content-center overflow-hidden">
              <img
                src={outfit.preview || '/assets/images/chara_placeholder.png'}
                alt={outfit.id}
                class="size-full object-cover"
                onerror={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/images/chara_placeholder.png';
                }} />
              {#if isEquipped}
                <span
                  class="absolute top-2 right-2 text-[10px] font-bold text-background bg-gold px-2 py-0.5 rounded-full shadow">
                  Equipped
                </span>
              {:else if !outfit.hasSpine}
                <span
                  class="absolute top-2 right-2 text-[10px] font-medium text-muted-foreground bg-black/60 px-1.5 py-0.5 rounded">
                  Locked
                </span>
              {/if}
            </div>

            <CardContent class="p-2.5 flex flex-col items-center text-center">
              <span class="text-xs font-mono font-medium text-foreground truncate w-full">
                {outfit.id.replace('crf_skn_002_', '')}
              </span>
              <span class="text-[11px] mt-0.5 {isEquipped ? 'text-gold font-bold' : 'text-muted-foreground'}">
                {isEquipped ? 'Active' : outfit.hasSpine ? 'Wear' : 'Preview Only'}
              </span>
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}
  </div>
</div>
