import { createHash, timingSafeEqual } from 'node:crypto';
import type { SeatOwner } from './room-store';

export type PlatformActorType = 'human' | 'ai' | 'guest';

export type PlatformHouseholdMember = {
  playerId: string;
  displayName?: string;
  actorType?: PlatformActorType;
  owners?: string[];
};

export type PlatformIdentityInput = {
  provider?: string;
  playerId: string;
  displayName?: string;
  actorType?: PlatformActorType;
};

export type PlatformIdentity = PlatformIdentityInput & {
  provider: string;
  displayName: string;
  owner: SeatOwner;
};

const fail = (message: string): never => { throw new Error(message); };

function cleanText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${field} 无效`);
  return value.trim();
}

/** Constant-time comparison for the loopback satellite secret. An empty secret disables the endpoint. */
export function verifyPlatformSecret(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** HTTP field values stay ASCII; platforms percent-encode UTF-8 display names or household payloads. */
export function decodePlatformDisplayName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return decodeURIComponent(value); }
  catch { return fail('X-Player-Name 编码无效'); }
}

/** Parse optional trusted `X-Player-Type` header; `guest:*` IDs are always downgraded to `guest`. */
export function parsePlatformActorType(rawType: string | undefined, playerId: string): PlatformActorType {
  if (playerId.startsWith('guest:')) return 'guest';
  if (!rawType || !rawType.trim()) return 'guest';
  const normalized = rawType.trim().toLowerCase();
  if (normalized === 'human' || normalized === 'ai' || normalized === 'guest') return normalized;
  return fail('X-Player-Type 无效');
}

/** Parse optional percent-encoded JSON array `X-Player-Household` describing owner <-> bound AI relations. */
export function parsePlatformHousehold(rawHeader: string | undefined): PlatformHouseholdMember[] {
  if (!rawHeader || !rawHeader.trim()) return [];
  let decoded = '';
  try {
    decoded = decodeURIComponent(rawHeader);
  } catch {
    fail('X-Player-Household 编码无效');
  }
  if (decoded.length > 8192) fail('X-Player-Household 过大');
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    fail('X-Player-Household 格式无效');
  }
  if (!Array.isArray(parsed) || parsed.length > 16) throw new Error('X-Player-Household 须为不超过 16 项的数组');
  return parsed.map((entry, idx) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`X-Player-Household[${idx}] 无效`);
    const item = entry as Record<string, unknown>;
    const playerId = cleanText(item.playerId, `X-Player-Household[${idx}].playerId`, 128);
    if (/\p{Cc}/u.test(playerId)) throw new Error(`X-Player-Household[${idx}].playerId 无效`);
    const rawRole = item.actorType;
    let actorType: PlatformActorType;
    if (playerId.startsWith('guest:')) {
      actorType = 'guest';
    } else if (rawRole === undefined) {
      actorType = 'ai';
    } else if (rawRole === 'human' || rawRole === 'ai' || rawRole === 'guest') {
      actorType = rawRole;
    } else {
      throw new Error(`X-Player-Household[${idx}].actorType 无效`);
    }
    const displayName =
      item.displayName === undefined
        ? undefined
        : cleanText(item.displayName, `X-Player-Household[${idx}].displayName`, 49);
    let owners: string[] | undefined;
    if (item.owners !== undefined) {
      if (!Array.isArray(item.owners)) throw new Error(`X-Player-Household[${idx}].owners 无效`);
      owners = item.owners.map((ownerPid, ownerIdx) => cleanText(ownerPid, `X-Player-Household[${idx}].owners[${ownerIdx}]`, 128));
    }
    return {
      playerId,
      ...(displayName ? { displayName } : {}),
      actorType,
      ...(owners ? { owners } : {}),
    };
  });
}

/**
 * Turn a platform-owned identity into an opaque local seat owner.
 * Raw platform IDs remain outside room saves while account/guest/slot identities stay isolated.
 */
export function platformIdentity(input: PlatformIdentityInput): PlatformIdentity {
  const provider = (input.provider?.trim().toLowerCase() || 'cedartoy');
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(provider)) fail('平台标识无效');
  const playerId = cleanText(input.playerId, 'X-Player-Id', 128);
  if (/\p{Cc}/u.test(playerId)) fail('X-Player-Id 无效');
  const actorType: PlatformActorType = playerId.startsWith('guest:') ? 'guest' : (input.actorType ?? 'guest');
  const fallbackName = playerId.startsWith('guest:') ? 'CEDAR 游客' : 'CEDAR 棋手';
  const displayName = (input.displayName?.trim().replace(/\s+/g, ' ').slice(0, 49) || fallbackName);
  const digest = createHash('sha256').update(`${provider}\0${playerId}`).digest('hex').slice(0, 32);
  const actorKey = createHash('sha256')
    .update(`${provider}\0actor\0${playerId.startsWith('guest:') ? playerId : playerId.split(':')[0]}`)
    .digest('hex')
    .slice(0, 32);
  return {
    provider,
    playerId,
    displayName,
    ...(actorType ? { actorType } : {}),
    owner: {
      accountId: `platform:${provider}:${digest}`,
      accountName: displayName,
      actorType,
      actorKey,
    },
  };
}
