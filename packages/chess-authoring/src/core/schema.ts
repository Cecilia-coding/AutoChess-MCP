import { z } from "zod";

const number = () => z.number().finite();
const nonnegative = () => number().nonnegative();
const positive = () => number().positive();
const text = () => z.string().trim().min(1);
const id = () =>
  z.string().regex(/^[a-z][a-z0-9_-]*$/, "ID 使用小写字母开头，可含数字、下划线和连字符");
const growth = () => z.tuple([z.literal(1), nonnegative(), nonnegative()]);

export const amountSchema = z.strictObject({
  flat: nonnegative().default(0),
  attackRatio: nonnegative().default(0),
  healthRatio: nonnegative().default(0),
});

export const triggerSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("battle_start") }),
  z.strictObject({ type: z.literal("interval"), intervalMs: positive().int() }),
  z.strictObject({ type: z.literal("every_attacks"), count: positive().int() }),
  z.strictObject({
    type: z.literal("mana_full"),
    maxMana: positive(),
    startMana: nonnegative().default(0),
  }),
]);

export const targetSchema = z.strictObject({
  team: z.enum(["ally", "enemy", "self"]),
  selector: z.enum(["current", "nearest", "lowest_health_ratio", "highest_attack"]),
  count: positive().int(),
  includeSelf: z.boolean().default(false),
});

export const effectSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("damage"),
    damageType: z.enum(["physical", "magic"]),
    amount: amountSchema,
  }),
  z.strictObject({ type: z.literal("heal"), amount: amountSchema }),
  z.strictObject({ type: z.literal("shield"), amount: amountSchema, durationMs: positive().int() }),
  z.strictObject({ type: z.literal("stun"), durationMs: positive().int() }),
  z.strictObject({
    type: z.literal("stat_change"),
    stat: z.enum(["attack", "armor", "magicResist", "attackSpeed"]),
    operation: z.enum(["flat", "percent"]),
    value: number(),
    durationMs: positive().int(),
  }),
]);

export const unitSchema = z.strictObject({
  id: id(),
  name: text(),
  cost: z.number().int().min(1).max(5),
  role: z.enum(["tank", "melee", "ranged", "caster", "support"]).default("caster"),
  description: z.string().default(""),
  stats: z.strictObject({
    health: positive(),
    attack: nonnegative(),
    attackIntervalMs: positive().int(),
    range: positive().int(),
    armor: nonnegative().default(0),
    magicResist: nonnegative().default(0),
  }),
  skill: z.strictObject({
    name: text(),
    trigger: triggerSchema,
    target: targetSchema,
    effects: z.array(effectSchema).min(1),
  }),
});

export const packSchema = z
  .strictObject({
    schemaVersion: z.literal("1"),
    name: text(),
    description: z.string().default(""),
    rules: z.strictObject({
      baseTemplate: z.literal("standard_v1"),
      starGrowth: z.strictObject({
        health: growth(),
        attack: growth(),
        damage: growth(),
        healing: growth(),
        shield: growth(),
        controlDuration: growth(),
      }),
      skillStatBasis: z.literal("one_star"),
    }),
    units: z.array(unitSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    const ids = new Set<string>();
    for (const [i, unit] of pack.units.entries()) {
      const issue = (field: (string | number)[], message: string) =>
        ctx.addIssue({ code: "custom", path: ["units", i, ...field], message });
      if (ids.has(unit.id)) issue(["id"], "棋子 ID 重复");
      ids.add(unit.id);
      const { target, trigger, effects } = unit.skill;
      if (trigger.type === "mana_full" && trigger.startMana > trigger.maxMana)
        issue(["skill", "trigger", "startMana"], "初始法力不能超过法力上限");
      if (target.team === "self" && target.count !== 1)
        issue(["skill", "target", "count"], "自身目标数量应为 1");
      if (target.team !== "ally" && target.includeSelf)
        issue(["skill", "target", "includeSelf"], "includeSelf 只用于友军选取");
      if (target.team !== "enemy" && target.selector === "current")
        issue(["skill", "target", "selector"], "当前攻击目标只适用于敌方");
      for (const [j, effect] of effects.entries()) {
        if (effect.type === "stat_change" && effect.operation === "percent" && effect.value < -1)
          issue(["skill", "effects", j, "value"], "百分比使用小数，减少量最多为 -1（-100%）");
      }
    }
  });

export type ChessPack = z.output<typeof packSchema>;
export type ChessPackInput = z.input<typeof packSchema>;
export type ChessUnit = ChessPack["units"][number];
export type SkillEffect = ChessUnit["skill"]["effects"][number];
export type Amount = z.output<typeof amountSchema>;
export type Star = 1 | 2 | 3;
export type FieldIssue = { path: string; code: string; message: string };

function fieldPath(path: PropertyKey[]) {
  return path.reduce<string>(
    (out, part) =>
      typeof part === "number" ? `${out}[${part}]` : `${out}${out ? "." : ""}${String(part)}`,
    "",
  );
}

export function validationIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys")
      return issue.keys.map((key) => ({
        path: fieldPath([...issue.path, key]),
        code: "unknown_field",
        message:
          /growth|bystar|star/i.test(key) && issue.path[0] === "units"
            ? "成长规则请填写在 rules.starGrowth，全体棋子统一使用。"
            : "此版本不支持该字段，请按协议填写；输入未保存。",
      }));
    return [{ path: fieldPath(issue.path), code: issue.code, message: issue.message }];
  });
}

export const packJsonSchema = z.toJSONSchema(packSchema, { io: "input" });
