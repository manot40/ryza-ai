<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { Input } from '$components/ui/input';
  import { Switch } from '$components/ui/switch';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  const app = $derived(config.get('app'));
  const stt = $derived(config.get('stt'));
</script>

<Card class="border-border/50 bg-card/75">
  <CardHeader class="pb-2">
    <CardTitle class="text-sm font-bold text-gold">Speech-to-Text (STT) & Voice Input</CardTitle>
    <span class="text-[11px] text-muted-foreground">
      Configure microphone transcription, VAD auto-send, and hands-free interruption.
    </span>
  </CardHeader>
  <CardContent class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">Voice Input Master</span>
        <span class="text-[11px] text-muted-foreground">Enable microphone button in chat</span>
      </div>
      <Switch
        checked={app.stt === 'on'}
        onCheckedChange={(val) => config.setApp('stt', val ? 'on' : 'off')} />
    </div>

    <div class="space-y-1.5 pt-2 border-t border-border/20">
      <label for="settings-stt-engine" class="block text-xs font-medium text-foreground">
        Transcription Engine
      </label>
      <select
        id="settings-stt-engine"
        value={stt.engine}
        onchange={(e) => config.setSTT('engine', (e.target as HTMLSelectElement).value)}
        class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
        <option value="auto">Auto (Browser WebSpeech with fallback)</option>
        <option value="webSpeech">Browser Built-in WebSpeech API</option>
        <option value="capture">Server Audio Capture (Whisper API)</option>
      </select>
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-border/20">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">Auto Send on Silence</span>
        <span class="text-[11px] text-muted-foreground">Send message automatically when you pause</span>
      </div>
      <Switch checked={Boolean(app.autoSend)} onCheckedChange={(val) => config.setApp('autoSend', val)} />
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-border/20">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">Barge-In (Voice Interruption)</span>
        <span class="text-[11px] text-muted-foreground">Interrupt Ryza's speech when you start speaking</span>
      </div>
      <Switch checked={Boolean(app.bargeIn)} onCheckedChange={(val) => config.setApp('bargeIn', val)} />
    </div>

    {#if stt.engine === 'capture'}
      <div class="space-y-1.5 pt-2 border-t border-border/20">
        <label for="settings-stt-base-url" class="block text-xs font-medium text-foreground">
          Server STT Endpoint URL
        </label>
        <Input
          id="settings-stt-base-url"
          value={stt.baseUrl}
          oninput={(e) => config.setSTT('baseUrl', (e.target as HTMLInputElement).value)}
          placeholder="https://api.openai.com/v1"
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1.5">
        <label for="settings-stt-api-key" class="block text-xs font-medium text-foreground">
          Server STT API Key
        </label>
        <Input
          id="settings-stt-api-key"
          type="password"
          value={stt.apiKey}
          oninput={(e) => config.setSTT('apiKey', (e.target as HTMLInputElement).value)}
          placeholder="sk-..."
          class="h-9 text-xs" />
      </div>

      <div class="space-y-1.5">
        <label for="settings-stt-model" class="block text-xs font-medium text-foreground">STT Model</label>
        <Input
          id="settings-stt-model"
          value={stt.model}
          oninput={(e) => config.setSTT('model', (e.target as HTMLInputElement).value)}
          placeholder="whisper-1"
          class="h-9 text-xs" />
      </div>
    {/if}
  </CardContent>
</Card>
