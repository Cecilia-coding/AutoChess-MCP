import { autochessCostOf, getUnit } from '../../content/autochess/units';
import type { Combatant } from './types';
import type { RoomSelf } from './room-types';
import { roomShopPrice } from './room-economy';

export const botStrength = (p: Combatant) => p.star * 12 + autochessCostOf(getUnit(p.templateId)) * 2 + p.itemIds.length;

/** 优先星级与前排，再利用不同模板补羁绊。罢工棋子本轮优先留在备战。 */
export function botField(seat: RoomSelf): string[] {
  const pool = [...seat.board,...seat.bench??[]];
  const chosen: Combatant[] = [];
  const struck = new Set(seat.roundHazards?.struck??[]);
  let cost = 0;
  while (pool.length && chosen.length < 10) {
    const candidates = pool.filter(p => getUnit(p.templateId).ally || cost < seat.capacity);
    if (!candidates.length) break;
    const templates = new Set(chosen.map(p=>p.templateId));
    const traits = new Set(chosen.flatMap(p=>{const u=getUnit(p.templateId);return [...u.factions,...u.jobs]}));
    const frontline = chosen.some(p=>['tank','melee'].includes(getUnit(p.templateId).role));
    const score = (p:Combatant) => {
      const u=getUnit(p.templateId);
      return botStrength(p) - (struck.has(p.id)?1000:0) + (!frontline && ['tank','melee'].includes(u.role)?5:0)
        + (!templates.has(p.templateId)?[...u.factions,...u.jobs].filter(t=>traits.has(t)).length*2:0);
    };
    candidates.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
    const pick=candidates[0]!; chosen.push(pick);pool.splice(pool.indexOf(pick),1);
    if (!getUnit(pick.templateId).ally) cost++;
  }
  return chosen.map(p=>p.id);
}

export function botBuyOrder(seat: RoomSelf): number[] {
  const pool=[...seat.board,...seat.bench??[]];
  const traits=new Set(pool.flatMap(p=>{const u=getUnit(p.templateId);return [...u.factions,...u.jobs]}));
  return seat.shop.flatMap((id,slot)=>{
    if (!id) return [];
    const unit=getUnit(id), cost=roomShopPrice(seat,unit);
    if (cost>(seat.gold??0)) return [];
    const copies=pool.filter(p=>p.templateId===id && p.star===1).length;
    const room=pool.filter(p=>!getUnit(p.templateId).ally).length<seat.capacity;
    const weakest=Math.min(...seat.board.map(botStrength));
    const useful=room || copies>0 || 12+autochessCostOf(unit)*2>weakest;
    if (!useful) return [];
    return [{slot,score:copies*25+(room?20:0)+autochessCostOf(unit)*2+[...unit.factions,...unit.jobs].filter(t=>traits.has(t)).length*3}];
  }).sort((a,b)=>b.score-a.score||a.slot-b.slot).map(x=>x.slot);
}
