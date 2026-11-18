import { rpHexes } from '../../packs/rp/hexes';
import type { Combatant } from '../../lib/autochess/types';
import { getGameConfig, onGameConfigChange } from '../../lib/meta/game-config';
import {
  buffMatchesPack,
  compileBuffToHexDef,
  resolveBuffFlavor,
  type BuffDraftConfig,
} from '../../lib/meta/journey-buffs';
import { hexPickAt, matchRules, type MatchRules } from '../../lib/autochess/match-rules';
import { createRng, hash32 } from '../../lib/autochess/rng';
import type { HexDef, HexRarity } from './types';

export type { HexDef, HexRarity };

/** @deprecated Read matchRules().hexPicks or getGameConfig().buffs.buffRounds. */
export const HEX_PICK_ROUNDS: Record<number, HexRarity> = Object.fromEntries(
  matchRules('standard').hexPicks.map((entry) => [entry.round, entry.rarity]),
);

export function hexRarityLabel(rarity: HexRarity): string {
  if (rarity === 'orange') return '传说';
  if (rarity === 'gold') return '金色';
  if (rarity === 'purple') return '稀世';
  return '普通';
}

/** RP 梗包开关：`CHESS_RP=1` 时把 packs/rp 的心悟并入查找表（默认不生效）。 */
const RP_ENABLED = process.env.CHESS_RP === '1';

export const hexes: HexDef[] = RP_ENABLED ? [...rpHexes] : [];

let cachedBuffCfg: BuffDraftConfig | null = null;
const compiledCache = new Map<string, Map<string, HexDef>>();

function ensureCache(): void {
  const current = getGameConfig().buffs;
  if (cachedBuffCfg === current && compiledCache.size > 0) return;
  cachedBuffCfg = current;
  compiledCache.clear();
  for (const packKey of ['ai', 'jianghu', 'default'] as const) {
    const map = new Map<string, HexDef>();
    const packId = packKey === 'default' ? undefined : packKey;
    for (const rule of current.items) {
      map.set(rule.id, compileBuffToHexDef(rule, packId));
    }
    if (RP_ENABLED) {
      for (const rp of rpHexes) map.set(rp.id, rp);
    }
    compiledCache.set(packKey, map);
  }
}

onGameConfigChange(() => {
  cachedBuffCfg = null;
  compiledCache.clear();
});

export function listJourneyHexes(packId?: string): HexDef[] {
  ensureCache();
  const cfg = getGameConfig().buffs;
  const flavor = resolveBuffFlavor(packId);
  const result = cfg.items
    .filter((item) => item.enabled && buffMatchesPack(item.scope, packId))
    .map((item) => compileBuffToHexDef(item, flavor));
  return RP_ENABLED ? [...result, ...rpHexes] : result;
}

export function findHex(id: string, packId?: string): HexDef | null {
  ensureCache();
  const key = packId === undefined ? 'default' : resolveBuffFlavor(packId);
  return compiledCache.get(key)?.get(id) ?? null;
}

export function getHex(id: string, packId?: string): HexDef {
  const hex = findHex(id, packId);
  if (!hex) throw new Error(`unknown hex: ${id}`);
  return hex;
}

export function withHexes(board: Combatant[], hexIds: string[] | undefined): Combatant[] {
  if (!hexIds?.length) return board;
  return board.map((piece) => ({ ...piece, hexIds }));
}

export function hexLabel(ids: string[] | undefined, packId?: string): string {
  if (!ids?.length) return '';
  return ids.map((id) => findHex(id, packId)?.name ?? id).join('、');
}

export function hexPickRarity(round: number, rules: MatchRules = matchRules()): HexRarity | null {
  return hexPickAt(round, rules);
}

/** Only pay immediate pick-time gold (structured `immediateGold` preferred; regex fallback for RP legacy notes). */
export function immediateHexGold(hex: Pick<HexDef, 'immediateGold' | 'gold' | 'note'>): number {
  if (typeof hex.immediateGold === 'number') return hex.immediateGold;
  if (typeof hex.gold === 'number' && hex.gold > 0) return hex.gold;
  const note = hex.note ?? '';
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

/** 禁买储蓄契约：当前回合至 +banRounds-1 禁止购买，期满回合开始发 payoutGold。 */
export function shopBanFromHex(hex: Pick<HexDef, 'id' | 'note' | 'shopBanContract'>, pickRound: number) {
  if (hex.shopBanContract) {
    const rounds = Math.max(1, Math.trunc(hex.shopBanContract.banRounds));
    return {
      hex: hex.id,
      untilRound: pickRound + rounds - 1,
      payoutRound: pickRound + rounds,
      gold: hex.shopBanContract.payoutGold,
    };
  }
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

export function grantUnitFromNote(hex: Pick<HexDef, 'grantUnitId' | 'note'>, roster: { id: string; name: string }[]): string | null {
  if (hex.grantUnitId) return hex.grantUnitId;
  const matches = roster.filter((unit) => hex.note.includes(unit.name));
  return matches.length === 1 ? matches[0]!.id : null;
}

export function scoreHex(hex: HexDef): number {
  const statPack = (hex.stats ?? []).reduce((sum, op) => sum + Math.max(0, op.value), 0);
  const perTraitScore = (hex.perTraitUnit?.stats ?? []).reduce((sum, op) => sum + Math.max(0, op.value) * 3, 0);
  const interestScore =
    hex.interestCap === undefined
      ? 0
      : hex.interestCap === 0
        ? 8
        : Math.max(0, hex.interestCap - 4) * 6;
  const flatRoundIncome = hex.roundIncome ? Object.values(hex.roundIncome)[0] ?? 0 : 0;
  return (hex.atkPct ?? 0)
    + (hex.hpPct ?? 0)
    + (hex.skillPct ?? 0)
    + (hex.aspdPct ?? 0)
    + (hex.drPct ?? 0) * 1.4
    + Math.max(0, hex.armorPct ?? 0) * 0.8
    + Math.max(0, hex.mrPct ?? 0) * 0.8
    + statPack * 0.7
    + perTraitScore
    + immediateHexGold(hex) * 1.5
    + (hex.immediateXp ?? 0) * 1.2
    + (hex.roundXpBonus ?? 0) * 12
    + (hex.xpPerBuyBonus ?? 0) * 8
    + (hex.freeRefreshesPerRound ?? 0) * 14
    + (hex.immediateFreeRefreshes ?? 0) * 3
    + (hex.xpPerPaidRefresh ?? 0) * 10
    + interestScore
    + flatRoundIncome * 4
    + (hex.shopBanContract ? hex.shopBanContract.payoutGold * 0.9 : 0)
    + (hex.bonusFieldCap ?? 0) * 45
    + (hex.starUpHighestUnit ? 42 : 0)
    + (hex.itemBoxes?.length ? 24 : 0)
    + (hex.onHpBelow ? 22 : 0)
    + (hex.grantUnitId ? 30 : 0)
    + (hex.grantRandomCostUnit ? hex.grantRandomCostUnit.cost * 8 : 0)
    + (hex.controlImmune ? 18 : 0)
    + (hex.immuneSafety ? 16 : 0)
    + (hex.emergencyHealPct ?? 0) * 0.8
    + (hex.hazardModifiers ? 18 : 0);
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
