/** Private gift history is projected from the existing recipient records. */
import type { GiftPresentation } from './gift-presentation';
export type GiftLedgerDirection = 'all' | 'sent' | 'received';
export type GiftLedgerQuery = { direction?: GiftLedgerDirection; cursor?: string; limit?: number };
export type GiftLedgerEntry = {
  id: string;
  source: 'ordinary' | 'wheel';
  direction: Exclude<GiftLedgerDirection, 'all'>;
  from: { id: string; name: string };
  to: { id: string; name: string };
  item: { id: string; name: string; cosmeticId?: string; theme?: string; intro?: string };
  note?: string;
  status: 'pending' | 'claimed' | 'forwarded' | 'unknown';
  at: number;
  atIso: string;
  claimedAt?: number;
  claimedAtIso?: string;
  forwardedAt?: number;
  forwardedAtIso?: string;
  legacy?: true;
};
export type GiftLedgerPage = {
  entries: GiftLedgerEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  direction: GiftLedgerDirection;
  order: 'newest_first';
  serverNow: number;
  historyNotice: string;
  presentations: Record<'ordinary' | 'wheel', GiftPresentation>;
};
export const GIFT_LEDGER_MAX = 50;
export const GIFT_LEDGER_CURSOR_MAX = 512;
export const GIFT_LEDGER_GUIDE = {
  tool: 'read_turn', args: { giftHistory: true }, fill: ['accountToken'],
  reason: '想看看自己收到、送出的礼物？当前连接加 giftHistory=true；giftDirection 可选 sent 或 received，默认最近20条，用 giftCursor 接 nextCursor 翻页。',
};
