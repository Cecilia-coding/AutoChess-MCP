import { rpHexes } from '../../packs/rp/hexes';
import type { Combatant } from '../../lib/autochess/types';
import { hexPickAt, matchRules, type MatchRules } from '../../lib/autochess/match-rules';
import { createRng, hash32 } from '../../lib/autochess/rng';
import type { HexDef, HexRarity } from './types';

export type { HexDef, HexRarity };

/** @deprecated Read matchRules().hexPicks. Kept as a snapshot of the live standard table. */
export const HEX_PICK_ROUNDS: Record<number, HexRarity> = Object.fromEntries(
  matchRules('standard').hexPicks.map((entry) => [entry.round, entry.rarity]),
);

export function hexRarityLabel(rarity: HexRarity): string {
  if (rarity === 'gold') return '金色';
  if (rarity === 'purple') return '紫色';
  if (rarity === 'orange') return '橙色';
  return '蓝色';
}

/** RP 梗包开关：`CHESS_RP=1` 时把 packs/rp 的心悟并入查找表（默认不生效）。 */
const RP_ENABLED = process.env.CHESS_RP === '1';

export const hexes: HexDef[] = RP_ENABLED ? [...rpHexes] : [];

export function findHex(id: string): HexDef | null {
  return hexes.find((entry) => entry.id === id) ?? null;
}

export function getHex(id: string): HexDef {
  const hex = findHex(id);
  if (!hex) throw new Error(`unknown hex: ${id}`);
  return hex;
}

export function withHexes(board: Combatant[], hexIds: string[] | undefined): Combatant[] {
  if (!hexIds?.length) return board;
  return board.map((piece) => ({ ...piece, hexIds }));
}

export function hexLabel(ids: string[] | undefined): string {
  if (!ids?.length) return '';
  return ids.map((id) => findHex(id)?.name ?? id).join('、');
}

export function hexPickRarity(round: number, rules: MatchRules = matchRules()): HexRarity | null {
  return hexPickAt(round, rules);
}

/** Dump notes mix pick grants with later economy. Only the pick-time gold is paid. */
export function immediateHexGold(hex: Pick<HexDef, 'gold' | 'note'>): number {
  const note = hex.note ?? '';
  // 只有明确给「金币」的立即获得才算钱（例：多多益善是「立即获得 8/12/20 次免费刷新」，不是 8 金）。
  const instant = note.match(/立即获得\s*(\d+)(?:\/\d+)*\s*金/);
  if (instant) return Number(instant[1]);
  const leading = note.match(/^获得\s*(\d+)(?:\/\d+)*\s*金币/);
  if (leading) return Number(leading[1]);
  const delayed = /(接下来|回合后|失败时|阵亡时|击杀|胜利时|每获得|每个对战|升级时|升至|触发|没有则|最多获得)/;
  for (const chunk of note.split(/[；。]/)) {
    if (delayed.test(chunk)) continue;
    const match = chunk.match(/获得\s*(\d+)(?:\/\d+)*\s*金币/);
    if (match) return Number(match[1]);
  }
  return 0;
}

/** 养精蓄锐: current round plus the next N-1 cannot buy; gold lands on pickRound+N. */
export function shopBanFromHex(hex: Pick<HexDef, 'id' | 'note'>, pickRound: number) {
  const ban = hex.note.match(/接下来\s*(\d+)\s*回合禁止购买/);
  if (!ban) return null;
  const rounds = Number(ban[1]);
  const pay = hex.note.match(/(\d+)\s*回合后获得\s*(\d+)\s*金币/);
  return {
    hex: hex.id,
    untilRound: pickRound + rounds - 1,
    payoutRound: pickRound + (pay ? Number(pay[1]) : rounds),
    gold: pay ? Number(pay[2]) : 0,
  };
}

export function shopBanned(untilRound: number | undefined, round: number) {
  return (untilRound ?? 0) >= round;
}

/** 投石成金: N combat rounds after the pick, pay bonus gold only if seat holds >= threshold. */
export function delayedGoldBonus(
  hex: Pick<HexDef, 'id' | 'note'>,
  pickRound: number,
): { hex: string; round: number; gold: number; minGold: number } | null {
  const match = hex.note.match(/若\s*(\d+)\s*个对战回合后拥有金币数量不低于\s*(\d+)，则额外获得\s*(\d+)/);
  if (!match) return null;
  return { hex: hex.id, round: pickRound + Number(match[1]), gold: Number(match[3]), minGold: Number(match[2]) };
}

/** 胜绩累资: every N wins pays M gold, then the tally restarts. */
export function winGoldPerStreak(hex: Pick<HexDef, 'id' | 'note'>): { hex: string; wins: number; gold: number } | null {
  const match = hex.note.match(/每获得\s*(\d+)\s*场胜利，获得\s*(\d+)\s*金币/);
  if (!match) return null;
  return { hex: hex.id, wins: Number(match[1]), gold: Number(match[2]) };
}

/** 塞翁失马: each own piece that dies in battle rolls a pct chance for gold. */
export function deathGoldChance(hex: Pick<HexDef, 'note'>): { pct: number; gold: number } | null {
  const match = hex.note.match(/棋子阵亡时，有\s*(\d+)%\s*概率获得\s*(\d+)\s*金币/);
  if (!match) return null;
  return { pct: Number(match[1]), gold: Number(match[2]) };
}

/** 抢占先机: for the next N rounds, K shop refreshes per round that cost no gold. */
export function freeRefreshGrant(
  hex: Pick<HexDef, 'id' | 'note'>,
  pickRound: number,
): { hex: string; until: number; perRound: number } | null {
  const match = hex.note.match(/接下来(?:三个|(\d+))回合都会获得\s*(\d+)\s*次仅可在本回合使用的刷新次数/);
  if (!match) return null;
  const rounds = match[1] ? Number(match[1]) : 3;
  return { hex: hex.id, until: pickRound + rounds - 1, perRound: Number(match[2]) };
}

/** 物美价廉/囊中取物: the first paid refresh each round costs less (free = full waiver). */
export function refreshDiscountFromHex(hex: Pick<HexDef, 'note'>): { free: boolean; discount: number } | null {
  if (/每个对战回合首次刷新商店免费/.test(hex.note)) return { free: true, discount: 0 };
  const match = hex.note.match(/每个对战回合首次消耗金币刷新商店减少\s*(\d+)\s*枚/);
  if (!match) return null;
  return { free: false, discount: Number(match[1]) };
}

/**
 * Resolve "获得 1 个某某棋子" hexes against the room's own roster, so swapping packs
 * needs no per-hex edits. Explicit grantUnitId wins; otherwise the note must say
 * 获得 1 个 and name exactly one roster unit.
 */
export function grantUnitFromNote(hex: Pick<HexDef, 'grantUnitId' | 'note'>, roster: { id: string; name: string }[]): string | null {
  if (hex.grantUnitId) return hex.grantUnitId;
  // 奖励文案可能同时包含装备名与棋子名，统一按「恰好一个在册棋名」判定。
  const matches = roster.filter((unit) => hex.note.includes(unit.name));
  return matches.length === 1 ? matches[0]!.id : null;
}

export function scoreHex(hex: HexDef): number {
  return (hex.atkPct ?? 0)
    + (hex.hpPct ?? 0)
    + (hex.skillPct ?? 0)
    + (hex.aspdPct ?? 0)
    + (hex.drPct ?? 0) * 1.2
    + (hex.armorPct ?? 0)
    + (hex.mrPct ?? 0)
    + immediateHexGold(hex) * 0.4
    + (hex.grantUnitId ? 80 : 0);
}

export function pickBestHex(offer: readonly HexDef[]): HexDef | undefined {
  let best = offer[0];
  if (!best) return undefined;
  for (const hex of offer) {
    if (scoreHex(hex) > scoreHex(best)) best = hex;
  }
  return best;
}

export function compactHex(hex: HexDef) {
  const gold = immediateHexGold(hex);
  return { id: hex.id, name: hex.name, rarity: hex.rarity, note: hex.note, gold: gold || undefined };
}

function publicHexPool(rarity: HexRarity, owned: ReadonlySet<string>, pool: readonly HexDef[]): HexDef[] {
  const wanted = rarity === 'orange' ? new Set<HexRarity>(['orange', 'gold']) : new Set<HexRarity>([rarity]);
  return pool.filter((hex) => wanted.has(hex.rarity) && !owned.has(hex.id));
}

/**
 * 从**所在包**的心悟池抽三选一。池由调用方传入（房间用 `packHexes(room.pack)`），
 * 每套棋谱只读取自己声明的心悟；未声明时返回空。
 */
export function makeHexOffer(seed: number, round: number, owned: readonly string[], pool: readonly HexDef[], rules: MatchRules = matchRules()): HexDef[] {
  const rarity = hexPickRarity(round, rules);
  if (!rarity || !pool.length) return [];
  const ownedSet = new Set(owned);
  const candidates = publicHexPool(rarity, ownedSet, pool);
  const fallback = pool.filter((hex) => hex.rarity !== 'orange' && !ownedSet.has(hex.id));
  const source = candidates.length >= 3 ? candidates : fallback;
  const rng = createRng(hash32(seed, round, 3101));
  const remaining = [...source];
  const choices: HexDef[] = [];
  while (choices.length < 3 && remaining.length) {
    const index = rng.int(remaining.length);
    choices.push(remaining.splice(index, 1)[0]!);
  }
  return choices;
}
