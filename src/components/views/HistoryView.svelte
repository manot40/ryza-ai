<script lang="ts">
  import { session, type HistoryEntry } from '$lib/stores/session.svelte';
  import { talkLoop } from '$lib/talk-loop.svelte';
  import { VoiceCache, isFav } from '$lib/audio/voicecache';
  import { confirmDialog } from '$lib/stores/confirm.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import Header from './Header.svelte';
  import { Button } from '$components/ui/button';
  import { PlayIcon, SquareIcon, StarIcon, MessageSquareIcon, Volume2Icon, Trash2Icon } from '@lucide/svelte';

  type FilterTab = 'all' | 'voiced' | 'fav';

  let filter = $state<FilterTab>('all');
  let playingKey = $state<string | null>(null);
  let favUpdateNonce = $state(0);

  const filteredHistory = $derived.by(() => {
    // Read favUpdateNonce so toggling favorite triggers reactive re-computation
    void favUpdateNonce;
    const list = session.history;
    if (filter === 'voiced') {
      return list.filter((item) => Boolean(item.voiceKey));
    }
    if (filter === 'fav') {
      return list.filter((item) => Boolean(item.voiceKey && isFav(item.voiceKey)));
    }
    return list;
  });

  const counts = $derived.by(() => {
    void favUpdateNonce;
    const list = session.history;
    const voiced = list.filter((item) => Boolean(item.voiceKey)).length;
    const fav = list.filter((item) => Boolean(item.voiceKey && isFav(item.voiceKey))).length;
    return { all: list.length, voiced, fav };
  });

  function isCurrentlyPlaying(voiceKey?: string): boolean {
    if (!voiceKey) return false;
    return talkLoop.speaking && talkLoop.lastVoiceKey === voiceKey;
  }

  async function handleTogglePlay(voiceKey?: string) {
    if (!voiceKey) return;
    if (isCurrentlyPlaying(voiceKey)) {
      talkLoop.interrupt();
      playingKey = null;
    } else {
      playingKey = voiceKey;
      await talkLoop.playVoiceKey(voiceKey);
    }
  }

  function handleToggleFav(voiceKey?: string) {
    if (!voiceKey) return;
    const nextFav = VoiceCache.toggleFav(voiceKey);
    favUpdateNonce++;
    toast.show(nextFav ? 'Added to favorites ★' : 'Removed from favorites');
  }

  async function handleClearHistory() {
    const ok = await confirmDialog.ask({
      title: 'Clear Chat History?',
      description:
        'Are you sure you want to clear all dialogue history in this session? Active turns will be reset, but saved memory logs remain intact.',
      confirmText: 'Clear History',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;

    session.clearHistory();
    toast.show('Chat history cleared');
  }

  function formatTime(timestamp?: number): string {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function cleanAssistantText(text: string): string {
    // Strip <state>...</state> blocks if present
    return text.replace(/<state>[\s\S]*?<\/state>/gi, '').trim();
  }
</script>

<Header title="Chat History">
  {#if session.history.length > 0}
    <Button
      variant="ghost"
      size="sm"
      class="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1.5 px-2"
      onclick={handleClearHistory}>
      <Trash2Icon class="size-3.5" />
      <span>Clear</span>
    </Button>
  {/if}
</Header>

<div class="flex flex-col flex-1 overflow-hidden">
  <!-- Filter Tabs -->
  <div class="flex items-center gap-1.5 px-4 py-2 border-b border-border/40 bg-card/30">
    <Button
      variant={filter === 'all' ? 'secondary' : 'ghost'}
      size="sm"
      class="h-7 text-xs rounded-full px-2.5 {filter === 'all'
        ? 'bg-gold/15 text-gold font-semibold'
        : 'text-muted-foreground'}"
      onclick={() => (filter = 'all')}>
      All ({counts.all})
    </Button>
    <Button
      variant={filter === 'voiced' ? 'secondary' : 'ghost'}
      size="sm"
      class="h-7 text-xs rounded-full px-2.5 gap-1 {filter === 'voiced'
        ? 'bg-gold/15 text-gold font-semibold'
        : 'text-muted-foreground'}"
      onclick={() => (filter = 'voiced')}>
      <Volume2Icon class="size-3" />
      Voiced ({counts.voiced})
    </Button>
    <Button
      variant={filter === 'fav' ? 'secondary' : 'ghost'}
      size="sm"
      class="h-7 text-xs rounded-full px-2.5 gap-1 {filter === 'fav'
        ? 'bg-gold/15 text-gold font-semibold'
        : 'text-muted-foreground'}"
      onclick={() => (filter = 'fav')}>
      <StarIcon class="size-3" />
      Favorites ({counts.fav})
    </Button>
  </div>

  <!-- Dialogue Messages Container -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[68vh]">
    {#if filteredHistory.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div class="size-12 rounded-full bg-gold/10 flex items-center justify-center text-gold">
          <MessageSquareIcon class="size-6 opacity-80" />
        </div>
        <div class="space-y-1">
          <p class="text-sm font-medium text-foreground/90">No chat history</p>
          <p class="text-xs text-muted-foreground max-w-xs">
            {#if filter === 'voiced'}
              No voice recordings generated yet. Turn on Voice Playback in settings to hear Ryza speak!
            {:else if filter === 'fav'}
              No favorite voices yet. Star any dialogue voice clip to pin it to favorites.
            {:else}
              Talk with Ryza in Free Talk or Story mode to build conversation history.
            {/if}
          </p>
        </div>
      </div>
    {:else}
      {#each filteredHistory as entry (entry.id || entry.at || entry.content)}
        {#if entry.role === 'user'}
          <!-- User Bubble -->
          <div class="flex justify-end">
            <div
              class="max-w-[85%] bg-primary/15 border border-primary/25 rounded-2xl rounded-tr-xs px-3.5 py-2.5 shadow-xs space-y-1 text-right">
              <p
                class="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap select-text text-left">
                {entry.content}
              </p>
              {#if entry.at}
                <span class="text-[10px] text-muted-foreground/70 block">
                  {formatTime(entry.at)}
                </span>
              {/if}
            </div>
          </div>
        {:else}
          <!-- Ryza (Assistant) Bubble -->
          <div class="flex items-start gap-2.5 max-w-[94%]">
            <img
              src="/assets/images/chara_icons/ryza.png"
              alt="Ryza"
              class="size-8 rounded-full border border-gold/40 shrink-0 mt-0.5 object-cover shadow-xs" />

            <div
              class="flex-1 bg-card/85 border border-border/60 rounded-2xl rounded-tl-xs p-3.5 shadow-sm space-y-2.5">
              <div class="flex items-center justify-between gap-2 border-b border-border/30 pb-1.5">
                <span class="text-xs font-semibold text-gold">Ryza</span>
                {#if entry.at}
                  <span class="text-[10px] text-muted-foreground/70">
                    {formatTime(entry.at)}
                  </span>
                {/if}
              </div>

              <!-- Message Text -->
              <p
                class="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap select-text">
                {cleanAssistantText(entry.content)}
              </p>

              <!-- Voice Playback Bar (if voiced) -->
              {#if entry.voiceKey}
                {@const isPlaying = isCurrentlyPlaying(entry.voiceKey)}
                {@const isFavorite = isFav(entry.voiceKey)}
                <div
                  class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-background/75 border border-border/50 transition-colors {isPlaying
                    ? 'border-gold/60 bg-gold/5'
                    : ''}">
                  <div class="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-7 rounded-full {isPlaying
                        ? 'bg-gold text-background hover:bg-gold/90'
                        : 'bg-gold/15 text-gold hover:bg-gold/25'}"
                      onclick={() => handleTogglePlay(entry.voiceKey)}>
                      {#if isPlaying}
                        <SquareIcon class="size-3 fill-current" />
                      {:else}
                        <PlayIcon class="size-3.5 fill-current ml-0.5" />
                      {/if}
                    </Button>

                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-medium {isPlaying ? 'text-gold' : 'text-foreground/80'}">
                        {isPlaying ? 'Playing...' : 'Voice clip'}
                      </span>
                      {#if isPlaying}
                        <span class="flex gap-0.5 items-center">
                          <span class="w-1 h-3 bg-gold rounded-full animate-pulse"></span>
                          <span class="w-1 h-4 bg-gold rounded-full animate-pulse delay-75"></span>
                          <span class="w-1 h-2 bg-gold rounded-full animate-pulse delay-150"></span>
                        </span>
                      {/if}
                    </div>
                  </div>

                  <!-- Favorite Button -->
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 rounded-full text-muted-foreground hover:text-gold"
                    title={isFavorite ? 'Favorited' : 'Add to favorites'}
                    onclick={() => handleToggleFav(entry.voiceKey)}>
                    <StarIcon
                      class="size-4 transition-colors {isFavorite
                        ? 'text-gold fill-gold'
                        : 'text-muted-foreground/70'}" />
                  </Button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
