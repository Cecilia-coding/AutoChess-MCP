import { autochessCostOf, getUnit, poolUnits } from '../../content/autochess/units';
import type { UnitDef } from '../../content/autochess/types';
import { makeShop, rollDraft, type AutochessPiece, type DraftReward } from './core';
import { items, itemHint, orbItems } from '../../content/autochess/items';
import { createRng, hash32 } from './rng';
import { matchRules } from './match-rules';

export type CatchupState = { streak: number; hpGap: number; hp: number; grants: number; lastGrantRound: number; shopGrants?: number; draftGrants?: number };
export const freshCatchup = (): CatchupState => ({ streak: 0, hpGap: 0, hp: matchRules().startHp, grants: 0, lastGrantRound: -99 });
function eligible(state: CatchupState, round: number) {
  const start = matchRules().startHp;
  return round >= 3 && state.streak >= 2 && state.hp > 0 && state.hp <= start * 0.7 && state.hpGap >= start * 0.2 && state.grants < 3 && round - state.lastGrantRound >= 3;
}

export function recordCatchup(previous: CatchupState | undefined, lost: boolean, fielded: number, capacity: number, hp: number, medianHp: number): CatchupState {
  const state = previous ?? freshCatchup();
  const contested = fielded >= Math.max(1, Math.ceil(capacity * 0.8));
  return { ...state, streak: lost && contested && hp > 0 ? state.streak + 1 : 0, hp, hpGap: Math.max(0, medianHp - hp) };
}

/** Soft shop assistance only: no free purchase, cost upgrade, combat modifier or extra roll. */
export function makeCatchupShop(seed: number, round: number, roster: AutochessPiece[], previous?: CatchupState, refresh = 0, pool: UnitDef[] = poolUnits(), level?: number) {
  const shop = makeShop(seed, round, refresh, pool, level);
  const state = { ...(previous ?? freshCatchup()) };
  if (!eligible(state, round) || (state.shopGrants ?? 0) >= 2) return { shop, state, assisted: false };
  const copies = new Map<string, number>();
  const available = new Set(pool.map(unit => unit.id));
  for (const piece of roster) {
    const cost = autochessCostOf(getUnit(piece.templateId));
    if (piece.star === 1 && cost >= 1 && cost <= 2 && available.has(piece.templateId)) copies.set(piece.templateId, (copies.get(piece.templateId) ?? 0) + 1);
  }
  const candidates = [...copies.keys()];
  const slots = shop.flatMap((unit, index) => {
    // Do not remove another useful copy already naturally offered.
    if (copies.has(unit.id)) return [];
    return candidates.filter(id => autochessCostOf(getUnit(id)) === autochessCostOf(unit)).map(id => ({ index, id }));
  });
  const rng = createRng(hash32(seed, round, 23871 + refresh * 17));
  if (!slots.length || rng.next() >= 0.5) return { shop, state, assisted: false };
  const pairs = slots.filter(slot => (copies.get(slot.id) ?? 0) >= 2);
  const choices = pairs.length ? pairs : slots;
  const selected = choices[rng.int(choices.length)]!;
  shop[selected.index] = getUnit(selected.id);
  state.grants += 1; state.shopGrants = (state.shopGrants ?? 0) + 1; state.lastGrantRound = round;
  return { shop, state, assisted: true };
}

function catchupPrefs(loot: { id: string; hpPct?: number; drPct?: number; armorPct?: number; mrPct?: number; startShieldPct?: number; emergencyHealPct?: number; atkPct?: number; penetrationPct?: number; skillPct?: number }[], defensive: boolean): string[] {
  return loot
    .map((item) => ({
      id: item.id,
      score: defensive
        ? (item.hpPct ?? 0) + (item.drPct ?? 0) * 2 + (item.armorPct ?? 0) + (item.mrPct ?? 0) + (item.startShieldPct ?? 0) + (item.emergencyHealPct ?? 0) * 0.4
        : (item.atkPct ?? 0) + (item.penetrationPct ?? 0) + (item.skillPct ?? 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.id);
}

/** Only improve an existing equipment landing. Dice, reward category and unique rewards stay real. */
export function makeCatchupDraft(track: DraftReward[], seed: number, round: number, position: number, roster: AutochessPiece[], inventory: string[], previous?: CatchupState, loot = orbItems) {
  const state = { ...(previous ?? freshCatchup()) };
  if (!eligible(state, round) || (state.draftGrants ?? 0) >= 2 || !track.length) return { track, state, assisted: false };
  const index = (position + rollDraft(seed, round)) % track.length;
  const landing = track[index]!;
  if (landing.kind !== 'item') return { track, state, assisted: false };
  const targets = roster.filter(piece => piece.itemIds.length < 2);
  const tanks = targets.filter(piece => ['tank', 'melee'].includes(getUnit(piece.templateId).role));
  const defensive = catchupPrefs(loot, true);
  const offensive = catchupPrefs(loot, false);
  const needsArmor = tanks.some(piece => !piece.itemIds.some(id => defensive.includes(id)));
  const candidates = (needsArmor ? defensive : offensive).filter(id =>
    id !== landing.itemId && !inventory.includes(id) && (needsArmor ? tanks : targets).some(piece => !piece.itemIds.includes(id)));
  const useful = needsArmor ? defensive : offensive;
  // Keep a naturally useful roll instead of spending the assistance allowance.
  if (!candidates.length || useful.includes(landing.itemId)) return { track, state, assisted: false };
  const rng = createRng(hash32(seed, round, 23879));
  if (rng.next() >= 0.6) return { track, state, assisted: false };
  const id = candidates[rng.int(candidates.length)]!;
  const item = loot.find(entry => entry.id === id) ?? items.find(entry => entry.id === id)!;
  const nextTrack = [...track];
  nextTrack[index] = { ...landing, itemId: id, label: item.name, detail: itemHint(id) };
  state.grants += 1; state.draftGrants = (state.draftGrants ?? 0) + 1; state.lastGrantRound = round;
  return { track: nextTrack, state, assisted: true };
}
