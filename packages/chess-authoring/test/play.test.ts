import test from "node:test";
import assert from "node:assert/strict";
import { packSchema, type ChessPack } from "../src/core/schema.js";
import { prepareStarter } from "../src/core/starter.js";
import { compilePack } from "../src/play/adapter.js";
import { createTrial, actTrial, viewTrial } from "../src/play/match.js";

function analyticalPack(): ChessPack {
  return packSchema.parse({
    schemaVersion: "1",
    name: "独立数值验收",
    rules: {
      baseTemplate: "standard_v1",
      skillStatBasis: "one_star",
      starGrowth: {
        health: [1, 2, 8],
        attack: [1, 1, 1],
        damage: [1, 2, 3],
        healing: [1, 3, 4],
        shield: [1, 4, 5],
        controlDuration: [1, 2, 4],
      },
    },
    units: [
      {
        id: "a",
        name: "甲",
        cost: 1,
        stats: { health: 317, attack: 29, attackIntervalMs: 1000, range: 20 },
        skill: {
          name: "手算技能",
          trigger: { type: "battle_start" },
          target: { team: "enemy", selector: "nearest", count: 1 },
          effects: [
            {
              type: "damage",
              damageType: "magic",
              amount: { flat: 13, attackRatio: 2, healthRatio: 0.1 },
            },
          ],
        },
      },
      {
        id: "b",
        name: "乙",
        cost: 1,
        stats: { health: 10000, attack: 0, attackIntervalMs: 1000, range: 20 },
        skill: {
          name: "空",
          trigger: { type: "battle_start" },
          target: { team: "self", selector: "nearest", count: 1 },
          effects: [{ type: "shield", amount: { flat: 0 }, durationMs: 1000 }],
        },
      },
    ],
  });
}
const fighter = (id: string, unit: string, star: 1 | 2 | 3 = 1) => ({
  id,
  templateId: unit,
  star,
  localRow: 3,
  localCol: 1,
  itemIds: [],
});
const battle = (pack: ChessPack, star: 1 | 2 | 3 = 1) =>
  compilePack(pack).battle({
    battleId: "independent",
    seed: 891,
    left: [fighter("left", "a", star)],
    right: [fighter("right", "b")],
  });

test("actual battle uses authored HP/attack and manually computed damage for all four triggers and three stars", () => {
  const triggers = [
    { type: "battle_start" },
    { type: "interval", intervalMs: 1000 },
    { type: "every_attacks", count: 2 },
    { type: "mana_full", maxMana: 80, startMana: 80 },
  ] as const;
  for (const trigger of triggers)
    for (const star of [1, 2, 3] as const) {
      const pack = analyticalPack();
      pack.units[0].skill.trigger = trigger;
      const result = battle(pack, star);
      assert.equal(
        result.units.find((unit) => unit.id === "left")!.maxHp,
        [317, 634, 2536][star - 1],
      );
      const damage = result.events.find(
        (event) => event.type === "damage" && event.sourceId === "left" && event.skillId === "a",
      );
      assert.ok(damage, `${trigger.type}/${star} must deal real damage`);
      assert.equal(damage.value, [102, 205, 308][star - 1]); // floor((13 + 29*2 + 317*.1) * [1,2,3])
      assert.equal(compilePack(pack).panel("a", star).atk, 29);
      assert.ok(result.events.some((event) => event.type === "end"));
    }
});
test("shield and stun values reach actual combat; zero attack does not cause phantom damage", () => {
  for (const star of [1, 2, 3] as const) {
    const pack = analyticalPack();
    pack.units[0].stats.attack = 0;
    pack.units[0].skill.effects = [
      { type: "shield", amount: { flat: 10, attackRatio: 0, healthRatio: 0 }, durationMs: 2300 },
      { type: "stun", durationMs: 700 },
    ];
    const result = battle(pack, star);
    assert.equal(
      result.events.find((event) => event.type === "shield" && event.skillId === "a")?.value,
      [10, 40, 50][star - 1],
    );
    assert.equal(
      result.events.find((event) => event.type === "trait" && event.skillId === "a")?.value,
      [700, 1400, 2800][star - 1],
    );
    const damage = result.events.filter(
      (event) =>
        event.type === "damage" && event.sourceId === "left" && event.targetIds?.includes("right"),
    );
    assert.ok(!damage.length, JSON.stringify(damage.slice(0, 3)));
  }
});
test("interval healing repairs real damage and target selection excludes self", () => {
  const pack = analyticalPack();
  pack.units[0].stats.health = 1000;
  pack.units[0].stats.attack = 0;
  pack.units[0].skill = {
    name: "回春",
    trigger: { type: "interval", intervalMs: 1000 },
    target: { team: "ally", selector: "lowest_health_ratio", count: 1, includeSelf: false },
    effects: [{ type: "heal", amount: { flat: 37, attackRatio: 0, healthRatio: 0 } }],
  };
  pack.units[1].skill = {
    name: "开场伤害",
    trigger: { type: "battle_start" },
    target: { team: "enemy", selector: "nearest", count: 2, includeSelf: false },
    effects: [
      {
        type: "damage",
        damageType: "magic",
        amount: { flat: 200, attackRatio: 0, healthRatio: 0 },
      },
    ],
  };
  const result = compilePack(pack).battle({
    battleId: "heal",
    seed: 17,
    left: [fighter("healer", "a", 3), { ...fighter("ally", "a"), localCol: 2 }],
    right: [fighter("enemy", "b")],
  });
  const heal = result.events.find((event) => event.type === "heal" && event.sourceId === "healer");
  assert.equal(heal?.value, 148);
  assert.deepEqual(heal?.targetIds, ["ally"]);
});
test("temporary -100% attack expires without division by zero; independent packs cannot overwrite one another", () => {
  const pack = analyticalPack();
  pack.units[0].skill.target = { team: "self", selector: "nearest", count: 1, includeSelf: false };
  pack.units[0].skill.effects = [
    { type: "stat_change", stat: "attack", operation: "percent", value: -1, durationMs: 700 },
  ];
  const result = battle(pack);
  const firstDamage = result.events.find(
    (event) => event.type === "damage" && event.sourceId === "left",
  );
  assert.ok(firstDamage && firstDamage.timeMs >= 700);
  assert.equal(firstDamage.value, 29);
  const first = compilePack(pack);
  const secondPack = structuredClone(pack);
  secondPack.units[0].stats.attack = 123;
  const second = compilePack(secondPack);
  assert.equal(first.panel("a", 3).atk, 29);
  assert.equal(second.panel("a", 3).atk, 123);
});
test("temporary zero attack speed stops attacks and resumes after expiration", () => {
  const pack = analyticalPack();
  pack.units[0].skill.target = { team: "self", selector: "nearest", count: 1, includeSelf: false };
  pack.units[0].skill.effects = [
    { type: "stat_change", stat: "attackSpeed", operation: "percent", value: -1, durationMs: 700 },
  ];
  const result = battle(pack);
  const attacks = result.events.filter(
    (event) => event.type === "attack" && event.sourceId === "left",
  );
  assert.ok(attacks.length > 1);
  assert.ok(attacks.every((event) => event.timeMs >= 700));
  assert.equal(
    result.events.find(
      (event) =>
        event.type === "damage" && event.sourceId === "left" && event.targetIds?.includes("right"),
    )?.value,
    29,
  );
});
test("shop purchase merges nine copies into three stars, preserves board slot and rejects illegal actions atomically", () => {
  const pack = analyticalPack();
  pack.units = pack.units.slice(0, 1);
  let match = createTrial("merge", pack, 754);
  for (let i = 0; i < 5; i++) match = actTrial(match, { type: "buy", slot: i });
  assert.ok(match.player.pieces.some((piece) => piece.star === 2));
  const piece = match.player.pieces.find((piece) => piece.star === 2)!;
  match = actTrial(match, { type: "move", pieceId: piece.id, row: 3, col: 2 });
  match = actTrial(match, { type: "refresh" });
  for (let i = 0; i < 3; i++) match = actTrial(match, { type: "buy", slot: i });
  const saved = JSON.stringify(match);
  assert.throws(() => actTrial(match, { type: "buy", slot: 3 }), /金币/);
  assert.equal(JSON.stringify(match), saved);
  assert.throws(() => actTrial(match, { type: "move", pieceId: piece.id, row: 40, col: 0 }));
  match = actTrial(match, { type: "ready" });
  match = actTrial(match, { type: "buy", slot: 0 });
  assert.equal(match.player.pieces.length, 1);
  assert.equal(match.player.pieces[0].star, 3);
  assert.equal(match.player.pieces[0].row, 3);
  assert.equal(viewTrial(match).panels[0].maxHp, 2536);
});
for (const preset of ["endurance", "balanced", "skill"] as const) {
  test(`full trial match with authored ${preset} roster reaches a real terminal result`, () => {
    const pack = prepareStarter({ name: `全局验收 ${preset}`, preset, size: 10 });
    let match = createTrial(`full-${preset}`, pack, 1843);
    for (let turn = 0; turn < 30 && match.phase === "prepare"; turn++) {
      for (let slot = 0; slot < 5; slot++) {
        try {
          match = actTrial(match, { type: "buy", slot });
        } catch {
          /* ordinary insufficient-gold/full-bench choices */
        }
      }
      const selected = [...match.player.pieces]
        .sort((a, b) => b.star - a.star)
        .slice(0, match.player.level);
      for (const piece of match.player.pieces.filter(
        (piece) => piece.row !== null && !selected.some((entry) => entry.id === piece.id),
      ))
        match = actTrial(match, { type: "move", pieceId: piece.id, row: null, col: null });
      for (const [index, piece] of selected.entries())
        match = actTrial(match, {
          type: "move",
          pieceId: piece.id,
          row: 3 - Math.floor(index / 5),
          col: index % 5,
        });
      match = actTrial(match, { type: "ready" });
      assert.ok(match.battle?.events.some((event) => event.type === "end"));
    }
    assert.equal(match.phase, "finished");
    assert.ok(["win", "loss", "draw"].includes(match.result!));
    assert.ok(match.history.length > 1);
  });
}
