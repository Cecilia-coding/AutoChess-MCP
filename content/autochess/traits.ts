import { aiTraits } from '../../packs/ai/traits';
import { jianghuTraits } from '../../packs/jianghu/traits';
import { traitsWithData } from './trait-tiers';
import type { FactionId, TraitDef } from './types';

export const TRAIT_PACKS: Record<string, readonly TraitDef[]> = {
  ai: aiTraits,
  jianghu: jianghuTraits,
};

export const traits: TraitDef[] = traitsWithData([...aiTraits, ...jianghuTraits]);

export function packTraits(packId: string | undefined | null): readonly TraitDef[] {
  return TRAIT_PACKS[packId ?? 'ai'] ?? aiTraits;
}

export const sliceFactions: FactionId[] = aiTraits
  .filter((trait) => trait.kind === 'faction')
  .map((trait) => trait.id);

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
