import { getSkill, skillRawDamage } from '../../content/autochess/skills';
import { traits as allTraitDefs } from '../../content/autochess/traits';
import { unitSkill, type SkillPrimitive, type SkillScale, type UnitSkill } from '../../content/autochess/unit-skills';
import { findHex } from '../../content/autochess/hexes';
import { items as allItems } from '../../content/autochess/items';
import { getUnit } from '../../content/autochess/units';
import {
  AUTOCHESS_MAX_BATTLE_MS,
  BOARD_COLS,
  HALF_ROWS,
  CONFIG_VERSION,
  MANA_MAX,
  MANA_ON_HIT,
  MANA_ON_TAKEN,
  MANA_REGEN_BASE_PER_SEC,
  MANA_TAKEN_CAP_PER_SEC,
  MAX_BATTLE_MS,
  MOVE_MS,
  RULES_VERSION,
  SHIELD_CAP_PCT,
  SLICE_POP_CAP,
  SUDDEN_DEATH_MAX_BONUS,
  SUDDEN_DEATH_MS,
  SUDDEN_DEATH_STEP,
  TICK_MS,
} from './constants';
import { cellKey, inBounds, manhattan, neighbors, nextStepToward, worldPos } from './grid';
import { hashString } from './rng';
import {applyCombatForm,expireCombatForm,changeFormStat,isFormStat,type TemporaryForm} from './combat-form';
import { combatStats, effectiveTraits, teamLabel, uniqueTraitCounts } from './stats';
import type {
  BattleInput,
  BattleOutcome,
  BattleOutput,
  CombatEvent,
  CombatEventType,
  Combatant,
  TeamId,
  UnitStatLine,
  Vec,
} from './types';
import type { ItemTrigger, SkillRewrite, TraitMechanic, TriggerTiming } from '../../content/autochess/types';

type Fighter = {
  id: string;
  team: TeamId;
  templateId: string;
  name: string;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  atk: number;
  aspd: number;
  armor: number;
  mr: number;
  range: number;
  skillPct: number;
  /** 造成伤害提高（doc 的「增伤」）。 */
  dmgPct: number;
  drPct: number;
  /** 受到技能伤害降低。 */
  skillTakenPct: number;
  /** 伤害吸血。 */
  lifestealPct: number;
  penetrationPct: number;
  /** 破防（固定值忽视防御）与会心结算辅助。 */
  penetrationFlat: number;
  critDamagePct: number;
  hitCounter: number;
  dodgePct: number;
  regenPctPerSec: number;
  emergencyHealPct: number;
  emergencyUsed: boolean;
  firstCastControlMs: number;
  controlUsed: boolean;
  controlImmune: boolean;
  /** 面板自带的免控（用于限时免控到期后还原）。 */
  baseControlImmune: boolean;
  /** 限时免控。 */
  controlImmuneUntil?: number;
  /** 移速倍率（黑洞 30% 减速等）。 */
  moveSpeedPct: number;
  deathBurstHpPct: number;
  deathBurstUsed: boolean;
  moveMode?: 'advance' | 'backline' | 'cast';
  allyBuffPct: number;
  allyBuffUsed: boolean;
  burnAtkPctPerTick: number;
  ricochetPct: number;
  distanceDamagePctPerTile: number;
  castUntargetableMs: number;
  skillId: string;
  hexIds: string[];
  star: 1 | 2 | 3;
  traits: string[];
  temporaryForm?: TemporaryForm;
  summon: boolean;
  mana: number;
  manaCost: number;
  attackReadyAt: number;
  moveReadyAt: number;
  shield: number;
  shieldUntil: number;
  hitMana: number;
  hitWindow: number;
  damageDealt: number;
  healingDone: number;
  damageTaken: number;
  casts: number;
  revived: boolean;
  targetable: boolean;
  untargetableUntil: number;
  stunUntil: number;
  /** Silence prevents skill casts. */
  silenceUntil: number;
  /** Disarm prevents basic attacks. */
  disarmUntil: number;
  /** 普攻次数与剩余复活次数：给数据驱动的技能用。 */
  attackCount: number;
  revivesLeft: number;
  /** 本场击杀数。 */
  kills: number;
  /** 开战时的内力（蓝条显示用）。 */
  spawnMana: number;
  /** 该方棋手是否全场气血最低。 */
  playerHpLowest?: boolean;
  /** 普攻追加效果，到期自动失效。 */
  riders: { until: number; everyNth?: number; counter: number; effects: SkillPrimitive[] }[];
  /** 召唤物：主人 id + 是否朝主人的目标开火 + 消失时间。 */
  parentId?: string;
  turret?: boolean;
  expireAt?: number;
  /** 数据驱动叠层，键里可带目标 id。 */
  stacks: Map<string, number>;
  /** 伤害格挡池，每秒衰减。 */
  blockPool: number;
  blockTickAt: number;
  /** 免死窗口：致死伤害留 1 血。 */
  undyingUntil: number;
  /** 免死触发时追加的技能。 */
  undyingBurst?: SkillPrimitive[];
  /** 临时普攻改写。 */
  attackOverride?: { until: number; scale: SkillScale; segments?: number };
  /** 面板自带属性，用于装备 proc 的读取。 */
  itemIds: string[];
  /** 每个 trigger 的上次触发时刻。 */
  triggerAt: Map<string, number>;
  /** 面板基准值：给「内力转属性」这类按基准重算的效果用。 */
  baseMaxHp: number;
  baseAtk: number;
  /** 内力回复相关。 */
  manaRegenPct: number;
  manaRegenAt: number;
  /** 普攻增伤与受疗加成。 */
  basicPct: number;
  healReceivePct: number;
  /** 周期被动的上次结算时刻。 */
  lastTickAt: number;
  /** 漂浮：不可选中并按时间成长，可提前引爆。 */
  floating?: { startAt: number; until: number; radiusFrom: number; radiusTo: number; pctFrom: number; pctTo: number; hpThreshold: number; share: boolean };
  critPct: number;
  kiteReadyAt: number;
  lastMovedAt: number;
};

function rewriteEffects(effects: readonly SkillPrimitive[], rewrite: SkillRewrite): SkillPrimitive[] {
  return effects.map((effect) => {
    const next = { ...effect } as SkillPrimitive;
    if (rewrite.castRadiusDelta && 'radius' in next && typeof next.radius === 'number') {
      next.radius += rewrite.castRadiusDelta;
    }
    if (rewrite.castCountDelta && next.op === 'damage') {
      next.count = (next.count ?? 1) + rewrite.castCountDelta;
    }
    if ('effects' in next && Array.isArray(next.effects)) {
      return { ...next, effects: rewriteEffects(next.effects, rewrite) } as SkillPrimitive;
    }
    return next;
  });
}

function liveUnitSkill(fighter: Fighter, units: Fighter[]): UnitSkill | undefined {
  const base = unitSkill(fighter.templateId);
  if (!base || !fighter.hexIds.length) return base;
  let current = base;
  for (const hexId of fighter.hexIds) {
    const hex = findHex(hexId);
    for (const rewrite of hex?.skillRewrites ?? []) {
      if (rewrite.unitId !== fighter.templateId) continue;
      if (rewrite.strongestOnly) {
        const peers = units.filter((unit) => unit.templateId === fighter.templateId && unit.hexIds.includes(hexId));
        const strongest = [...peers].sort((a, b) => (b.atk + b.maxHp) - (a.atk + a.maxHp) || a.id.localeCompare(b.id))[0];
        if (strongest?.id !== fighter.id) continue;
      }
      current = {
        ...current,
        mana: current.mana + (rewrite.castManaDelta ?? 0),
        cast: rewrite.castEffects
          ? [...(current.cast ?? []), ...rewrite.castEffects]
          : current.cast,
        onAttack: rewrite.onAttackEffects
          ? [...(current.onAttack ?? []), ...rewrite.onAttackEffects]
          : current.onAttack,
        ...(rewrite.castRadiusDelta || rewrite.castCountDelta
          ? { cast: rewriteEffects(current.cast ?? [], rewrite) }
          : {}),
      };
    }
  }
  return current;
}

type ScheduledEffect = {
  at: number;
  kind: 'stat-revert' | 'skill-fx';
  sourceId: string;
  targetId?: string;
  skillId: string;
  /** stat-revert：临时增益到期后还原（数据驱动技能用）。 */
  revert?: { stat: string; factor: number };
  /** skill-fx: delayed resolution for scheduled skill primitives. */
  skillFx?: SkillPrimitive[];
};

type Intent =
  | { kind: 'cast'; fighter: Fighter; target: Fighter }
  | { kind: 'attack'; fighter: Fighter; target: Fighter }
  | { kind: 'move'; fighter: Fighter; dest: Vec; reason?: 'advance' | 'kite' }
  | { kind: 'swap'; fighter: Fighter; blocker: Fighter };

function living(units: Fighter[]): Fighter[] {
  return units.filter((unit) => unit.hp > 0);
}

function foesOf(self: Fighter, units: Fighter[]): Fighter[] {
  return living(units).filter((unit) => unit.team !== self.team && unit.targetable);
}

function alliesOf(self: Fighter, units: Fighter[]): Fighter[] {
  return living(units).filter((unit) => unit.team === self.team);
}

function comparePos(a: Fighter, b: Fighter): number {
  if (a.row !== b.row) return a.row - b.row;
  if (a.col !== b.col) return a.col - b.col;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Ties must be broken relative to the attacker, not by absolute row. Sorting by
 * absolute row meant the right-hand team always picked the nearest foe while
 * the left-hand team reached past it, which handed the right side the fight.
 */
function nearest(self: Fighter, foes: Fighter[]): Fighter | null {
  if (foes.length === 0) return null;
  return [...foes].sort((a, b) => {
    const da = manhattan(self, a);
    const db = manhattan(self, b);
    if (da !== db) return da - db;
    const ra = Math.abs(a.row - self.row);
    const rb = Math.abs(b.row - self.row);
    if (ra !== rb) return ra - rb;
    if (a.col !== b.col) return a.col - b.col;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0]!;
}

function lowestHpAlly(self: Fighter, units: Fighter[]): Fighter {
  return [...alliesOf(self, units)].sort((a, b) => {
    const ra = a.hp / a.maxHp;
    const rb = b.hp / b.maxHp;
    if (ra !== rb) return ra - rb;
    return comparePos(a, b);
  })[0]!;
}

function mitigated(raw: number, resist: number): number {
  if (raw <= 0) return 0;
  return Math.max(1, Math.floor((raw * 100) / (100 + Math.max(0, resist))));
}

function mitigatedBy(source: Fighter, raw: number, resist: number, target?: Fighter): number {
  // 破防（固定值）先削防御，再按百分比穿透。
  const shaved = Math.max(0, resist - source.penetrationFlat);
  const effectiveResist = shaved * (1 - source.penetrationPct / 100);
  const distancePct = target
    ? Math.min(35, Math.max(0, manhattan(source, target) - 1) * source.distanceDamagePctPerTile)
    : 0;
  // 增伤（doc 的 ⚔️ 增伤）对所有输出生效：普攻与技能统一在这里收口。
  // 会心：按会心率掷骰，会心时用会心伤害倍率（文档 200% = ×2）。
  let critMult = 1;
  if (source.critPct > 0 && target && target.team !== source.team) {
    source.hitCounter += 1;
    const roll = hashString(source.hitCounter * 7919, `${source.id}:${target.id}`) % 100;
    if (roll < Math.min(100, source.critPct)) critMult = Math.max(1, (source.critDamagePct || 200) / 100);
  }
  const dealt = raw * (1 + (source.dmgPct ?? 0) / 100) * critMult;
  return mitigated(Math.floor(dealt * (1 + distancePct / 100)), effectiveResist);
}

/**
 * Overtime has to actually end the fight. A gentle +5%/s left two front-liners
 * grinding to the 40s cap, so nearly every even board scored a draw.
 */
function damageMult(timeMs: number): number {
  if (timeMs < SUDDEN_DEATH_MS) return 1;
  const seconds = Math.floor((timeMs - SUDDEN_DEATH_MS) / 1000);
  return 1 + Math.min(SUDDEN_DEATH_MAX_BONUS, SUDDEN_DEATH_STEP * seconds);
}

function healMult(timeMs: number): number {
  return timeMs >= MAX_BATTLE_MS ? Math.max(0, 0.5 - (timeMs - MAX_BATTLE_MS) / 10000) : timeMs >= SUDDEN_DEATH_MS ? 0.5 : 1;
}

function shieldCap(maxHp: number): number {
  return Math.floor((maxHp * SHIELD_CAP_PCT) / 100);
}

function spawnFighter(
  unit: Combatant,
  team: TeamId,
  roster: Combatant[],
  seed: number,
): Fighter {
  const def = getUnit(unit.templateId);
  const stats = combatStats(unit, roster, team);
  const pos = worldPos(team, unit.localRow, unit.localCol);
  const delay = hashString(seed, unit.id) % 400;
  return {
    id: unit.id,
    team,
    templateId: unit.templateId,
    name: def.name,
    row: pos.row,
    col: pos.col,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    aspd: stats.aspd,
    armor: stats.armor,
    mr: stats.mr,
    range: stats.range,
    skillPct: stats.skillPct,
    dmgPct: stats.dmgPct,
    drPct: stats.drPct,
    skillTakenPct: stats.skillTakenPct,
    lifestealPct: stats.lifestealPct,
    penetrationPct: stats.penetrationPct,
    penetrationFlat: stats.penetrationFlat,
    critDamagePct: stats.critDamagePct,
    hitCounter: 0,
    dodgePct: stats.dodgePct,
    regenPctPerSec: stats.regenPctPerSec,
    emergencyHealPct: stats.emergencyHealPct,
    emergencyUsed: false,
    firstCastControlMs: stats.firstCastControlMs,
    controlUsed: false,
    controlImmune: stats.controlImmune,
    baseControlImmune: stats.controlImmune,
    moveSpeedPct: stats.moveSpeedPct || 1,
    deathBurstHpPct: stats.deathBurstHpPct,
    deathBurstUsed: false,
    moveMode: stats.moveMode,
    allyBuffPct: stats.allyBuffPct,
    allyBuffUsed: false,
    burnAtkPctPerTick: stats.burnAtkPctPerTick,
    ricochetPct: stats.ricochetPct,
    distanceDamagePctPerTile: stats.distanceDamagePctPerTile,
    castUntargetableMs: stats.castUntargetableMs,
    skillId: def.autochessSkillId ?? def.skillId,
    hexIds: [...(unit.hexIds ?? [])],
    star: unit.star,
    traits: effectiveTraits(unit),
    summon: def.summon,
    mana: Math.min(Math.max(0, (unit.initialMana ?? 0) + stats.manaStartFlat), Math.max(1, def.manaByStar?.[unit.star - 1] ?? MANA_MAX)),
    spawnMana: Math.min(Math.max(0, (unit.initialMana ?? 0) + stats.manaStartFlat), Math.max(1, def.manaByStar?.[unit.star - 1] ?? MANA_MAX)),
    manaCost: Math.max(1, def.manaByStar?.[unit.star - 1] ?? MANA_MAX),
    attackReadyAt: delay,
    moveReadyAt: delay,
    shield: Math.floor(stats.maxHp * stats.startShieldPct / 100),
    shieldUntil: stats.startShieldPct > 0 ? MAX_BATTLE_MS : 0,
    hitMana: 0,
    hitWindow: 0,
    damageDealt: 0,
    healingDone: 0,
    damageTaken: 0,
    casts: 0,
    revived: false,
    targetable: stats.startUntargetableMs <= 0,
    untargetableUntil: stats.startUntargetableMs,
    stunUntil: 0,
    silenceUntil: 0,
    disarmUntil: 0,
    attackCount: 0,
    kills: 0,
    revivesLeft: (unitSkill(unit.templateId)?.onDeath ?? []).reduce(
      (max, effect) => (effect.op === 'revive' ? Math.max(max, effect.max) : max),
      0,
    ),
    riders: [],
    stacks: new Map<string, number>(),
    blockPool: 0,
    blockTickAt: 0,
    undyingUntil: 0,
    baseMaxHp: stats.maxHp,
    baseAtk: stats.atk,
    itemIds: [...unit.itemIds],
    triggerAt: new Map<string, number>(),
    manaRegenPct: stats.manaRegenPct,
    manaRegenAt: 0,
    basicPct: stats.basicPct,
    healReceivePct: stats.healReceivePct,
    lastTickAt: 0,
    critPct: stats.critPct,
    kiteReadyAt: 0,
    lastMovedAt: 0,
  };
}

function firstEmpty(team: TeamId, units: Fighter[]): { row: number; col: number } | null {
  const rows = Array.from(
    { length: HALF_ROWS },
    (_, index) => team === 'left' ? HALF_ROWS + index : HALF_ROWS - 1 - index,
  );
  const blocked = occupiedKeys(units);
  for (const row of rows) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const pos = { row, col };
      if (inBounds(pos) && !blocked.has(cellKey(pos))) return pos;
    }
  }
  return null;
}

function occupiedKeys(units: Fighter[]): Set<number> {
  const blocked = new Set<number>();
  for (const unit of living(units)) blocked.add(cellKey(unit));
  return blocked;
}

function skillTarget(self: Fighter, units: Fighter[]): Fighter | null {
  const skill = getSkill(self.skillId);
  if (skill.kind === 'self_shield') return self.hp > 0 ? self : null;
  if (skill.kind === 'ally_shield' || skill.kind === 'ally_heal') {
    return lowestHpAlly(self, units);
  }
  return nearest(self, foesOf(self, units));
}

function freeFlankCell(fighter: Fighter, target: Fighter, units: Fighter[]): Vec | null {
  const blocked = occupiedKeys(units);
  blocked.delete(cellKey(fighter));
  return neighbors(target)
    .filter((cell) => !blocked.has(cellKey(cell)))
    .sort((a, b) => manhattan(b, fighter) - manhattan(a, fighter) || a.row - b.row || a.col - b.col)[0] ?? null;
}

function applyHeal(target: Fighter, amount: number): number {
  if (amount <= 0 || target.hp <= 0) return 0;
  const boosted = target.healReceivePct > 0 ? Math.floor((amount * (100 + target.healReceivePct)) / 100) : amount;
  const healed = Math.min(boosted, target.maxHp - target.hp);
  target.hp += healed;
  return healed;
}

function applyShield(target: Fighter, amount: number, until: number): number {
  if (amount <= 0 || target.hp <= 0) return 0;
  const next = Math.min(shieldCap(target.maxHp), target.shield + amount);
  const gained = next - target.shield;
  target.shield = next;
  target.shieldUntil = until;
  return gained;
}

function applyDamage(target: Fighter, amount: number): { through: number; hp: number } {
  if (amount <= 0 || target.hp <= 0) return { through: 0, hp: 0 };
  let reduced =
    target.drPct > 0
      ? Math.max(1, Math.floor((amount * (100 - target.drPct)) / 100))
      : amount;
  // 伤害格挡池（薛北鲲）：先扣池子再吃气血，池子每秒衰减。
  if (target.blockPool > 0 && reduced > 0) {
    const soak = Math.min(target.blockPool, reduced);
    target.blockPool -= soak;
    reduced -= soak;
    if (reduced <= 0) return { through: 0, hp: 0 };
  }
  let rest = reduced;
  if (target.shield > 0) {
    const soak = Math.min(target.shield, rest);
    target.shield -= soak;
    rest -= soak;
  }
  const hpHit = Math.min(target.hp, rest);
  target.hp -= hpHit;
  target.damageTaken += hpHit;
  return { through: hpHit, hp: hpHit };
}

function grantHitMana(target: Fighter, hpHit: number, timeMs: number): void {
  if (hpHit <= 0 || target.hp <= 0) return;
  if (timeMs - target.hitWindow >= 1000) {
    target.hitMana = 0;
    target.hitWindow = timeMs;
  }
  const room = MANA_TAKEN_CAP_PER_SEC - target.hitMana;
  if (room <= 0) return;
  const gained = Math.min(MANA_ON_TAKEN, room);
  target.hitMana += gained;
  target.mana = Math.min(target.manaCost, target.mana + gained);
}

function outcomeOf(units: Fighter[]): BattleOutcome | null {
  const left = living(units).some((unit) => unit.team === 'left');
  const right = living(units).some((unit) => unit.team === 'right');
  if (left && right) return null;
  if (left && !right) return 'left';
  if (!left && right) return 'right';
  return 'draw';
}

function keyEventsOf(events: CombatEvent[]): CombatEvent[] {
  const firstCast = events.find((event) => event.type === 'cast');
  const firstDeath = events.find((event) => event.type === 'death');
  const biggestHit = events
    .filter((event) => event.type === 'damage')
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const picked = [firstCast, biggestHit, firstDeath].filter(
    (event): event is CombatEvent => Boolean(event),
  );
  const unique = new Map<number, CombatEvent>();
  for (const event of picked) unique.set(event.seq, event);
  if (unique.size < 3) {
    for (const event of events) {
      if (unique.size >= 3) break;
      if (event.type === 'end' || event.type === 'spawn' || event.type === 'trait') continue;
      unique.set(event.seq, event);
    }
  }
  return [...unique.values()].sort((a, b) => a.seq - b.seq).slice(0, 3);
}

/**
 * ── 数据驱动技能解释器 ─────────────────────────────────────────
 *
 * 引擎只认 `SkillPrimitive` 原语，不认识任何具体技能 id：棋子的技能写在
 * `content/autochess/unit-skills.ts` 里，换一套棋子只换那张表。
 */
type SkillPacket = { source: Fighter; target: Fighter; amount: number; skillId?: string; via: 'aa' | 'skill'; trueDamage?: boolean };
type SkillEvent = { type: CombatEventType; sourceId?: string; targetIds?: string[]; value?: number; pos?: Vec; skillId?: string; text: string };
type SkillOutcome = {
  packets: SkillPacket[];
  events: SkillEvent[];
  buffReverts: { at: number; fighterId: string; stat: string; factor: number }[];
  summons: Fighter[];
  delayedFx: { at: number; effects: SkillPrimitive[] }[];
};

function scaleAmount(scale: SkillScale, star: number, self: Fighter): number {
  const index = Math.min(2, Math.max(0, star - 1));
  const flat = scale.flatByStar?.[index] ?? scale.flat ?? 0;
  const atkPct = scale.atkPctByStar?.[index] ?? scale.atkPct ?? 0;
  const armorPct = scale.armorPctByStar?.[index] ?? scale.armorPct ?? 0;
  const hpPct = scale.hpPct ?? 0;
  const raw = flat + (self.atk * atkPct) / 100 + (Math.max(self.armor, self.mr) * armorPct) / 100 + (self.maxHp * hpPct) / 100;
  return Math.max(1, Math.round(raw));
}

/** 全队（同阵营）存活单位的总气血百分比，用于「背水一战」类条件。 */
function teamHpPercent(self: Fighter, units: Fighter[]): number {
  let hp = 0;
  let max = 0;
  for (const unit of units) {
    if (unit.team !== self.team || unit.hp <= 0) continue;
    hp += unit.hp;
    max += unit.maxHp;
  }
  return max > 0 ? (hp / max) * 100 : 100;
}

function pickSkillFoes(self: Fighter, at: string, count: number, target: Fighter | null, units: Fighter[]): Fighter[] {
  const foes = foesOf(self, units);
  const byNearest = (a: Fighter, b: Fighter) => manhattan(self, a) - manhattan(self, b) || comparePos(a, b);
  switch (at) {
    case 'current':
    case 'target':
      return target && target.hp > 0 ? [target] : [];
    case 'nearestFoes':
      return [...foes].sort(byNearest).slice(0, Math.max(1, count));
    case 'farthestFoes':
      return [...foes].sort((a, b) => -byNearest(a, b)).slice(0, Math.max(1, count));
    case 'lowestDefense':
      return [...foes].sort((a, b) => Math.max(a.armor, a.mr) - Math.max(b.armor, b.mr) || comparePos(a, b)).slice(0, Math.max(1, count));
    case 'highestHpPct':
      return [...foes].sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp || comparePos(a, b)).slice(0, Math.max(1, count));
    case 'allFoes':
      return [...foes].sort(comparePos);
    case 'randomFoes':
      return [...foes].sort((a, b) => hashString(self.star * 977, `${self.id}:${a.id}`) - hashString(self.star * 977, `${self.id}:${b.id}`)).slice(0, Math.max(1, count));
    default:
      return [];
  }
}

function runSkillEffects(input: {
  self: Fighter;
  target: Fighter | null;
  effects: readonly SkillPrimitive[];
  units: Fighter[];
  timeMs: number;
  skillId: string;
  skillName: string;
  star: number;
  damageMult: number;
  seed: number;
  ruleset: 'autochess';
  depth?: number;
}): SkillOutcome {
  const { self, units, timeMs, skillId, skillName, star } = input;
  const out: SkillOutcome = { packets: [], events: [], buffReverts: [], summons: [], delayedFx: [] };
  const depth = input.depth ?? 0;
  if (depth > 4) return out;
  const index = Math.min(2, Math.max(0, star - 1));
  const pushPacket = (target: Fighter, raw: number, type: string | undefined) => {
    const resist = type === 'magic' ? target.mr : target.armor;
    const boosted = Math.max(1, Math.floor(raw * (1 + self.skillPct / 100) * input.damageMult));
    out.packets.push({
      source: self,
      target,
      amount: type === 'true' ? boosted : mitigatedBy(self, boosted, resist, target),
      skillId,
      via: 'skill',
      trueDamage: type === 'true',
    });
  };

  for (const effect of input.effects) {
    switch (effect.op) {
      case 'damage': {
        const centers = effect.at === 'self'
          ? [self]
          : pickSkillFoes(self, effect.at, effect.count ?? 1, input.target, units).filter((foe) => effect.at !== 'target' || foe === input.target);
        const center = centers[0];
        if (!center) break;
        // 半径可以随自身叠层成长（牧野弥毒池）
        const baseRadius = effect.radiusFromStack
          ? (effect.radius ?? 1) + (self.stacks.get(effect.radiusFromStack.key) ?? 0) * effect.radiusFromStack.add
          : effect.radius;
        const hit = new Map<string, Fighter>();
        for (const node of centers) {
          const around = baseRadius
            ? foesOf(self, units)
              .filter((foe) => manhattan(node, foe) <= baseRadius)
              .sort((a, b) => manhattan(node, a) - manhattan(node, b) || comparePos(a, b))
              .slice(0, effect.count ? Math.max(1, effect.count) : undefined)
            : [node];
          for (const foe of around) hit.set(foe.id, foe);
        }
        const victims = [...hit.values()].filter((foe) => foe.hp > 0);
        if (!victims.length) break;
        const total = scaleAmount(effect.scale, star, self);
        const hpSharePct = effect.scale.targetMaxHpPct ?? 0;
        const segments = Math.max(1, effect.segments ?? 1);
        const perSegment = Math.max(1, Math.floor(total / (effect.share ? victims.length * segments : segments)));
        for (const foe of victims) {
          let amount = perSegment + (hpSharePct ? Math.floor((foe.maxHp * hpSharePct) / 100 / segments) : 0);
          if (effect.perTileDecayPct) {
            const tiles = Math.max(0, manhattan(center, foe) - 1);
            amount = Math.max(1, Math.floor(perSegment * Math.max(0, 1 - (tiles * effect.perTileDecayPct) / 100)));
          }
          for (let segment = 0; segment < segments; segment += 1) pushPacket(foe, amount, effect.type);
        }
        out.events.push({
          type: 'trait',
          sourceId: self.id,
          targetIds: victims.map((foe) => foe.id),
          value: perSegment,
          skillId,
          text: `${self.name} 的「${skillName}」命中 ${victims.length} 名敌人（${effect.share ? '分摊' : '单体'} ${perSegment}${segments > 1 ? ` × ${segments}段` : ''}）`,
        });
        break;
      }
      case 'heal': {
        const raw = scaleAmount(effect.scale, star, self);
        const segments = Math.max(1, effect.segments ?? 1);
        const candidates = effect.at === 'self'
          ? [self]
          : effect.at === 'target'
            ? (input.target ? [input.target] : [])
            : (() => {
              const allies = alliesOf(self, units)
                .filter((ally) => effect.at !== 'alliesNearTarget' || (input.target ? manhattan(input.target, ally) <= (effect.radius ?? 1) : true))
                .filter((ally) => effect.at !== 'alliesNearSelf' || manhattan(self, ally) <= (effect.radius ?? 1))
                .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || comparePos(a, b));
              return effect.at === 'allAllies' ? allies : allies.slice(0, 1);
            })();
        for (const ally of candidates) {
          const per = Math.max(1, Math.floor(raw / segments));
          let healed = 0;
          for (let segment = 0; segment < segments; segment += 1) healed += applyHeal(ally, per);
          if (healed > 0) {
            self.healingDone += healed;
            out.events.push({ type: 'regen', sourceId: self.id, targetIds: [ally.id], value: healed, skillId, text: `${self.name} 的「${skillName}」为 ${ally.name} 回复 ${healed}` });
          }
        }
        break;
      }
      case 'shield': {
        const raw = scaleAmount(effect.scale, star, self);
        const candidates = effect.at === 'self'
          ? [self]
          : effect.at === 'allies'
            ? alliesOf(self, units)
            : effect.at === 'alliesNearSelf'
              ? alliesOf(self, units).filter((ally) => manhattan(self, ally) <= (effect.radius ?? 1)).slice(0, effect.count)
              : alliesOf(self, units).filter((ally) => !effect.radius || !input.target || manhattan(input.target, ally) <= effect.radius).slice(0, effect.count);
        for (const ally of candidates) {
          const gained = applyShield(ally, raw, timeMs + effect.ms);
          if (gained > 0) out.events.push({ type: 'shield', sourceId: self.id, targetIds: [ally.id], value: gained, skillId, text: `${self.name} 的「${skillName}」为 ${ally.name} 附加护盾 ${gained}` });
        }
        break;
      }
      case 'buff': {
        const index2 = Math.min(2, Math.max(0, star - 1));
        const value = effect.valueByStar?.[index2] ?? effect.value;
        const candidates = effect.at === 'self'
          ? [self]
          : effect.at === 'alliesNearTarget' && input.target
            ? alliesOf(self, units).filter((ally) => manhattan(input.target!, ally) <= (effect.radius ?? 1))
            : alliesOf(self, units).sort((a, b) => b.atk - a.atk || comparePos(a, b)).slice(0, Math.max(1, effect.count ?? 1));
        for (const ally of candidates) {
          if (effect.stat === 'aspdPct') {
            const factor = 1 + value / 100;
            changeFormStat(ally,'aspd',value=>value*factor);
            if (effect.ms) out.buffReverts.push({ at: timeMs + effect.ms, fighterId: ally.id, stat: 'aspd', factor });
          } else if (effect.stat === 'atkPct') {
            const factor = 1 + value / 100;
            changeFormStat(ally,'atk',value=>Math.round(value*factor));
            if (effect.ms) out.buffReverts.push({ at: timeMs + effect.ms, fighterId: ally.id, stat: 'atk', factor });
          } else if (effect.stat === 'hpPct') {
            const factor = 1 + value / 100;
            ally.maxHp = Math.round(ally.maxHp * factor);
            ally.hp = Math.round(ally.hp * factor);
            if (effect.ms) out.buffReverts.push({ at: timeMs + effect.ms, fighterId: ally.id, stat: 'hp', factor });
          } else if (effect.stat === 'armorPct' || effect.stat === 'mrPct') {
            const stat = effect.stat === 'armorPct' ? 'armor' : 'mr';
            const factor = 1 + value / 100;
            changeFormStat(ally,stat,value=>Math.round(value*factor));
            if (effect.ms) out.buffReverts.push({ at: timeMs + effect.ms, fighterId: ally.id, stat, factor });
          } else if (effect.stat.endsWith('Pct')) {
            // 这些百分比通道在 Fighter 上仍保留 Pct 后缀。
            const field = effect.stat as keyof Fighter;
            const current = ally[field];
            if (typeof current === 'number') {
              (ally as unknown as Record<string, number>)[field as string] = current + value;
              if (effect.ms) out.buffReverts.push({ at: timeMs + effect.ms, fighterId: ally.id, stat: effect.stat, factor: value });
            }
          } else {
            // 其它数值字段（射程 / 初始内力等）
            const field = effect.stat as keyof Fighter;
            const current = ally[field];
            if(isFormStat(effect.stat))changeFormStat(ally,effect.stat,current=>current+value);
            else if (typeof current === 'number') (ally as unknown as Record<string, number>)[field as string] = current + value;
          }
          out.events.push({ type: 'trait', sourceId: self.id, targetIds: [ally.id], value, skillId, text: `${self.name} 的「${skillName}」使 ${ally.name} 获得 ${value} ${effect.stat}${effect.ms ? `（${effect.ms / 1000}秒）` : ''}` });
        }
        break;
      }
      case 'block': {
        const index2 = Math.min(2, Math.max(0, star - 1));
        self.blockPool += effect.byStar?.[index2] ?? effect.amount ?? 0;
        break;
      }
      case 'status': {
        const ms = effect.msByStar?.[index] ?? effect.ms ?? 1000;
        const marks = effect.at === 'self'
          ? [self]
          : effect.at === 'target' || effect.at === 'current'
            ? (input.target ? [input.target] : [])
            : pickSkillFoes(self, effect.at, effect.count ?? 1, input.target, units).slice(0, Math.max(1, effect.count ?? 1));
        for (const mark of marks) {
          if (effect.status !== 'untargetable' && mark.controlImmune) {
            out.events.push({ type: 'trait', sourceId: mark.id, targetIds: [mark.id], skillId, text: `${mark.name} 免疫控制` });
            continue;
          }
          if (effect.status === 'stun') mark.stunUntil = Math.max(mark.stunUntil, timeMs + ms);
          else if (effect.status === 'silence') mark.silenceUntil = Math.max(mark.silenceUntil, timeMs + ms);
          else if (effect.status === 'disarm') mark.disarmUntil = Math.max(mark.disarmUntil, timeMs + ms);
          else { mark.targetable = false; mark.untargetableUntil = Math.max(mark.untargetableUntil, timeMs + ms); }
          out.events.push({ type: 'trait', sourceId: self.id, targetIds: [mark.id], value: ms, skillId, text: `${self.name} 的「${skillName}」使 ${mark.name} ${effect.status === 'stun' ? '眩晕' : effect.status === 'silence' ? '沉默' : effect.status === 'disarm' ? '缴械' : '无法选中'} ${(ms / 1000).toFixed(1)} 秒` });
        }
        break;
      }
      case 'rider': {
        self.riders.push({ until: timeMs + effect.ms, everyNth: effect.everyNth, counter: 0, effects: effect.effects });
        out.events.push({ type: 'trait', sourceId: self.id, skillId, text: `${self.name} 的「${skillName}」进入强化状态（${(effect.ms / 1000).toFixed(1)}秒）` });
        break;
      }
      case 'conditional': {
        const when = effect.when;
        const ok = (when.selfHpBelowPct === undefined || (self.hp / self.maxHp) * 100 < when.selfHpBelowPct)
          && (when.selfHpAbovePct === undefined || (self.hp / self.maxHp) * 100 > when.selfHpAbovePct)
          && (when.teamHpBelowPct === undefined || teamHpPercent(self, units) < when.teamHpBelowPct)
          && (when.teamHpAbovePct === undefined || teamHpPercent(self, units) > when.teamHpAbovePct)
          && (when.targetAtkBelowSelf === undefined || (input.target ? input.target.atk < self.atk : false))
          && (when.selfShielded === undefined || (self.shield > 0) === when.selfShielded)
          && (when.targetDistanceAbove === undefined || (input.target ? manhattan(self, input.target) > when.targetDistanceAbove : false))
          && (when.targetDistanceAtMost === undefined || (input.target ? manhattan(self, input.target) <= when.targetDistanceAtMost : false))
          && (when.targetHpBelowPct === undefined || (input.target ? (input.target.hp / input.target.maxHp) * 100 < when.targetHpBelowPct : false))
          && (when.castParity === undefined || (self.casts % 2 === 1) === (when.castParity === 'odd'))
          && (when.stackBelow === undefined || (self.stacks.get(when.stackBelow.key) ?? 0) < when.stackBelow.value)
          && (when.stackAtLeast === undefined || (self.stacks.get(when.stackAtLeast.key) ?? 0) >= when.stackAtLeast.value)
          && (when.costAtLeast === undefined || getUnit(self.templateId).cost >= when.costAtLeast)
          && (when.targetRoleIn === undefined || (input.target ? when.targetRoleIn.includes(getUnit(input.target.templateId).role) : false))
          && (when.playerHpLowest === undefined || (self.playerHpLowest ?? false) === when.playerHpLowest);
        if (ok) {
          const nested = runSkillEffects({ ...input, effects: effect.effects, depth: depth + 1 });
          out.packets.push(...nested.packets);
          out.events.push(...nested.events);
          out.buffReverts.push(...nested.buffReverts);
          out.summons.push(...nested.summons);
          out.delayedFx.push(...nested.delayedFx);
        }
        break;
      }
      case 'everyNthAttack': {
        if (self.attackCount > 0 && self.attackCount % effect.every === 0) {
          const nested = runSkillEffects({ ...input, effects: effect.effects, depth: depth + 1 });
          out.packets.push(...nested.packets);
          out.events.push(...nested.events);
          out.buffReverts.push(...nested.buffReverts);
          out.summons.push(...nested.summons);
          out.delayedFx.push(...nested.delayedFx);
        }
        break;
      }
      case 'move': {
        const anchor = effect.at === 'farthestFoe'
          ? [...foesOf(self, units)].sort((a, b) => manhattan(self, b) - manhattan(self, a) || comparePos(a, b))[0] ?? null
          : effect.at === 'lowestDefense'
            ? [...foesOf(self, units)].sort((a, b) => Math.max(a.armor, a.mr) - Math.max(b.armor, b.mr) || comparePos(a, b))[0] ?? null
            : input.target;
        const destination = anchor ? freeFlankCell(self, anchor, units) : null;        if (destination) {
          self.row = destination.row;
          self.col = destination.col;
          self.lastMovedAt = timeMs;
          out.events.push({ type: 'move', sourceId: self.id, pos: destination, skillId, text: `${self.name} 瞬移至 ${anchor?.name ?? '目标'} 身侧` });
        }
        break;
      }
      case 'pullFoe': {
        const farthest = [...foesOf(self, units)].sort((a, b) => manhattan(self, b) - manhattan(self, a) || comparePos(a, b))[0];
        if (!farthest) break;
        const occupied = occupiedKeys(units);
        occupied.delete(cellKey(farthest));
        const spot = neighbors(self).filter((cell) => !occupied.has(cellKey(cell))).sort((a, b) => manhattan(a, farthest) - manhattan(b, farthest))[0];
        if (spot) {
          farthest.row = spot.row;
          farthest.col = spot.col;
          farthest.lastMovedAt = timeMs;
          if (effect.stunMs && !farthest.controlImmune) farthest.stunUntil = Math.max(farthest.stunUntil, timeMs + effect.stunMs);
          out.events.push({ type: 'move', sourceId: farthest.id, targetIds: [farthest.id], pos: spot, skillId, text: `${self.name} 的「${skillName}」把 ${farthest.name} 拉至身前` });
        }
        break;
      }
      case 'summon': {
        const hole = firstEmpty(self.team, units);
        const summonUnit = getUnit(effect.unitId);
        const summon: Combatant = {
          id: `${self.id}-summon-${out.summons.length + 1}`,
          templateId: effect.unitId,
          star: self.star,
          localRow: hole?.row ?? self.row,
          localCol: hole?.col ?? self.col,
          itemIds: [],
        };
        const fighter = spawnFighter(summon, self.team, [], input.seed);
        if (effect.inheritAspd) fighter.aspd = self.aspd;
        if (effect.atkPctOfParent) fighter.atk = Math.max(1, Math.round((self.atk * effect.atkPctOfParent) / 100));
        if (effect.hpPctOfParent) {
          fighter.maxHp = Math.max(1, Math.round((self.maxHp * effect.hpPctOfParent) / 100));
          fighter.hp = fighter.maxHp;
        }
        fighter.parentId = self.id;
        fighter.turret = effect.turret ?? false;
        fighter.expireAt = timeMs + effect.ms;
        out.summons.push(fighter);
        out.events.push({ type: 'summon', sourceId: fighter.id, pos: { row: fighter.row, col: fighter.col }, skillId, text: `${self.name} 召唤「${summonUnit.name}」（${(effect.ms / 1000).toFixed(0)}秒）` });
        break;
      }
      case 'pierceProjectile': {
        const anchor = effect.at === 'farthestFoe'
          ? [...foesOf(self, units)].sort((a, b) => manhattan(self, b) - manhattan(self, a) || comparePos(a, b))[0]
          : input.target;
        if (!anchor) break;
        const rowSpan = anchor.row - self.row;
        const colSpan = anchor.col - self.col;
        const length = Math.hypot(rowSpan, colSpan) || 1;
        const onLine = foesOf(self, units)
          .map((foe) => {
            const dr = foe.row - self.row;
            const dc = foe.col - self.col;
            return { foe, along: (dr * rowSpan + dc * colSpan) / length, lateral: Math.abs(dr * colSpan - dc * rowSpan) / length };
          })
          .filter((entry) => entry.along > 0 && entry.lateral <= 1.2)
          .sort((a, b) => a.along - b.along)
          .slice(0, Math.max(1, effect.hits ?? 1));
        if (!onLine.length) break;
        let raw = scaleAmount(effect.scale, star, self);
        for (const entry of onLine) {
          pushPacket(entry.foe, raw, effect.type);
          raw = Math.max(1, Math.floor(raw * (1 - (effect.falloffPct ?? 50) / 100)));
        }
        out.events.push({ type: 'trait', sourceId: self.id, targetIds: onLine.map((entry) => entry.foe.id), skillId, text: `${self.name} 的「${skillName}」贯穿 ${onLine.length} 名敌人` });
        break;
      }
      case 'undying': {
        self.undyingUntil = Math.max(self.undyingUntil, timeMs + effect.ms);
        if (effect.onTrigger?.length) self.undyingBurst = [...effect.onTrigger];
        if (effect.drPct) {
          self.drPct += effect.drPct;
          if (effect.drMs) out.buffReverts.push({ at: timeMs + effect.drMs, fighterId: self.id, stat: 'dr', factor: effect.drPct });
        }
        out.events.push({ type: 'trait', sourceId: self.id, skillId, text: `${self.name} 获得 ${(effect.ms / 1000).toFixed(1)} 秒不死` });
        break;
      }
      case 'stack': {
        const marks = effect.radius && input.target
          ? foesOf(self, units).filter((foe) => manhattan(input.target!, foe) <= effect.radius!)
          : [input.target ?? self];
        for (const mark of marks) {
          const key = effect.perTarget ? `${effect.key}:${mark.id}` : effect.key;
          const next = (self.stacks.get(key) ?? 0) + effect.add;
          self.stacks.set(key, effect.max === undefined ? next : Math.min(effect.max, next));
        }
        break;
      }
      case 'clearStack': {
        // 先收集再删除：避免边遍历边改 Map
        const doomed = Array.from(self.stacks.keys()).filter((key) => key === effect.key || key.startsWith(`${effect.key}:`));
        for (const key of doomed) self.stacks.delete(key);
        break;
      }
      case 'gold': {
        // 战斗内经济：只记事件，由房间在结算时入账（skillId 前缀 'item-gold'）
        out.events.push({ type: 'trait', sourceId: self.id, value: effect.amount, skillId: 'item-gold', text: `${self.name} 通过装备获得 ${effect.amount} 金币` });
        break;
      }
      case 'consumeStacks': {
        const victims = effect.radius ? foesOf(self, units).filter((foe) => manhattan(self, foe) <= effect.radius!) : foesOf(self, units);
        const touched = victims.filter((foe) => (self.stacks.get(`${effect.key}:${foe.id}`) ?? 0) > 0);
        if (!touched.length) break;
        const per = scaleAmount(effect.per, star, self);
        for (const foe of touched) {
          const stacks = self.stacks.get(`${effect.key}:${foe.id}`) ?? 0;
          pushPacket(foe, per * stacks, 'phys');
          if (effect.clear !== false) self.stacks.delete(`${effect.key}:${foe.id}`);
        }
        out.events.push({ type: 'trait', sourceId: self.id, targetIds: touched.map((foe) => foe.id), skillId, text: `${self.name} 的「${skillName}」引爆 ${touched.length} 名敌人身上的层数` });
        break;
      }
      case 'transform': {
        if (effect.atkFromMaxHpPct) {const gain=Math.round((self.maxHp * effect.atkFromMaxHpPct) / 100);changeFormStat(self,'atk',value=>value+gain);}
        if (effect.aspdPct) {const factor=1+effect.aspdPct/100;changeFormStat(self,'aspd',value=>value*factor);}
        out.events.push({ type: 'trait', sourceId: self.id, skillId, text: `${self.name} 完成变身，永久强化` });
        break;
      }
      case 'delayed': {
        out.delayedFx.push({ at: timeMs + effect.ms, effects: effect.effects });
        break;
      }
      case 'controlImmune': {
        self.controlImmune = true;
        self.controlImmuneUntil = Math.max(self.controlImmuneUntil ?? 0, timeMs + effect.ms);
        out.events.push({ type: 'trait', sourceId: self.id, skillId, text: `${self.name} 获得 ${(effect.ms / 1000).toFixed(0)} 秒免控` });
        break;
      }
      case 'debuff': {
        const marks = effect.at === 'target' || effect.at === 'nearestFoes'
          ? pickSkillFoes(self, effect.at === 'target' ? 'target' : 'nearestFoes', effect.count ?? 1, input.target, units)
          : effect.at === 'randomFoes'
            ? pickSkillFoes(self, 'randomFoes', effect.count ?? 1, input.target, units)
            : effect.at === 'selfRadius'
              ? foesOf(self, units).filter((foe) => manhattan(self, foe) <= (effect.radius ?? 1)).slice(0, effect.count)
              : foesOf(self, units);
        for (const mark of marks) {
          if (effect.stat === 'moveSpeedPct') mark.moveSpeedPct = Math.max(0.2, (mark.moveSpeedPct || 1) * (1 - effect.value / 100));
          else if (effect.stat.endsWith('Pct')) {
            const field = effect.stat.slice(0, -3) as keyof Fighter;
            const current = mark[field];
            if(isFormStat(field))changeFormStat(mark,field,value=>Math.max(0,value-effect.value));
            else if (typeof current === 'number') (mark as unknown as Record<string, number>)[field as string] = Math.max(0, current - effect.value);
          }
          out.events.push({ type: 'trait', sourceId: self.id, targetIds: [mark.id], value: effect.value, skillId, text: `${self.name} 的「${skillName}」使 ${mark.name} ${effect.stat} -${effect.value}` });
        }
        break;
      }
      case 'knockback': {
        const pushed = foesOf(self, units).filter((foe) => manhattan(self, foe) <= effect.radius);
        for (const foe of pushed) {
          if (foe.controlImmune) continue;
          const dr = Math.sign(foe.row - self.row);
          const dc = Math.sign(foe.col - self.col);
          const cell = { row: foe.row + dr, col: foe.col + dc };
          const blocked = occupiedKeys(units);
          blocked.delete(cellKey(foe));
          if (inBounds(cell) && !blocked.has(cellKey(cell))) {
            foe.row = cell.row;
            foe.col = cell.col;
            foe.lastMovedAt = timeMs;
          }
          if (effect.stunMs) foe.stunUntil = Math.max(foe.stunUntil, timeMs + effect.stunMs);
          out.events.push({ type: 'move', sourceId: foe.id, pos: { row: foe.row, col: foe.col }, skillId, text: `${self.name} 的「${skillName}」击退 ${foe.name}` });
        }
        break;
      }
      case 'overrideAttack': {
        self.attackOverride = { until: timeMs + effect.ms, scale: effect.scale, segments: effect.segments };
        out.events.push({ type: 'trait', sourceId: self.id, skillId, text: `${self.name} 的「${skillName}」改写普攻（${(effect.ms / 1000).toFixed(0)}秒）` });
        break;
      }
      case 'repeat': {
        for (let index = 1; index <= effect.times; index += 1) {
          out.delayedFx.push({ at: timeMs + index * effect.everyMs, effects: effect.effects });
        }
        break;
      }
      case 'randomPick': {
        if (!effect.options.length) break;
        const pick = effect.options[hashString(star * 131, `${self.id}:${Math.floor(timeMs / 100)}`) % effect.options.length]!;
        const nested = runSkillEffects({ ...input, effects: pick, depth: depth + 1 });
        out.packets.push(...nested.packets);
        out.events.push(...nested.events);
        out.buffReverts.push(...nested.buffReverts);
        out.summons.push(...nested.summons);
        out.delayedFx.push(...nested.delayedFx);
        break;
      }
      case 'stealAtk': {
        // 没有显式目标（如每秒触发）时取最近的敌人
        const victim = input.target ?? nearest(self, foesOf(self, units));
        if (!victim || (self.stacks.get(effect.key) ?? 0) >= effect.maxStacks) break;
        const taken = Math.round((victim.atk * effect.pct) / 100);
        changeFormStat(victim,'atk',value=>Math.max(1,value-taken));
        changeFormStat(self,'atk',value=>value+taken);
        self.stacks.set(effect.key, (self.stacks.get(effect.key) ?? 0) + 1);
        out.events.push({ type: 'trait', sourceId: self.id, targetIds: [victim.id], value: taken, skillId, text: `${self.name} 偷取 ${victim.name} ${taken} 攻击（${self.stacks.get(effect.key)}/${effect.maxStacks} 层）` });
        break;
      }
      case 'reskin': {
        // 掺水/变身：把目标的名称、面板与羁绊换成另一枚棋子（不动气血、不换技能）。
        // TODO(特效): 目前无视觉表现，被掺/换形的棋子在棋盘上应换皮/高亮，否则玩家看不出来。
        // TODO(套娃): 未来可加 `swapSkill` 开关，让被换形的棋子改用目标技能（会传染，谨慎开）。
        const victims = (effect.at === 'self' ? [self] : pickSkillFoes(self, effect.at, effect.count ?? 1, input.target, units)).filter((foe) => foe.hp > 0);
        const into = getUnit(effect.into);
        const template = into.statTemplate;
        const suffix = effect.suffix ?? '';
        for (const victim of victims) {
          const before = victim.name;
          const duration=effect.msByStar?.[index]??effect.ms;
          applyCombatForm(victim,effect.into,{
            name:`${into.name}${suffix}`,traits:[...into.factions,...into.jobs],
            atk:template?.atk??victim.atk,aspd:template?.aspd??victim.aspd,
            armor:template?.armor??victim.armor,mr:template?.mr??victim.mr,range:template?.range??victim.range,
          },duration===undefined?undefined:timeMs+duration);
          out.events.push({ type: 'trait', sourceId: self.id, targetIds: [victim.id], skillId, text: `${before} 变成了 ${into.name}${suffix}${duration===undefined?'':`（${duration/1000}秒）`}` });
        }
        break;
      }
      case 'gainMana': {
        self.mana = Math.max(0, self.mana + effect.amount);        break;
      }
      case 'scaleFromMana': {
        const hpBonus = Math.min(effect.hpPctCap, self.mana * effect.perManaPct);
        const atkBonus = Math.min(effect.atkPctCap, self.mana * effect.perManaPct);
        self.maxHp = Math.round(self.baseMaxHp * (1 + hpBonus / 100));
        changeFormStat(self,'atk',()=>Math.round(self.baseAtk*(1+atkBonus/100)));
        if (self.hp > self.maxHp) self.hp = self.maxHp;
        break;
      }
      case 'float': {
        self.floating = {
          startAt: timeMs,
          until: timeMs + effect.ms,
          radiusFrom: effect.radiusFrom,
          radiusTo: effect.radiusTo,
          pctFrom: effect.pctFrom,
          pctTo: effect.pctTo,
          hpThreshold: Math.round((self.maxHp * effect.hpThresholdPct) / 100),
          share: effect.share !== false,
        };
        self.targetable = false;
        self.untargetableUntil = Math.max(self.untargetableUntil, timeMs + effect.ms);
        out.events.push({ type: 'trait', sourceId: self.id, skillId, text: `${self.name} 变成泡泡漂浮（至多 ${(effect.ms / 1000).toFixed(0)} 秒，受控或承伤 ${effect.hpThresholdPct}% 提前引爆）` });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** 技能数据里的常驻面板修正由 stats.ts 读取（那里才构造面板）。 */

/** 装备触发（proc）的取用口：按时机取回该棋子身上所有装备的触发数据。 */
function itemTriggers(fighter: Fighter, timing: TriggerTiming) {
  const out: { key: string; trigger: ItemTrigger }[] = [];
  fighter.itemIds.forEach((itemId, index) => {
    const item = findItem(itemId);
    item?.triggers?.forEach((trigger, ti) => {
      if (trigger.on === timing) out.push({ key: `${itemId}#${index}#${ti}`, trigger });
    });
  });
  return out;
}

function findItem(id: string) {
  return allItems.find((entry) => entry.id === id) ?? null;
}

/**
 * 执行某个时机的装备触发。效果与棋子技能共用同一套原语与解释器，
 * 所以新增 proc 装备只需往 items 数据里写 triggers，不必改引擎。
 */
function runItemTriggers(input: {
  fighter: Fighter;
  timing: TriggerTiming;
  target?: Fighter | null;
  units: Fighter[];
  timeMs: number;
  seed: number;
  ruleset: 'autochess';
  packets: SkillPacket[];
  pushEvent: (event: SkillEvent) => void;
}): Fighter[] {
  const summons: Fighter[] = [];
  for (const { key, trigger } of itemTriggers(input.fighter, input.timing)) {
    if (trigger.everyMs) {
      const last = input.fighter.triggerAt.get(key) ?? -Infinity;
      if (input.timeMs - last < trigger.everyMs) continue;
      input.fighter.triggerAt.set(key, input.timeMs);
    }
    if (trigger.chancePct !== undefined && trigger.chancePct < 100) {
      const roll = hashString((input.timeMs * 131) ^ (input.target ? hashString(7, input.target.id) : 0), `${input.fighter.id}:${key}`) % 100;
      if (roll >= trigger.chancePct) continue;
    }
    if (trigger.stack) {
      const current = input.fighter.stacks.get(trigger.stack.key) ?? 0;
      if (trigger.stopAtMax && trigger.stack.max !== undefined && current >= trigger.stack.max) continue;
      const next = current + trigger.stack.add;
      input.fighter.stacks.set(trigger.stack.key, trigger.stack.max === undefined ? next : Math.min(trigger.stack.max, next));
    }
    const outcome = runSkillEffects({
      self: input.fighter,
      target: input.target ?? null,
      effects: trigger.effects,
      units: input.units,
      timeMs: input.timeMs,
      skillId: `item:${key}`,
      skillName: `装备·${findItem(key.split('#')[0]!)?.name ?? '未知装备'}`,
      star: input.fighter.star,
      damageMult: 1,
      seed: input.seed,
      ruleset: input.ruleset,
    });
    input.packets.push(...outcome.packets);
    for (const event of outcome.events) input.pushEvent(event);
    summons.push(...outcome.summons);
  }
  return summons;
}

export function simulateBattle(input: BattleInput): BattleOutput {
  const ruleset = 'autochess' as const;
  const left = input.left.slice(0, SLICE_POP_CAP);
  const right = input.right.slice(0, SLICE_POP_CAP);
  const units = [
    ...left.map((unit) => spawnFighter(unit, 'left', left, input.seed)),
    ...right.map((unit) => spawnFighter(unit, 'right', right, input.seed)),
  ];
  // 心悟覆写可能改变主动技能内力消耗；此时双方棋子都已生成，才能正确判断“最强大的”实例。
  for (const unit of units) {
    const spec = liveUnitSkill(unit, units);
    if (spec) unit.manaCost = Math.max(1, spec.mana);
    unit.playerHpLowest = input.playerHpLowest?.[unit.team] ?? false;
  }
  const leftNames = new Set(units.filter(unit => unit.team === 'left').map(unit => unit.name));
  const sharedNames = new Set(units.filter(unit => unit.team === 'right' && leftNames.has(unit.name)).map(unit => unit.name));
  const events: CombatEvent[] = [];
  let seq = 0;
  const push = (event: Omit<CombatEvent, 'seq'>): void => {
    let text = event.text;
    if (event.sourceId && sharedNames.size) {
      const source = units.find(unit => unit.id === event.sourceId);
      const targets = (event.targetIds ?? []).map(id => units.find(unit => unit.id === id)).filter((unit): unit is Fighter => !!unit);
      for (const name of sharedNames) {
        if (!text.includes(name)) continue;
        const participants = [
          ...(source?.name === name && text.startsWith(name) ? [source] : []),
          ...targets.filter(unit => unit.name === name),
          ...(source?.name === name && !text.startsWith(name) ? [source] : []),
        ];
        if (!participants.length) continue;
        let occurrence = 0;
        text = text.replaceAll(name, () => {
          const unit = participants[Math.min(occurrence++, participants.length - 1)]!;
          return `[${unit.team === 'left' ? '左' : '右'}]${name}`;
        });
      }
    }
    events.push({ seq: (seq += 1), ...event, text });
  };
  const scheduled: ScheduledEffect[] = [];
  const originalPos = new Map(units.map((unit) => [unit.id, { row: unit.row, col: unit.col }]));
  const occupiedAtStart = occupiedKeys(units);

  // ── 阵营争锋（数据驱动）：同队内比两个阵营的人数，多的一方触发 ──
  for (const trait of allTraitDefs) {
    const standoff = trait.mechanics?.find((entry): entry is Extract<TraitMechanic, { id: 'campStandoff' }> => entry.id === 'campStandoff');
    if (!standoff) continue;
    for (const side of ['left', 'right'] as const) {
      const roster = side === 'left' ? left : right;
      const counts = uniqueTraitCounts(roster);
      const countA = counts.get(standoff.campA) ?? 0;
      const countB = counts.get(standoff.campB) ?? 0;
      if (countA === 0 || countB === 0 || countA + countB < standoff.at) continue;
      const majority = countA === countB ? null : countA > countB ? standoff.campA : standoff.campB;
      if (!majority) continue;
      for (const unit of units.filter((entry) => entry.team === side && entry.traits.includes(majority))) {
        if (majority === standoff.campA) {
          const gained = applyShield(unit, Math.round((unit.maxHp * standoff.shieldPct) / 100), MAX_BATTLE_MS);
          if (gained > 0) push({ timeMs: 0, type: 'shield', sourceId: unit.id, targetIds: [unit.id], value: gained, skillId: 'camp-standoff', text: `争锋·${trait.name}：${unit.name} 获得 ${gained} 护盾` });
        } else {
          const gain = Math.round((unit.atk * standoff.atkPct) / 100);
          if (gain > 0) {
            unit.atk += gain;
            push({ timeMs: 0, type: 'trait', sourceId: unit.id, value: gain, skillId: 'camp-standoff', text: `争锋·${trait.name}：${unit.name} 攻击 +${gain}` });
          }
        }
      }
    }
  }

  // ── Data-driven battle-start hooks ──
  const preludePackets: SkillPacket[] = [];
  /** 每秒类装备触发产生的伤害包（在 packets 建立后并入）。 */
  const secondPackets: SkillPacket[] = [];
  for (const unit of units) {
    // 装备的开战触发（爪/盾/光环类）
    runItemTriggers({
      fighter: unit, timing: 'battleStart', units, timeMs: 0, seed: input.seed, ruleset,
      packets: preludePackets, pushEvent: (event) => push({ timeMs: 0, ...event }),
    });
  }
  for (const unit of units) {    const opening = unitSkill(unit.templateId);
    if (!opening?.onBattleStart) continue;
    const outcome = runSkillEffects({
      self: unit, target: null, effects: opening.onBattleStart, units, timeMs: 0,
      skillId: unit.skillId, skillName: opening.name, star: unit.star, damageMult: 1,
      seed: input.seed, ruleset,
    });
    for (const event of outcome.events) push({ timeMs: 0, ...event });
    for (const summon of outcome.summons) units.push(summon);
    for (const revert of outcome.buffReverts) {
      scheduled.push({
        at: revert.at, kind: 'stat-revert', sourceId: revert.fighterId, targetId: revert.fighterId,
        skillId: 'stat-revert', revert: { stat: revert.stat, factor: revert.factor },
      });
    }
  }

  for (const unit of units) {
    if (unit.moveMode !== 'advance' && unit.moveMode !== 'backline') continue;
    occupiedAtStart.delete(cellKey(unit));
    const candidates = unit.moveMode === 'advance'
      ? [{ row: unit.row + (unit.team === 'left' ? -1 : 1), col: unit.col }]
      : Array.from(
          { length: HALF_ROWS },
          (_, index) => unit.team === 'left' ? index : HALF_ROWS * 2 - 1 - index,
        ).flatMap((row) =>
          [unit.col, ...Array.from({ length: BOARD_COLS }, (_, col) => col)]
            .filter((col, index, cols) => cols.indexOf(col) === index)
            .map((col) => ({ row, col })),
        );
    const destination = candidates.find((pos) => inBounds(pos) && !occupiedAtStart.has(cellKey(pos)));
    if (destination) {
      unit.row = destination.row;
      unit.col = destination.col;
    }
    occupiedAtStart.add(cellKey(unit));
  }

  const maybeEmergencyHeal = (unit: Fighter, timeMs: number): void => {
    if (unit.hp <= 0 || unit.emergencyUsed || unit.emergencyHealPct <= 0) return;
    if (unit.hp / unit.maxHp >= 0.4) return;
    unit.emergencyUsed = true;
    const healed = applyHeal(unit, Math.floor(unit.maxHp * unit.emergencyHealPct / 100));
    unit.healingDone += healed;
    if (healed > 0) push({ timeMs, type: 'heal', sourceId: unit.id, targetIds: [unit.id], value: healed, text: `${unit.name} 触发应急治疗，回复 ${healed}` });
  };

  const markMoved = (unit: Fighter, timeMs: number): void => {
    unit.lastMovedAt = timeMs;
  };

  for (const unit of units) {
    push({
      timeMs: 0,
      type: 'spawn',
      sourceId: unit.id,
      pos: { row: unit.row, col: unit.col },
      text: `${teamLabel(unit.team)} ${unit.name} 就位`,
    });
    const origin = originalPos.get(unit.id);
    if (origin && (origin.row !== unit.row || origin.col !== unit.col)) {
      push({ timeMs: 0, type: 'move', sourceId: unit.id, pos: { row: unit.row, col: unit.col }, text: `${unit.name} 由技能装配切入战场` });
    }
    if (!unit.targetable) push({ timeMs: 0, type: 'trait', sourceId: unit.id, text: `${unit.name} 获得短暂无敌与不可选中` });
    if (unit.shield > 0) push({ timeMs: 0, type: 'shield', sourceId: unit.id, targetIds: [unit.id], value: unit.shield, skillId: 'one-through', text: `${unit.name} 开战获得护盾 ${unit.shield}` });
  }

  let outcome: BattleOutcome = 'draw';
  let timeMs = 0;
  let ticks = 0;

  const battleLimit = AUTOCHESS_MAX_BATTLE_MS;
  for (timeMs = TICK_MS; timeMs <= battleLimit; timeMs += TICK_MS) {
    ticks += 1;
    if (timeMs === SUDDEN_DEATH_MS) {
      push({ timeMs, type: 'sudden_death', text: '十八秒已过，治疗减半，伤害将逐秒加重。' });
    }
    if (timeMs === MAX_BATTLE_MS) {
      push({ timeMs, type: 'sudden_death', text: '加时决胜：治疗逐渐失效，所有棋子每秒承受递增的气血流失。' });
    }

    for(const unit of units)if(expireCombatForm(unit,timeMs)&&unit.hp>0)push({timeMs,type:'trait',sourceId:unit.id,targetIds:[unit.id],skillId:'form-restored',text:`${unit.name} 恢复原形与面板`});
    for (const unit of living(units)) {
      if (unit.shield > 0 && timeMs >= unit.shieldUntil) unit.shield = 0;
      // 召唤物到期退场
      if (unit.controlImmuneUntil && timeMs >= unit.controlImmuneUntil) {
        unit.controlImmune = unit.baseControlImmune;
        unit.controlImmuneUntil = undefined;
      }
      if (unit.expireAt !== undefined && unit.expireAt > 0 && timeMs >= unit.expireAt && unit.hp > 0) {
        unit.hp = 0;
        push({ timeMs, type: 'death', sourceId: unit.id, text: `${unit.name} 到期消散` });
      }
      // 格挡池每秒衰减 40%（薛北鲲）
      if (unit.blockPool > 0) {
        if (!unit.blockTickAt) unit.blockTickAt = timeMs;
        while (timeMs - unit.blockTickAt >= 1000) {
          unit.blockTickAt += 1000;
          unit.blockPool = Math.max(0, unit.blockPool * 0.6);
        }
      }
      // 基础内力回复（回元 / 各类「内力回复 +X%」装备）
      if (unit.manaRegenPct > 0 && unit.hp > 0) {
        if (!unit.manaRegenAt) unit.manaRegenAt = timeMs;
        while (timeMs - unit.manaRegenAt >= 1000) {
          unit.manaRegenAt += 1000;
          unit.mana = Math.min(unit.manaCost, unit.mana + (MANA_REGEN_BASE_PER_SEC * unit.manaRegenPct) / 100);
        }
      }
      // 装备触发：每秒类（存活叠层 / 每秒回血 / 荆棘成长…）
      runItemTriggers({ fighter: unit, timing: 'second', units, timeMs, seed: input.seed, ruleset, packets: secondPackets, pushEvent: (event) => push({ timeMs, ...event }) });
      // 周期被动（墨先生：每秒回内力与气血，并按内力换算面板）
      const tickSpec = unitSkill(unit.templateId)?.tick;      if (tickSpec && timeMs - unit.lastTickAt >= tickSpec.everyMs) {
        unit.lastTickAt = timeMs;
        const outcome = runSkillEffects({
          self: unit, target: null, effects: tickSpec.effects, units, timeMs,
          skillId: unit.skillId, skillName: unitSkill(unit.templateId)?.name ?? unit.skillId,
          star: unit.star, damageMult: damageMult(timeMs), seed: input.seed, ruleset,
        });
        for (const event of outcome.events) push({ timeMs, ...event });
      }
      // 漂浮引爆（波波桃）：受控 / 累计承伤达标 / 时间到
      if (unit.floating) {
        const float = unit.floating;
        const controlled = unit.stunUntil > timeMs;
        const hurt = float.hpThreshold > 0 && unit.damageTaken >= float.hpThreshold;
        const expired = timeMs >= float.until;
        if (controlled || hurt || expired) {
          unit.floating = undefined;
          unit.targetable = true;
          const span = Math.max(1, float.until - float.startAt);
          const elapsed = Math.min(1, Math.max(0, (timeMs - float.startAt) / span));
          const radius = Math.max(1, Math.round(float.radiusFrom + (float.radiusTo - float.radiusFrom) * elapsed));
          const pct = Math.round(float.pctFrom + (float.pctTo - float.pctFrom) * elapsed);
          push({ timeMs, type: 'trait', sourceId: unit.id, skillId: unit.skillId, text: `${unit.name} 泡泡引爆（漂浮 ${((timeMs - float.startAt) / 1000).toFixed(1)} 秒 · 半径 ${radius} 格 · ${pct}% 攻击）` });
          scheduled.push({
            at: timeMs, kind: 'skill-fx', sourceId: unit.id, skillId: unit.skillId,
            skillFx: [{ op: 'damage', at: 'self', radius, share: float.share, type: 'magic', scale: { atkPct: pct } }],
          });
        } else if (unit.targetable) {
          unit.targetable = false;
        }
      }
      if (!unit.targetable && timeMs >= unit.untargetableUntil) unit.targetable = true;
      if (unit.regenPctPerSec > 0 && timeMs % 1000 === 0) {
        const healed = applyHeal(unit, Math.max(0, Math.floor(unit.maxHp * unit.regenPctPerSec / 100 * healMult(timeMs))));
        unit.healingDone += healed;
        if (healed > 0) push({ timeMs, type: 'regen', sourceId: unit.id, targetIds: [unit.id], value: healed, text: `${unit.name} 持续回复 ${healed}` });
      }
    }

    const pendingFx: { sourceId: string; targetId?: string; skillId: string; effects: SkillPrimitive[] }[] = [];
    const due = scheduled.filter((effect) => effect.at <= timeMs);
    for (const effect of due) {
      const source = units.find((unit) => unit.id === effect.sourceId);
      if (!source) continue;
      if (effect.kind === 'skill-fx') {
        pendingFx.push({ sourceId: effect.sourceId, targetId: effect.targetId, skillId: effect.skillId, effects: effect.skillFx ?? [] });
        continue;
      }
      if (effect.kind === 'stat-revert') {
        const subject = units.find((unit) => unit.id === (effect.targetId ?? effect.sourceId));
        const revert = effect.revert;
        if (subject && revert) {
          if (revert.stat === 'aspd') changeFormStat(subject,'aspd',value=>value/revert.factor);
          else if (revert.stat === 'atk') changeFormStat(subject,'atk',value=>Math.round(value/revert.factor));
          else if (revert.stat === 'hp') {
            subject.maxHp = Math.max(1, Math.round(subject.maxHp / revert.factor));
            subject.hp = Math.min(subject.maxHp, Math.round(subject.hp / revert.factor));
          } else if (revert.stat === 'armor' || revert.stat === 'mr') changeFormStat(subject,revert.stat,value=>Math.round(value/revert.factor));
          else if (revert.stat === 'dr') subject.drPct = Math.max(0, subject.drPct - revert.factor);
          else {
            const current = subject[revert.stat as keyof Fighter];
            if(isFormStat(revert.stat))changeFormStat(subject,revert.stat,value=>value-revert.factor);
            else if (typeof current === 'number') (subject as unknown as Record<string, number>)[revert.stat] = current - revert.factor;
          }
        }
        continue;
      }
    }
    for (const effect of due) scheduled.splice(scheduled.indexOf(effect), 1);

    const intents: Intent[] = [];
    for (const unit of [...living(units)].sort(comparePos)) {
      if (timeMs < unit.stunUntil || !unit.targetable) continue;
      // Turret summons aim from their living owner's position.
      const anchor = unit.turret && unit.parentId ? units.find((entry) => entry.id === unit.parentId && entry.hp > 0) ?? unit : unit;
      const target = nearest(anchor, foesOf(unit, units));
      if (!target) continue;
      if (unit.mana >= unit.manaCost && timeMs >= unit.silenceUntil) {
        const chosen = skillTarget(unit, units);
        if (chosen) {
          intents.push({ kind: 'cast', fighter: unit, target: chosen });
          continue;
        }
      }
      if (unit.range >= 3 && timeMs >= unit.kiteReadyAt && timeMs >= unit.moveReadyAt) {
        const visibleFoes = foesOf(unit, units);
        const currentDanger = Math.min(...visibleFoes.map((foe) => manhattan(unit, foe)));
        if (currentDanger <= 1) {
          const blocked = occupiedKeys(units);
          blocked.delete(cellKey(unit));
          const destination = neighbors(unit)
            .filter((cell) => !blocked.has(cellKey(cell)))
            .map((cell) => ({ cell, safety: Math.min(...visibleFoes.map((foe) => manhattan(cell, foe))) }))
            .filter(({ safety }) => safety > currentDanger)
            .sort((a, b) => b.safety - a.safety || a.cell.row - b.cell.row || a.cell.col - b.cell.col)[0]?.cell;
          if (destination) {
            intents.push({ kind: 'move', fighter: unit, dest: destination, reason: 'kite' });
            continue;
          }
        }
      }
      if (timeMs >= unit.attackReadyAt && timeMs >= unit.disarmUntil && manhattan(unit, target) <= unit.range) {
        intents.push({ kind: 'attack', fighter: unit, target });
        continue;
      }
      if (timeMs >= unit.moveReadyAt && manhattan(unit, target) > unit.range) {
        const blocked = occupiedKeys(units);
        blocked.delete(cellKey(unit));
        const dest = nextStepToward(unit, target, unit.range, blocked);
        if (dest) {
          intents.push({ kind: 'move', fighter: unit, dest });
        } else if (unit.range === 1) {
          const blocker = alliesOf(unit, units)
            .filter((ally) => ally.id !== unit.id)
            .filter((ally) => ally.range > unit.range)
            .filter((ally) => neighbors(unit).some((cell) => cell.row === ally.row && cell.col === ally.col))
            .filter((ally) => manhattan(ally, target) < manhattan(unit, target))
            .sort((a, b) => b.range - a.range || comparePos(a, b))[0];
          if (blocker) intents.push({ kind: 'swap', fighter: unit, blocker });
        }
      }
    }

    const claimed = new Map<number, Intent[]>();
    for (const intent of intents) {
      if (intent.kind !== 'move') continue;
      const key = cellKey(intent.dest);
      const list = claimed.get(key) ?? [];
      list.push(intent);
      claimed.set(key, list);
    }
    const blockedAfter = occupiedKeys(units);
    for (const [key, list] of claimed) {
      const winner = [...list].sort((a, b) => {
        const ha = hashString(input.seed ^ timeMs, a.fighter.id);
        const hb = hashString(input.seed ^ timeMs, b.fighter.id);
        if (ha !== hb) return ha - hb;
        return a.fighter.id < b.fighter.id ? -1 : 1;
      })[0]!;
      if (blockedAfter.has(key)) continue;
      const mover = winner.fighter;
      if (winner.kind !== 'move') continue;
      mover.row = winner.dest.row;
      mover.col = winner.dest.col;
      mover.moveReadyAt = timeMs + MOVE_MS;
      if (winner.reason === 'kite') mover.kiteReadyAt = timeMs + 2000;
      markMoved(mover, timeMs);
      blockedAfter.add(key);
      push({
        timeMs,
        type: 'move',
        sourceId: mover.id,
        pos: { ...winner.dest },
        text: winner.reason === 'kite'
          ? `${mover.name} 被近战贴身，后撤至 ${winner.dest.row + 1}-${winner.dest.col + 1}`
          : `${mover.name} 移至 ${winner.dest.row + 1}-${winner.dest.col + 1}`,
      });
    }

    const swapped = new Set<string>();
    for (const intent of intents) {
      if (intent.kind !== 'swap') continue;
      const { fighter, blocker } = intent;
      if (swapped.has(fighter.id) || swapped.has(blocker.id)) continue;
      if (fighter.hp <= 0 || blocker.hp <= 0 || fighter.team !== blocker.team) continue;
      if (manhattan(fighter, blocker) !== 1) continue;
      const from = { row: fighter.row, col: fighter.col };
      fighter.row = blocker.row;
      fighter.col = blocker.col;
      blocker.row = from.row;
      blocker.col = from.col;
      fighter.moveReadyAt = timeMs + MOVE_MS;
      blocker.moveReadyAt = timeMs + MOVE_MS;
      markMoved(fighter, timeMs);
      markMoved(blocker, timeMs);
      swapped.add(fighter.id);
      swapped.add(blocker.id);
      push({ timeMs, type: 'move', sourceId: fighter.id, pos: { row: fighter.row, col: fighter.col }, text: `${fighter.name} 与 ${blocker.name} 换位前进` });
      push({ timeMs, type: 'move', sourceId: blocker.id, pos: { row: blocker.row, col: blocker.col }, text: `${blocker.name} 为 ${fighter.name} 让位` });
    }

    const packets: { source: Fighter; target: Fighter; amount: number; skillId?: string; via: 'aa' | 'skill'; trueDamage?: boolean }[] = [];
    packets.push(...preludePackets.splice(0), ...secondPackets.splice(0));

    // Delayed skill resolution begins after the packet channel is available.
    for (const fx of pendingFx) {
      const source = units.find((unit) => unit.id === fx.sourceId && unit.hp > 0);
      if (!source) continue;
      const target = fx.targetId ? units.find((unit) => unit.id === fx.targetId && unit.hp > 0) ?? null : null;
      const spec = liveUnitSkill(source, units);
      const outcome = runSkillEffects({
        self: source, target, effects: fx.effects, units, timeMs, skillId: fx.skillId,
        skillName: spec?.name ?? fx.skillId, star: source.star, damageMult: damageMult(timeMs),
        seed: input.seed, ruleset,
      });
      packets.push(...outcome.packets);
      for (const event of outcome.events) push({ timeMs, ...event });
      for (const summon of outcome.summons) units.push(summon);
      for (const revert of outcome.buffReverts) {
        scheduled.push({
          at: revert.at, kind: 'stat-revert', sourceId: revert.fighterId, targetId: revert.fighterId,
          skillId: 'stat-revert', revert: { stat: revert.stat, factor: revert.factor },
        });
      }
      for (const nested of outcome.delayedFx) {
        scheduled.push({ at: nested.at, kind: 'skill-fx', sourceId: source.id, targetId: target?.id, skillId: fx.skillId, skillFx: nested.effects });
      }
    }
    pendingFx.length = 0;

    for (const intent of intents) {
      if (intent.kind !== 'cast') continue;
      const { fighter, target } = intent;
      const skill = getSkill(fighter.skillId);
      const displaySkillName = liveUnitSkill(fighter, units)?.name ?? skill.name;
      fighter.mana = 0;
      fighter.casts += 1;
      fighter.attackReadyAt = timeMs + Math.max(TICK_MS, Math.round(1000 / fighter.aspd));
      push({
        timeMs,
        type: 'cast',
        sourceId: fighter.id,
        targetIds: [target.id],
        skillId: skill.id,
        text: `${fighter.name} 施放「${displaySkillName}」`,
      });
      // 装备触发：施法时
      runItemTriggers({ fighter, timing: 'cast', target, units, timeMs, seed: input.seed, ruleset, packets, pushEvent: (event) => push({ timeMs, ...event }) });
      // 数据驱动技能优先；没有技能表的棋子使用角色通用技能。
      const spec = liveUnitSkill(fighter, units);
      if (spec?.cast) {
        const outcome = runSkillEffects({
          self: fighter, target, effects: spec.cast, units, timeMs,
          skillId: skill.id, skillName: spec.name, star: fighter.star, damageMult: damageMult(timeMs),
          seed: input.seed, ruleset,
        });
        packets.push(...outcome.packets);
        for (const event of outcome.events) push({ timeMs, ...event });
        for (const revert of outcome.buffReverts) {
          scheduled.push({
            at: revert.at, kind: 'stat-revert', sourceId: revert.fighterId, targetId: revert.fighterId,
            skillId: 'stat-revert', revert: { stat: revert.stat, factor: revert.factor },
          });
        }
        for (const summon of outcome.summons) units.push(summon);
        for (const fx of outcome.delayedFx) {
          scheduled.push({ at: fx.at, kind: 'skill-fx', sourceId: fighter.id, targetId: target.id, skillId: skill.id, skillFx: fx.effects });
        }
        continue;
      }
      if (skill.kind === 'self_shield' || skill.kind === 'ally_shield') {
        const gained = applyShield(
          target,
          Math.floor((target.maxHp * skill.coeff) / 100),
          timeMs + skill.shieldMs,
        );
        if (gained > 0) {
          push({
            timeMs,
            type: 'shield',
            sourceId: fighter.id,
            targetIds: [target.id],
            value: gained,
            skillId: skill.id,
            text: `${target.name} 获得护盾 ${gained}`,
          });
        }
      } else if (skill.kind === 'ally_heal') {
        const healed = applyHeal(
          target,
          Math.floor((target.maxHp * skill.coeff * healMult(timeMs)) / 100),
        );
        fighter.healingDone += healed;
        if (healed > 0) {
          push({
            timeMs,
            type: 'heal',
            sourceId: fighter.id,
            targetIds: [target.id],
            value: healed,
            skillId: skill.id,
            text: `${fighter.name} 为 ${target.name} 治疗 ${healed}`,
          });
        }
      } else {
        const raw = Math.floor(
          skillRawDamage(skill, fighter.star, fighter.atk) *
            (1 + fighter.skillPct / 100) *
            damageMult(timeMs),
        );
        const resist = skill.kind === 'single_magic' ? target.mr : target.armor;
        packets.push({
          source: fighter,
          target,
          amount: mitigatedBy(fighter, raw, resist, target),
          skillId: skill.id,
          via: 'skill',
        });
      }
    }

    for (const intent of intents) {
      if (intent.kind !== 'attack') continue;
      const { fighter, target } = intent;
      fighter.attackReadyAt = timeMs + Math.max(TICK_MS, Math.round(1000 / fighter.aspd));
      fighter.mana = Math.min(fighter.manaCost, fighter.mana + MANA_ON_HIT);
      // 普攻公式可被技能数据覆盖：临时改写 > 常驻写法 > 默认「攻击 × 100%」
      const attackSpec0 = liveUnitSkill(fighter, units);
      const override = fighter.attackOverride && fighter.attackOverride.until > timeMs ? fighter.attackOverride : undefined;
      const segments = override?.segments ?? 1;
      const raw = override
        ? Math.max(1, Math.floor(scaleAmount(override.scale, fighter.star, fighter) / segments))
        : attackSpec0?.attack
          ? scaleAmount(attackSpec0.attack, fighter.star, fighter)
          : Math.floor(fighter.atk * damageMult(timeMs));
      const aaRaw = fighter.basicPct > 0 ? Math.floor(raw * (1 + fighter.basicPct / 100)) : raw;
      for (let index = 0; index < segments; index += 1) {
        packets.push({ source: fighter, target, amount: mitigatedBy(fighter, aaRaw, target.armor, target), via: 'aa' });
      }
      // ── 数据驱动普攻追加：棋子的 onAttack + 生效中的强化状态（rider） ──
      fighter.attackCount += 1;
      const attackSpec = liveUnitSkill(fighter, units);
      const riderEffects: SkillPrimitive[] = [...(attackSpec?.onAttack ?? [])];
      for (const rider of fighter.riders) {
        if (timeMs > rider.until) continue;
        rider.counter += 1;
        if (rider.everyNth && rider.counter % rider.everyNth !== 0) continue;
        riderEffects.push(...rider.effects);
      }
      if (fighter.riders.some((rider) => rider.until <= timeMs)) fighter.riders = fighter.riders.filter((rider) => rider.until > timeMs);
      if (riderEffects.length) {
        const outcome = runSkillEffects({
          self: fighter, target, effects: riderEffects, units, timeMs,
          skillId: fighter.skillId, skillName: attackSpec?.name ?? fighter.skillId,
          star: fighter.star, damageMult: damageMult(timeMs), seed: input.seed, ruleset,
        });
        packets.push(...outcome.packets);
        for (const event of outcome.events) push({ timeMs, ...event });
        for (const summon of outcome.summons) units.push(summon);
      }
      push({
        timeMs,
        type: 'attack',
        sourceId: fighter.id,
        targetIds: [target.id],
        text: `${fighter.name} 普攻 ${target.name}`,
      });
    }

    const damagedThisTick = new Set<string>();
    for (const packet of packets) {
      if (packet.via === 'aa') {
        const evadeRoll = hashString(input.seed ^ timeMs, `${packet.target.id}:${packet.source.id}:evade`) % 100;
        const evadePct = Math.min(65, packet.target.dodgePct);
        if (evadeRoll < evadePct) {
          push({ timeMs, type: 'trait', sourceId: packet.target.id, targetIds: [packet.source.id], text: `${packet.target.name} 闪避普攻` });
          continue;
        }
      }
      const wasAlive = packet.target.hp > 0;
      // 技能减伤：只对技能来源生效。
      const incoming = packet.via === 'skill' && packet.target.skillTakenPct > 0
        ? Math.max(1, Math.floor(packet.amount * (1 - packet.target.skillTakenPct / 100)))
        : packet.amount;
      const hit = packet.trueDamage
        ? (() => {
            const savedDr = packet.target.drPct;
            packet.target.drPct = 0;
            const result = applyDamage(packet.target, incoming);
            packet.target.drPct = savedDr;
            return result;
          })()
        : applyDamage(packet.target, incoming);
      packet.source.damageDealt += hit.hp;
      // 吸血：按实际造成的伤害回复（战士 / 装备的吸血通道）。
      if (packet.source.lifestealPct > 0 && packet.source.team !== packet.target.team && hit.hp > 0) {
        const leeched = applyHeal(packet.source, Math.max(1, Math.floor(hit.hp * packet.source.lifestealPct / 100)));
        packet.source.healingDone += leeched;
      }
      // Undying effects leave the target at 1 HP once per activation.
      if (packet.target.hp <= 0 && packet.target.undyingUntil > timeMs) {
        packet.target.hp = 1;
        packet.target.undyingUntil = 0;
        push({ timeMs, type: 'trait', sourceId: packet.target.id, targetIds: [packet.target.id], text: `${packet.target.name} 濒死不倒，留 1 血` });
        const burst = packet.target.undyingBurst;
        packet.target.undyingBurst = undefined;
        if (burst?.length) {
          const spec = liveUnitSkill(packet.target, units);
          const outcome = runSkillEffects({
            self: packet.target, target: packet.source, effects: burst, units, timeMs,
            skillId: packet.target.skillId, skillName: spec?.name ?? packet.target.skillId,
            star: packet.target.star, damageMult: damageMult(timeMs), seed: input.seed, ruleset,
          });
          packets.push(...outcome.packets);
          for (const event of outcome.events) push({ timeMs, ...event });
        }
      }
            // 装备触发：命中（攻击方）与被击（受击方）。item: 前缀的包不再触发，避免递归。
      if (!packet.skillId?.startsWith('item:')) {
        runItemTriggers({ fighter: packet.source, timing: 'hit', target: packet.target, units, timeMs, seed: input.seed, ruleset, packets, pushEvent: (event) => push({ timeMs, ...event }) });
        runItemTriggers({ fighter: packet.target, timing: 'attacked', target: packet.source, units, timeMs, seed: input.seed, ruleset, packets, pushEvent: (event) => push({ timeMs, ...event }) });
      }
      // 击杀钩子（西铮再斩、叶惊弦箭矢续飞）
      if (wasAlive && packet.target.hp <= 0) {
        packet.source.kills += 1;
        runItemTriggers({ fighter: packet.source, timing: 'kill', target: packet.target, units, timeMs, seed: input.seed, ruleset, packets, pushEvent: (event) => push({ timeMs, ...event }) });
          const killerSpec = liveUnitSkill(packet.source, units);
        if (killerSpec?.onKill) {
          const outcome = runSkillEffects({
            self: packet.source, target: null, effects: killerSpec.onKill, units, timeMs,
            skillId: packet.source.skillId, skillName: killerSpec.name, star: packet.source.star,
            damageMult: damageMult(timeMs), seed: input.seed, ruleset,
          });
          packets.push(...outcome.packets);
          for (const event of outcome.events) push({ timeMs, ...event });
          for (const summon of outcome.summons) units.push(summon);
        }
      }
      // 受击钩子（数据驱动）：每个单位每 tick 只触发一次。
      if (wasAlive && hit.hp > 0 && packet.target.hp > 0 && !damagedThisTick.has(packet.target.id)) {
          const hurtSpec = liveUnitSkill(packet.target, units);
        if (hurtSpec?.onDamaged) {
          damagedThisTick.add(packet.target.id);
          const outcome = runSkillEffects({
            self: packet.target, target: packet.source, effects: hurtSpec.onDamaged, units, timeMs,
            skillId: packet.target.skillId, skillName: hurtSpec.name, star: packet.target.star,
            damageMult: damageMult(timeMs), seed: input.seed, ruleset,
          });
          for (const event of outcome.events) push({ timeMs, ...event });
          for (const summon of outcome.summons) units.push(summon);
        }
      }
      grantHitMana(packet.target, hit.hp, timeMs);
      maybeEmergencyHeal(packet.target, timeMs);
      if (hit.hp <= 0 && packet.amount <= 0) continue;
      push({
        timeMs,
        type: 'damage',
        sourceId: packet.source.id,
        targetIds: [packet.target.id],
        value: hit.hp,
        skillId: packet.skillId,
        text:
          packet.via === 'skill'
            ? `${packet.source.name} 技能命中 ${packet.target.name}，${hit.hp}`
            : `${packet.target.name} 失血 ${hit.hp}`,
      });
    }

    // Overtime drains HP directly, equally for both teams, before the normal death pass.
    if (timeMs >= MAX_BATTLE_MS && timeMs % 1000 === 0) {
      const drainPct = 0.04 + 0.02 * ((timeMs - MAX_BATTLE_MS) / 1000);
      for (const unit of living(units)) {
        const loss = Math.min(unit.hp, Math.ceil(unit.maxHp * drainPct));
        unit.hp -= loss;
        unit.damageTaken += loss;
        push({ timeMs, type: 'damage', sourceId: unit.id, targetIds: [unit.id], value: loss, skillId: 'overtime', text: `${unit.name} 加时流失 ${loss} 气血` });
      }
    }
    for (const unit of units) {
      if (unit.hp > 0) continue;
      if (events.some((event) => event.type === 'death' && event.sourceId === unit.id)) continue;
      // ── Data-driven on-death effects ──
      const deathSpec = liveUnitSkill(unit, units);
      const revive = deathSpec?.onDeath?.find((effect) => effect.op === 'revive');
      if (revive && revive.op === 'revive' && unit.revivesLeft > 0) {
        unit.revivesLeft -= 1;
        unit.hp = Math.max(1, Math.round(unit.maxHp * 0.5));
        unit.mana = 0;
        unit.stunUntil = 0;
        unit.silenceUntil = 0;
        unit.disarmUntil = 0;
        const spot = revive.moveTo === 'farthestFoe'
          ? (() => {
              const farthest = [...foesOf(unit, units)].sort((a, b) => manhattan(unit, b) - manhattan(unit, a) || comparePos(a, b))[0];
              return farthest ? freeFlankCell(farthest, unit, units) : null;
            })()
          : null;
        if (spot) {
          unit.row = spot.row;
          unit.col = spot.col;
          markMoved(unit, timeMs);
        }
        push({ timeMs, type: 'regen', sourceId: unit.id, targetIds: [unit.id], value: unit.hp, skillId: unit.skillId, text: `${unit.name} 立刻复活并跃向最远敌人（剩余 ${unit.revivesLeft} 次）` });
        if (revive.radius) {
          const burst = scaleAmount(revive.scale ?? { atkPct: 250 }, unit.star, unit);
          for (const foe of foesOf(unit, units).filter((entry) => manhattan(unit, entry) <= revive.radius!)) {
            const hit = applyDamage(foe, mitigatedBy(unit, burst, foe.armor, foe));
            unit.damageDealt += hit.hp;
            grantHitMana(foe, hit.hp, timeMs);
            push({ timeMs, type: 'damage', sourceId: unit.id, targetIds: [foe.id], value: hit.hp, skillId: unit.skillId, text: `${unit.name} 复活冲击 ${foe.name}，${hit.hp}` });
          }
        }
        continue;
      }
      push({
        timeMs,
        type: 'death',
        sourceId: unit.id,
        text: `${unit.name} 倒下`,
      });
      for (const holder of living(units).filter((fighter) => fighter.deathBurstHpPct > 0 && !fighter.deathBurstUsed)) {
        holder.deathBurstUsed = true;
        const raw = Math.floor(holder.maxHp * holder.deathBurstHpPct / 100);
        for (const victim of foesOf(holder, units)) {
          const burst = applyDamage(victim, mitigatedBy(holder, raw, victim.mr, victim));
          holder.damageDealt += burst.hp;
          maybeEmergencyHeal(victim, timeMs);
          if (burst.hp > 0) push({ timeMs, type: 'damage', sourceId: holder.id, targetIds: [victim.id], value: burst.hp, skillId: 'death-burst', text: `${holder.name} 借阵亡冲击 ${victim.name}，${burst.hp}` });
        }
      }
    }

    const decided = outcomeOf(units);
    if (decided) {
      outcome = decided;
      break;
    }
    if (timeMs >= battleLimit) {
      // 打满时间不再直接判平：按双方存活棋子的剩余气血总和决定胜负（差距很小才判平）。
      const remainingHp = (team: TeamId) => living(units).filter((entry) => entry.team === team).reduce((total, entry) => total + entry.hp, 0);
      const leftHp = remainingHp('left'); const rightHp = remainingHp('right');
      outcome = Math.abs(leftHp - rightHp) < 1 ? 'draw' : leftHp > rightHp ? 'left' : 'right';
      push({ timeMs, type: 'end', text: `时间到，按剩余气血判定：青 ${Math.round(leftHp)} / 赤 ${Math.round(rightHp)}` });
      break;
    }
  }

  const resultText = outcome === 'draw' ? '双方仍有人在场，判平。' : `${teamLabel(outcome)} 胜。`;
  push({ timeMs, type: 'end', text: resultText });

  const lines: UnitStatLine[] = units.map((unit) => ({
    id: unit.id,
    team: unit.team,
    name: unit.name,
    templateId: unit.templateId,
    damageDealt: unit.damageDealt,
    healingDone: unit.healingDone,
    damageTaken: unit.damageTaken,
    casts: unit.casts,
    kills: unit.kills,
    survivingHp: Math.max(0, unit.hp),
    maxHp: unit.maxHp,
    manaCost: unit.manaCost,
    manaStart: unit.spawnMana,
  }));

  return {
    battleId: input.battleId,
    rulesVersion: RULES_VERSION,
    configVersion: CONFIG_VERSION,
    seed: input.seed,
    outcome,
    durationMs: timeMs,
    ticks,
    events,
    keyEvents: keyEventsOf(events),
    units: lines,
  };
}
