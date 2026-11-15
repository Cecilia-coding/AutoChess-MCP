import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleOutput } from '../lib/autochess/types';
import {
  consumeBattleAudioEvents,
  createBattleAudioCursor,
  getActiveSoundPackId,
  matchOutcomeSfx,
  roundOutcomeSfx,
  setActiveSoundPack,
  type NoiseBurstOpts,
  type SfxKind,
  type SfxSynthContext,
  type ToneOpts,
} from '../lib/autochess/sound';
import { soundPack, soundPacks } from '../packs/presentation';
import { PACK_LIST } from '../packs/registry';

const ALL_SFX_KINDS: readonly SfxKind[] = [
  'swing',
  'hitLight',
  'hitHeavy',
  'hitSkill',
  'cast',
  'shield',
  'heal',
  'death',
  'battleStart',
  'roundWin',
  'roundLose',
  'roundDraw',
  'matchWin',
  'matchLose',
  'matchDraw',
  'buy',
  'sell',
  'merge',
  'place',
  'reroll',
  'ui',
];

function recordSynthCalls(packId: string, kind: SfxKind) {
  const tones: ToneOpts[] = [];
  const bursts: NoiseBurstOpts[] = [];
  const ctx: SfxSynthContext = {
    t: 1.0,
    scale: 1.0,
    tone: (opts) => tones.push(opts),
    noiseBurst: (opts) => bursts.push(opts),
    jitter: (value) => value,
  };
  soundPack(packId).play(kind, ctx);
  return { tones, bursts };
}

test('combat audio cursor emits hit, cast, shield, heal, death, and outcome cues without duplicates', () => {
  const output: BattleOutput = {
    battleId: 'b-sfx-1',
    rulesVersion: '1',
    configVersion: '1',
    seed: 7,
    outcome: 'left',
    durationMs: 1200,
    ticks: 12,
    keyEvents: [],
    units: [
      {
        id: 'u1',
        team: 'left',
        name: 'Ally',
        templateId: 'a',
        damageDealt: 300,
        healingDone: 50,
        damageTaken: 100,
        casts: 1,
        kills: 1,
        survivingHp: 900,
        maxHp: 1000,
        manaCost: 50,
        manaStart: 0,
      },
      {
        id: 'u2',
        team: 'right',
        name: 'Enemy',
        templateId: 'b',
        damageDealt: 100,
        healingDone: 0,
        damageTaken: 300,
        casts: 0,
        kills: 0,
        survivingHp: 0,
        maxHp: 1000,
        manaCost: 50,
        manaStart: 0,
      },
    ],
    events: [
      { seq: 1, timeMs: 100, type: 'attack', sourceId: 'u1', targetIds: ['u2'], text: 'atk' },
      { seq: 2, timeMs: 180, type: 'damage', sourceId: 'u1', targetIds: ['u2'], value: 80, text: 'light' },
      { seq: 3, timeMs: 300, type: 'cast', sourceId: 'u1', skillId: 'spark', text: 'cast' },
      { seq: 4, timeMs: 350, type: 'damage', sourceId: 'u1', targetIds: ['u2'], skillId: 'spark', value: 110, text: 'skill' },
      { seq: 5, timeMs: 500, type: 'shield', sourceId: 'u1', targetIds: ['u1'], value: 120, text: 'shield' },
      { seq: 6, timeMs: 650, type: 'heal', sourceId: 'u1', targetIds: ['u1'], value: 50, text: 'heal' },
      { seq: 7, timeMs: 800, type: 'damage', sourceId: 'u1', targetIds: ['u2'], value: 260, text: 'crit' },
      { seq: 8, timeMs: 900, type: 'death', sourceId: 'u2', text: 'ko' },
      { seq: 9, timeMs: 1200, type: 'end', text: 'end' },
    ],
  };

  const fired: SfxKind[] = [];
  const cursor = createBattleAudioCursor(output);
  const record = (kind: SfxKind) => fired.push(kind);

  consumeBattleAudioEvents(output, 0, cursor, record);
  consumeBattleAudioEvents(output, 200, cursor, record);
  consumeBattleAudioEvents(output, 400, cursor, record);
  consumeBattleAudioEvents(output, 700, cursor, record);
  consumeBattleAudioEvents(output, 950, cursor, record);
  consumeBattleAudioEvents(output, 1200, cursor, record);
  consumeBattleAudioEvents(output, 1300, cursor, record);

  assert.deepEqual(fired, [
    'battleStart',
    'swing',
    'hitLight',
    'cast',
    'hitSkill',
    'shield',
    'heal',
    'hitHeavy',
    'death',
    'roundWin',
  ]);

  const loseFired: SfxKind[] = [];
  const loseOutput: BattleOutput = { ...output, battleId: 'b-sfx-2', outcome: 'right' };
  consumeBattleAudioEvents(loseOutput, 1200, createBattleAudioCursor(loseOutput), (k) => loseFired.push(k));
  assert.equal(loseFired.at(-1), 'roundLose');

  const suppressedFired: SfxKind[] = [];
  const supOutput: BattleOutput = { ...output, battleId: 'b-sfx-3', outcome: 'draw' };
  consumeBattleAudioEvents(
    supOutput,
    1200,
    createBattleAudioCursor(supOutput),
    (k) => suppressedFired.push(k),
    { suppressOutcome: true },
  );
  assert.equal(suppressedFired.includes('roundDraw'), false);
  assert.equal(suppressedFired.at(-1), 'death');

  assert.equal(roundOutcomeSfx('left'), 'roundWin');
  assert.equal(roundOutcomeSfx('right'), 'roundLose');
  assert.equal(roundOutcomeSfx('draw'), 'roundDraw');
  assert.equal(matchOutcomeSfx('win'), 'matchWin');
  assert.equal(matchOutcomeSfx('loss'), 'matchLose');
  assert.equal(matchOutcomeSfx('draw'), 'matchDraw');
});

test('every declared pack mounts its own valid sound pack and covers all 21 cues', () => {
  assert.ok(soundPacks.length >= 2);
  for (const pack of PACK_LIST) {
    const soundId = pack.presentation?.soundId;
    assert.ok(soundId, `${pack.id} must declare presentation.soundId`);
    const resolved = soundPack(soundId);
    assert.equal(resolved.id, soundId);

    for (const kind of ALL_SFX_KINDS) {
      const { tones, bursts } = recordSynthCalls(soundId, kind);
      assert.ok(tones.length + bursts.length > 0, `${soundId}/${kind} emitted no audio voices`);
      for (const tone of tones) {
        assert.ok(Number.isFinite(tone.duration) && tone.duration > 0, `${soundId}/${kind} invalid tone duration`);
        assert.ok(Number.isFinite(tone.gainPeak) && tone.gainPeak > 0, `${soundId}/${kind} invalid tone gainPeak`);
        assert.ok(Number.isFinite(tone.freqStart) && tone.freqStart >= 20, `${soundId}/${kind} invalid freqStart`);
      }
      for (const burst of bursts) {
        assert.ok(Number.isFinite(burst.duration) && burst.duration > 0, `${soundId}/${kind} invalid burst duration`);
        assert.ok(Number.isFinite(burst.gainPeak) && burst.gainPeak > 0, `${soundId}/${kind} invalid burst gainPeak`);
        assert.ok(Number.isFinite(burst.freqStart) && burst.freqStart >= 60, `${soundId}/${kind} invalid burst freq`);
      }
    }
  }

  for (const kind of ['battleStart', 'cast', 'buy', 'roundWin', 'matchWin'] as const) {
    assert.notDeepEqual(
      recordSynthCalls('jianghu-sound', kind),
      recordSynthCalls('ai-sound', kind),
      `jianghu-sound/${kind} should diverge cleanly from ai-sound`,
    );
  }

  setActiveSoundPack('jianghu-sound');
  assert.equal(getActiveSoundPackId(), 'jianghu-sound');
  setActiveSoundPack(undefined);
  assert.equal(getActiveSoundPackId(), undefined);
});
