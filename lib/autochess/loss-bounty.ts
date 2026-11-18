import { getGameConfig } from '../meta/game-config';

export type LossBounty = { streak: number; bank: number };
export const freshLossBounty = (): LossBounty => ({ streak: 0, bank: 0 });

/** Unspent risk, not income: only a surviving winner can cash out. */
export function settleLossBounty(previous: LossBounty | undefined, outcome: 'win' | 'loss' | 'draw', hp: number) {
  const current = previous ?? freshLossBounty();
  if (hp <= 0) return { state: freshLossBounty(), payout: 0 };
  if (outcome === 'win') return { state: freshLossBounty(), payout: current.bank };
  if (outcome === 'draw') return { state: { streak: 0, bank: current.bank }, payout: 0 };
  const streak = current.streak + 1;
  const { lossBountyPerLossCap, lossBountyBankCap } = getGameConfig().pacing;
  return { state: { streak, bank: Math.min(lossBountyBankCap, current.bank + Math.min(lossBountyPerLossCap, streak + 1)) }, payout: 0 };
}
