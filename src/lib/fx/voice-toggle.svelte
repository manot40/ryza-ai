<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    active?: boolean;
    size?: number;
    class?: string;
  }

  let { active = true, size = 32, class: className = '' }: Props = $props();

  let canvas: HTMLCanvasElement | null = null;
  let rafId = 0;
  let voiceT = 0;
  const voiceDur = 3;

  function draw(dt: number) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    voiceT += dt;
    const t = (voiceT % voiceDur) / voiceDur;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#f6ecdf';
    ctx.fillStyle = '#f6ecdf';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Speaker cone
    ctx.beginPath();
    ctx.moveTo(8, cy - 5);
    ctx.lineTo(13, cy - 5);
    ctx.lineTo(18, cy - 10);
    ctx.lineTo(18, cy + 10);
    ctx.lineTo(13, cy + 5);
    ctx.lineTo(8, cy + 5);
    ctx.closePath();
    ctx.fill();

    if (active) {
      const pulse = 0.65 + 0.35 * Math.sin(t * Math.PI * 2);
      ctx.beginPath();
      ctx.arc(cx + 2, cy, 7 * pulse, -0.7, 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 2, cy, 11 * pulse, -0.7, 0.7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(w - 8, h - 8);
      ctx.strokeStyle = '#ff9a86';
      ctx.stroke();
    }
  }

  onMount(() => {
    let last = performance.now();

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      draw(dt);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<canvas
  bind:this={canvas}
  width={size}
  height={size}
  class="pointer-events-none {className}"
  aria-hidden="true">
</canvas>
