/**
 * AI 包的「监管」数据工厂（对敌方施加、跨回合持久的标记）。
 *
 * 与 `hazards.ts` 相反：那里是"自己棋子的风险"，这里是"主动给对手挂的东西"。
 * 数值集中在这里，工厂产出 `UnitManeuver`；判定在 `lib/autochess/maneuvers.ts`。
 */
import type { UnitManeuver } from '../../content/autochess/types';

export const AI_MANEUVER_TUNING = {
  /** safety 合规税：触发节奏与叠层上限。 */
  safetyTax: {
    trigger: 'roundWin' as const,
    perTrigger: 1,
    maxStacks: 4,
  },
} as const;

/**
 * 「safety 合规税」：每次己方赢下交手，给对面**随机一枚**棋子盖一层 safety。
 * 越盖越肉、输出与会心越来越少；对方**卖掉那枚棋子即清除**（唯一反制）。
 */
export function safetyTax(overrides: Partial<UnitManeuver> = {}): UnitManeuver {
  const t = AI_MANEUVER_TUNING.safetyTax;
  return {
    id: 'safety-tax',
    label: 'safety 合规税',
    trigger: t.trigger,
    target: 'randomFoe',
    effect: 'safety',
    perTrigger: t.perTrigger,
    maxStacks: t.maxStacks,
    note: '赢下交手就给对面随机一枚棋子盖一层 safety；卖掉它才能清掉。',
    ...overrides,
  };
}
