import type { AccountStore, PlatformAccountPerson } from '../accounts/account-store';
import type { EchoTreeStore } from '../accounts/echo-tree-store';
import { announcementsFor } from '../meta/announcements';
import { COSMETICS, DEFAULT_BOARD_SKIN, listedCosmetics } from '../meta/cosmetics';
import { CURRENCY, exchangeBotPerHuman } from '../meta/economy';
import { COSMETIC_TIER_META, getGameConfig } from '../meta/game-config';
import type { GiftLedgerQuery } from '../meta/gift-ledger';
import {
  AUTOCHESS_HOST_ADAPTER_VERSION,
  AUTOCHESS_PLATFORM_PROTOCOL_VERSION,
  type AutochessEchoScope,
} from '../meta/host-config';
import { leaderboardOrder } from '../meta/leaderboard';
import type { EphemeralStudioBridge } from '../pack-studio/ephemeral-bridge';
import type { PackId } from '../../packs/registry';
import {
  platformIdentity,
  type PlatformHouseholdMember,
  type PlatformIdentity,
} from './platform-identity';
import type { RoomStore, SeatOwner } from './room-store';

export const PLATFORM_WORLD_ACTIONS = [
  'world',
  'shop_buy',
  'shop_equip',
  'gift_catalog',
  'gift_send',
  'gift_claim',
  'subsidize',
  'arcade',
] as const;

export type PlatformWorldAction = (typeof PLATFORM_WORLD_ACTIONS)[number];

export type PlatformWorldDeps = {
  accounts: AccountStore;
  echo?: EchoTreeStore;
  rooms?: RoomStore;
  studio?: EphemeralStudioBridge;
  packAvailability?: { isEnabled(id: PackId): boolean; enabledPacks(): unknown[] };
  cosmeticsSandbox?: boolean;
  echoScope?: AutochessEchoScope;
  arcadeEnabled?: boolean;
  cursorEnabled?: boolean;
  mcpUrl?: string;
};

export type PlatformUiRequest = {
  scope: 'meta' | 'account' | 'room';
  op: string;
  args?: Record<string, unknown>;
};

export type PlatformWorldBridge = {
  resolveSeatOwner(identity: PlatformIdentity, household?: readonly PlatformHouseholdMember[]): SeatOwner;
  handleAction(
    identity: PlatformIdentity,
    action: PlatformWorldAction,
    params: Record<string, unknown>,
    household?: readonly PlatformHouseholdMember[],
  ): unknown;
  dispatchHostUi(
    identity: PlatformIdentity,
    request: PlatformUiRequest,
    household?: readonly PlatformHouseholdMember[],
  ): unknown;
};

const fail = (message: string): never => { throw new Error(message); };
const PLATFORM_HASH_RE = /^platform:[a-z0-9][a-z0-9_-]{0,31}:[a-f0-9]{32}$/;
const PLATFORM_HASH_GLOBAL_RE = /platform:[a-z0-9][a-z0-9_-]{0,31}:[a-f0-9]{32}:?/g;
const HIDDEN_KEYS = new Set([
  'token',
  'accountToken',
  'watchToken',
  'password',
  'accountId',
  'actorKey',
  'fromId',
  'toId',
  'ownerId',
  'audienceIds',
]);

function scrubPlatformPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return PLATFORM_HASH_RE.test(value) ? undefined : value.replace(PLATFORM_HASH_GLOBAL_RE, '');
  }
  if (Array.isArray(value)) return value.map(scrubPlatformPayload);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (HIDDEN_KEYS.has(key)) continue;
    if (typeof entry === 'string' && PLATFORM_HASH_RE.test(entry)) continue;
    out[key] = scrubPlatformPayload(entry);
  }
  return out;
}

function assertNonGuest(identity: PlatformIdentity) {
  if (identity.owner.actorType === 'guest') {
    fail('游客身份暂未开放局外钱包与互赠，请使用平台正式人或机身份');
  }
}

function reqText(value: unknown, field: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${field} 无效`);
  return value.trim();
}

function reqId(value: unknown): string {
  const id = reqText(value, 'requestId', 80);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) fail('requestId 无效');
  return id;
}

function buildHouseholdPeople(
  identity: PlatformIdentity,
  household: readonly PlatformHouseholdMember[] = [],
): { people: PlatformAccountPerson[]; actorId: string } {
  const map = new Map<string, PlatformAccountPerson>();
  const toAccountId = (playerId: string, actorType: 'human' | 'ai') =>
    platformIdentity({ provider: identity.provider, playerId, actorType }).owner.accountId;

  const selfIsAi = identity.owner.actorType === 'ai';
  map.set(identity.owner.accountId, {
    id: identity.owner.accountId,
    name: identity.owner.accountName,
    isAi: selfIsAi,
  });

  for (const member of household) {
    if (member.playerId.startsWith('guest:') || member.actorType === 'guest') continue;
    const memberRole: 'human' | 'ai' = member.actorType === 'human' ? 'human' : 'ai';
    const resolved = platformIdentity({
      provider: identity.provider,
      playerId: member.playerId,
      ...(member.displayName ? { displayName: member.displayName } : {}),
      actorType: memberRole,
    });
    const owners = member.owners?.length
      ? member.owners
        .filter((pid) => !pid.startsWith('guest:'))
        .map((pid) => toAccountId(pid, 'human'))
      : memberRole === 'ai' && !selfIsAi
        ? [identity.owner.accountId]
        : undefined;
    const prev = map.get(resolved.owner.accountId);
    map.set(resolved.owner.accountId, {
      id: resolved.owner.accountId,
      name: resolved.owner.accountName,
      isAi: memberRole === 'ai',
      ...(owners?.length ? { owners } : prev?.owners ? { owners: prev.owners } : {}),
    });
  }

  // If the AI calls on its own and passed a single human owner in household, link them implicitly.
  const humans = [...map.values()].filter((p) => !p.isAi);
  const selfPerson = map.get(identity.owner.accountId)!;
  if (selfPerson.isAi && !selfPerson.owners?.length && humans.length === 1) {
    selfPerson.owners = [humans[0]!.id];
  }

  return { people: [...map.values()], actorId: identity.owner.accountId };
}

function readEchoEvents(
  deps: PlatformWorldDeps,
  selfId: string,
  partnerIds: string[],
  limit: number,
  afterId?: string | null,
  since?: number,
) {
  const scope = deps.echoScope ?? 'public';
  if (!deps.echo || scope === 'none') {
    return { events: [], latestId: null, hasMore: false, scope };
  }
  const viewerIds = scope === 'private' ? [selfId, ...partnerIds] : undefined;
  if (afterId !== undefined) {
    return {
      ...deps.echo.pageAfter(afterId, limit, viewerIds),
      latestId: deps.echo.latestId(viewerIds),
      scope,
    };
  }
  const events = since === undefined ? deps.echo.recent(limit, viewerIds) : deps.echo.since(since, limit, viewerIds);
  return {
    events,
    latestId: deps.echo.latestId(viewerIds),
    hasMore: false,
    scope,
  };
}

/**
 * 平台局外与宿主 UI 桥接包：通过 `AccountStore.platformRun` 统一完成建档、羁绊绑定、
 * 商店买装、人机互赠礼函、接济与游乐摊，保持棋局引擎纯粹且零静态凭证泄露。
 */
export function createPlatformWorldBridge(deps: PlatformWorldDeps): PlatformWorldBridge {
  const { accounts } = deps;
  const cosmeticsSandbox = deps.cosmeticsSandbox === true;
  const arcadeEnabled = deps.arcadeEnabled ?? accounts.arcadeOptions.enabled === true;
  const echoScope = deps.echoScope ?? accounts.arcadeOptions.echoScope ?? 'public';

  function runAsPlatform<T>(
    identity: PlatformIdentity,
    household: readonly PlatformHouseholdMember[] | undefined,
    fn: (token: string) => T,
  ): T {
    assertNonGuest(identity);
    const { people, actorId } = buildHouseholdPeople(identity, household);
    return accounts.platformRun(people, actorId, fn);
  }

  function buildCatalogPayload() {
    const cfg = getGameConfig();
    const reward = { play: cfg.economy.legacyPlayReward, win: cfg.economy.legacyWinReward };
    return {
      cosmetics: cosmeticsSandbox ? COSMETICS : listedCosmetics(),
      tiers: COSMETIC_TIER_META,
      currencies: CURRENCY,
      exchange: exchangeBotPerHuman(),
      reward,
      defaultSkin: DEFAULT_BOARD_SKIN,
      arcadeEnabled,
      echoScope,
      sandbox: cosmeticsSandbox,
    };
  }

  return {
    resolveSeatOwner(identity, household) {
      if (identity.owner.actorType === 'guest') return identity.owner;
      return runAsPlatform(identity, household, (token) => {
        const self = accounts.selfAccount(token);
        return {
          ...identity.owner,
          accountName: self.username,
          ...(self.equipped.board ? { skinId: self.equipped.board } : {}),
          ...(self.equipped.frame ? { frame: self.equipped.frame } : {}),
        };
      });
    },

    handleAction(identity, action, params, household) {
      return scrubPlatformPayload(
        runAsPlatform(identity, household, (token) => {
          accounts.flushPendingEcho();
          if (action === 'world') {
            const self = accounts.selfAccount(token);
            const partnerIds = self.boundPartners.map((p) => p.id);
            const partnerName = typeof params.to === 'string' && params.to.trim() ? params.to.trim() : undefined;
            const echoData = readEchoEvents(deps, self.id, partnerIds, 20);
            return {
              self,
              currencies: CURRENCY,
              tiers: COSMETIC_TIER_META,
              cosmetics: listedCosmetics(),
              giftCatalog: self.boundPartners.length ? accounts.giftCatalog(token, partnerName) : null,
              giftHistory: accounts.giftLedger(token, { limit: 20 }),
              ...(arcadeEnabled ? { arcade: accounts.arcadeView(token) } : {}),
              echo: echoData,
            };
          }
          if (action === 'shop_buy') {
            const cosmeticId = reqText(params.cosmeticId, 'cosmeticId', 80);
            return { self: accounts.buyCosmetic(token, cosmeticId) };
          }
          if (action === 'shop_equip') {
            const cosmeticId = params.cosmeticId === null ? null : reqText(params.cosmeticId, 'cosmeticId', 80);
            return { self: accounts.equipCosmetic(token, cosmeticId) };
          }
          if (action === 'gift_catalog') {
            const to = params.to === undefined ? undefined : reqText(params.to, 'to', 80);
            return accounts.giftCatalog(token, to);
          }
          if (action === 'gift_send') {
            const cosmeticId = reqText(params.cosmeticId, 'cosmeticId', 80);
            const requestId = reqId(params.requestId ?? params.request_id);
            const to = params.to === undefined ? undefined : reqText(params.to, 'to', 80);
            const note = params.note === undefined ? undefined : String(params.note);
            return accounts.giftCosmeticForAccount(token, requestId, cosmeticId, note, to);
          }
          if (action === 'gift_claim') {
            const giftId = reqText(params.giftId ?? params.gift_id, 'giftId', 100);
            const rawReq = params.requestId ?? params.request_id;
            const requestId = rawReq === undefined ? undefined : reqId(rawReq);
            return accounts.claimGift(token, giftId, requestId);
          }
          if (action === 'subsidize') {
            const coins = Number(params.coins);
            const requestId = reqId(params.requestId ?? params.request_id);
            const self = accounts.selfAccount(token);
            const targetAi = params.to ?? params.aiId ?? params.aiName ?? (self.boundPartners.length === 1 ? self.boundPartners[0]!.id : undefined);
            return accounts.subsidize(token, reqText(targetAi, 'aiId', 80), coins, requestId);
          }
          if (action === 'arcade') {
            if (!arcadeEnabled) fail('当前站点已关闭像素游乐摊');
            const command = params.command;
            return command === undefined ? accounts.arcadeView(token) : accounts.arcadeAction(token, command);
          }
          fail(`未知平台局外动作：${String(action)}`);
        }),
      );
    },

    dispatchHostUi(identity, request, household) {
      const op = reqText(request.op, 'op', 64);
      const args = request.args ?? {};

      if (request.scope === 'meta') {
        if (op === 'catalog') return buildCatalogPayload();
        if (op === 'announcements') return { announcements: announcementsFor('human') };
        if (op === 'leaderboard') {
          const order = leaderboardOrder(args.order);
          return { order, entries: accounts.leaderboard(Number(args.limit) || 20, order) };
        }
        return runAsPlatform(identity, household, (token) => {
          accounts.flushPendingEcho();
          if (op === 'profile') return { self: accounts.selfAccount(token) };
          if (op === 'buy') return { self: accounts.buyCosmetic(token, args.cosmeticId) };
          if (op === 'equip') return { self: accounts.equipCosmetic(token, args.cosmeticId) };
          if (op === 'gift_catalog') return accounts.giftCatalog(token, args.to);
          if (op === 'gift_history') {
            return { giftHistory: accounts.giftLedger(token, args as GiftLedgerQuery) };
          }
          if (op === 'gift') return accounts.giftCosmetic(token, args.to, args.cosmeticId, args.note);
          if (op === 'claim') return accounts.claimGifts(token, args.giftId);
          if (op === 'subsidize') {
            const requestId = reqId(args.requestId);
            return accounts.subsidize(token, args.aiId, args.coins, requestId);
          }
          if (op === 'echo') {
            const self = accounts.selfAccount(token);
            const limit = Number(args.limit) || 40;
            const page = readEchoEvents(
              deps,
              self.id,
              self.boundPartners.map((p) => p.id),
              limit,
              args.afterId as string | null | undefined,
              args.since === undefined ? undefined : Number(args.since),
            );
            return { ...page, serverNow: Date.now(), echoScope };
          }
          fail(`未知 meta 操作：${op}`);
        });
      }

      if (request.scope === 'account') {
        return runAsPlatform(identity, household, (token) => {
          if (op === 'bindings') return { ai: accounts.boundAi(token) };
          if (op === 'arcade') return accounts.arcadeView(token);
          if (op === 'arcade_action') return accounts.arcadeAction(token, args.command);
          if (op === 'watch_rooms') {
            if (!deps.rooms) return { rooms: [] };
            const self = accounts.selfAccount(token);
            const machineIds = self.boundPartners.filter((p) => p.isAi).map((p) => p.id);
            return { rooms: deps.rooms.watchableForMachines(machineIds) };
          }
          fail(`平台模式下不支持该 account 操作：${op}`);
        });
      }

      if (request.scope === 'room') {
        const rooms = deps.rooms ?? fail('RoomStore 未配置');
        if (op === 'config') {
          return {
            cursorEnabled: deps.cursorEnabled ?? false,
            slim: false,
            mcpUrl: deps.mcpUrl ?? '',
            packs: deps.packAvailability ? deps.packAvailability.enabledPacks() : [],
            cosmeticsSandbox,
            arcadeEnabled,
            echoScope,
            adapterVersion: AUTOCHESS_HOST_ADAPTER_VERSION,
            platformProtocol: AUTOCHESS_PLATFORM_PROTOCOL_VERSION,
          };
        }
        if (op === 'create') {
          const owner = this.resolveSeatOwner(identity, household);
          return rooms.create(
            owner.accountName,
            typeof args.pack === 'string' ? args.pack : undefined,
            typeof args.seats === 'number' ? args.seats : undefined,
            owner,
            typeof args.mode === 'string' ? args.mode : undefined,
          );
        }
        if (op === 'create_custom') {
          const owner = this.resolveSeatOwner(identity, household);
          return rooms.createCustom(
            owner.accountName,
            args.customPack,
            typeof args.seats === 'number' ? args.seats : undefined,
            owner,
            typeof args.mode === 'string' ? args.mode : 'duel',
          );
        }
        if (op === 'join') {
          const owner = this.resolveSeatOwner(identity, household);
          return rooms.join(
            reqText(args.invitation, 'invitation', 120),
            owner.accountName,
            reqText(args.joinKey, 'joinKey', 120),
            owner,
          );
        }
        if (op === 'start') return rooms.start(args as Parameters<RoomStore['start']>[0]);
        if (op === 'state') return rooms.view(args as Parameters<RoomStore['view']>[0]);
        if (op === 'action') return rooms.mutate(args as Parameters<RoomStore['mutate']>[0]);
        if (op === 'studio_sync') {
          if (!deps.studio) fail('工坊共创桥未启用');
          return runAsPlatform(identity, household, (token) =>
            deps.studio!.syncFromBrowser(token, args as Parameters<EphemeralStudioBridge['syncFromBrowser']>[1]),
          );
        }
        fail(`未知 room 操作：${op}`);
      }

      fail(`未知 UI scope：${String(request.scope)}`);
    },
  };
}
