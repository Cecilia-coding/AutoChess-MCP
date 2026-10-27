import { defineTrait, traitTier as at } from '../../content/autochess/define-trait';
import type { TraitDef } from '../../content/autochess/types';

/** 夜航船羁绊的文案、档位和效果。 */
export const jianghuTraits: TraitDef[] = [
  defineTrait('canal', '漕帮', 'faction', '[2/4] 成员生命 +18%/35%。', {
    2: at(['hpPct', 18]), 4: at(['hpPct', 35]),
  }),
  defineTrait('escort', '镖局', 'faction', '[2/4] 成员双抗 +25/55。', {
    2: at(['armor', 25], ['mr', 25]), 4: at(['armor', 55], ['mr', 55]),
  }),
  defineTrait('troupe', '梨园', 'faction', '[2/3] 成员技能强度 +18%/36%。', {
    2: at(['skillPct', 18]), 3: at(['skillPct', 36]),
  }),
  defineTrait('blade', '刀客', 'faction', '[2/4] 成员攻击 +16%/34%。', {
    2: at(['atkPct', 16]), 4: at(['atkPct', 34]),
  }),
  defineTrait('yamen', '衙门', 'faction', '[2/4] 成员攻速 +12%/28%。', {
    2: at(['aspdPct', 12]), 4: at(['aspdPct', 28]),
  }),
  defineTrait('warrior', '武者', 'job', '[2/4/6] 攻击与生命逐级提升。', {
    2: at(['atkPct', 10], ['hpPct', 8]), 4: at(['atkPct', 18], ['hpPct', 15]), 6: at(['atkPct', 28], ['hpPct', 24]),
  }),
  defineTrait('brawler', '力士', 'job', '[2/4] 生命与护甲提升。', {
    2: at(['hpPct', 16], ['armor', 20]), 4: at(['hpPct', 30], ['armor', 45]),
  }),
  defineTrait('marksman', '射手', 'job', '[2/4] 攻速与射程提升。', {
    2: at(['aspdPct', 16]), 4: at(['aspdPct', 30], ['range', 1]),
  }),
  defineTrait('assassin', '刺客', 'job', '[2/4] 暴击率与暴击伤害提升。', {
    2: at(['critPct', 12], ['critDamagePct', 20]), 4: at(['critPct', 24], ['critDamagePct', 45]),
  }),
  defineTrait('fortress', '铁卫', 'job', '[2/4] 双抗与减伤提升。', {
    2: at(['armor', 25], ['mr', 25]), 4: at(['armor', 50], ['mr', 50], ['drPct', 8]),
  }),
  defineTrait('sustain', '回春', 'job', '[2/4] 生命与持续回复提升。', {
    2: at(['hpPct', 12], ['regenPctPerSec', 1]), 4: at(['hpPct', 24], ['regenPctPerSec', 2]),
  }),
  defineTrait('advisor', '谋士', 'job', '[2/4] 技能强度与内力回复提升。', {
    2: at(['skillPct', 14], ['manaRegenPct', 15]), 4: at(['skillPct', 28], ['manaRegenPct', 30]),
  }),
];
