import type { ItemDef, TraitDef, UnitDef } from '../content/autochess/types';
import type { UnitSkill } from '../content/autochess/unit-skills';
import type { PackDefinition } from './types';

export type RuntimePackId = `custom:${string}`;

const MAX_EPHEMERAL_PACKS = 128;
const ephemeralPacks = new Map<RuntimePackId, PackDefinition>();

export function isRuntimePackId(value: unknown): value is RuntimePackId {
  return typeof value === 'string' && value.startsWith('custom:') && ephemeralPacks.has(value as RuntimePackId);
}

export function registerEphemeralPack(pack: PackDefinition): RuntimePackId {
  if (!pack.id.startsWith('custom:')) {
    throw new Error(`runtime pack id must start with custom:, got: ${pack.id}`);
  }
  const id = pack.id as RuntimePackId;
  if (ephemeralPacks.has(id)) {
    ephemeralPacks.delete(id);
  } else if (ephemeralPacks.size >= MAX_EPHEMERAL_PACKS) {
    const oldest = ephemeralPacks.keys().next().value;
    if (oldest) ephemeralPacks.delete(oldest);
  }
  ephemeralPacks.set(id, pack);
  return id;
}

export function unregisterEphemeralPack(id: string): boolean {
  return ephemeralPacks.delete(id as RuntimePackId);
}

export function getEphemeralPack(id: string): PackDefinition | undefined {
  return id.startsWith('custom:') ? ephemeralPacks.get(id as RuntimePackId) : undefined;
}

export function listEphemeralPackIds(): RuntimePackId[] {
  return [...ephemeralPacks.keys()];
}

export function findEphemeralUnit(id: string): UnitDef | null {
  for (const pack of ephemeralPacks.values()) {
    const direct = pack.roster.find((unit) => unit.id === id) ?? pack.forms?.find((unit) => unit.id === id);
    if (direct) return direct;
  }
  return null;
}

export function findEphemeralTrait(id: string): TraitDef | null {
  for (const pack of ephemeralPacks.values()) {
    const trait = pack.traits.find((entry) => entry.id === id);
    if (trait) return trait;
  }
  return null;
}

export function findEphemeralItem(id: string): ItemDef | null {
  for (const pack of ephemeralPacks.values()) {
    const item = pack.items.find((entry) => entry.id === id);
    if (item) return item;
  }
  return null;
}

export function findEphemeralSkill(id: string): UnitSkill | undefined {
  for (const pack of ephemeralPacks.values()) {
    const skill = pack.skills?.[id];
    if (skill) return skill;
  }
  return undefined;
}

export function resolveUnitSpriteId(templateId: string): string {
  return findEphemeralUnit(templateId)?.spriteId ?? templateId;
}

