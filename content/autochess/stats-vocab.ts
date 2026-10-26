/**
 * 数据驱动的属性词表（引擎与内容之间的唯一契约）。
 *
 * 内容（棋子 / 装备 / 心悟 / 羁绊档位）只描述「给谁、加什么属性、多少」，
 * 由 `applyStatOps` 统一结算。新增一条属性只需在 `StatKey` 与下面的 switch 里各加一处，
 * 之后所有内容都能直接用，不必再改引擎。
 *
 * 换一套棋子 / 羁绊时：换数据即可，本文件与 `lib/autochess/stats.ts` 不需要动。
 */

/** 可结算的属性键。`*Pct` 一律是百分数（20 = +20%）。 */
export type StatKey =
  // 基础三围与双抗（add = 固定值；对应 *Pct 为面板百分比）
  | 'hp'
  | 'atk'
  | 'armor'
  | 'mr'
  | 'range'
  | 'hpPct'
  | 'atkPct'
  | 'armorPct'
  | 'mrPct'
  // 输出与防御通道
  | 'aspdPct'
  | 'skillPct'
  | 'basicPct'
  | 'dmgPct'
  | 'drPct'
  | 'skillTakenPct'
  | 'penetrationPct'
  /** 破防：固定值忽视防御（文档里全员 40，刺客羁绊 20/25/30/35）。 */
  | 'penetrationFlat'
  | 'dodgePct'
  | 'critPct'
  | 'critDamagePct'
  | 'lifestealPct'
  // 资源与续航
  | 'manaRegenPct'
  | 'manaStartFlat'
  | 'healReceivePct'
  | 'regenPctPerSec'
  | 'moveSpeedPct'
  // 开战一次性
  | 'startShieldPct'
  | 'distanceDamagePctPerTile';

export type StatOp = { stat: StatKey; value: number };

/** 所有可被 StatOp 写入的累加槽。引擎在结算某个棋子时构造一次。 */
export type StatSink = {
  hp: number;
  atk: number;
  armor: number;
  mr: number;
  aspd: number;
  range: number;
  hpPct: number;
  atkPct: number;
  armorPct: number;
  mrPct: number;
  skillPct: number;
  basicPct: number;
  dmgPct: number;
  drPct: number;
  skillTakenPct: number;
  penetrationPct: number;
  penetrationFlat: number;
  dodgePct: number;
  critPct: number;
  critDamagePct: number;
  lifestealPct: number;
  manaRegenPct: number;
  manaStartFlat: number;
  healReceivePct: number;
  regenPctPerSec: number;
  moveSpeedPct: number;
  startShieldPct: number;
  distanceDamagePctPerTile: number;
};

/** 攻速与移速是乘算（`aspd *= 1 + pct/100`），其余百分比是加算后一次性乘。 */
const MULTIPLICATIVE: ReadonlySet<StatKey> = new Set<StatKey>(['aspdPct', 'moveSpeedPct']);
/** 取最大值而不是累加的属性（同一件装备只算一次是最强的那件）。 */
const MAX_SEMANTICS: ReadonlySet<StatKey> = new Set<StatKey>([
  'startShieldPct',
  'distanceDamagePctPerTile',
]);

export function createStatSink(base: { hp: number; atk: number; armor: number; mr: number; aspd: number; range: number }): StatSink {
  return {
    hp: base.hp,
    atk: base.atk,
    armor: base.armor,
    mr: base.mr,
    aspd: base.aspd,
    range: base.range,
    hpPct: 0,
    atkPct: 0,
    armorPct: 0,
    mrPct: 0,
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
    manaStartFlat: 0,
    healReceivePct: 0,
    regenPctPerSec: 0,
    moveSpeedPct: 0,
    startShieldPct: 0,
    distanceDamagePctPerTile: 0,
  };
}

/**
 * 把一组 StatOp 写进累加槽。这是引擎里唯一认识 `StatKey` 的地方：
 * 新属性只在这里加一个 case 即可被全部内容使用。
 */
export function applyStatOps(sink: StatSink, ops: readonly StatOp[] | undefined | null): void {
  if (!ops?.length) return;
  for (const op of ops) {
    const value = op.value;
    if (!Number.isFinite(value) || value === 0) continue;
    const key = op.stat;
    if (MULTIPLICATIVE.has(key)) {
      // 乘算通道：aspdPct / moveSpeedPct 存成倍率系数
      if (key === 'aspdPct') sink.aspd *= 1 + value / 100;
      else sink.moveSpeedPct = (sink.moveSpeedPct || 1) * (1 + value / 100);
      continue;
    }
    if (MAX_SEMANTICS.has(key)) {
      const field = key as 'startShieldPct' | 'distanceDamagePctPerTile';
      if (value > sink[field]) sink[field] = value;
      continue;
    }
    if (!(key in sink)) continue;
    (sink as Record<string, number>)[key] += value;
  }
}

/** 面板百分比乘算收口：hp/atk/armor/mr 加算完再乘。 */
export function finalizeStatSink(sink: StatSink): StatSink {
  sink.hp = Math.round(sink.hp * (1 + sink.hpPct / 100));
  sink.atk = Math.round(sink.atk * (1 + sink.atkPct / 100));
  sink.armor = Math.round(sink.armor * (1 + sink.armorPct / 100));
  sink.mr = Math.round(sink.mr * (1 + sink.mrPct / 100));
  if (sink.moveSpeedPct === 0) sink.moveSpeedPct = 1;
  return sink;
}

/** `{2: 10, 4: 24}` 形式的档位表取当前档（沿用「不小于」语义）。 */
export function ladderValue(table: Record<number, number>, count: number): number {
  let value = 0;
  for (const key of Object.keys(table).map(Number).sort((a, b) => a - b)) {
    if (count >= key) value = table[key] ?? value;
  }
  return value;
}

/** 把 `{2: [+14% 攻击]}` 展开成「当前档位生效的属性」。 */
export function ladderOps(table: Record<number, readonly StatOp[]>, count: number): StatOp[] {
  let ops: readonly StatOp[] = [];
  for (const key of Object.keys(table).map(Number).sort((a, b) => a - b)) {
    if (count >= key) ops = table[key] ?? ops;
  }
  return [...ops];
}
