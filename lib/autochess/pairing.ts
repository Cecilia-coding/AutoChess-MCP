import { createRng, hash32 } from './rng';

export type Matchup = {
  left: number;
  right: number;
  host: number;
  visitor: number;
  ghost?: boolean;
};

export function pickHost(a: number, b: number, seed: number, round: number): number {
  return hash32(seed, round, a * 31 + b + 17) % 2 === 0 ? a : b;
}

/** Pair living seats. Odd one out visits a ghost copy of another living board; only the real seat takes damage. */
export function pairLiving(living: number[], seed: number, round: number, lastOpponent: readonly (number | undefined)[] = []): Matchup[] {
  if (living.length <= 1) return [];
  const rng = createRng(hash32(seed, round, 4401));
  const order = [...living];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const used = new Set<number>();
  const matchups: Matchup[] = [];
  const takePartner = (id: number) =>
    order.find((other) => !used.has(other) && other !== id && lastOpponent[id] !== other)
    ?? order.find((other) => !used.has(other) && other !== id);
  for (const id of order) {
    if (used.has(id)) continue;
    const partner = takePartner(id);
    if (partner === undefined) {
      const ghost = lastOpponent[id] !== undefined && living.includes(lastOpponent[id]!)
        ? lastOpponent[id]!
        : living.find((other) => other !== id);
      if (ghost === undefined) continue;
      const host = pickHost(id, ghost, seed, round);
      matchups.push({ left: id, right: ghost, host, visitor: host === id ? ghost : id, ghost: true });
      used.add(id);
      continue;
    }
    used.add(id);
    used.add(partner);
    const host = pickHost(id, partner, seed, round);
    matchups.push({ left: id, right: partner, host, visitor: host === id ? partner : id });
  }
  return matchups;
}

export function matchupFor(matchups: readonly Matchup[], seat: number): Matchup | undefined {
  return matchups.find((entry) => !entry.ghost && (entry.left === seat || entry.right === seat))
    ?? matchups.find((entry) => entry.left === seat || entry.right === seat);
}
