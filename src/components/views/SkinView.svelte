<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/stores/config.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import Header from './Header.svelte';
  import { avatarService } from '$lib/avatar/avatar-service.svelte';
  import { crfStore } from '$lib/avatar/crfstore';
  import { Button } from '$components/ui/button';
  import { Card, CardContent } from '$components/ui/card';
  import { UploadIcon } from '@lucide/svelte';

  interface SkinItem {
    id: string;
    hasSpine?: boolean;
    preview?: string | null;
    imported?: boolean;
  }

  let skins = $state<SkinItem[]>([]);
  let loading = $state(true);
  let fileInput: HTMLInputElement | null = null;

  const currentSkin = $derived(
    String(config.get('state')?.skin || 'crf_skn_002_0001').replace(/_(01|99)$/, '')
  );

  async function loadAllSkins() {
    loading = true;
    try {
      const imported = await crfStore.entries();
      const res = await fetch('/assets/_index/skins.json');
      let raw: SkinItem[] = [];
      if (res.ok) {
        raw = await res.json();
      }
      const combined: SkinItem[] = [...imported, ...raw];
      const seen: Record<string, SkinItem> = {};
      const list: SkinItem[] = [];

      combined.forEach((s) => {
        const oid = String(s.id).replace(/_(01|99)$/, '');
        if (seen[oid]) {
          if (s.hasSpine) seen[oid].hasSpine = true;
          if (!seen[oid].preview && s.preview) seen[oid].preview = s.preview;
          return;
        }
        seen[oid] = {
          id: oid,
          hasSpine: Boolean(s.hasSpine),
          preview: s.preview,
          imported: Boolean(s.imported),
        };
        list.push(seen[oid]);
      });
      skins = list;
    } catch {
      skins = [
        { id: 'crf_skn_002_0001', hasSpine: true },
        { id: 'crf_skn_002_0002', hasSpine: true },
        { id: 'crf_skn_002_0003', hasSpine: false },
      ];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadAllSkins();
  });

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    target.value = '';
    try {
      toast.show('Importing costume...');
      const v = await crfStore.importZip(file);
      config.setState('skin', v.id);
      avatarService.loadSkin(v.id);
      await loadAllSkins();
      toast.show(`Imported: ${v.id}`);
    } catch (err: unknown) {
      toast.err(`Import failed: ${(err as Error)?.message || 'Unknown error'}`);
    }
  }

  function handleEquip(outfit: SkinItem) {
    if (!outfit.hasSpine) return;
    config.setState('skin', outfit.id);
    avatarService.loadSkin(outfit.id);
  }
</script>

<input bind:this={fileInput} type="file" accept=".zip" class="hidden" onchange={handleFileSelect} />

<!-- View Header -->
<Header title="Costumes">
  <div class="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      class="h-7 text-xs flex items-center gap-1 bg-card/60 backdrop-blur-md rounded-full border-border/40 hover:bg-card/90"
      onclick={() => fileInput?.click()}>
      <UploadIcon class="size-3.5" />
      <span>Import ZIP</span>
    </Button>
    <span class="text-xs text-muted-foreground">
      {skins.length} Outfits
    </span>
  </div>
</Header>

<!-- Outfits Grid -->
<div class="flex-1 overflow-y-auto p-4 max-h-[70vh]">
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
