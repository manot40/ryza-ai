<script lang="ts">
  import * as Sheet from '$components/ui/sheet';
  import { Button } from '$components/ui/button';
  import { config } from '$lib/stores/config.svelte';
  import { Langs, type SupportedUiLocale } from '$lib/i18n/langs';
  import { loadLocale } from 'wuchale/load-utils';

  interface Props {
    open?: boolean;
    charaHidden?: boolean;
    onNewTalk?: () => void;
    onToggleChara?: () => void;
  }

  let { open = $bindable(false), charaHidden = false, onNewTalk, onToggleChara }: Props = $props();

  let showLangSelect = $state(false);

  const languages: { id: SupportedUiLocale; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
    { id: 'zh', label: '简体中文' },
    { id: 'id', label: 'Bahasa Indonesia' },
  ];

  async function selectLanguage(lang: SupportedUiLocale) {
    config.set('app.lang', lang);
    await loadLocale(lang);
    showLangSelect = false;
    open = false;
  }

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    open = false;
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="right"
    class="w-64 bg-background/95 backdrop-blur-md border-l border-border/60 p-4 flex flex-col justify-between">
    <div class="flex flex-col gap-4">
      <Sheet.Header class="text-left border-b border-border/40 pb-3">
        <Sheet.Title class="text-gold font-semibold text-base">Quick Actions</Sheet.Title>
        <Sheet.Description class="text-xs text-muted-foreground">
          Shortcuts and display controls
        </Sheet.Description>
      </Sheet.Header>

      {#if !showLangSelect}
        <div class="flex flex-col gap-2">
          <Button
            variant="outline"
            class="justify-start gap-3 h-11 border-border/50 hover:bg-muted/40"
            onclick={() => {
              open = false;
              onNewTalk?.();
            }}>
            <img src="/assets/icons/asterisk.svg" alt="" class="w-4 h-4 opacity-80" />
            <span>New Conversation</span>
          </Button>

          <Button
            variant="outline"
            class="justify-start gap-3 h-11 border-border/50 hover:bg-muted/40"
            onclick={() => (showLangSelect = true)}>
            <img src="/assets/icons/language.svg" alt="" class="w-4 h-4 opacity-80" />
            <span>Language</span>
          </Button>

          <Button
            variant="outline"
            class="justify-start gap-3 h-11 border-border/50 hover:bg-muted/40"
            onclick={() => {
              open = false;
              onToggleChara?.();
            }}>
            <img
              src={charaHidden ? '/assets/icons/chara_show.svg' : '/assets/icons/chara_hide.svg'}
              alt=""
              class="w-4 h-4 opacity-80" />
            <span>Toggle Character</span>
          </Button>

          <Button
            variant="outline"
            class="justify-start gap-3 h-11 border-border/50 hover:bg-muted/40"
            onclick={handleFullscreen}>
            <img src="/assets/icons/allscreen.svg" alt="" class="w-4 h-4 opacity-80" />
            <span>Toggle Fullscreen</span>
          </Button>
        </div>
      {:else}
        <div class="flex flex-col gap-2">
          <Button
            variant="ghost"
            class="justify-start text-xs text-muted-foreground hover:text-foreground mb-1"
            onclick={() => (showLangSelect = false)}>
            ← Back
          </Button>

          <div class="space-y-1">
            {#each languages as lang}
              <Button
                variant={config.section('app')?.lang === lang.id ? 'secondary' : 'ghost'}
                class="w-full justify-start text-sm {config.section('app')?.lang === lang.id
                  ? 'font-semibold text-gold'
                  : ''}"
                onclick={() => selectLanguage(lang.id)}>
                {lang.label}
              </Button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
