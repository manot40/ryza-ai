// Spine WebGL 4.2 runtime interfaces and engine types

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

export interface SpineAttachment {
  name?: string;
  width?: number;
  height?: number;
  worldVerticesLength?: number;
  computeWorldVertices?(slot: SpineSlot, ...args: unknown[]): void;
}

export interface SpineBone {
  data: { name: string };
  name?: string;
  active?: boolean;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  a?: number;
  b?: number;
  c?: number;
  d?: number;
}

export interface SpineSlot {
  data: { name?: string; blendMode?: number; visible?: boolean };
  bone: SpineBone;
  getAttachment(): SpineAttachment | null;
  setAttachment(att: unknown): void;
  color: { r: number; g: number; b: number; a: number };
}

export interface SpineAnimation {
  name: string;
  duration: number;
}

export interface SpineSkeletonData {
  hash?: string;
  animations: SpineAnimation[];
  bones: Array<{ name: string; y?: number }>;
  findAnimation(name: string): SpineAnimation | null;
  findBone(name: string): unknown;
}

export interface SpineTrackEntry {
  animation?: SpineAnimation | null;
  loop: boolean;
  timeScale: number;
  trackTime: number;
  trackEnd: number;
  mixDuration: number;
  mixTime: number;
  alpha: number;
  mixBlend?: unknown;
  mixingFrom?: SpineTrackEntry | null;
}

export interface SpineAnimationState {
  data: { defaultMix: number };
  update(dt: number): void;
  apply(skeleton: SpineSkeleton): void;
  setAnimation(track: number, animName: string, loop: boolean): SpineTrackEntry;
  addAnimation(track: number, animName: string, loop: boolean, delay: number): SpineTrackEntry;
  setEmptyAnimation(track: number, mixDuration: number): SpineTrackEntry;
  addEmptyAnimation(track: number, mixDuration: number, delay: number): SpineTrackEntry;
  getCurrent(track: number): SpineTrackEntry | null;
}

export interface SpineTransformConstraint {
  data?: { name?: string };
  name?: string;
  mixX?: number | null;
  mixY?: number | null;
  mixScaleX?: number | null;
  mixScaleY?: number | null;
}

export interface SpineSkeleton {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  slots: SpineSlot[];
  bones: SpineBone[];
  transformConstraints?: SpineTransformConstraint[];
  data: SpineSkeletonData;
  findBone(name: string): SpineBone | null;
  findSlot(name: string): SpineSlot | null;
  update(dt: number): void;
  updateWorldTransform(physics: unknown): void;
}

export interface SpineSkeletonRenderer {
  premultipliedAlpha: boolean;
  draw(batcher: SpinePolygonBatcher, skeleton: SpineSkeleton): void;
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
  texture: unknown;
  setTexture(texture: unknown): void;
}

export interface SpineAtlas {
  pages: SpineAtlasPage[];
}

export interface SpineAssetManager {
  isLoadingComplete(): boolean;
  hasErrors(): boolean;
  removeAll(): void;
  errors: Record<string, unknown>;
  loadBinary(path: string): void;
  loadTextureAtlas(path: string): void;
  require(path: string): unknown;
}

export interface SpineLayer {
  canvas: HTMLCanvasElement;
  ctx: SpineManagedCtx;
  gl: WebGLRenderingContext;
  shader: SpineShader;
  batcher: SpinePolygonBatcher;
  sr: SpineSkeletonRenderer;
  mvp: SpineMatrix4;
  assets: SpineAssetManager;
  skeleton: SpineSkeleton | null;
  state: SpineAnimationState | null;
  data: SpineSkeletonData | null;
  bounds: unknown;
  ready: boolean;
  _cover: { x0: number; x1: number; y0: number; y1: number; w: number; h: number } | null;
  _coverDone: boolean;
  cssW: number;
  cssH: number;
  dpr: number;
  _atlas?: SpineAtlas | null;
  _atlasUrl?: string;
  _atlasBaseTex?: unknown[] | null;
  _atlasVarName?: string;
  _atlasVarTex?: unknown[] | null;
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

// Gesture JSON Data Models
export interface BasePose {
  id: string;
  weight?: number;
  applicableSittingIds?: string[];
  poseTypeIds?: string[];
}

export interface ExpressionSet {
  weight?: number;
  eyeOpen?: string;
  eyeClosed?: string;
  eyebrow?: string;
  mouth?: string;
}

export interface EffectSet {
  weight?: number;
  names: string[];
}

export interface IntensityProfile {
  basePoses?: BasePose[];
  expressionSets?: ExpressionSet[];
  effectSets?: EffectSet[];
  eyeBase?: string;
  eyebrowBase?: string;
  mouthBase?: string;
  mixDurationEye?: number;
  mixDurationEyebrow?: number;
  poseRerollIntervalMin?: number;
  poseRerollIntervalMax?: number;
  armGroupWeights?: Record<string, number>;
  armGroupWeightsByPoseType?: Record<string, Record<string, number>>;
}

export interface FixedGestureBinding {
  attitude?: string;
  oneShotAnimation?: string;
  weight?: number;
}

export interface GazeEntry {
  direction: string;
  holdSeconds?: number;
  weight?: number;
}

export interface EyeModeEntry {
  mode: 'blink' | 'blinkFast' | 'closed';
  intervalSeconds?: number;
  jitterSeconds?: number;
  durationSeconds?: number;
  weight?: number;
}

export interface TensionProfile {
  ambientBindings?: Array<{
    driverDefId: string;
    weight?: number;
    repeatMin?: number;
    repeatMax?: number;
  }>;
  gaze?: {
    gazeEntries?: GazeEntry[];
    eyeModeEntries?: EyeModeEntry[];
  };
  torsoWaistGroupWeights?: Record<string, number>;
  torsoWaistGroupWeightsByPoseType?: Record<string, Record<string, number>>;
}

export interface EmotionProfile {
  intensityProfiles?: Record<string, IntensityProfile>;
  fixedGestureBindingsByAttitude?: Record<string, FixedGestureBinding[]>;
  tensionProfiles?: Record<string, TensionProfile>;
  mixDurationMin?: number;
  mixDurationMax?: number;
  lipSyncScrubClip?: string;
  baseAnimTimeScale?: number;
}

export interface MotionGroup {
  GroupId: string;
  OccupancyLetters?: string;
  ApplicableSittingIDs?: string;
  ApplicablePoseIds?: string;
  AnimName_1?: string;
  AnimName_2?: string;
  Alpha1?: number;
  Alpha2?: number;
  Speed1?: number;
  Speed2?: number;
  BlendTime?: number;
  GroupWeight?: number;
  VariantWeight?: number;
}

export type OccupancyKind = 'arm' | 'torso' | 'leg' | 'legL' | 'legR';

export interface PoseTypeSet {
  previousId: string;
  newId: string;
  weight?: number;
}

export interface MixDurationPoses {
  sourceHash?: string;
  animPoses?: Record<string, Record<string, number[]>>;
}

export interface DriverDef {
  Id: string;
  Spec: string;
}

export interface LookFollower {
  part: string;
  scale?: number;
  delay?: number;
}

export interface LookDriverSpec {
  driver?: 'eye' | 'head';
  yawMin?: number;
  yawMax?: number;
  pitchMin?: number;
  pitchMax?: number;
  rollMin?: number;
  rollMax?: number;
  transitionMin?: number;
  transitionMax?: number;
  holdMin?: number;
  holdMax?: number;
  rollFollowSpeed?: number;
  followers?: LookFollower[];
}

export interface ArmInOutPartConfig {
  samePartDetourDirection?: string;
  minSeconds?: number;
  maxSeconds?: number;
  pairStartDelayReferenceDistance?: number;
  pairStartDelayMinSeconds?: number;
  pairStartDelayMaxSeconds?: number;
  enableArmInOutRouting?: boolean;
  idleGroupIds?: {
    byPosture?: Record<string, string>;
    default?: string;
  };
  byGroupId?: Record<string, { left?: number; right?: number }>;
  rankPositions?: Record<string, number>;
}

export interface ProjectConfig {
  windAnimationPrefix?: string;
  closedEyeAnimation?: string;
  mixDurationSaturationRatio?: number;
  tapReactionEnterMix?: number;
  tapReactionExitMix?: number;
  fingerTrackDelay?: number;
  fingerTrackMaxRange?: number;
  fingerTrackCenterBone?: string;
  fingerTrackHeadThreshold?: number;
  fingerTrackHeadScale?: number;
  fingerTrackBodyThreshold?: number;
  fingerTrackBodyScale?: number;
  lockSittingAxis?: boolean;
  samePartDetourDirection?: string;
  armInOutPartConfig?: ArmInOutPartConfig;
  enableArmInOutRouting?: boolean;
  hitPartNames?: Record<string, string>;
  tensionConfig?: {
    defaultDecayRate?: number;
    decayRates?: Record<string, number>;
  };
  fxOnAnimNames?: Record<string, string>;
  fxOffAnimNames?: Record<string, string>;
  gazeReturnToFront?: {
    entry?: {
      minSeconds?: number;
      maxSeconds?: number;
      secondsPerDistance?: number;
    };
    exit?: {
      minSeconds?: number;
      maxSeconds?: number;
      secondsPerDistance?: number;
    };
  };
  lipSyncClosure?: {
    enabled?: boolean;
    opennessMappingEnabled?: boolean;
    opennessFloorDb?: number;
    opennessCeilingDb?: number;
    opennessOutputScale?: number;
    opennessAttackMs?: number;
    opennessReleaseMs?: number;
    minHoldMs?: number;
    dipThreshold?: number;
  };
}

export interface EmotionalGestureCatalog {
  EmotionProfilesV4?: Record<string, EmotionProfile>;
  MotionGroups?: MotionGroup[];
  PoseTypeSets?: PoseTypeSet[];
  MixDurationPoses?: MixDurationPoses;
  DriverDefs?: DriverDef[];
  TapReactions?: Array<{ PartName: string; OverlayID: string }>;
  performanceConfig?: {
    intensitySpeedMultipliers?: Record<string, number>;
  };
}

export interface GestureData {
  projectConfig?: ProjectConfig;
  emotionalGesture?: EmotionalGestureCatalog;
  rigConfig?: {
    aimSlots?: Record<string, { bone?: string }>;
    rollSlots?: Record<string, { bone?: string }>;
  };
}

export interface SceneConfigLight {
  rimEnabled?: boolean;
  color?: number;
  direction?: number;
  rimGlowWidth?: number;
  rimGlowPower?: number;
  rimOpacity?: number;
}

export interface SceneConfigData {
  config?: {
    light?: SceneConfigLight;
    constraintOverrides?: Record<
      string,
      {
        translateMixX?: unknown;
        translateMixY?: unknown;
        scaleMixX?: unknown;
        scaleMixY?: unknown;
      }
    >;
  };
}
