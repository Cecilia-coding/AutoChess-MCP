import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { findHex } from '../content/autochess/hexes';
import { GameConfigStore } from '../lib/accounts/config-store';
import { hazardChancePct } from '../lib/autochess/hazards';
import { xpBuyAmount, xpBuyCost } from '../lib/autochess/level';
import { settleLossBounty } from '../lib/autochess/loss-bounty';
import { roomRefreshPrice, roomShopPrice } from '../lib/autochess/room-economy';
import { createRoomMcp } from '../lib/autochess/room-mcp';
import { RoomStore } from '../lib/autochess/room-store';
import type { RoomCredentials } from '../lib/autochess/room-types';
import { defeatDamage } from '../lib/autochess/round-settlement';
import { combatStats } from '../lib/autochess/stats';
import { DEFAULT_GAME_CONFIG } from '../lib/meta/game-config';
import {
  BUFF_ARCHETYPES,
  BUFF_RARITY_META,
  DEFAULT_BUFF_DRAFT_CONFIG,
  compileBuffToHexDef,
  drawSeatBuffOffer,
  rollRoundBuffRarity,
} from '../lib/meta/journey-buffs';
import { packRoster } from '../packs/registry';

function completeRoundOnePrep(store: RoomStore, creds: RoomCredentials, tag: string) {
  let view = store.view(creds);
  if (view.self?.swordOffer) {
    view = store.mutate({
      ...creds,
      round: view.round,
      revision: view.self.revision,
      requestId: `${tag}-sword`,
      action: { kind: 'pick_sword', item: view.self.swordOffer.choices[0]! },
    });
  }
  const starter = view.self?.bench?.[0];
  if (starter && (view.self?.board.length ?? 0) === 0) {
    view = store.mutate({
      ...creds,
      round: view.round,
      revision: view.self!.revision,
      requestId: `${tag}-move`,
      action: { kind: 'move', piece: starter.id, row: 3, col: 2 },
    });
  }
  return store.mutate({
    ...creds,
    round: view.round,
    revision: view.self!.revision,
    requestId: `${tag}-ready`,
    action: { kind: 'ready' },
  });
}

function advanceThroughBuffAndClear(store: RoomStore, creds: RoomCredentials, tag: string) {
  let view = store.view(creds);
  if (view.self?.hexOffer) {
    view = store.mutate({
      ...creds,
      round: view.round,
      revision: view.self.revision,
      requestId: `${tag}-hex`,
      action: { kind: 'pick_hex', hex: view.self.hexOffer.choices[0]!.id },
    });
  }
  while (view.self?.itemOffer) {
    const item = view.self.itemOffer.boxes[view.self.itemOffer.boxIndex]![0]!;
    view = store.mutate({
      ...creds,
      round: view.round,
      revision: view.self.revision,
      requestId: `${tag}-item-${view.self.itemOffer.boxIndex}`,
      action: { kind: 'pick_item', item },
    });
  }
  if (!view.self?.ready) {
    view = store.mutate({
      ...creds,
      round: view.round,
      revision: view.self!.revision,
      requestId: `${tag}-ready`,
      action: { kind: 'ready' },
    });
  }
  return view;
}

function parseToolJson(result: Awaited<ReturnType<Client['callTool']>>) {
  assert.notEqual(result.isError, true, `Expected non-error MCP result, got: ${JSON.stringify(result)}`);
  const first = (result.content as { type: string; text?: string }[])[0];
  return JSON.parse(first?.text ?? '{}');
}

test('Buff 词条双包分开包装且彻底移除酒馆相关词条', () => {
  assert.equal(BUFF_ARCHETYPES.length, 37);
  assert.equal(DEFAULT_BUFF_DRAFT_CONFIG.items.length, 37);
  assert.deepEqual(DEFAULT_BUFF_DRAFT_CONFIG.buffRounds, [3, 7, 11]);
  assert.deepEqual(DEFAULT_BUFF_DRAFT_CONFIG.supplyRounds, [5, 9]);
  assert.deepEqual(DEFAULT_BUFF_DRAFT_CONFIG.rerollCosts, [2, 4]);

  for (const rule of DEFAULT_BUFF_DRAFT_CONFIG.items) {
    const aiDef = compileBuffToHexDef(rule, 'ai');
    const jhDef = compileBuffToHexDef(rule, 'jianghu');
    const texts = [aiDef.name, aiDef.note, jhDef.name, jhDef.note];
    for (const t of texts) {
      assert.equal(/酒馆/.test(t), false, `词条 ${rule.id} 不应出现「酒馆」字样: ${t}`);
    }
    if (rule.scope === 'shared') {
      assert.notEqual(aiDef.name, jhDef.name, `双包通用词条 ${rule.id} 应在 AI铲铲 与 夜航船 拥有分开包装的名称`);
    }
  }
});

test('同房同稀有度三选一同步、独立候选词条、补给回合与付费重投阶梯', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-buff-draft-'));
  try {
    const store = new RoomStore(dir);
    const created = store.create('测试棋手A', 'ai', undefined, undefined, 'standard');
    const invite = store.invite(created).invitation;
    const joined = store.join(invite, '测试棋手B', 'join-key-player-two-123456');

    completeRoundOnePrep(store, created, 'p0-r1');
    const viewAfterR1 = completeRoundOnePrep(store, joined, 'p1-r1');

    // 第 2 轮开商店，不连弹奇遇（给玩家逛店攒钱，减少弹窗疲劳）
    assert.equal(viewAfterR1.round, 2);
    assert.equal(store.view(created).self?.hexOffer, undefined, '第 2 轮应专心逛店，不急着弹奇遇');
    assert.equal(store.view(created).self?.itemOffer, undefined);

    advanceThroughBuffAndClear(store, created, 'p0-r2');
    const viewAfterR2 = advanceThroughBuffAndClear(store, joined, 'p1-r2');

    assert.equal(viewAfterR2.round, 3);
    const viewP0 = store.view(created);
    const viewP1 = store.view(joined);

    assert.ok(viewP0.self?.hexOffer, '第 3 轮 P0 应弹出奇遇三选一');
    assert.ok(viewP1.self?.hexOffer, '第 3 轮 P1 应弹出奇遇三选一');
    assert.equal(viewP0.self.hexOffer.choices.length, 3);
    assert.equal(viewP1.self.hexOffer.choices.length, 3);

    // 同一时间段全房间同稀有度（含人类与 AI/路人机）
    const sharedRarity = viewP0.self.hexOffer.rarityId!;
    assert.equal(viewP1.self.hexOffer.rarityId, sharedRarity);
    assert.equal(viewP1.self.hexOffer.rarity, BUFF_RARITY_META[sharedRarity].hexRarity);

    // 校验同房间所有已落选词条（含 6 个 bot 席位）均为同一品阶
    const persisted = JSON.parse(readFileSync(join(dir, `${created.roomId}.json`), 'utf8')) as {
      seats: { bot?: boolean; hexes?: string[] }[];
    };
    for (const seat of persisted.seats) {
      if (!seat.bot) continue;
      assert.ok(seat.hexes?.length === 1, '第 3 轮开局 bot 应已完成同品阶 Buff 选择');
      const picked = findHex(seat.hexes[0]!, 'ai');
      assert.equal(picked?.rarity, BUFF_RARITY_META[sharedRarity].hexRarity);
    }

    // 同一时间大家拿到不同候选词条
    assert.notDeepEqual(
      viewP0.self.hexOffer.choices.map(c => c.id),
      viewP1.self.hexOffer.choices.map(c => c.id),
    );

    const beforeGold = store.view(created).self!.gold!;
    assert.ok(beforeGold >= 6, '第 3 轮玩家手头应已有足够 Token 决策是否付费重投');
    const firstChoices = store.view(created).self!.hexOffer!.choices.map(c => c.id);
    assert.equal(store.view(created).self!.hexOffer!.rerollsUsed, 0);
    assert.equal(store.view(created).self!.hexOffer!.rerollCost, 2);

    // 第一次付费重投（2 金）
    const afterReroll1 = store.mutate({
      ...created,
      round: 3,
      revision: store.view(created).self!.revision,
      requestId: 'buff-reroll-step1',
      action: { kind: 'reroll_hex' },
    });
    assert.equal(afterReroll1.self!.gold, beforeGold - 2);
    assert.equal(afterReroll1.self!.hexOffer!.rarityId, sharedRarity);
    assert.equal(afterReroll1.self!.hexOffer!.rerollsUsed, 1);
    assert.equal(afterReroll1.self!.hexOffer!.rerollCost, 4);
    const secondChoices = afterReroll1.self!.hexOffer!.choices.map(c => c.id);
    assert.equal(secondChoices.filter(id => firstChoices.includes(id)).length, 0, '首次重投应尽量避开上一批 3 张词条');

    // 第二次付费重投（4 金）
    const afterReroll2 = store.mutate({
      ...created,
      round: 3,
      revision: afterReroll1.self!.revision,
      requestId: 'buff-reroll-step2',
      action: { kind: 'reroll_hex' },
    });
    assert.equal(afterReroll2.self!.gold, beforeGold - 6);
    assert.equal(afterReroll2.self!.hexOffer!.rarityId, sharedRarity);
    assert.equal(afterReroll2.self!.hexOffer!.rerollsUsed, 2);
    assert.equal(afterReroll2.self!.hexOffer!.rerollCost, null);

    // 超过上限第 3 次应拒绝
    assert.throws(
      () =>
        store.mutate({
          ...created,
          round: 3,
          revision: afterReroll2.self!.revision,
          requestId: 'buff-reroll-step3',
          action: { kind: 'reroll_hex' },
        }),
      /最多重投 2 次/,
    );

    // 清掉金币并测试另一席位金币不足重投报错
    while ((store.view(joined).self!.gold ?? 0) >= 2) {
      const p1 = store.view(joined);
      if ((p1.self!.gold ?? 0) >= 4) {
        store.mutate({ ...joined, round: 3, revision: p1.self!.revision, requestId: `burn-xp-${p1.self!.revision}`, action: { kind: 'buy_xp', times: 1 } });
      } else {
        store.mutate({ ...joined, round: 3, revision: p1.self!.revision, requestId: `burn-roll-${p1.self!.revision}`, action: { kind: 'refresh' } });
      }
    }
    assert.throws(
      () =>
        store.mutate({
          ...joined,
          round: 3,
          revision: store.view(joined).self!.revision,
          requestId: 'p1-reroll-no-gold',
          action: { kind: 'reroll_hex' },
        }),
      /金币不足/,
    );

    // 完成第 3 轮进入第 4 轮（无 Buff、无补给箱）-> 完成第 4 轮进入第 5 轮（装备补给箱）
    advanceThroughBuffAndClear(store, created, 'p0-r3');
    advanceThroughBuffAndClear(store, joined, 'p1-r3');
    assert.equal(store.view(created).round, 4);
    assert.equal(store.view(created).self?.hexOffer, undefined);
    assert.equal(store.view(created).self?.itemOffer, undefined);

    advanceThroughBuffAndClear(store, created, 'p0-r4');
    advanceThroughBuffAndClear(store, joined, 'p1-r4');
    const r5 = store.view(created);
    assert.equal(r5.round, 5);
    assert.equal(r5.self?.hexOffer, undefined);
    assert.ok(r5.self?.itemOffer, '第 5 轮应按 supplyRounds 弹出装备三选一补给箱');
    assert.equal(r5.self.itemOffer.boxes[0]?.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('经济运营类、奇物升星与 AI 词条机制生效校验', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-buff-fx-'));
  try {
    const store = new RoomStore(dir);
    const created = store.create('测试棋手', 'ai', undefined, undefined, 'standard');
    store.start(created);
    completeRoundOnePrep(store, created, 'fx-r1');

    // 直接通过持久化存档精确覆盖第 2 轮候选池做定向机制回归
    const roomFile = join(dir, `${created.roomId}.json`);

    // 1) 结构化数值映射校验
    assert.equal(findHex('econ-hedge', 'ai')?.interestCap, 7);
    assert.equal(findHex('econ-stipend', 'ai')?.interestCap, 0);
    assert.deepEqual(findHex('econ-stipend', 'ai')?.roundIncome, { 1: 5, 2: 5, 3: 5 });
    assert.equal(findHex('econ-fast-xp', 'ai')?.xpPerBuyBonus, 2);
    assert.equal(findHex('econ-reroll', 'ai')?.freeRefreshesPerRound, 1);
    assert.equal(findHex('econ-engine', 'ai')?.freeRefreshesPerRound, 2);
    assert.equal(findHex('econ-engine', 'ai')?.xpPerPaidRefresh, 1);
    assert.deepEqual(findHex('econ-contract', 'ai')?.shopBanContract, { banRounds: 2, payoutGold: 28 });
    assert.equal(findHex('rule-cap-up', 'ai')?.bonusFieldCap, 1);
    assert.deepEqual(findHex('rule-star-up', 'ai')?.starUpHighestUnit, { count: 1, grantHazardImmunity: true });
    assert.equal(findHex('ai-offpeak', 'ai')?.hazardModifiers?.forcePriceTrough, true);
    assert.equal(findHex('ai-clean-ip', 'ai')?.hazardModifiers?.chanceScalePct, 35);
    assert.equal(findHex('ai-no-safety', 'ai')?.immuneSafety, true);
    assert.equal(findHex('ai-no-safety', 'ai')?.controlImmune, true);

    // 2) 用持久化房间校验 rule-cap-up / rule-star-up / econ-fast-xp / econ-contract 在 RoomStore 中的真实执行
    const disk = JSON.parse(readFileSync(roomFile, 'utf8'));
    const seat = disk.seats[0];
    seat.gold = 40;
    seat.level = 3;
    seat.xp = 0;
    seat.hexOffer = {
      round: disk.round,
      rarity: 'orange',
      rarityId: 'legendary',
      rarityLabel: '传说奇遇',
      rerollsUsed: 0,
      maxRerolls: 2,
      rerollCost: 2,
      choices: ['econ-fast-xp', 'rule-cap-up', 'rule-star-up'].map(id => {
        const hex = findHex(id, 'ai')!;
        return { id: hex.id, name: hex.name, rarity: hex.rarity, note: hex.note };
      }),
    };
    writeFileSync(roomFile, JSON.stringify(disk), 'utf8');
    const reloaded = new RoomStore(dir);
    let view = reloaded.view(created);
    const capBefore = view.self!.capacity;

    // 选 rule-cap-up -> 人口+1，金币+4
    view = reloaded.mutate({
      ...created,
      round: view.round,
      revision: view.self!.revision,
      requestId: 'pick-cap-up',
      action: { kind: 'pick_hex', hex: 'rule-cap-up' },
    });
    assert.equal(view.self!.capacity, capBefore + 1);
    assert.equal(view.self!.gold, 44);

    // 注入 rule-star-up & econ-fast-xp 再重载验证升星+风控免疫+史诗宝箱、以及买经验+2
    const disk2 = JSON.parse(readFileSync(roomFile, 'utf8'));
    disk2.seats[0].hexOffer = {
      round: disk2.round,
      rarity: 'orange',
      rarityId: 'legendary',
      rarityLabel: '传说奇遇',
      rerollsUsed: 0,
      maxRerolls: 2,
      rerollCost: 2,
      choices: ['rule-star-up', 'econ-fast-xp', 'econ-contract'].map(id => {
        const hex = findHex(id, 'ai')!;
        return { id: hex.id, name: hex.name, rarity: hex.rarity, note: hex.note };
      }),
    };
    const targetPieceId = disk2.seats[0].board[0].id as string;
    const starBefore = disk2.seats[0].board[0].star as number;
    writeFileSync(roomFile, JSON.stringify(disk2), 'utf8');
    const reloaded2 = new RoomStore(dir);
    view = reloaded2.view(created);
    view = reloaded2.mutate({
      ...created,
      round: view.round,
      revision: view.self!.revision,
      requestId: 'pick-star-up',
      action: { kind: 'pick_hex', hex: 'rule-star-up' },
    });
    assert.equal(view.self!.board[0]!.star, starBefore + 1);
    assert.ok(view.self!.hazardImmunePieceIds?.includes(targetPieceId));
    const epicOffer = view.self?.itemOffer;
    assert.ok(epicOffer && epicOffer.family === 'epic');

    // 先选完史诗宝箱
    view = reloaded2.mutate({
      ...created,
      round: view.round,
      revision: view.self!.revision,
      requestId: 'pick-star-epic-item',
      action: { kind: 'pick_item', item: epicOffer.boxes[0]![0]! },
    });

    // 再测试 econ-fast-xp + econ-contract
    const disk3 = JSON.parse(readFileSync(roomFile, 'utf8'));
    disk3.seats[0].gold = 20;
    disk3.seats[0].xp = 0;
    disk3.seats[0].hexOffer = {
      round: disk3.round,
      rarity: 'rare',
      rarityId: 'rare',
      rarityLabel: '稀世奇遇',
      rerollsUsed: 0,
      maxRerolls: 2,
      rerollCost: 2,
      choices: ['econ-fast-xp', 'econ-contract', 'econ-reroll'].map(id => {
        const hex = findHex(id, 'ai')!;
        return { id: hex.id, name: hex.name, rarity: hex.rarity, note: hex.note };
      }),
    };
    writeFileSync(roomFile, JSON.stringify(disk3), 'utf8');
    const reloaded3 = new RoomStore(dir);
    view = reloaded3.mutate({
      ...created,
      round: 2,
      revision: reloaded3.view(created).self!.revision,
      requestId: 'pick-fast-xp',
      action: { kind: 'pick_hex', hex: 'econ-fast-xp' },
    });
    const goldBeforeXp = view.self!.gold!;
    view = reloaded3.mutate({
      ...created,
      round: 2,
      revision: view.self!.revision,
      requestId: 'buy-xp-fast',
      action: { kind: 'buy_xp', times: 1 },
    });
    assert.equal(view.self!.gold, goldBeforeXp - 4);
    assert.equal(view.self!.level, 4, 'Lv3 0/4 时买 6 点经验应升至 Lv4');
    assert.equal(view.self!.xp, 2, 'econ-fast-xp 应使每次 4 金买经验多得 +2 点（共 6 点，溢出 2 点）');

    // 测试 permanentFreeRefreshesPerRound & roomRefreshPrice
    assert.equal(roomRefreshPrice({ freeRefreshes: undefined, shopRefresh: 0, hexes: ['econ-reroll'] }, 2), 0);
    assert.equal(roomRefreshPrice({ freeRefreshes: undefined, shopRefresh: 1, hexes: ['econ-reroll'] }, 2), 2);
    assert.equal(roomRefreshPrice({ freeRefreshes: undefined, shopRefresh: 1, hexes: ['econ-engine'] }, 2), 0);
    assert.equal(roomRefreshPrice({ freeRefreshes: undefined, shopRefresh: 2, hexes: ['econ-engine'] }, 2), 2);

    // 测试 ai-clean-ip 对 hazardChancePct 的 65% 降幅（scale 35%）
    const aiUnits = packRoster('ai');
    const deepseek = aiUnits.find(u => u.id === 'ai-deepseek');
    if (deepseek?.hazard?.length) {
      const ctx = { seed: 42, round: 3, seatId: 's0', unitId: deepseek.id, star: 2 };
      const rawPct = hazardChancePct(deepseek.hazard[0]!, ctx, 100);
      const reducedPct = hazardChancePct(deepseek.hazard[0]!, ctx, 35);
      assert.ok(reducedPct <= rawPct * 0.36);
    }

    // 测试 ai-offpeak (troughDelta) 对 roomShopPrice 生效
    assert.ok(roomShopPrice({ roundHazards: { round: 2, struck: [], soldOut: [], priceDelta: { 'ai-deepseek': -1 } } }, deepseek!) < 99);

    // 测试 ai-no-safety 免疫 safetyStacks
    const unitWithSafety = {
      id: 'p1',
      templateId: aiUnits[0]!.id,
      star: 1 as const,
      localRow: 3,
      localCol: 2,
      itemIds: [] as string[],
      safetyStacks: 5,
    };
    const penalized = combatStats(unitWithSafety, [unitWithSafety], 'left');
    const exempted = combatStats({ ...unitWithSafety, hexIds: ['ai-no-safety'] }, [{ ...unitWithSafety, hexIds: ['ai-no-safety'] }], 'left');
    assert.equal(exempted.controlImmune, true);
    assert.ok(exempted.maxHp > penalized.maxHp || exempted.atk > penalized.atk, 'ai-no-safety 应免疫 safety 合规税并提升属性');

    // 最后测 econ-contract 2 轮禁购并在到期回合发 +28 金
    const disk4 = JSON.parse(readFileSync(roomFile, 'utf8'));
    disk4.seats[0].shopBanUntil = undefined;
    disk4.seats[0].gold = 10;
    disk4.seats[0].hexOffer = {
      round: disk4.round,
      rarity: 'orange',
      rarityId: 'legendary',
      rarityLabel: '传说奇遇',
      rerollsUsed: 0,
      maxRerolls: 2,
      rerollCost: 2,
      choices: ['econ-contract', 'econ-tycoon', 'econ-jackpot'].map(id => {
        const hex = findHex(id, 'ai')!;
        return { id: hex.id, name: hex.name, rarity: hex.rarity, note: hex.note };
      }),
    };
    writeFileSync(roomFile, JSON.stringify(disk4), 'utf8');
    const reloaded4 = new RoomStore(dir);
    view = reloaded4.mutate({
      ...created,
      round: 2,
      revision: reloaded4.view(created).self!.revision,
      requestId: 'pick-contract',
      action: { kind: 'pick_hex', hex: 'econ-contract' },
    });
    assert.equal(view.self!.shopBanUntil, 3);
    assert.throws(
      () =>
        reloaded4.mutate({
          ...created,
          round: 2,
          revision: view.self!.revision,
          requestId: 'contract-buy-blocked',
          action: { kind: 'buy', index: 0 },
        }),
      /不能买棋/,
    );
    // 第 2 轮就绪 -> 进第 3 轮（仍禁购；第 3 轮会弹出奇遇三选一）-> 完成第 3 轮 -> 进第 4 轮（返还 +28 金）
    view = reloaded4.mutate({
      ...created,
      round: 2,
      revision: view.self!.revision,
      requestId: 'contract-r2-ready',
      action: { kind: 'ready' },
    });
    assert.equal(view.round, 3);
    assert.equal(view.self!.shopBanUntil, 3);
    const goldR3 = view.self!.gold!;
    view = advanceThroughBuffAndClear(reloaded4, created, 'contract-r3');
    assert.equal(view.round, 4);
    assert.ok(view.self!.gold! >= goldR3 + 28, `契约第 4 轮期满应至少包含 +28 金返还（实得 ${view.self!.gold! - goldR3}）`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('GameConfigStore 热改 Buff 参数、双包文案与重投阶梯即时生效', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-buff-hot-'));
  const cfgStore = new GameConfigStore(dir);
  try {
    const next = structuredClone(DEFAULT_GAME_CONFIG);
    const hedge = next.buffs.items.find(item => item.id === 'econ-hedge')!;
    hedge.params.interestCap = 9;
    hedge.params.gold = 11;
    hedge.copy.ai = {
      name: '热改囤Key大亨',
      desc: '热更新文案测试：立得 {gold} Token，利息上限 {interestCap}。',
    };
    next.buffs.rerollCosts = [1, 3, 5];
    cfgStore.save(next);

    const compiledAi = findHex('econ-hedge', 'ai');
    assert.equal(compiledAi?.name, '热改囤Key大亨');
    assert.equal(compiledAi?.interestCap, 9);
    assert.equal(compiledAi?.immediateGold, 11);
    assert.match(compiledAi?.note ?? '', /11 Token.*9/);

    // 夜航船文案独立未受 AI 文案改动影响，数值参数共用同一后台参数
    const compiledJh = findHex('econ-hedge', 'jianghu');
    assert.equal(compiledJh?.name, '钱庄利滚利');
    assert.equal(compiledJh?.interestCap, 9);

    const rarity = rollRoundBuffRarity(1234, 3, 'ai', cfgStore.get().buffs);
    assert.ok(rarity);
    const offer = drawSeatBuffOffer({
      seed: 1234,
      seatIndex: 0,
      round: 3,
      packId: 'ai',
      rarity,
      ownedIds: [],
      config: cfgStore.get().buffs,
    });
    assert.equal(offer.maxRerolls, 3);
    assert.equal(offer.rerollCost, 1);
  } finally {
    cfgStore.reset('all');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('player/legacy MCP 工具数量不变且支持 reroll_hex 与 pick_hex 全流程', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-buff-mcp-'));
  const rooms = new RoomStore(dir);
  const playerServer = createRoomMcp(rooms, 'player', {
    claimGift: () => ({ ok: true }),
    registerAi: () => ({}),
    loginAi: () => ({}),
    ownerForToken: () => undefined,
  });
  const legacyServer = createRoomMcp(rooms, 'legacy');
  const [pClientT, pServerT] = InMemoryTransport.createLinkedPair();
  const [lClientT, lServerT] = InMemoryTransport.createLinkedPair();
  const pClient = new Client({ name: 'test-player-buff', version: '1.0.0' });
  const lClient = new Client({ name: 'test-legacy-buff', version: '1.0.0' });

  try {
    await Promise.all([playerServer.connect(pServerT), legacyServer.connect(lServerT)]);
    await Promise.all([pClient.connect(pClientT), lClient.connect(lClientT)]);

    const [pTools, lTools] = await Promise.all([pClient.listTools(), lClient.listTools()]);
    assert.equal(pTools.tools.length, 4, 'player profile 工具数保持 4 个不变');
    assert.equal(lTools.tools.length, 9, 'legacy profile 工具数保持 9 个不变');

    const created = rooms.create('MCP棋手', 'ai', undefined, undefined, 'standard');
    rooms.start(created);
    completeRoundOnePrep(rooms, created, 'mcp-r1');
    // 第 2 轮不弹奇遇，直接就绪进入第 3 轮选秀回合
    advanceThroughBuffAndClear(rooms, created, 'mcp-r2');

    // 先凑至少 2 金以便在第 3 轮测试 reroll_hex
    while ((rooms.view(created).self!.gold ?? 0) < 2 && (rooms.view(created).self!.bench?.length ?? 0) > 0) {
      const piece = rooms.view(created).self!.bench![0]!;
      rooms.mutate({
        ...created,
        round: 3,
        revision: rooms.view(created).self!.revision,
        requestId: `mcp-sell-${piece.id}`,
        action: { kind: 'sell', piece: piece.id },
      });
    }

    const readRes = parseToolJson(await pClient.callTool({ name: 'read_turn', arguments: { ...created } }));
    assert.ok(readRes.modelSnapshot?.hexOffer, 'read_turn 应返回 hexOffer');
    const offerBefore = readRes.modelSnapshot.hexOffer;
    assert.equal(offerBefore.rerollCost, 2);

    const rerollRes = parseToolJson(
      await pClient.callTool({
        name: 'act',
        arguments: {
          ...created,
          kind: 'reroll_hex',
          round: readRes.round,
          revision: readRes.self.revision,
          requestId: 'mcp-act-reroll-01',
        },
      }),
    );
    assert.equal(rerollRes.modelSnapshot.hexOffer.rerollsUsed, 1);
    assert.equal(rerollRes.modelSnapshot.hexOffer.rarityId, offerBefore.rarityId);

    const chosenHex = rerollRes.modelSnapshot.hexOffer.choices[0].id as string;
    const pickRes = parseToolJson(
      await pClient.callTool({
        name: 'act',
        arguments: {
          ...created,
          kind: 'pick_hex',
          hex: chosenHex,
          round: rerollRes.round,
          revision: rerollRes.self.revision,
          requestId: 'mcp-act-pick-01',
        },
      }),
    );
    assert.equal(pickRes.modelSnapshot.hexOffer, undefined);
    assert.ok((pickRes.modelSnapshot.hexes as string[]).includes(chosenHex));
  } finally {
    await pClient.close();
    await lClient.close();
    await playerServer.close();
    await legacyServer.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('前轻后重四段 S 型扣血曲线、弈决缩放与局内节奏后台热改生效', () => {
  // 1) 默认前轻后重曲线校验（R1–R4: 3~5, R5–R8: 6~10, R9–R12: 11~16, R13+: 16~24+）
  assert.equal(defeatDamage(1, 1), 3);
  assert.equal(defeatDamage(2, 2), 4);
  assert.equal(defeatDamage(4, 5), 5);
  assert.equal(defeatDamage(5, 1), 6);
  assert.equal(defeatDamage(8, 5), 10);
  assert.equal(defeatDamage(9, 1), 11);
  assert.equal(defeatDamage(12, 5), 16);
  assert.equal(defeatDamage(13, 1), 16);
  assert.equal(defeatDamage(13, 5), 24);
  assert.equal(defeatDamage(14, 1), 18);

  // 前 4 轮连败按每轮留 2 子只掉 4*4=16 血（84 血进 R5），不会早早暴毙
  const earlyTotal = [1, 2, 3, 4].reduce((sum, round) => sum + defeatDamage(round, 2), 0);
  assert.equal(earlyTotal, 16);

  // 弈决 0.65 缩放生效
  assert.equal(defeatDamage(1, 3, 0.65), 3);
  assert.equal(defeatDamage(8, 5, 0.65), 7);

  // 2) 热改 GameConfigStore.pacing 对 RoomStore / level / loss-bounty / RoomView.pacing 即时生效
  const dir = mkdtempSync(join(tmpdir(), 'autochess-pacing-hot-'));
  const roomDir = mkdtempSync(join(tmpdir(), 'autochess-pacing-rooms-'));
  const cfgStore = new GameConfigStore(dir);
  try {
    const next = structuredClone(DEFAULT_GAME_CONFIG);
    next.pacing.standardStartHp = 120;
    next.pacing.startGold = 12;
    next.pacing.shopRefreshCost = 1;
    next.pacing.xpBuyCost = 3;
    next.pacing.xpBuyAmount = 6;
    next.pacing.lossBountyBankCap = 22;
    next.pacing.damageStages[0]!.baseDamage = 1;
    cfgStore.save(next);

    assert.equal(xpBuyCost(), 3);
    assert.equal(xpBuyAmount(), 6);
    assert.equal(defeatDamage(1, 1), 2);
    let bank = { streak: 0, bank: 0 };
    for (let i = 0; i < 8; i += 1) bank = settleLossBounty(bank, 'loss', 80).state;
    assert.equal(bank.bank, 22);

    const store = new RoomStore(roomDir);
    const created = store.create('测试运营玩家', 'ai', undefined, undefined, 'standard');
    const view = store.view(created);
    assert.equal(view.maxHp, 120);
    assert.equal(view.self?.hp, 120);
    assert.equal(view.self?.gold, 12);
    assert.equal(view.pacing?.xpBuyCost, 3);
    assert.equal(view.pacing?.xpBuyAmount, 6);
    assert.equal(view.pacing?.shopRefreshCost, 1);

    // 测试弈决 1v1 模式使用 duelStartHp 与 duelDamageScale（且 lossDamageScale 修复后实际传入结算）
    cfgStore.reset('pacing');
    const duelCreated = store.create('弈决玩家A', 'ai', undefined, undefined, 'duel');
    const duelInvite = store.invite(duelCreated).invitation;
    const duelJoined = store.join(duelInvite, '弈决玩家B', 'duel-join-key-player-2');
    const viewDuel = store.view(duelCreated);
    assert.equal(viewDuel.maxHp, 150);
    // 完成双方 R1：若其中一方负场，第 1 轮在 duel(0.65) 下最多扣 3 血（>=147）
    completeRoundOnePrep(store, duelCreated, 'duel-r1-a');
    const afterDuelR1 = completeRoundOnePrep(store, duelJoined, 'duel-r1-b');
    const loserHp = Math.min(...afterDuelR1.seats.map(s => s.hp));
    assert.ok(loserHp >= 147, `弈决第 1 轮在 0.65 缩放后扣血应 <=3（当前最低血量 ${loserHp}）`);
  } finally {
    cfgStore.reset('all');
    rmSync(dir, { recursive: true, force: true });
    rmSync(roomDir, { recursive: true, force: true });
  }
});
