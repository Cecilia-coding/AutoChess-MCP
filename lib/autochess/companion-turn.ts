import { BENCH_CAPACITY } from './constants';
import { autochessCostOf, getUnit } from '../../content/autochess/units';
import { immediateHexGold, makeHexOffer, pickBestHex } from '../../content/autochess/hexes';
import type { HexDef } from '../../content/autochess/types';
import { makeCatchupShop, makeCatchupDraft } from './catchup';
import { lootForRoster } from '../../content/autochess/items';
import { DEFAULT_PACK_ID, packKitItems, packRoster } from '../../packs/registry';
import { addAndMerge, draftChoices, fieldCapacity, AUTOCHESS_INCOME, AUTOCHESS_START_GOLD, AUTOCHESS_START_HP, makeDraftTrack, makePiece, nextStar, rollDraft, shouldDraft, skillDraftDue, type AutochessOpponent } from './core';

/** Same income, one dice roll and one reward as the human. Idempotent per settled round. */
export function settleCompanionRound(opponent: AutochessOpponent, seed: number, round: number): AutochessOpponent {
  if (opponent.hp <= 0 || (opponent.lastDraftRound ?? 0) >= round) return opponent;
  const next: AutochessOpponent = { ...opponent, board: opponent.board.map(p => ({ ...p, itemIds: [...p.itemIds] })),
    bench: (opponent.bench ?? []).map(p => ({ ...p, itemIds: [...p.itemIds] })), inventory: [...(opponent.inventory ?? [])],
    uniqueRewards: [...(opponent.uniqueRewards ?? [])], hexes: [...(opponent.hexes ?? [])], gold: (opponent.gold ?? AUTOCHESS_START_GOLD) + AUTOCHESS_INCOME,
    lastDraftRound: round, draftLabel: '本回合未触发选秀' };
  if (!shouldDraft(seed, round, next.lastSkillRound ?? 0)) return next;
  const blocked = new Set(next.uniqueRewards);
  if (fieldCapacity(round + 1, next.bonusCap ?? 0) >= 8) blocked.add('field-cap');
  const position = next.draftPosition ?? 0;
  const roster = packRoster(DEFAULT_PACK_ID);
  const loot = lootForRoster(roster);
  const originalTrack = makeDraftTrack(seed, round, blocked, skillDraftDue(round, next.lastSkillRound ?? 0) ? position : undefined, roster);
  const assisted = makeCatchupDraft(originalTrack, seed, round, position, [...next.board, ...next.bench!], next.inventory!, next.catchup, loot);
  const track = assisted.track;
  next.catchup = assisted.state;
  const landing = draftChoices(track, position, rollDraft(seed, round))[0]!;
  const reward = landing.reward;
  next.draftPosition = landing.index;
  next.draftLabel = reward.label;
  if (reward.kind === 'gold') next.gold! += reward.amount;
  if (reward.kind === 'heal') next.hp = Math.min(AUTOCHESS_START_HP, next.hp + reward.amount);
  if (reward.kind === 'mishap') next.hp = Math.max(1, next.hp - reward.hpLoss);
  if (reward.kind === 'item') { next.inventory!.push(reward.itemId); next.lastSkillRound = round; }
  if (reward.kind === 'unit') {
    const unit = getUnit(reward.unitId);
    const merged = addAndMerge(next.board, next.bench!, makePiece(unit, `${next.id}-draft-${round}`));
    if (merged.bench.length <= BENCH_CAPACITY) { next.board = merged.board; next.bench = merged.bench; next.inventory!.push(...merged.returnedItems); }
    else next.gold! += autochessCostOf(unit);
  }
  if (reward.kind === 'unique') {
    next.uniqueRewards!.push(reward.uniqueId);
    if (reward.uniqueId === 'field-cap') next.bonusCap = (next.bonusCap ?? 0) + 1;
    if (reward.uniqueId === 'twin-kit') { next.inventory!.push(...packKitItems(DEFAULT_PACK_ID)); next.lastSkillRound = round; }
    if (reward.uniqueId === 'star-token') {
      const target = [...next.board].sort((a,b) => autochessCostOf(getUnit(b.templateId)) - autochessCostOf(getUnit(a.templateId)))[0];
      if (target) next.board = next.board.map(p => p.id === target.id ? { ...p, star: nextStar(p.star) } : p);
    }
  }
  return next;
}

export function pickCompanionHex(opponent: AutochessOpponent, seed: number, round: number, pool: readonly HexDef[]): AutochessOpponent {
  const offer = makeHexOffer(seed, round, opponent.hexes ?? [], pool);
  const pick = pickBestHex(offer);
  if (!pick) return opponent;
  return {
    ...opponent,
    hexes: [...new Set([...(opponent.hexes ?? []), pick.id])],
    gold: (opponent.gold ?? 0) + immediateHexGold(pick),
  };
}

export function prepareOpponentRound(opponent: AutochessOpponent, seed: number, round: number): AutochessOpponent {
  if (opponent.hp <= 0 || opponent.shopRound === round) return settleCompanionRound(opponent, seed, round);
  const offer = makeCatchupShop(seed, round, [...opponent.board, ...(opponent.bench ?? [])], opponent.catchup);
  // Human buys before the draft too: apply the same shared cooldown order.
  const prepared = settleCompanionRound({ ...opponent, catchup: offer.state }, seed, round);
  return { ...prepared, shopRound: round, shopUnitIds: offer.shop.map(unit => unit.id) };
}
