import type { ItemBoxGrant, ItemDef } from '../../content/autochess/types';
import type { Rng } from './rng';

/** 某品阶可开的候选装备池。引擎不认识具体宝箱，只认品阶。 */
export function itemBoxPool(
  family: string,
  loot: readonly ItemDef[],
  excluded: ReadonlySet<string> = new Set(),
): string[] {
  return loot.filter((item) => item.family === family && !excluded.has(item.id)).map((item) => item.id);
}

/**
 * 按数据声明开启若干「选 1」宝箱：每个箱子从同品阶池里抽 `options` 件不重复候选。
 * 返回的每个子数组就是一箱的候选，房间按顺序让棋手各选 1 件。
 */
export function openItemBoxes(input: {
  grants: readonly ItemBoxGrant[];
  loot: readonly ItemDef[];
  rng: Rng;
  excluded?: ReadonlySet<string>;
}): string[][] {
  const excluded = new Set(input.excluded ?? []);
  const boxes: string[][] = [];
  for (const grant of input.grants) {
    const pool = itemBoxPool(grant.family, input.loot, excluded);
    if (!pool.length) continue;
    for (let index = 0; index < Math.max(0, grant.count); index += 1) {
      const remaining = [...pool];
      const choices: string[] = [];
      const take = Math.min(grant.options, remaining.length);
      while (choices.length < take) {
        const pick = remaining.splice(input.rng.int(remaining.length), 1)[0]!;
        choices.push(pick);
      }
      if (choices.length) boxes.push(choices);
    }
  }
  return boxes;
}
