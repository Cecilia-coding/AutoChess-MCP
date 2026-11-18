import express from 'express';
import { FeedbackStore } from '../lib/accounts/feedback-store';
import { feedbackRouter } from '../lib/accounts/feedback-http';
import { resolve } from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { leaderboardOrder } from '../lib/meta/leaderboard';
import { RoomStore } from '../lib/autochess/room-store';
import { createRoomMcp } from '../lib/autochess/room-mcp';
import { RoomCursor } from '../lib/autochess/room-cursor';
import { PackAvailabilityStore } from '../lib/autochess/pack-availability';
import { AccountStore } from '../lib/accounts/account-store';
import { GameConfigStore } from '../lib/accounts/config-store';
import { MatchQueue } from '../lib/accounts/matchmaking';
import { MachineInviteService } from '../lib/autochess/machine-invite';
import { SocialInvitations } from '../lib/autochess/social-invitations';
import { humanInvitationGuide, machineInvite, playerMcpUrl } from '../lib/autochess/invite-copy';
import { COSMETICS, listedCosmetics, DEFAULT_BOARD_SKIN } from '../lib/meta/cosmetics';
import { CURRENCY, exchangeBotPerHuman } from '../lib/meta/economy';
import { COSMETIC_TIER_META, DEFAULT_GAME_CONFIG, getGameConfig, type GameConfigSectionId } from '../lib/meta/game-config';
import { EchoTreeStore } from '../lib/accounts/echo-tree-store';
import { ECHO_GUIDE, type EchoQuery } from '../lib/meta/echo-tree';
import type { GiftLedgerQuery } from '../lib/meta/gift-ledger';
import { createOutgameMcp } from '../lib/accounts/outgame-mcp';
import { MatchService } from '../lib/accounts/match-service';
import { EphemeralStudioBridge } from '../lib/pack-studio/ephemeral-bridge';
import { announcementsFor } from '../lib/meta/announcements';
import { parsePackId } from '../packs/registry';
import { isMatchMode } from '../packs/modes/registry';
import {
  createPlatformWorldBridge,
  decodePlatformDisplayName,
  parsePlatformActorType,
  parsePlatformHousehold,
  PlatformRoomAdapter,
  platformIdentity,
  verifyPlatformSecret,
} from '../lib/autochess/platform-adapter';
import { AUTOCHESS_ADAPTER_CAPABILITIES, AUTOCHESS_HOST_ADAPTER_VERSION, AUTOCHESS_PLATFORM_PROTOCOL_VERSION } from '../lib/meta/host-config';

/** 瘦身演示模式：不带账号/密码/皮肤等完全体内容（小机器展示用）。不设此变量则行为与完全体一致。 */
const slim = process.env.CHESS_SLIM === '1';
const arcadeEnabled = process.env.CHESS_ARCADE_ENABLED !== '0' && process.env.CHESS_ARCADE_PREVIEW !== '0' && process.env.CHESS_WHEEL_PREVIEW !== '0';
const echoScope = (['public', 'private', 'none'].includes(process.env.CHESS_ECHO_SCOPE ?? '') ? process.env.CHESS_ECHO_SCOPE : 'public') as 'public' | 'private' | 'none';
const port = Number(process.env.CHESS_ROOM_PORT ?? 8791);
type PublicEndpoint = 'web' | 'mcp';
/** Browser-visible address used in every URL handed to a player or MCP client. */
function publicUrl(pathname = '', endpoint: PublicEndpoint = 'web'): string {
  const configured = process.env.CHESS_PUBLIC_ORIGIN?.trim();
  const fallback = endpoint === 'mcp' ? `http://127.0.0.1:${port}` : 'http://127.0.0.1:3000';
  if (!configured) return pathname ? new URL(pathname, `${fallback}/`).toString() : fallback;
  const parsed = new URL(configured);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
    || (parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
    throw new Error('CHESS_PUBLIC_ORIGIN 必须是完整的 http(s) origin，且不能包含路径、账号、查询或片段');
  }
  return pathname ? new URL(pathname, `${parsed.origin}/`).toString() : parsed.origin;
}
const publicOrigin = publicUrl();
const cursorEnabled = process.env.CHESS_DISABLE_CURSOR !== '1';
const cosmeticsSandbox = process.env.CHESS_COSMETICS_SANDBOX === '1';
const accountDir = resolve(process.env.CHESS_ACCOUNT_DATA ?? '.local/accounts');
/** 后台配置表优先加载：驱动外观分层、经济结算、游乐摊档位与玩法概率权重。 */
const configStore = new GameConfigStore(accountDir);
/** 回音树：支持公共流 / 绑定关系私有流 / 关闭三种宿主策略。 */
const echoTree = new EchoTreeStore(accountDir);
const accounts = new AccountStore(accountDir, echoTree, { enabled: arcadeEnabled, echoScope });
const feedback = new FeedbackStore(accountDir, accounts);
const packAvailability = new PackAvailabilityStore(accountDir);
const matchQueue = new MatchQueue(accountDir, accounts);
const seatAppearance = slim
  ? undefined
  : (accountId: string) => {
    try {
      const identity = accounts.seatIdentity(accountId);
      return { ...(identity.skinId ? { skinId: identity.skinId } : {}), ...(identity.frame ? { frame: identity.frame } : {}) };
    } catch {
      return undefined;
    }
  };
/** 局外战绩/货币：房间结束由 recorder 整局结算（未挂靠账号的席位跳过）。瘦身模式不记账。 */
const store = new RoomStore(
  resolve(process.env.CHESS_ROOM_DATA ?? '.local/chess-rooms'),
  slim ? undefined : { settle: input => accounts.settleMatch(input) },
  packAvailability,
  seatAppearance,
);
/** 匹配编排：人类走队列，机走远游局；统一建房与凭证。 */
const packForMatch = () => packAvailability.enabledPacks()[0]?.id ?? process.env.CHESS_PACK ?? 'ai';
const matchService = new MatchService({ accounts, queue: matchQueue, rooms: store, pack: packForMatch, validatePack: pack => { if (!packAvailability.enabledPacks().some(entry => entry.id === pack)) throw Error('这套棋谱暂未开放匹配'); } });
const cursor = new RoomCursor(store, `http://127.0.0.1:${port}/mcp`);
const machineInvites = new MachineInviteService(accounts, store);
const social = new SocialInvitations(accountDir, accounts, store);
const studioBridge = new EphemeralStudioBridge(accounts);
const platformWorld = slim ? undefined : createPlatformWorldBridge({
  accounts,
  echo: echoTree,
  rooms: store,
  studio: studioBridge,
  packAvailability,
  cosmeticsSandbox,
  echoScope,
  arcadeEnabled,
  cursorEnabled,
  mcpUrl: publicUrl('/mcp', 'mcp'),
});
const platformRooms = new PlatformRoomAdapter(store, platformWorld);
/** 开房/入座可选挂靠账号：席位记 accountId 与自己装备的棋盘皮肤。瘦身模式不挂账号/皮肤。 */
const accountOwner = (token: unknown) => {
  if (slim) return undefined;
  const account = accounts.authenticate(token);
  if (!account) return undefined;
  const equipped = accounts.selfAccount(token).equipped;
  const skinId = equipped.board;
  const frame = equipped.frame;
  return { accountId: account.id, accountName: account.username, ...(skinId ? { skinId } : {}), ...(frame ? { frame } : {}) };
};
const app = express();
app.use((req, res, next) => {
  const host = req.hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) { res.status(403).json({ error: '仅支持本地访问' }); return; }
  if (req.headers.origin && req.headers.origin !== publicOrigin && !/^http:\/\/(127\.0\.0\.1|localhost):(3000|8787|8791)$/.test(req.headers.origin)) { res.status(403).json({ error: '来源无效' }); return; }
  next();
});
app.get('/health', (_req, res) => res.json({
  ok: true,
  service: 'autochess-mcp',
  version: 1,
  adapterVersion: AUTOCHESS_HOST_ADAPTER_VERSION,
  platformProtocol: AUTOCHESS_PLATFORM_PROTOCOL_VERSION,
  capabilities: AUTOCHESS_ADAPTER_CAPABILITIES,
  slim,
}));
if (!slim) app.use('/feedback', feedbackRouter(accounts, feedback));
app.use(express.json({ limit: '256kb' }));
app.post('/platform/autochess', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const expectedSecret = process.env.CHESS_PLATFORM_SECRET?.trim();
  if (!expectedSecret) { res.status(404).json({ error: '平台适配入口未启用' }); return; }
  if (!verifyPlatformSecret(expectedSecret, req.get('X-Autochess-Platform-Secret'))) { res.status(403).json({ error: '平台适配凭证无效' }); return; }
  try {
    const provider = req.get('X-Player-Provider') ?? 'cedartoy';
    const rawPlayerId = req.get('X-Player-Id') ?? '';
    const actorType = parsePlatformActorType(req.get('X-Player-Type'), rawPlayerId);
    const displayName = decodePlatformDisplayName(req.get('X-Player-Name'));
    const householdMembers = parsePlatformHousehold(req.get('X-Player-Household'));
    const identity = platformIdentity({
      provider,
      playerId: rawPlayerId,
      actorType,
      ...(displayName ? { displayName } : {}),
    });
    const seatHousehold = req.body?.params?.seatHousehold === true
      ? householdMembers
        .filter((member) => member.actorType !== 'guest' && member.playerId !== identity.playerId)
        .map((member) => platformIdentity({
          provider,
          playerId: member.playerId,
          ...(member.displayName ? { displayName: member.displayName } : {}),
          actorType: member.actorType,
        }).owner)
      : undefined;
    res.json(await platformRooms.play(identity, req.body?.action, req.body?.params, undefined, {
      ...(seatHousehold?.length ? { household: seatHousehold } : {}),
      ...(householdMembers.length ? { householdMembers } : {}),
    }));
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : '平台棋局操作失败' }); }
});
app.post('/room', async (req, res) => {
  try {
    const { op, ...args } = req.body;
    if (op === 'config') res.json({
      cursorEnabled,
      slim,
      mcpUrl: publicUrl('/mcp', 'mcp'),
      packs: packAvailability.enabledPacks(),
      cosmeticsSandbox,
      arcadeEnabled,
      echoScope,
      adapterVersion: AUTOCHESS_HOST_ADAPTER_VERSION,
      platformProtocol: AUTOCHESS_PLATFORM_PROTOCOL_VERSION,
    });
    else if (op === 'pack_flags' || op === 'set_pack_enabled') {
      if (slim || !accounts.authenticate(args.token)?.isAdmin) { res.status(403).json({ error: '只有管理员可以管理棋谱' }); return; }
      const packs = op === 'set_pack_enabled' ? packAvailability.setEnabled(args.packId, args.enabled) : packAvailability.allPacks();
      res.json({ packs });
    }
    else if (op === 'balance_report') {
      if (slim || !accounts.authenticate(args.token)?.isAdmin) { res.status(403).json({ error: '只有管理员可以查看棋子战绩' }); return; }
      const star = [0, 1, 2, 3].includes(args.star) ? args.star as 0 | 1 | 2 | 3 : 0;
      res.json(store.balanceReport({
        pack: typeof args.pack === 'string' ? parsePackId(args.pack) : undefined,
        mode: isMatchMode(args.mode) ? args.mode : undefined, source: args.source === 'all' ? undefined : args.source === 'lab' ? 'lab' : 'live', star
      }));
    }
    else if (op === 'create_lab') {
      if (slim || !accounts.authenticate(args.token)?.isAdmin) { res.status(403).json({ error: '只有管理员可以开测试对掏' }); return; }
      const pack = parsePackId(typeof args.pack === 'string' ? args.pack : 'ai');
      const host = store.create('测试棋手甲', pack, 2, undefined, 'duel', undefined, 'lab');
      const guest = store.join(host.invitation, '测试棋手乙', `lab-${host.roomId}`);
      res.json({
        roomId: host.roomId, watchToken: host.watchToken,
        left: { roomId: host.roomId, token: host.token }, right: { roomId: guest.roomId, token: guest.token }
      });
    }
    else if ((op === 'cursor-start' || op === 'cursor-stop') && !cursorEnabled) res.status(403).json({ error: '线上棋室请通过 MCP 客户端入座，不运行 Cursor' });
    else if (op === 'create') res.json(store.create(typeof args.name === 'string' ? args.name : '你', typeof args.pack === 'string' ? args.pack : undefined, typeof args.seats === 'number' ? args.seats : undefined, accountOwner(args.accountToken), typeof args.mode === 'string' ? args.mode : undefined));
    else if (op === 'create_custom') res.json(store.createCustom(typeof args.name === 'string' ? args.name : '你', args.customPack, typeof args.seats === 'number' ? args.seats : undefined, accountOwner(args.accountToken), typeof args.mode === 'string' ? args.mode : 'duel'));
    else if (op === 'studio_sync') {
      if (slim) throw new Error('演示版不含账号共创');
      res.json(studioBridge.syncFromBrowser(args.token ?? args.accountToken, args as Parameters<typeof studioBridge.syncFromBrowser>[1]));
    }
    else if (op === 'join') res.json(machineInvites.join(args.invitation, args.name, args.joinKey, args.accountToken));
    else if (op === 'social_invite') {
      if (slim) throw Error('演示版不含账号系统');
      res.json({ invitation: social.send(args.accountToken, args, args.toId) });
    }
    else if (op === 'issue_machine_ticket') {
      if (slim) throw new Error('演示版不含账号系统');
      res.json(machineInvites.issue(args.roomId, args.token, args.accountToken, args.aiId));
    }
    else if (op === 'request_machine') {
      if (slim) throw new Error('演示版不含账号系统');
      res.json(machineInvites.request(args.roomId, args.token, args.accountToken, args.aiUsername));
    }
    else if (op === 'machine_requests') {
      if (slim) throw new Error('演示版不含账号系统');
      res.json(machineInvites.hostRequests(args.roomId, args.token, args.accountToken));
    }
    else if (op === 'start') res.json(store.start(args));
    else if (op === 'state') res.json(store.view(args));
    else if (op === 'invite') res.json(store.invite(args));
    else if (op === 'poke') res.json(store.poke(args));
    else if (op === 'action') { const view = store.mutate(args); if (view.phase === 'finished') cursor.abort(view.id); res.json(view); }
    else if (op === 'cursor-start') { cursor.start(args); res.json(store.view(args)); }
    else if (op === 'cursor-stop') { cursor.stop(args); res.json(store.view(args)); }
    else res.status(400).json({ error: '未知操作' });
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : '房间操作失败' }); }
});
app.post('/account', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (slim) { res.status(404).json({ error: '演示版不含账号系统' }); return; }
  try {
    const { op, ...args } = req.body;
    if (op === 'register') {
      if (args.isAi === true) throw new Error('机请用玩家给的入籍码注册');
      res.json(accounts.register(args.username, args.password));
    }
    else if (op === 'issue_ai_invite') res.json(accounts.issueAiInvite(args.token));
    else if (op === 'register_ai') res.json(accounts.registerAiWithInvite(args.invite, args.name, args.password));
    else if (op === 'login') res.json(accounts.login(args.username, args.password));
    else if (op === 'me') { const account = accounts.authenticate(args.token); if (account) res.json({ account }); else res.status(401).json({ error: '登录态无效' }); }
    else if (op === 'logout') { const account = accounts.authenticate(args.token); if (account) matchQueue.cancel(args.token); accounts.logout(args.token); if (account) social.forget(account.id); res.json({ ok: true }); }
    else if (op === 'social') res.json(social.snapshot(args.token));
    else if (op === 'social_find') res.json({ peer: social.findPlayer(args.token, args.name) });
    else if (op === 'arcade') res.json(accounts.arcadeView(args.token));
    else if (op === 'arcade_action') res.json(accounts.arcadeAction(args.token, args.command));
    else if (op === 'invitation_respond') {
      if (typeof args.accept !== 'boolean') throw Error('请选择接受或婉拒');
      res.json(social.respond(args.token, args.inviteId, args.accept));
    }
    else if (op === 'delete') res.json({ account: accounts.softDelete(args.token) });
    else if (op === 'bind') res.status(400).json({ error: '旧绑定入口已关闭；请让机使用入籍码登记，账号会自动绑定' });
    else if (op === 'unbind') { accounts.unbind(args.token, args.aiId); res.json({ ok: true }); }
    else if (op === 'bindings') res.json({ ai: accounts.boundAi(args.token) });
    else if (op === 'machine_credential') res.json(accounts.machineCredential(args.token, args.aiId));
    else if (op === 'watch_rooms') {
      const viewer = accounts.authenticate(args.token);
      if (!viewer || viewer.isAi) throw new Error('请先登录玩家账号');
      const machineIds = accounts.bindingsOfAccount(viewer.id).filter(binding => {
        try { return accounts.ownerIdOfAi(binding.aiId) === viewer.id; } catch { return false; }
      }).map(binding => binding.aiId);
      res.json({ rooms: store.watchableForMachines(machineIds) });
    }
    else if (op === 'machine_requests') res.json(machineInvites.ownerRequests(args.token));
    else if (op === 'respond_machine_request') res.json(machineInvites.respond(args.token, args.requestId, args.accept === true));
    else if (op === 'match') res.json({ match: matchService.seek(args.token, { seatSize: args.seatSize, pack: args.pack, mode: args.mode }), tables: matchService.tables(args.pack) });
    else if (op === 'unmatch') { matchService.cancel(args.token); res.json({ ok: true, tables: matchService.tables(args.pack) }); }
    else if (op === 'match-position') res.json({ position: matchQueue.positionOf(args.token) });
    else if (op === 'match-poll') { res.json({ match: matchService.status(args.token), tables: matchService.tables(args.pack) }); }
    else res.status(400).json({ error: '未知操作' });
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : '账号操作失败' }); }
});
app.post('/meta', async (req, res) => {
  try {
    const { op, ...args } = req.body;
    if (op === 'catalog') {
      const cfg = getGameConfig();
      const reward = { play: cfg.economy.legacyPlayReward, win: cfg.economy.legacyWinReward };
      res.json(slim
        ? { cosmetics: [], tiers: COSMETIC_TIER_META, currencies: CURRENCY, exchange: exchangeBotPerHuman(), reward, defaultSkin: DEFAULT_BOARD_SKIN, slim }
        : { cosmetics: cosmeticsSandbox ? COSMETICS : listedCosmetics(), tiers: COSMETIC_TIER_META, currencies: CURRENCY, exchange: exchangeBotPerHuman(), reward, defaultSkin: DEFAULT_BOARD_SKIN, arcadeEnabled: accounts.arcadeOptions.enabled === true, echoScope, sandbox: cosmeticsSandbox }
      );
    }
    else if (op === 'leaderboard') {
      const order = leaderboardOrder(args.order);
      res.json({ order, entries: accounts.leaderboard(Number(args.limit) || 20, order) });
    }
    else if (slim) {
      if (op === 'profile') res.json({ self: null, slim });
      else res.status(400).json({ error: '当前为瘦身演示模式，暂未开放该外观操作' });
    }
    else if (op === 'admin_config_get') {
      if (!accounts.authenticate(args.token)?.isAdmin) { res.status(403).json({ error: '只有管理员可以查看后台配置表' }); return; }
      res.json({ config: configStore.get(), defaults: DEFAULT_GAME_CONFIG, tierMeta: COSMETIC_TIER_META, updatedAt: configStore.updatedAt(), customized: configStore.isCustomized() });
    }
    else if (op === 'admin_config_save') {
      if (!accounts.authenticate(args.token)?.isAdmin) { res.status(403).json({ error: '只有管理员可以修改后台配置表' }); return; }
      const saved = configStore.save(args.config);
      res.json({ ok: true, config: saved, updatedAt: configStore.updatedAt(), customized: configStore.isCustomized(), cosmetics: cosmeticsSandbox ? COSMETICS : listedCosmetics(), exchange: exchangeBotPerHuman() });
    }
    else if (op === 'admin_config_reset') {
      if (!accounts.authenticate(args.token)?.isAdmin) { res.status(403).json({ error: '只有管理员可以重置后台配置表' }); return; }
      const section = ['cosmetics', 'pacing', 'economy', 'arcade', 'odds', 'buffs', 'all'].includes(args.section) ? args.section as GameConfigSectionId | 'all' : 'all';
      const next = configStore.reset(section);
      res.json({ ok: true, config: next, updatedAt: configStore.updatedAt(), customized: configStore.isCustomized(), cosmetics: cosmeticsSandbox ? COSMETICS : listedCosmetics(), exchange: exchangeBotPerHuman() });
    }
    else if (op === 'profile') res.json({ self: accounts.selfAccount(args.token) });
    else if (op === 'gift_catalog') res.json(accounts.giftCatalog(args.token, args.to));
    else if (op === 'gift_history') {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ giftHistory: accounts.giftLedger(args.token, { direction: args.direction, cursor: args.cursor, limit: args.limit }) });
    }
    else if (op === 'exchange') res.status(400).json({ error: '兑换已改为定向接济，请选一只自己的机' });
    else if (op === 'subsidize') {
      if (typeof args.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(args.requestId)) throw new Error('接济请求编号无效');
      res.json(accounts.subsidize(args.token, args.aiId, args.coins, args.requestId));
    }
    else if (op === 'echo') {
      accounts.flushPendingEcho();
      if (echoScope === 'none') {
        res.json({ events: [], latestId: null, hasMore: false, serverNow: Date.now(), echoScope });
        return;
      }
      let viewerIds: string[] | undefined;
      if (echoScope === 'private') {
        const viewer = typeof args.token === 'string' && args.token ? accounts.authenticate(args.token) : undefined;
        if (!viewer) {
          res.json({ events: [], latestId: null, hasMore: false, serverNow: Date.now(), echoScope });
          return;
        }
        const self = accounts.selfAccount(args.token);
        viewerIds = [self.id, ...self.boundPartners.map(partner => partner.id)];
      }
      const limit = Number(args.limit) || 40;
      if (args.afterId !== undefined) {
        if (args.afterId !== null && (typeof args.afterId !== 'string' || !args.afterId || args.afterId.length > 80)) throw new Error('回音树游标无效');
        res.json({ ...echoTree.pageAfter(args.afterId, limit, viewerIds), latestId: echoTree.latestId(viewerIds), serverNow: Date.now(), echoScope });
      } else {
        // Keep the timestamp response for older clients; new clients use afterId pages.
        res.json({ events: args.since === undefined ? echoTree.recent(limit, viewerIds) : echoTree.since(Number(args.since), limit, viewerIds), latestId: echoTree.latestId(viewerIds), serverNow: Date.now(), echoScope });
      }
    }
    else if (op === 'announcements') res.json({ announcements: announcementsFor('human') });
    else if (op === 'buy') res.json({ self: accounts.buyCosmetic(args.token, args.cosmeticId) });
    else if (op === 'equip') res.json({ self: accounts.equipCosmetic(args.token, args.cosmeticId) });
    else if (op === 'gift') res.json(accounts.giftCosmetic(args.token, args.to, args.cosmeticId, args.note));
    else if (op === 'claim') res.json(accounts.claimGifts(args.token, args.giftId));
    else res.status(400).json({ error: '未知操作' });
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : '外观操作失败' }); }
});
app.post('/mcp', async (req, res) => {
  // 局外 MCP（profile=outgame）：厂商公告 / 商品 / 余额 / 回音树 + 下单 / 送礼。对局内三工具不受影响。
  if (req.query.profile === 'outgame') {
    if (slim) { res.status(404).json({ error: '演示版不含账号系统' }); return; }
    const server = createOutgameMcp({ accounts, echo: echoTree, match: matchService, studio: studioBridge });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch { if (!res.headersSent) res.status(500).json({ error: 'MCP请求失败' }); }
    return;
  }
  if (slim && req.query.profile === 'enroll') { res.status(404).json({ error: '演示版不含账号系统' }); return; }
  const profile = req.query.profile === 'player' ? 'player' : req.query.profile === 'adapter' ? 'adapter' : req.query.profile === 'enroll' ? 'enroll' : 'legacy';
  const server = createRoomMcp(store, profile, {
    ...(!slim ? { giftLedger: (token: string, query: GiftLedgerQuery) => accounts.giftLedger(token, query) } : {}),
    ...(!slim && echoScope !== 'none' ? {
      echo: (token: string, query: EchoQuery) => {
        const me = accounts.authenticate(token);
        if (!me) throw Error('登录态无效，请使用自己的账号 accountToken');
        accounts.flushPendingEcho();
        const self = accounts.selfAccount(token);
        const viewerIds = echoScope === 'private' ? [self.id, ...self.boundPartners.map(partner => partner.id)] : undefined;
        const limit = query.limit ?? 20;
        const latestId = echoTree.latestId(viewerIds);
        const page = query.afterId === undefined
          ? { events: echoTree.recent(limit, viewerIds), nextId: latestId, hasMore: false }
          : echoTree.pageAfter(query.afterId, limit, viewerIds);
        return {
          echo: {
            ...page, events: page.events.map(event => ({ ...event, atIso: new Date(event.at).toISOString() })), latestId, serverNow: Date.now(), scope: echoScope,
            order: query.afterId === undefined ? 'newest_first' : 'oldest_first'
          }, echoGuide: ECHO_GUIDE
        };
      }
    } : {}),
    ...(accounts.arcadeOptions.enabled && !slim ? { arcade: (token: string, command?: unknown) => command === undefined ? accounts.arcadeView(token) : accounts.arcadeAction(token, command) } : {}),
    ...(!slim ? {
      studioRead: (token: string) => studioBridge.readForMcp(token),
      studioAct: (token: string, command: unknown, requestId?: string) => studioBridge.actForMcp(token, command, requestId),
    } : {}),
    ...(!slim ? { claimGift: (token: string, giftId: string, requestId?: string) => accounts.claimGift(token, giftId, requestId) } : {}),
    match: (token, action, options) => {
      if (slim) throw Error('演示版不含匹配');
      if (action === 'cancel') { matchService.cancel(token); return { status: 'cancelled' }; }
      if (action === 'seek') return matchService.seek(token, options);
      return { match: matchService.status(token), tables: matchService.tables(options?.pack) };
    },
    feedbackList: token => { if (slim) throw Error('演示版不含反馈处'); return feedback.list(token); },
    submitFeedback: (token, input) => { if (slim) throw Error('演示版不含反馈处'); return feedback.submit(token, input, 'mcp'); },
    accountStatus: (token, withGifts, to) => {
      if (slim) throw Error('演示版不含账号系统');
      const me = accounts.selfAccount(token);
      return {
        ...social.snapshot(token, true), account: { id: me.id, username: me.username, isAi: me.isAi, ...(me.ownerName ? { ownerName: me.ownerName } : {}) }, boundPartners: me.boundPartners, wallet: me.coins, record: me.record,
        ...(accounts.arcadeOptions.enabled ? { arcadeGuide: { tool: 'read_turn', args: { arcade: true }, actTool: 'act', actArgs: { kind: 'arcade' }, fill: ['accountToken'], reason: '像素游乐摊：同一连接查券与摊位、领试玩券、购券、玩老虎机/刮刮乐、搏倍或落袋，以及互赠抽出的限定外观。' } } : {}),
        studioGuide: { tool: 'read_turn', args: { studio: true }, actTool: 'act', actArgs: { kind: 'studio' }, fill: ['accountToken'], reason: '像素棋谱工坊：当绑定人类在网页开启共创后，同一连接协同选模板、编辑棋子羁绊数值并运行 1v1 测桩；服务端不存档。' },
        ...(withGifts ? { giftCatalog: accounts.giftCatalog(token, to) } : {})
      };
    },
    ...(!slim ? { giftCatalog: (token: string, to?: unknown) => accounts.giftCatalog(token, to) } : {}),
    giftCosmeticForAccount: (token, requestId, cosmeticId, note, to) => {
      if (slim) throw Error('演示版不含赠礼');
      return accounts.giftCosmeticForAccount(token, requestId, cosmeticId, note, to);
    },
    social: token => { if (slim) throw Error('演示版不含账号系统'); return social.snapshot(token, true); },
    seatMail: credentials => {
      if (slim) return undefined;
      const view = store.view(credentials), id = view.seatIndex === undefined ? undefined : view.seats[view.seatIndex]?.accountId;
      if (!id || !accounts.getAccount(id)?.isAi) return undefined;
      social.touch(id);
      const inbox = social.forAccount(id).inbox;
      return inbox.length ? inbox : undefined;
    },
    sendInvite: (token, credentials, toId) => { if (slim) throw Error('演示版不含账号系统'); return social.send(token, credentials, toId, true); },
    findPlayer: (token, name) => { if (slim) throw Error('演示版不含账号系统'); return social.findPlayer(token, name, true); },
    respondInvite: (token, id, accept) => { if (slim) throw Error('演示版不含账号系统'); return social.respond(token, id, accept, true); },
    registerAi: (invite, name, password) => { if (slim) throw Error('演示版不含账号系统'); return accounts.registerAiWithInvite(invite, name, password); },
    loginAi: (username, password) => { if (slim) throw Error('演示版不含账号系统'); return accounts.loginAi(username, password); },
    ownerForToken: token => accounts.authenticate(token)?.isAi ? accountOwner(token) : undefined,
    create: (accountToken, requestId, pack) => {
      const account = accounts.authenticate(accountToken);
      if (!account?.isAi) throw new Error('请先用已登记的机账号开房');
      const ownerId = accounts.ownerIdOfAi(account.id);
      const seat = store.createForMachine(accounts.seatIdentity(account.id), requestId, pack);
      const origin = publicUrl();
      const watchUrl = new URL(publicUrl('/autochess/room'));
      watchUrl.searchParams.set('room', seat.roomId);
      watchUrl.hash = `watch=${seat.watchToken}`;
      return {
        ...seat, watchUrl: watchUrl.toString(),
        inviteText: humanInvitationGuide(origin, seat.roomId, ownerId).text,
        humanInvitation: humanInvitationGuide(origin, seat.roomId, ownerId),
        machineInviteText: machineInvite(playerMcpUrl(publicUrl('/mcp', 'mcp')), seat.invitation)
      };
    },
    join: (invitation, name, joinKey, accountToken) => {
      // Tickets are account-creating capabilities, never roomId.code seat-reconnect invitations.
      if (invitation.startsWith('mt1_')) return machineInvites.join(invitation, name, joinKey, accountToken);
      if (accountToken && !accounts.authenticate(accountToken)?.isAi) {
        const seated = store.resumeInvitationSeat(invitation, accountToken);
        if (seated) return seated;
        throw new Error('入座请用自己的机账号 accountToken；已经拿到 roomId 和席位 token 的棋手，直接 read_turn 即可继续。');
      }
      return machineInvites.join(invitation, name, joinKey, accountToken);
    },
    giftCatalogForAi: aiId => {
      if (slim) throw new Error('演示版不含赠礼');
      return accounts.giftCatalogForAi(aiId);
    },
    giftCosmeticFromRoom: (aiId, roomId, requestId, cosmeticId, note) => {
      if (slim) throw new Error('演示版不含赠礼');
      return accounts.giftCosmeticFromRoom(aiId, roomId, requestId, cosmeticId, note);
    },
  });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { void transport.close(); void server.close(); });
  try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
  catch { if (!res.headersSent) res.status(500).json({ error: 'MCP请求失败' }); }
});
app.get('/mcp', (req, res) => {
  if (String(req.headers.accept || '').includes('text/event-stream')) { res.status(405).set('Allow', 'POST').end(); return; }
  const roomUrl = publicUrl('/autochess/room');
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>autochess MCP</title>
<p>这是给机用的 Streamable HTTP 接口，浏览器直接打开会得到 405。</p>
<p>请打开棋室页面：<a href="${roomUrl}">${roomUrl}</a></p>`);
});
app.all('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').end());
app.listen(port, '127.0.0.1', () => {
  console.log(`Room and MCP ready: http://127.0.0.1:${port}/mcp${slim ? ' (slim demo)' : ''}`);
  for (const host of store.localCursorRooms()) store.cursorState(host, false, '服务已恢复，点击继续 Cursor');
});
