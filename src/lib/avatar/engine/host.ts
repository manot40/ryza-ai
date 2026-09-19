import type { SpineHost, SpineLayer } from './types';

export function makeHost(canvas: HTMLCanvasElement): SpineHost | null {
  if (typeof window === 'undefined') return null;
  const spineObj = (window as unknown as { spine?: any }).spine;
  if (!spineObj) return null;

  let ctx: any;
  try {
    ctx = new spineObj.ManagedWebGLRenderingContext(canvas, {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
    });
  } catch {
    return null;
  }

  if (!ctx || !ctx.gl) return null;

  return {
    canvas,
    ctx,
    gl: ctx.gl,
    shader: spineObj.Shader.newTwoColoredTextured(ctx),
    batcher: new spineObj.PolygonBatcher(ctx),
    sr: new spineObj.SkeletonRenderer(ctx),
    mvp: new spineObj.Matrix4(),
  };
}

export function makeLayer(host: SpineHost): SpineLayer {
  const spineObj = (window as unknown as { spine?: any }).spine;
  return {
    canvas: host.canvas,
    ctx: host.ctx,
    gl: host.gl,
    shader: host.shader,
    batcher: host.batcher,
    sr: host.sr,
    mvp: host.mvp,
    assets: new spineObj.AssetManager(host.ctx),
    skeleton: null,
    state: null,
    data: null,
    bounds: null,
    ready: false,
    _cover: null,
    _coverDone: false,
    cssW: 0,
    cssH: 0,
    dpr: 1,
  };
}
