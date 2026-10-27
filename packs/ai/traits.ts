import { defineTrait, traitTier as at } from '../../content/autochess/define-trait';
import type { TraitDef } from '../../content/autochess/types';

/** AI 包羁绊的文案、档位和效果；共享引擎不认识任何本包 id。 */
export const aiTraits: TraitDef[] = [
  defineTrait('frontier', '前沿闭源', 'faction', '[2/4] 增伤减伤，顶尖牌抱团。', {
    2: at(['dmgPct', 12], ['drPct', 12]), 4: at(['dmgPct', 22], ['drPct', 22]),
  }),
  defineTrait('orient', '东方算力', 'faction', '[2/4/6/8] 攻速与内力回复。注意：会抬高 Claude 的「查IP」风险。', {
    2: at(['aspdPct', 15], ['manaRegenPct', 20]), 4: at(['aspdPct', 28], ['manaRegenPct', 35]),
    6: at(['aspdPct', 42], ['manaRegenPct', 50]), 8: at(['aspdPct', 58], ['manaRegenPct', 65]),
  }),
  defineTrait('opensource', '开源同盟', 'faction', '[2/4/6] 技能增伤，权重越高共享越强。', {
    2: at(['skillPct', 12]), 4: at(['skillPct', 22], ['atkPct', 12]), 6: at(['skillPct', 34], ['atkPct', 20]),
  }),
  defineTrait('indie', '独立作坊', 'faction', '[2/4/6] 攻血与减伤：杂牌多了反而稳。', {
    2: at(['atkPct', 10], ['hpPct', 10], ['drPct', 5]), 4: at(['atkPct', 18], ['hpPct', 18], ['drPct', 8]),
    6: at(['atkPct', 28], ['hpPct', 28], ['drPct', 12]),
  }),
  defineTrait('showdown', '双势', 'faction', '[2/4/6] 开源与闭源同场：多的一方触发争锋——开源多则全队获得共享护盾，闭源多则该阵营攻击提升（专利费）。', {
    2: at(['dmgPct', 8], ['drPct', 8]), 4: at(['dmgPct', 15], ['drPct', 15]), 6: at(['dmgPct', 22], ['drPct', 22]),
  }, { mechanics: [{ id: 'campStandoff', campA: 'opensource', campB: 'frontier', at: 2, shieldPct: 15, atkPct: 15 }] }),

  defineTrait('reasoning', '推理', 'job', '[2/4] 会心与会伤：想得越久，暴击越狠。', {
    2: at(['critPct', 15], ['critDamagePct', 30]), 4: at(['critPct', 28], ['critDamagePct', 65]),
  }),
  defineTrait('coding', '编码', 'job', '[2] 攻速与技能增伤。', { 2: at(['aspdPct', 20], ['skillPct', 10]) }),
  defineTrait('agent', '智能体', 'job', '[2/4/6] 攻击与攻速：多步编排、连续出手。', {
    2: at(['atkPct', 12], ['aspdPct', 12]), 4: at(['atkPct', 22], ['aspdPct', 22]), 6: at(['atkPct', 34], ['aspdPct', 34]),
  }),
  defineTrait('multimodal', '多模态', 'job', '[2/4/6] 增伤与破防：图文音一起处理。', {
    2: at(['dmgPct', 10], ['penetrationFlat', 15]), 4: at(['dmgPct', 18], ['penetrationFlat', 30]),
    6: at(['dmgPct', 28], ['penetrationFlat', 45]),
  }),
  defineTrait('longcontext', '长上下文', 'job', '[2/4] 射程与每格增伤：看得越远打得越准。', {
    2: at(['range', 1], ['distanceDamagePctPerTile', 8]), 4: at(['range', 1], ['distanceDamagePctPerTile', 16]),
  }),
  defineTrait('speed', '极速', 'job', '[2] 攻速与移速。', { 2: at(['aspdPct', 30], ['moveSpeedPct', 10]) }),
  defineTrait('value', '性价比', 'job', '[2/4/6] 气血与减伤：便宜耐用。', {
    2: at(['hpPct', 12], ['drPct', 5]), 4: at(['hpPct', 22], ['drPct', 10]), 6: at(['hpPct', 32], ['drPct', 15]),
  }),
  defineTrait('alignment', '对齐', 'job', '[2/4/6] 减伤与双抗：合规护体。', {
    2: at(['drPct', 10], ['armorPct', 12], ['mrPct', 12]), 4: at(['drPct', 18], ['armorPct', 24], ['mrPct', 24]),
    6: at(['drPct', 28], ['armorPct', 38], ['mrPct', 38]),
  }),
  defineTrait('companion', '陪伴', 'job', '[2/4/6] 受疗、气血与每秒回复：越陪越稳。', {
    2: at(['healReceivePct', 15], ['hpPct', 10]), 4: at(['healReceivePct', 25], ['hpPct', 20], ['regenPctPerSec', 1]),
    6: at(['healReceivePct', 38], ['hpPct', 32], ['regenPctPerSec', 2]),
  }),
];
