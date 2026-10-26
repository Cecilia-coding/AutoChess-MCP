import { BENCH_CAPACITY } from './constants';
import { items, lootForRoster } from '../../content/autochess/items';
import { autochessCostOf, getUnit, poolUnits } from '../../content/autochess/units';
import type { ItemDef, UnitDef } from '../../content/autochess/types';
import type { Combatant, Star } from './types';
import { createRng, hash32, type Rng } from './rng';
import { tiles } from '../game/board';
import type { CatchupState } from './catchup';
import type { LossBounty } from './loss-bounty';
import { shopMaxCostForLevel } from './level';
import { evenSeatCount, matchRules, stageRarity } from './match-rules';

export const AUTOCHESS_PLAYER_COUNT = matchRules().seatCount;
export const AUTOCHESS_SHOP_SIZE = 5;
export const SHOP_REFRESH_COST = 2;
export const AUTOCHESS_START_GOLD = 5;
export const AUTOCHESS_INCOME = 5;
export const AUTOCHESS_START_HP = matchRules().startHp;
export function equipFromRoster(board: AutochessPiece[], bench: AutochessPiece[], inventory: string[], pieceId: string, itemId: string, loot: readonly { id: string }[] = items) {
  const piece = [...board, ...bench].find(entry => entry.id === pieceId);
  const index = inventory.indexOf(itemId);
  if (!piece || index < 0 || !loot.some(item => item.id === itemId)) return null;
  if (piece.itemIds.length >= 2 || piece.itemIds.includes(itemId)) return null;
  const equip = (entry: AutochessPiece) => entry.id === pieceId ? { ...entry, itemIds: [...entry.itemIds, itemId] } : entry;
  return { board: board.map(equip), bench: bench.map(equip), inventory: inventory.filter((_, i) => i !== index) };
}

export type AutochessPhase = 'deploy' | 'battle' | 'result' | 'shop' | 'draft_roll' | 'draft_pick' | 'game_over';

export type AutochessPiece = Combatant;

export type MergeResult = {
  board: AutochessPiece[];
  bench: AutochessPiece[];
  returnedItems: string[];
  merges: number;
  consumed: Record<string,string>;
};

export type AutochessOpponent = {
  id: string;
  name: string;
  hp: number;
  board: AutochessPiece[];
  bench?: AutochessPiece[];
  gold?: number;
  inventory?: string[];
  uniqueRewards?: string[];
  hexes?: string[];
  bonusCap?: number;
  draftPosition?: number;
  lastSkillRound?: number;
  lastDraftRound?: number;
  draftLabel?: string;
  catchup?: CatchupState;
  bounty?: LossBounty;
  shopRound?: number;
  shopUnitIds?: string[];
};

export type DraftReward =
  | { id: string; kind: 'gold'; label: string; detail: string; amount: number }
  | { id: string; kind: 'heal'; label: string; detail: string; amount: number }
  | { id: string; kind: 'mishap'; label: string; detail: string; hpLoss: number }
  | { id: string; kind: 'unit'; label: string; detail: string; unitId: string }
  | { id: string; kind: 'item'; label: string; detail: string; itemId: string }
  | { id: string; kind: 'unique'; label: string; detail: string; uniqueId: 'field-cap' | 'star-token' | 'twin-kit' };

export type DraftChoice = {
  direction: 'clockwise' | 'counterclockwise';
  index: number;
  reward: DraftReward;
};

export function unlockedMaxCost(round: number): number {
  const rules = matchRules();
  return Math.max(1, Math.min(5, rules.shopCostStart + Math.floor(Math.max(0, round - 1) / rules.shopCostEvery)));
}

export function fieldCapacity(round: number, bonusCap = 0): number {
  const rules = matchRules();
  const base = 1 + Math.floor(Math.max(0, round - 1) / rules.fieldCapEvery);
  return Math.max(1, Math.min(8, base + Math.max(0, Math.trunc(bonusCap))));
}

export function initialCost(seed: number): 1 | 2 {
  return createRng(hash32(seed, 101)).int(2) === 0 ? 1 : 2;
}

export function skillDraftDue(round: number, lastSkillRound: number): boolean { return round - lastSkillRound >= 3; }

export function shouldDraft(seed: number, round: number, lastSkillRound?: number): boolean {
  if (lastSkillRound !== undefined && skillDraftDue(round, lastSkillRound)) return true;
  return createRng(hash32(seed, round, 503)).next() < 0.5;
}

export function rollDraft(seed: number, round: number): number {
  return createRng(hash32(seed, round, 907)).int(6) + 1;
}

function chooseUnit(cost: number, rng: ReturnType<typeof createRng>, roster: UnitDef[] = poolUnits()): UnitDef {
  const exact = roster.filter((item) => autochessCostOf(item) === cost);
  const candidates = exact.length > 0 ? exact : roster.filter((unit) => autochessCostOf(unit) > 0 && autochessCostOf(unit) <= cost);
  return candidates[rng.int(candidates.length)]!;
}

export function makeInitialPieces(seed: number, roster: UnitDef[] = poolUnits(), seats = AUTOCHESS_PLAYER_COUNT): { cost: 1 | 2; pieces: AutochessPiece[] } {
  const cost = initialCost(seed);
  const rng = createRng(hash32(seed, 211));
  return {
    cost,
    pieces: Array.from({ length: evenSeatCount(seats, AUTOCHESS_PLAYER_COUNT) }, (_, index) => {
      const unit = chooseUnit(cost, rng, roster);
      return makePiece(unit, `opening-${index}`, index === 0 ? 1 : 2, index % 4);
    }),
  };
}

export function makePiece(unit: UnitDef, id: string, row = 1, col = 1): AutochessPiece {
  return {
    id,
    templateId: unit.id,
    star: 1,
    localRow: row,
    localCol: col,
    itemIds: [],
  };
}

/** Unlocked tiers only. 5-cost stays rare so one high roll is not the game. */
const SHOP_COST_WEIGHT = [0, 50, 30, 15, 8, 4];

function rollShopCost(maxCost: number, rng: ReturnType<typeof createRng>): number {
  let total = 0;
  for (let cost = 1; cost <= maxCost; cost += 1) total += SHOP_COST_WEIGHT[cost] ?? 0;
  if (total <= 0) return 1;
  let roll = rng.next() * total;
  for (let cost = 1; cost <= maxCost; cost += 1) {
    roll -= SHOP_COST_WEIGHT[cost] ?? 0;
    if (roll < 0) return cost;
  }
  return 1;
}

export function makeShop(seed: number, round: number, refresh = 0, roster: UnitDef[] = poolUnits(), level?: number): UnitDef[] {
  const rng = createRng(hash32(seed, round, 1201 + refresh * 17));
  const maxCost = level===undefined?unlockedMaxCost(round):shopMaxCostForLevel(level);
  return Array.from({ length: AUTOCHESS_SHOP_SIZE }, () => {
    const cost = rollShopCost(maxCost, rng);
    return chooseUnit(cost, rng, roster);
  });
}

const ITEM_TIER = ['white', 'purple', 'epic', 'orange'] as const;

export function itemFamilyForHex(rarity: ReturnType<typeof stageRarity>): string {
  if (rarity === 'blue') return 'white';
  if (rarity === 'purple') return 'purple';
  if (rarity === 'gold') return 'epic';
  return 'orange';
}

export function pickDraftItem(loot: readonly ItemDef[], round: number, rng: Rng): ItemDef {
  if (!loot.length) throw new Error('empty draft loot');
  const want = itemFamilyForHex(stageRarity(round));
  const same = loot.filter((item) => item.family === want);
  if (rng.next() < 0.85 && same.length) return same[rng.int(same.length)]!;
  const index = ITEM_TIER.indexOf(want as (typeof ITEM_TIER)[number]);
  const neighbors = [ITEM_TIER[index - 1], ITEM_TIER[index + 1]].filter((family): family is (typeof ITEM_TIER)[number] => Boolean(family));
  const spill = loot.filter((item) => neighbors.includes(item.family as (typeof ITEM_TIER)[number]));
  const pool = spill.length ? spill : same.length ? same : loot;
  return pool[rng.int(pool.length)]!;
}

export function makeDraftTrack(seed: number, round: number, ownedUnique: ReadonlySet<string>, pityPosition?: number, roster: UnitDef[] = poolUnits()): DraftReward[] {
  const rng = createRng(hash32(seed, round, 1601));
  const maxCost = unlockedMaxCost(round);
  const loot = lootForRoster(roster);
  const bag = '装备背包';
  const takeItem = () => pickDraftItem(loot, round, rng);
  const fieldCap = { id: 'unique-field-cap', kind: 'unique' as const, uniqueId: 'field-cap' as const, label: '扩编令', detail: '上场上限永久 +1；整局唯一' };
  const starToken = { id: 'unique-star-token', kind: 'unique' as const, uniqueId: 'star-token' as const, label: '点星令', detail: '任选一名场上棋子升 1 星；整局唯一' };
  const twinKit = { id: 'unique-twin-kit', kind: 'unique' as const, uniqueId: 'twin-kit' as const, label: '天工匣', detail: '获得本棋谱的两件装备；整局唯一' };
  const uniqueStops = new Map<number, Extract<DraftReward, { kind: 'unique' }>>([
    [2, fieldCap],
    [7, starToken],
    [13, twinKit],
  ]);
  return tiles.map((tile, index) => {
    if (pityPosition !== undefined && Array.from({ length: 6 }, (_, i) => (pityPosition + i + 1) % tiles.length).includes(index)) {
      const item = takeItem();
      return { id: `pity-${round}-${index}`, kind: 'item', label: item.name, detail: '装备保底 · 加入装备背包', itemId: item.id };
    }
    const candidate = uniqueStops.get(index);
    if (candidate) {
      if (!ownedUnique.has(candidate.uniqueId)) return candidate;
    }
    if (tile.type === 'rest') {
      const amount = 4 + rng.int(5);
      return { id: `heal-${round}-${index}`, kind: 'heal', label: '歇脚疗伤', detail: `恢复 ${amount} 气血`, amount };
    }
    if (tile.type === 'boss') {
      const hpLoss = 5 + rng.int(4);
      return { id: `mishap-${round}-${index}`, kind: 'mishap', label: '撞上硬茬', detail: `损失 ${hpLoss} 气血`, hpLoss };
    }
    if (tile.type === 'shop') {
      const item = takeItem();
      return { id: `item-${round}-${index}`, kind: 'item', label: `捡漏：${item.name}`, detail: `免费加入${bag}`, itemId: item.id };
    }
    if (tile.type === 'encounter' && rng.int(5) === 0) {
      const hpLoss = 3 + rng.int(5);
      return { id: `mishap-${round}-${index}`, kind: 'mishap', label: '旅途意外', detail: `损失 ${hpLoss} 气血`, hpLoss };
    }
    const kind = rng.int(10);
    const goldCutoff = 2;
    const unitCutoff = 4;
    if (kind < goldCutoff) {
      const amount = 3 + rng.int(4);
      return { id: `gold-${round}-${index}`, kind: 'gold', label: `${amount} 金`, detail: '立即获得金币', amount };
    }
    if (kind < unitCutoff) {
      const unit = chooseUnit(rng.int(maxCost) + 1, rng, roster);
      return { id: `unit-${round}-${index}`, kind: 'unit', label: unit.name, detail: `${autochessCostOf(unit)}费棋子，加入备战区`, unitId: unit.id };
    }
    const item = takeItem();
    return { id: `item-${round}-${index}`, kind: 'item', label: item.name, detail: `加入${bag}`, itemId: item.id };
  });
}

export function draftChoices(track: DraftReward[], position: number, roll: number): DraftChoice[] {
  const clockwise = (position + roll) % track.length;
  return [{ direction: 'clockwise', index: clockwise, reward: track[clockwise]! }];
}

export function nextStar(star: Star): Star {
  return star === 1 ? 2 : 3;
}

/** Add a piece, then resolve 3-of-a-kind across field and bench, including chain merges. */
export function addAndMerge(
  board: AutochessPiece[],
  bench: AutochessPiece[],
  added: AutochessPiece,
): MergeResult {
  type Located = { piece: AutochessPiece; place: 'board' | 'bench'; order: number };
  let roster: Located[] = [
    ...board.map((piece, order) => ({ piece: { ...piece, itemIds: [...piece.itemIds] }, place: 'board' as const, order })),
    ...bench.map((piece, order) => ({ piece: { ...piece, itemIds: [...piece.itemIds] }, place: 'bench' as const, order })),
    { piece: { ...added, itemIds: [...added.itemIds] }, place: 'bench', order: bench.length },
  ];
  const returnedItems: string[] = [];
  let merges = 0;
  const mergedInto: Record<string,string> = {};
  const byPlace = (a: Located, b: Located) => (a.place === b.place ? a.order - b.order : a.place === 'board' ? -1 : 1);
  const of = (templateId: string, star: number) =>
    roster.filter((entry) => entry.piece.templateId === templateId && entry.piece.star === star).sort(byPlace);

  const pickMatches = (): { matches: Located[]; star: 1 | 2 | 3 } | null => {
    const normal = roster.find((entry) =>
      entry.piece.star < 3 && !getUnit(entry.piece.templateId).ally && of(entry.piece.templateId, entry.piece.star).length >= 3);
    if (normal) return { matches: of(normal.piece.templateId, normal.piece.star).slice(0, 3), star: nextStar(normal.piece.star) };
    return null;
  };

  while (true) {
    const pick = pickMatches();
    if (!pick) break;
    const survivor = pick.matches[0]!;
    for (const entry of pick.matches) if (entry.piece.id !== survivor.piece.id) {
      for (const id of Object.keys(mergedInto)) if (mergedInto[id] === entry.piece.id) mergedInto[id] = survivor.piece.id;
      mergedInto[entry.piece.id] = survivor.piece.id;
    }
    const equipped: string[] = [];
    for (const itemId of pick.matches.flatMap((entry) => entry.piece.itemIds)) {
      if (equipped.length < 2 && !equipped.includes(itemId)) equipped.push(itemId);
      else returnedItems.push(itemId);
    }
    const consumed = new Set(pick.matches.map((entry) => entry.piece.id));
    roster = roster.filter((entry) => !consumed.has(entry.piece.id));
    roster.push({
      ...survivor,
      piece: { ...survivor.piece, star: pick.star, itemIds: equipped },
    });
    merges += 1;
  }

  return {
    board: roster.filter((entry) => entry.place === 'board').sort((a, b) => a.order - b.order).map((entry) => entry.piece),
    bench: roster.filter((entry) => entry.place === 'bench').sort((a, b) => a.order - b.order).map((entry) => entry.piece),
    returnedItems,
    merges,
    consumed: mergedInto,
  };
}

export function deliverUnitToRoster(
  board: AutochessPiece[],
  bench: AutochessPiece[],
  gold: number,
  unitId: string,
  pieceId: string,
) {
  const unit = getUnit(unitId);
  const merged = addAndMerge(board, bench, makePiece(unit, pieceId));
  if (merged.bench.length <= BENCH_CAPACITY) {
    return { board: merged.board, bench: merged.bench, gold, returnedItems: merged.returnedItems };
  }
  return { board, bench, gold: gold + autochessCostOf(unit), returnedItems: [] as string[] };
}

/** Put a benched piece onto an occupied cell and return that occupant to the bench. */
export function replaceFromBench(
  board: AutochessPiece[],
  bench: AutochessPiece[],
  benchId: string,
  boardId: string,
): { board: AutochessPiece[]; bench: AutochessPiece[] } | null {
  const incoming = bench.find((piece) => piece.id === benchId);
  const outgoing = board.find((piece) => piece.id === boardId);
  if (!incoming || !outgoing) return null;
  return {
    board: board.map((piece) =>
      piece.id === outgoing.id
        ? { ...incoming, localRow: outgoing.localRow, localCol: outgoing.localCol }
        : piece,
    ),
    bench: bench.map((piece) => piece.id === incoming.id ? outgoing : piece),
  };
}

export function unequipFromRoster(
  board: AutochessPiece[],
  bench: AutochessPiece[],
  pieceId: string,
  itemId: string,
): { board: AutochessPiece[]; bench: AutochessPiece[]; removed: boolean } {
  let removed = false;
  const strip = (piece: AutochessPiece): AutochessPiece => {
    if (piece.id !== pieceId || !piece.itemIds.includes(itemId)) return piece;
    removed = true;
    let skipped = false;
    return {
      ...piece,
      itemIds: piece.itemIds.filter((id) => {
        if (!skipped && id === itemId) {
          skipped = true;
          return false;
        }
        return true;
      }),
    };
  };
  return { board: board.map(strip), bench: bench.map(strip), removed };
}

export function sellFromRoster(
  board: AutochessPiece[],
  bench: AutochessPiece[],
  pieceId: string,
): { board: AutochessPiece[]; bench: AutochessPiece[]; returnedItems: string[]; gold: number; piece: AutochessPiece } | null {
  const piece = board.find((entry) => entry.id === pieceId) ?? bench.find((entry) => entry.id === pieceId);
  if (!piece) return null;
  return {
    board: board.filter((entry) => entry.id !== pieceId),
    bench: bench.filter((entry) => entry.id !== pieceId),
    returnedItems: [...piece.itemIds],
    gold: sellValue(piece),
    piece,
  };
}

export function sellValue(piece: AutochessPiece): number {
  const cost = autochessCostOf(getUnit(piece.templateId));
  if (piece.star === 1) return cost;
  const copies = piece.star === 3 ? 9 : 3;
  const refundRate = piece.star === 3 ? 0.4 : 0.6;
  return Math.max(1, Math.floor(cost * copies * refundRate));
}
