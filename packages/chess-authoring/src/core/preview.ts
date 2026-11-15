import {
  packSchema,
  validationIssues,
  type Amount,
  type ChessPack,
  type ChessUnit,
  type FieldIssue,
  type SkillEffect,
  type Star,
} from "./schema.js";

const rounded = (value: number) => Number(value.toFixed(6));
export const STARS: readonly Star[] = [1, 2, 3];
const effectGrowth = { damage: "damage", heal: "healing", shield: "shield" } as const;

/** Ratios always reference the caster's one-star chassis. Apply global growth once. */
export function evaluateAmount(amount: Amount, unit: ChessUnit, multiplier: number): number {
  return rounded(
    (amount.flat +
      unit.stats.attack * amount.attackRatio +
      unit.stats.health * amount.healthRatio) *
      multiplier,
  );
}

export function evaluateEffect(effect: SkillEffect, unit: ChessUnit, pack: ChessPack, star: Star) {
  const growth = pack.rules.starGrowth;
  if ("amount" in effect)
    return {
      ...effect,
      value: evaluateAmount(effect.amount, unit, growth[effectGrowth[effect.type]][star - 1]),
    };
  if (effect.type === "stun")
    return { ...effect, durationMs: rounded(effect.durationMs * growth.controlDuration[star - 1]) };
  // Stat changes and shield lifetimes remain fixed for every unit in schema v1.
  return { ...effect };
}

export function previewPack(pack: ChessPack) {
  return pack.units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    cost: unit.cost,
    role: unit.role,
    skillName: unit.skill.name,
    trigger: unit.skill.trigger,
    target: unit.skill.target,
    stars: STARS.map((star) => ({
      star,
      stats: {
        ...unit.stats,
        health: rounded(unit.stats.health * pack.rules.starGrowth.health[star - 1]),
        attack: rounded(unit.stats.attack * pack.rules.starGrowth.attack[star - 1]),
      },
      effects: unit.skill.effects.map((effect) => evaluateEffect(effect, unit, pack, star)),
    })),
  }));
}

export function inspectPack(input: unknown) {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success) return { valid: false as const, issues: validationIssues(parsed.error) };
  const preview = previewPack(parsed.data);
  const issues: FieldIssue[] = [];
  // Even finite source numbers can overflow when combined; reject unusable output.
  for (const [i, unit] of preview.entries()) {
    for (const row of unit.stars) {
      const values = [
        ...Object.values(row.stats),
        ...row.effects.flatMap((effect) => ("value" in effect ? [effect.value] : [])),
      ];
      if (values.some((value) => !Number.isFinite(value)))
        issues.push({
          path: `units[${i}]`,
          code: "numeric_overflow",
          message: "成长计算超出数值范围，请降低基础值或倍率。",
        });
      if (
        row.effects.some((effect) => "durationMs" in effect && !Number.isFinite(effect.durationMs))
      )
        issues.push({
          path: `units[${i}].skill.effects`,
          code: "numeric_overflow",
          message: "持续时间计算超出数值范围。",
        });
    }
  }
  if (issues.length) return { valid: false as const, issues };
  const warnings: { code: string; message: string }[] = [
    {
      code: "trial_snapshot",
      message: "试下局使用开局时的棋谱快照，修改后请另开一局。",
    },
  ];
  const missingCosts = [1, 2, 3, 4, 5].filter(
    (cost) => !parsed.data.units.some((unit) => unit.cost === cost),
  );
  if (missingCosts.length)
    warnings.push({
      code: "incomplete_cost_pool",
      message: `草稿还缺少 ${missingCosts.join("、")} 费棋子，试下商店会跳过这些费用档。`,
    });
  return { valid: true as const, pack: parsed.data, preview, warnings };
}
