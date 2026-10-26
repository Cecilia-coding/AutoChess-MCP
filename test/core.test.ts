import assert from 'node:assert/strict';
import test from 'node:test';
import { lootForRoster } from '../content/autochess/items';
import { aiRoster } from '../packs/ai/roster';
import { aiItems } from '../packs/ai/items';
import { jianghuRoster } from '../packs/jianghu/roster';
import { jianghuItems } from '../packs/jianghu/items';
import { PACKS, packKitItems, packRoster, parsePackId } from '../packs/registry';
import { findUnit } from '../content/autochess/units';
import { simulateBattle } from '../lib/autochess/combat';
import { pickDraftItem } from '../lib/autochess/core';
import type { Rng } from '../lib/autochess/rng';
import type { Combatant } from '../lib/autochess/types';

const fighter = (templateId: string, id: string, row = 3): Combatant => ({
  id,
  templateId,
  star: 1,
  localRow: row,
  localCol: 2,
  itemIds: [],
});

test('the public registry contains only the maintained packs', () => {
  assert.deepEqual(Object.keys(PACKS), ['ai', 'jianghu']);
  assert.equal(parsePackId(undefined), 'ai');
  assert.equal(parsePackId('jianghu'), 'jianghu');
  assert.throws(() => parsePackId('unknown-pack'));
});

test('every public roster entry resolves through the shared unit registry', () => {
  for (const unit of [...aiRoster, ...jianghuRoster]) assert.equal(findUnit(unit.id)?.id, unit.id);
  assert.deepEqual(packRoster('ai').map((unit) => unit.id), aiRoster.map((unit) => unit.id));
});

test('each public pack uses its own complete item pool and kit reward', () => {
  const aiLoot = lootForRoster(aiRoster);
  const jianghuLoot = lootForRoster(jianghuRoster);
  const families = ['epic', 'orange', 'purple', 'white'];

  assert.ok(aiLoot.every((item) => item.id.startsWith('ai-') || item.id.startsWith('rp-')));
  assert.ok(jianghuLoot.every((item) => item.id.startsWith('jh-') || item.id.startsWith('rp-')));
  assert.deepEqual([...new Set(aiItems.map((item) => item.family))].sort(), families);
  assert.deepEqual([...new Set(jianghuItems.map((item) => item.family))].sort(), families);
  assert.ok(packKitItems('ai').every((id) => aiItems.some((item) => item.id === id)));
  assert.ok(packKitItems('jianghu').every((id) => jianghuItems.some((item) => item.id === id)));
});

test('draft items are tiered by family without relying on id prefixes', () => {
  const sameTier: Rng = { next: () => 0, int: () => 0 };
  const adjacentTier: Rng = { next: () => 0.99, int: () => 0 };
  const neutralIds = aiItems.map((item, index) => ({ ...item, id: `item-${index}` }));

  assert.equal(pickDraftItem(neutralIds, 1, sameTier).family, 'white');
  assert.equal(pickDraftItem(neutralIds, 1, adjacentTier).family, 'purple');
  assert.throws(() => pickDraftItem([], 1, sameTier), /empty draft loot/);
});

test('the AI pack completes a deterministic battle', () => {
  const output = simulateBattle({
    battleId: 'public-smoke',
    seed: 42,
    left: [fighter('ai-manus', 'left-agent')],
    right: [fighter('ai-hunyuan', 'right-agent', 0)],
  });
  assert.ok(['left', 'right', 'draw'].includes(output.outcome));
  assert.ok(output.events.some((event) => event.type === 'attack' || event.type === 'damage'));
  assert.equal(output.units.length, 2);
});
