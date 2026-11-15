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
  presentation: { renderer: 'pixel-2d', appearanceId: 'jianghu-pixels', soundId: 'jianghu-sound' },
  /** 暂未声明心悟池：本包没有心悟三选一。 */
  hexes: [],
  /** 选秀引导语与《夜航船》水路地名（与公共 18 格机制拓扑一一对应）。 */
  draftIntro: '江湖豪侠、随身兵刃、盘缠补给或风波奇遇，都藏在这趟夜航水路里。',
  draftTiles: [
    { name: '钱塘渡口', detail: '登船' },
    { name: '运河夜泊', detail: '逢友' },
    { name: '水驿账房', detail: '点兵' },
    { name: '芦花茶棚', detail: '打尖' },
    { name: '瓦舍夜市', detail: '淘货' },
    { name: '枫桥客栈', detail: '歇脚' },
    { name: '兰亭古渡', detail: '问津' },
    { name: '黑风险关', detail: '闯关' },
    { name: '烟雨长堤', detail: '问路' },
    { name: '百货船市', detail: '捡漏' },
    { name: '回春药庐', detail: '调息' },
    { name: '梨园戏台', detail: '听书' },
    { name: '长明灯坊', detail: '祈福' },
    { name: '巡检水关', detail: '盘查' },
    { name: '乱石暗礁', detail: '涉险' },
    { name: '寒山雾渡', detail: '摸黑' },
    { name: '听雨船篷', detail: '养神' },
    { name: '江南早埠', detail: '靠岸' },
  ],
});
