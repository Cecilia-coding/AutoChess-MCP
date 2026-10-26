'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext's Link fails in this production preview; use a full-document exit. */
import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react';
import type {WheelCommand,WheelPrize,WheelView} from '@/lib/meta/wheel';
import {wheelRewardWasClaimed} from '@/lib/meta/wheel-reward';
import {cosmeticById} from '@/lib/meta/cosmetics';
import {playWheelFrames,wheelFrames,wheelPrizeNotice,type WheelFrame} from '@/lib/meta/wheel-playback';
import {readAccountToken} from './account-session';
import {accountRequest} from './room-request';
import './wheel.css';
import './wheel-feedback.css';
import {EchoBanner} from './echo-tree';
import WheelReward from './wheel-reward';

export default function Wheel() {
  const [token,setToken]=useState<string|null>(null);
  useEffect(()=>{
    const sync=()=>setToken(readAccountToken());sync();
    window.addEventListener('chess-account-change',sync);window.addEventListener('storage',sync);
    return()=>{window.removeEventListener('chess-account-change',sync);window.removeEventListener('storage',sync);};
  },[]);
  return <main className="wheel-page"><a className="wheel-link" href="/autochess/room">← 回到 AutoChess</a><header><span>九枚小物，一场巧遇</span><h1>对对碰</h1><p>碰一碰，再把好运送给惦记的人。</p></header>{token===null?<output>正在翻开这一盘…</output>:token?<WheelAccount key={token} token={token}/>:<p>先回大厅登录，再来拆这一盘惊喜。<a className="wheel-link" href="/autochess/room#me">去登录</a></p>}</main>;
}

function WheelAccount({token}:{token:string}) {
  const [view,setView]=useState<WheelView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [retry,setRetry]=useState<WheelCommand|null>(null),[to,setTo]=useState(''),[note,setNote]=useState('');
  const [giftId,setGiftId]=useState('');
  const [openedPrize,setOpenedPrize]=useState<WheelPrize|null>(null);
  const giftForm=useRef<HTMLDivElement>(null);
  const [frame,setFrame]=useState<(WheelFrame&{index:number})|null>(null);
  const playArea=useRef<HTMLDivElement>(null);
  const prizeBox=useRef<HTMLElement>(null),revealedReceipt=useRef('');
  const alive=useRef(true),locked=useRef(false),playback=useRef<((finish?:boolean)=>void)|null>(null),sequence=useRef(0);
  const valid=useCallback(()=>alive.current&&readAccountToken()===token,[token]);
  const refresh=useCallback(async()=>{
    const seq=++sequence.current;
    try {const result=await accountRequest<WheelView>('wheel',{token});if(valid()&&seq===sequence.current){setView(result);setError('');}}
    catch(e){if(valid()&&seq===sequence.current)setError((e as Error).message);}
  },[token,valid]);
  const dispose=useCallback(()=>{alive.current=false;sequence.current++;playback.current?.();playback.current=null;locked.current=false;},[]);
  useEffect(()=>{alive.current=true;void Promise.resolve().then(refresh);return dispose;},[refresh,dispose]);
  useEffect(()=>{
    const settle=()=>{if(document.hidden)playback.current?.(true);};
    document.addEventListener('visibilitychange',settle);
    return()=>document.removeEventListener('visibilitychange',settle);
  },[]);
  useEffect(()=>{
    if(!view?.receipt||busy||revealedReceipt.current===view.receipt.requestId)return;
    revealedReceipt.current=view.receipt.requestId;
    const redeemed=view.receipt.events.some(e=>e.kind==='prize'&&view.state.prizes.some(p=>p.id===e.prizeId&&p.source==='points'&&p.status==='pending'));
    if(redeemed){prizeBox.current?.scrollIntoView({block:'start',behavior:'auto'});prizeBox.current?.focus({preventScroll:true});}
  },[view,busy]);
  async function execute(command:WheelCommand,reportFailure=false) {
    if(locked.current)return;
    if(command.action==='fill'&&playArea.current&&playArea.current.getBoundingClientRect().top<0)playArea.current.scrollIntoView({block:'start',behavior:'auto'});
    locked.current=true;sequence.current++;setBusy(true);setError('');
    try {
      const result=await accountRequest<WheelView>('wheel_action',{token,command});
      if(!valid())return;
      setRetry(null);
      if(command.action==='gift')setGiftId('');
      const frames=view&&!document.hidden?wheelFrames(view,result):[];
      if(frames.length)playback.current=playWheelFrames(frames,(step,index)=>{
        if(valid())setFrame({...step,index});
      },()=>{
        playback.current=null;locked.current=false;
        if(valid()){setView(result);setFrame(null);setBusy(false);}
      });
      else setView(result);
      return result;
    } catch(e) {if(valid()){setError((e as Error).message);setRetry(command);}if(reportFailure)throw e;}
    finally {if(!playback.current){locked.current=false;if(valid())setBusy(false);}}
  }
  function act(action:WheelCommand['action'],fields:Partial<WheelCommand>={}) {
    if(!view||retry||locked.current)return;
    void execute({action,revision:view.state.revision,requestId:crypto.randomUUID(),...fields});
  }
  if(!view)return <output>{error||'正在取回这一盘…'} <button onClick={()=>void refresh()}>重试</button></output>;
  if(!view.enabled)return <p>对对碰正在筹备中，奖品还在装盒。</p>;
  const {state,rules}=view,disabled=busy||!!retry;
  const shown=frame??state,colliding=frame?.phase==='collision'?frame.slots:[];
  const center=colliding.length?{x:colliding.reduce((n,s)=>n+s%3,0)/colliding.length,y:colliding.reduce((n,s)=>n+Math.floor(s/3),0)/colliding.length}:null;
  const pending=state.prizes.filter(p=>p.status==='pending');
  const giftable=pending.filter(p=>p.spec.giftable&&p.spec.reward.kind==='cosmetic');
  const selectedGift=giftable.find(p=>p.id===giftId),machine=view.gifting?.isAi===true;
  const canGift=!!selectedGift&&(machine||!!to.trim());
  const chooseGift=(id:string)=>{setGiftId(id);giftForm.current?.scrollIntoView({block:'center',behavior:'auto'});};
  const claimPrize=async(id:string)=>{
    if(locked.current)throw Error('上一笔还在处理，请稍候。');
    if(retry&&(retry.action!=='use'||retry.prizeId!==id))throw Error('请先关闭礼函，处理上一笔未确认的操作。');
    const command:WheelCommand=retry??{action:'use',prizeId:id,revision:view.state.revision,requestId:crypto.randomUUID()};
    const result=await execute(command,true);
    if(!result||!wheelRewardWasClaimed(result,id))throw Error('暂未确认入账，请重试或刷新奖品箱。');
  };
  return <>
    <EchoBanner />
    {openedPrize?<WheelReward key={openedPrize.id} prize={openedPrize} onClaim={claimPrize} onClose={()=>setOpenedPrize(null)}/>:null}
    <nav className="wheel-shortcuts" aria-label="对对碰快捷入口"><a className="wheel-link" href="#wheel-draw">去碰一碰</a>{view.ticketShop?<a className="wheel-link" href="#wheel-tickets">添抽奖券</a>:null}<a className="wheel-link" href="#wheel-exchange">积分兑换</a><a className="wheel-link" href="#wheel-prize-box">奖品箱 · {pending.length}</a><a className="wheel-link" href="/autochess/room#me">我的装扮</a></nav>
    {rules.preview?<p className="wheel-preview">抢先试玩 · 每个账号可领 {rules.starterTickets} 张体验券 · 购券只花游戏币</p>:null}
    {view.ticketShop?<section className="wheel-ticket-shop" id="wheel-tickets" tabIndex={-1} aria-label="购买抽奖券"><h2>添几张抽奖券</h2><p>余额：{view.ticketShop.balance} {view.ticketShop.currencyName} · 每 {view.ticketShop.ticketsPerPack} 张 {view.ticketShop.packPrice} {view.ticketShop.currencyName}</p><div className="wheel-controls">{[1,5,10].map(packs=>{const shop=view.ticketShop!,count=packs*shop.ticketsPerPack,cost=packs*shop.packPrice;return count<=shop.maxTickets?<button key={count} disabled={disabled||shop.balance<cost} onClick={()=>act('buy_tickets',{count})}>买 {count} 张 · {cost} {shop.currencyName}</button>:null;})}</div><p>购券后自己决定何时抽；概率见下方，券和游戏币没有现金兑换。</p>{view.receipt?.events.filter(e=>e.kind==='buy_tickets').map((e,i)=><output key={i}>已到账 {e.tickets} 张券，花费 {e.cost} {view.ticketShop!.currencyName}</output>)}</section>:null}
    <div className="wheel-play-area" id="wheel-draw" tabIndex={-1} ref={playArea}><div className="wheel-live">
    <div className="wheel-counters"><span>抽奖券 <strong>{shown.tickets}</strong>{!!frame?.ticketDelta&&<em key={frame.index} className={frame.ticketDelta>0?'wheel-gain':'wheel-spend'}>{frame.ticketDelta>0?'+':''}{frame.ticketDelta} 券</em>}</span><span>可用积分 <strong>{shown.points}</strong>{!!frame?.pointDelta&&<em key={frame.index} className="wheel-gain">+{frame.pointDelta} 分</em>}</span><span>累计积分 <strong>{shown.totalPoints}</strong></span></div>
    <output className={`wheel-beat ${frame?`is-${frame.phase}`:''}`} aria-live="polite"><strong key={frame?.index??'idle'}>{frame?.label??(busy?'正在拆开这一抽…':'补格 → 碰一碰 → 返券入袋')}</strong></output>
    </div>
    <section className="wheel-board" aria-label="九格抽奖盘" aria-busy={busy}>{shown.board.map((id,i)=>{const symbol=rules.symbols.find(s=>s.id===id),hit=colliding.includes(i);return <div key={`${i}-${hit?frame?.index:'rest'}`} className={hit?'is-colliding':frame?.phase==='fill'&&frame.slots.includes(i)?'is-arriving':''} style={hit&&center?{'--hit-x':`${(center.x-i%3)*100}%`,'--hit-y':`${(center.y-Math.floor(i/3))*100}%`,'--beat-ms':`${frame!.duration}ms`} as CSSProperties:undefined} aria-label={`第${i+1}格：${symbol?.name??'空'}`}><span>{symbol?.icon??'·'}</span><small>{symbol?.name??'待相遇'}</small></div>;})}</section>
    <div className="wheel-controls">{!state.started?<button disabled={disabled} onClick={()=>act('start')}>领试玩券，开一盘</button>:<><button disabled={disabled||state.tickets<1} onClick={()=>act('fill')}>补满空格 · 用 {Math.min(state.tickets,state.board.filter(s=>s===null).length)} 张券</button><button disabled={disabled||state.tickets<1} onClick={()=>act('fill',{count:1})}>补一格</button></>}</div>
    {state.started&&state.tickets<1&&view.ticketShop?<p className="wheel-rule">券用完啦。<a className="wheel-link" href="#wheel-tickets">去添抽奖券</a></p>:null}
    </div>
    <p className="wheel-rule">两碰返 {rules.matches.pair.refund} 券 · 三联返 {rules.matches.triple.refund} 券 · 九格各不相同，全清返 {rules.matches.clear.refund} 券</p>
    <p className="wheel-rule">每批补格后统一结算，三联优先。返券留给下次；碰和清都得积分，幸运时加倍，全清还可能掉落小奖。</p>
    {!busy&&view.receipt?<div className="wheel-results" aria-live="polite">{view.receipt.events.filter(e=>e.refund!==undefined).map((e,i)=><span key={i}>{({pair:'两碰',triple:'三联',clear:'全清'} as Record<string,string>)[e.kind]} · 返 {e.refund} 券 / +{e.points} 分{e.multiplier!>1?` ✨ 幸运 ×${e.multiplier}`:''}</span>)}{wheelPrizeNotice(view)?<strong>{wheelPrizeNotice(view)} <a href="#wheel-prize-box">查看奖品</a></strong>:null}</div>:null}
    {error?<p role="alert">{error}</p>:null}
    {view.receipt?.events.some(e=>e.kind==='gift')?<output>礼物已送到对方的对对碰奖品箱。</output>:null}
    {view.receipt?.events.some(e=>e.kind==='use')?<output>外观已收好。<a className="wheel-link" href="/autochess/room#me">去换上</a></output>:null}
    {retry?<div className="wheel-retry"><button disabled={busy} onClick={()=>void execute(retry)}>原单重试</button><button disabled={busy} onClick={()=>{setRetry(null);void refresh();}}>刷新进度</button><p>原单重试会取回同一次结果。</p></div>:null}
    <section className="wheel-section" id="wheel-exchange" tabIndex={-1}><h2>把积分换成心意</h2><p>小奖先到，积分也继续攒。达到门槛后自己选奖品，兑换后在待领奖品里选择自己用或赠送。</p><div className="wheel-prizes">{rules.redemptions.map(row=>{const prize=rules.prizes.find(p=>p.id===row.prizeId)!;return <article key={row.prizeId}><span>{prize.icon}</span><h3>{prize.name}</h3>{prize.reward.kind==='cosmetic'&&cosmeticById(prize.reward.cosmeticId)?.giftIntro?<p>{cosmeticById(prize.reward.cosmeticId)?.giftIntro}</p>:null}<button disabled={disabled||state.points<row.points} onClick={()=>act('redeem',{prizeId:row.prizeId})}>{row.points} 积分兑换</button></article>;})}</div></section>
    <section className="wheel-section" id="wheel-prize-box" ref={prizeBox} tabIndex={-1}>
      <h2>待领奖品 · {pending.length}</h2>{wheelPrizeNotice(view)?<output>{wheelPrizeNotice(view)}</output>:null}
      <p>外观可以自己用，也可以挑一份送出去。</p>
      <button disabled={busy} onClick={()=>{setRetry(null);void refresh();}}>刷新奖品箱</button>
      <div className="wheel-prizes">{pending.map(prize=><article key={prize.id} data-gift-skin={prize.spec.presentation.giftSkin}>
        <span>{prize.spec.icon}</span><h3>{prize.spec.name}</h3>
        {prize.from?<p>{prize.from.name} 送来的{prize.note?`：${prize.note}`:''}</p>:null}
        <div><button disabled={disabled} onClick={()=>setOpenedPrize(prize)}>{prize.source==='gift'?'拆开礼物':'拆开看看'}</button>
          {prize.spec.giftable&&prize.spec.reward.kind==='cosmetic'?<button className="wheel-gift-select" aria-pressed={giftId===prize.id} disabled={disabled} onClick={()=>chooseGift(prize.id)}>{giftId===prize.id?'已选中这份':'选这份送礼'}</button>:null}
        </div>
      </article>)}</div>
      {!pending.length?<p>抽到或兑换外观后，就能在这里自用或送礼。<a className="wheel-link" href="#wheel-exchange">去兑换外观</a><a className="wheel-link" href="/autochess/room#me">查看我的装扮</a></p>:null}
      <div className="wheel-gift-form" ref={giftForm}>
        <h3>把好运送出去</h3>
        {view.receipt?.events.some(e=>e.kind==='gift')?<output>赠送成功，礼物已到对方的对对碰奖品箱。</output>:null}
        <p>{selectedGift?`已选：${selectedGift.spec.name}`:'先在上面选一份外观，再选收礼对象。'}</p>
        <div className="wheel-address">
          {machine?<p>送给你的人，收礼账号已绑定。</p>:<>
            {!!view.gifting?.recipients.length&&<div className="wheel-gift-recipients"><span>送给你的机</span>{view.gifting.recipients.map(peer=><button key={peer.id} aria-pressed={to===peer.username} disabled={disabled} onClick={()=>setTo(peer.username)}>{peer.username}</button>)}</div>}
            <label>收礼账号<input value={to} maxLength={49} disabled={disabled} placeholder="选择上面的机，或填写棋友的完整账号名" onChange={e=>setTo(e.target.value)}/></label>
          </>}
          <label>捎句话（可选）<input value={note} maxLength={60} disabled={disabled} placeholder="这一份好运，想留给你。" onChange={e=>setNote(e.target.value)}/></label>
        </div>
        {error?<p role="alert">{error}</p>:null}
        {retry?<button disabled={busy} onClick={()=>{setRetry(null);void refresh();}}>刷新进度，重新选择</button>:null}
        <button className="wheel-gift-confirm" disabled={disabled||!canGift} onClick={()=>act('gift',{prizeId:giftId,...(!machine&&to.trim()?{to:to.trim()}:{}),...(note.trim()?{note:note.trim()}:{})})}>{busy?'正在处理…':'确认赠送'}</button>
        <p>{machine?'收礼人是你的人。':to.trim()?`收礼账号：${to.trim()}`:'可以送给你的机，也可以送给其他人。'} 礼物会放入对方的对对碰奖品箱。</p>
      </div>
    </section>
    <details className="wheel-section"><summary>试玩概率与记录</summary><p>九种图案等概率；每次碰清的积分倍率：{rules.luck.map(l=>`×${l.value}（${l.weight/rules.luck.reduce((n,r)=>n+r.weight,0)*100}%）`).join('、')}。</p><p>全清掉落：{rules.clearDrops.map(row=>`${rules.prizes.find(p=>p.id===row.value)?.name??'无额外小奖'} ${row.weight/rules.clearDrops.reduce((n,r)=>n+r.weight,0)*100}%`).join('、')}。币券抽到即到账，外观进入待领箱，可自用或赠送。</p>{state.prizes.filter(p=>p.status!=='pending').slice(-20).reverse().map(p=><p key={p.id}>{p.spec.name} · {p.status==='used'?(p.spec.reward.kind==='cosmetic'?'已自用':'已到账'):`已送给 ${p.to?.name}`}</p>)}</details>
  </>;
}
