import type { HexRarity } from '../../content/autochess/types';

import { MODE_PACKS, modePack, type MatchModeId } from '../../packs/modes/registry';
import type { ModeRules } from '../../packs/modes/types';
export type { MatchModeId } from '../../packs/modes/registry';

export type HexPick = { round: number; rarity: HexRarity };

export const MIN_SEATS = 2;
export const MAX_SEATS = 16;

/** 2/4/6/8… Traditional default is 8. Pairing needs even capacity; odd leftovers use a ghost. */
export function evenSeatCount(raw: unknown, fallback = 8): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_SEATS || n > MAX_SEATS || n % 2 !== 0) return fallback;
  return n;
}

export type MatchRules = ModeRules & { id: MatchModeId; hexPicks: HexPick[] };

export function buildHexPicks(every: number, first: number, rarities: readonly HexRarity[], until: number): HexPick[] {
  const cadence = Math.max(1, Math.trunc(every) || 1);
  const start = Math.max(1, Math.trunc(first) || 1);
  const ladder = rarities.length ? rarities : (['blue'] as HexRarity[]);
  const picks: HexPick[] = [];
  let index = 0;
  for (let round = start; round <= until; round += cadence) {
    picks.push({ round, rarity: ladder[Math.min(index, ladder.length - 1)]! });
    index += 1;
  }
  return picks;
}

export const MATCH_MODES = Object.fromEntries(Object.entries(MODE_PACKS).map(([id, pack]) => [id, {
  ...pack.rules, id, hexPicks: buildHexPicks(pack.rules.hexEvery, pack.rules.hexFirst, pack.rules.hexRarities, pack.rules.hardRoundCap),
}])) as Record<MatchModeId, MatchRules>;

export function parseMatchMode(value?: string | null): MatchModeId {
  return modePack(value).id;
}
export function matchRules(mode?: string | null, seats?: unknown): MatchRules {
  const pack = modePack(mode);
  const base = MATCH_MODES[pack.id];
  return { ...base, hexRarities: [...base.hexRarities], hexPicks: base.hexPicks.map(pick => ({...pick})),
    seatCount: pack.seatPolicy === 'fixed' ? base.seatCount : evenSeatCount(seats ?? process.env.CHESS_SEATS, base.seatCount) };
}

export function hexPickAt(round: number, rules: MatchRules = matchRules()): HexRarity | null {
  return rules.hexPicks.find((entry) => entry.round === round)?.rarity ?? null;
}

/** Current loot/hex era: last issued rarity, or the first rung before any pick. */
export function stageRarity(round: number, rules: MatchRules = matchRules()): HexRarity {
  let rarity = rules.hexRarities[0] ?? 'blue';
  for (const pick of rules.hexPicks) {
    if (round < pick.round) break;
    rarity = pick.rarity;
  }
  return rarity;
}

export function boardSkinId(seatIndex: number): string {
  return `board-${seatIndex}`;
}
