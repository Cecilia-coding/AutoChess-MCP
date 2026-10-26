import { findUnit } from '../../content/autochess/units';
import type { Combatant } from './types';

export function hazardLabels(piece: Pick<Combatant, 'templateId' | 'star'>, fielded: boolean): string[] {
  return (findUnit(piece.templateId)?.hazard ?? []).filter(h => h.benchChancePct !== undefined).map(h => {
    if (h.immuneAtStar !== undefined && piece.star >= h.immuneAtStar) return `${h.label}：已豁免`;
    return fielded ? `${h.label}：出战风险，${h.timing === 'roundEnd' ? '战后' : '回合开始'}判定` : `${h.label}：备战每轮固定 ${h.benchChancePct}%`;
  });
}
