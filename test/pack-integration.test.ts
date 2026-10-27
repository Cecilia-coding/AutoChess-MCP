import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { getSkill } from '../content/autochess/skills';
import { unitSkill } from '../content/autochess/unit-skills';
import { simulateBattle } from '../lib/autochess/combat';
import { RoomStore } from '../lib/autochess/room-store';
import type { Combatant, Star } from '../lib/autochess/types';
import { LOBBY_MODES } from '../packs/modes/registry';
import { PACK_LIST } from '../packs/registry';

const directory = mkdtempSync(join(tmpdir(), 'autochess-pack-integration-'));
after(() => rmSync(directory, { recursive: true, force: true }));

test('every pack has closed references and every roster unit completes a battle', () => {
  let battles = 0;

  for (const pack of PACK_LIST) {
    const units = [...pack.roster, ...(pack.forms ?? [])];
    const unitIds = new Set(units.map((unit) => unit.id));
    const traitIds = new Set(pack.traits.map((trait) => trait.id));
    const itemIds = new Set(pack.items.map((item) => item.id));

    assert.ok(pack.roster.length > 0, `${pack.id} has no playable units`);
    assert.ok(pack.items.length > 0, `${pack.id} has no items`);

    for (const unit of units) {
      for (const traitId of [...unit.factions, ...unit.jobs]) {
        assert.ok(traitIds.has(traitId), `${pack.id}/${unit.id} references unknown trait ${traitId}`);
      }
      if (!unitSkill(unit.id)) assert.doesNotThrow(() => getSkill(unit.autochessSkillId ?? unit.skillId));
    }
    for (const item of pack.items) {
      for (const traitId of item.grantTraits ?? []) {
        assert.ok(traitIds.has(traitId), `${pack.id}/${item.id} grants unknown trait ${traitId}`);
      }
    }
    for (const itemId of pack.opening?.tiers.flat() ?? []) {
      assert.ok(itemIds.has(itemId), `${pack.id} opening references unknown item ${itemId}`);
    }
    for (const skillId of Object.keys(pack.skills ?? {})) {
      assert.ok(unitIds.has(skillId), `${pack.id} declares a skill for unknown unit ${skillId}`);
    }

    for (const [index, left] of pack.roster.entries()) {
      const right = pack.roster[(index + 1) % pack.roster.length]!;
      const fighter = (unitId: string, side: string, offset: number): Combatant => ({
        id: `${side}-${index}`,
        templateId: unitId,
        star: ((offset % 3) + 1) as Star,
        localRow: side === 'left' ? 3 : 0,
        localCol: offset % 4,
        itemIds: pack.items.length ? [pack.items[offset % pack.items.length]!.id] : [],
      });
      const output = simulateBattle({
        battleId: `pack-smoke-${pack.id}-${index}`,
        seed: 1000 + index,
        left: [fighter(left.id, 'left', index)],
        right: [fighter(right.id, 'right', index + 1)],
      });
      assert.ok(['left', 'right', 'draw'].includes(output.outcome));
      assert.ok(output.units.length >= 2);
      battles += 1;
    }
  }

  assert.equal(battles, PACK_LIST.reduce((total, pack) => total + pack.roster.length, 0));
});

test('every public pack and mode can start, battle, persist and reload', () => {
  for (const pack of PACK_LIST) {
    for (const mode of LOBBY_MODES) {
      const roomDirectory = join(directory, `${pack.id}-${mode.id}`);
      const store = new RoomStore(roomDirectory);
      const created = store.create('测试棋手', pack.id, undefined, undefined, mode.id);
      const credentials = { roomId: created.roomId, token: created.token };
      let view = store.start(credentials);

      assert.equal(view.pack, pack.id);
      assert.equal(view.mode, mode.id);

      if (view.self?.swordOffer) {
        view = store.mutate({
          ...credentials,
          round: view.round,
          revision: view.self.revision,
          requestId: `sword-${pack.id}-${mode.id}`,
          action: { kind: 'pick_sword', item: view.self.swordOffer.choices[0]! },
        });
      }

      const piece = view.self?.bench?.[0];
      assert.ok(piece);
      view = store.mutate({
        ...credentials,
        round: view.round,
        revision: view.self!.revision,
        requestId: `move-${pack.id}-${mode.id}`,
        action: { kind: 'move', piece: piece.id, row: 3, col: 2 },
      });
      view = store.mutate({
        ...credentials,
        round: view.round,
        revision: view.self!.revision,
        requestId: `ready-${pack.id}-${mode.id}`,
        action: { kind: 'ready' },
      });

      assert.ok(view.battle || view.round > 1 || view.phase === 'finished');
      const restored = new RoomStore(roomDirectory).view(credentials);
      assert.equal(restored.pack, pack.id);
      assert.ok(restored.round >= view.round);
    }
  }
});
