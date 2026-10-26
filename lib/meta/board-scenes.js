// Art-space coordinates keep this scene's composition outside the renderer.
export const ROSE_COURT = {
  size: 1024,
  corners: [[281, 264], [746, 264], [834, 786], [214, 786]],
  bench: { first: [207, 864], last: [901, 864] },
  palette: { ally: '#829aa9', enemy: '#9d425b', gold: '#b39b78' },
  ambience: {
    perch: [408, 88],
    flights: [
      { points: [[92, 210], [345, 30], [649, 46], [928, 172]], start: 1.6, duration: 10, size: .9 },
      { points: [[76, 224], [331, 62], [652, 57], [938, 194]], start: 2.4, duration: 10.8, size: .7 },
      { points: [[957, 174], [730, 70], [375, 35], [79, 185]], start: 22, duration: 9, size: .65 },
    ],
    runes: [{ x: 799, y: 222, rx: 40, ry: 21 }, { x: 509, y: 953, rx: 22, ry: 20 }],
  },
  image: '/boards/rose-court.png',
};
const astral = {
  size: 1024,
  corners: [[286, 275], [727, 275], [842, 787], [215, 787]],
  bench: { first: [219, 855], last: [898, 855] },
  palette: { ally: '#80b5ce', enemy: '#ba6d73', gold: '#d8b76b' },
  particles: false,
  ambience: {
    glowColor: '#f5d28b',
    runes: [{ x: 512, y: 95, rx: 83, ry: 82 }, { x: 815, y: 179, rx: 44, ry: 37 }, { x: 512, y: 512, rx: 24, ry: 22 }],
    orbits: [{ x: 815, y: 179, rx: 68, ry: 29, speed: .12 }, { x: 815, y: 179, rx: 45, ry: 18, speed: -.18 }],
    starfield: {
      speed: 8, starScale: 1.65, trailOpacity: .78, trailWidth: 1.4,
      center: [512, 92], radii: [135, 177, 224, 279, 343, 420, 510, 615],
      sky: [[0, 0], [1024, 0], [1024, 405], [971, 322], [922, 210], [897, 141], [612, 141], [562, 215], [460, 215], [385, 145], [247, 145], [224, 86], [204, 101], [194, 147], [165, 147], [104, 272], [55, 412], [0, 457]],
    },
    motes: [[283, 80], [355, 103], [643, 61], [739, 87], [829, 61], [928, 146], [54, 412], [976, 419]],
  },
};
export const TIME_ASTROLABE = { ...astral, image: '/boards/time-astrolabe.png' };
export const TIME_ASTROLABE_IVORY = { ...astral, image: '/boards/time-astrolabe-ivory.png' };
export const REVIVAL_SEASON = {
  size: 1024,
  corners: [[302, 287], [722, 287], [778, 780], [278, 780]],
  bench: { first: [296, 846], last: [715, 846], scale: .5, compactLabels: true },
  palette: { ally: '#528a80', enemy: '#bc7473', gold: '#c8b879' },
  particles: false,
  lighting: { sky: '#fff4cf', ground: '#435749', sun: '#fff0c2', rim: '#a8d8bb' },
  ambience: {
    bird: 'dove',
    flights: [
      { points: [[-35, 190], [285, 65], [576, 43], [1055, 145]], start: 1, duration: 15, size: 1.25 },
      { points: [[-45, 214], [274, 109], [575, 79], [1050, 180]], start: 3.7, duration: 16, size: .95 },
      { points: [[1055, 328], [919, 171], [514, 71], [-40, 137]], start: 23, duration: 14, size: 1.05 },
    ],
    glowColor: '#fff1bc',
    runes: [{ x: 515, y: 511, rx: 30, ry: 28 }, { x: 194, y: 201, rx: 56, ry: 49 }, { x: 823, y: 213, rx: 58, ry: 48 }],
    motes: [[53, 415], [37, 578], [73, 638], [965, 437], [981, 563], [942, 658]],
    veil: { color: '#e5e4cb', opacity: .58, points: [[274, 265], [745, 265], [825, 791], [219, 791]] },
    atmosphere: { top: '#fff2d3', bottom: '#e3eee3', opacity: .13 },
    fronds: [
      { x: -24, y: -22, points: [[0, 0], [76, 35], [144, 112], [247, 120]], size: 1.28, leafLength: 52, leafWidth: .23, opacity: 1, color: '#4e6044', light: '#7f9064', shadow: '#304631', sway: 4.5, speed: .64, phase: 0 },
      { x: 1048, y: -8, points: [[0, 0], [70, 18], [132, 115], [237, 141]], flip: -1, size: 1.2, leafLength: 54, leafWidth: .23, opacity: 1, color: '#566749', light: '#89976c', shadow: '#374d35', sway: 4.2, speed: .58, phase: 1.7 },
      { x: -26, y: 170, points: [[0, 0], [42, 4], [100, 65], [164, 92]], size: 1, leafLength: 44, leafWidth: .23, opacity: 1, color: '#3e563c', light: '#70845a', shadow: '#293e2a', sway: 5, speed: .76, phase: 3.1 },
    ],
    // Seven-branch layout tuned in the local scene editor.
    frondLayout: {
      version: 2, sceneId: 'revival-season',
      items: [
        { id: 'branch-1', template: 0, x: 0, y: 0, scale: 1, rotation: 0, flip: 1 },
        { id: 'branch-2', template: 1, x: 29.703864310549648, y: 51.59083935898275, scale: 1, rotation: 0, flip: 1 },
        { id: 'branch-3', template: 2, x: -32, y: -70.35114458043103, scale: 1.34, rotation: 24, flip: 1 },
        { id: 'branch-5', template: 0, x: -110.08, y: 373.3053413753446, scale: 1, rotation: 0, flip: 1 },
        { id: 'branch-6', template: 1, x: 85.6474233996513, y: 376.43215433209946, scale: 1.09, rotation: -9, flip: 1 },
        { id: 'branch-7', template: 0, x: 132.54811488838686, y: -30.799999999999997, scale: .85, rotation: 18, flip: 1 },
        { id: 'branch-8', template: 1, x: -54.31932155274876, y: -8.82597833824903, scale: .92, rotation: 6, flip: 1 },
      ],
    },
  },
  image: '/boards/revival-season.png',
};
export const BAMBOO_POOL = {
  size: 1024,
  corners: [[286, 265], [736, 265], [818, 782], [232, 782]],
  bench: { first: [220, 860], last: [890, 860] },
  palette: { ally: '#467c70', enemy: '#ab5358', gold: '#c4a768' },
  particles: false,
  lighting: { sky: '#d8ece3', ground: '#2d4538', sun: '#f5f8df', rim: '#9ee3be' },
  ambience: {
    glowColor: '#a9ded0',
    runes: [
      { x: 512, y: 516, rx: 42, ry: 24 },
      { x: 504, y: 245, rx: 28, ry: 18 },
    ],
    ripples: {
      center: [512, 516],
      aspectRatio: 0.52,
      minRadius: 16,
      maxRadius: 185,
      count: 5,
      speed: 0.16,
      color: '#9fe4d2',
      opacity: 0.58,
      width: 1.8,
    },
    pond: {
      outline: [[399, 327], [477, 336], [565, 323], [661, 333], [708, 386], [723, 470], [682, 578], [638, 657], [603, 701], [508, 747], [425, 715], [348, 676], [325, 599], [306, 516], [323, 426], [361, 362]],
      fish: [
        { center: [510, 525], radii: [116, 139], period: 42, phase: .6, direction: 1, size: 1.12, opacity: .88, color: '#e36e37', light: '#ffd099', shadow: '#975039' },
        { center: [510, 525], radii: [103, 128], period: 42, phase: 2.7, direction: 1, size: .94, opacity: .84, color: '#d64d30', light: '#ffbb80', shadow: '#884b3d' },
        { center: [510, 525], radii: [126, 145], period: 42, phase: 4.8, direction: 1, size: .82, opacity: .86, color: '#eb8840', light: '#ffdb9e', shadow: '#a65832' },
      ],
      refraction: { image: '/boards/bamboo-pool.png', strength: 20, speed: .65, opacity: .95 },
      reflection: { color: '#e3fff5', opacity: .34, speed: .6, height: 4, gloss: 22 },
      surface: { color: '#e1fff2', opacity: .2, count: 8, speed: .55 },
    },
    waterFlow: {
      color: '#b8ede0',
      streams: [
        { points: [[360, 410], [440, 428], [560, 412], [650, 425]], width: 1.4, speed: 0.12, opacity: 0.28 },
        { points: [[310, 520], [420, 540], [590, 510], [710, 530]], width: 1.6, speed: 0.09, opacity: 0.26 },
        { points: [[350, 620], [450, 642], [570, 615], [670, 630]], width: 1.3, speed: 0.13, opacity: 0.24 },
        { points: [[400, 710], [480, 725], [550, 705], [620, 718]], width: 1.2, speed: 0.10, opacity: 0.22 },
      ],
    },
    bamboos: [
      {
        root: [50, 710], height: 710, width: 8.5, segments: 7, baseAngle: 1.6, sway: 3.2, speed: 0.52, phase: 0,
        clusters: [
          { node: 2, side: 1, angle: 28, leafCount: 4, leafLength: 52, twigLength: 32 },
          { node: 4, side: -1, angle: -25, leafCount: 4, leafLength: 48, twigLength: 28 },
          { node: 5, side: 1, angle: 32, leafCount: 5, leafLength: 54, twigLength: 36 },
          { node: 6, side: 1, angle: 18, leafCount: 4, leafLength: 46, twigLength: 30 },
        ],
      },
      {
        root: [115, 640], height: 640, width: 7.5, segments: 6, baseAngle: 2.8, sway: 3.8, speed: 0.58, phase: 1.5,
        clusters: [
          { node: 2, side: 1, angle: 35, leafCount: 4, leafLength: 50, twigLength: 34 },
          { node: 3, side: -1, angle: -22, leafCount: 3, leafLength: 44, twigLength: 26 },
          { node: 5, side: 1, angle: 26, leafCount: 5, leafLength: 56, twigLength: 38 },
        ],
      },
      {
        root: [-10, 50], height: 280, width: 5.5, segments: 4, baseAngle: 80, sway: 4.2, speed: 0.65, phase: 2.8,
        clusters: [
          { node: 2, side: 1, angle: 22, leafCount: 4, leafLength: 46, twigLength: 30 },
          { node: 3, side: 1, angle: 34, leafCount: 5, leafLength: 52, twigLength: 35 },
          { node: 4, side: 1, angle: 16, leafCount: 4, leafLength: 44, twigLength: 28 },
        ],
      },
      {
        root: [895, 650], height: 650, width: 8.5, segments: 6, baseAngle: -2.8, sway: 3.5, speed: 0.54, phase: 2.1,
        clusters: [
          { node: 2, side: -1, angle: -30, leafCount: 4, leafLength: 52, twigLength: 34 },
          { node: 4, side: 1, angle: 22, leafCount: 4, leafLength: 46, twigLength: 28 },
          { node: 5, side: -1, angle: -24, leafCount: 5, leafLength: 55, twigLength: 36 },
        ],
      },
      {
        root: [965, 720], height: 720, width: 7.5, segments: 7, baseAngle: -1.2, sway: 3.0, speed: 0.48, phase: 0.8,
        clusters: [
          { node: 3, side: -1, angle: -26, leafCount: 4, leafLength: 48, twigLength: 32 },
          { node: 5, side: -1, angle: -32, leafCount: 5, leafLength: 54, twigLength: 36 },
          { node: 6, side: 1, angle: 20, leafCount: 4, leafLength: 44, twigLength: 26 },
        ],
      },
      {
        root: [1035, 60], height: 280, width: 5.5, segments: 4, baseAngle: -82, sway: 4.0, speed: 0.62, phase: 3.6,
        clusters: [
          { node: 2, side: -1, angle: -22, leafCount: 4, leafLength: 48, twigLength: 30 },
          { node: 3, side: -1, angle: -30, leafCount: 5, leafLength: 52, twigLength: 35 },
          { node: 4, side: -1, angle: -16, leafCount: 4, leafLength: 45, twigLength: 28 },
        ],
      },
    ],
    bambooLayout: { version: 2, sceneId: 'bamboo-pool', items: [
      { id: 'branch-1', template: 0, x: -35.91218174686695, y: 109.4351972841473, scale: 1.76, rotation: 14, flip: 1 },
      { id: 'branch-2', template: 1, x: -106.30837985458736, y: -106.30849167472013, scale: 1, rotation: 8, flip: 1 },
      { id: 'branch-3', template: 2, x: 1.5633349134922696, y: 60.845000191684335, scale: 1.18, rotation: -44, flip: 1 },
      { id: 'branch-4', template: 3, x: 62.534112188543986, y: 118.81517098265908, scale: 1.61, rotation: -14, flip: 1 },
      { id: 'branch-5', template: 4, x: -781.679425973194, y: -170.4060103416416, scale: 1.14, rotation: 30, flip: 1 },
      { id: 'branch-6', template: 5, x: 7.817032391886869, y: 140.70232494330452, scale: 2.16, rotation: 45, flip: 1 },
      { id: 'branch-7', template: 0, x: -35.91218174686695, y: 360.4602754291707, scale: 1.4, rotation: -29, flip: 1 },
    ] },
    landingRipple: { color: '#e0fff2', opacity: .95, radius: 66, minRadius: 10, width: 2.8, aspectRatio: .5, duration: 1.65, delay: .18 },
    fallingLeafStyle: { light: '#4f7947', shadow: '#23432d', edge: '#557b4b', minTilt: .55 },
    fallingLeaves: [
      { start: [120, 160], end: [460, 650], duration: 15, delay: 0, opacity: .92, size: 1.45, phase: 0 },
      { start: [880, 130], end: [560, 610], duration: 17, delay: 6.5, opacity: .88, size: 1.25, phase: 1.4 },
      { start: [180, 80], end: [330, 760], duration: 19, delay: 11, opacity: .8, size: 1.05, phase: 2.5 },
      { start: [950, 230], end: [745, 830], duration: 16, delay: 4, opacity: .96, size: 1.65, phase: 3.2 },
      { start: [65, 370], end: [260, 860], duration: 14, delay: 8, opacity: .94, size: 1.6, phase: 4.6 },
      { start: [780, 75], end: [440, 540], duration: 20, delay: 15, opacity: .76, size: .95, phase: 5.1 },
      { start: [280, 150], end: [610, 710], duration: 18, delay: 5, opacity: .8, size: 1.1, phase: 1.8 },
      { start: [925, 430], end: [690, 895], duration: 15.5, delay: 10, opacity: .94, size: 1.75, phase: 3.8 },
      { start: [80, 245], end: [375, 725], duration: 21, delay: 17, opacity: .86, size: 1.3, phase: 5.8 },
    ],
    veil: { color: '#c5e2d6', opacity: 0.20, points: [[286, 265], [736, 265], [818, 782], [232, 782]] },
    atmosphere: { top: '#e2f0e8', bottom: '#cfe3d7', opacity: 0.08 },
    motes: [
      [330, 480], [680, 420], [420, 620], [600, 650],
      [250, 680], [780, 580], [180, 360], [840, 380],
      [512, 330], [470, 720],
    ],
  },
  image: '/boards/bamboo-pool.png',
};
export const TIDAL_RUINS = {
  size: 1024,
  corners: [[261, 274], [763, 274], [817, 790], [207, 790]],
  bench: { first: [220, 866], last: [814, 866], scale: .62, compactLabels: true },
  palette: { ally: '#4aa8a9', enemy: '#c97972', gold: '#d7b86f' },
  particles: false,
  lighting: { sky: '#bdf5ec', ground: '#163f4c', sun: '#c9fff4', rim: '#55d9d2' },
  ambience: {
    glowColor: '#8ff9ee',
    bubbleStreams: [
      { x: 55, bottom: 646, top: 216, count: 6, radius: 8, duration: 14, drift: 17 },
      { x: 973, bottom: 672, top: 203, count: 7, radius: 9, duration: 16, drift: 15 },
      { x: 284, bottom: 146, top: 12, count: 4, radius: 5, duration: 7, drift: 14 },
      { x: 733, bottom: 145, top: 10, count: 4, radius: 6, duration: 8, drift: 18 },
    ],
    lightShafts: [
      { x: 376, y: -24, width: 62, length: 570, angle: 20, sweep: 12, speed: .36, phase: 0, opacity: .66 },
      { x: 485, y: -32, width: 42, length: 700, angle: 7, sweep: 10, speed: .43, phase: 1.3, opacity: .56 },
      { x: 566, y: -25, width: 58, length: 610, angle: -12, sweep: 13, speed: .32, phase: 2.4, opacity: .62 },
      { x: 660, y: -18, width: 35, length: 440, angle: -25, sweep: 10, speed: .48, phase: 3.7, opacity: .57 },
    ],
    pond: {
      outline: [[185, 18], [802, 18], [783, 152], [246, 154]],
      fish: [
        { center: [472, 87], radii: [192, 36], period: 24, phase: .2, size: .78, color: '#70cfcd', light: '#d7fff0', shadow: '#215a6b', opacity: .92 },
        { center: [484, 83], radii: [185, 32], period: 24, phase: .48, size: .58, color: '#86d7cb', light: '#e5ffee', shadow: '#246474', opacity: .86 },
        { center: [466, 89], radii: [181, 29], period: 24, phase: .76, size: .65, color: '#7dc8cd', light: '#cffaf5', shadow: '#245569', opacity: .9 },
        { center: [520, 87], radii: [205, 42], period: 31, direction: -1, phase: 2.7, size: .82, color: '#c9bd74', light: '#fff0b5', shadow: '#426e6b', opacity: .9 },
        { center: [511, 90], radii: [198, 37], period: 31, direction: -1, phase: 3, size: .58, color: '#b5cc96', light: '#efffd0', shadow: '#396c69', opacity: .85 },
      ],
    },
    runes: [
      { x: 354, y: 354, rx: 58, ry: 34 }, { x: 669, y: 361, rx: 58, ry: 34 },
      { x: 735, y: 665, rx: 58, ry: 34 }, { x: 307, y: 716, rx: 54, ry: 31 },
      { x: 512, y: 513, rx: 48, ry: 29 },
    ],
    orbits: [
      { x: 512, y: 513, rx: 142, ry: 88, speed: .11 },
      { x: 512, y: 513, rx: 218, ry: 132, speed: -.075 },
    ],
    spinners: [
      { x: 354, y: 354, rx: 68, ry: 39, speed: 20, width: 2.8, opacity: .88 },
      { x: 669, y: 361, rx: 69, ry: 40, speed: -18, width: 2.8, opacity: .88 },
      { x: 735, y: 665, rx: 66, ry: 38, speed: 19, width: 2.6, opacity: .82 },
      { x: 307, y: 716, rx: 62, ry: 35, speed: -21, width: 2.6, opacity: .82 },
      { x: 512, y: 513, rx: 175, ry: 103, speed: 8, width: 2.4, opacity: .72, dashes: '95 45 18 36' },
    ],
    runeMotion: { speed: 1.15, scale: .13, opacity: .62, swing: .27 },
    moteMotion: { x: 13, y: 22, speed: 1.25, radius: 3.5, opacity: .48, swing: .34 },
    ripples: { center: [512, 513], aspectRatio: .56, minRadius: 28, maxRadius: 235, count: 5, speed: .13, color: '#a7fff1', opacity: .48, width: 2 },
    waterFlow: {
      color: '#adfff5',
      streams: [
        { points: [[282, 407], [420, 356], [625, 389], [751, 465]], width: 2.6, speed: .15, opacity: .68, dash: '58 22 13 18', flow: 25, driftX: 7, driftY: 6 },
        { points: [[254, 548], [389, 475], [661, 486], [784, 584]], width: 3, speed: .11, opacity: .72, dash: '72 28 18 22', flow: 21, driftX: 9, driftY: 7 },
        { points: [[274, 678], [420, 616], [621, 640], [760, 731]], width: 2.3, speed: .17, opacity: .6, dash: '48 20 10 16', flow: 29, driftX: 6, driftY: 6 },
      ],
    },
    motes: [[66, 299], [104, 525], [151, 444], [902, 299], [870, 523], [942, 655], [432, 143], [592, 118], [514, 214], [336, 228], [700, 221]],
    landingRipple: { color: '#c6fff5', opacity: .95, radius: 72, minRadius: 10, width: 3, aspectRatio: .53, duration: 1.8, delay: .2 },
    veil: { color: '#8ce7df', opacity: .11, points: [[247, 257], [778, 257], [829, 800], [194, 800]] },
    atmosphere: { top: '#a9efe7', bottom: '#5fc9c4', opacity: .07 },
  },
  image: '/boards/tidal-ruins.jpg',
};
export const XUANTIAN_PLATFORM = {
  size: 1024,
  corners: [[242, 285], [783, 285], [846, 792], [178, 792]],
  bench: { first: [223, 857], last: [807, 857], scale: .62, compactLabels: true },
  palette: { ally: '#6aa493', enemy: '#b67c70', gold: '#bd9967' },
  particles: false,
  lighting: { sky: '#e7fff8', ground: '#607870', sun: '#f3fff8', rim: '#9dd8c7' },
  ambience: {
    glowColor: '#c8fff0',
    fogBanks: [
      { x: 493, y: 170, rx: 215, ry: 30, driftX: 110, driftY: 20, speed: .56, phase: .8, opacity: .58 },
      { x: 239, y: 426, rx: 104, ry: 39, driftX: 92, driftY: 30, speed: .88, phase: 0, opacity: .72 },
      { x: 802, y: 426, rx: 108, ry: 40, driftX: 88, driftY: 32, speed: .82, phase: 2.2, opacity: .7 },
      { x: 164, y: 656, rx: 122, ry: 48, driftX: 103, driftY: 29, speed: .72, phase: 1.4, opacity: .75 },
      { x: 859, y: 658, rx: 123, ry: 46, driftX: 105, driftY: 28, speed: .78, phase: 3.6, opacity: .75 },
      { x: 492, y: 751, rx: 198, ry: 30, driftX: 115, driftY: 19, speed: .61, phase: 4.4, opacity: .42 },
    ],
    runes: [
      { x: 512, y: 518, rx: 96, ry: 55 }, { x: 513, y: 80, rx: 78, ry: 63 },
      { x: 169, y: 192, rx: 28, ry: 40 }, { x: 843, y: 499, rx: 27, ry: 22 },
    ],
    orbits: [
      { x: 512, y: 518, rx: 76, ry: 41, speed: .08 },
      { x: 512, y: 518, rx: 115, ry: 61, speed: -.055 },
    ],
    spinners: [
      { x: 512, y: 518, rx: 108, ry: 58, speed: 12, width: 2.6, opacity: .78, dashes: '78 33 16 27' },
      { x: 512, y: 518, rx: 151, ry: 81, speed: -8, width: 2, opacity: .58, dashes: '105 48 21 40' },
      { x: 512, y: 80, rx: 86, ry: 68, speed: 9, width: 2.2, opacity: .5, dashes: '70 42 13 35' },
    ],
    runeMotion: { speed: .75, scale: .1, opacity: .54, swing: .23 },
    moteMotion: { x: 18, y: 13, speed: .8, radius: 3, opacity: .4, swing: .3 },
    waterFlow: {
      color: '#effffb',
      streams: [
        { points: [[112, 449], [218, 414], [306, 452], [366, 493]], width: 4.4, speed: .08, opacity: .72, dash: '96 28 30 38', flow: 12, driftX: 18, driftY: 8 },
        { points: [[907, 444], [815, 405], [733, 454], [676, 505]], width: 4.2, speed: .075, opacity: .7, dash: '92 30 28 40', flow: -11, driftX: 18, driftY: 8 },
        { points: [[79, 682], [195, 631], [275, 663], [337, 727]], width: 3.4, speed: .1, opacity: .58, dash: '76 24 22 34', flow: 14, driftX: 15, driftY: 7 },
        { points: [[938, 687], [833, 625], [751, 660], [684, 731]], width: 3.4, speed: .095, opacity: .58, dash: '76 24 22 34', flow: -14, driftX: 15, driftY: 7 },
      ],
    },
    motes: [[219, 178], [310, 134], [410, 101], [612, 102], [717, 139], [803, 183], [344, 333], [674, 333]],
    landingRipple: { color: '#e6fff8', opacity: .92, radius: 66, minRadius: 9, width: 2.5, aspectRatio: .5, duration: 1.7, delay: .18 },
    veil: { color: '#e7f4ee', opacity: .18, points: [[228, 266], [797, 266], [861, 805], [163, 805]] },
    atmosphere: { top: '#eafff8', bottom: '#cfe9df', opacity: .09 },
  },
  image: '/boards/xuantian-platform.jpg',
};
export const GOLDEN_SCALES = {
  size: 1024,
  corners: [[255, 267], [769, 267], [820, 790], [204, 790]],
  bench: { first: [220, 865], last: [809, 865], scale: .62, compactLabels: true },
  palette: { ally: '#337c89', enemy: '#a85f58', gold: '#e4b247' },
  particles: false,
  lighting: { sky: '#ffe0a2', ground: '#4b3428', sun: '#ffe6a7', rim: '#63d8e4' },
  ambience: {
    glowColor: '#ffd363',
    localGlowArtwork: '/boards/golden-scales.jpg',
    localGlows: [
      { x: 179, y: 286, rx: 34, ry: 35, color: '#66efff', speed: 1.35, phase: 0 },
      { x: 868, y: 287, rx: 34, ry: 35, color: '#66efff', speed: 1.35, phase: .6 },
      { x: 48, y: 660, rx: 42, ry: 42, color: '#72f4ff', speed: 1.2, phase: 1.8 },
      { x: 983, y: 661, rx: 42, ry: 42, color: '#72f4ff', speed: 1.2, phase: 2.4 },
      { x: 101, y: 728, rx: 50, ry: 49, color: '#8df8ff', speed: 1.15, phase: 3.3 },
      { x: 955, y: 728, rx: 50, ry: 49, color: '#8df8ff', speed: 1.15, phase: 3.9 },
    ],
    fronds: [
      { x: -19, y: -21, points: [[0, 0], [61, 5], [123, 34], [178, 83]], color: '#48533b', light: '#8d8956', shadow: '#202f29', leafLength: 77, leafWidth: .12, leafAngle: 65, leafCount: 13, sway: 5, speed: .85, phase: 0, opacity: .98 },
      { x: -14, y: 12, points: [[0, 0], [28, 53], [39, 111], [62, 171]], color: '#414d34', light: '#7b7f50', shadow: '#202e28', leafLength: 68, leafWidth: .12, leafAngle: 63, leafCount: 12, sway: 4, speed: .72, phase: 1.5, opacity: .98 },
      { x: 1043, y: -21, flip: -1, points: [[0, 0], [61, 5], [123, 34], [178, 83]], color: '#48533b', light: '#8d8956', shadow: '#202f29', leafLength: 77, leafWidth: .12, leafAngle: 65, leafCount: 13, sway: 5, speed: .78, phase: 2, opacity: .98 },
      { x: 1038, y: 12, flip: -1, points: [[0, 0], [28, 53], [39, 111], [62, 171]], color: '#414d34', light: '#7b7f50', shadow: '#202e28', leafLength: 68, leafWidth: .12, leafAngle: 63, leafCount: 12, sway: 4, speed: .83, phase: 3.1, opacity: .98 },
    ],
    runes: [
      { x: 512, y: 82, rx: 92, ry: 78 }, { x: 512, y: 514, rx: 112, ry: 62 },
      { x: 165, y: 318, rx: 29, ry: 33 }, { x: 855, y: 314, rx: 29, ry: 33 },
      { x: 110, y: 691, rx: 31, ry: 34 }, { x: 907, y: 688, rx: 31, ry: 34 },
    ],
    orbits: [
      { x: 512, y: 514, rx: 156, ry: 84, speed: .075 },
      { x: 512, y: 514, rx: 206, ry: 110, speed: -.052 },
    ],
    spinners: [
      { x: 512, y: 82, rx: 100, ry: 78, speed: 16, width: 3, opacity: .82, dashes: '64 27 12 23', pointSize: 4 },
      { x: 512, y: 514, rx: 139, ry: 75, speed: 13, width: 2.8, opacity: .86, dashes: '82 31 16 27' },
      { x: 512, y: 514, rx: 211, ry: 113, speed: -9, width: 2.3, opacity: .67, dashes: '118 46 20 38' },
    ],
    runeMotion: { speed: .95, scale: .12, opacity: .6, swing: .27 },
    moteMotion: { x: 15, y: 25, speed: .9, radius: 3.2, opacity: .46, swing: .33 },
    ripples: { center: [512, 514], aspectRatio: .52, minRadius: 42, maxRadius: 240, count: 4, speed: .09, color: '#ffd86d', opacity: .43, width: 2.2 },
    waterFlow: {
      color: '#ffe19a',
      streams: [
        { points: [[279, 362], [403, 323], [619, 329], [747, 382]], width: 2.4, speed: .08, opacity: .58, dash: '68 23 14 20', flow: 16, driftX: 9, driftY: 5 },
        { points: [[249, 567], [382, 520], [650, 519], [780, 582]], width: 2.8, speed: .07, opacity: .62, dash: '84 29 18 24', flow: 14, driftX: 11, driftY: 6 },
        { points: [[276, 713], [411, 670], [618, 675], [747, 731]], width: 2.1, speed: .09, opacity: .52, dash: '54 21 11 18', flow: 18, driftX: 8, driftY: 5 },
      ],
    },
    motes: [[224, 172], [299, 120], [386, 92], [641, 92], [728, 120], [804, 174], [315, 343], [705, 341], [344, 674], [675, 680]],
    landingRipple: { color: '#ffe7a0', opacity: .92, radius: 68, minRadius: 10, width: 2.7, aspectRatio: .5, duration: 1.75, delay: .2 },
    veil: { color: '#f5d99c', opacity: .13, points: [[241, 248], [783, 248], [834, 805], [190, 805]] },
    atmosphere: { top: '#fbd8a0', bottom: '#d99d57', opacity: .07 },
  },
  image: '/boards/golden-scales.jpg',
};
export const BOARD_SCENES = [
  { id: 'rose-court', name: '玫瑰古堡', artwork: ROSE_COURT },
  { id: 'time-astrolabe', name: '时间星盘 · 异色', artwork: TIME_ASTROLABE },
  { id: 'time-astrolabe-ivory', name: '时间星盘', artwork: TIME_ASTROLABE_IVORY },
  { id: 'revival-season', name: '复苏季节', artwork: REVIVAL_SEASON },
  { id: 'bamboo-pool', name: '竹影潭', artwork: BAMBOO_POOL },
  { id: 'tidal-ruins', name: '潮汐遗迹', artwork: TIDAL_RUINS },
  { id: 'xuantian-platform', name: '玄天道台', artwork: XUANTIAN_PLATFORM },
  { id: 'golden-scales', name: '金砂圣秤', artwork: GOLDEN_SCALES },
  { id: 'garden', name: '庭院', artwork: null },
];
export const DEFAULT_BOARD_SCENE = 'rose-court';
