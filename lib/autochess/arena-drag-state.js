// Opponent polling updates may rebuild actors without interrupting our unchanged piece.
export function canKeepArenaDrag(previous,next,pieceId) {
  return !!pieceId && previous.editable && next.editable && !previous.battle && !next.battle
    && JSON.stringify([previous.board,previous.bench])===JSON.stringify([next.board,next.bench]);
}
