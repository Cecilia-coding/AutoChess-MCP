/**
 * 像素游乐摊 · 共享骨架（赌注规格、搏倍机制、奖品与插件接口）。
 * 数值与权重全部由 `lib/meta/game-config.ts` 驱动，支持后台配置表实时热调。
 */
import { type CurrencyId } from './economy';
import { getGameConfig, onGameConfigChange } from './game-config';
import type { GiftPresentation } from './gift-presentation';

export type ArcadeGameId = 'slot-machine' | 'scratchcard' | (string & {});
export type ArcadeStakeId = 'small' | 'medium' | 'high';
export type ArcadePayMode = 'ticket' | 'coin';

export type Weighted<T> = { value: T; weight: number };

export function weightedPick<T>(entries: readonly Weighted<T>[], random: () => number): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!entries.length || entries.some(entry => !Number.isFinite(entry.weight) || entry.weight <= 0) || !Number.isFinite(total)) {
    throw Error('奖池权重无效');
  }
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('随机源无效');
  let cursor = value * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.value;
  }
  return entries[entries.length - 1]!.value;
}

export type ArcadeStakeSpec = {
  id: ArcadeStakeId;
  label: string;
  badge: string;
  ticketCost: number;
  humanCost: number;
  botCost: number;
  cosmeticRateBoost: number;
};

export const ARCADE_STAKES: ArcadeStakeSpec[] = [];
export const ARCADE_GAMBLE_RULES = { winProbability: 0.48, multiplier: 2, maxDoubles: 3 };
export let ARCADE_STARTER_TICKETS = 5;
export const ARCADE_RELIEF_RULES = { tickets: 2, dailyLimit: 5 };
export const ARCADE_LIMITS = { prizes: 1000, receipts: 32 } as const;
export const ARCADE_RULES_ID = 'pixel-arcade-v1';

export type ArcadePrizeSpec = {
  id: string;
  name: string;
  icon: string;
  cosmeticId: string;
  giftable: boolean;
  rarity: 'rare' | 'epic';
};

export const ARCADE_PRIZE_SPECS: readonly ArcadePrizeSpec[] = [
  { id: 'olive', name: '灵橄 · 衔春', icon: '🕊️', cosmeticId: 'frame-revival-olive', giftable: true, rarity: 'rare' },
  { id: 'ivy', name: '青藤 · 凌霄', icon: '🌿', cosmeticId: 'frame-revival-ivy', giftable: true, rarity: 'rare' },
  { id: 'astrolabe', name: '时间星盘 · 异色', icon: '✦', cosmeticId: 'skin-time-astrolabe', giftable: true, rarity: 'epic' },
] as const;

export const ARCADE_COSMETIC_DROPS: Weighted<string>[] = [];

function syncArcadeFromConfig() {
  const arc = getGameConfig().arcade;
  ARCADE_STAKES.splice(0, ARCADE_STAKES.length, ...arc.stakes.map(s => ({ ...s })));
  ARCADE_GAMBLE_RULES.winProbability = arc.gambleWinProbability;
  ARCADE_GAMBLE_RULES.multiplier = arc.gambleMultiplier;
  ARCADE_GAMBLE_RULES.maxDoubles = arc.gambleMaxDoubles;
  ARCADE_STARTER_TICKETS = arc.starterTickets;
  ARCADE_RELIEF_RULES.tickets = arc.reliefTickets;
  ARCADE_RELIEF_RULES.dailyLimit = arc.reliefDailyLimit;
  ARCADE_COSMETIC_DROPS.splice(
    0,
    ARCADE_COSMETIC_DROPS.length,
    ...arc.drops.map(d => ({ value: d.prizeId, weight: d.weight })),
  );
}

syncArcadeFromConfig();
onGameConfigChange(syncArcadeFromConfig);

export function arcadeStakeById(id: string | undefined): ArcadeStakeSpec | undefined {
  return getGameConfig().arcade.stakes.find(entry => entry.id === id);
}

export type ArcadeGameOutcome = {
  code: string;
  label: string;
  tier: 'bust' | 'win' | 'big' | 'mega' | 'jackpot';
  won: boolean;
  multiplier: number;
  cosmeticBaseChance: number;
  detail: Record<string, unknown>;
};

export type ArcadePaytableRow = {
  combo: string;
  payout: string;
  note: string;
};

export type ArcadeGameMeta = {
  id: ArcadeGameId;
  name: string;
  subtitle: string;
  badge: string;
  tagline: string;
  paytable: ArcadePaytableRow[];
};

export type ArcadeGamePlayContext = {
  stake: ArcadeStakeSpec;
  random: () => number;
};

export interface ArcadeGamePlugin {
  readonly meta: ArcadeGameMeta;
  play(ctx: ArcadeGamePlayContext): ArcadeGameOutcome;
}

export type ArcadePrize = {
  id: string;
  spec: ArcadePrizeSpec;
  at: number;
  source: ArcadeGameId | 'gift' | 'legacy';
  status: 'pending' | 'used' | 'sent';
  from?: { id: string; name: string };
  to?: { id: string; name: string };
  note?: string;
  settledAt?: number;
};

export type ArcadeClaimAction = {
  tool: 'claim_gift';
  args: { giftId: string };
  fill: ['accountToken'];
};

export type ArcadePendingGamble = {
  roundId: string;
  gameId: ArcadeGameId;
  gameName: string;
  stakeId: ArcadeStakeId;
  currency: CurrencyId;
  initialCoins: number;
  currentCoins: number;
  doublesUsed: number;
  maxDoubles: number;
  winProbability: number;
  outcomeSummary: string;
};

export type ArcadeLastRound = {
  roundId: string;
  gameId: ArcadeGameId;
  gameName: string;
  stakeId: ArcadeStakeId;
  payMode: ArcadePayMode;
  stakeAmount: number;
  currency: CurrencyId;
  won: boolean;
  tier: ArcadeGameOutcome['tier'];
  outcomeCode: string;
  outcomeLabel: string;
  multiplier: number;
  payoutCoins: number;
  droppedPrizeId?: string;
  detail: Record<string, unknown>;
  at: number;
};

export type ArcadeStats = {
  plays: number;
  wins: number;
  busts: number;
  bigHits: number;
  totalGambledWins: number;
  totalGambledBusts: number;
};

export type ArcadeEvent =
  | { kind: 'start'; tickets: number }
  | { kind: 'relief'; tickets: number; day: string; usedToday: number }
  | { kind: 'buy_tickets'; tickets: number; cost: number; currency: CurrencyId }
  | { kind: 'play'; roundId: string; gameId: ArcadeGameId; stakeId: ArcadeStakeId; payMode: ArcadePayMode; spent: number; currency: CurrencyId; tier: ArcadeGameOutcome['tier']; label: string; payoutCoins: number; cosmeticPrizeId?: string }
  | { kind: 'cash_out'; roundId: string; coins: number; currency: CurrencyId }
  | { kind: 'gamble'; roundId: string; won: boolean; coinsAfter: number; lostCoins?: number; autoCashedOut?: boolean; currency: CurrencyId }
  | { kind: 'prize'; prizeId: string; specId: string }
  | { kind: 'use'; prizeId: string; cosmeticId: string }
  | { kind: 'gift'; prizeId: string; toId: string; toName: string; cosmeticId: string };

export type ArcadeCommand = {
  action: 'start' | 'relief' | 'buy_tickets' | 'play' | 'cash_out' | 'gamble' | 'use' | 'gift';
  requestId: string;
  revision: number;
  gameId?: ArcadeGameId;
  stakeId?: ArcadeStakeId;
  payMode?: ArcadePayMode;
  autoCashOut?: boolean;
  count?: number;
  prizeId?: string;
  to?: string;
  note?: string;
};

export type ArcadeReceipt = {
  requestId: string;
  fingerprint: string;
  revision: number;
  events: ArcadeEvent[];
};

export type ArcadeState = {
  rulesId: string;
  starterClaimed: boolean;
  revision: number;
  tickets: number;
  relief?: { day: string; count: number };
  stats: ArcadeStats;
  pendingGamble: ArcadePendingGamble | null;
  lastRound: ArcadeLastRound | null;
  prizes: ArcadePrize[];
  receipts: ArcadeReceipt[];
};

export type ArcadeReliefStatus = {
  tickets: number;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  eligible: boolean;
};

/** Compute daily bankruptcy relief availability from state & lowest stake cost (single source of truth). */
export function arcadeReliefStatus(
  state: Pick<ArcadeState, 'starterClaimed' | 'tickets' | 'pendingGamble' | 'relief'>,
  currency: CurrencyId,
  balance: number,
  at: number,
  maxTickets = getGameConfig().arcade.maxTickets,
): { day: string; usedToday: number; remainingToday: number; broke: boolean; hasRoom: boolean; eligible: boolean } {
  const { reliefDailyLimit, stakes } = getGameConfig().arcade;
  const day = new Date(at).toISOString().slice(0, 10);
  const usedToday = state.relief?.day === day ? state.relief.count : 0;
  const remainingToday = Math.max(0, reliefDailyLimit - usedToday);
  const minStake = stakes[0]!;
  const minCoinCost = currency === 'bot' ? minStake.botCost : minStake.humanCost;
  const broke = state.tickets < minStake.ticketCost && balance < minCoinCost;
  const hasRoom = state.tickets < maxTickets;
  const eligible = state.starterClaimed && !state.pendingGamble && broke && remainingToday > 0 && hasRoom;
  return { day, usedToday, remainingToday, broke, hasRoom, eligible };
}

export type ArcadeView = {
  enabled: boolean;
  games: ArcadeGameMeta[];
  stakes: readonly ArcadeStakeSpec[];
  gambleRules: typeof ARCADE_GAMBLE_RULES;
  starterTickets: number;
  relief: ArcadeReliefStatus;
  wallet: { human: number; bot: number; activeCurrency: CurrencyId; activeBalance: number };
  ticketShop: {
    currency: CurrencyId;
    currencyName: string;
    balance: number;
    ticketsPerPack: number;
    packPrice: number;
    maxPackCount: number;
    maxTickets: number;
  };
  state: Omit<ArcadeState, 'receipts' | 'prizes'> & {
    prizes: (ArcadePrize & { claimAction?: ArcadeClaimAction })[];
  };
  guide: typeof ARCADE_GUIDE;
  gifting?: {
    isAi: boolean;
    recipients: { id: string; username: string }[];
    presentation?: GiftPresentation;
  };
  giftDelivery?: {
    status: 'delivered';
    viewState: 'unreported';
    recipientName?: string;
    presentation: GiftPresentation;
  };
  recipientHint: string;
  receipt?: Omit<ArcadeReceipt, 'fingerprint'>;
  replayed?: boolean;
};

export const ARCADE_GUIDE = {
  actions: {
    start: '首次领取迎新游乐券（每账号仅限一次）',
    relief: '游乐券与货币都不足一局最低注时领取每日低保救济券',
    buy_tickets: '用铜钱/机芯兑换游乐券；count 填 1~100',
    play: '开一局：gameId 可选 slot-machine / scratchcard，stakeId 可选 small / medium / high，payMode 可选 ticket / coin',
    cash_out: '将本局赢得且暂存在待决区的收益见好就收，直接落袋',
    gamble: '对待决收益搏倍（翻倍或失手归零，可连续搏倍）',
    use: '待领礼物优先直接调用该奖品的 claimAction；自有奖品可用 use 拆开入囊',
    gift: 'prizeId 填待领外观实例 id，可带 to（多只机时指名）和 note（<=60 字）互赠给绑定棋友/人类/机',
  },
  hint: '每次操作须附带当前 state.revision 与唯一 requestId；断线原单重试保持参数与 requestId 不变。',
} as const;

export function emptyArcadeState(): ArcadeState {
  return {
    rulesId: ARCADE_RULES_ID,
    starterClaimed: false,
    revision: 0,
    tickets: 0,
    stats: { plays: 0, wins: 0, busts: 0, bigHits: 0, totalGambledWins: 0, totalGambledBusts: 0 },
    pendingGamble: null,
    lastRound: null,
    prizes: [],
    receipts: [],
  };
}
