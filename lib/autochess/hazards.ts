/**
 * 房间层「风控」解析器（跨回合、动金币，不属于战斗原语）。
 *
 * 与 `stats.ts` 的 `ScalingMetric` 同一套路：数据在棋子/包里声明（`UnitDef.hazard`），
 * 引擎只按具名 metric 解释。新增一种风控 = 在 `HazardMetric` 加一个名字 + 在下面的
 * `METRIC_HANDLERS` 加一个 handler，其余内容不必改。
 *
 * 掷骰**每回合独立重掷**，种子取 `hash(seed, seatId, unitId, hazardId, round)`：
 * 对玩家是"纯看命、每轮重算"（现实里有的随便登、有的全副武装被封号）；
 * 对引擎仍可复现、可回放、可打日志。确定性只保证"同样的局面重开结果一致"。
 */
import { createRng, hash32, hashString } from './rng';
import type { HazardMetric, HazardTiming, UnitHazard } from '../../content/autochess/types';

export type HazardRollContext = {
  /** 房间种子（`room.seed`）。 */
  seed: number;
  round: number;
  /** 席位 id，用于把同一棋子的掷骰分散到不同席位。 */
  seatId: string;
  /** 棋子模板 id（`piece.templateId`）。 */
  unitId: string;
  /** 当前星级。 */
  star: number;
  pieceId?: string;
  zone?: 'field' | 'bench';
  /** `${unitId}:${hazard.id}` → 历史命中次数（黑名单）。 */
  hitCounts?: Record<string, number>;
  /** 己方（含自身）携带某羁绊的不同棋子数。 */
  alliedTraitCount?: (trait: string) => number;
};

export type HazardRoll = {
  hazard: UnitHazard;
  chancePct: number;
  hit: boolean;
};

/** 该棋子在本风控下已命中几次。 */
export function hazardHitCount(ctx: HazardRollContext, hazard: UnitHazard): number {
  return ctx.hitCounts?.[`${ctx.unitId}:${hazard.id}`] ?? 0;
}

/**
 * 具名 metric → 概率增量（百分点，累加语义）。
 * `selfStar` 是"查表替换"语义（覆盖同项），用起来像「星级越高越容易罢工」。
 */
const METRIC_HANDLERS: Record<HazardMetric['k'], (metric: HazardMetric, ctx: HazardRollContext, hazard: UnitHazard) => number> = {
  constant: (metric) => (metric.k === 'constant' ? metric.value : 0),
  alliedTraitCount: (metric, ctx) =>
    metric.k === 'alliedTraitCount' ? (ctx.alliedTraitCount?.(metric.trait) ?? 0) * metric.perPct : 0,
  hitCount: (metric, ctx, hazard) => (metric.k === 'hitCount' ? hazardHitCount(ctx, hazard) * metric.perPct : 0),
  selfStar: (metric, ctx) => (metric.k === 'selfStar' ? (metric.table[ctx.star] ?? 0) : 0),
  round: (metric, ctx) => (metric.k === 'round' ? Math.max(0, ctx.round - 1) * metric.perPct : 0),
};

/** 每局固定的「风控强度」随机系数范围：同一房间种子固定，跨局随机（纯看脸）。 */
export const HAZARD_LUCK_RANGE = { min: 0.5, max: 1.5 } as const;

/**
 * 本局的风控强度系数 k：由房间种子决定，**一局之内恒定、换一局重掷**。
 * k=0.5 本局风控温和，k=1.5 本局风控严打——这就是「看脸」的来源。
 */
export function hazardLuck(seed: number): number {
  const rng = createRng(hash32(seed, 0x9e11));
  const { min, max } = HAZARD_LUCK_RANGE;
  return min + (max - min) * rng.next();
}

/** 本回合的命中概率（%），已按 `capPct` 夹紧。这是**理论值**（东方越多越高），只用于展示。 */
export function hazardChancePct(hazard: UnitHazard, ctx: HazardRollContext): number {
  if (hazard.immuneAtStar !== undefined && ctx.star >= hazard.immuneAtStar) return 0;
  if (ctx.zone === 'bench' && hazard.benchChancePct !== undefined) return hazard.benchChancePct;
  let pct = hazard.basePct;
  for (const metric of hazard.metrics ?? []) {
    pct += METRIC_HANDLERS[metric.k](metric, ctx, hazard);
  }
  return Math.max(0, Math.min(hazard.capPct, pct));
}

/**
 * 每回合的额外「运气抖动」：理论概率只是中心值，实际掷骰再乘一层 [min,max] 随机。
 * 于是就算满盘东方（理论概率高），也可能连续几轮运气好、一直不被查。
 */
export const HAZARD_ROUND_LUCK = { min: 0.35, max: 1.65 } as const;

/** 每回合独立掷一次；返回是否命中与本回合理论概率（便于 UI 显示风险档位）。 */
export function rollHazard(hazard: UnitHazard, ctx: HazardRollContext): HazardRoll {
  const chancePct = hazardChancePct(hazard, ctx);
  if (chancePct <= 0) return { hazard, chancePct, hit: false };
  const key = `${ctx.unitId}:${hazard.id}:${ctx.seatId}${hazard.perPieceRoll ? `:${ctx.pieceId ?? ctx.unitId}` : ''}`;
  const rng = createRng(hash32(ctx.seed ^ hashString(0, key), ctx.round, 0x9a11));
  if (ctx.zone === 'bench' && hazard.benchChancePct !== undefined) return { hazard, chancePct, hit: rng.next() * 100 < chancePct };
  // 实际命中率 = 理论概率 × 本局系数 k × 本回合抖动；理论递增，实际看脸。
  const { min, max } = HAZARD_ROUND_LUCK;
  const jitter = min + (max - min) * rng.next();
  const effective = Math.min(100, chancePct * hazardLuck(ctx.seed) * jitter);
  return { hazard, chancePct, hit: rng.next() * 100 < effective };
}

/** 结算一个棋子的全部风控；房间层按 `timing` 取用。 */
export function rollUnitHazards(
  unit: { templateId: string; star: number },
  ctx: Omit<HazardRollContext, 'unitId' | 'star'>,
  hazards: readonly UnitHazard[],
): HazardRoll[] {
  const full: HazardRollContext = { ...ctx, unitId: unit.templateId, star: unit.star };
  return hazards.map((hazard) => rollHazard(hazard, full));
}

export type PriceRoll = { hazard: UnitHazard; chancePct: number; peak: boolean; delta: number };

/**
 * `price` 类回合波动：命中=波峰（涨价），未命中=波谷（打折）。
 * 与 `rollHazard` 共用同一套每回合确定性掷骰，房间层结算商店/购买价时用 `delta`。
 */
export function rollPrice(hazard: UnitHazard, ctx: HazardRollContext): PriceRoll {
  const roll = rollHazard(hazard, ctx);
  const peak = roll.hit;
  return {
    hazard,
    chancePct: roll.chancePct,
    peak,
    delta: peak ? hazard.price?.peakDelta ?? 0 : hazard.price?.troughDelta ?? 0,
  };
}

/** 过滤出某个时机的风控（房间层只在回合开始/结束各跑一遍）。 */
export function hazardsAt(hazards: readonly UnitHazard[] | undefined, timing: HazardTiming): UnitHazard[] {
  return (hazards ?? []).filter((hazard) => hazard.timing === timing);
}

/** 命中后的记账 key。 */
export function hazardKey(hazard: UnitHazard): string {
  return hazard.id;
}
