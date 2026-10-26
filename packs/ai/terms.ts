/**
 * 「人机棋」术语表 —— AI 包的主题化命名唯一来源。
 *
 * 这些映射是主题界面的扩展数据。经济、等级与能量仍由共享引擎处理；
 * 当前公开界面使用通用叫法，二改主题 UI 时可以从这里统一读取标签。
 */
export const AI_TERMS = {
  /** 金币 → Token。 */
  gold: {
    name: 'Token',
    short: 'Token',
    desc: '购买模型、升级显存。',
    /** 利息：每存 `per` 点，下回合 +1「余热算力」。 */
    interest: { name: '余热算力', per: 10, cap: 5 },
  },
  /** 经验与人口 → 参数规模。等级即部署节点（棋子上限），也抬高高阶模型的刷出率。 */
  level: {
    name: '参数规模',
    desc: '每升一级可多部署一个节点（棋子上限），并提升高阶大模型的刷出概率。',
    ladder: ['7B', '14B', '32B', '70B', 'MoE', '405B'],
  },
  /** 蓝条 → 上下文长度。普攻/受击累积 Token，满则触发技能，随后清空 KV Cache。 */
  mana: {
    name: '上下文长度',
    unit: 'Token',
    desc: '普攻/受击增加 Token 计数；Token 达到上限触发 Prompt 补全（技能释放），随后清空缓存（KV Cache 清除）。',
  },
  /** 刷新商店 → 重新生成（采样重 roll）。 */
  reroll: {
    name: '重新生成',
    cost: 2,
    desc: '每次消耗 2 FLOPs 进行一次采样重 roll。',
  },
  /** 棋子升星 → 精度量化。 */
  star: {
    name: '精度量化',
    tiers: ['INT4', 'FP16', 'FP32'],
    desc: '1星 INT4 残血量化 → 2星 FP16 半精度 → 3星 FP32 满血浮点。',
  },
} as const;

/** 星级 → 精度标签（1★ INT4 / 2★ FP16 / 3★ FP32）。 */
export function quantizationLabel(star: number): string {
  return AI_TERMS.star.tiers[Math.max(0, Math.min(2, Math.floor(star) - 1))];
}

/** 参数规模档位标签（按等级 1..N）。 */
export function parameterSizeLabel(level: number): string {
  const ladder = AI_TERMS.level.ladder;
  return ladder[Math.max(0, Math.min(ladder.length - 1, Math.floor(level) - 1))];
}
