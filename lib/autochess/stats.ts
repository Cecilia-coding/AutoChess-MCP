import { findHex } from '../../content/autochess/hexes';
import { items, MAX_ITEMS_PER_UNIT } from '../../content/autochess/items';
import {
  autochessAtkStarMultiplier,
  autochessHpStarMultiplier,
  ROLE_BASE,
} from '../../content/autochess/roles';
import { findTrait } from '../../content/autochess/traits';
import { unitSkill } from '../../content/autochess/unit-skills';
import { safetyOps } from '../../content/autochess/safety';
import {
  applyStatOps,
  createStatSink,
  ladderValue,
  type StatOp,
} from '../../content/autochess/stats-vocab';
import { autochessCostOf, getUnit } from '../../content/autochess/units';
import type { ScalingMetric, TraitDef, TraitId, TraitTier } from '../../content/autochess/types';
import { ASPD_CAP, COST_MULT, EXTRA_DR_CAP } from './constants';
import { manhattan, worldPos } from './grid';
import type { Combatant, CombatStats, TeamId } from './types';

function findItem(id: string) {
  return items.find((entry) => entry.id === id) ?? null;
}

/**
 * 棋子的有效羁绊 = 自身阵营/职业 + 棋子自带 grantTraits + 装备转职 + 心悟转职。
 * 转职书与其他羁绊注入效果走这一条，引擎不认任何具体 id。
 */
export function effectiveTraits(unit: Pick<Combatant, 'templateId' | 'itemIds' | 'hexIds'>): TraitId[] {
  const def = getUnit(unit.templateId);
  const out: TraitId[] = [...def.factions, ...def.jobs, ...(def.grantTraits ?? [])];
  for (const itemId of unit.itemIds.slice(0, MAX_ITEMS_PER_UNIT)) {
    const item = findItem(itemId);
    if (item?.grantTraits?.length) out.push(...item.grantTraits);
  }
  for (const hexId of unit.hexIds ?? []) {
    const hex = findHex(hexId);
    if (hex?.grantTraits?.length) out.push(...hex.grantTraits);
  }
  return out;
}

export function uniqueTraitCounts(team: Combatant[]): Map<TraitId, number> {
  const sets = new Map<TraitId, Set<string>>();
  for (const unit of team) {
    const def = getUnit(unit.templateId);
    if (def.summon) continue;
    for (const id of effectiveTraits(unit)) {
      const set = sets.get(id) ?? new Set<string>();
      set.add(unit.templateId);
      sets.set(id, set);
    }
  }
  const counts = new Map<TraitId, number>();
  for (const [trait, set] of sets) counts.set(trait, set.size);
  return counts;
}

export function factionCount(team: Combatant[], faction: TraitId): number {
  return uniqueTraitCounts(team).get(faction) ?? 0;
}

/** 战场实时量的具名处理器。新增一种「量」只需要在这里加一个 handler，数据侧就能引用。 */
const SCALING_METRICS: Record<ScalingMetric, (unit: Combatant, team: Combatant[], teamId: TeamId) => number> = {
  adjacentAllies: (unit, team, teamId) => {
    const origin = worldPos(teamId, unit.localRow, unit.localCol);
    let count = 0;
    for (const other of team) {
      if (other.id === unit.id) continue;
      if (manhattan(origin, worldPos(teamId, other.localRow, other.localCol)) === 1) count += 1;
    }
    return count;
  },
  distinctAllies: (_unit, team) => new Set(team.map((entry) => entry.templateId)).size,
  teamSize: (_unit, team) => team.length,
};

/** 羁绊解析器：默认读全局表；接一套新羁绊时只需换这个函数。 */
export type TraitResolver = (id: string) => TraitDef | null;

/**
 * 把「当前上场羁绊 + 各自人数」翻译成一组属性操作。
 *
 * 这是引擎理解羁绊的唯一入口，且不认识任何具体羁绊 id：
 * 换一整套羁绊（甚至换成别的棋谱包）时，只要 TraitDef 里有 `tierEffects` 数据就能直接跑。
 */
export function collectTraitOps(input: {
  myTraits: readonly TraitId[];
  counts: Map<TraitId, number>;
  team: Combatant[];
  unit: Combatant;
  resolveTrait?: TraitResolver;
}): StatOp[] {
  const resolve = input.resolveTrait ?? findTrait;
  const { counts } = input;
  const ops: StatOp[] = [];
  // 取「不超过人数的最高已定义档」；若高档没写数据，自动沿用低档（例如只写了 2/4/6 的羁绊遇到 8 人）。
  const tierEntry = (effects: Record<number, TraitTier>, count: number): TraitTier | undefined => {
    const keys = Object.keys(effects).map(Number).filter((key) => count >= key).sort((a, b) => a - b);
    return keys.length ? effects[keys[keys.length - 1]!] : undefined;
  };

  for (const traitId of new Set(input.myTraits)) {
    const trait = resolve(traitId);
    const effects = trait?.tierEffects;
    if (!effects) continue;
    const count = counts.get(traitId) ?? 0;
    const entry = tierEntry(effects, count);
    if (entry?.stats?.length) ops.push(...entry.stats);
  }

  for (const [traitId, count] of counts) {
    const trait = resolve(traitId);
    const entry = trait?.tierEffects ? tierEntry(trait.tierEffects, count) : undefined;
    if (!entry?.teamStats?.length) continue;
    ops.push(...entry.teamStats);
  }

  return ops;
}

export function combatStats(
  unit: Combatant,
  team: Combatant[],
  teamId: TeamId = 'left',
): CombatStats {
  const def = getUnit(unit.templateId);
  const autochessCost = autochessCostOf(def);
  const roleBase = ROLE_BASE[def.role];
  const useOfficialTemplate = Boolean(def.statTemplate);
  const cost = autochessCost;
  const costMult = useOfficialTemplate ? 1 : (COST_MULT[cost] ?? 1);
  const base = useOfficialTemplate ? def.statTemplate! : roleBase;
  const hpStarMult = autochessHpStarMultiplier(autochessCost, unit.star);
  const atkStarMult = autochessAtkStarMultiplier(autochessCost, unit.star);
  const sink = createStatSink({
    hp: Math.round(base.hp * costMult * hpStarMult),
    atk: Math.round(base.atk * costMult * atkStarMult),
    armor: base.armor,
    mr: base.mr,
    aspd: base.aspd,
    range: base.range,
  });

  // 棋子自带常驻属性（数据侧声明，引擎不特判 id）。
  applyStatOps(sink, def.passiveStats);
  // Permanent modifiers declared by skill data.
  applyStatOps(sink, unitSkill(def.id)?.passiveStats);
  // 「safety」合规税：越对齐越安全、越安全越没用（跨回合叠层，卖掉即清除）。
  applyStatOps(sink, safetyOps(unit.safetyStacks ?? 0));
  applyStatOps(sink, unit.tempStats);

  // 装备与心悟里那些「一次性 / 布尔」效果仍是独立档位，数值部分全部走 StatSink。
  let emergencyHealPct = 0;
  let firstCastControlMs = 0;
  let deathBurstHpPct = 0;
  let startUntargetableMs = 0;
  let moveMode: 'advance' | 'backline' | 'cast' | undefined;
  let controlImmune = false;
  let allyBuffPct = 0;
  let burnAtkPctPerTick = 0;
  let ricochetPct = 0;
  let castUntargetableMs = 0;

  for (const itemId of unit.itemIds.slice(0, MAX_ITEMS_PER_UNIT)) {
    const item = findItem(itemId);
    if (!item) continue;
    // 通用属性包（新装备统一走这里）
    applyStatOps(sink, item.stats);
    // 常用字段映射。
    sink.hp += item.hp;
    sink.hpPct += item.hpPct ?? 0;
    sink.atk += item.atk;
    sink.atkPct += item.atkPct ?? 0;
    sink.armor += item.armor;
    sink.armorPct += item.armorPct ?? 0;
    sink.mr += item.mr;
    sink.mrPct += item.mrPct ?? 0;
    applyStatOps(sink, [{ stat: 'aspdPct', value: item.aspdPct }]);
    sink.skillPct += item.skillPct;
    sink.drPct += item.drPct ?? 0;
    sink.    penetrationPct += item.penetrationPct ?? 0;
    sink.penetrationFlat += item.penetrationFlat ?? 0;
    sink.dodgePct += item.dodgePct ?? 0;
    sink.regenPctPerSec += item.regenPctPerSec ?? 0;
    sink.range += item.rangeBonus ?? 0;
    if (item.startShieldPct) applyStatOps(sink, [{ stat: 'startShieldPct', value: item.startShieldPct }]);
    if (item.distanceDamagePctPerTile) applyStatOps(sink, [{ stat: 'distanceDamagePctPerTile', value: item.distanceDamagePctPerTile }]);
    emergencyHealPct = Math.max(emergencyHealPct, item.emergencyHealPct ?? 0);
    firstCastControlMs = Math.max(firstCastControlMs, item.firstCastControlMs ?? 0);
    deathBurstHpPct = Math.max(deathBurstHpPct, item.deathBurstHpPct ?? 0);
    startUntargetableMs = Math.max(startUntargetableMs, item.startUntargetableMs ?? 0);
    moveMode = item.moveMode ?? moveMode;
    controlImmune ||= item.controlImmune ?? false;
    allyBuffPct = Math.max(allyBuffPct, item.allyBuffPct ?? 0);
    burnAtkPctPerTick = Math.max(burnAtkPctPerTick, item.burnAtkPctPerTick ?? 0);
    ricochetPct = Math.max(ricochetPct, item.ricochetPct ?? 0);
    castUntargetableMs = Math.max(castUntargetableMs, item.castUntargetableMs ?? 0);
  }

  // 食用/使用过的一次性道具：永久统计（珍馐等）
  for (const consumedId of unit.consumed ?? []) {
    const item = findItem(consumedId);
    if (!item) continue;
    applyStatOps(sink, item.stats);
    sink.hpPct += item.hpPct ?? 0;
    sink.atkPct += item.atkPct ?? 0;
    sink.armorPct += item.armorPct ?? 0;
    sink.mrPct += item.mrPct ?? 0;
  }

  // 心悟：属性类彼此共鸣（持有 2 个以上属性类心悟时，属性类效果 +50%）
  const ownedHexes = (unit.hexIds ?? []).map((hexId) => findHex(hexId)).filter((hex): hex is NonNullable<typeof hex> => Boolean(hex));
  const attributeHexes = ownedHexes.filter((hex) => hex.tags?.includes('attribute'));
  const resonance = attributeHexes.length >= 2 ? 1.5 : 1;
  const hexAllies = team.filter((member) => member.id !== unit.id);
  for (const hex of ownedHexes) {
    const gate = hex.when;
    if (gate) {
      const adjacent = hexAllies.filter((member) => manhattan({ row: unit.localRow, col: unit.localCol }, { row: member.localRow, col: member.localCol }) <= 1).length;
      if (gate.adjacentAlliesAtLeast !== undefined && adjacent < gate.adjacentAlliesAtLeast) continue;
      if (gate.adjacentAlliesAtMost !== undefined && adjacent > gate.adjacentAlliesAtMost) continue;
      if (gate.noItems !== undefined && (unit.itemIds.length === 0) !== gate.noItems) continue;
      const def = getUnit(unit.templateId);
      if (gate.roleIn !== undefined && !gate.roleIn.includes(def.role)) continue;
      const cost = autochessCostOf(def);
      if (gate.costAtLeast !== undefined && cost < gate.costAtLeast) continue;
      if (gate.costAtMost !== undefined && cost > gate.costAtMost) continue;
    }
    const factor = hex.tags?.includes('attribute') ? resonance : 1;
    applyStatOps(sink, hex.stats?.map((op) => ({ ...op, value: op.value * factor })));
    // Scale declared effects by adjacent ally count.
    if (hex.perAdjacentAlly?.length) {
      const adjacent = hexAllies.filter((member) => manhattan({ row: unit.localRow, col: unit.localCol }, { row: member.localRow, col: member.localCol }) <= 1).length;
      if (adjacent > 0) applyStatOps(sink, hex.perAdjacentAlly.map((op) => ({ ...op, value: op.value * adjacent })));
    }
    sink.hpPct += (hex.hpPct ?? 0) * factor;
    sink.atkPct += (hex.atkPct ?? 0) * factor;
    sink.skillPct += (hex.skillPct ?? 0) * factor;
    applyStatOps(sink, [{ stat: 'aspdPct', value: (hex.aspdPct ?? 0) * factor }]);
    sink.drPct += (hex.drPct ?? 0) * factor;
    sink.armorPct += (hex.armorPct ?? 0) * factor;
    sink.mrPct += (hex.mrPct ?? 0) * factor;
  }

  const counts = uniqueTraitCounts(team);
  const myTraits = new Set(effectiveTraits(unit));

  /** 羁绊档位收集成的一组操作；旧实现里百分比是「乘在已定稿面板上」，所以分两步应用。 */
  const traitOps: StatOp[] = [];

  // 低费升星补正（引擎规则，不是羁绊）
  if (cost <= 2 && unit.star > 1) {
    const mult = unit.star === 2 ? 1.3 : 1.6;
    sink.armor = Math.round(sink.armor * mult + 15);
    sink.mr = Math.round(sink.mr * mult + 15);
  }

  // 羁绊：档位数值全部来自数据表（见 collectTraitOps）
  traitOps.push(...collectTraitOps({ myTraits: [...myTraits], counts, team, unit }));

  // 棋子自带的实时量缩放。
  if (def.scaling) {
    const size = SCALING_METRICS[def.scaling.metric](unit, team, teamId);
    traitOps.push({ stat: def.scaling.stat, value: ladderValue(def.scaling.ladder, size) });
  }

  // 定稿面板 → 羁绊：先加固定值，再乘百分比（与旧实现的乘算语义一致）。
  let hp = Math.round(sink.hp * (1 + sink.hpPct / 100));
  let atk = Math.round(sink.atk * (1 + sink.atkPct / 100));
  let armor = Math.round(sink.armor * (1 + sink.armorPct / 100));
  let mr = Math.round(sink.mr * (1 + sink.mrPct / 100));
  let aspd = sink.aspd;
  let skillPct = sink.skillPct;
  let drPct = sink.drPct;
  let penetrationPct = sink.penetrationPct;
  let dodgePct = sink.dodgePct;
  let regenPctPerSec = sink.regenPctPerSec;
  let rangeBonus = sink.range;

  for (const op of traitOps) {
    switch (op.stat) {
      case 'hp': hp += op.value; break;
      case 'atk': atk += op.value; break;
      case 'armor': armor += op.value; break;
      case 'mr': mr += op.value; break;
      case 'hpPct': hp = Math.round(hp * (1 + op.value / 100)); break;
      case 'atkPct': atk = Math.round(atk * (1 + op.value / 100)); break;
      case 'armorPct': armor = Math.round(armor * (1 + op.value / 100)); break;
      case 'mrPct': mr = Math.round(mr * (1 + op.value / 100)); break;
      case 'aspdPct': aspd *= 1 + op.value / 100; break;
      case 'skillPct': skillPct += op.value; break;
      case 'drPct': drPct += op.value; break;
      case 'penetrationPct': penetrationPct += op.value; break;
      case 'dodgePct': dodgePct += op.value; break;
      case 'regenPctPerSec': regenPctPerSec += op.value; break;
      case 'range': rangeBonus += op.value; break;
      case 'distanceDamagePctPerTile': sink.distanceDamagePctPerTile = Math.max(sink.distanceDamagePctPerTile, op.value); break;
      default: applyStatOps(sink, [op]);
    }
  }

  aspd = Math.min(ASPD_CAP, aspd);
  drPct = Math.min(EXTRA_DR_CAP, drPct);
  const primary = def.factions[0] ?? def.jobs[0] ?? 'untyped';

  return {
    maxHp: hp,
    atk,
    aspd,
    armor,
    mr,
    range: Math.min(6, rangeBonus),
    skillPct,
    basicPct: sink.basicPct,
    dmgPct: sink.dmgPct,
    drPct,
    skillTakenPct: Math.min(80, sink.skillTakenPct),
    penetrationPct: Math.min(75, penetrationPct),
    penetrationFlat: Math.max(0, sink.penetrationFlat),
    dodgePct: Math.min(35, dodgePct),
    critPct: Math.min(100, sink.critPct),
    critDamagePct: sink.critDamagePct,
    lifestealPct: Math.min(80, sink.lifestealPct),
    manaRegenPct: sink.manaRegenPct,
    manaStartFlat: sink.manaStartFlat,
    healReceivePct: sink.healReceivePct,
    regenPctPerSec: Math.min(3, regenPctPerSec),
    moveSpeedPct: sink.moveSpeedPct || 1,
    emergencyHealPct,
    firstCastControlMs,
    deathBurstHpPct,
    startUntargetableMs,
    startShieldPct: Math.min(30, sink.startShieldPct),
    moveMode,
    controlImmune,
    allyBuffPct: Math.min(20, allyBuffPct),
    burnAtkPctPerTick: Math.min(30, burnAtkPctPerTick),
    ricochetPct: Math.min(70, ricochetPct),
    distanceDamagePctPerTile: Math.min(7, sink.distanceDamagePctPerTile),
    castUntargetableMs: Math.min(800, castUntargetableMs),
    trait: primary,
    traitCount: counts.get(primary) ?? 0,
  };
}

export function teamLabel(team: TeamId): string {
  return team === 'left' ? '青方' : '赤方';
}
