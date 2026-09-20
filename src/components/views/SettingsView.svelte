<script lang="ts">
  import type { SupportedUiLocale } from '$lib/i18n/langs';

  import { onMount } from 'svelte';
  import { loadLocale } from 'wuchale/load-utils';

  import { modal } from '$lib/stores/modal.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { sound } from '$lib/audio/sound';
  import { talkLoop } from '$lib/talk-loop.svelte';
  import {
    chat,
    speak,
    listModels,
    listQwenTtsModels,
    qwenCloneVoice,
    isPlaceholderModel,
    resolvedContext,
    QWEN_TTS_VOICES,
  } from '$lib/api';

  import Header from './Header.svelte';
  import * as Tabs from '$components/ui/tabs';
  import * as Dialog from '$components/ui/dialog';
  import { Input } from '$components/ui/input';
  import { Textarea } from '$components/ui/textarea';
  import { Button } from '$components/ui/button';
  import { Switch } from '$components/ui/switch';
  import { Slider } from '$components/ui/slider';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  let activeTab = $state('llm');

  // LLM State
  let llmBaseUrl = $state('');
  let llmModel = $state('');
  let llmApiKey = $state('');
  let llmTemp = $state(0.9);
  let llmMaxTokens = $state(400);
  let llmHistoryTurns = $state(12);
  let llmContextWindow = $state(0);
  let llmThinking = $state<'auto' | 'off' | 'on'>('auto');
  let llmThinkingEffort = $state<'default' | 'off' | 'low' | 'medium' | 'high' | 'max'>('default');
  let llmThinkingStyle = $state<'auto' | 'none' | 'openai' | 'openrouter' | 'qwen' | 'glm'>('auto');
  let llmModelsList = $state<string[]>([]);
  let isFetchingModels = $state(false);
  let isTestingLlm = $state(false);

  // TTS State
  let ttsProvider = $state<'openai' | 'openai-speech' | 'qwen'>('openai');
  let ttsProviderStyle = $state<'default' | 'audio.cpp'>('default');
  let ttsBaseUrl = $state('');
  let ttsApiKey = $state('');
  let ttsMode = $state<'clone' | 'preset' | 'off'>('clone');
  let ttsModelClone = $state('');
  let ttsModelPreset = $state('');
  let ttsPresetVoice = $state('Chloe');
  let ttsReference = $state('assets/voice/ryza_wav/prologue_08.wav');
  let ttsStyleHint = $state('明るく元気な若い女性の声。親しみやすい口調で。');
  let qwenBaseUrl = $state('');
  let qwenApiKey = $state('');
  let qwenModel = $state('qwen3-tts-flash');
  let qwenVoice = $state('Cherry');
  let qwenCloneTarget = $state('qwen3-tts-vc-2026-01-22');
  let qwenModelsList = $state<string[]>([]);
  let isFetchingQwenModels = $state(false);
  let isCloningVoice = $state(false);
  let isTestingTts = $state(false);

  // Language Matrix State
  let appLang = $state<SupportedUiLocale>('en');
  let voiceLang = $state('auto');
  let llmLang = $state('auto');
  let ttsLang = $state('auto');

  // Game / Presentation State
  let appVoice = $state(true);
  let appShowBubble = $state(true);
  let appVibration = $state(true);
  let appRim = $state(true);
  let appTextSpeed = $state(30);
  let timeMode = $state<'real' | 'flow' | 'manual'>('real');
  let flowSpeed = $state<number>(60);
  let cheatMode = $state(false);

  // Memory State
  let memoryEnabled = $state(true);
  let turnsPerSession = $state(8);
  let sessionCap = $state(8);
  let summaryCap = $state(8);

  // Audio State
  let appVolume = $state(0.9);
  let bgmVol = $state(0.55);
  let ambientVol = $state(0.45);
  let voiceVol = $state(1.0);
  let seVol = $state(0.85);

  // Data State
  let importDialogOpen = $state(false);
  let importJsonText = $state('');
  let saveNotice = $state(false);

  const estimatedContext = $derived(resolvedContext());

  function reloadFromConfig() {
    const l = config.section('llm') || {};
    const t = config.section('tts') || {};
    const v = config.section('voice') || {};
    const m = config.section('memory') || {};
    const a = config.section('audio') || {};
    const app = config.section('app') || {};

    llmBaseUrl = l.baseUrl || '';
    llmModel = l.model || 'gpt-4o-mini';
    llmApiKey = l.apiKey || '';
    llmTemp = l.temperature ?? 0.9;
    llmMaxTokens = l.maxTokens ?? 400;
    llmHistoryTurns = l.historyTurns ?? 12;
    llmContextWindow = l.contextWindow ?? 0;
    llmThinking = l.thinking || 'auto';
    llmThinkingEffort = l.thinkingEffort || 'default';
    llmThinkingStyle = l.thinkingStyle || 'auto';
    llmLang = l.lang || 'auto';

    ttsProvider = (t.provider as 'openai' | 'openai-speech' | 'qwen') || 'openai';
    ttsProviderStyle = (t.providerStyle as 'default' | 'audio.cpp') || 'default';
    ttsBaseUrl = t.baseUrl || '';
    ttsApiKey = t.apiKey || '';
    ttsMode = (t.mode as 'clone' | 'preset' | 'off') || 'clone';
    ttsModelClone = t.modelClone || 'voice-clone-model';
    ttsModelPreset = t.modelPreset || 'tts-model';
    ttsPresetVoice = t.presetVoice || 'Chloe';
    ttsReference = t.reference || 'assets/voice/ryza_wav/prologue_08.wav';
    ttsStyleHint = t.styleHint || '明るく元気な若い女性の声。親しみやすい口調で。';
    qwenBaseUrl = t.qwenBaseUrl || '';
    qwenApiKey = t.qwenApiKey || '';
    qwenModel = t.qwenModel || 'qwen3-tts-flash';
    qwenVoice = t.qwenVoice || 'Cherry';
    qwenCloneTarget = t.qwenCloneTarget || 'qwen3-tts-vc-2026-01-22';
    ttsLang = t.lang || 'auto';

    voiceLang = v.lang || 'auto';

    memoryEnabled = m.enabled !== false;
    turnsPerSession = m.turnsPerSession ?? 8;
    sessionCap = m.sessionCap ?? 8;
    summaryCap = m.summaryCap ?? 8;

    appVoice = app.voice !== false;
    appShowBubble = app.showBubble !== false;
    appVibration = app.vibration !== false;
    appRim = app.rim !== false;
    appTextSpeed = app.textSpeed ?? 30;
    timeMode = (app.timeMode as 'real' | 'flow' | 'manual') || 'real';
    flowSpeed = app.flowSpeed ?? 60;
    appLang = (app.lang as SupportedUiLocale) || 'en';
    cheatMode = Boolean(app.cheat);

    appVolume = app.volume ?? 0.9;
    bgmVol = a.bgm ?? 0.55;
    ambientVol = a.ambient ?? 0.45;
    voiceVol = a.voice ?? 1.0;
    seVol = a.se ?? 0.85;
  }

  onMount(() => {
    reloadFromConfig();
  });

  async function handleLanguageChange(lang: SupportedUiLocale) {
    appLang = lang;
    config.set('app.lang', lang);
    try {
      await loadLocale(lang);
    } catch {}
  }

  function handleTimeModeChange(mode: 'real' | 'flow' | 'manual') {
    timeMode = mode;
    config.set('app.timeMode', mode);
    if (mode === 'flow') {
      config.set('state.gameHour', new Date().getHours());
      config.set('state.gameClockAt', Date.now());
      config.set('state.todManualUntil', 0);
    }
  }

  function handleSave() {
    // LLM
    config.set('llm.baseUrl', llmBaseUrl);
    config.set('llm.model', llmModel);
    config.set('llm.apiKey', llmApiKey);
    config.set('llm.temperature', llmTemp);
    config.set('llm.maxTokens', Math.max(64, llmMaxTokens || 400));
    config.set('llm.historyTurns', Math.max(2, llmHistoryTurns || 12));
    config.set('llm.contextWindow', llmContextWindow > 0 ? llmContextWindow : 0);
    config.set('llm.thinking', llmThinking);
    config.set('llm.thinkingEffort', llmThinkingEffort);
    config.set('llm.thinkingStyle', llmThinkingStyle);
    config.set('llm.lang', llmLang);

    // TTS
    config.set('tts.provider', ttsProvider);
    config.set('tts.providerStyle', ttsProviderStyle);
    config.set('tts.mode', ttsMode);
    config.set('tts.lang', ttsLang);
    if (ttsProvider === 'qwen') {
      config.set('tts.qwenBaseUrl', qwenBaseUrl);
      config.set('tts.qwenApiKey', qwenApiKey);
      config.set('tts.qwenModel', qwenModel);
      config.set('tts.qwenVoice', qwenVoice);
      config.set('tts.qwenCloneTarget', qwenCloneTarget);
    } else {
      config.set('tts.baseUrl', ttsBaseUrl);
      config.set('tts.apiKey', ttsApiKey);
      if (ttsMode === 'clone') {
        config.set('tts.modelClone', ttsModelClone);
        config.set('tts.reference', ttsReference);
      } else if (ttsMode === 'preset') {
        config.set('tts.modelPreset', ttsModelPreset);
        config.set('tts.presetVoice', ttsPresetVoice);
      }
      config.set('tts.styleHint', ttsStyleHint);
    }

    // Language Matrix
    config.set('voice.lang', voiceLang);

    // Game Tab
    config.set('memory.enabled', memoryEnabled);
    config.set('memory.turnsPerSession', Math.max(2, turnsPerSession || 8));
    config.set('memory.sessionCap', Math.max(2, sessionCap || 8));
    config.set('memory.summaryCap', Math.max(2, summaryCap || 8));

    config.set('app.voice', appVoice);
    config.set('app.showBubble', appShowBubble);
    config.set('app.vibration', appVibration);
    config.set('app.rim', appRim);
    config.set('app.textSpeed', appTextSpeed);
    config.set('app.timeMode', timeMode);
    config.set('app.flowSpeed', flowSpeed);
    config.set('app.cheat', cheatMode);

    // Audio Tab
    config.set('app.volume', appVolume);
    config.set('audio.bgm', bgmVol);
    config.set('audio.ambient', ambientVol);
    config.set('audio.voice', voiceVol);
    config.set('audio.se', seVol);
    sound.applyVolumes();

    toast.show('Settings saved successfully!');
    saveNotice = true;
    setTimeout(() => {
      saveNotice = false;
    }, 2000);
  }

  async function handleFetchModels() {
    if (!llmBaseUrl) {
      toast.err('Please enter API Base URL first');
      return;
    }
    isFetchingModels = true;
    toast.show('Fetching models list...');
    try {
      config.set('llm.baseUrl', llmBaseUrl);
      config.set('llm.apiKey', llmApiKey);
      const list = await listModels();
      llmModelsList = list.map((m) => m.id);
      if (llmModelsList.length > 0) {
        if (!llmModel || !llmModelsList.includes(llmModel)) {
          llmModel = llmModelsList[0];
        }
        toast.show(`Found ${llmModelsList.length} models!`);
      } else {
        toast.show('No models found, enter model manually.');
      }
    } catch (e: unknown) {
      toast.err(`Failed to fetch models: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isFetchingModels = false;
    }
  }

  async function handleTestLlm() {
    if (!llmApiKey) {
      toast.err('API Key is required to test LLM');
      return;
    }
    isTestingLlm = true;
    toast.show('Testing LLM connection...');
    try {
      config.set('llm.baseUrl', llmBaseUrl);
      config.set('llm.model', llmModel);
      config.set('llm.apiKey', llmApiKey);
      config.set('llm.temperature', llmTemp);
      config.set('llm.thinking', llmThinking);
      config.set('llm.thinkingEffort', llmThinkingEffort);
      config.set('llm.thinkingStyle', llmThinkingStyle);
      const res = await chat([], '短く一言、あいさつして。', { mode: 'chat', style: 'text' });
      toast.show(`Ryza: ${res.text}`);
    } catch (e: unknown) {
      toast.err(`LLM Test Failed: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isTestingLlm = false;
    }
  }

  async function handleFetchQwenModels() {
    if (!qwenApiKey) {
      toast.err('Please enter Qwen API Key first');
      return;
    }
    isFetchingQwenModels = true;
    toast.show('Fetching Qwen models...');
    try {
      config.set('tts.qwenBaseUrl', qwenBaseUrl);
      config.set('tts.qwenApiKey', qwenApiKey);
      const list = await listQwenTtsModels();
      qwenModelsList = list.map((m) => m.id);
      if (qwenModelsList.length > 0) {
        toast.show(`Found ${qwenModelsList.length} Qwen models!`);
      } else {
        toast.show('No models returned from endpoint.');
      }
    } catch (e: unknown) {
      toast.err(`Failed to fetch Qwen models: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isFetchingQwenModels = false;
    }
  }

  async function handleQwenCloneVoice() {
    if (!qwenApiKey) {
      toast.err('Please enter Qwen API Key first');
      return;
    }
    isCloningVoice = true;
    toast.show('Cloning voice from reference sample...');
    try {
      config.set('tts.qwenBaseUrl', qwenBaseUrl);
      config.set('tts.qwenApiKey', qwenApiKey);
      config.set('tts.qwenCloneTarget', qwenCloneTarget);
      const voiceId = await qwenCloneVoice();
      qwenVoice = voiceId;
      qwenModel = qwenCloneTarget || 'qwen3-tts-vc-2026-01-22';
      toast.show('Voice successfully cloned!');
    } catch (e: unknown) {
      toast.err(`Voice cloning failed: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isCloningVoice = false;
    }
  }

  async function handleTestTts() {
    const key = ttsProvider === 'qwen' ? qwenApiKey : ttsApiKey;
    if (!key) {
      toast.err('TTS API Key is required');
      return;
    }
    const model =
      ttsProvider === 'qwen'
        ? qwenModel || 'qwen3-tts-flash'
        : ttsMode === 'clone'
          ? ttsModelClone
          : ttsModelPreset;
    if (isPlaceholderModel(model)) {
      toast.err('Please enter a valid TTS model name');
      return;
    }
    isTestingTts = true;
    toast.show('Synthesizing voice test...');
    try {
      config.set('tts.provider', ttsProvider);
      config.set('tts.providerStyle', ttsProviderStyle);
      config.set('tts.mode', ttsMode);
      if (ttsProvider === 'qwen') {
        config.set('tts.qwenBaseUrl', qwenBaseUrl);
        config.set('tts.qwenApiKey', qwenApiKey);
        config.set('tts.qwenModel', qwenModel);
        config.set('tts.qwenVoice', qwenVoice);
        config.set('tts.qwenCloneTarget', qwenCloneTarget);
      } else {
        config.set('tts.baseUrl', ttsBaseUrl);
        config.set('tts.apiKey', ttsApiKey);
        config.set('tts.modelClone', ttsModelClone);
        config.set('tts.reference', ttsReference);
        config.set('tts.modelPreset', ttsModelPreset);
        config.set('tts.presetVoice', ttsPresetVoice);
        config.set('tts.styleHint', ttsStyleHint);
      }
      const audioUrl = await speak('やあ、聞こえてる？');
      if (!audioUrl) {
        toast.show('TTS is disabled or produced no audio');
        return;
      }
      talkLoop.playUrl(audioUrl);
      toast.show('Voice synthesis test succeeded!');
    } catch (e: unknown) {
      toast.err(`TTS Test Failed: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isTestingTts = false;
    }
  }

  function handleExportConfig() {
    const data = config.exportJSON();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(data);
      toast.show('Configuration copied to clipboard!');
    }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ryza-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportSubmit() {
    if (!importJsonText.trim()) return;
    try {
      config.importJSON(importJsonText.trim());
      reloadFromConfig();
      importDialogOpen = false;
      importJsonText = '';
      toast.show('Settings imported successfully!');
    } catch (e: unknown) {
      toast.err(`Import failed: ${(e as Error)?.message || 'Invalid JSON'}`);
    }
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

<!-- View Header -->
<Header title="Settings">
  <Button
    size="sm"
    class="h-8 text-xs bg-gold text-background hover:bg-gold/90 font-bold"
    onclick={handleSave}>
    Save All
  </Button>
</Header>

<!-- Tabs Navigation -->
<Tabs.Root bind:value={activeTab} class="flex flex-col flex-1 overflow-hidden" style="min-height: 60dvh;">
  <div class="px-3 border-b border-border/30">
    <Tabs.List variant="line" class="grid grid-cols-6 p-0.5 rounded-lg text-[11px] h-10!">
      <Tabs.Trigger value="llm">LLM</Tabs.Trigger>
      <Tabs.Trigger value="tts">TTS</Tabs.Trigger>
      <Tabs.Trigger value="lang">Language</Tabs.Trigger>
      <Tabs.Trigger value="game">Game</Tabs.Trigger>
      <Tabs.Trigger value="audio">Audio</Tabs.Trigger>
      <Tabs.Trigger value="data">Data</Tabs.Trigger>
    </Tabs.List>
  </div>

  <!-- Scrollable Tab Content -->
  <div class="flex-1 overflow-y-auto p-4" style="max-height: 52dvh;">
    <!-- ============================================== LLM TAB -->
    <Tabs.Content value="llm" class="space-y-4 m-0">
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Large Language Model (LLM)</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="space-y-1.5">
            <label for="settings-llm-base-url" class="block text-xs font-medium text-foreground">
              API Base URL
            </label>
            <Input
              id="settings-llm-base-url"
              bind:value={llmBaseUrl}
              placeholder="https://api.openai.com/v1"
              class="h-9 text-xs" />
            <span class="block text-[11px] text-muted-foreground">
              OpenAI-compatible URL ending in /v1. Dev config seeds from config/providers.json.
            </span>
          </div>

          <div class="space-y-1.5">
            <label for="settings-llm-model" class="block text-xs font-medium text-foreground">
              Model Name
            </label>
            {#if llmModelsList.length > 0}
              <select
                id="settings-llm-model"
                bind:value={llmModel}
                class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {#each llmModelsList as m}
                  <option value={m}>{m}</option>
                {/each}
              </select>
            {:else}
              <Input
                id="settings-llm-model"
                bind:value={llmModel}
                placeholder="gpt-4o-mini / claude-3-5-sonnet"
                class="h-9 text-xs" />
            {/if}
            <div class="flex justify-between items-center pt-1">
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs border-gold/40 text-gold hover:bg-gold/10"
                disabled={isFetchingModels}
                onclick={handleFetchModels}>
                {isFetchingModels ? 'Fetching...' : 'Fetch Models'}
              </Button>
              <span class="text-[11px] text-muted-foreground">
                Fetch to populate dropdown or type manually
              </span>
            </div>
          </div>

          <div class="space-y-1.5">
            <label for="settings-llm-api-key" class="block text-xs font-medium text-foreground">
              API Key
            </label>
            <Input
              id="settings-llm-api-key"
              type="password"
              bind:value={llmApiKey}
              placeholder="sk-..."
              class="h-9 text-xs" />
            <span class="block text-[11px] text-muted-foreground">Stored only in local storage</span>
          </div>

          <div class="space-y-2 pt-1">
            <div class="flex justify-between text-xs">
              <label for="settings-llm-temp" class="font-medium text-foreground">Temperature</label>
              <span class="text-gold font-mono">{llmTemp}</span>
            </div>
            <Slider type="single" min={0} max={2} step={0.05} bind:value={llmTemp} class="w-full" />
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <div class="space-y-1">
              <label for="settings-llm-max-tokens" class="block text-xs font-medium text-foreground">
                Max Tokens
              </label>
              <Input
                id="settings-llm-max-tokens"
                type="number"
                min="64"
                bind:value={llmMaxTokens}
                class="h-9 text-xs" />
            </div>
            <div class="space-y-1">
              <label for="settings-llm-history-turns" class="block text-xs font-medium text-foreground">
                History Turns
              </label>
              <Input
                id="settings-llm-history-turns"
                type="number"
                min="2"
                bind:value={llmHistoryTurns}
                class="h-9 text-xs" />
            </div>
          </div>

          <div class="space-y-1.5 pt-1">
            <label for="settings-llm-context" class="block text-xs font-medium text-foreground">
              Context Window (tokens)
            </label>
            <Input
              id="settings-llm-context"
              type="number"
              min="0"
              bind:value={llmContextWindow}
              placeholder="0 (auto)"
              class="h-9 text-xs" />
            <span class="block text-[11px] text-muted-foreground">
              0 = guess from model id. Auto resolved: {estimatedContext} tokens.
            </span>
          </div>

          <div class="space-y-2 pt-2 border-t border-border/30">
            <span class="block text-xs font-semibold text-gold">Reasoning & Thinking</span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div class="space-y-1">
                <label for="settings-llm-thinking" class="block text-[11px] font-medium text-foreground">
                  Thinking Mode
                </label>
                <select
                  id="settings-llm-thinking"
                  bind:value={llmThinking}
                  class="h-8 w-full rounded-md border border-border/50 bg-background/80 px-2 py-0.5 text-xs text-foreground">
                  <option value="auto">Auto</option>
                  <option value="off">Off</option>
                  <option value="on">On</option>
                </select>
              </div>

              <div class="space-y-1">
                <label
                  for="settings-llm-thinking-effort"
                  class="block text-[11px] font-medium text-foreground">
                  Effort
                </label>
                <select
                  id="settings-llm-thinking-effort"
                  bind:value={llmThinkingEffort}
                  class="h-8 w-full rounded-md border border-border/50 bg-background/80 px-2 py-0.5 text-xs text-foreground">
                  <option value="default">Default</option>
                  <option value="off">Off</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="max">Max</option>
                </select>
              </div>

              <div class="space-y-1">
                <label
                  for="settings-llm-thinking-style"
                  class="block text-[11px] font-medium text-foreground">
                  Protocol Style
                </label>
                <select
                  id="settings-llm-thinking-style"
                  bind:value={llmThinkingStyle}
                  class="h-8 w-full rounded-md border border-border/50 bg-background/80 px-2 py-0.5 text-xs text-foreground">
                  <option value="auto">Auto</option>
                  <option value="none">None</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="qwen">Qwen</option>
                  <option value="glm">GLM</option>
                </select>
              </div>
            </div>
          </div>

          <div class="pt-2">
            <Button
              variant="outline"
              size="sm"
              class="w-full text-xs h-8 font-semibold border-gold/50 text-gold hover:bg-gold/10"
              disabled={isTestingLlm}
              onclick={handleTestLlm}>
              {isTestingLlm ? 'Testing...' : '💬 Test Chat (Connection Check)'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Tabs.Content>

    <!-- ============================================== TTS TAB -->
    <Tabs.Content value="tts" class="space-y-4 m-0">
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Voice Synthesis (TTS)</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="space-y-1.5">
            <label for="settings-tts-provider" class="block text-xs font-medium text-foreground">
              Service Provider
            </label>
            <select
              id="settings-tts-provider"
              bind:value={ttsProvider}
              class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="openai">OpenAI Compatible (Chat/Voice Clone)</option>
              <option value="openai-speech">OpenAI Audio Speech (/v1/audio/speech)</option>
              <option value="qwen">DashScope / Qwen TTS</option>
            </select>
          </div>

          {#if ttsProvider === 'openai-speech'}
            <div class="space-y-1.5">
              <label for="settings-tts-provider-style" class="block text-xs font-medium text-foreground">
                Request Payload Style
              </label>
              <select
                id="settings-tts-provider-style"
                bind:value={ttsProviderStyle}
                class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground shadow-xs">
                <option value="default">Standard /v1/audio/speech</option>
                <option value="audio.cpp">audio.cpp Compatible</option>
              </select>
            </div>
          {/if}

          <!-- Qwen Provider Specific Fields -->
          {#if ttsProvider === 'qwen'}
            <div class="space-y-1.5">
              <label for="settings-qwen-base-url" class="block text-xs font-medium text-foreground">
                Qwen Base URL
              </label>
              <Input
                id="settings-qwen-base-url"
                bind:value={qwenBaseUrl}
                placeholder="Leave empty for public DashScope endpoint"
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1.5">
              <label for="settings-qwen-api-key" class="block text-xs font-medium text-foreground">
                Qwen API Key
              </label>
              <Input
                id="settings-qwen-api-key"
                type="password"
                bind:value={qwenApiKey}
                placeholder="DashScope API Key"
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1.5">
              <label for="settings-qwen-model" class="block text-xs font-medium text-foreground">
                Qwen Model ID
              </label>
              {#if qwenModelsList.length > 0}
                <select
                  id="settings-qwen-model"
                  bind:value={qwenModel}
                  class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
                  {#each qwenModelsList as m}
                    <option value={m}>{m}</option>
                  {/each}
                </select>
              {:else}
                <Input
                  id="settings-qwen-model"
                  bind:value={qwenModel}
                  placeholder="qwen3-tts-flash / qwen3-tts-vc-2026-01-22"
                  class="h-9 text-xs" />
              {/if}
              <div class="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs border-gold/40 text-gold hover:bg-gold/10"
                  disabled={isFetchingQwenModels}
                  onclick={handleFetchQwenModels}>
                  {isFetchingQwenModels ? 'Fetching...' : 'Fetch Qwen Models'}
                </Button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label for="settings-qwen-voice" class="block text-xs font-medium text-foreground">
                Voice ID or Preset
              </label>
              <select
                id="settings-qwen-voice"
                bind:value={qwenVoice}
                class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
                {#each QWEN_TTS_VOICES as v}
                  <option value={v}>{v}</option>
                {/each}
                {#if !QWEN_TTS_VOICES.includes(qwenVoice as any) && qwenVoice}
                  <option value={qwenVoice}>{qwenVoice} (Custom / Cloned)</option>
                {/if}
              </select>
            </div>

            <div class="space-y-1.5">
              <label for="settings-qwen-clone-target" class="block text-xs font-medium text-foreground">
                Voice Clone Target Model
              </label>
              <Input
                id="settings-qwen-clone-target"
                bind:value={qwenCloneTarget}
                placeholder="qwen3-tts-vc-2026-01-22"
                class="h-9 text-xs" />
              <div class="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs border-gold/40 text-gold hover:bg-gold/10"
                  disabled={isCloningVoice}
                  onclick={handleQwenCloneVoice}>
                  {isCloningVoice ? 'Cloning...' : 'Clone Voice from Ryza Sample'}
                </Button>
              </div>
            </div>

            <div class="space-y-1.5 pt-1">
              <label for="settings-tts-mode-qwen" class="block text-xs font-medium text-foreground">
                Voice Mode
              </label>
              <select
                id="settings-tts-mode-qwen"
                bind:value={ttsMode}
                class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
                <option value="clone">Voice Clone</option>
                <option value="off">Off (Disabled)</option>
              </select>
            </div>
          {:else}
            <!-- OpenAI / OpenAI-Speech Fields -->
            <div class="space-y-1.5">
              <label for="settings-tts-base-url" class="block text-xs font-medium text-foreground">
                TTS Base URL
              </label>
              <Input
                id="settings-tts-base-url"
                bind:value={ttsBaseUrl}
                placeholder="https://api.openai.com/v1"
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1.5">
              <label for="settings-tts-api-key" class="block text-xs font-medium text-foreground">
                TTS API Key
              </label>
              <Input
                id="settings-tts-api-key"
                type="password"
                bind:value={ttsApiKey}
                placeholder="sk-..."
                class="h-9 text-xs" />
            </div>

            <div class="space-y-1.5">
              <label for="settings-tts-mode" class="block text-xs font-medium text-foreground">
                TTS Mode
              </label>
              <select
                id="settings-tts-mode"
                bind:value={ttsMode}
                class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
                <option value="clone">Voice Clone (Ryza's original voice)</option>
                <option value="preset">Preset Voice</option>
                <option value="off">Off (Disabled)</option>
              </select>
            </div>

            {#if ttsMode === 'clone'}
              <div class="space-y-1.5">
                <label for="settings-tts-model-clone" class="block text-xs font-medium text-foreground">
                  Voice Clone Model ID
                </label>
                <Input
                  id="settings-tts-model-clone"
                  bind:value={ttsModelClone}
                  placeholder="voice-clone-model"
                  class="h-9 text-xs" />
              </div>

              <div class="space-y-1.5">
                <label for="settings-tts-reference" class="block text-xs font-medium text-foreground">
                  Reference Audio Path
                </label>
                <Input
                  id="settings-tts-reference"
                  bind:value={ttsReference}
                  placeholder="assets/voice/ryza_wav/prologue_08.wav"
                  class="h-9 text-xs" />
              </div>
            {:else if ttsMode === 'preset'}
              <div class="space-y-1.5">
                <label for="settings-tts-model-preset" class="block text-xs font-medium text-foreground">
                  Preset Model ID
                </label>
                <Input
                  id="settings-tts-model-preset"
                  bind:value={ttsModelPreset}
                  placeholder="tts-1 / tts-model"
                  class="h-9 text-xs" />
              </div>

              <div class="space-y-1.5">
                <label for="settings-tts-preset-voice" class="block text-xs font-medium text-foreground">
                  Preset Voice Name
                </label>
                <Input
                  id="settings-tts-preset-voice"
                  bind:value={ttsPresetVoice}
                  placeholder="alloy / Chloe / nova"
                  class="h-9 text-xs" />
              </div>
            {/if}

            <div class="space-y-1.5">
              <label for="settings-tts-style-hint" class="block text-xs font-medium text-foreground">
                Voice Style Hint
              </label>
              <Input
                id="settings-tts-style-hint"
                bind:value={ttsStyleHint}
                placeholder="明るく元気な若い女性の声。親しみやすい口調で。"
                class="h-9 text-xs" />
              <span class="block text-[11px] text-muted-foreground">
                Sets voice personality; delivery tone (ASMR whisper, story) layers on top automatically.
              </span>
            </div>
          {/if}

          <div class="pt-2">
            <Button
              variant="outline"
              size="sm"
              class="w-full text-xs h-8 font-semibold border-gold/50 text-gold hover:bg-gold/10"
              disabled={isTestingTts}
              onclick={handleTestTts}>
              {isTestingTts ? 'Synthesizing...' : '🔊 Test Voice (Audio Check)'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Tabs.Content>

    <!-- ============================================== LANGUAGE TAB -->
    <Tabs.Content value="lang" class="space-y-4 m-0">
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">4-Axis Language Matrix</CardTitle>
          <span class="text-[11px] text-muted-foreground">
            Configure UI strings, shipped voice recordings, character replies, and TTS speech independently.
          </span>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- 1. UI Language -->
          <div class="space-y-1.5">
            <span class="block text-xs font-semibold text-foreground">Interface Language (UI)</span>
            <div class="grid grid-cols-2 gap-2">
              {#each [{ id: 'en', label: 'English' }, { id: 'ja', label: '日本語' }, { id: 'zh', label: '简体中文' }, { id: 'id', label: 'Bahasa Indonesia' }] as l}
                <Button
                  variant={appLang === l.id ? 'secondary' : 'outline'}
                  class="h-8 text-xs {appLang === l.id ? 'border-gold text-gold font-bold' : ''}"
                  onclick={() => handleLanguageChange(l.id as SupportedUiLocale)}>
                  {l.label}
                </Button>
              {/each}
            </div>
          </div>

          <!-- 2. Recorded Voice Language -->
          <div class="space-y-1.5 pt-2 border-t border-border/30">
            <label for="settings-lang-voice" class="block text-xs font-semibold text-foreground">
              Recorded Voice Packs
            </label>
            <select
              id="settings-lang-voice"
              bind:value={voiceLang}
              class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
              <option value="auto">Auto (Follow Interface)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="en">English</option>
              <option value="zh">简体中文 (Chinese)</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
            <span class="block text-[11px] text-muted-foreground">
              Language used for shipped sound clips and alarm wake-up voices.
            </span>
          </div>

          <!-- 3. Ryza Replies / Character Chat Text -->
          <div class="space-y-1.5 pt-2 border-t border-border/30">
            <label for="settings-lang-llm" class="block text-xs font-semibold text-foreground">
              Ryza Replies (Character Chat Text)
            </label>
            <select
              id="settings-lang-llm"
              bind:value={llmLang}
              class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
              <option value="auto">Auto (Follow Interface)</option>
              <option value="ja">日本語 (Japanese — Recommended for character authenticity)</option>
              <option value="en">English</option>
              <option value="zh">简体中文 (Chinese)</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
            <span class="block text-[11px] text-muted-foreground">
              The language Ryza writes in the dialogue text. Set to 日本語 to keep dialogue Japanese
              regardless of UI language.
            </span>
          </div>

          <!-- 4. Speech Synthesis Language -->
          <div class="space-y-1.5 pt-2 border-t border-border/30">
            <label for="settings-lang-tts" class="block text-xs font-semibold text-foreground">
              Speech Synthesis Language (TTS)
            </label>
            <select
              id="settings-lang-tts"
              bind:value={ttsLang}
              class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
              <option value="auto">Auto (Same as Ryza Replies)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="en">English</option>
              <option value="zh">简体中文 (Chinese)</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
            <span class="block text-[11px] text-muted-foreground">
              If speech language differs from Ryza replies, the line will be automatically translated by the
              LLM before sending to TTS.
            </span>
          </div>
        </CardContent>
      </Card>
    </Tabs.Content>

    <!-- ============================================== GAME TAB -->
    <Tabs.Content value="game" class="space-y-4 m-0">
      <!-- Presentation & Feedback -->
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Presentation & Feedback</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-medium text-foreground">Voice Playback</span>
              <span class="text-[11px] text-muted-foreground">Master audio voice toggle</span>
            </div>
            <Switch checked={appVoice} onCheckedChange={(val) => (appVoice = val)} />
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border/20">
            <div class="flex flex-col">
              <span class="text-xs font-medium text-foreground">Show Speech Bubble</span>
              <span class="text-[11px] text-muted-foreground">Talk bubbles over the stage</span>
            </div>
            <Switch checked={appShowBubble} onCheckedChange={(val) => (appShowBubble = val)} />
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border/20">
            <div class="flex flex-col">
              <span class="text-xs font-medium text-foreground">Vibration</span>
              <span class="text-[11px] text-muted-foreground">Haptic feedback on taps and events</span>
            </div>
            <Switch checked={appVibration} onCheckedChange={(val) => (appVibration = val)} />
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border/20">
            <div class="flex flex-col">
              <span class="text-xs font-medium text-foreground">Rim Light</span>
              <span class="text-[11px] text-muted-foreground">Character edge lighting shader</span>
            </div>
            <Switch checked={appRim} onCheckedChange={(val) => (appRim = val)} />
          </div>

          <div class="space-y-1.5 pt-2 border-t border-border/20">
            <span class="block text-xs font-medium text-foreground">Text Typewriter Speed</span>
            <div class="grid grid-cols-4 gap-1.5">
              {#each [{ v: 30, t: '1x (Slow)' }, { v: 18, t: '1.5x' }, { v: 12, t: '2x' }, { v: 8, t: '3x (Fast)' }] as s}
                <Button
                  variant={appTextSpeed === s.v ? 'secondary' : 'outline'}
                  size="sm"
                  class="h-7 text-[11px] {appTextSpeed === s.v ? 'border-gold text-gold font-bold' : ''}"
                  onclick={() => (appTextSpeed = s.v)}>
                  {s.t}
                </Button>
              {/each}
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Time Passage -->
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Time Passage</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="space-y-1.5">
            <label for="settings-time-mode" class="block text-xs font-medium text-foreground">
              Time Mode
            </label>
            <select
              id="settings-time-mode"
              bind:value={timeMode}
              onchange={(e) => handleTimeModeChange(e.currentTarget.value as 'real' | 'flow' | 'manual')}
              class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
              <option value="real">Real Clock (Follows device system time)</option>
              <option value="flow">In-Game Flow (Simulated time progression)</option>
              <option value="manual">Manual Only (TOD toggle in top bar)</option>
            </select>
          </div>

          {#if timeMode === 'flow'}
            <div class="space-y-1.5">
              <label for="settings-flow-speed" class="block text-xs font-medium text-foreground">
                In-Game Flow Speed
              </label>
              <select
                id="settings-flow-speed"
                bind:value={flowSpeed}
                class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
                <option value={15}>Slow (1 real min = 15 game mins)</option>
                <option value={60}>Standard (1 real min = 1 game hr)</option>
                <option value={180}>Fast (1 real min = 3 game hrs)</option>
                <option value={360}>Very Fast (1 real min = 6 game hrs)</option>
              </select>
            </div>
          {/if}
        </CardContent>
      </Card>

      <!-- Long Term Memory -->
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Long Term Memory</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-medium text-foreground">Enable Memory Summaries</span>
              <span class="text-[11px] text-muted-foreground">Fold sessions into summary cards</span>
            </div>
            <Switch checked={memoryEnabled} onCheckedChange={(val) => (memoryEnabled = val)} />
          </div>

          <div class="grid grid-cols-3 gap-2 pt-2 border-t border-border/20">
            <div class="space-y-1">
              <label for="settings-memory-turns" class="block text-[11px] font-medium text-foreground">
                Turns / Session
              </label>
              <Input
                id="settings-memory-turns"
                type="number"
                min="2"
                bind:value={turnsPerSession}
                class="h-8 text-xs" />
            </div>
            <div class="space-y-1">
              <label for="settings-memory-session-cap" class="block text-[11px] font-medium text-foreground">
                Session Cap
              </label>
              <Input
                id="settings-memory-session-cap"
                type="number"
                min="2"
                bind:value={sessionCap}
                class="h-8 text-xs" />
            </div>
            <div class="space-y-1">
              <label for="settings-memory-summary-cap" class="block text-[11px] font-medium text-foreground">
                Summary Cap
              </label>
              <Input
                id="settings-memory-summary-cap"
                type="number"
                min="2"
                bind:value={summaryCap}
                class="h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Game Balance / Cheats -->
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Game Balance</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-medium text-foreground">Cheat Mode</span>
              <span class="text-[11px] text-muted-foreground">Infinite stamina (🍎∞) and coins</span>
            </div>
            <Switch checked={cheatMode} onCheckedChange={(val) => (cheatMode = val)} />
          </div>
        </CardContent>
      </Card>
    </Tabs.Content>

    <!-- ============================================== AUDIO TAB -->
    <Tabs.Content value="audio" class="space-y-4 m-0">
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Volume Controls</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <label for="settings-audio-master" class="font-medium text-foreground">Master Volume</label>
              <span class="text-gold font-mono">{Math.round(appVolume * 100)}%</span>
            </div>
            <Slider
              type="single"
              min={0}
              max={1}
              step={0.05}
              bind:value={appVolume}
              onValueChange={() => {
                config.set('app.volume', appVolume);
                sound.applyVolumes();
              }}
              class="w-full" />
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <label for="settings-audio-bgm" class="font-medium text-foreground">
                Background Music (BGM)
              </label>
              <span class="text-gold font-mono">{Math.round(bgmVol * 100)}%</span>
            </div>
            <Slider
              type="single"
              min={0}
              max={1}
              step={0.05}
              bind:value={bgmVol}
              onValueChange={() => {
                config.set('audio.bgm', bgmVol);
                sound.applyVolumes();
              }}
              class="w-full" />
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <label for="settings-audio-ambient" class="font-medium text-foreground">Ambient Sound</label>
              <span class="text-gold font-mono">{Math.round(ambientVol * 100)}%</span>
            </div>
            <Slider
              type="single"
              min={0}
              max={1}
              step={0.05}
              bind:value={ambientVol}
              onValueChange={() => {
                config.set('audio.ambient', ambientVol);
                sound.applyVolumes();
              }}
              class="w-full" />
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <label for="settings-audio-voice" class="font-medium text-foreground">Voice Volume</label>
              <span class="text-gold font-mono">{Math.round(voiceVol * 100)}%</span>
            </div>
            <Slider
              type="single"
              min={0}
              max={1}
              step={0.05}
              bind:value={voiceVol}
              onValueChange={() => {
                config.set('audio.voice', voiceVol);
              }}
              class="w-full" />
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <label for="settings-audio-se" class="font-medium text-foreground">Sound Effects (SE)</label>
              <span class="text-gold font-mono">{Math.round(seVol * 100)}%</span>
            </div>
            <Slider
              type="single"
              min={0}
              max={1}
              step={0.05}
              bind:value={seVol}
              onValueChange={() => {
                config.set('audio.se', seVol);
              }}
              class="w-full" />
          </div>
        </CardContent>
      </Card>
    </Tabs.Content>

    <!-- ============================================== DATA TAB -->
    <Tabs.Content value="data" class="space-y-4 m-0">
      <Card class="border-border/50 bg-card/75">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-bold text-gold">Data Management</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <Button
            variant="outline"
            class="w-full text-xs h-9 justify-start border-border/50"
            onclick={handleExportConfig}>
            📥 Export Settings JSON (Copy & Download)
          </Button>

          <Button
            variant="outline"
            class="w-full text-xs h-9 justify-start border-border/50"
            onclick={() => {
              importJsonText = '';
              importDialogOpen = true;
            }}>
            📤 Import Settings JSON...
          </Button>

          <Button
            variant="outline"
            class="w-full text-xs h-9 justify-start border-destructive/40 text-destructive hover:bg-destructive/10"
            onclick={handleResetAll}>
            ⚠️ Reset All Settings to Defaults
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

<!-- Import JSON Dialog -->
<Dialog.Root bind:open={importDialogOpen}>
  <Dialog.Content class="sm:max-w-md bg-card/95 border-border/60">
    <Dialog.Header>
      <Dialog.Title class="text-sm font-bold text-gold">Import Configuration JSON</Dialog.Title>
      <Dialog.Description class="text-xs text-muted-foreground">
        Paste exported configuration JSON below to restore settings.
      </Dialog.Description>
    </Dialog.Header>
    <div class="py-2">
      <Textarea
        bind:value={importJsonText}
        placeholder={'{ "llm": { ... }, "tts": { ... } }'}
        rows={8}
        class="text-xs font-mono resize-none" />
    </div>
    <Dialog.Footer class="gap-2 sm:gap-0">
      <Button variant="outline" size="sm" class="text-xs" onclick={() => (importDialogOpen = false)}>
        Cancel
      </Button>
      <Button
        size="sm"
        class="text-xs bg-gold text-background hover:bg-gold/90 font-semibold"
        onclick={handleImportSubmit}>
        Apply Configuration
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
