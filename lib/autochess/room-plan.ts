import { applyCompanionPlan, parseCompanionPlan } from './companion';
import { getUnit } from '../../content/autochess/units';
import { makeShop } from './core';
import type { RoomView } from './room-types';
import { resolveRoomPlan } from './room-refs';

export function validateRoomPlan(view: RoomView, raw: string) {
  let formatReason='';
  const plan = parseCompanionPlan(raw, reason=>{formatReason=reason;});
  if(!plan || !view.self) return {plan:null,reason:formatReason||'请先入座，读取自己的棋盘。'};
  const self = view.self; let reason = '';
  let resolved;
  try{resolved=resolveRoomPlan(plan,[...self.board,...self.bench??[]],self);}catch(e){return {plan:null,reason:e instanceof Error?e.message:'棋子引用无效'};}
  let refresh = 0;
  const result = applyCompanionPlan({board:self.board,bench:self.bench??[],inventory:self.inventory??[],gold:self.gold??0,
    capacity:self.capacity,shop:self.shop.map(id=>id?getUnit(id):undefined) as ReturnType<typeof getUnit>[], idPrefix:'validate-',plan:resolved,recoverPositions:true,
    refreshShop:()=>makeShop(1, view.round, ++refresh), onInvalid:r=>reason=r});
  return result ? {plan,reason:''} : {plan:null,reason:reason||'计划无法执行，请核对当前上场、备战与金币。'};
}
export async function requestValidRoomPlan(view:RoomView,prompt:string,generate:(prompt:string)=>Promise<string>,onAttempt:(attempt:number,raw:string,reason:string)=>void) {
  let nextPrompt=prompt;
  for(let attempt=1;attempt<=2;attempt++) {
    const raw=await generate(nextPrompt);const checked=validateRoomPlan(view,raw);onAttempt(attempt,raw,checked.reason);
    if(checked.plan)return checked.plan;
    nextPrompt=`${prompt}\n上次计划没有执行，金币与棋子均未改变。错误：${checked.reason}\n上次JSON：${raw}\n请修正该错误后重新给出完整JSON。严格不超过capacity；不用的positions/equip可省略。`;
  }
  throw new Error('机友两次计划均未通过校验，已暂停；可以点击继续重试。');
}
