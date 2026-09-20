<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import { game } from '$lib/stores/game.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';
  import { talkLoop } from '$lib/talk-loop.svelte';

  import { Input } from '$components/ui/input';
  import { Button } from '$components/ui/button';
  import { CogIcon } from '@lucide/svelte';
  import VoiceToggle from '$lib/fx/voice-toggle.svelte';

  let inputText = $state('');
  let panelCollapsed = $state(false);

  const appState = $derived(config.section('state') || {});
  const isVoiceActive = $derived(appState.style !== 'text' && config.section('app')?.voice !== false);

  const textSpeeds = [
    { label: '×1', ms: 28 },
    { label: '×1.5', ms: 18 },
    { label: '×2', ms: 12 },
    { label: '×3', ms: 8 },
  ];
  let speedIdx = $state(0);

  onMount(() => {
    const savedSpeed = Number(config.section('app')?.textSpeed);
    const matched = textSpeeds.findIndex((s) => s.ms === savedSpeed);
    if (matched >= 0) {
      speedIdx = matched;
      talkLoop.typewriter.speed = textSpeeds[matched].ms;
    }

    if (!talkLoop.displayText) {
      talkLoop.greet();
    }
  });

  function cycleSpeed() {
    speedIdx = (speedIdx + 1) % textSpeeds.length;
    talkLoop.typewriter.speed = textSpeeds[speedIdx].ms;
    config.set('app.textSpeed', textSpeeds[speedIdx].ms);
  }

  function handleSend() {
    const trimmed = inputText.trim();
    if (!trimmed || talkLoop.isThinking) return;

    inputText = '';
    talkLoop.say(trimmed);
  }

  function handleSkipTypewriter() {
    if (talkLoop.typewriter.isTyping) {
      talkLoop.typewriter.finish();
    }
  }

  function toggleVoiceStyle() {
    const nextStyle = appState.style === 'text' ? 'normal' : 'text';
    config.set('state.style', nextStyle);
  }

  onDestroy(() => {
    talkLoop.typewriter.cancel();
  });
</script>

<div class="relative flex flex-col size-full justify-between p-2 sm:p-3 pointer-events-none">
  <!-- Top HUD Cluster -->
  <div class="flex items-start justify-between pointer-events-none">
    <div class="flex flex-col gap-1.5 pointer-events-auto">
      <!-- Stamina Row -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="flex items-center gap-1.5 bg-card/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-border/40 shadow-sm cursor-pointer hover:bg-card/80 transition-colors"
        onclick={() => overlayStore.openSheet('status')}>
        <div class="flex items-center gap-0.5">
          {#each Array(game.apples().slots) as _, i}
            <img
              src="/assets/icons/{i < game.apples().filled
                ? 'stamina_apple_filled'
                : 'stamina_apple_empty'}.svg"
              alt=""
              class="w-4 h-4" />
          {/each}
        </div>
        <span class="text-xs font-semibold text-foreground">
          {game.cheat() ? '∞' : game.s.stamina}
        </span>
      </div>

      <!-- Money & Level Row -->
      <div class="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          class="h-6 flex items-center gap-1 bg-card/60 backdrop-blur-md px-2.5 py-0 rounded-full border-border/40 text-xs font-medium text-gold shadow-sm hover:bg-card/80"
          onclick={() => overlayStore.openSheet('status')}>
          <img src="/assets/icons/hud_coin.svg" alt="" class="w-3.5 h-3.5" />
          <span>{game.cheat() ? '∞' : game.s.money.toLocaleString()}</span>
        </Button>

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="bg-card/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-border/40 text-xs font-semibold text-foreground/80 shadow-sm cursor-pointer hover:bg-card/80 transition-colors"
          onclick={() => overlayStore.openSheet('status')}>
          Lv.{game.level()}
        </div>
      </div>
    </div>

    <!-- Quick Action Floating Buttons -->
    <div class="flex flex-col gap-2.5 pointer-events-auto">
      <Button
        variant="outline"
        size="icon"
        class="size-12 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => viewStore.setView('skin')}
        title="Shop">
        <img src="/assets/icons/shop.svg" alt="" class="size-6" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        class="size-12 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => viewStore.setView('quest')}
        title="Quests">
        <img src="/assets/icons/quest.svg" alt="" class="size-6" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        class="size-12 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => overlayStore.openSheet('inv')}
        title="Inventory">
        <img src="/assets/icons/bag.svg" alt="" class="size-6" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        class="size-12 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => viewStore.setView('settings')}
        title="Settings">
        <CogIcon class="size-6" />
      </Button>
    </div>
  </div>

  <!-- Bottom Log Panel & Input Bar -->
  <div
    style="translate: 0 {!panelCollapsed ? '0' : 'calc(100% - var(--spacing) * 24)'}"
    class="flex flex-col sm:w-lg mx-auto pointer-events-auto transition-all duration-300">
    <!-- Retry Bar if error occurred -->
    {#if talkLoop.retryVisible}
      <div
        class="mb-2 flex items-center justify-between p-2 rounded-xl bg-destructive/20 border border-destructive/40 text-xs text-foreground backdrop-blur-md animate-in fade-in">
        <span>Reply could not be retrieved.</span>
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs border-destructive/50 text-foreground hover:bg-destructive/30"
          onclick={() => talkLoop.retryLast()}>
          Retry
        </Button>
      </div>
    {/if}

    <div class="flex justify-between items-center mb-2">
      <Button
        variant="outline"
        class="rounded-full bg-card/60 backdrop-blur-md text-foreground/90 hover:bg-card/90 shadow-sm transition-all"
        style="background: {isVoiceActive ? 'linear-gradient(120deg, #ff9a3d, #f5b03d)' : 'revert-rule'}"
        aria-label="Toggle Voice"
        onclick={toggleVoiceStyle}>
        <VoiceToggle active={isVoiceActive} size={28} />
        <span class={['transition-all font-medium', isVoiceActive ? 'text-background' : '-ml-1']}>
          {isVoiceActive ? 'Voice' : 'Text'}
        </span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        class="size-10 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => (panelCollapsed = !panelCollapsed)}
        title="Toggle Log Panel">
        <img
          src="/assets/icons/arrow_up.svg"
          alt=""
          class="size-4 transition-transform duration-200 {!panelCollapsed ? 'rotate-180' : ''}" />
      </Button>
    </div>

    <div class="flex flex-col gap-2">
      {#if config.section('app')?.showBubble !== false}
        <!-- Dialogue Bubble Card -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="bg-card/85 backdrop-blur-md border border-border/50 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2.5 cursor-pointer select-text w-full"
          onclick={handleSkipTypewriter}>
          <div
            class={[
              !panelCollapsed && 'border-b pb-2',
              'flex items-center justify-between border-border/30 w-full',
            ]}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
              onclick={(e) => {
                e.stopPropagation();
                overlayStore.openSheet('mode');
              }}>
              <img
                src="/assets/images/chara_icons/ryza.png"
                alt="Ryza"
                class="size-8 rounded-full border border-gold/40 object-cover" />
              <div class="flex flex-col">
                <span class="text-xs font-bold text-gold leading-none">Ryza</span>
                <span class="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {appState.mode || 'Chat'} Mode
                </span>
              </div>
            </div>

            <!-- Message Page Dots -->
            {#if talkLoop.recentPages.length > 1}
              <div class="flex items-center gap-1">
                {#each talkLoop.recentPages as _, idx}
                  <Button
                    variant="ghost"
                    size="icon"
                    class="w-2.5 h-2.5 min-w-0 p-0 rounded-full transition-colors {idx ===
                    talkLoop.activePageIdx
                      ? 'bg-gold hover:bg-gold'
                      : 'bg-muted-foreground/40 hover:bg-muted-foreground/60'}"
                    onclick={(e) => {
                      e.stopPropagation();
                      talkLoop.selectPage(idx);
                    }}
                    aria-label="Message {idx + 1}" />
                {/each}
              </div>
            {/if}
          </div>

          <!-- Dialogue Text / Thinking Dots -->
          <div class="min-h-12 text-sm leading-relaxed text-foreground font-normal overflow-y-auto max-h-32">
            {#if talkLoop.isThinking}
              <div class="flex items-center gap-1.5 py-2 text-gold animate-pulse">
                <span class="w-2 h-2 rounded-full bg-gold"></span>
                <span class="w-2 h-2 rounded-full bg-gold animation-delay-200"></span>
                <span class="w-2 h-2 rounded-full bg-gold animation-delay-400"></span>
                <span class="text-xs text-muted-foreground ml-1.5">Ryza is thinking...</span>
              </div>
            {:else}
              {talkLoop.displayText}
            {/if}
          </div>
        </div>
      {/if}

      <!-- Input Bar -->
      <div
        class="flex items-center gap-1.5 bg-card/80 backdrop-blur-md p-1.5 rounded-full border border-border/50 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          class="size-10 rounded-full text-xs font-bold text-gold hover:bg-muted/40"
          onclick={cycleSpeed}
          title="Text Speed">
          {textSpeeds[speedIdx].label}
        </Button>

        <Input
          bind:value={inputText}
          placeholder="Say something to Ryza..."
          disabled={talkLoop.isThinking}
          class="h-9 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm px-2 text-foreground placeholder:text-muted-foreground/60"
          onkeydown={(e) => {
            if (e.key === 'Enter') handleSend();
          }} />

        <Button
          variant="ghost"
          size="icon"
          class="size-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40"
          onclick={() => (inputText = '')}
          title="Clear Input">
          <img src="/assets/icons/asterisk.svg" alt="" class="w-4 h-4 opacity-70" />
        </Button>

        <Button
          size="icon"
          class="size-10 rounded-full bg-gold text-background hover:bg-gold/90 shadow-sm"
          disabled={talkLoop.isThinking}
          onclick={handleSend}
          title="Send">
          <img src="/assets/icons/send.svg" alt="Send" class="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
</div>
