import type { SceneConfigLight } from '../types';

import { Filter, GlProgram, GpuProgram, defaultFilterVert } from 'pixi.js';

import RIM_GL from './shader.glsl?raw';
import RIM_WG from './shader.wgsl?raw';

export class RimFilter extends Filter {
  constructor() {
    const glProgram = GlProgram.from({
      vertex: defaultFilterVert,
      fragment: RIM_GL,
    });
    const gpuProgram = GpuProgram.from({
      vertex: { source: RIM_WG, entryPoint: 'mainVertex' },
      fragment: { source: RIM_WG, entryPoint: 'mainFragment' },
    });

    super({
      glProgram,
      gpuProgram,
      resources: {
        rimUniforms: {
          uTexel: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uLight: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uRimColor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
          uRimOpacity: { value: 0.7, type: 'f32' },
          uGlowPower: { value: 2.4, type: 'f32' },
        },
      },
      padding: 0,
      resolution: 'inherit',
      antialias: 'inherit',
      blendMode: 'add',
    });
  }

  updateLight(viewportW: number, viewportH: number, light?: SceneConfigLight | null): void {
    const res = this.resources as Record<string, { uniforms: Record<string, unknown> }>;
    const uniforms = res.rimUniforms?.uniforms;
    if (!uniforms) return;

    const n = Number(light?.color) >>> 0;
    const cr = ((n >>> 16) & 255) / 255;
    const cg = ((n >>> 8) & 255) / 255;
    const cb = (n & 255) / 255;

    let deg = Number(light?.direction);
    if (Number.isNaN(deg)) deg = 220;
    const rad = (deg * Math.PI) / 180;

    let glow = Number(light?.rimGlowWidth);
    if (!(glow > 0)) glow = 12;
    let power = Number(light?.rimGlowPower);
    if (!(power > 0)) power = 2.4;
    let opac = Number(light?.rimOpacity);
    if (!(opac >= 0)) opac = 0.7;
    if (light?.rimEnabled === false) opac = 0;

    const uTexel = uniforms.uTexel as Float32Array;
    if (uTexel) {
      uTexel[0] = 1 / Math.max(1, viewportW);
      uTexel[1] = 1 / Math.max(1, viewportH);
    }
    const uLight = uniforms.uLight as Float32Array;
    if (uLight) {
      uLight[0] = Math.cos(rad) * glow;
      uLight[1] = Math.sin(rad) * glow;
    }
    const uRimColor = uniforms.uRimColor as Float32Array;
    if (uRimColor) {
      uRimColor[0] = cr;
      uRimColor[1] = cg;
      uRimColor[2] = cb;
    }
    uniforms.uRimOpacity = opac;
    uniforms.uGlowPower = power;
  }
}
