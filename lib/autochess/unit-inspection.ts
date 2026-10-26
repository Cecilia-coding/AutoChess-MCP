import { autochessCostOf, getUnit } from '../../content/autochess/units';
import { unitSkill } from '../../content/autochess/unit-skills';
import { combatStats, effectiveTraits, uniqueTraitCounts } from './stats';
import type { Combatant, TeamId } from './types';

/** Bench units keep their own upgrades; only fielded units receive the deployed team context. */
export function inspectUnit(piece: Combatant, board: Combatant[], side: TeamId = 'left') {
  const unit = getUnit(piece.templateId);
  const fielded = board.some(member => member.id === piece.id);
  const team = fielded ? board : [];
  return {
    unit, cost: autochessCostOf(unit), fielded,
    stats: combatStats(piece, team, side), skill: unitSkill(piece.templateId),
    traits: [...new Set(effectiveTraits(piece))], counts: uniqueTraitCounts(team),
    notes: unit.skillNote.replace(/\*\*/g, '').split(/(?=(?:主动|被动|双生)「)/u).filter(Boolean),
  };
}
