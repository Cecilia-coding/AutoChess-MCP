import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { simulateBattle } from "../lib/autochess/combat";
import { packDefinition } from "../packs/registry";
import { pixelAppearance, pixelPortrait } from "../packs/presentation";
import { jianghuItems, jianghuRoster } from "../packs/jianghu";
import { jianghuPixelAppearance } from "../packs/jianghu/presentation/appearance";
import { jianghuPixelEffects } from "../packs/jianghu/presentation/effects";
import { itemImage } from "../lib/meta/cosmetics";

function pngInfo(path: string) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} must be a PNG`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
  };
}

test("jianghu pack uses pixel-2d presentation and covers all 40 roster units", () => {
  const pack = packDefinition("jianghu");
  assert.deepEqual(pack.presentation, {
    renderer: "pixel-2d",
    appearanceId: "jianghu-pixels",
    soundId: "jianghu-sound",
  });
  const appearance = pixelAppearance(pack.presentation?.appearanceId);
  assert.equal(appearance?.id, "jianghu-pixels");

  assert.equal(jianghuRoster.length, 40);
  const manifestIds = new Set(jianghuPixelAppearance.manifest.units.map((u) => u.id));
  for (const unit of jianghuRoster) {
    assert.ok(manifestIds.has(unit.id), `Missing pixel manifest entry for ${unit.id}`);
    const entry = jianghuPixelAppearance.manifest.units.find((u) => u.id === unit.id)!;
    const atlas = pngInfo(`${jianghuPixelAppearance.source}/${entry.atlas}`);
    assert.equal(atlas.width, 512);
    assert.equal(atlas.height, 1088);
    assert.equal(atlas.colorType, 6, `${unit.id} atlas must be RGBA`);

    const portrait = pngInfo(`${jianghuPixelAppearance.source}/${entry.portrait}`);
    assert.equal(portrait.width, 72);
    assert.equal(portrait.height, 72);
    assert.equal(portrait.colorType, 6, `${unit.id} portrait must be RGBA`);

    const url = pixelPortrait(unit.id);
    assert.ok(url?.startsWith("/pixel-jianghu/portraits/jh-"), `Unexpected portrait URL for ${unit.id}: ${url}`);
  }
});

test("jianghu runtimeFiles exist on disk and match compiled battle effect cues", async () => {
  const files = await jianghuPixelAppearance.runtimeFiles();
  const unique = new Set(files);
  for (const file of files) {
    assert.ok(existsSync(`${jianghuPixelAppearance.source}/${file}`), `Missing runtime file: ${file}`);
  }

  const output = simulateBattle({
    battleId: "jh-pixel-smoke",
    seed: 20261114,
    left: [
      { id: "l1", templateId: "jh-boatgirl", star: 1, localRow: 2, localCol: 1, itemIds: ["jh-travel-lantern"] },
      { id: "l2", templateId: "jh-escort", star: 2, localRow: 0, localCol: 2, itemIds: [] },
      { id: "l3", templateId: "jh-secretary", star: 1, localRow: 3, localCol: 3, itemIds: [] },
    ],
    right: [
      { id: "r1", templateId: "jh-bladehead", star: 1, localRow: 0, localCol: 1, itemIds: [] },
      { id: "r2", templateId: "jh-wusheng", star: 2, localRow: 1, localCol: 3, itemIds: [] },
      { id: "r3", templateId: "jh-starlet", star: 1, localRow: 3, localCol: 2, itemIds: [] },
    ],
  });

  const cuesA = jianghuPixelEffects.compile(output);
  const cuesB = jianghuPixelEffects.compile(output);
  assert.deepEqual(cuesA, cuesB, "Effect compilation must be deterministic");
  assert.ok(cuesA.length > 0, "Expected combat effect cues for jianghu replay");
  for (const cue of cuesA) {
    assert.ok(unique.has(cue.file), `Cue file ${cue.file} missing from runtimeFiles()`);
  }
});

test("all 12 jianghu items render distinct crisp 16x16 pixel SVGs without pixel flag", () => {
  assert.equal(jianghuItems.length, 12);
  const rendered = new Set<string>();
  for (const item of jianghuItems) {
    const src = itemImage(item.id, { label: item.name });
    assert.ok(src.startsWith("data:image/svg+xml;utf8,"), `Expected SVG data URL for ${item.id}`);
    const decoded = decodeURIComponent(src.slice("data:image/svg+xml;utf8,".length));
    assert.ok(decoded.includes('shape-rendering="crispEdges"'), `${item.id} must use crispEdges pixel SVG`);
    assert.ok(decoded.includes('viewBox="0 0 16 16"'), `${item.id} must be 16x16 pixel grid`);
    assert.ok(!rendered.has(decoded), `Duplicate sprite art detected on ${item.id}`);
    rendered.add(decoded);
  }
});
