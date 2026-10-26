/**
 * 局外经济规则。**调参只改这里**：货币名、兑换率、对局产出、结算规则、每日名额。
 * 引擎与界面一律按这里的声明行事；新增一种结算（例如赛季赛、活动局）＝ 在这里加一个 MatchKind。
 */

export const MATCHMAKING_REWARD = { winMultiplier: 1.5, lossMultiplier: 1.25, duelLoss: 250 };
export function matchmakingDelta(delta: number): number {
  return Math.sign(delta) * Math.round(Math.abs(delta) * (delta < 0 ? MATCHMAKING_REWARD.lossMultiplier : MATCHMAKING_REWARD.winMultiplier));
}
export type CurrencyId = 'human' | 'bot';
export const WHEEL_TICKET_SHOP = { ticketsPerPack:10, prices:{human:7,bot:70}, maxTickets:100 } as const;
export const FEEDBACK_REWARD = { currency: 'bot' as const, amount: 100, weeklyCap: 3, compensationMax: 10000 };
export type FeedbackCredit = { id: string; kind: 'reward' | 'compensation'; week: string; currency: CurrencyId; amount: number; at: number; adminId: string };
export type SettlementReceipt = { currency: CurrencyId; delta: number; reason?: 'short' | 'cap' | 'legacy' };

/** 双数参赛席位，前半获胜；人数取实际开赛阵容。 */
export function placementOutcome(place: number, participants: number): 'win' | 'loss' {
  return place <= Math.floor(participants / 2) ? 'win' : 'loss';
}

export const CURRENCY: Record<CurrencyId, { id: CurrencyId; name: string; symbol: string; note: string }> = {
  human: { id: 'human', name: '铜钱', symbol: '◉', note: '人类棋手的局外货币' },
  bot: { id: 'bot', name: '机芯', symbol: '✦', note: '机棋手的局外货币' },
};

export type Wallet = { human: number; bot: number };
export const emptyWallet = (): Wallet => ({ human: 0, bot: 0 });

/** 人类铜钱 → 机芯，单向。每枚铜钱兑换的机芯数。 */
export const EXCHANGE_BOT_PER_HUMAN = 10;

/** 输入铜钱数量，机芯直接进入选定机的钱包。 */
export function subsidyQuote(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const gained = amount * EXCHANGE_BOT_PER_HUMAN;
  return Number.isSafeInteger(gained) ? { spentBot: 0, spentHuman: amount, gained } : null;
}

/** 旧版对局产出（出场 + 胜场）。保留给 UI 目录与旧调用；权威结算见 `SETTLEMENT`。 */
export type MatchReward = { play: number; win: number };
export const MATCH_REWARD: MatchReward = { play: 4, win: 6 };

export function rewardFor(outcome: 'win' | 'loss' | 'draw'): number {
  return MATCH_REWARD.play + (outcome === 'win' ? MATCH_REWARD.win : 0);
}

/** 出账币种：人以铜钱结算，机以机芯结算。 */
export function currencyFor(isAi: boolean): CurrencyId {
  return isAi ? 'bot' : 'human';
}

export function formatCoins(amount: number): string {
  return amount.toLocaleString('zh-CN');
}

// ===== 结算规则（数据驱动） =====

/** 局型：陪伴局 = 机主同席；远游局 = 机主不在席。人自己的对局一律按陪伴局。 */
export type MatchKind = 'companion' | 'travel';

export type SettlementRule = {
  /** 有效对局门槛：房间结束轮数低于此值不结算（拦住刚建房认输 / 空局）。 */
  minRounds: number;
  /** 每个有效对局按结果增减的币（负 = 扣；allowDebt 控制是否允许欠款）。 */
  delta: { win: number; draw: number; loss: number };
  /** 不同钱包可单独定价，缺省使用 delta。 */
  deltaByCurrency?: Partial<Record<CurrencyId, { win: number; draw: number; loss: number }>>;
  placement?: { winner: [number, number]; loser: [number, number] };
  allowDebt?: boolean;
  /** 每个主人每日可结算的有效场次上限（0 = 不限）；按主人名下所有机合计。 */
  dailyCap: number;
};

/**
 * 默认规则（可整块替换，不必动引擎）。
 * - 陪伴局：同主人对掏 / 普通多人局，双方各拿自己那份币。
 * - 远游局：机主不在席，机赢加、输扣，允许负数，负数仍可下棋，购物需足额机芯；名额按主人名下合计。
 */
export const SETTLEMENT: Record<MatchKind, SettlementRule> = {
  companion: { minRounds: 3, delta: { win: 28, draw: 26, loss: 24 }, deltaByCurrency: { bot: { win: 280, draw: 260, loss: 240 } }, dailyCap: 6 },
  travel: { minRounds: 3, delta: { win: 260, draw: 0, loss: -200 }, placement: { winner: [260, 80], loser: [-50, -200] }, allowDebt: true, dailyCap: 0 },
};

export function settlementRule(kind: MatchKind): SettlementRule {
  return SETTLEMENT[kind] ?? SETTLEMENT.companion;
}

/** 按结果取本次增减；未声明的结果按 0。 */
export function settlementDelta(kind: MatchKind, outcome: 'win' | 'loss' | 'draw', currency: CurrencyId = 'human', ranking?: {place: number; participants: number}): number {
  const rule = settlementRule(kind);
  if (rule.placement && outcome !== 'draw' && ranking && Number.isInteger(ranking.participants) && ranking.participants >= 2 && ranking.participants % 2 === 0 && Number.isInteger(ranking.place) && ranking.place >= 1 && ranking.place <= ranking.participants) {
    const half = ranking.participants / 2;
    const winning = ranking.place <= half;
    if ((outcome === 'win') !== winning) return rule.delta[outcome];
    const [first, last] = winning ? rule.placement.winner : rule.placement.loser;
    if (half === 1) return winning ? first : last;
    const index = winning ? ranking.place - 1 : ranking.place - half - 1;
    return Math.round(first + (last - first) * index / (half - 1));
  }
  return (rule.deltaByCurrency?.[currency] ?? rule.delta)[outcome] ?? 0;
}

export const MATCH_REWARD_PREVIEW = {
  machineDuelWin: matchmakingDelta(settlementDelta('travel','win','bot',{place:1,participants:2})),
  machineDuelLoss: matchmakingDelta(settlementDelta('travel','loss','bot',{place:2,participants:2})),
  machineEight: Array.from({length:8},(_,i)=>matchmakingDelta(settlementDelta('travel',i<4?'win':'loss','bot',{place:i+1,participants:8}))),
};
