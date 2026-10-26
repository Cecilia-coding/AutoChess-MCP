import type { Role } from './types';

export type RoleBase = {
  hp: number;
  atk: number;
  aspd: number;
  armor: number;
  mr: number;
  range: number;
};

/**
 * 1-star, cost-1 baseline per role. Everything else scales off this table,
 * so retuning the whole game starts here.
 */
export const ROLE_BASE: Record<Role, RoleBase> = {
  tank: { hp: 720, atk: 40, aspd: 0.7, armor: 35, mr: 25, range: 1 },
  melee: { hp: 580, atk: 56, aspd: 0.9, armor: 25, mr: 20, range: 1 },
  ranged: { hp: 430, atk: 53, aspd: 0.85, armor: 15, mr: 15, range: 3 },
  caster: { hp: 450, atk: 37, aspd: 0.7, armor: 15, mr: 20, range: 3 },
  support: { hp: 500, atk: 35, aspd: 0.7, armor: 20, mr: 25, range: 3 },
};

/** Cost 0 is a free companion: same body as a 1-cost, but absent from the shop. */
export const COST_MULT: Record<number, number> = {
  0: 1,
  1: 1,
  2: 1.15,
  3: 1.32,
  4: 1.52,
  5: 1.75,
  6: 2.05,
};

/** TFT-style: 2★ ≈ 1.8×, 3★ ≈ 1.8². */
export const STAR_MULT = [0, 1, 1.8, 3.24] as const;

/** Backward-compatible high-cost attack curve; use the helper for live combat. */
export const AUTOCHESS_ATK_STAR_MULT = [0, 1, 1.5, 3.375] as const;

export function autochessAtkStarMultiplier(cost: number, star: 1 | 2 | 3): number {
  if (star === 1) return 1;
  if (star === 2) return cost <= 2 ? 2.1 : 1.5;
  return cost >= 4 ? 3.375 : cost <= 2 ? 2.9 : 2.25;
}

/**
 * High-cost 3★ pieces are chase win conditions. Low-cost pieces keep the old
 * curve so an early 3★ does not erase the value of the late shop.
 */
export function autochessHpStarMultiplier(cost: number, star: 1 | 2 | 3): number {
  if (star === 1) return 1;
  if (star === 2) return cost <= 2 ? 2.3 : 1.8;
  if (cost >= 5) return 9.72;
  if (cost === 4) return 6.48;
  return 3.24;
}

export const roleLabel: Record<Role, string> = {
  tank: '前排',
  melee: '近战',
  ranged: '远程',
  caster: '法系',
  support: '辅助',
};
