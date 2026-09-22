<script lang="ts">
  import {
    world,
    WORLD_MAP_FIELDS,
    WORLD_MAP_STAGES,
    fallbackFieldPos,
    fallbackStagePos,
    type WorldField,
    type WorldStage,
  } from '$lib/stores/world.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  interface Props {
    currentStageId: string;
    day: number;
    initialAreaId?: string;
    onSelectStage: (stageId: string) => void;
    onToggleList: () => void;
  }

  const { currentStageId, day, initialAreaId, onSelectStage, onToggleList }: Props = $props();

  const ZOOM_MIN = 1.0;
  const ZOOM_MAX = 3.2;
  const ZOOM_STEP = 0.35;

  let level = $state<'area' | 'field'>('area');
  let areaId = $state('area_01');
  let fieldId = $state('');

  $effect(() => {
    if (initialAreaId) {
      areaId = initialAreaId;
    } else {
      const a = world.areaOf(currentStageId);
      if (a) areaId = a;
    }
  });

  let zoom = $state(1.0);
  let panX = $state(0);
  let panY = $state(0);

  let isAreaSheetOpen = $state(false);

  // Dragging state
  let isDragging = $state(false);
  let isDragLocked = $state(false);
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let originPanX = 0;
  let originPanY = 0;
  let activePointers: Record<number, { x: number; y: number }> = {};
  let pinchBaseDist = 0;
  let pinchBaseZoom = 1.0;

  const MAP_ASPECT = 2048 / 1152;
  let vw = $state(800);
  let vh = $state(600);
  let viewportEl: HTMLDivElement | undefined = $state();

  const layerW = $derived.by(() => {
    if (!vw || !vh) return 1920;
    if (vw / vh >= MAP_ASPECT) {
      return vw;
    }
    return vh * MAP_ASPECT;
  });

  const layerH = $derived.by(() => {
    if (!vw || !vh) return 1080;
    if (vw / vh >= MAP_ASPECT) {
      return vw / MAP_ASPECT;
    }
    return vh;
  });

  const areas = $derived(world.areas());
  const currentArea = $derived(areas.find((a) => a.id === areaId) || areas[0]);
  const fields = $derived(world.fields(areaId));
  const currentField = $derived(fields.find((f) => f.id === fieldId));
  const stages = $derived(fieldId ? world.stagesInField(fieldId) : []);

  const currentAreaOfRyza = $derived(world.areaOf(currentStageId));
  const currentFieldOfRyza = $derived(world.fieldOf(currentStageId));

  function clampPan() {
    const scaledW = layerW * zoom;
    const scaledH = layerH * zoom;

    const maxPanX = Math.max(0, (scaledW - vw) / 2);
    const maxPanY = Math.max(0, (scaledH - vh) / 2);

    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  function applyZoomBy(delta: number) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
    clampPan();
  }

  function resetCamera() {
    zoom = 1.0;
    panX = 0;
    panY = 0;
    isDragLocked = false;
    clampPan();
  }

  function focusField(fId: string) {
    const p = WORLD_MAP_FIELDS[fId] || fallbackFieldPos(fields, fId);
    if (!p) return;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, p[2]));
    const dxFromCenter = (p[0] - 0.5) * layerW;
    const dyFromCenter = (p[1] - 0.5) * layerH;
    panX = -dxFromCenter * zoom;
    panY = -dyFromCenter * zoom;
    clampPan();
  }

  function recenterOnRyza() {
    if (currentAreaOfRyza && currentAreaOfRyza !== areaId) {
      if (world.locked(currentAreaOfRyza)) {
        toast.err('Area locked');
        return;
      }
      areaId = currentAreaOfRyza;
      level = 'area';
      fieldId = '';
    }

    if (currentFieldOfRyza) {
      focusField(currentFieldOfRyza);
    } else {
      resetCamera();
    }
  }

  function handleSelectField(f: WorldField) {
    level = 'field';
    fieldId = f.id;
    isDragLocked = true;
    focusField(f.id);
  }

  function handleLeaveField() {
    level = 'area';
    fieldId = '';
    isDragLocked = false;
    resetCamera();
  }

  function handlePointerDown(e: PointerEvent) {
    if (isDragLocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    originPanX = panX;
    originPanY = panY;
  }

  function handlePointerMove(e: PointerEvent) {
    if (isDragLocked || !isDragging) return;
    activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const SLOP = 6;
    if (!hasMoved && Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;

    if (!hasMoved) {
      hasMoved = true;
      try {
        viewportEl?.setPointerCapture(e.pointerId);
      } catch {}
    }

    const pointerIds = Object.keys(activePointers);
    if (pointerIds.length >= 2) {
      const p1 = activePointers[Number(pointerIds[0])];
      const p2 = activePointers[Number(pointerIds[1])];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (pinchBaseDist > 0) {
        zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchBaseZoom * (dist / pinchBaseDist)));
        clampPan();
      } else {
        pinchBaseDist = dist;
        pinchBaseZoom = zoom;
      }
      return;
    }

    panX = originPanX + dx;
    panY = originPanY + dy;
    clampPan();
  }

  function handlePointerUp(e: PointerEvent) {
    try {
      if (viewportEl && viewportEl.hasPointerCapture(e.pointerId)) {
        viewportEl.releasePointerCapture(e.pointerId);
      }
    } catch {}

    delete activePointers[e.pointerId];
    const remainingIds = Object.keys(activePointers);
    if (remainingIds.length === 0) {
      isDragging = false;
      hasMoved = false;
      pinchBaseDist = 0;
    } else if (remainingIds.length === 1) {
      const remaining = activePointers[Number(remainingIds[0])];
      if (remaining) {
        startX = remaining.x;
        startY = remaining.y;
        originPanX = panX;
        originPanY = panY;
        pinchBaseDist = 0;
      }
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    applyZoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }
</script>

<div class="relative w-full h-full flex-1 flex flex-col select-none overflow-hidden bg-[#0d1016]">
  <!-- Top Center: Current Location Badge -->
  <div class="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
    <div
      class="bg-[#120c0a]/85 text-[#f0e6d8] text-xs font-medium px-3.5 py-1 rounded-full border border-white/10 shadow-md backdrop-blur-xs max-w-[70vw] truncate">
      {world.stageName(currentStageId)}
    </div>
  </div>

  <!-- Interactive Pan / Zoom Canvas Layer -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={viewportEl}
    bind:clientWidth={vw}
    bind:clientHeight={vh}
    class="w-full h-full flex-1 relative overflow-hidden touch-none select-none {isDragLocked
      ? 'cursor-default'
      : isDragging
        ? 'cursor-grabbing'
        : 'cursor-grab'} {level === 'field' ? 'focused' : ''}"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onwheel={handleWheel}>
    <div
      class="absolute origin-center will-change-transform {isDragging
        ? 'transition-none'
        : 'transition-transform duration-200 ease-out'}"
      style="width: {layerW}px; height: {layerH}px; left: 50%; top: 50%; margin-left: {-layerW /
        2}px; margin-top: {-layerH / 2}px; transform: translate({panX}px, {panY}px) scale({zoom});">
      <!-- Background Plate -->
      <img
        src="/assets/world_map/areas/{areaId}.jpg"
        alt="World Map Plate"
        class="absolute inset-0 w-full h-full object-fill pointer-events-none select-none {level === 'field'
          ? 'brightness-60 saturate-75 transition duration-300'
          : 'transition duration-300'}"
        draggable="false" />

      <!-- Field Level Pins (when level === 'area') -->
      {#if level === 'area'}
        {#each fields as field}
          {@const p = WORLD_MAP_FIELDS[field.id] || fallbackFieldPos(fields, field.id)}
          {@const isRyzaField = currentFieldOfRyza === field.id}
          <button
            type="button"
            class="absolute -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center gap-0.5 cursor-pointer group focus:outline-hidden"
            style="left: {p[0] * 100}%; top: {p[1] * 100}%;"
            onclick={(e) => {
              e.stopPropagation();
              handleSelectField(field);
            }}>
            <div class="relative w-8 h-8 flex items-center justify-center">
              <img
                src="/assets/world_map/ui/field_pin.svg"
                alt="Pin"
                class="w-7 h-7 drop-shadow-md transition-transform group-hover:scale-110"
                draggable="false" />
              {#if isRyzaField}
                <img
                  src="/assets/world_map/ui/field_pin_ring.svg"
                  alt="Ring"
                  class="absolute -inset-1.5 w-11 h-11 animate-pulse pointer-events-none"
                  draggable="false" />
              {/if}
            </div>
            <span
              class="px-2 py-0.5 rounded-full text-[11px] leading-tight font-medium whitespace-nowrap shadow-sm {isRyzaField
                ? 'bg-[#b8471f] text-white font-semibold'
                : 'bg-[#120c0a]/85 text-[#f2e8dc] border border-white/10'}">
              {world.fieldName(field.id)}
            </span>
          </button>
        {/each}
      {/if}

      <!-- Stage Level Pins (when level === 'field') -->
      {#if level === 'field' && currentField}
        {@const baseP = WORLD_MAP_FIELDS[currentField.id] || fallbackFieldPos(fields, currentField.id)}
        {#each stages as stage}
          {@const stageCalibrated = WORLD_MAP_STAGES[stage.id]}
          {@const sPos = stageCalibrated
            ? [baseP[0] + stageCalibrated[0] * 0.08, baseP[1] + stageCalibrated[1] * 0.08, baseP[2]]
            : fallbackStagePos(stages, stage.id, baseP)}
          {@const isCurrent = stage.id === currentStageId}
          <button
            type="button"
            class="absolute -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center gap-0.5 cursor-pointer group focus:outline-hidden"
            style="left: {sPos[0] * 100}%; top: {sPos[1] * 100}%;"
            onclick={(e) => {
              e.stopPropagation();
              onSelectStage(stage.id);
            }}>
            <img
              src={isCurrent
                ? '/assets/world_map/ui/field_pin.svg'
                : '/assets/world_map/ui/field_pin_inactive.svg'}
              alt="Stage Pin"
              class="w-6 h-6 drop-shadow-md transition-transform group-hover:scale-110"
              draggable="false" />
            <span
              class="px-1.5 py-0.5 rounded-full text-[10px] leading-tight font-medium whitespace-nowrap shadow-xs {isCurrent
                ? 'bg-[#b8471f] text-white font-semibold'
                : 'bg-[#120c0a]/85 text-[#f2e8dc] border border-white/10'}">
              {world.stageName(stage.id)}
            </span>
          </button>
        {/each}
      {/if}

      <!-- Ryza Location Marker Ribbon + Avatar -->
      {#if currentAreaOfRyza === areaId && currentFieldOfRyza}
        {@const myP = WORLD_MAP_FIELDS[currentFieldOfRyza] || fallbackFieldPos(fields, currentFieldOfRyza)}
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none flex flex-col items-center gap-0.5"
          style="left: {myP[0] * 100}%; top: {myP[1] * 100}%;">
          <div class="relative w-[74px] h-[28px] flex items-center justify-center">
            <img
              src="/assets/world_map/ui/current_location.svg"
              alt="Current Location"
              class="w-full h-full drop-shadow-md object-contain"
              draggable="false" />
            <span
              class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tracking-wide drop-shadow-sm">
              Current
            </span>
          </div>
          <div
            class="w-9 h-9 rounded-full bg-[#fdf7ee] border-2 border-white shadow-lg overflow-hidden flex items-center justify-center -mt-1">
            <img
              src="/assets/images/chara_icons/ryza.png"
              alt="Ryza"
              class="w-full h-full object-cover"
              draggable="false" />
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Zoom Controls (Bottom Right) -->
  <div class="absolute right-3 bottom-16 z-20 flex flex-col gap-2">
    {#if level === 'field'}
      <button
        type="button"
        class="w-9 h-9 rounded-full border border-white/20 {isDragLocked
          ? 'bg-[#b8471f] text-white shadow-[#b8471f]/30'
          : 'bg-[#120c0c]/85 text-[#f2e8dc] hover:bg-[#1a1212]'} text-sm font-bold flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
        onclick={() => (isDragLocked = !isDragLocked)}
        title={isDragLocked ? 'Drag Locked (Tap to Unlock)' : 'Drag Unlocked (Tap to Lock)'}>
        {isDragLocked ? '🔒' : '🔓'}
      </button>
    {/if}
    <button
      type="button"
      class="w-9 h-9 rounded-full bg-[#120c0c]/85 hover:bg-[#1a1212] border border-white/20 text-[#f2e8dc] text-lg font-bold flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
      onclick={() => applyZoomBy(ZOOM_STEP)}
      title="Zoom In">
      ＋
    </button>
    <button
      type="button"
      class="w-9 h-9 rounded-full bg-[#120c0c]/85 hover:bg-[#1a1212] border border-white/20 text-[#f2e8dc] text-lg font-bold flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
      onclick={() => applyZoomBy(-ZOOM_STEP)}
      title="Zoom Out">
      －
    </button>
    <button
      type="button"
      class="w-9 h-9 rounded-full bg-[#120c0c]/85 hover:bg-[#1a1212] border border-white/20 text-[#f2e8dc] text-sm font-bold flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
      onclick={resetCamera}
      title="Reset Zoom">
      ◎
    </button>
  </div>

  <!-- Bottom Navigation Bar -->
  <div class="absolute left-3 right-3 bottom-3 z-20 flex items-center gap-2">
    {#if level === 'field'}
      <button
        type="button"
        class="flex-1 flex items-center gap-2 min-w-0 px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#120c0c]/85 hover:bg-[#1a1212] text-[#f2e8dc] text-xs font-semibold shadow-lg transition cursor-pointer"
        onclick={handleLeaveField}>
        <span class="text-base text-gold leading-none">‹</span>
        <span class="truncate">{world.fieldName(fieldId)}</span>
      </button>
    {:else}
      <button
        type="button"
        class="flex-1 flex items-center gap-2 min-w-0 px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#120c0c]/85 hover:bg-[#1a1212] text-[#f2e8dc] text-xs font-semibold shadow-lg transition cursor-pointer"
        onclick={() => (isAreaSheetOpen = true)}>
        <span class="text-gold leading-none">◉</span>
        <span class="truncate">{world.areaName(areaId)}</span>
      </button>
    {/if}

    <button
      type="button"
      class="px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#120c0c]/85 hover:bg-[#1a1212] text-[#f2e8dc] text-xs font-semibold shadow-lg transition cursor-pointer whitespace-nowrap active:scale-95"
      onclick={recenterOnRyza}>
      Current
    </button>

    <button
      type="button"
      class="px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#120c0c]/85 hover:bg-[#1a1212] text-[#f2e8dc] text-xs font-semibold shadow-lg transition cursor-pointer whitespace-nowrap active:scale-95"
      onclick={onToggleList}>
      List
    </button>
  </div>

  <!-- Area Selection Modal/Sheet -->
  {#if isAreaSheetOpen}
    <div
      class="absolute inset-0 z-30 bg-black/50 backdrop-blur-xs flex flex-col justify-end"
      role="button"
      tabindex="0"
      onclick={() => (isAreaSheetOpen = false)}
      onkeydown={(e) => {
        if (e.key === 'Escape') isAreaSheetOpen = false;
      }}>
      <div
        class="bg-[#171316] border-t border-border/40 rounded-t-2xl p-4 space-y-3 max-h-[75vh] flex flex-col"
        role="dialog"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between pb-1 border-b border-border/20">
          <h3 class="text-sm font-bold text-[#f2e8dc]">Select Area</h3>
          <button
            type="button"
            class="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            onclick={() => (isAreaSheetOpen = false)}>
            ✕
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 overflow-y-auto pr-1">
          {#each areas as a}
            {@const locked = world.locked(a.id)}
            {@const isHere = a.id === areaId}
            {@const folks = world.npcsInArea(a.id, day).slice(0, 5)}
            {@const thumbOk = ['area_01', 'area_02', 'area_03'].includes(a.id)}
            <button
              type="button"
              class="relative rounded-xl border-2 p-1 text-left transition overflow-hidden group {isHere
                ? 'border-[#e05a2a] bg-[#e05a2a]/10'
                : 'border-white/10 hover:border-white/30 bg-black/30'} {locked
                ? 'opacity-70 cursor-not-allowed'
                : 'cursor-pointer'}"
              onclick={() => {
                if (locked) {
                  toast.err('No ship, no leaving Kurken Island');
                  return;
                }
                areaId = a.id;
                level = 'area';
                fieldId = '';
                resetCamera();
                isAreaSheetOpen = false;
              }}>
              <div class="relative h-20 w-full rounded-lg overflow-hidden bg-muted">
                <img
                  src={thumbOk
                    ? `/assets/world_map/area_thumbs/${a.id}.jpg`
                    : `/assets/world_map/areas/${a.id}.jpg`}
                  alt={world.areaName(a.id)}
                  class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                {#if isHere}
                  <span
                    class="absolute top-1.5 left-1.5 bg-[#d94f22] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                    Current
                  </span>
                {/if}
                {#if locked}
                  <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span class="text-xl">🔒</span>
                  </div>
                {/if}
                {#if folks.length > 0}
                  <div class="absolute right-1.5 bottom-1.5 flex -space-x-1.5">
                    {#each folks as folk}
                      <img
                        src={world.iconFor(folk.id)}
                        alt={world.npcName(folk.id)}
                        class="w-5 h-5 rounded-full border border-background object-cover bg-muted" />
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="mt-1 text-center">
                <span class="text-xs font-semibold text-[#e8ded2] truncate block">
                  {world.areaName(a.id)}
                </span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
