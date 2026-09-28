<script lang="ts">
  import type { XYMap } from './engine/types';

  import { cn } from '$lib/utils';
  import { onMount, onDestroy } from 'svelte';

  import service from './avatar-service.svelte';

  interface Props {
    stageId?: string;
    tod?: string;
    skinId?: string;
    hidden?: boolean;
    class?: string;
    onTapPart?: (part: string, overlayId: string | null) => void;
  }

  let { class: className = '', onTapPart }: Props = $props();

  let canvas: HTMLCanvasElement | null = null;
  let containerEl: HTMLDivElement | null = null;

  type Ripple = XYMap & { id: number };
  let ripples = $state<Ripple[]>([]),
    nextRippleId = 0;
  let drag = { id: null as number | null, x: 0, y: 0 },
    dragMoved = false;

  function handlePointerDown(e: PointerEvent) {
    if (!canvas) return;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    dragMoved = false;
    try {
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}

    const rect = canvas.getBoundingClientRect();
    const z = service.engine.cssZoom(canvas);
    const x = (e.clientX - rect.left) / z;
    const y = (e.clientY - rect.top) / z;
    service.engine.setPointer(x, y, true);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const z = service.engine.cssZoom(canvas);
    const x = (e.clientX - rect.left) / z;
    const y = (e.clientY - rect.top) / z;
    service.engine.setPointer(x, y, true);

    if (drag.id === e.pointerId) {
      const dx = (e.clientX - drag.x) / z;
      const dy = (e.clientY - drag.y) / z;
      if (Math.abs(dx) + Math.abs(dy) >= 6) {
        drag.x = e.clientX;
        drag.y = e.clientY;
        dragMoved = true;
        service.engine.panBy(dx, dy);
      }
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!canvas) return;
    const wasMoved = dragMoved;
    if (drag.id === e.pointerId) {
      drag.id = null;
      dragMoved = false;
    }
    if (wasMoved) return;

    const rect = canvas.getBoundingClientRect();
    const z = service.engine.cssZoom(canvas);
    const x = (e.clientX - rect.left) / z;
    const y = (e.clientY - rect.top) / z;

    const part = service.engine.hitPartAt(x, y);
    if (part) {
      const ripId = ++nextRippleId;
      ripples = [...ripples, { id: ripId, x: e.clientX - rect.left, y: e.clientY - rect.top }];
      setTimeout(() => {
        ripples = ripples.filter((r) => r.id !== ripId);
      }, 600);
      const overlay = service.engine.poke(part);
      onTapPart?.(part, overlay);
    }
  }

  function handlePointerLeave() {
    service.engine.setPointer(0, 0, false);
    drag.id = null;
    dragMoved = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const eng = service.engine;
    eng.zoomBy(e.deltaY < 0 ? eng.PLAYER_ZOOM_STEP : -eng.PLAYER_ZOOM_STEP);
  }

  onMount(() => {
    if (canvas && containerEl) service.init(canvas, containerEl);
  });

  onDestroy(() => service.destroy());
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={containerEl}
  onwheel={handleWheel}
  onpointerup={handlePointerUp}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerleave={handlePointerLeave}
  class={cn('relative size-full overflow-hidden', className)}>
  <canvas bind:this={canvas} class="block size-full touch-none select-none"></canvas>
  {#each ripples as r (r.id)}
    <div
      class="tap-ripple pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 size-14 rounded-full border-2 border-gold/70 bg-gold/20 animate-ping duration-500"
      style="left: {r.x}px; top: {r.y}px;">
    </div>
  {/each}
</div>
