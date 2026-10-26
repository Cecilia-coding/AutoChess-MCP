/**
 * 房间棋手等级：等级即人口，并决定商店能出到几费。
 *
 * - 每轮自然获得 `XP_PER_ROUND` 点经验；
 * - 花 `XP_BUY_COST` 金购买 `XP_BUY_AMOUNT` 点经验；
 * - 连胜会额外发金币（连败的上涨仍走 loss-bounty 的赏金池）。
 */

export const START_LEVEL = 2;
/** Maximum player level. */
export const MAX_LEVEL = 10;
/** 各等级升到下一级所需经验。 */
export const XP_TO_NEXT: Record<number, number> = { 2: 2, 3: 4, 4: 8, 5: 14, 6: 20, 7: 28, 8: 38, 9: 50 };
export const XP_PER_ROUND = 3;
export const XP_BUY_COST = 4;
export const XP_BUY_AMOUNT = 4;

/** 人口 = 等级（再叠加扩编令），下限 1、上限 8。 */
export function fieldCapacityForLevel(level: number, bonusCap = 0): number {
  const base = Math.max(1, Math.min(MAX_LEVEL, Math.trunc(level) || START_LEVEL));
  return Math.max(1, Math.min(MAX_LEVEL, base + Math.max(0, Math.trunc(bonusCap))));
}

export function xpToNext(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return XP_TO_NEXT[level] ?? null;
}

export type LevelProgress = { level: number; xp: number; gained: number };

/** 加经验并滚过尽可能多的等级。 */
export function addXp(level: number, xp: number, amount: number): LevelProgress {
  let nextLevel = Math.max(START_LEVEL, Math.trunc(level) || START_LEVEL);
  let nextXp = xp + Math.max(0, Math.trunc(amount));
  let gained = 0;
  for (;;) {
    const need = xpToNext(nextLevel);
    if (need === null) { nextXp = 0; break; }
    if (nextXp < need) break;
    nextXp -= need;
    nextLevel += 1;
    gained += 1;
  }
  return { level: nextLevel, xp: nextXp, gained };
}

/** 连胜额外金币：第一场不涨，从第二连胜起逐级上涨，封顶 4 金。 */
export const WIN_STREAK_GOLD_CAP = 4;

export function winStreakGold(count: number): number {
  if (count <= 1) return 0;
  return Math.min(WIN_STREAK_GOLD_CAP, count - 1);
}

/** 对战阶段：1-4 回合早期、5-8 中期、9+ 后期（给 roundIncome 这类阶梯用）。 */
export function stageOfRound(round: number): number {
  if (round <= 4) return 1;
  if (round <= 8) return 2;
  return 3;
}

/** 房间商店按棋手等级解锁的最高费用；升级后下一次刷新或换轮生效。 */
export const SHOP_MAX_COST_BY_LEVEL: Record<number,number> = {2:1,3:2,4:2,5:3,6:4,7:5,8:5,9:5,10:5};
export function shopMaxCostForLevel(level:number):number {return SHOP_MAX_COST_BY_LEVEL[Math.max(START_LEVEL,Math.min(MAX_LEVEL,Math.trunc(level)))]??1;}
