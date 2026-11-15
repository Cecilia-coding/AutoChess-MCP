import type { BattleOutput } from "../autochess/types";

export type SpriteFrame = { x: number; y: number; w: number; h: number; durationMs: number };
export type SpriteClip = { loop: boolean; frames: SpriteFrame[] };
export type PixelManifest = {
  frame: { anchor: { x: number; y: number } };
  clips: Record<string, SpriteClip>;
  units: { id: string; name: string; atlas: string; portrait: string; color: string }[];
};
export type EffectCue = {
  file: string;
  unitId: string;
  start: number;
  duration: number;
  frames: { x: number; y: number; w: number; h: number }[];
  anchor: { x: number; y: number };
  scale: number;
  fromId?: string;
  rotate?: boolean;
};
export type PixelEffectAdapter = { compile: (battle: BattleOutput) => EffectCue[] };
export type SfxKind =
  | "swing"
  | "hitLight"
  | "hitHeavy"
  | "hitSkill"
  | "cast"
  | "shield"
  | "heal"
  | "death"
  | "battleStart"
  | "roundWin"
  | "roundLose"
  | "roundDraw"
  | "matchWin"
  | "matchLose"
  | "matchDraw"
  | "buy"
  | "sell"
  | "merge"
  | "place"
  | "reroll"
  | "ui";

export type ToneOpts = {
  type?: OscillatorType;
  startAt: number;
  duration: number;
  freqStart: number;
  freqEnd?: number;
  gainPeak: number;
  attack?: number;
};

export type NoiseBurstOpts = {
  startAt: number;
  duration: number;
  filterType?: BiquadFilterType;
  freqStart: number;
  freqEnd?: number;
  q?: number;
  gainPeak: number;
};

export type SfxSynthContext = {
  t: number;
  scale: number;
  tone: (opts: ToneOpts) => void;
  noiseBurst: (opts: NoiseBurstOpts) => void;
  jitter: (value: number, pct?: number) => number;
};

export type SoundPack = {
  id: string;
  play: (kind: SfxKind, sfx: SfxSynthContext) => void;
};
export type PixelBoardMoteKind = 'petals' | 'fireflies' | 'stars' | 'leaves' | 'snow' | 'embers';
export type PixelBoardMotifKind =
  | 'rose'
  | 'olive'
  | 'sun'
  | 'astrolabe'
  | 'bamboo'
  | 'peach'
  | 'moon'
  | 'lantern'
  | 'frost'
  | 'ember'
  | 'blood'
  | 'ai'
  | 'jianghu';

export type PixelBoardDecor = {
  moteKind: PixelBoardMoteKind;
  moteColors: readonly [string, string, string];
  cornerMotif: PixelBoardMotifKind;
  /** Living-canvas scene id (see lib/autochess/pixel-scene-skins); replaces the framed stage when set. */
  scene?: string;
};

export type PixelAppearance = {
  boardColors: {
    background: string;
    panel: string;
    own: [string, string];
    enemy: [string, string];
    bench: string;
    trim: string;
    text: string;
  };
  boardTheme?: {
    plinthShadow?: string;
    plinthDark?: string;
    plinthLight?: string;
    plinthJoint?: string;
    frameDark?: string;
    frameInnerLine?: string;
    bevelLight?: string;
    gridRim?: string;
    gridInnerBevel?: string;
    ownRim?: string;
    enemyRim?: string;
    ownPlaque?: [string, string, string];
    enemyPlaque?: [string, string, string];
    midBar?: string;
    midSegments?: [string, string];
    midClasp?: [string, string, string];
    benchRim?: string;
    benchAccents?: [string, string];
    benchBar?: string;
    shadow?: string;
    sparkTrail?: string;
    sparkCore?: string;
  };
  boardDecor?: PixelBoardDecor;
  id: string;
  source: string;
  publicPath: string;
  assetVersion?: string;
  manifest: PixelManifest;
  bodyScale: number;
  shield?: { file: string; width: number; height: number; anchor: { x: number; y: number } };
  runtimeFiles: () => Promise<string[]>;
  loadEffects: () => Promise<PixelEffectAdapter>;
};
