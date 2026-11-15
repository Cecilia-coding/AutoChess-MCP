import type { PixelAppearance, PixelBoardMotifKind } from '../presentation/types';
import { BENCH_CAPACITY, BOARD_COLS, BOARD_ROWS, HALF_ROWS } from './constants';
import type { PixelBoard } from './pixel-board';
import { isPixelScene, paintSceneAnimated, paintSceneStatic } from './pixel-scene-skins';

export type BoardFloorStyle =
  | 'stone_carpet'
  | 'garden_meadow'
  | 'sun_marble'
  | 'astral_observatory'
  | 'bamboo_deck'
  | 'jade_pond'
  | 'moon_pond'
  | 'lantern_street'
  | 'frost_rune'
  | 'ember_forge'
  | 'blood_cathedral'
  | 'ai_lab'
  | 'jianghu_ship';

export type BoardPropKind =
  | 'streetLamp'
  | 'roseBush'
  | 'oliveTree'
  | 'gardenUrn'
  | 'flutedPillar'
  | 'armillaryOrb'
  | 'telescope'
  | 'astralCrystal'
  | 'bambooClump'
  | 'stoneLantern'
  | 'peachTree'
  | 'jadeLantern'
  | 'moonPagoda'
  | 'lotusCluster'
  | 'lanternPost'
  | 'wineJars'
  | 'frostPine'
  | 'iceSpire'
  | 'fireBrazier'
  | 'warBanner'
  | 'candelabra'
  | 'bloodChalice'
  | 'serverTotem'
  | 'deskSucculent'
  | 'shipBollard'
  | 'paperBoatLamp';

export type PropPalette = {
  o: string;
  w: string;
  h: string;
  m: string;
  s: string;
  g: string;
  d: string;
  l: string;
  a: string;
  b: string;
  c: string;
  f: string;
  k: string;
};

export type AnimatedAnchorKind = 'flame' | 'lantern' | 'star' | 'water';

export type AnimatedAnchor = {
  x: number;
  y: number;
  kind: AnimatedAnchorKind;
  color: string;
  bright: string;
};

export type BoardSceneSpec = {
  motif: PixelBoardMotifKind;
  floorStyle: BoardFloorStyle;
  innerProp: BoardPropKind;
  outerProp: BoardPropKind;
  headerKind: 'crown' | 'floral' | 'celestial' | 'lantern' | 'crystal' | 'flame' | 'tech' | 'scroll';
  gateKind: AnimatedAnchorKind;
  propPalette: PropPalette;
  floorAccent: string;
  floorHighlight: string;
  floorDeep: string;
  carpetColor?: string;
};

export type StageGeometry = {
  stageLeft: number;
  stageTop: number;
  stageWidth: number;
  stageHeight: number;
  panelLeft: number;
  panelTop: number;
  panelWidth: number;
  panelHeight: number;
  gridLeft: number;
  gridTop: number;
  gridW: number;
  gridH: number;
  midY: number;
  benchY: number;
  centerX: number;
};

type PixelSprite = readonly string[];

export const PIXEL_PROPS: Record<BoardPropKind, PixelSprite> = {
  streetLamp: [
    '....oooo....',
    '...ofbbfo...',
    '..ofaaaafo..',
    '..oabwwbao..',
    '..ofaaafo...',
    '...ooooo....',
    '....omo.....',
    '....omo.....',
    '....oso.....',
    '....omo.....',
    '....omo.....',
    '....oso.....',
    '....omo.....',
    '....omo.....',
    '....oso.....',
    '...ommmo....',
    '...ossso....',
    '..ommmmmo...',
    '..ossssso...',
    '.ooooooooo..',
  ],
  roseBush: [
    '....oooo......oo',
    '...ocabco..oo...',
    '..ocaaaacoocabo.',
    '..oabwaacoaaaaco',
    '..ocaaaacoaabwao',
    '.oooccaooocaaaco',
    'odgloooodgloooc.',
    'dgllggggllgggdo.',
    'odgggggggggggdo.',
    '.ooddgggggddoo..',
    '..oommmmmmmoo...',
    '..ohmmmmmmmsso..',
    '...ommmmmmsso...',
    '...osssssssso...',
    '..oohmmmmmmssoo.',
    '..ooooooooooooo.',
  ],
  oliveTree: [
    '.....oooooo.....',
    '...oodllllgoo...',
    '..odgllglggggo..',
    '.odgggllgggbbgo.',
    '.odgbbgggggddgo.',
    '.oodggggggggddo.',
    '..odglggdgggddo.',
    '..ooddggbggddoo.',
    '....ooodddooo...',
    '......osmo......',
    '......osmo......',
    '......osmo......',
    '.....oosmoo.....',
    '.....osmmso.....',
    '....oommmmoo....',
    '...ommhmmmsso...',
    '...osssssssso...',
    '....oooooooo....',
  ],
  gardenUrn: [
    '....oo....oo....',
    '...owwo..obbo...',
    '..owbbwoobwwbo..',
    '...owwo..obbo...',
    '..odggooodggdo..',
    '.odlgdgggggldo..',
    '..oodgggggddo...',
    '...ohmmmmmmso...',
    '...ommmmmmsso...',
    '....ommmmsso....',
    '....osssssso....',
    '...ohmmmmmsso...',
    '...oooooooooo...',
  ],
  flutedPillar: [
    '...oooooooo...',
    '..okffffffko..',
    '..ofwwffwwfo..',
    '..okffffffko..',
    '...owmwmwmo...',
    '...owmwmwso...',
    '...owmwmwso...',
    '...owmwmwso...',
    '...owmwmwso...',
    '...owmwmwso...',
    '...owmwmwso...',
    '...owmwmwso...',
    '...owmwmwso...',
    '...owmwmwso...',
    '..oohmmmmssoo.',
    '..ohmmmmmsso..',
    '.oohmmmmmssoo.',
    '.oooooooooooo.',
  ],
  armillaryOrb: [
    '.....oooooo.....',
    '...ooffffffoo...',
    '..ofk..bb..kfo..',
    '.of..obwwbo..fo.',
    '.of.obaaaafo.fo.',
    '.ok.faaffaaf.ko.',
    '.of..obwwbo..fo.',
    '..ofk..bb..kfo..',
    '...ooffffffoo...',
    '.....okffko.....',
    '......offo......',
    '....ohmmmmso....',
    '...ohmmsmssso...',
    '..ohmmmmmmsso...',
    '..osssssssssso..',
    '.oooooooooooooo.',
  ],
  telescope: [
    '..........oooo..',
    '........oofffko.',
    '......oofwwffko.',
    '....oofffkkfko..',
    '..oofwwffkkoo...',
    '.ofkkfkkoo......',
    '..ooooo.oko.....',
    '.......osmo.....',
    '......os.m.so...',
    '.....os..m..so..',
    '....os...m...so.',
    '...os....s....so',
    '..os.....s.....o',
    '.oo......o....oo',
  ],
  astralCrystal: [
    '......oo......',
    '.....obbo.....',
    '....obwwbo....',
    '....obaabo....',
    '...obawwabo...',
    '...obaaaabo...',
    '...ocaaaaco...',
    '....ocaaaco...',
    '....occcco....',
    '.....occo.....',
    '......oo......',
    '..............',
    '..oooooooooo..',
    '.ohmmmmmmmsso.',
    '.offkffffkkfo.',
    '.oooooooooooo.',
  ],
  bambooClump: [
    '..oo......oo....',
    '.oglo.oo.oglo...',
    '..ooogllo.oo....',
    '...ogddoo..o....',
    '..oogo..ogllo...',
    '..oggo..oggo.oo.',
    '..oglo..oglogllo',
    '..okko..oggo.oo.',
    '..oggo..okko....',
    '..oglo..oggo....',
    '..okko..oglo....',
    '..oggo..okko....',
    '..oglo..oggo....',
    '.oommo..oommo...',
    'ohmmmsooommmso..',
    'oooooooooooooo..',
  ],
  stoneLantern: [
    '......oo......',
    '.....ommo.....',
    '..ooommmmooo..',
    '.ohmmmmmmmmsso',
    '..oohmmmssooo.',
    '...oaabbaao...',
    '...oabwwbao...',
    '...oaaaaaoo...',
    '...ohmmmmso...',
    '....ommmso....',
    '....ommmso....',
    '....osssso....',
    '...ohmmmmsso..',
    '..ohmmmmmmsso.',
    '..ooooooooooo.',
  ],
  peachTree: [
    '....oooo..oooo....',
    '..ooabbbooabwboo..',
    '.ocaaawaaaawwabbo.',
    '.oaabwaaacaaaabao.',
    'ooabaaaccabwaaaao.',
    'ocaacaaaooocaaaao.',
    '.oooaaosmoooaaoo..',
    '...oocosmoocco....',
    '.....ossmooo......',
    '....oosmmso.......',
    '....osmmsmo.......',
    '....ossmsso.......',
    '...oosmmssoo......',
    '..oosmmmmssso.....',
    '.odggggggggddo....',
    '..ooooooooooo.....',
  ],
  jadeLantern: [
    '.....oooo.....',
    '....ofbbfo....',
    '..oofkkkkfoo..',
    '.ohmwwwwwwwso.',
    '..oobwwwwwboo.',
    '...oabbbwbao..',
    '...oaaaaaaaao.',
    '...oohwmmhsoo.',
    '....ohmmmso...',
    '....ohmmsso...',
    '...oohmmmssoo.',
    '..ohmmmmmmmsso',
    '..ooooooooooo.',
  ],
  moonPagoda: [
    '......oo......',
    '.....obbo.....',
    '...oohmmhoo...',
    '..ohmmmmmmso..',
    '....ommmso....',
    '...oaabbaao...',
    '...oabwwbao...',
    '...oaabbaao...',
    '..oohmmmmsoo..',
    '.ohmmmmmmmmsso',
    '...ommmmmso...',
    '...osssssso...',
    '..oohmmmmssoo.',
    '..ooooooooooo.',
  ],
  lotusCluster: [
    '.....oooo.....',
    '....obwwbo....',
    '...ocabbaco...',
    '....occcco....',
    '.oodggllggdoo.',
    'odgllggggllgdo',
    'odgggggggggddo',
    '.ooddggggddoo.',
    '..oooooooooo..',
  ],
  lanternPost: [
    '...oooooooooo.',
    '..ohmmsmsssmmo',
    '...oso.....oko',
    '...omo....ocbo',
    '...omo...oabbo',
    '...oso..oabwao',
    '...omo..oaaaao',
    '...omo...ocaco',
    '...oso....ofko',
    '...omo.....oao',
    '...omo.....oao',
    '...oso......o.',
    '...omo........',
    '..ommmo.......',
    '.ossssso......',
    '.ooooooo......',
  ],
  wineJars: [
    '.......oooo...',
    '......occaco..',
    '......ohwmso..',
    '..ooooosssso..',
    '.ocaaohwmmmso.',
    '.ohwmosmmmmso.',
    'ohwmmsommmmsso',
    'ommmmsossmssso',
    'ossssso.oooo..',
    '.ooooo........',
  ],
  frostPine: [
    '......oo......',
    '.....owwo.....',
    '....owbbwo....',
    '...odgllgdo...',
    '..oowwwbbwoo..',
    '..odgggllgdo..',
    '.ooowwbbwwwoo.',
    '.oddgggggggddo',
    '.ooowwbwwwbwoo',
    'oddggggggggddo',
    '.ooodddddddooo',
    '.....ommo.....',
    '.....osso.....',
    '....owwwwo....',
    '...oooooooo...',
  ],
  iceSpire: [
    '......oo......',
    '.....owwo.....',
    '....obwwbo....',
    '..ooobwwbooo..',
    '.owbobaaabobo.',
    '.obwboaaaobwo.',
    '.oaaabaccbabo.',
    '.ocaacccccaco.',
    '..ossmmmmssso.',
    '.owwmmmmmmsswo',
    '.oooooooooooo.',
  ],
  fireBrazier: [
    '.....oo..oo.....',
    '....obbo.obo....',
    '...obwwboobbo...',
    '..oabwwaaaabao..',
    '..oaaawwaaacbo..',
    '...ocaaaaacco...',
    '.oookffffffkkooo',
    '.ommmmmmmmmmmms.',
    '..osssssssssss..',
    '...os..oo..so...',
    '..os...oo...so..',
    '.ooo...oo...ooo.',
  ],
  warBanner: [
    '....oo........',
    '...offo.......',
    '...okfoooooooo',
    '...omoaaaaaaao',
    '...omofbbbbba.',
    '...osoaaaaaaf.',
    '...omocccaaa..',
    '...omoccccaaao',
    '...oso........',
    '...omo........',
    '...omo........',
    '...oso........',
    '..ommmo.......',
    '..ossso.......',
    '.ooooooo......',
  ],
  candelabra: [
    '..oo...oo...oo..',
    '.obbo.obbo.obbo.',
    '.oaao.oaao.oaao.',
    '.owwo.owwo.owwo.',
    '.owwo.owwo.owwo.',
    '..ofkoffkoffko..',
    '...oooffffooo...',
    '......offo......',
    '......okko......',
    '......offo......',
    '......okko......',
    '.....ooffoo.....',
    '....offkkkfo....',
    '...oohmmmmsoo...',
    '...oooooooooo...',
  ],
  bloodChalice: [
    '...oooooooo...',
    '..okffffffko..',
    '..ofaaaaaafo..',
    '..okccccccko..',
    '...okffffko...',
    '....ooffoo....',
    '.....okko.....',
    '....ooffoo....',
    '...ohmmmmso...',
    '..ohmmmmmmsso.',
    '..ossssssssso.',
    '..ooooooooooo.',
  ],
  serverTotem: [
    '..oooooooooo..',
    '.ohmmmmmmmmsso',
    '.omoooooooooso',
    '.omobbbwwbooso',
    '.omobaaaabooso',
    '.omoooooooooso',
    '.ommkfmkfmkkso',
    '.ommmmmmmmmms.',
    '.omoooooooooso',
    '.omobboaaaooso',
    '.ommmmmmmmmms.',
    '.ohmmmmmmmmsso',
    '.ossssssssssso',
    '.oooooooooooo.',
  ],
  deskSucculent: [
    '....oo..oo....',
    '...olgolglo...',
    '..olglgglggo..',
    '.odlggbgglggo.',
    '..oodggggddo..',
    '..oohmmmmsoo..',
    '...ommmmmso...',
    '...ommmmsso...',
    '...osssssso...',
    '....oooooo....',
  ],
  shipBollard: [
    '....oooooo....',
    '...ohmmmmso...',
    '...ommmmmsso..',
    '...offkkkffo..',
    '..ofkkfffkkfo.',
    '..offkkkffkoo.',
    '...ommoabbo...',
    '...osmoaaco...',
    '...ommmsso....',
    '..ohmmmmmso...',
    '..osssssssso..',
    '..oooooooooo..',
  ],
  paperBoatLamp: [
    '.....oooo.....',
    '....obwwbo....',
    '...oabwwbao...',
    '...oaaaaaoo...',
    '..ooffffffoo..',
    '.ohmmmmmmmmsso',
    '..ossssssssso.',
    '...oooooooooo.',
  ],
};

export const BOARD_SCENE_SPECS: Record<PixelBoardMotifKind, BoardSceneSpec> = {
  rose: {
    motif: 'rose',
    floorStyle: 'stone_carpet',
    innerProp: 'roseBush',
    outerProp: 'streetLamp',
    headerKind: 'floral',
    gateKind: 'lantern',
    carpetColor: '#8d3659',
    floorAccent: '#b05d7e',
    floorHighlight: '#fbeaf0',
    floorDeep: '#4a2e46',
    propPalette: {
      o: '#291728',
      w: '#fff2f6',
      h: '#cfb3c4',
      m: '#947488',
      s: '#5c4154',
      g: '#5b8a57',
      d: '#355939',
      l: '#8dc27a',
      a: '#d9537b',
      b: '#ffb7ce',
      c: '#8d2444',
      f: '#f2c278',
      k: '#9c6e32',
    },
  },
  olive: {
    motif: 'olive',
    floorStyle: 'garden_meadow',
    innerProp: 'gardenUrn',
    outerProp: 'oliveTree',
    headerKind: 'floral',
    gateKind: 'star',
    floorAccent: '#7aa660',
    floorHighlight: '#fffce8',
    floorDeep: '#465934',
    propPalette: {
      o: '#263820',
      w: '#fcfff5',
      h: '#e6dec8',
      m: '#c4ba9e',
      s: '#877c64',
      g: '#6aa153',
      d: '#3e6935',
      l: '#a5db7c',
      a: '#f5d26b',
      b: '#fff6ba',
      c: '#bd8a2d',
      f: '#ebd383',
      k: '#967b35',
    },
  },
  sun: {
    motif: 'sun',
    floorStyle: 'sun_marble',
    innerProp: 'armillaryOrb',
    outerProp: 'flutedPillar',
    headerKind: 'celestial',
    gateKind: 'star',
    floorAccent: '#cfa352',
    floorHighlight: '#fffdf3',
    floorDeep: '#6c5a3f',
    propPalette: {
      o: '#3b2e1e',
      w: '#fffcf0',
      h: '#f2e6cf',
      m: '#d6c7aa',
      s: '#968466',
      g: '#7ca37a',
      d: '#496e4b',
      l: '#b3d4a9',
      a: '#e5a93c',
      b: '#fff2a6',
      c: '#a6691e',
      f: '#f2c65e',
      k: '#9c7122',
    },
  },
  astrolabe: {
    motif: 'astrolabe',
    floorStyle: 'astral_observatory',
    innerProp: 'astralCrystal',
    outerProp: 'telescope',
    headerKind: 'celestial',
    gateKind: 'star',
    floorAccent: '#6f9be3',
    floorHighlight: '#eaf4ff',
    floorDeep: '#1f2e54',
    propPalette: {
      o: '#121b33',
      w: '#eef6ff',
      h: '#a6bce0',
      m: '#667ca6',
      s: '#3b4a70',
      g: '#4b7899',
      d: '#284561',
      l: '#8bc4ed',
      a: '#72b8ff',
      b: '#d9f2ff',
      c: '#396eb8',
      f: '#f2c66d',
      k: '#9e7226',
    },
  },
  bamboo: {
    motif: 'bamboo',
    floorStyle: 'bamboo_deck',
    innerProp: 'stoneLantern',
    outerProp: 'bambooClump',
    headerKind: 'scroll',
    gateKind: 'water',
    floorAccent: '#5f9473',
    floorHighlight: '#eef7e6',
    floorDeep: '#2e4a3b',
    propPalette: {
      o: '#1f3025',
      w: '#f0f7e6',
      h: '#cbd6c7',
      m: '#99a396',
      s: '#5d6b5e',
      g: '#5aa166',
      d: '#336641',
      l: '#98db8d',
      a: '#f5bd5b',
      b: '#fff0ad',
      c: '#b56e28',
      f: '#a5bd7d',
      k: '#637846',
    },
  },
  peach: {
    motif: 'peach',
    floorStyle: 'jade_pond',
    innerProp: 'jadeLantern',
    outerProp: 'peachTree',
    headerKind: 'floral',
    gateKind: 'water',
    floorAccent: '#78b8ad',
    floorHighlight: '#fff5f8',
    floorDeep: '#593d4c',
    propPalette: {
      o: '#3b2430',
      w: '#fff6f9',
      h: '#f2e4e8',
      m: '#cfc2c6',
      s: '#734b46',
      g: '#6ba882',
      d: '#3d7055',
      l: '#a5dbad',
      a: '#f295b2',
      b: '#ffd6e5',
      c: '#c4587e',
      f: '#f0cc75',
      k: '#9c7834',
    },
  },
  moon: {
    motif: 'moon',
    floorStyle: 'moon_pond',
    innerProp: 'lotusCluster',
    outerProp: 'moonPagoda',
    headerKind: 'celestial',
    gateKind: 'water',
    floorAccent: '#6b94c7',
    floorHighlight: '#edf6ff',
    floorDeep: '#23314d',
    propPalette: {
      o: '#172136',
      w: '#eef6ff',
      h: '#b7c7de',
      m: '#7d8fab',
      s: '#475773',
      g: '#4a857e',
      d: '#2c5454',
      l: '#83c7bd',
      a: '#8ec5ff',
      b: '#e8f5ff',
      c: '#4e83bf',
      f: '#d9e5f7',
      k: '#7f93b5',
    },
  },
  lantern: {
    motif: 'lantern',
    floorStyle: 'lantern_street',
    innerProp: 'wineJars',
    outerProp: 'lanternPost',
    headerKind: 'lantern',
    gateKind: 'lantern',
    floorAccent: '#cf7442',
    floorHighlight: '#fff4d6',
    floorDeep: '#3d2419',
    propPalette: {
      o: '#29150e',
      w: '#fff3db',
      h: '#db9c79',
      m: '#a66b4b',
      s: '#633926',
      g: '#708c54',
      d: '#435933',
      l: '#a9c47c',
      a: '#e34e36',
      b: '#ffe07d',
      c: '#992218',
      f: '#f5c256',
      k: '#9e6c1e',
    },
  },
  frost: {
    motif: 'frost',
    floorStyle: 'frost_rune',
    innerProp: 'iceSpire',
    outerProp: 'frostPine',
    headerKind: 'crystal',
    gateKind: 'star',
    floorAccent: '#69b0d9',
    floorHighlight: '#ffffff',
    floorDeep: '#2d516e',
    propPalette: {
      o: '#1d364d',
      w: '#ffffff',
      h: '#d9effc',
      m: '#a8cbe3',
      s: '#6388a3',
      g: '#4c857d',
      d: '#2d5754',
      l: '#87c4b8',
      a: '#69c9f0',
      b: '#dbf7ff',
      c: '#358ab8',
      f: '#d0edff',
      k: '#72a8c9',
    },
  },
  ember: {
    motif: 'ember',
    floorStyle: 'ember_forge',
    innerProp: 'warBanner',
    outerProp: 'fireBrazier',
    headerKind: 'flame',
    gateKind: 'flame',
    floorAccent: '#d96534',
    floorHighlight: '#ffe8b8',
    floorDeep: '#331d19',
    propPalette: {
      o: '#21110e',
      w: '#fff2cc',
      h: '#ada09c',
      m: '#756663',
      s: '#453837',
      g: '#8c694a',
      d: '#573c28',
      l: '#bf9467',
      a: '#f0642b',
      b: '#ffd254',
      c: '#a82716',
      f: '#e6ae45',
      k: '#8f5f1d',
    },
  },
  blood: {
    motif: 'blood',
    floorStyle: 'blood_cathedral',
    innerProp: 'bloodChalice',
    outerProp: 'candelabra',
    headerKind: 'crown',
    gateKind: 'flame',
    carpetColor: '#751c36',
    floorAccent: '#a82c4b',
    floorHighlight: '#fae3ea',
    floorDeep: '#2b121e',
    propPalette: {
      o: '#1a0a12',
      w: '#fff0eb',
      h: '#b59fa7',
      m: '#7d6870',
      s: '#45353d',
      g: '#5b7352',
      d: '#364a32',
      l: '#8aab78',
      a: '#cc294b',
      b: '#ffbe66',
      c: '#751026',
      f: '#e6b85c',
      k: '#8f6422',
    },
  },
  ai: {
    motif: 'ai',
    floorStyle: 'ai_lab',
    innerProp: 'deskSucculent',
    outerProp: 'serverTotem',
    headerKind: 'tech',
    gateKind: 'star',
    floorAccent: '#8e73bd',
    floorHighlight: '#ffffff',
    floorDeep: '#4a3b66',
    propPalette: {
      o: '#2c233b',
      w: '#ffffff',
      h: '#ebe4f7',
      m: '#cfc4e3',
      s: '#8f81ab',
      g: '#5db895',
      d: '#387d63',
      l: '#9ce8c7',
      a: '#69c2f0',
      b: '#fff099',
      c: '#4e7dc2',
      f: '#f2c86b',
      k: '#9c772d',
    },
  },
  jianghu: {
    motif: 'jianghu',
    floorStyle: 'jianghu_ship',
    innerProp: 'paperBoatLamp',
    outerProp: 'shipBollard',
    headerKind: 'scroll',
    gateKind: 'lantern',
    floorAccent: '#8c6e54',
    floorHighlight: '#fbf6ec',
    floorDeep: '#382c38',
    propPalette: {
      o: '#261d26',
      w: '#fcf6ea',
      h: '#dec2a2',
      m: '#ad8b6b',
      s: '#6e523c',
      g: '#5f947c',
      d: '#376151',
      l: '#96ccb2',
      a: '#d97645',
      b: '#ffe694',
      c: '#8f3a29',
      f: '#deb35d',
      k: '#8c6527',
    },
  },
};

export function boardSceneSpec(motif?: PixelBoardMotifKind): BoardSceneSpec {
  return BOARD_SCENE_SPECS[motif ?? 'ai'] ?? BOARD_SCENE_SPECS.ai;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim();
  if (!clean.startsWith('#')) return null;
  if (clean.length === 7 || clean.length === 9) {
    const r = Number.parseInt(clean.slice(1, 3), 16);
    const g = Number.parseInt(clean.slice(3, 5), 16);
    const b = Number.parseInt(clean.slice(5, 7), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? [r, g, b] : null;
  }
  return null;
}

export function hexAlpha(hex: string, alpha: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return hex;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamped.toFixed(3)})`;
}

export function mixHex(hexA: string, hexB: string, t: number): string {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  if (!a || !b) return hexA;
  const k = Math.max(0, Math.min(1, t));
  const ch = (i: number) =>
    Math.round(a[i]! + (b[i]! - a[i]!) * k)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

export function computeStageGeometry(board: PixelBoard): StageGeometry {
  const gridSpan = board.cellWidth * BOARD_COLS + Math.abs(board.skew) * (BOARD_ROWS - 1);
  const benchSpan = board.benchSpacing * BENCH_CAPACITY;
  const stageSpan = Math.min(board.width - 10, Math.max(gridSpan + 68, benchSpan + 34));
  const stageLeft = Math.round((board.width - stageSpan) / 2);
  const stageWidth = Math.round(stageSpan);
  const stageTop = 8;
  const stageHeight = board.height - 18;
  return {
    stageLeft,
    stageTop,
    stageWidth,
    stageHeight,
    panelLeft: stageLeft + 11,
    panelTop: stageTop + 11,
    panelWidth: stageWidth - 22,
    panelHeight: stageHeight - 25,
    gridLeft: Math.round(board.left),
    gridTop: Math.round(board.top),
    gridW: Math.round(board.cellWidth * BOARD_COLS),
    gridH: Math.round(board.rowHeight * BOARD_ROWS),
    midY: Math.round(board.top + HALF_ROWS * board.rowHeight),
    benchY: board.benchY,
    centerX: Math.round(board.width / 2),
  };
}

function fillNotched(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  color: string,
): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  const s = Math.max(1, Math.round(step));
  ctx.fillStyle = color;
  if (rw <= s * 2 || rh <= s * 2) {
    ctx.fillRect(rx, ry, Math.max(1, rw), Math.max(1, rh));
    return;
  }
  ctx.fillRect(rx + s, ry, rw - s * 2, rh);
  ctx.fillRect(rx, ry + s, rw, rh - s * 2);
}

function fillStepped(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  unit: number,
  color: string,
): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  const u = Math.max(1, Math.round(unit));
  if (rw <= u * 4 || rh <= u * 4) {
    fillNotched(ctx, rx, ry, rw, rh, u, color);
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(rx + u * 2, ry, rw - u * 4, rh);
  ctx.fillRect(rx + u, ry + u, rw - u * 2, rh - u * 2);
  ctx.fillRect(rx, ry + u * 2, rw, rh - u * 4);
}

function drawPixelRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  dotSize: number,
  color: string,
  dashedEvery = 1,
): void {
  const stepRad = Math.max(0.03, dotSize / Math.max(12, Math.max(rx, ry)));
  ctx.fillStyle = color;
  let index = 0;
  for (let a = 0; a < Math.PI * 2; a += stepRad) {
    if (dashedEvery > 1 && index % dashedEvery !== 0) {
      index++;
      continue;
    }
    const px = Math.round(cx + Math.cos(a) * rx - dotSize / 2);
    const py = Math.round(cy + Math.sin(a) * ry - dotSize / 2);
    ctx.fillRect(px, py, dotSize, dotSize);
    index++;
  }
}

function drawPixelDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const iry = Math.max(2, Math.round(ry));
  for (let dy = -iry; dy <= iry; dy += 2) {
    const ny = dy / iry;
    const halfW = Math.round(rx * Math.sqrt(Math.max(0, 1 - ny * ny)));
    if (halfW > 0) {
      ctx.fillRect(Math.round(cx - halfW), Math.round(cy + dy), halfW * 2, 2);
    }
  }
}

function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  bottomY: number,
  pxScale: number,
  sprite: PixelSprite,
  palette: PropPalette,
  flipX = false,
): void {
  const cols = sprite[0]?.length ?? 0;
  const rows = sprite.length;
  const startX = Math.round(anchorX - (cols * pxScale) / 2);
  const startY = Math.round(bottomY - rows * pxScale);
  for (let ry = 0; ry < rows; ry++) {
    const row = sprite[ry]!;
    for (let rx = 0; rx < cols; rx++) {
      const ch = row[flipX ? cols - 1 - rx : rx];
      if (!ch || ch === '.') continue;
      const color = palette[ch as keyof PropPalette];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(startX + rx * pxScale, startY + ry * pxScale, pxScale, pxScale);
    }
  }
}

function drawMiniTuft(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  palette: PropPalette,
  withBlossom: boolean,
): void {
  ctx.fillStyle = palette.d;
  ctx.fillRect(cx - 5, cy, 10, 2);
  ctx.fillRect(cx - 3, cy - 2, 6, 2);
  ctx.fillStyle = palette.g;
  ctx.fillRect(cx - 4, cy - 1, 3, 2);
  ctx.fillRect(cx + 1, cy - 1, 3, 2);
  if (withBlossom) {
    ctx.fillStyle = palette.a;
    ctx.fillRect(cx - 3, cy - 3, 2, 2);
    ctx.fillRect(cx + 2, cy - 2, 2, 2);
    ctx.fillStyle = palette.b;
    ctx.fillRect(cx, cy - 4, 2, 2);
  }
}

function drawPixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  color: string,
  dashPeriod = 1,
): void {
  const step = Math.max(1, Math.round(size));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / step));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    if (dashPeriod > 1 && i % dashPeriod !== 0) continue;
    const t = i / steps;
    const px = Math.round(x0 + dx * t - step / 2);
    const py = Math.round(y0 + dy * t - step / 2);
    ctx.fillRect(px, py, step, step);
  }
}

function drawCompassPointers(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  primary: string,
  highlight: string,
): void {
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const tipX = Math.round(cx + dx * outerR);
    const tipY = Math.round(cy + dy * outerR);
    const baseX = Math.round(cx + dx * innerR);
    const baseY = Math.round(cy + dy * innerR);
    const px = Math.abs(dy) * 5;
    const py = Math.abs(dx) * 5;
    drawPixelLine(ctx, baseX - px, baseY - py, tipX, tipY, 2, primary);
    drawPixelLine(ctx, baseX + px, baseY + py, tipX, tipY, 2, primary);
    ctx.fillStyle = highlight;
    ctx.fillRect(baseX - 2, baseY - 2, 4, 4);
    ctx.fillRect(tipX - 1, tipY - 1, 3, 3);
  }
}

function drawAstrolabeCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const outerR = Math.max(88, Math.round(span * 0.43));
  const rimW = Math.max(10, Math.round(outerR * 0.09));
  const { f, k, a, b, s, w } = spec.propPalette;
  const isSun = spec.floorStyle === 'sun_marble';

  // Soft sunken dial backing disc so the astrolabe anchors the canvas
  drawPixelDisc(ctx, gcx, gcy, outerR + 6, outerR + 6, hexAlpha(spec.floorDeep, isSun ? 0.14 : 0.22));
  drawPixelDisc(ctx, gcx, gcy, outerR - rimW, outerR - rimW, hexAlpha(s, isSun ? 0.1 : 0.16));

  // Graduated outer brass limb ring + inner bevel
  drawPixelRing(ctx, gcx, gcy, outerR, outerR, 3, hexAlpha(k, 0.56));
  drawPixelRing(ctx, gcx, gcy, outerR - 3, outerR - 3, 2, hexAlpha(f, 0.55));
  drawPixelRing(ctx, gcx, gcy, outerR - rimW, outerR - rimW, 2, hexAlpha(k, 0.5));
  drawPixelRing(ctx, gcx, gcy, outerR - rimW - 2, outerR - rimW - 2, 2, hexAlpha(bevel, 0.42), 2);

  // 24 radial zodiac / degree ticks around the astrolabe bezel
  for (let i = 0; i < 24; i++) {
    const rad = (i / 24) * Math.PI * 2;
    const major = i % 3 === 0;
    const r0 = outerR - rimW + 1;
    const r1 = outerR - (major ? 1 : 3);
    drawPixelLine(
      ctx,
      Math.round(gcx + Math.cos(rad) * r0),
      Math.round(gcy + Math.sin(rad) * r0),
      Math.round(gcx + Math.cos(rad) * r1),
      Math.round(gcy + Math.sin(rad) * r1),
      major ? 2 : 1,
      hexAlpha(major ? w : f, major ? 0.65 : 0.45),
    );
    if (i % 6 === 3) {
      const mx = Math.round(gcx + Math.cos(rad) * (outerR - rimW / 2));
      const my = Math.round(gcy + Math.sin(rad) * (outerR - rimW / 2));
      ctx.fillStyle = hexAlpha(a, 0.7);
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
  }

  // Cardinal compass needles outside the limb
  drawCompassPointers(ctx, gcx, gcy, outerR - 2, outerR + 14, hexAlpha(k, 0.62), hexAlpha(b, 0.72));

  // Inscribed 8-point geometric celestial star inside the plate
  const starR = Math.round(outerR * 0.72);
  drawPixelLine(ctx, gcx - starR, gcy, gcx + starR, gcy, 2, hexAlpha(f, 0.34), 2);
  drawPixelLine(ctx, gcx, gcy - starR, gcx, gcy + starR, 2, hexAlpha(f, 0.34), 2);
  const diag = Math.round(starR * 0.7);
  drawPixelLine(ctx, gcx - diag, gcy - diag, gcx + diag, gcy + diag, 2, hexAlpha(f, 0.32));
  drawPixelLine(ctx, gcx - diag, gcy + diag, gcx + diag, gcy - diag, 2, hexAlpha(f, 0.32));

  // Classic eccentric Ecliptic Rete Ring (signature offset astrolabe hoop)
  const reteR = Math.round(outerR * 0.56);
  const reteCx = gcx + Math.round(outerR * 0.14);
  const reteCy = gcy - Math.round(outerR * 0.14);
  drawPixelRing(ctx, reteCx, reteCy, reteR, reteR, 3, hexAlpha(f, 0.54));
  drawPixelRing(ctx, reteCx, reteCy, reteR - 5, reteR - 5, 2, hexAlpha(a, 0.48), 2);

  // Inner azimuth horizon arc + concentric core ring
  const innerR = Math.round(outerR * 0.42);
  drawPixelRing(ctx, gcx, gcy, innerR, innerR, 2, hexAlpha(spec.floorAccent, 0.48));
  drawPixelRing(ctx, gcx, gcy, Math.round(innerR * 0.52), Math.round(innerR * 0.52), 2, hexAlpha(f, 0.52));

  // Diagonal alidade sighting rule cutting gracefully through the dial center
  const ruleR = outerR - rimW - 4;
  const rx = Math.round(ruleR * 0.84);
  const ry = Math.round(ruleR * 0.54);
  drawPixelLine(ctx, gcx - rx, gcy + ry, gcx + rx, gcy - ry, 2, hexAlpha(k, 0.56));
  drawPixelLine(ctx, gcx - rx, gcy + ry + 3, gcx + rx, gcy - ry + 3, 2, hexAlpha(b, 0.48));

  // Central jeweled sun-gear hub
  drawPixelDisc(ctx, gcx, gcy, 18, 18, hexAlpha(k, 0.55));
  drawPixelDisc(ctx, gcx, gcy, 12, 12, hexAlpha(f, 0.58));
  drawPixelDisc(ctx, gcx, gcy, 6, 6, hexAlpha(b, 0.72));

  // Corner constellations inside the four playfield corners
  const cxOff = Math.round(geom.gridW * 0.36);
  const cyOff = Math.round(geom.gridH * 0.37);
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const ox = gcx + sx * cxOff;
    const oy = gcy + sy * cyOff;
    const pts: readonly [number, number][] = [
      [ox - sx * 28, oy - sy * 10],
      [ox - sx * 6, oy - sy * 22],
      [ox + sx * 12, oy + sy * 4],
    ];
    drawPixelLine(ctx, pts[0][0], pts[0][1], pts[1][0], pts[1][1], 1, hexAlpha(f, 0.35), 2);
    drawPixelLine(ctx, pts[1][0], pts[1][1], pts[2][0], pts[2][1], 1, hexAlpha(f, 0.35), 2);
    for (const [pxPt, pyPt] of pts) {
      ctx.fillStyle = hexAlpha(b, 0.65);
      ctx.fillRect(pxPt - 1, pyPt - 1, 3, 3);
    }
    anchors.push({ x: pts[1][0], y: pts[1][1], kind: 'star', color: f, bright: b });
  }

  // Animated starlight pips on the ecliptic
  anchors.push(
    { x: reteCx + reteR, y: reteCy, kind: 'star', color: f, bright: b },
    { x: reteCx - Math.round(reteR * 0.68), y: reteCy + Math.round(reteR * 0.72), kind: 'star', color: a, bright: w },
  );
}

function drawRoseFountainCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(66, Math.round(span * 0.28));
  const { h, m, s, a, b, f, g, d, w } = spec.propPalette;

  // Royal tapestry runner border framing the rose courtyard interior
  const padX = Math.max(18, Math.round(geom.gridW * 0.08));
  const padY = Math.max(16, Math.round(geom.gridH * 0.07));
  fillNotched(ctx, geom.gridLeft + padX, geom.gridTop + padY, geom.gridW - padX * 2, geom.gridH - padY * 2, 6, hexAlpha(spec.carpetColor ?? a, 0.14));
  fillNotched(ctx, geom.gridLeft + padX + 5, geom.gridTop + padY + 5, geom.gridW - (padX + 5) * 2, geom.gridH - (padY + 5) * 2, 4, hexAlpha(f, 0.12));

  // Corner blooming rose trellises anchored right inside the court corners
  for (const [ox, oy] of [
    [geom.gridLeft + 34, geom.gridTop + 44],
    [geom.gridLeft + geom.gridW - 34, geom.gridTop + 44],
    [geom.gridLeft + 34, geom.gridTop + geom.gridH - 18],
    [geom.gridLeft + geom.gridW - 34, geom.gridTop + geom.gridH - 18],
  ] as const) {
    ctx.fillStyle = hexAlpha(d, 0.45);
    ctx.fillRect(ox - 16, oy - 12, 32, 16);
    ctx.fillStyle = hexAlpha(g, 0.42);
    ctx.fillRect(ox - 12, oy - 15, 24, 14);
    ctx.fillStyle = hexAlpha(a, 0.65);
    ctx.fillRect(ox - 9, oy - 11, 5, 5);
    ctx.fillRect(ox + 3, oy - 13, 5, 5);
    ctx.fillStyle = hexAlpha(b, 0.72);
    ctx.fillRect(ox - 8, oy - 10, 2, 2);
    ctx.fillRect(ox + 4, oy - 12, 2, 2);
  }

  // Carved Marble Octagonal Fountain
  drawPixelDisc(ctx, gcx + 3, gcy + 4, r + 6, r + 6, hexAlpha(s, 0.25));
  drawPixelRing(ctx, gcx, gcy, r, r, 6, hexAlpha(m, 0.56));
  drawPixelRing(ctx, gcx, gcy, r - 4, r - 4, 3, hexAlpha(h, 0.62));
  drawPixelDisc(ctx, gcx, gcy, r - 10, r - 10, hexAlpha('#6aa9c9', 0.34));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.65), Math.round(r * 0.65), 2, hexAlpha(bevel, 0.36), 2);
  // Tiered marble center pedestal & water spout
  drawPixelDisc(ctx, gcx, gcy, 24, 24, hexAlpha(m, 0.55));
  drawPixelDisc(ctx, gcx, gcy, 15, 15, hexAlpha(h, 0.62));
  drawPixelDisc(ctx, gcx, gcy, 6, 6, hexAlpha(w, 0.7));
  anchors.push(
    { x: gcx - 18, y: gcy + 14, kind: 'water', color: bevel, bright: w },
    { x: gcx + 22, y: gcy - 18, kind: 'water', color: bevel, bright: w },
  );
}

function drawPeachBridgeCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const { m, s, o, a, b, g, l, f, w } = spec.propPalette;

  // Winding crystal-aqua stream sloping across the courtyard center
  const brookSpan = Math.round(geom.gridW * 0.56);
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = Math.round(geom.gridLeft - 24 + t * (geom.gridW + 48));
    const by = Math.round(gcy + (t - 0.5) * geom.gridH * 0.42 + Math.sin(t * Math.PI * 2) * 24);
    const rw = Math.round(32 + Math.sin(t * Math.PI) * 14);
    drawPixelDisc(ctx, bx, by, rw, Math.round(rw * 0.68), hexAlpha('#7ac4cc', 0.34));
    drawPixelDisc(ctx, bx, by, Math.round(rw * 0.72), Math.round(rw * 0.46), hexAlpha('#aae3eb', 0.28));
  }
  // Tiny lily pads & orange koi silhouette in upper and lower stream bends
  for (const [kx, ky, flip] of [
    [gcx - Math.round(brookSpan * 0.42), gcy - 48, 1],
    [gcx + Math.round(brookSpan * 0.38), gcy + 52, -1],
  ] as const) {
    drawPixelDisc(ctx, kx, ky, 14, 9, hexAlpha(g, 0.55));
    drawPixelDisc(ctx, kx - 3, ky - 1, 8, 5, hexAlpha(l, 0.45));
    ctx.fillStyle = hexAlpha(a, 0.75);
    ctx.fillRect(kx + 4, ky - 4, 4, 3);
    ctx.fillStyle = hexAlpha('#f28b52', 0.7);
    ctx.fillRect(kx + 18 * flip, ky + 6, 8, 3);
    ctx.fillStyle = hexAlpha(w, 0.75);
    ctx.fillRect(kx + 21 * flip, ky + 7, 3, 1);
    anchors.push({ x: kx + 18 * flip, y: ky + 6, kind: 'water', color: bevel, bright: w });
  }

  // 16-bit Arched Cedar Moon-Bridge right across center of brook
  const bw = Math.min(180, Math.round(geom.gridW * 0.42));
  const bh = 54;
  // Soft shadow on stream water beneath arch
  fillNotched(ctx, gcx - Math.round(bw * 0.46), gcy + 8, Math.round(bw * 0.92), 20, 4, hexAlpha(o, 0.18));
  // Cedar bridge deck & arched planks
  fillStepped(ctx, gcx - bw / 2, gcy - bh / 2, bw, bh, 6, hexAlpha(s, 0.52));
  fillStepped(ctx, gcx - bw / 2 + 4, gcy - bh / 2 + 4, bw - 8, bh - 8, 5, hexAlpha(m, 0.55));
  for (let px = gcx - bw / 2 + 12; px < gcx + bw / 2 - 12; px += 14) {
    ctx.fillStyle = hexAlpha(o, 0.3);
    ctx.fillRect(px, gcy - bh / 2 + 8, 2, bh - 16);
  }
  // Top and bottom banister rails + 4 lotus finial posts
  ctx.fillStyle = hexAlpha(f, 0.65);
  ctx.fillRect(gcx - bw / 2 + 6, gcy - bh / 2 + 2, bw - 12, 4);
  ctx.fillRect(gcx - bw / 2 + 6, gcy + bh / 2 - 6, bw - 12, 4);
  for (const px of [gcx - bw / 2 + 8, gcx + bw / 2 - 12]) {
    for (const py of [gcy - bh / 2 - 2, gcy + bh / 2 - 6]) {
      ctx.fillStyle = hexAlpha(o, 0.55);
      ctx.fillRect(px, py, 6, 8);
      ctx.fillStyle = hexAlpha(b, 0.72);
      ctx.fillRect(px + 1, py + 1, 4, 3);
    }
  }
}

function drawMoonPoolCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(76, Math.round(span * 0.34));
  const { a, b, f, g, l, w } = spec.propPalette;

  // Deep moonlit pond pool across center
  drawPixelDisc(ctx, gcx, gcy, Math.round(geom.gridW * 0.38), Math.round(geom.gridH * 0.38), hexAlpha(spec.floorAccent, 0.2));
  drawPixelRing(ctx, gcx, gcy, r, r, 3, hexAlpha(b, 0.42));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.76), Math.round(r * 0.76), 2, hexAlpha(w, 0.32), 2);

  // Rippled Crescent Moon reflection inside the pool center
  const moonR = Math.max(24, Math.round(r * 0.38));
  for (let dy = -moonR; dy <= moonR; dy += 3) {
    const ny = dy / moonR;
    const hw = Math.round(moonR * Math.sqrt(Math.max(0, 1 - ny * ny)));
    const cut = Math.round(hw * 0.52);
    const waveOffset = (Math.floor(dy / 3) % 2) * 3;
    const xStart = gcx - hw + waveOffset;
    const width = Math.max(3, hw - cut + 6);
    ctx.fillStyle = hexAlpha(f, 0.44);
    ctx.fillRect(xStart, gcy + dy, width, 2);
    ctx.fillStyle = hexAlpha(w, 0.38);
    ctx.fillRect(xStart + 2, gcy + dy, Math.max(2, Math.round(width * 0.55)), 1);
  }

  // Lotus pads with glowing night-lily firefly glints around pool rim
  for (const [lx, ly] of [
    [gcx - Math.round(r * 0.78), gcy - Math.round(r * 0.45)],
    [gcx + Math.round(r * 0.8), gcy + Math.round(r * 0.42)],
    [gcx - Math.round(r * 0.65), gcy + Math.round(r * 0.65)],
  ] as const) {
    drawPixelDisc(ctx, lx, ly, 16, 10, hexAlpha(g, 0.55));
    drawPixelDisc(ctx, lx - 2, ly - 1, 9, 5, hexAlpha(l, 0.45));
    ctx.fillStyle = hexAlpha(a, 0.7);
    ctx.fillRect(lx + 2, ly - 4, 5, 4);
    ctx.fillStyle = hexAlpha(w, 0.8);
    ctx.fillRect(lx + 4, ly - 5, 2, 2);
    anchors.push({ x: lx + 4, y: ly - 4, kind: 'water', color: b, bright: w });
  }
  anchors.push({ x: gcx, y: gcy - moonR + 8, kind: 'star', color: b, bright: bevel });
}

function drawBambooZenCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(66, Math.round(span * 0.3));
  const { d, g, l, s, m, a } = spec.propPalette;

  // Swept Zen gravel rings & wave lines across the courtyard
  for (let rr = r + 32; rr <= r + 88; rr += 18) {
    drawPixelRing(ctx, gcx, gcy, rr, Math.round(rr * 0.84), 2, hexAlpha(spec.floorAccent, 0.24), 2);
  }
  // Organic stone stepping trail skirting left/south to north/right
  for (const [sx, sy, sw, sh] of [
    [-Math.round(geom.gridW * 0.32), Math.round(geom.gridH * 0.34), 34, 22],
    [-Math.round(geom.gridW * 0.22), Math.round(geom.gridH * 0.2), 28, 20],
    [Math.round(geom.gridW * 0.22), -Math.round(geom.gridH * 0.2), 30, 20],
    [Math.round(geom.gridW * 0.31), -Math.round(geom.gridH * 0.34), 34, 22],
  ] as const) {
    fillNotched(ctx, gcx + sx - sw / 2, gcy + sy - sh / 2, sw, sh, 4, hexAlpha(s, 0.32));
    fillNotched(ctx, gcx + sx - sw / 2 + 2, gcy + sy - sh / 2 + 2, sw - 4, sh - 4, 3, hexAlpha(m, 0.32));
  }

  // Central stone water basin + mossy Taiji island
  drawPixelDisc(ctx, gcx, gcy, r, Math.round(r * 0.82), hexAlpha(spec.floorAccent, 0.18));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.62), Math.round(r * 0.56), 4, hexAlpha(s, 0.45));
  drawPixelDisc(ctx, gcx - 12, gcy, Math.round(r * 0.38), Math.round(r * 0.34), hexAlpha(g, 0.32));
  drawPixelDisc(ctx, gcx + 18, gcy + 6, 20, 14, hexAlpha(d, 0.42));
  // Bamboo culm and leaf sprays tucked inside the 4 courtyard corners
  for (const [cx, cy, dir] of [
    [geom.gridLeft + 18, geom.gridTop + 18, 1],
    [geom.gridLeft + geom.gridW - 18, geom.gridTop + 18, -1],
    [geom.gridLeft + 18, geom.gridTop + geom.gridH - 18, 1],
    [geom.gridLeft + geom.gridW - 18, geom.gridTop + geom.gridH - 18, -1],
  ] as const) {
    ctx.fillStyle = hexAlpha(d, 0.45);
    ctx.fillRect(cx - 2, cy - 10, 4, 24);
    ctx.fillStyle = hexAlpha(g, 0.48);
    ctx.fillRect(cx + 2 * dir, cy - 6, 12, 4);
    ctx.fillRect(cx + 5 * dir, cy + 2, 10, 4);
    ctx.fillStyle = hexAlpha(l, 0.48);
    ctx.fillRect(cx + 4 * dir, cy - 8, 8, 2);
    ctx.fillStyle = hexAlpha(a, 0.5);
    ctx.fillRect(cx - 6 * dir, cy + 6, 3, 2);
  }
}

function drawOliveMeadowCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(66, Math.round(span * 0.28));
  const { f, a, b, g, l, m, s, w } = spec.propPalette;

  // Curved organic travertine stepping slabs (avoiding straight checkerboard grid)
  for (let i = -3; i <= 3; i++) {
    const sy = gcy + i * Math.round(geom.gridH * 0.12);
    const sx = gcx + Math.round(Math.sin(i * 0.85) * geom.gridW * 0.14);
    drawPixelDisc(ctx, sx, sy, 28, 14, hexAlpha(s, 0.22));
    drawPixelDisc(ctx, sx - 2, sy - 2, 22, 10, hexAlpha(bevel, 0.34));
  }

  // Central Laurel Wellspring & Sun Mosaic
  drawPixelRing(ctx, gcx, gcy, r, r, 4, hexAlpha(m, 0.48));
  drawPixelRing(ctx, gcx, gcy, r - 10, r - 10, 3, hexAlpha(g, 0.44), 2);
  drawPixelRing(ctx, gcx, gcy, r - 20, r - 20, 2, hexAlpha(f, 0.48));
  drawPixelDisc(ctx, gcx, gcy, Math.max(24, Math.round(r * 0.48)), Math.max(24, Math.round(r * 0.48)), hexAlpha('#7ac4d4', 0.3));
  drawPixelDisc(ctx, gcx, gcy, 10, 10, hexAlpha(b, 0.56));

  // Wildflower micro clusters scattered warmly across the meadow
  for (let i = 0; i < 12; i++) {
    const fx = geom.gridLeft + 26 + ((i * 113) % Math.max(60, geom.gridW - 52));
    const fy = geom.gridTop + 24 + ((i * 89) % Math.max(60, geom.gridH - 48));
    if (Math.hypot(fx - gcx, fy - gcy) < r + 14) continue;
    if (i % 3 === 0) {
      drawMiniTuft(ctx, fx, fy, spec.propPalette, true);
    } else {
      ctx.fillStyle = hexAlpha(l, 0.5);
      ctx.fillRect(fx - 4, fy, 8, 3);
      ctx.fillStyle = hexAlpha(i % 2 === 0 ? w : a, 0.66);
      ctx.fillRect(fx - 2, fy - 2, 3, 3);
    }
  }
  anchors.push({ x: gcx, y: gcy - 8, kind: 'water', color: bevel, bright: w });
}

function drawFrostShrineCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(78, Math.round(span * 0.36));
  const { a, b, w } = spec.propPalette;

  // Soft snowbank drifts tucked cleanly in the 4 outer corners of the ice lake
  for (const [cx, cy] of [
    [geom.gridLeft + 34, geom.gridTop + 26],
    [geom.gridLeft + geom.gridW - 34, geom.gridTop + 26],
    [geom.gridLeft + 34, geom.gridTop + geom.gridH - 26],
    [geom.gridLeft + geom.gridW - 34, geom.gridTop + geom.gridH - 26],
  ] as const) {
    drawPixelDisc(ctx, cx, cy, 46, 26, hexAlpha(bevel, 0.58));
    drawPixelDisc(ctx, cx, cy, 34, 18, hexAlpha(b, 0.45));
  }

  // 6-pointed pixel glacier crystal mandala at center
  drawPixelRing(ctx, gcx, gcy, r, r, 2, hexAlpha(spec.floorAccent, 0.38));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.58), Math.round(r * 0.58), 2, hexAlpha(b, 0.5), 2);
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2 - Math.PI / 6;
    const tx = Math.round(gcx + Math.cos(ang) * r);
    const ty = Math.round(gcy + Math.sin(ang) * r);
    drawPixelLine(ctx, gcx, gcy, tx, ty, 2, hexAlpha(spec.floorAccent, 0.42));
    // Crystal side barbs at 65% radius
    const bx = gcx + Math.cos(ang) * (r * 0.65);
    const by = gcy + Math.sin(ang) * (r * 0.65);
    for (const side of [-0.55, 0.55] as const) {
      drawPixelLine(
        ctx,
        Math.round(bx),
        Math.round(by),
        Math.round(bx + Math.cos(ang + side) * 22),
        Math.round(by + Math.sin(ang + side) * 22),
        2,
        hexAlpha(a, 0.46),
      );
    }
    anchors.push({ x: tx, y: ty, kind: 'star', color: a, bright: w });
  }
  drawPixelDisc(ctx, gcx, gcy, 16, 16, hexAlpha(a, 0.34));
  drawPixelDisc(ctx, gcx, gcy, 8, 8, hexAlpha(w, 0.65));
}

function drawEmberForgeCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(72, Math.round(span * 0.33));
  const { a, b, c, s, o } = spec.propPalette;

  // Jagged glowing lava fissure channels feeding inward from the 4 corners
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const xOuter = gcx + sx * Math.round(geom.gridW * 0.4);
    const yOuter = gcy + sy * Math.round(geom.gridH * 0.4);
    const xMid = gcx + sx * Math.round(geom.gridW * 0.24);
    const yMid = gcy + sy * Math.round(geom.gridH * 0.16);
    const xIn = gcx + sx * Math.round(r * 0.68);
    const yIn = gcy + sy * Math.round(r * 0.62);
    drawPixelLine(ctx, xOuter, yOuter, xMid, yMid, 3, hexAlpha(c, 0.34));
    drawPixelLine(ctx, xMid, yMid, xIn, yIn, 3, hexAlpha(a, 0.4));
    drawPixelLine(ctx, xMid, yMid, xIn, yIn, 1, hexAlpha(b, 0.46));
    anchors.push({ x: xIn, y: yIn, kind: 'flame', color: a, bright: b });
  }

  // Central octagonal basalt forge hearth & anvil crest
  drawPixelDisc(ctx, gcx, gcy, r, r, hexAlpha(o, 0.22));
  drawPixelRing(ctx, gcx, gcy, r, r, 4, hexAlpha(s, 0.5));
  drawPixelRing(ctx, gcx, gcy, r - 12, r - 12, 3, hexAlpha(a, 0.45));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.52), Math.round(r * 0.52), 2, hexAlpha(b, 0.44), 2);
  drawPixelDisc(ctx, gcx, gcy, 18, 18, hexAlpha(a, 0.34));
  // Pixel anvil silhouette inside the forge ring
  ctx.fillStyle = hexAlpha(o, 0.45);
  ctx.fillRect(gcx - 14, gcy - 6, 28, 7);
  ctx.fillRect(gcx - 7, gcy + 1, 14, 6);
  ctx.fillRect(gcx - 11, gcy + 7, 22, 4);
}

function drawBloodRoseWindowCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(76, Math.round(span * 0.36));
  const { a, b, c, f, o } = spec.propPalette;

  // Velvet nave runner carpet vertically along the center
  const aisleW = Math.min(geom.gridW - 36, Math.round(geom.gridW * 0.4));
  fillNotched(ctx, gcx - aisleW / 2, geom.gridTop + 8, aisleW, geom.gridH - 16, 4, hexAlpha(c, 0.24));
  fillNotched(ctx, gcx - aisleW / 2 + 5, geom.gridTop + 12, aisleW - 10, geom.gridH - 24, 2, hexAlpha(f, 0.14));

  // Projected Stained-Glass Rose Window Light Pattern
  drawPixelDisc(ctx, gcx, gcy, r, r, hexAlpha(o, 0.22));
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const px = Math.round(gcx + Math.cos(ang) * (r * 0.58));
    const py = Math.round(gcy + Math.sin(ang) * (r * 0.58));
    drawPixelDisc(ctx, px, py, 18, 18, hexAlpha(i % 2 === 0 ? a : c, 0.28));
    drawPixelLine(ctx, gcx, gcy, Math.round(gcx + Math.cos(ang) * r), Math.round(gcy + Math.sin(ang) * r), 2, hexAlpha(f, 0.36));
  }
  drawPixelRing(ctx, gcx, gcy, r, r, 3, hexAlpha(f, 0.45));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.44), Math.round(r * 0.44), 2, hexAlpha(a, 0.5));
  drawPixelDisc(ctx, gcx, gcy, 12, 12, hexAlpha(b, 0.45));
  anchors.push({ x: gcx, y: gcy, kind: 'flame', color: a, bright: b });
}

function drawAiQuantumCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const core = Math.max(46, Math.round(span * 0.18));
  const { f, a, b, s, d } = spec.propPalette;

  // 45-degree chamfered PCB bus traces routing from 4 quadrants into central silicon die
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    for (const lane of [0, 14]) {
      const ix = gcx + sx * (core + lane);
      const iy = gcy + sy * Math.round(core * 0.55);
      const mx = gcx + sx * Math.round(geom.gridW * 0.25 + lane * 0.5);
      const my = gcy + sy * Math.round(geom.gridH * 0.24);
      const ox = gcx + sx * Math.round(geom.gridW * 0.38);
      const oy = gcy + sy * Math.round(geom.gridH * 0.36 - lane);
      drawPixelLine(ctx, ix, iy, mx, my, 2, hexAlpha(f, 0.36));
      drawPixelLine(ctx, mx, my, ox, my, 2, hexAlpha(a, 0.34));
      ctx.fillStyle = hexAlpha(f, 0.52);
      ctx.fillRect(ox - 3, oy - 3, 6, 6);
    }
    anchors.push({
      x: gcx + sx * (core + 8),
      y: gcy + sy * (core + 8),
      kind: 'star',
      color: a,
      bright: b,
    });
  }

  // Central chamfered Quantum Tensor Silicon Die & Pin Frame
  drawPixelRing(ctx, gcx, gcy, core + 24, core + 24, 2, hexAlpha(a, 0.36), 2);
  fillStepped(ctx, gcx - core, gcy - core, core * 2, core * 2, 8, hexAlpha(s, 0.36));
  fillNotched(ctx, gcx - core + 8, gcy - core + 8, (core - 8) * 2, (core - 8) * 2, 6, hexAlpha(d, 0.28));
  fillNotched(ctx, gcx - Math.round(core * 0.45), gcy - Math.round(core * 0.45), Math.round(core * 0.9), Math.round(core * 0.9), 4, hexAlpha(a, 0.38));
  // Gold contact pins along all 4 sides of the chip package
  ctx.fillStyle = hexAlpha(f, 0.58);
  for (let p = -core + 14; p <= core - 14; p += 10) {
    ctx.fillRect(gcx + p - 2, gcy - core - 5, 4, 5);
    ctx.fillRect(gcx + p - 2, gcy + core, 4, 5);
    ctx.fillRect(gcx - core - 5, gcy + p - 2, 5, 4);
    ctx.fillRect(gcx + core, gcy + p - 2, 5, 4);
  }
  ctx.fillStyle = hexAlpha(b, 0.72);
  ctx.fillRect(gcx - 5, gcy - 5, 10, 10);
}

function drawJianghuCompassCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(72, Math.round(span * 0.33));
  const { f, k, a, b, o } = spec.propPalette;

  // Coiled rope deck cleats tucked neatly at the 4 timber deck corners
  for (const [cx, cy] of [
    [geom.gridLeft + 26, geom.gridTop + 26],
    [geom.gridLeft + geom.gridW - 26, geom.gridTop + 26],
    [geom.gridLeft + 26, geom.gridTop + geom.gridH - 26],
    [geom.gridLeft + geom.gridW - 26, geom.gridTop + geom.gridH - 26],
  ] as const) {
    drawPixelRing(ctx, cx, cy, 12, 10, 2, hexAlpha(f, 0.45));
    drawPixelRing(ctx, cx, cy, 7, 6, 2, hexAlpha(k, 0.45));
  }

  // Brass Bagua & Marine Compass Rose inlaid cleanly into timber deck planks
  drawPixelRing(ctx, gcx, gcy, r, r, 3, hexAlpha(k, 0.5));
  drawPixelRing(ctx, gcx, gcy, r - 8, r - 8, 2, hexAlpha(f, 0.52));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.56), Math.round(r * 0.56), 2, hexAlpha(k, 0.44), 2);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    drawPixelLine(
      ctx,
      Math.round(gcx + Math.cos(ang) * (r * 0.32)),
      Math.round(gcy + Math.sin(ang) * (r * 0.32)),
      Math.round(gcx + Math.cos(ang) * (r - 10)),
      Math.round(gcy + Math.sin(ang) * (r - 10)),
      2,
      hexAlpha(i % 2 === 0 ? f : k, 0.44),
    );
  }
  drawCompassPointers(ctx, gcx, gcy, Math.round(r * 0.35), r + 8, hexAlpha(f, 0.58), hexAlpha(b, 0.65));
  drawPixelDisc(ctx, gcx, gcy, 12, 12, hexAlpha(o, 0.36));
  drawPixelDisc(ctx, gcx, gcy, 7, 7, hexAlpha(a, 0.52));
  anchors.push({ x: gcx, y: gcy - r + 4, kind: 'lantern', color: a, bright: bevel });
}

function drawLanternPlazaCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  anchors: AnimatedAnchor[],
): void {
  const gcx = geom.gridLeft + Math.round(geom.gridW / 2);
  const gcy = geom.midY;
  const span = Math.min(geom.gridW, geom.gridH);
  const r = Math.max(70, Math.round(span * 0.31));
  const { a, b, c, f } = spec.propPalette;

  // Warm amber lantern glow pools at all 4 plaza corners
  for (const [lx, ly] of [
    [geom.gridLeft + 38, geom.gridTop + 44],
    [geom.gridLeft + geom.gridW - 38, geom.gridTop + 44],
    [geom.gridLeft + 38, geom.gridTop + geom.gridH - 44],
    [geom.gridLeft + geom.gridW - 38, geom.gridTop + geom.gridH - 44],
  ] as const) {
    drawPixelDisc(ctx, lx, ly, 54, 38, hexAlpha(a, 0.16));
    drawPixelDisc(ctx, lx, ly, 26, 18, hexAlpha(b, 0.16));
    anchors.push({ x: lx, y: ly, kind: 'lantern', color: a, bright: b });
  }

  // Embroidered crimson & gold imperial knot medallion in the plaza center
  fillNotched(ctx, gcx - r, gcy - r, r * 2, r * 2, 14, hexAlpha(c, 0.2));
  fillNotched(ctx, gcx - r + 8, gcy - r + 8, (r - 8) * 2, (r - 8) * 2, 10, hexAlpha(f, 0.22));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.72), Math.round(r * 0.72), 2, hexAlpha(b, 0.45));
  drawPixelRing(ctx, gcx, gcy, Math.round(r * 0.42), Math.round(r * 0.42), 2, hexAlpha(a, 0.48), 2);
  drawPixelDisc(ctx, gcx, gcy, 12, 12, hexAlpha(f, 0.46));
}

function paintFloorSurfaceAndCenterpiece(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  appearance: PixelAppearance | undefined,
  spec: BoardSceneSpec,
  anchors: AnimatedAnchor[],
): void {
  const colors = appearance?.boardColors;
  const panel = colors?.panel ?? '#f7f4fb';
  const trim = colors?.trim ?? '#b6a5cb';
  const bevel = appearance?.boardTheme?.bevelLight ?? '#ffffff';
  const px = geom.panelLeft + 2;
  const py = geom.panelTop + 2;
  const pw = geom.panelWidth - 4;
  const floorBottom = Math.min(geom.panelTop + geom.panelHeight - 2, geom.benchY - 60);
  const ph = Math.max(120, floorBottom - py);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  // 1. Continuous seamless floor canvas (NO rigid 44px brick grid & NO opaque center cutout box)
  if (spec.floorStyle === 'bamboo_deck' || spec.floorStyle === 'jianghu_ship') {
    const baseFill =
      spec.floorStyle === 'jianghu_ship' ? mixHex(panel, spec.propPalette.m, 0.14) : mixHex(panel, spec.floorAccent, 0.08);
    ctx.fillStyle = baseFill;
    ctx.fillRect(px, py, pw, ph);
    if (spec.floorStyle === 'jianghu_ship') {
      const plankAlt = mixHex(panel, trim, 0.09);
      const seam = hexAlpha(trim, 0.2);
      for (let y = py; y < py + ph; y += 22) {
        if (Math.floor((y - py) / 22) % 2 === 1) {
          ctx.fillStyle = plankAlt;
          ctx.fillRect(px, y, pw, 22);
        }
        ctx.fillStyle = seam;
        ctx.fillRect(px, y, pw, 1);
        const off = (Math.floor((y - py) / 22) % 2) * 38;
        for (let x = px + off + 36; x < px + pw; x += 76) {
          ctx.fillRect(x, y, 1, 22);
          ctx.fillStyle = hexAlpha(spec.propPalette.f, 0.35);
          ctx.fillRect(x + 3, y + 3, 2, 2);
          ctx.fillRect(x + 3, y + 17, 2, 2);
          ctx.fillStyle = seam;
        }
      }
    } else {
      // Swept pale sand horizontal striations
      ctx.fillStyle = hexAlpha(spec.floorAccent, 0.12);
      for (let y = py + 10; y < py + ph; y += 14) {
        ctx.fillRect(px + 8, y, pw - 16, 1);
      }
    }
  } else if (spec.floorStyle === 'jade_pond' || spec.floorStyle === 'moon_pond') {
    const waterTint =
      spec.floorStyle === 'moon_pond' ? mixHex(panel, spec.floorAccent, 0.24) : mixHex(panel, spec.floorAccent, 0.12);
    ctx.fillStyle = waterTint;
    ctx.fillRect(px, py, pw, ph);
    // Gentle horizon/shoreline framing along panel perimeter
    ctx.fillStyle = hexAlpha(spec.propPalette.m, 0.18);
    ctx.fillRect(px, py, pw, 12);
    ctx.fillRect(px, py + ph - 12, pw, 12);
    ctx.fillStyle = hexAlpha(spec.floorHighlight, 0.38);
    for (let i = 0; i < 18; i++) {
      const rx = px + 18 + ((i * 97) % Math.max(40, pw - 64));
      const ry = py + 18 + ((i * 61) % Math.max(40, ph - 36));
      ctx.fillRect(rx, ry, 14 + (i % 3) * 6, 2);
    }
  } else if (spec.floorStyle === 'garden_meadow') {
    ctx.fillStyle = mixHex(panel, spec.floorAccent, 0.16);
    ctx.fillRect(px, py, pw, ph);
    for (let i = 0; i < 8; i++) {
      const gx = px + 36 + ((i * 107) % Math.max(60, pw - 72));
      const gy = py + 32 + ((i * 73) % Math.max(60, ph - 64));
      drawPixelDisc(ctx, gx, gy, 48, 28, hexAlpha(spec.floorAccent, 0.12));
    }
  } else {
    // Organic subtle masonry / brushed stone / velvet ground without square grid clutter
    ctx.fillStyle = mixHex(panel, spec.floorAccent, 0.08);
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = hexAlpha(trim, 0.1);
    for (let i = 0; i < 14; i++) {
      const sx = px + 24 + ((i * 119) % Math.max(80, pw - 80));
      const sy = py + 24 + ((i * 83) % Math.max(80, ph - 60));
      ctx.fillRect(sx, sy, 32 + (i % 3) * 14, 18);
    }
  }

  // Ultra-subtle atmospheric north/south tone distinction (zero dividing wall)
  ctx.fillStyle = hexAlpha(appearance?.boardColors?.enemy[0] ?? trim, 0.07);
  ctx.fillRect(px, py, pw, Math.round((geom.midY - py) * 0.92));
  ctx.fillStyle = hexAlpha(appearance?.boardColors?.own[0] ?? spec.floorAccent, 0.07);
  ctx.fillRect(px, geom.midY, pw, Math.max(0, py + ph - geom.midY));

  // Soft perimeter stone inner coping frame around canvas edge
  ctx.fillStyle = hexAlpha(trim, 0.24);
  ctx.fillRect(px + 6, py + 6, pw - 12, 2);
  ctx.fillRect(px + 6, py + ph - 8, pw - 12, 2);
  ctx.fillRect(px + 6, py + 6, 2, ph - 12);
  ctx.fillRect(px + pw - 8, py + 6, 2, ph - 12);

  // 2. Heroic Painted Centerpiece occupying the middle of the arena canvas
  if (spec.floorStyle === 'astral_observatory' || spec.floorStyle === 'sun_marble') {
    drawAstrolabeCenterpiece(ctx, geom, spec, bevel, anchors);
  } else if (spec.floorStyle === 'stone_carpet') {
    drawRoseFountainCenterpiece(ctx, geom, spec, bevel, anchors);
  } else if (spec.floorStyle === 'jade_pond') {
    drawPeachBridgeCenterpiece(ctx, geom, spec, bevel, anchors);
  } else if (spec.floorStyle === 'moon_pond') {
    drawMoonPoolCenterpiece(ctx, geom, spec, bevel, anchors);
  } else if (spec.floorStyle === 'bamboo_deck') {
    drawBambooZenCenterpiece(ctx, geom, spec);
  } else if (spec.floorStyle === 'garden_meadow') {
    drawOliveMeadowCenterpiece(ctx, geom, spec, bevel, anchors);
  } else if (spec.floorStyle === 'frost_rune') {
    drawFrostShrineCenterpiece(ctx, geom, spec, bevel, anchors);
  } else if (spec.floorStyle === 'ember_forge') {
    drawEmberForgeCenterpiece(ctx, geom, spec, anchors);
  } else if (spec.floorStyle === 'blood_cathedral') {
    drawBloodRoseWindowCenterpiece(ctx, geom, spec, anchors);
  } else if (spec.floorStyle === 'ai_lab') {
    drawAiQuantumCenterpiece(ctx, geom, spec, anchors);
  } else if (spec.floorStyle === 'jianghu_ship') {
    drawJianghuCompassCenterpiece(ctx, geom, spec, bevel, anchors);
  } else {
    drawLanternPlazaCenterpiece(ctx, geom, spec, anchors);
  }

  // Scattered organic petals / bamboo leaves on outdoor garden themes
  if (
    spec.floorStyle === 'jade_pond' ||
    spec.floorStyle === 'stone_carpet' ||
    spec.floorStyle === 'garden_meadow' ||
    spec.floorStyle === 'bamboo_deck'
  ) {
    const speck = spec.floorStyle === 'bamboo_deck' ? spec.propPalette.g : spec.propPalette.a;
    ctx.fillStyle = hexAlpha(speck, 0.44);
    for (let i = 0; i < 16; i++) {
      const sx = geom.gridLeft + 24 + ((i * 73) % Math.max(40, geom.gridW - 48));
      const sy = geom.gridTop + 22 + ((i * 97) % Math.max(40, geom.gridH - 44));
      ctx.fillRect(sx, sy, 3, 2);
      if (i % 3 === 0) {
        ctx.fillStyle = hexAlpha(spec.propPalette.b, 0.45);
        ctx.fillRect(sx + 4, sy + 2, 2, 2);
        ctx.fillStyle = hexAlpha(speck, 0.44);
      }
    }
  }
  ctx.restore();
}

function drawTopHeaderOrnament(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
): void {
  const y = 33;
  const cx = geom.centerX;
  const { f, k, a, b, g, d, s, o, w } = spec.propPalette;
  const span = Math.min(180, Math.round(geom.gridW * 0.42));

  // Decorative cornice bars flanking center crest (safely above row-0 unit bars)
  ctx.fillStyle = hexAlpha(k, 0.55);
  ctx.fillRect(cx - span, y, span - 24, 2);
  ctx.fillRect(cx + 24, y, span - 24, 2);
  ctx.fillStyle = bevel;
  ctx.fillRect(cx - span, y + 2, span - 24, 1);
  ctx.fillRect(cx + 24, y + 2, span - 24, 1);

  if (spec.headerKind === 'floral') {
    for (const dx of [-span + 16, -span + 54, span - 54, span - 16]) {
      ctx.fillStyle = d;
      ctx.fillRect(cx + dx - 6, y - 2, 12, 4);
      ctx.fillStyle = g;
      ctx.fillRect(cx + dx - 4, y - 3, 8, 3);
      ctx.fillStyle = a;
      ctx.fillRect(cx + dx - 2, y - 4, 4, 4);
      ctx.fillStyle = b;
      ctx.fillRect(cx + dx - 1, y - 3, 2, 2);
    }
    fillNotched(ctx, cx - 16, y - 9, 32, 18, 3, o);
    fillNotched(ctx, cx - 14, y - 7, 28, 14, 2, f);
    fillNotched(ctx, cx - 8, y - 5, 16, 10, 1, a);
    ctx.fillStyle = b;
    ctx.fillRect(cx - 3, y - 2, 6, 4);
  } else if (spec.headerKind === 'lantern') {
    for (const dx of [-span + 18, span - 18]) {
      ctx.fillStyle = o;
      ctx.fillRect(cx + dx - 5, y - 4, 10, 12);
      ctx.fillStyle = a;
      ctx.fillRect(cx + dx - 4, y - 2, 8, 8);
      ctx.fillStyle = b;
      ctx.fillRect(cx + dx - 2, y, 4, 4);
      ctx.fillStyle = f;
      ctx.fillRect(cx + dx - 3, y - 4, 6, 2);
      ctx.fillRect(cx + dx - 3, y + 6, 6, 2);
    }
    fillNotched(ctx, cx - 16, y - 8, 32, 16, 2, o);
    fillNotched(ctx, cx - 14, y - 6, 28, 12, 1, f);
    fillNotched(ctx, cx - 10, y - 4, 20, 8, 1, a);
    ctx.fillStyle = b;
    ctx.fillRect(cx - 4, y - 2, 8, 4);
  } else if (spec.headerKind === 'celestial') {
    fillNotched(ctx, cx - 18, y - 9, 36, 18, 3, o);
    fillNotched(ctx, cx - 16, y - 7, 32, 14, 2, s);
    fillNotched(ctx, cx - 10, y - 5, 20, 10, 1, f);
    ctx.fillStyle = b;
    ctx.fillRect(cx - 4, y - 3, 8, 6);
    ctx.fillStyle = a;
    ctx.fillRect(cx - 2, y - 1, 4, 2);
  } else if (spec.headerKind === 'crystal') {
    fillNotched(ctx, cx - 15, y - 9, 30, 18, 4, o);
    fillNotched(ctx, cx - 13, y - 7, 26, 14, 3, a);
    fillNotched(ctx, cx - 7, y - 5, 14, 10, 2, b);
    ctx.fillStyle = w;
    ctx.fillRect(cx - 2, y - 3, 4, 6);
  } else if (spec.headerKind === 'flame') {
    for (const dx of [-24, 24]) {
      ctx.fillStyle = a;
      ctx.fillRect(cx + dx - 3, y - 4, 6, 6);
      ctx.fillStyle = b;
      ctx.fillRect(cx + dx - 1, y - 6, 2, 5);
    }
    fillNotched(ctx, cx - 17, y - 8, 34, 16, 3, o);
    fillNotched(ctx, cx - 15, y - 6, 30, 12, 2, f);
    ctx.fillStyle = a;
    ctx.fillRect(cx - 6, y - 4, 12, 8);
    ctx.fillStyle = b;
    ctx.fillRect(cx - 3, y - 2, 6, 4);
  } else if (spec.headerKind === 'crown') {
    fillNotched(ctx, cx - 18, y - 8, 36, 16, 2, o);
    ctx.fillStyle = f;
    ctx.fillRect(cx - 14, y - 2, 28, 7);
    ctx.fillRect(cx - 12, y - 6, 4, 4);
    ctx.fillRect(cx - 2, y - 7, 4, 5);
    ctx.fillRect(cx + 8, y - 6, 4, 4);
    ctx.fillStyle = a;
    ctx.fillRect(cx - 3, y, 6, 4);
    ctx.fillStyle = b;
    ctx.fillRect(cx - 1, y + 1, 2, 2);
  } else if (spec.headerKind === 'tech') {
    fillNotched(ctx, cx - 18, y - 8, 36, 16, 2, o);
    ctx.fillStyle = f;
    for (const sx of [-12, -4, 4, 10]) {
      ctx.fillRect(cx + sx, y - 10, 2, 2);
      ctx.fillRect(cx + sx, y + 8, 2, 2);
    }
    fillNotched(ctx, cx - 14, y - 6, 28, 12, 1, s);
    ctx.fillStyle = a;
    ctx.fillRect(cx - 8, y - 3, 16, 6);
    ctx.fillStyle = b;
    ctx.fillRect(cx - 3, y - 1, 6, 2);
  } else {
    // Cloud-scroll nameplate for bamboo / jianghu themes
    fillNotched(ctx, cx - 22, y - 7, 44, 14, 2, o);
    fillNotched(ctx, cx - 19, y - 5, 38, 10, 1, f);
    fillNotched(ctx, cx - 12, y - 4, 24, 8, 1, w);
    ctx.fillStyle = a;
    ctx.fillRect(cx - 4, y - 2, 8, 4);
    ctx.fillStyle = b;
    ctx.fillRect(cx - 2, y - 1, 4, 2);
  }
}

function drawApronProps(
  ctx: CanvasRenderingContext2D,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  bevel: string,
  anchors: AnimatedAnchor[],
): void {
  const leftApronX = Math.max(geom.stageLeft + 18, geom.gridLeft - 18);
  const rightApronX = Math.min(geom.stageLeft + geom.stageWidth - 18, geom.gridLeft + geom.gridW + 18);
  const hasLeftSpace = geom.gridLeft - geom.stageLeft >= 28;
  const hasRightSpace = geom.stageLeft + geom.stageWidth - (geom.gridLeft + geom.gridW) >= 28;
  const { o, s, m, f, a, b, g, d } = spec.propPalette;

  // Sculpted frontline gateposts on both stage aprons
  for (const [enabled, px] of [
    [hasLeftSpace, leftApronX],
    [hasRightSpace, rightApronX],
  ] as const) {
    if (!enabled) continue;
    fillNotched(ctx, px - 6, geom.midY - 12, 12, 24, 2, o);
    fillNotched(ctx, px - 5, geom.midY - 11, 10, 22, 1, s);
    ctx.fillStyle = m;
    ctx.fillRect(px - 4, geom.midY - 9, 8, 18);
    ctx.fillStyle = f;
    ctx.fillRect(px - 5, geom.midY - 10, 10, 2);
    ctx.fillRect(px - 5, geom.midY + 8, 10, 2);
    ctx.fillStyle = a;
    ctx.fillRect(px - 3, geom.midY - 5, 6, 8);
    ctx.fillStyle = b;
    ctx.fillRect(px - 2, geom.midY - 4, 4, 5);
    anchors.push({ x: px, y: geom.midY - 2, kind: spec.gateKind, color: a, bright: b });
  }

  // Right apron vertical counter-ornaments balancing left-side "敌阵" / "我阵" plaques
  if (hasRightSpace) {
    for (const cy of [
      Math.round(geom.gridTop + (HALF_ROWS * (geom.gridH / BOARD_ROWS)) / 2),
      Math.round(geom.gridTop + HALF_ROWS * (geom.gridH / BOARD_ROWS) * 1.5),
    ]) {
      fillNotched(ctx, rightApronX - 7, cy - 17, 14, 34, 2, s);
      fillNotched(ctx, rightApronX - 6, cy - 16, 12, 32, 1, bevel);
      fillNotched(ctx, rightApronX - 5, cy - 15, 10, 30, 1, spec.floorDeep);
      ctx.fillStyle = f;
      ctx.fillRect(rightApronX - 3, cy - 12, 6, 2);
      ctx.fillRect(rightApronX - 3, cy + 10, 6, 2);
      ctx.fillStyle = g;
      ctx.fillRect(rightApronX - 2, cy - 7, 4, 14);
      ctx.fillStyle = b;
      ctx.fillRect(rightApronX - 1, cy - 3, 2, 6);
    }
  }

  // Bench divider flank mini planters / lanterns beside "备战席"
  const benchHeaderY = geom.benchY - 44;
  for (const bx of [geom.centerX - 114, geom.centerX + 114]) {
    ctx.fillStyle = d;
    ctx.fillRect(bx - 5, benchHeaderY - 8, 10, 4);
    ctx.fillStyle = g;
    ctx.fillRect(bx - 4, benchHeaderY - 10, 8, 3);
    ctx.fillStyle = b;
    ctx.fillRect(bx - 2, benchHeaderY - 11, 4, 2);
    ctx.fillStyle = o;
    ctx.fillRect(bx - 4, benchHeaderY - 4, 8, 4);
    ctx.fillStyle = f;
    ctx.fillRect(bx - 3, benchHeaderY - 3, 6, 2);
  }

  // Upper corner inner props when stage side apron allows
  if (geom.gridLeft - geom.stageLeft >= 42) {
    const innerSprite = PIXEL_PROPS[spec.innerProp];
    drawPixelSprite(ctx, geom.stageLeft + 26, geom.gridTop + 14, 1, innerSprite, spec.propPalette, false);
    drawPixelSprite(ctx, geom.stageLeft + geom.stageWidth - 26, geom.gridTop + 14, 1, innerSprite, spec.propPalette, true);
  }
}

function paintOuterMarginDiorama(
  ctx: CanvasRenderingContext2D,
  board: PixelBoard,
  geom: StageGeometry,
  spec: BoardSceneSpec,
  anchors: AnimatedAnchor[],
): void {
  const leftSpace = geom.stageLeft - 6;
  const rightSpace = board.width - (geom.stageLeft + geom.stageWidth) - 6;
  const minMargin = Math.min(leftSpace, rightSpace);
  if (minMargin < 44) return;

  const innerSprite = PIXEL_PROPS[spec.innerProp];
  const outerSprite = PIXEL_PROPS[spec.outerProp];
  const nearScale = minMargin >= 66 ? 2 : 1;
  const nearOffset = Math.min(Math.round(minMargin * 0.42), 44);
  const { o, s, m, a, b, d, f } = spec.propPalette;

  for (const [side, edgeX] of [
    [-1, geom.stageLeft],
    [1, geom.stageLeft + geom.stageWidth],
  ] as const) {
    const x1 = Math.round(edgeX + side * nearOffset);
    for (const [py, sprite] of [
      [215, outerSprite],
      [485, innerSprite],
    ] as const) {
      drawPixelDisc(ctx, x1, py + 2, 18 * nearScale * 0.72, 6, hexAlpha('#000000', 0.24));
      drawPixelDisc(ctx, x1, py, 15 * nearScale * 0.68, 5, hexAlpha(s, 0.75));
      ctx.fillStyle = hexAlpha(m, 0.65);
      ctx.fillRect(x1 - 10, py - 2, 20, 2);
      drawPixelSprite(ctx, x1, py, nearScale, sprite, spec.propPalette, side > 0);
      drawMiniTuft(ctx, x1 + side * 14, py + 3, spec.propPalette, true);
      if (spec.gateKind === 'lantern' || spec.gateKind === 'flame') {
        anchors.push({
          x: x1,
          y: py - Math.round(sprite.length * nearScale * 0.65),
          kind: spec.gateKind,
          color: a,
          bright: b,
        });
      }
    }

    if (minMargin >= 112) {
      const farOffset = Math.min(Math.round(minMargin * 0.76), 118);
      const x2 = Math.round(edgeX + side * farOffset);
      for (const py of [135, 355, 595]) {
        const chosen = py === 355 ? outerSprite : innerSprite;
        drawPixelDisc(ctx, x2, py + 2, 20, 7, hexAlpha('#000000', 0.2));
        drawPixelDisc(ctx, x2, py, 16, 5, hexAlpha(d, 0.75));
        drawPixelSprite(ctx, x2, py, 2, chosen, spec.propPalette, side > 0);
      }
      ctx.fillStyle = hexAlpha(o, 0.35);
      ctx.fillRect(Math.min(x1, x2) + 4, 318, Math.abs(x2 - x1) - 8, 3);
      ctx.fillStyle = hexAlpha(f, 0.32);
      ctx.fillRect(Math.min(x1, x2) + 4, 319, Math.abs(x2 - x1) - 8, 1);
    }
  }
}

export function drawCornerMotifEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  motif: PixelBoardMotifKind,
  primary: string,
  spark: string,
  outline: string,
): void {
  const plot = (dx: number, dy: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(cx + dx, cy + dy, w, h);
  };
  if (motif === 'rose' || motif === 'peach') {
    plot(-3, -3, 7, 7, outline);
    plot(-2, -2, 5, 5, primary);
    plot(-1, -1, 3, 3, spark);
    plot(0, 0, 1, 1, primary);
  } else if (motif === 'olive' || motif === 'bamboo') {
    plot(-3, -1, 7, 3, outline);
    plot(-2, 0, 5, 1, '#529943');
    plot(-1, -2, 2, 2, spark);
    plot(0, 1, 2, 1, '#529943');
  } else if (motif === 'sun' || motif === 'astrolabe' || motif === 'frost') {
    plot(0, -4, 1, 9, primary);
    plot(-4, 0, 9, 1, primary);
    plot(-2, -2, 5, 5, outline);
    plot(-1, -1, 3, 3, spark);
  } else if (motif === 'moon') {
    plot(-3, -3, 6, 7, outline);
    plot(-2, -2, 4, 5, spark);
    plot(0, -1, 2, 3, outline);
  } else if (motif === 'lantern') {
    plot(-3, -3, 7, 7, outline);
    plot(-2, -2, 5, 5, primary);
    plot(-1, -1, 3, 3, '#ffe49e');
    plot(0, 3, 1, 2, outline);
  } else {
    plot(-2, -3, 5, 7, outline);
    plot(-1, -3, 3, 6, primary);
    plot(-2, -1, 5, 3, primary);
    plot(0, -1, 1, 3, spark);
  }
}

/** Paint translucent placement grid overlay ("透明格子") ONLY while dragging a unit onto the canvas. */
export function paintTranslucentDragGrid(
  ctx: CanvasRenderingContext2D,
  board: PixelBoard,
  appearance: PixelAppearance | undefined,
  alpha: number,
  hoverCell: { row: number; col: number } | null = null,
): void {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (clamped <= 0.01) return;

  const geom = computeStageGeometry(board);
  const colors = appearance?.boardColors;
  const theme = appearance?.boardTheme;
  const bevel = theme?.bevelLight ?? '#ffffff';
  const ownCols = colors?.own ?? ['#bde0d5', '#cde8df'];
  const enemyCols = colors?.enemy ?? ['#e9cad5', '#f2d8e0'];
  const ownRim = theme?.ownRim ?? '#7fb6a4';
  const enemyRim = theme?.enemyRim ?? '#c896a8';
  const midSegments = theme?.midSegments ?? ['#f6d796', '#fff7e2'];

  ctx.save();

  for (let row = 0; row < BOARD_ROWS; row++) {
    const isOwn = row >= HALF_ROWS;
    const rimHex = isOwn ? ownRim : enemyRim;
    for (let col = 0; col < BOARD_COLS; col++) {
      const left = Math.round(geom.gridLeft + col * board.cellWidth) + 1;
      const top = Math.round(geom.gridTop + row * board.rowHeight) + 1;
      const w = Math.round(board.cellWidth) - 2;
      const h = Math.round(board.rowHeight) - 2;
      const zoneHex = (isOwn ? ownCols : enemyCols)[(row + col) % 2]!;
      const isHovered = hoverCell !== null && hoverCell.row === row && hoverCell.col === col;

      // Translucent frosted fill over painted canvas (deployable own half clearer than faint enemy half)
      const fillOpacity = isHovered ? 0.36 : isOwn ? 0.22 : 0.06;
      fillNotched(ctx, left, top, w, h, 2, hexAlpha(zoneHex, fillOpacity * clamped));
      if (isHovered) {
        fillNotched(ctx, left + 1, top + 1, w - 2, h - 2, 2, hexAlpha(bevel, 0.28 * clamped));
      }

      // Translucent crisp perimeter & corner brackets
      const strokeOpacity = isHovered ? 0.88 : isOwn ? 0.56 : 0.22;
      const rimCol = hexAlpha(rimHex, strokeOpacity * clamped);
      ctx.fillStyle = rimCol;
      if (isOwn) {
        ctx.fillRect(left + 2, top, w - 4, 1);
        ctx.fillRect(left + 2, top + h - 1, w - 4, 1);
        ctx.fillRect(left, top + 2, 1, h - 4);
        ctx.fillRect(left + w - 1, top + 2, 1, h - 4);

        const arm = 6;
        ctx.fillStyle = hexAlpha(bevel, (isHovered ? 0.92 : 0.65) * clamped);
        ctx.fillRect(left + 1, top + 1, arm, 1);
        ctx.fillRect(left + 1, top + 1, 1, arm);
        ctx.fillRect(left + w - 1 - arm, top + 1, arm, 1);
        ctx.fillRect(left + w - 2, top + 1, 1, arm);
        ctx.fillRect(left + 1, top + h - 2, arm, 1);
        ctx.fillRect(left + 1, top + h - 1 - arm, 1, arm);
        ctx.fillRect(left + w - 1 - arm, top + h - 2, arm, 1);
        ctx.fillRect(left + w - 2, top + h - 1 - arm, 1, arm);
      } else {
        for (let sx = left + 4; sx < left + w - 4; sx += 10) {
          ctx.fillRect(sx, top, 4, 1);
          ctx.fillRect(sx, top + h - 1, 4, 1);
        }
        for (let sy = top + 4; sy < top + h - 4; sy += 9) {
          ctx.fillRect(left, sy, 1, 3);
          ctx.fillRect(left + w - 1, sy, 1, 3);
        }
      }
    }
  }

  // Frontline separator hairline visible strictly while dragging to clarify half-board boundary
  ctx.fillStyle = hexAlpha(midSegments[0], 0.52 * clamped);
  for (let sx = geom.gridLeft + 2; sx < geom.gridLeft + geom.gridW - 2; sx += 12) {
    ctx.fillRect(sx, geom.midY, Math.min(6, geom.gridLeft + geom.gridW - 2 - sx), 2);
  }

  ctx.restore();
}

export function paintStaticBoardScene(
  ctx: CanvasRenderingContext2D,
  board: PixelBoard,
  appearance: PixelAppearance | undefined,
): AnimatedAnchor[] {
  const scene = appearance?.boardDecor?.scene;
  if (isPixelScene(scene)) {
    paintSceneStatic(ctx, board, scene);
    return [];
  }
  const geom = computeStageGeometry(board);
  const colors = appearance?.boardColors;
  const theme = appearance?.boardTheme;
  const bg = colors?.background ?? '#e5e0f0';
  const panel = colors?.panel ?? '#f7f4fb';
  const trim = colors?.trim ?? '#b6a5cb';
  const bevel = theme?.bevelLight ?? '#ffffff';
  const frameDark = theme?.frameDark ?? '#735f96';
  const midClasp = theme?.midClasp ?? ['#766199', '#ffe5ad', '#ef95b2'];
  const benchAccents = theme?.benchAccents ?? ['#9fd6c5', '#e3b7ca'];
  const spec = boardSceneSpec(appearance?.boardDecor?.cornerMotif);
  const anchors: AnimatedAnchor[] = [];

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, board.width, board.height);

  const floorLine = theme?.gridRim ? hexAlpha(theme.gridRim, 0.11) : '#5b4a7312';
  const crossTint = theme?.gridRim ? hexAlpha(theme.gridRim, 0.2) : '#6c598c24';
  ctx.fillStyle = floorLine;
  for (let gy = 36; gy < board.height; gy += 48) {
    ctx.fillRect(0, gy, board.width, 1);
  }
  const gridOriginX = Math.round(board.width / 2) % 48;
  for (let gx = gridOriginX; gx < board.width; gx += 48) {
    ctx.fillRect(gx, 0, 1, board.height);
  }
  ctx.fillStyle = crossTint;
  for (let gy = 36; gy < board.height; gy += 48) {
    for (let gx = gridOriginX; gx < board.width; gx += 48) {
      ctx.fillRect(gx - 2, gy, 5, 1);
      ctx.fillRect(gx, gy - 2, 1, 5);
    }
  }

  paintOuterMarginDiorama(ctx, board, geom, spec, anchors);

  fillStepped(ctx, geom.stageLeft + 4, geom.stageTop + 7, geom.stageWidth, geom.stageHeight + 2, 3, theme?.plinthShadow ?? '#6e5b8f26');
  fillStepped(ctx, geom.stageLeft, geom.stageTop + 4, geom.stageWidth, geom.stageHeight, 3, theme?.plinthDark ?? '#6b588c');
  fillStepped(ctx, geom.stageLeft + 3, geom.stageTop + 7, geom.stageWidth - 6, geom.stageHeight - 5, 2, theme?.plinthLight ?? '#9f8db9');
  ctx.fillStyle = theme?.plinthJoint ?? '#766298';
  for (let bx = geom.stageLeft + 28; bx < geom.stageLeft + geom.stageWidth - 28; bx += 42) {
    ctx.fillRect(bx, geom.stageTop + geom.stageHeight - 2, 2, 4);
  }
  fillStepped(ctx, geom.stageLeft, geom.stageTop, geom.stageWidth, geom.stageHeight - 3, 3, frameDark);
  fillStepped(ctx, geom.stageLeft + 2, geom.stageTop + 2, geom.stageWidth - 4, geom.stageHeight - 7, 3, trim);
  fillStepped(ctx, geom.stageLeft + 5, geom.stageTop + 5, geom.stageWidth - 10, geom.stageHeight - 13, 2, bevel);
  fillStepped(ctx, geom.stageLeft + 7, geom.stageTop + 7, geom.stageWidth - 14, geom.stageHeight - 17, 2, panel);
  fillNotched(ctx, geom.stageLeft + 10, geom.stageTop + 10, geom.stageWidth - 20, geom.stageHeight - 23, 2, theme?.frameInnerLine ?? '#ded4ee');
  fillNotched(ctx, geom.panelLeft, geom.panelTop, geom.panelWidth, geom.panelHeight, 2, panel);

  paintFloorSurfaceAndCenterpiece(ctx, geom, appearance, spec, anchors);

  const cornerMotif = appearance?.boardDecor?.cornerMotif;
  for (const [xi, cx] of [geom.stageLeft + 15, geom.stageLeft + geom.stageWidth - 16].entries()) {
    for (const [yi, cy] of [geom.stageTop + 15, geom.stageTop + geom.stageHeight - 19].entries()) {
      fillNotched(ctx, cx - 5, cy - 5, 11, 11, 2, frameDark);
      fillNotched(ctx, cx - 4, cy - 4, 9, 9, 1, midClasp[1]);
      if (cornerMotif) {
        drawCornerMotifEmblem(ctx, cx, cy, cornerMotif, midClasp[2], bevel, midClasp[0]);
      } else {
        ctx.fillStyle = (xi + yi) % 2 ? benchAccents[1] : benchAccents[0];
        ctx.fillRect(cx - 2, cy - 2, 5, 5);
        ctx.fillStyle = bevel;
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }
  }

  drawTopHeaderOrnament(ctx, geom, spec, bevel);
  drawApronProps(ctx, geom, spec, bevel, anchors);

  const labelX = Math.max(geom.stageLeft + 17, geom.gridLeft - 18);
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px monospace';
  const enemyPlaque = theme?.enemyPlaque ?? ['#8f5166', '#c693a6', '#faeaf0'];
  const ownPlaque = theme?.ownPlaque ?? ['#3a7363', '#7db5a3', '#e6f7f1'];
  const cellH = geom.gridH / BOARD_ROWS;
  for (const [label, centerY, tint, borderCol, bgCol] of [
    ['敌阵', geom.gridTop + (HALF_ROWS * cellH) / 2, enemyPlaque[0], enemyPlaque[1], enemyPlaque[2]],
    ['我阵', geom.gridTop + HALF_ROWS * cellH * 1.5, ownPlaque[0], ownPlaque[1], ownPlaque[2]],
  ] as const) {
    const py = Math.round(centerY);
    if (geom.gridLeft - geom.stageLeft >= 32) {
      fillNotched(ctx, labelX - 9, py - 19, 18, 36, 2, borderCol);
      fillNotched(ctx, labelX - 8, py - 18, 16, 34, 1, bevel);
      fillNotched(ctx, labelX - 7, py - 17, 14, 32, 1, bgCol);
    }
    ctx.fillStyle = tint;
    ctx.fillText(label[0]!, labelX, py - 4);
    ctx.fillText(label[1]!, labelX, py + 11);
  }

  // Subtle edge-only frontline markers flanking left/right aprons without crossing the painted centerpiece
  const midBar = theme?.midBar ?? '#79659c';
  const midSeg = theme?.midSegments ?? ['#f6d796', '#fff7e2'];
  for (const mx of [geom.gridLeft - 10, geom.gridLeft + geom.gridW + 2]) {
    ctx.fillStyle = hexAlpha(midBar, 0.72);
    ctx.fillRect(mx, geom.midY - 2, 8, 4);
    ctx.fillStyle = midSeg[0];
    ctx.fillRect(mx + 1, geom.midY - 1, 6, 2);
  }

  const benchHeaderY = geom.benchY - 44;
  const benchBar = theme?.benchBar ?? '#9d8bc0';
  const benchRim = theme?.benchRim ?? '#8774aa';
  ctx.fillStyle = benchBar;
  ctx.fillRect(geom.centerX - 104, benchHeaderY - 5, 62, 2);
  ctx.fillRect(geom.centerX + 42, benchHeaderY - 5, 62, 2);
  ctx.fillStyle = bevel;
  ctx.fillRect(geom.centerX - 104, benchHeaderY - 3, 62, 1);
  ctx.fillRect(geom.centerX + 42, benchHeaderY - 3, 62, 1);
  fillNotched(ctx, geom.centerX - 34, benchHeaderY - 14, 68, 18, 2, benchRim);
  fillNotched(ctx, geom.centerX - 32, benchHeaderY - 12, 64, 14, 1, panel);
  ctx.fillStyle = colors?.text ?? '#483b5c';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('备战席', geom.centerX, benchHeaderY - 1);

  for (let i = 0; i < BENCH_CAPACITY; i++) {
    const bx = board.benchLeft + i * board.benchSpacing;
    const sx = Math.round(bx - board.benchSpacing / 2 + 2);
    const sw = Math.round(board.benchSpacing - 4);
    const sy = geom.benchY - 31;
    const sh = 62;
    fillNotched(ctx, sx - 1, sy - 1, sw + 2, sh + 4, 2, hexAlpha(benchRim, 0.92));
    fillNotched(ctx, sx, sy, sw, sh + 1, 2, hexAlpha(bevel, 0.9));
    fillNotched(ctx, sx + 1, sy + 1, sw - 2, sh - 1, 1, hexAlpha(colors?.bench ?? '#eae3f4', 0.84));
    ctx.fillStyle = '#7a679c24';
    ctx.fillRect(sx + 2, sy + 1, sw - 4, 4);
    ctx.fillStyle = '#ffffffa8';
    ctx.fillRect(sx + 2, sy + sh - 6, sw - 4, 2);
    ctx.fillStyle = i % 2 ? benchAccents[0] : benchAccents[1];
    ctx.fillRect(sx + 2, sy + sh - 4, sw - 4, 3);
    ctx.fillStyle = trim;
    ctx.fillRect(sx + 3, sy + 3, 2, 2);
    ctx.fillRect(sx + sw - 5, sy + 3, 2, 2);
  }

  return anchors;
}

export function paintAnimatedBoardAccents(
  ctx: CanvasRenderingContext2D,
  board: PixelBoard,
  appearance: PixelAppearance | undefined,
  anchors: readonly AnimatedAnchor[],
  now: number,
  reduced: boolean,
): void {
  const scene = appearance?.boardDecor?.scene;
  if (isPixelScene(scene)) {
    paintSceneAnimated(ctx, board, scene, now, reduced);
    return;
  }
  if (reduced) return;

  ctx.save();
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i]!;
    const phase = Math.floor((now / 260 + i * 0.7) % 3);
    if (a.kind === 'flame') {
      ctx.globalAlpha = phase === 1 ? 0.42 : 0.28;
      ctx.fillStyle = a.color;
      ctx.fillRect(Math.round(a.x - 5), Math.round(a.y - 5), 10, 10);
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = a.bright;
      ctx.fillRect(Math.round(a.x + (phase - 1)), Math.round(a.y - 6 - (phase % 2) * 2), 2, 2);
    } else if (a.kind === 'lantern') {
      ctx.globalAlpha = phase === 2 ? 0.34 : 0.22;
      ctx.fillStyle = a.bright;
      ctx.fillRect(Math.round(a.x - 7), Math.round(a.y - 7), 14, 14);
    } else if (a.kind === 'star') {
      ctx.globalAlpha = 0.3 + 0.55 * Math.abs(Math.sin(now * 0.0024 + i));
      ctx.fillStyle = a.bright;
      ctx.fillRect(Math.round(a.x - 3), Math.round(a.y), 7, 1);
      ctx.fillRect(Math.round(a.x), Math.round(a.y - 3), 1, 7);
    } else {
      const shift = Math.round(Math.sin(now * 0.002 + i * 1.4) * 3);
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = a.bright;
      ctx.fillRect(Math.round(a.x - 4 + shift), Math.round(a.y + 3), 6, 1);
    }
  }
  ctx.restore();

  const decor = appearance?.boardDecor;
  if (!decor) return;
  const geom = computeStageGeometry(board);
  const margin = Math.round((board.width - geom.stageWidth) / 2);
  if (margin < 16) return;
  const fallDir = decor.moteKind === 'embers' ? -1 : 1;
  const count = 16;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0;
    const laneW = Math.max(8, margin - 8);
    const laneX = side ? 4 + ((i * 19) % laneW) : board.width - margin + 4 + ((i * 23) % laneW);
    const phase = ((now * (0.012 + (i % 4) * 0.004) * fallDir) + i * 53) % (board.height + 24);
    const y = Math.round(phase < -12 ? phase + board.height + 24 : phase);
    const sway =
      decor.moteKind === 'stars' || decor.moteKind === 'fireflies'
        ? 0
        : Math.round(Math.sin(now * 0.0018 + i) * 3);
    const x = Math.round(laneX + sway);
    ctx.fillStyle = decor.moteColors[i % decor.moteColors.length]!;
    if (decor.moteKind === 'stars') {
      ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(now * 0.002 + i));
      ctx.fillRect(x, y, 2, 2);
      if (i % 3 === 0) {
        ctx.fillRect(x - 1, y, 4, 2);
        ctx.fillRect(x, y - 1, 2, 4);
      }
    } else {
      ctx.globalAlpha = 0.48;
      ctx.fillRect(x, y, 2, 2);
      if (i % 2 === 0) ctx.fillRect(x + 1, y + 1, 2, 2);
    }
  }
  ctx.restore();
}
