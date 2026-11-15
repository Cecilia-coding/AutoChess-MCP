'use client';
import { Component, useCallback, useMemo, useEffect, useRef, useState, useSyncExternalStore, type ErrorInfo, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { modePack, DEFAULT_MODE, type MatchModeId } from '@/packs/modes/registry';
import Arena3D from './arena-3d';
import type { ClientDropTarget, ClientUnitTarget, ItemPreviewTarget } from './arena-types';
import BattleStats from './battle-stats';
import DanmakuStream from './danmaku-stream';
import { roomPlayback } from '@/lib/autochess/room-playback';
import {
  consumeBattleAudioEvents,
  createBattleAudioCursor,
  installSfxUnlock,
  isSfxMuted,
  matchOutcomeSfx,
  playSfx,
  roundOutcomeSfx,
  setActiveSoundPack,
  subscribeSfxMuted,
  toggleSfxMuted,
  type BattleAudioCursor,
} from '@/lib/autochess/sound';
import { roomBoardSkin } from '@/lib/autochess/room-appearance';
import { roomShopPrice, roomRefreshPrice } from '@/lib/autochess/room-economy';
import { roomStatusEntries } from '@/lib/autochess/room-status';
import { machineInvite, playerMcpUrl } from '@/lib/autochess/invite-copy';
import { findUnit } from '@/content/autochess/units';
import { unitSkill } from '@/content/autochess/unit-skills';
import { START_LEVEL, XP_BUY_COST, xpToNext, shopMaxCostForLevel } from '@/lib/autochess/level';
import { items, itemHint } from '@/content/autochess/items';
import { activeTier, findTrait } from '@/content/autochess/traits';
import { COSMETICS, boardModelFor, itemImage, NATIVE_BOARD_SKIN, skinPalette } from '@/lib/meta/cosmetics';
import { resolveEffectiveBoardSkin, resolveEffectiveFrame, usePreviewWardrobe, writePreviewWardrobe } from '@/lib/meta/preview-wardrobe';
import { pixelAvatarImage } from '@/lib/meta/pixel-items';
import { resolveTiles } from '@/lib/game/board';
import { packDraftIntro, packDraftTiles, packDefinition, type PackSummary } from '@/packs/registry';
import { goldAmount, levelLabel, packTerms, starLabel } from '@/packs/terms';
import type { RoomAction, RoomCredentials, RoomMutation, RoomView, RoomBattle, RoomHazardBan } from '@/lib/autochess/room-types';
import type { Combatant } from '@/lib/autochess/types';
import './room-ui.css';
import RoomResult from './room-result';
import UnitInspector from './unit-inspector';
import { previewRoomMove, type PendingRoomMove } from '@/lib/autochess/room-move-preview';
import { uniqueTraitCounts } from '@/lib/autochess/stats';
import Lobby, { Avatar } from './lobby';
import { EchoBanner } from './echo-tree';
import MachineInvitePanel from './machine-invite-panel';
import SocialInbox, { SocialInboxTrigger } from './social-inbox';
import { readAccountToken } from './account-session';
import { roomRequest } from './room-request';
import Feedback from './feedback';
import { PixelIcon } from './pixel-ui/pixel-icon';
import { PixelDraft } from './pixel-ui/pixel-draft';
import { PixelHpRail, PixelHpSceneStrip } from './pixel-ui/pixel-hp-rail';
import { RoomWorkspace } from './pixel-ui/room-workspace';
import './pixel-ui/room.css';
import './pixel-ui/fairytale-outer.css';

const SESSION = 'autochess-room-current-v1';
const SANDBOX_BOARD_OPTIONS = COSMETICS.filter(entry => entry.kind === 'board');
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
function roundOutcomeNotice(round: number, outcome: 'left' | 'right' | 'draw'): string {
  return `✦ 第 ${round} 轮小局${outcome === 'left' ? '胜利' : outcome === 'right' ? '失利' : '战平'}`;
}
function RoomApp({initialCredentials,onSessionChange}: {initialCredentials: RoomCredentials|null|undefined;onSessionChange:(next:RoomCredentials|null)=>void}) {
  const [connection,setConnection]=useState<{cursorEnabled:boolean;mcpUrl:string;packs:PackSummary[];cosmeticsSandbox?:boolean}>({cursorEnabled:false,mcpUrl:'',packs:[]});
  const preview=usePreviewWardrobe();
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
    const [rightTab,setRightTab]=useState<'unit'|'traits'|'items'|'status'|'battle'>('unit');
    const [inspectedPieceId,setInspectedPieceId]=useState<string|null>(null);
   const [hazardAlert,setHazardAlert]=useState<RoomHazardBan[]|null>(null);
  const [selected,setSelected]=useState<string>();
  const [pendingItem,setPendingItem]=useState<{id:string;index:number}|null>(null);
  const [panelsOpen,setPanelsOpen]=useState(false);
  const [playback,setPlayback]=useState<{battle:RoomBattle;time:number}|null>(null);
  const sfxMuted = useSyncExternalStore(subscribeSfxMuted, isSfxMuted, () => false);
  const battleAudioRef = useRef<BattleAudioCursor | null>(null);
  const hadActiveMatchRef = useRef<string | null>(null);
  const seenResultKeyRef = useRef<string | null>(null);
  const [savedSession,setSavedSession]=useState<RoomCredentials|null>(null);
  const seenBattle=useRef(''); const seenHazards=useRef(new Set<string>()); const busyRef=useRef(false); const current=useRef<RoomCredentials|null>(null);
  const pending=useRef<RoomMutation|null>(null);
  const dropAtClientRef=useRef<((clientX:number,clientY:number)=>ClientDropTarget)|null>(null);
  const previewClientRef=useRef<((point:{x:number;y:number}|null)=>void)|null>(null);
  const unitAtClientRef=useRef<((clientX:number,clientY:number)=>ClientUnitTarget)|null>(null);
  const previewItemRef=useRef<((target:ItemPreviewTarget)=>void)|null>(null);
  const shopGhostRef=useRef<HTMLDivElement>(null);
  const shopDragRef=useRef<{id:number;index:number;unitId:string;unitName:string;x:number;y:number;dragging:boolean}|null>(null);
  const itemDragRef=useRef<{id:number;index:number;itemId:string;itemName:string;x:number;y:number;dragging:boolean}|null>(null);
  const itemDragHandlersRef=useRef<{move:(e:PointerEvent)=>void;end:(e:PointerEvent,cancelled:boolean)=>void}|null>(null);
  const suppressShopClickRef=useRef(false);
  const suppressItemClickRef=useRef(false);
  const adopt=(next:RoomView)=>{const old=latestView.current;if(old?.id===next.id&&old.revision>next.revision)return;latestView.current=next;setActiveSoundPack(packDefinition(next.pack).presentation?.soundId);setView(next);};
  useEffect(()=>{
    if(initialCredentials!==undefined)return;
    const params=new URLSearchParams(window.location.search); const hash=new URLSearchParams(window.location.hash.slice(1));
    if(params.get('room')&&hash.get('watch')) {setCredentials({roomId:params.get('room')!,token:hash.get('watch')!});return;}
    try {const saved=localStorage.getItem(SESSION);if(saved)setSavedSession(JSON.parse(saved) as RoomCredentials);}catch{}
  },[]);
  useEffect(()=>{
    current.current=credentials;
    if(typeof window!=='undefined')window.scrollTo(0,0);
    if(!credentials)return;
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
    seenBattle.current=view.battle.output.battleId;setShopOpen(false);setDraftOpen(false);setSelected(undefined);setPendingItem(null);setInspectedPieceId(null);
    setPlayback({battle:view.battle,time:0});
  },[view?.battle?.output.battleId]);
  useEffect(() => installSfxUnlock(), []);
  const roomSoundId = credentials && view?.pack ? packDefinition(view.pack).presentation?.soundId : undefined;
  useEffect(() => {
    setActiveSoundPack(roomSoundId);
    return () => setActiveSoundPack(undefined);
  }, [roomSoundId]);
  useEffect(()=>{
    if(!playback)return;
    const start=performance.now()-playback.time/2; const id=playback.battle.output.battleId;
    const round = playback.battle.round;
    const output=roomPlayback(playback.battle,view?.seatIndex??0).output;
    const duration=output.durationMs;
    const battleSoundId = view?.pack ? packDefinition(view.pack).presentation?.soundId : undefined;
    const suppressOutcome = () => Boolean(latestView.current?.self?.result);
    if(!battleAudioRef.current || battleAudioRef.current.battleId!==id){
      battleAudioRef.current=createBattleAudioCursor(output);
      consumeBattleAudioEvents(output,playback.time,battleAudioRef.current,undefined,{suppressOutcome:suppressOutcome(),soundId:battleSoundId});
    }
    const timer=setInterval(()=>{
      const time=(performance.now()-start)*2;
      const isMatchFinal = suppressOutcome();
      if(battleAudioRef.current)consumeBattleAudioEvents(output,Math.min(time,duration),battleAudioRef.current,undefined,{suppressOutcome:isMatchFinal,soundId:battleSoundId});
      if(time>=duration){
        if(!isMatchFinal){
          setNotice(roundOutcomeNotice(round, output.outcome));
        }
        setPlayback(null);setShopOpen(true);clearInterval(timer);
      }
      else setPlayback(p=>p?.battle.output.battleId===id?{...p,time}:p);
    },50);
    return()=>clearInterval(timer);
  },[playback?.battle.output.battleId]);
  const resultOutcome = view?.self?.result?.outcome;
  useEffect(() => {
    const roomId = view?.id;
    if (!roomId) return;
    if (!resultOutcome) {
      hadActiveMatchRef.current = roomId;
      return;
    }
    if (playback) return;
    const key = `${roomId}:${resultOutcome}`;
    if (seenResultKeyRef.current === key) return;
    seenResultKeyRef.current = key;
    if (hadActiveMatchRef.current === roomId) {
      playSfx(matchOutcomeSfx(resultOutcome), { soundId: roomSoundId });
    }
  }, [view?.id, resultOutcome, Boolean(playback)]);
  useEffect(()=>{
    const hazards=view?.self?.roundHazards;
    if(playback||!view||!hazards?.banned?.length)return;
    const fresh=hazards.banned.filter(entry=>!seenHazards.current.has(`${view.id}:${entry.round??hazards.round}:${entry.pieceId}`));
    if(!fresh.length)return;
    for(const entry of fresh)seenHazards.current.add(`${view.id}:${entry.round??hazards.round}:${entry.pieceId}`);
    const timer=setTimeout(()=>setHazardAlert(fresh),0);
    return()=>clearTimeout(timer);
  },[playback,view?.id,view?.self?.roundHazards]);
  useEffect(()=>{
    const onMove=(e:PointerEvent)=>itemDragHandlersRef.current?.move(e);
    const onUp=(e:PointerEvent)=>itemDragHandlersRef.current?.end(e,false);
    const onCancel=(e:PointerEvent)=>itemDragHandlersRef.current?.end(e,true);
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    window.addEventListener('pointercancel',onCancel);
    return()=>{
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onCancel);
    };
  },[]);
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
      if(command.kind==='claim'){setDraftOpen(false);setNotice(next.self?.draftLabel??'奖励已入账');playSfx('buy');}
      if(command.kind==='roll'){setNotice(`骰点已锁定，落点奖励不会因${terms.reroll.name}而改变`);playSfx('reroll');}
      if(command.kind==='refresh'){playSfx('reroll');}
      if(command.kind==='move'){setNotice('站位已保存');playSfx('place');}
      if(command.kind==='withdraw'||command.kind==='equip'||command.kind==='consume'){playSfx('place');}
      if(command.kind==='unequip'){playSfx('place');setNotice(`✦ 已卸下「${equipment(command.item)}」，放回背包`);}
      if(command.kind==='buy_xp'){playSfx('merge');}
      if(command.kind==='ready'){playSfx('ui');}
      if(command.kind==='sell'){
        playSfx('sell');
        setSelected(cur=>cur===command.piece?undefined:cur);
        setInspectedPieceId(cur=>cur===command.piece?null:cur);
      }
      if(command.kind==='buy' && next.self) {
        const before=[...state.self.board,...state.self.bench??[]];
        const after=[...next.self.board,...next.self.bench??[]];
        const merged=after.filter(piece=>before.some(old=>old.id===piece.id && old.star<piece.star));
        playSfx(merged.length?'merge':'buy');
        if(merged.length)setNotice(merged.map(piece=>{
          const consumed=before.filter(old=>old.templateId===piece.templateId && !after.some(current=>current.id===old.id));
          const refs=consumed.map(old=>state.self!.pieceRefs?.[old.id]).filter(Boolean);
          return `${findUnit(piece.templateId)?.name??piece.templateId} 合成升至 ${starLabel(terms, piece.star)}，保留 ${next.self!.pieceRefs?.[piece.id]??'原棋子'}${refs.length?`；${refs.join('、')} 已合入`:''}`;
        }).join('；'));
      }
    } catch(e) {setError((e as Error).message);if(command.kind==='move')setNotice('站位未确认，已恢复已知棋盘，请重试');}
    finally{setMovePreview(null);busyRef.current=false;setBusy(false);}
  };
  const buyAndDeploy=async(shopIndex:number,target:{row:number;col:number})=>{
    const state=latestView.current;
    if(!credentials||!state?.self||busyRef.current)return;
    busyRef.current=true;setBusy(true);
    const beforeAll=[...state.self.board,...(state.self.bench??[])];
    const beforeIds=new Set(beforeAll.map(p=>p.id));
    const buyPayload={...credentials,round:state.round,revision:state.self.revision,requestId:crypto.randomUUID(),action:{kind:'buy' as const,index:shopIndex}};
    pending.current=buyPayload;
    try {
      const afterBuy=await request('action',buyPayload);
      adopt(afterBuy);pending.current=null;setError('');
      if(!afterBuy.self)return;
      const afterAll=[...afterBuy.self.board,...(afterBuy.self.bench??[])];
      const merged=afterAll.filter(piece=>beforeAll.some(old=>old.id===piece.id&&old.star<piece.star));
      playSfx(merged.length?'merge':'buy');
      if(merged.length){
        setNotice(merged.map(piece=>`${findUnit(piece.templateId)?.name??piece.templateId} 合成升至 ${starLabel(terms,piece.star)}`).join('；'));
      }
      const created=(afterBuy.self.bench??[]).find(p=>!beforeIds.has(p.id));
      if(!created)return;
      const occupied=afterBuy.self.board.some(p=>p.localRow===target.row&&p.localCol===target.col);
      const cap=afterBuy.self.capacity??afterBuy.self.level??START_LEVEL;
      if(!occupied&&afterBuy.self.board.length>=cap){
        if(!merged.length)setNotice('上阵席位已满，已招募至备战席');
        return;
      }
      const moveAction={kind:'move' as const,piece:created.id,row:target.row,col:target.col};
      setMovePreview({roomId:afterBuy.id,round:afterBuy.round,revision:afterBuy.self.revision,action:moveAction});
      try {
        const afterMove=await request('action',{...credentials,round:afterBuy.round,revision:afterBuy.self.revision,requestId:crypto.randomUUID(),action:moveAction});
        adopt(afterMove);
        if(!merged.length)setNotice('已招募并直接上阵');
      } catch {
        if(!merged.length)setNotice('已招募至备战席');
      }
    } catch(e) {
      setError((e as Error).message);
    } finally {
      setMovePreview(null);busyRef.current=false;setBusy(false);
    }
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
  if(!credentials)return <div className="lobby-viewport"><div role={error?'alert':undefined}>{error}</div>{savedSession?<div className="lobby-saved-session"><span className="saved-icon"><PixelIcon name="crown" size={15}/></span><span>检测到未完成棋局</span><button className="btn-resume" type="button" onClick={()=>setCredentials(savedSession)}>重连席位</button><button className="btn-clear" type="button" onClick={()=>{try{localStorage.removeItem(SESSION);}catch{}setSavedSession(null);}}>清除存档</button></div>:null}<Lobby packs={connection.packs} packsLoading={!configLoaded} packsError={configError} mcpUrl={connection.mcpUrl} cosmeticsSandbox={connection.cosmeticsSandbox} onRefreshPacks={refreshConfig} onPacksChanged={packs=>{configRequest.current++;setConnection(current=>({...current,packs}));setConfigError('');}} onCreate={(packId,mode)=>void create(packId,mode)}             onJoin={(invitation,joinKey)=>void joinRoom(invitation,joinKey)} onEnterRoom={(roomId,token)=>setCredentials({roomId,token})} busy={busy}/></div>;
  if(!view)return <div className="lobby-viewport"><main className="lobby-restore-card"><p>{error||'正在恢复棋局…'}</p><p className="lobby-hint">席位还在。不要急着清掉本机凭证；连上后会自己同步。</p><button type="button" onClick={()=>{try{localStorage.removeItem(SESSION);}catch{}onSessionChange(null);}}>返回棋室入口</button></main></div>;
  const displayed=previewRoomMove(view,movePreview);
  const self=displayed.self;const watching=!self;const index=view.seatIndex??0;
  const enemyIndex=view.opponentIndex ?? (view.seats.length===2 ? 1-index : undefined);
  const own=displayed.seats[index];const enemy=enemyIndex!==undefined?view.seats[enemyIndex]:undefined;
  const sandbox = connection.cosmeticsSandbox === true;
  const equippedBoard = resolveEffectiveBoardSkin({
    sandbox,
    previewBoard: preview.board,
    seatSkinId: roomBoardSkin(displayed),
  });
  const ownFrame = resolveEffectiveFrame({
    sandbox,
    previewFrame: preview.frame,
    seatFrame: own?.frame,
  });
  const playbackEnemy=replay?.opponent;
  const shownEnemy=playbackEnemy!==undefined?view.seats[playbackEnemy]:enemy;
  const board=playback?playback.battle.boards[index]!:own?.board??[];
  const bench=playback?playback.battle.benches[index]!:own?.bench??[];
  const refreshPrice=self?roomRefreshPrice(self,view.round):0;
  const editable=!!self&&self.hp>0&&!self.ready&&!playback&&view.phase!=='finished'&&!busy;
  const draft=self?.draft;
  const hexOffer=self?.hexOffer;
  const finish=()=>{
    if(playback && replay && !latestView.current?.self?.result){
      const cursor=battleAudioRef.current;
      if(!cursor || cursor.battleId!==replay.output.battleId || !cursor.outcomePlayed){
        if(cursor && cursor.battleId===replay.output.battleId)cursor.outcomePlayed=true;
        playSfx(roundOutcomeSfx(replay.output.outcome), { soundId: roomSoundId });
      }
      setNotice(roundOutcomeNotice(playback.battle.round, replay.output.outcome));
    }
    setPlayback(null);setShopOpen(true);
  };
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
   const cleanItemHint=(id:string)=>itemHint(id).replace(/\*\*\s*|\s*\*\*/g,'').replace(/(^|[；;]\s*)\*\s*/g,'$1').trim();
   const itemRarity=(id:string)=>items.find(x=>x.id===id)?.family??'white';
   const ranking=[...view.seats].map((seat,index)=>({...seat,index})).sort((a,b)=>b.hp-a.hp||a.index-b.index);
   const draftIntro=packDraftIntro(view.pack);
   const boardTiles=resolveTiles(packDraftTiles(view.pack));
   const traitCounts=self?uniqueTraitCounts(self.board):new Map<string,number>();
   const statusEntries=self?roomStatusEntries(self,view.round):[];
  // 一次性食用/使用类道具：显示「食用/使用/重铸」按钮
  const consumeLabel=(id:string)=>items.find(x=>x.id===id)?.consume?.label;
  const playerUrl=playerMcpUrl(connection.mcpUrl);
  const inviteText=machineInvite(playerUrl,invitation);
   const pixel=packDefinition(view.pack).presentation?.renderer === 'pixel-2d';
   const activeRightTab = !pixel && rightTab === 'unit' ? 'battle' : rightTab;
   const enemyBoardPieces = playback ? playback.battle.boards[playbackEnemy ?? 0]! : enemy?.board ?? [];
   const enemyBenchPieces = playback ? playback.battle.benches[playbackEnemy ?? 0]! : enemy?.bench ?? [];
   const allInspectable = [...board, ...bench, ...enemyBoardPieces, ...enemyBenchPieces];
   const activeInspected = inspectedPieceId ? allInspectable.find(p => p.id === inspectedPieceId) : undefined;
   const dockedPiece = activeInspected ?? (selected ? allInspectable.find(p => p.id === selected) : undefined) ?? (board[0] ?? bench[0]);
   const isOwnPiece = (piece: Combatant) => board.some(p => p.id === piece.id) || bench.some(p => p.id === piece.id);
   const ownRoster = [...board, ...bench];
   const selectedOwnPiece = selected ? ownRoster.find(p => p.id === selected) : undefined;
   const inspectedOwnPiece = activeInspected && isOwnPiece(activeInspected) ? activeInspected : undefined;
   const equippedBarTarget = selectedOwnPiece ?? inspectedOwnPiece;
   const equippedTabTarget = equippedBarTarget ?? (dockedPiece && isOwnPiece(dockedPiece) ? dockedPiece : undefined);
   const activePendingItem = editable && pendingItem && self?.inventory?.[pendingItem.index] === pendingItem.id ? pendingItem : null;
   const canApplyItem = (itemId: string, piece: Combatant): { ok: true; consume?: string } | { ok: false; reason: string } => {
     const cLabel = consumeLabel(itemId);
     if (cLabel) return { ok: true, consume: cLabel };
     if (piece.itemIds.length >= 2) return { ok: false, reason: '装备已满 (2/2)' };
     if (piece.itemIds.includes(itemId)) return { ok: false, reason: '已有同名装备' };
     return { ok: true };
   };
   const applyItemToPiece = (itemId: string, piece: Combatant) => {
     const uName = findUnit(piece.templateId)?.name ?? piece.templateId;
     const check = canApplyItem(itemId, piece);
     if (!check.ok) {
       setNotice(`⚠ ${uName} ${check.reason}`);
       return false;
     }
     setPendingItem(null);
     setNotice(check.consume ? `✦ 已为 ${uName} ${check.consume}「${equipment(itemId)}」` : `✦ 已为 ${uName} 装上「${equipment(itemId)}」`);
     void action({ kind: check.consume ? 'consume' : 'equip', piece: piece.id, item: itemId });
     return true;
   };
   const resolveItemDropPiece = (clientX: number, clientY: number): Combatant | undefined => {
     const hit = unitAtClientRef.current?.(clientX, clientY);
     if (hit) return ownRoster.find(p => p.id === hit.id);
     const elUnder = typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null;
     if (elUnder?.closest('.unit-dossier') && dockedPiece && isOwnPiece(dockedPiece)) return dockedPiece;
     return undefined;
   };
   itemDragHandlersRef.current = {
     move: (e: PointerEvent) => {
       const drag = itemDragRef.current;
       if (!drag || drag.id !== e.pointerId) return;
       if (!drag.dragging) {
         if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
         drag.dragging = true;
         suppressItemClickRef.current = true;
       }
       const targetPiece = resolveItemDropPiece(e.clientX, e.clientY);
       const check = targetPiece ? canApplyItem(drag.itemId, targetPiece) : null;
       previewItemRef.current?.(targetPiece && check ? { unitId: targetPiece.id, valid: check.ok } : null);
       const ghostEl = shopGhostRef.current;
       if (ghostEl) {
         const img = ghostEl.querySelector('img');
         const span = ghostEl.querySelector('span');
         const src = itemImage(drag.itemId, { label: drag.itemName, pixel: true });
         if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
         if (span) {
           if (targetPiece && check) {
             const uName = findUnit(targetPiece.templateId)?.name ?? targetPiece.templateId;
             span.textContent = check.ok
               ? (check.consume ? `✦ 给 ${uName} ${check.consume}` : `✦ 装给 ${uName} (${targetPiece.itemIds.length}/2)`)
               : `⚠ ${uName} · ${check.reason}`;
           } else {
             span.textContent = `拖到棋子装配 · ${drag.itemName}`;
           }
         }
         ghostEl.dataset.sell = 'false';
         ghostEl.dataset.equip = targetPiece && check ? (check.ok ? 'valid' : 'warn') : 'idle';
         ghostEl.style.display = 'flex';
         ghostEl.style.transform = `translate3d(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px, 0)`;
       }
     },
     end: (e: PointerEvent, cancelled: boolean) => {
       const drag = itemDragRef.current;
       if (!drag || drag.id !== e.pointerId) return;
       itemDragRef.current = null;
       if (shopGhostRef.current) {
         shopGhostRef.current.style.display = 'none';
         delete shopGhostRef.current.dataset.equip;
       }
       previewItemRef.current?.(null);
       if (cancelled || !drag.dragging) return;
       const targetPiece = resolveItemDropPiece(e.clientX, e.clientY);
       if (targetPiece) applyItemToPiece(drag.itemId, targetPiece);
       setTimeout(() => { suppressItemClickRef.current = false; }, 0);
     },
   };
   const makeItemInteract = (id: string, i: number) => ({
     onPointerDown: pixel ? (e: ReactPointerEvent<HTMLButtonElement>) => {
       if (e.currentTarget.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
       itemDragRef.current = { id: e.pointerId, index: i, itemId: id, itemName: equipment(id), x: e.clientX, y: e.clientY, dragging: false };
     } : undefined,
     onClick: () => {
       if (suppressItemClickRef.current) { suppressItemClickRef.current = false; return; }
       if (!editable) return;
       if (selectedOwnPiece && canApplyItem(id, selectedOwnPiece).ok) {
         applyItemToPiece(id, selectedOwnPiece);
         return;
       }
       if (activePendingItem?.index === i && activePendingItem.id === id) {
         setPendingItem(null);
         setNotice('');
         return;
       }
       setPendingItem({ id, index: i });
       setNotice(`✦ 已拿起「${equipment(id)}」— 点击棋盘或备战席上的己方棋子装上`);
     },
   });
   const renderInspectorActions = (piece: Combatant) => editable && self && [...self.board, ...(self.bench ?? [])].some(p => p.id === piece.id) ? <>
     <button onClick={() => setSelected(piece.id)}>选中棋子</button>
     {self.board.some(p => p.id === piece.id) ? <button onClick={() => action({ kind: 'withdraw', piece: piece.id })}>下场</button> : null}
     {piece.itemIds.map((id, i) => <button key={`unequip-${id}-${i}`} onClick={() => action({ kind: 'unequip', piece: piece.id, item: id })}>卸下 {equipment(id)}</button>)}
     {(self.inventory ?? []).map((id, i) => <button key={`${id}-${i}`} disabled={piece.itemIds.length >= 2 || piece.itemIds.includes(id)} onClick={() => action({ kind: 'equip', piece: piece.id, item: id })}>装上 {equipment(id)}</button>)}
     {(self.inventory ?? []).map((id, i) => consumeLabel(id) ? <button key={`use-${id}-${i}`} onClick={() => action({ kind: 'consume', piece: piece.id, item: id })}>{consumeLabel(id)} {equipment(id)}</button> : null)}
     <button onClick={() => action({ kind: 'sell', piece: piece.id })}>出售</button>
   </> : null;
   const xpNext = self ? xpToNext(self.level ?? START_LEVEL) : null;
   const maxHp = view.maxHp ?? modePack(view.mode).rules.startHp;
    const roomMenu=!watching?<details className="autochess-companion room-float"><summary className={pixel?'pixel-hud-slot':undefined} aria-label="房间菜单" title="房间菜单">{pixel?<><PixelIcon name="menu" size={13}/><span className="pixel-hud-slot-label">菜单</span></>:'☰'}</summary><div className="room-actions rounded-xl border bg-white p-3 text-sm">
        <button className="room-menu-close" type="button" onClick={event=>event.currentTarget.closest('details')?.removeAttribute('open')}>收起房间菜单</button>
        <SocialInboxTrigger variant="menu" />
        <Feedback roomId={view.id} variant="menu" />
        <p>{`${modePack(view.mode).name} · `}房间 {view.id} · {enemy?`对局中 · ${enemy.name}`:`等待棋友（${view.seats.length}/${view.seatCount}）`}</p>
        {view.seatIndex===0&&enemy?<><button type="button" disabled={busy||view.phase!=='prepare'||enemy.ready} onClick={async()=>{try{adopt(await request('poke',credentials!));setNotice('催促已登记；需客户端正在监听，30秒内重复点击会合并。');}catch(e){setError((e as Error).message);}}}>踹醒它</button><p role="status">{view.wake?.status} · 自动续聊需要客户端适配器正在等待</p></>:null}
        {view.seatIndex===0?<><MachineInvitePanel credentials={credentials} mcpUrl={playerUrl} canInvite={view.phase==='waiting'&&view.seats.length<(view.seatCount??2)} onNotice={setNotice}/><button className="m-1 rounded border p-2" disabled={!invitation||!playerUrl} onClick={()=>copy(inviteText,'邀请词抄好了，发给它就行')}>复制普通邀请</button><button className="m-1 rounded border p-2" disabled={!playerUrl} onClick={()=>copy(playerUrl,'MCP 地址抄好了')}>复制 MCP 地址</button><button className="m-1 rounded border p-2" disabled={!watchLink} onClick={()=>copy(watchLink,'观战链接抄好了')}>复制观战链接</button><p className="break-all">给机的 MCP：{playerUrl||'加载中…'}</p></>:null}
        {view.phase!=='finished'&&self&&self.hp>0?<button className="m-1 rounded border p-2" onClick={()=>action({kind:'resign'})}>认输结束</button>:<button className="m-1 rounded border p-2" onClick={backToLobby}>新建一局</button>}
        <button className="m-1 rounded border p-2" type="button" onClick={()=>toggleSfxMuted()}>{sfxMuted?'开启战斗音效':'关闭战斗音效'}</button>
        {sandbox ? <label className="m-1 block rounded border p-2 text-xs">试穿棋盘：<select aria-label="菜单切换试穿棋盘" value={equippedBoard ?? NATIVE_BOARD_SKIN} onChange={event => writePreviewWardrobe({ board: event.target.value })}>
          <option value={NATIVE_BOARD_SKIN}>原盘·随棋谱</option>
          {SANDBOX_BOARD_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label> : null}
        <button className="m-1 rounded border p-2" type="button" onClick={()=>void leaveRoom()}>退出房间（自动认输）</button>
       </div></details>:null;
    const pixelHudTools = pixel ? <>
      {sandbox ? <label className="pixel-hud-board-picker" title={`实时试穿全部 ${SANDBOX_BOARD_OPTIONS.length} 套像素棋盘与联动按键皮肤`}>
        <PixelIcon name="frame" size={12} />
        <select aria-label="试穿棋盘皮肤" value={equippedBoard ?? NATIVE_BOARD_SKIN} onChange={event => writePreviewWardrobe({ board: event.target.value })}>
          <option value={NATIVE_BOARD_SKIN}>原盘·随棋谱</option>
          {SANDBOX_BOARD_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label> : null}
      <button type="button" className={`pixel-hud-slot ${sfxMuted ? 'is-muted' : ''}`} aria-pressed={!sfxMuted} aria-label={sfxMuted ? '开启音效' : '关闭音效'} title={sfxMuted ? '开启打击与战斗音效' : '静音音效'} onClick={() => toggleSfxMuted()}>
        <PixelIcon name={sfxMuted ? 'mute' : 'volume'} size={13} />
        <span className="pixel-hud-slot-label">{sfxMuted ? '静音' : '音效'}</span>
      </button>
      <SocialInboxTrigger variant="pixel" />
      <Feedback roomId={view.id} variant="pixel" />
      {roomMenu}
    </> : undefined;
    const danmakuFlying=<DanmakuStream key={view.id} messages={view.danmaku??[]} playbackRound={playback?.battle.round} covered={shopOpen} />;
    const composer=!watching?<form className="danmaku-composer" onSubmit={event=>{event.preventDefault();void sayDanmaku();}}>
        <input value={danmakuText} maxLength={60} placeholder="发条弹幕…" onChange={event=>setDanmakuText(event.target.value)} aria-label="弹幕输入" />
        <button type="submit" disabled={!danmakuText.trim()}>发射</button>
      </form>:null;
    const stageShort = playback ? `R${playback.battle.round} · 交锋` : view.phase === 'prepare' ? `R${view.round} · 备战` : '待开局';
    const shownEnemySeatIndex = playbackEnemy !== undefined ? playbackEnemy : enemyIndex;
    const versusHud=<div className="room-versus-hud" aria-label="当前交手双方">
        <div className="versus-side own">
          {pixel && !ownFrame ? <img className="pixel-versus-avatar" src={pixelAvatarImage(own?.accountId ?? own?.id ?? 'self', { self: true })} alt="" draggable={false} /> : <Avatar id={own?.accountId ?? own?.id ?? 'self'} frame={ownFrame} size={32} />}
          <div className="versus-meta">
            <span className="versus-name">{watching ? '观战席' : (own?.name ?? '我方')}</span>
            <span className="versus-sub">{modePack(view.mode).showHpInVersus&&own ? `${own.hp} / ${maxHp} 血` : watching ? '观测者' : '执子在下方'}</span>
          </div>
          {pixel && modePack(view.mode).showHpInVersus && own ? <span className="versus-hp-pill own"><PixelIcon name="heart" size={10} /><b>{own.hp}</b></span> : null}
        </div>
        <div className="versus-stage-badge" data-phase={playback ? 'battle' : view.phase}>
          <span className="stage-star">{pixel?<PixelIcon name="sword" size={13}/>:'✦'}</span>
          <span className="stage-text">
             {playback ? `第 ${playback.battle.round} 轮 · 自动交锋` : view.phase === 'prepare' ? `第 ${view.round} 轮 · 备战排布` : '棋局待启'}
          </span>
          {pixel ? <span className="stage-text-compact">{stageShort}</span> : null}
          <span className="stage-vs">VS</span>
        </div>
        <div className="versus-side enemy">
          {pixel && modePack(view.mode).showHpInVersus && shownEnemy ? <span className="versus-hp-pill enemy"><b>{shownEnemy.hp}</b><PixelIcon name="heart" size={10} /></span> : null}
          <div className="versus-meta text-right">
            <span className="versus-name">
              {shownEnemy?.name ?? (view.phase === 'waiting' ? '等待棋友' : '本轮轮空')}
              {shownEnemy?.bot ? <span className="versus-tag-bot">机</span> : null}
              {replay?.ghost ? <span className="versus-tag-ghost">镜像</span> : null}
            </span>
            <span className="versus-sub">{shownEnemy ? modePack(view.mode).showHpInVersus ? `${shownEnemy.hp} / ${maxHp} 血` : '客席迎战' : '空席'}</span>
          </div>
          {pixel ? <img className="pixel-versus-avatar" src={pixelAvatarImage(shownEnemy?.accountId ?? shownEnemy?.id ?? 'enemy', { bot: shownEnemy?.bot })} alt="" draggable={false} /> : <Avatar id={shownEnemy?.accountId ?? shownEnemy?.id ?? 'enemy'} frame={shownEnemy?.frame} size={30} />}
        </div>
      </div>;
   return <main data-pack={view.pack} data-board-skin={equippedBoard || undefined} className={`room-table autochess-table mx-auto max-w-[1500px] px-3 py-3 text-[var(--ink)] ${pixel?'pixel-game':''}`}>
       {!pixel?roomMenu:null}
     {!pixel?<section className={`danmaku-strip ${shopOpen?'is-covered':''}`} aria-label="弹幕">{danmakuFlying}{composer}</section>:null}
     {error?<p className="room-error" role="alert">{error} {pending.current?<button onClick={retry}>重试刚才操作</button>:null}</p>:null}
     {hazardAlert?<div className="hazard-dialog-layer"><dialog open className="hazard-dialog" aria-labelledby="hazard-dialog-title">
       <header><span><i/> ACCOUNT CENTER</span><button type="button" aria-label="关闭封号提示" onClick={()=>setHazardAlert(null)}>×</button></header>
       <div className="hazard-dialog-body"><div className="hazard-pet" aria-hidden="true">🤖<span>!</span></div><div className="hazard-speech"><strong id="hazard-dialog-title">Your account has been suspended.</strong><p>{hazardAlert.every(entry=>entry.zone==='bench')?'都没上场，还是被查到了。':'查 IP 命中。账号已从本局阵容中强制下线。'}</p></div></div>
       <ul>{hazardAlert.map(entry=><li key={entry.pieceId}><b>{entry.name}</b><span>命中率 {Math.round(entry.chancePct)}%{entry.refundGold?` · 返还 ${goldAmount(terms, entry.refundGold)}`:''}{entry.returnedItems?.length?` · ${entry.returnedItems.length} 件装备已退回背包`:''}</span></li>)}</ul>
       <footer><button type="button" onClick={()=>{setHazardAlert(null);setRightTab('status');}}>看看发生了什么</button><button type="button" className="hazard-ack" onClick={()=>setHazardAlert(null)}>好的（扶额）</button></footer>
     </dialog></div>:null}
    {!pixel&&self?.bounty?.bank?<p className="px-2">连败赏金 {goldAmount(terms, self.bounty.bank)} · 取胜领取，淘汰清零</p>:null}
    {!pixel&&playback?<output>正在回放第 {playback.battle.round} 轮 · 棋友可同时准备下一轮</output>:null}
    {self?.result?<RoomResult key={view.id} result={self.result} finished={view.phase==='finished'} show={!playback} onReturn={backToLobby}/>:view.phase==='finished'&&!playback?<p className="p-3 font-bold" role="status">{view.winner==='draw'?'平局':`${view.seats[view.winner??0]?.name??'对方'} 获胜`} · 棋局已保存</p>:null}
    {!pixel&&draftOpen&&draft&&!self?.result&&!playback?<section className="room-draft" aria-label="旅途选秀">
      <header className="room-draft-header"><div><span className="room-draft-kicker">autochess · 一掷定缘</span><h2>旅途选秀</h2><p>每轮一次，落点已保存。领取后回到棋盘。</p></div><button onClick={()=>setDraftOpen(false)}>暂回棋盘</button></header>
      <div className="board-grid">{boardTiles.map((tile,i)=><article key={tile.id} className={`board-tile ${tile.type} ${(draft.landing??draft.position)===i?'active':''}`} style={{gridRow:tile.coordinate[0],gridColumn:tile.coordinate[1]}}><span className="tile-number">{String(i+1).padStart(2,'0')}</span><strong>{tile.name}</strong><small title={draft.track[i]?.detail}>{draft.track[i]?.label}</small></article>)}
        <div className="board-center"><span className="room-draft-state">{draft.roll===undefined?'等待掷骰':'落点已锁定 · 待领取'}</span><div className="room-dice-face" aria-label={draft.roll===undefined?'骰子':`骰点 ${draft.roll}`}>{draft.roll??'?'}</div><h3>{draft.landing===undefined?'下一站，会遇见什么？':draft.track[draft.landing]?.label}</h3><p>{draft.landing===undefined?'装备、棋子、机缘或小小意外，都在这条旅途中。':draft.track[draft.landing]?.detail}</p><button className="room-draft-primary" disabled={busy} onClick={()=>action({kind:draft.roll===undefined?'roll':'claim'})}>{busy?'正在结算…':draft.roll===undefined?'掷骰子 · 出发':draft.track[draft.landing!]?.kind==='mishap'?'接受遭遇 · 返回棋盘':'领取奖励 · 返回棋盘'}</button></div>
      </div></section>:
    <>
    {pixel&&draftOpen&&draft&&!self?.result&&!playback?<PixelDraft draft={draft} tiles={boardTiles} terms={terms} intro={draftIntro} busy={busy} onClose={()=>setDraftOpen(false)} onAct={()=>void action({kind:draft.roll===undefined?'roll':'claim'})}/>:null}
    {(self?.swordOffer||self?.hexOffer||self?.itemOffer)&&!self?.result&&!playback?<div className="room-offer-overlay">
    {self?.swordOffer?<section className="codex-offer-card" aria-label={`开局${self.swordOffer.label}三选一`}>
      <header className="codex-offer-header"><span className="codex-offer-badge">✦ 一掷定剑 · 命途初现 ✦</span><h2 className="font-heading text-xl">开局{self.swordOffer.label} · 三选一</h2><p className="text-sm">选一件进装备背包，选完方可就绪布阵。</p></header>
      <div className="codex-offer-grid">{self.swordOffer.choices.map(id=><button key={id} disabled={!editable} data-rarity={itemRarity(id)} className="codex-choice-card" onClick={()=>void action({kind:'pick_sword',item:id})}><span className="codex-choice-pedestal"><img className="peach-card-art" src={itemImage(id,{label:equipment(id)})} alt=""/></span><strong>{equipment(id)}</strong><p className="text-sm">{cleanItemHint(id)}</p><span className="codex-choice-cta">择此入局 ▸</span><span className="card-fleuron-corner">✦</span></button>)}</div>
    </section>:null}
    {hexOffer?<section className="codex-offer-card" aria-label="心悟三选一">
      <header className="codex-offer-header"><span className="codex-offer-badge">❖ 灵台顿悟 · 局势天工 ❖</span><h2 className="font-heading text-xl">心悟三选一 · {hexOffer.rarity==='orange'?'橙色神圣':hexOffer.rarity==='gold'?'金色史诗':hexOffer.rarity==='purple'?'紫色稀有':'蓝色经典'}</h2><p className="text-sm">本轮全员同一稀有度。择一精修入道。</p></header>
      <div className="codex-offer-grid">{hexOffer.choices.map(hex=><button key={hex.id} disabled={!editable} data-rarity={hexOffer.rarity} className={`codex-choice-card rarity-${hexOffer.rarity}`} onClick={()=>action({kind:'pick_hex',hex:hex.id})}><strong>{hex.name}</strong><p className="text-sm">{hex.note}</p><span className="codex-choice-cta">领悟此道 ▸</span><span className="card-fleuron-corner">❖</span></button>)}</div>
    </section>:null}
    {self?.itemOffer?<section className="codex-offer-card" aria-label="装备宝箱多选一">
      <header className="codex-offer-header"><span className="codex-offer-badge">✧ 灵宝锦囊 · 奇门遁甲 ✧</span><h2 className="font-heading text-xl">装备宝箱 · 从 {(self.itemOffer.boxes[self.itemOffer.boxIndex]??[]).length} 件里选 1</h2><p className="text-sm">还剩 {self.itemOffer.boxes.length-self.itemOffer.boxIndex} 箱待启封。</p></header>
      <div className="codex-offer-grid">{(self.itemOffer.boxes[self.itemOffer.boxIndex]??[]).map(id=><button key={id} disabled={!editable} data-rarity={itemRarity(id)} className="codex-choice-card" onClick={()=>void action({kind:'pick_item',item:id})}><span className="codex-choice-pedestal"><img className="peach-card-art" src={itemImage(id,{label:equipment(id)})} alt=""/></span><strong>{equipment(id)}</strong><p className="text-sm">{cleanItemHint(id)}</p><span className="codex-choice-cta">收入行囊 ▸</span><span className="card-fleuron-corner">✧</span></button>)}</div>
    </section>:null}
    </div>:null}
<RoomWorkspace pixel={pixel} legacyClassName={`room-board-layout ${shopOpen?'is-shop-open':''} ${panelsOpen?'show-panels':''}`} toggle={<button type="button" className="room-panel-toggle" aria-expanded={panelsOpen} onClick={()=>setPanelsOpen(value=>!value)}>{panelsOpen?'收起信息':'对局信息'}</button>} ranking={pixel ? <PixelHpRail
       ranking={ranking}
       selfIndex={index}
       enemyIndex={shownEnemySeatIndex}
       maxHp={maxHp}
       levelText={self ? levelLabel(terms, self.level ?? START_LEVEL) : undefined}
       xpText={self ? (xpNext === null ? 'MAX' : `${self.xp ?? 0}/${xpNext}`) : undefined}
       xpPct={self ? (xpNext ? Math.min(100, Math.round(((self.xp ?? 0) / xpNext) * 100)) : 100) : undefined}
       capText={self ? `阵 ${board.length}/${self.capacity ?? self.level ?? START_LEVEL}` : undefined}
       bountyText={self?.bounty?.bank ? `赏金 ${goldAmount(terms, self.bounty.bank)}` : null}
     /> : <aside className="room-ranking" aria-label="当前排名">
       <strong><span className="fleuron">✦</span> 弈者名录</strong>
       <div className="room-ranking-list">
         {ranking.map((seat,rank)=><div className={`room-ranking-row rank-${rank+1} ${seat.index===index?'is-self':''}`} key={seat.id}>
           <span className="room-ranking-place">{rank===0?'✦ 1':rank===1?'❖ 2':rank===2?'✧ 3':`${rank+1}`}</span>
           <span className="room-ranking-name">{seat.name}</span>
           <span className="room-ranking-hp"><i style={{width:`${Math.max(0,Math.min(100,seat.hp/maxHp*100))}%`}}/><b>{seat.hp}</b></span>
         </div>)}
       </div>
       {self ? <div className="room-ranking-self" aria-label={`我的${terms.level.name}与${terms.level.shop}`}><span>{terms.level.name} {levelLabel(terms, self.level??START_LEVEL)}</span><span>{terms.level.xp} {self.xp??0}/{xpNext??'MAX'}</span><span>{terms.level.shop} {shopMaxCostForLevel(self.level??START_LEVEL)}费</span><span>{terms.level.upgrade} {goldAmount(terms, XP_BUY_COST)}</span></div> : null}
     </aside>} information={<aside className="room-sidepanel" aria-label="棋局信息">
       <div className="room-side-tabs">
         {pixel ? <button className={activeRightTab==='unit'?'is-active':''} onClick={()=>setRightTab('unit')}><PixelIcon name="star" size={11}/>棋子</button> : null}
         <button className={activeRightTab==='traits'?'is-active':''} onClick={()=>setRightTab('traits')}>{pixel?<PixelIcon name="shield" size={11}/>:null}羁绊{traitCounts.size?` ${traitCounts.size}`:''}</button>
         <button className={activeRightTab==='battle'?'is-active':''} onClick={()=>setRightTab('battle')}>{pixel?<PixelIcon name="sword" size={11}/>:null}战况</button>
         <button className={activeRightTab==='items'?'is-active':''} onClick={()=>setRightTab('items')}>{pixel?<PixelIcon name="bag" size={11}/>:null}装备{self?.inventory?.length?` ${self.inventory.length}`:''}</button>
         <button className={activeRightTab==='status'?'is-active':''} onClick={()=>setRightTab('status')}>{pixel?<PixelIcon name="scroll" size={11}/>:null}状态{statusEntries.length?` ${statusEntries.length}`:''}</button>
       </div>
       <div className="room-side-body">
         {activeRightTab==='unit' ? (
           dockedPiece ? <UnitInspector docked piece={dockedPiece} board={isOwnPiece(dockedPiece)?board:enemyBoardPieces} side={isOwnPiece(dockedPiece)?'left':'right'} owner={isOwnPiece(dockedPiece)?'己方':(shownEnemy?.name??'对方')} replaying={!!playback} onClose={activeInspected?()=>setInspectedPieceId(null):undefined} onUnequip={editable&&isOwnPiece(dockedPiece)?(itemId)=>{void action({kind:'unequip',piece:dockedPiece.id,item:itemId});}:undefined} actions={renderInspectorActions(dockedPiece)} terms={terms} />
           : <div className="pixel-empty-pane"><PixelIcon name="star" size={18}/><p>点击棋盘或备战席上的棋子，即可在此检视属性、技能与装备。</p></div>
         ) : activeRightTab==='battle' ? <BattleStats output={statsReplay?.output} timeMs={playback?.time??statsReplay?.output.durationMs??0} running={!!playback} round={statsBattle?.round} opponent={statsReplay?view.seats[statsReplay.opponent]?.name:undefined}/>
         : activeRightTab==='traits' ? <div className="room-trait-list">{[...traitCounts.entries()].map(([id,count])=>{const trait=findTrait(id);if(!trait)return null;const tier=activeTier(trait,count);return <div className={`room-trait-row ${tier?'is-active':''}`} key={id}><span>{trait.name}</span><b>{count}</b><small>{tier?`激活 ${tier}`:'未激活'}</small></div>})}{!traitCounts.size?<p>暂无上场羁绊，拖动备战棋子上阵即可激活。</p>:null}</div>
         : activeRightTab==='items' ? <div className="room-item-list">{equippedTabTarget&&equippedTabTarget.itemIds.length?<div className="pixel-bag-equipped-group"><div className="pixel-bag-equipped-head">已装在「{findUnit(equippedTabTarget.templateId)?.name??equippedTabTarget.templateId}」身上</div>{equippedTabTarget.itemIds.map((id,i)=><div className="pixel-bag-equipped-card" key={`eq-${equippedTabTarget.id}-${id}-${i}`}><img className="peach-card-art" src={itemImage(id,{label:equipment(id),pixel})} alt="" draggable={false}/><div><strong>{equipment(id)}</strong><small>{cleanItemHint(id)}</small></div><button type="button" disabled={!editable} onClick={()=>void action({kind:'unequip',piece:equippedTabTarget.id,item:id})}>卸下</button></div>)}</div>:null}{self?.inventory?.map((id,i)=>{const interact=makeItemInteract(id,i);const armed=activePendingItem?.index===i&&activePendingItem.id===id;return <button type="button" key={`${id}-${i}`} className={`pixel-bag-card ${armed?'is-armed':''}`} disabled={!editable} {...interact}><img className="peach-card-art" src={itemImage(id,{label:equipment(id),pixel})} alt="" draggable={false}/><div><strong>{equipment(id)}<em>{consumeLabel(id)??(armed?'待选目标':'拖动/点击装配')}</em></strong><small>{cleanItemHint(id)}</small></div></button>;})}{!self?.inventory?.length&&!equippedTabTarget?.itemIds.length?<p>暂无待装配装备</p>:null}</div>
         : <div className="room-status-list">{statusEntries.map(entry=><div className={`room-status-entry is-${entry.tone}`} key={entry.id}><strong>{entry.title}</strong><small>{entry.detail}</small></div>)}{!statusEntries.length?<p>当前没有额外状态</p>:null}{pixel&&view.log.length?<div className="pixel-side-log"><strong>近期纪要</strong>{view.log.slice(-6).reverse().map((line,i)=><p key={i}>{line}</p>)}</div>:null}</div>}
       </div>
      </aside>}>
<div className="room-board-main">
      {!pixel?versusHud:null}
     <Arena3D hud={pixel?versusHud:undefined} hudTools={pixelHudTools} sceneHud={pixel?<PixelHpSceneStrip ranking={ranking} selfIndex={index} enemyIndex={shownEnemySeatIndex} maxHp={maxHp} />:undefined} inspectedPieceId={pixel?inspectedPieceId:undefined} onInspectChange={pixel?(id=>{setInspectedPieceId(id);if(id)setRightTab('unit');}):undefined} overlay={pixel?<section className="danmaku-strip" aria-label="弹幕">{danmakuFlying}</section>:undefined} footer={pixel?composer:undefined} log={playback ? `正在交锋：第 ${playback.battle.round} 轮` : view.log.at(-1)} board={board} bench={bench} enemyBoard={enemyBoardPieces} enemyBench={enemyBenchPieces}
      dropAtClientRef={pixel?dropAtClientRef:undefined} previewClientRef={pixel?previewClientRef:undefined}
      unitAtClientRef={pixel?unitAtClientRef:undefined} previewItemRef={pixel?previewItemRef:undefined} armedItemId={pixel?activePendingItem?.id??null:undefined}
      opponentName={shownEnemy?.name??(view.phase==='waiting'?'等待棋友入座':'本轮轮空')} skinId={equippedBoard} visiting={!!view.venue?.visiting} battle={replay?.output??null} timeMs={playback?.time??0} running={!!playback} editable={editable}
      homePalette={skinPalette(own?.skinId)} awayPalette={skinPalette(shownEnemy?.skinId)}
      boardModel={boardModelFor(equippedBoard)} terms={terms} {...packDefinition(view.pack).presentation}
      selectedId={selected} onCell={(row,col)=>{if(!editable)return;const cellPiece=board.find(p=>p.localRow===row&&p.localCol===col);if(activePendingItem&&cellPiece){applyItemToPiece(activePendingItem.id,cellPiece);return;}if(activePendingItem&&!cellPiece){setPendingItem(null);return;}if(selected&&cellPiece?.id===selected){setSelected(undefined);setInspectedPieceId(cellPiece.id);return;}if(selected)move(selected,row,col);else setSelected(cellPiece?.id);}}
      onBench={id=>{if(!editable)return;const benchPiece=bench.find(p=>p.id===id);if(activePendingItem&&benchPiece){applyItemToPiece(activePendingItem.id,benchPiece);return;}setSelected(id===selected?undefined:id);}} onWithdraw={()=>{if(editable&&selected)void action({kind:'withdraw',piece:selected});}}
      onDrop={(source,target)=>{if(!editable)return;if(target.kind==='cell')move(source.id,target.row,target.col);else void action({kind:target.kind==='sell'?'sell':'withdraw',piece:source.id});}}
      notice={notice} onInspect={()=>setShopOpen(false)} onDismiss={()=>setShopOpen(false)} shopOpen={shopOpen&&!!self&&!playback} shopEnabled={!!self&&!playback&&view.phase!=='finished'} onShopToggle={()=>shopOpen?closeShop():setShopOpen(true)}
      controls={playback?<button className={pixel?'pixel-primary':undefined} onClick={finish}>{pixel?<PixelIcon name="play" size={13}/>:null}跳过战斗</button>:watching?<><span>实时观战</span><button onClick={backToLobby}>返回大厅</button></>:view.phase==='finished'||self?.hp===0?<><button onClick={backToLobby}>新建一局</button><button onClick={()=>void leaveRoom()}>返回大厅</button></>:view.phase==='waiting'?<>{view.seatIndex===0?<button className={pixel?'pixel-primary':undefined} disabled={busy} onClick={()=>void startSolo()}>补路人机开局</button>:<span>等待房主开局</span>}</>:<>{draft?<button className={pixel?'pixel-draft-cta':undefined} onClick={()=>{setDraftOpen(true);setShopOpen(false);}}>{pixel?<PixelIcon name="dice" size={13}/>:null}<span>前往旅途选秀</span></button>:null}<button className={pixel?`pixel-primary ${self.ready?'is-ready':''}`:undefined} disabled={busy||!!playback||view.phase!=='prepare'||(!self.ready&&(!editable||!self.board.length||!!draft||!!self.swordOffer||!!self.hexOffer||!!self.itemOffer))} onClick={()=>action({kind:self.ready?'unready':'ready'})}>{pixel?<PixelIcon name="sword" size={14}/>:null}<span>{self.swordOffer?`先选${self.swordOffer.label}`:self.hexOffer?'先选心悟':self.itemOffer?'先选宝箱':draft?'先完成选秀':self.ready?'已就绪 · 撤回':'就绪开战'}</span></button></>}
      inventory={<><strong>{pixel?<PixelIcon name="bag" size={12}/>:null}背包 · {self?.inventory?.length??0}</strong>{equippedBarTarget?.itemIds.map((id,i)=><button type="button" key={`equipped-${equippedBarTarget.id}-${id}-${i}`} className="is-equipped" data-rarity={itemRarity(id)} title={`点击从「${findUnit(equippedBarTarget.templateId)?.name??equippedBarTarget.templateId}」卸下「${equipment(id)}」`} disabled={!editable} onClick={()=>void action({kind:'unequip',piece:equippedBarTarget.id,item:id})}><img className="peach-card-art" src={itemImage(id,{label:equipment(id),pixel})} alt="" draggable={false}/><span>{equipment(id)}</span><em>卸下</em></button>)}{self?.inventory?.map((id,i)=>{const interact=makeItemInteract(id,i);const armed=activePendingItem?.index===i&&activePendingItem.id===id;return <button type="button" key={`${id}-${i}`} className={armed?'is-armed':undefined} data-rarity={itemRarity(id)} title={`${cleanItemHint(id)}（拖到棋子身上或点击装配）`} disabled={!editable||(pixel?false:!selected)} {...(pixel?interact:{onClick:()=>selected&&action({kind:consumeLabel(id)?'consume':'equip',piece:selected,item:id})})}><img className="peach-card-art" src={itemImage(id,{label:equipment(id),pixel})} alt="" draggable={false}/><span>{equipment(id)}</span></button>;})}{!self?.inventory?.length&&!equippedBarTarget?.itemIds.length?<p>{watching?'仅棋手可见':'空槽 · 战后掉落'}</p>:null}</>}
      inspectorActions={renderInspectorActions}
      onUnequipPiece={(pieceId,itemId)=>{void action({kind:'unequip',piece:pieceId,item:itemId});}}
       topPanel={(pixel||shopOpen)&&self&&(pixel||!playback)&&view.phase!=='finished'?<div className="peach-shop" role="dialog" aria-label={`房间战后${terms.level.shop}`}>
         <header>
           <div className="peach-shop-title">
             {pixel?<PixelIcon name="bag" size={14}/>:null}
             <strong>{terms.level.shop}</strong>
             <span className="pixel-gold-chip">{pixel?<PixelIcon name="coin" size={12}/>:null}<b>{self.gold}</b> <small>{terms.gold.name}</small></span>
             {pixel ? <span className="pixel-level-chip">{levelLabel(terms, self.level??START_LEVEL)} · 上阵 {board.length}/{self.capacity??self.level??START_LEVEL}</span> : null}
             {self.shopBanUntil&&self.shopBanUntil>=view.round?<em className="pixel-shop-ban">养精蓄锐 · 禁购</em>:null}
           </div>
           <span className="peach-shop-actions">
             <button disabled={!editable||self.gold!<XP_BUY_COST||xpNext===null} onClick={()=>action({kind:'buy_xp'})}>{pixel?<PixelIcon name="bolt" size={11}/>:null}{terms.level.upgrade}{pixel&&xpNext!==null?` (${self.xp??0}/${xpNext})`:''} · {goldAmount(terms, XP_BUY_COST)}</button>
             <button disabled={!editable||self.gold!<refreshPrice||!self.shop.length} onClick={()=>action({kind:'refresh'})}>{pixel?<PixelIcon name="refresh" size={11}/>:null}{terms.reroll.name} · {goldAmount(terms, refreshPrice)}</button>
             {!pixel?<button onClick={closeShop}>收起{terms.level.shop}</button>:null}
           </span>
         </header>
         <div className={`peach-shop-cards ${pixel && !self.shop.length ? 'is-locked-deck' : ''}`}>
           {self.shop.map((id,i)=>{
             if(!id)return pixel?<div key={`${view.round}-sold-${i}`} className="pixel-card-slot is-sold"><span>已招募</span></div>:null;
             const unit=findUnit(id);
             if(!unit)return <span key={`${view.round}-${i}`}>{id}</span>;
             const locked=!!self.shopBanUntil&&self.shopBanUntil>=view.round;
             const unitCost=unit.autochessCost??unit.cost;
             const unitTraits=[...unit.factions,...unit.jobs].map(t=>findTrait(t)?.name).filter(Boolean).join(' · ');
             const finishCardDrag=(e:ReactPointerEvent<HTMLButtonElement>,cancelled:boolean)=>{
               const drag=shopDragRef.current;
               if(!drag||drag.id!==e.pointerId)return;
               shopDragRef.current=null;
               if(shopGhostRef.current)shopGhostRef.current.style.display='none';
               previewClientRef.current?.(null);
               if(cancelled||!drag.dragging)return;
               const drop=dropAtClientRef.current?.(e.clientX,e.clientY)??null;
               if(drop?.kind==='cell')void buyAndDeploy(drag.index,{row:drop.row,col:drop.col});
               else if(drop?.kind==='bench')void action({kind:'buy',index:drag.index});
               setTimeout(()=>{suppressShopClickRef.current=false;},0);
             };
             return <button key={`${view.round}-${i}`} data-cost={unitCost} disabled={!editable||locked||self.gold!<roomShopPrice(self,unit)}
               onPointerDown={pixel?e=>{
                 if(e.currentTarget.disabled||(e.pointerType==='mouse'&&e.button!==0))return;
                 shopDragRef.current={id:e.pointerId,index:i,unitId:unit.id,unitName:unit.name,x:e.clientX,y:e.clientY,dragging:false};
               }:undefined}
               onPointerMove={pixel?e=>{
                 const drag=shopDragRef.current;
                 if(!drag||drag.id!==e.pointerId)return;
                 if(!drag.dragging){
                   if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;
                   drag.dragging=true;
                   suppressShopClickRef.current=true;
                   try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
                 }
                 const ghostEl=shopGhostRef.current;
                 const drop=dropAtClientRef.current?.(e.clientX,e.clientY)??null;
                 if(ghostEl){
                   const img=ghostEl.querySelector('img');
                   const span=ghostEl.querySelector('span');
                   const src=itemImage(drag.unitId,{label:drag.unitName});
                   if(img&&img.getAttribute('src')!==src)img.setAttribute('src',src);
                   if(span)span.textContent=drop?.kind==='cell'?`上阵 · ${drag.unitName}`:drop?.kind==='bench'?`备战 · ${drag.unitName}`:drag.unitName;
                   ghostEl.dataset.sell='false';
                   ghostEl.style.display='flex';
                   ghostEl.style.transform=`translate3d(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px, 0)`;
                 }
                 previewClientRef.current?.({x:e.clientX,y:e.clientY});
               }:undefined}
               onPointerUp={pixel?e=>finishCardDrag(e,false):undefined}
               onPointerCancel={pixel?e=>finishCardDrag(e,true):undefined}
               onClick={()=>{
                 if(suppressShopClickRef.current){suppressShopClickRef.current=false;return;}
                 void action({kind:'buy',index:i});
               }}>
               {pixel?<div className="pixel-card-top"><em>{unitCost}费</em><small>{unitTraits}</small></div>:null}
               <img className="peach-card-art" src={itemImage(unit.id,{label:unit.name})} alt="" draggable={false}/>
               <div className="pixel-card-foot">
                 <strong>{unit.name}</strong>
                 <span className="pixel-card-price">{pixel?<PixelIcon name="coin" size={11}/>:null}{pixel?roomShopPrice(self,unit):goldAmount(terms, roomShopPrice(self,unit))}</span>
               </div>
               <p className="peach-card-tag">{unitSkill(unit.id)?.name ?? ''}</p>
             </button>;
           })}
           {!self.shop.length ? (pixel ? <>
             {Array.from({length: 5}, (_, i) => <div key={i} className="pixel-card-slot" aria-hidden="true"><i>✦</i></div>)}
             <p className="pixel-locked-banner">✦ 首轮交锋结束后开放{terms.level.shop} ✦</p>
           </> : <p>第一轮战斗结束后开放{terms.level.shop}。</p>) : null}
         </div>
       </div>:null}/>
     </div>
</RoomWorkspace>
     </>
     }
    {pixel?<div ref={shopGhostRef} className="pixel-drag-ghost" style={{display:'none'}} aria-hidden="true"><img alt=""/><span/></div>:null}
    {!pixel?<p className="px-3 py-2 text-sm">{view.log.at(-1)}</p>:null}
  </main>;
}

export default function RoomPage() {
  const [session,setSession]=useState<{version:number;credentials:RoomCredentials|null|undefined}>({version:0,credentials:undefined});
  return <><EchoBanner /><SocialInbox onEnterRoom={credentials=>{try{localStorage.setItem(SESSION,JSON.stringify(credentials));}catch{}window.history.replaceState(null,'',window.location.pathname);setSession(old=>({version:old.version+1,credentials}));}}><RoomCrashFence key={session.version}><RoomApp initialCredentials={session.credentials} onSessionChange={credentials=>setSession(old=>old.version===session.version?{version:old.version+1,credentials}:old)} /></RoomCrashFence></SocialInbox></>;
}
