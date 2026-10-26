import { BOARD_ROWS } from './constants';
import type { RoomBattle } from './room-types';
import type { BattleOutput, CombatEvent } from './types';

/** 回放只变换观看方向，保留服务端原始结算和棋子 ID。 */
export function roomPlayback(battle: RoomBattle, seat: number) {
  const fight = battle.fights?.find(f => !f.ghost && (f.left === seat || f.right === seat))
    ?? battle.fights?.find(f => f.left === seat || f.right === seat);
  const output = fight?.output ?? battle.output;
  const opponent = fight ? (fight.left === seat ? fight.right : fight.left) : 1-seat;
  const flip = fight ? fight.right === seat : seat === 1;
  if (!flip) return { output, opponent, ghost: !!fight?.ghost };
  const event = (e: CombatEvent): CombatEvent => e.pos ? {...e,pos:{...e.pos,row:BOARD_ROWS-1-e.pos.row}} : {...e};
  const projected: BattleOutput = {...output,
    outcome: output.outcome === 'draw' ? 'draw' : output.outcome === 'left' ? 'right' : 'left',
    units: output.units.map(u => ({...u,team:u.team === 'left' ? 'right' : 'left'})),
    events: output.events.map(event), keyEvents: output.keyEvents.map(event)};
  return {output:projected,opponent,ghost:!!fight?.ghost};
}
