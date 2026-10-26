import type { FactionId, JobId, Role, UnitDef } from './types';

export function defineUnit(
  id: string,
  name: string,
  cost: UnitDef['cost'],
  role: Role,
  skillId: string,
  factions: FactionId[],
  jobs: JobId[],
  artNeed: string,
  overrides: Partial<UnitDef> = {},
): UnitDef {
  return {
    id,
    name,
    cost,
    role,
    skillId,
    factions,
    jobs,
    summon: false,
    master: false,
    companion: false,
    source: 'pack',
    skillNote: '角色技能先用职责积木，正式数值后补。',
    artNeed,
    ...overrides,
  };
}
