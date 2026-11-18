/**
 * 像素游乐摊 · 状态机引擎（纯状态推进，不碰持久化与账号锁）。
 * 负责扣费、调功能包、派发稀有外观、处理「见好就收 / 搏倍归零」风险阶段。
 */
import { type CurrencyId } from '../meta/economy';
import {
  ARCADE_LIMITS,
  ARCADE_PRIZE_SPECS,
  ARCADE_RULES_ID,
  arcadeReliefStatus,
  arcadeStakeById,
  emptyArcadeState,
  weightedPick,
  type ArcadeCommand,
  type ArcadeEvent,
  type ArcadePrize,
  type ArcadeState,
} from '../meta/arcade';
import { getGameConfig } from '../meta/game-config';
import { ARCADE_GAMES, arcadeGameById } from '../meta/arcade-registry';

export type PlayArcadeContext = {
  currency: CurrencyId;
  balance: number;
  random: () => number;
  makeId: () => string;
  at: number;
};

export type PlayArcadeOutput = {
  state: ArcadeState;
  events: ArcadeEvent[];
  coinDelta: number;
};

export function validateArcadeConfig(): void {
  const cfg = getGameConfig().arcade;
  if (!ARCADE_GAMES.length) throw Error('至少需要登记一个游乐玩法');
  if (new Set(ARCADE_GAMES.map(g => g.meta.id)).size !== ARCADE_GAMES.length) throw Error('游乐玩法 id 重复');
  if (new Set(ARCADE_PRIZE_SPECS.map(p => p.id)).size !== ARCADE_PRIZE_SPECS.length) throw Error('游乐摊奖品 id 重复');
  for (const stake of cfg.stakes) {
    if (stake.ticketCost <= 0 || stake.humanCost <= 0 || stake.botCost <= 0) throw Error(`赌注档位 ${stake.id} 无效`);
  }
  weightedPick(cfg.drops.map(d => ({ value: d.prizeId, weight: d.weight })), () => 0);
}

export function playArcade(original: ArcadeState, command: ArcadeCommand, ctx: PlayArcadeContext): PlayArcadeOutput {
  const cfg = getGameConfig().arcade;
  const state = structuredClone(original);
  const events: ArcadeEvent[] = [];
  let coinDelta = 0;

  if (state.rulesId !== ARCADE_RULES_ID) {
    throw Error('游乐摊规则版本已更新，请先迁移档案');
  }

  if (command.action === 'start') {
    if (state.starterClaimed) throw Error('迎新试手券已经领过了；对局赢棋也会掉落游乐券');
    const added = Math.min(cfg.starterTickets, cfg.maxTickets - state.tickets);
    if (added <= 0) throw Error('游乐券已达上限');
    state.starterClaimed = true;
    state.tickets += added;
    events.push({ kind: 'start', tickets: added });
    return { state, events, coinDelta };
  }

  if (command.action === 'relief') {
    if (!state.starterClaimed) throw Error('先领迎新试玩券再试，更划算');
    if (state.pendingGamble) throw Error('上一手赢到的筹码还未结算，请先选择「见好就收」或「搏倍翻番」');
    const relief = arcadeReliefStatus(state, ctx.currency, ctx.balance, ctx.at, cfg.maxTickets);
    if (!relief.broke) throw Error('手里还有游乐券或足额货币，够开下一局啦');
    if (relief.remainingToday <= 0) {
      throw Error(`今日低保救济已领完（每日上限 ${cfg.reliefDailyLimit} 次）；打一局对弈胜场也会掉落游乐券`);
    }
    const added = Math.min(cfg.reliefTickets, cfg.maxTickets - state.tickets);
    if (added <= 0) throw Error('游乐券已达上限');
    const usedToday = relief.usedToday + 1;
    state.tickets += added;
    state.relief = { day: relief.day, count: usedToday };
    events.push({ kind: 'relief', tickets: added, day: relief.day, usedToday });
    return { state, events, coinDelta };
  }

  if (command.action === 'buy_tickets') {
    const count = command.count;
    if (!Number.isSafeInteger(count) || count! < 1 || count! > cfg.maxPackCount) {
      throw Error(`购买张数须为 1 ~ ${cfg.maxPackCount} 的整数`);
    }
    if (state.tickets + count! > cfg.maxTickets) {
      throw Error(`游乐券上限为 ${cfg.maxTickets} 张`);
    }
    const ticketPrice = ctx.currency === 'bot' ? cfg.ticketBotPrice : cfg.ticketHumanPrice;
    const cost = ticketPrice * count!;
    if (ctx.balance < cost) {
      throw Error(`${ctx.currency === 'bot' ? '机芯' : '铜钱'}不足，需要 ${cost}`);
    }
    coinDelta -= cost;
    state.tickets += count!;
    events.push({ kind: 'buy_tickets', tickets: count!, cost, currency: ctx.currency });
    return { state, events, coinDelta };
  }

  if (command.action === 'play') {
    if (state.pendingGamble) {
      throw Error('上一手赢到的筹码还未结算，请先选择「见好就收」或「搏倍翻番」');
    }
    const game = arcadeGameById(command.gameId);
    if (!game) throw Error('请选择游乐摊玩法（slot-machine 或 scratchcard）');
    const stake = arcadeStakeById(command.stakeId);
    if (!stake) throw Error('请选择合法的赌注档位（small / medium / high）');
    if (command.payMode !== 'ticket' && command.payMode !== 'coin') {
      throw Error('请指明消耗方式（ticket 游乐券 或 coin 铜钱/机芯）');
    }

    const ticketPrice = ctx.currency === 'bot' ? cfg.ticketBotPrice : cfg.ticketHumanPrice;
    const spent = command.payMode === 'ticket'
      ? stake.ticketCost
      : (ctx.currency === 'bot' ? stake.botCost : stake.humanCost);
    const unitCoins = command.payMode === 'ticket'
      ? stake.ticketCost * ticketPrice
      : spent;

    if (command.payMode === 'ticket') {
      if (state.tickets < spent) throw Error(`游乐券不足，本档位需要 ${spent} 张`);
      state.tickets -= spent;
    } else {
      if (ctx.balance < spent) throw Error(`${ctx.currency === 'bot' ? '机芯' : '铜钱'}不足，需要 ${spent}`);
      coinDelta -= spent;
    }

    const roundId = ctx.makeId();
    const outcome = game.play({ stake, random: ctx.random });
    const payoutCoins = outcome.won && outcome.multiplier > 0
      ? Math.max(1, Math.round(unitCoins * outcome.multiplier))
      : 0;

    let droppedPrizeId: string | undefined;
    if (outcome.cosmeticBaseChance > 0 && state.prizes.length < ARCADE_LIMITS.prizes) {
      const chance = Math.min(1, outcome.cosmeticBaseChance * stake.cosmeticRateBoost);
      if (ctx.random() < chance) {
        const dropWeights = cfg.drops.map(d => ({ value: d.prizeId, weight: d.weight }));
        const specId = weightedPick(dropWeights, ctx.random);
        const spec = ARCADE_PRIZE_SPECS.find(item => item.id === specId);
        if (spec) {
          const prize: ArcadePrize = {
            id: ctx.makeId(),
            spec: structuredClone(spec),
            at: ctx.at,
            source: game.meta.id,
            status: 'pending',
          };
          state.prizes.push(prize);
          droppedPrizeId = prize.id;
          events.push({ kind: 'prize', prizeId: prize.id, specId: spec.id });
        }
      }
    }

    state.stats.plays++;
    if (outcome.won) {
      state.stats.wins++;
      if (outcome.tier === 'big' || outcome.tier === 'mega' || outcome.tier === 'jackpot') state.stats.bigHits++;
    } else {
      state.stats.busts++;
    }

    events.push({
      kind: 'play',
      roundId,
      gameId: game.meta.id,
      stakeId: stake.id,
      payMode: command.payMode,
      spent,
      currency: ctx.currency,
      tier: outcome.tier,
      label: outcome.label,
      payoutCoins,
      ...(droppedPrizeId ? { cosmeticPrizeId: droppedPrizeId } : {}),
    });

    if (payoutCoins > 0) {
      if (command.autoCashOut === true) {
        coinDelta += payoutCoins;
        events.push({ kind: 'cash_out', roundId, coins: payoutCoins, currency: ctx.currency });
      } else {
        state.pendingGamble = {
          roundId,
          gameId: game.meta.id,
          gameName: game.meta.name,
          stakeId: stake.id,
          currency: ctx.currency,
          initialCoins: payoutCoins,
          currentCoins: payoutCoins,
          doublesUsed: 0,
          maxDoubles: cfg.gambleMaxDoubles,
          winProbability: cfg.gambleWinProbability,
          outcomeSummary: outcome.label,
        };
      }
    }

    state.lastRound = {
      roundId,
      gameId: game.meta.id,
      gameName: game.meta.name,
      stakeId: stake.id,
      payMode: command.payMode,
      stakeAmount: spent,
      currency: ctx.currency,
      won: outcome.won,
      tier: outcome.tier,
      outcomeCode: outcome.code,
      outcomeLabel: outcome.label,
      multiplier: outcome.multiplier,
      payoutCoins,
      ...(droppedPrizeId ? { droppedPrizeId } : {}),
      detail: outcome.detail,
      at: ctx.at,
    };

    return { state, events, coinDelta };
  }

  if (command.action === 'cash_out') {
    const pending = state.pendingGamble;
    if (!pending) throw Error('当前没有待结算的游乐收益');
    if (pending.currency !== ctx.currency) throw Error('账号币种不匹配');
    coinDelta += pending.currentCoins;
    state.pendingGamble = null;
    events.push({ kind: 'cash_out', roundId: pending.roundId, coins: pending.currentCoins, currency: ctx.currency });
    return { state, events, coinDelta };
  }

  if (command.action === 'gamble') {
    const pending = state.pendingGamble;
    if (!pending) throw Error('当前没有可搏倍的筹码；先玩一把赢钱再来搏');
    if (pending.currency !== ctx.currency) throw Error('账号币种不匹配');
    if (pending.doublesUsed >= pending.maxDoubles) throw Error('本局搏倍次数已达上限，请见好就收');
    const won = ctx.random() < pending.winProbability;
    if (won) {
      const nextCoins = pending.currentCoins * cfg.gambleMultiplier;
      const nextDoubles = pending.doublesUsed + 1;
      state.stats.totalGambledWins++;
      if (nextDoubles >= pending.maxDoubles) {
        coinDelta += nextCoins;
        state.pendingGamble = null;
        events.push({ kind: 'gamble', roundId: pending.roundId, won: true, coinsAfter: nextCoins, autoCashedOut: true, currency: ctx.currency });
        events.push({ kind: 'cash_out', roundId: pending.roundId, coins: nextCoins, currency: ctx.currency });
      } else {
        state.pendingGamble = { ...pending, currentCoins: nextCoins, doublesUsed: nextDoubles };
        events.push({ kind: 'gamble', roundId: pending.roundId, won: true, coinsAfter: nextCoins, currency: ctx.currency });
      }
      return { state, events, coinDelta };
    }
    const lostCoins = pending.currentCoins;
    state.pendingGamble = null;
    state.stats.totalGambledBusts++;
    events.push({ kind: 'gamble', roundId: pending.roundId, won: false, coinsAfter: 0, lostCoins, currency: ctx.currency });
    return { state, events, coinDelta };
  }

  throw Error('此操作需要账号奖品事务');
}

export function newArcadeState(): ArcadeState {
  validateArcadeConfig();
  return emptyArcadeState();
}
