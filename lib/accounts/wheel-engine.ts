import { emptyWheel, WHEEL_LIMITS, type Weighted, type WheelCommand, type WheelEvent, type WheelRules, type WheelState } from '../meta/wheel';

export function weightedPick<T>(entries:Weighted<T>[], random:()=>number):T {
  const total = entries.reduce((sum,e)=>sum+e.weight,0);
  if (!entries.length || entries.some(e=>!Number.isFinite(e.weight)||e.weight<=0) || !Number.isFinite(total)) throw Error('奖池权重无效');
  const value = random();
  if (!Number.isFinite(value) || value<0 || value>=1) throw Error('随机源无效');
  let cursor=value*total;
  for (const entry of entries) { cursor-=entry.weight; if(cursor<0)return entry.value; }
  return entries[entries.length-1].value;
}

export function validateWheelRules(rules:WheelRules) {
  if(rules.size!==9 || rules.symbols.length!==9 || new Set(rules.symbols.map(s=>s.id)).size!==9)throw Error('九格需要九种不同图案');
  if(!Number.isSafeInteger(rules.starterTickets)||rules.starterTickets<0)throw Error('初始券无效');
  if(new Set(rules.prizes.map(p=>p.id)).size!==rules.prizes.length)throw Error('奖品编号重复');
  for(const row of Object.values(rules.matches)) if(!Number.isSafeInteger(row.refund)||row.refund<0||!Number.isSafeInteger(row.points)||row.points<1)throw Error('碰清配置无效');
  for(const row of rules.redemptions) if(!rules.prizes.some(p=>p.id===row.prizeId)||!Number.isSafeInteger(row.points)||row.points<1)throw Error('积分奖品无效');
  for(const row of rules.clearDrops) if(row.value!==null&&!rules.prizes.some(p=>p.id===row.value))throw Error('掉落奖品不存在');
  for(const row of rules.luck)if(!Number.isSafeInteger(row.value)||row.value<1)throw Error('幸运倍率无效');
  for(const prize of rules.prizes) {
    const reward=prize.reward;
    if(reward.kind==='cosmetic' ? !reward.cosmeticId : !Number.isSafeInteger(reward.amount)||reward.amount<=0)throw Error('奖励内容无效');
  }
  weightedPick(rules.symbols.map(s=>({value:s.id,weight:s.weight})),()=>0);
  weightedPick(rules.clearDrops,()=>0); weightedPick(rules.luck,()=>0);
}

/** 本次补格结束才统一判碰：三联优先，余下配对；返券留给下一次主动补格。 */
export function playWheel(original:WheelState, command:WheelCommand, rules:WheelRules, random:()=>number, makeId:()=>string, at:number) {
  const state=structuredClone(original),events:WheelEvent[]=[];
  if(state.rulesId!==rules.id)throw Error('本盘规则已更新，请联系反馈处保留进度');
  const award=(prizeId:string,source:'clear'|'points')=>{
    if(state.prizes.length>=WHEEL_LIMITS.prizes)throw Error('奖品箱已满，请联系反馈处整理记录');
    const spec=rules.prizes.find(p=>p.id===prizeId);
    if(!spec)throw Error('奖品不存在');
    const prize={id:makeId(),spec:structuredClone(spec),at,source,status:'pending' as const};
    state.prizes.push(prize); events.push({kind:'prize',prizeId:prize.id});
  };
  if(command.action==='start') {
    if(state.started)throw Error('试玩券已经领过了');
    state.started=true; state.tickets+=rules.starterTickets; events.push({kind:'start'});
  } else if(command.action==='fill') {
    if(!state.started)throw Error('先领取试玩券');
    const empty=state.board.flatMap((symbol,index)=>symbol===null?[index]:[]);
    const count=command.count??Math.min(empty.length,state.tickets);
    if(!Number.isSafeInteger(count)||count<1||count>empty.length)throw Error('补格数量无效');
    if(state.tickets<count)throw Error('抽奖券不足');
    const slots=empty.slice(0,count);
    for(const i of slots)state.board[i]=weightedPick(rules.symbols.map(s=>({value:s.id,weight:s.weight})),random);
    state.tickets-=count;
    events.push({kind:'fill',slots,symbols:slots.map(i=>state.board[i]!)});
    const resolve=(kind:'pair'|'triple'|'clear',indices:number[])=>{
      const multiplier=weightedPick(rules.luck,random),row=rules.matches[kind],points=row.points*multiplier;
      events.push({kind,slots:indices,symbols:indices.map(i=>state.board[i]!),refund:row.refund,points,multiplier});
      for(const i of indices)state.board[i]=null;
      state.tickets+=row.refund;state.points+=points;state.totalPoints+=points;
      if(kind==='clear') {const prize=weightedPick(rules.clearDrops,random);if(prize)award(prize,'clear');}
    };
    if(state.board.every(Boolean)&&new Set(state.board).size===rules.size)resolve('clear',state.board.map((_,i)=>i));
    else for(const symbol of rules.symbols) {
      const indices=state.board.flatMap((s,i)=>s===symbol.id?[i]:[]);
      while(indices.length>=3)resolve('triple',indices.splice(0,3));
      if(indices.length===2)resolve('pair',indices);
    }
  } else if(command.action==='redeem') {
    const row=rules.redemptions.find(r=>r.prizeId===command.prizeId);
    if(!row)throw Error('请选择积分奖品');
    if(state.points<row.points)throw Error('积分还不够');
    state.points-=row.points;award(row.prizeId,'points');
  } else throw Error('此操作需要账号奖品事务');
  return {state,events};
}

export function newWheel(rules:WheelRules) {validateWheelRules(rules);return emptyWheel(rules);}
