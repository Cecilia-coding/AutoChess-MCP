import { effectiveTraits } from './stats';
import type { Combatant } from './types';
import type { RecurringGrant } from '../../content/autochess/types';

/** 解析重复发放候选池所需的最小棋子资料；引擎不依赖具体包。 */
export type RecurringRosterUnit = {
  id: string;
  factions: string[];
  jobs: string[];
  cost: number;
};

/** 每个候选池的最小人数；数据不足时不发放（可回退金币）。 */
function uniqueBoardTraits(board: readonly Combatant[]): Set<string> {
  const traits = new Set<string>();
  for (const piece of board) {
    for (const trait of effectiveTraits(piece)) traits.add(trait);
  }
  return traits;
}

/** 场上「人数最多」的羁绊：按不同棋子名计数，平手时取字典序保证确定性。 */
function topBoardTrait(board: readonly Combatant[]): string | null {
  const counts = new Map<string, Set<string>>();
  for (const piece of board) {
    for (const trait of effectiveTraits(piece)) {
      const seen = counts.get(trait) ?? new Set<string>();
      seen.add(piece.templateId);
      counts.set(trait, seen);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  return ranked[0]?.[0] ?? null;
}

/**
 * 计算某类重复发放的候选棋子 id。
 *
 * 四种池子都由数据声明，换包换羁绊不需要改这里：
 * - `traitRelated`：与上场阵容任一羁绊相关的在册棋子
 * - `topTrait`：与场上人数最多羁绊相同的在册棋子
 * - `cheapBoard`：上场阵容中不高于 `maxCost` 费的棋子本身
 */
export function recurringGrantPool(
  grant: Pick<RecurringGrant, 'pool' | 'maxCost'>,
  board: readonly Combatant[],
  roster: readonly RecurringRosterUnit[],
): string[] {
  const affordable = roster.filter((unit) => unit.cost > 0);

  if (grant.pool === 'cheapBoard') {
    const maxCost = grant.maxCost ?? 2;
    const onBoard = [...new Set(board.map((piece) => piece.templateId))];
    return onBoard.filter((id) => {
      const unit = affordable.find((entry) => entry.id === id);
      return Boolean(unit && unit.cost <= maxCost);
    });
  }

  const boardTraits = uniqueBoardTraits(board);
  if (!boardTraits.size) return [];

  if (grant.pool === 'topTrait') {
    const top = topBoardTrait(board);
    if (!top) return [];
    return affordable
      .filter((unit) => unit.factions.includes(top) || unit.jobs.includes(top))
      .map((unit) => unit.id);
  }

  return affordable
    .filter((unit) => unit.factions.some((faction) => boardTraits.has(faction))
      || unit.jobs.some((job) => boardTraits.has(job)))
    .map((unit) => unit.id);
}
