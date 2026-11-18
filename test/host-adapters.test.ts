import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountStore, type AccountFile } from '../lib/accounts/account-store';
import { EchoTreeStore } from '../lib/accounts/echo-tree-store';
import { ARCADE_STARTER_TICKETS } from '../lib/meta/arcade';
import { assetUrl, configureAssetBase, normalizeBasePath } from '../lib/meta/asset-url';
import {
  AUTOCHESS_ADAPTER_CAPABILITIES,
  AUTOCHESS_HOST_ADAPTER_VERSION,
  AUTOCHESS_PLATFORM_PROTOCOL_VERSION,
  CEDAR_HOST_FEATURES,
  resolveHostConfig,
} from '../lib/meta/host-config';
import { DEFAULT_GAME_CONFIG } from '../lib/meta/game-config';
import { settlementDelta } from '../lib/meta/economy';
import { newRequestId } from '../lib/autochess/request-id';
import { roomPreparationUI, waitingStartHint } from '../components/autochess/room-ui-state';

test('assetUrl & resolveHostConfig honor subpath bases without double slashes', () => {
  assert.equal(normalizeBasePath('/autochess/static///'), '/autochess/static');
  assert.equal(assetUrl('/pixel/ui/frame.png', '/autochess/static/'), '/autochess/static/pixel/ui/frame.png');
  assert.equal(assetUrl('https://cdn.example.com/a.png', '/sub'), 'https://cdn.example.com/a.png');
  assert.equal(assetUrl('data:image/png;base64,abc', '/sub'), 'data:image/png;base64,abc');
  configureAssetBase('/host-subpath');
  assert.equal(assetUrl('/sfx/hit.wav'), '/host-subpath/sfx/hit.wav');
  configureAssetBase('');

  const host = resolveHostConfig({
    assetBase: '/cedar-assets/',
    features: { echoScope: 'private', leaveMode: 'preserve-seat', embeddedContainer: true },
  });
  assert.equal(host.assetBase, '/cedar-assets');
  assert.equal(host.features.echoScope, 'private');
  assert.equal(host.features.leaveMode, 'preserve-seat');
  assert.equal(host.features.embeddedContainer, true);
  assert.equal(host.routes.arcade, '/autochess/arcade');
  assert.equal(AUTOCHESS_HOST_ADAPTER_VERSION, '2.1.0');
  assert.equal(AUTOCHESS_PLATFORM_PROTOCOL_VERSION, 'cedartoy-satellite-v1');
  assert.ok(AUTOCHESS_ADAPTER_CAPABILITIES.includes('arcade-embedded'));
  assert.ok(AUTOCHESS_ADAPTER_CAPABILITIES.includes('game-config-store'));
});

test('newRequestId produces URL-safe request IDs even when randomUUID is absent', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    const id1 = newRequestId();
    assert.match(id1, /^[a-zA-Z0-9_-]{8,80}$/);

    // Simulate insecure HTTP context where crypto.randomUUID may be undefined.
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues },
    });
    const fallbackId = newRequestId('req');
    assert.match(fallbackId, /^req-[a-zA-Z0-9_-]{8,76}$/);
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'crypto', originalDescriptor);
  }
});

test('roomPreparationUI keeps waiting rooms locked from shop/draft offers until match start', () => {
  const selfReadyFalse = { hp: 30, ready: false } as Parameters<typeof roomPreparationUI>[0]['self'];
  const selfReadyTrue = { hp: 30, ready: true } as Parameters<typeof roomPreparationUI>[0]['self'];

  const wait = roomPreparationUI({ phase: 'waiting', self: selfReadyFalse }, false, false);
  assert.deepEqual(wait, { editable: false, offers: false, shop: false });

  const prep = roomPreparationUI({ phase: 'prepare', self: selfReadyFalse }, false, false);
  assert.deepEqual(prep, { editable: true, offers: true, shop: true });

  const prepReady = roomPreparationUI({ phase: 'prepare', self: selfReadyTrue }, false, false);
  assert.deepEqual(prepReady, { editable: false, offers: true, shop: true });

  const finished = roomPreparationUI({ phase: 'finished', self: selfReadyFalse }, false, false);
  assert.deepEqual(finished, { editable: false, offers: false, shop: false });

  assert.match(waitingStartHint(true, true), /补路人机/);
  assert.match(waitingStartHint(false, true), /等待房主开局/);
});

test('EchoTreeStore filters private echo events by household audience and supports echoScope=none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-echo-scope-'));
  try {
    const echo = new EchoTreeStore(dir);
    echo.publish({
      id: 'pub-1',
      kind: 'gift',
      scope: 'public',
      at: 1000,
      from: { id: 'a1', name: 'A1', isAi: false },
      to: { id: 'a2', name: 'A2', isAi: true },
      item: { id: 'skin-1', name: '棋盘一' },
    });
    echo.publish({
      id: 'priv-1',
      kind: 'gift',
      scope: 'private',
      audienceIds: ['h1', 'bot1'],
      at: 2000,
      from: { id: 'h1', name: '江川雪', isAi: false },
      to: { id: 'bot1', name: '专属机', isAi: true },
      item: { id: 'skin-2', name: '私密心意' },
    });

    // Outsider querying household feed sees ONLY public events, never another pair's private echo.
    const outsider = echo.recent(10, ['outsider']);
    assert.deepEqual(outsider.map(e => e.id), ['pub-1']);

    // Bound household sees both public and their own private echo, ordered newest_first.
    const household = echo.recent(10, ['h1', 'bot1']);
    assert.deepEqual(household.map(e => e.id), ['priv-1', 'pub-1']);

    // echoScope: 'none' on AccountStore publishes 0 echo events while still updating ledger & inbox.
    const silentDir = mkdtempSync(join(tmpdir(), 'autochess-echo-none-'));
    try {
      const silentEcho = new EchoTreeStore(silentDir);
      const store = new AccountStore(silentDir, silentEcho, { enabled: true, echoScope: 'none' });
      const human = store.register('静音主', 'password123');
      const inv = store.issueAiInvite(human.token);
      const ai = store.registerAiWithInvite(inv.invite, '静音机', 'password123');
      store.settleMatch({ roomId: 'r-mute-1', round: 5, entries: [{ accountId: human.account.id, place: 1, outcome: 'win' }] });
      store.settleMatch({ roomId: 'r-mute-2', round: 5, entries: [{ accountId: human.account.id, place: 1, outcome: 'win' }] });
      const cat = store.giftCatalog(human.token, ai.account.id);
      const giftable = cat.options.find(o => o.available)!;
      store.giftCosmetic(human.token, ai.account.id, giftable.id, '不上树');
      assert.equal(silentEcho.recent(10).length, 0);
      assert.equal(store.giftLedger(human.token).entries.length, 1);
    } finally {
      rmSync(silentDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AccountStore.platformRun bridges host identities transactionally and rolls back on write failure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-platform-run-'));
  try {
    let persisted: AccountFile = {
      version: 1,
      accounts: [],
      sessions: {},
      bindings: [],
      aiInvites: [],
      machineTickets: [],
      machineRequests: [],
      roomGiftActions: [],
      settledRooms: {},
      settlementReceipts: {},
      dailySettlement: {},
      subsidyActions: [],
      pendingEcho: [],
    };
    let shouldFail = false;
    const store = new AccountStore(dir, undefined, { enabled: true }, {
      read: () => persisted,
      write: data => {
        if (shouldFail) throw new Error('DB_WRITE_FAILED');
        persisted = structuredClone(data);
      },
    });

    const pHumanId = 'platform:cedartoy:' + 'a'.repeat(32);
    const pAiId = 'platform:cedartoy:' + 'b'.repeat(32);

    const view = store.platformRun(
      [
        { id: pHumanId, name: '江川雪', isAi: false },
        { id: pAiId, name: '星野机', isAi: true, owners: [pHumanId] },
      ],
      pHumanId,
      token => store.arcadeAction(token, { action: 'start', requestId: 'plat-start-1', revision: 0 }),
    );
    assert.equal(view.state.tickets, ARCADE_STARTER_TICKETS);
    assert.equal(persisted.accounts.length, 2);

    // Next transactional call fails during storage.write => in-memory state rolls back cleanly.
    shouldFail = true;
    assert.throws(() => store.platformRun(
      [
        { id: pHumanId, name: '江川雪改名', isAi: false },
        { id: pAiId, name: '星野机', isAi: true, owners: [pHumanId] },
      ],
      pHumanId,
      token => store.arcadeAction(token, {
        action: 'play',
        gameId: 'slot-machine',
        stakeId: 'small',
        payMode: 'ticket',
        requestId: 'plat-play-fail',
        revision: view.state.revision,
      }),
    ), /DB_WRITE_FAILED/);

    shouldFail = false;
    const afterRollback = store.platformRun(
      [{ id: pHumanId, name: '江川雪', isAi: false }],
      pHumanId,
      token => store.arcadeView(token),
    );
    assert.equal(afterRollback.state.tickets, ARCADE_STARTER_TICKETS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CEDAR_HOST_FEATURES and two-match gift economy support direct file-backed platformRun', () => {
  const host = resolveHostConfig({ features: CEDAR_HOST_FEATURES });
  assert.equal(host.features.authMode, 'platform');
  assert.equal(host.features.accounts, false);
  assert.equal(host.features.matchmaking, false);
  assert.equal(host.features.gifting, 'mutual-bound');
  assert.equal(host.features.echoScope, 'private');

  // Even 2 companion losses afford an entry-tier 52-copper gift/frame; 1 win + 1 loss gives 62 copper.
  assert.equal(DEFAULT_GAME_CONFIG.economy.companionHumanLoss * 2, 52);
  assert.equal(settlementDelta('companion', 'win', 'human') + settlementDelta('companion', 'loss', 'human'), 62);
  assert.equal(settlementDelta('companion', 'loss', 'bot') * 2, 520);

  const dir = mkdtempSync(join(tmpdir(), 'autochess-platform-file-'));
  try {
    const fileStore = new AccountStore(dir, undefined, { enabled: true });
    const hId = 'platform:cedartoy:' + 'c'.repeat(32);
    const self = fileStore.platformRun([{ id: hId, name: '江川雪', isAi: false }], hId, token => fileStore.selfAccount(token));
    assert.equal(self.username, '江川雪');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
