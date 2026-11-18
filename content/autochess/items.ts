import type { Rng } from '../../lib/autochess/rng';
import { findEphemeralItem } from '../../packs/ephemeral-registry';
import { allPackItems, packItems } from '../../packs/registry';
import type { ItemDef } from './types';

export const items: ItemDef[] = allPackItems();
export const orbItems: ItemDef[] = [];

export function lootForPack(packId?: string): ItemDef[] {
  return packItems(packId);
}

export function describeItem(item: ItemDef): string {
  const parts: string[] = [];
  if (item.atkPct) parts.push(`攻击 +${item.atkPct}%`);
  if (item.atk) parts.push(`攻击 +${item.atk}`);
  if (item.skillPct) parts.push(`技能伤害 +${item.skillPct}%`);
  if (item.hpPct) parts.push(`生命 +${item.hpPct}%`);
  if (item.hp) parts.push(`生命 +${item.hp}`);
  if (item.aspdPct) parts.push(`攻速 +${item.aspdPct}%`);
  if (item.armor) parts.push(`护甲 +${item.armor}`);
  if (item.mr) parts.push(`魔抗 +${item.mr}`);
  if (item.armorPct || item.mrPct) parts.push(`双抗 +${Math.max(item.armorPct ?? 0, item.mrPct ?? 0)}%`);
  if (item.penetrationPct) parts.push(`破甲/穿透 ${item.penetrationPct}%`);
  if (item.dodgePct) parts.push(`闪避 +${item.dodgePct}%`);
  if (item.drPct) parts.push(`减伤 +${item.drPct}%`);
  if (item.rangeBonus) parts.push(`射程 +${item.rangeBonus}`);
  if (item.grantTraits?.length) parts.push('附带羁绊转职');
  if (item.note) parts.push(item.note);
  return parts.join('；') || item.family;
}

export const itemHints: Record<string, string> = Object.fromEntries(items.map((item) => [item.id, describeItem(item)]));
export const itemArtNeeds: Record<string, string> = Object.fromEntries(items.map((item) => [item.id, `${item.color} ${item.family}`]));

export function findItemTemplate(id: string): ItemDef | null {
  return items.find((entry) => entry.id === id) ?? findEphemeralItem(id) ?? null;
}

export function getItem(id: string): ItemDef {
  const item = findItemTemplate(id);
  if (!item) throw new Error(`unknown item: ${id}`);
  return item;
}

export function itemHint(id: string): string {
  if (itemHints[id]) return itemHints[id]!;
  const ephemeral = findEphemeralItem(id);
  return ephemeral ? describeItem(ephemeral) : '装备';
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
