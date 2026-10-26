/**
 * AI 包的风控数据工厂（数值集中在这里，方便后期调）。
 *
 * 这里只产出 `UnitHazard` 数据；判定/结算在 `lib/autochess/hazards.ts`。
 * 想加新梗（例如"监管审查"、"刷榜实锤掉星"）就在这里加一个工厂函数，
 * 再到 roster 里挂到对应棋子上即用。
 */
import type { UnitHazard } from '../../content/autochess/types';

/** 风控可调参数（唯一数值源）。 */
export const AI_HAZARD_TUNING = {
  /**
   * 查IP封号理论值：`P_base = min(basePct + orient*每名东方棋子 + hitCount*每次封号, capPct)`。
   * 实战判定命中率：`P_effective = min(100%, P_base × k × jitter)`（见 lib/autochess/hazards.ts）。
   * 其中 k ∈ [0.5, 1.5] 为当局宏观风控烈度系数（房间种子决定，整局恒定；k=0.5 温和放水，k=1.5 严打严封）；
   * jitter ∈ [0.35, 1.65] 为每回合单轮运气抖动；base 保证全外援也有底噪风险，orient 项让混编更危险。
   */
  ipBan: { basePct: 4, perOrientPct: 8, perHitPct: 60, capPct: 85 },
  /** 官方活动罢工：按星级查表（★/★★/★★★）。 */
  officialStrike: { byStar: { 1: 0, 2: 12, 3: 30 } as Record<number, number>, capPct: 30 },
  /** 错峰定价：每回合独立掷骰，命中=波峰涨价，未命中=波谷打折。 */
  offPeak: { peakChancePct: 50, peakDelta: 1, troughDelta: -1 },
  /** Coding Plan 限量：每回合掷骰，命中=本回合售罄；`perRoundPct` 为负=越早期越难抢。 */
  codingPlan: { basePct: 55, perRoundPct: -8, capPct: 55 },
} as const;

/** 「查IP」：每回合结算，命中即封号离场（金币打水漂，重买后风险递增）。 */
export function ipBanHazard(overrides: Partial<UnitHazard> = {}): UnitHazard {
  const t = AI_HAZARD_TUNING.ipBan;
  return {
    id: 'ip-ban',
    label: '查IP',
    timing: 'roundEnd',
    effect: 'ban',
    benchChancePct: 1,
    immuneAtStar: 3,
    perPieceRoll: true,
    basePct: t.basePct,
    capPct: t.capPct,
    metrics: [
      { k: 'alliedTraitCount', trait: 'orient', perPct: t.perOrientPct },
      { k: 'hitCount', perPct: t.perHitPct },
    ],
    note: '战后查 IP：一、二星备战每枚固定 1%；出战时东方棋子与封号记录增加风险；三星免查。封号离场，装备退回背包。',
    ...overrides,
  };
}

/** 「官方活动」罢工：星级越高越容易罢工，命中则缺席 `strikeRounds` 回合后归队。 */
export function officialEventStrike(overrides: Partial<UnitHazard> = {}): UnitHazard {
  const t = AI_HAZARD_TUNING.officialStrike;
  return {
    id: 'official-event-strike',
    label: '罢工',
    timing: 'roundStart',
    effect: 'strike',
    basePct: 0,
    capPct: t.capPct,
    metrics: [{ k: 'selfStar', table: t.byStar }],
    strikeRounds: 1,
    note: '官方活动价换来的强度，星级越高越可能突然罢工缺席。',
    ...overrides,
  };
}

/**
 * 「错峰定价」（DeepSeek 梗）：每回合独立掷骰，命中=波峰涨价、未命中=波谷打折。
 * 房间层结算商店/购买价时读 `rollPrice(...).delta`。
 */
export function offPeakPricing(overrides: Partial<UnitHazard> = {}): UnitHazard {
  const t = AI_HAZARD_TUNING.offPeak;
  return {
    id: 'off-peak-pricing',
    label: '错峰定价',
    timing: 'roundStart',
    effect: 'price',
    basePct: t.peakChancePct,
    capPct: t.peakChancePct,
    price: { peakDelta: t.peakDelta, troughDelta: t.troughDelta },
    note: '碰上波峰涨价，落到波谷打折。买它要挑时候。',
    ...overrides,
  };
}

/**
 * 「限量 Coding Plan」（GLM 梗）：每回合独立掷骰，命中=本回合售罄、商店买不到。
 * `perRoundPct` 取负 → 早期特别难抢，越往后越好买。
 */
export function codingPlanSoldOut(overrides: Partial<UnitHazard> = {}): UnitHazard {
  const t = AI_HAZARD_TUNING.codingPlan;
  return {
    id: 'coding-plan-soldout',
    label: '限量 Coding Plan',
    timing: 'roundStart',
    effect: 'soldout',
    basePct: t.basePct,
    capPct: t.capPct,
    metrics: [{ k: 'round', perPct: t.perRoundPct }],
    note: '开售即秒杀：早期特别难抢，越往后越好买到。',
    ...overrides,
  };
}
