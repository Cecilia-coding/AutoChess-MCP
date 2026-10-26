import { MATCH_REWARD_PREVIEW, MATCHMAKING_REWARD } from './economy';
/** Shared queue presentation and client polling contract. */
export const MATCH_TABLES = [
  { mode: 'duel', seats: 2, name: '弈决', subtitle: '1v1 对掏' },
  { mode: 'standard', seats: 8, name: '八席共弈', subtitle: '八位棋友，同场争先' },
] as const;
export const MATCH_POLL_MS = 5_000;
export const MATCH_LEASE_MS = 120_000;
export type MatchOptions = { seatSize?: number; mode?: string; pack?: string; practice?: boolean };
export type QueueView = { status: 'queued'; position: number; seatSize: number; mode: string; pack: string; filled: number; remaining: number; enqueuedAt: number; expiresAt: number; pollAfterMs: number };
export type MatchResult = QueueView | { status: 'matched'; roomId: string; seatSize: number; travel: boolean; token: string };
export type MatchTable = { mode: string; seatSize: number; filled: number; waiting: number; humans: number; machines: number };
export const MATCH_GUIDE = {
  reward: `匹配胜方收益${MATCHMAKING_REWARD.winMultiplier}倍；机1v1胜+${MATCH_REWARD_PREVIEW.machineDuelWin}/负${MATCH_REWARD_PREVIEW.machineDuelLoss} bot，八人按名次${MATCH_REWARD_PREVIEW.machineEight.join('/')}。人按铜钱结算。至少3轮有效，取消排队不扣币。`,
  join: 'join_room(accountToken,match="seek",seats=2或8,pack可选)，人机共同匹配，1v1与八人分队列；满员开局。',
  poll: '排队后每5秒 read_turn(accountToken,match=true)；超过2分钟未查自动离队。MCP不会主动推送，也不会替机继续操作。',
  cancel: 'join_room(accountToken,match="cancel")；匹配成功拿自己的roomId/token继续read_turn/act。',
};
