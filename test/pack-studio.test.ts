import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AccountStore } from '../lib/accounts/account-store';
import { EchoTreeStore } from '../lib/accounts/echo-tree-store';
import { createOutgameMcp } from '../lib/accounts/outgame-mcp';
import { createRoomMcp } from '../lib/autochess/room-mcp';
import { RoomStore } from '../lib/autochess/room-store';
import {
  analyzeStudioPack,
  analyzeStudioUnit,
  roleBaselineStats,
  simulateStudioDuel,
} from '../lib/pack-studio/balance';
import { ensureCustomPackRegistered } from '../lib/pack-studio/compiler';
import {
  buildExportPackPayload,
  parseImportedPackJson,
} from '../lib/pack-studio/browser-storage';
import { EphemeralStudioBridge } from '../lib/pack-studio/ephemeral-bridge';
import { validateCustomPack } from '../lib/pack-studio/schema';
import { STUDIO_ORIGINAL_SPRITES, STUDIO_SPRITES } from '../lib/pack-studio/sprites';
import { combatStats, uniqueTraitCounts } from '../lib/autochess/stats';
import { simulateBattle } from '../lib/autochess/combat';
import { activeTier, findTrait } from '../content/autochess/traits';
import { STUDIO_STARTER_OPTIONS, createPackFromStarter } from '../lib/pack-studio/templates';

function parseToolJson(result: Awaited<ReturnType<Client['callTool']>>) {
  const first = (result.content as { type: string; text?: string }[])[0];
  return JSON.parse(first?.text ?? '{}');
}

test('显式起步模板构造、校验与 JSON 导出导入闭环', () => {
  assert.equal(STUDIO_SPRTER_CHECK(), true);
  assert.equal(STUDIO_STARTER_OPTIONS.length, 3);

  const blank = createPackFromStarter({
    starterId: 'blank',
    id: 'pack-blank-1',
    title: '白纸棋谱',
    starGrowthPreset: 'classic_180',
    buffFlavor: 'classic',
  });
  const blankCheck = validateCustomPack(blank);
  assert.equal(blankCheck.validSchema, true);
  assert.equal(blankCheck.playable, false);
  assert.ok(blankCheck.playBlockers.some((msg) => msg.includes('4 枚棋子')));

  const compact = createPackFromStarter({
    starterId: 'compact-12',
    id: 'pack-compact-1',
    title: '星港 12 枚',
    starGrowthPreset: 'compact_165',
    buffFlavor: 'tech',
  });
  const compactCheck = validateCustomPack(compact);
  assert.equal(compactCheck.validSchema, true);
  assert.equal(compactCheck.playable, true);
  const compactAnalysis = analyzeStudioPack(compact);
  assert.equal(compactAnalysis.unitCount, 12);
  assert.equal(compactAnalysis.emptyMatrixCells, 0);

  const standard = createPackFromStarter({
    starterId: 'standard-20',
    id: 'pack-std-1',
    title: '江湖 20 枚',
    starGrowthPreset: 'high_cost_chase',
    buffFlavor: 'classic',
  });
  const stdCheck = validateCustomPack(standard);
  assert.equal(stdCheck.validSchema, true);
  assert.equal(stdCheck.playable, true);
  const stdAnalysis = analyzeStudioPack(standard);
  assert.equal(stdAnalysis.unitCount, 20);
  assert.equal(stdAnalysis.emptyMatrixCells, 0);

  // Export -> Import roundtrip
  const exported = buildExportPackPayload(compact);
  const imported = parseImportedPackJson(exported, 'pack-imported-1');
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.pack.id, 'pack-imported-1');
    assert.equal(imported.pack.units.length, 12);
    assert.equal(imported.pack.title, '星港 12 枚');
  }

  // Malformed JSON or broken trait ref must fail explicitly
  const badJson = parseImportedPackJson('{not valid json');
  assert.equal(badJson.ok, false);
  const broken = structuredClone(compact);
  broken.units[0]!.factions = ['non-existent-faction'];
  const brokenCheck = validateCustomPack(broken);
  assert.equal(brokenCheck.validSchema, false);
  assert.ok(brokenCheck.errors.some((e) => e.includes('不存在的阵营')));
});

function STUDIO_SPRTER_CHECK() {
  return STUDIO_ORIGINAL_SPRITES.length === 20 && STUDIO_SPRITES.length === 89;
}

test('自定义羁绊两枚同阵营上阵实时激活并作用于战斗面板', () => {
  const compact = createPackFromStarter({
    starterId: 'compact-12',
    id: 'pack-trait-live-check',
    title: '发条羁绊测试',
    starGrowthPreset: 'classic_180',
    buffFlavor: 'tech',
  });
  // Verify compact-12 and standard-20 exclusively use original st-* sprites
  for (const unit of compact.units) {
    assert.ok(unit.spriteId.startsWith('st-'), `应使用原创素材而非官包立绘: ${unit.spriteId}`);
  }
  const std = createPackFromStarter({
    starterId: 'standard-20',
    id: 'pack-std-sprite-check',
    title: '原创20枚',
    starGrowthPreset: 'classic_180',
    buffFlavor: 'classic',
  });
  assert.equal(new Set(std.units.map((u) => u.spriteId)).size, 20);
  for (const unit of std.units) {
    assert.ok(unit.spriteId.startsWith('st-'), `standard-20 应全量采用 st-* 原创像素偶: ${unit.spriteId}`);
  }

  const compiled = ensureCustomPackRegistered(compact);
  const clockUnits = compact.units.filter((u) => u.factions.includes('f-clock'));
  assert.ok(clockUnits.length >= 2);
  const c1 = { id: 't1', templateId: compiled.unitIdMap[clockUnits[0]!.id]!, star: 1 as const, localRow: 3, localCol: 1, itemIds: [] };
  const c2 = { id: 't2', templateId: compiled.unitIdMap[clockUnits[1]!.id]!, star: 1 as const, localRow: 3, localCol: 2, itemIds: [] };
  const clockTraitId = compiled.traitIdMap['f-clock']!;
  const trait = findTrait(clockTraitId)!;
  assert.ok(trait);
  const counts = uniqueTraitCounts([c1, c2]);
  assert.equal(counts.get(clockTraitId), 2);
  assert.equal(activeTier(trait, 2), 2);
  const soloHp = combatStats(c1, [c1]).maxHp;
  const pairedHp = combatStats(c1, [c1, c2]).maxHp;
  assert.equal(pairedHp, Math.round(soloHp * 1.16));
  const sim = simulateBattle({ battleId: 'trait-sim-1', seed: 99, left: [c1, c2], right: [{ ...c1, id: 'e1' }] });
  assert.equal(sim.units.find((u) => u.id === 't1')?.maxHp, pairedHp);
});

test('数值天平（EHP/DPS/升星变与不变）与 1v1 确定性对打测桩', () => {
  const pack = createPackFromStarter({
    starterId: 'compact-12',
    id: 'pack-bal-test',
    title: '数值测桩包',
    starGrowthPreset: 'classic_180',
    buffFlavor: 'tech',
  });

  const sample = pack.units[0]!;
  const s1 = analyzeStudioUnit(sample, pack.starGrowth, 1);
  const s2 = analyzeStudioUnit(sample, pack.starGrowth, 2);
  const s3 = analyzeStudioUnit(sample, pack.starGrowth, 3);

  assert.equal(s1.budgetRatioPct, 100);
  assert.equal(s2.stats.hp, Math.round(sample.stats.hp * 1.8));
  assert.equal(s3.stats.hp, Math.round(sample.stats.hp * 3.24));
  // Standard preset keeps armor/aspd/range invariant across stars
  assert.equal(s2.stats.armor, s1.stats.armor);
  assert.equal(s3.stats.aspd, s1.stats.aspd);
  assert.equal(s3.stats.range, s1.stats.range);

  // Baseline helper builds exact 100% budget unit
  const base3Tank = roleBaselineStats(3, 'tank');
  assert.ok(base3Tank.hp > 900);

  // 2★ mirrors must beat identical 1★ in 1v1 duel
  const fighterId = pack.units.find((u) => u.role === 'melee')?.id ?? pack.units[0]!.id;
  const duel = simulateStudioDuel(pack, {
    leftUnitId: fighterId,
    leftStar: 2,
    rightUnitId: fighterId,
    rightStar: 1,
    leftPos: { row: 3, col: 2 },
    rightPos: { row: 3, col: 2 },
    seed: 12345,
  });
  assert.equal(duel.winner, 'left');
  assert.ok(duel.durationSec > 0);
  assert.ok(duel.theoreticalRawTtkLeftToRightSec > 0);
  assert.ok(duel.left.survivingHp > 0);
  assert.equal(duel.right.survivingHp, 0);
});

test('绑定机纯内存共创桥 + MCP（read_turn/act/outgame）权限隔离与零落盘', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-studio-mcp-'));
  const echo = new EchoTreeStore(dir);
  const accounts = new AccountStore(dir, echo, { enabled: true, echoScope: 'public' });
  const human = accounts.register('江川雪', 'password123');
  const invite = accounts.issueAiInvite(human.token);
  const boundAi = accounts.registerAiWithInvite(invite.invite, '星海机', 'ai-password-123');
  const strangerHuman = accounts.register('路人玩家', 'password456');

  const rooms = new RoomStore(dir, { settle: (input) => accounts.settleMatch(input) });
  const bridge = new EphemeralStudioBridge(accounts);

  const playerMcp = createRoomMcp(rooms, 'player', {
    claimGift: (token, giftId, requestId) => accounts.claimGift(token, giftId, requestId),
    studioRead: (token) => bridge.readForMcp(token),
    studioAct: (token, cmd, reqId) => bridge.actForMcp(token, cmd, reqId),
    accountStatus: (token) => ({ account: accounts.authenticate(token) }),
    registerAi: (inv, name, pass) => accounts.registerAiWithInvite(inv, name, pass),
    loginAi: (user, pass) => accounts.loginAi(user, pass),
    ownerForToken: () => undefined,
  });
  const outgameMcp = createOutgameMcp({ accounts, echo, studio: bridge });

  const [pClientTx, pServerTx] = InMemoryTransport.createLinkedPair();
  await playerMcp.connect(pServerTx);
  const pClient = new Client({ name: 'test-player-mcp', version: '1.0.0' });
  await pClient.connect(pClientTx);

  const [oClientTx, oServerTx] = InMemoryTransport.createLinkedPair();
  await outgameMcp.connect(oServerTx);
  const oClient = new Client({ name: 'test-outgame-mcp', version: '1.0.0' });
  await oClient.connect(oClientTx);

  try {
    // 1. Player MCP tool count contract must remain strictly 4 tools (toJsonSchemaCompat succeeds too)
    const listed = await pClient.listTools();
    assert.deepEqual(
      listed.tools.map((t) => t.name).sort(),
      ['act', 'claim_gift', 'join_room', 'read_turn'],
    );

    // 2. Before human opens co-creation, bound AI gets active=false
    const beforeOpen = parseToolJson(
      await pClient.callTool({ name: 'read_turn', arguments: { accountToken: boundAi.token, studio: true } }),
    );
    assert.equal(beforeOpen.active, false);

    // 3. Human opens co-creation with null pack (no starter picked yet)
    const opened = bridge.syncFromBrowser(human.token, {
      mode: 'open',
      pack: null,
      summary: '邀请星海机一起选模版',
    });
    assert.equal(opened.active, true);
    assert.equal(opened.revision, 1);

    // 4. Stranger cannot access human's ephemeral session
    const strangerRead = parseToolJson(
      await oClient.callTool({ name: 'studio_pack', arguments: { accountToken: strangerHuman.token } }),
    );
    assert.equal(strangerRead.active, false);

    // 5. Bound AI reads session via player MCP and picks explicit compact-12 starter
    const aiRead = parseToolJson(
      await pClient.callTool({ name: 'read_turn', arguments: { accountToken: boundAi.token, studio: true } }),
    );
    assert.equal(aiRead.active, true);
    assert.equal(aiRead.catalogs.starters.length, 3);
    assert.equal(aiRead.catalogs.sprites.length, 89);

    const initReply = parseToolJson(
      await pClient.callTool({
        name: 'act',
        arguments: {
          accountToken: boundAi.token,
          kind: 'studio',
          requestId: 'studio-init-001',
          studio: {
            action: 'init_from_template',
            revision: 1,
            starterId: 'compact-12',
            title: '双人机共创棋谱',
            starGrowthPreset: 'classic_180',
            buffFlavor: 'tech',
            summary: '选用 12 枚紧凑原型作为共同起点',
          },
        },
      }),
    );
    assert.equal(initReply.ok, true);
    assert.equal(initReply.revision, 2);
    assert.equal(initReply.playable, true);

    // 6. Bound AI patches a unit stat via outgame MCP + runs duel check
    const patchReply = parseToolJson(
      await oClient.callTool({
        name: 'studio_pack',
        arguments: {
          accountToken: boundAi.token,
          requestId: 'studio-patch-002',
          action: 'patch',
          revision: 2,
          summary: '强化史莱姆骑身板以便前排扛伤',
          patch: {
            upsertUnits: [
              {
                id: 'c-slime',
                name: '铁甲史莱姆',
                cost: 1,
                role: 'tank',
                spriteId: 'st-slime-knight',
                factions: ['f-moss'],
                jobs: ['j-guardian'],
                stats: { hp: 820, atk: 42, armor: 40, mr: 30, aspd: 0.7, range: 1 },
                skill: {
                  name: '重甲盾阵',
                  description: '加厚护盾',
                  trigger: { kind: 'mana', maxMana: 65 },
                  target: 'self',
                  targetCount: 1,
                  effects: [{ kind: 'shield', baseByStar: [200, 340, 560], hpPct: 14, durationMs: 4000 }],
                },
              },
            ],
          },
        },
      }),
    );
    assert.equal(patchReply.ok, true);
    assert.equal(patchReply.revision, 3);

    // 7. Browser pulls revision 3 and verifies AI edit + runs duel via MCP
    const pulled = bridge.syncFromBrowser(human.token, { mode: 'pull', sinceRevision: 1 });
    assert.equal(pulled.revision, 3);
    assert.equal(pulled.pack?.units.find((u) => u.id === 'c-slime')?.name, '铁甲史莱姆');

    const duelReply = parseToolJson(
      await pClient.callTool({
        name: 'act',
        arguments: {
          accountToken: boundAi.token,
          kind: 'studio',
          requestId: 'studio-duel-003',
          studio: {
            action: 'duel',
            leftUnitId: 'c-slime',
            leftStar: 2,
            rightUnitId: 'c-star',
            rightStar: 1,
          },
        },
      }),
    );
    assert.equal(duelReply.ok, true);
    assert.ok(duelReply.duel.durationSec > 0);

    // 8. Closing wipes RAM bridge
    const closed = bridge.syncFromBrowser(human.token, { mode: 'close' });
    assert.equal(closed.active, false);
    assert.equal(bridge.activeSessionCount(), 0);
  } finally {
    await pClient.close();
    await oClient.close();
    await playerMcp.close();
    await outgameMcp.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('RoomStore.createCustom 运行完整纯内存自定义试玩局且零服务端落盘', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-custom-memroom-'));
  try {
    const rooms = new RoomStore(dir);
    const customPack = createPackFromStarter({
      starterId: 'compact-12',
      id: 'pack-mem-play',
      title: '纯内存试玩谱',
      starGrowthPreset: 'classic_180',
      buffFlavor: 'classic',
    });

    const host = rooms.createCustom('江川雪', customPack, 2, undefined, 'duel');
    const started = rooms.start({ roomId: host.roomId, token: host.token });
    assert.equal(started.ephemeral, true);
    assert.equal(started.customPack?.title, '纯内存试玩谱');
    assert.ok(started.pack?.startsWith('custom:'));
    assert.ok(started.self?.swordOffer);

    // R1: Pick opening white item, place starter, fight bots until R3 Buff Draft
    let view = rooms.mutate({
      roomId: host.roomId,
      token: host.token,
      round: started.round,
      revision: started.self!.revision,
      requestId: 'c-r1-sword',
      action: { kind: 'pick_sword', item: started.self!.swordOffer!.choices[0]! },
    });
    const piece = view.self!.bench![0]!;
    view = rooms.mutate({
      roomId: host.roomId,
      token: host.token,
      round: view.round,
      revision: view.self!.revision,
      requestId: 'c-r1-move',
      action: { kind: 'move', piece: piece.id, row: 3, col: 2 },
    });
    view = rooms.mutate({
      roomId: host.roomId,
      token: host.token,
      round: view.round,
      revision: view.self!.revision,
      requestId: 'c-r1-ready',
      action: { kind: 'ready' },
    });

    assert.equal(view.round, 2);
    assert.ok((view.battle?.round ?? 0) >= 1);
    assert.equal(view.self?.shop.length, 5);

    // R2: Ready again to reach R3 Shared Journey Buff Draft
    view = rooms.mutate({
      roomId: host.roomId,
      token: host.token,
      round: view.round,
      revision: view.self!.revision,
      requestId: 'c-r2-ready',
      action: { kind: 'ready' },
    });
    assert.equal(view.round, 3);
    assert.ok(view.self?.hexOffer, '第 3 轮应弹出共享奇遇三选一');
    // Must never offer AI-exclusive or Jianghu-exclusive IDs in custom pack
    for (const choice of view.self!.hexOffer!.choices) {
      assert.ok(
        !choice.id.startsWith('ai-') && !choice.id.startsWith('jh-'),
        `自定义棋谱不得混入特定官包专属 Buff: ${choice.id}`,
      );
    }

    // Critical assertion: zero room JSON files written to disk & zero recorded fights in telemetry
    const savedFiles = readdirSync(dir);
    assert.deepEqual(
      savedFiles.filter((f) => /^[a-f0-9]{12}\.json/.test(f)),
      [],
      '内存试玩房严禁写任何房间 JSON 到磁盘',
    );
    const telemetry = JSON.parse(readFileSync(join(dir, 'balance-telemetry.json'), 'utf8'));
    assert.equal(telemetry.fights.length, 0, '内存试玩房严禁写入公共遥测战绩');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

