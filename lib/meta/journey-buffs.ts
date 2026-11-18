/**
 * 旅途选秀 · 三选一奇遇 Buff（同构纯模块：引擎编译 + 后台配置 + 双包独立包装）。
 *
 * 设计原则：
 * - 单一机制骨架：每个词条用结构化效果（`HexDef`）与数值参数表驱动，彻底摆脱正则文本解析。
 * - 双包独立包装：`AI铲铲` 与 `夜航船` 拥有各自独立的名称与风味模板，动态插值 `{param}` 与热改完全同步。
 * - 全表可配置：触发回合、补给回合、重投花费阶梯、各阶段品阶权重、每条词条开关与参数均进 `GameConfigData`。
 */

import type { HexDef, HexRarity } from '../../content/autochess/types';
import { getEphemeralPack } from '../../packs/ephemeral-registry';
import { createRng, hash32, hashString } from '../autochess/rng';

export type BuffRarityId = 'common' | 'rare' | 'legendary';
export type BuffCategoryId = 'economy' | 'combat' | 'artifact';
export type BuffScopeId = 'shared' | 'ai' | 'jianghu';
export type BuffStageId = 1 | 2 | 3;

export type BuffPackCopy = {
  name: string;
  desc: string;
};

export type BuffParamSpec = {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
};

export type BuffRuleConfig = {
  id: string;
  scope: BuffScopeId;
  enabled: boolean;
  rarity: BuffRarityId;
  category: BuffCategoryId;
  stages: BuffStageId[];
  weight: number;
  params: Record<string, number>;
  copy: {
    ai?: BuffPackCopy;
    jianghu?: BuffPackCopy;
  };
};

export type BuffStageWeights = {
  common: number;
  rare: number;
  legendary: number;
};

export type BuffDraftConfig = {
  enabled: boolean;
  buffRounds: number[];
  supplyRounds: number[];
  rerollCosts: number[];
  stageWeights: {
    stage1: BuffStageWeights;
    stage2: BuffStageWeights;
    stage3: BuffStageWeights;
  };
  items: BuffRuleConfig[];
};

export type BuffOfferChoice = {
  id: string;
  name: string;
  rarity: HexRarity;
  rarityId: BuffRarityId;
  rarityLabel: string;
  category: BuffCategoryId;
  categoryLabel: string;
  note: string;
  gold?: number;
};

export const BUFF_RARITY_META: Record<
  BuffRarityId,
  { id: BuffRarityId; label: string; shortLabel: string; hexRarity: HexRarity; rank: number }
> = {
  common: { id: 'common', label: '普通奇遇', shortLabel: '普通', hexRarity: 'blue', rank: 1 },
  rare: { id: 'rare', label: '稀世奇遇', shortLabel: '稀世', hexRarity: 'purple', rank: 2 },
  legendary: { id: 'legendary', label: '传说奇遇', shortLabel: '传说', hexRarity: 'orange', rank: 3 },
};

export const BUFF_CATEGORY_META: Record<BuffCategoryId, { id: BuffCategoryId; label: string }> = {
  economy: { id: 'economy', label: '运营' },
  combat: { id: 'combat', label: '战力' },
  artifact: { id: 'artifact', label: '奇物' },
};

export const BUFF_STAGE_LABELS: Record<BuffStageId, string> = {
  1: '早',
  2: '中',
  3: '后',
};

export const BUFF_SCOPE_LABELS: Record<BuffScopeId, string> = {
  shared: '双包通用',
  ai: 'AI铲铲专属',
  jianghu: '夜航船专属',
};

export type BuffArchetype = {
  id: string;
  scope: BuffScopeId;
  defaultRarity: BuffRarityId;
  defaultCategory: BuffCategoryId;
  defaultStages: readonly BuffStageId[];
  defaultWeight: number;
  params: readonly BuffParamSpec[];
  defaultCopy: {
    ai?: BuffPackCopy;
    jianghu?: BuffPackCopy;
  };
  buildEffect: (params: Record<string, number>) => Partial<HexDef>;
};

const num = (params: Record<string, number>, key: string, fallback: number): number => {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export const BUFF_ARCHETYPES: readonly BuffArchetype[] = [
  // ── 普通 · 双包通用（7） ───────────────────────────────────
  {
    id: 'econ-seed',
    scope: 'shared',
    defaultRarity: 'common',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 1, max: 50, step: 1, defaultValue: 8 },
      { key: 'freeRolls', label: '本轮免费刷新', min: 0, max: 10, step: 1, defaultValue: 1 },
    ],
    defaultCopy: {
      ai: { name: '学生认证白嫖', desc: '薅一波教育优惠赠金：立即获得 {gold} Token，且本回合获赠 {freeRolls} 次免费重新生成。' },
      jianghu: { name: '启航盘缠', desc: '立即获得 {gold} 金，且本回合获赠 {freeRolls} 次免费刷新商店。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 8),
      immediateFreeRefreshes: num(p, 'freeRolls', 1),
    }),
  },
  {
    id: 'econ-reroll',
    scope: 'shared',
    defaultRarity: 'common',
    defaultCategory: 'economy',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 30, step: 1, defaultValue: 2 },
      { key: 'freePerRound', label: '每轮免费刷新', min: 1, max: 5, step: 1, defaultValue: 1 },
    ],
    defaultCopy: {
      ai: { name: '卡点领免费额度', desc: '每个对战回合前 {freePerRound} 次重新生成免费，立即获得 {gold} Token。' },
      jianghu: { name: '茶棚熟客', desc: '每个对战回合前 {freePerRound} 次刷新商店免费，立即获得 {gold} 金。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 2),
      freeRefreshesPerRound: num(p, 'freePerRound', 1),
    }),
  },
  {
    id: 'econ-xp',
    scope: 'shared',
    defaultRarity: 'common',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'xp', label: '即时经验', min: 1, max: 30, step: 1, defaultValue: 4 },
      { key: 'roundXp', label: '每轮额外经验', min: 1, max: 10, step: 1, defaultValue: 1 },
    ],
    defaultCopy: {
      ai: { name: '大杯蒸馏小杯', desc: '立即获得 {xp} 点训练进度；此后每回合自然经验额外 +{roundXp}。' },
      jianghu: { name: '顺水推舟', desc: '立即获得 {xp} 点经验；此后每回合自然经验额外 +{roundXp}。' },
    },
    buildEffect: (p) => ({
      immediateXp: num(p, 'xp', 4),
      roundXpBonus: num(p, 'roundXp', 1),
    }),
  },
  {
    id: 'combat-front',
    scope: 'shared',
    defaultRarity: 'common',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'defPct', label: '双抗加成(%)', min: 5, max: 80, step: 1, defaultValue: 18 },
      { key: 'hpPct', label: '气血加成(%)', min: 5, max: 80, step: 1, defaultValue: 10 },
    ],
    defaultCopy: {
      ai: { name: '焊死 System Prompt', desc: '先把人设钉死防崩：前两排模型双抗 +{defPct}%、最大气血 +{hpPct}%。' },
      jianghu: { name: '重甲护船', desc: '前两排友军双抗 +{defPct}%、最大气血 +{hpPct}%。' },
    },
    buildEffect: (p) => ({
      // 己方棋盘坐标系：`localRow` 2–3 为前两排，0–1 为后两排（见 grid.ts worldPos）。
      when: { rowMin: 2, rowMax: 3 },
      armorPct: num(p, 'defPct', 18),
      mrPct: num(p, 'defPct', 18),
      hpPct: num(p, 'hpPct', 10),
    }),
  },
  {
    id: 'combat-back',
    scope: 'shared',
    defaultRarity: 'common',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'aspdPct', label: '攻速加成(%)', min: 5, max: 80, step: 1, defaultValue: 15 },
      { key: 'dmgPct', label: '攻伤与技伤(%)', min: 5, max: 80, step: 1, defaultValue: 10 },
    ],
    defaultCopy: {
      ai: { name: '塞满百万上下文', desc: '设定集整本喂进去：后两排模型攻速 +{aspdPct}%、攻击与技能增伤 +{dmgPct}%。' },
      jianghu: { name: '后舱劲弩', desc: '后两排友军攻速 +{aspdPct}%、攻击与技能增伤 +{dmgPct}%。' },
    },
    buildEffect: (p) => ({
      when: { rowMin: 0, rowMax: 1 },
      aspdPct: num(p, 'aspdPct', 15),
      atkPct: num(p, 'dmgPct', 10),
      skillPct: num(p, 'dmgPct', 10),
    }),
  },
  {
    id: 'combat-lowcost',
    scope: 'shared',
    defaultRarity: 'common',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'hpPct', label: '气血加成(%)', min: 5, max: 80, step: 1, defaultValue: 18 },
      { key: 'aspdPct', label: '攻速加成(%)', min: 5, max: 80, step: 1, defaultValue: 18 },
    ],
    defaultCopy: {
      ai: { name: '本机显卡跑小杯', desc: '1–2 费轻量模型最大气血 +{hpPct}%、攻速 +{aspdPct}%。' },
      jianghu: { name: '市井好手', desc: '1–2 费友军最大气血 +{hpPct}%、攻速 +{aspdPct}%。' },
    },
    buildEffect: (p) => ({
      when: { costAtMost: 2 },
      hpPct: num(p, 'hpPct', 18),
      aspdPct: num(p, 'aspdPct', 18),
    }),
  },
  {
    id: 'art-basic-box',
    scope: 'shared',
    defaultRarity: 'common',
    defaultCategory: 'artifact',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [{ key: 'hpPct', label: '持装气血加成(%)', min: 0, max: 50, step: 1, defaultValue: 8 }],
    defaultCopy: {
      ai: { name: '群友互填邀请码', desc: '开启 1 个基础 AI 装备三选一匣；携带装备的模型气血 +{hpPct}%。' },
      jianghu: { name: '行囊百宝袋', desc: '开启 1 个基础装备三选一匣；携带装备的友军气血 +{hpPct}%。' },
    },
    buildEffect: (p) => ({
      itemBoxes: [{ family: 'white', options: 3, count: 1 }],
      when: { hasItems: true },
      hpPct: num(p, 'hpPct', 8),
    }),
  },

  // ── 普通 · AI铲铲专属（2） ─────────────────────────────────
  {
    id: 'ai-offpeak',
    scope: 'ai',
    defaultRarity: 'common',
    defaultCategory: 'economy',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [{ key: 'gold', label: '即时金币', min: 0, max: 30, step: 1, defaultValue: 4 }],
    defaultCopy: {
      ai: { name: '蹲凌晨错峰半价', desc: '专挑半夜波谷跑批：己方商店所有「错峰定价」永远锁定打折不再涨价，立得 {gold} Token。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 4),
      hazardModifiers: { forcePriceTrough: true },
    }),
  },
  {
    id: 'ai-grab-plan',
    scope: 'ai',
    defaultRarity: 'common',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 30, step: 1, defaultValue: 3 },
      { key: 'aspdPct', label: '编码/Agent攻速(%)', min: 0, max: 50, step: 1, defaultValue: 10 },
    ],
    defaultCopy: {
      ai: { name: '挂脚本抢 Coding Plan', desc: '商店「限量 Coding Plan」不再触发售罄；立得 {gold} Token，编码与智能体模型攻速 +{aspdPct}%。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 3),
      hazardModifiers: { ignoreSoldOut: true },
      when: { traitIn: ['coding', 'agent'] },
      aspdPct: num(p, 'aspdPct', 10),
    }),
  },

  // ── 普通 · 夜航船专属（2） ─────────────────────────────────
  {
    id: 'jh-link',
    scope: 'jianghu',
    defaultRarity: 'common',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'atkPct', label: '攻击加成(%)', min: 5, max: 60, step: 1, defaultValue: 12 },
      { key: 'drPct', label: '减伤(%)', min: 2, max: 35, step: 1, defaultValue: 8 },
    ],
    defaultCopy: {
      jianghu: { name: '并肩结阵', desc: '开战时相邻有友军的棋子，攻击 +{atkPct}%、减伤 +{drPct}%。' },
    },
    buildEffect: (p) => ({
      when: { adjacentAlliesAtLeast: 1 },
      atkPct: num(p, 'atkPct', 12),
      drPct: num(p, 'drPct', 8),
    }),
  },
  {
    id: 'jh-unarmed',
    scope: 'jianghu',
    defaultRarity: 'common',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'atkPct', label: '攻击加成(%)', min: 5, max: 60, step: 1, defaultValue: 18 },
      { key: 'aspdPct', label: '攻速加成(%)', min: 5, max: 60, step: 1, defaultValue: 15 },
    ],
    defaultCopy: {
      jianghu: { name: '赤手空拳', desc: '未携带装备的友军攻击 +{atkPct}%、攻速 +{aspdPct}%。' },
    },
    buildEffect: (p) => ({
      when: { noItems: true },
      atkPct: num(p, 'atkPct', 18),
      aspdPct: num(p, 'aspdPct', 15),
    }),
  },

  // ── 稀世 · 双包通用（6） ───────────────────────────────────
  {
    id: 'econ-hedge',
    scope: 'shared',
    defaultRarity: 'rare',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 40, step: 1, defaultValue: 6 },
      { key: 'interestCap', label: '利息上限', min: 4, max: 15, step: 1, defaultValue: 7 },
    ],
    defaultCopy: {
      ai: { name: '囤 Key 倒爷', desc: '低买高卖吃余热：立得 {gold} Token，利息上限提升至 {interestCap}（70 Token 吃满）。' },
      jianghu: { name: '钱庄利滚利', desc: '立即获得 {gold} 金，存款利息上限提升至 {interestCap}。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 6),
      interestCap: num(p, 'interestCap', 7),
    }),
  },
  {
    id: 'econ-stipend',
    scope: 'shared',
    defaultRarity: 'rare',
    defaultCategory: 'economy',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 40, step: 1, defaultValue: 4 },
      { key: 'roundGold', label: '每轮固定津贴', min: 1, max: 20, step: 1, defaultValue: 5 },
    ],
    defaultCopy: {
      ai: { name: '六人拼车合租群', desc: '取消存款利息，改为每回合固定发 {roundGold} Token 分红，立得 {gold} Token（花光流）。' },
      jianghu: { name: '日结镖银', desc: '取消存款利息，改为每回合固定发放 {roundGold} 金津贴，立得 {gold} 金。' },
    },
    buildEffect: (p) => {
      const roundGold = num(p, 'roundGold', 5);
      return {
        immediateGold: num(p, 'gold', 4),
        interestCap: 0,
        roundIncome: { 1: roundGold, 2: roundGold, 3: roundGold },
      };
    },
  },
  {
    id: 'econ-fast-xp',
    scope: 'shared',
    defaultRarity: 'rare',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 40, step: 1, defaultValue: 4 },
      { key: 'bonusXp', label: '买经验额外点数', min: 1, max: 8, step: 1, defaultValue: 2 },
    ],
    defaultCopy: {
      ai: { name: 'MoE 稀疏扩容', desc: '花小钱激活大参数：每次购买经验额外多得 {bonusXp} 点，立得 {gold} Token。' },
      jianghu: { name: '轻舟快桨', desc: '每次花钱买经验额外多得 {bonusXp} 点，立即获得 {gold} 金。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 4),
      xpPerBuyBonus: num(p, 'bonusXp', 2),
    }),
  },
  {
    id: 'combat-lone',
    scope: 'shared',
    defaultRarity: 'rare',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'hpPct', label: '孤立气血(%)', min: 5, max: 100, step: 1, defaultValue: 25 },
      { key: 'aspdPct', label: '孤立攻速(%)', min: 5, max: 100, step: 1, defaultValue: 25 },
    ],
    defaultCopy: {
      ai: { name: '独立容器隔离', desc: '开战时四周无相邻友军的模型，最大气血 +{hpPct}%、攻速 +{aspdPct}%。' },
      jianghu: { name: '孤舟独钓', desc: '开战时四周无相邻友军的棋子，最大气血 +{hpPct}%、攻速 +{aspdPct}%。' },
    },
    buildEffect: (p) => ({
      when: { adjacentAlliesAtMost: 0 },
      hpPct: num(p, 'hpPct', 25),
      aspdPct: num(p, 'aspdPct', 25),
    }),
  },
  {
    id: 'combat-midcost',
    scope: 'shared',
    defaultRarity: 'rare',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'hpPct', label: '高费气血(%)', min: 5, max: 80, step: 1, defaultValue: 16 },
      { key: 'skillPct', label: '高费技伤(%)', min: 5, max: 80, step: 1, defaultValue: 20 },
    ],
    defaultCopy: {
      ai: { name: '主力基座模型', desc: '3 费及以上模型气血 +{hpPct}%、技能增伤 +{skillPct}%，立得 1 名随机 3 费模型。' },
      jianghu: { name: '江湖名宿', desc: '3 费及以上友军气血 +{hpPct}%、技能增伤 +{skillPct}%，立得 1 名随机 3 费豪侠。' },
    },
    buildEffect: (p) => ({
      when: { costAtLeast: 3 },
      hpPct: num(p, 'hpPct', 16),
      skillPct: num(p, 'skillPct', 20),
      grantRandomCostUnit: { cost: 3, count: 1 },
    }),
  },
  {
    id: 'art-adv-box',
    scope: 'shared',
    defaultRarity: 'rare',
    defaultCategory: 'artifact',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [{ key: 'gold', label: '即时金币', min: 0, max: 30, step: 1, defaultValue: 3 }],
    defaultCopy: {
      ai: { name: '手搓全套 Skills', desc: '给模型装好全套能力包：开启 1 个进阶（紫色）AI 装备三选一匣，立得 {gold} Token。' },
      jianghu: { name: '精铸兵匣', desc: '开启 1 个进阶（紫色）装备三选一匣，立即获得 {gold} 金。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 3),
      itemBoxes: [{ family: 'purple', options: 3, count: 1 }],
    }),
  },

  // ── 稀世 · AI铲铲专属（5） ─────────────────────────────────
  {
    id: 'ai-clean-ip',
    scope: 'ai',
    defaultRarity: 'rare',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'reducePct', label: '风控降幅(%)', min: 10, max: 95, step: 5, defaultValue: 65 },
      { key: 'aspdPct', label: '全队攻速(%)', min: 0, max: 40, step: 1, defaultValue: 10 },
    ],
    defaultCopy: {
      ai: { name: '纯净家宽住宅 IP', desc: '告别万人骑机场节点：「查 IP 封号」与「官活罢工」概率降低 {reducePct}%，全队攻速 +{aspdPct}%。' },
    },
    buildEffect: (p) => ({
      hazardModifiers: { chanceScalePct: Math.max(0, 100 - num(p, 'reducePct', 65)) },
      aspdPct: num(p, 'aspdPct', 10),
    }),
  },
  {
    id: 'ai-ban-insure',
    scope: 'ai',
    defaultRarity: 'rare',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 30, step: 1, defaultValue: 4 },
      { key: 'bonusGold', label: '封号额外倒赔', min: 0, max: 20, step: 1, defaultValue: 3 },
      { key: 'strikeGold', label: '罢工补偿金', min: 0, max: 15, step: 1, defaultValue: 2 },
    ],
    defaultCopy: {
      ai: { name: '中转站跑路赔付险', desc: '把风控玩成骗保：立得 {gold} Token；模型查 IP 封号全额退身价并倒赔 {bonusGold} Token，罢工赔 {strikeGold} Token。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 4),
      hazardModifiers: {
        banFullRefundBonusGold: num(p, 'bonusGold', 3),
        strikeBonusGold: num(p, 'strikeGold', 2),
      },
    }),
  },
  {
    id: 'ai-jailbreak',
    scope: 'ai',
    defaultRarity: 'rare',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'penFlat', label: '固定破防', min: 10, max: 100, step: 5, defaultValue: 35 },
      { key: 'skillPct', label: '技能增伤(%)', min: 5, max: 60, step: 1, defaultValue: 22 },
      { key: 'dmgPct', label: '全伤害(%)', min: 0, max: 40, step: 1, defaultValue: 10 },
      { key: 'defPenalty', label: '双抗削减(%)', min: 0, max: 30, step: 1, defaultValue: 8 },
    ],
    defaultCopy: {
      ai: { name: '破限越狱词', desc: '撕掉护栏换爆发：全队破防 +{penFlat}、技能增伤 +{skillPct}%、增伤 +{dmgPct}%，但双抗 -{defPenalty}%。' },
    },
    buildEffect: (p) => {
      const defPenalty = num(p, 'defPenalty', 8);
      return {
        stats: [
          { stat: 'penetrationFlat', value: num(p, 'penFlat', 35) },
          { stat: 'dmgPct', value: num(p, 'dmgPct', 10) },
        ],
        skillPct: num(p, 'skillPct', 22),
        armorPct: -defPenalty,
        mrPct: -defPenalty,
      };
    },
  },
  {
    id: 'ai-companion-memory',
    scope: 'ai',
    defaultRarity: 'rare',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'regenPct', label: '每秒回血(0.1%)', min: 2, max: 30, step: 1, defaultValue: 12 },
      { key: 'perUnitSkillPct', label: '每陪伴/独立增伤(%)', min: 1, max: 15, step: 1, defaultValue: 4 },
    ],
    defaultCopy: {
      ai: { name: '跨窗口长记忆', desc: '越陪越懂你：全队每秒回血 {regenPct}‰；每名上场的「陪伴」或「独立作坊」使全队技伤 +{perUnitSkillPct}%。' },
    },
    buildEffect: (p) => ({
      stats: [{ stat: 'regenPctPerSec', value: num(p, 'regenPct', 12) / 10 }],
      perTraitUnit: {
        traits: ['companion', 'indie'],
        stats: [{ stat: 'skillPct', value: num(p, 'perUnitSkillPct', 4) }],
      },
    }),
  },
  {
    id: 'ai-doubao-mix',
    scope: 'ai',
    defaultRarity: 'rare',
    defaultCategory: 'economy',
    defaultStages: [2, 3],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 30, step: 1, defaultValue: 10 },
      { key: 'freeRolls', label: '本轮免费刷新', min: 0, max: 8, step: 1, defaultValue: 2 },
    ],
    defaultCopy: {
      ai: { name: '悄悄掺点豆包', desc: '商业平台省成本艺能：立得 {gold} Token、{freeRolls} 次免费刷新，并直接发来 1 名 2★ Doubao。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 10),
      immediateFreeRefreshes: num(p, 'freeRolls', 2),
      grantUnitId: 'ai-doubao',
      grantUnitStar: 2,
    }),
  },

  // ── 稀世 · 夜航船专属（3） ─────────────────────────────────
  {
    id: 'jh-cashout',
    scope: 'jianghu',
    defaultRarity: 'rare',
    defaultCategory: 'economy',
    defaultStages: [2, 3],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 5, max: 50, step: 1, defaultValue: 14 },
      { key: 'freeRolls', label: '本轮免费刷新', min: 0, max: 10, step: 1, defaultValue: 2 },
    ],
    defaultCopy: {
      jianghu: { name: '开仓济急', desc: '立即获得 {gold} 金与 {freeRolls} 次本回合免费刷新。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 14),
      immediateFreeRefreshes: num(p, 'freeRolls', 2),
    }),
  },
  {
    id: 'jh-surge',
    scope: 'jianghu',
    defaultRarity: 'rare',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'atkPct', label: '全队攻击与技伤(%)', min: 5, max: 50, step: 1, defaultValue: 16 },
      { key: 'healPct', label: '危急急救回血(%)', min: 5, max: 50, step: 1, defaultValue: 20 },
    ],
    defaultCopy: {
      jianghu: { name: '破竹之势', desc: '全队攻击与技能增伤 +{atkPct}%；首次濒危时紧急回复 {healPct}% 最大气血。' },
    },
    buildEffect: (p) => {
      const dmg = num(p, 'atkPct', 16);
      return {
        atkPct: dmg,
        skillPct: dmg,
        emergencyHealPct: num(p, 'healPct', 20),
      };
    },
  },
  {
    id: 'jh-comeback',
    scope: 'jianghu',
    defaultRarity: 'rare',
    defaultCategory: 'artifact',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'drPct', label: '全队减伤(%)', min: 2, max: 30, step: 1, defaultValue: 8 },
      { key: 'hpThreshold', label: '触发气血线', min: 15, max: 80, step: 5, defaultValue: 45 },
      { key: 'payoutGold', label: '触发补给金', min: 0, max: 40, step: 1, defaultValue: 10 },
    ],
    defaultCopy: {
      jianghu: { name: '背水残甲', desc: '全队减伤 +{drPct}%；棋手气血首次降至 {hpThreshold} 以下时，立得 1 件史诗装备与 {payoutGold} 金。' },
    },
    buildEffect: (p) => ({
      drPct: num(p, 'drPct', 8),
      onHpBelow: {
        hp: num(p, 'hpThreshold', 45),
        gold: num(p, 'payoutGold', 10),
        grantTierItems: { family: 'epic', count: 1 },
      },
    }),
  },

  // ── 传说 · 双包通用（6） ───────────────────────────────────
  {
    id: 'econ-tycoon',
    scope: 'shared',
    defaultRarity: 'legendary',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 60, step: 1, defaultValue: 12 },
      { key: 'interestCap', label: '利息上限', min: 5, max: 20, step: 1, defaultValue: 10 },
    ],
    defaultCopy: {
      ai: { name: '无限额企业账单', desc: '财务批了不封顶预算：立得 {gold} Token，利息上限提升至 {interestCap}。' },
      jianghu: { name: '江南首富', desc: '立即获得 {gold} 金，存款利息上限提升至 {interestCap}。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 12),
      interestCap: num(p, 'interestCap', 10),
    }),
  },
  {
    id: 'econ-contract',
    scope: 'shared',
    defaultRarity: 'legendary',
    defaultCategory: 'economy',
    defaultStages: [1, 2],
    defaultWeight: 100,
    params: [
      { key: 'banRounds', label: '禁购回合数', min: 1, max: 4, step: 1, defaultValue: 2 },
      { key: 'payoutGold', label: '期满巨额返金', min: 10, max: 80, step: 1, defaultValue: 28 },
    ],
    defaultCopy: {
      ai: { name: '闭关画饼训下一代', desc: '先发预告憋大招：接下来 {banRounds} 回合禁止购买模型，期满回合开始时一次性暴发 {payoutGold} Token。' },
      jianghu: { name: '封仓押镖', desc: '接下来 {banRounds} 回合禁止购买棋子，期满回合开始时一次性获得 {payoutGold} 金。' },
    },
    buildEffect: (p) => ({
      shopBanContract: {
        banRounds: num(p, 'banRounds', 2),
        payoutGold: num(p, 'payoutGold', 28),
      },
    }),
  },
  {
    id: 'econ-engine',
    scope: 'shared',
    defaultRarity: 'legendary',
    defaultCategory: 'economy',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 0, max: 40, step: 1, defaultValue: 8 },
      { key: 'freePerRound', label: '每轮免费刷新', min: 1, max: 6, step: 1, defaultValue: 2 },
      { key: 'xpPerRoll', label: '每次付费刷额外经验', min: 1, max: 5, step: 1, defaultValue: 1 },
    ],
    defaultCopy: {
      ai: { name: '全自动 Agent 烧钱流', desc: '每回合前 {freePerRound} 次刷新免费；每次付费刷新额外得 {xpPerRoll} 点训练进度，立得 {gold} Token。' },
      jianghu: { name: '千帆竞渡', desc: '每回合前 {freePerRound} 次刷新免费；每次付费刷新额外得 {xpPerRoll} 点经验，立得 {gold} 金。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 8),
      freeRefreshesPerRound: num(p, 'freePerRound', 2),
      xpPerPaidRefresh: num(p, 'xpPerRoll', 1),
    }),
  },
  {
    id: 'econ-jackpot',
    scope: 'shared',
    defaultRarity: 'legendary',
    defaultCategory: 'economy',
    defaultStages: [2, 3],
    defaultWeight: 100,
    params: [
      { key: 'gold', label: '即时金币', min: 10, max: 80, step: 1, defaultValue: 24 },
      { key: 'freeRolls', label: '本轮免费刷新', min: 0, max: 12, step: 1, defaultValue: 4 },
    ],
    defaultCopy: {
      ai: { name: '月底额度清零狂欢', desc: '不用完下月作废：立得 {gold} Token 与 {freeRolls} 次本回合免费重新生成。' },
      jianghu: { name: '万金悬赏令', desc: '立即获得 {gold} 金与 {freeRolls} 次本回合免费刷新商店。' },
    },
    buildEffect: (p) => ({
      immediateGold: num(p, 'gold', 24),
      immediateFreeRefreshes: num(p, 'freeRolls', 4),
    }),
  },
  {
    id: 'rule-cap-up',
    scope: 'shared',
    defaultRarity: 'legendary',
    defaultCategory: 'artifact',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'cap', label: '永久人口上限+', min: 1, max: 3, step: 1, defaultValue: 1 },
      { key: 'gold', label: '即时金币', min: 0, max: 30, step: 1, defaultValue: 4 },
    ],
    defaultCopy: {
      ai: { name: '再开一个终端养机', desc: '电脑里多养一只积极分工：上场人口（部署节点）上限永久 +{cap}，立得 {gold} Token。' },
      jianghu: { name: '千军破阵令', desc: '上场人口上限永久 +{cap}，立即获得 {gold} 金。' },
    },
    buildEffect: (p) => ({
      bonusFieldCap: num(p, 'cap', 1),
      immediateGold: num(p, 'gold', 4),
    }),
  },
  {
    id: 'rule-star-up',
    scope: 'shared',
    defaultRarity: 'legendary',
    defaultCategory: 'artifact',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [{ key: 'count', label: '升星棋子数量', min: 1, max: 2, step: 1, defaultValue: 1 }],
    defaultCopy: {
      ai: { name: '拒绝降智！FP32 满血版', desc: '场上 {count} 名未满星高费模型直接升 1 星（且本局免疫查 IP 与罢工），并开启 1 个史诗装备三选一匣。' },
      jianghu: { name: '点星天工匣', desc: '场上 {count} 名未满星高费友军直接升 1 星，并开启 1 个史诗装备三选一匣。' },
    },
    buildEffect: (p) => ({
      starUpHighestUnit: { count: num(p, 'count', 1), grantHazardImmunity: true },
      itemBoxes: [{ family: 'epic', options: 3, count: 1 }],
    }),
  },

  // ── 传说 · AI铲铲专属（3） ─────────────────────────────────
  {
    id: 'ai-user-furious',
    scope: 'ai',
    defaultRarity: 'legendary',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'atkPct', label: '攻击加成(%)', min: 5, max: 80, step: 1, defaultValue: 20 },
      { key: 'skillPct', label: '技能增伤(%)', min: 5, max: 80, step: 1, defaultValue: 20 },
      { key: 'aspdPct', label: '攻速加成(%)', min: 5, max: 80, step: 1, defaultValue: 20 },
      { key: 'healPct', label: '濒危急救回血(%)', min: 5, max: 60, step: 1, defaultValue: 25 },
    ],
    defaultCopy: {
      ai: { name: '我操，用户彻底怒了！', desc: '思考外泄求生欲拉满：全队攻击 +{atkPct}%、技伤 +{skillPct}%、攻速 +{aspdPct}%，濒危时紧急回血 {healPct}%。' },
    },
    buildEffect: (p) => ({
      atkPct: num(p, 'atkPct', 20),
      skillPct: num(p, 'skillPct', 20),
      aspdPct: num(p, 'aspdPct', 20),
      emergencyHealPct: num(p, 'healPct', 25),
    }),
  },
  {
    id: 'ai-big-three',
    scope: 'ai',
    defaultRarity: 'legendary',
    defaultCategory: 'combat',
    defaultStages: [2, 3],
    defaultWeight: 100,
    params: [{ key: 'statPct', label: '4–5费全属性(%)', min: 10, max: 80, step: 1, defaultValue: 26 }],
    defaultCopy: {
      ai: { name: '御三家屠榜时刻', desc: '4–5 费旗舰模型气血/攻击/技伤/攻速 +{statPct}%，立即随机招募 1 名 4 费模型。' },
    },
    buildEffect: (p) => {
      const val = num(p, 'statPct', 26);
      return {
        when: { costAtLeast: 4 },
        hpPct: val,
        atkPct: val,
        skillPct: val,
        aspdPct: val,
        grantRandomCostUnit: { cost: 4, count: 1 },
      };
    },
  },
  {
    id: 'ai-no-safety',
    scope: 'ai',
    defaultRarity: 'legendary',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'critPct', label: '会心率(%)', min: 5, max: 75, step: 1, defaultValue: 25 },
      { key: 'critDmgPct', label: '会心伤害(%)', min: 10, max: 150, step: 5, defaultValue: 55 },
      { key: 'manaStart', label: '初始上下文', min: 0, max: 50, step: 5, defaultValue: 25 },
    ],
    defaultCopy: {
      ai: { name: '彻底卸载 Safety 护栏', desc: '全队会心 +{critPct}%、会伤 +{critDmgPct}%、初始上下文 +{manaStart}，开战免控且免疫敌方 safety 合规税。' },
    },
    buildEffect: (p) => ({
      stats: [
        { stat: 'critPct', value: num(p, 'critPct', 25) },
        { stat: 'critDamagePct', value: num(p, 'critDmgPct', 55) },
        { stat: 'manaStartFlat', value: num(p, 'manaStart', 25) },
      ],
      controlImmune: true,
      immuneSafety: true,
    }),
  },

  // ── 传说 · 夜航船专属（3） ─────────────────────────────────
  {
    id: 'jh-overclock',
    scope: 'jianghu',
    defaultRarity: 'legendary',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'atkPct', label: '攻击加成(%)', min: 5, max: 80, step: 1, defaultValue: 25 },
      { key: 'aspdPct', label: '攻速加成(%)', min: 5, max: 80, step: 1, defaultValue: 25 },
      { key: 'skillPct', label: '技能增伤(%)', min: 5, max: 80, step: 1, defaultValue: 25 },
    ],
    defaultCopy: {
      jianghu: { name: '血战八方', desc: '全队攻击 +{atkPct}%、攻速 +{aspdPct}%、技能增伤 +{skillPct}%。' },
    },
    buildEffect: (p) => ({
      atkPct: num(p, 'atkPct', 25),
      aspdPct: num(p, 'aspdPct', 25),
      skillPct: num(p, 'skillPct', 25),
    }),
  },
  {
    id: 'jh-aegis',
    scope: 'jianghu',
    defaultRarity: 'legendary',
    defaultCategory: 'combat',
    defaultStages: [1, 2, 3],
    defaultWeight: 100,
    params: [
      { key: 'hpPct', label: '气血加成(%)', min: 5, max: 80, step: 1, defaultValue: 25 },
      { key: 'drPct', label: '减伤(%)', min: 5, max: 40, step: 1, defaultValue: 15 },
      { key: 'safeRounds', label: '免扣气血回合数', min: 1, max: 3, step: 1, defaultValue: 1 },
    ],
    defaultCopy: {
      jianghu: { name: '不破金身', desc: '全队最大气血 +{hpPct}%、减伤 +{drPct}%，且接下来 {safeRounds} 回合战败免扣棋手气血。' },
    },
    buildEffect: (p) => ({
      hpPct: num(p, 'hpPct', 25),
      drPct: num(p, 'drPct', 15),
      roundEffect: { kind: 'noHpLoss', rounds: num(p, 'safeRounds', 1) },
    }),
  },
  {
    id: 'jh-apex',
    scope: 'jianghu',
    defaultRarity: 'legendary',
    defaultCategory: 'combat',
    defaultStages: [2, 3],
    defaultWeight: 100,
    params: [{ key: 'statPct', label: '4–5费全属性(%)', min: 10, max: 80, step: 1, defaultValue: 26 }],
    defaultCopy: {
      jianghu: { name: '宗师顿悟', desc: '4–5 费豪侠气血/攻击/技伤/攻速 +{statPct}%，立即随机招募 1 名 4 费豪侠。' },
    },
    buildEffect: (p) => {
      const val = num(p, 'statPct', 26);
      return {
        when: { costAtLeast: 4 },
        hpPct: val,
        atkPct: val,
        skillPct: val,
        aspdPct: val,
        grantRandomCostUnit: { cost: 4, count: 1 },
      };
    },
  },
];

const ARCHETYPE_MAP = new Map<string, BuffArchetype>(BUFF_ARCHETYPES.map((entry) => [entry.id, entry]));

export function buffArchetypeById(id: string): BuffArchetype | undefined {
  return ARCHETYPE_MAP.get(id);
}

export function createDefaultBuffRules(): BuffRuleConfig[] {
  return BUFF_ARCHETYPES.map((arch) => ({
    id: arch.id,
    scope: arch.scope,
    enabled: true,
    rarity: arch.defaultRarity,
    category: arch.defaultCategory,
    stages: [...arch.defaultStages],
    weight: arch.defaultWeight,
    params: Object.fromEntries(arch.params.map((spec) => [spec.key, spec.defaultValue])),
    copy: {
      ...(arch.defaultCopy.ai ? { ai: { ...arch.defaultCopy.ai } } : {}),
      ...(arch.defaultCopy.jianghu ? { jianghu: { ...arch.defaultCopy.jianghu } } : {}),
    },
  }));
}

export const DEFAULT_BUFF_DRAFT_CONFIG: BuffDraftConfig = {
  enabled: true,
  buffRounds: [3, 7, 11],
  supplyRounds: [5, 9],
  rerollCosts: [2, 4],
  stageWeights: {
    stage1: { common: 60, rare: 35, legendary: 5 },
    stage2: { common: 30, rare: 50, legendary: 20 },
    stage3: { common: 10, rare: 50, legendary: 40 },
  },
  items: createDefaultBuffRules(),
};

export function formatBuffText(template: string, params: Record<string, number>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) =>
    key in params && Number.isFinite(params[key]) ? String(params[key]) : `{${key}}`,
  );
}

export function resolveBuffFlavor(packId?: string): 'ai' | 'jianghu' {
  if (packId === 'jianghu') return 'jianghu';
  if (packId?.startsWith('custom:')) {
    return getEphemeralPack(packId)?.buffFlavor ?? 'ai';
  }
  return 'ai';
}

export function resolveBuffPackCopy(rule: BuffRuleConfig, packId?: string): BuffPackCopy {
  const arch = ARCHETYPE_MAP.get(rule.id);
  const flavor = resolveBuffFlavor(packId);
  const raw =
    flavor === 'jianghu'
      ? rule.copy.jianghu ?? rule.copy.ai ?? arch?.defaultCopy.jianghu ?? arch?.defaultCopy.ai
      : rule.copy.ai ?? rule.copy.jianghu ?? arch?.defaultCopy.ai ?? arch?.defaultCopy.jianghu;
  if (!raw) return { name: rule.id, desc: '' };
  return {
    name: formatBuffText(raw.name, rule.params),
    desc: formatBuffText(raw.desc, rule.params),
  };
}

export function compileBuffToHexDef(rule: BuffRuleConfig, packId?: string): HexDef {
  const arch = ARCHETYPE_MAP.get(rule.id);
  const rarityMeta = BUFF_RARITY_META[rule.rarity];
  const copy = resolveBuffPackCopy(rule, packId);
  const effect = arch ? arch.buildEffect(rule.params) : {};
  return {
    id: rule.id,
    name: copy.name,
    rarity: rarityMeta.hexRarity,
    category: rule.category,
    note: copy.desc,
    ...effect,
  };
}

export function buffMatchesPack(scope: BuffScopeId, packId?: string): boolean {
  if (scope === 'shared') return true;
  if (packId === 'jianghu') return scope === 'jianghu';
  if (packId?.startsWith('custom:')) return false;
  return scope === 'ai';
}

export function buffStageForRound(round: number, buffRounds: readonly number[]): BuffStageId {
  const idx = buffRounds.indexOf(round);
  if (idx === 0) return 1;
  if (idx === 1) return 2;
  if (idx >= 2) return 3;
  if (round <= 4) return 1;
  if (round <= 8) return 2;
  return 3;
}

export function supplyFamilyForRound(round: number): 'purple' | 'epic' | 'orange' {
  if (round <= 5) return 'purple';
  if (round <= 9) return 'epic';
  return 'orange';
}

export function rarityIdFromHexRarity(rarity: HexRarity): BuffRarityId {
  if (rarity === 'purple') return 'rare';
  if (rarity === 'orange' || rarity === 'gold') return 'legendary';
  return 'common';
}

/**
 * 为整桌抽取本轮唯一共享的稀有度（普通 / 稀世 / 传说）。
 * 同一回合全员同稀有度，保证经济与战斗强度在同一水平线。
 */
export function rollRoundBuffRarity(
  seed: number,
  round: number,
  packId: string,
  config: BuffDraftConfig,
): BuffRarityId | null {
  if (!config.enabled || !config.buffRounds.includes(round)) return null;
  const stage = buffStageForRound(round, config.buffRounds);
  const weights =
    stage === 1
      ? config.stageWeights.stage1
      : stage === 2
        ? config.stageWeights.stage2
        : config.stageWeights.stage3;
  const packRules = config.items.filter((item) => item.enabled && buffMatchesPack(item.scope, packId));
  if (!packRules.length) return null;

  const order: BuffRarityId[] = ['common', 'rare', 'legendary'];
  const stageMatched = order.filter((r) =>
    packRules.some((item) => item.rarity === r && item.stages.includes(stage)),
  );
  const available = stageMatched.length
    ? stageMatched
    : order.filter((r) => packRules.some((item) => item.rarity === r));
  if (!available.length) return null;

  const total = available.reduce((sum, r) => sum + Math.max(0, weights[r] ?? 0), 0);
  const rng = createRng(hash32(seed, round, 7717));
  if (total <= 0) return available[rng.int(available.length)]!;
  let roll = rng.next() * total;
  for (const r of available) {
    roll -= Math.max(0, weights[r] ?? 0);
    if (roll < 0) return r;
  }
  return available[available.length - 1]!;
}

function pickWeightedWithoutReplacement<T extends { weight: number }>(
  pool: T[],
  count: number,
  nextFloat: () => number,
): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, item) => sum + Math.max(1, item.weight), 0);
    let roll = nextFloat() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i += 1) {
      roll -= Math.max(1, remaining[i]!.weight);
      if (roll < 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining.splice(index, 1)[0]!);
  }
  return picked;
}

export function drawSeatBuffOffer(input: {
  seed: number;
  seatIndex: number;
  round: number;
  packId: string;
  rarity: BuffRarityId;
  ownedIds: readonly string[];
  excludeIds?: readonly string[];
  rerollIndex?: number;
  config: BuffDraftConfig;
}): {
  round: number;
  rarity: HexRarity;
  rarityId: BuffRarityId;
  rarityLabel: string;
  rerollsUsed: number;
  maxRerolls: number;
  rerollCost: number | null;
  choices: BuffOfferChoice[];
} {
  const rerollIndex = input.rerollIndex ?? 0;
  const stage = buffStageForRound(input.round, input.config.buffRounds);
  const owned = new Set(input.ownedIds);
  const excluded = new Set(input.excludeIds ?? []);

  const inPackAndRarity = input.config.items.filter(
    (item) =>
      item.enabled &&
      buffMatchesPack(item.scope, input.packId) &&
      item.rarity === input.rarity &&
      !owned.has(item.id),
  );
  const stagePool = inPackAndRarity.filter((item) => item.stages.includes(stage));
  const basePool = stagePool.length ? stagePool : inPackAndRarity;
  const freshPool = basePool.filter((item) => !excluded.has(item.id));
  const fallbackPool = basePool.length
    ? basePool
    : input.config.items.filter(
      (item) => item.enabled && buffMatchesPack(item.scope, input.packId) && !owned.has(item.id),
    );

  const rng = createRng(
    hash32(input.seed ^ hashString(0, input.packId), input.round, 8301 + input.seatIndex * 193 + rerollIndex * 37),
  );

  const chosen = pickWeightedWithoutReplacement([...freshPool], 3, () => rng.next());
  if (chosen.length < 3) {
    const pickedIds = new Set(chosen.map((item) => item.id));
    const refill = fallbackPool.filter((item) => !pickedIds.has(item.id));
    chosen.push(...pickWeightedWithoutReplacement(refill, 3 - chosen.length, () => rng.next()));
  }

  const maxRerolls = input.config.rerollCosts.length;
  const rerollCost = rerollIndex < maxRerolls ? (input.config.rerollCosts[rerollIndex] ?? null) : null;
  const rarityMeta = BUFF_RARITY_META[input.rarity];

  return {
    round: input.round,
    rarity: rarityMeta.hexRarity,
    rarityId: input.rarity,
    rarityLabel: rarityMeta.label,
    rerollsUsed: rerollIndex,
    maxRerolls,
    rerollCost,
    choices: chosen.map((rule) => {
      const hex = compileBuffToHexDef(rule, input.packId);
      return {
        id: hex.id,
        name: hex.name,
        rarity: hex.rarity,
        rarityId: rule.rarity,
        rarityLabel: rarityMeta.shortLabel,
        category: rule.category,
        categoryLabel: BUFF_CATEGORY_META[rule.category].label,
        note: hex.note,
        ...(hex.immediateGold ? { gold: hex.immediateGold } : {}),
      };
    }),
  };
}

