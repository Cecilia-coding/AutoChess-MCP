import { autochessCostOf } from '../../content/autochess/units';
import { findHex, refreshDiscountFromHex } from '../../content/autochess/hexes';
import type { UnitDef } from '../../content/autochess/types';
import type { RoomSelf } from './room-types';
import { SHOP_REFRESH_COST } from './core';

export function roomShopPrice(seat: Pick<RoomSelf, 'roundHazards'>, unit: UnitDef): number {
  return Math.max(0, autochessCostOf(unit) + (seat.roundHazards?.priceDelta?.[unit.id] ?? 0));
}

export function roomRefreshPrice(seat: Pick<RoomSelf, 'freeRefreshes' | 'shopRefresh' | 'hexes'>, round: number): number {
  if (seat.freeRefreshes && round <= seat.freeRefreshes.until && seat.freeRefreshes.left > 0) return 0;
  if ((seat.shopRefresh ?? 0) !== 0) return SHOP_REFRESH_COST;
  let discount = 0;
  for (const id of seat.hexes ?? []) {
    const hex = findHex(id);
    if (!hex) continue;
    const rule = refreshDiscountFromHex(hex);
    if (!rule) continue;
    if (rule.free) return 0;
    discount = Math.max(discount, rule.discount);
  }
  return Math.max(0, SHOP_REFRESH_COST - discount);
}
