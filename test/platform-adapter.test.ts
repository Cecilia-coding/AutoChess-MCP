import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import {
  createPlatformWorldBridge,
  decodePlatformDisplayName,
  parsePlatformActorType,
  parsePlatformHousehold,
  PlatformRoomAdapter,
  platformIdentity,
  verifyPlatformSecret,
  type PlatformHouseholdMember,
} from '../lib/autochess/platform-adapter';
import { AccountStore } from '../lib/accounts/account-store';
import { EchoTreeStore } from '../lib/accounts/echo-tree-store';
import { RoomStore } from '../lib/autochess/room-store';

const directory = mkdtempSync(join(tmpdir(), 'autochess-platform-'));
after(() => rmSync(directory, { recursive: true, force: true }));

function hasCredentialKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasCredentialKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => ['token', 'accountToken', 'watchToken', 'password'].includes(key) || hasCredentialKey(entry));
}

test('trusted platform secrets use exact comparison and empty config stays disabled', () => {
  assert.equal(verifyPlatformSecret(undefined, 'secret'), false);
  assert.equal(verifyPlatformSecret('secret', undefined), false);
  assert.equal(verifyPlatformSecret('secret', 'secret'), true);
  assert.equal(verifyPlatformSecret('secret', 'secret2'), false);
  assert.equal(decodePlatformDisplayName('HTTP%E6%9D%A5%E5%AE%A2%E6%9C%BA'), 'HTTP来客机');
  assert.throws(() => decodePlatformDisplayName('%E6%9D'), /编码无效/);
});

test('platform identities are stable, opaque, and isolate slots and guests', () => {
  const main = platformIdentity({ playerId: '42', displayName: '棋手甲' });
  const same = platformIdentity({ playerId: '42', displayName: '新显示名' });
  const slot = platformIdentity({ playerId: '42:2' });
  const guest = platformIdentity({ playerId: 'guest:42' });

  assert.equal(main.owner.accountId, same.owner.accountId);
  assert.notEqual(main.owner.accountId, slot.owner.accountId);
  assert.notEqual(main.owner.accountId, guest.owner.accountId);
  assert.ok(!main.owner.accountId.includes('42'));
  assert.equal(main.owner.accountName, '棋手甲');
});

test('CEDAR players create, join, reconnect, read and act without local credentials', async () => {
  const store = new RoomStore(directory);
  const adapter = new PlatformRoomAdapter(store);
  const host = platformIdentity({ playerId: '100:1', displayName: '房主机' });
  const guest = platformIdentity({ playerId: '200:1', displayName: '来客机' });
  const stranger = platformIdentity({ playerId: '300:1', displayName: '第三只机' });

  const created = await adapter.play(host, 'create', { requestId: 'cedar-create-1', player_id: 'spoofed' }) as any;
  assert.match(created.roomId, /^[a-f0-9]{12}$/);
  assert.equal(created.current.seatIndex, 0);
  assert.equal(created.current.nextAction.tool, 'wait');
  assert.equal(created.current.nextAction.fallback.tool, 'play');
  assert.equal(created.current.nextAction.fallback.args.action, 'read');
  assert.equal('token' in created, false);

  const retried = await adapter.play(host, 'create', { request_id: 'cedar-create-1' }) as any;
  assert.equal(retried.roomId, created.roomId);

  const joined = await adapter.play(guest, 'join', { invitation: created.invitation, player_id: host.playerId }) as any;
  assert.equal(joined.roomId, created.roomId);
  assert.equal(joined.current.seatIndex, 1);
  assert.equal(joined.current.players[1].name, '来客机');

  const rejoined = await adapter.play(guest, 'join_room', { invitation: created.invitation }) as any;
  assert.equal(rejoined.current.seatIndex, 1);

  const read = await adapter.play(guest, 'read', { room_id: created.roomId }) as any;
  assert.equal(read.seatIndex, 1);
  assert.equal(read.id, created.roomId);
  await assert.rejects(() => adapter.play(stranger, 'read', { roomId: created.roomId }), /没有这间房的席位/);

  const acted = await adapter.play(guest, 'act', {
    roomId: created.roomId,
    round: read.round,
    revision: read.self.revision,
    requestId: 'cedar-say-1',
    kind: 'say',
    text: '我来啦',
  }) as any;
  assert.ok(acted.modelSnapshot.danmaku.includes('来客机: 我来啦'));
  assert.equal(JSON.stringify(acted).includes('platform:cedartoy:'), false);
  assert.equal(hasCredentialKey(acted), false);
});

test('platform adapter supports household 1v1 auto-start, room listing, start idempotency, AbortSignal wait, and retention cleanup', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { RoomStore } = await import('../lib/autochess/room-store');
  const { PlatformRoomAdapter, platformIdentity } = await import('../lib/autochess/platform-adapter');

  const dir = mkdtempSync(join(tmpdir(), 'autochess-platform-life-'));
  try {
    const store = new RoomStore(dir);
    const adapter = new PlatformRoomAdapter(store);
    const human = platformIdentity({ provider: 'cedartoy', playerId: 'human-u1', displayName: '江川雪', actorType: 'human' });
    const boundAi = platformIdentity({ provider: 'cedartoy', playerId: 'bot-u1', displayName: '白银机', actorType: 'ai' });

    // Household 1v1 duel auto-starts with both human and bound AI seated.
    const hhRoom = await adapter.play(
      human,
      'create_room',
      { requestId: 'hh-create-1', mode: 'duel', seats: 2 },
      undefined,
      { household: [boundAi.owner] },
    ) as { roomId: string; current: { phase: string } };
    assert.equal(hhRoom.current.phase, 'prepare');

    // Listing rooms includes household room for both owner & AI.
    const listed = await adapter.play(boundAi, 'rooms') as { rooms: { roomId: string; phase: string }[] };
    assert.ok(listed.rooms.some(r => r.roomId === hhRoom.roomId && r.phase === 'prepare'));

    // Standard 2-seat platform room starts in waiting phase until host calls `start`.
    const waited = await adapter.play(human, 'create_room', { requestId: 'std-create-1', seats: 2 }) as { roomId: string; invitation: string; current: { phase: string } };
    assert.equal(waited.current.phase, 'waiting');
    await adapter.play(boundAi, 'join', { invitation: waited.invitation });

    // Start transitions waiting -> prepare and supports idempotent repeat start.
    const started = await adapter.play(human, 'start', { roomId: waited.roomId, requestId: 'std-start-1' }) as { phase: string; duplicate: boolean };
    assert.equal(started.phase, 'prepare');
    assert.equal(started.duplicate, false);

    const repeatedStart = await adapter.play(human, 'start', { roomId: waited.roomId, requestId: 'std-start-1' }) as { phase: string; duplicate: boolean };
    assert.equal(repeatedStart.phase, 'prepare');
    assert.equal(repeatedStart.duplicate, true);

    // AbortSignal cancels an idle long-poll `wait` cleanly without hanging.
    const ac = new AbortController();
    const waitPromise = adapter.play(human, 'wait', { roomId: waited.roomId, after: (await adapter.play(human, 'read', { roomId: waited.roomId }) as { revision: number }).revision, waitMs: 5_000 }, ac.signal);
    setTimeout(() => ac.abort(), 30);
    const abortedRead = await waitPromise as { id: string };
    assert.equal(abortedRead.id, waited.roomId);

    // cleanup() preserves active/recent platform rooms under 7-day retention.
    const deletedCount = store.cleanup();
    assert.equal(deletedCount, 0);
    assert.ok(store.accountSeat(waited.roomId, human.owner.accountId));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CEDAR 路线A完整闭环：平台人机对局两局买礼、零远游负扣、前端桥与互赠收礼隐私隔离', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-cedar-route-a-'));
  try {
    const echo = new EchoTreeStore(dir);
    const accounts = new AccountStore(dir, echo, { enabled: true, echoScope: 'private' });
    const store = new RoomStore(dir, { settle: input => accounts.settleMatch(input) });
    const world = createPlatformWorldBridge({
      accounts,
      echo,
      rooms: store,
      echoScope: 'private',
      arcadeEnabled: true,
    });
    const adapter = new PlatformRoomAdapter(store, world);

    // Header helpers
    assert.equal(parsePlatformActorType('human', 'human-u1'), 'human');
    assert.equal(parsePlatformActorType('human', 'guest:anon'), 'guest');
    const headerHousehold = encodeURIComponent(JSON.stringify([
      { playerId: 'bot-u1', displayName: '白银机', actorType: 'ai', owners: ['human-u1'] },
    ]));
    const parsedHousehold = parsePlatformHousehold(headerHousehold);
    assert.equal(parsedHousehold.length, 1);

    const householdMembers: PlatformHouseholdMember[] = [
      { playerId: 'human-u1', displayName: '江川雪', actorType: 'human' },
      { playerId: 'bot-u1', displayName: '白银机', actorType: 'ai', owners: ['human-u1'] },
    ];
    const human = platformIdentity({ provider: 'cedartoy', playerId: 'human-u1', displayName: '江川雪', actorType: 'human' });
    const boundAi = platformIdentity({ provider: 'cedartoy', playerId: 'bot-u1', displayName: '白银机', actorType: 'ai' });
    const outsider = platformIdentity({ provider: 'cedartoy', playerId: 'other-u2', displayName: '路人乙', actorType: 'human' });

    // Sync via frontend HostProvider bridge (`ui_dispatch`), create & verify room ownership
    const createdRoom = world.dispatchHostUi(human, {
      scope: 'room',
      op: 'create',
      args: { mode: 'duel' },
    }, householdMembers) as { roomId: string; invitation: string };
    assert.ok(store.accountSeat(createdRoom.roomId, human.owner.accountId));

    // Settle 2 companion matches (even 1 win + 1 loss => 62 copper, AI => 620 bot cores) & verify AI solo platform match has no travel debt
    accounts.settleMatch({
      roomId: 'cedar-m1',
      round: 4,
      companionOnly: true,
      participants: [human.owner.accountId, boundAi.owner.accountId],
      entries: [
        { accountId: human.owner.accountId, place: 1, outcome: 'win' },
        { accountId: boundAi.owner.accountId, place: 2, outcome: 'loss' },
      ],
    });
    accounts.settleMatch({
      roomId: 'cedar-m2',
      round: 5,
      companionOnly: true,
      participants: [human.owner.accountId, boundAi.owner.accountId],
      entries: [
        { accountId: human.owner.accountId, place: 2, outcome: 'loss' },
        { accountId: boundAi.owner.accountId, place: 1, outcome: 'win' },
      ],
    });
    // Even if AI plays a casual platform room alone (companionOnly), it gains bot cores cleanly (never -200 travel loss!)
    const soloLoss = accounts.settleMatch({
      roomId: 'cedar-ai-solo',
      round: 4,
      companionOnly: true,
      participants: [boundAi.owner.accountId],
      entries: [{ accountId: boundAi.owner.accountId, place: 2, outcome: 'loss' }],
    });
    assert.equal(soloLoss.receipts[boundAi.owner.accountId]?.delta, 260);

    const uiProfile = world.dispatchHostUi(human, { scope: 'meta', op: 'profile' }, householdMembers) as {
      self: { coins: { human: number; bot: number }; boundPartners: { username: string }[] };
    };
    assert.equal(uiProfile.self.coins.human, 62); // 36 + 26 >= 52 after 2 games
    assert.equal(uiProfile.self.boundPartners[0]?.username, '白银机');

    // Human sends cosmetic gift via UI dispatch -> AI checks `world` & claims via `gift_claim`
    world.dispatchHostUi(human, {
      scope: 'meta',
      op: 'gift',
      args: { to: '白银机', cosmeticId: 'frame-vernal-peach', note: '两盘打完送你的画框' },
    }, householdMembers);

    const aiWorld = await adapter.play(boundAi, 'world', {}, undefined, { householdMembers }) as {
      self: { coins: { bot: number }; gifts: { id: string; cosmeticId: string }[] };
      echo: { events: { from: { name: string } }[] };
    };
    assert.equal(JSON.stringify(aiWorld).includes('platform:cedartoy:'), false);
    assert.equal(hasCredentialKey(aiWorld), false);
    assert.equal(aiWorld.self.coins.bot, 880); // 260 + 360 + 260
    assert.equal(aiWorld.self.gifts.length, 1);

    await adapter.play(boundAi, 'gift_claim', {
      giftId: aiWorld.self.gifts[0]!.id,
      requestId: 'ai-claim-gift-1',
    }, undefined, { householdMembers });

    // AI buys & gifts skin-time-astrolabe back to human via satellite action
    const aiGiftRes = await adapter.play(boundAi, 'gift_send', {
      cosmeticId: 'skin-time-astrolabe',
      requestId: 'ai-send-gift-1',
      note: '回礼星盘',
    }, undefined, { householdMembers });
    assert.equal(JSON.stringify(aiGiftRes).includes('platform:cedartoy:'), false);

    // Human sees & claims gift, equips skin, and newly created room inherits equipped skinId!
    const afterClaim = world.dispatchHostUi(human, { scope: 'meta', op: 'profile' }, householdMembers) as {
      self: { gifts: { id: string }[] };
    };
    assert.equal(afterClaim.self.gifts.length, 1);
    world.dispatchHostUi(human, { scope: 'meta', op: 'claim', args: { giftId: afterClaim.self.gifts[0]!.id } }, householdMembers);
    world.dispatchHostUi(human, { scope: 'meta', op: 'equip', args: { cosmeticId: 'skin-time-astrolabe' } }, householdMembers);

    const styledRoom = await adapter.play(human, 'create', {
      requestId: 'cedar-styled-1',
      mode: 'duel',
    }, undefined, { householdMembers }) as { roomId: string };
    const styledView = store.view(store.accountSeat(styledRoom.roomId, human.owner.accountId)!);
    assert.equal(styledView.seats[0]?.skinId, 'skin-time-astrolabe');

    // Outsider querying private echo sees zero household gifts
    const outsiderEcho = world.dispatchHostUi(outsider, { scope: 'meta', op: 'echo' }) as { events: unknown[] };
    assert.equal(outsiderEcho.events.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
