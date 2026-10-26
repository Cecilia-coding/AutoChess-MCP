import { findHex } from '../../content/autochess/hexes';
import { findUnit } from '../../content/autochess/units';
import type { RoomSelf } from './room-types';

export type RoomStatusEntry = {
  id: string;
  tone: 'buff' | 'debuff' | 'resource';
  title: string;
  detail: string;
};

const remaining = (until: number, round: number) => `余 ${Math.max(0, until - round + 1)} 轮`;

function activeHexDetail(self: Partial<RoomSelf>, id: string, round: number): string | null {
  const hex = findHex(id);
  if (!hex) return null;
  if (!hex.roundEffect) return hex.note;
  const until = self.roundFx?.[id];
  if (until === undefined) return `${hex.note} · 下回合生效`;
  if (until < round) return null;
  const tail = `持续至第 ${until} 轮 · ${remaining(until, round)}`;
  if (hex.roundEffect.kind === 'freeRefresh') return `本轮免费刷新 ${self.freeRefreshes?.left ?? hex.roundEffect.perRound}/${hex.roundEffect.perRound} 次 · ${tail}`;
  if (hex.roundEffect.kind === 'noHpLoss') return `本轮不会扣棋手气血 · ${tail}`;
  if (hex.roundEffect.kind === 'cashback') return `已记账 ${self.cashbackSpent ?? 0} 金，到期返还 · ${tail}`;
  if (hex.roundEffect.kind === 'foeManaSlow') return `对手内力回复 -${hex.roundEffect.value}% · ${tail}`;
  return `${hex.note} · ${tail}`;
}

export function roomStatusEntries(self: Partial<RoomSelf>, round: number): RoomStatusEntry[] {
  const entries: RoomStatusEntry[] = [];
  const add = (entry: RoomStatusEntry) => entries.push(entry);
  for (const id of self.hexes ?? []) {
    const hex = findHex(id); const detail = activeHexDetail(self, id, round);
    if (hex && detail) add({ id: `hex:${id}`, tone: 'buff', title: hex.name, detail });
  }
  if ((self.winStreak ?? 0) > 0) add({ id: 'win-streak', tone: 'buff', title: `连胜 ×${self.winStreak}`, detail: '连胜金币正在累积。' });
  if ((self.bounty?.bank ?? 0) > 0) add({ id: 'bounty', tone: 'buff', title: `止败赏金 ${self.bounty!.bank} 金`, detail: '下次取胜领取；淘汰时清零。' });
  if (self.shopBanUntil !== undefined && self.shopBanUntil >= round) add({ id: 'shop-ban', tone: 'debuff', title: '养精蓄锐', detail: `商店购买封印至第 ${self.shopBanUntil} 轮。` });
  const hazards = self.roundHazards;
  if (hazards?.round === round) {
    for (const ban of hazards.banned ?? []) add({ id: `ban:${ban.pieceId}`, tone: 'debuff', title: `${ban.name} · 账号封禁`, detail: `查 IP 命中 ${Math.round(ban.chancePct)}%${ban.refundGold ? ` · 返还 ${ban.refundGold} 金` : ''}${ban.returnedItems?.length ? ` · ${ban.returnedItems.length} 件装备已退回背包` : ''}` });
    const roster = [...(self.board ?? []), ...(self.bench ?? [])];
    for (const id of hazards.struck ?? []) {
      const piece = roster.find(entry => entry.id === id);
      add({ id: `strike:${id}`, tone: 'debuff', title: `${piece ? findUnit(piece.templateId)?.name ?? piece.templateId : '棋子'} · 官方活动`, detail: '本回合罢工，不会参加战斗。' });
    }
    for (const id of hazards.soldOut ?? []) add({ id: `soldout:${id}`, tone: 'debuff', title: `${findUnit(id)?.name ?? id} · 售罄`, detail: '本回合商店里买不到。' });
    for (const [id, delta] of Object.entries(hazards.priceDelta ?? {})) if (delta !== 0) add({ id: `price:${id}`, tone: delta > 0 ? 'debuff' : 'buff', title: `${findUnit(id)?.name ?? id} ${delta > 0 ? '涨价' : '折扣'}`, detail: `本回合价格 ${delta > 0 ? '+' : ''}${delta}。` });
  }
  return entries;
}
