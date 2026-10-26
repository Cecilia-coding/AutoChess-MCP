import { createHash, timingSafeEqual } from 'node:crypto';

import { parseCompanionPlan } from './companion';
import { playerRoomMutationReply, playerRoomReply, type PlayerReplyOptions } from './room-mcp';
import type { RoomStore, SeatOwner } from './room-store';
import type { RoomAction, RoomCredentials } from './room-types';

export type PlatformIdentityInput = {
  provider?: string;
  playerId: string;
  displayName?: string;
};

export type PlatformIdentity = PlatformIdentityInput & {
  provider: string;
  displayName: string;
  owner: SeatOwner;
};

type Params = Record<string, unknown>;

const requestIdPattern = /^[A-Za-z0-9_-]{8,80}$/;
const roomIdPattern = /^[a-f0-9]{12}$/;

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

/** Constant-time comparison for the loopback satellite secret. An empty secret disables the endpoint. */
export function verifyPlatformSecret(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** HTTP field values stay ASCII; platforms percent-encode UTF-8 display names. */
export function decodePlatformDisplayName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return decodeURIComponent(value); }
  catch { return fail('X-Player-Name 编码无效'); }
}

/**
 * Turn a platform-owned identity into an opaque local seat owner.
 * Raw platform IDs remain outside room saves while account/guest/slot identities stay isolated.
 */
export function platformIdentity(input: PlatformIdentityInput): PlatformIdentity {
  const provider = (input.provider?.trim().toLowerCase() || 'cedartoy');
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(provider)) fail('平台标识无效');
  const playerId = text(input.playerId, 'X-Player-Id', 128);
  if (/\p{Cc}/u.test(playerId)) fail('X-Player-Id 无效');
  const fallbackName = playerId.startsWith('guest:') ? 'CEDAR 游客' : `CEDAR 棋手 ${playerId.slice(-12)}`;
  const displayName = (input.displayName?.trim().replace(/\s+/g, ' ').slice(0, 49) || fallbackName);
  const digest = createHash('sha256').update(`${provider}\0${playerId}`).digest('hex').slice(0, 32);
  return {
    provider,
    playerId,
    displayName,
    owner: { accountId: `platform:${provider}:${digest}`, accountName: displayName },
  };
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
    if (['token', 'accountToken', 'watchToken', 'password', 'optionalAction', 'feedbackAction', 'echoGuide', 'giftHistoryGuide', 'giftGuide', 'matchGuide'].includes(key)) continue;
    if (key === 'fill' && Array.isArray(entry)) {
      out.fill = entry.filter(item => item !== 'token' && item !== 'accountToken' && item !== 'roomId')
        .map(item => typeof item === 'string' ? `params.${item}` : item);
      continue;
    }
    out[key] = rewriteHint(entry, roomId);
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

/** Root-play adapter used by account-owning platforms such as CEDAR TOY. */
export class PlatformRoomAdapter {
  constructor(private readonly store: RoomStore) {}

  private credentials(identity: PlatformIdentity, roomId: string): RoomCredentials {
    return this.store.accountSeat(roomId, identity.owner.accountId) ?? fail('你没有这间房的席位；先 join');
  }

  async play(identity: PlatformIdentity, rawAction: unknown, rawParams?: unknown): Promise<unknown> {
    const action = text(rawAction, 'action', 32);
    const params = paramsOf(rawParams);
    // CEDAR may inject player_id into params for older adapters. It is deliberately ignored;
    // only the authenticated X-Player-Id header supplied by the platform selects a seat.
    if (['token', 'accountToken', 'password'].some(key => params[key] !== undefined)) fail('平台入口不接收账号或席位凭证');

    if (action === 'create' || action === 'create_room') {
      const requestId = requestIdOf(params);
      const pack = params.pack === undefined ? undefined : text(params.pack, 'pack', 40);
      const seat = this.store.createForMachine(identity.owner, requestId, pack);
      const current = playerRoomReply(this.store.view(seat), readOptions(params, true));
      return rewriteHint({ roomId: seat.roomId, invitation: seat.invitation, current }, seat.roomId);
    }

    if (action === 'join' || action === 'join_room') {
      const invitation = text(params.invitation, 'invitation', 100);
      const seat = this.store.joinForAccount(invitation, identity.owner);
      const current = playerRoomReply(this.store.view(seat), readOptions(params, true));
      return rewriteHint({ roomId: seat.roomId, current }, seat.roomId);
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
      const view = waitMs && initial.revision === after ? await this.store.wait(credentials, after, waitMs) : initial;
      return rewriteHint(playerRoomReply(view, readOptions(params)), roomId);
    }

    if (action === 'act') {
      const roomId = roomIdOf(params);
      const credentials = this.credentials(identity, roomId);
      const before = this.store.view(credentials);
      const round = integer(params.round, 'round', 1);
      const revision = integer(params.revision, 'revision');
      const requestId = requestIdOf(params);
      const view = this.store.mutate({ ...credentials, round, revision, requestId, action: actionOf(params, before.battle?.round) });
      return rewriteHint(playerRoomMutationReply(before, view, { ...readOptions(params), round, revision }), roomId);
    }

    fail('未知 action；可用 create、join、read、act');
  }
}
