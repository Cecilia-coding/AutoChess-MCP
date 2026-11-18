/**
 * 游乐摊功能包 #1 · 三轴像素老虎机 (Slot Machine)
 * 符号权重与倍率由 `lib/meta/game-config.ts` 驱动。
 */
import { weightedPick, type ArcadeGameMeta, type ArcadeGameOutcome, type ArcadeGamePlugin, type Weighted } from '../arcade';
import { getGameConfig, onGameConfigChange } from '../game-config';

export type SlotSymbolId = 'seven' | 'star' | 'clover' | 'coin' | 'bomb' | 'skull';

export type SlotSymbolSpec = {
  id: SlotSymbolId;
  name: string;
  glyph: string;
  weight: number;
};

export const SLOT_SYMBOLS: SlotSymbolSpec[] = [];

function syncSlotSymbols() {
  const list = getGameConfig().odds.slotSymbols.map(s => ({ ...s }));
  SLOT_SYMBOLS.splice(0, SLOT_SYMBOLS.length, ...list);
}
syncSlotSymbols();
onGameConfigChange(syncSlotSymbols);

export type SlotSpinDetail = {
  reels: [SlotSymbolId, SlotSymbolId, SlotSymbolId];
  hitLine: string;
  jackpot: boolean;
  bombed: boolean;
};

function countSymbol(reels: readonly SlotSymbolId[], id: SlotSymbolId): number {
  let n = 0;
  for (const r of reels) if (r === id) n++;
  return n;
}

export function resolveSlotReels(reels: [SlotSymbolId, SlotSymbolId, SlotSymbolId]): ArcadeGameOutcome {
  const p = getGameConfig().odds.slotPayouts;
  const [a, b, c] = reels;
  const hasBomb = a === 'bomb' || b === 'bomb' || c === 'bomb';
  const hasSkull = a === 'skull' || b === 'skull' || c === 'skull';

  if (a === 'seven' && b === 'seven' && c === 'seven') {
    const detail: SlotSpinDetail = { reels, hitLine: '7-7-7 · 超级头彩', jackpot: true, bombed: false };
    return { code: '777', label: `777 头彩 · ${p.seven3}×！`, tier: 'jackpot', won: true, multiplier: p.seven3, cosmeticBaseChance: p.seven3Chance, detail };
  }
  if (a === 'star' && b === 'star' && c === 'star') {
    const detail: SlotSpinDetail = { reels, hitLine: '三连星徽', jackpot: false, bombed: false };
    return { code: 'triple_star', label: `三星连珠 · ${p.star3}×`, tier: 'mega', won: true, multiplier: p.star3, cosmeticBaseChance: p.star3Chance, detail };
  }
  if (a === 'clover' && b === 'clover' && c === 'clover') {
    const detail: SlotSpinDetail = { reels, hitLine: '三叶逢春', jackpot: false, bombed: false };
    return { code: 'triple_clover', label: `三连幸运草 · ${p.clover3}×`, tier: 'big', won: true, multiplier: p.clover3, cosmeticBaseChance: p.clover3Chance, detail };
  }
  if (a === 'coin' && b === 'coin' && c === 'coin') {
    const detail: SlotSpinDetail = { reels, hitLine: '满堂金贯', jackpot: false, bombed: false };
    return { code: 'triple_coin', label: `三枚铜钱连线 · ${p.coin3}×`, tier: 'big', won: true, multiplier: p.coin3, cosmeticBaseChance: p.coin3Chance, detail };
  }

  if (hasBomb) {
    const label = countSymbol(reels, 'bomb') >= 2 ? '双雷连环引爆，筹码震飞！' : '第三格哑雷炸膛，颗粒无收！';
    const detail: SlotSpinDetail = { reels, hitLine: '爆雷归零', jackpot: false, bombed: true };
    return { code: 'bombed', label, tier: 'bust', won: false, multiplier: 0, cosmeticBaseChance: 0, detail };
  }

  if (!hasSkull) {
    if (countSymbol(reels, 'seven') === 2 && p.seven2 > 0) {
      const detail: SlotSpinDetail = { reels, hitLine: '双 7 临门', jackpot: false, bombed: false };
      return { code: 'pair_seven', label: `双 7 幸运线 · ${p.seven2}×`, tier: 'win', won: true, multiplier: p.seven2, cosmeticBaseChance: p.seven2Chance, detail };
    }
    if (countSymbol(reels, 'star') === 2 && p.star2 > 0) {
      const detail: SlotSpinDetail = { reels, hitLine: '双星伴月', jackpot: false, bombed: false };
      return { code: 'pair_star', label: `双星连线 · ${p.star2}×`, tier: 'win', won: true, multiplier: p.star2, cosmeticBaseChance: 0, detail };
    }
    if (countSymbol(reels, 'clover') === 2 && p.clover2 > 0) {
      const detail: SlotSpinDetail = { reels, hitLine: '幸运双叶', jackpot: false, bombed: false };
      return { code: 'pair_clover', label: `双草成对 · ${p.clover2}×`, tier: 'win', won: true, multiplier: p.clover2, cosmeticBaseChance: 0, detail };
    }
    if (countSymbol(reels, 'coin') === 2 && p.coin2 > 0) {
      const detail: SlotSpinDetail = { reels, hitLine: '双钱微鸣', jackpot: false, bombed: false };
      return { code: 'pair_coin', label: `双铜小回血 · ${p.coin2}×`, tier: 'win', won: true, multiplier: p.coin2, cosmeticBaseChance: 0, detail };
    }
  }

  const label = hasSkull ? '骷髅挡道，这一手空箱收场。' : '三轴错开，下把再来！';
  const detail: SlotSpinDetail = { reels, hitLine: '未中奖', jackpot: false, bombed: false };
  return { code: 'miss', label, tier: 'bust', won: false, multiplier: 0, cosmeticBaseChance: 0, detail };
}

export const slotMachineGame: ArcadeGamePlugin = {
  get meta(): ArcadeGameMeta {
    const p = getGameConfig().odds.slotPayouts;
    const top = Math.max(p.seven3, p.star3, p.clover3, p.coin3);
    return {
      id: 'slot-machine',
      name: '三轴老虎机',
      subtitle: '拉杆冲三连 · 避开雷与骷髅',
      badge: `最高 ${top}×`,
      tagline: '三格同心爆头彩；带雷或骷髅熄火。赢了可当场搏倍！',
      paytable: [
        { combo: '7 · 7 · 7', payout: `${p.seven3}× + 限定外观`, note: '超级头彩' },
        { combo: '✦ · ✦ · ✦', payout: `${p.star3}× + 高概率外观`, note: '三星连珠' },
        { combo: '🍀 · 🍀 · 🍀', payout: `${p.clover3}× + 中概率外观`, note: '幸运三叶' },
        { combo: '🪙 · 🪙 · 🪙', payout: `${p.coin3}× + 低概率外观`, note: '三钱贯满' },
        { combo: '双 7 / 双 ✦ / 双 🍀 / 双 🪙', payout: `${p.seven2}× / ${p.star2}× / ${p.clover2}× / ${p.coin2}×`, note: '无雷无骷小胜' },
        { combo: '含 💣 或 💀 / 错轴', payout: '0×（归零）', note: '高风险失手' },
      ],
    };
  },
  play({ random }) {
    const weights: Weighted<SlotSymbolId>[] = getGameConfig().odds.slotSymbols.map(s => ({ value: s.id, weight: s.weight }));
    const reels: [SlotSymbolId, SlotSymbolId, SlotSymbolId] = [
      weightedPick(weights, random),
      weightedPick(weights, random),
      weightedPick(weights, random),
    ];
    return resolveSlotReels(reels);
  },
};
