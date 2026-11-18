import { findEphemeralSkill } from '../../packs/ephemeral-registry';
import { allPackSkills } from '../../packs/registry';
import type { UnitSkill } from '../../packages/chess-engine/src/skill-types';
export * from '../../packages/chess-engine/src/skill-types';
export const unitSkills: Record<string, UnitSkill> = allPackSkills();
export function unitSkill(id: string): UnitSkill | undefined {
  return unitSkills[id] ?? findEphemeralSkill(id);
}
