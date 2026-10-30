import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AccountStore } from '../lib/accounts/account-store';
import { createRoomMcp } from '../lib/autochess/room-mcp';
import { RoomStore } from '../lib/autochess/room-store';
import { WHEEL_DRAFT } from '../lib/meta/wheel';

test('human-to-machine wheel gifts expose one flat, retry-safe claim action', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'autochess-gift-claim-'));
  let client: Client | undefined;
  let server: ReturnType<typeof createRoomMcp> | undefined;
  try {
    const rules = structuredClone(WHEEL_DRAFT);
    rules.redemptions = [{ prizeId: 'olive', points: 2 }];
    const accounts = new AccountStore(directory, undefined, {
      enabled: true,
      rules,
      random: () => 0,
    });
    const human = accounts.register('Asteroid', 'password-123');
    const invitation = accounts.issueAiInvite(human.token);
    const machine = accounts.registerAiWithInvite(
      invitation.invite,
      'Alex',
      'password-456',
    );
    const act = (token: string, action: string, extra: object = {}) =>
      accounts.wheelAction(token, {
        action,
        requestId: randomUUID(),
        revision: accounts.wheelView(token).state.revision,
        ...extra,
      });

    act(human.token, 'start');
    act(human.token, 'fill', { count: 2 });
    act(human.token, 'redeem', { prizeId: 'olive' });
    const outgoing = accounts.wheelView(human.token).state.prizes[0]!;
    act(human.token, 'gift', {
      prizeId: outgoing.id,
      to: machine.account.username,
      note: '第一份奖励，送给你',
    });

    const incoming = accounts.wheelView(machine.token).state.prizes[0]!;
    assert.equal(incoming.spec.name, '灵橄 · 衔春');
    assert.deepEqual(incoming.claimAction, {
      tool: 'claim_gift',
      args: { giftId: incoming.id },
      fill: ['accountToken'],
    });

    server = createRoomMcp(new RoomStore(join(directory, 'rooms')), 'player', {
      claimGift: (token, giftId, requestId) =>
        accounts.claimGift(token, giftId, requestId),
      registerAi: () => {
        throw new Error('unused');
      },
      loginAi: () => {
        throw new Error('unused');
      },
      ownerForToken: () => undefined,
    });
    client = new Client({ name: 'gift-claim-regression', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    assert.deepEqual(
      (await client.listTools()).tools.map((tool) => tool.name),
      ['join_room', 'read_turn', 'claim_gift', 'act'],
    );
    const response = await client.callTool({
      name: incoming.claimAction!.tool,
      arguments: { accountToken: machine.token, ...incoming.claimAction!.args },
    });
    assert.equal(response.isError, undefined);
    const first = JSON.parse(
      (response.content as { type: 'text'; text: string }[])[0]!.text,
    );
    const replay = accounts.claimGift(machine.token, incoming.id);
    assert.equal(first.claimed, true);
    assert.equal(replay.claimed, true);
    assert.equal(replay.replayed, true);
    assert.ok(accounts.selfAccount(machine.token).owned.includes('frame-revival-olive'));
    assert.equal(accounts.wheelView(machine.token).state.prizes[0]!.status, 'used');
  } finally {
    await client?.close();
    await server?.close();
    assert.ok(directory.startsWith(join(tmpdir(), 'autochess-gift-claim-')));
    rmSync(directory, { recursive: true, force: true });
  }
});
