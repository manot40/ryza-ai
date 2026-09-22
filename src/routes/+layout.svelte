<script lang="ts">
  import './layout.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import { avatarService } from '$lib/avatar/avatar-service.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { modal } from '$lib/stores/modal.svelte';
  import { sound } from '$lib/audio/sound';
  import { voiceBank } from '$lib/audio/voicebank';
  import { world } from '$lib/stores/world.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { game } from '$lib/stores/game.svelte';
  import { quests } from '$lib/stores/quests.svelte';
  import { talkLoop } from '$lib/talk-loop.svelte';
  import { nsfw } from '$lib/stores/nsfw.svelte';
  import { overlayStore } from '$lib/stores/overlay.svelte';

  import TopBar from '$components/chrome/TopBar.svelte';
  import Drawer from '$components/chrome/Drawer.svelte';
  import SideMenu from '$components/chrome/SideMenu.svelte';
  import AppModal from '$components/AppModal.svelte';
  import ToastHost from '$components/chrome/ToastHost.svelte';
  import Confetti from '$lib/fx/confetti.svelte';
  import { computeFitUiZoom } from '$lib/fit-ui';
  import { imeViewport } from '$lib/actions/ime-viewport';
  import { initElectronShell } from '$lib/platform/electron';

  // Bottom Sheets
  import ModeSheet from '$components/sheets/ModeSheet.svelte';
  import InventorySheet from '$components/sheets/InventorySheet.svelte';
  import StatusSheet from '$components/sheets/StatusSheet.svelte';
  import NpcSheet from '$components/sheets/NpcSheet.svelte';
  import LanguageSheet from '$components/sheets/LanguageSheet.svelte';

  // Overlays
  import TitleOverlay from '$components/overlays/TitleOverlay.svelte';
  import OnboardingOverlay from '$components/overlays/OnboardingOverlay.svelte';
  import PrologueOverlay from '$components/overlays/PrologueOverlay.svelte';
  import AlarmOverlay from '$components/overlays/AlarmOverlay.svelte';
  import QuestClearOverlay from '$components/overlays/QuestClearOverlay.svelte';
  import FaintOverlay from '$components/overlays/FaintOverlay.svelte';
  import ConfirmDialog from '$components/overlays/ConfirmDialog.svelte';

  let { children } = $props();

  let avatarRef: Avatar | null = null;
  let confettiRef: Confetti | null = null;
  let phoneEl: HTMLElement | null = null;
  let uiZoom = $state(1);

  const appState = $derived(config.get('state'));

  function updateZoom() {
    if (!browser) return;
    const isShell = Boolean((window as unknown as { ryzaShell?: unknown }).ryzaShell);
    const res = computeFitUiZoom(window.innerWidth, window.innerHeight, isShell, uiZoom);
    if (res.changed) {
      uiZoom = res.zoom;
      if (phoneEl) {
        phoneEl.style.zoom = String(res.zoom);
      }
    }
  }

  $effect(() => {
    if (avatarRef) {
      avatarService.setInstance(avatarRef);
    }
  });

  async function handleNewConversation() {
    const ok = await modal.confirm(
      'New Conversation',
      'Start a new conversation with Ryza? This resets active chat turns, but your adventure level, inventory, and memories will remain safe.',
      'Start New Talk',
      'Cancel'
    );
    if (ok) {
      session.clearHistory();
      nsfw.reset();
      talkLoop.recentPages = [];
      talkLoop.activePageIdx = 0;
      viewStore.setView('talk');
      talkLoop.greet();
    }
  }

  function handleTapPart(part: string, overlay: string | null) {
    talkLoop.buzz(18);
    sound.se('touch_start');
    if (overlay) sound.tapVoice(overlay);
  }

  onMount(() => {
    initElectronShell();
    updateZoom();
    window.addEventListener('resize', updateZoom);

    // Boot audio and session services
    Promise.all([config.hydrate(), world.init(), voiceBank.load(), sound.init()]).then(() => {
      sound.setCatalog(Object.keys(world.scenes || {}));
      const st = config.get('state');
      sound.setPlace(st.stage, st.tod, world.backgroundFor(st.stage));
      sound.setRoute(st.onboardingDone ? 'talk' : 'title');
      session.init();
      session.dailyNudge();
    });

    // 30-second RPG clock tick
    const clockInterval = setInterval(() => {
      session.tickTime();
    }, 30000);

    // Lifecycle visibility sync
    const onVisibilityChange = () => {
      if (!document.hidden) {
        session.tickDay();
        session.tickTime();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // RPG event dispatch wiring
    const unbindQuestClear = quests.on('clear', (q) => {
      overlayStore.showQuestClear({
        title: q.title,
        praise: quests.praise(q.no),
      });
      sound.se('quest_clear');
      confettiRef?.burst();
    });

    const unbindGame = game.on('stamina', () => {
      if (game.faint()) {
        talkLoop.showFaint();
      }
    });

    return () => {
      window.removeEventListener('resize', updateZoom);
      clearInterval(clockInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unbindQuestClear();
      unbindGame();
    };
  });
</script>

<div
  class="relative w-screen h-dvh overflow-hidden bg-background flex items-center justify-center select-none">
  <!-- #phone container fixed at 420x860 or full mobile with Android IME adjustment -->
  <main
    id="phone"
    bind:this={phoneEl}
    use:imeViewport
    class="relative w-full h-full max-w-3xl bg-background text-foreground overflow-hidden shadow-2xl flex flex-col">
    <!-- Background Spine Stage & Avatar -->
    <div class="absolute inset-0 z-0 overflow-hidden">
      <Avatar
        bind:this={avatarRef}
        stageId={appState.stage || 'stage_01_001_04'}
        tod={appState.tod || 'aft'}
        skinId={appState.skin || 'crf_skn_002_0001'}
        hidden={avatarService.hidden}
        onTapPart={handleTapPart}
        class="w-full h-full" />
    </div>

    <!-- Stage Vignette & Atmosphere Gradient -->
    <div
      id="vignette"
      class="pointer-events-none absolute inset-0 z-10 bg-radial from-transparent via-transparent to-background/70">
    </div>

    <!-- Confetti particle FX overlay -->
    <Confetti bind:this={confettiRef} class="pointer-events-none absolute inset-0 z-25" />

    <!-- Persistent Top Chrome -->
    {#if viewStore.activeView !== 'world'}
      <TopBar
        onOpenDrawer={() => (viewStore.drawerOpen = true)}
        onOpenSideMenu={() => (viewStore.sideMenuOpen = true)}
        onSelectView={(v) => viewStore.setView(v)} />
    {/if}

    <!-- Navigation Drawer & Quick Menu -->
    <Drawer
      bind:open={viewStore.drawerOpen}
      activeView={viewStore.activeView}
      onSelectView={(v) => viewStore.setView(v)} />

    <SideMenu
      bind:open={viewStore.sideMenuOpen}
      charaHidden={avatarService.hidden}
      onNewTalk={handleNewConversation}
      onToggleChara={() => avatarService.toggleChara()} />

    <!-- Main View Outlet -->
    <div
      class="relative z-20 flex-1 flex flex-col overflow-hidden pointer-events-none {viewStore.activeView ===
      'world'
        ? 'pt-0'
        : 'pt-14'}">
      {@render children()}
    </div>

    <!-- Toast Notifications Host -->
    <ToastHost />

    <!-- Global Dialog Modal -->
    <AppModal />

    <!-- Global Confirmation Alert Dialog -->
    <ConfirmDialog />

    <!-- Bottom Sheets -->
    <ModeSheet />
    <InventorySheet />
    <StatusSheet />
    <NpcSheet />
    <LanguageSheet />

    <!-- Overlays -->
    <TitleOverlay />
    <OnboardingOverlay />
    <PrologueOverlay />
    <AlarmOverlay />
    <QuestClearOverlay />
    <FaintOverlay />
  </main>
</div>
