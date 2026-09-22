<script lang="ts">
  import * as Sheet from '$components/ui/sheet';
  import Header from '$components/views/Header.svelte';
  import { Button } from '$components/ui/button';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { Langs } from '$lib/i18n/langs';
  import { loadLocale } from 'wuchale/load-utils';

  const languages = [
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
    { id: 'zh', label: '简体中文' },
    { id: 'id', label: 'Bahasa Indonesia' },
  ];

  const currentLang = $derived(config.get('app')?.lang || Langs.ui() || 'en');

  async function selectLanguage(langId: string) {
    config.setApp('lang', langId);
    try {
      await loadLocale(langId);
    } catch {}
    overlayStore.closeSheet('lang');
  }
</script>

<Sheet.Root bind:open={overlayStore.langSheetOpen}>
  <Sheet.Content
    side="bottom"
    class="w-full max-w-xl mx-auto bg-background/95 border border-border/60 rounded-t-2xl"
    showCloseButton={false}>
    <Header title="Language" />

    <div class="flex-1 overflow-y-auto p-4 space-y-3 max-h-[70vh]">
      <div class="flex flex-col gap-2">
        {#each languages as lang}
          {@const isActive = currentLang === lang.id}
          <Button
            variant={isActive ? 'default' : 'outline'}
            class="h-10 justify-between px-4 text-sm font-medium rounded-xl {isActive
              ? 'bg-gold text-background font-semibold hover:bg-gold/90'
              : 'bg-card/70 text-foreground/80 hover:bg-card border-border/40'}"
            onclick={() => selectLanguage(lang.id)}>
            <span>{lang.label}</span>
            {#if isActive}
              <span class="text-xs">✓</span>
            {/if}
          </Button>
        {/each}
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>
