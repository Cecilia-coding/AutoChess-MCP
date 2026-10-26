import { simulateBattle } from './combat';
import type { BattleOutput } from './types';
import type { AutochessOpponent } from './core';
import { fieldCapacity } from './core';
import { recordCatchup, type CatchupState } from './catchup';
import { settleLossBounty, type LossBounty } from './loss-bounty';
import { AUTOCHESS_START_GOLD } from './core';

/** Persistent player damage, separate from a piece's battle HP. */
/** 阵亡伤害：底噪 + 随回合增长 + 存活加成；`scale` 由模式（lossDamageScale）整体缩放。 */
export function defeatDamage(round: number, survivors: number, scale = 1) {
  return Math.max(1, Math.round((6 + 2 * Math.floor(Math.max(0, round - 1) / 3) + Math.min(5, Math.max(1, survivors))) * scale));
}
export function battleHpLoss(battle: BattleOutput, round: number, scale = 1) {
  const count = (team: 'left' | 'right') => battle.units.filter(unit => unit.team === team && unit.survivingHp > 0).length;
  const drawDamage = Math.max(1, Math.round((6 + 2 * Math.floor(Math.max(0, round - 1) / 3)) * scale));
  return {
    left: battle.outcome === 'right' ? defeatDamage(round, count('right'), scale) : battle.outcome === 'draw' ? drawDamage : 0,
    right: battle.outcome === 'left' ? defeatDamage(round, count('left'), scale) : battle.outcome === 'draw' ? drawDamage : 0,
  };
}

export function settleLobbyRound(input: { hp: number; opponents: AutochessOpponent[]; opponentId: string; battle: BattleOutput; round: number; seed: number; playerCatchup?: CatchupState; playerFielded?: number; playerCapacity?: number; playerBounty?: LossBounty }) {
  const opponents = input.opponents.map(entry => ({ ...entry }));
  const events: { name: string; loss: number; hp: number }[] = [];
  const losers = new Set<string>();
  const outcomes = new Map<string, 'win' | 'loss' | 'draw'>();
  outcomes.set(input.opponentId, input.battle.outcome === 'right' ? 'win' : input.battle.outcome === 'left' ? 'loss' : 'draw');
  if (input.battle.outcome === 'left') losers.add(input.opponentId);
  const damage = battleHpLoss(input.battle, input.round);
  const hp = Math.max(0, input.hp - damage.left);
  if (damage.left) events.push({ name: '你', loss: input.hp - hp, hp });
  const apply = (seat: AutochessOpponent, loss: number) => {
    const before = seat.hp;
    seat.hp = Math.max(0, seat.hp - loss);
    if (loss) events.push({ name: seat.name, loss: before - seat.hp, hp: seat.hp });
  };
  const opponent = opponents.find(entry => entry.id === input.opponentId);
  if (opponent) apply(opponent, damage.right);
  // Every other living seat also plays once. With odd seats, one fights a copy;
  // only the real seat takes damage, so nobody gets charged for two matches.
  const remaining = opponents.filter(entry => entry.id !== input.opponentId && entry.hp > 0);
  const offset = remaining.length ? (input.round - 1) % remaining.length : 0;
  const ordered = [...remaining.slice(offset), ...remaining.slice(0, offset)];
  for (let i = 0; i < ordered.length; i += 2) {
    const left = ordered[i]!;
    const right = ordered[i + 1];
    const ghost = right ?? input.opponents.find(entry => entry.id !== left.id && entry.hp > 0);
    if (!ghost) continue;
    const result = simulateBattle({ battleId: `lobby-${input.seed}-${input.round}-${i}`, seed: input.seed + input.round * 997 + i,
      left: left.board, right: ghost.board });
    const loss = battleHpLoss(result, input.round);
    outcomes.set(left.id, result.outcome === 'left' ? 'win' : result.outcome === 'right' ? 'loss' : 'draw');
    if (right) outcomes.set(right.id, result.outcome === 'right' ? 'win' : result.outcome === 'left' ? 'loss' : 'draw');
    if (result.outcome === 'right') losers.add(left.id);
    if (right && result.outcome === 'left') losers.add(right.id);
    apply(left, loss.left);
    if (right) apply(right, loss.right);
  }
  const livingHp = [hp, ...opponents.map(seat => seat.hp)].filter(value => value > 0).sort((a,b) => a-b);
  const median = livingHp[Math.floor(livingHp.length / 2)] ?? 0;
  for (const seat of opponents) seat.catchup = recordCatchup(seat.catchup, losers.has(seat.id), seat.board.length, fieldCapacity(input.round, seat.bonusCap), seat.hp, median);
  const playerCatchup = recordCatchup(input.playerCatchup, input.battle.outcome === 'right', input.playerFielded ?? 0, input.playerCapacity ?? fieldCapacity(input.round), hp, median);
  for (const seat of opponents) {
    const outcome = outcomes.get(seat.id);
    if (!outcome) continue;
    const bounty = settleLossBounty(seat.bounty, outcome, seat.hp);
    seat.bounty = bounty.state;
    if (bounty.payout) seat.gold = (seat.gold ?? AUTOCHESS_START_GOLD) + bounty.payout;
  }
  const bounty = settleLossBounty(input.playerBounty, input.battle.outcome === 'left' ? 'win' : input.battle.outcome === 'right' ? 'loss' : 'draw', hp);
  return { hp, opponents, events, playerCatchup, playerBounty: bounty.state, bountyPayout: bounty.payout };
}
