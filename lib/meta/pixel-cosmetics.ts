const CACHE_LIMIT = 400;
const avatarCache = new Map<string, string>();
const frameCache = new Map<string, string>();
const frameCardCache = new Map<string, string>();

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function memoGetOrPut(cache: Map<string, string>, key: string, build: () => string): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = build();
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
}

class PixelCanvas {
  private readonly grid: (string | null)[][];
  constructor(readonly width: number, readonly height: number) {
    this.grid = Array.from({ length: height }, () => Array<string | null>(width).fill(null));
  }

  px(x: number, y: number, color: string | null) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.grid[y]![x] = color;
  }

  rect(x: number, y: number, w: number, h: number, color: string | null) {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        this.px(x + dx, y + dy, color);
      }
    }
  }

  plotMask(ox: number, oy: number, rows: readonly string[], palette: Record<string, string>) {
    for (let y = 0; y < rows.length; y += 1) {
      const row = rows[y]!;
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x]!;
        if (ch !== '.' && palette[ch]) this.px(ox + x, oy + y, palette[ch]!);
      }
    }
  }

  toSvg(): string {
    const rects: string[] = [];
    for (let y = 0; y < this.height; y += 1) {
      let x = 0;
      const row = this.grid[y]!;
      while (x < this.width) {
        const col = row[x];
        if (!col) {
          x += 1;
          continue;
        }
        let run = 1;
        while (x + run < this.width && row[x + run] === col) run += 1;
        rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${col}"/>`);
        x += run;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
  }
}

/** Living-canvas skins ship previews rendered from the real scene painter. */
const SCENE_PREVIEWS = new Set([
  'skin-lotus-pond',
  'skin-coral-lagoon',
  'skin-wisteria-brook',
  'skin-embroidery-hoop',
  'skin-sunset-cloudsea',
  'skin-carousel-night',
  'skin-revival',
  'skin-rose-court',
  'skin-time-astrolabe-ivory',
  'skin-time-astrolabe',
  'skin-bamboo',
]);

/** Public path for the 16-bit board skin preview PNG. */
export function pixelBoardPreviewPath(boardId: string): string {
  return SCENE_PREVIEWS.has(boardId) ? `/pixel-scenes/${boardId}.png` : `/pixel-cosmetics/boards/${boardId}.png`;
}

type AvatarPalette = {
  outer: string;
  bgDark: string;
  bgLight: string;
  rim: string;
  crest: string;
  accent: string;
  spark: string;
};

const AVATAR_PALETTES: readonly AvatarPalette[] = [
  { outer: '#3a2d4a', bgDark: '#4f3b66', bgLight: '#735a8f', rim: '#c4b1db', crest: '#fbe8aa', accent: '#f29eb9', spark: '#ffffff' },
  { outer: '#274237', bgDark: '#365c4d', bgLight: '#538570', rim: '#a5cfb8', crest: '#f5f0cf', accent: '#9be0b0', spark: '#ffffff' },
  { outer: '#223354', bgDark: '#304975', bgLight: '#4f71ab', rim: '#a6c4eb', crest: '#fae28a', accent: '#8cc9fa', spark: '#ffffff' },
  { outer: '#4a2639', bgDark: '#6b3851', bgLight: '#995776', rim: '#deb2c7', crest: '#fff0f5', accent: '#f59ab8', spark: '#fae07a' },
  { outer: '#4a3520', bgDark: '#6e4f2f', bgLight: '#9c7346', rim: '#dfc296', crest: '#ffe89e', accent: '#f7b35e', spark: '#ffffff' },
  { outer: '#244247', bgDark: '#325d63', bgLight: '#4e888f', rim: '#a5d4d6', crest: '#fff5dc', accent: '#9ae6db', spark: '#ffffff' },
  { outer: '#3b2429', bgDark: '#59333c', bgLight: '#854e5a', rim: '#d9a9b2', crest: '#fae08c', accent: '#eb6c83', spark: '#fff2f4' },
  { outer: '#2d3b26', bgDark: '#455939', bgLight: '#6c8759', rim: '#c4d9ac', crest: '#fffbe6', accent: '#c9e87d', spark: '#ffffff' },
];

const AVATAR_CRESTS: readonly (readonly string[])[] = [
  // Crown / diamond tiara (8x8)
  [
    '.a....a.',
    '.c.cc.c.',
    'c.cccc.c',
    'cccccccc',
    'ccassacc',
    'cccccccc',
    '.cccccc.',
    '........',
  ],
  // 4-point star gem (8x8)
  [
    '...cs...',
    '...cc...',
    '.a.cc.a.',
    'cccaaccc',
    'cccaaccc',
    '.a.cc.a.',
    '...cc...',
    '...cs...',
  ],
  // Four-leaf clover (8x8)
  [
    '.cc..cc.',
    'cacc.cca',
    '.cccccc.',
    '..caac..',
    '.cccccc.',
    'cca..ccs',
    '.cc..cc.',
    '...cc...',
  ],
  // Crescent moon & star (8x8)
  [
    '..ccc...',
    '.ccss...',
    'cc....a.',
    'cc...asa',
    'cc....a.',
    '.cc.....',
    '..ccccc.',
    '...ccc..',
  ],
  // Heraldic rose / blossom (8x8)
  [
    '..a..a..',
    '.ccsscc.',
    'cca..acc',
    'caaccaac',
    'cca..acc',
    '.cccccc.',
    '..a..a..',
    '........',
  ],
  // Sunburst lantern gem (8x8)
  [
    '...cs...',
    '.a.cc.a.',
    '..cccc..',
    'ccsaaccc',
    'cccaascc',
    '..cccc..',
    '.a.cc.a.',
    '...cc...',
  ],
];

/** Deterministic 16-bit pixel heraldry avatar (20x20 crispEdges SVG data URL). */
export function pixelDefaultAvatarSvg(seed: string): string {
  const key = seed || 'anon';
  return memoGetOrPut(avatarCache, key, () => {
    const h = hashSeed(key);
    const pal = AVATAR_PALETTES[h % AVATAR_PALETTES.length]!;
    const crest = AVATAR_CRESTS[(h >>> 4) % AVATAR_CRESTS.length]!;
    const mirrorSpark = ((h >>> 8) & 1) === 1;
    const c = new PixelCanvas(20, 20);

    // Base square tile with subtle 2px pixel bevel + pixel filigree background
    c.rect(0, 0, 20, 20, pal.bgDark);
    c.rect(1, 1, 18, 18, pal.bgLight);
    c.rect(0, 0, 20, 1, pal.outer);
    c.rect(0, 19, 20, 1, pal.outer);
    c.rect(0, 0, 1, 20, pal.outer);
    c.rect(19, 0, 1, 20, pal.outer);
    c.rect(2, 2, 16, 16, pal.bgDark);
    c.rect(2, 2, 16, 1, pal.rim);
    c.rect(2, 2, 1, 16, pal.rim);

    // Inner diamond checker tint
    for (let y = 4; y <= 15; y += 1) {
      for (let x = 4; x <= 15; x += 1) {
        if ((x + y) % 2 === 0 && Math.abs(x - 9.5) + Math.abs(y - 9.5) <= 6) {
          c.px(x, y, pal.bgLight);
        }
      }
    }

    // Center pixel emblem (8x8 placed at 6,6)
    c.plotMask(6, 6, crest, { c: pal.crest, a: pal.accent, s: pal.spark });

    // Corner pixel studs (varied slightly by hash for individuality)
    const stud = mirrorSpark ? pal.accent : pal.crest;
    c.px(3, 3, stud);
    c.px(16, 3, stud);
    c.px(3, 16, stud);
    c.px(16, 16, stud);
    return svgUrl(c.toSvg());
  });
}

type RetiredFrameTheme = {
  outer: string;
  mid: string;
  light: string;
  inner: string;
  accent: string;
  spark: string;
};

const RETIRED_FRAMES: Record<string, RetiredFrameTheme> = {
  'frame-ring': {
    outer: '#4a3d59',
    mid: '#a693bd',
    light: '#ebe2f5',
    inner: '#6e5c82',
    accent: '#9c527a',
    spark: '#ffffff',
  },
  'frame-peach': {
    outer: '#5e283e',
    mid: '#ba6888',
    light: '#fce8ef',
    inner: '#7a3852',
    accent: '#f29eb9',
    spark: '#fae07a',
  },
  'frame-jade': {
    outer: '#1f3d31',
    mid: '#4b856b',
    light: '#d8f0e4',
    inner: '#2d5443',
    accent: '#e3b554',
    spark: '#fff5d6',
  },
  'frame-crown': {
    outer: '#523814',
    mid: '#c49645',
    light: '#fff0bd',
    inner: '#755320',
    accent: '#d9486b',
    spark: '#ffffff',
  },
};

function drawRetiredFrameToCanvas(frameId: string): PixelCanvas {
  const theme = RETIRED_FRAMES[frameId] ?? RETIRED_FRAMES['frame-ring']!;
  const c = new PixelCanvas(32, 32);

  // Octagonal crisp 4px pixel frame (inner transparent aperture [4..27] = 24x24)
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const topOrBottom = y === 0 || y === 31;
      const leftOrRight = x === 0 || x === 31;
      const chamfer =
        (x < 2 && y < 2) ||
        (x > 29 && y < 2) ||
        (x < 2 && y > 29) ||
        (x > 29 && y > 29);
      if (chamfer) continue;

      const insideAperture = x >= 4 && x <= 27 && y >= 4 && y <= 27;
      if (insideAperture) continue;

      if (x === 3 && (y >= 4 && y <= 27)) {
        c.px(x, y, theme.inner);
      } else if (x === 28 && (y >= 4 && y <= 27)) {
        c.px(x, y, theme.inner);
      } else if (y === 3 && (x >= 3 && x <= 28)) {
        c.px(x, y, theme.inner);
      } else if (y === 28 && (x >= 3 && x <= 28)) {
        c.px(x, y, theme.inner);
      } else if (topOrBottom || leftOrRight || ((x === 2 || x === 29) && (y === 1 || y === 30)) || ((x === 1 || x === 30) && (y === 2 || y === 29))) {
        c.px(x, y, theme.outer);
      } else if (x === 1 || y === 1) {
        c.px(x, y, theme.light);
      } else {
        c.px(x, y, theme.mid);
      }
    }
  }

  // Signature corner & top pixel ornaments
  if (frameId === 'frame-crown') {
    c.plotMask(11, 0, [
      '.s..s..s.',
      'lcllcllcl',
      '.lllllll.',
    ], { l: theme.light, s: theme.spark, c: theme.accent });
    c.rect(14, 29, 4, 2, theme.accent);
    c.px(15, 29, theme.spark);
    c.rect(2, 2, 2, 2, theme.light);
    c.rect(28, 2, 2, 2, theme.light);
    c.rect(2, 28, 2, 2, theme.light);
    c.rect(28, 28, 2, 2, theme.light);
  } else if (frameId === 'frame-jade') {
    for (const [cx, cy] of [[2, 2], [27, 2], [2, 27], [27, 27]] as const) {
      c.rect(cx, cy, 3, 3, theme.outer);
      c.rect(cx + 1, cy + 1, 2, 2, theme.accent);
      c.px(cx + 1, cy + 1, theme.spark);
    }
    c.rect(15, 1, 2, 2, theme.accent);
    c.rect(15, 29, 2, 2, theme.accent);
  } else if (frameId === 'frame-peach') {
    for (const [cx, cy] of [[1, 1], [27, 1], [1, 27], [27, 27]] as const) {
      c.px(cx + 1, cy, theme.accent);
      c.px(cx, cy + 1, theme.accent);
      c.px(cx + 2, cy + 1, theme.accent);
      c.px(cx + 1, cy + 2, theme.accent);
      c.px(cx + 1, cy + 1, theme.spark);
    }
    c.rect(15, 1, 2, 2, theme.light);
  } else {
    for (const [cx, cy] of [[15, 1], [15, 29], [1, 15], [29, 15]] as const) {
      c.rect(cx, cy, 2, 2, theme.accent);
      c.px(cx, cy, theme.spark);
    }
  }
  return c;
}

/** 16-bit crisp pixel SVG for retired avatar frames (32x32 shape-rendering="crispEdges"). */
export function pixelInlineFrameSvg(frameId: string): string {
  const key = frameId in RETIRED_FRAMES ? frameId : 'frame-ring';
  return memoGetOrPut(frameCache, key, () => svgUrl(drawRetiredFrameToCanvas(key).toSvg()));
}

/** 16-bit crisp pixel showcase card preview SVG for frames without dedicated PNG cards. */
export function pixelFrameCardPreviewSvg(frameId: string): string {
  const key = frameId in RETIRED_FRAMES ? frameId : 'frame-ring';
  return memoGetOrPut(frameCardCache, key, () => {
    const theme = RETIRED_FRAMES[key]!;
    const card = new PixelCanvas(48, 36);
    card.rect(0, 0, 48, 36, theme.inner);
    card.rect(1, 1, 46, 34, theme.outer);
    card.rect(2, 2, 44, 32, theme.light);
    for (let y = 3; y < 33; y += 1) {
      for (let x = 3; x < 45; x += 1) {
        if ((x + y) % 4 === 0) card.px(x, y, `${theme.mid}33`);
      }
    }
    // Center mini pixel emblem of the frame itself
    card.plotMask(16, 10, [
      '..oooooooooo..',
      '.oMMMMMMMMMMo.',
      'oML........LMo',
      'oM..........Mo',
      'oM...aaaa...Mo',
      'oM..aasaaa..Mo',
      'oM..aaaaaa..Mo',
      'oM...aaaa...Mo',
      'oM..........Mo',
      'oML........LMo',
      '.oMMMMMMMMMMo.',
      '..oooooooooo..',
    ], {
      o: theme.outer,
      M: theme.mid,
      L: theme.light,
      a: theme.accent,
      s: theme.spark,
    });
    return svgUrl(card.toSvg());
  });
}
