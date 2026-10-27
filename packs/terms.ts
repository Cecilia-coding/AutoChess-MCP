import { packTerms as termsForPack } from './registry';
import type { PackTerms } from './types';

export type { PackTerms } from './types';

/** Human-facing terminology only. Protocol and persistence fields stay gold/level/star. */
export function packTerms(packId: string | undefined): PackTerms {
  return termsForPack(packId);
}

export function goldAmount(terms: PackTerms, amount: number): string {
  return `${amount} ${terms.gold.short}`;
}

export function levelLabel(terms: PackTerms, level: number): string {
  const normalized = Math.max(1, Math.trunc(level));
  const ladder = terms.level.ladder;
  return ladder?.[Math.min(ladder.length - 1, normalized - 1)] ?? `Lv${normalized}`;
}

export function starLabel(terms: PackTerms, star: number): string {
  return terms.star.tiers[Math.max(0, Math.min(2, Math.floor(star) - 1))];
}
