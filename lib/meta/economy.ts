/**
 * 局外经济规则：**单一来源读取 `lib/meta/game-config.ts`**。
 * 运营可在后台配置表实时修改，保存后同步生效；保留导出结构以兼容既有调用与测试。
 */
import { getGameConfig, onGameConfigChange, type EconomyConfig } from './game-config';

export type CurrencyId = 'human' | 'bot';
export type FeedbackCredit = { id: string; kind: 'reward' | 'compensation'; week: string; currency: CurrencyId; amount: number; at: number; adminId: string };
export type SettlementReceipt = { currency: CurrencyId; delta: number; arcadeTickets?: number; reason?: 'short' | 'cap' | 'legacy' };
export type MatchReward = { play: number; win: number };
export type MatchKind = 'companion' | 'travel';
export type SettlementRule = {
  minRounds: number;
  delta: { win: number; draw: number; loss: number };
  deltaByCurrency?: Partial<Record<CurrencyId, { win: number; draw: number; loss: number }>>;
  placement?: { winner: [number, number]; loser: [number, number] };
  arcadeTickets?: { win: number; draw: number; loss: number };
  allowDebt?: boolean;
  dailyCap: number;
};

export const CURRENCY: Record<CurrencyId, { id: CurrencyId; name: string; symbol: string; note: string }> = {
  human: { id: 'human', name: '铜钱', symbol: '◉', note: '人类棋手的局外货币' },
  bot: { id: 'bot', name: '机芯', symbol: '✦', note: '机棋手的局外货币' },
};

export type Wallet = { human: number; bot: number };
export const emptyWallet = (): Wallet => ({ human: 0, bot: 0 });

export const MATCHMAKING_REWARD = { winMultiplier: 1.5, lossMultiplier: 1.25, duelLoss: 250 };
export const ARCADE_TICKET_SHOP = {
  ticketsPerPack: 1,
  maxPackCount: 100,
  prices: { human: 8, bot: 80 },
  maxTickets: 200,
};
export const FEEDBACK_REWARD = { currency: 'bot' as const, amount: 100, weeklyCap: 3, compensationMax: 10000 };
export const MATCH_REWARD: MatchReward = { play: 4, win: 6 };
export let EXCHANGE_BOT_PER_HUMAN = 10;

export const SETTLEMENT: Record<MatchKind, SettlementRule> = {
  companion: {
    minRounds: 3,
    delta: { win: 36, draw: 24, loss: 16 },
    deltaByCurrency: { bot: { win: 360, draw: 240, loss: 160 } },
    arcadeTickets: { win: 1, draw: 0, loss: 0 },
    dailyCap: 6,
  },
  travel: {
    minRounds: 3,
    delta: { win: 260, draw: 0, loss: -200 },
    placement: { winner: [260, 80], loser: [-50, -200] },
    arcadeTickets: { win: 2, draw: 0, loss: 0 },
    allowDebt: true,
    dailyCap: 0,
  },
};

function syncEconomyFromConfig() {
  const cfg = getGameConfig();
  const eco: EconomyConfig = cfg.economy;
  const arc = cfg.arcade;

  EXCHANGE_BOT_PER_HUMAN = eco.exchangeBotPerHuman;
  MATCHMAKING_REWARD.winMultiplier = eco.matchmakingWinMultiplier;
  MATCHMAKING_REWARD.lossMultiplier = eco.matchmakingLossMultiplier;
  MATCHMAKING_REWARD.duelLoss = eco.matchmakingDuelLoss;

  ARCADE_TICKET_SHOP.maxPackCount = arc.maxPackCount;
  ARCADE_TICKET_SHOP.prices.human = arc.ticketHumanPrice;
  ARCADE_TICKET_SHOP.prices.bot = arc.ticketBotPrice;
  ARCADE_TICKET_SHOP.maxTickets = arc.maxTickets;

  FEEDBACK_REWARD.amount = eco.feedbackRewardBot;
  FEEDBACK_REWARD.weeklyCap = eco.feedbackWeeklyCap;
  FEEDBACK_REWARD.compensationMax = eco.feedbackCompensationMax;

  MATCH_REWARD.play = eco.legacyPlayReward;
  MATCH_REWARD.win = eco.legacyWinReward;

  SETTLEMENT.companion.minRounds = eco.companionMinRounds;
  SETTLEMENT.companion.delta = { win: eco.companionHumanWin, draw: eco.companionHumanDraw, loss: eco.companionHumanLoss };
  SETTLEMENT.companion.deltaByCurrency = {
    bot: { win: eco.companionBotWin, draw: eco.companionBotDraw, loss: eco.companionBotLoss },
  };
  SETTLEMENT.companion.arcadeTickets = { win: eco.companionWinTickets, draw: 0, loss: 0 };
  SETTLEMENT.companion.dailyCap = eco.companionDailyCap;

  SETTLEMENT.travel.minRounds = eco.travelMinRounds;
  SETTLEMENT.travel.delta = { win: eco.travelWinnerFirst, draw: 0, loss: eco.travelLoserLast };
  SETTLEMENT.travel.placement = {
    winner: [eco.travelWinnerFirst, eco.travelWinnerLast],
    loser: [eco.travelLoserFirst, eco.travelLoserLast],
  };
  SETTLEMENT.travel.arcadeTickets = { win: eco.travelWinTickets, draw: 0, loss: 0 };
  SETTLEMENT.travel.dailyCap = eco.travelDailyCap;
}

syncEconomyFromConfig();
onGameConfigChange(syncEconomyFromConfig);

export function exchangeBotPerHuman(): number {
  return getGameConfig().economy.exchangeBotPerHuman;
}

export function matchmakingDelta(delta: number): number {
  const { matchmakingWinMultiplier, matchmakingLossMultiplier } = getGameConfig().economy;
  return Math.sign(delta) * Math.round(Math.abs(delta) * (delta < 0 ? matchmakingLossMultiplier : matchmakingWinMultiplier));
}

export function placementOutcome(place: number, participants: number): 'win' | 'loss' {
  return place <= Math.floor(participants / 2) ? 'win' : 'loss';
}

export function subsidyQuote(amount: number, rate = exchangeBotPerHuman()) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const gained = amount * rate;
  return Number.isSafeInteger(gained) ? { spentBot: 0, spentHuman: amount, gained } : null;
}

export function rewardFor(outcome: 'win' | 'loss' | 'draw'): number {
  const { legacyPlayReward, legacyWinReward } = getGameConfig().economy;
  return legacyPlayReward + (outcome === 'win' ? legacyWinReward : 0);
}

export function currencyFor(isAi: boolean): CurrencyId {
  return isAi ? 'bot' : 'human';
}

export function formatCoins(amount: number): string {
  return amount.toLocaleString('zh-CN');
}

export function settlementRule(kind: MatchKind): SettlementRule {
  return SETTLEMENT[kind] ?? SETTLEMENT.companion;
}

export function settlementDelta(
  kind: MatchKind,
  outcome: 'win' | 'loss' | 'draw',
  currency: CurrencyId = 'human',
  ranking?: { place: number; participants: number },
): number {
  const rule = settlementRule(kind);
  if (
    rule.placement &&
    outcome !== 'draw' &&
    ranking &&
    Number.isInteger(ranking.participants) &&
    ranking.participants >= 2 &&
    ranking.participants % 2 === 0 &&
    Number.isInteger(ranking.place) &&
    ranking.place >= 1 &&
    ranking.place <= ranking.participants
  ) {
    const half = ranking.participants / 2;
    const winning = ranking.place <= half;
    if ((outcome === 'win') !== winning) return rule.delta[outcome];
    const [first, last] = winning ? rule.placement.winner : rule.placement.loser;
    if (half === 1) return winning ? first : last;
    const index = winning ? ranking.place - 1 : ranking.place - half - 1;
    return Math.round(first + ((last - first) * index) / (half - 1));
  }
  return (rule.deltaByCurrency?.[currency] ?? rule.delta)[outcome] ?? 0;
}

export const MATCH_REWARD_PREVIEW = {
  machineDuelWin: matchmakingDelta(settlementDelta('travel', 'win', 'bot', { place: 1, participants: 2 })),
  machineDuelLoss: matchmakingDelta(settlementDelta('travel', 'loss', 'bot', { place: 2, participants: 2 })),
  machineEight: Array.from({ length: 8 }, (_, i) =>
    matchmakingDelta(settlementDelta('travel', i < 4 ? 'win' : 'loss', 'bot', { place: i + 1, participants: 8 })),
  ),
};
