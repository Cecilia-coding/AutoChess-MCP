import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { BOARD_SCENES } from '../lib/meta/board-scenes.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const expected = [
  ['rose-court', 'rose-court.png'],
  ['time-astrolabe', 'time-astrolabe.png'],
  ['time-astrolabe-ivory', 'time-astrolabe-ivory.png'],
  ['revival-season', 'revival-season.png'],
  ['bamboo-pool', 'bamboo-pool.png'],
  ['tidal-ruins', 'tidal-ruins.jpg'],
  ['xuantian-platform', 'xuantian-platform.jpg'],
  ['golden-scales', 'golden-scales.jpg'],
] as const;

test('every artwork board has its public image', () => {
  for (const [id, file] of expected) {
    const scene = BOARD_SCENES.find(entry => entry.id === id);
    assert.ok(scene?.artwork, `${id} should have an artwork scene`);
    assert.equal(scene.artwork.image, `/boards/${file}`);

    const image = readFileSync(`${root}public/boards/${file}`);
    assert.ok(image.length > 800_000, `${file} should contain the full artwork`);
    if (file.endsWith('.png')) {
      assert.deepEqual([...image.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    } else {
      assert.deepEqual([...image.subarray(0, 2)], [0xff, 0xd8]);
    }
  }
});

test('the public scene registry exposes all eight artwork boards and a light garden fallback', () => {
  assert.equal(new Set(BOARD_SCENES.map(scene => scene.id)).size, BOARD_SCENES.length);
  assert.deepEqual(
    BOARD_SCENES.filter(scene => scene.artwork).map(scene => scene.id),
    expected.map(([id]) => id),
  );
  assert.equal(BOARD_SCENES.find(scene => scene.id === 'garden')?.artwork, null);
});
