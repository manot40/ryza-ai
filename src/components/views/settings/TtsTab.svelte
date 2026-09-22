<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { talkLoop } from '$lib/talk-loop.svelte';
  import { speak, listQwenTtsModels, qwenCloneVoice, fishCloneVoice, QWEN_TTS_VOICES } from '$lib/api';
  import { Input } from '$components/ui/input';
  import { Button } from '$components/ui/button';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  const tts = $derived(config.get('tts'));

  let qwenModelsList = $state<string[]>([]);
  let isFetchingQwenModels = $state(false);
  let isCloningVoice = $state(false);
  let isCloningFish = $state(false);
  let isTestingTts = $state(false);

  async function handleFetchQwenModels() {
    if (!tts.qwenApiKey) {
      toast.err('Please enter Qwen API Key first');
      return;
    }
    isFetchingQwenModels = true;
    toast.show('Fetching Qwen models...');
    try {
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
    if (!tts.qwenApiKey) {
      toast.err('Please enter Qwen API Key first');
      return;
    }
    isCloningVoice = true;
    toast.show('Cloning voice from reference sample...');
    try {
      const voiceId = await qwenCloneVoice();
      config.setTTS({
        qwenVoice: voiceId,
        qwenModel: tts.qwenCloneTarget || 'qwen3-tts-vc-2026-01-22',
      });
      toast.show('Voice successfully cloned!');
    } catch (e: unknown) {
      toast.err(`Voice cloning failed: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isCloningVoice = false;
    }
  }

  async function handleFishCloneVoice() {
    if (!tts.fishApiKey) {
      toast.err('Fish Audio API Key is required');
      return;
    }
    isCloningFish = true;
    toast.show('Cloning Ryza voice via Fish Audio...');
    try {
      const vid = await fishCloneVoice();
      config.setTTS('fishVoice', vid);
      toast.show('Voice successfully cloned to Fish Audio!');
    } catch (e: unknown) {
      toast.err(`Fish Audio clone failed: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isCloningFish = false;
    }
  }

  async function handleTestTts() {
    if (tts.provider === 'qwen' && !tts.qwenApiKey) {
      toast.err('Qwen API Key is required');
      return;
    }
    if (tts.provider === 'fish' && !tts.fishApiKey) {
      toast.err('Fish Audio API Key is required');
      return;
    }
    if ((tts.provider === 'openai' || tts.provider === 'openai-speech') && !tts.apiKey) {
      toast.err('TTS API Key is required');
      return;
    }
    isTestingTts = true;
    toast.show('Synthesizing voice test...');
    try {
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
</script>

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
        value={tts.provider}
        onchange={(e) => config.setTTS('provider', (e.target as HTMLSelectElement).value)}
        class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
        <option value="openai">OpenAI Compatible (Chat/Voice Clone)</option>
        <option value="openai-speech">OpenAI Audio Speech (/v1/audio/speech)</option>
        <option value="qwen">DashScope / Qwen TTS</option>
        <option value="fish">Fish Audio (api.fish.audio)</option>
        <option value="voicevox">VOICEVOX (Local Engine)</option>
        <option value="aivis">AivisSpeech (Local Engine)</option>
      </select>
    </div>

    {#if tts.provider === 'openai-speech'}
      <div class="space-y-1.5">
        <label for="settings-tts-provider-style" class="block text-xs font-medium text-foreground">
          Request Payload Style
        </label>
        <select
          id="settings-tts-provider-style"
          value={tts.providerStyle || 'default'}
          onchange={(e) => config.setTTS('providerStyle', (e.target as HTMLSelectElement).value)}
          class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground shadow-xs">
          <option value="default">Standard /v1/audio/speech</option>
          <option value="audio.cpp">audio.cpp Compatible</option>
        </select>
      </div>
    {/if}

    <!-- Qwen Provider Specific Fields -->
    {#if tts.provider === 'qwen'}
      <div class="space-y-1.5">
        <label for="settings-qwen-base-url" class="block text-xs font-medium text-foreground">
          Qwen Base URL
        </label>
        <Input
          id="settings-qwen-base-url"
          value={tts.qwenBaseUrl}
          oninput={(e) => config.setTTS('qwenBaseUrl', (e.target as HTMLInputElement).value)}
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
          value={tts.qwenApiKey}
          oninput={(e) => config.setTTS('qwenApiKey', (e.target as HTMLInputElement).value)}
          placeholder="sk-..."
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1.5">
        <label for="settings-qwen-model" class="block text-xs font-medium text-foreground">
          Qwen Model Name
        </label>
        <Input
          id="settings-qwen-model"
          value={tts.qwenModel}
          oninput={(e) => config.setTTS('qwenModel', (e.target as HTMLInputElement).value)}
          placeholder="qwen3-tts-flash"
          class="h-9 text-xs" />
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
          value={tts.qwenVoice}
          onchange={(e) => config.setTTS('qwenVoice', (e.target as HTMLSelectElement).value)}
          class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
          {#each QWEN_TTS_VOICES as v}
            <option value={v}>{v}</option>
          {/each}
          {#if !QWEN_TTS_VOICES.includes(tts.qwenVoice as (typeof QWEN_TTS_VOICES)[number]) && tts.qwenVoice}
            <option value={tts.qwenVoice}>{tts.qwenVoice} (Custom / Cloned)</option>
          {/if}
        </select>
      </div>

      <div class="space-y-1.5">
        <label for="settings-qwen-clone-target" class="block text-xs font-medium text-foreground">
          Voice Clone Target Model
        </label>
        <Input
          id="settings-qwen-clone-target"
          value={tts.qwenCloneTarget}
          oninput={(e) => config.setTTS('qwenCloneTarget', (e.target as HTMLInputElement).value)}
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
          value={tts.mode}
          onchange={(e) => config.setTTS('mode', (e.target as HTMLSelectElement).value)}
          class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
          <option value="clone">Voice Clone</option>
          <option value="off">Off (Disabled)</option>
        </select>
      </div>
    {:else if tts.provider === 'fish'}
      <div class="space-y-1.5">
        <label for="settings-fish-base-url" class="block text-xs font-medium text-foreground">
          Fish Audio Base URL
        </label>
        <Input
          id="settings-fish-base-url"
          value={tts.fishBaseUrl}
          oninput={(e) => config.setTTS('fishBaseUrl', (e.target as HTMLInputElement).value)}
          placeholder="https://api.fish.audio"
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1.5">
        <label for="settings-fish-api-key" class="block text-xs font-medium text-foreground">
          Fish Audio API Key
        </label>
        <Input
          id="settings-fish-api-key"
          type="password"
          value={tts.fishApiKey}
          oninput={(e) => config.setTTS('fishApiKey', (e.target as HTMLInputElement).value)}
          placeholder="sk-..."
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1.5">
        <label for="settings-fish-model" class="block text-xs font-medium text-foreground">Model Name</label>
        <Input
          id="settings-fish-model"
          value={tts.fishModel}
          oninput={(e) => config.setTTS('fishModel', (e.target as HTMLInputElement).value)}
          placeholder="s1"
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1.5">
        <label for="settings-fish-voice" class="block text-xs font-medium text-foreground">
          Voice ID (Normal Voice)
        </label>
        <Input
          id="settings-fish-voice"
          value={tts.fishVoice}
          oninput={(e) => config.setTTS('fishVoice', (e.target as HTMLInputElement).value)}
          placeholder="Leave empty or click clone below"
          class="h-9 text-xs" />
        <div class="pt-1">
          <Button
            variant="outline"
            size="sm"
            class="h-7 text-xs border-gold/40 text-gold hover:bg-gold/10"
            disabled={isCloningFish}
            onclick={handleFishCloneVoice}>
            {isCloningFish ? 'Cloning...' : 'Clone Voice to Fish Audio'}
          </Button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="settings-fish-voice-asmr" class="block text-xs font-medium text-foreground">
          Voice ID (ASMR Mode Voice)
        </label>
        <Input
          id="settings-fish-voice-asmr"
          value={tts.fishVoiceAsmr}
          oninput={(e) => config.setTTS('fishVoiceAsmr', (e.target as HTMLInputElement).value)}
          placeholder="Optional ASMR whisper voice ID"
          class="h-9 text-xs" />
      </div>
    {:else if tts.provider === 'voicevox'}
      <div class="space-y-1.5">
        <label for="settings-voicevox-url" class="block text-xs font-medium text-foreground">
          VOICEVOX Engine URL
        </label>
        <Input
          id="settings-voicevox-url"
          value={tts.voicevoxBaseUrl}
          oninput={(e) => config.setTTS('voicevoxBaseUrl', (e.target as HTMLInputElement).value)}
          placeholder="http://127.0.0.1:50021"
          class="h-9 text-xs" />
        <span class="block text-[11px] text-muted-foreground">
          Local loopback synthesis engine. No API key needed.
        </span>
      </div>

      <div class="space-y-1.5">
        <label for="settings-voicevox-voice" class="block text-xs font-medium text-foreground">
          Speaker Style ID
        </label>
        <Input
          id="settings-voicevox-voice"
          value={tts.voicevoxVoice}
          oninput={(e) => config.setTTS('voicevoxVoice', (e.target as HTMLInputElement).value)}
          placeholder="3 (default speaker ID)"
          class="h-9 text-xs" />
      </div>
    {:else if tts.provider === 'aivis'}
      <div class="space-y-1.5">
        <label for="settings-aivis-url" class="block text-xs font-medium text-foreground">
          AivisSpeech Engine URL
        </label>
        <Input
          id="settings-aivis-url"
          value={tts.aivisBaseUrl}
          oninput={(e) => config.setTTS('aivisBaseUrl', (e.target as HTMLInputElement).value)}
          placeholder="http://127.0.0.1:10101"
          class="h-9 text-xs" />
        <span class="block text-[11px] text-muted-foreground">
          Local loopback synthesis engine. No API key needed.
        </span>
      </div>

      <div class="space-y-1.5">
        <label for="settings-aivis-voice" class="block text-xs font-medium text-foreground">
          Speaker Style ID
        </label>
        <Input
          id="settings-aivis-voice"
          value={tts.aivisVoice}
          oninput={(e) => config.setTTS('aivisVoice', (e.target as HTMLInputElement).value)}
          placeholder="888753760"
          class="h-9 text-xs" />
      </div>
    {:else}
      <!-- OpenAI / OpenAI-Speech Fields -->
      <div class="space-y-1.5">
        <label for="settings-tts-base-url" class="block text-xs font-medium text-foreground">
          TTS Base URL
        </label>
        <Input
          id="settings-tts-base-url"
          value={tts.baseUrl}
          oninput={(e) => config.setTTS('baseUrl', (e.target as HTMLInputElement).value)}
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
          value={tts.apiKey}
          oninput={(e) => config.setTTS('apiKey', (e.target as HTMLInputElement).value)}
          placeholder="sk-..."
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1.5">
        <label for="settings-tts-mode" class="block text-xs font-medium text-foreground">TTS Mode</label>
        <select
          id="settings-tts-mode"
          value={tts.mode}
          onchange={(e) => config.setTTS('mode', (e.target as HTMLSelectElement).value)}
          class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
          <option value="clone">Voice Clone (Ryza's original voice)</option>
          <option value="preset">Preset Voice</option>
          <option value="off">Off (Disabled)</option>
        </select>
      </div>

      {#if tts.mode === 'clone'}
        <div class="space-y-1.5">
          <label for="settings-tts-model-clone" class="block text-xs font-medium text-foreground">
            Voice Clone Model ID
          </label>
          <Input
            id="settings-tts-model-clone"
            value={tts.modelClone}
            oninput={(e) => config.setTTS('modelClone', (e.target as HTMLInputElement).value)}
            placeholder="voice-clone-model"
            class="h-9 text-xs" />
        </div>

        <div class="space-y-1.5">
          <label for="settings-tts-reference" class="block text-xs font-medium text-foreground">
            Reference Audio Path
          </label>
          <Input
            id="settings-tts-reference"
            value={tts.reference}
            oninput={(e) => config.setTTS('reference', (e.target as HTMLInputElement).value)}
            placeholder="assets/voice/ryza_wav/prologue_08.wav"
            class="h-9 text-xs" />
        </div>
      {:else if tts.mode === 'preset'}
        <div class="space-y-1.5">
          <label for="settings-tts-model-preset" class="block text-xs font-medium text-foreground">
            Preset Model ID
          </label>
          <Input
            id="settings-tts-model-preset"
            value={tts.modelPreset}
            oninput={(e) => config.setTTS('modelPreset', (e.target as HTMLInputElement).value)}
            placeholder="tts-1 / tts-model"
            class="h-9 text-xs" />
        </div>

        <div class="space-y-1.5">
          <label for="settings-tts-preset-voice" class="block text-xs font-medium text-foreground">
            Preset Voice Name
          </label>
          <Input
            id="settings-tts-preset-voice"
            value={tts.presetVoice}
            oninput={(e) => config.setTTS('presetVoice', (e.target as HTMLInputElement).value)}
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
          value={tts.styleHint}
          oninput={(e) => config.setTTS('styleHint', (e.target as HTMLInputElement).value)}
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
