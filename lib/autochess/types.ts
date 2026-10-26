import type { TraitId } from '../../content/autochess/types';
import type { StatOp } from '../../content/autochess/stats-vocab';

export type TeamId = 'left' | 'right';
export type BattleOutcome = 'left' | 'right' | 'draw';
export type Star = 1 | 2 | 3;

export type Combatant = {
  id: string;
  templateId: string;
  star: Star;
  localRow: number;
  localCol: number;
  itemIds: string[];
  /** Player-level 心悟 copied onto each combatant for this battle. */
  hexIds?: string[];
  /** 已食用/使用的一次性道具 id：永久提供其 stats（珍馐等）。 */
  consumed?: string[];
  /** Per-battle opening mana supplied by generic effects. */
  initialMana?: number;
  /** 「safety」合规税层数：跨回合持久，卖掉棋子即清除（面板由 safetyOps 结算）。 */
  safetyStacks?: number;
  /** 限时属性（RP 梗包「回合级效果」）：到 untilRound 为止有效，过期由房间层剔除。 */
  tempStats?: (StatOp & { untilRound: number; tag?: string })[];
  /** 本回合该棋子的风控理论概率（%，仅展示；实际掷骰还要过运气）。 */
  hazardPct?: number;
};

export type BattleInput = {
  battleId: string;
  seed: number;
  left: Combatant[];
  right: Combatant[];
  /** Whether this player currently has the lowest health in the match. */
  playerHpLowest?: Partial<Record<TeamId, boolean>>;
  /** 该方棋手等级（满级召唤等用）。 */
  playerLevel?: Partial<Record<TeamId, number>>;
};

export type Vec = { row: number; col: number };

export type CombatEventType =
  | 'spawn'
  | 'trait'
  | 'move'
  | 'attack'
  | 'cast'
  | 'shield'
  | 'heal'
  | 'damage'
  | 'death'
  | 'regen'
  | 'summon'
  | 'ember'
  | 'array'
  | 'moon'
  | 'sudden_death'
  | 'end';

export type CombatEvent = {
  seq: number;
  timeMs: number;
  type: CombatEventType;
  sourceId?: string;
  targetIds?: string[];
  value?: number;
  pos?: Vec;
  skillId?: string;
  text: string;
};

export type UnitStatLine = {
  id: string;
  team: TeamId;
  name: string;
  templateId: string;
  damageDealt: number;
  healingDone: number;
  damageTaken: number;
  casts: number;
  /** Kills credited to this unit during the battle. */
  kills: number;
  survivingHp: number;
  maxHp: number;
  /** 内力上限与开战内力（蓝条显示用）。 */
  manaCost: number;
  manaStart: number;
};

export type BattleOutput = {
  battleId: string;
  rulesVersion: string;
  configVersion: string;
  seed: number;
  outcome: BattleOutcome;
  durationMs: number;
  ticks: number;
  events: CombatEvent[];
  keyEvents: CombatEvent[];
  units: UnitStatLine[];
};

export type CombatStats = {
  maxHp: number;
  atk: number;
  aspd: number;
  armor: number;
  mr: number;
  range: number;
  skillPct: number;
  /** 普攻增伤（与技能增伤分离）。 */
  basicPct: number;
  /** 造成伤害提高（doc 的「增伤」）。 */
  dmgPct: number;
  drPct: number;
  /** 受到技能伤害降低。 */
  skillTakenPct: number;
  penetrationPct: number;
  /** 破防：固定值忽视防御。 */
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
  emergencyHealPct: number;
  firstCastControlMs: number;
  deathBurstHpPct: number;
  startUntargetableMs: number;
  startShieldPct: number;
  moveMode?: 'advance' | 'backline' | 'cast';
  controlImmune: boolean;
  allyBuffPct: number;
  burnAtkPctPerTick: number;
  ricochetPct: number;
  distanceDamagePctPerTile: number;
  castUntargetableMs: number;
  trait: TraitId;
  traitCount: number;
};
