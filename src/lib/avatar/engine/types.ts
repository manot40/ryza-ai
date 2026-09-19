// Spine WebGL 4.2 runtime interfaces and engine types
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SpineMatrix4 {
  values: Float32Array;
  ortho2d(x: number, y: number, width: number, height: number): void;
}

export interface SpineShader {
  bind(): void;
  unbind(): void;
  setUniformi(uniform: string, value: number): void;
  setUniform2f(uniform: string, x: number, y: number): void;
  setUniform3f(uniform: string, x: number, y: number, z: number): void;
  setUniformf(uniform: string, value: number): void;
  setUniform4x4f(uniform: string, values: Float32Array): void;
  getProgram(): WebGLProgram;
}

export interface SpinePolygonBatcher {
  begin(shader: SpineShader): void;
  end(): void;
}

export interface SpineSkeletonRenderer {
  premultipliedAlpha: boolean;
  draw(batcher: SpinePolygonBatcher, skeleton: any): void;
}

export interface SpineManagedCtx {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
}

export interface SpineHost {
  canvas: HTMLCanvasElement;
  ctx: SpineManagedCtx;
  gl: WebGLRenderingContext;
  shader: SpineShader;
  batcher: SpinePolygonBatcher;
  sr: SpineSkeletonRenderer;
  mvp: SpineMatrix4;
}

export interface SpineAtlasPage {
  name: string;
  texture: any;
  setTexture(texture: any): void;
}

export interface SpineAtlas {
  pages: SpineAtlasPage[];
}

export interface SpineLayer {
  canvas: HTMLCanvasElement;
  ctx: SpineManagedCtx;
  gl: WebGLRenderingContext;
  shader: SpineShader;
  batcher: SpinePolygonBatcher;
  sr: SpineSkeletonRenderer;
  mvp: SpineMatrix4;
  assets: any;
  skeleton: any;
  state: any;
  data: any;
  bounds: any;
  ready: boolean;
  _cover: { x0: number; x1: number; y0: number; y1: number; w: number; h: number } | null;
  _coverDone: boolean;
  cssW: number;
  cssH: number;
  dpr: number;
  _atlas?: SpineAtlas | null;
  _atlasUrl?: string;
  _atlasBaseTex?: any[] | null;
  _atlasVarName?: string;
  _atlasVarTex?: any[] | null;
}

export interface CameraView {
  left: number;
  bottom: number;
  worldW: number;
  worldH: number;
  cssW: number;
  cssH: number;
}

export interface CamParams {
  offsetX: number;
  offsetY: number;
  scale: number;
  zoom: number;
  panX: number;
  panY: number;
  worldW: number;
  worldH: number;
  left: number;
  bottom: number;
}

export interface SkinEntry {
  id: string;
  name: string;
  hasSpine?: boolean;
  skel?: string;
  atlas?: string;
  gesture?: string;
  variants?: Record<string, string | Record<string, string>>;
}

export interface SceneEntry {
  name?: string;
  skel: string;
  atlas: string;
  config?: string;
}

export interface PostureCamEntry {
  base?: {
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    cameraZoom?: number;
    cameraPanX?: number;
    cameraPanY?: number;
  };
  asmr?: {
    cameraZoom?: number;
    cameraPanX?: number;
  };
}

export type PostureCameraCatalog = Record<string, PostureCamEntry>;
