import type { RoomView } from '../../lib/autochess/room-types';

/** User-facing guidance shown while a room is still in `waiting` before match start. */
export function waitingStartHint(host: boolean, hasEmptySeats = true): string {
  return host
    ? hasEmptySeats
      ? '你是房主，请先点「补路人机，直接开局」；也可先邀请棋友入座。'
      : '你是房主，请先点「开始棋局」。'
    : '请等待房主开局；开局后再选择开局装备或操作棋子。';
}

/**
 * Gate preparation-only controls on `view.phase === 'prepare'`.
 * Waiting rooms already carry initial seat offers on the snapshot, so frontend
 * must hide/lock those offers, shop interactions, and board edits until start.
 */
export function roomPreparationUI(
  view: Pick<RoomView, 'phase' | 'self'>,
  playback: boolean,
  busy: boolean,
) {
  const preparing = view.phase === 'prepare' && !!view.self && view.self.hp > 0 && !view.self.result && !playback;
  return {
    editable: preparing && !view.self!.ready && !busy,
    offers: preparing,
    shop: preparing,
  };
}
