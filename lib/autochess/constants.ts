export const BENCH_CAPACITY = 9;
export const BENCH_SLOT_SPACING = 1.15;
export const BOARD_ROWS = 8;
export const BOARD_COLS = 5;
export const HALF_ROWS = 4;
export const TICK_MS = 100;
export const MAX_BATTLE_MS = 30_000;
export const AUTOCHESS_MAX_BATTLE_MS = 45_000;
export const SUDDEN_DEATH_MS = 18_000;
/** Damage bonus per whole second of overtime, and its ceiling. */
export const SUDDEN_DEATH_STEP = 0.15;
export const SUDDEN_DEATH_MAX_BONUS = 1.5;
export const MOVE_MS = 500;
export const MANA_MAX = 80;
export const MANA_ON_HIT = 10;
export const MANA_ON_TAKEN = 5;
export const MANA_TAKEN_CAP_PER_SEC = 20;
/** 基础内力回复（每秒）；「内力回复 +X%」按这个基数放大。文档未给基数，这里是可调假设。 */
export const MANA_REGEN_BASE_PER_SEC = 10;
export const MOVE_CELLS_PER_SEC = 2;
export const ASPD_CAP = 2.5;
export const SHIELD_CAP_PCT = 40;
export const HEAL_SHIELD_CAP_PCT = 50;
export const SLICE_POP_CAP = 8;
export const SLICE_SHOP_ODDS = { 1: 50, 2: 30, 3: 15, 4: 5 } as const;
export { COST_MULT, STAR_MULT } from '../../content/autochess/roles';
export const RULES_VERSION = 'autochess-c1-13';
export const CONFIG_VERSION = 'autochess-core-2026-10-26';
export const EXTRA_DR_CAP = 45;
