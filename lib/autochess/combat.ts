import { createBattleEngine } from "../../packages/chess-engine/src/combat";
import { getSkill } from "../../content/autochess/skills";
import { traits } from "../../content/autochess/traits";
import { unitSkill } from "../../content/autochess/unit-skills";
import { findHex } from "../../content/autochess/hexes";
import { items } from "../../content/autochess/items";
import { getUnit } from "../../content/autochess/units";
import { combatStats, effectiveTraits, uniqueTraitCounts } from "./stats";

export const simulateBattle = createBattleEngine({
  getUnit,
  getSkill,
  unitSkill,
  findHex,
  items,
  traits,
  combatStats,
  effectiveTraits,
  uniqueTraitCounts,
});
