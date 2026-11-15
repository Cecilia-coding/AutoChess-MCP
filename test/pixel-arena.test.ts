import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { pixelManifest } from "../packs/ai/presentation/appearance";
import { aiItems } from "../packs/ai/items";
import { itemImage } from "../lib/meta/cosmetics";
import { pixelAvatarImage, pixelItemArt } from "../lib/meta/pixel-items";
import { frameAt } from "../lib/autochess/frame";
import { pixelPose as samplePose } from "../lib/autochess/pixel-animation";
const pixelPose = (unit: Parameters<typeof samplePose>[1], time: number, moving: boolean) =>
  samplePose(pixelManifest.clips, unit, time, moving);
import {
  PIXEL_BOARD,
  fitPixelBoard,
  pixelPoint,
  pixelCell,
  pixelBench,
  pixelBenchSlot,
} from "../lib/autochess/pixel-board";
import { ownCellFromWorld } from "../lib/autochess/arena-view";
import { starTierVisual } from "../lib/autochess/pixel-arena";
import { simulateBattle } from "../lib/autochess/combat";
import { aiForms, aiRoster } from "../packs/ai/roster";
import { aiPixelEffects } from "../packs/ai/presentation/effects";
import { aiPixelAppearance } from "../packs/ai/presentation/appearance";
import type { Combatant, BattleOutput } from "../lib/autochess/types";

const piece = (templateId: string, id: string, col = 2, star: 1 | 2 | 3 = 1): Combatant => ({
  id,
  templateId,
  star,
  localRow: 3,
  localCol: col,
  itemIds: [],
});

test("appearance effects follow actual recipients and replay deterministically", async () => {
  const battle = simulateBattle({
    battleId: "fx",
    seed: 8,
    left: [{ ...piece("ai-musespark", "muse"), initialMana: 45 }, piece("ai-gpt", "ally", 1)],
    right: [piece("ai-claude", "foe", 3)],
  });
  const copy = structuredClone(battle),
    cues = aiPixelEffects.compile(battle);
  assert.deepEqual(battle, copy, "visual compilation does not mutate combat");
  assert.deepEqual(aiPixelEffects.compile(battle), cues);
  const files = new Set(await aiPixelAppearance.runtimeFiles());
  for (const cue of cues) {
    assert.ok(files.has(cue.file), cue.file);
    assert.ok(cue.duration > 0 && cue.frames.length > 0);
  }
  const rewards = battle.events.filter(
    (e) => e.type === "trait" && e.sourceId === "muse" && /回复.*内力/.test(e.text),
  );
  assert.ok(rewards.length);
  for (const reward of rewards)
    assert.ok(
      cues.some(
        (c) =>
          c.start === reward.timeMs &&
          c.unitId === reward.targetIds?.[0] &&
          c.file === "effects/symbols/ai-musespark.png",
      ),
    );
  const supportOnly = {
    ...battle,
    events: [
      {
        seq: 0,
        timeMs: 100,
        type: "cast" as const,
        sourceId: "ally",
        targetIds: ["foe"],
        text: "",
      },
    ],
  };
  assert.ok(
    aiPixelEffects.compile(supportOnly).every((c) => c.unitId === "ally"),
    "a support cast does not invent a hit on its provisional enemy target",
  );
});

test("all 29 playable characters and forms have valid transparent sprite atlases", async () => {
  assert.deepEqual(
    pixelManifest.units.map((unit) => unit.id).sort(),
    [...aiRoster, ...aiForms].map((unit) => unit.id).sort(),
  );
  for (const unit of pixelManifest.units) {
    const png = await readFile(new URL(`../assets/pixel-mascots/${unit.atlas}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), pixelManifest.atlas.width);
    assert.equal(png.readUInt32BE(20), pixelManifest.atlas.height);
    assert.equal(png[25], 6);
  }
});

test("grid and bench hit targets map back to all legal deployment cells", () => {
  assert.equal(PIXEL_BOARD.skew, 0, "default pixel board is orthogonal (zero skew)");
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 5; col++) {
      const p = pixelPoint(row, col);
      assert.equal(p.x, pixelPoint(0, col).x, "columns align straight vertically without slant");
      assert.deepEqual(pixelCell(p.x, p.y), { row, col });
      assert.deepEqual(ownCellFromWorld(row, col), row < 4 ? null : { row: 7 - row, col });
    }
  for (let i = 0; i < 9; i++) {
    const p = pixelBench(i);
    assert.equal(pixelBenchSlot(p.x, p.y), i);
  }
  assert.equal(pixelCell(-100, -100), null);
});

test("rectangular boards fill each viewport and retain cell and bench hit boundaries", () => {
  for (const [width, height] of [[840, 470], [374, 580], [620, 220], [1440, 700]]) {
    const { board, scale, x, y } = fitPixelBoard(width!, height!);
    assert.equal(board.skew, 0, "fitted pixel board stays straight across viewports");
    assert.ok(Math.abs(board.width * scale - (width! - 16)) < 0.01);
    assert.ok(Math.abs(board.height * scale - (height! - 16)) < 0.01);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 5; col++) {
        const center = pixelPoint(row, col, board);
        assert.equal(center.x, pixelPoint(0, col, board).x);
        for (const dx of [-0.49, 0, 0.49]) {
          const point = { x: center.x + dx * board.cellWidth, y: center.y };
          assert.deepEqual(pixelCell(point.x, point.y, board), { row, col });
          assert.ok(x + point.x * scale > 0 && x + point.x * scale < width!);
          assert.ok(y + point.y * scale > 0 && y + point.y * scale < height!);
        }
      }
    }
    for (let index = 0; index < 9; index++) {
      const point = pixelBench(index, board);
      assert.equal(pixelBenchSlot(point.x, point.y, board), index);
      assert.ok(point.x - board.benchSpacing / 2 >= 0);
      assert.ok(point.x + board.benchSpacing / 2 <= board.width);
    }
    assert.equal(pixelBenchSlot(board.benchLeft - board.benchSpacing, board.benchY, board), null);
    assert.equal(pixelCell(board.width / 2, board.benchY, board), null);
  }
});

test("replay sampling restores forms, shields, expressions and death when seeking", () => {
  const base = simulateBattle({
    battleId: "visual-test",
    seed: 1,
    left: [piece("ai-gpt", "gpt")],
    right: [piece("ai-claude", "foe")],
  });
  const initial = {
    id: "gpt",
    appearanceId: "ai-gpt",
    name: "GPT",
    hp: 100,
    maxHp: 100,
    mana: 0,
    maxMana: 50,
    shield: 20,
    shieldUntil: 700,
  };
  const battle: BattleOutput = {
    ...base,
    durationMs: 2000,
    events: [
      {
        seq: 0,
        timeMs: 0,
        type: "spawn",
        sourceId: "gpt",
        pos: { row: 4, col: 2 },
        text: "",
        visuals: [initial],
      },
      {
        seq: 1,
        timeMs: 200,
        type: "damage",
        sourceId: "foe",
        targetIds: ["gpt"],
        value: 60,
        text: "",
        visuals: [{ ...initial, hp: 40, shield: 0 }],
      },
      {
        seq: 2,
        timeMs: 300,
        type: "trait",
        sourceId: "gpt",
        text: "",
        visuals: [{ ...initial, hp: 40, appearanceId: "ai-codex", name: "Codex", shield: 0 }],
      },
      {
        seq: 3,
        timeMs: 1000,
        type: "death",
        sourceId: "gpt",
        text: "",
        visuals: [{ ...initial, hp: 0, shield: 0 }],
      },
    ],
  };
  assert.equal(frameAt(battle, 400).units[0]!.appearanceId, "ai-codex");
  assert.equal(pixelPose(frameAt(battle, 400).units[0]!, 400, false).key, "shock/hurt");
  assert.equal(pixelPose(frameAt(battle, 900).units[0]!, 900, false).key, "serious/idle");
  assert.equal(pixelPose(frameAt(battle, 1200).units[0]!, 1200, false).key, "dead");
  const before = frameAt(battle, 100).units[0]!;
  assert.equal(before.appearanceId, "ai-gpt");
  assert.equal(before.shield, 20);
  assert.equal(before.alive, true);
  assert.equal(pixelPose(before, 100, false).key, "happy/idle");
});

test("Muse invitation rewards reach allies, scale by star and never exceed context limits", () => {
  for (const star of [1, 2, 3] as const) {
    const muse = { ...piece("ai-musespark", "muse", 0, star), initialMana: 45 };
    const output = simulateBattle({
      battleId: `invite-${star}`,
      seed: 8,
      left: [muse, piece("ai-gpt", "ally-a", 1), piece("ai-claude", "ally-b", 3)],
      right: [piece("ai-gpt", "foe-a", 1, 3), piece("ai-claude", "foe-b", 3, 3)],
    });
    const grants = output.events.filter(
      (e) => e.type === "trait" && e.sourceId === "muse" && e.value && /回复.*内力/.test(e.text),
    );
    assert.ok(grants.some((e) => e.targetIds?.[0] === "ally-a" || e.targetIds?.[0] === "ally-b"));
    assert.ok(grants.some((e) => e.targetIds?.[0] === "muse"));
    assert.ok(grants.every((e) => (e.value ?? 0) <= (e.targetIds?.[0] === "muse" ? 5 : 10) * star));
    for (const event of grants)
      for (const state of event.visuals ?? []) assert.ok(state.mana <= state.maxMana);
    assert.ok(output.durationMs > 0 && output.durationMs <= 45_000);
  }
});

test("real combat emits GPT/Codex and temporary Doubao appearance transitions", () => {
  const output = simulateBattle({
    battleId: "forms",
    seed: 42,
    left: [piece("ai-gpt", "gpt")],
    right: [piece("ai-doubao", "foe", 2, 2), piece("ai-kimi", "foe2", 3)],
  });
  assert.ok(
    output.events.some((event) =>
      event.visuals?.some((state) => state.appearanceId === "ai-codex"),
    ),
  );
  assert.ok(
    output.events.some((event) =>
      event.visuals?.some((state) => state.id === "gpt" && state.appearanceId === "ai-doubao"),
    ),
  );
  assert.deepEqual(
    simulateBattle({
      battleId: "forms",
      seed: 42,
      left: [piece("ai-gpt", "gpt")],
      right: [piece("ai-doubao", "foe", 2, 2), piece("ai-kimi", "foe2", 3)],
    }),
    output,
  );
  const restored = output.events.find(
    (event) =>
      event.skillId === "form-restored" &&
      event.visuals?.some((state) => state.appearanceId === "ai-codex"),
  );
  assert.ok(restored, "Codex remains the underlying form after temporary disguise expires");
  assert.equal(
    frameAt(output, restored.timeMs).units.find((unit) => unit.id === "gpt")?.appearanceId,
    "ai-codex",
  );
});

test("every AI pack equipment item and commander mini-avatar renders crisp 16x16 pixel SVG art", () => {
  const uniqueSvgs = new Set<string>();
  for (const item of aiItems) {
    const src = itemImage(item.id, { label: item.name });
    assert.ok(src.startsWith("data:image/svg+xml;utf8,"), `${item.id} returns SVG data URL`);
    const decoded = decodeURIComponent(src.slice("data:image/svg+xml;utf8,".length));
    assert.ok(decoded.includes('shape-rendering="crispEdges"'), `${item.id} uses crispEdges`);
    assert.ok(decoded.includes('viewBox="0 0 16 16"'), `${item.id} uses 16x16 pixel grid`);
    assert.ok(!decoded.includes('font-family="serif"'), `${item.id} never falls back to serif text card`);
    uniqueSvgs.add(decoded);
  }
  assert.equal(uniqueSvgs.size, aiItems.length, "each AI equipment item has its own distinct pixel sprite");
  assert.ok(pixelItemArt("custom-unknown-item", true)?.includes("crispEdges"));
  assert.equal(pixelItemArt("custom-unknown-item", false), null);

  const selfAvatar = decodeURIComponent(
    pixelAvatarImage("player-1", { self: true }).slice("data:image/svg+xml;utf8,".length),
  );
  const botAvatar = decodeURIComponent(
    pixelAvatarImage("bot-1", { bot: true }).slice("data:image/svg+xml;utf8,".length),
  );
  assert.ok(selfAvatar.includes('shape-rendering="crispEdges"'));
  assert.ok(botAvatar.includes('shape-rendering="crispEdges"'));
  assert.notEqual(selfAvatar, botAvatar);
});
test("starTierVisual gives strictly separated scale, crest, bar frame, and ground seal across 1★/2★/3★", () => {
  const tier1 = starTierVisual(1);
  const tier2 = starTierVisual(2);
  const tier3 = starTierVisual(3);

  assert.equal(tier1.stars, 1);
  assert.equal(tier2.stars, 2);
  assert.equal(tier3.stars, 3);
  assert.equal(starTierVisual(0).stars, 1);
  assert.equal(starTierVisual(5).stars, 3);

  assert.ok(tier1.scale < tier2.scale && tier2.scale < tier3.scale);

  assert.equal(tier1.ring, null);
  assert.ok(tier2.ring && !tier2.ring.pulse && !tier2.ring.cornerTicks);
  assert.ok(tier3.ring && tier3.ring.pulse && tier3.ring.cornerTicks);
  assert.notEqual(tier2.ring.outer, tier3.ring.outer);
  assert.ok(tier2.ring.rx < tier3.ring.rx);

  assert.equal(new Set([tier1.crestBg, tier2.crestBg, tier3.crestBg]).size, 3);
  assert.equal(new Set([tier1.starFill, tier2.starFill, tier3.starFill]).size, 3);
  assert.equal(new Set([tier1.barFrame, tier2.barFrame, tier3.barFrame]).size, 3);
  assert.equal(new Set([tier1.labelBorder, tier2.labelBorder, tier3.labelBorder]).size, 3);
});
