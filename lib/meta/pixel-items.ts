/**
 * Low-saturation macaron pixel-art sprites (16x16 grid -> 64x64 crispEdges SVG)
 * for equipment items and compact player/bot mini-avatars in pixel mode.
 */

export type ItemFamily = "white" | "purple" | "epic" | "orange";

type FrameTheme = {
  border: string;
  bgTop: string;
  bgBot: string;
  shine: string;
};

const RARITY_FRAMES: Record<ItemFamily, FrameTheme> = {
  white: {
    border: "#8d7ea8",
    bgTop: "#fcfafe",
    bgBot: "#ece5f6",
    shine: "#ffffff",
  },
  purple: {
    border: "#8a6bc2",
    bgTop: "#f7f1fe",
    bgBot: "#e3d4f8",
    shine: "#ffffff",
  },
  epic: {
    border: "#c46b92",
    bgTop: "#fef2f7",
    bgBot: "#f5d6e4",
    shine: "#ffffff",
  },
  orange: {
    border: "#c98f38",
    bgTop: "#fffaf0",
    bgBot: "#fae5b8",
    shine: "#ffffff",
  },
};

const svgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Compiles a 16x16 ASCII pixel grid into minimal horizontal run-length `<rect>`s
 * over a beveled macaron rarity plaque.
 */
function compileItemSprite(
  family: ItemFamily,
  rows: readonly string[],
  palette: Record<string, string>,
): string {
  const f = RARITY_FRAMES[family];
  let rects = "";
  for (let y = 0; y < 16; y += 1) {
    const row = rows[y] ?? "";
    let x = 0;
    while (x < 16) {
      const ch = row[x] ?? ".";
      const color = ch === "." || ch === " " ? undefined : palette[ch];
      if (!color) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < 16 && row[end] === ch) end += 1;
      rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`;
      x = end;
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img">` +
    // Rounded-corner pixel bevel card (1px clipped corners for authentic 16-bit icon look)
    `<rect x="1" y="0" width="14" height="16" fill="${f.border}"/>` +
    `<rect x="0" y="1" width="16" height="14" fill="${f.border}"/>` +
    `<rect x="1" y="1" width="14" height="7" fill="${f.bgTop}"/>` +
    `<rect x="1" y="8" width="14" height="7" fill="${f.bgBot}"/>` +
    `<rect x="1" y="1" width="14" height="1" fill="${f.shine}"/>` +
    `<rect x="1" y="1" width="1" height="13" fill="${f.shine}" fill-opacity="0.65"/>` +
    rects +
    `</svg>`;
  return svgDataUrl(svg);
}

const BASE_PALETTE: Record<string, string> = {
  K: "#433458", // Soft dark plum outline (never harsh pure black)
  W: "#ffffff", // Pure specular highlight
  C: "#fff8eb", // Warm cream parchment
  G: "#f2c15a", // Macaron butter-gold
  g: "#d49835", // Shaded honey-gold
  M: "#7fd4b6", // Pastel mint
  m: "#53ab8d", // Shaded sage-mint
  P: "#f29cb8", // Pastel strawberry-rose
  p: "#cc6e8e", // Shaded berry-rose
  L: "#b99ee8", // Pastel lavender
  l: "#8c6ec2", // Shaded taro-purple
  B: "#89c4f0", // Pastel sky-blue
  b: "#5b96c7", // Shaded periwinkle
  O: "#f5ae84", // Pastel peach-coral
  o: "#cf7d53", // Shaded apricot
  S: "#d8d0e5", // Silver-lilac metal
  s: "#a699bd", // Shaded silver
};

type SpriteSpec = {
  family: ItemFamily;
  rows: readonly string[];
};

const AI_ITEM_SPRITES: Record<string, SpriteSpec> = {
  // ── White · Basic ──────────────────────────────────────────
  "ai-key": {
    family: "white",
    rows: [
      "................",
      ".........WW.....",
      "....KKKK..W.....",
      "...KGGGGK.......",
      "..KGWKKWGK......",
      "..KGK..KGK......",
      "..KGWKKWGK......",
      "...KGGGGKK......",
      "....KKKKGGK.....",
      "........KGGK....",
      ".........KGGKK..",
      "..........KGGGK.",
      ".........KKGKGGK",
      ".........KGGKKK.",
      "..........KK....",
      "................",
    ],
  },
  "ai-token-pack": {
    family: "white",
    rows: [
      "................",
      "......KKKK......",
      ".....KGGGGK.....",
      "......KggK......",
      "....KKKKKKKK....",
      "....KmmmmmmK....",
      "...KOOOOOOOOK...",
      "..KOWOOOOOOOoK..",
      "..KOOGGGGGOOoK..",
      "..KOOGWGgGOOoK..",
      "..KOOGGGGGOOoK..",
      "..KOOOOOOOOooK..",
      "...KooooooooK...",
      "....KKKKKKKK....",
      "................",
      "................",
    ],
  },
  "ai-prompt-tpl": {
    family: "white",
    rows: [
      "................",
      "...KKKKKKKKKK...",
      "..KCLLLLLLLLCK..",
      "..KCCCCCCCCCCK..",
      "..KCWLLLLLLCCK..",
      "..KCCCCCCCCCCK..",
      "..KCCmmmmmmCCK..",
      "..KCCCCCCCCCCK..",
      "..KCCPPPPPPCCK..",
      "..KCCCCCCCCCCK..",
      "..KCCBBBBCCCCK..",
      "..KCCCCCCCCGGK..",
      "...KKKKKKKKgGK..",
      "...........KK...",
      "................",
      "................",
    ],
  },
  "ai-book-opensource": {
    family: "white",
    rows: [
      "................",
      "...KKKKKKKKKK...",
      "..KWWMMMMMMMMK..",
      "..KWMmMMMMMMMK..",
      "..KWMmMMWWMMMK..",
      "..KWMmMWKKWMMK..",
      "..KWMmMWMMWMMK..",
      "..KWMmMMWWMMMK..",
      "..KWMmMMMMMMMK..",
      "..KWMmMGGGGMMK..",
      "..KWMmmmmmmmmK..",
      "..KWCCCCCCCCCK..",
      "...KKKKKKKKKK...",
      "......KGGK......",
      ".......KK.......",
      "................",
    ],
  },
  "ai-book-orient": {
    family: "white",
    rows: [
      "................",
      "...KKKKKKKKKK...",
      "..KWWOOOOOOOOK..",
      "..KWOoOOOOOOOK..",
      "..KWOoOOGGOOOK..",
      "..KWOoOGWWGOOK..",
      "..KWOoOGGGGOOK..",
      "..KWOoOOGGOOOK..",
      "..KWOoOOOOOOOK..",
      "..KWOoOPPPPOOK..",
      "..KWoooooooooK..",
      "..KWCCCCCCCCCK..",
      "...KKKKKKKKKK...",
      "......KPPK......",
      ".......KK.......",
      "................",
    ],
  },
  "ai-book-frontier": {
    family: "white",
    rows: [
      "................",
      "...KKKKKKKKKK...",
      "..KWWBBBBBBBBK..",
      "..KWBbBBBBBBBK..",
      "..KWBbBBWWBBBK..",
      "..KWBbBWWWWBBK..",
      "..KWBbBBWWBBBK..",
      "..KWBbBBBBWBBK..",
      "..KWBbBBBBBBBK..",
      "..KWBbBSSSSBBK..",
      "..KWbbbbbbbbbK..",
      "..KWCCCCCCCCCK..",
      "...KKKKKKKKKK...",
      "......KLLK......",
      ".......KK.......",
      "................",
    ],
  },
  "ai-book-showdown": {
    family: "white",
    rows: [
      "................",
      "...KKKKKKKKKK...",
      "..KWWLLLLPPPPK..",
      "..KWLlLLLPPPPK..",
      "..KWLlWLLPPWPK..",
      "..KWLlLWPPWLPK..",
      "..KWLlLLWWLLPK..",
      "..KWLlLWPPWLPK..",
      "..KWLlGLLPPGpK..",
      "..KWLlLLLPPPPK..",
      "..KWllllpppppK..",
      "..KWCCCCCCCCCK..",
      "...KKKKKKKKKK...",
      "......KGGK......",
      ".......KK.......",
      "................",
    ],
  },

  // ── Purple · Advanced ──────────────────────────────────────
  "ai-lora": {
    family: "purple",
    rows: [
      "................",
      "....K.K..K.K....",
      "...KKKKKKKKKK...",
      "..KLLLLLLLLLLK..",
      "..KLWWLLLLLLLK..",
      "..KLKKKKKKKKLK..",
      "..KLKMMGGMMKLK..",
      "..KLKMWGGMMKLK..",
      "..KLKMMGGMMKLK..",
      "..KLKKKKKKKKLK..",
      "..KllllllllllK..",
      "...KKKKKKKKKK...",
      "....KGK..KGK....",
      "....K.K..K.K....",
      "................",
      "................",
    ],
  },
  "ai-kvcache": {
    family: "purple",
    rows: [
      "................",
      "..KKKKKKKKKKK...",
      "..KBBKSSSSKBBK..",
      "..KBBKSSKSSBBK..",
      "..KBBKKKKKKBBK..",
      "..KBBBBBBBBBBK..",
      "..KBBKKKKKKBBK..",
      "..KBBKWWWWKBBK..",
      "..KBBKWMMWKBBK..",
      "..KBBKWWWWKBBK..",
      "..KBBKCCCCKBBK..",
      "..KbbbbbbbbbbK..",
      "..KKKKKKKKKKKK..",
      "................",
      "................",
      "................",
    ],
  },
  "ai-systemprompt": {
    family: "purple",
    rows: [
      "................",
      "....KKKKKKKK....",
      "...KGGGGGGGGK...",
      "..KGWWLLLLMMGK..",
      "..KGWLLLLLMMGK..",
      "..KGLLKKWWMMGK..",
      "..KGLLKGGWMMGK..",
      "..KGMMPGGKLLGK..",
      "..KGMMPPKKLLGK..",
      "...KGMMLLLLGK...",
      "....KGllllGK....",
      ".....KGGGGK.....",
      "......KKKK......",
      "................",
      "................",
      "................",
    ],
  },
  "ai-vision": {
    family: "purple",
    rows: [
      "................",
      "................",
      ".....KKKKKK.....",
      "...KKLLLLLLKK...",
      "..KLCCCCCCCCLK..",
      ".KLCWWBBBBCCCLK.",
      ".KLCWBBKKBBCCLK.",
      ".KLCBBKWWKBBCLK.",
      ".KLCBBKKKKBBCLK.",
      ".KLCCCBBBBCCCLK.",
      "..KLCCCCCCCCLK..",
      "...KKllllllKK...",
      ".....KKKKKK.....",
      "................",
      "................",
      "................",
    ],
  },
  "ai-temperature": {
    family: "purple",
    rows: [
      "................",
      "......KKKK......",
      ".....KCWWCK.....",
      ".....KCWWCK.KK..",
      ".....KCPPCK.....",
      ".....KCPPCK.KK..",
      ".....KCPPCK.....",
      ".....KCPPCK.KK..",
      "....KKPPPPKK....",
      "...KPPWPPPPPK...",
      "...KPPWPPPPpK...",
      "...KPPPPPPppK...",
      "....KKppppKK....",
      "......KKKK......",
      "................",
      "................",
    ],
  },
  "ai-memory": {
    family: "purple",
    rows: [
      "................",
      ".....KKKKKK.....",
      "....KSSSSSSK....",
      ".....KCCCCK.....",
      "...KKKKKKKKKK...",
      "..KCWWPPPPPLCK..",
      "..KCWPPWWPPLCK..",
      "..KCPPPLLPPLCK..",
      "..KCPPLWWLLLCK..",
      "..KCLLLLLLLLCK..",
      "..KCCGGGGGGCCK..",
      "...KCCCCCCCCK...",
      "....KKKKKKKK....",
      "................",
      "................",
      "................",
    ],
  },
  "ai-localdeploy": {
    family: "purple",
    rows: [
      "................",
      ".......KK.......",
      ".....KKMMKK.....",
      "....KMWMMMMK....",
      "...KMMMMMMMMK...",
      "..KmmmmmmmmmmK..",
      "..KKKKKKKKKKKK..",
      "...KCCCCCCCCK...",
      "...KCGGKKMMCK...",
      "...KCGGKKMMCK...",
      "...KCCCCKMMCK...",
      "...KSSSSSSSSK...",
      "...KKKKKKKKKK...",
      "................",
      "................",
      "................",
    ],
  },
  "ai-cot": {
    family: "purple",
    rows: [
      "................",
      "....KKKKKKKK....",
      "..KKWWWWWWWWKK..",
      ".KWWCCCGGCCCCWK.",
      ".KWCCCGWWGCCCWK.",
      ".KWCCCGWWGCCCWK.",
      ".KWCCCCGGCCCCWK.",
      "..KWWCCmmCCWWK..",
      "...KKKKKKKKKK...",
      "....KWWK........",
      ".....KK.........",
      "...KK...........",
      "...K............",
      "................",
      "................",
      "................",
    ],
  },
  "ai-prompt-inject": {
    family: "purple",
    rows: [
      "................",
      "...........KK...",
      "..........KSSK..",
      ".........KSSK...",
      ".......KKSSKK...",
      "......KCCCCK....",
      ".....KCWMMCK....",
      "....KCMMMCK.....",
      "...KCLLMCK......",
      "...KCLLCK.......",
      "..KKCCKK........",
      "..KSSK..........",
      ".KPK............",
      "PP..............",
      "................",
      "................",
    ],
  },
  "ai-429": {
    family: "purple",
    rows: [
      "................",
      ".....KKKKKK.....",
      "....KSSSSSSK....",
      "...KSSKPPKSSK...",
      "...KSSKPPKSSK...",
      "....KSSSSSSK....",
      "...KSSKGGKSSK...",
      "...KSSKGGKSSK...",
      "....KSSSSSSK....",
      "...KSSKMMKSSK...",
      "...KSSKMMKSSK...",
      "....KKKKKKKK....",
      ".......KK.......",
      "......KSSK......",
      ".....KKKKKK.....",
      "................",
    ],
  },

  // ── Epic · Ecosystem ───────────────────────────────────────
  "ai-mcp": {
    family: "epic",
    rows: [
      "................",
      "....KK....KK....",
      "....KGK..KGK....",
      "...KKKKKKKKKK...",
      "..KPPPPPPPPPPK..",
      "..KPWWPPPPPPPK..",
      "..KPPPMMMMPPPK..",
      "..KPPPMWWMPPPK..",
      "...KKppppppKK...",
      ".....KPPPPK.....",
      "......KLLK......",
      "......KLLK..W...",
      ".....KLLLLKWWW..",
      "......KKKK..W...",
      "................",
      "................",
    ],
  },
  "ai-subscription": {
    family: "epic",
    rows: [
      "................",
      "................",
      "..KKKKKKKKKKKK..",
      ".KGGGGGGGGGGGGK.",
      ".KGWWWWWWWWWWGK.",
      ".KKKKKKKKKKKKKK.",
      ".KPPPPPPPPPPPPK.",
      ".KPGGPPPPWWWWPK.",
      ".KPGGPPPPPPPPPK.",
      ".KPPPPPPGGGGPPK.",
      ".KppppppppppppK.",
      "..KKKKKKKKKKKK..",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  "ai-supercluster": {
    family: "epic",
    rows: [
      "................",
      "..KKKKKKKKKKKK..",
      ".KSSSSSSSSSSSSK.",
      ".KSWWMMBBPPPPSK.",
      ".KssssssssssssK.",
      "..KKKKKKKKKKKK..",
      ".KSSSSSSSSSSSSK.",
      ".KSWWMMBBGGGGSK.",
      ".KssssssssssssK.",
      "..KKKKKKKKKKKK..",
      ".KSSSSSSSSSSSSK.",
      ".KSWWMMBBPPPPSK.",
      "..KKKKKKKKKKKK..",
      "....KGK..KGK....",
      "................",
      "................",
    ],
  },
  "ai-rag": {
    family: "epic",
    rows: [
      "................",
      ".......WW.......",
      "...KKKKKKKKKK...",
      "..KWWMMMMMMMMK..",
      "..KWCCCCCCCCCK..",
      "...KKKKKKKKKK...",
      "..KWWPPPPPPPPK..",
      "..KWCCCCCCCCCK..",
      "...KKKKKKKKKK...",
      "..KWWGGGGGGGGK..",
      "..KWCCCCCCCCCK..",
      "...KKKKGGKKKK...",
      ".......GG.......",
      "................",
      "................",
      "................",
    ],
  },

  // ── Orange · Mythic ────────────────────────────────────────
  "ai-jailbreak": {
    family: "orange",
    rows: [
      "................",
      "..WW..KKKK..WW..",
      ".W...KGGGGK...W.",
      "....KGWPPWGK....",
      "...KGGPPPPGGK...",
      "....KGGGGGGK....",
      "..KKK..KGK..KKK.",
      ".KWWK..KGK..KWWK",
      "..KK...KGK...KK.",
      ".......KGGKK....",
      ".......KGKGGK...",
      ".......KGGKK....",
      ".......KGGGK....",
      "........KKK.....",
      "................",
      "................",
    ],
  },
  "ai-sota": {
    family: "orange",
    rows: [
      "................",
      ".......WW.......",
      "..KKKKKKKKKKKK..",
      ".KGKGGGGGGGGKGK.",
      ".KGKGWGGGGGGKGK.",
      ".KGKGWGPPGGGKGK.",
      "..KKGGPPPPGGKK..",
      "...KGGGPPGGGK...",
      "....KggggggK....",
      "......KGGK......",
      "......KggK......",
      "....KKKKKKKK....",
      "...KGGGGGGGGK...",
      "...KKKKKKKKKK...",
      "................",
      "................",
    ],
  },

  // ── Consumables · Permanent Boosts ─────────────────────────
  "ai-tokens-1m": {
    family: "purple",
    rows: [
      "................",
      "......WW........",
      ".....WWWW...W...",
      "......WW...WWW..",
      "....KKKKKK..W...",
      "...KGGGGGGK.....",
      "..KGWGGGGGGKK...",
      "..KGGGGGGWGGGK..",
      ".KKggggGGGGGGGK.",
      ".KLLLLLLLLLLLLK.",
      ".KLLGGGGGGGGLLK.",
      "..KllllllllllK..",
      "...KKKKKKKKKK...",
      "................",
      "................",
      "................",
    ],
  },
  "ai-finetune": {
    family: "epic",
    rows: [
      "................",
      "......KKKK......",
      ".....KOOOOK.....",
      ".....KSSSSK.....",
      "......KCCK......",
      ".....KCCCCK.....",
      "....KCWMMCCK....",
      "...KCMMMMMMCK...",
      "..KCPPPPPPPPCK..",
      "..KCPPWPPPPPCK..",
      "..KCLLLLLLLLCK..",
      "...KLLLLLLLLK...",
      "....KKKKKKKK....",
      "................",
      "................",
      "................",
    ],
  },
};

const GENERIC_FALLBACKS: readonly SpriteSpec[] = [
  // Sword
  {
    family: "white",
    rows: [
      "................",
      "...........KKK..",
      "..........KWWWK.",
      ".........KWSSWK.",
      "........KWSSK...",
      ".......KWSSK....",
      "......KWSSK.....",
      "...KKKWSSK......",
      "...KGGSSK.......",
      "....KGGGK.......",
      "...KOOOKKK......",
      "..KOOOK.........",
      "..KKKK..........",
      "................",
      "................",
      "................",
    ],
  },
  // Crystal Orb
  {
    family: "purple",
    rows: [
      "................",
      ".....KKKKKK.....",
      "...KKLLLLLLKK...",
      "..KLLWWLLLLLLK..",
      "..KLWWWLLLLLLK..",
      "..KLLLLLMMLLLK..",
      "..KLLLLMMMMLLK..",
      "..KLLLLlMMlllK..",
      "...KKllllllKK...",
      "....KKKKKKKK....",
      "...KGGGGGGGGK...",
      "....KKKKKKKK....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  // Crest Shield
  {
    family: "white",
    rows: [
      "................",
      "...KKKKKKKKKK...",
      "..KGGGGGGGGGGK..",
      "..KGWWBBBBMMGK..",
      "..KGWBBBBBMMGK..",
      "..KGBBBBGGGGGK..",
      "..KGBBBGWWWWGK..",
      "...KGBBBGGGGK...",
      "....KGBBMMGK....",
      ".....KGBMGK.....",
      "......KGGK......",
      ".......KK.......",
      "................",
      "................",
      "................",
      "................",
    ],
  },
];

const ITEM_CACHE = new Map<string, string>();

/**
 * Returns a crisp 16x16 macaron pixel-art SVG data URL for AI pack items
 * (and for any item when `forcePixel` is true).
 */
export function pixelItemArt(id: string, forcePixel = false): string | null {
  const key = `${id}:${forcePixel ? 1 : 0}`;
  const cached = ITEM_CACHE.get(key);
  if (cached) return cached;


const JH_PALETTE: Record<string, string> = {
  K: "#2e2433", // Soft dark iron ink outline
  W: "#fffdf8", // Ivory highlight
  C: "#efe6d4", // Warm parchment / straw
  c: "#c4b69e", // Shaded hemp
  A: "#e6b45a", // Lantern amber gold
  a: "#b57e32", // Aged bronze / bamboo dark
  J: "#83b8a6", // Celadon river jade
  j: "#4f8071", // Shaded celadon
  R: "#c76873", // Smoked vermilion rose
  r: "#8c3d47", // Deep seal crimson
  P: "#9c6d89", // Dusk plum
  p: "#69455c", // Deep plum
  B: "#6b7ea6", // Night river indigo
  b: "#455373", // Shaded indigo
  S: "#d5dce6", // Forged steel
  s: "#8d96a6", // Shaded iron
};

const JH_ITEM_SPRITES: Record<string, SpriteSpec> = {
  "jh-travel-lantern": {
    family: "white",
    rows: [
      "................",
      "......KKKK......",
      ".....KaaaaK.....",
      "......KaaK......",
      ".....KaAAaK.....",
      "....KaAWWAaK....",
      "....KaAWWAaK....",
      "....KaAAAAaK....",
      "....KaAAaAaK....",
      ".....KaaaaK.....",
      "......KaaK......",
      "......KRRK......",
      "......KrrK......",
      ".......KK.......",
      "................",
      "................",
    ],
  },
  "jh-wrist-wrap": {
    family: "white",
    rows: [
      "................",
      "................",
      ".....KKKKKK.....",
      "....KBCCCCBK....",
      "...KBBcBBcBBK...",
      "...KBCCCCCCBK...",
      "...KBBcBBcBBK...",
      "...KBBcRRcBBK...",
      "....KBRrrRBK....",
      "....KbCCCCbK....",
      ".....KbRRbK.....",
      ".....KrrrrK.....",
      "......KKKK......",
      "................",
      "................",
      "................",
    ],
  },
  "jh-herb-pouch": {
    family: "white",
    rows: [
      "................",
      "....KKK..KKK....",
      "...KJWK..KJWK...",
      "....KjK..KjK....",
      ".....KKAAKK.....",
      "....KCCCCCCK....",
      "...KJWWWWWWjK...",
      "...KJJJJJJJjK...",
      "..KJJJAAAAJJjK..",
      "..KJJJAaaAJJjK..",
      "...KJJJJJJjjK...",
      "....KjjjjjjK....",
      ".....KKKKKK.....",
      "................",
      "................",
      "................",
    ],
  },
  "jh-rain-cape": {
    family: "purple",
    rows: [
      "................",
      "......KKKK......",
      ".....KBBBBK.....",
      "....KBBWWBBK....",
      "....KbCCCCbK....",
      "...KCccCCccCK...",
      "...KCCaCCaCCK...",
      "..KCccCccCccCK..",
      "..KCCaCCaCCaCK..",
      ".KCccCccCccCccK.",
      ".KccaaacccaaacK.",
      "..KKKKKKKKKKKK..",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  "jh-swallow-darts": {
    family: "purple",
    rows: [
      "................",
      "..KK......KK....",
      ".KSWK....KWSK...",
      ".KSSWK..KWSSK...",
      "..KsSSKKSSsK....",
      "...KsSSSSsK.....",
      "....KKssKK......",
      ".....KssK.......",
      "....KSKKsK......",
      "...KRRK.KRRK....",
      "..KrrK...KrrK...",
      "...KK.....KK....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  "jh-smoke-pellet": {
    family: "purple",
    rows: [
      "................",
      "........WWWW....",
      "......WWCCCCW...",
      ".....WCCCPPPCC..",
      "......WWPPPPcW..",
      ".......WWPPW....",
      ".....KKKWW......",
      "....KPpPK.......",
      "...KPPWWPK......",
      "...KPpBBpK......",
      "...KbbBBbK......",
      "....KbbbK.......",
      ".....KKK........",
      "................",
      "................",
      "................",
    ],
  },
  "jh-escort-banner": {
    family: "epic",
    rows: [
      "................",
      "...KK...........",
      "..KWSK..........",
      "..KaSKKKKKK.....",
      "..KaKRRRRRRK....",
      "..KaKRAAWRRRK...",
      "..KaKRARRRrK....",
      "..KaKRRRRrK.....",
      "..KaKAArrK......",
      "..KaKKKKK.......",
      "..KaK...........",
      "..KaK...........",
      "..KaK...........",
      "..KKK...........",
      "................",
      "................",
    ],
  },
  "jh-tempered-edge": {
    family: "epic",
    rows: [
      "................",
      "..........KKKK..",
      ".........KSWWK..",
      "........KSWWsK..",
      ".......KSWWsK...",
      "......KSWWsK....",
      ".....KSWWsK.....",
      "....KSWWsK......",
      "...KAJKKK.......",
      "..KaaAK.........",
      ".KRRKaK.........",
      ".KrrK...........",
      "..KK............",
      "................",
      "................",
      "................",
    ],
  },
  "jh-calm-breath": {
    family: "epic",
    rows: [
      "................",
      "......KKKK......",
      ".....KRRRRK.....",
      "......KAAK......",
      "....KKJJJJKK....",
      "...KJJWWWWjJK...",
      "..KJJWKKKKJjJK..",
      "..KJJWK..KWjJK..",
      "..KJJjK..KjjJK..",
      "..KjjjKKKKjjjK..",
      "...KjjJJJJjjK...",
      "....KKRRRRKK....",
      ".....KrrrrK.....",
      "......KKKK......",
      "................",
      "................",
    ],
  },
  "jh-meteor-blade": {
    family: "orange",
    rows: [
      "................",
      "..........KKKK..",
      ".........KSBWK..",
      "........KSBBWK..",
      ".......KSWBsWK..",
      "......KSBBssK...",
      ".....KAAAsKK....",
      "....KaAAK.......",
      "...KbaK.........",
      "..KbaK..........",
      ".KbaK...........",
      ".KKK............",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  "jh-ninefold-vest": {
    family: "orange",
    rows: [
      "................",
      "...KKKK..KKKK...",
      "..KAAAaKKaAAAK..",
      ".KAWWAaRRaAWWAK.",
      ".KAAAaRRRRaAAAK.",
      "..KKRAAWWAAaKK..",
      "...KRAAaaAAaK...",
      "...KRRAAAArrK...",
      "...KRAAaaAAaK...",
      "...KRRAAAArrK...",
      "...KaaRRRRaaK...",
      "....KKKKKKKK....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  "jh-cloudstep-boots": {
    family: "orange",
    rows: [
      "................",
      "................",
      "...KKKK..KKKK...",
      "..KAAACK.KAAACK.",
      "..KBBBBK.KBBBBK.",
      "..KBWWBK.KBWWBK.",
      "..KBBBBK.KBBBBK.",
      ".KBBBBBK.KBBBBBK",
      "KWWBBBBK.KWWBBBK",
      "KCCbbbKK.KCCbbbK",
      ".KKKKKK...KKKKKK",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
};
  const spec = AI_ITEM_SPRITES[id];
  if (spec) {
    const built = compileItemSprite(spec.family, spec.rows, BASE_PALETTE);
    ITEM_CACHE.set(key, built);
    return built;
  }
  const jhSpec = JH_ITEM_SPRITES[id];
  if (jhSpec) {
    const built = compileItemSprite(jhSpec.family, jhSpec.rows, JH_PALETTE);
    ITEM_CACHE.set(key, built);
    return built;
  }
  if (!forcePixel) return null;

  const fallback = GENERIC_FALLBACKS[hashSeed(id) % GENERIC_FALLBACKS.length]!;
  const built = compileItemSprite(fallback.family, fallback.rows, BASE_PALETTE);
  ITEM_CACHE.set(key, built);
  return built;
}

// ── Pixel Mini-Avatars (for Left HP Stack & Pixel Matchup Bar) ─────────────

type AvatarPalette = {
  bg: string;
  border: string;
  main: string;
  shade: string;
  accent: string;
};

const HUMAN_THEMES: readonly AvatarPalette[] = [
  { bg: "#eef9f4", border: "#6dc2a3", main: "#95dec2", shade: "#64b396", accent: "#ffd479" },
  { bg: "#f5f0fc", border: "#9b84cc", main: "#c4aef0", shade: "#967cc9", accent: "#f7a6c1" },
  { bg: "#fef2f6", border: "#d485a2", main: "#f5abc4", shade: "#cc7896", accent: "#fff0a6" },
  { bg: "#eef6fd", border: "#7ab0db", main: "#9fd0f5", shade: "#6fa4cf", accent: "#ffd479" },
  { bg: "#fff8eb", border: "#cfa053", main: "#f7cd82", shade: "#cf9e4c", accent: "#95dec2" },
];

const BOT_THEMES: readonly AvatarPalette[] = [
  { bg: "#f1edf9", border: "#9987bf", main: "#cbc0e6", shade: "#9c8ec2", accent: "#88def2" },
  { bg: "#edf6fa", border: "#80aec9", main: "#b5d9ed", shade: "#84afc9", accent: "#96e6c5" },
  { bg: "#fbf0f5", border: "#c78ba6", main: "#ebbcd1", shade: "#bf8aa2", accent: "#ffe08c" },
  { bg: "#f6f2ea", border: "#bfa37a", main: "#e8d2b0", shade: "#bfa47c", accent: "#f59cb8" },
];

const HUMAN_TEMPLATES: readonly (readonly string[])[] = [
  // Cat-ear hoodie commander
  [
    "................",
    "...KK......KK...",
    "..KMMK....KMMK..",
    "..KMPKKKKKKPMK..",
    "..KMMMMMMMMMMK..",
    ".KMMSSSSSSSSMMK.",
    ".KMSCCCCCCCCSMK.",
    ".KMSCKCCCKCCSMK.",
    ".KMSCPCCCCPCSMK.",
    "..KSCCCCCCCCSK..",
    "...KKKKKKKKKK...",
    "...KMMGGGGMMK...",
    "..KMMMMMMMMMMK..",
    "..KmmmmmmmmmmK..",
    "...KKKKKKKKKK...",
    "................",
  ],
  // Star-beret tactician
  [
    "................",
    ".....KKKKKK.....",
    "...KKMMMMMMKK...",
    "..KMMGGMMMMMMK..",
    "..KMMMMMMMMmmK..",
    "...KKKKKKKKKK...",
    "..KCCCCCCCCCCK..",
    "..KCCKCCCCKCCK..",
    "..KCCPCCCCPCCK..",
    "...KCCCCCCCCK...",
    "....KKKKKKKK....",
    "...KMMWWWWMMK...",
    "..KMMMMMMMMMMK..",
    "..KmmmmmmmmmmK..",
    "...KKKKKKKKKK...",
    "................",
  ],
  // Headphones strategist
  [
    "................",
    "....KKKKKKKK....",
    "...KMMMMMMMMK...",
    "..KMMmmmmmmMMK..",
    ".KGGCCCCCCCCGGK.",
    ".KGGCKCCCCKCGGK.",
    ".KGGCPCCCCPCGGK.",
    "..KKCCCCCCCCKK..",
    "....KKKKKKKK....",
    "...KMMMMMMMMK...",
    "..KMMGGGGGGMMK..",
    "..KMMMMMMMMMMK..",
    "..KmmmmmmmmmmK..",
    "...KKKKKKKKKK...",
    "................",
    "................",
  ],
];

const BOT_TEMPLATES: readonly (readonly string[])[] = [
  // Cute CRT antenna bot
  [
    "................",
    ".......KK.......",
    "......KGGK......",
    ".......KK.......",
    "...KKKKKKKKKK...",
    "..KMMMMMMMMMMK..",
    "..KMKKKKKKKKMK..",
    "..KMKGGGGGGKMK..",
    "..KMKGWKKWGKMK..",
    "..KMKGGGGGGKMK..",
    "..KMKKKKKKKKMK..",
    "..KmmmmmmmmmmK..",
    "...KKKKKKKKKK...",
    "....KMMGGMMK....",
    "...KKKKKKKKKK...",
    "................",
  ],
  // Cute twin-ear cyber bot
  [
    "................",
    "..KK........KK..",
    ".KGGK......KGGK.",
    "..KK.KKKKKK.KK..",
    "...KKMMMMMMKK...",
    "..KMMMMMMMMMMK..",
    "..KMKKKKKKKKMK..",
    "..KMKWWKKWWKMK..",
    "..KMKPPKKPPKMK..",
    "..KMKKKKKKKKMK..",
    "...KmmmmmmmmK...",
    "....KKKKKKKK....",
    "...KMMGGGGMMK...",
    "...KKKKKKKKKK...",
    "................",
    "................",
  ],
];

const AVATAR_CACHE = new Map<string, string>();

export function pixelAvatarImage(
  seed: string,
  options: { bot?: boolean; self?: boolean } = {},
): string {
  const key = `${seed}:${options.bot ? 1 : 0}:${options.self ? 1 : 0}`;
  const cached = AVATAR_CACHE.get(key);
  if (cached) return cached;

  const h = hashSeed(seed || "anon");
  const isBot = Boolean(options.bot);
  const theme = isBot
    ? BOT_THEMES[h % BOT_THEMES.length]!
    : options.self
      ? HUMAN_THEMES[0]!
      : HUMAN_THEMES[(h % (HUMAN_THEMES.length - 1)) + 1]!;
  const rows = isBot
    ? BOT_TEMPLATES[h % BOT_TEMPLATES.length]!
    : HUMAN_TEMPLATES[h % HUMAN_TEMPLATES.length]!;

  const map: Record<string, string> = {
    K: "#433458",
    W: "#ffffff",
    C: "#fff3e6",
    P: "#f59cb8",
    M: theme.main,
    m: theme.shade,
    S: theme.shade,
    G: theme.accent,
  };

  let rects = "";
  for (let y = 0; y < 16; y += 1) {
    const row = rows[y] ?? "";
    let x = 0;
    while (x < 16) {
      const ch = row[x] ?? ".";
      const color = ch === "." ? undefined : map[ch];
      if (!color) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < 16 && row[end] === ch) end += 1;
      rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`;
      x = end;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img">` +
    `<rect width="16" height="16" fill="${theme.border}"/>` +
    `<rect x="1" y="1" width="14" height="14" fill="${theme.bg}"/>` +
    `<rect x="1" y="1" width="14" height="1" fill="#ffffff"/>` +
    rects +
    `</svg>`;
  const url = svgDataUrl(svg);
  AVATAR_CACHE.set(key, url);
  return url;
}
