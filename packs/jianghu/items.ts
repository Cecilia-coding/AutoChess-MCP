import type { ItemDef } from '../../content/autochess/types';

type Family = 'white' | 'purple' | 'epic' | 'orange';

const COLOR: Record<Family, string> = {
  white: '#d8d2c8',
  purple: '#8d6bb8',
  epic: '#b45a8c',
  orange: '#e3b62f',
};

function item(id: string, name: string, family: Family, rest: Partial<ItemDef>): ItemDef {
  return {
    id,
    name,
    family,
    color: COLOR[family],
    atk: 0,
    hp: 0,
    armor: 0,
    mr: 0,
    aspdPct: 0,
    skillPct: 0,
    ...rest,
  };
}

/** 「夜航船」原创装备池；四个 family 与通用选秀品阶一一对应。 */
export const jianghuItems: ItemDef[] = [
  item('jh-travel-lantern', '行路灯', 'white', {
    hpPct: 15,
    note: '* 气血 +15%。灯火不灭，夜路不慌。',
  }),
  item('jh-wrist-wrap', '练功护腕', 'white', {
    atkPct: 15,
    note: '* 攻击 +15%。一招一式，先从扎稳手腕开始。',
  }),
  item('jh-herb-pouch', '随身药囊', 'white', {
    regenPctPerSec: 1.2,
    note: '* 每秒回复 1.2% 最大气血。',
  }),

  item('jh-rain-cape', '蓑雨披风', 'purple', {
    armorPct: 14,
    mrPct: 14,
    drPct: 6,
    note: '* 双抗 +14%、减伤 +6%。',
  }),
  item('jh-swallow-darts', '燕尾镖', 'purple', {
    atkPct: 12,
    aspdPct: 20,
    note: '* 攻击 +12%、攻速 +20%。',
  }),
  item('jh-smoke-pellet', '烟丸', 'purple', {
    dodgePct: 18,
    note: '* 闪避 +18%。烟起时，脚步先到。',
  }),

  item('jh-escort-banner', '行旗', 'epic', {
    hpPct: 20,
    allyBuffPct: 12,
    note: '* 气血 +20%；身边友军获得 12% 属性增益。',
  }),
  item('jh-tempered-edge', '百炼锋', 'epic', {
    atkPct: 38,
    penetrationPct: 22,
    note: '* 攻击 +38%、破甲 +22%。',
  }),
  item('jh-calm-breath', '定息玉', 'epic', {
    skillPct: 28,
    stats: [{ stat: 'manaStartFlat', value: 18 }],
    note: '* 技能增伤 +28%、初始内力 +18。',
  }),

  item('jh-meteor-blade', '陨铁长锋', 'orange', {
    atkPct: 80,
    stats: [{ stat: 'critPct', value: 25 }, { stat: 'critDamagePct', value: 35 }],
    note: '* 攻击 +80%、会心 +25%、会伤 +35%。',
  }),
  item('jh-ninefold-vest', '九叠衣', 'orange', {
    hpPct: 45,
    armorPct: 25,
    mrPct: 25,
    drPct: 12,
    note: '* 气血 +45%、双抗 +25%、减伤 +12%。',
  }),
  item('jh-cloudstep-boots', '踏云履', 'orange', {
    aspdPct: 35,
    dodgePct: 22,
    controlImmune: true,
    note: '* 攻速 +35%、闪避 +22%，并免疫控制。',
  }),
];
