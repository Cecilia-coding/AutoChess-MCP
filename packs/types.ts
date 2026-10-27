import type { HexDef, ItemDef, TraitDef, UnitDef } from '../content/autochess/types';
import type { UnitSkill } from '../content/autochess/unit-skills';

export type PackTerms = {
  gold: { name: string; short: string };
  level: { name: string; xp: string; shop: string; upgrade: string; ladder?: readonly string[] };
  mana: { name: string };
  reroll: { name: string };
  star: { name: string; tiers: readonly [string, string, string] };
};

export type PackDefinition = {
  id: string;
  displayName: string;
  icon: string;
  description: string;
  roster: UnitDef[];
  forms?: UnitDef[];
  traits: TraitDef[];
  items: ItemDef[];
  skills?: Record<string, UnitSkill>;
  terms: PackTerms;
  opening?: { readonly label: string; readonly tiers: readonly (readonly string[])[] };
  hexes?: readonly HexDef[];
  kitItems?: readonly string[];
  draftTiles?: readonly { name: string; detail: string }[];
};

/** Keeps every pack declaration type-checked without teaching shared code its id. */
export function definePack<const T extends PackDefinition>(pack: T): T {
  return pack;
}

type PackIndex<T extends readonly PackDefinition[]> = {
  [Pack in T[number] as Pack['id']]: Pack;
};

/** Builds the typed registry from declarations and rejects duplicate ids at startup. */
export function indexPacks<const T extends readonly PackDefinition[]>(...packs: T): PackIndex<T> {
  const entries = packs.map((pack) => [pack.id, pack] as const);
  if (new Set(entries.map(([id]) => id)).size !== entries.length) throw new Error('duplicate pack id');
  return Object.fromEntries(entries) as PackIndex<T>;
}

export const GENERIC_PACK_TERMS: PackTerms = {
  gold: { name: '金币', short: '金' },
  level: { name: '等级', xp: '经验', shop: '商店', upgrade: '升级' },
  mana: { name: '内力' },
  reroll: { name: '刷新' },
  star: { name: '星级', tiers: ['1★', '2★', '3★'] },
};
