import type { TraitDef } from '../../content/autochess/types';

/**
 * AI 包的羁绊文案表（数值在 `content/autochess/trait-tiers.ts` 的 traitTiers 里按 id 挂载）。
 *
 * 两个轴，刻意做少（"少量棋子、少而硬"）：
 *   阵营 = 出身/流派：frontier 前沿闭源 / orient 东方算力 / opensource 开源同盟 / indie 独立作坊 / infra 基建
 *   职业 = 能力角色：reasoning coding agent multimodal longcontext speed value alignment companion
 *
 * 品牌名只在棋子名里（Claude / GPT / DeepSeek…），不再一个牌子一条羁绊，避免死羁绊。
 * 换一套羁绊时整包替换本文件即可，引擎与属性词表都不用改。
 */
export const aiTraits: TraitDef[] = [
  // ── 阵营 ────────────────────────────────────────────────
  { id: 'frontier', name: '前沿闭源', kind: 'faction', tiers: [2, 4], ladders: '[2/4] 增伤减伤，顶尖牌抱团。' },
  { id: 'orient', name: '东方算力', kind: 'faction', tiers: [2, 4, 6, 8], ladders: '[2/4/6/8] 攻速与内力回复。注意：会抬高 Claude 的「查IP」风险。' },
  { id: 'opensource', name: '开源同盟', kind: 'faction', tiers: [2, 4, 6], ladders: '[2/4/6] 技能增伤，权重越高共享越强。' },
  { id: 'indie', name: '独立作坊', kind: 'faction', tiers: [2, 4, 6], ladders: '[2/4/6] 攻血与减伤：杂牌多了反而稳。' },
  { id: 'showdown', name: '双势', kind: 'faction', tiers: [2, 4, 6], ladders: '[2/4/6] 开源与闭源同场：多的一方触发争锋——开源多则全队获得共享护盾，闭源多则该阵营攻击提升（专利费）。' },

  // ── 职业 ────────────────────────────────────────────────
  { id: 'reasoning', name: '推理', kind: 'job', tiers: [2, 4], ladders: '[2/4] 会心与会伤：想得越久，暴击越狠。' },
  { id: 'coding', name: '编码', kind: 'job', tiers: [2], ladders: '[2] 攻速与技能增伤。' },
  { id: 'agent', name: '智能体', kind: 'job', tiers: [2, 4, 6], ladders: '[2/4/6] 攻击与攻速：多步编排、连续出手。' },
  { id: 'multimodal', name: '多模态', kind: 'job', tiers: [2, 4, 6], ladders: '[2/4/6] 增伤与破防：图文音一起处理。' },
  { id: 'longcontext', name: '长上下文', kind: 'job', tiers: [2, 4], ladders: '[2/4] 射程与每格增伤：看得越远打得越准。' },
  { id: 'speed', name: '极速', kind: 'job', tiers: [2], ladders: '[2] 攻速与移速。' },
  { id: 'value', name: '性价比', kind: 'job', tiers: [2, 4, 6], ladders: '[2/4/6] 气血与减伤：便宜耐用。' },
  { id: 'alignment', name: '对齐', kind: 'job', tiers: [2, 4, 6], ladders: '[2/4/6] 减伤与双抗：合规护体。' },
  { id: 'companion', name: '陪伴', kind: 'job', tiers: [2, 4, 6], ladders: '[2/4/6] 受疗、气血与每秒回复：越陪越稳。' },
];
