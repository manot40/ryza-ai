<script lang="ts">
  import { config } from '$lib/stores/config.svelte';
  import { sound } from '$lib/audio/sound';
  import { Slider } from '$components/ui/slider';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  const app = $derived(config.get('app'));
  const audio = $derived(config.get('audio'));
</script>

<Card class="border-border/50 bg-card/75">
  <CardHeader class="pb-2">
    <CardTitle class="text-sm font-bold text-gold">Volume Controls</CardTitle>
  </CardHeader>
  <CardContent class="space-y-4">
    <div class="space-y-2">
      <div class="flex justify-between text-xs">
        <label for="settings-audio-master" class="font-medium text-foreground">Master Volume</label>
        <span class="text-gold font-mono">{Math.round((app.volume ?? 0.9) * 100)}%</span>
      </div>
      <Slider
        type="single"
        min={0}
        max={1}
        step={0.05}
        value={app.volume ?? 0.9}
        onValueChange={(val) => {
          config.setApp('volume', val);
          sound.applyVolumes();
        }}
        class="w-full" />
    </div>

    <div class="space-y-2">
      <div class="flex justify-between text-xs">
        <label for="settings-audio-bgm" class="font-medium text-foreground">Background Music (BGM)</label>
        <span class="text-gold font-mono">{Math.round((audio.bgm ?? 0.55) * 100)}%</span>
      </div>
      <Slider
        type="single"
        min={0}
        max={1}
        step={0.05}
        value={audio.bgm ?? 0.55}
        onValueChange={(val) => {
          config.setAudio('bgm', val);
          sound.applyVolumes();
        }}
        class="w-full" />
    </div>

    <div class="space-y-2">
      <div class="flex justify-between text-xs">
        <label for="settings-audio-ambient" class="font-medium text-foreground">Ambient Sound</label>
        <span class="text-gold font-mono">{Math.round((audio.ambient ?? 0.45) * 100)}%</span>
      </div>
      <Slider
        type="single"
        min={0}
        max={1}
        step={0.05}
        value={audio.ambient ?? 0.45}
        onValueChange={(val) => {
          config.setAudio('ambient', val);
          sound.applyVolumes();
        }}
        class="w-full" />
    </div>

    <div class="space-y-2">
      <div class="flex justify-between text-xs">
        <label for="settings-audio-voice" class="font-medium text-foreground">Voice Volume</label>
        <span class="text-gold font-mono">{Math.round((audio.voice ?? 1.0) * 100)}%</span>
      </div>
      <Slider
        type="single"
        min={0}
        max={1}
        step={0.05}
        value={audio.voice ?? 1.0}
        onValueChange={(val) => {
          config.setAudio('voice', val);
        }}
        class="w-full" />
    </div>

    <div class="space-y-2">
      <div class="flex justify-between text-xs">
        <label for="settings-audio-se" class="font-medium text-foreground">Sound Effects (SE)</label>
        <span class="text-gold font-mono">{Math.round((audio.se ?? 0.85) * 100)}%</span>
      </div>
      <Slider
        type="single"
        min={0}
        max={1}
        step={0.05}
        value={audio.se ?? 0.85}
        onValueChange={(val) => {
          config.setAudio('se', val);
        }}
        class="w-full" />
    </div>
  </CardContent>
</Card>
