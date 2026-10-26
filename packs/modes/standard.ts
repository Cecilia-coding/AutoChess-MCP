import type { ModePack, ModeRules } from './types';

export const standardRules: ModeRules = {
  seatCount: 8,
  finishWhenLiving: 1,
  hardRoundCap: 50,
  hexEvery: 3,
  hexFirst: 3,
  hexRarities: ['blue', 'blue', 'purple', 'purple', 'orange'],
  startHp: 100,
  income: 5,
  interestCap: 4,
  shopCostStart: 1,
  shopCostEvery: 3,
  fieldCapEvery: 2,
};

export const standardMode = {
  id: 'standard', name: '多人对弈', description: '轮流交手，留到最后', icon: '✦',
  createLabel: '辟立对弈棋局', lobby: true, seatPolicy: 'configurable', showHpInVersus: false,
  rules: standardRules,
} as const satisfies ModePack;
