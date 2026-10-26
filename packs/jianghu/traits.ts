import type { TraitDef } from '../../content/autochess/types';

/** 夜航船（江湖）包的专属羁绊。 */
export const jianghuTraits: TraitDef[] = [
  { id: 'canal', name: '漕帮', kind: 'faction', tiers: [2, 4], ladders: '[2/4] 成员生命 +18%/35%。' },
  { id: 'escort', name: '镖局', kind: 'faction', tiers: [2, 4], ladders: '[2/4] 成员双抗 +25/55。' },
  { id: 'troupe', name: '梨园', kind: 'faction', tiers: [2, 3], ladders: '[2/3] 成员技能强度 +18%/36%。' },
  { id: 'blade', name: '刀客', kind: 'faction', tiers: [2, 4], ladders: '[2/4] 成员攻击 +16%/34%。' },
  { id: 'yamen', name: '衙门', kind: 'faction', tiers: [2, 4], ladders: '[2/4] 成员攻速 +12%/28%。' },
  { id: 'warrior', name: '武者', kind: 'job', tiers: [2, 4, 6], ladders: '[2/4/6] 攻击与生命逐级提升。' },
  { id: 'brawler', name: '力士', kind: 'job', tiers: [2, 4], ladders: '[2/4] 生命与护甲提升。' },
  { id: 'marksman', name: '射手', kind: 'job', tiers: [2, 4], ladders: '[2/4] 攻速与射程提升。' },
  { id: 'assassin', name: '刺客', kind: 'job', tiers: [2, 4], ladders: '[2/4] 暴击率与暴击伤害提升。' },
  { id: 'fortress', name: '铁卫', kind: 'job', tiers: [2, 4], ladders: '[2/4] 双抗与减伤提升。' },
  { id: 'sustain', name: '回春', kind: 'job', tiers: [2, 4], ladders: '[2/4] 生命与持续回复提升。' },
  { id: 'advisor', name: '谋士', kind: 'job', tiers: [2, 4], ladders: '[2/4] 技能强度与内力回复提升。' },
];
