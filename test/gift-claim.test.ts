import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AccountStore } from '../lib/accounts/account-store';
import { EchoTreeStore } from '../lib/accounts/echo-tree-store';
import { RoomStore } from '../lib/autochess/room-store';
import { createRoomMcp } from '../lib/autochess/room-mcp';

async function connectMcp(accounts: AccountStore, echoTree: EchoTreeStore) {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-gift-rooms-'));
  const rooms = new RoomStore(dir, { settle: input => accounts.settleMatch(input) });
  const server = createRoomMcp(rooms, 'player', {
    arcade: (token, command) => command === undefined ? accounts.arcadeView(token) : accounts.arcadeAction(token, command),
    claimGift: (token, giftId, requestId) => accounts.claimGift(token, giftId, requestId),
    giftLedger: (token, query) => accounts.giftLedger(token, query),
    echo: (token, query) => {
      const me = accounts.selfAccount(token);
      const viewerIds = accounts.arcadeOptions.echoScope === 'private'
        ? [me.id, ...me.boundPartners.map(p => p.id)]
        : undefined;
      const limit = query.limit ?? 20;
      const page = query.afterId === undefined
        ? { events: echoTree.recent(limit, viewerIds), nextId: echoTree.latestId(viewerIds), hasMore: false }
        : echoTree.pageAfter(query.afterId, limit, viewerIds);
      return { echo: page };
    },
    accountStatus: (token, withGifts, to) => {
      const me = accounts.selfAccount(token);
      return {
        account: { id: me.id, username: me.username, isAi: me.isAi, ownerName: me.ownerName },
        boundPartners: me.boundPartners,
        wallet: me.coins,
        record: me.record,
        ...(withGifts ? { giftCatalog: accounts.giftCatalog(token, to) } : {}),
      };
    },
    giftCatalog: (token, to) => accounts.giftCatalog(token, to),
    giftCosmeticForAccount: (token, requestId, cosmeticId, note, to) =>
      accounts.giftCosmeticForAccount(token, requestId, cosmeticId, note, to),
    registerAi: (invite, name, password) => accounts.registerAiWithInvite(invite, name, password),
    loginAi: (username, password) => accounts.loginAi(username, password),
    ownerForToken: token => {
      const me = accounts.authenticate(token);
      return me?.isAi ? { actorType: 'ai' as const, accountId: me.id, accountName: me.username } : undefined;
    },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    cleanup: async () => {
      await client.close();
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function parseToolJson(result: Awaited<ReturnType<Client['callTool']>>) {
  const first = (result.content as { type: string; text?: string }[])[0];
  return JSON.parse(first?.text ?? '{}');
}

test('symmetric human <-> bound AI shop gifting and unified inbox/ledger', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-sym-gift-'));
  try {
    const echo = new EchoTreeStore(dir);
    const accounts = new AccountStore(dir, echo, { enabled: true, echoScope: 'public' });
    const human = accounts.register('江川雪', 'password123');
    const invite = accounts.issueAiInvite(human.token);
    const ai = accounts.registerAiWithInvite(invite.invite, '小银', 'ai-password-123');

    // Fund human with copper (three companion wins => 120 copper), then subsidize 52 copper (at 1:10 => 520 bot cores) so both afford a 52 / 520 shop gift.
    for (const roomId of ['room-fund-1', 'room-fund-2', 'room-fund-3']) {
      accounts.settleMatch({
        roomId,
        round: 4,
        participants: [human.account.id, ai.account.id],
        entries: [
          { accountId: human.account.id, place: 1, outcome: 'win' },
          { accountId: ai.account.id, place: 2, outcome: 'loss' },
        ],
      });
    }

    // Direct subsidize: human spends 52 copper (68 left >= 52 shop price) -> AI gets 520 bot cores (>= 520 shop price).
    accounts.subsidize(human.token, ai.account.id, 52, 'sub-req-1234');

    // 1. Human gifts a shop cosmetic to bound AI.
    const catalogForHuman = accounts.giftCatalog(human.token, ai.account.id);
    const pick = catalogForHuman.options.find(opt => opt.id !== 'board-default' && opt.available)!;
    const sentFromHuman = accounts.giftCosmetic(human.token, ai.account.id, pick.id, '送小银的新棋盘');
    assert.equal(sentFromHuman.toName, ai.account.username);

    // Duplicate gift while pending in recipient's inbox is blocked.
    assert.throws(() => accounts.giftCosmetic(human.token, ai.account.id, pick.id), /对方已经有这件外观/);

    // Both human and AI see the gift in their unified ledger; AI sees it in pending gifts.
    const humanLedger = accounts.giftLedger(human.token, { direction: 'sent' });
    assert.equal(humanLedger.entries.length, 1);
    assert.equal(humanLedger.entries[0]!.to.id, ai.account.id);

    const aiSelfBeforeClaim = accounts.selfAccount(ai.token);
    assert.equal(aiSelfBeforeClaim.gifts.length, 1);

    // 2. AI claims the gift from human.
    const claimed = accounts.claimGifts(ai.token, sentFromHuman.gift.id);
    assert.equal(claimed.claimed.length, 1);
    assert.ok(claimed.self.owned.includes(pick.id));

    // 3. AI gifts another shop cosmetic back to its human owner.
    const catalogForAi = accounts.giftCatalog(ai.token);
    const secondPick = catalogForAi.options.find(opt => opt.id !== pick.id && opt.id !== 'board-default' && opt.available)!;
    const sentFromAi = accounts.giftCosmetic(ai.token, undefined, secondPick.id, '回礼给主人');
    assert.equal(sentFromAi.toName, human.account.username);
    assert.equal(accounts.selfAccount(human.token).gifts.length, 1);

    const aiLedgerAll = accounts.giftLedger(ai.token, { direction: 'all' });
    assert.equal(aiLedgerAll.entries.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('human-to-machine arcade prizes expose one flat, retry-safe claim_gift MCP action', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-arcade-claim-'));
  // Scripted PRNG:
  // 1) 0.998 -> scratchcard jackpot tier (weight sum 1000, last 5 is jackpot => 20x + 1.0 cosmeticBaseChance)
  // 2) 0.1 -> luckySymbol index
  // 3..N) shuffle / decoys -> 0.1
  // drop roll (< 1.0) + cosmetic drop pick -> 0.1
  const scripted = [0.998, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
  let cursor = 0;
  const echoTree = new EchoTreeStore(dir);
  const accounts = new AccountStore(dir, echoTree, {
    enabled: true,
    echoScope: 'public',
    random: () => scripted[Math.min(cursor++, scripted.length - 1)]!,
  });
  const human = accounts.register('主人测试', 'password123');
  const invite = accounts.issueAiInvite(human.token);
  const ai = accounts.registerAiWithInvite(invite.invite, '糖糖机', 'ai-password-123');

  const mcp = await connectMcp(accounts, echoTree);
  try {
    // Claim starter tickets & play scratchcard to deterministically hit a cosmetic prize drop.
    let view = accounts.arcadeAction(human.token, { action: 'start', requestId: 'arcade-start-1', revision: 0 });
    view = accounts.arcadeAction(human.token, {
      action: 'play',
      gameId: 'scratchcard',
      stakeId: 'small',
      payMode: 'ticket',
      autoCashOut: true,
      requestId: 'arcade-play-1',
      revision: view.state.revision,
    });
    assert.equal(view.state.prizes.length, 1);
    const outgoing = view.state.prizes[0]!;

    // Human gifts the exclusive arcade cosmetic prize to their bound AI.
    accounts.arcadeAction(human.token, {
      action: 'gift',
      prizeId: outgoing.id,
      to: ai.account.id,
      note: '给你留的游乐摊稀有限定礼',
      requestId: 'arcade-gift-1',
      revision: view.state.revision,
    });

    // AI reads its arcade state via MCP and sees the flat claimAction.
    const readRes = parseToolJson(await mcp.client.callTool({
      name: 'read_turn',
      arguments: { accountToken: ai.token, arcade: true },
    }));
    const incoming = readRes.state.prizes[0];
    assert.equal(incoming.status, 'pending');
    assert.equal(incoming.claimAction.tool, 'claim_gift');
    assert.deepEqual(incoming.claimAction.args, { giftId: incoming.id });

    // AI claims the prize using claim_gift twice (second call safely idempotent).
    const firstClaim = parseToolJson(await mcp.client.callTool({
      name: 'claim_gift',
      arguments: { accountToken: ai.token, giftId: incoming.id },
    }));
    assert.equal(firstClaim.claimed, true);
    assert.equal(firstClaim.source, 'arcade');

    const secondClaim = parseToolJson(await mcp.client.callTool({
      name: 'claim_gift',
      arguments: { accountToken: ai.token, giftId: incoming.id },
    }));
    assert.equal(secondClaim.replayed, true);
    assert.equal(accounts.arcadeView(ai.token).state.prizes[0]!.status, 'used');
  } finally {
    await mcp.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});
