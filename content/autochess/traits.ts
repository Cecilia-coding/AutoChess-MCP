import { allPackTraits } from '../../packs/registry';
import type { TraitDef } from './types';

export const traits: TraitDef[] = allPackTraits();

export function getTrait(id: string): TraitDef {
  const trait = findTrait(id);
  if (!trait) throw new Error(`unknown trait: ${id}`);
  return trait;
}

export function findTrait(id: string): TraitDef | null {
  return traits.find((trait) => trait.id === id) ?? null;
}

export function isFaction(id: string): boolean {
  return findTrait(id)?.kind === 'faction';
}

export function isJob(id: string): boolean {
  return findTrait(id)?.kind === 'job';
}

export function activeTier(trait: TraitDef, count: number): number {
  let tier = 0;
  for (const step of trait.tiers) if (count >= step) tier = step;
  return tier;
}

export function nextTier(trait: TraitDef, count: number): number | null {
  return trait.tiers.find((step) => count < step) ?? null;
}
