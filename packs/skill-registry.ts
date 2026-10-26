/**
 * 各棋谱包的棋子技能表汇总。
 *
 * 各包的技能表在这里合并，`unitSkill(id)` 统一查询。
 * 新增带专属技能的棋谱时，在这里登记对应技能表。
 */
import type { UnitSkill } from '../content/autochess/unit-skills';
import { aiUnitSkills } from './ai/skills';

export const PACK_UNIT_SKILLS: Record<string, UnitSkill> = {
  ...aiUnitSkills,
};

export function packUnitSkill(id: string): UnitSkill | undefined {
  return PACK_UNIT_SKILLS[id];
}
