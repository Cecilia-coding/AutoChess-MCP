import type { HexRarity } from '../../content/autochess/types';

export type ModeRules = {
  seatCount: number;
  finishWhenLiving: number;
  /** Safety valve only. Designed end is last player standing. */
  hardRoundCap: number;
  /** Heart-hex every N rounds. Frenzy shortens this. */
  hexEvery: number;
  hexFirst: number;
  /** Pick 1, 2, 3… use these rarities then hold the last. Same round ⇒ same rarity for everyone. */
  hexRarities: HexRarity[];
  startHp: number;
  /** 阵亡/平局扣血缩放：默认 1；短局模式（如 1v1）用它收节奏，不影响其他模式。 */
  lossDamageScale?: number;
  income: number;
  /** 基础利息：每 10 金给 1 金，封顶这个数（生财有道把它抬到 10）。 */
  interestCap: number;
  shopCostStart: number;
  shopCostEvery: number;
  fieldCapEvery: number;
};

export type ModePack = {
  id: string;
  name: string;
  description: string;
  icon: string;
  createLabel: string;
  lobby: boolean;
  seatPolicy: 'fixed' | 'configurable';
  showHpInVersus: boolean;
  rules: ModeRules;
};
