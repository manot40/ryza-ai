<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { AvatarEngine } from './engine/avatar-engine';

  interface Props {
    stageId?: string;
    tod?: string;
    skinId?: string;
    hidden?: boolean;
    class?: string;
    onTapPart?: (part: string, overlayId: string | null) => void;
  }

  let {
    stageId = 'stage_01_001_04',
    tod = 'aft',
    skinId = 'crf_skn_002_0001',
    hidden = false,
    class: className = '',
    onTapPart,
  }: Props = $props();

  let canvas: HTMLCanvasElement | null = null;
  const engine = new AvatarEngine();
  let ready = $state(false);
  let currentStageTod = '';
  let currentSkin = '';

  interface Ripple {
    id: number;
    x: number;
    y: number;
  }
  let ripples = $state<Ripple[]>([]);
  let nextRippleId = 0;

  export function setEmotion(emotion: string, attitude: string = 'agree', immediate?: boolean) {
    engine.setEmotion(emotion, attitude, immediate);
  }

  export function setTalking(on: boolean) {
    engine.setTalking(on);
  }

  export function setTalkingEnvelope(env: { envelope: number[]; durationMs?: number; windowMs?: number }) {
    engine.setTalkingEnvelope(env);
  }

  export function setAtlasVariant(name: string, cb?: () => void) {
    engine.setAtlasVariant(name, cb);
  }

  export function poke(part: string): string | null {
    return engine.poke(part);
  }

  export function setHidden(on: boolean) {
    engine.setHidden(on);
  }

  export function setAudioAnalyser(analyser: AnalyserNode | null) {
    engine.setAudioAnalyser(analyser);
  }

  export function loadScene(newStageId: string, newTod: string, cb?: (err: Error | null) => void) {
    currentStageTod = `${newStageId}/${newTod}`;
    engine.loadScene(newStageId, newTod, cb, skinId);
  }

  export function loadSkin(newSkinId: string, cb?: (err: Error | null) => void) {
    currentSkin = newSkinId;
    engine.loadSkin(newSkinId, cb);
  }

  function handlePointerDown(e: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const z = engine._cssZoom(canvas);
    const x = (e.clientX - rect.left) / z;
    const y = (e.clientY - rect.top) / z;
    engine.setPointer(x, y, true);

    const part = engine.hitPartAt(x, y);
    if (part) {
      const ripId = ++nextRippleId;
      ripples = [...ripples, { id: ripId, x: e.clientX - rect.left, y: e.clientY - rect.top }];
      setTimeout(() => {
        ripples = ripples.filter((r) => r.id !== ripId);
      }, 600);
      const overlay = engine.poke(part);
      onTapPart?.(part, overlay);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const z = engine._cssZoom(canvas);
    const x = (e.clientX - rect.left) / z;
    const y = (e.clientY - rect.top) / z;
    engine.setPointer(x, y, true);
  }

  function handlePointerLeave() {
    engine.setPointer(0, 0, false);
  }

  let containerEl: HTMLDivElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const handleResize = () => engine.resize();

  onMount(async () => {
    if (!canvas) return;
    await engine.init(canvas);
    engine.resize();

    if (typeof ResizeObserver !== 'undefined' && containerEl) {
      resizeObserver = new ResizeObserver(() => engine.resize());
      resizeObserver.observe(containerEl);
    }
    window.addEventListener('resize', handleResize);
    ready = true;
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', handleResize);
    engine.destroy();
  });

  $effect(() => {
    if (!ready || !stageId || !tod) return;
    const key = `${stageId}/${tod}`;
    if (currentStageTod !== key) {
      currentStageTod = key;
      currentSkin = skinId;
      engine.loadScene(stageId, tod, undefined, skinId);
    }
  });

  $effect(() => {
    if (!ready || !skinId) return;
    if (currentSkin !== skinId) {
      currentSkin = skinId;
      engine.loadSkin(skinId);
    }
  });

  $effect(() => {
    engine.setHidden(hidden);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={containerEl}
  class="relative h-full w-full overflow-hidden {className}"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerleave={handlePointerLeave}>
  <canvas bind:this={canvas} class="h-full w-full touch-none select-none"></canvas>
  {#each ripples as r (r.id)}
    <div
      class="tap-ripple pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 border-gold/70 bg-gold/20 animate-ping duration-500"
      style="left: {r.x}px; top: {r.y}px;">
    </div>
  {/each}
</div>
