import type {
  SpineHost,
  SpineLayer,
  SpineManagedCtx,
  SpineShader,
  SpinePolygonBatcher,
  SpineSkeletonRenderer,
  SpineMatrix4,
  SpineAssetManager,
} from './types';

interface SpineHostRuntime {
  ManagedWebGLRenderingContext: new (
    canvas: HTMLCanvasElement,
    options?: { alpha?: boolean; premultipliedAlpha?: boolean; antialias?: boolean }
  ) => SpineManagedCtx;
  Shader: {
    newTwoColoredTextured(ctx: SpineManagedCtx): SpineShader;
  };
  PolygonBatcher: new (ctx: SpineManagedCtx) => SpinePolygonBatcher;
  SkeletonRenderer: new (ctx: SpineManagedCtx) => SpineSkeletonRenderer;
  Matrix4: new () => SpineMatrix4;
  AssetManager: new (ctx: SpineManagedCtx) => SpineAssetManager;
}

export function makeHost(canvas: HTMLCanvasElement): SpineHost | null {
  if (typeof window === 'undefined') return null;
  const spineObj = (window as unknown as { spine?: SpineHostRuntime }).spine;
  if (!spineObj) return null;

  let ctx: SpineManagedCtx | null = null;
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
  const spineObj = (window as unknown as { spine?: SpineHostRuntime }).spine;
  if (!spineObj) {
    throw new Error('Spine WebGL runtime not available');
  }
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
