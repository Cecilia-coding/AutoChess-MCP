import {
  createRng,
  BOARD_COLS,
  HALF_ROWS,
  type BattleOutput,
  type Combatant,
  type Star,
} from "@autochess/chess-engine";
import { z } from "zod";
import { inspectPack } from "../core/preview.js";
import type { ChessPack } from "../core/schema.js";
import { compilePack } from "./adapter.js";
import { trialRules } from "./rules.js";

export type Piece = {
  id: string;
  unitId: string;
  star: Star;
  row: number | null;
  col: number | null;
};
export type Seat = {
  health: number;
  gold: number;
  level: number;
  xp: number;
  pieces: Piece[];
  shop: (string | null)[];
  rolls: number;
};
export type TrialMatch = {
  id: string;
  revision: number;
  pack: ChessPack;
  seed: number;
  round: number;
  phase: "prepare" | "finished";
  result?: "win" | "loss" | "draw";
  player: Seat;
  opponent: Seat;
  nextPiece: number;
  battle?: BattleOutput;
  history: { round: number; outcome: string; playerHealth: number; opponentHealth: number }[];
};
export const actionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("buy"),
    slot: z
      .number()
      .int()
      .min(0)
      .max(trialRules.shopSize - 1),
  }),
  z.strictObject({ type: z.literal("sell"), pieceId: z.string() }),
  z
    .strictObject({
      type: z.literal("move"),
      pieceId: z.string(),
      row: z
        .number()
        .int()
        .min(0)
        .max(HALF_ROWS - 1)
        .nullable(),
      col: z
        .number()
        .int()
        .min(0)
        .max(BOARD_COLS - 1)
        .nullable(),
    })
    .refine((a) => (a.row === null) === (a.col === null), "行列应同时填写或留空"),
  z.strictObject({ type: z.literal("refresh") }),
  z.strictObject({ type: z.literal("upgrade") }),
  z.strictObject({ type: z.literal("ready") }),
]);
export type TrialAction = z.infer<typeof actionSchema>;
const fail = (message: string): never => {
  throw new Error(message);
};
const definition = (match: TrialMatch, id: string) =>
  match.pack.units.find((unit) => unit.id === id) ?? fail("棋子不属于本局棋谱");
const onBoard = (piece: Piece) => piece.row !== null;
function roll(match: TrialMatch, seat: Seat, side: number) {
  const rng = createRng(
    (match.seed + match.round * 7919 + seat.rolls++ * 104729 + side * 65537) >>> 0,
  );
  const costs = [1, 2, 3, 4, 5].filter((cost) =>
    match.pack.units.some((unit) => unit.cost === cost),
  );
  const total = costs.reduce((sum, cost) => sum + trialRules.shopWeights[cost - 1], 0);
  seat.shop = Array.from({ length: trialRules.shopSize }, () => {
    let choice = rng.next() * total;
    const cost =
      costs.find((cost) => (choice -= trialRules.shopWeights[cost - 1]) < 0) ??
      costs[costs.length - 1];
    const pool = match.pack.units.filter((unit) => unit.cost === cost);
    return pool[rng.int(pool.length)].id;
  });
}
function merge(seat: Seat) {
  for (const star of [1, 2] as const)
    for (const unitId of new Set(seat.pieces.map((piece) => piece.unitId))) {
      let group = seat.pieces.filter((piece) => piece.unitId === unitId && piece.star === star);
      while (group.length >= 3) {
        const chosen = [...group]
          .sort((a, b) => Number(onBoard(b)) - Number(onBoard(a)))
          .slice(0, 3);
        chosen[0].star = (star + 1) as Star;
        seat.pieces = seat.pieces.filter((piece) => !chosen.slice(1).includes(piece));
        group = seat.pieces.filter((piece) => piece.unitId === unitId && piece.star === star);
      }
    }
}
function buy(match: TrialMatch, seat: Seat, slot: number) {
  const id = seat.shop[slot] ?? fail("该商品已经售出");
  const unit = definition(match, id);
  if (seat.gold < unit.cost) fail("金币不足");
  seat.pieces.push({ id: `piece_${match.nextPiece++}`, unitId: id, star: 1, row: null, col: null });
  merge(seat);
  if (seat.pieces.filter((piece) => !onBoard(piece)).length > trialRules.benchSize)
    fail("备战席已满");
  seat.gold -= unit.cost;
  seat.shop[slot] = null;
}
function gainXp(seat: Seat, amount: number) {
  seat.xp += amount;
  while (seat.level < trialRules.maxLevel && seat.xp >= trialRules.xpToLevel[seat.level]) {
    seat.xp -= trialRules.xpToLevel[seat.level];
    seat.level++;
  }
  if (seat.level === trialRules.maxLevel) seat.xp = 0;
}
function opponentPrepare(match: TrialMatch) {
  const seat = match.opponent;
  const engine = compilePack(match.pack);
  for (let pass = 0; pass < 2; pass++) {
    const slots = seat.shop
      .map((id, slot) => ({ slot, cost: id ? definition(match, id).cost : 0 }))
      .sort((a, b) => b.cost - a.cost);
    for (const { slot, cost } of slots)
      if (cost && seat.gold >= cost && seat.pieces.length < trialRules.benchSize)
        buy(match, seat, slot);
    if (pass === 0 && seat.gold >= trialRules.refreshCost + 1) {
      seat.gold -= trialRules.refreshCost;
      roll(match, seat, 1);
    }
  }
  if (seat.level < trialRules.maxLevel && seat.gold >= trialRules.upgradeCost + 3) {
    seat.gold -= trialRules.upgradeCost;
    gainXp(seat, trialRules.upgradeXp);
  }
  const strength = (piece: Piece) => {
    const p = engine.panel(piece.unitId, piece.star);
    return p.maxHp + p.atk * p.aspd * 10;
  };
  seat.pieces.sort((a, b) => strength(b) - strength(a));
  seat.pieces.forEach((piece, index) => {
    piece.row = index < seat.level ? HALF_ROWS - 1 - Math.floor(index / BOARD_COLS) : null;
    piece.col = index < seat.level ? index % BOARD_COLS : null;
  });
  // Keep enough bench space for the next round; proceeds follow the same sale rule as the player.
  for (const piece of seat.pieces.slice(seat.level + 3))
    seat.gold += definition(match, piece.unitId).cost * 3 ** (piece.star - 1);
  seat.pieces = seat.pieces.slice(0, seat.level + 3);
}
const fighters = (seat: Seat): Combatant[] =>
  seat.pieces.filter(onBoard).map((piece) => ({
    id: piece.id,
    templateId: piece.unitId,
    star: piece.star,
    localRow: piece.row!,
    localCol: piece.col!,
    itemIds: [],
  }));
export function createTrial(id: string, input: unknown, seed: number): TrialMatch {
  const checked = inspectPack(input);
  if (!checked.valid) throw new Error("请先修正棋谱格式");
  const seat = (): Seat => ({
    health: trialRules.startHealth,
    gold: trialRules.startGold,
    level: trialRules.startLevel,
    xp: 0,
    pieces: [],
    shop: [],
    rolls: 0,
  });
  const match: TrialMatch = {
    id,
    revision: 1,
    pack: structuredClone(checked.pack),
    seed,
    round: 1,
    phase: "prepare",
    player: seat(),
    opponent: seat(),
    nextPiece: 1,
    history: [],
  };
  roll(match, match.player, 0);
  roll(match, match.opponent, 1);
  return match;
}
/** Pure transactional transition: failures never mutate the saved match. */
export function actTrial(previous: TrialMatch, input: unknown): TrialMatch {
  const action = actionSchema.parse(input);
  const match = structuredClone(previous);
  if (match.phase !== "prepare") fail("本局已结束，请新开一局");
  const seat = match.player;
  if (action.type === "buy") buy(match, seat, action.slot);
  if (action.type === "refresh") {
    if (seat.gold < trialRules.refreshCost) fail("金币不足");
    seat.gold -= trialRules.refreshCost;
    roll(match, seat, 0);
  }
  if (action.type === "upgrade") {
    if (seat.level >= trialRules.maxLevel) fail("已达到最高等级");
    if (seat.gold < trialRules.upgradeCost) fail("金币不足");
    seat.gold -= trialRules.upgradeCost;
    gainXp(seat, trialRules.upgradeXp);
  }
  if (action.type === "sell" || action.type === "move") {
    const piece =
      seat.pieces.find((piece) => piece.id === action.pieceId) ?? fail("找不到这枚棋子");
    if (action.type === "sell") {
      seat.gold += definition(match, piece.unitId).cost * 3 ** (piece.star - 1);
      seat.pieces = seat.pieces.filter((entry) => entry !== piece);
    } else {
      const occupant = seat.pieces.find(
        (entry) =>
          entry !== piece &&
          action.row !== null &&
          entry.row === action.row &&
          entry.col === action.col,
      );
      if (occupant) {
        occupant.row = piece.row;
        occupant.col = piece.col;
      }
      piece.row = action.row;
      piece.col = action.col;
      if (seat.pieces.filter(onBoard).length > seat.level)
        fail("上场数量超过等级，请先升级或换下棋子");
      if (seat.pieces.filter((piece) => !onBoard(piece)).length > trialRules.benchSize)
        fail("备战席已满");
    }
  }
  if (action.type === "ready") {
    if (!seat.pieces.some(onBoard)) fail("先买棋子，再放到棋盘上");
    opponentPrepare(match);
    match.battle = compilePack(match.pack).battle({
      battleId: `${match.id}-${match.round}`,
      seed: match.seed + match.round,
      left: fighters(seat),
      right: fighters(match.opponent),
    });
    const outcome = match.battle.outcome;
    const loss =
      trialRules.lossBase +
      match.battle.units.filter(
        (unit) => unit.survivingHp > 0 && unit.team === (outcome === "left" ? "left" : "right"),
      ).length *
        trialRules.lossPerSurvivor;
    if (outcome === "left") match.opponent.health = Math.max(0, match.opponent.health - loss);
    else if (outcome === "right") seat.health = Math.max(0, seat.health - loss);
    else {
      seat.health = Math.max(0, seat.health - trialRules.lossBase);
      match.opponent.health = Math.max(0, match.opponent.health - trialRules.lossBase);
    }
    match.history.push({
      round: match.round,
      outcome,
      playerHealth: seat.health,
      opponentHealth: match.opponent.health,
    });
    if (seat.health === 0 || match.opponent.health === 0 || match.round >= trialRules.maxRounds) {
      match.phase = "finished";
      match.result =
        seat.health > match.opponent.health
          ? "win"
          : seat.health < match.opponent.health
            ? "loss"
            : "draw";
    } else {
      match.round++;
      for (const [side, player] of [seat, match.opponent].entries()) {
        player.gold +=
          trialRules.income +
          Math.min(trialRules.maxInterest, Math.floor(player.gold / trialRules.interestPerGold));
        gainXp(player, trialRules.roundXp);
        roll(match, player, side);
      }
    }
  }
  match.revision++;
  return match;
}
export function viewTrial(match: TrialMatch) {
  const engine = compilePack(match.pack);
  return {
    ...match,
    rules: trialRules,
    board: { rows: HALF_ROWS, cols: BOARD_COLS },
    panels: match.player.pieces.map((piece) => ({
      pieceId: piece.id,
      ...engine.panel(piece.unitId, piece.star),
    })),
  };
}
