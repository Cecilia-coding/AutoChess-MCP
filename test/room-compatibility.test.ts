import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoomStore } from '../lib/autochess/room-store';

test('rooms from removed packs remain on disk without blocking startup', () => {
  const directory = mkdtempSync(join(tmpdir(), 'autochess-old-room-'));
  const file = join(directory, 'aaaaaaaaaaaa.json');
  const legacy = JSON.stringify({
    version: 1,
    id: 'aaaaaaaaaaaa',
    pack: 'removed-pack',
  });
  try {
    writeFileSync(file, legacy);
    const rooms = new RoomStore(directory);
    assert.throws(
      () => rooms.view({ roomId: 'aaaaaaaaaaaa', token: 'x'.repeat(24) }),
      /房间不存在/,
    );
    assert.equal(readFileSync(file, 'utf8'), legacy);
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), 'autochess-old-room-')));
    rmSync(directory, { recursive: true, force: true });
  }
});
