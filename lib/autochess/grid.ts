import { BOARD_COLS, BOARD_ROWS, HALF_ROWS } from './constants';
import type { TeamId, Vec } from './types';

export function inBounds(pos: Vec): boolean {
  return pos.row >= 0 && pos.row < BOARD_ROWS && pos.col >= 0 && pos.col < BOARD_COLS;
}

export function manhattan(a: Vec, b: Vec): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function neighbors(pos: Vec): Vec[] {
  return [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ].filter(inBounds);
}

export function worldPos(team: TeamId, localRow: number, localCol: number): Vec {
  const row =
    team === 'left' ? HALF_ROWS + (HALF_ROWS - 1 - localRow) : localRow;
  return { row, col: localCol };
}

export function cellKey(pos: Vec): number {
  return pos.row * BOARD_COLS + pos.col;
}

/**
 * Neighbours ordered by how much closer they get to `goal`. Plain compass order
 * would make "north" win every tie, which quietly favours whichever team is
 * walking north.
 */
function neighborsToward(pos: Vec, goal: Vec): Vec[] {
  return neighbors(pos).sort((a, b) => {
    const da = manhattan(a, goal);
    const db = manhattan(b, goal);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
}

/** First step toward a cell from which `range` can hit `goal`. Occupied cells block. */
export function nextStepToward(
  start: Vec,
  goal: Vec,
  range: number,
  blocked: Set<number>,
): Vec | null {
  if (manhattan(start, goal) <= range) return null;
  const startKey = cellKey(start);
  const visited = new Set<number>([startKey]);
  const queue: { pos: Vec; first: Vec | null }[] = [{ pos: start, first: null }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighborsToward(current.pos, goal)) {
      const key = cellKey(next);
      if (visited.has(key)) continue;
      if (blocked.has(key) && key !== startKey) continue;
      visited.add(key);
      const first = current.first ?? next;
      if (manhattan(next, goal) <= range) return first;
      queue.push({ pos: next, first });
    }
  }
  return null;
}
