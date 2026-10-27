import { activeRoster, allPackUnits } from '../../packs/registry';
import type { UnitDef } from './types';

const unitsById = new Map(allPackUnits().map((unit) => [unit.id, unit]));

export function getUnit(id: string): UnitDef {
  const unit = findUnit(id);
  if (!unit) throw new Error(`unknown unit: ${id}`);
  return unit;
}

export function findUnit(id: string): UnitDef | null {
  return unitsById.get(id) ?? null;
}

export function playableUnits(): UnitDef[] {
  return poolUnits();
}

export function poolUnits(): UnitDef[] {
  return activeRoster();
}

export function autochessCostOf(unit: UnitDef): UnitDef['cost'] {
  return unit.autochessCost ?? unit.cost;
}

export function unitsByCost(cost: number): UnitDef[] {
  return poolUnits().filter((unit) => autochessCostOf(unit) === cost);
}
