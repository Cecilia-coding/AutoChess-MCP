import type { BattleOutput, CombatEvent, TeamId, Vec } from './types';

export type UnitFrame = {
  id: string;
  team: TeamId;
  name: string;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** 内力（蓝条）：按相邻两次施法线性充满，施法后归零（展示近似）。 */
  mana: number;
  maxMana: number;
  acting: 'idle' | 'move' | 'attack' | 'cast';
};

export type BattleFrame = {
  timeMs: number;
  units: UnitFrame[];
  log: CombatEvent[];
  ended: boolean;
};

export function frameAt(output: BattleOutput, timeMs: number): BattleFrame {
  const units = new Map<string, UnitFrame>();
  const log: CombatEvent[] = [];
  let ended = false;
  const acting = new Map<string, UnitFrame['acting']>();
  // 蓝条近似：收集每枚棋子的施法时刻与出生时刻
  const castsByUnit = new Map<string, number[]>();
  const spawnAt = new Map<string, number>();
  for (const event of output.events) {
    if (event.type === 'cast' && event.sourceId) {
      const list = castsByUnit.get(event.sourceId) ?? [];
      list.push(event.timeMs);
      castsByUnit.set(event.sourceId, list);
    }
    if (event.type === 'spawn' && event.sourceId && !spawnAt.has(event.sourceId)) spawnAt.set(event.sourceId, event.timeMs);
  }

  for (const event of output.events) {
    if (event.timeMs > timeMs) break;
    if (event.type !== 'spawn') log.push(event);
    if (event.type === 'end') ended = true;

    if (event.type === 'spawn' && event.sourceId && event.pos) {
      const line = output.units.find((item) => item.id === event.sourceId);
      units.set(event.sourceId, {
        id: event.sourceId,
        team: line?.team ?? 'left',
        name: line?.name ?? event.sourceId,
        row: event.pos.row,
        col: event.pos.col,
        hp: line?.maxHp ?? 0,
        maxHp: line?.maxHp ?? 0,
        alive: true,
        mana: line?.manaStart ?? 0,
        maxMana: Math.max(1, line?.manaCost ?? 1),
        acting: 'idle',
      });
    }

    const source = event.sourceId ? units.get(event.sourceId) : undefined;
    const target = event.targetIds?.[0] ? units.get(event.targetIds[0]) : undefined;

    const actionIsRecent = timeMs - event.timeMs <= 500;
    if (event.type === 'move' && source && event.pos) {
      source.row = event.pos.row;
      source.col = event.pos.col;
      if (actionIsRecent) acting.set(source.id, 'move');
    }
    if (event.type === 'attack' && source && actionIsRecent) acting.set(source.id, 'attack');
    if (event.type === 'cast' && source && actionIsRecent) acting.set(source.id, 'cast');
    if (event.type === 'damage' && target) {
      target.hp = Math.max(0, target.hp - (event.value ?? 0));
    }
    if (event.type === 'heal' && target) {
      target.hp = Math.min(target.maxHp, target.hp + (event.value ?? 0));
    }
    if (event.type === 'regen' && source) {
      source.hp = Math.min(source.maxHp, source.hp + (event.value ?? 0));
    }
    if (event.type === 'death' && source) {
      source.alive = false;
      source.hp = 0;
    }
  }

  for (const unit of units.values()) {
    unit.acting = unit.alive ? (acting.get(unit.id) ?? 'idle') : 'idle';
    // 蓝条：相邻两次施法之间线性充满；只有上一发则按平均间隔续充
    const casts = castsByUnit.get(unit.id) ?? [];
    const start = spawnAt.get(unit.id) ?? 0;
    const prev = [...casts].reverse().find((at) => at <= timeMs);
    const next = casts.find((at) => at > timeMs);
    if (next !== undefined) {
      const from = prev ?? start;
      const span = Math.max(1, next - from);
      unit.mana = unit.maxMana * Math.min(1, Math.max(0, (timeMs - from) / span));
    } else if (prev !== undefined) {
      const gaps = casts.slice(1).map((at, index) => at - casts[index]!);
      const interval = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 4000;
      unit.mana = unit.maxMana * Math.min(1, Math.max(0, (timeMs - prev) / Math.max(1, interval)));
    } else {
      const first = casts[0];
      unit.mana = first === undefined ? unit.mana : unit.maxMana * Math.min(1, Math.max(0, (timeMs - start) / Math.max(1, first - start)));
    }
  }

  return {
    timeMs,
    units: [...units.values()],
    log,
    ended,
  };
}

export function cellOf(units: UnitFrame[], pos: Vec): UnitFrame | undefined {
  return units.find((unit) => unit.row === pos.row && unit.col === pos.col);
}
