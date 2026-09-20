<script lang="ts">
  import { viewStore } from '$lib/stores/view.svelte';
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
</script>

<div class="relative h-full w-full overflow-hidden">
  <!-- TalkView is always mounted as the primary interactive overlay over Spine -->
  <div class="absolute inset-0 z-10 {viewStore.activeView === 'talk' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0 invisible'} transition-opacity duration-200">
    <TalkView />
  </div>

  <!-- Other Views overlay on top when active -->
  {#if viewStore.activeView === 'world'}
    <div class="absolute inset-0 z-20">
      <WorldView />
    </div>
  {:else if viewStore.activeView === 'quest'}
    <div class="absolute inset-0 z-20">
      <QuestView />
    </div>
  {:else if viewStore.activeView === 'daily'}
    <div class="absolute inset-0 z-20">
      <DailyView />
    </div>
  {:else if viewStore.activeView === 'alarm'}
    <div class="absolute inset-0 z-20">
      <AlarmView />
    </div>
  {:else if viewStore.activeView === 'chara'}
    <div class="absolute inset-0 z-20">
      <CharaView />
    </div>
  {:else if viewStore.activeView === 'skin'}
    <div class="absolute inset-0 z-20">
      <SkinView />
    </div>
  {:else if viewStore.activeView === 'memory'}
    <div class="absolute inset-0 z-20">
      <MemoryView />
    </div>
  {:else if viewStore.activeView === 'settings'}
    <div class="absolute inset-0 z-20">
      <SettingsView />
    </div>
  {:else if viewStore.activeView === 'welcome'}
    <div class="absolute inset-0 z-20">
      <WelcomeView />
    </div>
  {/if}
</div>
