import type { StatKey, StatOp } from './stats-vocab';

export type Role = 'tank' | 'melee' | 'ranged' | 'caster' | 'support';
export type DamageType = 'physical' | 'magic';
export type SkillKind =
  | 'self_shield'
  | 'ally_shield'
  | 'ally_heal'
  | 'single_phys'
  | 'single_magic';
export type TraitKind = 'faction' | 'job';
/**
 * 羁绊 id 故意保持开放（string）：换一套棋子 / 羁绊时只加数据，不动类型。
 */
export type FactionId = string;
export type JobId = string;
export type TraitId = string;

export type SkillDef = {
  id: string;
  name: string;
  kind: SkillKind;
  coeff: number;
  /** Optional fixed value added before the attack ratio. */
  flat?: number;
  /** 1★ / 2★ / 3★ attack ratios for skills with a finishing-star spike. */
  coeffByStar?: readonly [number, number, number];
  shieldMs: number;
  maxTargets: number;
};

export type UnitStatTemplate = {
  hp: number;
  atk: number;
  armor: number;
  mr: number;
  aspd: number;
  range: number;
};

export type UnitDef = {
  id: string;
  name: string;
  cost: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Shop tier when it differs from the content cost. */
  autochessCost?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  role: Role;
  skillId: string;
  /** Skill override used by autochess combat. */
  autochessSkillId?: string;
  factions: FactionId[];
  jobs: JobId[];
  summon: boolean;
  master: boolean;
  /** Companions ride along for free and stay out of the shop pool. */
  companion: boolean;
  /** Exists only in the autochess roster. */
  autochessOnly?: boolean;
  /** External unit: fixed at 1 star, excluded from the shop and field limit. */
  ally?: boolean;
  source: 'pack' | 'summon' | 'ai';
  /** Skills are role bricks, not claimed official kit. */
  skillNote: string;
  artNeed: string;
  /** Exact 1★ chassis for units whose official-like template is known. */
  statTemplate?: UnitStatTemplate;
  /** Per-star energy cost; unspecified pieces use the global default. */
  manaByStar?: readonly [number, number, number];
  /** Base critical chance used by mechanics that convert crit into another stat. */
  critPct?: number;
  /** 额外羁绊：由棋子自身、装备或强化效果注入。 */
  grantTraits?: TraitId[];
  /** 棋子自带的常驻属性。 */
  passiveStats?: StatOp[];
  /** 需要按战场实时量缩放的属性（数据驱动，metric 由引擎的具名处理器解析）。 */
  scaling?: { metric: ScalingMetric; stat: StatOp['stat']; ladder: Record<number, number> };
  /** 房间层「风控」机制（回合结算，不在战斗内）。与 scaling 同一套路：数据声明，引擎具名解析。 */
  hazard?: UnitHazard[];
  /** 房间层「监管」机制：对敌方棋子施加持久标记（可被卖掉清除）。 */
  maneuver?: UnitManeuver[];
};

/** 引擎支持的「实时量」具名处理器；新增一种只在这里加名字与一个 handler。 */
export type ScalingMetric = 'adjacentAllies' | 'distinctAllies' | 'teamSize';

/** 全队光环可引用的战场实时量；新增一种只在这里加名字与一个 handler。 */
export type AuraMetric = 'traitCount' | 'teamStars';

/**
 * ── 房间层「风控」机制 ─────────────────────────────────────────
 *
 * 有些梗必须跨回合、动金币（查IP封号、官方活动罢工…），战斗原语表达不了。
 * 这里只声明数据；判定与结算由 `lib/autochess/hazards.ts` 的具名 handler 完成，
 * 房间层在回合开始时统一调用。新增一种风控 = 加一个 metric 名字 + 一个 handler。
 */
export type HazardTiming = 'roundStart' | 'roundEnd';
/** 命中后的效果：`ban` 直接离场（金币打水漂），`strike` 缺席若干回合后归队，`price` 改变本回合购买价，`soldout` 本回合售罄买不到。 */
export type HazardEffect = 'ban' | 'strike' | 'price' | 'soldout';

export type HazardMetric =
  /** 固定基础值（通常配合其它 metric 使用）。 */
  | { k: 'constant'; value: number }
  /** 己方（含自身）携带该羁绊的不同棋子数，每名 +perPct。查IP 的核心项。 */
  | { k: 'alliedTraitCount'; trait: TraitId; perPct: number }
  /** 该棋子被本风控命中过的历史次数，每次 +perPct（黑名单递增）。 */
  | { k: 'hitCount'; perPct: number }
  /** 按自身星级查表（Gemini 官活罢工：星级越高越容易罢工）。 */
  | { k: 'selfStar'; table: Record<number, number> }
  /** 按回合数递增，第 round 回合 +perPct*(round-1)。 */
  | { k: 'round'; perPct: number };

export type UnitHazard = {
  /** 稳定 id，用于记账与去重（同一棋子可挂多条风控）。 */
  id: string;
  label: string;
  timing: HazardTiming;
  effect: HazardEffect;
  /** 基础概率（%）。 */
  basePct: number;
  /** Reserve chance is exact and bypasses all modifiers. */
  benchChancePct?: number;
  immuneAtStar?: number;
  perPieceRoll?: boolean;
  /** 概率上限（%），防止叠到必中。 */
  capPct: number;
  /** 逐项累加的基础概率修正；留空则只用 basePct。 */
  metrics?: HazardMetric[];
  /** `strike` 缺席回合数，默认 1。 */
  strikeRounds?: number;
  /** `ban` 时的补偿金币，默认 0（梭哈纯亏）。 */
  refundGold?: number;
  /** `price` 类型的价格波动：命中=波峰，未命中=波谷。 */
  price?: { peakDelta: number; troughDelta: number };
  note?: string;
};

/**
 * ── 房间层「监管」机制 ─────────────────────────────────────────
 *
 * 与风控相反：这是**主动施加给对手**的持久标记（例：safety 合规税）。
 * 命中后挂在对方某枚棋子上、跨回合累积；对方**卖掉那枚棋子即清除**（唯一反制）。
 * 判定在 `lib/autochess/maneuvers.ts`，结算由房间层调用。
 */
export type ManeuverEffect = 'safety';
export type ManeuverTrigger = 'roundStart' | 'roundWin';
export type UnitManeuver = {
  id: string;
  label: string;
  /** 触发时机：`roundWin` = 只在己方赢下交手时叠加；`roundStart` = 每回合。 */
  trigger: ManeuverTrigger;
  target: 'randomFoe';
  effect: ManeuverEffect;
  /** 每次触发叠几层。 */
  perTrigger: number;
  /** 叠层上限（防止一局把对面彻底废掉）。 */
  maxStacks: number;
  note?: string;
};

export type ItemDef = {
  id: string;
  name: string;
  color: string;
  family: string;
  atk: number;
  atkPct?: number;
  hp: number;
  hpPct?: number;
  armor: number;
  armorPct?: number;
  mr: number;
  mrPct?: number;
  aspdPct: number;
  skillPct: number;
  penetrationPct?: number;
  /** 破防：固定值忽视防御。 */
  penetrationFlat?: number;
  dodgePct?: number;
  regenPctPerSec?: number;
  drPct?: number;
  emergencyHealPct?: number;
  firstCastControlMs?: number;
  deathBurstHpPct?: number;
  startUntargetableMs?: number;
  startShieldPct?: number;
  moveMode?: 'advance' | 'backline' | 'cast';
  controlImmune?: boolean;
  allyBuffPct?: number;
  burnAtkPctPerTick?: number;
  ricochetPct?: number;
  rangeBonus?: number;
  distanceDamagePctPerTile?: number;
  castUntargetableMs?: number;
  /** 通用属性包：新装备一律用这个，不必再往 ItemDef 上加字段。 */
  stats?: StatOp[];
  /** 转职：使装备者额外获得这些羁绊。 */
  grantTraits?: TraitId[];
  /** 触发式效果（proc）：命中/被击/施法/击杀/阵亡/每秒。效果复用技能原语，引擎不认识具体装备。 */
  triggers?: ItemTrigger[];
  /** 一次性食用/使用类：消耗后给棋子永久属性（见 room-store 的 consume 动作）。 */
  consume?: {
    label: string;
    stats?: StatOp[];
    note?: string;
  };
  note?: string;
};

export type TriggerTiming = 'battleStart' | 'hit' | 'attacked' | 'cast' | 'kill' | 'death' | 'second';

export type ItemTrigger = {
  on: TriggerTiming;
  /** 触发节流 / 概率（概率用确定性 hash）。 */
  everyMs?: number;
  chancePct?: number;
  /** 叠层：每次触发累加，可供效果里的 `radiusFromStack` 等读取。 */
  stack?: { key: string; add: number; max?: number };
  /** 满层后不再执行效果，适合逐层加面板的装备。 */
  stopAtMax?: boolean;
  /** 效果：与棋子技能同一套原语（SkillPrimitive），引擎复用同一个解释器。 */
  effects: import('./unit-skills').SkillPrimitive[];
};

export type HexRarity = 'blue' | 'purple' | 'gold' | 'orange';

/** 候选池：上场阵容羁绊相关 / 阵容中低费棋子 / 场上人数最多羁绊的棋子。 */
export type RecurringGrantPool = 'traitRelated' | 'cheapBoard' | 'topTrait';

/** 装备宝箱：从 `options` 件同品阶装备里选 1 件，`count` 个箱子依次开启。 */
export type ItemBoxGrant = {
  /** 品阶：white / purple / epic / orange。 */
  family: string;
  options: number;
  count: number;
};

/** 神秘宝匣的一份随机奖励：可能给金币、装备或棋子。 */
export type MysteryReward = {
  gold?: number;
  items?: { family: string; count: number };
  units?: number;
};

/** 神秘宝匣系（蓝/紫/金共用一个计数）：第 `doubleAt` 次翻倍，第 `fortuneAt` 次改发鸿运宝匣。 */
export type MysteryBox = {
  /** 三档共享的计数键。 */
  counter: string;
  /** 每次开箱随机抽一份。 */
  rewards: MysteryReward[];
  doubleAt?: number;
  fortuneAt?: number;
  fortune?: MysteryReward;
};

/** 棋手触发的条件发放（残甲锻锋：棋手气血低于 X 后）。 */
export type HexGrant = {
  itemBoxes?: ItemBoxGrant[];
  grantTierItems?: { family: string; count: number };
};

/** Repeated unit grant interpreted only by timing and candidate-pool rules. */
export type RecurringGrant = {
  timing: 'claim' | 'roundStart' | 'roundEnd';
  count: number;
  pool: RecurringGrantPool;
  /** 发放的星级，默认 1。 */
  star?: 1 | 2 | 3;
  /** cheapBoard 的低费上限，默认 2。 */
  maxCost?: number;
  /** 候选为空时改为发放的金币。 */
  fallbackGold?: number;
};

/** 回合级限时效果（RP 梗包）：回合初结算、持续 rounds 轮，到期自动剔除。 */
export type RoundEffect =
  | { kind: 'stat'; pick?: 'random' | 'all' | 'strongest'; stat: StatKey; value: number; rounds: number }
  | { kind: 'freeRefresh'; perRound: number; rounds: number }
  | { kind: 'noHpLoss'; rounds: number }
  | { kind: 'cashback'; rounds: number }
  | { kind: 'infect'; chance: number; value: number; rounds: number }
  | { kind: 'foeManaSlow'; value: number; rounds: number };

export type HexDef = {
  id: string;
  name: string;
  rarity: HexRarity;
  note: string;
  grantUnitId?: string;
  gold?: number;
  hpPct?: number;
  atkPct?: number;
  skillPct?: number;
  aspdPct?: number;
  drPct?: number;
  armorPct?: number;
  mrPct?: number;
  /** 通用属性包：新心悟一律用这个。 */
  stats?: StatOp[];
  /** 回合级限时效果（RP 梗包）：见 RoundEffect。 */
  roundEffect?: RoundEffect;
  /** Extra traits granted by this choice. */
  grantTraits?: TraitId[];
  /** 分类标签：'attribute' = 属性类（彼此共鸣 +50%）。 */
  tags?: string[];
  /** Effects that scale linearly with the number of adjacent allies. */
  perAdjacentAlly?: StatOp[];
  /** 直接发放的装备。 */
  grantItems?: string[];
  /** 随机发放 N 个棋子（好事成双 / 绝代双骄…）。一次性，不随回合重复。 */
  grantRandomUnits?: number;
  /** Units granted repeatedly on the declared timing. */
  recurringGrants?: RecurringGrant[];
  /** 按品阶随机发放 N 件装备（千锤百炼 / 血刃藏锋…）。一次性，直接进背包。 */
  grantTierItems?: { family: string; count: number };
  /** Sequential choose-one item boxes; all boxes must be opened before readying. */
  itemBoxes?: ItemBoxGrant[];
  /** 神秘宝匣系（随机奖励 + 累计计数）。 */
  mysteryBox?: MysteryBox;
  /** 覆盖基础利息上限（生财有道 = 10，天外横财 = 0）。 */
  interestCap?: number;
  /** 替代利息的每轮固定金币，按对战阶段（1/2/3，见 stageOfRound）取值。 */
  roundIncome?: Record<number, number>;
  /** 棋手气血降到 `hp` 以下时一次性发放（残甲锻锋）。 */
  onHpBelow?: { hp: number } & HexGrant;
  /** 属性生效的条件（位置 / 血量 / 装备数 类心悟）。 */
  when?: {
    adjacentAlliesAtLeast?: number;
    adjacentAlliesAtMost?: number;
    selfHpBelowPct?: number;
    selfHpAbovePct?: number;
    noItems?: boolean;
    roleIn?: string[];
    costAtLeast?: number;
    costAtMost?: number;
  };
  /** 只改写指定棋子的技能数据；运行时按声明解释，不按心悟 id 写特判。 */
  skillRewrites?: SkillRewrite[];
};

export type SkillRewrite = {
  unitId: string;
  /** 仅该棋子拥有本心悟且是同名棋子中战力最高者时生效。 */
  strongestOnly?: boolean;
  castEffects?: import('./unit-skills').SkillPrimitive[];
  onAttackEffects?: import('./unit-skills').SkillPrimitive[];
  castManaDelta?: number;
  castRadiusDelta?: number;
  castCountDelta?: number;
};

/** 一个「亮起来的档位」给什么。留空表示这一档只有文案、没有数值。 */
export type TraitTier = {
  /** 给该羁绊成员自己的属性。 */
  stats?: StatOp[];
  /** Stats granted to the whole allied team. */
  teamStats?: StatOp[];
};

export type TraitDef = {
  id: TraitId;
  name: string;
  kind: TraitKind;
  /** Unique-name counts that light this trait up, low to high. */
  tiers: number[];
  ladders: string;
  /** 数据驱动的档位效果：`{ 2: { stats: [...] }, 4: {...} }`（键与上面的 tiers 对应）。 */
  tierEffects?: Record<number, TraitTier>;
  /** 引擎具名机制（复唱、斩杀线、召唤…）。数据只声明引用与参数。 */
  mechanics?: TraitMechanic[];
  /** 文档已定义、引擎尚未接线的系统型机制（进度对照用）。 */
  pending?: string[];
};

export type TraitMechanic = {
  id: 'campStandoff';
  campA: TraitId;
  campB: TraitId;
  at: number;
  shieldPct: number;
  atkPct: number;
};
