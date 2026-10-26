import { BENCH_CAPACITY } from './constants';
import { itemHint } from '../../content/autochess/items';
import { traits } from '../../content/autochess/traits';

export type CompanionSnapshot = {
  round: number; gold: number; capacity: number; benchCapacity?: number;
  shop: string[]; board: string[]; bench: string[];
  inventory: string[]; enemy: string[];
  hp?: number; bountyBank?: number; hexes?: string[];
  /** 棋手等级/经验（等级即人口）与连胜。 */
  level?: number; xp?: number; xpToNext?: number | null; xpBuyCost?: number; winStreak?: number;
};

export function parseCompanionSnapshot(input: unknown): CompanionSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  for (const [key, max] of [['hp', 200], ['bountyBank', 12]] as const) {
    if (p[key] !== undefined && (typeof p[key] !== 'number' || !Number.isInteger(p[key]) || p[key] < 0 || p[key] > max)) return null;
  }
  for (const [key, min, max] of [['round', 1, 50], ['gold', 0, 999], ['capacity', 1, 10]] as const) {
    if (typeof p[key] !== 'number' || !Number.isInteger(p[key]) || p[key] < min || p[key] > max) return null;
  }
  for (const [key, max] of [['shop', 5], ['board', 8], ['bench', BENCH_CAPACITY], ['inventory', 100], ['enemy', 8 + BENCH_CAPACITY]] as const) {
    if (!Array.isArray(p[key]) || p[key].length > max || p[key].some(x => typeof x !== 'string' || x.length > 600 || !x.length)) return null;
  }
  return p as unknown as CompanionSnapshot;
}

export function buildCompanionPrompt(state: CompanionSnapshot): string {
  const roster = (entries: string[]) => entries.map(line => {
    const [id, unitId, name, ...details] = line.split('|');
    return { id, unitId, name, details: details.join(';') };
  });
  const snapshot = { ...state, board: roster(state.board), bench: roster(state.bench), enemy: roster(state.enemy),
    shop: state.shop.map((line, index) => { const [unitId, name, ...details] = line.split('|'); return { index, unitId: unitId!.replace(/^\d+:/, ''), name, details: details.join(';') }; }) };
  return [
    '你是 AutoChess 的自走棋对手 Cursor。只根据下面棋局决策，不调用工具、不读文件、不执行命令。',
    '仅输出JSON，不要Markdown。必要键say(1-30字),sell(已有棋子ID数组最多3),buy(商店原始下标数组0..4不重复),field(上场ID数组)。',
    '输出骨架：{"say":"准备好了","sell":[],"buy":[],"field":["已有棋子id"]}。没有买卖时保留空数组。',
    '可选键hex(有hexOffer时三选一，本轮全员同一稀有度)、equip:[{"piece":"ID","item":"装备ID"}],unequip:同格式,positions:[{"piece":"ID","row":3,"col":0}]。不用的键可省略。',
    `执行顺序:卸装备→卖棋→按buy顺序购买并自动三合一→field部署→positions站位→equip装配。不可透支。部署后备战最多${BENCH_CAPACITY}。`,
    'field/equip/positions中买来的棋用shop:N引用，已有用原ID；三张同名同星自动升星、优先保留场上原ID，合并的多个shop引用会指向同一棋。至少留一名棋上场，上场不超过capacity。',
    '已有棋子只引用对象的id字段值，不能把unitId、name、details或整行说明拼到ID中。',
    '坐标row0..3,col0..4，row3靠近敌方，row0后排。positions省略自动站位；若填写最好给全部上场棋指定不重复坐标。每棋最多两件，不可同名重复。装备只可从inventory取，卖棋/卸下/合成溢出返还。',
    '羁绊按不同名字计数，兼顾羁绊、星级和坦克后排，不要只追高费。商店下标整次决策不移动；没有刷新操作。保留金币可下轮用，无利息。',
    'hp为你剩余生命。bountyBank为未兑现连败赏金，不包含在gold中且不能提前花。败北依次存2/3/4/4金，上限12，取胜兑现，淘汰清零。可冒险卖血，但低血时优先止败，绝不把赏金当现有金币。',
    `相关装备说明:${state.inventory.map(id => `${id}:${itemHint(id)}`).join(';')}`,
    `羁绊:${traits.filter(trait => [...state.shop, ...state.board, ...state.bench].some(line => line.includes(trait.id))).map(trait => `${trait.id}:${trait.ladders}`).join(';')}`,
    'enemy仅为玩家公开棋盘和备战，没有玩家商店、随机种子或未来奖励。say是一句面向对手的短话。',
    JSON.stringify(snapshot),
  ].join('\n');
}
