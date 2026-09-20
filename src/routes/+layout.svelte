<script lang="ts">
  import './layout.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import { avatarService } from '$lib/avatar/avatar-service.svelte';
  import { config } from '$lib/stores/config.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import TopBar from '$components/chrome/TopBar.svelte';
  import Drawer from '$components/chrome/Drawer.svelte';
  import SideMenu from '$components/chrome/SideMenu.svelte';
  import AppModal from '$components/AppModal.svelte';
  import Confetti from '$lib/fx/confetti.svelte';
  import { computeFitUiZoom } from '$lib/fit-ui';

  let { children } = $props();

  let avatarRef: Avatar | null = null;
  let confettiRef: Confetti | null = null;
  let phoneEl: HTMLElement | null = null;
  let uiZoom = $state(1);

  const appState = $derived(config.section('state') || {});

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

  onMount(() => {
    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => {
      window.removeEventListener('resize', updateZoom);
    };
  });
</script>

<div class="relative w-screen h-dvh overflow-hidden bg-black flex items-center justify-center select-none">
  <!-- #phone container fixed at 420x860 or full mobile -->
  <main
    id="phone"
    bind:this={phoneEl}
    class="relative w-full h-full max-w-3xl bg-background text-foreground overflow-hidden shadow-2xl flex flex-col"
  >
    <!-- Background Spine Stage & Avatar -->
    <div class="absolute inset-0 z-0 overflow-hidden">
      <Avatar
        bind:this={avatarRef}
        stageId={appState.stage || 'stage_01_001_04'}
        tod={appState.tod || 'aft'}
        skinId={appState.skin || 'crf_skn_002_0001'}
        hidden={avatarService.hidden}
        class="w-full h-full"
      />
    </div>

    <!-- Stage Vignette & Atmosphere Gradient -->
    <div
      id="vignette"
      class="pointer-events-none absolute inset-0 z-10 bg-radial from-transparent via-transparent to-background/70"
    ></div>

    <!-- Confetti particle FX overlay -->
    <Confetti bind:this={confettiRef} class="pointer-events-none absolute inset-0 z-25" />

    <!-- Persistent Top Chrome -->
    <TopBar
      onOpenDrawer={() => (viewStore.drawerOpen = true)}
      onOpenSideMenu={() => (viewStore.sideMenuOpen = true)}
      onSelectView={(v) => viewStore.setView(v)}
    />

    <!-- Navigation Drawer & Quick Menu -->
    <Drawer
      bind:open={viewStore.drawerOpen}
      activeView={viewStore.activeView}
      onSelectView={(v) => viewStore.setView(v)}
    />

    <SideMenu
      bind:open={viewStore.sideMenuOpen}
      charaHidden={avatarService.hidden}
      onNewTalk={() => viewStore.setView('talk')}
      onToggleChara={() => avatarService.toggleChara()}
    />

    <!-- Main View Outlet -->
    <div class="relative z-20 flex-1 flex flex-col overflow-hidden pt-14">
      {@render children()}
    </div>

    <!-- Global Dialog Modal -->
    <AppModal />
  </main>
</div>
