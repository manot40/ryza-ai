<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { game } from '$lib/stores/game.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { avatarService } from '$lib/avatar/avatar-service.svelte';
  import { TypewriterController } from '$lib/typewriter';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';

  import { CogIcon }from '@lucide/svelte'

  let inputText = $state('');
  let isThinking = $state(false);
  let displayText = $state('');
  let recentPages = $state<string[]>([]);
  let activePageIdx = $state(0);
  let panelCollapsed = $state(false);

  onMount(() => {
    const greeting = 'Welcome back, adventurer! What shall we do today?';
    displayText = greeting;
    recentPages = [greeting];
  });

  const textSpeeds = [
    { label: '×1', ms: 28 },
    { label: '×1.5', ms: 18 },
    { label: '×2', ms: 12 },
    { label: '×3', ms: 8 },
  ];
  let speedIdx = $state(0);

  const typewriter = new TypewriterController({
    speed: textSpeeds[0].ms,
    onUpdate: (partial) => {
      displayText = partial;
    },
    onDone: () => {
      avatarService.setTalking(false);
    },
  });

  function cycleSpeed() {
    speedIdx = (speedIdx + 1) % textSpeeds.length;
    typewriter.speed = textSpeeds[speedIdx].ms;
    config.set('app.textSpeed', textSpeeds[speedIdx].ms);
  }

  function handleSend() {
    const trimmed = inputText.trim();
    if (!trimmed || isThinking) return;

    inputText = '';
    isThinking = true;
    avatarService.setEmotion('smile', 'agree');

    // Simulated LLM turn for UI integration (Phase 6 full loop connects api.chat)
    setTimeout(() => {
      isThinking = false;
      const reply = `Let's head out on an adventure! The weather on the island is fantastic today.`;
      recentPages = [...recentPages.slice(-4), reply];
      activePageIdx = recentPages.length - 1;
      avatarService.setEmotion('happy', 'agree');
      avatarService.setTalking(true);
      typewriter.start(reply);
    }, 1000);
  }

  function handleSkipTypewriter() {
    if (typewriter.isTyping) {
      typewriter.finish();
    }
  }

  function selectPage(idx: number) {
    if (typewriter.isTyping) typewriter.finish();
    activePageIdx = idx;
    displayText = recentPages[idx];
  }

  onDestroy(() => {
    typewriter.cancel();
  });
</script>

<div class="relative flex flex-col size-full justify-between p-3 pointer-events-none">
  <!-- Top HUD Cluster -->
  <div class="flex items-start justify-between pointer-events-auto">
    <div class="flex flex-col gap-1.5">
      <!-- Stamina Row -->
      <div class="flex items-center gap-1.5 bg-card/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-border/40 shadow-sm">
        <div class="flex items-center gap-0.5">
          {#each Array(game.apples().slots) as _, i}
            <img
              src="/assets/icons/{i < game.apples().filled ? 'stamina_apple_filled' : 'stamina_apple_empty'}.svg"
              alt=""
              class="w-4 h-4"
            />
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
          onclick={() => viewStore.setView('quest')}
        >
          <img src="/assets/icons/hud_coin.svg" alt="" class="w-3.5 h-3.5" />
          <span>{game.cheat() ? '∞' : game.s.money.toLocaleString()}</span>
        </Button>

        <div class="bg-card/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-border/40 text-xs font-semibold text-foreground/80 shadow-sm">
          Lv.{game.level()}
        </div>
      </div>
    </div>

    <!-- Quick Action Floating Buttons -->
    <div class="flex flex-col gap-1 pointer-events-auto">
      <Button
        variant="outline"
        size="icon"
        class="size-9 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => (panelCollapsed = !panelCollapsed)}
        title="Toggle Log Panel"
      >
        <img
          src="/assets/icons/arrow_up.svg"
          alt=""
          class="w-4 h-4 transition-transform duration-200 {panelCollapsed ? 'rotate-180' : ''}"
        />
      </Button>

      <Button
        variant="outline"
        size="icon"
        class="size-9 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => viewStore.setView('quest')}
        title="Quests"
      >
        <img src="/assets/icons/quest.svg" alt="" class="w-4 h-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        class="size-9 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => viewStore.setView('skin')}
        title="Costumes"
      >
        <img src="/assets/icons/bag.svg" alt="" class="w-4 h-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        class="size-9 rounded-full bg-card/70 backdrop-blur-md border-border/50 shadow-md hover:bg-card/90"
        onclick={() => viewStore.setView('settings')}
        title="Settings"
      >
       <CogIcon class="size-4" />
      </Button>
    </div>
  </div>

  <!-- Bottom Log Panel & Input Bar -->
   <div class="sm:w-lg mx-auto">
    <div class="flex flex-col gap-2 pointer-events-auto transition-all duration-300 {panelCollapsed ? 'translate-y-[calc(100%-3.5rem)]' : ''}">
      <!-- Dialogue Bubble Card -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="bg-card/85 backdrop-blur-md border border-border/50 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2.5 cursor-pointer select-text w-full"
        onclick={handleSkipTypewriter}
      >
        <div class="flex items-center justify-between border-b border-border/30 pb-2 w-full">
          <div class="flex items-center gap-2.5">
            <img
              src="/assets/images/chara_icons/ryza.png"
              alt="Ryza"
              class="w-8 h-8 rounded-full border border-gold/40 object-cover"
            />
            <div class="flex flex-col">
              <span class="text-xs font-bold text-gold leading-none">Ryza</span>
              <span class="text-[10px] text-muted-foreground leading-tight mt-0.5">
                Free Talk Mode
              </span>
            </div>
          </div>

          <!-- Message Page Dots -->
          {#if recentPages.length > 1}
            <div class="flex items-center gap-1">
              {#each recentPages as _, idx}
                <Button
                  variant="ghost"
                  size="icon"
                  class="w-2.5 h-2.5 min-w-0 p-0 rounded-full transition-colors {idx === activePageIdx ? 'bg-gold hover:bg-gold' : 'bg-muted-foreground/40 hover:bg-muted-foreground/60'}"
                  onclick={(e) => {
                    e.stopPropagation();
                    selectPage(idx);
                  }}
                  aria-label="Message {idx + 1}"
                />
              {/each}
            </div>
          {/if}
        </div>

        <!-- Dialogue Text / Thinking Dots -->
        <div class="min-h-12 text-sm leading-relaxed text-foreground font-normal overflow-y-auto max-h-32">
          {#if isThinking}
            <div class="flex items-center gap-1.5 py-2 text-gold animate-pulse">
              <span class="w-2 h-2 rounded-full bg-gold"></span>
              <span class="w-2 h-2 rounded-full bg-gold animation-delay-200"></span>
              <span class="w-2 h-2 rounded-full bg-gold animation-delay-400"></span>
              <span class="text-xs text-muted-foreground ml-1.5">Ryza is thinking...</span>
            </div>
          {:else}
            {displayText}
          {/if}
        </div>
      </div>

      <!-- Input Bar -->
      <div class="flex items-center gap-1.5 bg-card/80 backdrop-blur-md p-1.5 rounded-full border border-border/50 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          class="size-9 rounded-full text-xs font-bold text-gold hover:bg-muted/40"
          onclick={cycleSpeed}
          title="Text Speed"
        >
          {textSpeeds[speedIdx].label}
        </Button>

        <Input
          bind:value={inputText}
          placeholder="Say something to Ryza..."
          class="h-9 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm px-2 text-foreground placeholder:text-muted-foreground/60"
          onkeydown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />

        <Button
          variant="ghost"
          size="icon"
          class="size-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40"
          onclick={() => (inputText = '')}
          title="Clear Input"
        >
          <img src="/assets/icons/asterisk.svg" alt="" class="w-4 h-4 opacity-70" />
        </Button>

        <Button
          size="icon"
          class="size-9 rounded-full bg-gold text-background hover:bg-gold/90 shadow-sm"
          onclick={handleSend}
          title="Send"
        >
          <img src="/assets/icons/send.svg" alt="Send" class="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
</div>
