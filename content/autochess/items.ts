import type { Rng } from '../../lib/autochess/rng';
import { aiItems } from '../../packs/ai/items';
import { AI_ROSTER_IDS } from '../../packs/ai/roster';
import { jianghuItems } from '../../packs/jianghu/items';
import { JIANGHU_ROSTER_IDS } from '../../packs/jianghu/roster';
import { rpItems } from '../../packs/rp/items';
import type { ItemDef } from './types';

const RP_ENABLED = process.env.CHESS_RP === '1';

export const items: ItemDef[] = [...aiItems, ...jianghuItems, ...(RP_ENABLED ? rpItems : [])];
export const orbItems: ItemDef[] = [];

export function lootForRoster(roster: readonly { id: string }[]): ItemDef[] {
  const aiMatches = roster.filter((unit) => AI_ROSTER_IDS.has(unit.id)).length;
  const jianghuMatches = roster.filter((unit) => JIANGHU_ROSTER_IDS.has(unit.id)).length;
  const packItems = jianghuMatches > aiMatches ? jianghuItems : aiItems;
  return [...packItems, ...(RP_ENABLED ? rpItems : [])];
}

function describeItem(item: ItemDef): string {
  const parts: string[] = [];
  if (item.atkPct) parts.push(`攻击 +${item.atkPct}%`);
  if (item.skillPct) parts.push(`技能伤害 +${item.skillPct}%`);
  if (item.hpPct) parts.push(`生命 +${item.hpPct}%`);
  if (item.armorPct || item.mrPct) parts.push(`双抗 +${Math.max(item.armorPct ?? 0, item.mrPct ?? 0)}%`);
  if (item.penetrationPct) parts.push(`破甲/穿透 ${item.penetrationPct}%`);
  if (item.dodgePct) parts.push(`闪避 +${item.dodgePct}%`);
  if (item.drPct) parts.push(`减伤 +${item.drPct}%`);
  if (item.rangeBonus) parts.push(`射程 +${item.rangeBonus}`);
  if (item.note) parts.push(item.note);
  return parts.join('；') || item.family;
}

export const itemHints: Record<string, string> = Object.fromEntries(items.map((item) => [item.id, describeItem(item)]));
export const itemArtNeeds: Record<string, string> = Object.fromEntries(items.map((item) => [item.id, `${item.color} ${item.family}`]));

export function getItem(id: string): ItemDef {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`unknown item: ${id}`);
  return item;
}

export function itemHint(id: string): string {
  return itemHints[id] ?? '装备';
}

export function findItemTemplate(id: string): ItemDef | null {
  return items.find((entry) => entry.id === id) ?? null;
}

export const MAX_ITEMS_PER_UNIT = 2;

export function drawSwords(pool: readonly string[], count: number, rng: Rng): string[] {
  const available = [...pool];
  const drawn: string[] = [];
  while (drawn.length < count && available.length) drawn.push(available.splice(rng.int(available.length), 1)[0]);
  return drawn;
}

export function swordTierForRound(round: number): number {
  return round <= 2 ? 0 : round <= 5 ? 1 : 2;
}
