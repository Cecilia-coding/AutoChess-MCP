import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GameConfigStore } from '../lib/accounts/config-store';
import {
  DEFAULT_GAME_CONFIG,
  getGameConfig,
  validateGameConfig,
} from '../lib/meta/game-config';
import {
  cosmeticById,
  cosmeticPrice,
  listedCosmetics,
} from '../lib/meta/cosmetics';
import {
  exchangeBotPerHuman,
  settlementDelta,
} from '../lib/meta/economy';
import {
  newArcadeState,
  playArcade,
} from '../lib/accounts/arcade-engine';

test('default board tiers match 3-tier shop pricing & move 异色 into tier 3 shop', () => {
  const listed = listedCosmetics();
  const byId = new Map(listed.map(item => [item.id, item]));

  const t1Ids = ['skin-rose-court', 'skin-wisteria-brook', 'skin-wonderland-rabbit', 'skin-carousel-night'];
  const t2PaidIds = ['skin-lotus-pond', 'skin-coral-lagoon', 'skin-embroidery-hoop'];
  const t3Ids = ['skin-time-astrolabe-ivory', 'skin-time-astrolabe'];

  for (const id of t1Ids) {
    const item = byId.get(id);
    assert.ok(item, `${id} should be listed`);
    assert.equal(item.tier, 't1');
    assert.equal(item.acquisition, 'shop');
    assert.equal(cosmeticPrice(item, 'human'), 180);
    assert.equal(cosmeticPrice(item, 'bot'), 1800);
  }
  const revivalDefault = byId.get('skin-revival');
  assert.ok(revivalDefault, 'skin-revival should remain visible in shop');
  assert.equal(revivalDefault.tier, 't2');
  assert.equal(revivalDefault.acquisition, 'default');
  assert.equal(cosmeticPrice(revivalDefault, 'human'), 0);
  assert.equal(cosmeticPrice(revivalDefault, 'bot'), 0);

  for (const id of t2PaidIds) {
    const item = byId.get(id);
    assert.ok(item, `${id} should be listed`);
    assert.equal(item.tier, 't2');
    assert.equal(item.acquisition, 'shop');
    assert.equal(cosmeticPrice(item, 'human'), 108);
    assert.equal(cosmeticPrice(item, 'bot'), 1080);
  }
  for (const id of t3Ids) {
    const item = byId.get(id);
    assert.ok(item, `${id} should be listed`);
    assert.equal(item.tier, 't3');
    assert.equal(item.acquisition, 'shop');
    assert.equal(cosmeticPrice(item, 'human'), 52);
    assert.equal(cosmeticPrice(item, 'bot'), 520);
  }
});

test('GameConfigStore persists atomic overrides, hot-syncs runtime modules, and resets cleanly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-config-store-'));
  try {
    const store = new GameConfigStore(dir);
    assert.equal(store.isCustomized(), false);

    const next = structuredClone(DEFAULT_GAME_CONFIG);
    const lotusRule = next.cosmetics.find(entry => entry.id === 'skin-lotus-pond')!;
    lotusRule.humanPrice = 128;
    lotusRule.botPrice = 1280;
    next.economy.exchangeBotPerHuman = 15;
    next.economy.companionHumanWin = 60;
    next.arcade.gambleWinProbability = 0.66;
    next.arcade.ticketHumanPrice = 12;

    const saved = store.save(next);
    assert.equal(store.isCustomized(), true);
    assert.ok(store.updatedAt() > 0);
    assert.equal(saved.economy.exchangeBotPerHuman, 15);
    assert.ok(existsSync(join(dir, 'game-config.json')));
    const diskText = readFileSync(join(dir, 'game-config.json'), 'utf8');
    assert.match(diskText, /"companionHumanWin": 60/);

    // Runtime hot propagation without restart
    assert.equal(getGameConfig().economy.companionHumanWin, 60);
    assert.equal(exchangeBotPerHuman(), 15);
    assert.equal(settlementDelta('companion', 'win', 'human'), 60);
    const lotus = cosmeticById('skin-lotus-pond');
    assert.ok(lotus);
    assert.equal(cosmeticPrice(lotus, 'human'), 128);
    assert.equal(cosmeticPrice(lotus, 'bot'), 1280);

    // Reload from disk via a fresh store instance
    const reloaded = new GameConfigStore(dir);
    assert.equal(reloaded.isCustomized(), true);
    assert.equal(reloaded.get().arcade.ticketHumanPrice, 12);

    // Arcade engine reads live ticket price and gambleWinProbability overrides
    const buyResult = playArcade(
      newArcadeState(),
      { action: 'buy_tickets', count: 1, revision: 0, requestId: 'cfg_buy_ticket_01' },
      {
        currency: 'human',
        balance: 100,
        random: () => 0.1,
        makeId: () => 'id1',
        at: 1000,
      },
    );
    assert.equal(buyResult.coinDelta, -12);
    assert.equal(buyResult.state.tickets, 1);

    const playResult = playArcade(
      buyResult.state,
      { action: 'play', gameId: 'slot-machine', stakeId: 'small', payMode: 'ticket', revision: 0, requestId: 'cfg_play_slot_01' },
      {
        currency: 'human',
        balance: 100,
        random: () => 0.05,
        makeId: () => 'id2',
        at: 1001,
      },
    );
    assert.ok(playResult.state.pendingGamble);
    assert.equal(playResult.state.pendingGamble.winProbability, 0.66);

    const outcome = playArcade(
      playResult.state,
      { action: 'gamble', revision: 0, requestId: 'cfg_gamble_check_01' },
      {
        currency: 'human',
        balance: 0,
        random: () => 0.6,
        makeId: () => 'id3',
        at: 1002,
      },
    );
    assert.equal(outcome.state.pendingGamble?.currentCoins, playResult.state.pendingGamble.initialCoins * 2);

    // Partial reset restores only economy while keeping cosmetic override
    reloaded.reset('economy');
    assert.equal(exchangeBotPerHuman(), DEFAULT_GAME_CONFIG.economy.exchangeBotPerHuman);
    assert.equal(cosmeticPrice(cosmeticById('skin-lotus-pond')!, 'human'), 128);

    // Partial reset restores buffs section cleanly
    const withBuffOverride = reloaded.get();
    withBuffOverride.buffs.rerollCosts = [1, 3, 5];
    withBuffOverride.buffs.buffRounds = [3, 6];
    reloaded.save(withBuffOverride);
    assert.deepEqual(getGameConfig().buffs.rerollCosts, [1, 3, 5]);
    reloaded.reset('buffs');
    assert.deepEqual(getGameConfig().buffs.rerollCosts, DEFAULT_GAME_CONFIG.buffs.rerollCosts);
    assert.deepEqual(getGameConfig().buffs.buffRounds, DEFAULT_GAME_CONFIG.buffs.buffRounds);

    // Partial reset restores pacing section cleanly
    const withPacingOverride = reloaded.get();
    withPacingOverride.pacing.standardStartHp = 135;
    withPacingOverride.pacing.baseInterestCap = 6;
    reloaded.save(withPacingOverride);
    assert.equal(getGameConfig().pacing.standardStartHp, 135);
    assert.equal(getGameConfig().pacing.baseInterestCap, 6);
    reloaded.reset('pacing');
    assert.equal(getGameConfig().pacing.standardStartHp, DEFAULT_GAME_CONFIG.pacing.standardStartHp);
    assert.equal(getGameConfig().pacing.baseInterestCap, DEFAULT_GAME_CONFIG.pacing.baseInterestCap);

    // Full reset restores all defaults and returns runtime to baseline
    reloaded.reset('all');
    assert.equal(reloaded.isCustomized(), false);
    assert.equal(cosmeticPrice(cosmeticById('skin-lotus-pond')!, 'human'), 108);
    assert.equal(settlementDelta('companion', 'win', 'human'), DEFAULT_GAME_CONFIG.economy.companionHumanWin);
  } finally {
    // Ensure global singleton returns to defaults even if an assertion throws
    new GameConfigStore(dir).reset('all');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validateGameConfig rejects invalid prices, out-of-range probabilities, zero weights, and invalid buff schedules', () => {
  assert.throws(() => validateGameConfig(null), /结构无效/);

  const badPrice = structuredClone(DEFAULT_GAME_CONFIG);
  badPrice.cosmetics[0]!.humanPrice = -5;
  assert.throws(() => validateGameConfig(badPrice), /铜钱价格/);

  const badProb = structuredClone(DEFAULT_GAME_CONFIG);
  badProb.arcade.gambleWinProbability = 0.99;
  assert.throws(() => validateGameConfig(badProb), /搏倍胜率/);

  const badTicket = structuredClone(DEFAULT_GAME_CONFIG);
  badTicket.arcade.ticketHumanPrice = 0;
  assert.throws(() => validateGameConfig(badTicket), /单张游乐券铜钱价/);

  const badWeight = structuredClone(DEFAULT_GAME_CONFIG);
  badWeight.odds.slotSymbols[0]!.weight = 0;
  assert.throws(() => validateGameConfig(badWeight), /权重/);

  const badScratchWeight = structuredClone(DEFAULT_GAME_CONFIG);
  badScratchWeight.odds.scratchTiers[0]!.weight = 0;
  assert.throws(() => validateGameConfig(badScratchWeight), /权重/);

  const badStageWeights = structuredClone(DEFAULT_GAME_CONFIG);
  badStageWeights.buffs.stageWeights.stage1 = { common: 0, rare: 0, legendary: 0 };
  assert.throws(() => validateGameConfig(badStageWeights), /品阶权重之和必须大于 0/);

  const badRerollCount = structuredClone(DEFAULT_GAME_CONFIG);
  badRerollCount.buffs.rerollCosts = [1, 2, 3, 4, 5, 6];
  assert.throws(() => validateGameConfig(badRerollCount), /重投次数上限/);

  const badBuffName = structuredClone(DEFAULT_GAME_CONFIG);
  badBuffName.buffs.items[0]!.copy.ai!.name = '   ';
  assert.throws(() => validateGameConfig(badBuffName), /名称/);

  const badStageOrder = structuredClone(DEFAULT_GAME_CONFIG);
  badStageOrder.pacing.damageStages[1]!.maxRound = badStageOrder.pacing.damageStages[0]!.maxRound;
  assert.throws(() => validateGameConfig(badStageOrder), /截至回合必须大于/);
});
