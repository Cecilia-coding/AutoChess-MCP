import type { HexDef, ItemDef, TraitDef, UnitDef } from '../content/autochess/types';
import { listJourneyHexes } from '../content/autochess/hexes';
import { aiPack } from './ai';
import { jianghuPack } from './jianghu';
import { rpHexes } from './rp/hexes';
import { rpItems } from './rp/items';
import { indexPacks, type PackDefinition, type PackTerms } from './types';
import {
  getEphemeralPack,
  isRuntimePackId,
  listEphemeralPackIds,
  registerEphemeralPack,
  unregisterEphemeralPack,
  findEphemeralUnit,
  findEphemeralTrait,
  findEphemeralItem,
  findEphemeralSkill,
  resolveUnitSpriteId,
  type RuntimePackId,
} from './ephemeral-registry';

export {
  getEphemeralPack,
  isRuntimePackId,
  listEphemeralPackIds,
  registerEphemeralPack,
  unregisterEphemeralPack,
  findEphemeralUnit,
  findEphemeralTrait,
  findEphemeralItem,
  findEphemeralSkill,
  resolveUnitSpriteId,
  type RuntimePackId,
};

const RP_ENABLED = process.env.CHESS_RP === '1';

export const PACKS = indexPacks(aiPack, jianghuPack);
export type PackId = keyof typeof PACKS;
export type AnyPackId = PackId | RuntimePackId;
export const PACK_LIST: readonly PackDefinition[] = Object.values(PACKS);
const BUILTIN_DEFAULT_PACK_ID: PackId = aiPack.id;

export function isAnyPackId(value: unknown): value is AnyPackId {
  return isPackId(value) || isRuntimePackId(value);
}

function assertUnique(kind: string, ids: readonly string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`duplicate ${kind} id: ${id}`);
    seen.add(id);
  }
}

assertUnique('unit', PACK_LIST.flatMap((pack) => [...pack.roster, ...(pack.forms ?? [])].map((entry) => entry.id)));
assertUnique('trait', PACK_LIST.flatMap((pack) => pack.traits.map((entry) => entry.id)));
assertUnique('item', PACK_LIST.flatMap((pack) => pack.items.map((entry) => entry.id)));
for (const pack of PACK_LIST) {
  const itemIds = new Set(pack.items.map((item) => item.id));
  const unknownKitItem = pack.kitItems?.find((id) => !itemIds.has(id));
  if (unknownKitItem) throw new Error(`unknown ${pack.id} kit item: ${unknownKitItem}`);
}

export const DEFAULT_PACK_ID: PackId = parsePackId(process.env.CHESS_PACK);
export const ACTIVE_PACK_ID = DEFAULT_PACK_ID;

export function isPackId(value: unknown): value is PackId {
  return typeof value === 'string' && Object.hasOwn(PACKS, value);
}

export function parsePackId(value: string | undefined | null): PackId {
  if (!value) return BUILTIN_DEFAULT_PACK_ID;
  if (Object.hasOwn(PACKS, value)) return value as PackId;
  throw new Error(`unknown pack: ${value}`);
}

export function parseAnyPackId(value: string | undefined | null): AnyPackId {
  if (!value) return BUILTIN_DEFAULT_PACK_ID;
  if (Object.hasOwn(PACKS, value)) return value as PackId;
  if (isRuntimePackId(value)) return value;
  throw new Error(`unknown pack: ${value}`);
}

export function packDefinition(id?: string | null): PackDefinition {
  const packId = parseAnyPackId(id ?? DEFAULT_PACK_ID);
  return isRuntimePackId(packId) ? getEphemeralPack(packId)! : PACKS[packId];
}

export function packRoster(id: string | undefined): UnitDef[] {
  return packDefinition(id).roster;
}

export function packTraits(id: string | undefined): readonly TraitDef[] {
  return packDefinition(id).traits;
}

export function packItems(id: string | undefined): ItemDef[] {
  return [...packDefinition(id).items, ...(RP_ENABLED ? rpItems : [])];
}

export function packTerms(id: string | undefined): PackTerms {
  return packDefinition(id).terms;
}

export function allPackUnits(): UnitDef[] {
  return PACK_LIST.flatMap((pack) => [...pack.roster, ...(pack.forms ?? [])]);
}

export function allPackTraits(): TraitDef[] {
  return PACK_LIST.flatMap((pack) => pack.traits);
}

export function allPackItems(): ItemDef[] {
  return [...PACK_LIST.flatMap((pack) => pack.items), ...(RP_ENABLED ? rpItems : [])];
}

export function allPackSkills() {
  return Object.assign({}, ...PACK_LIST.map((pack) => pack.skills ?? {}));
}

export function packMeta(id: string | undefined) {
  const packId = parseAnyPackId(id ?? DEFAULT_PACK_ID);
  const pack = packDefinition(packId);
  return { id: packId, name: pack.displayName, icon: pack.icon, description: pack.description, units: pack.roster.length };
}

export type PackSummary = { id: PackId; name: string; icon: string; description: string; units: number };
export const PACK_SUMMARIES: PackSummary[] = PACK_LIST.map((pack) => ({
  id: pack.id as PackId,
  name: pack.displayName,
  icon: pack.icon,
  description: pack.description,
  units: pack.roster.length,
}));

export type PackOpening = { readonly label: string; readonly tiers: readonly (readonly string[])[] };

export function packOpening(id: string | undefined): PackOpening | undefined {
  return packDefinition(id).opening;
}

export function packHexes(id: string | undefined): readonly HexDef[] {
  const packId = parseAnyPackId(id ?? DEFAULT_PACK_ID);
  const pack = packDefinition(packId);
  const base = listJourneyHexes(packId);
  return RP_ENABLED ? [...base, ...(pack.hexes ?? []), ...rpHexes] : [...base, ...(pack.hexes ?? [])];
}

export function packDraftTiles(id: string | undefined): readonly { name: string; detail: string }[] | undefined {
  return packDefinition(id).draftTiles;
}

export function packDraftIntro(id: string | undefined): string | undefined {
  return packDefinition(id).draftIntro;
}

export function packKitItems(id: string | undefined): readonly string[] {
  return packDefinition(id).kitItems ?? [];
}

export function activeRoster(): UnitDef[] {
  return packRoster(DEFAULT_PACK_ID);
}
