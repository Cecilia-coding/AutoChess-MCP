import { aiForms, aiRoster } from '../../packs/ai/roster';
import { jianghuRoster } from '../../packs/jianghu/roster';
import { activeRoster } from '../../packs/registry';
import type { UnitDef } from './types';

const allUnits: UnitDef[] = [...aiRoster, ...aiForms, ...jianghuRoster];

export function getUnit(id: string): UnitDef {
  const unit = findUnit(id);
  if (!unit) throw new Error(`unknown unit: ${id}`);
  return unit;
}

export function findUnit(id: string): UnitDef | null {
  return allUnits.find((unit) => unit.id === id) ?? null;
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
