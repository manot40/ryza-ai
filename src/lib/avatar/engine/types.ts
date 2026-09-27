import type {
  Skeleton,
  Bone,
  Slot,
  Attachment,
  AnimationState,
  TrackEntry,
  SkeletonData,
  TextureAtlas,
  Spine,
} from '@esotericsoftware/spine-pixi-v8';

// Type aliases mapped to official Spine 4.2 runtime types
export type SpineSkeleton = Skeleton;
export type SpineBone = Bone;
export type SpineSlot = Slot;
export type SpineAttachment = Attachment;
export type SpineSkeletonData = SkeletonData;
export type SpineAnimationState = AnimationState;
export type SpineTrackEntry = TrackEntry;
export type SpineAtlas = TextureAtlas;

export type XYMap = Record<'x' | 'y', number>;

export interface SpineLayer {
  spine: Spine | null;
  skeleton: Skeleton | null;
  state: AnimationState | null;
  data: SkeletonData | null;
  ready: boolean;
  _cover?: { x0: number; x1: number; y0: number; y1: number; w: number; h: number } | null;
  _coverDone?: boolean;
  _atlas?: TextureAtlas | null;
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
