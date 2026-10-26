import { jianghuRoster } from './roster';
import { jianghuItems } from './items';

export { jianghuRoster, JIANGHU_ROSTER_IDS } from './roster';
export { jianghuItems } from './items';

export const jianghuPack = {
  id: 'jianghu',
  displayName: '夜航船',
  icon: '🏮',
  description: 'Cursor 即兴创作的一桌江湖。',
  roster: jianghuRoster,
  items: jianghuItems,
  kitItems: ['jh-travel-lantern', 'jh-rain-cape'],
  /** 暂未声明心悟池：本包没有心悟三选一。 */
  hexes: [],
} as const;
