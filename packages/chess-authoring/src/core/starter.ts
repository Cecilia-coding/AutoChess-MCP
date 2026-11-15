import { z } from "zod";
import { growthPresets } from "./templates.js";
import { packSchema, type ChessPackInput, type ChessUnit } from "./schema.js";

type Role = ChessUnit["role"];
type Skill = ChessPackInput["units"][number]["skill"];
export const skillRecipes: Record<string, { name: string; description: string; skill: Skill }> = {
  strike: {
    name: "单体重击",
    description: "每攻击 3 次，重击当前敌人。",
    skill: {
      name: "重击",
      trigger: { type: "every_attacks", count: 3 },
      target: { team: "enemy", selector: "current", count: 1 },
      effects: [{ type: "damage", damageType: "physical", amount: { attackRatio: 2 } }],
    },
  },
  spell: {
    name: "群体法术",
    description: "每 5 秒，对最近的 2 名敌人造成魔法伤害。",
    skill: {
      name: "灵光",
      trigger: { type: "interval", intervalMs: 5000 },
      target: { team: "enemy", selector: "nearest", count: 2 },
      effects: [{ type: "damage", damageType: "magic", amount: { attackRatio: 2.5 } }],
    },
  },
  heal: {
    name: "治疗队友",
    description: "每 5 秒，治疗血量比例最低的友军。",
    skill: {
      name: "回春",
      trigger: { type: "interval", intervalMs: 5000 },
      target: { team: "ally", selector: "lowest_health_ratio", count: 1, includeSelf: true },
      effects: [{ type: "heal", amount: { attackRatio: 3 } }],
    },
  },
  shield: {
    name: "保护自己",
    description: "开战时获得护盾，持续 6 秒。",
    skill: {
      name: "守护",
      trigger: { type: "battle_start" },
      target: { team: "self", selector: "nearest", count: 1 },
      effects: [{ type: "shield", amount: { healthRatio: 0.2 }, durationMs: 6000 }],
    },
  },
  control: {
    name: "打断敌人",
    description: "每 6 秒，伤害并眩晕最近的敌人 1 秒。",
    skill: {
      name: "震荡",
      trigger: { type: "interval", intervalMs: 6000 },
      target: { team: "enemy", selector: "nearest", count: 1 },
      effects: [
        { type: "damage", damageType: "magic", amount: { attackRatio: 1 } },
        { type: "stun", durationMs: 1000 },
      ],
    },
  },
};

export const starterRoles: Record<
  Role,
  { name: string; description: string; stats: ChessUnit["stats"]; skill: keyof typeof skillRecipes }
> = {
  tank: {
    name: "前排",
    description: "生命与护甲较高，负责承伤。",
    stats: {
      health: 800,
      attack: 35,
      attackIntervalMs: 1400,
      range: 1,
      armor: 30,
      magicResist: 20,
    },
    skill: "shield",
  },
  melee: {
    name: "近战",
    description: "近距离持续攻击。",
    stats: {
      health: 650,
      attack: 55,
      attackIntervalMs: 1100,
      range: 1,
      armor: 20,
      magicResist: 10,
    },
    skill: "strike",
  },
  ranged: {
    name: "远程",
    description: "射程较远，生命较低。",
    stats: {
      health: 450,
      attack: 55,
      attackIntervalMs: 1000,
      range: 4,
      armor: 10,
      magicResist: 10,
    },
    skill: "strike",
  },
  caster: {
    name: "法师",
    description: "通过技能打出伤害。",
    stats: {
      health: 500,
      attack: 45,
      attackIntervalMs: 1400,
      range: 3,
      armor: 10,
      magicResist: 20,
    },
    skill: "spell",
  },
  support: {
    name: "辅助",
    description: "治疗或保护友军。",
    stats: {
      health: 550,
      attack: 35,
      attackIntervalMs: 1400,
      range: 3,
      armor: 10,
      magicResist: 20,
    },
    skill: "heal",
  },
};

export const starterConfig = {
  sizes: [5, 10, 15, 20],
  costMultipliers: [1, 1.15, 1.3, 1.5, 1.8],
  roles: starterRoles,
  skillRecipes,
  note: "起步模板提供初始数值与费用分布，可继续增删棋子和调整；正式对战平衡还需实测。",
};

export const starterSchema = z.strictObject({
  name: z.string().trim().min(1),
  description: z.string().default(""),
  preset: z.enum(["endurance", "balanced", "skill"]),
  size: z
    .number()
    .int()
    .refine(
      (size) => starterConfig.sizes.includes(size),
      "请选择 guide.starter.sizes 中的起步数量，生成后可继续增删棋子",
    ),
});

export function starterUnit(role: Role, cost: number) {
  const recipe = starterRoles[role];
  const multiplier = starterConfig.costMultipliers[cost - 1];
  return {
    role,
    cost,
    stats: {
      ...recipe.stats,
      health: Math.round(recipe.stats.health * multiplier),
      attack: Math.round(recipe.stats.attack * multiplier),
    },
    skill: structuredClone(skillRecipes[recipe.skill].skill),
  };
}

/** Clients select a blueprint; stat construction stays in this module. */
export function starterBlueprints() {
  return Object.fromEntries(
    Object.keys(starterRoles).map((role) => [
      role,
      Object.fromEntries(
        starterConfig.costMultipliers.map((_, i) => [i + 1, starterUnit(role as Role, i + 1)]),
      ),
    ]),
  );
}

/** Optional starter sizes are UI recipes, not a restriction on pack roster length. */
export function prepareStarter(input: z.input<typeof starterSchema>) {
  const args = starterSchema.parse(input);
  const { name: _presetName, ...starGrowth } = growthPresets[args.preset];
  const roles: Role[] = ["tank", "support", "ranged", "caster", "melee"];
  const units = Array.from({ length: args.size }, (_, i) => {
    const cost = (i % 5) + 1;
    const role = roles[(i + Math.floor(i / 5)) % roles.length];
    return {
      id: `unit_${i + 1}`,
      name: `${starterRoles[role].name}${i + 1}`,
      ...starterUnit(role, cost),
    };
  });
  return packSchema.parse({
    schemaVersion: "1",
    name: args.name,
    description: args.description,
    rules: { baseTemplate: "standard_v1", starGrowth, skillStatBasis: "one_star" },
    units,
  });
}
