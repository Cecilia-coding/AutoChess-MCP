export type StarGrowthPresetId = 'classic_180' | 'high_cost_chase' | 'compact_165' | 'custom';

export type StudioStarGrowth = {
  presetId: StarGrowthPresetId;
  hpMultipliers: [1, number, number];
  atkMultipliers: [1, number, number];
  highCostThreeStarHpBoost: boolean;
  lowCostDefBonus: boolean;
};

export type StarGrowthPresetMeta = {
  id: StarGrowthPresetId;
  name: string;
  subtitle: string;
  detail: string;
  config: StudioStarGrowth;
};

export const STAR_GROWTH_PRESETS: readonly StarGrowthPresetMeta[] = [
  {
    id: 'classic_180',
    name: '标准 1.8x 阶梯成长',
    subtitle: '1★ → 2★ (1.80x) → 3★ (3.24x)',
    detail: '双抗/攻速/射程保持不变，仅放大基础气血与攻击；直观稳定，最容易测算 TTK 与单卡预算。',
    config: {
      presetId: 'classic_180',
      hpMultipliers: [1, 1.8, 3.24],
      atkMultipliers: [1, 1.8, 3.24],
      highCostThreeStarHpBoost: false,
      lowCostDefBonus: false,
    },
  },
  {
    id: 'high_cost_chase',
    name: '高费三星追梦曲线',
    subtitle: '低费前期稳健 + 4/5 费 3★ 质变清场',
    detail: '1~2 费 2★ 获额外双抗保护避免前期坐牢，4/5 费 3★ 获额外高额生命乘区成为大后期终结器。',
    config: {
      presetId: 'high_cost_chase',
      hpMultipliers: [1, 1.8, 3.24],
      atkMultipliers: [1, 1.5, 2.25],
      highCostThreeStarHpBoost: true,
      lowCostDefBonus: true,
    },
  },
  {
    id: 'compact_165',
    name: '平缓快节奏成长',
    subtitle: '1★ → 2★ (1.65x) → 3★ (2.75x)',
    detail: '缩短星级碾压倍差，让站位、装备搭配和羁绊构筑在中期拥有更高权重。',
    config: {
      presetId: 'compact_165',
      hpMultipliers: [1, 1.65, 2.75],
      atkMultipliers: [1, 1.6, 2.55],
      highCostThreeStarHpBoost: false,
      lowCostDefBonus: false,
    },
  },
  {
    id: 'custom',
    name: '自由手调倍率曲线',
    subtitle: '自定义 2★ / 3★ 血量与攻击乘数',
    detail: '自行设定 2★、3★ 的生命与攻击乘数，以及是否启用低费护甲补正或高费三星爆发。',
    config: {
      presetId: 'custom',
      hpMultipliers: [1, 1.8, 3.24],
      atkMultipliers: [1, 1.75, 3.0],
      highCostThreeStarHpBoost: false,
      lowCostDefBonus: false,
    },
  },
];

export function cloneStarGrowthPreset(presetId: StarGrowthPresetId): StudioStarGrowth {
  const found = STAR_GROWTH_PRESETS.find((entry) => entry.id === presetId);
  if (!found) throw new Error(`未知的升星成长预设: ${presetId}`);
  return {
    ...found.config,
    hpMultipliers: [...found.config.hpMultipliers],
    atkMultipliers: [...found.config.atkMultipliers],
  };
}

export function starHpMultiplierForPack(
  growth: StudioStarGrowth,
  cost: number,
  star: 1 | 2 | 3,
): number {
  if (star === 1) return 1;
  if (growth.highCostThreeStarHpBoost) {
    if (star === 2) return cost <= 2 ? Math.max(growth.hpMultipliers[1], 2.2) : growth.hpMultipliers[1];
    if (cost >= 5) return Math.round(growth.hpMultipliers[2] * 2.8 * 100) / 100;
    if (cost === 4) return Math.round(growth.hpMultipliers[2] * 1.9 * 100) / 100;
  }
  return growth.hpMultipliers[star - 1];
}

export function starAtkMultiplierForPack(
  growth: StudioStarGrowth,
  cost: number,
  star: 1 | 2 | 3,
): number {
  if (star === 1) return 1;
  if (growth.highCostThreeStarHpBoost) {
    if (star === 2) return cost <= 2 ? Math.max(growth.atkMultipliers[1], 1.9) : growth.atkMultipliers[1];
    if (cost >= 4) return Math.round(growth.atkMultipliers[2] * 1.5 * 100) / 100;
  }
  return growth.atkMultipliers[star - 1];
}

