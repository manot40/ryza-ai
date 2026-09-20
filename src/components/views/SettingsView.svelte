<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/stores/config.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { modal } from '$lib/stores/modal.svelte';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Switch } from '$components/ui/switch';
  import * as Tabs from '$components/ui/tabs';
  import { Slider } from '$components/ui/slider';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';
  import { loadLocale } from 'wuchale/load-utils';
  import type { SupportedUiLocale } from '$lib/i18n/langs';

  let activeTab = $state('llm');

  // LLM State
  let llmBaseUrl = $state('');
  let llmModel = $state('');
  let llmApiKey = $state('');
  let llmTemp = $state(0.7);

  // TTS State
  let ttsProvider = $state('openai');
  let ttsBaseUrl = $state('');
  let ttsApiKey = $state('');
  let ttsModel = $state('');

  // Audio State
  let bgmVol = $state(0.6);
  let seVol = $state(0.8);
  let voiceVol = $state(1.0);

  // App State
  let appLang = $state<SupportedUiLocale>('en');
  let cheatMode = $state(false);

  let saveNotice = $state(false);

  onMount(() => {
    const l = config.section('llm') || {};
    const t = config.section('tts') || {};
    const a = config.section('audio') || {};
    const app = config.section('app') || {};

    llmBaseUrl = l.baseUrl || '';
    llmModel = l.model || '';
    llmApiKey = l.apiKey || '';
    llmTemp = l.temperature ?? 0.7;

    ttsProvider = t.provider || 'openai';
    ttsBaseUrl = t.baseUrl || '';
    ttsApiKey = t.apiKey || '';
    ttsModel = t.modelPreset || '';

    bgmVol = a.bgm ?? 0.6;
    seVol = a.se ?? 0.8;
    voiceVol = a.voice ?? 1.0;

    appLang = (app.lang as SupportedUiLocale) || 'en';
    cheatMode = Boolean(app.cheat);
  });

  async function handleLanguageChange(lang: SupportedUiLocale) {
    appLang = lang;
    config.set('app.lang', lang);
    await loadLocale(lang);
  }

  function handleSave() {
    config.set('llm.baseUrl', llmBaseUrl);
    config.set('llm.model', llmModel);
    config.set('llm.apiKey', llmApiKey);
    config.set('llm.temperature', llmTemp);

    config.set('tts.provider', ttsProvider);
    config.set('tts.baseUrl', ttsBaseUrl);
    config.set('tts.apiKey', ttsApiKey);
    config.set('tts.modelPreset', ttsModel);

    config.set('audio.bgm', bgmVol);
    config.set('audio.se', seVol);
    config.set('audio.voice', voiceVol);

    config.set('app.cheat', cheatMode);

    saveNotice = true;
    setTimeout(() => {
      saveNotice = false;
    }, 2000);
  }

  function handleExportConfig() {
    const data = config.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ryza-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleResetAll() {
    const ok = await modal.confirm(
      'Reset All Settings',
      'Are you sure you want to reset all settings to defaults? Your game progress will be preserved.',
      'Reset Settings',
      'Cancel'
    );
    if (ok) {
      config.reset();
      window.location.reload();
    }
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
      <h2 class="text-lg font-bold text-gold">Settings</h2>
    </div>

    <Button
      size="sm"
      class="h-8 text-xs bg-gold text-background hover:bg-gold/90 font-bold"
      onclick={handleSave}>
      Save All
    </Button>
  </div>

  <!-- Tabs Navigation -->
  <Tabs.Root bind:value={activeTab} class="flex-1 flex flex-col overflow-hidden">
    <div class="px-4 pt-2 border-b border-border/30 bg-muted/20">
      <Tabs.List class="grid grid-cols-5 h-9 bg-muted/60 p-0.5 rounded-lg text-xs">
        <Tabs.Trigger value="llm">LLM</Tabs.Trigger>
        <Tabs.Trigger value="tts">TTS</Tabs.Trigger>
        <Tabs.Trigger value="audio">Audio</Tabs.Trigger>
        <Tabs.Trigger value="app">App</Tabs.Trigger>
        <Tabs.Trigger value="data">Data</Tabs.Trigger>
      </Tabs.List>
    </div>

    <!-- Scrollable Tab Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- LLM Tab -->
      <Tabs.Content value="llm" class="space-y-4 m-0">
        <Card class="border-border/50 bg-card/75">
          <CardHeader>
            <CardTitle class="text-sm font-bold text-gold">LLM Configuration</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="space-y-1">
              <label for="settings-llm-base-url" class="text-xs font-medium text-foreground">
                API Base URL
              </label>
              <Input
                id="settings-llm-base-url"
                bind:value={llmBaseUrl}
                placeholder="https://api.openai.com/v1"
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1">
              <label for="settings-llm-model" class="text-xs font-medium text-foreground">Model Name</label>
              <Input
                id="settings-llm-model"
                bind:value={llmModel}
                placeholder="gpt-4o / claude-3-5-sonnet"
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1">
              <label for="settings-llm-api-key" class="text-xs font-medium text-foreground">API Key</label>
              <Input
                id="settings-llm-api-key"
                type="password"
                bind:value={llmApiKey}
                placeholder="sk-..."
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <label for="settings-llm-temp" class="font-medium text-foreground">Temperature</label>
                <span class="text-gold font-mono">{llmTemp}</span>
              </div>
              <Slider type="single" min={0} max={2} step={0.05} bind:value={llmTemp} class="w-full" />
            </div>
          </CardContent>
        </Card>
      </Tabs.Content>

      <!-- TTS Tab -->
      <Tabs.Content value="tts" class="space-y-4 m-0">
        <Card class="border-border/50 bg-card/75">
          <CardHeader>
            <CardTitle class="text-sm font-bold text-gold">Voice Synthesis (TTS)</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="space-y-1">
              <label for="settings-tts-provider" class="text-xs font-medium text-foreground">Provider</label>
              <Input
                id="settings-tts-provider"
                bind:value={ttsProvider}
                placeholder="openai / qwen"
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1">
              <label for="settings-tts-base-url" class="text-xs font-medium text-foreground">Base URL</label>
              <Input
                id="settings-tts-base-url"
                bind:value={ttsBaseUrl}
                placeholder="https://api.openai.com/v1"
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1">
              <label for="settings-tts-api-key" class="text-xs font-medium text-foreground">API Key</label>
              <Input
                id="settings-tts-api-key"
                type="password"
                bind:value={ttsApiKey}
                placeholder="sk-..."
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1">
              <label for="settings-tts-model" class="text-xs font-medium text-foreground">
                Voice / Model ID
              </label>
              <Input
                id="settings-tts-model"
                bind:value={ttsModel}
                placeholder="alloy / nova"
                class="h-9 text-xs" />
            </div>
          </CardContent>
        </Card>
      </Tabs.Content>

      <!-- Audio Tab -->
      <Tabs.Content value="audio" class="space-y-4 m-0">
        <Card class="border-border/50 bg-card/75">
          <CardHeader>
            <CardTitle class="text-sm font-bold text-gold">Volume Controls</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <label for="settings-audio-bgm" class="font-medium text-foreground">
                  Background Music (BGM)
                </label>
                <span class="text-gold font-mono">{Math.round(bgmVol * 100)}%</span>
              </div>
              <Slider type="single" min={0} max={1} step={0.05} bind:value={bgmVol} class="w-full" />
            </div>

            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <label for="settings-audio-voice" class="font-medium text-foreground">Voice Volume</label>
                <span class="text-gold font-mono">{Math.round(voiceVol * 100)}%</span>
              </div>
              <Slider type="single" min={0} max={1} step={0.05} bind:value={voiceVol} class="w-full" />
            </div>

            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <label for="settings-audio-se" class="font-medium text-foreground">Sound Effects (SE)</label>
                <span class="text-gold font-mono">{Math.round(seVol * 100)}%</span>
              </div>
              <Slider type="single" min={0} max={1} step={0.05} bind:value={seVol} class="w-full" />
            </div>
          </CardContent>
        </Card>
      </Tabs.Content>

      <!-- App Tab -->
      <Tabs.Content value="app" class="space-y-4 m-0">
        <Card class="border-border/50 bg-card/75">
          <CardHeader>
            <CardTitle class="text-sm font-bold text-gold">App Preferences</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2.5">
              <span class="block text-xs font-medium text-foreground">Interface Language</span>
              <div class="grid grid-cols-2 gap-2">
                {#each [{ id: 'en', label: 'English' }, { id: 'ja', label: '日本語' }, { id: 'zh', label: '简体中文' }, { id: 'id', label: 'Bahasa Indonesia' }] as l}
                  <Button
                    variant={appLang === l.id ? 'secondary' : 'outline'}
                    class="h-9 text-xs {appLang === l.id ? 'border-gold text-gold font-bold' : ''}"
                    onclick={() => handleLanguageChange(l.id as SupportedUiLocale)}>
                    {l.label}
                  </Button>
                {/each}
              </div>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-border/30">
              <div class="flex flex-col gap-1">
                <span class="text-xs font-medium text-foreground">Cheat Mode</span>
                <span class="text-[11px] text-muted-foreground">Infinite stamina and gold</span>
              </div>
              <Switch checked={cheatMode} onCheckedChange={(val) => (cheatMode = val)} />
            </div>
          </CardContent>
        </Card>
      </Tabs.Content>

      <!-- Data Tab -->
      <Tabs.Content value="data" class="space-y-4 m-0">
        <Card class="border-border/50 bg-card/75">
          <CardHeader>
            <CardTitle class="text-sm font-bold text-gold">Data Management</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <Button
              variant="outline"
              class="w-full text-xs h-9 justify-start border-border/50"
              onclick={handleExportConfig}>
              Export Settings JSON
            </Button>

            <Button
              variant="outline"
              class="w-full text-xs h-9 justify-start border-destructive/40 text-destructive hover:bg-destructive/10"
              onclick={handleResetAll}>
              Reset Settings to Defaults
            </Button>
          </CardContent>
        </Card>
      </Tabs.Content>
    </div>
  </Tabs.Root>

  {#if saveNotice}
    <div class="p-2 bg-leaf/20 border-t border-leaf/40 text-center text-xs text-foreground font-medium">
      Settings saved!
    </div>
  {/if}
</div>
