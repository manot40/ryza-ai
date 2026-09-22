<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { chat, listModels, resolvedContext } from '$lib/api';
  import { Input } from '$components/ui/input';
  import { Button } from '$components/ui/button';
  import { Slider } from '$components/ui/slider';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  const llm = $derived(config.get('llm'));

  let llmModelsList = $state<string[]>([]);
  let isFetchingModels = $state(false);
  let isTestingLlm = $state(false);

  const estimatedContext = $derived(resolvedContext());

  async function handleFetchModels() {
    if (!llm.baseUrl) {
      toast.err('Please enter API Base URL first');
      return;
    }
    isFetchingModels = true;
    toast.show('Fetching models list...');
    try {
      const list = await listModels();
      llmModelsList = list.map((m) => m.id);
      if (llmModelsList.length > 0) {
        if (!llm.model || !llmModelsList.includes(llm.model)) {
          config.setLLM('model', llmModelsList[0]);
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
    if (!llm.apiKey) {
      toast.err('API Key is required to test LLM');
      return;
    }
    isTestingLlm = true;
    toast.show('Connecting to Ryza (LLM Test)...');
    try {
      const res = await chat([], '短く一言、あいさつして。', { mode: 'chat', style: 'text' });
      toast.show(`Ryza: ${res.text}`);
    } catch (e: unknown) {
      toast.err(`LLM Test Failed: ${(e as Error)?.message || 'Unknown error'}`);
    } finally {
      isTestingLlm = false;
    }
  }
</script>

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
        value={llm.baseUrl}
        oninput={(e) => config.setLLM('baseUrl', (e.target as HTMLInputElement).value)}
        placeholder="https://api.openai.com/v1"
        class="h-9 text-xs" />
      <span class="block text-[11px] text-muted-foreground">
        OpenAI-compatible URL ending in /v1. Dev config seeds from config/providers.json.
      </span>
    </div>

    <div class="space-y-1.5">
      <label for="settings-llm-model" class="block text-xs font-medium text-foreground">Model Name</label>
      {#if llmModelsList.length > 0}
        <select
          id="settings-llm-model"
          value={llm.model}
          onchange={(e) => config.setLLM('model', (e.target as HTMLSelectElement).value)}
          class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {#each llmModelsList as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
      {:else}
        <Input
          id="settings-llm-model"
          value={llm.model}
          oninput={(e) => config.setLLM('model', (e.target as HTMLInputElement).value)}
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
        <span class="text-[11px] text-muted-foreground">Fetch to populate dropdown or type manually</span>
      </div>
    </div>

    <div class="space-y-1.5">
      <label for="settings-llm-api-key" class="block text-xs font-medium text-foreground">API Key</label>
      <Input
        id="settings-llm-api-key"
        type="password"
        value={llm.apiKey}
        oninput={(e) => config.setLLM('apiKey', (e.target as HTMLInputElement).value)}
        placeholder="sk-..."
        class="h-9 text-xs" />
      <span class="block text-[11px] text-muted-foreground">Stored only in local storage</span>
    </div>

    <div class="space-y-2 pt-1">
      <div class="flex justify-between text-xs">
        <label for="settings-llm-temp" class="font-medium text-foreground">Temperature</label>
        <span class="text-gold font-mono">{llm.temperature}</span>
      </div>
      <Slider
        type="single"
        min={0}
        max={2}
        step={0.05}
        value={llm.temperature}
        onValueChange={(val) => config.setLLM('temperature', val)}
        class="w-full" />
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
          value={llm.maxTokens}
          oninput={(e) =>
            config.setLLM('maxTokens', Math.max(64, Number((e.target as HTMLInputElement).value) || 400))}
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
          value={llm.historyTurns}
          oninput={(e) =>
            config.setLLM('historyTurns', Math.max(2, Number((e.target as HTMLInputElement).value) || 12))}
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
        value={llm.contextWindow}
        oninput={(e) =>
          config.setLLM('contextWindow', Math.max(0, Number((e.target as HTMLInputElement).value) || 0))}
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
            value={llm.thinking}
            onchange={(e) =>
              config.setLLM('thinking', (e.target as HTMLSelectElement).value as 'auto' | 'off' | 'on')}
            class="h-8 w-full rounded-md border border-border/50 bg-background/80 px-2 py-0.5 text-xs text-foreground">
            <option value="auto">Auto</option>
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </div>

        <div class="space-y-1">
          <label for="settings-llm-thinking-effort" class="block text-[11px] font-medium text-foreground">
            Effort
          </label>
          <select
            id="settings-llm-thinking-effort"
            value={llm.thinkingEffort}
            onchange={(e) =>
              config.setLLM(
                'thinkingEffort',
                (e.target as HTMLSelectElement).value as 'default' | 'off' | 'low' | 'medium' | 'high' | 'max'
              )}
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
          <label for="settings-llm-thinking-style" class="block text-[11px] font-medium text-foreground">
            Protocol Style
          </label>
          <select
            id="settings-llm-thinking-style"
            value={llm.thinkingStyle}
            onchange={(e) =>
              config.setLLM(
                'thinkingStyle',
                (e.target as HTMLSelectElement).value as
                  'auto' | 'none' | 'openai' | 'openrouter' | 'qwen' | 'glm'
              )}
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
