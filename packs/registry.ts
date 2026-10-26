import type { HexDef, TraitDef, UnitDef } from '../content/autochess/types';
import { aiPack } from './ai';
import { aiTraits } from './ai/traits';
import { jianghuPack } from './jianghu';
import { jianghuTraits } from './jianghu/traits';
import { rpHexes } from './rp/hexes';

const RP_ENABLED = process.env.CHESS_RP === '1';

export const PACKS = { ai: aiPack, jianghu: jianghuPack } as const;
export type PackId = keyof typeof PACKS;

export const PACK_TRAITS: Record<PackId, readonly TraitDef[]> = {
  ai: aiTraits,
  jianghu: jianghuTraits,
};

export const PACK_LIST = [PACKS.ai, PACKS.jianghu];
export const DEFAULT_PACK_ID: PackId = parsePackId(process.env.CHESS_PACK);
export const ACTIVE_PACK_ID = DEFAULT_PACK_ID;

export function parsePackId(value: string | undefined | null): PackId {
  if (!value || value === 'ai') return 'ai';
  if (value === 'jianghu') return 'jianghu';
  throw new Error(`unknown pack: ${value}`);
}

export function packRoster(id: string | undefined): UnitDef[] {
  return PACKS[parsePackId(id)].roster;
}

export function packTraits(id: string | undefined): readonly TraitDef[] {
  return PACK_TRAITS[parsePackId(id)];
}

export function packMeta(id: string | undefined) {
  const pack = PACKS[parsePackId(id)];
  return { id: pack.id, name: pack.displayName, icon: pack.icon, description: pack.description, units: pack.roster.length };
}

export type PackSummary = ReturnType<typeof packMeta>;
export const PACK_SUMMARIES: PackSummary[] = PACK_LIST.map((pack) => packMeta(pack.id));

export type PackOpening = { readonly label: string; readonly tiers: readonly (readonly string[])[] };

export function packOpening(id: string | undefined): PackOpening | undefined {
  const pack = PACKS[parsePackId(id)] as { opening?: PackOpening };
  return pack.opening;
}

export function packHexes(id: string | undefined): readonly HexDef[] {
  const pack = PACKS[parsePackId(id)] as { hexes?: readonly HexDef[] };
  return RP_ENABLED ? [...(pack.hexes ?? []), ...rpHexes] : (pack.hexes ?? []);
}

export function packDraftTiles(id: string | undefined): readonly { name: string; detail: string }[] | undefined {
  const pack = PACKS[parsePackId(id)] as { draftTiles?: readonly { name: string; detail: string }[] };
  return pack.draftTiles;
}

export function packKitItems(id: string | undefined): readonly string[] {
  const pack = PACKS[parsePackId(id)] as { kitItems?: readonly string[] };
  return pack.kitItems ?? [];
}

export function activeRoster(): UnitDef[] {
  return packRoster(DEFAULT_PACK_ID);
}
