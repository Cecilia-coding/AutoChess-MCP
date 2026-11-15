'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { findUnit } from '@/content/autochess/units';
import UnitInspector from './unit-inspector';
import { PixelIcon } from './pixel-ui/pixel-icon';
import type { Combatant } from '@/lib/autochess/types';
import { DiamondFleuron } from './theme-decorations';
import './arena-3d.css';
import './artwork-arena.css';
import { boardSceneFor, itemImage } from '@/lib/meta/cosmetics';
import { BENCH_CAPACITY } from '@/lib/autochess/constants';
import { starLabel } from '@/packs/terms';
import { PixelArenaView } from './pixel-ui/arena-view';

export type { Props } from './arena-types';
import type { ClientDropTarget, ClientUnitTarget, ItemPreviewTarget, Props } from './arena-types';
export default function Arena3D(props: Props) {
  const pixel = props.renderer === 'pixel-2d';
  const host = useRef<HTMLDivElement>(null);
  const trash = useRef<HTMLDivElement>(null);
  const shopSlot = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [detailedBoard,setDetailedBoard]=useState(false);
  const selectedScene=boardSceneFor(props.skinId);
  const sceneId=selectedScene.id;
  const [fullscreen,setFullscreen]=useState(false);
  useEffect(()=>{const changed=()=>setFullscreen(!!document.fullscreenElement);changed();document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[]);
  useEffect(()=>{
    const color=pixel?'#eeeaf4':'#1c1726';
    let meta=document.querySelector('meta[name="theme-color"]') as HTMLMetaElement|null;
    const prev=meta?.getAttribute('content')??null;
    const created=!meta;
    if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta);}
    meta.setAttribute('content',color);
    return()=>{if(created)meta?.remove();else if(prev!==null)meta?.setAttribute('content',prev);};
  },[pixel]);
  const renderProps={...props,boardModel:detailedBoard?props.boardModel:undefined};
  const latest = useRef(renderProps); latest.current=renderProps;
  const api=useRef<{
    setView:(value:Props)=>void;
    dispose:()=>void;
    resetCamera:()=>void;
    rotateCamera:(direction:number)=>void;
    zoomBy:(factor:number)=>void;
    dropAtClient?:(clientX:number,clientY:number)=>ClientDropTarget;
    previewClient?:(point:{x:number;y:number}|null)=>void;
    unitAtClient?:(clientX:number,clientY:number)=>ClientUnitTarget;
    previewItem?:(target:ItemPreviewTarget)=>void;
  }|null>(null);
  const [error,setError]=useState('');
  const [uncontrolledInspectedId,setUncontrolledInspectedId]=useState<string|null>(null);
  const inspectedId = props.inspectedPieceId !== undefined ? props.inspectedPieceId : uncontrolledInspectedId;
  const setInspectedId = (next: string | null) => {
    if (props.inspectedPieceId === undefined) setUncontrolledInspectedId(next);
    props.onInspectChange?.(next);
  };
  const [toast,setToast]=useState('');
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else setToast('当前浏览器暂不支持全屏。');
    }catch{setToast('全屏切换失败，请稍后重试。');}
  }
  const inspected=[...props.board,...props.bench,...props.enemyBoard,...props.enemyBench].find(piece=>piece.id===inspectedId);
  const inspectedIsOwn = inspected ? props.board.some(p => p.id === inspected.id) || props.bench.some(p => p.id === inspected.id) : false;
  const inspectedUnequip = inspected && inspectedIsOwn && props.editable && props.onUnequipPiece
    ? (itemId: string) => props.onUnequipPiece?.(inspected.id, itemId)
    : undefined;
  useEffect(()=>{
    let stopped=false;
    const inRect=(el:HTMLElement|null,x:number,y:number)=>{
      const r=el?.getBoundingClientRect();
      return !!r&&r.width>0&&r.height>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
    };
    const setGhost=(info:{templateId:string;name:string;x:number;y:number;overSell:boolean}|null)=>{
      const el=ghost.current;
      if(!el)return;
      if(!info){el.style.display='none';return;}
      const img=el.querySelector('img');
      const label=el.querySelector('span');
      const src=itemImage(info.templateId,{label:info.name});
      if(img&&img.getAttribute('src')!==src)img.setAttribute('src',src);
      if(label)label.textContent=info.overSell?'松手出售':info.name;
      el.dataset.sell=info.overSell?'true':'false';
      el.style.display='flex';
      el.style.transform=`translate3d(${Math.round(info.x)}px, ${Math.round(info.y)}px, 0)`;
    };
    const loadRenderer = pixel ? import('@/lib/autochess/pixel-arena') : import('@/lib/autochess/arena-renderer.js');
    loadRenderer.then(({createArena})=>{
      if(stopped||!host.current)return;
      try {
        api.current=createArena(host.current,{
          onCell:(row:number,col:number)=>latest.current.onCell(row,col),
          onBench:(id:string)=>latest.current.onBench(id),
          onWithdraw:()=>latest.current.onWithdraw(),
          onDrop:((source, target)=>latest.current.onDrop(source,target)) as Props['onDrop'],
          onInspect:(piece:Combatant)=>{setInspectedId(piece.id);latest.current.onInspect()},
          saleHitTest:(x:number,y:number)=>latest.current.editable&&(inRect(trash.current,x,y)||(pixel&&inRect(shopSlot.current,x,y))),
          onSaleHover:(active:boolean)=>{
            trash.current?.classList.toggle('drop-ready',active);
            shopSlot.current?.classList.toggle('drop-ready',active);
          },
          onDragGhost:setGhost,
        },selectedScene.artwork);
        if(latest.current.dropAtClientRef)latest.current.dropAtClientRef.current=(cx,cy)=>api.current?.dropAtClient?.(cx,cy)??null;
        if(latest.current.previewClientRef)latest.current.previewClientRef.current=(pt)=>api.current?.previewClient?.(pt);
        if(latest.current.unitAtClientRef)latest.current.unitAtClientRef.current=(cx,cy)=>api.current?.unitAtClient?.(cx,cy)??null;
        if(latest.current.previewItemRef)latest.current.previewItemRef.current=(target)=>api.current?.previewItem?.(target);
        api.current!.setView(latest.current);
        setError('');
      }catch(e){console.error('arena init failed',e);setError(`棋盘加载失败：${(e as Error)?.message??String(e)}`);}
    }).catch((e)=>{if(stopped)return;console.error('arena import failed',e);setError('棋盘文件没能加载，点一下重新打开。');});
    const dismiss=(e:PointerEvent)=>{if(!(e.target instanceof Element)||e.target.closest('.peach-popover,.peach-shop-toggle,.peach-inventory,.pixel-detail-slot,.pixel-shop-slot,.pixel-inventory-slot,.room-sidepanel,.pixel-sell'))return;setInspectedId(null);latest.current.onDismiss()};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setInspectedId(null);latest.current.onDismiss()}};
    document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',escape);
    return()=>{
      stopped=true;
      setGhost(null);
      if(latest.current.dropAtClientRef)latest.current.dropAtClientRef.current=null;
      if(latest.current.previewClientRef)latest.current.previewClientRef.current=null;
      if(latest.current.unitAtClientRef)latest.current.unitAtClientRef.current=null;
      if(latest.current.previewItemRef)latest.current.previewItemRef.current=null;
      api.current?.dispose();api.current=null;
      document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',escape);
    };
  },[selectedScene.artwork,pixel]);
  useLayoutEffect(()=>{api.current?.setView(renderProps)},[props,detailedBoard,sceneId]);
  useEffect(()=>setInspectedId(null),[props.opponentName,props.running,pixel?false:props.shopOpen]);
  useEffect(()=>{setToast(props.notice);const timer=setTimeout(()=>setToast(''),3600);return()=>clearTimeout(timer)},[props.notice]);
  const activeOwnId = props.selectedId ?? inspectedId ?? undefined;
  const selectedOwn = activeOwnId ? [...props.board, ...props.bench].find(p => p.id === activeOwnId) : undefined;
  if(pixel) return <PixelArenaView view={props} host={host} trash={trash} shopSlot={shopSlot} ghost={ghost}
    canSellSelected={Boolean(props.editable && selectedOwn)}
    onSellSelected={()=>{
      if(!props.editable||!selectedOwn)return;
      const onBoard=props.board.some(p=>p.id===selectedOwn.id);
      setInspectedId(null);
      props.onDrop({kind:onBoard?'board':'bench',id:selectedOwn.id},{kind:'sell'});
    }}
    fullscreen={fullscreen} onFullscreen={()=>void toggleFullscreen()}
    onZoom={factor=>api.current?.zoomBy(factor)} onReset={()=>api.current?.resetCamera()}
    onInspect={piece=>{setInspectedId(piece.id);props.onInspect();}} error={error} notice={toast}
    inspector={inspected?<UnitInspector piece={inspected}
      board={inspectedIsOwn?props.board:props.enemyBoard}
      side={inspectedIsOwn?'left':'right'}
      owner={inspectedIsOwn?'己方':props.opponentName}
      replaying={props.running} onClose={()=>setInspectedId(null)} onUnequip={inspectedUnequip} actions={props.inspectorActions(inspected)} terms={props.terms}/>:undefined}/>;
  return <section className={`peach-arena-shell ${pixel?'with-pixels':selectedScene.artwork?'with-artwork':''}`} data-skin={pixel?'pixel-grid':sceneId}>
     <div className="peach-arena-stage">
       <div ref={host} className="peach-arena-scene" aria-label={pixel?'像素棋盘':`${selectedScene.name}棋盘`} />
       <div className="peach-camera peach-camera-overlay" aria-label="棋盘视角控制">
         <button type="button" className="peach-fullscreen" onClick={()=>void toggleFullscreen()}>{fullscreen?'退出全屏':'全屏'}</button>
         {!pixel&&!selectedScene.artwork&&props.boardModel?<button type="button" onClick={()=>setDetailedBoard(v=>!v)}>{detailedBoard?'切回轻量庭院':'加载精细地形'}</button>:null}
         {!pixel&&!selectedScene.artwork?<><button type="button" aria-label="向左转动视角" title="向左旋转视角" onClick={()=>api.current?.rotateCamera(-1)}>↶</button>
         <button type="button" aria-label="向右转动视角" title="向右旋转视角" onClick={()=>api.current?.rotateCamera(1)}>↷</button></>:null}
         <button type="button" aria-label="重置视角" title="重置俯瞰视角" onClick={()=>api.current?.resetCamera()}>⟳</button>
            <button type="button" aria-label="放大棋盘" title="放大（手机也可双指捏合）" onClick={()=>api.current?.zoomBy(1/1.2)}>＋</button>
            <button type="button" aria-label="缩小棋盘" title="缩小（手机也可双指捏合）" onClick={()=>api.current?.zoomBy(1.2)}>－</button>
       </div>
      {pixel||selectedScene.artwork?<details className="peach-enemy-bench"><summary>对面备战 {props.enemyBench.length}/{BENCH_CAPACITY}</summary><div>{props.enemyBench.length?props.enemyBench.map(piece=><button key={piece.id} type="button" onClick={()=>{setInspectedId(piece.id);props.onInspect();}}>{findUnit(piece.templateId)?.name??piece.templateId} {starLabel(props.terms, piece.star)}</button>):<span>备战区为空</span>}</div></details>:null}
      {error?<div className="peach-popover" role="alert"><p>{error}</p><button type="button" onClick={()=>{const url=new URL(window.location.href);url.searchParams.set('_recover',String(Date.now()));window.location.replace(url.href)}}>重新加载棋盘</button></div>:null}
      {props.topPanel?<div className="peach-popover">{props.topPanel}</div>:inspected?<UnitInspector piece={inspected}
        board={inspectedIsOwn?props.board:props.enemyBoard}
        side={inspectedIsOwn?'left':'right'}
        owner={inspectedIsOwn?'己方':props.opponentName}
        replaying={props.running} onClose={()=>setInspectedId(null)} onUnequip={inspectedUnequip} actions={props.inspectorActions(inspected)} terms={props.terms}/>:null}
      {toast?<div className="peach-toast" role="status"><DiamondFleuron className="mr-1.5" />{toast}</div>:null}
      <div className="peach-dock">
        <div ref={trash} className={`peach-trash ${!props.editable?'disabled':''}`} aria-label="拖入出售棋子" title="拖入出售，装备退回库存"><PixelIcon name="trash" size={20}/><span>出售</span></div>
        <div className="peach-round-controls">{props.controls}</div>
        <button className="peach-shop-toggle" disabled={!props.shopEnabled} aria-label={props.terms.level.shop} aria-expanded={props.shopOpen} onClick={()=>{setInspectedId(null);props.onShopToggle()}}><PixelIcon name="bag" size={20}/><span>{props.terms.level.shop}</span></button>
      </div>
      <div className="peach-inventory">{props.inventory}</div>
    </div>
  </section>;
}
