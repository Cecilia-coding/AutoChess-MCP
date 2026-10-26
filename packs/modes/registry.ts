import { standardMode } from './standard';
import { duelMode } from './duel';
import { frenzyMode } from './frenzy';

/** 模式包与棋谱包独立组合；新增模式只需在此注册。 */
export const MODE_PACKS = { standard: standardMode, duel: duelMode, frenzy: frenzyMode } as const;
export type MatchModeId = keyof typeof MODE_PACKS;
export const DEFAULT_MODE: MatchModeId = 'standard';
export const LOBBY_MODES = Object.values(MODE_PACKS).filter(mode => mode.lobby);
export function isMatchMode(value: unknown): value is MatchModeId {
  return typeof value === 'string' && Object.hasOwn(MODE_PACKS, value);
}
export function modePack(value?: string | null) {
  return MODE_PACKS[isMatchMode(value) ? value : DEFAULT_MODE];
}
export function isLobbyMode(value: unknown): value is MatchModeId {
  return isMatchMode(value) && MODE_PACKS[value].lobby;
}
