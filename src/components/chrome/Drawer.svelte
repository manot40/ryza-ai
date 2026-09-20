<script lang="ts">
  import { daily } from '$lib/stores/daily.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { Button } from '$components/ui/button';

  import * as Sheet from '$components/ui/sheet';

  interface Props {
    open?: boolean;
    activeView: string;
    onSelectView: (view: string) => void;
  }

  let { open = $bindable(false), activeView, onSelectView }: Props = $props();

  const navItems = [
    { id: 'talk', label: 'Talk', icon: '/assets/icons/chara.svg' },
    { id: 'welcome', label: 'Welcome Missions', icon: '/assets/icons/welcome_mission.svg' },
    { id: 'daily', label: 'Daily Login', icon: '/assets/icons/present.svg', hasBadge: true },
    { id: 'quest', label: 'Quests', icon: '/assets/icons/quest.svg' },
    { id: 'world', label: 'World Map', icon: '/assets/icons/clock.svg' },
    { id: 'alarm', label: 'Alarm Clock', icon: '/assets/icons/alarm.svg' },
    { id: 'chara', label: 'Character Profile', icon: '/assets/icons/profile.svg' },
    { id: 'skin', label: 'Costumes', icon: '/assets/icons/charaedit.svg' },
    { id: 'memory', label: 'Memories', icon: '/assets/icons/save_data.svg' },
    { id: 'settings', label: 'Settings', icon: '/assets/icons/charaedit.svg' },
  ];

  function handleSelect(viewId: string) {
    onSelectView(viewId);
    open = false;
  }

  function handleOpenLang() {
    open = false;
    overlayStore.openSheet('lang');
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="left"
    class="w-72 sm:w-80 bg-background/95 backdrop-blur-md border-r border-border/60 p-0 flex flex-col justify-between">
    <div class="flex flex-col overflow-y-auto">
      <Sheet.Header class="p-4 border-b border-border/40 flex flex-row items-center gap-3">
        <img
          src="/assets/images/chara_icons/ryza.png"
          alt="Ryza"
          class="w-12 h-12 rounded-full border border-gold/40 object-cover shadow-sm" />
        <div class="flex flex-col text-left">
          <Sheet.Title class="text-gold font-bold text-base leading-tight">Ryza</Sheet.Title>
          <Sheet.Description class="text-xs text-muted-foreground mt-0.5">
            Days together: {config.section('state')?.day || 1}
          </Sheet.Description>
        </div>
      </Sheet.Header>

      <nav class="p-2 space-y-1">
        {#each navItems as item}
          <Button
            variant={activeView === item.id ? 'secondary' : 'ghost'}
            class="w-full justify-start gap-3 h-10 px-3 text-sm font-medium {activeView === item.id
              ? 'bg-gold/15 text-gold font-semibold'
              : 'text-foreground/80'}"
            onclick={() => handleSelect(item.id)}>
            <img src={item.icon} alt="" class="w-5 h-5 opacity-80" />
            <span class="flex-1 text-left">{item.label}</span>
            {#if item.hasBadge && daily.available()}
              <span class="w-2 h-2 rounded-full bg-ember animate-pulse"></span>
            {/if}
          </Button>
        {/each}

        <!-- Language Sheet Action -->
        <Button
          variant="ghost"
          class="w-full justify-start gap-3 h-10 px-3 text-sm font-medium text-foreground/80 hover:bg-muted/40"
          onclick={handleOpenLang}>
          <img src="/assets/icons/language.svg" alt="" class="w-5 h-5 opacity-80" />
          <span class="flex-1 text-left">Language</span>
        </Button>
      </nav>
    </div>

    <div class="p-4 border-t border-border/30 text-xs text-muted-foreground/70 text-center">
      Offline Rebuilt Edition · No official server
    </div>
  </Sheet.Content>
</Sheet.Root>
