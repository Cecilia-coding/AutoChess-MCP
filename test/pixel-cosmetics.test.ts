import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AccountStore } from '../lib/accounts/account-store';
import {
  avatarImage,
  COSMETICS,
  cosmeticImage,
  DEFAULT_BOARD_SKIN,
  frameImage,
  NATIVE_BOARD_SKIN,
} from '../lib/meta/cosmetics';
import {
  resolveEffectiveBoardSkin,
  resolveEffectiveFrame,
} from '../lib/meta/preview-wardrobe';
import {
  applyBoardSkinToAppearance,
  PIXEL_BOARD_SKINS,
  pixelBoardSkin,
} from '../lib/meta/pixel-board-skins';
import { pixelAppearance, pixelAppearances } from '../packs/presentation';
import { fitPixelBoard } from '../lib/autochess/pixel-board';
import {
  BOARD_SCENE_SPECS,
  boardSceneSpec,
  computeStageGeometry,
  hexAlpha,
  mixHex,
  paintTranslucentDragGrid,
  PIXEL_PROPS,
} from '../lib/autochess/pixel-board-decor';

const root = fileURLToPath(new URL('../', import.meta.url));

function decodeSvgDataUrl(url: string): string {
  const prefix = 'data:image/svg+xml;utf8,';
  assert.ok(url.startsWith(prefix), `Expected SVG data URL, got: ${url.slice(0, 48)}`);
  return decodeURIComponent(url.slice(prefix.length));
}

test('every board cosmetic maps to a real 16-bit PNG preview and live board theme', () => {
  const boards = COSMETICS.filter(entry => entry.kind === 'board');
  assert.equal(boards.length, 17);

  const base = pixelAppearance('jianghu-pixels') ?? pixelAppearances[0];
  assert.ok(base, 'Expected at least one registered pack pixel appearance');

  for (const board of boards) {
    const expectedPath = cosmeticImage(board.id);
    assert.match(expectedPath, new RegExp(`^/(pixel-cosmetics/boards|pixel-scenes)/${board.id}\\.png$`));

    const png = readFileSync(`${root}public${expectedPath}`);
    assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${expectedPath} must be valid PNG`);

    const skin = pixelBoardSkin(board.id);
    assert.ok(skin, `Missing pixel board skin for ${board.id}`);

    const themed = applyBoardSkinToAppearance(base, board.id);
    assert.equal(themed.id, base.id);
    assert.equal(themed.publicPath, base.publicPath);
    assert.equal(themed.manifest, base.manifest);
    assert.deepEqual(themed.boardColors, skin.boardColors);
    assert.deepEqual(themed.boardTheme, skin.boardTheme);
    assert.deepEqual(themed.boardDecor, PIXEL_BOARD_SKINS[board.id]!.decor);
  }

  assert.equal(applyBoardSkinToAppearance(base, undefined), base);
});

test('all frame assets and inline avatars/frames render pure crispEdges pixel art', () => {
  const assetFrames = COSMETICS.filter(entry => entry.kind === 'frame' && entry.frameAsset);
  assert.equal(assetFrames.length, 5);
  for (const frame of assetFrames) {
    const asset = frame.frameAsset!;
    assert.equal(cosmeticImage(frame.id), asset.image);
    assert.equal(frameImage(frame.id), asset.image);

    const svg = readFileSync(`${root}public${asset.image}`, 'utf8');
    assert.ok(svg.includes('shape-rendering="crispEdges"'), `${asset.image} should use crispEdges`);
    assert.ok(svg.includes('viewBox="0 0 48 48"'), `${asset.image} should use 48x48 viewBox`);
    assert.ok(!svg.includes('<circle'), `${asset.image} must not contain <circle>`);
    assert.ok(!svg.includes('feGaussianBlur'), `${asset.image} must not contain blur filters`);
  }

  const inlineFrames = COSMETICS.filter(entry => entry.kind === 'frame' && !entry.frameAsset);
  assert.equal(inlineFrames.length, 4);
  for (const frame of inlineFrames) {
    const overlaySvg = decodeSvgDataUrl(frameImage(frame.id)!);
    assert.ok(overlaySvg.includes('shape-rendering="crispEdges"'), `${frame.id} overlay should be crispEdges`);
    assert.ok(!overlaySvg.includes('<circle') && !overlaySvg.includes('Gradient'));

    const cardSvg = decodeSvgDataUrl(cosmeticImage(frame.id));
    assert.ok(cardSvg.includes('shape-rendering="crispEdges"'), `${frame.id} card preview should be crispEdges`);
    assert.ok(!cardSvg.includes('<circle') && !cardSvg.includes('Gradient'));
  }

  const alice1 = avatarImage('alice-seed');
  const alice2 = avatarImage('alice-seed');
  const bob = avatarImage('bob-seed');
  assert.equal(alice1, alice2);
  assert.notEqual(alice1, bob);

  const avatarSvg = decodeSvgDataUrl(alice1);
  assert.ok(avatarSvg.includes('shape-rendering="crispEdges"'));
  assert.ok(!avatarSvg.includes('<circle') && !avatarSvg.includes('Gradient'));
});

test('复苏季节 (skin-revival) is initial default, cannot be bought or gifted, and supports switching', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autochess-board-explicit-'));
  try {
    const store = new AccountStore(dir);
    const created = store.register('PixelTester', 'password-123');
    const accountId = store.selfAccount(created.token).id;
    const invite = store.issueAiInvite(created.token);
    const ai = store.registerAiWithInvite(invite.invite, 'TestBot', 'password-123');

    // 1. Fresh account owns and defaults to DEFAULT_BOARD_SKIN (复苏季节).
    const initial = store.selfAccount(created.token);
    assert.ok(initial.owned.includes(DEFAULT_BOARD_SKIN));
    assert.equal(initial.equipped.board, DEFAULT_BOARD_SKIN);
    assert.equal(store.seatIdentity(accountId).skinId, DEFAULT_BOARD_SKIN);

    // 2. Default skin cannot be bought or gifted, even with sufficient funds.
    store.grantCoins(accountId, 'human', 500);
    assert.throws(() => store.buyCosmetic(created.token, DEFAULT_BOARD_SKIN), /初始默认/);
    assert.throws(() => store.giftCosmetic(created.token, ai.account.id, DEFAULT_BOARD_SKIN), /初始默认外观不可赠送/);

    // 3. Purchasing & equipping 玫瑰古堡 switches cleanly, and equipping 复苏季节 restores default.
    const withRose = store.buyCosmetic(created.token, 'skin-rose-court');
    assert.equal(withRose.equipped.board, 'skin-rose-court');
    assert.equal(store.seatIdentity(accountId).skinId, 'skin-rose-court');

    const backToRevival = store.equipCosmetic(created.token, DEFAULT_BOARD_SKIN);
    assert.equal(backToRevival.equipped.board, DEFAULT_BOARD_SKIN);
    assert.equal(store.seatIdentity(accountId).skinId, DEFAULT_BOARD_SKIN);

    // 4. Explicit NATIVE_BOARD_SKIN clears seat skinId while keeping 复苏季节 owned.
    const nativeMode = store.equipCosmetic(created.token, NATIVE_BOARD_SKIN);
    assert.equal(nativeMode.equipped.board, undefined);
    assert.ok(nativeMode.owned.includes(DEFAULT_BOARD_SKIN));
    assert.equal(store.seatIdentity(accountId).skinId, undefined);

    // 5. Persisted legacy saves without board skin default to 复苏季节; explicit custom skin stays active.
    const file = join(dir, 'accounts.json');
    const saved = JSON.parse(readFileSync(file, 'utf8')) as { accounts: Array<{ id: string; cosmetics?: { owned: string[]; equipped: { board?: string }; boardExplicit?: boolean } }> };
    const record = saved.accounts.find(a => a.id === accountId)!;
    delete record.cosmetics!.boardExplicit;
    delete record.cosmetics!.equipped.board;
    writeFileSync(file, JSON.stringify(saved), 'utf8');

    const reloadedDefault = new AccountStore(dir);
    assert.equal(reloadedDefault.seatIdentity(accountId).skinId, DEFAULT_BOARD_SKIN);
    assert.equal(reloadedDefault.selfAccount(created.token).equipped.board, DEFAULT_BOARD_SKIN);

    record.cosmetics!.equipped.board = 'skin-rose-court';
    writeFileSync(file, JSON.stringify(saved), 'utf8');

    const reloadedExplicit = new AccountStore(dir);
    assert.equal(reloadedExplicit.seatIdentity(accountId).skinId, 'skin-rose-court');
    assert.equal(reloadedExplicit.selfAccount(created.token).equipped.board, 'skin-rose-court');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preview wardrobe resolves sandbox board and frame overrides without mutating non-sandbox behavior', () => {
  // Non-sandbox sessions ignore local preview state and preserve equipped seat cosmetics.
  assert.equal(
    resolveEffectiveBoardSkin({
      sandbox: false,
      previewBoard: 'skin-bloodnight',
      seatSkinId: 'skin-rose-court',
    }),
    'skin-rose-court',
  );
  assert.equal(
    resolveEffectiveFrame({
      sandbox: false,
      previewFrame: 'frame-royal',
      seatFrame: 'frame-ember',
    }),
    'frame-ember',
  );

  // Sandbox without active override keeps the equipped seat cosmetic.
  assert.equal(
    resolveEffectiveBoardSkin({ sandbox: true, seatSkinId: 'skin-rose-court' }),
    'skin-rose-court',
  );
  assert.equal(
    resolveEffectiveFrame({ sandbox: true, seatFrame: 'frame-ember' }),
    'frame-ember',
  );

  // Sandbox preview overrides work for retired/wheel cosmetics too.
  assert.equal(
    resolveEffectiveBoardSkin({
      sandbox: true,
      previewBoard: 'skin-bloodnight',
      seatSkinId: 'skin-rose-court',
    }),
    'skin-bloodnight',
  );
  assert.equal(
    resolveEffectiveFrame({
      sandbox: true,
      previewFrame: 'frame-royal',
      seatFrame: 'frame-ember',
    }),
    'frame-royal',
  );

  // Switching preview to NATIVE_BOARD_SKIN yields undefined so pack-native board styling shows through.
  assert.equal(
    resolveEffectiveBoardSkin({
      sandbox: true,
      previewBoard: NATIVE_BOARD_SKIN,
      seatSkinId: 'skin-rose-court',
    }),
    undefined,
  );
});

test('all 17 cosmetic boards and pack-native boards define complete pixel scene specs and valid prop sprites', () => {
  // Validate every pixel prop sprite has uniform width and every glyph resolves in every theme palette.
  for (const [propName, rows] of Object.entries(PIXEL_PROPS)) {
    assert.ok(rows.length >= 8, `${propName} sprite should have >= 8 rows`);
    const widths = new Set(rows.map(r => r.length));
    assert.equal(widths.size, 1, `${propName} sprite rows must have equal width`);
    const width = rows[0]!.length;
    assert.ok(width >= 10, `${propName} sprite width should be >= 10`);
  }

  for (const [motif, spec] of Object.entries(BOARD_SCENE_SPECS)) {
    for (const propKey of [spec.innerProp, spec.outerProp]) {
      const sprite = PIXEL_PROPS[propKey];
      assert.ok(sprite, `Missing sprite ${propKey} for ${motif}`);
      for (const row of sprite) {
        for (const ch of row) {
          if (ch === '.') continue;
          const color = spec.propPalette[ch as keyof typeof spec.propPalette];
          assert.ok(color && color.startsWith('#'), `${motif}.${propKey} missing palette color for glyph '${ch}'`);
        }
      }
    }
    assert.ok(hexAlpha(spec.floorAccent, 0.5).startsWith('rgba('));
    assert.ok(mixHex(spec.floorAccent, spec.floorHighlight, 0.5).startsWith('#'));
  }

  // Every cosmetic skin maps to a valid scene spec
  const boards = COSMETICS.filter(entry => entry.kind === 'board');
  for (const board of boards) {
    const skin = pixelBoardSkin(board.id)!;
    const spec = boardSceneSpec(skin.decor.cornerMotif);
    assert.equal(spec.motif, skin.decor.cornerMotif);
  }

  // Both pack-native appearances carry distinct boardDecor motifs
  for (const packApp of pixelAppearances) {
    assert.ok(packApp.boardDecor?.cornerMotif, `${packApp.id} should define pack-native boardDecor`);
    const spec = boardSceneSpec(packApp.boardDecor.cornerMotif);
    assert.equal(spec.motif, packApp.boardDecor.cornerMotif);
  }

  // Stage geometry remains valid across mobile and desktop viewports
  for (const [w, h] of [[390, 760], [1280, 820]] as const) {
    const fitted = fitPixelBoard(w, h);
    const geom = computeStageGeometry(fitted.board);
    assert.ok(geom.stageWidth >= geom.gridW);
    assert.ok(geom.panelTop + geom.panelHeight <= fitted.board.height);
    assert.ok(geom.gridTop > 50 && geom.benchY > geom.gridTop + geom.gridH);
  }
});

test('translucent drag grid draws nothing at rest and paints overlay slots only while dragging', () => {
  const fitted = fitPixelBoard(1280, 820);
  const fills: number[] = [];
  const fakeCtx = {
    fillStyle: '',
    save() {},
    restore() {},
    fillRect(x: number, _y: number, w: number, h: number) {
      if (w > 0 && h > 0) fills.push(x);
    },
  } as unknown as CanvasRenderingContext2D;

  paintTranslucentDragGrid(fakeCtx, fitted.board, undefined, 0, null);
  assert.equal(fills.length, 0, 'idle canvas (alpha=0) must draw zero grid rectangles');

  paintTranslucentDragGrid(fakeCtx, fitted.board, undefined, 1, { row: 5, col: 2 });
  assert.ok(fills.length > 40, 'active drag overlay must draw translucent slots over the board');
});

test('every board skin links to a bespoke outer UI & pixel button theme with crisp micro-ornament charms', () => {
  const roomApp = readFileSync(`${root}components/autochess/room-app.tsx`, 'utf8');
  assert.ok(
    roomApp.includes('data-board-skin={equippedBoard || undefined}'),
    'room-app.tsx should bind data-board-skin on main.room-table when a board skin is active',
  );

  const roomCss = readFileSync(`${root}components/autochess/pixel-ui/room.css`, 'utf8');
  const boards = COSMETICS.filter(entry => entry.kind === 'board');
  for (const board of boards) {
    const selector = `.pixel-game.room-table[data-board-skin="${board.id}"]`;
    assert.ok(roomCss.includes(selector), `room.css should define linked button/UI skin for ${board.id}`);
  }
  assert.ok(roomCss.includes('--sk-charm-svg:'), 'room.css should define crisp pixel micro-ornament charms');
  assert.ok(
    roomCss.includes('.pixel-game.room-table[data-board-skin] .peach-shop-actions button::after'),
    'outer shop buttons should display linked pixel micro-ornaments',
  );
  assert.ok(
    roomCss.includes('.pixel-game.room-table[data-board-skin] .pixel-action-cell .pixel-primary::before'),
    'primary battle CTA should display linked pixel corner charms',
  );
});
