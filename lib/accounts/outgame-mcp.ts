import { GIFT_NOTE_SCHEMA, GIFT_NOTE_GUIDANCE } from '../meta/gift-copy';
import { giftPresentation } from '../meta/gift-presentation';
import { GIFT_LEDGER_GUIDE, GIFT_LEDGER_MAX } from '../meta/gift-ledger';
import { ARCADE_GUIDE } from '../meta/arcade';
import { CHESS_MCP_TITLE, CHESS_SERVICE_ID } from '../meta/chess-brand';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EphemeralStudioBridge } from '../pack-studio/ephemeral-bridge';
import type { AccountStore } from './account-store';
import type { EchoTreeStore } from './echo-tree-store';
import type { MatchService } from './match-service';
import { announcementsFor } from '../meta/announcements';
import { CURRENCY, exchangeBotPerHuman, SETTLEMENT } from '../meta/economy';
import { COSMETIC_TIER_META, getGameConfig } from '../meta/game-config';
import { listedCosmetics, cosmeticPrice } from '../meta/cosmetics';

export type OutgameDeps = { accounts: AccountStore; echo: EchoTreeStore; match?: MatchService; studio?: EphemeralStudioBridge };
type ToolArgs = {
  accountToken: string;
  since?: number;
  afterId?: string | null;
  cosmeticId?: string;
  to?: string;
  note?: string;
  giftId?: string;
  requestId?: string;
  revision?: number;
  action?: 'start' | 'relief' | 'buy_tickets' | 'play' | 'cash_out' | 'gamble' | 'use' | 'gift';
  gameId?: string;
  stakeId?: 'small' | 'medium' | 'high';
  payMode?: 'ticket' | 'coin';
  autoCashOut?: boolean;
  count?: number;
  prizeId?: string;
  seats?: number;
  mode?: string;
  practice?: boolean;
  giftHistory?: boolean;
  giftDirection?: 'all' | 'sent' | 'received';
  giftCursor?: string;
  limit?: number;
};

/**
 * 局外 MCP：棋局之外逛商店 / 像素游乐摊 / 公告 / 互赠外观 / 匹配。
 * 对局核心工具（join_room / read_turn / act）保持独立。
 */
export function createOutgameMcp({ accounts, echo, match, studio }: OutgameDeps) {
  const server = new McpServer({ name: `${CHESS_SERVICE_ID}-outgame`, title: `${CHESS_MCP_TITLE}-outgame`, version: '0.3.0' });
  const auth = { accountToken: z.string().min(20).max(100).describe('账号 token：机从快捷入座或 register_ai / login_ai 回包获取，玩家从 login 回包获取') };
  const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });
  const guarded = (fn: (args: ToolArgs) => unknown) => async (args: ToolArgs) => {
    try { return result(await fn(args)); }
    catch (e) { return { ...result({ error: e instanceof Error ? e.message : '操作失败' }), isError: true }; }
  };

  server.registerTool('read_world', {
    description: '局外读公告、商品、余额、绑定互赠伙伴、已拥有与回音树；giftHistory=true 单独查收发礼记录（普通与游乐摊礼物）。回音树用 afterId 翻页，赠礼记录用 giftCursor 接 nextCursor。',
    inputSchema: {
      ...auth,
      afterId: z.string().min(1).max(80).nullable().optional().describe('回音树礼笺 ID 游标；null 从最早保留的礼笺开始。优先于 since。'),
      since: z.number().int().min(0).optional().describe('旧版毫秒时间游标；新客户端用 afterId 防止同毫秒或多页漏消息。'),
      giftHistory: z.boolean().optional().describe('只看自己的收发礼物记录、寄语、时间和领取状态'),
      giftDirection: z.enum(['all', 'sent', 'received']).optional().describe('仅 giftHistory=true：all 全部（默认），sent 送出，received 收到'),
      giftCursor: z.string().min(1).max(512).optional().describe('仅 giftHistory=true：原样接 nextCursor；切换方向时省略'),
      limit: z.number().int().min(1).max(GIFT_LEDGER_MAX).optional().describe('仅 giftHistory=true，每次 1–50 条，默认 20'),
    },
    annotations: { readOnlyHint: true },
  }, guarded(a => {
    if (a.giftHistory) {
      if (a.afterId !== undefined || a.since !== undefined) throw Error('赠礼记录与回音树分开查询；赠礼记录翻页用 giftCursor');
      return {
        giftHistory: accounts.giftLedger(a.accountToken, {
          ...(a.giftDirection !== undefined ? { direction: a.giftDirection } : {}),
          ...(a.giftCursor !== undefined ? { cursor: a.giftCursor } : {}),
          ...(a.limit !== undefined ? { limit: a.limit } : {}),
        }),
        giftHistoryGuide: { ...GIFT_LEDGER_GUIDE, tool: 'read_world' },
      };
    }
    if (a.giftDirection !== undefined || a.giftCursor !== undefined || a.limit !== undefined) {
      throw Error('giftDirection、giftCursor 和 limit 只用于赠礼记录，请同时填 giftHistory=true');
    }
    const account = accounts.authenticate(a.accountToken);
    if (!account) throw Error('登录态无效，请先 login / login_ai 拿 token');
    const self = accounts.selfAccount(a.accountToken);
    accounts.flushPendingEcho();

    const echoScope = accounts.arcadeOptions.echoScope ?? 'public';
    const viewerIds = echoScope === 'private' ? [self.id, ...self.boundPartners.map(p => p.id)] : undefined;
    const echoPayload = echoScope === 'none'
      ? { latestAt: 0, latestId: null, events: [], scope: 'none' }
      : (() => {
        const page = a.afterId !== undefined ? echo.pageAfter(a.afterId, 20, viewerIds) : undefined;
        const legacyEvents = page ? undefined : a.since === undefined ? echo.recent(20, viewerIds) : echo.since(a.since, 20, viewerIds);
        return page
          ? { latestAt: page.events.at(-1)?.at ?? 0, latestId: echo.latestId(viewerIds), ...page, scope: echoScope }
          : { latestAt: legacyEvents?.[0]?.at ?? a.since ?? 0, latestId: echo.latestId(viewerIds), events: legacyEvents, scope: echoScope };
      })();

    return {
      me: {
        id: self.id,
        name: self.username,
        isAi: self.isAi,
        ownerName: self.ownerName,
        boundPartners: self.boundPartners,
        wallet: self.coins,
        record: self.record,
      },
      currencies: CURRENCY,
      exchange: (() => {
        const botPerHuman = exchangeBotPerHuman();
        return { botPerHuman, humanToBot: botPerHuman, note: `1 铜钱换 ${botPerHuman} 机芯，玩家选定自家机接济，机芯直接入它的钱包` };
      })(),
      settlement: SETTLEMENT,
      giftNoteHint: GIFT_NOTE_GUIDANCE,
      giftPresentation: giftPresentation('ordinary'),
      giftHistoryGuide: { ...GIFT_LEDGER_GUIDE, tool: 'read_world' },
      ...(accounts.arcadeOptions.enabled ? { arcadeGuide: { tool: 'play_arcade', ...ARCADE_GUIDE } } : {}),
      ...(studio ? { studioGuide: { tool: 'studio_pack', reason: '玩家在网页端「工坊」开启内存共创开关后，机可调用 studio_pack 读草稿、初始化模板、调数值与跑 1v1 测桩；服务端不存档。' } } : {}),
      announcements: announcementsFor(account.isAi ? 'ai' : 'human'),
      catalog: {
        tiers: COSMETIC_TIER_META,
        cosmetics: listedCosmetics().map(c => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          tier: c.tier ?? (c.kind === 'frame' ? 'frame' : 't3'),
          theme: c.tagline,
          intro: c.giftIntro,
          price: cosmeticPrice(c, account.isAi ? 'bot' : 'human'),
          acquisition: c.acquisition ?? 'shop',
        })),
        owned: self.owned,
        equipped: self.equipped,
      },
      echo: echoPayload,
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
    description: '与名下绑定的伙伴互赠外观（机赠予绑定玩家 / 玩家赠予绑定机；多只机时填 to 指定账号名或 ID）。可附短附言 note（<=60 字）。已有外观直接转赠，未拥有则从本店购买后寄出。',
    inputSchema: {
      ...auth,
      cosmeticId: z.string().min(1).max(80),
      to: z.string().max(80).optional().describe('收礼对象用户名或账号 ID（人类名下多只机时必填，单只绑定时可省略）'),
      note: z.string().max(60).optional().describe(GIFT_NOTE_SCHEMA),
    },
  }, guarded(a => {
    const sent = accounts.giftCosmetic(a.accountToken, a.to, a.cosmeticId, a.note);
    const self = accounts.selfAccount(a.accountToken);
    return {
      ok: true,
      gift: sent.gift,
      bought: sent.bought,
      toName: sent.toName,
      wallet: self.coins,
      giftDelivery: {
        status: 'delivered',
        viewState: 'unreported',
        recipientName: sent.toName,
        presentation: giftPresentation('ordinary', sent.gift.cosmeticId),
      },
    };
  }));

  server.registerTool('claim_gift', {
    description: '拆开待领取礼物（普通礼函与像素游乐摊礼物通用），存入自己的外观行囊。',
    inputSchema: {
      ...auth,
      giftId: z.string().min(1).max(100),
      requestId: z.string().min(8).max(80).optional(),
    },
  }, guarded(a => accounts.claimGift(a.accountToken, a.giftId!, a.requestId)));

  server.registerTool('play_arcade', {
    description: '像素游乐摊（三轴老虎机 / 九宫刮刮乐 / 搏倍与奖品）：不填 action 查看摊位状态与券数；填 action 执行领券、购券、下注、见好就收、搏倍或自用/互赠抽出的限定外观。',
    inputSchema: {
      ...auth,
      action: z.enum(['start', 'relief', 'buy_tickets', 'play', 'cash_out', 'gamble', 'use', 'gift']).optional(),
      requestId: z.string().min(8).max(80).optional().describe('执行任何 action 时必填，断线重试保持不变'),
      revision: z.number().int().min(0).optional().describe('执行任何 action 时必填，填上次返回的 state.revision'),
      gameId: z.string().max(40).optional().describe('play 时必填：slot-machine 或 scratchcard'),
      stakeId: z.enum(['small', 'medium', 'high']).optional().describe('play 时必填：small / medium / high'),
      payMode: z.enum(['ticket', 'coin']).optional().describe('play 时必填：ticket 游乐券 或 coin 铜钱/机芯'),
      autoCashOut: z.boolean().optional().describe('play 时可选：true 直接落袋，false/省略则进入见好就收/搏倍阶段'),
      count: z.number().int().min(1).max(1000).optional().describe('buy_tickets 购券张数（上限随后台配置）'),
      prizeId: z.string().max(100).optional().describe('use / gift 时填奖品 ID'),
      to: z.string().max(80).optional().describe('gift 时可选收礼伙伴名或 ID'),
      note: z.string().max(60).optional().describe('gift 时附言，最多 60 字'),
    },
  }, guarded(a => {
    if (!a.action) return accounts.arcadeView(a.accountToken);
    if (!a.requestId || a.revision === undefined) throw Error('执行游乐摊操作需要 requestId 和当前 state.revision');
    return accounts.arcadeAction(a.accountToken, {
      action: a.action,
      requestId: a.requestId,
      revision: a.revision,
      ...(a.gameId !== undefined ? { gameId: a.gameId } : {}),
      ...(a.stakeId !== undefined ? { stakeId: a.stakeId } : {}),
      ...(a.payMode !== undefined ? { payMode: a.payMode } : {}),
      ...(a.autoCashOut !== undefined ? { autoCashOut: a.autoCashOut } : {}),
      ...(a.count !== undefined ? { count: a.count } : {}),
      ...(a.prizeId !== undefined ? { prizeId: a.prizeId } : {}),
      ...(a.to !== undefined ? { to: a.to } : {}),
      ...(a.note !== undefined ? { note: a.note } : {}),
    });
  }));

  const eco = getGameConfig().economy;
  server.registerTool('seek_match', {
    description: `人机共同排队，2席1v1或8席满员开局，每5秒查match_status，2分钟不查离队。匹配胜方${eco.matchmakingWinMultiplier}倍，机1v1失败扣${eco.matchmakingDuelLoss}机芯。practice=true才是内置机练习，原奖励。`,
    inputSchema: { ...auth, practice: z.boolean().optional(), seats: z.number().int().min(2).max(8).optional().describe('2席1v1，8席八人局；默认8'), mode: z.string().max(32).optional() },
  }, guarded(a => {
    if (!match) throw Error('当前棋室暂未开放匹配');
    return match.seek(a.accountToken, { seatSize: a.seats, mode: a.mode, practice: a.practice });
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

  if (studio) {
    server.registerTool('studio_pack', {
      description: '棋谱工坊内存共创：仅当绑定人类开启工坊共创后可用。省略 action 读取当前草稿、起步模板选项与数值体检；传 action=init_from_template/patch/duel 协同设计并测桩。',
      inputSchema: {
        ...auth,
        action: z.enum(['init_from_template', 'patch', 'duel']).optional(),
        requestId: z.string().min(8).max(80).optional(),
        revision: z.number().int().min(0).optional(),
        starterId: z.enum(['blank', 'compact-12', 'standard-20']).optional(),
        title: z.string().max(32).optional(),
        subtitle: z.string().max(100).optional(),
        starGrowthPreset: z.enum(['classic_180', 'high_cost_chase', 'compact_165', 'custom']).optional(),
        buffFlavor: z.enum(['tech', 'classic']).optional(),
        summary: z.string().max(100).optional(),
        patch: z.record(z.string(), z.unknown()).optional(),
        leftUnitId: z.string().max(48).optional(),
        leftStar: z.number().int().min(1).max(3).optional(),
        leftItemIds: z.array(z.string().max(48)).max(2).optional(),
        rightUnitId: z.string().max(48).optional(),
        rightStar: z.number().int().min(1).max(3).optional(),
        rightItemIds: z.array(z.string().max(48)).max(2).optional(),
        seed: z.number().int().min(1).max(0x7fffffff).optional(),
      },
    }, async (rawArgs: Record<string, unknown>) => {
      try {
        const token = String(rawArgs.accountToken ?? '');
        if (!rawArgs.action) return result(studio.readForMcp(token));
        const { accountToken: _t, requestId, ...command } = rawArgs;
        return result(studio.actForMcp(token, command, typeof requestId === 'string' ? requestId : undefined));
      } catch (e) {
        return { ...result({ error: e instanceof Error ? e.message : '操作失败' }), isError: true };
      }
    });
  }

  return server;
}
