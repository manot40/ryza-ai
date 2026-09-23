<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { nsfw } from '$lib/stores/nsfw.svelte';
  import { Input } from '$components/ui/input';
  import { Button } from '$components/ui/button';
  import { Switch } from '$components/ui/switch';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  const app = $derived(config.get('app'));
  const memory = $derived(config.get('memory'));

  function handleTimeModeChange(mode: 'real' | 'flow' | 'manual') {
    config.setApp('timeMode', mode);
    if (mode === 'flow') {
      config.setState({
        gameHour: new Date().getHours(),
        gameClockAt: Date.now(),
        todManualUntil: 0,
      });
    }
  }

  function handleNsfwChange(val: boolean) {
    config.setApp('nsfwEnabled', val);
    nsfw.setEnabled(val);
  }
</script>

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
      <Switch checked={app.voice !== false} onCheckedChange={(val) => config.setApp('voice', val)} />
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-border/20">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">Show Speech Bubble</span>
        <span class="text-[11px] text-muted-foreground">Talk bubbles over the stage</span>
      </div>
      <Switch
        checked={app.showBubble !== false}
        onCheckedChange={(val) => config.setApp('showBubble', val)} />
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-border/20">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">Vibration</span>
        <span class="text-[11px] text-muted-foreground">Haptic feedback on taps and events</span>
      </div>
      <Switch checked={app.vibration !== false} onCheckedChange={(val) => config.setApp('vibration', val)} />
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-border/20">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">Rim Light</span>
        <span class="text-[11px] text-muted-foreground">Character edge lighting shader</span>
      </div>
      <Switch checked={app.rim !== false} onCheckedChange={(val) => config.setApp('rim', val)} />
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-border/20">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">Show Original Text</span>
        <span class="text-[11px] text-muted-foreground">Display original text alongside translations</span>
      </div>
      <Switch
        checked={Boolean(app.showOriginal)}
        onCheckedChange={(val) => config.setApp('showOriginal', val)} />
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-border/20">
      <div class="flex flex-col">
        <span class="text-xs font-medium text-foreground">NSFW Costume Permission</span>
        <span class="text-[11px] text-muted-foreground">
          Allow Ryza to undress or switch to bikini textures
        </span>
      </div>
      <Switch checked={Boolean(app.nsfwEnabled)} onCheckedChange={handleNsfwChange} />
    </div>

    <div class="space-y-1.5 pt-2 border-t border-border/20">
      <label for="settings-npc-freq" class="block text-xs font-medium text-foreground">
        Guest Dialogue Frequency
      </label>
      <select
        id="settings-npc-freq"
        value={app.npcFrequency || 'normal'}
        onchange={(e) => config.setApp('npcFrequency', (e.target as HTMLSelectElement).value)}
        class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
        <option value="restrained">Restrained (Ryza rarely brings in others)</option>
        <option value="normal">Normal (Natural conversational balance)</option>
        <option value="frequent">Frequent (Island friends chime in often)</option>
        <option value="lively">Lively (Kurken island banter in full swing)</option>
      </select>
    </div>

    <div class="space-y-1.5 pt-2 border-t border-border/20">
      <span class="block text-xs font-medium text-foreground">Text Typewriter Speed</span>
      <div class="grid grid-cols-4 gap-1.5">
        {#each [{ v: 30, t: '1x (Slow)' }, { v: 18, t: '1.5x' }, { v: 12, t: '2x' }, { v: 8, t: '3x (Fast)' }] as s}
          <Button
            variant={app.textSpeed === s.v ? 'secondary' : 'outline'}
            size="sm"
            class="h-7 text-[11px] {app.textSpeed === s.v ? 'border-gold text-gold font-bold' : ''}"
            onclick={() => config.setApp('textSpeed', s.v)}>
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
      <label for="settings-time-mode" class="block text-xs font-medium text-foreground">Time Mode</label>
      <select
        id="settings-time-mode"
        value={app.timeMode || 'real'}
        onchange={(e) =>
          handleTimeModeChange((e.target as HTMLSelectElement).value as 'real' | 'flow' | 'manual')}
        class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
        <option value="real">Real Clock (Follows device system time)</option>
        <option value="flow">In-Game Flow (Simulated time progression)</option>
        <option value="manual">Manual Only (TOD toggle in top bar)</option>
      </select>
    </div>

    {#if app.timeMode === 'flow'}
      <div class="space-y-1.5">
        <label for="settings-flow-speed" class="block text-xs font-medium text-foreground">
          In-Game Flow Speed
        </label>
        <select
          id="settings-flow-speed"
          value={app.flowSpeed ?? 60}
          onchange={(e) => config.setApp('flowSpeed', Number((e.target as HTMLSelectElement).value))}
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
      <Switch
        checked={memory.enabled !== false}
        onCheckedChange={(val) => config.setMemory('enabled', val)} />
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
          value={memory.turnsPerSession ?? 10}
          oninput={(e) =>
            config.setMemory(
              'turnsPerSession',
              Math.max(2, Number((e.target as HTMLInputElement).value) || 10)
            )}
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
          value={memory.sessionCap ?? 8}
          oninput={(e) =>
            config.setMemory('sessionCap', Math.max(2, Number((e.target as HTMLInputElement).value) || 8))}
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
          value={memory.summaryCap ?? 8}
          oninput={(e) =>
            config.setMemory('summaryCap', Math.max(2, Number((e.target as HTMLInputElement).value) || 8))}
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
      <Switch checked={Boolean(app.cheat)} onCheckedChange={(val) => config.setApp('cheat', val)} />
    </div>
  </CardContent>
</Card>
