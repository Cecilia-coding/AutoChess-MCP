/** The board follows the displayed player's equipment, not the matchmaking venue. */
export function roomBoardSkin(view: { seatIndex?: number; seats: readonly ({ skinId?: string } | undefined)[] }): string | undefined {
  // Spectators see seat zero's formation, so use that same seat's board.
  return view.seats[view.seatIndex ?? 0]?.skinId;
}
