'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { findUnit } from '@/content/autochess/units';
import UnitInspector from './unit-inspector';
import { Trash2, Store } from 'lucide-react';
import type { BattleOutput, Combatant } from '@/lib/autochess/types';
import type { BoardModelRef } from '@/lib/meta/board-assets';
import { DiamondFleuron } from './theme-decorations';
import './arena-3d.css';
import './artwork-arena.css';
import { boardSceneFor } from '@/lib/meta/cosmetics';
import { BENCH_CAPACITY } from '@/lib/autochess/constants';

type Props = {
  board: Combatant[]; bench: Combatant[]; enemyBoard: Combatant[]; enemyBench: Combatant[];
  opponentName: string; skinId?: string; visiting?: boolean; battle: BattleOutput | null; timeMs: number; running: boolean; editable: boolean;
  /** 双方棋盘皮肤（渲染层只认颜色，不认 id）。 */
  homePalette?: { inner: string; outer: string; sky: string };
  awayPalette?: { inner: string; outer: string; sky: string };
  /** 本视角玩家的棋盘 3D 模型（有就用真模型，没有落回程序化庭院 + palette）。 */
  boardModel?: BoardModelRef;
  selectedId?: string;
  onCell: (row:number,col:number)=>void; onBench:(id:string)=>void; onWithdraw:()=>void;
  onDrop:(source:{kind:'board'|'bench';id:string},target:{kind:'cell';row:number;col:number}|{kind:'bench'|'sell'})=>void;
  controls:ReactNode; inventory:ReactNode; topPanel:ReactNode; notice:string;
  inspectorActions:(piece:Combatant)=>ReactNode;
  onDismiss:()=>void; onInspect:()=>void; shopOpen:boolean; shopEnabled:boolean; onShopToggle:()=>void;
};
export default function Arena3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const trash = useRef<HTMLDivElement>(null);
  const [detailedBoard,setDetailedBoard]=useState(false);
  const selectedScene=boardSceneFor(props.skinId);
  const sceneId=selectedScene.id;
  const [fullscreen,setFullscreen]=useState(false);
  useEffect(()=>{const changed=()=>setFullscreen(!!document.fullscreenElement);changed();document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[]);
  const renderProps={...props,boardModel:detailedBoard?props.boardModel:undefined};
  const latest = useRef(renderProps); latest.current=renderProps;
  const api=useRef<{setView:(value:Props)=>void;dispose:()=>void;resetCamera:()=>void;rotateCamera:(direction:number)=>void;zoomBy:(factor:number)=>void}|null>(null);
  const [error,setError]=useState('');
  const [inspectedId,setInspectedId]=useState<string|null>(null);
  const [toast,setToast]=useState('');
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else setToast('当前浏览器暂不支持全屏。');
    }catch{setToast('全屏切换失败，请稍后重试。');}
  }
  const inspected=[...props.board,...props.bench,...props.enemyBoard,...props.enemyBench].find(piece=>piece.id===inspectedId);
  useEffect(()=>{
    let stopped=false;
    import('@/lib/autochess/arena-renderer.js').then(({createArena})=>{
      if(stopped||!host.current)return;
      try {
        api.current=createArena(host.current,{
          onCell:(row:number,col:number)=>latest.current.onCell(row,col),
          onBench:(id:string)=>latest.current.onBench(id),
          onWithdraw:()=>latest.current.onWithdraw(),
          onDrop:((source, target)=>latest.current.onDrop(source,target)) as Props['onDrop'],
          onInspect:(piece:Combatant)=>{setInspectedId(piece.id);latest.current.onInspect()},
          saleHitTest:(x:number,y:number)=>{const r=trash.current?.getBoundingClientRect();return !!r&&latest.current.editable&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom},
          onSaleHover:(active:boolean)=>trash.current?.classList.toggle('drop-ready',active),
        },selectedScene.artwork);
        api.current!.setView(latest.current);
        setError('');
      }catch(e){console.error('arena init failed',e);setError(`三维棋盘加载失败：${(e as Error)?.message??String(e)}`);}
    }).catch((e)=>{if(stopped)return;console.error('arena import failed',e);setError('棋盘文件没能加载，点一下重新打开。');});
    const dismiss=(e:PointerEvent)=>{if(!(e.target instanceof Element)||e.target.closest('.peach-popover,.peach-shop-toggle,.peach-inventory'))return;setInspectedId(null);latest.current.onDismiss()};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setInspectedId(null);latest.current.onDismiss()}};
    document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',escape);
    return()=>{stopped=true;api.current?.dispose();api.current=null;document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',escape);};
  },[selectedScene.artwork]);
  useLayoutEffect(()=>{api.current?.setView(renderProps)},[props,detailedBoard,sceneId]);
  useEffect(()=>setInspectedId(null),[props.opponentName,props.running,props.shopOpen]);
  useEffect(()=>{setToast(props.notice);const timer=setTimeout(()=>setToast(''),3600);return()=>clearTimeout(timer)},[props.notice]);
  return <section className={`peach-arena-shell ${selectedScene.artwork?'with-artwork':''}`} data-skin={sceneId}>
     <div className="peach-arena-stage">
       <div ref={host} className="peach-arena-scene" aria-label={`${selectedScene.name}棋盘`} />
       <div className="peach-camera peach-camera-overlay" aria-label="棋盘视角控制">
         <button type="button" className="peach-fullscreen" onClick={()=>void toggleFullscreen()}>{fullscreen?'退出全屏':'全屏'}</button>
         {!selectedScene.artwork&&props.boardModel?<button type="button" onClick={()=>setDetailedBoard(v=>!v)}>{detailedBoard?'切回轻量庭院':'加载精细地形'}</button>:null}
         {!selectedScene.artwork?<><button type="button" aria-label="向左转动视角" title="向左旋转视角" onClick={()=>api.current?.rotateCamera(-1)}>↶</button>
         <button type="button" aria-label="向右转动视角" title="向右旋转视角" onClick={()=>api.current?.rotateCamera(1)}>↷</button></>:null}
         <button type="button" aria-label="重置视角" title="重置俯瞰视角" onClick={()=>api.current?.resetCamera()}>⟳</button>
            <button type="button" aria-label="放大棋盘" title="放大（手机也可双指捏合）" onClick={()=>api.current?.zoomBy(1/1.2)}>＋</button>
            <button type="button" aria-label="缩小棋盘" title="缩小（手机也可双指捏合）" onClick={()=>api.current?.zoomBy(1.2)}>－</button>
       </div>
      {selectedScene.artwork?<details className="peach-enemy-bench"><summary>对面备战 {props.enemyBench.length}/{BENCH_CAPACITY}</summary><div>{props.enemyBench.length?props.enemyBench.map(piece=><button key={piece.id} type="button" onClick={()=>{setInspectedId(piece.id);props.onInspect();}}>{findUnit(piece.templateId)?.name??piece.templateId} {piece.star}★</button>):<span>备战区为空</span>}</div></details>:null}
      {error?<div className="peach-popover" role="alert"><p>{error}</p><button type="button" onClick={()=>{const url=new URL(window.location.href);url.searchParams.set('_recover',String(Date.now()));window.location.replace(url.href)}}>重新加载棋盘</button></div>:null}
      {props.topPanel?<div className="peach-popover">{props.topPanel}</div>:inspected?<UnitInspector piece={inspected}
        board={props.board.some(p=>p.id===inspected.id)||props.bench.some(p=>p.id===inspected.id)?props.board:props.enemyBoard}
        side={props.board.some(p=>p.id===inspected.id)||props.bench.some(p=>p.id===inspected.id)?'left':'right'}
        owner={props.board.some(p=>p.id===inspected.id)||props.bench.some(p=>p.id===inspected.id)?'己方':props.opponentName}
        replaying={props.running} onClose={()=>setInspectedId(null)} actions={props.inspectorActions(inspected)}/>:null}
      {toast?<div className="peach-toast" role="status"><DiamondFleuron className="mr-1.5" />{toast}</div>:null}
      <div className="peach-dock">
        <div ref={trash} className={`peach-trash ${!props.editable?'disabled':''}`} aria-label="拖入出售棋子" title="拖入出售，装备退回库存"><Trash2 size={24}/><span>出售</span></div>
        <div className="peach-round-controls">{props.controls}</div>
        <button className="peach-shop-toggle" disabled={!props.shopEnabled} aria-label="商店" aria-expanded={props.shopOpen} onClick={()=>{setInspectedId(null);props.onShopToggle()}}><Store size={24}/><span>商店</span></button>
      </div>
      <div className="peach-inventory">{props.inventory}</div>
    </div>
  </section>;
}
