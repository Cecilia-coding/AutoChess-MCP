import type { CSSProperties } from 'react';

/**
 * Hand-crafted multi-color 12x12 / 14x14 cute pastel pixel sprites.
 * Every sprite uses integer crisp-edge pixel blocks (`shapeRendering="crispEdges"`)
 * so UI icons, packs, cosmetics, and wheel charms never clash with pixel frames.
 */
const PALETTE = {
  '.': null,
  // Outlines & soft inks
  o: '#755f99', // soft wisteria outline
  d: '#4f3d70', // deeper ink detail
  // Creams & whites
  w: '#ffffff',
  c: '#fff7fb', // warm milk cream
  // Sakura / Strawberry pinks
  p: '#ffd6e8',
  P: '#f49ac1',
  R: '#d96b9a',
  // Sky & Ice blues
  s: '#d8f0ff',
  S: '#89c7f0',
  B: '#5395cb',
  // Pistachio mints
  m: '#d5f6e6',
  M: '#7ed1ae',
  G: '#489d7c',
  // Butter & Honey golds
  y: '#fff4be',
  Y: '#f7cf6b',
  O: '#d89b38',
  // Soft lavenders
  l: '#ebe4ff',
  L: '#b9a6eb',
  // Warm peach / terracotta blush
  a: '#ffcfb8',
  A: '#f29b76',
} as const;

type ColorKey = keyof typeof PALETTE;

const SPRITES = {
  fairyCrown: {
    size: 14,
    rows: [
      '......oo......',
      '.oo..oYYo..oo.',
      'oYYo.oYyo.oYYo',
      'oYyo.oYYo.oYyo',
      'oYYooYYYYooYYo',
      'oYYYYPYYPYYYYo',
      'oYYYPPwwPPYYYo',
      'oYYYPPRRPPYYYo',
      'oSYYYYPPYYYYS.',
      '.oYYYYYYYYYYo.',
      '.oOOOOOOOOOOo.',
      '..oooooooooo..',
      '..............',
      '....yy..yy....',
    ],
  },
  ribbonWand: {
    size: 12,
    rows: [
      '......oo....',
      '..oo.oYYo...',
      '.oYYooYyo...',
      '.oYyyyyYYo..',
      '..ooYYYoo...',
      '...oYyo.....',
      '..oPPoo.....',
      '.oPwwP.o....',
      '..oRRoPo....',
      '....oPo.....',
      '...oPo......',
      '..oo........',
    ],
  },
  sakuraHeart: {
    size: 12,
    rows: [
      '............',
      '.ooo....ooo.',
      'oPPPo..oPPPo',
      'oPwwPooPPPPo',
      'oPwPPPPPPPPo',
      'oPPPPPRPPPRo',
      '.oPPPRRRPPo.',
      '..oPPRRPPo..',
      '...oPPPPo...',
      '....oPPo....',
      '.....oo.....',
      '............',
    ],
  },
  starGem: {
    size: 12,
    rows: [
      '.....oo.....',
      '....oYYo....',
      '....oYyo....',
      '.ooooYwoooo.',
      'oYYYYwwYYYYo',
      '.oYYYYYYYYo.',
      '..oYYYYYYo..',
      '..oYYooYYo..',
      '.oYYo..oYYo.',
      '.ooo....ooo.',
      '............',
      '............',
    ],
  },
  tiaraGold: {
    size: 12,
    rows: [
      '............',
      'o...oooo...o',
      'oY..oYYo..Yo',
      'oYo.oYyo.oYo',
      'oYYooYYooYYo',
      'oYYYPwwPYYYo',
      'oYYYPPRRYYYo',
      '.oYYYYYYYYo.',
      '.oOOOOOOOOo.',
      '..oooooooo..',
      '............',
      '............',
    ],
  },
  tiaraSky: {
    size: 12,
    rows: [
      '............',
      'o...oooo...o',
      'os..oSSo..so',
      'oSo.oSwo.oSo',
      'oSSooSSooSSo',
      'oSSSLwwLSSSo',
      'oSSSLBBSSSLo',
      '.oSSSSSSSSo.',
      '.oBBBBBBBBo.',
      '..oooooooo..',
      '............',
      '............',
    ],
  },
  tiaraRose: {
    size: 12,
    rows: [
      '............',
      'o...oooo...o',
      'op..oPPo..po',
      'oPo.oPwo.oPo',
      'oPPooPPooPPo',
      'oPPPYwwYPPPo',
      'oPPPYRRPPPYo',
      '.oPPPPPPPPo.',
      '.oRRRRRRRRo.',
      '..oooooooo..',
      '............',
      '............',
    ],
  },
  giftPouch: {
    size: 12,
    rows: [
      '..ooo..ooo..',
      '.oPPPoPPPo..',
      '..ooPPPPoo..',
      'oooooooooooo',
      'oPPPoYYoPPPo',
      'oPppoYYoPPPo',
      'oooooooooooo',
      'oPPPoYYoPPPo',
      'oPPPoYYoPPPo',
      'oRRRoOOoRRRo',
      '.oooooooooo.',
      '............',
    ],
  },
  loveMail: {
    size: 12,
    rows: [
      '............',
      '.oooooooooo.',
      'owwwwwwwwww.',
      'owwwPwwPwww.',
      'owwoPRRPoww.',
      'owwwoPPowww.',
      'owwwwPPwwww.',
      'owwllwwllww.',
      'oLLLLLLLLLL.',
      '.oooooooooo.',
      '............',
      '............',
    ],
  },
  bubbleChat: {
    size: 12,
    rows: [
      '.oooooooooo.',
      'osssssssssso',
      'oswwwwwwwwso',
      'oswPowwPowso',
      'oswwwwwwwwso',
      'osssssssssso',
      'oSSSSSSSSSSo',
      '.ooooSSSSoo.',
      '....oSSo....',
      '....ooo.....',
      '............',
      '............',
    ],
  },
  goldCoin: {
    size: 12,
    rows: [
      '...oooooo...',
      '..oYYYYYYo..',
      '.oYYywwyYYo.',
      'oYYyOOOOyYYo',
      'oYYOYYYYOYYo',
      'oYYOYYYYOYYo',
      'oYYOYYYYOYYo',
      'oYYyOOOOyYYo',
      '.oYYYYYYYYo.',
      '..oOOOOOOo..',
      '...oooooo...',
      '............',
    ],
  },
  skyCore: {
    size: 12,
    rows: [
      '....oooo....',
      '...oSSSSo...',
      '..oSwssSSo..',
      '.oSwsPPssSo.',
      'oSssPRRssSSo',
      'oSssPPPPssSo',
      '.oSSssssSSo.',
      '..oSSSSSSo..',
      '...oBBBBo...',
      '....oooo....',
      '............',
      '............',
    ],
  },
  candyPair: {
    size: 12,
    rows: [
      '....ooo.....',
      '...oPPPo....',
      '..oPwwPPo...',
      '..oPPPPPo...',
      '...ooPoo.oo.',
      '.ooo.oo.oMMo',
      'oMMMo..oMwwM',
      'oMwwMo.oMMMo',
      'oMMMMo..ooo.',
      '.oooo.......',
      '............',
      '............',
    ],
  },
  swordCross: {
    size: 12,
    rows: [
      '.oo......oo.',
      'oPPo....oSSo',
      '.oPPo..oSSo.',
      '..oPPooSSo..',
      '...oPPPPo...',
      '..oSSooPPo..',
      '.oYYo..oYYo.',
      'oYoYYooYYoYo',
      '.oo.oYYo.oo.',
      '...oYooYo...',
      '..oo....oo..',
      '............',
    ],
  },
  prismStar: {
    size: 12,
    rows: [
      '.....oo.....',
      '....oSSo....',
      '...oSwwSo...',
      '.oooSSSSooo.',
      'oPPPLLLLMMMo',
      '.ooPPPPPPoo.',
      '..oPPYYPPo..',
      '..oYo..oYo..',
      '.ooo....ooo.',
      '............',
      '............',
      '............',
    ],
  },
  chibiBot: {
    size: 14,
    rows: [
      '......oo......',
      '.....oPPo.....',
      '......oo......',
      '..oooooooooo..',
      '.oLLLLLLLLLLo.',
      'oLLooooooooLLo',
      'oLoSSSSSSSSoLo',
      'oLoSddSSddSoLo',
      'oLoPPPPPPPPoLo',
      'oLLooooooooLLo',
      '.oLssLLLLssLo.',
      '..oooooooooo..',
      '...oLLooLLo...',
      '...ooo..ooo...',
    ],
  },
  warmLantern: {
    size: 14,
    rows: [
      '......oo......',
      '....ooYYoo....',
      '...oOOOOOOo...',
      '..oYYYYYYYYo..',
      '.oYYAAYYAAYYo.',
      'oYYAAyyyyAAYYo',
      'oYYAAyyyyAAYYo',
      '.oYYAAYYAAYYo.',
      '..oYYYYYYYYo..',
      '...oOOOOOOo...',
      '....ooYYoo....',
      '.....oYYo.....',
      '....oYoYYo....',
      '....oo..oo....',
    ],
  },
  eyeSpy: {
    size: 12,
    rows: [
      '............',
      '....oooo....',
      '..ooLLLLoo..',
      '.oLLwwwwLLo.',
      'oLwwddddwwLo',
      'oLwdSSSSdwLo',
      'oLwwddddwwLo',
      '.oLLwwwwLLo.',
      '..ooLLLLoo..',
      '....oooo....',
      '............',
      '............',
    ],
  },
  clover: {
    size: 12,
    rows: [
      '...oo..oo...',
      '..oMMooMMo..',
      '..oMwMMwMo..',
      '.ooMMMMMMoo.',
      'oMMoGGGGooMo',
      'oMwMMMMMMwMo',
      '.oooGGGGooo.',
      '..oMMooMMo..',
      '..ooo..ooo..',
      '.....oGo....',
      '....oGo.....',
      '............',
    ],
  },
  sparkle: {
    size: 12,
    rows: [
      '.....oo.....',
      '.....oo.....',
      '....oYYo....',
      '...oYwwYo...',
      '.oooYwwYooo.',
      'oYYYwwwwYYYo',
      '.oooYwwYooo.',
      '...oYwwYo...',
      '....oYYo....',
      '.....oo.....',
      '.....oo.....',
      '............',
    ],
  },
  bow: {
    size: 12,
    rows: [
      '............',
      '.ooo....ooo.',
      'oPPPo..oPPPo',
      'oPwwPooPwwPo',
      'oPPPPooPPPPo',
      '.oooPPPPooo.',
      '...oPRRPo...',
      '..oPPooPPo..',
      '.oPPo..oPPo.',
      '.ooo....ooo.',
      '............',
      '............',
    ],
  },
  seatEmpty: {
    size: 12,
    rows: [
      '............',
      '..oooooooo..',
      '.oMMMMMMMMo.',
      'oMmmmmmmmmMo',
      'oMmMMmmMMmMo',
      'oMmmmmmmmmMo',
      'oMmmmmmmmmMo',
      '.oMMMMMMMMo.',
      '..oooooooo..',
      '............',
      '............',
      '............',
    ],
  },
  rose: {
    size: 12,
    rows: [
      '...oo..oo...',
      '..oRRoPRRo..',
      '.oRPRRRPRRo.',
      '.oRRPRRPRRo.',
      '..oRRRRRRo..',
      '...ooRRo....',
      '....oGoo....',
      '..ooGMoMo...',
      '..oMMoGo....',
      '...oooGo....',
      '.....oo.....',
      '............',
    ],
  },
  daisy: {
    size: 12,
    rows: [
      '....oooo....',
      '.ooowwwwooo.',
      'owwoYYYYowwo',
      'owwoYwwYowwo',
      '.ooowwwwooo.',
      '....oooo....',
      '.....oGo....',
      '..oooGMo....',
      '..oMMoGo....',
      '...oooGo....',
      '.....oo.....',
      '............',
    ],
  },
  moon: {
    size: 12,
    rows: [
      '....ooooo...',
      '..ooYYYYYo..',
      '.oYYywwYYo..',
      'oYYYo..oo...',
      'oYYYo...y...',
      'oYYYo.......',
      'oYYYYo..yy..',
      '.oYYYYooo...',
      '..ooYYYYYo..',
      '....ooooo...',
      '............',
      '............',
    ],
  },
  bamboo: {
    size: 12,
    rows: [
      '.....ooo....',
      '..oooMGo....',
      '.oMMMoGo.oo.',
      '..oooMGoMMMo',
      '....oGoooo..',
      '....oMMo....',
      '....oGGo....',
      '....oMMo....',
      '....oGGo....',
      '....oMMo....',
      '....ooo.....',
      '............',
    ],
  },
  flower: {
    size: 12,
    rows: [
      '....oooo....',
      '...oPPPPo...',
      '.oooPwwPooo.',
      'oPPPoYYoPPPo',
      'oPPPoYYoPPPo',
      '.oooPPPPooo.',
      '..oPPooPPo..',
      '.oPPo..oPPo.',
      '..oo....oo..',
      '............',
      '............',
      '............',
    ],
  },
  cloud: {
    size: 12,
    rows: [
      '............',
      '....oooo....',
      '..ooWWWWoo..',
      '.oWWWWWWWWo.',
      'oWWccccccWWo',
      'oWccssssscWo',
      '.oooooooooo.',
      '............',
      '..y......y..',
      '............',
      '............',
      '............',
    ],
  },
  bird: {
    size: 12,
    rows: [
      '............',
      '......ooo...',
      '.....oWWWo..',
      '..ooooWdwoY.',
      '.oWWWWWWWoo.',
      'oWWssWWWo...',
      '.ooWWWWo....',
      '..oMGoYo....',
      '...oo.o.....',
      '............',
      '............',
      '............',
    ],
  },
  shell: {
    size: 12,
    rows: [
      '....oooo....',
      '..ooPPPPoo..',
      '.oPPwPPwPPo.',
      'oPPwPPPPwPPo',
      'oPPwPwwPwPPo',
      'oPPPPwwPPPPo',
      '.oPPRRRRPPo.',
      '..oooPPooo..',
      '.....oo.....',
      '............',
      '............',
      '............',
    ],
  },
  peach: {
    size: 12,
    rows: [
      '.....ooo....',
      '....oMMMo...',
      '..oo.oGoo...',
      '.oPPooPPPo..',
      'oPwwPPPPPPo.',
      'oPwPPPPaaPo.',
      'oPPPPaaaaPo.',
      '.oPPPPPPPo..',
      '..ooPPPoo...',
      '....ooo.....',
      '............',
      '............',
    ],
  },
  bell: {
    size: 12,
    rows: [
      '.....oo.....',
      '....oYYo....',
      '...oYwwYo...',
      '..oYYYYYYo..',
      '..oYYYYYYo..',
      '.oYYYYYYYYo.',
      '.oYYYYYYYYo.',
      'oOOOOOOOOOOo',
      '.ooooYYoooo.',
      '.....oo.....',
      '............',
      '............',
    ],
  },
  ticket: {
    size: 12,
    rows: [
      '............',
      '.oooooooooo.',
      'oYYYYYYYYYYo',
      'oYPPoYYoPPYo',
      '.oPPoYYoPPo.',
      'oYPPoYYoPPYo',
      'oYYYYYYYYYYo',
      '.oooooooooo.',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  leaf: {
    size: 12,
    rows: [
      '......ooo...',
      '....ooMMMo..',
      '...oMMwMMo..',
      '..oMMGMGMo..',
      '.oMMGGMMo...',
      '.oMGMoMo....',
      '..oGo.......',
      '.oGo........',
      '.oo.........',
      '............',
      '............',
      '............',
    ],
  },
  rabbit: {
    size: 12,
    rows: [
      '......ddd...',
      '.....dwwwd..',
      '.ddd.dwppwd.',
      'dwwwddwwwwd.',
      'dwBwwdwwwwd.',
      'dwwdwwwwwwd.',
      'dwwdwdwwwdw.',
      'dwwdwpwPwpwd',
      '.ddd.dwwwwd.',
      '....dSSBBSSd',
      '....dBBBBBBd',
      '.....dddddd.',
    ],
  },
  craftTome: {
    size: 12,
    rows: [
      '.......ooo..',
      '..ooooowwwo.',
      '.oLLLooSBo..',
      '.oLllLoSBo..',
      '.oLllOoYYo..',
      '.oLllLoo....',
      '.oLllLoYYo..',
      '.oLLLLoo....',
      '.oOOOOOOo...',
      '.oooooooo...',
      '............',
      '............',
    ],
  },
} as const;

export type PixelSpriteName = keyof typeof SPRITES;

export function PixelSprite({
  name,
  size = 16,
  className = '',
  style,
}: {
  name: PixelSpriteName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const sprite = SPRITES[name];
  return (
    <svg
      className={`pixel-sprite ${className}`.trim()}
      width={size}
      height={size}
      viewBox={`0 0 ${sprite.size} ${sprite.size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={style}
    >
      {sprite.rows.flatMap((row, y) =>
        [...row].map((cell, x) => {
          const fill = PALETTE[cell as ColorKey] ?? (cell === 'W' ? '#ffffff' : null);
          return fill ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} /> : null;
        }),
      )}
    </svg>
  );
}

export function modeSpriteName(modeId: string): PixelSpriteName {
  if (modeId === 'duel') return 'swordCross';
  return 'prismStar';
}

export function packSpriteName(packId: string): PixelSpriteName {
  if (packId === 'jianghu') return 'warmLantern';
  if (packId.startsWith('custom:')) return 'craftTome';
  return 'chibiBot';
}

export function cosmeticSpriteName(cosmeticId: string): PixelSpriteName {
  if (cosmeticId.includes('rose')) return 'rose';
  if (cosmeticId.includes('coral') || cosmeticId.includes('lagoon')) return 'shell';
  if (cosmeticId.includes('wisteria')) return 'flower';
  if (cosmeticId.includes('embroidery')) return 'bow';
  if (cosmeticId.includes('wonderland') || cosmeticId.includes('rabbit')) return 'rabbit';
  if (cosmeticId.includes('carousel')) return 'ticket';
  if (cosmeticId.includes('lotus')) return 'sakuraHeart';
  if (cosmeticId.includes('revival')) return 'daisy';
  if (cosmeticId.includes('astrolabe-ivory')) return 'starGem';
  if (cosmeticId.includes('astrolabe')) return 'moon';
  if (cosmeticId.includes('bamboo')) return 'bamboo';
  if (cosmeticId.includes('lantern')) return 'warmLantern';
  if (cosmeticId.includes('olive')) return 'bird';
  if (cosmeticId.includes('ivy')) return 'leaf';
  return 'sparkle';
}

export function echoKindSpriteName(kind: string): PixelSpriteName {
  if (kind === 'gift' || kind === 'wheel_gift') return 'giftPouch';
  if (kind === 'prize' || kind === 'wheel') return 'candyPair';
  if (kind === 'match' || kind === 'win') return 'tiaraGold';
  return 'sakuraHeart';
}
