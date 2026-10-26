import type { ModePack } from './types';
import { standardRules } from './standard';

export const duelMode = {
  id: 'duel', name: '弈决', description: '1v1 对掏 · 双方 150 血', icon: '⚔',
  createLabel: '开启弈决', lobby: true, seatPolicy: 'fixed', showHpInVersus: true,
  rules: { ...standardRules, seatCount: 2, startHp: 150, lossDamageScale: 0.65 },
} as const satisfies ModePack;
