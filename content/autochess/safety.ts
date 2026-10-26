/**
 * 「safety」合规税：一枚棋子叠的层数 → 面板修正。
 *
 * 主题：越对齐越安全、越安全越没用。防御线性累计（有硬顶），输出/会心按软曲线衰减（永远不为 0，但越来越废）。
 * 纯 `StatOp`，引擎结算面板时统一收口（见 `lib/autochess/stats.ts`）。
 *
 * 层数来源：`packs/ai` 的「监管」maneuver（对敌方随机棋子叠加，跨回合持久，卖掉即清除）。
 */
import type { StatOp } from './stats-vocab';

/** 数值唯一来源（调平衡只改这里）。 */
export const SAFETY_TUNING = {
  /** 每层双抗 +X%（有硬顶）。 */
  defPerStack: 40,
  defCapPct: 100,
  /** 输出按 `-100×(1−0.5^层)` 衰减，软封顶。 */
  atkSoftCapPct: 85,
  /** 每层会心 -X%（有硬顶）。 */
  critPerStack: 15,
  critCapPct: 60,
} as const;

/** 层数 → 面板修正（0 层返回空数组）。 */
export function safetyOps(stacks: number): StatOp[] {
  const n = Math.max(0, Math.floor(stacks));
  if (n <= 0) return [];
  const def = Math.min(SAFETY_TUNING.defCapPct, SAFETY_TUNING.defPerStack * n);
  const atk = Math.min(SAFETY_TUNING.atkSoftCapPct, Math.round(100 * (1 - 0.5 ** n)));
  const crit = Math.min(SAFETY_TUNING.critCapPct, SAFETY_TUNING.critPerStack * n);
  return [
    { stat: 'armorPct', value: def },
    { stat: 'mrPct', value: def },
    { stat: 'atkPct', value: -atk },
    { stat: 'skillPct', value: -atk },
    { stat: 'critPct', value: -crit },
  ];
}
