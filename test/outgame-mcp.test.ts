import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AccountStore } from '../lib/accounts/account-store';
import { GameConfigStore } from '../lib/accounts/config-store';
import { EchoTreeStore } from '../lib/accounts/echo-tree-store';
import { createOutgameMcp } from '../lib/accounts/outgame-mcp';
import { createRoomMcp } from '../lib/autochess/room-mcp';
import { RoomStore } from '../lib/autochess/room-store';
import { DEFAULT_GAME_CONFIG } from '../lib/meta/game-config';

function parseToolJson(result: Awaited<ReturnType<Client['callTool']>>) {
  assert.notEqual(result.isError, true, `Expected non-error MCP result, got: ${JSON.stringify(result)}`);
  const first = (result.content as { type: string; text?: string }[])[0];
  return JSON.parse(first?.text ?? '{}');
}

async function connectOutgame(accounts: AccountStore, echo: EchoTreeStore) {
  const server = createOutgameMcp({ accounts, echo });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-outgame-mcp', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function connectPlayerRoom(accounts: AccountStore, echo: EchoTreeStore, roomsDir: string) {
  const rooms = new RoomStore(roomsDir);
  const server = createRoomMcp(rooms, 'player', {
    arcade: (token, command) => (command === undefined ? accounts.arcadeView(token) : accounts.arcadeAction(token, command)),
    giftCatalog: (token, to) => accounts.giftCatalog(token, to),
    claimGift: (token, giftId, requestId) => accounts.claimGift(token, giftId, requestId),
    registerAi: (invite, name, password) => accounts.registerAiWithInvite(invite, name, password),
    loginAi: (username, password) => accounts.loginAi(username, password),
    ownerForToken: token => {
      const me = accounts.authenticate(token);
      return me?.isAi ? { actorType: 'ai' as const, accountId: me.id, accountName: me.username } : undefined;
    },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-player-mcp', version: '1.0.0' });
  await client.connect(clientTransport);
  void echo;
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

test('outgame & room MCP expose 3-tier cosmetics, allow tier/astrolabe purchases, and reflect GameConfigStore live edits', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-outgame-mcp-'));
  const configStore = new GameConfigStore(dir);
  try {
    const echo = new EchoTreeStore(dir);
    const accounts = new AccountStore(dir, echo, { enabled: true, echoScope: 'public' });
    const human = accounts.register('小雪', 'password123');
    const invite = accounts.issueAiInvite(human.token);
    const ai = accounts.registerAiWithInvite(invite.invite, '小狐狸', 'ai-pass-123');

    accounts.grantCoins(ai.account.id, 'bot', 5000);
    accounts.grantCoins(human.account.id, 'human', 500);

    const outgame = await connectOutgame(accounts, echo);
    const player = await connectPlayerRoom(accounts, echo, dir);

    try {
      // 1. Outgame read_world exposes tier metadata & 3-tier prices for AI & Human
      const world = parseToolJson(await outgame.client.callTool({
        name: 'read_world',
        arguments: { accountToken: ai.token },
      }));
      assert.ok(world.catalog.tiers.t1 && world.catalog.tiers.t2 && world.catalog.tiers.t3);
      const byId = new Map<string, { id: string; name: string; kind: string; tier: string; price: number; acquisition: string }>(
        world.catalog.cosmetics.map((c: { id: string; name: string; kind: string; tier: string; price: number; acquisition: string }) => [c.id, c]),
      );
      const rose = byId.get('skin-rose-court');
      assert.equal(rose?.name, '玫瑰古堡');
      assert.equal(rose?.tier, 't1');
      assert.equal(rose?.price, 1800);
      assert.equal(rose?.acquisition, 'shop');
      assert.equal(byId.get('skin-revival')?.tier, 't2');
      assert.equal(byId.get('skin-revival')?.acquisition, 'default');
      assert.equal(byId.get('skin-revival')?.price, 0);
      assert.equal(byId.get('skin-lotus-pond')?.tier, 't2');
      assert.equal(byId.get('skin-lotus-pond')?.price, 1080);
      assert.equal(byId.get('skin-time-astrolabe')?.tier, 't3');
      assert.equal(byId.get('skin-time-astrolabe')?.acquisition, 'shop');
      assert.equal(byId.get('skin-time-astrolabe')?.price, 520);

      // 2. Default skin skin-revival cannot be purchased or gifted via MCP
      const badBuy = await outgame.client.callTool({
        name: 'submit_purchase',
        arguments: { accountToken: ai.token, cosmeticId: 'skin-revival' },
      });
      assert.equal(badBuy.isError, true);
      const badGift = await outgame.client.callTool({
        name: 'send_gift',
        arguments: { accountToken: ai.token, cosmeticId: 'skin-revival' },
      });
      assert.equal(badGift.isError, true);

      // 3. Bot purchases skin-time-astrolabe (异色, Tier 3) & skin-lotus-pond (Tier 2) over MCP
      const buyAstrolabe = parseToolJson(await outgame.client.callTool({
        name: 'submit_purchase',
        arguments: { accountToken: ai.token, cosmeticId: 'skin-time-astrolabe' },
      }));
      assert.equal(buyAstrolabe.ok, true);
      assert.equal(buyAstrolabe.wallet.bot, 5000 - 520);
      assert.ok(buyAstrolabe.owned.includes('skin-time-astrolabe'));

      const buyLotus = parseToolJson(await outgame.client.callTool({
        name: 'submit_purchase',
        arguments: { accountToken: ai.token, cosmeticId: 'skin-lotus-pond' },
      }));
      assert.equal(buyLotus.wallet.bot, 5000 - 520 - 1080);

      // 3. Hot-update config via GameConfigStore -> MCP read_world, read_turn, and play_arcade adapt immediately
      const next = structuredClone(DEFAULT_GAME_CONFIG);
      next.cosmetics.find(c => c.id === 'skin-rose-court')!.humanPrice = 240;
      next.cosmetics.find(c => c.id === 'skin-rose-court')!.botPrice = 2400;
      next.economy.exchangeBotPerHuman = 14;
      next.arcade.starterTickets = 7;
      next.arcade.ticketBotPrice = 95;
      configStore.save(next);

      const updatedWorld = parseToolJson(await outgame.client.callTool({
        name: 'read_world',
        arguments: { accountToken: human.token },
      }));
      assert.equal(updatedWorld.exchange.botPerHuman, 14);
      const humanItems = new Map<string, { price: number; tier: string }>(
        updatedWorld.catalog.cosmetics.map((c: { id: string; price: number; tier: string }) => [c.id, c]),
      );
      assert.equal(humanItems.get('skin-rose-court')?.price, 240);
      assert.equal(humanItems.get('skin-rose-court')?.tier, 't1');

      const giftCat = parseToolJson(await player.client.callTool({
        name: 'read_turn',
        arguments: { accountToken: ai.token, giftCatalog: true },
      }));
      const roseGift = giftCat.giftCatalog.options.find((o: { id: string }) => o.id === 'skin-rose-court');
      assert.equal(roseGift.price, 2400);
      assert.equal(roseGift.tier, 't1');
      assert.equal(
        giftCat.giftCatalog.options.some((o: { id: string }) => o.id === 'skin-revival'),
        false,
      );

      // 4. play_arcade MCP tool uses live starterTickets (7) and ticketBotPrice (95)
      const started = parseToolJson(await outgame.client.callTool({
        name: 'play_arcade',
        arguments: { accountToken: ai.token, action: 'start', requestId: 'mcp-arcade-start-1', revision: 0 },
      }));
      assert.equal(started.state.tickets, 7);

      const boughtTickets = parseToolJson(await player.client.callTool({
        name: 'act',
        arguments: {
          accountToken: ai.token,
          kind: 'arcade',
          revision: started.state.revision,
          requestId: 'mcp-arcade-buy-tix-1',
          arcade: { action: 'buy_tickets', count: 2 },
        },
      }));
      assert.equal(boughtTickets.state.tickets, 9);
      assert.equal(boughtTickets.wallet.bot, (5000 - 520 - 1080) - 2 * 95);
    } finally {
      await outgame.close();
      await player.close();
    }
  } finally {
    configStore.reset('all');
    rmSync(dir, { recursive: true, force: true });
  }
});
