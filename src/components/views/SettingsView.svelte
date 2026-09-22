<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import Header from './Header.svelte';
  import * as Tabs from '$components/ui/tabs';

  import LlmTab from './settings/LlmTab.svelte';
  import TtsTab from './settings/TtsTab.svelte';
  import SttTab from './settings/SttTab.svelte';
  import LangTab from './settings/LangTab.svelte';
  import GameTab from './settings/GameTab.svelte';
  import AudioTab from './settings/AudioTab.svelte';
  import DataTab from './settings/DataTab.svelte';

  let activeTab = $state('llm');

  let showSaved = $state(false);
  let savedTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    // Track changes to config.lastSaved to flash the subtle saved indicator
    const _ = config.lastSaved;
    showSaved = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      showSaved = false;
    }, 1800);
  });
</script>

<!-- View Header with Subtle Auto-save Indicator -->
<Header title="Settings">
  {#if showSaved}
    <div
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-leaf/15 text-leaf border border-leaf/30 text-xs font-medium animate-in fade-in duration-200">
      <span class="inline-block size-1.5 rounded-full bg-leaf animate-pulse"></span>
      Saved
    </div>
  {/if}
</Header>

<!-- Tabs Navigation -->
<Tabs.Root bind:value={activeTab} class="flex flex-col flex-1 overflow-hidden" style="min-height: 60dvh;">
  <div class="px-3 border-b border-border/30">
    <Tabs.List variant="line" class="grid grid-cols-7 p-0.5 rounded-lg text-[11px] h-10!">
      <Tabs.Trigger value="llm">LLM</Tabs.Trigger>
      <Tabs.Trigger value="tts">TTS</Tabs.Trigger>
      <Tabs.Trigger value="stt">STT</Tabs.Trigger>
      <Tabs.Trigger value="lang">Language</Tabs.Trigger>
      <Tabs.Trigger value="game">Game</Tabs.Trigger>
      <Tabs.Trigger value="audio">Audio</Tabs.Trigger>
      <Tabs.Trigger value="data">Data</Tabs.Trigger>
    </Tabs.List>
  </div>

  <!-- Scrollable Tab Content -->
  <div class="flex-1 overflow-y-auto p-4" style="max-height: 52dvh;">
    <Tabs.Content value="llm" class="space-y-4 m-0">
      <LlmTab />
    </Tabs.Content>

    <Tabs.Content value="tts" class="space-y-4 m-0">
      <TtsTab />
    </Tabs.Content>

    <Tabs.Content value="stt" class="space-y-4 m-0">
      <SttTab />
    </Tabs.Content>

    <Tabs.Content value="lang" class="space-y-4 m-0">
      <LangTab />
    </Tabs.Content>

    <Tabs.Content value="game" class="space-y-4 m-0">
      <GameTab />
    </Tabs.Content>

    <Tabs.Content value="audio" class="space-y-4 m-0">
      <AudioTab />
    </Tabs.Content>

    <Tabs.Content value="data" class="space-y-4 m-0">
      <DataTab />
    </Tabs.Content>
  </div>
</Tabs.Root>
