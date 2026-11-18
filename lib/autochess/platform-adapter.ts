import { AUTOCHESS_PLATFORM_PROTOCOL_VERSION } from '../meta/host-config';
import { parseCompanionPlan } from './companion';
import {
  decodePlatformDisplayName,
  parsePlatformActorType,
  parsePlatformHousehold,
  platformIdentity,
  verifyPlatformSecret,
  type PlatformActorType,
  type PlatformHouseholdMember,
  type PlatformIdentity,
  type PlatformIdentityInput,
} from './platform-identity';
import {
  PLATFORM_WORLD_ACTIONS,
  type PlatformUiRequest,
  type PlatformWorldAction,
  type PlatformWorldBridge,
} from './platform-world';
import { playerRoomMutationReply, playerRoomReply, type PlayerReplyOptions } from './room-mcp';
import type { RoomStore, SeatOwner } from './room-store';
import type { RoomAction, RoomCredentials } from './room-types';

export const PLATFORM_ADAPTER_VERSION = AUTOCHESS_PLATFORM_PROTOCOL_VERSION;
export {
  decodePlatformDisplayName,
  parsePlatformActorType,
  parsePlatformHousehold,
  platformIdentity,
  verifyPlatformSecret,
  type PlatformActorType,
  type PlatformHouseholdMember,
  type PlatformIdentity,
  type PlatformIdentityInput,
};
export { createPlatformWorldBridge, PLATFORM_WORLD_ACTIONS, type PlatformUiRequest, type PlatformWorldBridge } from './platform-world';

type Params = Record<string, unknown>;

const requestIdPattern = /^[A-Za-z0-9_-]{8,80}$/;
const roomIdPattern = /^[a-f0-9]{12}$/;
const WORLD_ACTION_SET = new Set<string>(PLATFORM_WORLD_ACTIONS);

const fail = (message: string): never => { throw new Error(message); };

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${field} 无效`);
  return (value as string).trim();
}

function integer(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(`${field} 无效`);
  return value as number;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') fail(`${field} 无效`);
  return value as boolean;
}

function paramsOf(value: unknown): Params {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('params 必须是对象');
  return value as Params;
}

function aliased(params: Params, camel: string, snake: string): unknown {
  return params[camel] ?? params[snake];
}

function readOptions(params: Params, entryGuide = false): PlayerReplyOptions {
  const units = params.units;
  if (units !== undefined && units !== 'current' && units !== 'none') fail('units 无效');
  const unitCache = aliased(params, 'unitCache', 'unit_cache');
  if (unitCache !== undefined && (typeof unitCache !== 'string' || unitCache.length > 256)) fail('unitCache 无效');
  return {
    ...(params.verbose === undefined ? {} : { verbose: boolean(params.verbose, 'verbose') }),
    ...(params.report === undefined ? {} : { report: boolean(params.report, 'report') }),
    ...(units === undefined ? {} : { units: units as 'current' | 'none' }),
    ...(unitCache === undefined ? {} : { unitCache: unitCache as string }),
    ...(entryGuide ? { entryGuide: true } : {}),
  };
}

function roomIdOf(params: Params): string {
  const roomId = text(aliased(params, 'roomId', 'room_id'), 'roomId', 12);
  if (!roomIdPattern.test(roomId)) fail('roomId 无效');
  return roomId;
}

function requestIdOf(params: Params): string {
  const requestId = text(aliased(params, 'requestId', 'request_id'), 'requestId', 80);
  if (!requestIdPattern.test(requestId)) fail('requestId 无效');
  return requestId;
}

function actionOf(params: Params, beforeBattleRound?: number): RoomAction {
  const kind = text(params.kind, 'kind', 32);
  if (kind === 'plan') {
    if (!params.plan || typeof params.plan !== 'object' || Array.isArray(params.plan)) fail('plan 无效');
    let reason = '';
    const plan = parseCompanionPlan(JSON.stringify(params.plan), message => { reason = message; });
    if (!plan) return fail(reason || 'plan 无效');
    return { kind: 'plan', plan, ready: boolean(params.ready, 'ready') };
  }
  if (kind === 'say') return { kind: 'danmaku', text: text(params.text, 'text', 60), battleRound: beforeBattleRound };
  if (kind === 'buy_xp') {
    const times = params.times === undefined ? undefined : integer(params.times, 'times', 1, 8);
    return { kind: 'buy_xp', ...(times === undefined ? {} : { times }) };
  }
  if (['refresh', 'ready', 'unready', 'cancel_room', 'resign', 'roll', 'claim', 'roll_and_claim'].includes(kind)) {
    return { kind } as RoomAction;
  }
  return fail('CEDAR 入口仅开放棋局动作');
}

function rewriteHint(value: unknown, roomId: string): unknown {
  if (Array.isArray(value)) return value.map(entry => rewriteHint(entry, roomId));
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (['token', 'accountToken', 'watchToken', 'password', 'accountId', 'actorKey', 'actorType', 'activeAt', 'accountName', 'optionalAction', 'feedbackAction', 'echoGuide', 'giftHistoryGuide', 'giftGuide', 'matchGuide'].includes(key)) continue;
    if (key === 'fill' && Array.isArray(entry)) {
      out.fill = entry.filter(item => item !== 'token' && item !== 'accountToken' && item !== 'roomId')
        .map(item => typeof item === 'string' ? `params.${item}` : item);
      continue;
    }
    out[key] = rewriteHint(entry, roomId);
  }
  if (source.tool === 'wait') {
    out.reason = '等待仅在当前请求内有效；不能在请求结束后唤醒客户端。使用 fallback 读取变化。';
  }
  if (typeof source.tool === 'string' && ['join_room', 'read_turn', 'wait_turn', 'act'].includes(source.tool)) {
    const action = source.tool === 'join_room' ? 'join' : source.tool === 'act' ? 'act' : 'read';
    const priorArgs = source.args && typeof source.args === 'object' && !Array.isArray(source.args)
      ? rewriteHint(source.args, roomId) as Record<string, unknown>
      : {};
    out.tool = 'play';
    out.args = { game: 'autochess', action, params: { roomId, ...priorArgs } };
  }
  return out;
}

export type PlatformPlayOptions = {
  household?: SeatOwner[];
  householdMembers?: readonly PlatformHouseholdMember[];
};

/** Root-play adapter used by account-owning platforms such as CEDAR TOY. */
export class PlatformRoomAdapter {
  constructor(
    private readonly store: RoomStore,
    private readonly world?: PlatformWorldBridge,
  ) {}

  private credentials(identity: PlatformIdentity, roomId: string): RoomCredentials {
    return this.store.accountSeat(roomId, identity.owner.accountId) ?? fail('你没有这间房的席位；先 join');
  }

  private resolveOwner(identity: PlatformIdentity, options?: PlatformPlayOptions): SeatOwner {
    return this.world ? this.world.resolveSeatOwner(identity, options?.householdMembers) : identity.owner;
  }

  private resolveHouseholdSeats(identity: PlatformIdentity, options?: PlatformPlayOptions): SeatOwner[] {
    if (!options?.household?.length) return [];
    if (!this.world || !options.householdMembers?.length) return options.household;
    const byId = new Map<string, PlatformHouseholdMember>();
    for (const member of options.householdMembers) {
      const mId = platformIdentity({
        provider: identity.provider,
        playerId: member.playerId,
        ...(member.displayName ? { displayName: member.displayName } : {}),
        actorType: member.actorType,
      }).owner.accountId;
      byId.set(mId, member);
    }
    return options.household.map((seat) => {
      const member = byId.get(seat.accountId);
      if (!member) return seat;
      const memberIdentity = platformIdentity({
        provider: identity.provider,
        playerId: member.playerId,
        displayName: seat.accountName,
        actorType: member.actorType,
      });
      return this.world!.resolveSeatOwner(memberIdentity, options.householdMembers);
    });
  }

  async play(
    identity: PlatformIdentity,
    rawAction: unknown,
    rawParams?: unknown,
    signal?: AbortSignal,
    options?: PlatformPlayOptions,
  ): Promise<unknown> {
    const action = text(rawAction, 'action', 32);
    const params = paramsOf(rawParams);
    // CEDAR may inject player_id into params for older adapters. It is deliberately ignored;
    // only the authenticated X-Player-Id header supplied by the platform selects a seat.
    if (['token', 'accountToken', 'password'].some(key => params[key] !== undefined)) fail('平台入口不接收账号或席位凭证');

    if (action === 'ui_dispatch') {
      const world = this.world;
      if (!world) throw new Error('当前站点未挂载平台前端桥接');
      const scope = text(params.scope, 'scope', 16);
      if (scope !== 'meta' && scope !== 'account' && scope !== 'room') throw new Error('scope 无效');
      const uiArgs = params.args === undefined ? {} : paramsOf(params.args);
      const req: PlatformUiRequest = { scope, op: text(params.op, 'op', 64), args: uiArgs };
      return world.dispatchHostUi(identity, req, options?.householdMembers);
    }

    if (WORLD_ACTION_SET.has(action)) {
      const world = this.world;
      if (!world) throw new Error('当前站点未开启平台局外钱包与互赠');
      return world.handleAction(identity, action as PlatformWorldAction, params, options?.householdMembers);
    }

    if (action === 'rooms') {
      return { rooms: this.store.platformRooms(identity.owner.accountId) };
    }

    if (action === 'create' || action === 'create_room') {
      const requestId = requestIdOf(params);
      const pack = params.pack === undefined ? undefined : text(params.pack, 'pack', 40);
      const mode = params.mode === undefined ? 'standard' : text(params.mode, 'mode', 32);
      const seats = params.seats === undefined ? undefined : integer(params.seats, 'seats', 2, 16);
      const owner = this.resolveOwner(identity, options);
      const household = this.resolveHouseholdSeats(identity, options);
      const seat = this.store.createForPlatform(owner, requestId, pack, mode, seats, household);
      const current = playerRoomReply(this.store.view(this.credentials(identity, seat.roomId)), readOptions(params, true));
      return rewriteHint({ roomId: seat.roomId, invitation: seat.invitation, current, duplicate: seat.duplicate === true }, seat.roomId);
    }

    if (action === 'join' || action === 'join_room') {
      const invitation = text(params.invitation, 'invitation', 100);
      const info = this.store.invitationRoom(invitation);
      const owner = this.resolveOwner(identity, options);
      const seat = info.isPlatform
        ? this.store.joinForPlatform(invitation, owner)
        : this.store.joinForAccount(invitation, owner);
      const current = playerRoomReply(this.store.view(seat), readOptions(params, true));
      return rewriteHint({ roomId: seat.roomId, current, duplicate: 'duplicate' in seat && seat.duplicate === true }, seat.roomId);
    }

    if (action === 'start') {
      const roomId = roomIdOf(params);
      const credentials = this.credentials(identity, roomId);
      const before = this.store.view(credentials);
      const view = this.store.start(credentials, requestIdOf(params));
      return rewriteHint({ ...playerRoomReply(view, readOptions(params, true)), duplicate: before.revision === view.revision }, roomId);
    }

    if (action === 'read' || action === 'read_turn' || action === 'wait') {
      const roomId = roomIdOf(params);
      const credentials = this.credentials(identity, roomId);
      const initial = this.store.view(credentials);
      const afterRaw = params.after;
      const after = afterRaw === undefined ? undefined : integer(afterRaw, 'after');
      const waitRaw = aliased(params, 'waitMs', 'wait_ms');
      const waitMs = waitRaw === undefined ? undefined : integer(waitRaw, 'waitMs', 0, 25_000);
      if (waitMs !== undefined && after === undefined) fail('waitMs 须配 after');
      if (after !== undefined && after > initial.revision) fail('after 超出当前房间 revision');
      const view = waitMs && initial.revision === after ? await this.store.wait(credentials, after, waitMs, signal) : initial;
      return rewriteHint(playerRoomReply(view, readOptions(params)), roomId);
    }

    if (action === 'act') {
      const roomId = roomIdOf(params);
      const credentials = this.credentials(identity, roomId);
      const before = this.store.view(credentials);
      if (before.phase === 'waiting' && !['say', 'cancel_room'].includes(String(params.kind))) {
        fail('请先由房主 start');
      }
      const round = integer(params.round, 'round', 1);
      const revision = integer(params.revision, 'revision');
      const requestId = requestIdOf(params);
      const view = this.store.mutate({ ...credentials, round, revision, requestId, action: actionOf(params, before.battle?.round) });
      return rewriteHint({ ...playerRoomMutationReply(before, view, { ...readOptions(params), round, revision }), duplicate: before.revision === view.revision }, roomId);
    }

    fail('未知 action；可用 rooms、create、join、start、read、act、world、shop_buy、shop_equip、gift_catalog、gift_send、gift_claim、subsidize、arcade');
  }
}
