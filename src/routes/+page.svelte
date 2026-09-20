<script lang="ts">
  import { VIEWS, viewStore } from '$lib/stores/view.svelte';
  import { useDebounceState } from '$lib/hooks/debounce.svelte';

  import * as Sheet from '$components/ui/sheet';

  import TalkView from '$components/views/TalkView.svelte';
  import WorldView from '$components/views/WorldView.svelte';
  import QuestView from '$components/views/QuestView.svelte';
  import DailyView from '$components/views/DailyView.svelte';
  import AlarmView from '$components/views/AlarmView.svelte';
  import CharaView from '$components/views/CharaView.svelte';
  import SkinView from '$components/views/SkinView.svelte';
  import MemoryView from '$components/views/MemoryView.svelte';
  import SettingsView from '$components/views/SettingsView.svelte';
  import WelcomeView from '$components/views/WelcomeView.svelte';

  let open = $state(false);

  const ANIMATION_TIMEOUT = 300;
  const debActiveView = useDebounceState(() => viewStore.activeView, ANIMATION_TIMEOUT);
  const activeView = $derived.by(() => {
    const isOpen = debActiveView.value && debActiveView.value !== 'talk';
    return isOpen ? debActiveView.value : viewStore.activeView;
  });

  function closeSheet() {
    open = false;
    viewStore.setView('talk');
  }

  $effect(() => {
    const isOpen = viewStore.activeView !== 'talk' && VIEWS.includes(viewStore.activeView);
    const setter = () => (open = isOpen);

    if (!isOpen) {
      const timeout = setTimeout(setter, ANIMATION_TIMEOUT);
      return () => clearTimeout(timeout);
    } else setter();
  });
</script>

<div class="relative size-full overflow-hidden pointer-events-none">
  <!-- TalkView is always mounted as the primary interactive overlay over Spine -->
  <div
    class="absolute inset-0 z-10 pointer-events-none {viewStore.activeView === 'talk'
      ? 'opacity-100'
      : 'opacity-0 invisible'} transition-opacity duration-200">
    <TalkView />
  </div>

  <!-- Other Views overlay on top when active -->
  <Sheet.Root {open} onOpenChange={closeSheet}>
    <Sheet.Content
      side="bottom"
      class="w-full max-w-xl mx-auto bg-background/95 border border-border/60 rounded-t-2xl"
      showCloseButton={false}>
      {#if activeView === 'world'}
        <WorldView />
      {:else if activeView === 'quest'}
        <QuestView />
      {:else if activeView === 'daily'}
        <DailyView />
      {:else if activeView === 'alarm'}
        <AlarmView />
      {:else if activeView === 'chara'}
        <CharaView />
      {:else if activeView === 'skin'}
        <SkinView />
      {:else if activeView === 'memory'}
        <MemoryView />
      {:else if activeView === 'settings'}
        <SettingsView />
      {:else if activeView === 'welcome'}
        <WelcomeView />
      {/if}
    </Sheet.Content>
  </Sheet.Root>
</div>
