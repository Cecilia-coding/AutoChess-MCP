/**
 * RP 梗包 —— 心悟部分（可选挂载，默认不生效）。
 *
 * 挂载方式：环境开关 `CHESS_RP=1`（见 packs/registry.ts 的 packHexes）。
 * 效果一律走 `HexDef.roundEffect`（回合级、限时几轮），由房间层结算；引擎不认具体 id。
 */
import type { HexDef } from '../../content/autochess/types';

export const rpHexes: HexDef[] = [
  {
    id: 'rp-roar', name: '低吼一声', rarity: 'purple',
    note: '* 低吼一声：**下一轮**某个棋子攻击 **×2**。',
    roundEffect: { kind: 'stat', pick: 'random', stat: 'atkPct', value: 100, rounds: 1 },
  },
  {
    id: 'rp-beast', name: '野兽一般', rarity: 'purple',
    note: '* 野兽一般：**下一轮**全队攻击 **+25%**，持续 **2 轮**。',
    roundEffect: { kind: 'stat', pick: 'all', stat: 'atkPct', value: 25, rounds: 2 },
  },
  {
    id: 'rp-sleep', name: '睡吧，我守着', rarity: 'gold',
    note: '* 睡吧，我守着：**2 轮**内不扣气血。',
    roundEffect: { kind: 'noHpLoss', rounds: 2 },
  },
  {
    id: 'rp-slow', name: '慢点吃，没人跟你抢', rarity: 'purple',
    note: '* 慢点吃，没人跟你抢：**下一轮**对手内力回复变慢 **30%**，持续 **2 轮**。',
    roundEffect: { kind: 'foeManaSlow', value: 30, rounds: 2 },
  },
  {
    id: 'rp-cashback', name: '连本带利', rarity: 'gold',
    note: '* 连本带利：**2 轮**内刷新 / 买棋的花费到期**连本带利**返还。',
    roundEffect: { kind: 'cashback', rounds: 2 },
  },
  {
    id: 'rp-infect', name: '极其', rarity: 'purple',
    note: '* 极其：小概率**感染**一枚棋子，攻击持续下降、会**繁殖**，**几轮后自愈**；卖掉也能清除。',
    roundEffect: { kind: 'infect', chance: 35, value: 8, rounds: 3 },
  },
  {
    id: 'rp-but', name: '不是而是', rarity: 'blue',
    note: '* 不是而是：**3 轮**内每轮 **3 次免费刷新**。',
    roundEffect: { kind: 'freeRefresh', perRound: 3, rounds: 3 },
  },
];
