import { definePack, GENERIC_PACK_TERMS } from '../types';
import { jianghuRoster } from './roster';
import { jianghuItems } from './items';
import { jianghuTraits } from './traits';

export { jianghuRoster } from './roster';
export { jianghuItems } from './items';
export { jianghuTraits } from './traits';

export const jianghuPack = definePack({
  id: 'jianghu',
  displayName: '夜航船',
  icon: '🏮',
  description: 'Cursor 即兴创作的一桌江湖。',
  roster: jianghuRoster,
  traits: jianghuTraits,
  items: jianghuItems,
  terms: GENERIC_PACK_TERMS,
  kitItems: ['jh-travel-lantern', 'jh-rain-cape'],
  /** 暂未声明心悟池：本包没有心悟三选一。 */
  hexes: [],
});
