import { getUnit } from '../../content/autochess/units';
import { BOARD_ROWS, HALF_ROWS, BOARD_COLS } from './constants';
import { worldPos } from './grid';
import { combatStats } from './stats';
import type { BattleOutput, Combatant, TeamId } from './types';

export function ownCellFromWorld(row: number, col: number) {
  return row >= HALF_ROWS && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS
    ? { row: BOARD_ROWS - 1 - row, col } : null;
}

/** Static placement projection only: no simulation and no economy changes. */
export function deploymentView(left: Combatant[], right: Combatant[]): BattleOutput {
  const output: BattleOutput = { battleId:'deployment', rulesVersion:'view',configVersion:'view',seed:0,outcome:'draw',durationMs:0,ticks:0,events:[],keyEvents:[],units:[] };
  for (const [team, pieces] of [['left',left],['right',right]] as const) {
    for (const piece of pieces) {
      const def = getUnit(piece.templateId);
      const maxHp = combatStats(piece, [...pieces], team as TeamId).maxHp;
      output.units.push({ id: piece.id, templateId: piece.templateId, name: def.name, team, maxHp, survivingHp: maxHp,
        damageDealt: 0, damageTaken: 0, healingDone: 0, casts: 0, kills: 0, manaCost: def.manaByStar?.[piece.star - 1] ?? 80, manaStart: 0 });
      output.events.push({seq:output.events.length,timeMs:0,type:'spawn',sourceId:piece.id,pos:worldPos(team,piece.localRow,piece.localCol),text:''});
    }
  }
  return output;
}
