import { packUnitSkill } from '../../packs/skill-registry';
import type { StatKey, StatOp } from './stats-vocab';

export type SkillScale = { flat?: number; atkPct?: number; armorPct?: number; hpPct?: number; targetMaxHpPct?: number; flatByStar?: readonly [number, number, number]; atkPctByStar?: readonly [number, number, number]; armorPctByStar?: readonly [number, number, number] };
export type DamageType = 'phys' | 'magic' | 'true';
export type SkillStatus = 'stun' | 'silence' | 'disarm' | 'untargetable';

export type SkillPrimitive =
  | { op: 'damage'; at: 'current' | 'target' | 'self' | 'nearestFoes' | 'farthestFoes' | 'randomFoes' | 'lowestDefense' | 'highestHpPct' | 'allFoes'; count?: number; radius?: number; radiusFromStack?: { key: string; add: number }; share?: boolean; segments?: number; type?: DamageType; perTileDecayPct?: number; scale: SkillScale }
  | { op: 'knockback'; radius: number; stunMs?: number }
  | { op: 'overrideAttack'; ms: number; scale: SkillScale; segments?: number }
  | { op: 'repeat'; times: number; everyMs: number; effects: SkillPrimitive[] }
  | { op: 'randomPick'; options: SkillPrimitive[][] }
  | { op: 'stealAtk'; pct: number; maxStacks: number; key: string }
  | { op: 'reskin'; at: 'self' | 'target' | 'randomFoes' | 'nearestFoes'; count?: number; into: string; suffix?: string; ms?: number; msByStar?: number[] }
  | { op: 'heal'; at: 'self' | 'target' | 'weakestAlly' | 'alliesNearTarget' | 'alliesNearSelf' | 'allies' | 'allAllies'; radius?: number; segments?: number; scale: SkillScale }
  | { op: 'shield'; at: 'self' | 'allies' | 'alliesNearTarget' | 'alliesNearSelf'; radius?: number; count?: number; ms: number; scale: SkillScale }
  | { op: 'debuff'; at: 'target' | 'nearestFoes' | 'randomFoes' | 'selfRadius' | 'allFoes'; count?: number; radius?: number; stat: StatKey; value: number; ms?: number }
  | { op: 'controlImmune'; ms: number }
  | { op: 'buff'; at: 'self' | 'allies' | 'alliesNearTarget' | 'strongestAllies'; count?: number; radius?: number; stat: StatKey; value: number; valueByStar?: readonly [number, number, number]; ms?: number }
  | { op: 'block'; amount?: number; byStar?: readonly [number, number, number] }
  | { op: 'status'; at: 'current' | 'target' | 'self' | 'nearestFoes' | 'randomFoes'; count?: number; radius?: number; status: SkillStatus; ms?: number; msByStar?: readonly [number, number, number] }
  | { op: 'move'; at: 'nearTarget' | 'farthestFoe' | 'lowestDefense' }
  | { op: 'pullFoe'; at: 'farthestFoe'; stunMs?: number }
  | { op: 'summon'; unitId: string; ms: number; turret?: boolean; inheritAspd?: boolean; atkPctOfParent?: number; hpPctOfParent?: number }
  | { op: 'pierceProjectile'; at: 'farthestFoe' | 'current'; hits?: number; falloffPct?: number; type?: DamageType; scale: SkillScale }
  | { op: 'undying'; ms: number; drPct?: number; drMs?: number; onTrigger?: SkillPrimitive[] }
  | { op: 'gainMana'; amount: number }
  | { op: 'scaleFromMana'; hpPctCap: number; atkPctCap: number; perManaPct: number }
  | { op: 'float'; ms: number; radiusFrom: number; radiusTo: number; pctFrom: number; pctTo: number; hpThresholdPct: number; share?: boolean }
  | { op: 'stack'; key: string; add: number; perTarget?: boolean; max?: number; radius?: number }
  | { op: 'clearStack'; key: string }
  | { op: 'gold'; amount: number }
  | { op: 'consumeStacks'; key: string; per: SkillScale; radius?: number; clear?: boolean }
  | { op: 'transform'; atkFromMaxHpPct?: number; aspdPct?: number }
  | { op: 'rider'; ms: number; everyNth?: number; effects: SkillPrimitive[] }
  | { op: 'delayed'; ms: number; effects: SkillPrimitive[] }
  | { op: 'conditional'; when: { selfHpBelowPct?: number; selfHpAbovePct?: number; teamHpBelowPct?: number; teamHpAbovePct?: number; targetAtkBelowSelf?: boolean; selfShielded?: boolean; targetDistanceAbove?: number; targetDistanceAtMost?: number; targetHpBelowPct?: number; targetRoleIn?: string[]; castParity?: 'odd' | 'even'; stackBelow?: { key: string; value: number }; stackAtLeast?: { key: string; value: number }; costAtLeast?: number; playerHpLowest?: boolean }; effects: SkillPrimitive[] }
  | { op: 'everyNthAttack'; every: number; effects: SkillPrimitive[] }
  | { op: 'revive'; max: number; radius?: number; moveTo?: 'farthestFoe'; scale?: SkillScale };

export type UnitSkill = { name: string; mana: number; passiveStats?: StatOp[]; attack?: SkillScale; passive?: boolean; cast?: SkillPrimitive[]; onAttack?: SkillPrimitive[]; onKill?: SkillPrimitive[]; onBattleStart?: SkillPrimitive[]; onDamaged?: SkillPrimitive[]; onDeath?: SkillPrimitive[]; tick?: { everyMs: number; effects: SkillPrimitive[] } };

export const unitSkills: Record<string, UnitSkill> = {};
export function unitSkill(id: string): UnitSkill | undefined { return packUnitSkill(id); }
