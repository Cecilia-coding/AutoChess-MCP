import type { BattleOutput, TeamId } from './types';

type Point = { timeMs: number; dealt: number; taken: number };
export type BattleStatRow = { id: string; name: string; team: TeamId; dealt: number; taken: number };
type Timeline = { row: BattleStatRow; born: number; points: Point[] };

/** 每场建立一次累计索引；回放只查当前时刻，结算数值留到回放结束。 */
export function indexBattleStats(output: BattleOutput) {
  const units = new Map<string, Timeline>();
  for (const unit of output.units) {
    const previous = units.get(unit.id);
    if (previous) {
      previous.row.dealt += unit.damageDealt;
      previous.row.taken += unit.damageTaken;
    } else units.set(unit.id, {
      row: { id: unit.id, name: unit.name, team: unit.team, dealt: unit.damageDealt, taken: unit.damageTaken },
      born: Infinity, points: [],
    });
  }
  const add = (id: string | undefined, timeMs: number, dealt: number, taken: number) => {
    const unit = id ? units.get(id) : undefined;
    if (!unit) return;
    const last = unit.points.at(-1);
    unit.points.push({ timeMs, dealt: (last?.dealt ?? 0) + dealt, taken: (last?.taken ?? 0) + taken });
  };
  for (const event of output.events) {
    if ((event.type === 'spawn' || event.type === 'summon') && event.sourceId) {
      const unit = units.get(event.sourceId);
      if (unit) unit.born = Math.min(unit.born, event.timeMs);
    }
    if (event.type !== 'damage' || !event.value || event.value < 0) continue;
    const target = event.targetIds?.[0]; // 战斗协议每个 damage 事件对应一个受击者。
    add(target, event.timeMs, 0, event.value);
    // 加时气血流失以自身为来源，仅记承伤。
    if (event.sourceId !== target) add(event.sourceId, event.timeMs, event.value, 0);
  }
  return [...units.values()];
}

export function battleStatsAt(index: ReturnType<typeof indexBattleStats>, timeMs: number, settled = false): BattleStatRow[] {
  return index.filter(unit => settled || unit.born <= timeMs).map(unit => {
    if (settled) return { ...unit.row };
    let lo = 0, hi = unit.points.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (unit.points[mid]!.timeMs <= timeMs) lo = mid + 1;
      else hi = mid;
    }
    const point = unit.points[lo - 1];
    return { ...unit.row, dealt: point?.dealt ?? 0, taken: point?.taken ?? 0 };
  });
}
