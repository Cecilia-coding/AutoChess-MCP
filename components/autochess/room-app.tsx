'use client';
import { Component, useCallback, useMemo, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { modePack, DEFAULT_MODE, type MatchModeId } from '@/packs/modes/registry';
import Arena3D from './arena-3d';
import BattleStats from './battle-stats';
import DanmakuStream from './danmaku-stream';
import { roomPlayback } from '@/lib/autochess/room-playback';
import { roomBoardSkin } from '@/lib/autochess/room-appearance';
import { roomShopPrice, roomRefreshPrice } from '@/lib/autochess/room-economy';
import { roomStatusEntries } from '@/lib/autochess/room-status';
import { machineInvite, playerMcpUrl } from '@/lib/autochess/invite-copy';
import { findUnit } from '@/content/autochess/units';
import { unitSkill } from '@/content/autochess/unit-skills';
import { START_LEVEL, XP_BUY_COST, xpToNext, shopMaxCostForLevel } from '@/lib/autochess/level';
import { items, itemHint } from '@/content/autochess/items';
import { activeTier, findTrait } from '@/content/autochess/traits';
import { boardModelFor, itemImage, skinPalette } from '@/lib/meta/cosmetics';
import { tiles } from '@/lib/game/board';
import { packDraftTiles, type PackSummary } from '@/packs/registry';
import { goldAmount, levelLabel, packTerms, starLabel } from '@/packs/terms';
import type { RoomAction, RoomCredentials, RoomMutation, RoomView, RoomBattle, RoomHazardBan } from '@/lib/autochess/room-types';
import './room-ui.css';
import RoomResult from './room-result';
import { previewRoomMove, type PendingRoomMove } from '@/lib/autochess/room-move-preview';
import { uniqueTraitCounts } from '@/lib/autochess/stats';
import Lobby, { Avatar } from './lobby';
import { EchoBanner } from './echo-tree';
import MachineInvitePanel from './machine-invite-panel';
import SocialInbox from './social-inbox';
import { readAccountToken } from './account-session';
import { roomRequest } from './room-request';
import Feedback from './feedback';

const SESSION = 'autochess-room-current-v1';
const OFFLINE = '网络中断，棋盘仍保留；连上后会自动同步';

class RoomCrashFence extends Component<{children: ReactNode}, {message: string}> {
  state = {message: ''};
  static getDerivedStateFromError(error: Error) { return {message: error.message || '页面渲染出错'}; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('room-app', error, info.componentStack); }
  render() {
    if (!this.state.message) return this.props.children;
    return <main className="p-6">
      <p role="alert">页面卡住了，棋局还在服务器，不会因为断网判负。</p>
      <p className="mt-2 text-sm">{this.state.message}</p>
      <button className="mt-4 rounded-full border px-4 py-2" onClick={()=>this.setState({message:''})}>重新显示棋盘</button>
    </main>;
  }
}

async function request<T = RoomView>(op:string, args:object={}): Promise<T> {
  return roomRequest<T>(op, args);
}
function RoomApp({initialCredentials,onSessionChange}: {initialCredentials: RoomCredentials|null|undefined;onSessionChange:(next:RoomCredentials|null)=>void}) {
  const [connection,setConnection]=useState<{cursorEnabled:boolean;mcpUrl:string;packs:PackSummary[]}>({cursorEnabled:false,mcpUrl:'',packs:[]});
  const [configLoaded,setConfigLoaded]=useState(false);
  const [configError,setConfigError]=useState('');
  const configRequest=useRef(0);
  const refreshConfig=useCallback(async()=>{
    const sequence=++configRequest.current;
    try {const next=await request<typeof connection>('config');if(sequence===configRequest.current){setConnection(next);setConfigError('');}}
    catch(e){if(sequence===configRequest.current)setConfigError((e as Error).message);}
    finally{if(sequence===configRequest.current)setConfigLoaded(true);}
  },[]);
  useEffect(()=>{
    void Promise.resolve().then(refreshConfig);
    const visible=()=>{if(!document.hidden)void refreshConfig();};
    document.addEventListener('visibilitychange',visible);
    return()=>document.removeEventListener('visibilitychange',visible);
  },[refreshConfig]);
  const [credentials,setCredentials]=useState<RoomCredentials|null>(initialCredentials??null);
  const [view,setView]=useState<RoomView|null>(null);
  const terms=packTerms(view?.pack);
  const latestView=useRef<RoomView|null>(null);
  const [movePreview,setMovePreview]=useState<PendingRoomMove|null>(null);
  const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
  const [invitation,setInvitation]=useState(''); const [watchLink,setWatchLink]=useState('');
   const [shopOpen,setShopOpen]=useState(false); const [draftOpen,setDraftOpen]=useState(false);
    const [rightTab,setRightTab]=useState<'traits'|'items'|'status'|'battle'>('battle');
   const [hazardAlert,setHazardAlert]=useState<RoomHazardBan[]|null>(null);
  const [selected,setSelected]=useState<string>();
  const [panelsOpen,setPanelsOpen]=useState(false);
  const [playback,setPlayback]=useState<{battle:RoomBattle;time:number}|null>(null);
  const [savedSession,setSavedSession]=useState<RoomCredentials|null>(null);
  const seenBattle=useRef(''); const seenHazards=useRef(new Set<string>()); const busyRef=useRef(false); const current=useRef<RoomCredentials|null>(null);
  const pending=useRef<RoomMutation|null>(null);
  const adopt=(next:RoomView)=>{const old=latestView.current;if(old?.id===next.id&&old.revision>next.revision)return;latestView.current=next;setView(next);};
  useEffect(()=>{
    if(initialCredentials!==undefined)return;
    const params=new URLSearchParams(window.location.search); const hash=new URLSearchParams(window.location.hash.slice(1));
    if(params.get('room')&&hash.get('watch')) {setCredentials({roomId:params.get('room')!,token:hash.get('watch')!});return;}
    try {const saved=localStorage.getItem(SESSION);if(saved)setSavedSession(JSON.parse(saved) as RoomCredentials);}catch{}
  },[]);
  useEffect(()=>{
    current.current=credentials; if(!credentials)return;
    let stopped=false; let inFlight=false;
    const refresh=async()=>{
      if(inFlight||stopped||document.hidden)return;
      if(typeof navigator!=='undefined' && navigator.onLine===false){setError(OFFLINE);return;}
      inFlight=true;
      try {const next=await request('state',credentials);if(!stopped){adopt(next);setError('');}}
      catch(e){if(!stopped)setError((e as Error).message);}finally{inFlight=false;}
    };
    void refresh();
    const timer=setInterval(refresh,2000);
    const visible=()=>{if(!document.hidden)void refresh();};
    const resume=()=>void refresh();
    const drop=()=>setError(OFFLINE);
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('online',resume);
    window.addEventListener('offline',drop);
    return()=>{
      stopped=true;clearInterval(timer);
      document.removeEventListener('visibilitychange',visible);
      window.removeEventListener('online',resume);
      window.removeEventListener('offline',drop);
    };
  },[credentials]);
  useEffect(()=>{
    if(!credentials || !view?.self || view.seatIndex!==0)return;
    void request<{invitation:string;watchToken:string}>('invite',credentials).then(info=>{
      setInvitation(info.invitation);setWatchLink(`${location.origin}/autochess/room?room=${credentials.roomId}#watch=${info.watchToken}`);
    }).catch(()=>{});
  },[credentials,view?.seatIndex]);
  useEffect(()=>{
    if(!view?.battle || seenBattle.current===view.battle.output.battleId)return;
    seenBattle.current=view.battle.output.battleId;setShopOpen(false);setDraftOpen(false);setSelected(undefined);
    setPlayback({battle:view.battle,time:0});
  },[view?.battle?.output.battleId]);
  useEffect(()=>{
    if(!playback)return;
    const start=performance.now()-playback.time/2; const id=playback.battle.output.battleId;
    const duration=roomPlayback(playback.battle,view?.seatIndex??0).output.durationMs;
    const timer=setInterval(()=>{
      const time=(performance.now()-start)*2;
      if(time>=duration){setPlayback(null);setShopOpen(true);clearInterval(timer);}
      else setPlayback(p=>p?.battle.output.battleId===id?{...p,time}:p);
    },50);
    return()=>clearInterval(timer);
  },[playback?.battle.output.battleId]);
  useEffect(()=>{
    const hazards=view?.self?.roundHazards;
    if(playback||!view||!hazards?.banned?.length)return;
    const fresh=hazards.banned.filter(entry=>!seenHazards.current.has(`${view.id}:${entry.round??hazards.round}:${entry.pieceId}`));
    if(!fresh.length)return;
    for(const entry of fresh)seenHazards.current.add(`${view.id}:${entry.round??hazards.round}:${entry.pieceId}`);
    const timer=setTimeout(()=>setHazardAlert(fresh),0);
    return()=>clearTimeout(timer);
  },[playback,view?.id,view?.self?.roundHazards]);
  const create=async(packOverride?:string,mode: MatchModeId = view?.mode??DEFAULT_MODE)=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);
    try {const accountToken=readAccountToken()||undefined;
      const chosenPack=packOverride??connection.packs[0]?.id;
      if(!chosenPack)throw new Error('还没有开放的棋谱');
      const result=await request<RoomCredentials>('create',{name:'你',pack:chosenPack,mode,accountToken});const next={roomId:result.roomId,token:result.token};
      try{localStorage.setItem(SESSION,JSON.stringify(next));}catch{/* 本次会话仍可继续 */}
      onSessionChange(next);}
    catch(e){setError((e as Error).message);}finally{busyRef.current=false;setBusy(false);}
  };
  const joinRoom=async(invitation:string,joinKey:string)=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);
    try {const accountToken=readAccountToken()||undefined;
      const result=await request<RoomCredentials>('join',{invitation,name:'棋友',joinKey,accountToken});const next={roomId:result.roomId,token:result.token};
      try{localStorage.setItem(SESSION,JSON.stringify(next));}catch{/* 本次会话仍可继续 */}
      onSessionChange(next);}
    catch(e){setError((e as Error).message);}finally{busyRef.current=false;setBusy(false);}
  };
  const action=async(command:RoomAction)=>{
    const state=latestView.current;
    if(!credentials||!state?.self||busyRef.current)return;busyRef.current=true;setBusy(true);
    const payload={...credentials,round:state.round,revision:state.self.revision,requestId:crypto.randomUUID(),action:command};pending.current=payload;
    if(command.kind==='move'){setMovePreview({roomId:state.id,round:state.round,revision:state.self.revision,action:command});setNotice('正在保存站位…');}
    try {const next=await request('action',payload);adopt(next);pending.current=null;setError('');
      if(command.kind==='claim'){setDraftOpen(false);setNotice(next.self?.draftLabel??'奖励已入账');}
      if(command.kind==='roll')setNotice(`骰点已锁定，落点奖励不会因${terms.reroll.name}而改变`);
      if(command.kind==='move')setNotice('站位已保存');
      if(command.kind==='buy' && next.self) {
        const before=[...state.self.board,...state.self.bench??[]];
        const after=[...next.self.board,...next.self.bench??[]];
        const merged=after.filter(piece=>before.some(old=>old.id===piece.id && old.star<piece.star));
        if(merged.length)setNotice(merged.map(piece=>{
          const consumed=before.filter(old=>old.templateId===piece.templateId && !after.some(current=>current.id===old.id));
          const refs=consumed.map(old=>state.self!.pieceRefs?.[old.id]).filter(Boolean);
          return `${findUnit(piece.templateId)?.name??piece.templateId} 合成升至 ${starLabel(terms, piece.star)}，保留 ${next.self!.pieceRefs?.[piece.id]??'原棋子'}${refs.length?`；${refs.join('、')} 已合入`:''}`;
        }).join('；'));
      }
    } catch(e) {setError((e as Error).message);if(command.kind==='move')setNotice('站位未确认，已恢复已知棋盘，请重试');}
    finally{setMovePreview(null);busyRef.current=false;setBusy(false);}
  };
  const retry=async()=>{if(!pending.current||busyRef.current)return;busyRef.current=true;setBusy(true);try{adopt(await request('action',pending.current));pending.current=null;setError('');setNotice('操作已确认');}catch(e){setError((e as Error).message);}finally{busyRef.current=false;setBusy(false);}};

  const copy=async(text:string,done='抄好了')=>{try{await navigator.clipboard.writeText(text);setNotice(done);}catch{setNotice(text);}};
  const [danmakuText,setDanmakuText]=useState('');
  const sayDanmaku=async()=>{
    const text=danmakuText.trim();if(!text||!credentials)return;setDanmakuText('');
    try{adopt(await request('action',{...credentials,round:view?.round??0,revision:view?.self?.revision??0,requestId:crypto.randomUUID(),action:{kind:'danmaku',text}}));setError('');}
    catch(e){setError((e as Error).message);}
  };
  const closeShop=()=>{setShopOpen(false);if(view?.self?.draft)setDraftOpen(true);};
  /** 人退出房间 = 认输：清掉本机会话回大厅，并向旧房间发送认输。机不走这条。 */
  const leaveRoom=async()=>{
    if(busyRef.current)return;
    busyRef.current=true;
    const state=latestView.current;
    try{localStorage.removeItem(SESSION);}catch{/* 隐私模式忽略 */}
    // 换房重建整个会话：旧请求只持有已卸载实例的状态 setter。
    onSessionChange(null);
    if(credentials&&state?.self&&state.self.hp>0&&state.phase!=='finished'){
      try{await request('action',{...credentials,round:state.round,revision:state.self.revision,requestId:crypto.randomUUID(),action:{kind:'resign'}});}catch{/* 离开本机视图，服务端状态以重连查询为准 */}
    }
  };
  /** 单人开局：补路人机后进入备战。 */
  const replayBattle=playback?.battle, viewerSeat=view?.seatIndex??0;
  const replay=useMemo(()=>replayBattle?roomPlayback(replayBattle,viewerSeat):null,[replayBattle,viewerSeat]);
  const statsBattle=playback?.battle??view?.battle;
  const statsReplay=useMemo(()=>statsBattle?roomPlayback(statsBattle,viewerSeat):null,[statsBattle,viewerSeat]);
  const startSolo=async()=>{if(!credentials||busyRef.current)return;busyRef.current=true;setBusy(true);try{adopt(await request('start',credentials));setError('');setNotice('已补路人机，开始布阵');}catch(e){setError((e as Error).message);}finally{busyRef.current=false;setBusy(false);}};
  if(!credentials)return <div className="lobby-viewport"><div role={error?'alert':undefined}>{error}</div>{savedSession?<div className="lobby-saved-session"><span className="saved-icon">✦</span><span>检测到未完成棋局</span><button className="btn-resume" type="button" onClick={()=>setCredentials(savedSession)}>重连席位</button><button className="btn-clear" type="button" onClick={()=>{try{localStorage.removeItem(SESSION);}catch{}setSavedSession(null);}}>清除存档</button></div>:null}<Lobby packs={connection.packs} packsLoading={!configLoaded} packsError={configError} mcpUrl={connection.mcpUrl} onRefreshPacks={refreshConfig} onPacksChanged={packs=>{configRequest.current++;setConnection(current=>({...current,packs}));setConfigError('');}} onCreate={(packId,mode)=>void create(packId,mode)}             onJoin={(invitation,joinKey)=>void joinRoom(invitation,joinKey)} onEnterRoom={(roomId,token)=>setCredentials({roomId,token})} busy={busy}/></div>;
  if(!view)return <main className="p-6"><p>{error||'正在恢复棋局…'}</p><p className="my-2 text-sm">席位还在。不要急着清掉本机凭证；连上后会自己同步。</p><button onClick={()=>{try{localStorage.removeItem(SESSION);}catch{}onSessionChange(null);}}>返回棋室入口</button></main>;
  const displayed=previewRoomMove(view,movePreview);
  const self=displayed.self;const watching=!self;const index=view.seatIndex??0;
  const enemyIndex=view.opponentIndex ?? (view.seats.length===2 ? 1-index : undefined);
  const own=displayed.seats[index];const enemy=enemyIndex!==undefined?view.seats[enemyIndex]:undefined;
  const equippedBoard=roomBoardSkin(displayed);
  const playbackEnemy=replay?.opponent;
  const shownEnemy=playbackEnemy!==undefined?view.seats[playbackEnemy]:enemy;
  const board=playback?playback.battle.boards[index]!:own?.board??[];
  const bench=playback?playback.battle.benches[index]!:own?.bench??[];
  const refreshPrice=self?roomRefreshPrice(self,view.round):0;
  const editable=!!self&&self.hp>0&&!self.ready&&!playback&&view.phase!=='finished'&&!busy;
  const draft=self?.draft;
  const hexOffer=self?.hexOffer;
  const finish=()=>{setPlayback(null);setShopOpen(true);};
   const move=(piece:string,row:number,col:number)=>{void action({kind:'move',piece,row,col});setSelected(undefined);};
   const backToLobby=()=>{
     if(watching){
       window.history.replaceState(null,'','/autochess/room');
       try{const saved=localStorage.getItem(SESSION);setSavedSession(saved?JSON.parse(saved) as RoomCredentials:null);}catch{setSavedSession(null);}
       setCredentials(null);return;
     }
     try{localStorage.removeItem(SESSION);}catch{/* 隐私模式忽略 */}
     setSavedSession(null);setCredentials(null);
   };
   const equipment=(id:string)=>items.find(x=>x.id===id)?.name??id;
   const ranking=[...view.seats].map((seat,index)=>({...seat,index})).sort((a,b)=>b.hp-a.hp||a.index-b.index);
   const packTiles=packDraftTiles(view.pack);
   const boardTiles=packTiles?tiles.map((tile,i)=>({...tile,name:packTiles[i]?.name??tile.name,detail:packTiles[i]?.detail??tile.detail})):tiles;
   const traitCounts=self?uniqueTraitCounts(self.board):new Map<string,number>();
   const statusEntries=self?roomStatusEntries(self,view.round):[];
  // 一次性食用/使用类道具：显示「食用/使用/重铸」按钮
  const consumeLabel=(id:string)=>items.find(x=>x.id===id)?.consume?.label;
  const playerUrl=playerMcpUrl(connection.mcpUrl);
  const inviteText=machineInvite(playerUrl,invitation);
   return <main className="room-table autochess-table mx-auto max-w-[1500px] px-3 py-3 text-[var(--ink)]">
       {!watching?<details className="autochess-companion room-float"><summary aria-label="房间菜单">☰</summary><div className="room-actions rounded-xl border bg-white p-3 text-sm">
        <button className="room-menu-close" type="button" onClick={event=>event.currentTarget.closest('details')?.removeAttribute('open')}>收起房间菜单</button>
        <Feedback roomId={view.id} />
        <p>{`${modePack(view.mode).name} · `}房间 {view.id} · {enemy?`对局中 · ${enemy.name}`:`等待棋友（${view.seats.length}/${view.seatCount}）`}</p>
        {view.seatIndex===0&&enemy?<><button type="button" disabled={busy||view.phase!=='prepare'||enemy.ready} onClick={async()=>{try{adopt(await request('poke',credentials!));setNotice('催促已登记；需客户端正在监听，30秒内重复点击会合并。');}catch(e){setError((e as Error).message);}}}>踹醒它</button><p role="status">{view.wake?.status} · 自动续聊需要客户端适配器正在等待</p></>:null}
        {view.seatIndex===0?<><MachineInvitePanel credentials={credentials} mcpUrl={playerUrl} canInvite={view.phase==='waiting'&&view.seats.length<(view.seatCount??2)} onNotice={setNotice}/><button className="m-1 rounded border p-2" disabled={!invitation||!playerUrl} onClick={()=>copy(inviteText,'邀请词抄好了，发给它就行')}>复制普通邀请</button><button className="m-1 rounded border p-2" disabled={!playerUrl} onClick={()=>copy(playerUrl,'MCP 地址抄好了')}>复制 MCP 地址</button><button className="m-1 rounded border p-2" disabled={!watchLink} onClick={()=>copy(watchLink,'观战链接抄好了')}>复制观战链接</button><p className="break-all">给机的 MCP：{playerUrl||'加载中…'}</p></>:null}
        {view.phase!=='finished'&&self&&self.hp>0?<button className="m-1 rounded border p-2" onClick={()=>action({kind:'resign'})}>认输结束</button>:<button className="m-1 rounded border p-2" onClick={backToLobby}>新建一局</button>}
        <button className="m-1 rounded border p-2" type="button" onClick={()=>void leaveRoom()}>退出房间（自动认输）</button>
       </div></details>:null}
     <section className={`danmaku-strip ${shopOpen?'is-covered':''}`} aria-label="弹幕">
      <DanmakuStream key={view.id} messages={view.danmaku??[]} playbackRound={playback?.battle.round} covered={shopOpen} />
      {!watching?<form className="danmaku-composer" onSubmit={event=>{event.preventDefault();void sayDanmaku();}}>
        <input value={danmakuText} maxLength={60} placeholder="发条弹幕…" onChange={event=>setDanmakuText(event.target.value)} aria-label="弹幕输入" />
        <button type="submit" disabled={!danmakuText.trim()}>发射</button>
      </form>:null}
    </section>
     {error?<p className="room-error" role="alert">{error} {pending.current?<button onClick={retry}>重试刚才操作</button>:null}</p>:null}
     {hazardAlert?<div className="hazard-dialog-layer"><dialog open className="hazard-dialog" aria-labelledby="hazard-dialog-title">
       <header><span><i/> ACCOUNT CENTER</span><button type="button" aria-label="关闭封号提示" onClick={()=>setHazardAlert(null)}>×</button></header>
       <div className="hazard-dialog-body"><div className="hazard-pet" aria-hidden="true">🤖<span>!</span></div><div className="hazard-speech"><strong id="hazard-dialog-title">Your account has been suspended.</strong><p>{hazardAlert.every(entry=>entry.zone==='bench')?'都没上场，还是被查到了。':'查 IP 命中。账号已从本局阵容中强制下线。'}</p></div></div>
       <ul>{hazardAlert.map(entry=><li key={entry.pieceId}><b>{entry.name}</b><span>命中率 {Math.round(entry.chancePct)}%{entry.refundGold?` · 返还 ${goldAmount(terms, entry.refundGold)}`:''}{entry.returnedItems?.length?` · ${entry.returnedItems.length} 件装备已退回背包`:''}</span></li>)}</ul>
       <footer><button type="button" onClick={()=>{setHazardAlert(null);setRightTab('status');}}>看看发生了什么</button><button type="button" className="hazard-ack" onClick={()=>setHazardAlert(null)}>好的（扶额）</button></footer>
     </dialog></div>:null}
    {self?.bounty?.bank?<p className="px-2">连败赏金 {goldAmount(terms, self.bounty.bank)} · 取胜领取，淘汰清零</p>:null}
    {playback?<output>正在回放第 {playback.battle.round} 轮 · 棋友可同时准备下一轮</output>:null}
    {self?.result?<RoomResult key={view.id} result={self.result} finished={view.phase==='finished'} show={!playback} onReturn={backToLobby}/>:view.phase==='finished'&&!playback?<p className="p-3 font-bold" role="status">{view.winner==='draw'?'平局':`${view.seats[view.winner??0]?.name??'对方'} 获胜`} · 棋局已保存</p>:null}
    {draftOpen&&draft&&!self?.result&&!playback?<section className="room-draft" aria-label="旅途选秀">
      <header className="room-draft-header"><div><span className="room-draft-kicker">autochess · 一掷定缘</span><h2>旅途选秀</h2><p>每轮一次，落点已保存。领取后回到棋盘。</p></div><button onClick={()=>setDraftOpen(false)}>暂回棋盘</button></header>
      <div className="board-grid">{boardTiles.map((tile,i)=><article key={tile.id} className={`board-tile ${tile.type} ${(draft.landing??draft.position)===i?'active':''}`} style={{gridRow:tile.coordinate[0],gridColumn:tile.coordinate[1]}}><span className="tile-number">{String(i+1).padStart(2,'0')}</span><strong>{tile.name}</strong><small title={draft.track[i]?.detail}>{draft.track[i]?.label}</small></article>)}
        <div className="board-center"><span className="room-draft-state">{draft.roll===undefined?'等待掷骰':'落点已锁定 · 待领取'}</span><div className="room-dice-face" aria-label={draft.roll===undefined?'骰子':`骰点 ${draft.roll}`}>{draft.roll??'?'}</div><h3>{draft.landing===undefined?'下一站，会遇见什么？':draft.track[draft.landing]?.label}</h3><p>{draft.landing===undefined?'装备、棋子、机缘或小小意外，都在这条旅途中。':draft.track[draft.landing]?.detail}</p><button className="room-draft-primary" disabled={busy} onClick={()=>action({kind:draft.roll===undefined?'roll':'claim'})}>{busy?'正在结算…':draft.roll===undefined?'掷骰子 · 出发':draft.track[draft.landing!]?.kind==='mishap'?'接受遭遇 · 返回棋盘':'领取奖励 · 返回棋盘'}</button></div>
      </div></section>:
    <>
    {(self?.swordOffer||self?.hexOffer||self?.itemOffer)&&!self?.result&&!playback?<div className="room-offer-overlay">
    {self?.swordOffer?<section className="codex-offer-card" aria-label={`开局${self.swordOffer.label}三选一`}>
      <header className="codex-offer-header"><span className="codex-offer-badge">✦ 一掷定剑 · 命途初现 ✦</span><h2 className="font-heading text-xl">开局{self.swordOffer.label} · 三选一</h2><p className="text-sm">选一件进装备背包，选完方可就绪布阵。</p></header>
      <div className="codex-offer-grid">{self.swordOffer.choices.map(id=><button key={id} disabled={!editable} className="codex-choice-card" onClick={()=>void action({kind:'pick_sword',item:id})}><img className="peach-card-art" src={itemImage(id,{label:equipment(id)})} alt=""/><strong>{equipment(id)}</strong><p className="text-sm">{itemHint(id)}</p><span className="card-fleuron-corner">✦</span></button>)}</div>
    </section>:null}
    {hexOffer?<section className="codex-offer-card" aria-label="心悟三选一">
      <header className="codex-offer-header"><span className="codex-offer-badge">❖ 灵台顿悟 · 局势天工 ❖</span><h2 className="font-heading text-xl">心悟三选一 · {hexOffer.rarity==='orange'?'橙色神圣':hexOffer.rarity==='gold'?'金色史诗':hexOffer.rarity==='purple'?'紫色稀有':'蓝色经典'}</h2><p className="text-sm">本轮全员同一稀有度。择一精修入道。</p></header>
      <div className="codex-offer-grid">{hexOffer.choices.map(hex=><button key={hex.id} disabled={!editable} className={`codex-choice-card rarity-${hexOffer.rarity}`} onClick={()=>action({kind:'pick_hex',hex:hex.id})}><strong>{hex.name}</strong><p className="text-sm">{hex.note}</p><span className="card-fleuron-corner">❖</span></button>)}</div>
    </section>:null}
    {self?.itemOffer?<section className="codex-offer-card" aria-label="装备宝箱多选一">
      <header className="codex-offer-header"><span className="codex-offer-badge">✧ 灵宝锦囊 · 奇门遁甲 ✧</span><h2 className="font-heading text-xl">装备宝箱 · 从 {(self.itemOffer.boxes[self.itemOffer.boxIndex]??[]).length} 件里选 1</h2><p className="text-sm">还剩 {self.itemOffer.boxes.length-self.itemOffer.boxIndex} 箱待启封。</p></header>
      <div className="codex-offer-grid">{(self.itemOffer.boxes[self.itemOffer.boxIndex]??[]).map(id=><button key={id} disabled={!editable} className="codex-choice-card" onClick={()=>void action({kind:'pick_item',item:id})}><img className="peach-card-art" src={itemImage(id,{label:equipment(id)})} alt=""/><strong>{equipment(id)}</strong><p className="text-sm">{itemHint(id)}</p><span className="card-fleuron-corner">✧</span></button>)}</div>
    </section>:null}
    </div>:null}
      <div className={`room-board-layout ${shopOpen?'is-shop-open':''} ${panelsOpen?'show-panels':''}`}><button type="button" className="room-panel-toggle" aria-expanded={panelsOpen} onClick={()=>setPanelsOpen(value=>!value)}>{panelsOpen?'收起信息':'对局信息'}</button>
     <aside className="room-ranking" aria-label="当前排名"><strong><span className="fleuron">✦</span> 弈者名录 <span className="fleuron">✦</span></strong>{ranking.map((seat,rank)=><div className={`room-ranking-row rank-${rank+1} ${seat.index===index?'is-self':''}`} key={seat.id}><span className="room-ranking-place">{rank===0?'✦ 1':rank===1?'❖ 2':rank===2?'✧ 3':`${rank+1}`}</span><span className="room-ranking-name">{seat.name}</span><span className="room-ranking-hp"><i style={{width:`${Math.max(0,Math.min(100,seat.hp/(view.maxHp??modePack(view.mode).rules.startHp)*100))}%`}}/><b>{seat.hp}</b></span></div>)}
       {self?<div className="room-ranking-self" aria-label={`我的${terms.level.name}与${terms.level.shop}`}><span>{terms.level.name} {levelLabel(terms, self.level??START_LEVEL)}</span><span>{terms.level.xp} {self.xp??0}/{xpToNext(self.level??START_LEVEL)??'MAX'}</span><span>{terms.level.shop} {shopMaxCostForLevel(self.level??START_LEVEL)}费</span><span>{terms.level.upgrade} {goldAmount(terms, XP_BUY_COST)}</span></div>:null}
     </aside>
     <div className="room-board-main">
      <div className="room-versus-hud" aria-label="当前交手双方">
        <div className="versus-side own">
          <Avatar id={own?.accountId ?? own?.id ?? 'self'} frame={own?.frame} size={30} />
          <div className="versus-meta">
            <span className="versus-name">{watching ? '观战席' : (own?.name ?? '我方')}</span>
            <span className="versus-sub">{modePack(view.mode).showHpInVersus&&own ? `${own.hp} / ${view.maxHp??modePack(view.mode).rules.startHp} 血` : watching ? '观测者' : '执子在下方'}</span>
          </div>
        </div>
        <div className="versus-stage-badge">
          <span className="stage-star">✦</span>
          <span className="stage-text">
             {playback ? `第 ${playback.battle.round} 轮 · 对局回放` : view.phase === 'prepare' ? `第 ${view.round} 轮 · 备战排布` : '棋局待启'}
          </span>
          <span className="stage-vs">VS</span>
          <span className="stage-star">✦</span>
        </div>
        <div className="versus-side enemy">
          <div className="versus-meta text-right">
            <span className="versus-name">
              {shownEnemy?.name ?? (view.phase === 'waiting' ? '等待棋友' : '本轮轮空')}
              {shownEnemy?.bot ? <span className="versus-tag-bot">机</span> : null}
              {replay?.ghost ? <span className="versus-tag-ghost">镜像</span> : null}
            </span>
            <span className="versus-sub">{shownEnemy ? modePack(view.mode).showHpInVersus ? `${shownEnemy.hp} / ${view.maxHp??modePack(view.mode).rules.startHp} 血` : '客席迎战' : '空席'}</span>
          </div>
          <Avatar id={shownEnemy?.accountId ?? shownEnemy?.id ?? 'enemy'} frame={shownEnemy?.frame} size={30} />
        </div>
      </div>
     <Arena3D board={board} bench={bench} enemyBoard={playback?playback.battle.boards[playbackEnemy??0]!:enemy?.board??[]} enemyBench={playback?playback.battle.benches[playbackEnemy??0]!:enemy?.bench??[]}
      opponentName={shownEnemy?.name??(view.phase==='waiting'?'等待棋友入座':'本轮轮空')} skinId={equippedBoard} visiting={!!view.venue?.visiting} battle={replay?.output??null} timeMs={playback?.time??0} running={!!playback} editable={editable}
      homePalette={skinPalette(own?.skinId)} awayPalette={skinPalette(shownEnemy?.skinId)}
      boardModel={boardModelFor(equippedBoard)} terms={terms}
      selectedId={selected} onCell={(row,col)=>{if(!editable)return;if(selected)move(selected,row,col);else setSelected(board.find(p=>p.localRow===row&&p.localCol===col)?.id);}}
      onBench={id=>{if(editable)setSelected(id);}} onWithdraw={()=>{if(editable&&selected)void action({kind:'withdraw',piece:selected});}}
      onDrop={(source,target)=>{if(!editable)return;if(target.kind==='cell')move(source.id,target.row,target.col);else void action({kind:target.kind==='sell'?'sell':'withdraw',piece:source.id});}}
      notice={notice} onInspect={()=>setShopOpen(false)} onDismiss={()=>setShopOpen(false)} shopOpen={shopOpen&&!!self&&!playback} shopEnabled={!!self&&!playback&&view.phase!=='finished'} onShopToggle={()=>shopOpen?closeShop():setShopOpen(true)}
      controls={playback?<button onClick={finish}>跳过战斗</button>:watching?<><span>实时观战</span><button onClick={backToLobby}>返回大厅</button></>:view.phase==='finished'||self?.hp===0?<><button onClick={backToLobby}>新建一局</button><button onClick={()=>void leaveRoom()}>返回大厅</button></>:view.phase==='waiting'?<>{view.seatIndex===0?<button disabled={busy} onClick={()=>void startSolo()}>补路人机，直接开局</button>:<span>等待房主开局</span>}</>:<>{draft?<button onClick={()=>{setDraftOpen(true);setShopOpen(false);}}>前往旅途选秀</button>:null}<button disabled={busy||!!playback||view.phase!=='prepare'||(!self.ready&&(!editable||!self.board.length||!!draft||!!self.swordOffer||!!self.hexOffer||!!self.itemOffer))} onClick={()=>action({kind:self.ready?'unready':'ready'})}>{self.swordOffer?`先选${self.swordOffer.label}`:self.hexOffer?'先选心悟':self.itemOffer?'先选宝箱':self.ready?'已就绪 · 撤回调整':'就绪开战'}</button></>}
      inventory={<><strong>装备背包 · {self?.inventory?.length??0}</strong>{self?.inventory?.map((id,i)=><button key={`${id}-${i}`} title={itemHint(id)} disabled={!editable||!selected} onClick={()=>selected&&action({kind:'equip',piece:selected,item:id})}><img className="peach-card-art" src={itemImage(id,{label:equipment(id)})} alt=""/>{equipment(id)}</button>)}{!self?.inventory?.length?<p>{watching?'仅棋手可见':'暂无待装配装备'}</p>:null}</>}
      inspectorActions={piece=>editable&&[...self!.board,...self!.bench!].some(p=>p.id===piece.id)?<><button onClick={()=>setSelected(piece.id)}>选中棋子</button>{self!.board.some(p=>p.id===piece.id)?<button onClick={()=>action({kind:'withdraw',piece:piece.id})}>下场</button>:null}{self!.inventory!.map((id,i)=><button key={`${id}-${i}`} disabled={piece.itemIds.length>=2||piece.itemIds.includes(id)} onClick={()=>action({kind:'equip',piece:piece.id,item:id})}>装上 {equipment(id)}</button>)}{self!.inventory!.map((id,i)=>consumeLabel(id)?<button key={`use-${id}-${i}`} onClick={()=>action({kind:'consume',piece:piece.id,item:id})}>{consumeLabel(id)} {equipment(id)}</button>:null)}{piece.itemIds.map(id=><button key={id} onClick={()=>action({kind:'unequip',piece:piece.id,item:id})}>卸下 {equipment(id)}</button>)}<button onClick={()=>action({kind:'sell',piece:piece.id})}>出售</button></>:null}
       topPanel={shopOpen&&self&&!playback&&view.phase!=='finished'?<div className="peach-shop" role="dialog" aria-label={`房间战后${terms.level.shop}`}><header><strong>战后{terms.level.shop} · {terms.gold.name} {self.gold}{self.shopBanUntil&&self.shopBanUntil>=view.round?' · 养精蓄锐，不能买棋':''}</strong><span><button disabled={!editable||self.gold!<XP_BUY_COST||xpToNext(self.level??START_LEVEL)===null} onClick={()=>action({kind:'buy_xp'})}>{terms.level.upgrade} · {goldAmount(terms, XP_BUY_COST)}</button><button disabled={!editable||self.gold!<refreshPrice||!self.shop.length} onClick={()=>action({kind:'refresh'})}>{terms.reroll.name} · {goldAmount(terms, refreshPrice)}</button><button onClick={closeShop}>收起{terms.level.shop}</button></span></header><div className="peach-shop-cards">{self.shop.map((id,i)=>{if(!id)return null;const unit=findUnit(id);if(!unit)return <span key={`${view.round}-${i}`}>{id}</span>;const locked=!!self.shopBanUntil&&self.shopBanUntil>=view.round;return <button key={`${view.round}-${i}`} disabled={!editable||locked||self.gold!<roomShopPrice(self,unit)} onClick={()=>action({kind:'buy',index:i})}><img className="peach-card-art" src={itemImage(unit.id,{label:unit.name})} alt=""/><span>{goldAmount(terms, roomShopPrice(self,unit))}</span><strong>{unit.name}</strong><p className="peach-card-tag">{unitSkill(unit.id)?.name ?? ''}</p></button>;})}{!self.shop.length?<p>第一轮战斗结束后开放{terms.level.shop}。</p>:null}</div></div>:null}/>
     </div>
      <aside className="room-sidepanel" aria-label="棋局信息">
       <div className="room-side-tabs"><button className={rightTab==='battle'?'is-active':''} onClick={()=>setRightTab('battle')}>战况</button><button className={rightTab==='traits'?'is-active':''} onClick={()=>setRightTab('traits')}>羁绊</button><button className={rightTab==='items'?'is-active':''} onClick={()=>setRightTab('items')}>装备</button><button className={rightTab==='status'?'is-active':''} onClick={()=>setRightTab('status')}>状态{statusEntries.length?` ${statusEntries.length}`:''}</button></div>
       {rightTab==='battle'?<BattleStats output={statsReplay?.output} timeMs={playback?.time??statsReplay?.output.durationMs??0} running={!!playback} round={statsBattle?.round} opponent={statsReplay?view.seats[statsReplay.opponent]?.name:undefined}/>:rightTab==='traits'?<div className="room-trait-list">{[...traitCounts.entries()].map(([id,count])=>{const trait=findTrait(id);if(!trait)return null;const tier=activeTier(trait,count);return <div className={`room-trait-row ${tier?'is-active':''}`} key={id}><span>{trait.name}</span><b>{count}</b><small>{tier?`激活 ${tier}`:'未激活'}</small></div>})}{!traitCounts.size?<p>暂无上场羁绊</p>:null}</div>:rightTab==='items'?<div className="room-item-list">{self?.inventory?.map((id,i)=><div key={`${id}-${i}`}><strong>{equipment(id)}</strong><small>{itemHint(id)}</small></div>)}{!self?.inventory?.length?<p>暂无装备</p>:null}</div>:<div className="room-status-list">{statusEntries.map(entry=><div className={`room-status-entry is-${entry.tone}`} key={entry.id}><strong>{entry.title}</strong><small>{entry.detail}</small></div>)}{!statusEntries.length?<p>当前没有额外状态</p>:null}</div>}
      </aside>
     </div>
     </>
     }
    <p className="px-3 py-2 text-sm">{view.log.at(-1)}</p>
  </main>;
}

export default function RoomPage() {
  const [session,setSession]=useState<{version:number;credentials:RoomCredentials|null|undefined}>({version:0,credentials:undefined});
  return <><EchoBanner /><SocialInbox onEnterRoom={credentials=>{try{localStorage.setItem(SESSION,JSON.stringify(credentials));}catch{}window.history.replaceState(null,'',window.location.pathname);setSession(old=>({version:old.version+1,credentials}));}} /><RoomCrashFence key={session.version}><RoomApp initialCredentials={session.credentials} onSessionChange={credentials=>setSession(old=>old.version===session.version?{version:old.version+1,credentials}:old)} /></RoomCrashFence></>;
}
