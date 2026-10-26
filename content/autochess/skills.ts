import type { SkillDef } from './types';

export const skills: SkillDef[] = [
  { id: 'self-shield', name: '护体', kind: 'self_shield', coeff: 18, shieldMs: 4000, maxTargets: 1 },
  { id: 'ally-shield', name: '援护', kind: 'ally_shield', coeff: 18, shieldMs: 4000, maxTargets: 1 },
  { id: 'ally-heal', name: '回春', kind: 'ally_heal', coeff: 14, shieldMs: 0, maxTargets: 1 },
  { id: 'strike', name: '破招', kind: 'single_phys', coeff: 180, shieldMs: 0, maxTargets: 1 },
  { id: 'bolt', name: '符矢', kind: 'single_magic', coeff: 180, shieldMs: 0, maxTargets: 1 },
];

export function skillCoefficient(skill: SkillDef, star: 1 | 2 | 3): number {
  return skill.coeffByStar?.[star - 1] ?? skill.coeff;
}

export function skillRawDamage(skill: SkillDef, star: 1 | 2 | 3, attack: number): number {
  return Math.round((skill.flat ?? 0) + attack * (skillCoefficient(skill, star) / 100));
}

export function getSkill(id: string): SkillDef {
  const skill = skills.find((item) => item.id === id);
  if (!skill) throw new Error(`unknown skill: ${id}`);
  return skill;
}
