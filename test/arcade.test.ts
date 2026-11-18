import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountStore, type AccountFile } from '../lib/accounts/account-store';
import { EchoTreeStore } from '../lib/accounts/echo-tree-store';
import { ARCADE_GAMBLE_RULES, ARCADE_RELIEF_RULES, ARCADE_STARTER_TICKETS, ARCADE_STAKES } from '../lib/meta/arcade';
import { slotMachineGame } from '../lib/meta/arcade-games/slot-machine';
import { scratchcardGame } from '../lib/meta/arcade-games/scratchcard';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('slot machine and scratchcard have >50% bust probability and negative base EV (<1.0x)', () => {
  const stake = ARCADE_STAKES[0]!;
  for (const [name, game] of [['slot-machine', slotMachineGame], ['scratchcard', scratchcardGame]] as const) {
    const rng = mulberry32(42);
    const rounds = 10_000;
    let busts = 0;
    let totalMult = 0;
    for (let i = 0; i < rounds; i++) {
      const outcome = game.play({ stake, random: rng });
      if (!outcome.won || outcome.multiplier === 0) busts++;
      totalMult += outcome.multiplier;
    }
    const bustRate = busts / rounds;
    const ev = totalMult / rounds;
    assert.ok(bustRate > 0.52, `${name} bustRate=${bustRate.toFixed(3)} expected > 0.52`);
    assert.ok(ev < 1.0, `${name} base EV=${ev.toFixed(3)} expected < 1.0`);
  }
});

test('arcade gamble-double mechanics: cash_out vs gamble double win/bust and replay safety', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-arcade-gamble-'));
  try {
    // Seed 2026 vs controlled queue for exact slot/scratch & gamble outcomes:
    // Scratch tier 0.70 => 'small' (weight 635..855 => 1.5x, base chance 0 => no cosmetic roll).
    // Gamble roll 0.1 < winProbability(0.45) => win double!
    // Next round: tier 0.70 => 1.5x, gamble roll 0.9 >= 0.45 => bust to 0!
    let rolls = [
      // Round 1 (scratchcard, small stake: 8 human coins or 1 ticket -> base 8 * 1.5 = 12 coins):
      0.70, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
    ];
    let idx = 0;
    const rng = () => rolls[Math.min(idx++, rolls.length - 1)]!;
    const echo = new EchoTreeStore(dir);
    const accounts = new AccountStore(dir, echo, { enabled: true, echoScope: 'none', random: rng });
    const user = accounts.register('赌侠甲', 'password123');

    // Give user some coins via match settlement (win => travel/companion reward + 1 arcade ticket).
    accounts.settleMatch({
      roomId: 'room-seed-1',
      round: 5,
      entries: [{ accountId: user.account.id, place: 1, outcome: 'win' }],
    });
    const baseCoins = accounts.arcadeView(user.token).wallet.human;
    assert.ok(baseCoins > 0);

    let view = accounts.arcadeAction(user.token, { action: 'start', requestId: 'req-start-1', revision: 0 });
    assert.equal(view.state.tickets, 1 + ARCADE_STARTER_TICKETS);

    // Play 1st scratchcard WITHOUT autoCashOut so pendingGamble opens.
    view = accounts.arcadeAction(user.token, {
      action: 'play',
      gameId: 'scratchcard',
      stakeId: 'small',
      payMode: 'ticket',
      autoCashOut: false,
      requestId: 'req-play-1',
      revision: view.state.revision,
    });
    assert.ok(view.state.pendingGamble);
    assert.equal(view.state.pendingGamble!.currentCoins, 12);

    // Replay same requestId must return exact same revision & not spend another ticket.
    const replay = accounts.arcadeAction(user.token, {
      action: 'play',
      gameId: 'scratchcard',
      stakeId: 'small',
      payMode: 'ticket',
      autoCashOut: false,
      requestId: 'req-play-1',
      revision: view.state.revision - 1,
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.state.tickets, ARCADE_STARTER_TICKETS);

    // Trying to play another round while pendingGamble is open must fail.
    assert.throws(() => accounts.arcadeAction(user.token, {
      action: 'play',
      gameId: 'scratchcard',
      stakeId: 'small',
      payMode: 'ticket',
      requestId: 'req-play-blocked',
      revision: view.state.revision,
    }), /见好就收|搏倍/);

    // Gamble once and win (next roll 0.1 < ARCADE_GAMBLE_RULES.winProbability).
    rolls = [0.1];
    idx = 0;
    view = accounts.arcadeAction(user.token, {
      action: 'gamble',
      requestId: 'req-gamble-win',
      revision: view.state.revision,
    });
    assert.ok(view.state.pendingGamble);
    assert.equal(view.state.pendingGamble!.currentCoins, 24);
    assert.equal(view.state.pendingGamble!.doublesUsed, 1);

    // Cash out (+24 copper on top of baseCoins).
    view = accounts.arcadeAction(user.token, {
      action: 'cash_out',
      requestId: 'req-cashout-1',
      revision: view.state.revision,
    });
    assert.equal(view.state.pendingGamble, null);
    assert.equal(view.wallet.human, baseCoins + 24);
    const coinsAfterCashout = view.wallet.human;

    // Round 2: buy tickets with coins & test coin stake + gamble bust to 0!
    view = accounts.arcadeAction(user.token, {
      action: 'buy_tickets',
      count: 1,
      requestId: 'req-buy-tix',
      revision: view.state.revision,
    });
    const coinsAfterTicket = coinsAfterCashout - view.ticketShop.packPrice;
    assert.equal(view.wallet.human, coinsAfterTicket);
    assert.equal(view.state.tickets, ARCADE_STARTER_TICKETS + 1);

    rolls = [0.70, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    idx = 0;
    view = accounts.arcadeAction(user.token, {
      action: 'play',
      gameId: 'scratchcard',
      stakeId: 'small',
      payMode: 'coin',
      autoCashOut: false,
      requestId: 'req-play-2',
      revision: view.state.revision,
    });
    const coinsAfterBet = coinsAfterTicket - ARCADE_STAKES[0]!.humanCost;
    assert.equal(view.wallet.human, coinsAfterBet);
    assert.ok(view.state.pendingGamble);

    // Gamble and bust! (0.9 >= 0.45)
    rolls = [Math.min(0.99, ARCADE_GAMBLE_RULES.winProbability + 0.3)];
    idx = 0;
    view = accounts.arcadeAction(user.token, {
      action: 'gamble',
      requestId: 'req-gamble-bust',
      revision: view.state.revision,
    });
    assert.equal(view.state.pendingGamble, null);
    assert.equal(view.wallet.human, coinsAfterBet);
    assert.equal(view.state.stats.totalGambledBusts, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('match settlement awards differentiated arcade tickets for wins only and migrates legacy wheel prizes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-arcade-settle-'));
  try {
    const accounts = new AccountStore(dir, undefined, { enabled: true });
    const human = accounts.register('棋手主', 'password123');
    const invite = accounts.issueAiInvite(human.token);
    const ai = accounts.registerAiWithInvite(invite.invite, '旅伴机', 'ai-password-123');

    // Travel win for AI (human NOT present in participants): +2 tickets for AI!
    const travel = accounts.settleMatch({
      roomId: 'room-travel-win',
      round: 5,
      participants: [ai.account.id],
      entries: [{ accountId: ai.account.id, place: 1, outcome: 'win' }],
    });
    assert.equal(travel.receipts[ai.account.id]?.arcadeTickets, 2);
    assert.equal(accounts.arcadeView(ai.token).state.tickets, 2);

    // Companion loss for human / companion win for human: win => +1 ticket, loss => +0 tickets.
    const comp = accounts.settleMatch({
      roomId: 'room-comp-mixed',
      round: 5,
      participants: [human.account.id, ai.account.id],
      entries: [
        { accountId: human.account.id, place: 1, outcome: 'win' },
        { accountId: ai.account.id, place: 2, outcome: 'loss' },
      ],
    });
    assert.equal(comp.receipts[human.account.id]?.arcadeTickets, 1);
    assert.equal(comp.receipts[ai.account.id]?.arcadeTickets ?? 0, 0);

    // Inject a legacy wheel prize into accounts.json and reload AccountStore to verify automatic migration.
    const file = join(dir, 'accounts.json');
    const persisted = JSON.parse(readFileSync(file, 'utf8')) as AccountFile;
    const targetAccount = persisted.accounts.find(a => a.id === human.account.id)!;
    targetAccount.wheel = {
      prizes: [
        {
          id: 'legacy-prize-1',
          spec: { id: 'olive', name: '灵橄 · 衔春', icon: '🕊️', reward: { kind: 'cosmetic', cosmeticId: 'frame-revival-olive' }, giftable: true },
          at: Date.now() - 10_000,
          source: 'gift',
          status: 'pending',
          from: { id: ai.account.id, name: ai.account.username },
          note: '旧转盘留存的心意',
        },
      ],
    };
    writeFileSync(file, JSON.stringify(persisted), 'utf8');

    const reloaded = new AccountStore(dir, undefined, { enabled: true });
    const { account: _, token } = reloaded.login('棋手主', 'password123');
    const migratedView = reloaded.arcadeView(token);
    assert.equal(migratedView.state.prizes.length, 1);
    assert.equal(migratedView.state.prizes[0]!.id, 'legacy-prize-1');
    assert.equal(migratedView.state.prizes[0]!.note, '旧转盘留存的心意');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('arcade daily bankruptcy relief grants tickets only when broke and enforces dailyLimit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-arcade-relief-'));
  try {
    let dayMs = Date.UTC(2026, 10, 15, 10, 0, 0);
    // Always bust on slot machine (roll 0.99 => bomb/bust, 0 coins, 0 cosmetic drop).
    const accounts = new AccountStore(dir, undefined, {
      enabled: true,
      echoScope: 'none',
      now: () => dayMs,
      random: () => 0.99,
    });
    const user = accounts.register('零元侠', 'password123');

    // Cannot claim relief before starterClaimed.
    assert.throws(() => accounts.arcadeAction(user.token, {
      action: 'relief',
      requestId: 'relief-too-early',
      revision: 0,
    }), /试玩券/);

    let view = accounts.arcadeAction(user.token, { action: 'start', requestId: 'relief-start', revision: 0 });
    assert.equal(view.state.tickets, ARCADE_STARTER_TICKETS);
    assert.equal(view.relief.eligible, false);

    // Spend all starter tickets with busts until truly broke (0 tickets, 0 coins).
    for (let i = 0; i < ARCADE_STARTER_TICKETS; i++) {
      view = accounts.arcadeAction(user.token, {
        action: 'play',
        gameId: 'slot-machine',
        stakeId: 'small',
        payMode: 'ticket',
        requestId: `relief-bust-starter-${i}`,
        revision: view.state.revision,
      });
    }
    assert.equal(view.state.tickets, 0);
    assert.equal(view.wallet.human, 0);
    assert.equal(view.relief.eligible, true);
    assert.equal(view.relief.remainingToday, ARCADE_RELIEF_RULES.dailyLimit);

    // Exhaust daily relief quota; each grant must fail cleanly once remainingToday reaches 0.
    for (let d = 0; d < ARCADE_RELIEF_RULES.dailyLimit; d++) {
      const revBefore = view.state.revision;
      const grantReq = `relief-grant-${d}`;
      view = accounts.arcadeAction(user.token, {
        action: 'relief',
        requestId: grantReq,
        revision: revBefore,
      });
      assert.equal(view.state.tickets, ARCADE_RELIEF_RULES.tickets);
      assert.equal(view.relief.usedToday, d + 1);
      assert.equal(view.relief.eligible, false);

      // Replay safety on relief action.
      const replayed = accounts.arcadeAction(user.token, {
        action: 'relief',
        requestId: grantReq,
        revision: revBefore,
      });
      assert.equal(replayed.replayed, true);
      assert.equal(replayed.state.tickets, ARCADE_RELIEF_RULES.tickets);

      // Cannot claim relief while still holding tickets.
      assert.throws(() => accounts.arcadeAction(user.token, {
        action: 'relief',
        requestId: `relief-blocked-${d}`,
        revision: view.state.revision,
      }), /够开下一局/);

      for (let t = 0; t < ARCADE_RELIEF_RULES.tickets; t++) {
        view = accounts.arcadeAction(user.token, {
          action: 'play',
          gameId: 'slot-machine',
          stakeId: 'small',
          payMode: 'ticket',
          requestId: `relief-spend-${d}-${t}`,
          revision: view.state.revision,
        });
      }
    }

    assert.equal(view.relief.eligible, false);
    assert.equal(view.relief.remainingToday, 0);
    assert.throws(() => accounts.arcadeAction(user.token, {
      action: 'relief',
      requestId: 'relief-exhausted',
      revision: view.state.revision,
    }), /今日低保救济已领完/);

    // Next UTC day resets quota cleanly.
    dayMs += 24 * 60 * 60 * 1000;
    const nextDayView = accounts.arcadeView(user.token);
    assert.equal(nextDayView.relief.usedToday, 0);
    assert.equal(nextDayView.relief.remainingToday, ARCADE_RELIEF_RULES.dailyLimit);
    assert.equal(nextDayView.relief.eligible, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
