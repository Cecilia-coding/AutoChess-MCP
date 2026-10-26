import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { decodePlatformDisplayName, PlatformRoomAdapter, platformIdentity, verifyPlatformSecret } from '../lib/autochess/platform-adapter';
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
