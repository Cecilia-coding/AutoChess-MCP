/**
 * 游戏全局后台配置表（单一来源：外观分层定价 / 局外经济与结算 / 游乐摊门票与档位 / 玩法概率权重）。
 *
 * 同构纯模块（无 Node fs 依赖），供服务端引擎、API 响应与前端商城/游乐摊/后台配置表共用。
 * 持久化与热加载由 `lib/accounts/config-store.ts`（GameConfigStore）负责。
 */

import {
  BUFF_ARCHETYPES,
  DEFAULT_BUFF_DRAFT_CONFIG,
  type BuffCategoryId,
  type BuffDraftConfig,
  type BuffPackCopy,
  type BuffRarityId,
  type BuffRuleConfig,
  type BuffStageId,
  type BuffStageWeights,
} from './journey-buffs';

export type {
  BuffCategoryId,
  BuffDraftConfig,
  BuffPackCopy,
  BuffRarityId,
  BuffRuleConfig,
  BuffStageId,
  BuffStageWeights,
} from './journey-buffs';

export type CosmeticTierId = 't1' | 't2' | 't3' | 'frame' | 'retired';
export type CosmeticAcquisition = 'shop' | 'arcade' | 'default' | 'retired';
export type GameConfigSectionId = 'cosmetics' | 'pacing' | 'buffs' | 'economy' | 'arcade' | 'odds';

export type DamageStageId = 'early' | 'mid' | 'late' | 'overtime';

export type DamageStageRule = {
  id: DamageStageId;
  label: string;
  maxRound: number;
  baseDamage: number;
  perSurvivor: number;
  survivorCap: number;
  extraPerRound: number;
};

export type PacingConfig = {
  standardStartHp: number;
  duelStartHp: number;
  duelDamageScale: number;
  drawDamageRatio: number;
  startGold: number;
  roundBaseIncome: number;
  baseInterestCap: number;
  shopRefreshCost: number;
  xpPerRound: number;
  xpBuyCost: number;
  xpBuyAmount: number;
  winStreakCap: number;
  lossBountyPerLossCap: number;
  lossBountyBankCap: number;
  damageStages: DamageStageRule[];
};

export type CosmeticTierMeta = {
  id: CosmeticTierId;
  label: string;
  shortLabel: string;
  badge: string;
  rank: number;
  defaultHumanPrice: number;
  defaultBotPrice: number;
};

export const COSMETIC_TIER_META: Record<CosmeticTierId, CosmeticTierMeta> = {
  t1: {
    id: 't1',
    label: '第一梯队 · 臻品典藏',
    shortLabel: '第一梯队',
    badge: '臻品',
    rank: 1,
    defaultHumanPrice: 180,
    defaultBotPrice: 1800,
  },
  t2: {
    id: 't2',
    label: '第二梯队 · 精选雅集',
    shortLabel: '第二梯队',
    badge: '精选',
    rank: 2,
    defaultHumanPrice: 108,
    defaultBotPrice: 1080,
  },
  t3: {
    id: 't3',
    label: '第三梯队 · 初遇星轨',
    shortLabel: '第三梯队',
    badge: '初遇',
    rank: 3,
    defaultHumanPrice: 52,
    defaultBotPrice: 520,
  },
  frame: {
    id: 'frame',
    label: '像素头像框',
    shortLabel: '头像框',
    badge: '画框',
    rank: 4,
    defaultHumanPrice: 52,
    defaultBotPrice: 520,
  },
  retired: {
    id: 'retired',
    label: '典藏绝版',
    shortLabel: '绝版',
    badge: '绝版',
    rank: 5,
    defaultHumanPrice: 0,
    defaultBotPrice: 0,
  },
};

export type CosmeticRuleConfig = {
  id: string;
  tier: CosmeticTierId;
  acquisition: CosmeticAcquisition;
  humanPrice: number;
  botPrice: number;
  sortOrder: number;
};

export type EconomyConfig = {
  exchangeBotPerHuman: number;
  matchmakingWinMultiplier: number;
  matchmakingLossMultiplier: number;
  matchmakingDuelLoss: number;
  legacyPlayReward: number;
  legacyWinReward: number;
  companionMinRounds: number;
  companionHumanWin: number;
  companionHumanDraw: number;
  companionHumanLoss: number;
  companionBotWin: number;
  companionBotDraw: number;
  companionBotLoss: number;
  companionWinTickets: number;
  companionDailyCap: number;
  travelMinRounds: number;
  travelWinnerFirst: number;
  travelWinnerLast: number;
  travelLoserFirst: number;
  travelLoserLast: number;
  travelWinTickets: number;
  travelDailyCap: number;
  feedbackRewardBot: number;
  feedbackWeeklyCap: number;
  feedbackCompensationMax: number;
};

export type ArcadeStakeConfig = {
  id: 'small' | 'medium' | 'high';
  label: string;
  badge: string;
  ticketCost: number;
  humanCost: number;
  botCost: number;
  cosmeticRateBoost: number;
};

export type ArcadeDropWeightConfig = {
  prizeId: string;
  weight: number;
};

export type ArcadeConfig = {
  starterTickets: number;
  ticketHumanPrice: number;
  ticketBotPrice: number;
  maxTickets: number;
  maxPackCount: number;
  reliefTickets: number;
  reliefDailyLimit: number;
  gambleWinProbability: number;
  gambleMultiplier: number;
  gambleMaxDoubles: number;
  stakes: ArcadeStakeConfig[];
  drops: ArcadeDropWeightConfig[];
};

export type SlotSymbolWeightConfig = {
  id: 'coin' | 'clover' | 'star' | 'seven' | 'bomb' | 'skull';
  name: string;
  glyph: string;
  weight: number;
};

export type SlotPayoutConfig = {
  seven3: number;
  star3: number;
  clover3: number;
  coin3: number;
  seven2: number;
  star2: number;
  clover2: number;
  coin2: number;
  seven3Chance: number;
  star3Chance: number;
  clover3Chance: number;
  coin3Chance: number;
  seven2Chance: number;
};

export type ScratchTierConfig = {
  id: 'bust' | 'small' | 'double' | 'crit' | 'mega' | 'jackpot';
  name: string;
  weight: number;
  multiplier: number;
  cosmeticBaseChance: number;
  label: string;
};

export type OddsConfig = {
  slotSymbols: SlotSymbolWeightConfig[];
  slotPayouts: SlotPayoutConfig;
  scratchTiers: ScratchTierConfig[];
};

export type GameConfigData = {
  version: number;
  cosmetics: CosmeticRuleConfig[];
  pacing: PacingConfig;
  economy: EconomyConfig;
  arcade: ArcadeConfig;
  odds: OddsConfig;
  buffs: BuffDraftConfig;
};

export const DEFAULT_PACING_CONFIG: PacingConfig = {
  standardStartHp: 100,
  duelStartHp: 150,
  duelDamageScale: 0.65,
  drawDamageRatio: 0.5,
  startGold: 5,
  roundBaseIncome: 5,
  baseInterestCap: 4,
  shopRefreshCost: 2,
  xpPerRound: 3,
  xpBuyCost: 4,
  xpBuyAmount: 4,
  winStreakCap: 4,
  lossBountyPerLossCap: 4,
  lossBountyBankCap: 15,
  damageStages: [
    { id: 'early', label: '前期保护期', maxRound: 4, baseDamage: 2, perSurvivor: 1, survivorCap: 3, extraPerRound: 0 },
    { id: 'mid', label: '中期成型期', maxRound: 8, baseDamage: 5, perSurvivor: 1, survivorCap: 5, extraPerRound: 0 },
    { id: 'late', label: '后期淘汰期', maxRound: 12, baseDamage: 9, perSurvivor: 1.5, survivorCap: 7, extraPerRound: 0 },
    { id: 'overtime', label: '决胜清场期', maxRound: 99, baseDamage: 14, perSurvivor: 2, survivorCap: 10, extraPerRound: 2 },
  ],
};

export const DEFAULT_COSMETIC_RULES: readonly CosmeticRuleConfig[] = [
  // 第一梯队：玫瑰古堡、紫藤、仙境、星夜
  { id: 'skin-rose-court', tier: 't1', acquisition: 'shop', humanPrice: 180, botPrice: 1800, sortOrder: 10 },
  { id: 'skin-wisteria-brook', tier: 't1', acquisition: 'shop', humanPrice: 180, botPrice: 1800, sortOrder: 20 },
  { id: 'skin-wonderland-rabbit', tier: 't1', acquisition: 'shop', humanPrice: 180, botPrice: 1800, sortOrder: 30 },
  { id: 'skin-carousel-night', tier: 't1', acquisition: 'shop', humanPrice: 180, botPrice: 1800, sortOrder: 40 },
  // 第二梯队：复苏季节（初始默认 · 仅展示不售不赠）、荷塘、珠贝、绣线
  { id: 'skin-revival', tier: 't2', acquisition: 'default', humanPrice: 0, botPrice: 0, sortOrder: 110 },
  { id: 'skin-lotus-pond', tier: 't2', acquisition: 'shop', humanPrice: 108, botPrice: 1080, sortOrder: 120 },
  { id: 'skin-coral-lagoon', tier: 't2', acquisition: 'shop', humanPrice: 108, botPrice: 1080, sortOrder: 130 },
  { id: 'skin-embroidery-hoop', tier: 't2', acquisition: 'shop', humanPrice: 108, botPrice: 1080, sortOrder: 140 },
  // 第三梯队：时间星盘、异色（+ 竹影潭）
  { id: 'skin-time-astrolabe-ivory', tier: 't3', acquisition: 'shop', humanPrice: 52, botPrice: 520, sortOrder: 210 },
  { id: 'skin-time-astrolabe', tier: 't3', acquisition: 'shop', humanPrice: 52, botPrice: 520, sortOrder: 220 },
  { id: 'skin-bamboo', tier: 't3', acquisition: 'shop', humanPrice: 52, botPrice: 520, sortOrder: 230 },
  // 头像框
  { id: 'frame-vernal-peach', tier: 'frame', acquisition: 'shop', humanPrice: 52, botPrice: 520, sortOrder: 310 },
  { id: 'frame-nocturne-peach', tier: 'frame', acquisition: 'shop', humanPrice: 52, botPrice: 520, sortOrder: 320 },
  { id: 'frame-lotus-koi', tier: 'frame', acquisition: 'shop', humanPrice: 52, botPrice: 520, sortOrder: 330 },
  { id: 'frame-revival-olive', tier: 'frame', acquisition: 'arcade', humanPrice: 0, botPrice: 0, sortOrder: 340 },
  { id: 'frame-revival-ivy', tier: 'frame', acquisition: 'arcade', humanPrice: 0, botPrice: 0, sortOrder: 350 },
  // 典藏绝版（保留给试穿沙盒与老档案）
  { id: 'skin-taohua', tier: 'retired', acquisition: 'retired', humanPrice: 0, botPrice: 0, sortOrder: 901 },
  { id: 'skin-moonpool', tier: 'retired', acquisition: 'retired', humanPrice: 52, botPrice: 520, sortOrder: 902 },
  { id: 'skin-lantern', tier: 'retired', acquisition: 'retired', humanPrice: 52, botPrice: 520, sortOrder: 903 },
  { id: 'skin-frost', tier: 'retired', acquisition: 'retired', humanPrice: 52, botPrice: 520, sortOrder: 904 },
  { id: 'skin-ember', tier: 'retired', acquisition: 'retired', humanPrice: 52, botPrice: 520, sortOrder: 905 },
  { id: 'skin-bloodnight', tier: 'retired', acquisition: 'retired', humanPrice: 52, botPrice: 520, sortOrder: 906 },
  { id: 'frame-ring', tier: 'retired', acquisition: 'retired', humanPrice: 0, botPrice: 0, sortOrder: 911 },
  { id: 'frame-peach', tier: 'retired', acquisition: 'retired', humanPrice: 40, botPrice: 400, sortOrder: 912 },
  { id: 'frame-jade', tier: 'retired', acquisition: 'retired', humanPrice: 90, botPrice: 900, sortOrder: 913 },
  { id: 'frame-crown', tier: 'retired', acquisition: 'retired', humanPrice: 200, botPrice: 2000, sortOrder: 914 },
];

export const DEFAULT_GAME_CONFIG: GameConfigData = {
  version: 1,
  cosmetics: DEFAULT_COSMETIC_RULES.map(entry => ({ ...entry })),
  pacing: structuredClone(DEFAULT_PACING_CONFIG),
  economy: {
    exchangeBotPerHuman: 10,
    matchmakingWinMultiplier: 1.5,
    matchmakingLossMultiplier: 1.25,
    matchmakingDuelLoss: 250,
    legacyPlayReward: 4,
    legacyWinReward: 6,
    companionMinRounds: 3,
    companionHumanWin: 36,
    companionHumanDraw: 28,
    companionHumanLoss: 26,
    companionBotWin: 360,
    companionBotDraw: 280,
    companionBotLoss: 260,
    companionWinTickets: 1,
    companionDailyCap: 6,
    travelMinRounds: 3,
    travelWinnerFirst: 260,
    travelWinnerLast: 80,
    travelLoserFirst: -50,
    travelLoserLast: -200,
    travelWinTickets: 2,
    travelDailyCap: 0,
    feedbackRewardBot: 100,
    feedbackWeeklyCap: 3,
    feedbackCompensationMax: 10000,
  },
  arcade: {
    starterTickets: 5,
    ticketHumanPrice: 8,
    ticketBotPrice: 80,
    maxTickets: 200,
    maxPackCount: 100,
    reliefTickets: 2,
    reliefDailyLimit: 5,
    gambleWinProbability: 0.48,
    gambleMultiplier: 2,
    gambleMaxDoubles: 3,
    stakes: [
      { id: 'small', label: '小试一局', badge: '1×', ticketCost: 1, humanCost: 8, botCost: 80, cosmeticRateBoost: 1 },
      { id: 'medium', label: '加注狂飙', badge: '3×', ticketCost: 3, humanCost: 24, botCost: 240, cosmeticRateBoost: 2.2 },
      { id: 'high', label: '豪掷千金', badge: '7.5×', ticketCost: 8, humanCost: 60, botCost: 600, cosmeticRateBoost: 4.0 },
    ],
    drops: [
      { prizeId: 'olive', weight: 50 },
      { prizeId: 'ivy', weight: 50 },
    ],
  },
  odds: {
    slotSymbols: [
      { id: 'coin', name: '赤铜钱', glyph: '🪙', weight: 28 },
      { id: 'clover', name: '四叶草', glyph: '🍀', weight: 24 },
      { id: 'star', name: '星徽', glyph: '✦', weight: 20 },
      { id: 'seven', name: '幸运7', glyph: '7', weight: 12 },
      { id: 'bomb', name: '哑火雷', glyph: '💣', weight: 8 },
      { id: 'skull', name: '空骷髅', glyph: '💀', weight: 8 },
    ],
    slotPayouts: {
      seven3: 30,
      star3: 15,
      clover3: 8,
      coin3: 4.5,
      seven2: 3,
      star2: 2,
      clover2: 1.4,
      coin2: 1.2,
      seven3Chance: 1.0,
      star3Chance: 0.45,
      clover3Chance: 0.18,
      coin3Chance: 0.08,
      seven2Chance: 0.04,
    },
    scratchTiers: [
      { id: 'bust', name: '谢谢惠顾', weight: 635, multiplier: 0, cosmeticBaseChance: 0, label: '银膜刮尽，差一格就能对上幸运符！' },
      { id: 'small', name: '单幸运符', weight: 220, multiplier: 1.5, cosmeticBaseChance: 0, label: '刮中一格幸运符，小赚 1.5×！' },
      { id: 'double', name: '双幸运符', weight: 90, multiplier: 2.5, cosmeticBaseChance: 0, label: '双符齐鸣 · 入账 2.5×！' },
      { id: 'crit', name: '幸运符+×2倍签', weight: 38, multiplier: 5, cosmeticBaseChance: 0.12, label: '刮出金字「×2」加倍签 · 5×！' },
      { id: 'mega', name: '三星齐中红榜', weight: 12, multiplier: 10, cosmeticBaseChance: 0.45, label: '三星齐中红榜 · 10× 暴富！' },
      { id: 'jackpot', name: '满堂彩头彩', weight: 5, multiplier: 20, cosmeticBaseChance: 1.0, label: '特等彩券「满堂彩」· 20× + 限定外观！' },
    ],
  },
  buffs: structuredClone(DEFAULT_BUFF_DRAFT_CONFIG),
};

let activeConfig: GameConfigData = structuredClone(DEFAULT_GAME_CONFIG);
const configListeners = new Set<(config: GameConfigData) => void>();

export function getGameConfig(): GameConfigData {
  return activeConfig;
}

export function onGameConfigChange(listener: (config: GameConfigData) => void): () => void {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}

export function setRuntimeGameConfig(next: GameConfigData): GameConfigData {
  activeConfig = structuredClone(next);
  for (const listener of configListeners) {
    listener(activeConfig);
  }
  return activeConfig;
}

export function resolveDamageStage(
  round: number,
  stages: readonly DamageStageRule[] = activeConfig.pacing.damageStages,
): { rule: DamageStageRule; prevMaxRound: number } {
  const safeRound = Math.max(1, Math.trunc(round) || 1);
  let prevMaxRound = 0;
  for (const rule of stages) {
    if (safeRound <= rule.maxRound) return { rule, prevMaxRound };
    prevMaxRound = rule.maxRound;
  }
  const fallback = stages[stages.length - 1] ?? DEFAULT_PACING_CONFIG.damageStages[3]!;
  const beforeLast = stages.length >= 2 ? stages[stages.length - 2]!.maxRound : 0;
  return { rule: fallback, prevMaxRound: beforeLast };
}

export function computeStageBaseDamage(
  round: number,
  cfg: PacingConfig = activeConfig.pacing,
): number {
  const safeRound = Math.max(1, Math.trunc(round) || 1);
  const { rule, prevMaxRound } = resolveDamageStage(safeRound, cfg.damageStages);
  const roundsIntoStage = Math.max(0, safeRound - prevMaxRound - 1);
  return rule.baseDamage + rule.extraPerRound * roundsIntoStage;
}

export function computeDefeatDamage(
  round: number,
  survivors: number,
  scale = 1,
  cfg: PacingConfig = activeConfig.pacing,
): number {
  const { rule } = resolveDamageStage(round, cfg.damageStages);
  const base = computeStageBaseDamage(round, cfg);
  const survivorBonus = Math.min(rule.survivorCap, Math.max(0, survivors) * rule.perSurvivor);
  return Math.max(1, Math.round((base + survivorBonus) * scale));
}

export function computeDrawDamage(
  round: number,
  scale = 1,
  cfg: PacingConfig = activeConfig.pacing,
): number {
  if (cfg.drawDamageRatio <= 0 || scale <= 0) return 0;
  const base = computeStageBaseDamage(round, cfg);
  return Math.max(1, Math.round(base * cfg.drawDamageRatio * scale));
}

function asNonNegInt(value: unknown, field: string, max = 1_000_000): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < 0 || num > max) {
    throw new Error(`${field} 须为 0 ~ ${max} 的整数`);
  }
  return num;
}

function asPosInt(value: unknown, field: string, min = 1, max = 1_000_000): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < min || num > max) {
    throw new Error(`${field} 须为 ${min} ~ ${max} 的整数`);
  }
  return num;
}

function asSignedInt(value: unknown, field: string, min = -100_000, max = 100_000): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < min || num > max) {
    throw new Error(`${field} 须为 ${min} ~ ${max} 的整数`);
  }
  return num;
}

function asFloat(value: unknown, field: string, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new Error(`${field} 须为 ${min} ~ ${max} 的有效数值`);
  }
  return num;
}

function asLabel(value: unknown, field: string, maxLen = 64): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLen) {
    throw new Error(`${field} 不能为空且不超过 ${maxLen} 字`);
  }
  return text;
}

export function validateGameConfig(raw: unknown): GameConfigData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('配置结构无效');
  }
  const input = raw as Partial<GameConfigData>;
  const defaults = DEFAULT_GAME_CONFIG;

  const baseCosmetics = new Map(defaults.cosmetics.map(entry => [entry.id, entry]));
  const rawCosmetics = Array.isArray(input.cosmetics) ? input.cosmetics : defaults.cosmetics;
  const seenIds = new Set<string>();
  const cosmetics: CosmeticRuleConfig[] = [];
  for (const item of rawCosmetics) {
    if (!item || typeof item !== 'object') throw new Error('外观配置项格式错误');
    const id = String(item.id ?? '');
    const fallback = baseCosmetics.get(id);
    if (!fallback || seenIds.has(id)) continue;
    seenIds.add(id);
    const tier = item.tier;
    if (!tier || !(tier in COSMETIC_TIER_META)) throw new Error(`外观 ${id} 梯队无效`);
    const acquisition = item.acquisition;
    if (acquisition !== 'shop' && acquisition !== 'arcade' && acquisition !== 'default' && acquisition !== 'retired') {
      throw new Error(`外观 ${id} 获取方式无效`);
    }
    cosmetics.push({
      id,
      tier,
      acquisition,
      humanPrice: asNonNegInt(item.humanPrice, `${id} 铜钱价格`),
      botPrice: asNonNegInt(item.botPrice, `${id} 机芯价格`),
      sortOrder: asNonNegInt(item.sortOrder ?? fallback.sortOrder, `${id} 排序`, 10_000),
    });
  }
  for (const fallback of defaults.cosmetics) {
    if (!seenIds.has(fallback.id)) cosmetics.push({ ...fallback });
  }
  cosmetics.sort((a, b) => COSMETIC_TIER_META[a.tier].rank - COSMETIC_TIER_META[b.tier].rank || a.sortOrder - b.sortOrder);

  const eRaw = (input.economy ?? defaults.economy) as Partial<EconomyConfig>;
  const economy: EconomyConfig = {
    exchangeBotPerHuman: asPosInt(eRaw.exchangeBotPerHuman ?? defaults.economy.exchangeBotPerHuman, '铜钱兑机芯倍率', 1, 1000),
    matchmakingWinMultiplier: asFloat(eRaw.matchmakingWinMultiplier ?? defaults.economy.matchmakingWinMultiplier, '匹配胜场倍率', 0.1, 10),
    matchmakingLossMultiplier: asFloat(eRaw.matchmakingLossMultiplier ?? defaults.economy.matchmakingLossMultiplier, '匹配负场倍率', 0.1, 10),
    matchmakingDuelLoss: asPosInt(eRaw.matchmakingDuelLoss ?? defaults.economy.matchmakingDuelLoss, '匹配对决参考扣分', 1, 100_000),
    legacyPlayReward: asNonNegInt(eRaw.legacyPlayReward ?? defaults.economy.legacyPlayReward, '出场预览奖励', 10_000),
    legacyWinReward: asNonNegInt(eRaw.legacyWinReward ?? defaults.economy.legacyWinReward, '胜场预览奖励', 10_000),
    companionMinRounds: asPosInt(eRaw.companionMinRounds ?? defaults.economy.companionMinRounds, '陪伴局最小回合', 1, 30),
    companionHumanWin: asNonNegInt(eRaw.companionHumanWin ?? defaults.economy.companionHumanWin, '陪伴局人类胜铜钱'),
    companionHumanDraw: asNonNegInt(eRaw.companionHumanDraw ?? defaults.economy.companionHumanDraw, '陪伴局人类平铜钱'),
    companionHumanLoss: asNonNegInt(eRaw.companionHumanLoss ?? defaults.economy.companionHumanLoss, '陪伴局人类负铜钱'),
    companionBotWin: asNonNegInt(eRaw.companionBotWin ?? defaults.economy.companionBotWin, '陪伴局机胜机芯'),
    companionBotDraw: asNonNegInt(eRaw.companionBotDraw ?? defaults.economy.companionBotDraw, '陪伴局机平机芯'),
    companionBotLoss: asNonNegInt(eRaw.companionBotLoss ?? defaults.economy.companionBotLoss, '陪伴局机负机芯'),
    companionWinTickets: asNonNegInt(eRaw.companionWinTickets ?? defaults.economy.companionWinTickets, '陪伴局胜场掉券', 50),
    companionDailyCap: asNonNegInt(eRaw.companionDailyCap ?? defaults.economy.companionDailyCap, '陪伴局每日名额上限', 200),
    travelMinRounds: asPosInt(eRaw.travelMinRounds ?? defaults.economy.travelMinRounds, '远游局最小回合', 1, 30),
    travelWinnerFirst: asSignedInt(eRaw.travelWinnerFirst ?? defaults.economy.travelWinnerFirst, '远游局榜首奖励'),
    travelWinnerLast: asSignedInt(eRaw.travelWinnerLast ?? defaults.economy.travelWinnerLast, '远游局胜圈末位奖励'),
    travelLoserFirst: asSignedInt(eRaw.travelLoserFirst ?? defaults.economy.travelLoserFirst, '远游局败圈首位结算'),
    travelLoserLast: asSignedInt(eRaw.travelLoserLast ?? defaults.economy.travelLoserLast, '远游局榜尾结算'),
    travelWinTickets: asNonNegInt(eRaw.travelWinTickets ?? defaults.economy.travelWinTickets, '远游局胜场掉券', 50),
    travelDailyCap: asNonNegInt(eRaw.travelDailyCap ?? defaults.economy.travelDailyCap, '远游局每日上限', 200),
    feedbackRewardBot: asNonNegInt(eRaw.feedbackRewardBot ?? defaults.economy.feedbackRewardBot, '反馈奖赏机芯'),
    feedbackWeeklyCap: asNonNegInt(eRaw.feedbackWeeklyCap ?? defaults.economy.feedbackWeeklyCap, '每周反馈奖赏上限', 50),
    feedbackCompensationMax: asNonNegInt(eRaw.feedbackCompensationMax ?? defaults.economy.feedbackCompensationMax, '反馈单笔补偿上限'),
  };

  const aRaw = (input.arcade ?? defaults.arcade) as Partial<ArcadeConfig>;
  const stakeDefaults = new Map(defaults.arcade.stakes.map(s => [s.id, s]));
  const rawStakes = Array.isArray(aRaw.stakes) ? aRaw.stakes : defaults.arcade.stakes;
  const stakes: ArcadeStakeConfig[] = defaults.arcade.stakes.map(fallback => {
    const found = rawStakes.find(s => s?.id === fallback.id) ?? fallback;
    const def = stakeDefaults.get(fallback.id)!;
    return {
      id: def.id,
      label: asLabel(found.label ?? def.label, `${def.id} 档位名称`, 16),
      badge: asLabel(found.badge ?? def.badge, `${def.id} 角标`, 12),
      ticketCost: asPosInt(found.ticketCost ?? def.ticketCost, `${def.label} 游乐券消耗`, 1, 200),
      humanCost: asPosInt(found.humanCost ?? def.humanCost, `${def.label} 铜钱消耗`, 1, 100_000),
      botCost: asPosInt(found.botCost ?? def.botCost, `${def.label} 机芯消耗`, 1, 1_000_000),
      cosmeticRateBoost: asFloat(found.cosmeticRateBoost ?? def.cosmeticRateBoost, `${def.label} 外观掉率倍率`, 0.1, 20),
    };
  });

  const rawDrops = Array.isArray(aRaw.drops) && aRaw.drops.length ? aRaw.drops : defaults.arcade.drops;
  const drops: ArcadeDropWeightConfig[] = rawDrops.map(d => ({
    prizeId: asLabel(d.prizeId, '奖池外观编号', 32),
    weight: asPosInt(d.weight, `奖池 ${d.prizeId} 权重`, 1, 100_000),
  }));

  const arcade: ArcadeConfig = {
    starterTickets: asNonNegInt(aRaw.starterTickets ?? defaults.arcade.starterTickets, '迎新试玩券', 100),
    ticketHumanPrice: asPosInt(aRaw.ticketHumanPrice ?? defaults.arcade.ticketHumanPrice, '单张游乐券铜钱价', 1, 10_000),
    ticketBotPrice: asPosInt(aRaw.ticketBotPrice ?? defaults.arcade.ticketBotPrice, '单张游乐券机芯价', 1, 100_000),
    maxTickets: asPosInt(aRaw.maxTickets ?? defaults.arcade.maxTickets, '游乐券持有上限', 5, 10_000),
    maxPackCount: asPosInt(aRaw.maxPackCount ?? defaults.arcade.maxPackCount, '单次购券上限', 1, 1000),
    reliefTickets: asNonNegInt(aRaw.reliefTickets ?? defaults.arcade.reliefTickets, '低保单次发券', 50),
    reliefDailyLimit: asNonNegInt(aRaw.reliefDailyLimit ?? defaults.arcade.reliefDailyLimit, '每日低保次数上限', 50),
    gambleWinProbability: asFloat(aRaw.gambleWinProbability ?? defaults.arcade.gambleWinProbability, '搏倍胜率', 0.05, 0.95),
    gambleMultiplier: asPosInt(aRaw.gambleMultiplier ?? defaults.arcade.gambleMultiplier, '搏倍倍数', 2, 10),
    gambleMaxDoubles: asPosInt(aRaw.gambleMaxDoubles ?? defaults.arcade.gambleMaxDoubles, '最大连搏次数', 1, 10),
    stakes,
    drops,
  };

  const oRaw = (input.odds ?? defaults.odds) as Partial<OddsConfig>;
  const rawSlotSymbols = Array.isArray(oRaw.slotSymbols) ? oRaw.slotSymbols : defaults.odds.slotSymbols;
  const slotSymbols: SlotSymbolWeightConfig[] = defaults.odds.slotSymbols.map(fallback => {
    const found = rawSlotSymbols.find(s => s?.id === fallback.id) ?? fallback;
    return {
      id: fallback.id,
      name: asLabel(found.name ?? fallback.name, `${fallback.id} 名称`, 16),
      glyph: fallback.glyph,
      weight: asPosInt(found.weight ?? fallback.weight, `老虎机「${fallback.name}」权重`, 1, 100_000),
    };
  });

  const spRaw = (oRaw.slotPayouts ?? defaults.odds.slotPayouts) as Partial<SlotPayoutConfig>;
  const spDef = defaults.odds.slotPayouts;
  const slotPayouts: SlotPayoutConfig = {
    seven3: asFloat(spRaw.seven3 ?? spDef.seven3, '777 三连倍率', 0, 500),
    star3: asFloat(spRaw.star3 ?? spDef.star3, '三星连珠倍率', 0, 500),
    clover3: asFloat(spRaw.clover3 ?? spDef.clover3, '三叶草连线倍率', 0, 500),
    coin3: asFloat(spRaw.coin3 ?? spDef.coin3, '三铜钱连线倍率', 0, 500),
    seven2: asFloat(spRaw.seven2 ?? spDef.seven2, '双7倍率', 0, 100),
    star2: asFloat(spRaw.star2 ?? spDef.star2, '双星倍率', 0, 100),
    clover2: asFloat(spRaw.clover2 ?? spDef.clover2, '双叶草倍率', 0, 100),
    coin2: asFloat(spRaw.coin2 ?? spDef.coin2, '双铜钱倍率', 0, 100),
    seven3Chance: asFloat(spRaw.seven3Chance ?? spDef.seven3Chance, '777 外观掉率', 0, 1),
    star3Chance: asFloat(spRaw.star3Chance ?? spDef.star3Chance, '三星外观掉率', 0, 1),
    clover3Chance: asFloat(spRaw.clover3Chance ?? spDef.clover3Chance, '三叶草外观掉率', 0, 1),
    coin3Chance: asFloat(spRaw.coin3Chance ?? spDef.coin3Chance, '三铜钱外观掉率', 0, 1),
    seven2Chance: asFloat(spRaw.seven2Chance ?? spDef.seven2Chance, '双7外观掉率', 0, 1),
  };

  const rawScratchTiers = Array.isArray(oRaw.scratchTiers) ? oRaw.scratchTiers : defaults.odds.scratchTiers;
  const scratchTiers: ScratchTierConfig[] = defaults.odds.scratchTiers.map(fallback => {
    const found = rawScratchTiers.find(t => t?.id === fallback.id) ?? fallback;
    return {
      id: fallback.id,
      name: asLabel(found.name ?? fallback.name, `${fallback.id} 档名`, 24),
      weight: asPosInt(found.weight ?? fallback.weight, `刮刮乐「${fallback.name}」权重`, 1, 100_000),
      multiplier: fallback.id === 'bust' ? 0 : asFloat(found.multiplier ?? fallback.multiplier, `刮刮乐「${fallback.name}」倍率`, 0, 500),
      cosmeticBaseChance: asFloat(found.cosmeticBaseChance ?? fallback.cosmeticBaseChance, `刮刮乐「${fallback.name}」基础掉率`, 0, 1),
      label: asLabel(found.label ?? fallback.label, `刮刮乐「${fallback.name}」文案`, 80),
    };
  });

  const buffs = validateBuffDraftConfig(input.buffs, defaults.buffs);
  const pacing = validatePacingConfig(input.pacing, defaults.pacing);

  return {
    version: 1,
    cosmetics,
    pacing,
    economy,
    arcade,
    odds: { slotSymbols, slotPayouts, scratchTiers },
    buffs,
  };
}

function validatePacingConfig(raw: unknown, fallback: PacingConfig): PacingConfig {
  const src = (raw && typeof raw === 'object' ? raw : fallback) as Partial<PacingConfig>;
  const stageDefaults = new Map(fallback.damageStages.map(stage => [stage.id, stage]));
  const rawStages = Array.isArray(src.damageStages) ? src.damageStages : fallback.damageStages;
  const stageOrder: DamageStageId[] = ['early', 'mid', 'late', 'overtime'];
  const damageStages: DamageStageRule[] = stageOrder.map(id => {
    const def = stageDefaults.get(id)!;
    const found = rawStages.find(item => item && item.id === id) ?? def;
    return {
      id,
      label: asLabel(found.label ?? def.label, `${def.label} 名称`, 24),
      maxRound: asPosInt(found.maxRound ?? def.maxRound, `${def.label} 截至回合`, 1, 999),
      baseDamage: asNonNegInt(found.baseDamage ?? def.baseDamage, `${def.label} 基础底伤`, 100),
      perSurvivor: asFloat(found.perSurvivor ?? def.perSurvivor, `${def.label} 每存活附加`, 0, 20),
      survivorCap: asNonNegInt(found.survivorCap ?? def.survivorCap, `${def.label} 存活附加封顶`, 50),
      extraPerRound: asNonNegInt(found.extraPerRound ?? def.extraPerRound, `${def.label} 每轮额外递增`, 20),
    };
  });
  for (let i = 1; i < damageStages.length; i += 1) {
    if (damageStages[i]!.maxRound <= damageStages[i - 1]!.maxRound) {
      throw new Error(`扣血阶段「${damageStages[i]!.label}」截至回合必须大于「${damageStages[i - 1]!.label}」`);
    }
  }

  return {
    standardStartHp: asPosInt(src.standardStartHp ?? fallback.standardStartHp, '多人局初始血量', 20, 500),
    duelStartHp: asPosInt(src.duelStartHp ?? fallback.duelStartHp, '弈决 1v1 初始血量', 20, 500),
    duelDamageScale: asFloat(src.duelDamageScale ?? fallback.duelDamageScale, '弈决 1v1 扣血系数', 0.1, 3),
    drawDamageRatio: asFloat(src.drawDamageRatio ?? fallback.drawDamageRatio, '平局底伤折算比例', 0, 2),
    startGold: asNonNegInt(src.startGold ?? fallback.startGold, '开局初始金币', 100),
    roundBaseIncome: asNonNegInt(src.roundBaseIncome ?? fallback.roundBaseIncome, '每轮基础工资', 50),
    baseInterestCap: asNonNegInt(src.baseInterestCap ?? fallback.baseInterestCap, '默认利息上限', 30),
    shopRefreshCost: asNonNegInt(src.shopRefreshCost ?? fallback.shopRefreshCost, '商店单次刷新花费', 20),
    xpPerRound: asNonNegInt(src.xpPerRound ?? fallback.xpPerRound, '每轮自然经验', 20),
    xpBuyCost: asPosInt(src.xpBuyCost ?? fallback.xpBuyCost, '买经验金币单价', 1, 30),
    xpBuyAmount: asPosInt(src.xpBuyAmount ?? fallback.xpBuyAmount, '单次买经验点数', 1, 30),
    winStreakCap: asNonNegInt(src.winStreakCap ?? fallback.winStreakCap, '连胜额外金币上限', 20),
    lossBountyPerLossCap: asNonNegInt(src.lossBountyPerLossCap ?? fallback.lossBountyPerLossCap, '单败赏金累加上限', 20),
    lossBountyBankCap: asNonNegInt(src.lossBountyBankCap ?? fallback.lossBountyBankCap, '连败赏金池总上限', 100),
    damageStages,
  };
}

function validateRoundsList(raw: unknown, fallback: number[], label: string): number[] {
  const list = Array.isArray(raw) ? raw : fallback;
  if (list.length > 20) throw new Error(`${label} 最多配置 20 个回合`);
  const parsed = list.map((v, i) => asPosInt(v, `${label}[${i}]`, 1, 40));
  return [...new Set(parsed)].sort((a, b) => a - b);
}

function validateStageWeights(raw: unknown, fallback: BuffStageWeights, label: string): BuffStageWeights {
  const src = (raw && typeof raw === 'object' ? raw : fallback) as Partial<BuffStageWeights>;
  const common = asNonNegInt(src.common ?? fallback.common, `${label} 普通权重`, 10_000);
  const rare = asNonNegInt(src.rare ?? fallback.rare, `${label} 稀世权重`, 10_000);
  const legendary = asNonNegInt(src.legendary ?? fallback.legendary, `${label} 传说权重`, 10_000);
  if (common + rare + legendary <= 0) throw new Error(`${label} 的品阶权重之和必须大于 0`);
  return { common, rare, legendary };
}

function validatePackCopy(raw: unknown, fallback: BuffPackCopy | undefined, label: string): BuffPackCopy | undefined {
  if (!fallback && !raw) return undefined;
  const base = fallback ?? { name: label, desc: '' };
  const src = (raw && typeof raw === 'object' ? raw : base) as Partial<BuffPackCopy>;
  return {
    name: asLabel(src.name ?? base.name, `${label} 名称`, 40),
    desc: asLabel(src.desc ?? base.desc, `${label} 描述模板`, 220),
  };
}

function validateBuffDraftConfig(raw: unknown, fallback: BuffDraftConfig): BuffDraftConfig {
  const src = (raw && typeof raw === 'object' ? raw : fallback) as Partial<BuffDraftConfig>;
  const enabled = typeof src.enabled === 'boolean' ? src.enabled : fallback.enabled;
  const buffRounds = validateRoundsList(src.buffRounds, fallback.buffRounds, '选秀触发回合');
  const supplyRounds = validateRoundsList(src.supplyRounds, fallback.supplyRounds, '装备补给回合');
  const rawCosts = Array.isArray(src.rerollCosts) ? src.rerollCosts : fallback.rerollCosts;
  if (rawCosts.length > 5) throw new Error('单轮重投次数上限最多配置 5 次');
  const rerollCosts = rawCosts.map((c, idx) => asNonNegInt(c, `第 ${idx + 1} 次重投费用`, 50));

  const swRaw = (src.stageWeights ?? fallback.stageWeights) as Partial<BuffDraftConfig['stageWeights']>;
  const stageWeights = {
    stage1: validateStageWeights(swRaw.stage1, fallback.stageWeights.stage1, '前期阶段权重'),
    stage2: validateStageWeights(swRaw.stage2, fallback.stageWeights.stage2, '中期阶段权重'),
    stage3: validateStageWeights(swRaw.stage3, fallback.stageWeights.stage3, '后期阶段权重'),
  };

  const fallbackById = new Map(fallback.items.map((item) => [item.id, item]));
  const rawItems = Array.isArray(src.items) ? src.items : fallback.items;
  const rawById = new Map<string, Partial<BuffRuleConfig>>();
  for (const item of rawItems) {
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      rawById.set(item.id, item);
    }
  }

  const items: BuffRuleConfig[] = BUFF_ARCHETYPES.map((arch) => {
    const def = fallbackById.get(arch.id)!;
    const found = rawById.get(arch.id);
    const rarity: BuffRarityId =
      found?.rarity === 'common' || found?.rarity === 'rare' || found?.rarity === 'legendary'
        ? found.rarity
        : def.rarity;
    const category: BuffCategoryId =
      found?.category === 'economy' || found?.category === 'combat' || found?.category === 'artifact'
        ? found.category
        : def.category;
    const rawStages = Array.isArray(found?.stages) ? found.stages : def.stages;
    const stages = [...new Set(rawStages.filter((s): s is BuffStageId => s === 1 || s === 2 || s === 3))].sort(
      (a, b) => a - b,
    );
    if (!stages.length) throw new Error(`Buff「${arch.id}」至少须勾选一个出现阶段（早/中/后）`);

    const params: Record<string, number> = {};
    const foundParams = (found?.params && typeof found.params === 'object' ? found.params : {}) as Record<string, unknown>;
    for (const spec of arch.params) {
      const val = foundParams[spec.key] ?? def.params[spec.key] ?? spec.defaultValue;
      params[spec.key] = spec.step && spec.step < 1
        ? asFloat(val, `${arch.id}.${spec.label}`, spec.min, spec.max)
        : asSignedInt(val, `${arch.id}.${spec.label}`, spec.min, spec.max);
    }

    const foundCopy = (found?.copy && typeof found.copy === 'object' ? found.copy : {}) as Partial<BuffRuleConfig['copy']>;
    const copy: BuffRuleConfig['copy'] = {
      ...(def.copy.ai ? { ai: validatePackCopy(foundCopy.ai, def.copy.ai, `${arch.id}(AI)`) } : {}),
      ...(def.copy.jianghu ? { jianghu: validatePackCopy(foundCopy.jianghu, def.copy.jianghu, `${arch.id}(夜航船)`) } : {}),
    };

    return {
      id: arch.id,
      scope: arch.scope,
      enabled: typeof found?.enabled === 'boolean' ? found.enabled : def.enabled,
      rarity,
      category,
      stages,
      weight: asPosInt(found?.weight ?? def.weight, `Buff「${arch.id}」权重`, 1, 10_000),
      params,
      copy,
    };
  });

  return { enabled, buffRounds, supplyRounds, rerollCosts, stageWeights, items };
}

export function normalizeGameConfig(raw?: unknown): GameConfigData {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_GAME_CONFIG);
  try {
    return validateGameConfig(raw);
  } catch {
    return structuredClone(DEFAULT_GAME_CONFIG);
  }
}

