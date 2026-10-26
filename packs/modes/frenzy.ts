import type { ModePack } from './types';
import { standardRules } from './standard';

export const frenzyMode = {
  id: 'frenzy', name: '狂战', description: '心悟更密，商店更快', icon: '✹',
  createLabel: '开启狂战', lobby: false, seatPolicy: 'configurable', showHpInVersus: false,
  rules: { ...standardRules, hexEvery: 2, hexFirst: 2,
    hexRarities: ['blue', 'purple', 'gold', 'gold', 'orange'], shopCostEvery: 2, fieldCapEvery: 1 },
} as const satisfies ModePack;
