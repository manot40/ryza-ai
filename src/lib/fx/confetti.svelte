<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		class?: string;
	}

	interface ConfettiParticle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		rot: number;
		vr: number;
		w: number;
		h: number;
		life: number;
		col: string;
	}

	let { class: className = '' }: Props = $props();

	let canvas: HTMLCanvasElement | null = null;
	let rafId = 0;
	let confetti: ConfettiParticle[] = [];
	const confettiDur = 2.2;

	export function burst() {
		if (!canvas) return;
		const r = canvas.getBoundingClientRect();
		const n = 56;
		confetti = [];
		for (let i = 0; i < n; i++) {
			const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
			confetti.push({
				x: r.width / 2,
				y: r.height * 0.42,
				vx: Math.cos(ang) * (180 + Math.random() * 220),
				vy: Math.sin(ang) * (80 + Math.random() * 160) - 220,
				rot: Math.random() * 6,
				vr: (Math.random() - 0.5) * 10,
				w: 6 + Math.random() * 7,
				h: 10 + Math.random() * 10,
				life: confettiDur,
				col: Math.random() > 0.5 ? '#e8b45c' : '#ff8a4c'
			});
		}
	}

	function draw(dt: number) {
		if (!canvas) return;
		const host = canvas.parentElement;
		if (host && host.classList.contains('hidden')) {
			confetti = [];
			return;
		}

		const w = host?.clientWidth || 360;
		const h = host?.clientHeight || 640;
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const next: ConfettiParticle[] = [];
		for (let i = 0; i < confetti.length; i++) {
			const p = confetti[i];
			p.life -= dt;
			if (p.life <= 0) continue;
			p.vy += 520 * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rot += p.vr * dt;
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rot);
			ctx.globalAlpha = Math.max(0, p.life / confettiDur);
			ctx.fillStyle = p.col;
			ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
			ctx.restore();
			next.push(p);
		}
		confetti = next;
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
	class="pointer-events-none absolute inset-0 {className}"
	aria-hidden="true"
></canvas>
