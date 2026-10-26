/**
 * RP 梗包 —— 装备部分（可选挂载，默认不生效）。
 *
 * 挂载方式：环境开关 `CHESS_RP=1`。开启后本包装备并入掉落池。
 * 「阵亡时触发」类效果走 `ItemDef.triggers` 的 `on:'death'` 通道（复用技能原语，引擎不认具体 id）。
 */
import type { ItemDef } from '../../content/autochess/types';

export const rpItems: ItemDef[] = [
  {
    id: 'rp-stone', name: '一颗石子投入平静的湖面', color: '#8d6bb8', family: 'epic',
    atk: 0, hp: 0, armor: 0, mr: 0, aspdPct: 0, skillPct: 0,
    triggers: [{ on: 'death', effects: [
      { op: 'damage', at: 'self', radius: 1, share: true, type: 'true', scale: { atkPct: 40 } },
    ] }],
    note: '* 携带者阵亡时，在自身周围 1 格激起涟漪：造成 **40% 攻击** 的真实伤害。',
  },
  {
    id: 'rp-bloodbone', name: '揉进骨血', color: '#8d6bb8', family: 'purple',
    atk: 0, hp: 0, armor: 0, mr: 0, aspdPct: 0, skillPct: 0,
    triggers: [{ on: 'death', effects: [
      { op: 'buff', at: 'allies', stat: 'atkPct', value: 6, ms: 999_999 },
    ] }],
    note: '* 携带者阵亡时把意志揉进骨血：全体存活友军永久 **+6% 攻击**（可叠加）。',
  },
];
