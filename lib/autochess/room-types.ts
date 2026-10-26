import type { SettlementReceipt } from '../meta/economy';
import type { MatchModeId } from '../../packs/modes/registry';
import type { AutochessOpponent, DraftReward } from './core';
import type { BattleOutput, Combatant } from './types';
import type { CompanionPlan } from './companion';
import type { RoomRefRegistry } from './room-refs';
import type { HexRarity } from '../../content/autochess/types';

export type HexOffer = {
  round: number;
  rarity: HexRarity;
  choices: { id: string; name: string; rarity: HexRarity; note: string; gold?: number }[];
};

/** 开局三选一：标签与候选池来自所在棋谱，选 1 件进背包后才能就绪。 */
export type SwordOffer = {
  round: number;
  /** 包级玩法词，用于按钮/标题文案。 */
  label: string;
  choices: string[];
};

/** 装备宝箱多选一：`boxes[boxIndex]` 是当前这一箱的候选，选 1 件后推进下一箱。 */
export type ItemOffer = {
  round: number;
  source: string;
  family: string;
  boxes: string[][];
  boxIndex: number;
};

export type RoomAction =
  | { kind: 'buy'; index: number }
  | { kind: 'sell'; piece: string }
  | { kind: 'move'; piece: string; row: number; col: number }
  | { kind: 'withdraw'; piece: string }
  | { kind: 'equip' | 'unequip'; piece: string; item: string }
  /** 食用/使用一次性道具（珍馐等）：永久属性记在棋子身上。 */
  | { kind: 'consume'; piece: string; item: string }
  | { kind: 'roll' | 'claim' | 'roll_and_claim' | 'ready' | 'resign' | 'cancel_room' | 'refresh' }
  /** 金币购买经验：`times` 次，每次 4 金换 4 点。 */
  | { kind: 'buy_xp'; times?: number }
  | { kind: 'pick_hex'; hex: string }
  | { kind: 'pick_item'; item: string }
  | { kind: 'pick_sword'; item: string }
  | { kind: 'plan'; plan: CompanionPlan; ready?: boolean }
  | { kind: 'unready' }
  /** 弹幕：任何人任何时候都可以发；style 是样式令牌，未知令牌降级为 default。 */
  | { kind: 'danmaku'; text: string; style?: string; battleRound?: number };

/** 弹幕样式令牌：新增样式 = 在这里加 token + UI 的 CSS 类（dm-<style>），旧消息自动降级。 */
export const DANMAKU_STYLES = ['default', 'gold'] as const;
export type DanmakuStyle = (typeof DANMAKU_STYLES)[number];
export type DanmakuMessage = { id: string; index: number; name: string; text: string; style: string; at: number; prepareRound?: number; battleRound?: number };
export type RoomSeatView = Pick<AutochessOpponent, 'id' | 'name' | 'hp' | 'board' | 'bench'> & {
  result?: Pick<RoomResult, 'place' | 'outcome'>;
  ready: boolean; online: boolean; say: string; bot?: boolean;
  /** 挂靠的人类账号（bot/路人为空）。 */
  accountId?: string;
  /** 该席位装备的棋盘皮肤 id；渲染时双方各用各的。 */
  skinId?: string;
  /** 该席位装备的头像框 id。 */
  frame?: string;
};
export type RoomVenue = { host: number; opponent: number; skinId: string; visiting: boolean; ghost?: boolean };
export type RoomFight = { left: number; right: number; host: number; ghost?: boolean; output: BattleOutput };
export type RoomHazardBan = { round?: number; zone?: 'field' | 'bench'; pieceId: string; templateId: string; name: string; chancePct: number; refundGold?: number; returnedItems?: string[] };
export type RoomResult = { place: number; participants: number; outcome: 'win' | 'loss' | 'draw'; round: number; reward?: SettlementReceipt; payment: 'pending' | 'paid' | 'guest' };
export type RoomSelf = AutochessOpponent & RoomRefRegistry & {
  result?: RoomResult;
  revision: number; ready: boolean; shop: (string | null)[]; capacity: number;
  /** 棋手等级/经验：等级即人口。 */
  level?: number; xp?: number;
  /** 当前连胜场数，用于连胜金币。 */
  winStreak?: number;
  lastPlan?: {requestId:string;round:number;revision?:number;merged:{from:string;to:string;templateId?:string;zone?:'fielded'|'benched';star?:number}[];
    references?:{from:string;to:string;templateId:string;zone:'fielded'|'benched';star:number}[];invalidated?:string[];
    positionsApplied?:{piece:string;row:number;col:number}[];adjustments:string[]};
  lastDraft?: {round:number;kind:string;label:string;hpDelta:number;goldDelta:number;noop:boolean;lethal:boolean};
  shopRefresh?: number;
  freeRefreshes?: { hex: string; until: number; perRound: number; left: number };
  /** RP 梗包「回合级效果」：hexId → 到期轮次（到期后保留，标记已经触发）。 */
  roundFx?: Record<string, number>;
  /** RP 梗包：到该轮为止不扣气血（睡吧，我守着）。 */
  noHpUntil?: number;
  /** RP 梗包：到该轮为止记录花费并到期返还（连本带利）。 */
  cashbackUntil?: number;
  /** RP 梗包：连本带利窗口内累计的花费。 */
  cashbackSpent?: number;
  hexWinTally?: { hex: string; wins: number }[];
  hexOffer?: HexOffer;
  /** Sequential choose-one item boxes; unresolved boxes block readying. */
  itemOffer?: ItemOffer;
  /** 开局装备三选一，未选不能就绪。 */
  swordOffer?: SwordOffer;
  /** 已触发过的棋手气血类心悟（残甲锻锋），避免重复发放。 */
  hexFlags?: string[];
  /** 心悟的累计计数（神秘宝匣系的三档共享计数）。 */
  hexCounters?: Record<string, number>;
  shopBanUntil?: number;
  hexPayouts?: { round: number; gold: number; hex: string; minGold?: number }[];
  /** 风控：累计封号次数（unitId → 次数），作查IP黑名单。 */
  banCounts?: Record<string, number>;
  /** 本回合风控结果：封号离场 / 罢工缺席 / 售罄 / 价格波动（查 IP 战后结算，其余在回合开始结算）。 */
  roundHazards?: { round: number; banned?: RoomHazardBan[]; struck: string[]; soldOut: string[]; priceDelta: Record<string, number> };
  draft?: { round: number; sourceRound?: number; track: DraftReward[]; position: number; roll?: number; landing?: number };
};
export type RoomBattle = { round: number; output: BattleOutput; boards: Combatant[][]; benches: Combatant[][]; losses: number[]; payouts: number[]; fights?: RoomFight[] };
export type RoomView = {
  wake?: {requestedAt?:number;receivedAt?:number;status:string};
  id: string; revision: number; round: number; phase: 'waiting' | 'prepare' | 'finished';
  cancelled?: boolean;
  mode?: MatchModeId; maxHp?: number;
  pack?: string; packName?: string; seatCount?: number; opponentIndex?: number; venue?: RoomVenue;
  seats: RoomSeatView[]; self?: RoomSelf; seatIndex?: number; battle?: RoomBattle;
  /** 弹幕流（最近 N 条，含机/人的发言）。 */
  danmaku?: DanmakuMessage[];
  winner?: number | 'draw'; log: string[]; cursor: { enabled: boolean; status: string };
};
export type RoomCredentials = { roomId: string; token: string };
export type RoomMutation = RoomCredentials & { round: number; revision: number; requestId: string; action: RoomAction };
