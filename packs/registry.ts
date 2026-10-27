import type { HexDef, ItemDef, TraitDef, UnitDef } from '../content/autochess/types';
import { aiPack } from './ai';
import { jianghuPack } from './jianghu';
import { rpHexes } from './rp/hexes';
import { rpItems } from './rp/items';
import { indexPacks, type PackDefinition, type PackTerms } from './types';

const RP_ENABLED = process.env.CHESS_RP === '1';

export const PACKS = indexPacks(aiPack, jianghuPack);
export type PackId = keyof typeof PACKS;
export const PACK_LIST: readonly PackDefinition[] = Object.values(PACKS);
const BUILTIN_DEFAULT_PACK_ID: PackId = aiPack.id;

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

export function parsePackId(value: string | undefined | null): PackId {
  if (!value) return BUILTIN_DEFAULT_PACK_ID;
  if (Object.hasOwn(PACKS, value)) return value as PackId;
  throw new Error(`unknown pack: ${value}`);
}

export function packDefinition(id?: string | null): PackDefinition {
  return PACKS[parsePackId(id ?? DEFAULT_PACK_ID)];
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
  const packId = parsePackId(id ?? DEFAULT_PACK_ID);
  const pack = PACKS[packId];
  return { id: packId, name: pack.displayName, icon: pack.icon, description: pack.description, units: pack.roster.length };
}

export type PackSummary = ReturnType<typeof packMeta>;
export const PACK_SUMMARIES: PackSummary[] = PACK_LIST.map((pack) => packMeta(pack.id));

export type PackOpening = { readonly label: string; readonly tiers: readonly (readonly string[])[] };

export function packOpening(id: string | undefined): PackOpening | undefined {
  return packDefinition(id).opening;
}

export function packHexes(id: string | undefined): readonly HexDef[] {
  const pack = packDefinition(id);
  return RP_ENABLED ? [...(pack.hexes ?? []), ...rpHexes] : (pack.hexes ?? []);
}

export function packDraftTiles(id: string | undefined): readonly { name: string; detail: string }[] | undefined {
  return packDefinition(id).draftTiles;
}

export function packKitItems(id: string | undefined): readonly string[] {
  return packDefinition(id).kitItems ?? [];
}

export function activeRoster(): UnitDef[] {
  return packRoster(DEFAULT_PACK_ID);
}
