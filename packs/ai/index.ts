import { definePack } from '../types';
import { aiItems, aiSwordTiers } from './items';
import { aiForms, aiRoster } from './roster';
import { aiUnitSkills } from './skills';
import { AI_TERMS } from './terms';
import { aiTraits } from './traits';

export { aiRoster, AI_BASE_CRIT, aiForms } from './roster';
export { aiTraits } from './traits';
export { aiUnitSkills } from './skills';
export { aiItems } from './items';
export { AI_HAZARD_TUNING, ipBanHazard, offPeakPricing, officialEventStrike, codingPlanSoldOut } from './hazards';
export { AI_MANEUVER_TUNING, safetyTax } from './maneuvers';
export { AI_TERMS, quantizationLabel, parameterSizeLabel } from './terms';

export const aiPack = definePack({
  id: 'ai',
  displayName: 'AI铲铲',
  icon: '🤖',
  description: '模型大乱斗：把模型的本事和怪脾气，搬上同一张棋盘。',
  roster: aiRoster,
  forms: aiForms,
  traits: aiTraits,
  items: aiItems,
  skills: aiUnitSkills,
  terms: {
    gold: { name: AI_TERMS.gold.name, short: AI_TERMS.gold.short },
    level: { name: AI_TERMS.level.name, xp: '训练进度', shop: '模型市场', upgrade: '扩容', ladder: AI_TERMS.level.ladder },
    mana: { name: AI_TERMS.mana.name },
    reroll: { name: AI_TERMS.reroll.name },
    star: { name: AI_TERMS.star.name, tiers: AI_TERMS.star.tiers },
  },
  /** 人机包的开局三选一：AI 装备按强度分档。 */
  opening: { label: 'AI 装备', tiers: aiSwordTiers },
  /** 暂未声明心悟池：本包没有心悟三选一。 */
  hexes: [],
  /** 选秀双件奖励使用本包自己的 AI 装备。 */
  kitItems: ['ai-key', 'ai-memory'],
  /** 选秀棋盘的地名。 */
  draftTiles: [
    { name: '开机自检', detail: '启程' },
    { name: '训练集群', detail: '预热' },
    { name: '数据集', detail: '清洗' },
    { name: '推理服务', detail: '上线' },
    { name: '模型市场', detail: '逛摊' },
    { name: '开源社区', detail: '白嫖' },
    { name: '微调工坊', detail: '炼丹' },
    { name: '算力荒原', detail: '抢卡' },
    { name: '长文本深海', detail: '翻书' },
    { name: 'token 集市', detail: '买量' },
    { name: '缓存池', detail: '歇脚' },
    { name: '提示词夜市', detail: '套话' },
    { name: '多模态广场', detail: '看图' },
    { name: '对齐实验室', detail: '考核' },
    { name: '限流峡谷', detail: '排队' },
    { name: '幻觉迷宫', detail: '试错' },
    { name: '回滚机房', detail: '兜底' },
    { name: '部署上线', detail: '收工' },
  ],
});
