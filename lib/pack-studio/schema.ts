import { z } from 'zod';
import type { Role } from '../../content/autochess/types';
import type { StatKey, StatOp } from '../../content/autochess/stats-vocab';
import type { PackTerms } from '../../packs/types';
import { isValidStudioSpriteId } from './sprites';
import type { StudioStarGrowth } from './star-curves';

export const STUDIO_ROLES: readonly Role[] = ['tank', 'melee', 'ranged', 'caster', 'support'] as const;
export const STUDIO_ITEM_TIERS = ['white', 'purple', 'epic', 'orange'] as const;
export type StudioItemTier = (typeof STUDIO_ITEM_TIERS)[number];

export const STUDIO_BUFF_FLAVORS = ['tech', 'classic'] as const;
export type StudioBuffFlavor = (typeof STUDIO_BUFF_FLAVORS)[number];

export const STUDIO_STAT_KEYS: readonly StatKey[] = [
  'hp',
  'atk',
  'armor',
  'mr',
  'range',
  'hpPct',
  'atkPct',
  'armorPct',
  'mrPct',
  'aspdPct',
  'skillPct',
  'basicPct',
  'dmgPct',
  'drPct',
  'skillTakenPct',
  'penetrationPct',
  'penetrationFlat',
  'dodgePct',
  'critPct',
  'critDamagePct',
  'lifestealPct',
  'manaRegenPct',
  'manaStartFlat',
  'healReceivePct',
  'regenPctPerSec',
  'moveSpeedPct',
  'startShieldPct',
  'distanceDamagePctPerTile',
] as const;

export const STUDIO_SKILL_TARGETS = [
  'current_enemy',
  'nearest_enemies',
  'farthest_enemy',
  'lowest_hp_ally',
  'self',
  'all_enemies',
  'all_allies',
] as const;
export type StudioSkillTarget = (typeof STUDIO_SKILL_TARGETS)[number];

const statKeySchema = z.enum([
  'hp',
  'atk',
  'armor',
  'mr',
  'range',
  'hpPct',
  'atkPct',
  'armorPct',
  'mrPct',
  'aspdPct',
  'skillPct',
  'basicPct',
  'dmgPct',
  'drPct',
  'skillTakenPct',
  'penetrationPct',
  'penetrationFlat',
  'dodgePct',
  'critPct',
  'critDamagePct',
  'lifestealPct',
  'manaRegenPct',
  'manaStartFlat',
  'healReceivePct',
  'regenPctPerSec',
  'moveSpeedPct',
  'startShieldPct',
  'distanceDamagePctPerTile',
]);

export const statOpSchema = z.object({
  stat: statKeySchema,
  value: z.number().finite().min(-500).max(5000),
});

export type StudioTraitTier = {
  count: number;
  scope: 'holders' | 'team';
  stats: StatOp[];
};

export type StudioTraitDef = {
  id: string;
  name: string;
  kind: 'faction' | 'job';
  description: string;
  tiers: StudioTraitTier[];
};

export type StudioSkillTrigger =
  | { kind: 'mana'; maxMana: number; startMana?: number }
  | { kind: 'every_attacks'; count: number }
  | { kind: 'battle_start' }
  | { kind: 'interval'; everyMs: number };

export type StudioSkillEffect =
  | {
      kind: 'damage';
      damageType: 'phys' | 'magic' | 'true';
      baseByStar: [number, number, number];
      atkPct: number;
      hpPct?: number;
    }
  | {
      kind: 'shield';
      baseByStar: [number, number, number];
      hpPct: number;
      durationMs: number;
    }
  | {
      kind: 'heal';
      baseByStar: [number, number, number];
      hpPct: number;
    }
  | {
      kind: 'stun';
      durationMsByStar: [number, number, number];
    }
  | {
      kind: 'stat_buff' | 'stat_debuff';
      stat: StatKey;
      value: number;
      durationMs: number;
    };

export type StudioSkillDef = {
  name: string;
  description: string;
  trigger: StudioSkillTrigger;
  target: StudioSkillTarget;
  targetCount: number;
  effects: StudioSkillEffect[];
};

export type StudioUnitDef = {
  id: string;
  name: string;
  cost: 1 | 2 | 3 | 4 | 5;
  role: Role;
  spriteId: string;
  factions: string[];
  jobs: string[];
  stats: {
    hp: number;
    atk: number;
    armor: number;
    mr: number;
    aspd: number;
    range: number;
  };
  skill: StudioSkillDef;
};

export type StudioItemDef = {
  id: string;
  name: string;
  tier: StudioItemTier;
  isOpeningChoice: boolean;
  stats: StatOp[];
  grantTraitId?: string;
  note?: string;
};

export type CustomPackV1 = {
  schemaVersion: 1;
  id: string;
  title: string;
  subtitle: string;
  authorNote?: string;
  buffFlavor: StudioBuffFlavor;
  terms: PackTerms;
  starGrowth: StudioStarGrowth;
  traits: StudioTraitDef[];
  units: StudioUnitDef[];
  items: StudioItemDef[];
};

const safeIdSchema = z
  .string()
  .trim()
  .min(1, 'ID 不能为空')
  .max(48, 'ID 最长 48 字符')
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID 仅支持字母、数字、下划线或连字符');

const starTripleNumberSchema = z.tuple([
  z.number().finite().min(0).max(50000),
  z.number().finite().min(0).max(50000),
  z.number().finite().min(0).max(50000),
]);

const skillTriggerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('mana'),
    maxMana: z.number().int().min(10).max(300),
    startMana: z.number().int().min(0).max(200).optional(),
  }),
  z.object({
    kind: z.literal('every_attacks'),
    count: z.number().int().min(2).max(12),
  }),
  z.object({
    kind: z.literal('battle_start'),
  }),
  z.object({
    kind: z.literal('interval'),
    everyMs: z.number().int().min(500).max(15000),
  }),
]);

const skillEffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('damage'),
    damageType: z.enum(['phys', 'magic', 'true']),
    baseByStar: starTripleNumberSchema,
    atkPct: z.number().finite().min(0).max(1200),
    hpPct: z.number().finite().min(0).max(100).optional(),
  }),
  z.object({
    kind: z.literal('shield'),
    baseByStar: starTripleNumberSchema,
    hpPct: z.number().finite().min(0).max(100),
    durationMs: z.number().int().min(500).max(20000),
  }),
  z.object({
    kind: z.literal('heal'),
    baseByStar: starTripleNumberSchema,
    hpPct: z.number().finite().min(0).max(100),
  }),
  z.object({
    kind: z.literal('stun'),
    durationMsByStar: z.tuple([
      z.number().int().min(100).max(6000),
      z.number().int().min(100).max(6000),
      z.number().int().min(100).max(6000),
    ]),
  }),
  z.object({
    kind: z.literal('stat_buff'),
    stat: statKeySchema,
    value: z.number().finite().min(-500).max(1000),
    durationMs: z.number().int().min(500).max(30000),
  }),
  z.object({
    kind: z.literal('stat_debuff'),
    stat: statKeySchema,
    value: z.number().finite().min(1).max(1000),
    durationMs: z.number().int().min(500).max(30000),
  }),
]);

export const studioTraitSchema = z.object({
  id: safeIdSchema,
  name: z.string().trim().min(1, '羁绊名称不能为空').max(20, '羁绊名称过长'),
  kind: z.enum(['faction', 'job']),
  description: z.string().trim().max(120),
  tiers: z
    .array(
      z.object({
        count: z.number().int().min(1).max(12),
        scope: z.enum(['holders', 'team']),
        stats: z.array(statOpSchema).max(8),
      }),
    )
    .min(1, '羁绊至少需要 1 个激活档位')
    .max(5),
});

export const studioUnitSchema = z.object({
  id: safeIdSchema,
  name: z.string().trim().min(1, '棋子名称不能为空').max(20, '棋子名称过长'),
  cost: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  role: z.enum(['tank', 'melee', 'ranged', 'caster', 'support']),
  spriteId: z.string().trim().min(1).max(64),
  factions: z.array(safeIdSchema).max(3),
  jobs: z.array(safeIdSchema).max(3),
  stats: z.object({
    hp: z.number().finite().min(100).max(20000),
    atk: z.number().finite().min(5).max(3000),
    armor: z.number().finite().min(0).max(500),
    mr: z.number().finite().min(0).max(500),
    aspd: z.number().finite().min(0.2).max(4),
    range: z.number().int().min(1).max(6),
  }),
  skill: z.object({
    name: z.string().trim().min(1, '技能名不能为空').max(24),
    description: z.string().trim().max(160),
    trigger: skillTriggerSchema,
    target: z.enum(STUDIO_SKILL_TARGETS),
    targetCount: z.number().int().min(1).max(10),
    effects: z.array(skillEffectSchema).min(1, '技能至少需要 1 条效果').max(4),
  }),
});

export const studioItemSchema = z.object({
  id: safeIdSchema,
  name: z.string().trim().min(1, '装备名称不能为空').max(24),
  tier: z.enum(STUDIO_ITEM_TIERS),
  isOpeningChoice: z.boolean(),
  stats: z.array(statOpSchema).max(8),
  grantTraitId: safeIdSchema.optional(),
  note: z.string().trim().max(120).optional(),
});

export const customPackSchema = z.object({
  schemaVersion: z.literal(1),
  id: safeIdSchema,
  title: z.string().trim().min(1, '棋谱标题不能为空').max(32),
  subtitle: z.string().trim().max(100),
  authorNote: z.string().trim().max(240).optional(),
  buffFlavor: z.enum(STUDIO_BUFF_FLAVORS),
  terms: z.object({
    gold: z.object({
      name: z.string().trim().min(1).max(12),
      short: z.string().trim().min(1).max(6),
    }),
    level: z.object({
      name: z.string().trim().min(1).max(12),
      xp: z.string().trim().min(1).max(12),
      shop: z.string().trim().min(1).max(12),
      upgrade: z.string().trim().min(1).max(12),
    }),
    mana: z.object({ name: z.string().trim().min(1).max(12) }),
    reroll: z.object({ name: z.string().trim().min(1).max(12) }),
    star: z.object({
      name: z.string().trim().min(1).max(12),
      tiers: z.tuple([
        z.string().trim().min(1).max(8),
        z.string().trim().min(1).max(8),
        z.string().trim().min(1).max(8),
      ]),
    }),
  }),
  starGrowth: z.object({
    presetId: z.enum(['classic_180', 'high_cost_chase', 'compact_165', 'custom']),
    hpMultipliers: z.tuple([
      z.literal(1),
      z.number().finite().min(1.1).max(4),
      z.number().finite().min(1.3).max(12),
    ]),
    atkMultipliers: z.tuple([
      z.literal(1),
      z.number().finite().min(1.1).max(4),
      z.number().finite().min(1.3).max(10),
    ]),
    highCostThreeStarHpBoost: z.boolean(),
    lowCostDefBonus: z.boolean(),
  }),
  traits: z.array(studioTraitSchema).max(24),
  units: z.array(studioUnitSchema).max(60),
  items: z.array(studioItemSchema).max(48),
});

export type PackValidationResult = {
  validSchema: boolean;
  playable: boolean;
  pack: CustomPackV1 | null;
  errors: string[];
  playBlockers: string[];
  warnings: string[];
};

export function validateCustomPack(raw: unknown): PackValidationResult {
  const parsed = customPackSchema.safeParse(raw);
  if (!parsed.success) {
    const issueMsgs = parsed.error.issues.slice(0, 8).map((issue) => {
      const path = issue.path.length ? `[${issue.path.join('.')}] ` : '';
      return `${path}${issue.message}`;
    });
    return {
      validSchema: false,
      playable: false,
      pack: null,
      errors: issueMsgs,
      playBlockers: issueMsgs,
      warnings: [],
    };
  }

  const pack: CustomPackV1 = parsed.data;
  const errors: string[] = [];
  const playBlockers: string[] = [];
  const warnings: string[] = [];

  if (pack.starGrowth.hpMultipliers[2] < pack.starGrowth.hpMultipliers[1]) {
    errors.push('3★ 生命倍率不能低于 2★ 倍率');
  }
  if (pack.starGrowth.atkMultipliers[2] < pack.starGrowth.atkMultipliers[1]) {
    errors.push('3★ 攻击倍率不能低于 2★ 倍率');
  }

  const traitIds = new Set<string>();
  const traitKindById = new Map<string, 'faction' | 'job'>();
  for (const trait of pack.traits) {
    if (traitIds.has(trait.id)) errors.push(`存在重复羁绊 ID: ${trait.id}`);
    traitIds.add(trait.id);
    traitKindById.set(trait.id, trait.kind);
    const tierCounts = trait.tiers.map((tier) => tier.count);
    if (new Set(tierCounts).size !== tierCounts.length) {
      errors.push(`羁绊「${trait.name}」存在重复的激活人数档位`);
    }
  }

  const unitIds = new Set<string>();
  for (const unit of pack.units) {
    if (unitIds.has(unit.id)) errors.push(`存在重复棋子 ID: ${unit.id}`);
    unitIds.add(unit.id);
    if (!isValidStudioSpriteId(unit.spriteId)) {
      errors.push(`棋子「${unit.name}」引用了未知的像素外观: ${unit.spriteId}`);
    }
    for (const fid of unit.factions) {
      const kind = traitKindById.get(fid);
      if (!kind) errors.push(`棋子「${unit.name}」引用了不存在的阵营 ID: ${fid}`);
      else if (kind !== 'faction') errors.push(`棋子「${unit.name}」把职业「${fid}」填进了阵营栏`);
    }
    for (const jid of unit.jobs) {
      const kind = traitKindById.get(jid);
      if (!kind) errors.push(`棋子「${unit.name}」引用了不存在的职业 ID: ${jid}`);
      else if (kind !== 'job') errors.push(`棋子「${unit.name}」把阵营「${jid}」填进了职业栏`);
    }
    if (!unit.factions.length && !unit.jobs.length) {
      warnings.push(`棋子「${unit.name}」尚未分配任何阵营或职业羁绊`);
    }
  }

  const itemIds = new Set<string>();
  for (const item of pack.items) {
    if (itemIds.has(item.id)) errors.push(`存在重复装备 ID: ${item.id}`);
    itemIds.add(item.id);
    if (item.grantTraitId && !traitIds.has(item.grantTraitId)) {
      errors.push(`装备「${item.name}」转职指向不存在的羁绊 ID: ${item.grantTraitId}`);
    }
  }

  if (pack.units.length < 4) {
    playBlockers.push(`上棋盘试玩至少需要 4 枚棋子（当前 ${pack.units.length} 枚）`);
  }
  if (!pack.units.some((u) => u.cost === 1)) {
    playBlockers.push('试玩需要至少 1 枚 1 费棋子（用于首轮发牌与商店刷出）');
  }
  if (pack.traits.length === 0) {
    warnings.push('尚未定义任何羁绊，战斗中不会触发阵营或职业加成');
  }
  if (pack.items.length > 0 && !pack.items.some((item) => item.isOpeningChoice)) {
    warnings.push('已定义装备但未勾选「开局三选一」白装，开局将跳过选装步骤');
  }

  for (const trait of pack.traits) {
    const holders = pack.units.filter(
      (u) => u.factions.includes(trait.id) || u.jobs.includes(trait.id),
    ).length;
    const emblemCount = pack.items.filter((item) => item.grantTraitId === trait.id).length;
    const maxTier = Math.max(...trait.tiers.map((t) => t.count));
    if (holders === 0) {
      warnings.push(`羁绊「${trait.name}」目前没有任何棋子携带`);
    } else if (holders + emblemCount < maxTier) {
      warnings.push(
        `羁绊「${trait.name}」最高档需 ${maxTier} 人，当前仅 ${holders} 枚棋子（+ ${emblemCount} 件转职），对局中较难凑齐`,
      );
    }
  }

  const allErrors = [...errors];
  const allBlockers = [...errors, ...playBlockers];

  return {
    validSchema: allErrors.length === 0,
    playable: allBlockers.length === 0,
    pack,
    errors: allErrors,
    playBlockers: allBlockers,
    warnings,
  };
}
