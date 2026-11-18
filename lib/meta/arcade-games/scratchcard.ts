/**
 * 游乐摊功能包 #2 · 九宫刮刮乐 (Scratchcard)
 * 档位权重与倍率由 `lib/meta/game-config.ts` 驱动。
 */
import { weightedPick, type ArcadeGameMeta, type ArcadeGameOutcome, type ArcadeGamePlugin, type Weighted } from '../arcade';
import { getGameConfig, onGameConfigChange, type ScratchTierConfig } from '../game-config';

export type ScratchSymbolId = 'crown' | 'gem' | 'lantern' | 'peach' | 'fan' | 'coin';

export const SCRATCH_SYMBOLS: readonly { id: ScratchSymbolId; name: string; glyph: string }[] = [
  { id: 'crown', name: '金冠', glyph: '👑' },
  { id: 'gem', name: '星钻', glyph: '💎' },
  { id: 'lantern', name: '红灯', glyph: '🏮' },
  { id: 'peach', name: '仙桃', glyph: '🍑' },
  { id: 'fan', name: '折扇', glyph: '🪭' },
  { id: 'coin', name: '通宝', glyph: '🪙' },
] as const;

export type ScratchCell = {
  symbol: ScratchSymbolId | 'double';
  factor: number;
  matched: boolean;
  isDouble: boolean;
};

export type ScratchCardDetail = {
  luckySymbol: ScratchSymbolId;
  cells: ScratchCell[];
  matchedCount: number;
  hasDouble: boolean;
};

type ScratchTierId = ScratchTierConfig['id'];
type ScratchTierSpec = ScratchTierConfig & { tier: ArcadeGameOutcome['tier'] };

const TIER_MAP: Record<ScratchTierId, ArcadeGameOutcome['tier']> = {
  bust: 'bust',
  small: 'win',
  double: 'big',
  crit: 'big',
  mega: 'mega',
  jackpot: 'jackpot',
};

export const SCRATCH_TIERS: ScratchTierSpec[] = [];

function syncScratchTiers() {
  const next = getGameConfig().odds.scratchTiers.map(t => ({ ...t, tier: TIER_MAP[t.id] }));
  SCRATCH_TIERS.splice(0, SCRATCH_TIERS.length, ...next);
}
syncScratchTiers();
onGameConfigChange(syncScratchTiers);

function pickIndex(len: number, random: () => number): number {
  return Math.min(len - 1, Math.floor(random() * len));
}

function shuffledPositions(random: () => number): number[] {
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1, random);
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices;
}

function buildCells(tier: ScratchTierSpec, lucky: ScratchSymbolId, random: () => number): ScratchCardDetail {
  const decoys = SCRATCH_SYMBOLS.filter(s => s.id !== lucky).map(s => s.id);
  const decoyFactors = [1, 1.5, 2.5, 5, 10, 20];
  const cells: ScratchCell[] = Array.from({ length: 9 }, () => ({
    symbol: decoys[pickIndex(decoys.length, random)]!,
    factor: decoyFactors[pickIndex(decoyFactors.length, random)]!,
    matched: false,
    isDouble: false,
  }));

  const order = shuffledPositions(random);
  let matchedCount = 0;
  let hasDouble = false;

  if (tier.id === 'small') {
    cells[order[0]!] = { symbol: lucky, factor: tier.multiplier, matched: true, isDouble: false };
    matchedCount = 1;
  } else if (tier.id === 'double') {
    cells[order[0]!] = { symbol: lucky, factor: tier.multiplier, matched: true, isDouble: false };
    cells[order[1]!] = { symbol: lucky, factor: 1, matched: true, isDouble: false };
    matchedCount = 2;
  } else if (tier.id === 'crit') {
    cells[order[0]!] = { symbol: lucky, factor: tier.multiplier, matched: true, isDouble: false };
    cells[order[1]!] = { symbol: 'double', factor: 2, matched: true, isDouble: true };
    matchedCount = 2;
    hasDouble = true;
  } else if (tier.id === 'mega') {
    cells[order[0]!] = { symbol: lucky, factor: tier.multiplier, matched: true, isDouble: false };
    cells[order[1]!] = { symbol: lucky, factor: 3, matched: true, isDouble: false };
    cells[order[2]!] = { symbol: lucky, factor: 2, matched: true, isDouble: false };
    matchedCount = 3;
  } else if (tier.id === 'jackpot') {
    cells[order[0]!] = { symbol: lucky, factor: 5, matched: true, isDouble: false };
    cells[order[1]!] = { symbol: lucky, factor: 3, matched: true, isDouble: false };
    cells[order[2]!] = { symbol: lucky, factor: 2, matched: true, isDouble: false };
    cells[order[3]!] = { symbol: 'double', factor: 2, matched: true, isDouble: true };
    matchedCount = 4;
    hasDouble = true;
  }

  return { luckySymbol: lucky, cells, matchedCount, hasDouble };
}

export const scratchcardGame: ArcadeGamePlugin = {
  get meta(): ArcadeGameMeta {
    const tiers = new Map(SCRATCH_TIERS.map(t => [t.id, t]));
    const jackpot = tiers.get('jackpot')!;
    const mega = tiers.get('mega')!;
    const crit = tiers.get('crit')!;
    const dbl = tiers.get('double')!;
    const small = tiers.get('small')!;
    return {
      id: 'scratchcard',
      name: '九宫刮刮乐',
      subtitle: '划开银膜 · 对幸运符与 ×2 倍签',
      badge: `最高 ${jackpot.multiplier}×`,
      tagline: '九宫寻找幸运符与 ×2 翻倍卡，中奖可当场搏倍！',
      paytable: [
        { combo: '三幸运符 + ×2 金签', payout: `${jackpot.multiplier}× + 限定外观`, note: jackpot.name },
        { combo: '三幸运符', payout: `${mega.multiplier}× + 高概率外观`, note: mega.name },
        { combo: '幸运符 + ×2 倍签', payout: `${crit.multiplier}× + 中概率外观`, note: crit.name },
        { combo: '双幸运符 / 单幸运符', payout: `${dbl.multiplier}× / ${small.multiplier}×`, note: '小赢一笔' },
        { combo: '全盘未对中', payout: '0×（谢谢惠顾）', note: '差一格更刺激' },
      ],
    };
  },
  play({ random }) {
    const weights: Weighted<ScratchTierSpec>[] = SCRATCH_TIERS.map(t => ({ value: t, weight: t.weight }));
    const tier = weightedPick(weights, random);
    const lucky = SCRATCH_SYMBOLS[pickIndex(SCRATCH_SYMBOLS.length, random)]!.id;
    const detail = buildCells(tier, lucky, random);
    return {
      code: tier.id,
      label: tier.label,
      tier: tier.tier,
      won: tier.multiplier > 0,
      multiplier: tier.multiplier,
      cosmeticBaseChance: tier.cosmeticBaseChance,
      detail,
    };
  },
};
