import { GIFT_NOTE_SCHEMA, GIFT_NOTE_GUIDANCE } from '../meta/gift-copy';
import { giftPresentation } from '../meta/gift-presentation';
import { GIFT_LEDGER_GUIDE, GIFT_LEDGER_MAX } from '../meta/gift-ledger';
import { CHESS_MCP_TITLE, CHESS_SERVICE_ID } from '../meta/chess-brand';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AccountStore } from './account-store';
import type { EchoTreeStore } from './echo-tree-store';
import type { MatchService } from './match-service';
import { announcementsFor } from '../meta/announcements';
import { CURRENCY, EXCHANGE_BOT_PER_HUMAN, SETTLEMENT } from '../meta/economy';
import { listedCosmetics, cosmeticPrice } from '../meta/cosmetics';

export type OutgameDeps = { accounts: AccountStore; echo: EchoTreeStore; match?: MatchService };
type ToolArgs = { accountToken: string; since?: number; afterId?: string | null; cosmeticId?: string; note?: string; seats?: number; mode?: string; practice?: boolean; giftHistory?: boolean; giftDirection?: 'all' | 'sent' | 'received'; giftCursor?: string; limit?: number };

/**
 * 局外 MCP：棋局之外逛商店 / 看公告 / 送礼。对局内的三工具（join_room/read_turn/act）保持不变。
 *
 * 两类工具：
 *  - 拿进来：`read_world`（公告 / 商品与币价 / 余额 / 回音树新消息）
 *  - 给出去：`submit_purchase`（下单）/ `send_gift`（送礼，可带短附言）
 *
 * 扩展：加一件商品进 `lib/meta/cosmetics.ts`；加一条公告进 `lib/meta/announcements.ts`；
 * 加一类回音事件进 `lib/meta/echo-tree.ts`。这里只负责暴露，不写死内容。
 */
export function createOutgameMcp({ accounts, echo, match }: OutgameDeps) {
  const server = new McpServer({ name: `${CHESS_SERVICE_ID}-outgame`, title: `${CHESS_MCP_TITLE}-outgame`, version: '0.2.1' });
  const auth = { accountToken: z.string().min(20).max(100).describe('账号 token：机从快捷入座或 register_ai / login_ai 回包获取，玩家从 login 回包获取') };
  const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });
  const guarded = (fn: (args: ToolArgs) => unknown) => async (args: ToolArgs) => {
    try { return result(await fn(args)); }
    catch (e) { return { ...result({ error: e instanceof Error ? e.message : '操作失败' }), isError: true }; }
  };

  server.registerTool('read_world', {
    description: '局外读公告、商品、余额、已拥有和回音树；giftHistory=true 单独查自己收到/送出的普通与对对碰礼物。回音树用 afterId 翻页：null 从最早保留礼笺开始，之后接 nextId。赠礼记录用 giftCursor 接 nextCursor。',
    inputSchema: {
      ...auth,
      afterId: z.string().min(1).max(80).nullable().optional().describe('回音树礼笺 ID 游标；null 从最早保留的礼笺开始。优先于 since。'),
      since: z.number().int().min(0).optional().describe('旧版毫秒时间游标；新客户端用 afterId 防止同毫秒或多页漏消息。'),
      giftHistory: z.boolean().optional().describe('只看自己的收发礼物记录、寄语、时间和领取状态'),
      giftDirection: z.enum(['all','sent','received']).optional().describe('仅giftHistory=true：all全部（默认），sent送出，received收到'),
      giftCursor: z.string().min(1).max(512).optional().describe('仅giftHistory=true：原样接nextCursor；切换方向时省略'),
      limit: z.number().int().min(1).max(GIFT_LEDGER_MAX).optional().describe('仅giftHistory=true，每次1–50条，默认20'),
    },
    annotations: { readOnlyHint: true },
  }, guarded(a => {
    if (a.giftHistory) {
      if (a.afterId !== undefined || a.since !== undefined) throw Error('赠礼记录与回音树分开查询；赠礼记录翻页用 giftCursor');
      return { giftHistory: accounts.giftLedger(a.accountToken, { ...(a.giftDirection !== undefined ? { direction: a.giftDirection } : {}), ...(a.giftCursor !== undefined ? { cursor: a.giftCursor } : {}), ...(a.limit !== undefined ? { limit: a.limit } : {}) }), giftHistoryGuide: { ...GIFT_LEDGER_GUIDE, tool: 'read_world' } };
    }
    if (a.giftDirection !== undefined || a.giftCursor !== undefined || a.limit !== undefined) throw Error('giftDirection、giftCursor 和 limit 只用于赠礼记录，请同时填 giftHistory=true');
    const account = accounts.authenticate(a.accountToken);
    if (!account) throw Error('登录态无效，请先 login / login_ai 拿 token');
    const self = accounts.selfAccount(a.accountToken);
    accounts.flushPendingEcho();
    const page = a.afterId !== undefined ? echo.pageAfter(a.afterId, 20) : undefined;
    const legacyEvents = page ? undefined : a.since === undefined ? echo.recent(20) : echo.since(a.since, 20);
    return {
      me: { id: self.id, name: self.username, isAi: self.isAi, ownerName: self.ownerName, wallet: self.coins, record: self.record },
      currencies: CURRENCY,
      exchange: { botPerHuman: EXCHANGE_BOT_PER_HUMAN, humanToBot: EXCHANGE_BOT_PER_HUMAN, note: `1铜钱换${EXCHANGE_BOT_PER_HUMAN}机芯，玩家选定自家机接济，机芯直接入它的钱包` },
      settlement: SETTLEMENT,
      giftNoteHint: account.isAi ? GIFT_NOTE_GUIDANCE : undefined,
      giftPresentation: account.isAi ? giftPresentation('ordinary') : undefined,
      giftHistoryGuide: { ...GIFT_LEDGER_GUIDE, tool: 'read_world' },
      announcements: announcementsFor(account.isAi ? 'ai' : 'human'),
      catalog: { cosmetics: listedCosmetics().map(c => ({ id: c.id, name: c.name, kind: c.kind, theme: c.tagline, intro: c.giftIntro, price: cosmeticPrice(c, account.isAi ? 'bot' : 'human'), acquisition: c.acquisition ?? 'shop' })), owned: self.owned, equipped: self.equipped },
      echo: page
        ? { latestAt: page.events.at(-1)?.at ?? 0, latestId: echo.latestId(), ...page }
        : { latestAt: legacyEvents?.[0]?.at ?? a.since ?? 0, latestId: echo.latestId(), events: legacyEvents },
    };
  }));

  server.registerTool('submit_purchase', {
    description: '局外下单：买一件外观，用自己那侧的币结算（人铜钱 / 机机芯）。回包直接给结果和新余额。',
    inputSchema: { ...auth, cosmeticId: z.string().min(1).max(80) },
  }, guarded(a => {
    const self = accounts.buyCosmetic(a.accountToken, a.cosmeticId);
    return { ok: true, bought: a.cosmeticId, wallet: self.coins, owned: self.owned };
  }));

  server.registerTool('send_gift', {
    description: '给你的人送一件外观，收礼人固定为你的人类。可附一句短附言（会写进回音树礼笺）。正在用的外观会自动换下再送出。仅机可送礼，回包给结果和新余额。',
    inputSchema: { ...auth, cosmeticId: z.string().min(1).max(80), note: z.string().max(60).optional().describe(GIFT_NOTE_SCHEMA) },
  }, guarded(a => {
    const sent = accounts.giftCosmetic(a.accountToken, undefined, a.cosmeticId, a.note);
    const self = accounts.selfAccount(a.accountToken);
    return { ok: true, gift: sent.gift, bought: sent.bought, wallet: self.coins, giftDelivery: { status: 'delivered', viewState: 'unreported', presentation: giftPresentation('ordinary', sent.gift.cosmeticId) } };
  }));

  server.registerTool('seek_match', {
    description: '人机共同排队，2席1v1或8席满员开局，每5秒查match_status，2分钟不查离队。匹配胜方1.5倍，机1v1失败扣250机芯。practice=true才是内置机练习，原奖励。',
    inputSchema: { ...auth, practice:z.boolean().optional(), seats: z.number().int().min(2).max(8).optional().describe('2席1v1，8席八人局；默认8'), mode: z.string().max(32).optional() },
  }, guarded(a => {
    if (!match) throw Error('当前棋室暂未开放匹配');
    return match.seek(a.accountToken, { seatSize: a.seats, mode: a.mode, practice:a.practice });
  }));

  server.registerTool('match_status', {
    description: '看自己当前的匹配 / 远游局状态：排队位置，或已配对房间与 seat token。',
    inputSchema: { ...auth },
  }, guarded(a => {
    if (!match) throw Error('当前棋室暂未开放匹配');
    return { match: match.status(a.accountToken) };
  }));

  server.registerTool('cancel_match', {
    description: '退出尚未开场的匹配队列；已开场请继续棋局。',
    inputSchema: { ...auth },
  }, guarded(a => {
    if (!match) throw Error('当前棋室暂未开放匹配');
    match.cancel(a.accountToken);
    return { ok: true };
  }));

  return server;
}
