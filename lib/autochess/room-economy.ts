import { getGameConfig } from '../meta/game-config';
import { autochessCostOf } from '../../content/autochess/units';
import { findHex, refreshDiscountFromHex } from '../../content/autochess/hexes';
import type { UnitDef } from '../../content/autochess/types';
import type { RoomSelf } from './room-types';

export function roomShopPrice(seat: Pick<RoomSelf, 'roundHazards'>, unit: UnitDef): number {
  return Math.max(0, autochessCostOf(unit) + (seat.roundHazards?.priceDelta?.[unit.id] ?? 0));
}

export function permanentFreeRefreshesPerRound(hexIds: readonly string[] | undefined): number {
  let perRound = 0;
  for (const id of hexIds ?? []) {
    perRound += findHex(id)?.freeRefreshesPerRound ?? 0;
  }
  return perRound;
}

export function seatInterestPreview(
  seat: Pick<RoomSelf, 'gold' | 'hexes'>,
  baseCap = getGameConfig().pacing.baseInterestCap,
  packId?: string,
  round = 1,
): { interest: number; cap: number; flat: number } {
  let cap = baseCap;
  let flat = 0;
  for (const hexId of seat.hexes ?? []) {
    const hex = findHex(hexId, packId);
    if (!hex) continue;
    if (hex.interestCap !== undefined) cap = hex.interestCap;
    if (hex.roundIncome) {
      const stage = round <= 4 ? 1 : round <= 8 ? 2 : 3;
      flat += hex.roundIncome[stage] ?? hex.roundIncome[Math.max(...Object.keys(hex.roundIncome).map(Number))] ?? 0;
    }
  }
  if (cap <= 0) return { interest: flat, cap: 0, flat };
  const interest = Math.min(cap, Math.floor((seat.gold ?? 0) / 10));
  return { interest: flat + interest, cap, flat };
}

export function roomRefreshPrice(
  seat: Pick<RoomSelf, 'freeRefreshes' | 'shopRefresh' | 'hexes'>,
  round: number,
  baseCost = getGameConfig().pacing.shopRefreshCost,
): number {
  if (seat.freeRefreshes && round <= seat.freeRefreshes.until && seat.freeRefreshes.left > 0) return 0;
  const used = seat.shopRefresh ?? 0;
  if (used < permanentFreeRefreshesPerRound(seat.hexes)) return 0;
  if (used !== 0) return baseCost;
  let discount = 0;
  for (const id of seat.hexes ?? []) {
    const hex = findHex(id);
    if (!hex) continue;
    const rule = refreshDiscountFromHex(hex);
    if (!rule) continue;
    if (rule.free) return 0;
    discount = Math.max(discount, rule.discount);
  }
  return Math.max(0, baseCost - discount);
}
