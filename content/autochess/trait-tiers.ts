import type { StatKey, StatOp } from './stats-vocab';
import type { TraitMechanic, TraitTier } from './types';

type TierMap = Record<number, TraitTier>;
const ops = (...pairs: readonly (readonly [StatKey, number])[]): StatOp[] =>
  pairs.map(([stat, value]) => ({ stat, value }));
const tiers = (table: Record<number, StatOp[]>): TierMap =>
  Object.fromEntries(Object.entries(table).map(([tier, stats]) => [Number(tier), { stats }]));

export const traitTiers: Record<string, TierMap> = {
  frontier: tiers({ 2: ops(['dmgPct', 12], ['drPct', 12]), 4: ops(['dmgPct', 22], ['drPct', 22]) }),
  orient: tiers({ 2: ops(['aspdPct', 15], ['manaRegenPct', 20]), 4: ops(['aspdPct', 28], ['manaRegenPct', 35]), 6: ops(['aspdPct', 42], ['manaRegenPct', 50]), 8: ops(['aspdPct', 58], ['manaRegenPct', 65]) }),
  opensource: tiers({ 2: ops(['skillPct', 12]), 4: ops(['skillPct', 22], ['atkPct', 12]), 6: ops(['skillPct', 34], ['atkPct', 20]) }),
  indie: tiers({ 2: ops(['atkPct', 10], ['hpPct', 10], ['drPct', 5]), 4: ops(['atkPct', 18], ['hpPct', 18], ['drPct', 8]), 6: ops(['atkPct', 28], ['hpPct', 28], ['drPct', 12]) }),
  showdown: tiers({ 2: ops(['dmgPct', 8], ['drPct', 8]), 4: ops(['dmgPct', 15], ['drPct', 15]), 6: ops(['dmgPct', 22], ['drPct', 22]) }),
  reasoning: tiers({ 2: ops(['critPct', 15], ['critDamagePct', 30]), 4: ops(['critPct', 28], ['critDamagePct', 65]) }),
  coding: tiers({ 2: ops(['aspdPct', 20], ['skillPct', 10]) }),
  agent: tiers({ 2: ops(['atkPct', 12], ['aspdPct', 12]), 4: ops(['atkPct', 22], ['aspdPct', 22]), 6: ops(['atkPct', 34], ['aspdPct', 34]) }),
  multimodal: tiers({ 2: ops(['dmgPct', 10], ['penetrationFlat', 15]), 4: ops(['dmgPct', 18], ['penetrationFlat', 30]), 6: ops(['dmgPct', 28], ['penetrationFlat', 45]) }),
  longcontext: tiers({ 2: ops(['range', 1], ['distanceDamagePctPerTile', 8]), 4: ops(['range', 1], ['distanceDamagePctPerTile', 16]) }),
  speed: tiers({ 2: ops(['aspdPct', 30], ['moveSpeedPct', 10]) }),
  value: tiers({ 2: ops(['hpPct', 12], ['drPct', 5]), 4: ops(['hpPct', 22], ['drPct', 10]), 6: ops(['hpPct', 32], ['drPct', 15]) }),
  alignment: tiers({ 2: ops(['drPct', 10], ['armorPct', 12], ['mrPct', 12]), 4: ops(['drPct', 18], ['armorPct', 24], ['mrPct', 24]), 6: ops(['drPct', 28], ['armorPct', 38], ['mrPct', 38]) }),
  companion: tiers({ 2: ops(['healReceivePct', 15], ['hpPct', 10]), 4: ops(['healReceivePct', 25], ['hpPct', 20], ['regenPctPerSec', 1]), 6: ops(['healReceivePct', 38], ['hpPct', 32], ['regenPctPerSec', 2]) }),
  canal: tiers({ 2: ops(['hpPct', 18]), 4: ops(['hpPct', 35]) }),
  escort: tiers({ 2: ops(['armor', 25], ['mr', 25]), 4: ops(['armor', 55], ['mr', 55]) }),
  troupe: tiers({ 2: ops(['skillPct', 18]), 3: ops(['skillPct', 36]) }),
  blade: tiers({ 2: ops(['atkPct', 16]), 4: ops(['atkPct', 34]) }),
  yamen: tiers({ 2: ops(['aspdPct', 12]), 4: ops(['aspdPct', 28]) }),
  warrior: tiers({ 2: ops(['atkPct', 10], ['hpPct', 8]), 4: ops(['atkPct', 18], ['hpPct', 15]), 6: ops(['atkPct', 28], ['hpPct', 24]) }),
  brawler: tiers({ 2: ops(['hpPct', 16], ['armor', 20]), 4: ops(['hpPct', 30], ['armor', 45]) }),
  marksman: tiers({ 2: ops(['aspdPct', 16]), 4: ops(['aspdPct', 30], ['range', 1]) }),
  assassin: tiers({ 2: ops(['critPct', 12], ['critDamagePct', 20]), 4: ops(['critPct', 24], ['critDamagePct', 45]) }),
  fortress: tiers({ 2: ops(['armor', 25], ['mr', 25]), 4: ops(['armor', 50], ['mr', 50], ['drPct', 8]) }),
  sustain: tiers({ 2: ops(['hpPct', 12], ['regenPctPerSec', 1]), 4: ops(['hpPct', 24], ['regenPctPerSec', 2]) }),
  advisor: tiers({ 2: ops(['skillPct', 14], ['manaRegenPct', 15]), 4: ops(['skillPct', 28], ['manaRegenPct', 30]) }),
};

export const traitMechanics: Record<string, TraitMechanic[]> = {
  showdown: [{ id: 'campStandoff', campA: 'opensource', campB: 'frontier', at: 2, shieldPct: 15, atkPct: 15 }],
};

export const traitPending: Record<string, string[]> = {};

export function traitsWithData<T extends { id: string }>(list: readonly T[]): (T & { tierEffects?: TierMap; mechanics?: TraitMechanic[]; pending?: string[] })[] {
  return list.map((trait) => ({ ...trait, tierEffects: traitTiers[trait.id], mechanics: traitMechanics[trait.id], pending: traitPending[trait.id] }));
}
