<script lang="ts">
  import type { SupportedUiLocale } from '$lib/i18n/langs';
  import { loadLocale } from 'wuchale/load-utils';
  import { config } from '$lib/stores/config.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardHeader, CardTitle, CardContent } from '$components/ui/card';

  const app = $derived(config.get('app'));
  const voice = $derived(config.get('voice'));
  const llm = $derived(config.get('llm'));
  const tts = $derived(config.get('tts'));

  async function handleLanguageChange(lang: SupportedUiLocale) {
    config.setApp('lang', lang);
    try {
      await loadLocale(lang);
    } catch {}
  }
</script>

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
            variant={app.lang === l.id ? 'secondary' : 'outline'}
            class="h-8 text-xs {app.lang === l.id ? 'border-gold text-gold font-bold' : ''}"
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
        value={voice.lang}
        onchange={(e) => config.setVoice('lang', (e.target as HTMLSelectElement).value)}
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
        value={llm.lang}
        onchange={(e) => config.setLLM('lang', (e.target as HTMLSelectElement).value)}
        class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
        <option value="auto">Auto (Follow Interface)</option>
        <option value="ja">日本語 (Japanese — Recommended for character authenticity)</option>
        <option value="en">English</option>
        <option value="zh">简体中文 (Chinese)</option>
        <option value="id">Bahasa Indonesia</option>
      </select>
      <span class="block text-[11px] text-muted-foreground">
        The language Ryza writes in the dialogue text. Set to 日本語 to keep dialogue Japanese regardless of
        UI language.
      </span>
    </div>

    <!-- 4. Speech Synthesis Language -->
    <div class="space-y-1.5 pt-2 border-t border-border/30">
      <label for="settings-lang-tts" class="block text-xs font-semibold text-foreground">
        Speech Synthesis Language (TTS)
      </label>
      <select
        id="settings-lang-tts"
        value={tts.lang}
        onchange={(e) => config.setTTS('lang', (e.target as HTMLSelectElement).value)}
        class="h-9 w-full rounded-md border border-border/50 bg-background/80 px-3 py-1 text-xs text-foreground">
        <option value="auto">Auto (Same as Ryza Replies)</option>
        <option value="ja">日本語 (Japanese)</option>
        <option value="en">English</option>
        <option value="zh">简体中文 (Chinese)</option>
        <option value="id">Bahasa Indonesia</option>
      </select>
      <span class="block text-[11px] text-muted-foreground">
        If speech language differs from Ryza replies, the line will be automatically translated by the LLM
        before sending to TTS.
      </span>
    </div>
  </CardContent>
</Card>
