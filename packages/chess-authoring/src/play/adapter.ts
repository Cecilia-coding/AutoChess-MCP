import {
  createBattleEngine,
  type BattleContent,
  type CombatStats,
  type UnitDef,
  type SkillDef,
  type UnitSkill,
  type SkillPrimitive,
  type TargetedEffect,
} from "@autochess/chess-engine";
import { previewPack } from "../core/preview.js";
import type { ChessPack } from "../core/schema.js";

/** Compile a validated immutable pack into an engine instance, with no global registry writes. */
export function compilePack(pack: ChessPack) {
  const previews = previewPack(pack);
  const definitions = new Map<string, UnitDef>();
  const skills = new Map<string, UnitSkill>();
  const panels = new Map<string, CombatStats[]>();
  const fallbackSkills = new Map<string, SkillDef>();
  for (const [index, unit] of pack.units.entries()) {
    const trigger = unit.skill.trigger;
    const mana = trigger.type === "mana_full" ? trigger.maxMana : 80;
    definitions.set(unit.id, {
      id: unit.id,
      name: unit.name,
      cost: unit.cost as UnitDef["cost"],
      role: unit.role,
      skillId: unit.id,
      factions: [],
      jobs: [],
      summon: false,
      master: false,
      companion: false,
      source: "pack",
      skillNote: unit.skill.name,
      artNeed: "",
      manaByStar: [mana, mana, mana],
    });
    fallbackSkills.set(unit.id, {
      id: unit.id,
      name: unit.skill.name,
      kind: "single_magic",
      coeff: 0,
      shieldMs: 0,
      maxTargets: unit.skill.target.count,
    });
    const rows = previews[index].stars;
    const effects: TargetedEffect[] = unit.skill.effects.map((effect, effectIndex) => {
      if ("amount" in effect)
        return {
          kind: effect.type,
          values: rows.map((row) => (row.effects[effectIndex] as { value: number }).value) as [
            number,
            number,
            number,
          ],
          ...("damageType" in effect ? { damageType: effect.damageType } : {}),
          ...("durationMs" in effect ? { durationMs: effect.durationMs } : {}),
        };
      if (effect.type === "stun")
        return {
          kind: "stun",
          durations: rows.map(
            (row) => (row.effects[effectIndex] as { durationMs: number }).durationMs,
          ) as [number, number, number],
        };
      return {
        kind: "stat",
        stat: ({ attack: "atk", armor: "armor", magicResist: "mr", attackSpeed: "aspd" } as const)[
          effect.stat
        ],
        operation: effect.operation,
        value: effect.value,
        durationMs: effect.durationMs,
      };
    });
    const compiled: SkillPrimitive[] = [{ op: "targeted", target: unit.skill.target, effects }];
    skills.set(unit.id, {
      name: unit.skill.name,
      mana,
      passive: trigger.type !== "mana_full",
      ...(trigger.type === "battle_start" ? { onBattleStart: compiled } : {}),
      ...(trigger.type === "interval"
        ? { tick: { everyMs: trigger.intervalMs, effects: compiled } }
        : {}),
      ...(trigger.type === "every_attacks"
        ? { onAttack: [{ op: "everyNthAttack" as const, every: trigger.count, effects: compiled }] }
        : {}),
      ...(trigger.type === "mana_full" ? { cast: compiled } : {}),
    });
    panels.set(
      unit.id,
      rows.map(({ stats }) => ({
        maxHp: stats.health,
        atk: stats.attack,
        aspd: 1000 / stats.attackIntervalMs,
        armor: stats.armor,
        mr: stats.magicResist,
        range: stats.range,
        skillPct: 0,
        basicPct: 0,
        dmgPct: 0,
        drPct: 0,
        skillTakenPct: 0,
        penetrationPct: 0,
        penetrationFlat: 0,
        dodgePct: 0,
        critPct: 0,
        critDamagePct: 0,
        lifestealPct: 0,
        manaRegenPct: 0,
        manaStartFlat: trigger.type === "mana_full" ? trigger.startMana : 0,
        healReceivePct: 0,
        regenPctPerSec: 0,
        moveSpeedPct: 1,
        emergencyHealPct: 0,
        firstCastControlMs: 0,
        deathBurstHpPct: 0,
        startUntargetableMs: 0,
        startShieldPct: 0,
        controlImmune: false,
        allyBuffPct: 0,
        burnAtkPctPerTick: 0,
        ricochetPct: 0,
        distanceDamagePctPerTile: 0,
        castUntargetableMs: 0,
        trait: "",
        traitCount: 0,
      })),
    );
  }
  const get = <T>(map: Map<string, T>, id: string): T => {
    const value = map.get(id);
    if (!value) throw new Error(`未知棋子：${id}`);
    return value;
  };
  const content: BattleContent = {
    getUnit: (id) => get(definitions, id),
    getSkill: (id) => get(fallbackSkills, id),
    unitSkill: (id) => get(skills, id),
    combatStats: (unit) => ({ ...get(panels, unit.templateId)[unit.star - 1] }),
    effectiveTraits: () => [],
    uniqueTraitCounts: () => new Map(),
    findHex: () => null,
    traits: [],
    items: [],
  };
  return {
    battle: createBattleEngine(content),
    panel: (id: string, star: 1 | 2 | 3) => ({ ...get(panels, id)[star - 1] }),
  };
}
