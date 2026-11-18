import { getSkill } from '../../content/autochess/skills';
import { ROLE_BASE } from '../../content/autochess/roles';
import { applyStatOps, createStatSink, type StatOp } from '../../content/autochess/stats-vocab';
import type { Role, TraitDef, UnitDef } from '../../content/autochess/types';
import type { UnitSkill } from '../../content/autochess/unit-skills';
import { createBattleEngine } from '../../packages/chess-engine/src/combat';
import { ASPD_CAP, COST_MULT, EXTRA_DR_CAP, MANA_ON_HIT } from '../autochess/constants';
import { collectTraitOps } from '../autochess/stats';
import type { CombatEvent, Combatant, CombatStats } from '../autochess/types';
import type { PackDefinition } from '../../packs/types';
import { compileCustomPack } from './compiler';
import type { CustomPackV1, StudioUnitDef } from './schema';
import { starAtkMultiplierForPack, starHpMultiplierForPack, type StudioStarGrowth } from './star-curves';

export type StudioUnitAnalysis = {
  star: 1 | 2 | 3;
  stats: {
    hp: number;
    atk: number;
    armor: number;
    mr: number;
    aspd: number;
    range: number;
    triggerSummary: string;
  };
  ehpPhys: number;
  ehpMagic: number;
  avgEhp: number;
  autoDps: number;
  firstCastSec: number | null;
  est15sOutput: number;
  ehpRatioPct: number;
  dpsRatioPct: number;
  budgetRatioPct: number;
  rating: 'undertuned' | 'balanced' | 'overtuned';
  ratingNote: string;
};

export type StudioMatrixCell = {
  factionId: string;
  jobId: string;
  units: { id: string; name: string; cost: number; role: Role; spriteId: string }[];
};

export type StudioPackAnalysis = {
  unitCount: number;
  factionCount: number;
  jobCount: number;
  itemCount: number;
  costHistogram: Record<1 | 2 | 3 | 4 | 5, number>;
  roleCounts: Record<Role, number>;
  frontlineCount: number;
  backlineCount: number;
  frontlineRatioPct: number;
  emptyMatrixCells: number;
  totalMatrixCells: number;
  matrix: StudioMatrixCell[];
  unitBudgets: {
    id: string;
    name: string;
    cost: number;
    role: Role;
    ehpPhys: number;
    autoDps: number;
    budgetRatioPct: number;
    rating: 'undertuned' | 'balanced' | 'overtuned';
  }[];
  outliers: string[];
  systemNotes: string[];
};

export type StudioDuelRequest = {
  leftUnitId: string;
  leftStar: 1 | 2 | 3;
  leftItemIds?: string[];
  leftPos?: { row: number; col: number };
  rightUnitId: string;
  rightStar: 1 | 2 | 3;
  rightItemIds?: string[];
  rightPos?: { row: number; col: number };
  seed?: number;
};

export type StudioDuelSideSummary = {
  unitId: string;
  name: string;
  star: 1 | 2 | 3;
  startMaxHp: number;
  startAtk: number;
  survivingHp: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  casts: number;
};

export type StudioDuelResult = {
  seed: number;
  winner: 'left' | 'right' | 'draw';
  winnerLabel: string;
  durationSec: number;
  theoreticalRawTtkLeftToRightSec: number;
  theoreticalRawTtkRightToLeftSec: number;
  left: StudioDuelSideSummary;
  right: StudioDuelSideSummary;
  highlights: { timeSec: number; type: CombatEvent['type']; text: string }[];
};

export function roleBaselineStats(cost: 1 | 2 | 3 | 4 | 5, role: Role): StudioUnitDef['stats'] {
  const base = ROLE_BASE[role];
  const mult = COST_MULT[cost] ?? 1;
  return {
    hp: Math.round(base.hp * mult),
    atk: Math.round(base.atk * mult),
    armor: base.armor,
    mr: base.mr,
    aspd: base.aspd,
    range: base.range,
  };
}

function estimateSingleProcOutput(
  unit: StudioUnitDef,
  star: 1 | 2 | 3,
  scaledAtk: number,
  scaledHp: number,
): number {
  const idx = star - 1;
  let total = 0;
  for (const eff of unit.skill.effects) {
    const countMult = unit.skill.target === 'all_enemies' || unit.skill.target === 'all_allies'
      ? 1.8
      : Math.min(2.2, 1 + (unit.skill.targetCount - 1) * 0.6);
    if (eff.kind === 'damage') {
      const dmg = (eff.baseByStar[idx] ?? 0) + (scaledAtk * eff.atkPct) / 100 + (scaledHp * (eff.hpPct ?? 0)) / 100;
      total += dmg * (eff.damageType === 'true' ? 1.25 : 1) * countMult;
    } else if (eff.kind === 'shield' || eff.kind === 'heal') {
      const val = (eff.baseByStar[idx] ?? 0) + (scaledHp * eff.hpPct) / 100;
      total += val * 0.9 * countMult;
    } else if (eff.kind === 'stun') {
      total += ((eff.durationMsByStar[idx] ?? 1000) / 1000) * scaledAtk * 0.85 * countMult;
    }
  }
  return total;
}

export function analyzeStudioUnit(
  unit: StudioUnitDef,
  growth: StudioStarGrowth,
  star: 1 | 2 | 3,
): StudioUnitAnalysis {
  const hpMult = starHpMultiplierForPack(growth, unit.cost, star);
  const atkMult = starAtkMultiplierForPack(growth, unit.cost, star);

  const hp = Math.round(unit.stats.hp * hpMult);
  const atk = Math.round(unit.stats.atk * atkMult);
  let armor = unit.stats.armor;
  let mr = unit.stats.mr;
  if (growth.lowCostDefBonus && unit.cost <= 2 && star > 1) {
    const mult = star === 2 ? 1.3 : 1.6;
    armor = Math.round(armor * mult + 15);
    mr = Math.round(mr * mult + 15);
  }
  const aspd = unit.stats.aspd;
  const range = unit.stats.range;

  const ehpPhys = Math.round(hp * (1 + armor / 100));
  const ehpMagic = Math.round(hp * (1 + mr / 100));
  const avgEhp = Math.round((ehpPhys + ehpMagic) / 2);
  const autoDps = Number((atk * aspd).toFixed(1));

  let firstCastSec: number | null = null;
  let castsIn15s = 0;
  let triggerSummary = '';
  const trig = unit.skill.trigger;
  if (trig.kind === 'mana') {
    const startMana = trig.startMana ?? 0;
    const manaNeeded = Math.max(0, trig.maxMana - startMana);
    const hitsNeeded = Math.ceil(manaNeeded / MANA_ON_HIT);
    firstCastSec = Number((hitsNeeded / aspd).toFixed(2));
    const cycleSec = Math.max(1 / aspd, trig.maxMana / (aspd * MANA_ON_HIT));
    if (firstCastSec <= 15) {
      castsIn15s = 1 + Math.floor((15 - firstCastSec) / cycleSec);
    }
    triggerSummary = `${trig.maxMana} 蓝条（首秀约 ${firstCastSec}s）`;
  } else if (trig.kind === 'every_attacks') {
    firstCastSec = Number((trig.count / aspd).toFixed(2));
    castsIn15s = Math.floor((15 * aspd) / trig.count);
    triggerSummary = `每 ${trig.count} 次普攻（约 ${firstCastSec}s 触发）`;
  } else if (trig.kind === 'battle_start') {
    firstCastSec = 0;
    castsIn15s = 1;
    triggerSummary = '开战 0.0s 瞬发';
  } else {
    firstCastSec = Number((trig.everyMs / 1000).toFixed(2));
    castsIn15s = Math.floor(15000 / trig.everyMs);
    triggerSummary = `每 ${(trig.everyMs / 1000).toFixed(1)}s 周期触发`;
  }

  const estSkillPerProc = estimateSingleProcOutput(unit, star, atk, hp);
  const est15sOutput = Math.round(autoDps * 15 + estSkillPerProc * castsIn15s);

  // Compare unit chassis at target star against same-cost role baseline at that star.
  const baseline = roleBaselineStats(unit.cost, unit.role);
  const baseHp = Math.round(baseline.hp * hpMult);
  const baseAtk = Math.round(baseline.atk * atkMult);
  let baseArmor = baseline.armor;
  let baseMr = baseline.mr;
  if (growth.lowCostDefBonus && unit.cost <= 2 && star > 1) {
    const mult = star === 2 ? 1.3 : 1.6;
    baseArmor = Math.round(baseArmor * mult + 15);
    baseMr = Math.round(baseMr * mult + 15);
  }
  const baseAvgEhp = Math.max(1, (baseHp * (1 + baseArmor / 100) + baseHp * (1 + baseMr / 100)) / 2);
  const baseAutoDps = Math.max(1, baseAtk * baseline.aspd);

  const ehpRatio = avgEhp / baseAvgEhp;
  const dpsRatio = autoDps / baseAutoDps;
  const ehpRatioPct = Math.round(ehpRatio * 100);
  const dpsRatioPct = Math.round(dpsRatio * 100);
  const budgetRatioPct = Math.round(Math.sqrt(Math.max(0.01, ehpRatio * dpsRatio)) * 100);

  let rating: StudioUnitAnalysis['rating'] = 'balanced';
  let ratingNote = '攻防模型贴合同费同定位标准模板';
  if (budgetRatioPct < 82) {
    rating = 'undertuned';
    ratingNote = '基础面板偏薄弱，除非技能倍率极高，否则前期难以站场';
  } else if (budgetRatioPct > 122) {
    rating = 'overtuned';
    ratingNote = '身板/秒伤显著高于同费模板，建议用更高蓝条或下调面板平衡';
  }

  return {
    star,
    stats: { hp, atk, armor, mr, aspd, range, triggerSummary },
    ehpPhys,
    ehpMagic,
    avgEhp,
    autoDps,
    firstCastSec,
    est15sOutput,
    ehpRatioPct,
    dpsRatioPct,
    budgetRatioPct,
    rating,
    ratingNote,
  };
}

export function analyzeStudioPack(pack: CustomPackV1): StudioPackAnalysis {
  const factions = pack.traits.filter((t) => t.kind === 'faction');
  const jobs = pack.traits.filter((t) => t.kind === 'job');

  const matrix: StudioMatrixCell[] = [];
  let emptyMatrixCells = 0;
  for (const faction of factions) {
    for (const job of jobs) {
      const matched = pack.units
        .filter((u) => u.factions.includes(faction.id) && u.jobs.includes(job.id))
        .map((u) => ({
          id: u.id,
          name: u.name,
          cost: u.cost,
          role: u.role,
          spriteId: u.spriteId,
        }));
      if (matched.length === 0) emptyMatrixCells += 1;
      matrix.push({ factionId: faction.id, jobId: job.id, units: matched });
    }
  }

  const costHistogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const roleCounts: Record<Role, number> = { tank: 0, melee: 0, ranged: 0, caster: 0, support: 0 };
  const unitBudgets: StudioPackAnalysis['unitBudgets'] = [];
  const outliers: string[] = [];

  for (const unit of pack.units) {
    costHistogram[unit.cost] += 1;
    roleCounts[unit.role] += 1;
    const analysis = analyzeStudioUnit(unit, pack.starGrowth, 1);
    unitBudgets.push({
      id: unit.id,
      name: unit.name,
      cost: unit.cost,
      role: unit.role,
      ehpPhys: analysis.ehpPhys,
      autoDps: analysis.autoDps,
      budgetRatioPct: analysis.budgetRatioPct,
      rating: analysis.rating,
    });
    if (analysis.rating === 'overtuned') {
      outliers.push(`${unit.name}（${unit.cost}费）1★ 预算占比 ${analysis.budgetRatioPct}% 偏高`);
    } else if (analysis.rating === 'undertuned') {
      outliers.push(`${unit.name}（${unit.cost}费）1★ 预算占比 ${analysis.budgetRatioPct}% 偏低`);
    }
  }

  const frontlineCount = roleCounts.tank + roleCounts.melee;
  const backlineCount = roleCounts.ranged + roleCounts.caster + roleCounts.support;
  const totalUnits = Math.max(1, pack.units.length);
  const frontlineRatioPct = Math.round((frontlineCount / totalUnits) * 100);

  const systemNotes: string[] = [];
  if (pack.units.length > 0 && frontlineRatioPct < 25) {
    systemNotes.push(`前排（坦/近战）仅占 ${frontlineRatioPct}%，实战可能缺少承伤棋子`);
  } else if (pack.units.length > 0 && frontlineRatioPct > 70) {
    systemNotes.push(`前排占比高达 ${frontlineRatioPct}%，后排输出与法系可能偏少`);
  }
  if (pack.units.length >= 8 && costHistogram[1] + costHistogram[2] < 3) {
    systemNotes.push('1~2 费低费卡偏少，玩家前期连败或卡池深度会不足');
  }
  if (pack.units.length >= 12 && costHistogram[4] + costHistogram[5] === 0) {
    systemNotes.push('缺少 4~5 费后期核心棋子，大后期运营升级收益较低');
  }

  return {
    unitCount: pack.units.length,
    factionCount: factions.length,
    jobCount: jobs.length,
    itemCount: pack.items.length,
    costHistogram,
    roleCounts,
    frontlineCount,
    backlineCount,
    frontlineRatioPct,
    emptyMatrixCells,
    totalMatrixCells: matrix.length,
    matrix,
    unitBudgets,
    outliers,
    systemNotes,
  };
}

function createIsolatedBattleEngine(definition: PackDefinition) {
  const unitMap = new Map<string, UnitDef>(definition.roster.map((u) => [u.id, u]));
  const traitMap = new Map<string, TraitDef>(definition.traits.map((t) => [t.id, t]));
  const itemMap = new Map(definition.items.map((i) => [i.id, i]));
  const skillMap: Record<string, UnitSkill> = definition.skills ?? {};

  const getUnit = (id: string): UnitDef => {
    const unit = unitMap.get(id);
    if (!unit) throw new Error(`测桩未找到棋子: ${id}`);
    return unit;
  };
  const findTrait = (id: string): TraitDef | null => traitMap.get(id) ?? null;
  const findItem = (id: string) => itemMap.get(id) ?? null;

  const effectiveTraits = (unit: Pick<Combatant, 'templateId' | 'itemIds' | 'hexIds'>): string[] => {
    const def = getUnit(unit.templateId);
    const out = [...def.factions, ...def.jobs, ...(def.grantTraits ?? [])];
    for (const itemId of unit.itemIds.slice(0, 2)) {
      const item = findItem(itemId);
      if (item?.grantTraits?.length) out.push(...item.grantTraits);
    }
    return out;
  };

  const uniqueTraitCounts = (team: Combatant[]): Map<string, number> => {
    const sets = new Map<string, Set<string>>();
    for (const unit of team) {
      for (const id of effectiveTraits(unit)) {
        const set = sets.get(id) ?? new Set<string>();
        set.add(unit.templateId);
        sets.set(id, set);
      }
    }
    const counts = new Map<string, number>();
    for (const [id, set] of sets) counts.set(id, set.size);
    return counts;
  };

  const combatStats = (unit: Combatant, team: Combatant[]): CombatStats => {
    const def = getUnit(unit.templateId);
    const cost = def.autochessCost ?? def.cost;
    const base = def.statTemplate ?? ROLE_BASE[def.role];
    const hpMult = def.starMult?.hp[unit.star - 1] ?? 1;
    const atkMult = def.starMult?.atk[unit.star - 1] ?? 1;
    const sink = createStatSink({
      hp: Math.round(base.hp * hpMult),
      atk: Math.round(base.atk * atkMult),
      armor: base.armor,
      mr: base.mr,
      aspd: base.aspd,
      range: base.range,
    });

    if (!def.disableLowCostStarBonus && cost <= 2 && unit.star > 1) {
      const mult = unit.star === 2 ? 1.3 : 1.6;
      sink.armor = Math.round(sink.armor * mult + 15);
      sink.mr = Math.round(sink.mr * mult + 15);
    }

    applyStatOps(sink, def.passiveStats);
    applyStatOps(sink, skillMap[def.id]?.passiveStats);
    for (const itemId of unit.itemIds.slice(0, 2)) {
      const item = findItem(itemId);
      if (!item) continue;
      applyStatOps(sink, item.stats);
    }

    const counts = uniqueTraitCounts(team);
    const myTraits = [...new Set(effectiveTraits(unit))];
    const traitOps: StatOp[] = collectTraitOps({
      myTraits,
      counts,
      team,
      unit,
      resolveTrait: findTrait,
    });

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
      emergencyHealPct: 0,
      firstCastControlMs: 0,
      deathBurstHpPct: 0,
      startUntargetableMs: 0,
      startShieldPct: Math.min(30, sink.startShieldPct),
      moveMode: undefined,
      controlImmune: false,
      allyBuffPct: 0,
      burnAtkPctPerTick: 0,
      ricochetPct: 0,
      distanceDamagePctPerTile: Math.min(7, sink.distanceDamagePctPerTile),
      castUntargetableMs: 0,
      trait: primary,
      traitCount: counts.get(primary) ?? 0,
    };
  };

  return {
    combatStats,
    simulate: createBattleEngine({
      getUnit,
      getSkill,
      unitSkill: (id) => skillMap[id],
      findHex: () => null,
      findItem,
      combatStats,
      effectiveTraits,
      uniqueTraitCounts,
      traits: definition.traits,
      items: definition.items,
    }),
  };
}

export function simulateStudioDuel(
  pack: CustomPackV1,
  request: StudioDuelRequest,
): StudioDuelResult {
  const compiled = compileCustomPack(pack);
  const leftTemplate = compiled.unitIdMap[request.leftUnitId];
  const rightTemplate = compiled.unitIdMap[request.rightUnitId];
  if (!leftTemplate) throw new Error(`左方棋子不存在: ${request.leftUnitId}`);
  if (!rightTemplate) throw new Error(`右方棋子不存在: ${request.rightUnitId}`);

  const mapItems = (ids: readonly string[] = []) =>
    ids.slice(0, 2).map((id) => compiled.itemIdMap[id]).filter((id): id is string => Boolean(id));

  const leftPiece: Combatant = {
    id: 'duel-left',
    templateId: leftTemplate,
    star: request.leftStar,
    localRow: request.leftPos?.row ?? 3,
    localCol: request.leftPos?.col ?? 2,
    itemIds: mapItems(request.leftItemIds),
  };
  const rightPiece: Combatant = {
    id: 'duel-right',
    templateId: rightTemplate,
    star: request.rightStar,
    localRow: request.rightPos?.row ?? 3,
    localCol: request.rightPos?.col ?? 2,
    itemIds: mapItems(request.rightItemIds),
  };

  const engine = createIsolatedBattleEngine(compiled.definition);
  const leftStats = engine.combatStats(leftPiece, [leftPiece]);
  const rightStats = engine.combatStats(rightPiece, [rightPiece]);

  const seed = request.seed ?? 20261117;
  const output = engine.simulate({
    battleId: `duel-${request.leftUnitId}-vs-${request.rightUnitId}-${seed}`,
    seed,
    left: [leftPiece],
    right: [rightPiece],
  });

  const leftLine = output.units.find((u) => u.id === 'duel-left')!;
  const rightLine = output.units.find((u) => u.id === 'duel-right')!;

  const physDmgFactor = (armor: number) => 100 / (100 + armor);
  const leftPerHit = Math.max(1, leftStats.atk * physDmgFactor(rightStats.armor));
  const rightPerHit = Math.max(1, rightStats.atk * physDmgFactor(leftStats.armor));
  const theoreticalRawTtkLeftToRightSec = Number(
    (rightStats.maxHp / (leftPerHit * leftStats.aspd)).toFixed(2),
  );
  const theoreticalRawTtkRightToLeftSec = Number(
    (leftStats.maxHp / (rightPerHit * rightStats.aspd)).toFixed(2),
  );

  const highlights = output.events
    .filter((ev) => ev.type === 'cast' || ev.type === 'shield' || ev.type === 'regen' || ev.type === 'death' || ev.type === 'end')
    .slice(0, 14)
    .map((ev) => ({
      timeSec: Number((ev.timeMs / 1000).toFixed(2)),
      type: ev.type,
      text: ev.text,
    }));

  const leftName = pack.units.find((u) => u.id === request.leftUnitId)?.name ?? request.leftUnitId;
  const rightName = pack.units.find((u) => u.id === request.rightUnitId)?.name ?? request.rightUnitId;

  return {
    seed,
    winner: output.outcome,
    winnerLabel:
      output.outcome === 'left'
        ? `青方胜（${leftName} ${request.leftStar}★）`
        : output.outcome === 'right'
          ? `赤方胜（${rightName} ${request.rightStar}★）`
          : '平局',
    durationSec: Number((output.durationMs / 1000).toFixed(2)),
    theoreticalRawTtkLeftToRightSec,
    theoreticalRawTtkRightToLeftSec,
    left: {
      unitId: request.leftUnitId,
      name: leftName,
      star: request.leftStar,
      startMaxHp: leftStats.maxHp,
      startAtk: leftStats.atk,
      survivingHp: leftLine.survivingHp,
      damageDealt: leftLine.damageDealt,
      damageTaken: leftLine.damageTaken,
      healingDone: leftLine.healingDone,
      casts: leftLine.casts,
    },
    right: {
      unitId: request.rightUnitId,
      name: rightName,
      star: request.rightStar,
      startMaxHp: rightStats.maxHp,
      startAtk: rightStats.atk,
      survivingHp: rightLine.survivingHp,
      damageDealt: rightLine.damageDealt,
      damageTaken: rightLine.damageTaken,
      healingDone: rightLine.healingDone,
      casts: rightLine.casts,
    },
    highlights,
  };
}
