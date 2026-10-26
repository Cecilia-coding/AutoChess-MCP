import type {WheelView} from './wheel';

export function wheelPrizeNotice(view:WheelView):string {
  const awarded=new Set(view.receipt?.events.filter(e=>e.kind==='prize').map(e=>e.prizeId));
  const prizes=view.state.prizes.filter(p=>awarded.has(p.id));
  if(!prizes.length)return '';
  const pending=prizes.filter(p=>p.status==='pending'&&p.spec.reward.kind==='cosmetic');
  if(pending.length)return `${pending.some(p=>p.source==='points')?'兑换成功':'抽到外观'}：${pending.map(p=>p.spec.name).join('、')}，已放入下方待领奖品。点「拆开看看」后确认收入装扮，或「选这份送礼」送出。`;
  return `奖品已到账：${prizes.map(p=>p.spec.name).join('、')}`;
}

export const WHEEL_BEATS = {spend:450,fill:500,collision:650,refund:850,prize:1000} as const;
export type WheelFrame = {
  phase:keyof typeof WHEEL_BEATS; duration:number; label:string;
  board:(string|null)[]; tickets:number; points:number; totalPoints:number;
  slots:number[]; ticketDelta:number; pointDelta:number;
};

/** Presentation of a committed receipt only; the server owns rewards and randomness. */
export function wheelFrames(before:WheelView,after:WheelView):WheelFrame[] {
  const events=after.receipt?.events;
  if(after.replayed||!events?.length||events[0].kind!=='fill'||after.state.revision!==before.state.revision+1)return [];
  const board=[...before.state.board],frames:WheelFrame[]=[];
  let {tickets,points,totalPoints}=before.state;
  const push=(phase:WheelFrame['phase'],label:string,slots:number[]=[],ticketDelta=0,pointDelta=0)=>{
    frames.push({phase,duration:WHEEL_BEATS[phase],label,slots:[...slots],ticketDelta,pointDelta,board:[...board],tickets,points,totalPoints});
  };
  for(const event of events) {
    const slots=event.slots??[];
    if(event.kind==='fill') {
      if(!slots.length||tickets<slots.length||slots.some((s,i)=>board[s]!==null||!event.symbols?.[i]))return [];
      tickets-=slots.length;
      push('spend',`用掉 ${slots.length} 张券`,[],-slots.length);
      slots.forEach((s,i)=>{board[s]=event.symbols![i];});
      push('fill','小物落格，看看谁会相遇',slots);
    } else if(event.kind==='pair'||event.kind==='triple'||event.kind==='clear') {
      if(!slots.length||slots.some((s,i)=>!board[s]||board[s]!==event.symbols?.[i])||event.refund===undefined||event.points===undefined)return [];
      const name={pair:'两碰！',triple:'三联！',clear:'九格各异 · 全清！'}[event.kind];
      push('collision',name,slots);
      slots.forEach(s=>{board[s]=null;});
      tickets+=event.refund;points+=event.points;totalPoints+=event.points;
      push('refund',`返 ${event.refund} 券 · +${event.points} 积分${(event.multiplier??1)>1?` · 幸运 ×${event.multiplier}`:''}`,[],event.refund,event.points);
    } else if(event.kind==='prize') {
      const prize=after.state.prizes.find(p=>p.id===event.prizeId);
      if(!prize)return [];
      const bonus=prize.spec.reward.kind==='tickets'?prize.spec.reward.amount:0;
      tickets+=bonus;
      push('prize',`小奖落袋 · ${prize.spec.name}`,[],bonus);
    } else return [];
  }
  // Unknown receipts settle directly instead of inventing intermediate balances.
  if(tickets!==after.state.tickets||points!==after.state.points||totalPoints!==after.state.totalPoints||board.some((s,i)=>s!==after.state.board[i]))return [];
  return frames;
}

/** Cancellation drops queued callbacks; finish=true jumps to the committed final view. */
export function playWheelFrames(
  frames:WheelFrame[],show:(frame:WheelFrame,index:number)=>void,done:()=>void,
  schedule:(fn:()=>void,ms:number)=>()=>void=(fn,ms)=>{const id=setTimeout(fn,ms);return()=>clearTimeout(id);},
): (finish?:boolean)=>void {
  let stopped=false,cancel:()=>void=()=>{};
  const stop=(finish=false)=>{if(stopped)return;stopped=true;cancel();if(finish)done();};
  const next=(index:number)=>{
    if(stopped)return;
    if(index===frames.length){stop(true);return;}
    show(frames[index],index);
    cancel=schedule(()=>next(index+1),frames[index].duration);
  };
  next(0);
  return stop;
}
