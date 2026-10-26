import type { WheelPrize, WheelView } from './wheel';
import { cosmeticById } from './cosmetics';

/** Copy uses the persisted prize, never the prototype's sample reward or sender. */
export function wheelRewardLetter(prize: WheelPrize) {
  const gifted = prize.source === 'gift';
  return {
    gifted,
    sender: gifted ? prize.from?.name ?? '一位棋友' : '对对碰',
    source: gifted ? '友人捎礼' : prize.source === 'points' ? '积分兑换' : '全清小奖',
    title: gifted ? '白鸽捎来一份心意' : '白鸽衔来这一份好运',
    note: prize.note?.trim() || null,
    intro: prize.spec.reward.kind === 'cosmetic' ? cosmeticById(prize.spec.reward.cosmeticId)?.giftIntro ?? null : null,
    claimable: prize.status === 'pending' && prize.spec.reward.kind === 'cosmetic',
  };
}

export function wheelRewardWasClaimed(view: WheelView, prizeId: string) {
  return view.state.prizes.some(prize => prize.id === prizeId && prize.status === 'used' && prize.spec.reward.kind === 'cosmetic');
}
