import { SLICE_SHOP_ODDS } from './constants';
import { createRng } from './rng';

export type CostTier = 1 | 2 | 3 | 4;

export function normalizeOdds(
  odds: Record<CostTier, number>,
  available: Partial<Record<CostTier, number>>,
): Record<CostTier, number> {
  const next: Record<CostTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let total = 0;
  for (const tier of [1, 2, 3, 4] as CostTier[]) {
    if (odds[tier] <= 0) continue;
    if ((available[tier] ?? 0) <= 0) continue;
    next[tier] = odds[tier];
    total += odds[tier];
  }
  if (total <= 0) return next;
  for (const tier of [1, 2, 3, 4] as CostTier[]) {
    if (next[tier] > 0) next[tier] = next[tier] / total;
  }
  return next;
}

export function rollCostTier(
  seed: number,
  salt: number,
  available: Partial<Record<CostTier, number>>,
  odds: Record<CostTier, number> = SLICE_SHOP_ODDS,
): CostTier | null {
  const table = normalizeOdds(odds, available);
  const rng = createRng((seed ^ (salt * 0x9e3779b9)) >>> 0);
  const roll = rng.next();
  let cursor = 0;
  for (const tier of [1, 2, 3, 4] as CostTier[]) {
    cursor += table[tier];
    if (table[tier] > 0 && roll < cursor) return tier;
  }
  return null;
}
