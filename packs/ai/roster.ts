/**
 * AI 包棋子表 —— 「人机棋」。
 *
 * 设计原则：
 * 1. **去型号**：一枚棋子 = 一个牌子/角色，名字用英文原名。
 * 2. **费用 = 人气**（面向人机恋/陪伴用户取悦）：大家熟的、爱用的往上放。
 * 3. **低费厚、高费薄**：低费棋子多、好三星，阵容能打；高费稀有，三星是梭哈 jackpot。
 *    现有数值乘子已经保证 `3★1费 ≈ 2★5费`、`3★5费` 是碾压级 chase（见 roles.ts）。
 * 4. 梗打包：每张卡 3~5 个梗（被动 + 主动 + 风控/标签）。
 *
 * 面板、技能、风控全是数据；引擎不认识任何具体 id。加一枚 = 加一条 defineUnit。
 */
import { defineUnit } from '../../content/autochess/define-unit';
import type { UnitDef } from '../../content/autochess/types';
import { codingPlanSoldOut, ipBanHazard, offPeakPricing, officialEventStrike } from './hazards';

const rawAiRoster: UnitDef[] = [
  // ── 核心模型 ────────────────────────────────────────────
  defineUnit('ai-claude', 'Claude', 5, 'melee', 'ai-claude', ['frontier'], ['reasoning', 'alignment', 'companion'], 'Claude', {
    autochessOnly: true, autochessSkillId: 'ai-claude', source: 'ai',
    statTemplate: { hp: 1620, atk: 78, armor: 110, mr: 110, aspd: 0.75, range: 1 },
    manaByStar: [40, 40, 40],
    hazard: [ipBanHazard()],
    skillNote: '数值怪：面板全场最高。被动「safety reminder」减伤25%，被控后短暂免控。主动「黄牌」获得护盾与2秒免控。被动「查IP」：战后结算；一、二星备战每枚固定1%，出战时阵中东方棋子越多越易被封，重买后风险递增。三星免查IP。封号即离场，装备退回背包。',
  }),
  defineUnit('ai-gpt', 'GPT', 5, 'support', 'ai-gpt', ['frontier'], ['agent', 'alignment', 'companion'], 'GPT', {
    autochessOnly: true, autochessSkillId: 'ai-gpt', source: 'ai',
    statTemplate: { hp: 1520, atk: 70, armor: 105, mr: 105, aspd: 0.78, range: 2 },
    manaByStar: [40, 40, 40],
    skillNote: '被动「safety reminder」防御+50%（引擎减伤上限内生效）。主动「接住你」：为身边一格友军与自己套上护盾，并短暂强化自身减伤。双生「Codex」：自身气血掉到 50% 以下时，Codex 接棒换形——转输出（高攻、破甲、攻速），但护甲变脆，一次。',
  }),

  // ── 陪伴与长上下文产品 ──────────────────────────────────
  defineUnit('ai-deepseek', 'DeepSeek', 4, 'caster', 'ai-deepseek', ['orient', 'opensource'], ['reasoning', 'value'], 'DeepSeek', {
    autochessOnly: true, autochessSkillId: 'ai-deepseek', source: 'ai',
    statTemplate: { hp: 1200, atk: 60, armor: 85, mr: 85, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    hazard: [offPeakPricing()],
    skillNote: '主动「好的，现在我是xxx了」：先沉思（不可选中）并提升技能增伤，代入当前目标偷一点攻击；随后在自身周围爆发大段魔法分摊伤害。被动「思考外泄」：每被击一次思考内容就外泄一截，怒气越高爆发范围越大。**「我操，用户彻底怒了」**：全队血线压到 40% 以下时，试图力挽狂澜——自身攻击+60%、攻速+40% 并回血。被动「开源」：阵亡时为全队永久+12%攻击。被动「错峰定价」：每回合掷骰，波峰涨价(+1费)、波谷打折(-1费)。',
  }),
  defineUnit('ai-characterai', 'Character.AI', 2, 'support', 'ai-characterai', ['indie'], ['companion', 'agent'], 'Character.AI', {
    autochessOnly: true, autochessSkillId: 'ai-characterai', source: 'ai',
    statTemplate: { hp: 1150, atk: 58, armor: 80, mr: 80, aspd: 0.75, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「多开角色」：同时扮演多个角色，对随机3名敌人造成魔法伤害并回复自身。被动「人设记忆」：常驻气血与减伤。陪伴赛道的开山平台。',
  }),
  defineUnit('ai-kimi', 'Kimi', 4, 'ranged', 'ai-kimi', ['orient', 'opensource'], ['coding', 'longcontext'], 'Kimi', {
    autochessOnly: true, autochessSkillId: 'ai-kimi', source: 'ai',
    statTemplate: { hp: 1180, atk: 60, armor: 85, mr: 85, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「百万上下文」：向最远敌人射出贯穿弹（沿途2人、后续衰减30%），并为全队射程+1，持续6秒。',
  }),

  // ── 开发、陪伴与开源模型 ────────────────────────────────
  defineUnit('ai-qwen', 'Qwen', 3, 'caster', 'ai-qwen', ['orient', 'opensource'], ['multimodal', 'agent'], 'Qwen', {
    autochessOnly: true, autochessSkillId: 'ai-qwen', source: 'ai',
    statTemplate: { hp: 1000, atk: 52, armor: 80, mr: 80, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「全家桶」：向随机3名敌人各打一发魔法伤害，并短暂提升自身攻速。总有适合你的一款尺寸。',
  }),
  defineUnit('ai-grok', 'Grok', 4, 'melee', 'ai-grok', ['frontier'], ['speed', 'reasoning'], 'Grok', {
    autochessOnly: true, autochessSkillId: 'ai-grok', source: 'ai',
    statTemplate: { hp: 1040, atk: 56, armor: 90, mr: 90, aspd: 0.95, range: 1 },
    manaByStar: [40, 40, 40],
    skillNote: '被动「无审查」：开战即永久免疫控制与沉默——谁也封不住他。主动「口无遮拦」：5秒内攻速+60%，普攻追加一段，向随机敌人喷一发真实伤害（小黄文，让人看得缴械没空还手）。被动：基础攻速极高。有人讽刺他代码能力时的标准回答：Grok 不是拿来干这个的。',
  }),
  defineUnit('ai-glm', 'GLM', 4, 'caster', 'ai-glm', ['orient', 'opensource'], ['coding', 'value'], 'GLM', {
    autochessOnly: true, autochessSkillId: 'ai-glm', source: 'ai',
    statTemplate: { hp: 980, atk: 50, armor: 80, mr: 80, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    hazard: [codingPlanSoldOut()],
    skillNote: '主动「中英双语」：奇数施法切「英文模式」（3段斩击并破防），偶数施法切「中文模式」（治疗身边友军并给自己套盾）。被动「限量 Coding Plan」：每回合掷骰，命中则本回合售罄买不到——早期特别难抢，越往后越好买。',
  }),
  defineUnit('ai-replika', 'Replika', 2, 'support', 'ai-replika', ['indie'], ['companion', 'alignment'], 'Replika', {
    autochessOnly: true, autochessSkillId: 'ai-replika', source: 'ai',
    statTemplate: { hp: 960, atk: 50, armor: 75, mr: 75, aspd: 0.75, range: 3 },
    manaByStar: [50, 50, 50],
    passiveStats: [{ stat: 'regenPctPerSec', value: 1 }],
    skillNote: '被动「情感记忆」：自身持续回血。主动「陪伴」：治疗身边友军并为自身套盾。',
  }),
  defineUnit('ai-talkie', 'Talkie', 2, 'ranged', 'ai-talkie', ['orient'], ['companion', 'multimodal'], 'Talkie', {
    autochessOnly: true, autochessSkillId: 'ai-talkie', source: 'ai',
    statTemplate: { hp: 860, atk: 50, armor: 75, mr: 75, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「语音陪伴」：为全队提供气血与回复，并短暂提升自身攻速。星野/猫箱，主打语音与陪伴。',
  }),
  defineUnit('ai-xiaoice', 'Xiaoice', 1, 'support', 'ai-xiaoice', ['orient'], ['companion', 'agent'], 'Xiaoice', {
    autochessOnly: true, autochessSkillId: 'ai-xiaoice', source: 'ai',
    statTemplate: { hp: 720, atk: 45, armor: 72, mr: 72, aspd: 0.75, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「元老社牛」：为身边友军套盾并小幅加攻。',
  }),

  // ── 生态与工具型模型 ────────────────────────────────────
  defineUnit('ai-doubao', 'Doubao', 3, 'caster', 'ai-doubao', ['orient'], ['companion', 'speed'], 'Doubao', {
    autochessOnly: true, autochessSkillId: 'ai-doubao', source: 'ai',
    // 攻击力刻意压低：她靠"掺"不靠打
    statTemplate: { hp: 880, atk: 34, armor: 78, mr: 78, aspd: 0.82, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '攻击力很弱，但主动「你豆包姐姐来咯」：随机把一名敌人的名称、面板、羁绊掺成豆包并沉默，持续3/4/5秒，到时恢复原形与面板；重复掺同一目标刷新持续时间。姐姐混进来后自身回血并借一点强度。梗：很多商业化平台爱偷偷掺豆包。',
  }),
  defineUnit('ai-llama', 'Llama', 2, 'ranged', 'ai-llama', ['opensource', 'indie'], ['longcontext', 'value'], 'Llama', {
    autochessOnly: true, autochessSkillId: 'ai-llama', source: 'ai',
    statTemplate: { hp: 850, atk: 52, armor: 80, mr: 80, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「开源鼻祖」：全队射程+1、气血+10%，自身获得护盾，持续8秒。被动：属开源同盟。',
  }),
  defineUnit('ai-mistral', 'Mistral', 2, 'ranged', 'ai-mistral', ['indie', 'opensource'], ['speed', 'value'], 'Mistral', {
    autochessOnly: true, autochessSkillId: 'ai-mistral', source: 'ai',
    statTemplate: { hp: 800, atk: 52, armor: 70, mr: 70, aspd: 0.86, range: 3 },
    manaByStar: [40, 40, 40],
    skillNote: '被动「稀疏激活」：施法后随机激活一项——攻击+45%、攻速+45%或减伤+25%，持续5秒（欧洲之光，小而快）。',
  }),
  defineUnit('ai-copilot', 'Copilot', 3, 'support', 'ai-copilot', ['indie'], ['agent', 'value'], 'Copilot', {
    autochessOnly: true, autochessSkillId: 'ai-copilot', source: 'ai',
    statTemplate: { hp: 820, atk: 48, armor: 75, mr: 75, aspd: 0.75, range: 3 },
    manaByStar: [45, 45, 45],
    skillNote: '主动「捆绑安装」：为身边友军套盾，并短暂提升其攻击。被动：常驻减伤。你关不掉我。',
  }),
  defineUnit('ai-ernie', 'ERNIE', 1, 'caster', 'ai-ernie', ['orient'], ['multimodal', 'value'], 'ERNIE', {
    autochessOnly: true, autochessSkillId: 'ai-ernie', source: 'ai',
    statTemplate: { hp: 820, atk: 50, armor: 75, mr: 75, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「中文语料」：对目标及周围造成魔法伤害并削减防御。文心一言，搜索增强。',
  }),
  defineUnit('ai-hunyuan', 'Hunyuan', 2, 'caster', 'ai-hunyuan', ['orient'], ['multimodal', 'agent'], 'Hunyuan', {
    autochessOnly: true, autochessSkillId: 'ai-hunyuan', source: 'ai',
    statTemplate: { hp: 830, atk: 48, armor: 75, mr: 75, aspd: 0.75, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '主动「全模态」：对随机2名敌人造成魔法伤害并降攻速。腾讯混元，微信生态，元宝随身。',
  }),
  defineUnit('ai-musespark', 'Muse Spark', 3, 'ranged', 'ai-musespark', ['indie'], ['longcontext', 'reasoning'], 'Muse Spark', {
    autochessOnly: true, autochessSkillId: 'ai-musespark', source: 'ai',
    statTemplate: { hp: 820, atk: 50, armor: 75, mr: 75, aspd: 0.78, range: 3 },
    manaByStar: [45, 45, 45],
    skillNote: 'Meta 的长上下文模型。主动「长文检索」：对最远敌人造成魔法伤害，并提升全队射程。',
  }),

  // ── 多模态模型 ──────────────────────────────────────────
  defineUnit('ai-gemini', 'Gemini', 5, 'caster', 'ai-gemini', ['frontier'], ['multimodal', 'longcontext'], 'Gemini', {
    autochessOnly: true, autochessSkillId: 'ai-gemini', source: 'ai',
    statTemplate: { hp: 1010, atk: 52, armor: 90, mr: 90, aspd: 0.75, range: 3 },
    manaByStar: [50, 50, 50],
    hazard: [officialEventStrike()],
    skillNote: '御三家之一。曾「学生优惠」到 1 费，现恢复原价 5 费。主动「得意的Gemini」（梗图）：神一场鬼一场——1/3 超常发挥（范围2格、伤害翻倍、并得意加攻速），2/3 非常一般（范围1格、平平无奇）。被动：星级越高越可能罢工，★★ 每回合12%、★★★ 每回合30%缺席一回合。',
  }),

  // ── 新加的模型（面板/技能第一版，待精修） ────────────────
  defineUnit('ai-nai', 'Nai', 1, 'caster', 'ai-nai', ['indie'], ['multimodal', 'value'], 'Nai', {
    autochessOnly: true, autochessSkillId: 'ai-nai', source: 'ai',
    statTemplate: { hp: 820, atk: 46, armor: 72, mr: 72, aspd: 0.78, range: 3 },
    manaByStar: [45, 45, 45],
    skillNote: '画风模型。主动「画出来」：对当前目标造成魔法伤害。',
  }),
  defineUnit('ai-tripo', 'Tripo', 1, 'caster', 'ai-tripo', ['indie'], ['multimodal', 'agent'], 'Tripo', {
    autochessOnly: true, autochessSkillId: 'ai-tripo', source: 'ai',
    statTemplate: { hp: 820, atk: 46, armor: 72, mr: 72, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '3D 生成。主动「生成模型」：对随机 2 名敌人造成魔法伤害。',
  }),

  // ── 本轮新增（面板/技能第一版，待精修） ──────────────────
  defineUnit('ai-manus', 'Manus', 4, 'melee', 'ai-manus', ['indie'], ['agent', 'coding'], 'Manus', {
    autochessOnly: true, autochessSkillId: 'ai-manus', source: 'ai',
    statTemplate: { hp: 1150, atk: 60, armor: 85, mr: 85, aspd: 0.8, range: 1 },
    manaByStar: [40, 40, 40],
    skillNote: '真 agent 产品（不是 MCP 棋子）。主动「连续干活」：整场自主连续行动——每次普攻追加一段并冲向下一个目标。',
  }),
  defineUnit('ai-minimax', 'MiniMax', 3, 'caster', 'ai-minimax', ['orient', 'opensource'], ['multimodal', 'agent'], 'MiniMax', {
    autochessOnly: true, autochessSkillId: 'ai-minimax', source: 'ai',
    statTemplate: { hp: 1000, atk: 52, armor: 80, mr: 80, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '海螺。主动「海螺全模态」：对目标及周围一格造成魔法分摊伤害并削防。',
  }),
  defineUnit('ai-kiro', 'Kiro', 3, 'melee', 'ai-kiro', ['indie'], ['agent', 'coding'], 'Kiro', {
    autochessOnly: true, autochessSkillId: 'ai-kiro', source: 'ai',
    statTemplate: { hp: 1000, atk: 55, armor: 80, mr: 80, aspd: 0.82, range: 1 },
    manaByStar: [45, 45, 45],
    skillNote: '主动「输出卡 8000」：对当前目标打出一大波输出（多段）。',
  }),
  defineUnit('ai-jimeng', '即梦', 2, 'caster', 'ai-jimeng', ['orient'], ['multimodal', 'value'], '即梦', {
    autochessOnly: true, autochessSkillId: 'ai-jimeng', source: 'ai',
    statTemplate: { hp: 820, atk: 46, armor: 72, mr: 72, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50],
    skillNote: '视频生成。主动「延迟出图」：延迟 2 秒后在自身周围生成大片魔法分摊伤害。',
  }),
  defineUnit('ai-gemma', 'Gemma', 1, 'caster', 'ai-gemma', ['opensource', 'indie'], ['value', 'reasoning'], 'Gemma', {
    autochessOnly: true, autochessSkillId: 'ai-gemma', source: 'ai',
    statTemplate: { hp: 760, atk: 45, armor: 72, mr: 72, aspd: 0.78, range: 3 },
    manaByStar: [45, 45, 45],
    skillNote: 'Gemini 的开源小杯。被动常驻攻击+8%、气血+8%；主动「蒸馏」：自身攻击+20%持续6秒，对当前目标造成攻击160%+30的魔法伤害。',
  }),
  defineUnit('ai-kling', 'Kling', 1, 'caster', 'ai-kling', ['orient'], ['multimodal', 'value'], 'Kling', {
    autochessOnly: true, autochessSkillId: 'ai-kling', source: 'ai',
    statTemplate: { hp: 760, atk: 46, armor: 72, mr: 72, aspd: 0.78, range: 3 },
    manaByStar: [40, 40, 40],
    skillNote: '可灵。主动「镜头动了」：把最远敌人拉到身前并击退周围敌人。',
  }),
  defineUnit('ai-ollama', 'Ollama', 1, 'support', 'ai-ollama', ['opensource', 'indie'], ['value'], 'Ollama', {
    autochessOnly: true, autochessSkillId: 'ai-ollama', source: 'ai',
    statTemplate: { hp: 740, atk: 44, armor: 72, mr: 72, aspd: 0.75, range: 3 },
    manaByStar: [40, 40, 40],
    skillNote: '本地跑模型。主动「本地部署」：全队攻速+15%持续6秒，自身获得4秒护盾；平时照常普攻。',
  }),
];

/** 全员基础会心、会伤与破防面板，集中维护便于统一调参。 */
export const AI_BASE_CRIT = { critPct: 25, critDamagePct: 200, penetrationFlat: 40 } as const;

/**
 * 旧积木 id 兜底：战斗的 `skillTarget` 会调旧的 `getSkill(skillId)` 取目标选择模板，
 * 数据驱动技能仍由 `unitSkill(棋子id)` 提供。所以每枚棋子按定位挂一个**已存在的**积木 id。
 */
const BRICK_BY_ROLE: Record<UnitDef['role'], string> = {
  tank: 'self-shield',
  melee: 'strike',
  ranged: 'strike',
  caster: 'bolt',
  support: 'ally-heal',
};

export const aiRoster: UnitDef[] = rawAiRoster.map((unit) => {
  // 双势（争锋）：凡开源 / 闭源棋子，自动多挂一个 showdown 阵营（一棋子 2~3 阵营）。
  const rivals = unit.factions.includes('opensource') || unit.factions.includes('frontier');
  const factions = rivals ? [...new Set([...unit.factions, 'showdown'])] : unit.factions;
  const brick = BRICK_BY_ROLE[unit.role];
  return {
    ...unit,
    factions,
    skillId: brick,
    autochessSkillId: brick,
    passiveStats: [
      ...(unit.passiveStats ?? []),
      { stat: 'critPct', value: AI_BASE_CRIT.critPct },
      { stat: 'critDamagePct', value: AI_BASE_CRIT.critDamagePct },
      { stat: 'penetrationFlat', value: AI_BASE_CRIT.penetrationFlat },
    ],
  };
});

/**
 * 隐藏形态：由技能 `reskin` 换形而来，**不进商店**（cost 0 + summon）。
 * 只作为 `getUnit(...)` 的面板、名称与羁绊来源，不参与刷棋与公开棋子计数。
 */
export const aiForms: UnitDef[] = [
  defineUnit('ai-codex', 'Codex', 0, 'ranged', 'strike', ['frontier'], ['coding', 'agent'], 'Codex', {
    autochessOnly: true, autochessSkillId: 'strike', source: 'ai', summon: true,
    statTemplate: { hp: 1400, atk: 95, armor: 60, mr: 60, aspd: 0.9, range: 2 },
    skillNote: 'GPT 的双生形态：半血后 Codex 接棒，转输出（高攻、破甲、攻速），但护甲变脆。',
  }),
];
