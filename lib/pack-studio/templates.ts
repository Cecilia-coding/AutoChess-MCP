import type { Role } from '../../content/autochess/types';
import { GENERIC_PACK_TERMS } from '../../packs/types';
import { roleBaselineStats } from './balance';
import type {
  CustomPackV1,
  StudioBuffFlavor,
  StudioItemDef,
  StudioSkillDef,
  StudioTraitDef,
  StudioUnitDef,
} from './schema';
import { cloneStarGrowthPreset, type StarGrowthPresetId } from './star-curves';

export type StudioStarterId = 'blank' | 'compact-12' | 'standard-20';

export type StudioStarterOptionMeta = {
  id: StudioStarterId;
  name: string;
  badge: string;
  unitCountLabel: string;
  matrixLabel: string;
  description: string;
};

export const STUDIO_STARTER_OPTIONS: readonly StudioStarterOptionMeta[] = [
  {
    id: 'blank',
    name: '空白自定义骨架',
    badge: '从 0 搭建',
    unitCountLabel: '0 枚棋子',
    matrixLabel: '自定阵营与职业',
    description: '只确立棋谱名称、术语与升星曲线；不塞任何默认棋子或羁绊，完全由你和机从第一行开始亲手捏。',
  },
  {
    id: 'compact-12',
    name: '12 枚紧凑模板',
    badge: '3×3 快节奏',
    unitCountLabel: '12 枚棋子 · 1~4 费',
    matrixLabel: '3 阵营 × 3 职业',
    description: '9 个交叉定位严丝合缝满格覆盖，配 12 枚原创手绘桌面偶；适合快速验证羁绊数值、改卡面和两局微调。',
  },
  {
    id: 'standard-20',
    name: '20 枚标准模板',
    badge: '4×4 完整构筑',
    unitCountLabel: '20 枚棋子 · 1~5 费',
    matrixLabel: '4 阵营 × 4 职业',
    description: '完整的 16 格羁绊网与全部 20 枚原创小人，含 4 枚 5 费橙卡与 12 件分档装备，涵盖 4 种技能触发机制。',
  },
];

export type CreatePackExplicitInput = {
  starterId: StudioStarterId;
  id: string;
  title: string;
  subtitle?: string;
  starGrowthPreset: StarGrowthPresetId;
  buffFlavor: StudioBuffFlavor;
};

function makeUnit(input: {
  id: string;
  name: string;
  cost: 1 | 2 | 3 | 4 | 5;
  role: Role;
  spriteId: string;
  factions: string[];
  jobs: string[];
  skill: StudioSkillDef;
  tweak?: Partial<StudioUnitDef['stats']>;
}): StudioUnitDef {
  const base = roleBaselineStats(input.cost, input.role);
  return {
    id: input.id,
    name: input.name,
    cost: input.cost,
    role: input.role,
    spriteId: input.spriteId,
    factions: input.factions,
    jobs: input.jobs,
    stats: {
      hp: input.tweak?.hp ?? base.hp,
      atk: input.tweak?.atk ?? base.atk,
      armor: input.tweak?.armor ?? base.armor,
      mr: input.tweak?.mr ?? base.mr,
      aspd: input.tweak?.aspd ?? base.aspd,
      range: input.tweak?.range ?? base.range,
    },
    skill: input.skill,
  };
}

function buildCompact12Content(): {
  traits: StudioTraitDef[];
  units: StudioUnitDef[];
  items: StudioItemDef[];
} {
  const traits: StudioTraitDef[] = [
    {
      id: 'f-clock',
      name: '发条坊',
      kind: 'faction',
      description: '齿轮咬合的钢铁防线',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'hpPct', value: 16 }] },
        { count: 4, scope: 'team', stats: [{ stat: 'hpPct', value: 26 }, { stat: 'armor', value: 16 }] },
      ],
    },
    {
      id: 'f-lantern',
      name: '萤灯社',
      kind: 'faction',
      description: '积蓄微光提前爆发',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'skillPct', value: 20 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'skillPct', value: 42 }, { stat: 'manaStartFlat', value: 18 }] },
      ],
    },
    {
      id: 'f-moss',
      name: '苔原森',
      kind: 'faction',
      description: '灵巧攻速与连携爆发',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'aspdPct', value: 18 }] },
        { count: 4, scope: 'team', stats: [{ stat: 'aspdPct', value: 28 }, { stat: 'atkPct', value: 14 }] },
      ],
    },
    {
      id: 'j-guardian',
      name: '铁卫',
      kind: 'job',
      description: '承伤并稳住前排线',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'armor', value: 24 }, { stat: 'mr', value: 24 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'armor', value: 52 }, { stat: 'mr', value: 52 }, { stat: 'drPct', value: 10 }] },
      ],
    },
    {
      id: 'j-striker',
      name: '游侠',
      kind: 'job',
      description: '强化普攻与致命暴击',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'atkPct', value: 18 }, { stat: 'critPct', value: 15 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'atkPct', value: 38 }, { stat: 'critPct', value: 25 }] },
      ],
    },
    {
      id: 'j-arcanist',
      name: '术士',
      kind: 'job',
      description: '技能回蓝与法术压制',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'skillPct', value: 22 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'skillPct', value: 48 }, { stat: 'manaRegenPct', value: 35 }] },
      ],
    },
  ];

  const units: StudioUnitDef[] = [
    makeUnit({
      id: 'c-slime',
      name: '史莱姆骑',
      cost: 1,
      role: 'tank',
      spriteId: 'st-slime-knight',
      factions: ['f-moss'],
      jobs: ['j-guardian'],
      skill: {
        name: '果冻护壁',
        description: '为自己举起持续 4 秒的生命护盾',
        trigger: { kind: 'mana', maxMana: 70 },
        target: 'self',
        targetCount: 1,
        effects: [{ kind: 'shield', baseByStar: [160, 270, 440], hpPct: 12, durationMs: 4000 }],
      },
    }),
    makeUnit({
      id: 'c-boat',
      name: '折纸舟',
      cost: 1,
      role: 'ranged',
      spriteId: 'st-paper-boat',
      factions: ['f-lantern'],
      jobs: ['j-striker'],
      skill: {
        name: '纸锋飞梭',
        description: '每 3 次普攻射出一发穿甲纸箭',
        trigger: { kind: 'every_attacks', count: 3 },
        target: 'current_enemy',
        targetCount: 1,
        effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [45, 85, 150], atkPct: 140 }],
      },
    }),
    makeUnit({
      id: 'c-bulb',
      name: '灯泡精',
      cost: 1,
      role: 'caster',
      spriteId: 'st-bulb-wisp',
      factions: ['f-clock'],
      jobs: ['j-arcanist'],
      skill: {
        name: '钨丝闪光',
        description: '向最近敌人射出一道暖光射线',
        trigger: { kind: 'mana', maxMana: 60 },
        target: 'current_enemy',
        targetCount: 1,
        effects: [{ kind: 'damage', damageType: 'magic', baseByStar: [130, 220, 360], atkPct: 180 }],
      },
    }),
    makeUnit({
      id: 'c-bunny',
      name: '发条兔',
      cost: 2,
      role: 'melee',
      spriteId: 'st-clock-bunny',
      factions: ['f-clock'],
      jobs: ['j-striker'],
      skill: {
        name: '拧弦猛斩',
        description: '砍击面前目标并震晕短暂时间',
        trigger: { kind: 'mana', maxMana: 75 },
        target: 'current_enemy',
        targetCount: 1,
        effects: [
          { kind: 'damage', damageType: 'phys', baseByStar: [150, 250, 420], atkPct: 190 },
          { kind: 'stun', durationMsByStar: [700, 900, 1200] },
        ],
      },
    }),
    makeUnit({
      id: 'c-tower',
      name: '灯塔偶',
      cost: 2,
      role: 'support',
      spriteId: 'st-tower-keeper',
      factions: ['f-lantern'],
      jobs: ['j-guardian'],
      skill: {
        name: '潮汐祝福',
        description: '为血量最低的友军回复生命并提高攻速',
        trigger: { kind: 'mana', maxMana: 70 },
        target: 'lowest_hp_ally',
        targetCount: 1,
        effects: [
          { kind: 'heal', baseByStar: [170, 290, 480], hpPct: 10 },
          { kind: 'stat_buff', stat: 'aspdPct', value: 25, durationMs: 4000 },
        ],
      },
    }),
    makeUnit({
      id: 'c-dice',
      name: '骰子怪',
      cost: 2,
      role: 'melee',
      spriteId: 'st-dice-imp',
      factions: ['f-moss'],
      jobs: ['j-striker'],
      skill: {
        name: '暴点突刺',
        description: '切击最近敌人造成高额魔法伤害',
        trigger: { kind: 'mana', maxMana: 65 },
        target: 'current_enemy',
        targetCount: 1,
        effects: [{ kind: 'damage', damageType: 'magic', baseByStar: [175, 300, 500], atkPct: 210 }],
      },
    }),
    makeUnit({
      id: 'c-cat',
      name: '黑猫巫',
      cost: 3,
      role: 'caster',
      spriteId: 'st-cat-mage',
      factions: ['f-lantern'],
      jobs: ['j-arcanist'],
      skill: {
        name: '星杖奇袭',
        description: '锁定最近 2 名敌人降下奥术星火',
        trigger: { kind: 'mana', maxMana: 85 },
        target: 'nearest_enemies',
        targetCount: 2,
        effects: [{ kind: 'damage', damageType: 'magic', baseByStar: [210, 360, 620], atkPct: 200 }],
      },
    }),
    makeUnit({
      id: 'c-tea',
      name: '茶壶匠',
      cost: 3,
      role: 'support',
      spriteId: 'st-tea-mimic',
      factions: ['f-moss'],
      jobs: ['j-arcanist'],
      skill: {
        name: '热茶烫甲',
        description: '削减最远敌方输出护甲并造成魔法泼溅',
        trigger: { kind: 'mana', maxMana: 80 },
        target: 'farthest_enemy',
        targetCount: 1,
        effects: [
          { kind: 'damage', damageType: 'magic', baseByStar: [230, 390, 660], atkPct: 220 },
          { kind: 'stat_debuff', stat: 'armor', value: 18, durationMs: 5000 },
        ],
      },
    }),
    makeUnit({
      id: 'c-gear',
      name: '齿轮偶',
      cost: 3,
      role: 'tank',
      spriteId: 'st-gear-golem',
      factions: ['f-clock'],
      jobs: ['j-guardian'],
      skill: {
        name: '开场齿盾',
        description: '开战时立即为全队 2 名友军覆上护盾',
        trigger: { kind: 'battle_start' },
        target: 'lowest_hp_ally',
        targetCount: 2,
        effects: [{ kind: 'shield', baseByStar: [180, 310, 520], hpPct: 12, durationMs: 6000 }],
      },
    }),
    makeUnit({
      id: 'c-star',
      name: '星象棋',
      cost: 4,
      role: 'melee',
      spriteId: 'st-star-knight',
      factions: ['f-clock'],
      jobs: ['j-striker', 'j-guardian'],
      skill: {
        name: '飞马压杀',
        description: '猛烈冲击目标并附加短暂眩晕',
        trigger: { kind: 'mana', maxMana: 80 },
        target: 'current_enemy',
        targetCount: 1,
        effects: [
          { kind: 'damage', damageType: 'phys', baseByStar: [280, 480, 860], atkPct: 260 },
          { kind: 'stun', durationMsByStar: [900, 1200, 1800] },
        ],
      },
    }),
    makeUnit({
      id: 'c-hourglass',
      name: '沙漏翁',
      cost: 4,
      role: 'caster',
      spriteId: 'st-hourglass-sage',
      factions: ['f-lantern'],
      jobs: ['j-arcanist'],
      skill: {
        name: '流沙共鸣',
        description: '轰击全场敌军造成范围魔法伤害',
        trigger: { kind: 'mana', maxMana: 95 },
        target: 'all_enemies',
        targetCount: 6,
        effects: [{ kind: 'damage', damageType: 'magic', baseByStar: [220, 390, 740], atkPct: 185 }],
      },
    }),
    makeUnit({
      id: 'c-cactus',
      name: '盆栽刺',
      cost: 4,
      role: 'melee',
      spriteId: 'st-cactus-boxer',
      factions: ['f-moss'],
      jobs: ['j-guardian', 'j-striker'],
      skill: {
        name: '蓄力拳舞',
        description: '每 2.5 秒鼓舞全队攻击并回复气血',
        trigger: { kind: 'interval', everyMs: 2500 },
        target: 'all_allies',
        targetCount: 6,
        effects: [
          { kind: 'heal', baseByStar: [80, 150, 280], hpPct: 4 },
          { kind: 'stat_buff', stat: 'atkPct', value: 12, durationMs: 2500 },
        ],
      },
    }),
  ];

  const items: StudioItemDef[] = [
    { id: 'it-oak-shield', name: '铜钉木盾', tier: 'white', isOpeningChoice: true, stats: [{ stat: 'hp', value: 180 }, { stat: 'armor', value: 15 }] },
    { id: 'it-iron-edge', name: '精钢短刃', tier: 'white', isOpeningChoice: true, stats: [{ stat: 'atkPct', value: 18 }, { stat: 'aspdPct', value: 10 }] },
    { id: 'it-amber-wand', name: '琥珀枝杖', tier: 'white', isOpeningChoice: true, stats: [{ stat: 'skillPct', value: 20 }, { stat: 'manaStartFlat', value: 15 }] },
    { id: 'it-tide-vest', name: '深水板甲', tier: 'purple', isOpeningChoice: false, stats: [{ stat: 'hp', value: 320 }, { stat: 'armor', value: 28 }, { stat: 'mr', value: 28 }] },
    { id: 'it-longbow', name: '望远长弓', tier: 'purple', isOpeningChoice: false, stats: [{ stat: 'atkPct', value: 25 }, { stat: 'range', value: 1 }] },
    { id: 'it-star-core', name: '发条核心', tier: 'epic', isOpeningChoice: false, stats: [{ stat: 'skillPct', value: 38 }, { stat: 'manaRegenPct', value: 45 }] },
    { id: 'it-vampire-fang', name: '暮夜吸血牙', tier: 'epic', isOpeningChoice: false, stats: [{ stat: 'atkPct', value: 32 }, { stat: 'lifestealPct', value: 22 }] },
    { id: 'it-clock-emblem', name: '发条纹章', tier: 'orange', isOpeningChoice: false, stats: [{ stat: 'hp', value: 350 }, { stat: 'drPct', value: 10 }], grantTraitId: 'f-clock', note: '佩戴者额外计为「发条坊」' },
  ];

  return { traits, units, items };
}

function buildStandard20Content(): {
  traits: StudioTraitDef[];
  units: StudioUnitDef[];
  items: StudioItemDef[];
} {
  const traits: StudioTraitDef[] = [
    {
      id: 'f-clock',
      name: '发条镇',
      kind: 'faction',
      description: '齿轮协奏撑起扎实血线与减伤',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'hp', value: 220 }] },
        { count: 4, scope: 'team', stats: [{ stat: 'hp', value: 420 }, { stat: 'drPct', value: 8 }] },
      ],
    },
    {
      id: 'f-paper',
      name: '纸境社',
      kind: 'faction',
      description: '折甲筑垒硬扛前期集火',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'armor', value: 25 }, { stat: 'mr', value: 20 }] },
        { count: 4, scope: 'team', stats: [{ stat: 'armor', value: 45 }, { stat: 'mr', value: 40 }, { stat: 'startShieldPct', value: 15 }] },
      ],
    },
    {
      id: 'f-lantern',
      name: '星灯塔',
      kind: 'faction',
      description: '灯火节拍鼓舞全队攻速与续航',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'aspdPct', value: 20 }] },
        { count: 4, scope: 'team', stats: [{ stat: 'aspdPct', value: 35 }, { stat: 'lifestealPct', value: 12 }] },
      ],
    },
    {
      id: 'f-moss',
      name: '软胶森',
      kind: 'faction',
      description: '魔力破防与技能倍增',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'skillPct', value: 22 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'skillPct', value: 48 }, { stat: 'penetrationPct', value: 30 }] },
      ],
    },
    {
      id: 'j-vanguard',
      name: '重盾',
      kind: 'job',
      description: '矗立最前排承受第一波火力',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'hpPct', value: 18 }, { stat: 'armor', value: 22 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'hpPct', value: 36 }, { stat: 'armor', value: 50 }] },
      ],
    },
    {
      id: 'j-duelist',
      name: '游刃',
      kind: 'job',
      description: '贴身连斩越战越快',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'atkPct', value: 20 }, { stat: 'aspdPct', value: 15 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'atkPct', value: 40 }, { stat: 'aspdPct', value: 32 }] },
      ],
    },
    {
      id: 'j-marksman',
      name: '神射',
      kind: 'job',
      description: '远距点杀与致命暴击',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'critPct', value: 20 }, { stat: 'atkPct', value: 15 }] },
        { count: 4, scope: 'holders', stats: [{ stat: 'critPct', value: 40 }, { stat: 'critDamagePct', value: 35 }] },
      ],
    },
    {
      id: 'j-weaver',
      name: '秘术',
      kind: 'job',
      description: '回复内力并庇护队友',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: 'manaRegenPct', value: 35 }, { stat: 'skillPct', value: 16 }] },
        { count: 4, scope: 'team', stats: [{ stat: 'manaStartFlat', value: 20 }, { stat: 'regenPctPerSec', value: 1.5 }] },
      ],
    },
  ];

  const units: StudioUnitDef[] = [
    // 1-cost (4)
    makeUnit({
      id: 's-slime', name: '史莱姆骑', cost: 1, role: 'tank', spriteId: 'st-slime-knight',
      factions: ['f-moss'], jobs: ['j-vanguard'],
      skill: { name: '桶盔举盾', description: '获得高额自保护盾', trigger: { kind: 'mana', maxMana: 70 }, target: 'self', targetCount: 1, effects: [{ kind: 'shield', baseByStar: [180, 300, 490], hpPct: 12, durationMs: 4000 }] },
    }),
    makeUnit({
      id: 's-dice', name: '骰子怪', cost: 1, role: 'melee', spriteId: 'st-dice-imp',
      factions: ['f-clock'], jobs: ['j-duelist'],
      skill: { name: '六面连击', description: '每 3 次普攻砸出重击伤害', trigger: { kind: 'every_attacks', count: 3 }, target: 'current_enemy', targetCount: 1, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [55, 100, 175], atkPct: 145 }] },
    }),
    makeUnit({
      id: 's-boat', name: '折纸舟', cost: 1, role: 'ranged', spriteId: 'st-paper-boat',
      factions: ['f-paper'], jobs: ['j-marksman'],
      skill: { name: '纸锋飞镖', description: '向当前目标射出高伤纸箭', trigger: { kind: 'mana', maxMana: 60 }, target: 'current_enemy', targetCount: 1, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [130, 220, 370], atkPct: 185 }] },
    }),
    makeUnit({
      id: 's-bulb', name: '灯泡精', cost: 1, role: 'caster', spriteId: 'st-bulb-wisp',
      factions: ['f-lantern'], jobs: ['j-weaver'],
      skill: { name: '微光治愈', description: '为伤势最重的同伴回复气血', trigger: { kind: 'mana', maxMana: 65 }, target: 'lowest_hp_ally', targetCount: 1, effects: [{ kind: 'heal', baseByStar: [160, 280, 460], hpPct: 10 }] },
    }),
    // 2-cost (4)
    makeUnit({
      id: 's-floppy', name: '软盘盾', cost: 2, role: 'tank', spriteId: 'st-floppy-squire',
      factions: ['f-clock'], jobs: ['j-vanguard'],
      skill: { name: '写保护阵', description: '开战即为最近 2 名队友披甲护盾', trigger: { kind: 'battle_start' }, target: 'lowest_hp_ally', targetCount: 2, effects: [{ kind: 'shield', baseByStar: [150, 260, 430], hpPct: 10, durationMs: 5500 }] },
    }),
    makeUnit({
      id: 's-cactus', name: '盆栽刺', cost: 2, role: 'melee', spriteId: 'st-cactus-boxer',
      factions: ['f-moss'], jobs: ['j-duelist'],
      skill: { name: '乱刺重拳', description: '连击面前敌人并提高自身攻速', trigger: { kind: 'mana', maxMana: 65 }, target: 'current_enemy', targetCount: 1, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [165, 290, 490], atkPct: 205 }, { kind: 'stat_buff', stat: 'aspdPct', value: 25, durationMs: 4000 }] },
    }),
    makeUnit({
      id: 's-music', name: '八音姬', cost: 2, role: 'support', spriteId: 'st-music-doll',
      factions: ['f-lantern'], jobs: ['j-weaver'],
      skill: { name: '暖场华尔兹', description: '为血量最低队友抬血并提升攻击', trigger: { kind: 'mana', maxMana: 70 }, target: 'lowest_hp_ally', targetCount: 1, effects: [{ kind: 'heal', baseByStar: [185, 320, 520], hpPct: 10 }, { kind: 'stat_buff', stat: 'atkPct', value: 18, durationMs: 4500 }] },
    }),
    makeUnit({
      id: 's-crane', name: '纸鹤弓', cost: 2, role: 'ranged', spriteId: 'st-crane-archer',
      factions: ['f-paper'], jobs: ['j-marksman'],
      skill: { name: '千纸长矢', description: '点射敌方最远目标造成物理伤害', trigger: { kind: 'mana', maxMana: 75 }, target: 'farthest_enemy', targetCount: 1, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [180, 310, 530], atkPct: 210 }] },
    }),
    // 3-cost (4)
    makeUnit({
      id: 's-shroom', name: '蘑菇卫', cost: 3, role: 'tank', spriteId: 'st-shroom-guard',
      factions: ['f-paper'], jobs: ['j-vanguard'],
      skill: { name: '菌盖震荡', description: '横扫最近 2 名敌军并眩晕 1 秒', trigger: { kind: 'mana', maxMana: 80 }, target: 'nearest_enemies', targetCount: 2, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [170, 295, 510], atkPct: 165 }, { kind: 'stun', durationMsByStar: [900, 1200, 1600] }] },
    }),
    makeUnit({
      id: 's-bunny', name: '发条兔', cost: 3, role: 'melee', spriteId: 'st-clock-bunny',
      factions: ['f-paper'], jobs: ['j-duelist'],
      skill: { name: '急条连斩', description: '瞬间劈出高额真伤直击破甲', trigger: { kind: 'mana', maxMana: 75 }, target: 'current_enemy', targetCount: 1, effects: [{ kind: 'damage', damageType: 'true', baseByStar: [195, 340, 610], atkPct: 215 }] },
    }),
    makeUnit({
      id: 's-tape', name: '磁带侠', cost: 3, role: 'ranged', spriteId: 'st-tape-ranger',
      factions: ['f-clock'], jobs: ['j-marksman'],
      skill: { name: '双轨甩带', description: '向最近 2 名敌军甩出高频连射', trigger: { kind: 'mana', maxMana: 70 }, target: 'nearest_enemies', targetCount: 2, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [200, 350, 600], atkPct: 210 }] },
    }),
    makeUnit({
      id: 's-cat', name: '黑猫巫', cost: 3, role: 'caster', spriteId: 'st-cat-mage',
      factions: ['f-moss'], jobs: ['j-weaver'],
      skill: { name: '夜星诅咒', description: '轰击敌阵并削弱魔抗', trigger: { kind: 'mana', maxMana: 85 }, target: 'nearest_enemies', targetCount: 2, effects: [{ kind: 'damage', damageType: 'magic', baseByStar: [220, 380, 660], atkPct: 190 }, { kind: 'stat_debuff', stat: 'mr', value: 20, durationMs: 5000 }] },
    }),
    // 4-cost (4)
    makeUnit({
      id: 's-tower', name: '灯塔偶', cost: 4, role: 'tank', spriteId: 'st-tower-keeper',
      factions: ['f-lantern'], jobs: ['j-vanguard'],
      skill: { name: '塔钟威慑', description: '击晕面前 2 名敌军并重击', trigger: { kind: 'mana', maxMana: 90 }, target: 'nearest_enemies', targetCount: 2, effects: [{ kind: 'stun', durationMsByStar: [1200, 1600, 2400] }, { kind: 'damage', damageType: 'phys', baseByStar: [220, 380, 720], atkPct: 180 }] },
    }),
    makeUnit({
      id: 's-star', name: '星象棋', cost: 4, role: 'melee', spriteId: 'st-star-knight',
      factions: ['f-lantern'], jobs: ['j-duelist'],
      skill: { name: '跳马追击', description: '突刺切斩最远敌方后排', trigger: { kind: 'mana', maxMana: 75 }, target: 'farthest_enemy', targetCount: 1, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [290, 500, 920], atkPct: 255 }] },
    }),
    makeUnit({
      id: 's-moon', name: '弦月灵', cost: 4, role: 'ranged', spriteId: 'st-moon-sprite',
      factions: ['f-moss'], jobs: ['j-marksman'],
      skill: { name: '新月爆裂', description: '每 3 次普攻激发月光穿透矢', trigger: { kind: 'every_attacks', count: 3 }, target: 'nearest_enemies', targetCount: 2, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [120, 220, 440], atkPct: 215 }] },
    }),
    makeUnit({
      id: 's-crt', name: '小电视', cost: 4, role: 'caster', spriteId: 'st-crt-bot',
      factions: ['f-clock'], jobs: ['j-weaver'],
      skill: { name: '频闪调律', description: '每隔 3 秒为全队恢复气血', trigger: { kind: 'interval', everyMs: 3000 }, target: 'all_allies', targetCount: 8, effects: [{ kind: 'heal', baseByStar: [110, 200, 400], hpPct: 5 }] },
    }),
    // 5-cost (4)
    makeUnit({
      id: 's-gear', name: '齿轮偶', cost: 5, role: 'tank', spriteId: 'st-gear-golem',
      factions: ['f-clock'], jobs: ['j-vanguard', 'j-duelist'],
      skill: { name: '机械震岳', description: '震撼全场并眩晕敌阵', trigger: { kind: 'mana', maxMana: 100 }, target: 'all_enemies', targetCount: 8, effects: [{ kind: 'damage', damageType: 'phys', baseByStar: [280, 490, 980], atkPct: 210 }, { kind: 'stun', durationMsByStar: [1000, 1500, 2600] }] },
    }),
    makeUnit({
      id: 's-tea', name: '茶壶匠', cost: 5, role: 'melee', spriteId: 'st-tea-mimic',
      factions: ['f-moss'], jobs: ['j-weaver', 'j-vanguard'],
      skill: { name: '滚烫倾注', description: '横扫近战圈造成巨额真实伤害', trigger: { kind: 'mana', maxMana: 85 }, target: 'nearest_enemies', targetCount: 3, effects: [{ kind: 'damage', damageType: 'true', baseByStar: [340, 620, 1280], atkPct: 265 }] },
    }),
    makeUnit({
      id: 's-lantern', name: '提灯灵', cost: 5, role: 'support', spriteId: 'st-lantern-spirit',
      factions: ['f-lantern'], jobs: ['j-marksman', 'j-weaver'],
      skill: { name: '满堂星灯', description: '全舞台声波光束冲击全场敌军', trigger: { kind: 'mana', maxMana: 90 }, target: 'all_enemies', targetCount: 8, effects: [{ kind: 'damage', damageType: 'magic', baseByStar: [310, 560, 1180], atkPct: 225 }] },
    }),
    makeUnit({
      id: 's-hourglass', name: '沙漏翁', cost: 5, role: 'caster', spriteId: 'st-hourglass-sage',
      factions: ['f-paper'], jobs: ['j-weaver'],
      skill: { name: '时序逆转', description: '轰击敌军同时为全队回复高额生命', trigger: { kind: 'mana', maxMana: 95 }, target: 'all_enemies', targetCount: 8, effects: [{ kind: 'damage', damageType: 'magic', baseByStar: [330, 600, 1250], atkPct: 230 }, { kind: 'heal', baseByStar: [200, 380, 760], hpPct: 8 }] },
    }),
  ];

  const items: StudioItemDef[] = [
    { id: 'si-cloth-armor', name: '粗麻护胸', tier: 'white', isOpeningChoice: true, stats: [{ stat: 'hp', value: 180 }, { stat: 'armor', value: 14 }] },
    { id: 'si-short-blade', name: '百炼匕首', tier: 'white', isOpeningChoice: true, stats: [{ stat: 'atkPct', value: 18 }, { stat: 'critPct', value: 10 }] },
    { id: 'si-jade-charm', name: '清心玉佩', tier: 'white', isOpeningChoice: true, stats: [{ stat: 'skillPct', value: 20 }, { stat: 'manaStartFlat', value: 15 }] },
    { id: 'si-bamboo-hat', name: '雨蓑斗笠', tier: 'white', isOpeningChoice: false, stats: [{ stat: 'mr', value: 18 }, { stat: 'dodgePct', value: 10 }] },
    { id: 'si-heavy-mail', name: '玄铁锁甲', tier: 'purple', isOpeningChoice: false, stats: [{ stat: 'hp', value: 340 }, { stat: 'armor', value: 30 }, { stat: 'mr', value: 25 }] },
    { id: 'si-wind-bow', name: '追风轻弓', tier: 'purple', isOpeningChoice: false, stats: [{ stat: 'aspdPct', value: 30 }, { stat: 'range', value: 1 }] },
    { id: 'si-scholar-scroll', name: '云篆秘卷', tier: 'purple', isOpeningChoice: false, stats: [{ stat: 'skillPct', value: 34 }, { stat: 'manaRegenPct', value: 40 }] },
    { id: 'si-dragon-lance', name: '破军长枪', tier: 'epic', isOpeningChoice: false, stats: [{ stat: 'atkPct', value: 36 }, { stat: 'penetrationPct', value: 35 }] },
    { id: 'si-blood-gourd', name: '饮血酒葫芦', tier: 'epic', isOpeningChoice: false, stats: [{ stat: 'atkPct', value: 28 }, { stat: 'lifestealPct', value: 25 }] },
    { id: 'si-guardian-bell', name: '金钟护心镜', tier: 'epic', isOpeningChoice: false, stats: [{ stat: 'hp', value: 480 }, { stat: 'startShieldPct', value: 20 }, { stat: 'drPct', value: 10 }] },
    { id: 'si-clock-token', name: '发条徽章', tier: 'orange', isOpeningChoice: false, stats: [{ stat: 'hp', value: 380 }, { stat: 'drPct', value: 12 }], grantTraitId: 'f-clock', note: '佩戴者额外计为「发条镇」成员' },
    { id: 'si-moss-seal', name: '软胶印记', tier: 'orange', isOpeningChoice: false, stats: [{ stat: 'skillPct', value: 45 }, { stat: 'manaStartFlat', value: 25 }], grantTraitId: 'f-moss', note: '佩戴者额外计为「软胶森」成员' },
  ];

  return { traits, units, items };
}

export function createPackFromStarter(input: CreatePackExplicitInput): CustomPackV1 {
  const starGrowth = cloneStarGrowthPreset(input.starGrowthPreset);
  const terms = {
    ...GENERIC_PACK_TERMS,
    gold: { ...GENERIC_PACK_TERMS.gold },
    level: { ...GENERIC_PACK_TERMS.level },
    mana: { ...GENERIC_PACK_TERMS.mana },
    reroll: { ...GENERIC_PACK_TERMS.reroll },
    star: {
      name: GENERIC_PACK_TERMS.star.name,
      tiers: [...GENERIC_PACK_TERMS.star.tiers] as [string, string, string],
    },
  };

  if (input.starterId === 'blank') {
    return {
      schemaVersion: 1,
      id: input.id,
      title: input.title,
      subtitle: input.subtitle ?? '从空白骨架出发的自走棋棋谱',
      buffFlavor: input.buffFlavor,
      terms,
      starGrowth,
      traits: [],
      units: [],
      items: [],
    };
  }

  const content = input.starterId === 'compact-12' ? buildCompact12Content() : buildStandard20Content();
  return {
    schemaVersion: 1,
    id: input.id,
    title: input.title,
    subtitle:
      input.subtitle ??
      (input.starterId === 'compact-12' ? '3阵营 × 3职业 · 12 枚原创桌面偶' : '4阵营 × 4职业 · 20 枚原创全卡池'),
    buffFlavor: input.buffFlavor,
    terms,
    starGrowth,
    ...content,
  };
}
