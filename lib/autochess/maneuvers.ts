/**
 * 房间层「监管」解析器：把己方源头棋子声明的 `maneuver` 施加到**敌方随机棋子**上。
 *
 * 与 `hazards.ts` 同一套路（数据声明 + 引擎具名解析），但方向相反：
 *  - hazard 是「自己棋子的风险」；
 *  - maneuver 是「主动给对手挂的持久标记」（例：safety 合规税）。
 *
 * 落点随机但可复现：种子 `hash(seed, sourceKey, maneuverId, round)`。
 * 标记跨回合持久；对方**卖掉那枚棋子即清除**（状态挂在棋子本身）。
 */
import { createRng, hash32, hashString } from './rng';
import type { ManeuverTrigger, UnitManeuver } from '../../content/autochess/types';

export type ManeuverSource = { sourceKey: string; maneuver: UnitManeuver };
export type ManeuverPlan = { targetPieceId: string; effect: UnitManeuver['effect']; stacks: number };

/** 该源头在当前时机是否需要触发（未来可扩展更多 trigger）。 */
export function maneuverFiresOn(maneuver: UnitManeuver, trigger: ManeuverTrigger): boolean {
  return maneuver.trigger === trigger;
}

/** 确定性随机落点：给一枚敌方棋子。 */
export function pickManeuverTarget(
  sourceKey: string,
  maneuver: UnitManeuver,
  foePieceIds: readonly string[],
  seed: number,
  round: number,
): string | null {
  if (!foePieceIds.length) return null;
  const rng = createRng(hash32(seed ^ hashString(0, `${sourceKey}:${maneuver.id}`), round, 0x5a7d));
  return foePieceIds[rng.int(foePieceIds.length)] ?? null;
}

/**
 * 结算一组源头在某个时机要施加的标记，按目标合并层数。
 * `stacksOf` 读目标当前已有的层数（用于封顶），返回每个目标要新增的层数。
 */
export function planManeuvers(input: {
  sources: readonly ManeuverSource[];
  trigger: ManeuverTrigger;
  foePieceIds: readonly string[];
  currentStacks: (pieceId: string) => number;
  seed: number;
  round: number;
}): ManeuverPlan[] {
  const totals = new Map<string, ManeuverPlan>();
  for (const { sourceKey, maneuver } of input.sources) {
    if (!maneuverFiresOn(maneuver, input.trigger)) continue;
    const target = pickManeuverTarget(sourceKey, maneuver, input.foePieceIds, input.seed, input.round);
    if (!target) continue;
    const pending = totals.get(target)?.stacks ?? 0;
    const room = maneuver.maxStacks - (input.currentStacks(target) + pending);
    const add = Math.min(Math.max(0, room), maneuver.perTrigger);
    if (add <= 0) continue;
    totals.set(target, { targetPieceId: target, effect: maneuver.effect, stacks: pending + add });
  }
  return [...totals.values()];
}
