/**
 * 像素游乐摊 · 功能包注册表。
 * 以后加新玩法（例如赌石、推币机）只需在这里添一个功能包实例。
 */
import type { ArcadeGamePlugin } from './arcade';
import { slotMachineGame } from './arcade-games/slot-machine';
import { scratchcardGame } from './arcade-games/scratchcard';

export const ARCADE_GAMES: readonly ArcadeGamePlugin[] = [
  slotMachineGame,
  scratchcardGame,
] as const;

export function arcadeGameById(id: string | undefined): ArcadeGamePlugin | undefined {
  return ARCADE_GAMES.find(game => game.meta.id === id);
}

export function arcadeGameCatalog() {
  return ARCADE_GAMES.map(game => game.meta);
}
