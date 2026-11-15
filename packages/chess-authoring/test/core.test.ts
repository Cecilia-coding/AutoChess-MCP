import test from "node:test";
import assert from "node:assert/strict";
import {
  examplePack,
  inspectPack,
  packSchema,
  growthPresets,
  prepareStarter,
  starterBlueprints,
  starterConfig,
} from "../src/core/index.js";

const example = () => structuredClone(examplePack);
function valueOf(effect: object) {
  assert.ok("value" in effect);
  return effect.value;
}
function durationOf(effect: object) {
  assert.ok("durationMs" in effect);
  return effect.durationMs;
}
test("one pack growth applies to every unit; skill values stay fixed while HP increases", () => {
  const result = inspectPack(example());
  assert.ok(result.valid);
  for (const unit of result.preview) {
    assert.deepEqual(
      unit.stars.map((row) => row.stats.health / unit.stars[0].stats.health),
      [1, 2, 8],
    );
    assert.deepEqual(
      unit.stars.map((row) => row.effects),
      [unit.stars[0].effects, unit.stars[0].effects, unit.stars[0].effects],
    );
  }
  assert.equal(valueOf(result.preview[0].stars[2].effects[0]), 190);
  assert.equal(valueOf(result.preview[2].stars[2].effects[0]), 140);
});
test("attack coefficient is amplified once and uses one-star caster stats", () => {
  const pack = example();
  const { name: _name, ...growth } = structuredClone(growthPresets.balanced);
  pack.rules.starGrowth = packSchema.shape.rules.shape.starGrowth.parse(growth);
  const result = inspectPack(pack);
  assert.ok(result.valid);
  assert.equal(result.preview[2].stars[2].stats.attack, 135);
  assert.equal(valueOf(result.preview[2].stars[2].effects[0]), 315);
});
test("reject per-unit and per-effect growth overrides with actionable paths", () => {
  for (const key of ["starGrowth", "coeffByStar", "growth"]) {
    const pack = example();
    Object.assign(pack.units[0], { [key]: [1, 3, 9] });
    const result = inspectPack(pack);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.issues[0].path, `units[0].${key}`);
      assert.match(result.issues[0].message, /rules.starGrowth/);
    }
  }
  const pack = example();
  Object.assign(pack.units[0].skill.effects[0], { amountByStar: [1, 2, 3] });
  assert.equal(inspectPack(pack).valid, false);
});
test("duplicate IDs, unsupported fields, numeric overflow and invalid targeting fail before save", () => {
  let pack = example();
  pack.units[1].id = pack.units[0].id;
  assert.equal(inspectPack(pack).valid, false);
  pack = example();
  Object.assign(pack, { serverPath: "/private/data" });
  assert.equal(inspectPack(pack).valid, false);
  pack = example();
  pack.units[0].stats.health = 1e308;
  assert.equal(inspectPack(pack).valid, false);
  pack = example();
  pack.units[1].skill.trigger = { type: "interval", intervalMs: 0 };
  assert.equal(inspectPack(pack).valid, false);
  pack = example();
  pack.units[1].skill.target.team = "self";
  pack.units[1].skill.target.count = 2;
  assert.equal(inspectPack(pack).valid, false);
  pack = example();
  pack.units[1].skill.trigger = { type: "mana_full", maxMana: 100, startMana: 101 };
  assert.equal(inspectPack(pack).valid, false);
  assert.equal(inspectPack({ ...example(), schemaVersion: "2" }).valid, false);
});
test("all skill bricks and global control scaling have stable preview semantics", () => {
  const pack = example();
  pack.rules.starGrowth.controlDuration = [1, 1.5, 2];
  pack.units[2].skill.effects = [
    { type: "damage", damageType: "magic", amount: { flat: 10, attackRatio: 1, healthRatio: 0.1 } },
    { type: "heal", amount: { flat: 20 } },
    { type: "shield", amount: { flat: 30 }, durationMs: 2000 },
    { type: "stun", durationMs: 1000 },
    {
      type: "stat_change",
      stat: "attackSpeed",
      operation: "percent",
      value: 0.2,
      durationMs: 4000,
    },
  ];
  const result = inspectPack(pack);
  assert.ok(result.valid);
  assert.deepEqual(
    result.preview[2].stars.map((row) => durationOf(row.effects[3])),
    [1000, 1500, 2000],
  );
  assert.equal(valueOf(result.preview[2].stars[2].effects[0]), 135);
  assert.equal(durationOf(result.preview[2].stars[2].effects[2]), 2000);
  assert.equal(valueOf(result.preview[2].stars[2].effects[4]), 0.2);
});
test("normalized JSON roundtrips without host-specific metadata", () => {
  const pack = packSchema.parse(example());
  assert.equal(pack.units[1].stats.armor, 0);
  assert.deepEqual(packSchema.parse(JSON.parse(JSON.stringify(pack))), pack);
  assert.deepEqual(Object.keys(pack), ["schemaVersion", "name", "description", "rules", "units"]);
});

test("guided starters produce the same editable contract for every template and size", () => {
  for (const preset of ["endurance", "balanced", "skill"] as const) {
    for (const size of starterConfig.sizes) {
      const pack = prepareStarter({ name: "创作测试", preset, size });
      assert.equal(pack.units.length, size);
      assert.equal(new Set(pack.units.map((unit) => unit.id)).size, size);
      for (let cost = 1; cost <= 5; cost++)
        assert.equal(pack.units.filter((unit) => unit.cost === cost).length, size / 5);
      assert.ok(inspectPack(pack).valid);
      assert.ok(pack.units.every((unit) => !("starGrowth" in unit)));
      // The advanced editor can remove a unit; starter menu sizes don't constrain content.
      pack.units.pop();
      assert.ok(inspectPack(pack).valid);
    }
  }
});

test("web blueprint data and generated starters share one stat source", () => {
  const blueprints = starterBlueprints();
  const pack = prepareStarter({ name: "蓝图测试", preset: "balanced", size: 20 });
  for (const unit of pack.units)
    assert.deepEqual(unit.stats, blueprints[unit.role][unit.cost].stats);
});
