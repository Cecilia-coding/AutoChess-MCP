import type { StatKey } from './stats-vocab';
import type { TraitDef, TraitKind, TraitTier } from './types';

export function traitTier(...stats: readonly (readonly [StatKey, number])[]): TraitTier {
  return { stats: stats.map(([stat, value]) => ({ stat, value })) };
}

export function defineTrait(
  id: string,
  name: string,
  kind: TraitKind,
  ladders: string,
  tierEffects: Record<number, TraitTier>,
  options: Pick<TraitDef, 'mechanics' | 'pending'> = {},
): TraitDef {
  const tiers = Object.keys(tierEffects).map(Number).sort((a, b) => a - b);
  return { id, name, kind, tiers, ladders, tierEffects, ...options };
}
