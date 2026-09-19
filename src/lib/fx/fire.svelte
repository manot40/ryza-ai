<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		width?: number;
		height?: number;
		class?: string;
	}

	let { width = 180, height = 180, class: className = '' }: Props = $props();

	let canvas: HTMLCanvasElement | null = null;
	let rafId = 0;
	let fireT = 0;

	function draw(dt: number) {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const w = canvas.width;
		const h = canvas.height;
		fireT += dt;
		const t = fireT;

		ctx.clearRect(0, 0, w, h);

		for (let i = 0; i < 14; i++) {
			const flicker = Math.sin(t * 8 + i * 1.7) * 0.5 + 0.5;
			const x = w / 2 + Math.sin(t * 2.2 + i) * (8 + i);
			const y = h * 0.72 - (i * 4 + ((t * 28 + i * 11) % 40));
			const s = 10 - i * 0.4 + flicker * 3;

			ctx.beginPath();
			ctx.fillStyle =
				i % 2
					? `rgba(232,180,92,${0.35 + flicker * 0.4})`
					: `rgba(255,138,76,${0.3 + flicker * 0.45})`;
			ctx.ellipse(x, y, s * 0.55, s, 0, 0, Math.PI * 2);
			ctx.fill();
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
	{width}
	{height}
	class="pointer-events-none {className}"
	aria-hidden="true"
></canvas>
