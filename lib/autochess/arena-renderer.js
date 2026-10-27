import { BENCH_CAPACITY, BENCH_SLOT_SPACING } from './constants';
import * as T from 'three';
import { frameAt } from './frame';
import { BOARD_ROWS, BOARD_COLS } from './constants';
import { getUnit } from '../../content/autochess/units';
import { deploymentView, ownCellFromWorld } from './arena-view';
import { makePeachGarden } from './peach-garden.js';
import { canKeepArenaDrag } from './arena-drag-state.js';
import { makeArtworkBoard } from './artwork-board.js';
import { makePlacementTracker } from './landing-ripples.js';
import { worldPos } from './grid';

/** @param {(typeof import('../meta/board-scenes.js').BOARD_SCENES)[number]['artwork']} [artwork] */
export function createArena(host, callbacks, artwork = null) {
const canvas=document.createElement('canvas');const labels=document.createElement('div');labels.className='peach-unit-labels';host.append(canvas,labels);
let view={},battle={events:[],units:[]},signature='',disposed=false,raf=0,lastSync=performance.now(),skinKey='';
// 旧 board-N 皮肤回退色板；新皮肤走 homePalette/awayPalette。
const palettes=['#e9cfd9','#d4e4ef','#efe4c8','#d9ead3','#ead9f0','#f0d9d4','#d4eae8','#eee0d2'];
const scene = new T.Scene(); scene.background = new T.Color('#e9cfd9'); scene.fog = new T.Fog('#e9cfd9', 22, 46);
const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2;
const camera=new T.PerspectiveCamera(artwork?42:37,1,.1,100);
let cameraYaw=Math.atan2(10,15);
let cameraZoom=1;
function placeCamera(){if(artwork){camera.position.set(0,14,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();return}const fit=Math.max(1,1.28/camera.aspect);const d=Math.hypot(10,15)*fit*cameraZoom;camera.position.set(Math.sin(cameraYaw)*d,13*fit*cameraZoom,Math.cos(cameraYaw)*d);camera.lookAt(0,.25,0)}
function resetCamera(){cameraYaw=Math.atan2(10,15);cameraZoom=1;resize()}
function rotateCamera(direction){if(artwork)return;cancel();cameraYaw+=direction*Math.PI/12;placeCamera()}
function zoomBy(factor){cameraZoom=Math.max(artwork ? .78 : .55,Math.min(artwork?1:2.4,cameraZoom*factor));resize()}
placeCamera();
scene.add(new T.HemisphereLight(artwork?.lighting?.sky??(artwork?'#c2d9ef':'#fff0f5'),artwork?.lighting?.ground??(artwork?'#352636':'#9291a6'),2.1));
const sun=new T.DirectionalLight(artwork?'#d4e3ff':'#ffe2b0',artwork?2.8:3.2);sun.position.set(-5,artwork?14:11,artwork?-7:6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8});sun.shadow.normalBias=.03;scene.add(sun);
const rim=new T.DirectionalLight('#82d8df',1.6);rim.position.set(5,4,-7);scene.add(rim);
if(artwork?.lighting?.sun)sun.color.set(artwork.lighting.sun);
if(artwork?.lighting?.rim)rim.color.set(artwork.lighting.rim);
const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.83,flatShading:true,...extra});
function mesh(geometry,mat,parent,pos=[0,0,0]){const m=new T.Mesh(geometry,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
const box=(w,h,d,mat,parent,pos)=>mesh(new T.BoxGeometry(w,h,d),mat,parent,pos);
const gold=material('#b7a474',{metalness:.45});
const cell=1.3;
const starText=star=>view.terms?.star?.tiers?.[Math.max(0,Math.min(2,Math.floor(star)-1))]??`${star}★`;
const garden=artwork?null:makePeachGarden(scene,BOARD_ROWS,BOARD_COLS);
if(artwork){scene.background=null;scene.fog=null;Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,far:55});sun.shadow.camera.updateProjectionMatrix();}
const art=artwork?makeArtworkBoard(host,canvas,labels,camera,scene,artwork):null;
// 真棋盘模型：外观挂了 GLB 才加载（懒加载 + 缓存）；未加载/失败时继续用程序化庭院兜底。
const boardGroup=new T.Group();scene.add(boardGroup);
let boardKey='',boardRoot=null,boardLoading=false,boardFailed=false,boardGeneration=0;
function releaseBoard(root){if(!root)return;const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v)}});ts.forEach(t=>{t.source?.data?.close?.();t.dispose()});ms.forEach(m=>m.dispose());gs.forEach(g=>g.dispose());}
/** 真棋盘的逐格可行走面高度（相对已落位的 y=0）。程序化庭院时为 null。 */
let boardSurface=null;
function clearBoard(){while(boardGroup.children.length)boardGroup.remove(boardGroup.children[0]);boardKey='';boardSurface=null;boardLoading=false;boardFailed=false;boardGeneration++;releaseBoard(boardRoot);boardRoot=null;garden?.setVisible(true)}
/**
 * 用向下的射线在每格中心测可行走面：AI 生成的棋盘常是起伏地形，
 * 单一平面会让棋子浮空或陷入。这里得到逐格高度，棋子按所处位置采样。
 * 全测不到（非实体或退化模型）时返回 null，调用方回退到包围盒落地。
 */
function measureSurface(clone){
  const ray=new T.Raycaster();
  const box=new T.Box3().setFromObject(clone),top=box.max.y+2;
  const values=new Float32Array(BOARD_ROWS*BOARD_COLS).fill(NaN);
  const down=new T.Vector3(0,-1,0),origin=new T.Vector3();
  for(let row=0;row<BOARD_ROWS;row++)for(let col=0;col<BOARD_COLS;col++){
    origin.set((col-(BOARD_COLS-1)/2)*2,top,(row-(BOARD_ROWS-1)/2)*cell);
    ray.set(origin,down);
    const hit=ray.intersectObject(clone,true)[0];
    if(hit)values[row*BOARD_COLS+col]=hit.point.y;
  }
  const hits=[...values].filter(Number.isFinite).sort((a,b)=>a-b);
  if(hits.length<BOARD_ROWS*BOARD_COLS*.4)return null;
  const median=hits[hits.length>>1];
  for(let i=0;i<values.length;i++)if(!Number.isFinite(values[i]))values[i]=median;
  for(let i=0;i<values.length;i++)values[i]-=median;
  return {values,median};
}
/** 按世界 x/z 双线性采样可行走面高度；棋盘外返回 0。 */
function sampleSurface(x,z){
  if(!boardSurface)return 0;
  const values=boardSurface.values,fc=x/2+(BOARD_COLS-1)/2,fr=z/cell+(BOARD_ROWS-1)/2;
  if(fc<-.5||fc>BOARD_COLS-.5||fr<-.5||fr>BOARD_ROWS-.5)return 0;
  const c0=Math.min(BOARD_COLS-2,Math.max(0,Math.floor(fc))),r0=Math.min(BOARD_ROWS-2,Math.max(0,Math.floor(fr)));
  const tc=Math.min(1,Math.max(0,fc-c0)),tr=Math.min(1,Math.max(0,fr-r0));
  const a=values[r0*BOARD_COLS+c0]*(1-tc)+values[r0*BOARD_COLS+c0+1]*tc;
  const b=values[(r0+1)*BOARD_COLS+c0]*(1-tc)+values[(r0+1)*BOARD_COLS+c0+1]*tc;
  return a*(1-tr)+b*tr;
}
function placeBoard(root,placement={}){
  const clone=root.clone(true);
  const box=new T.Box3().setFromObject(clone),size=box.getSize(new T.Vector3());
  const fit=placement.fit??10.5,s=(placement.scale??1)*(fit/Math.max(size.x,size.z,.001));
  const flatten=placement.flatten??1;
  clone.scale.set(s,s*flatten,s);
  clone.rotation.set(placement.rotationX??0,placement.rotationY??0,placement.rotationZ??0);
  const box2=new T.Box3().setFromObject(clone),center=box2.getCenter(new T.Vector3());
  clone.position.set(-center.x+(placement.offsetX??0),-box2.min.y,-center.z+(placement.offsetZ??0));
  clone.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true}});
  // surfaceY 是数据里的显式平面（模型底部起算）；不填就自动逐格测量。
  let lift=placement.surfaceY??0;boardSurface=null;
  if(placement.surfaceY===undefined){
    clone.updateMatrixWorld(true);
    const measured=measureSurface(clone);
    if(measured){lift=measured.median;boardSurface=measured;}
  }
  clone.position.y=-box2.min.y-lift+(placement.offsetY??0);
  clone.updateMatrixWorld(true);
  boardGroup.add(clone);garden?.setVisible(false);
}
function loadBoard(model){
  if(artwork)return;
  if(!model){if(boardKey)clearBoard();return}
  if(model.key===boardKey&&(boardLoading||boardFailed||boardGroup.children.length))return;
  clearBoard();boardKey=model.key;boardLoading=true;const generation=boardGeneration;
  import('three/examples/jsm/loaders/GLTFLoader.js').then(({GLTFLoader})=>{
    if(disposed||generation!==boardGeneration)return;
    new GLTFLoader().load(model.url,(gltf)=>{
      if(disposed||generation!==boardGeneration){releaseBoard(gltf.scene);return}
      boardLoading=false;boardRoot=gltf.scene;placeBoard(gltf.scene,model.placement);
    },undefined,()=>{if(generation===boardGeneration){boardLoading=false;boardFailed=true;garden?.setVisible(true)}});
  }).catch(()=>{if(generation===boardGeneration){boardLoading=false;boardFailed=true;garden?.setVisible(true)}});
}

function makeActor(line){
  const red=line.team==='right',role=getUnit(line.templateId).role==='support'?'heal':['ranged','caster'].includes(getUnit(line.templateId).role)?'range':'sword';
  const root=new T.Group();scene.add(root);const body=new T.Group();root.add(body);
  const cloth=material(red?'#b94e4c':'#288b7c'),dark=material(red?'#622b39':'#234953'),skin=material('#d8ba97'),hair=material('#222b32'),steel=material('#c3d3cc',{metalness:.65,roughness:.3});
  mesh(new T.CylinderGeometry(.23,.19,.48,6),cloth,body,[0,.91,0]);
  mesh(new T.CylinderGeometry(.2,.34,.4,6),dark,body,[0,.58,0]);
  box(.46,.07,.28,gold,body,[0,.71,0]);box(.14,.43,.045,gold,body,[0,.93,.215]);
  mesh(new T.IcosahedronGeometry(.205,1),skin,body,[0,1.32,0]);
  mesh(new T.SphereGeometry(.22,6,4,0,Math.PI*2,0,Math.PI*.6),hair,body,[0,1.36,0]);
  mesh(new T.ConeGeometry(.085,.28,5),hair,body,[0,1.62,0]);
  for(const x of [-.07,.07])box(.04,.025,.015,hair,body,[x,1.34,.188]);
  const arms=[],legs=[];
  for(const s of [-1,1]){const arm=new T.Group();arm.position.set(s*.28,1.09,0);body.add(arm);mesh(new T.IcosahedronGeometry(.145,0),gold,arm);box(.145,.32,.17,cloth,arm,[s*.01,-.2,0]);box(.12,.2,.13,skin,arm,[s*.01,-.43,.015]);arms.push(arm);
    const leg=new T.Group();leg.position.set(s*.125,.5,0);body.add(leg);box(.16,.29,.17,dark,leg,[0,-.13,0]);box(.18,.2,.27,hair,leg,[0,-.34,.04]);legs.push(leg);}
  const weapon=new T.Group();arms[1].add(weapon);weapon.position.set(0,-.47,.03);
  if(role==='sword'){box(.065,.16,.065,hair,weapon,[0,0,0]);box(.3,.05,.08,gold,weapon,[0,.08,0]);box(.075,.62,.04,steel,weapon,[0,.4,0]);mesh(new T.ConeGeometry(.05,.17,4),steel,weapon,[0,.795,0]);}
  else {box(.055,1.05,.055,gold,weapon,[0,.2,0]);mesh(new T.OctahedronGeometry(.15),material(role==='heal'?'#8bf9c9':'#fa9a83',{emissive:role==='heal'?'#29ae82':'#d34c35',emissiveIntensity:1}),weapon,[0,.8,0]);}
  const ring=mesh(new T.RingGeometry(.38,.44,32),new T.MeshBasicMaterial({color:red?'#f37d70':'#65dec1',side:T.DoubleSide,transparent:true,opacity:.85}),root,[0,.025,0]);ring.rotation.x=-Math.PI/2;
  const label=document.createElement('div');label.className=`label ${red?'red':''}`;
  label.innerHTML=`<span>${line.name}</span><div class="hp"><div class="fill"></div></div><div class="mana"><div class="fill"></div></div><span class="numbers"></span>`;labels.append(label);
  const motions=battle.events.filter(e=>e.sourceId===line.id&&(e.type==='spawn'||e.type==='move'));
  const actions=battle.events.filter(e=>e.sourceId===line.id&&(e.type==='attack'||e.type==='cast'));
  const death=battle.events.find(e=>e.sourceId===line.id&&e.type==='death');
  root.traverse(o=>{o.userData.unitId=line.id});
  const look=artwork?(red?artwork.palette.enemy:artwork.palette.ally):red?'#b94e4c':'#288b7c';
  const shade=red?'#622b39':'#234953';
  const glow=red?'#f37d70':'#65dec1';
  const actor={root,body,arms,legs,role,ring,label,motions,actions,death,cloth,dark,red,look,shade,glow};models.set(line.id,actor);return actor;
}
const position=(e)=>{if(art){const entry=pieceEntries.get(e.sourceId);if(entry?.reserve)return art.benchPosition(view.bench.findIndex(p=>p.id===entry.piece.id));return art.cellPosition(e.pos.row,e.pos.col)}return new T.Vector3((e.pos.col-(BOARD_COLS-1)/2)*2,0,(e.pos.row-(BOARD_ROWS-1)/2)*cell)};
function location(actor,t){let i=0;while(i+1<actor.motions.length&&actor.motions[i+1].timeMs<=t)i++;const e=actor.motions[i],p=position(e);if(i>0){const q=Math.min(1,Math.max(0,(t-e.timeMs)/300));p.lerpVectors(position(actor.motions[i-1]),p,q*q*(3-2*q));}return p;}

function buildEffects(){
for(const e of battle.events){
  if(!['attack','cast','heal','damage','shield'].includes(e.type))continue;
  const actor=models.get(e.sourceId),target=models.get(e.targetIds?.[0]);
  if(!actor&&!target)continue;
  let kind=e.type;
  if(e.type==='attack'||e.type==='cast')kind=actor?.role==='sword'?'slash':e.type==='cast'&&actor?.role==='heal'?'pulse':'bolt';
  if(kind==='damage')kind='hit';
  const color=kind==='heal'||kind==='pulse'?'#72ffbb':kind==='shield'?'#b7deff':actor?.red?'#ffab8d':'#e9df9d';
  const mat=new T.MeshBasicMaterial({color,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false});
  const geo=kind==='bolt'?new T.SphereGeometry(.08,6,4):kind==='hit'?new T.IcosahedronGeometry(.12,0):new T.RingGeometry(kind==='slash'?.45:.28,kind==='slash'?.52:.34,24,1,0,kind==='slash'?Math.PI*1.25:Math.PI*2);
  const fx=mesh(geo,mat,scene);fx.castShadow=false;fx.visible=false;
  // Damage is authoritative at event time. A short visual windup precedes that instant.
  effects.push({e,actor,target,kind,fx,start:e.timeMs-(kind==='bolt'?220:kind==='slash'?160:0),duration:kind==='bolt'?220:kind==='hit'?180:550});
}
}
function paint(t){
  const frame=frameAt(battle,t);
  for(const u of frame.units){const a=models.get(u.id);if(!a)continue;
    if(drag?.unitId===u.id){a.root.position.copy(drag.position);}
    else{const p=location(a,t);a.root.position.set(p.x,p.y+sampleSurface(p.x,p.z),p.z);}
    let latest;for(const e of a.actions){if(e.timeMs-220>t)break;latest=e;}
    const target=models.get(latest?.targetIds?.[0]);
    let aim=target?location(target,t).sub(a.root.position):new T.Vector3(0,0,a.red?1:-1);
    const recent=[...a.motions].reverse().find(e=>e.timeMs<=t);
    const moving=recent?.type==='move'&&t-recent.timeMs<300;
    if(moving&&recent){const before=a.motions[a.motions.indexOf(recent)-1];if(before)aim=position(recent).sub(position(before));}
    if(aim.lengthSq()>.001)a.root.rotation.y=Math.atan2(aim.x,aim.z);
    const dt=latest?t-latest.timeMs:9999,active=dt>=-220&&dt<330,phase=(dt+220)/550;
    const gait=moving?Math.sin(t*.021):0;
    a.legs[0].rotation.x=gait*.6;a.legs[1].rotation.x=-gait*.6;
    a.arms[0].rotation.x=-gait*.4;a.arms[1].rotation.x=gait*.4;
    a.arms[1].rotation.z=0;a.body.rotation.y=0;
    if(active){a.arms[1].rotation.x=-.35-Math.sin(phase*Math.PI)*2.1;a.arms[1].rotation.z=a.role==='sword'?-Math.sin(phase*Math.PI)*.6:0;a.body.rotation.y=Math.sin(phase*Math.PI*2)*.23;}
    a.body.position.y=moving?Math.abs(gait)*.045:Math.sin(t*.003)*.012;
    const fall=a.death?T.MathUtils.clamp((t-a.death.timeMs)/430,0,1):0;
    a.body.rotation.z=fall*Math.PI*.47;a.body.position.y-=fall*.03;
    a.cloth.color.set(fall?'#667171':a.look);a.dark.color.set(fall?'#434b50':a.shade);a.ring.material.color.set(fall?'#777f80':a.glow);
    a.label.classList.toggle('dead',!u.alive);a.label.classList.toggle('selected',u.id===view.selectedId);a.label.querySelector('.hp .fill').style.width=`${Math.max(0,u.hp/u.maxHp)*100}%`;a.label.querySelector('.mana .fill').style.width=`${u.alive?Math.max(0,Math.min(1,u.mana/u.maxMana))*100:0}%`;a.label.querySelector('.numbers').textContent=u.alive?`${Math.ceil(u.hp)} / ${u.maxHp}`:'已倒下';
    if(art){const entry=pieceEntries.get(u.id),reserve=entry?.reserve;a.root.scale.setScalar(reserve ? (artwork.bench.scale??.62) : .82);a.label.classList.toggle('compact-reserve',!!reserve&&!!artwork.bench.compactLabels);if(reserve&&artwork.bench.compactLabels)a.label.classList.toggle('selected',entry.piece.id===view.selectedId);}
    const p=a.root.position.clone().add(new T.Vector3(0,(fall?.7:1.88)*a.root.scale.x,0)).project(camera);a.label.style.left=`${(p.x*.5+.5)*renderer.domElement.clientWidth}px`;a.label.style.top=`${(-p.y*.5+.5)*renderer.domElement.clientHeight}px`;
  }
  for(const x of effects){const p=(t-x.start)/x.duration;x.fx.visible=p>=0&&p<=1;if(!x.fx.visible)continue;
    const from=x.actor?location(x.actor,x.e.timeMs):location(x.target,x.e.timeMs);const to=x.target?location(x.target,x.e.timeMs):from.clone();
    x.fx.material.opacity=Math.sin(Math.PI*p)*.85;x.fx.scale.setScalar(1);x.fx.rotation.set(0,0,0);
    if(x.kind==='bolt'){x.fx.position.copy(from.lerp(to,p));x.fx.position.y=.95+Math.sin(p*Math.PI)*.3;x.fx.scale.setScalar(1.3);}
    else if(x.kind==='slash'){x.fx.position.copy(from.lerp(to,.45));x.fx.position.y=.85;x.fx.rotation.set(-.6,p*2,Math.PI*.2);x.fx.scale.setScalar(.7+p*.6);}
    else {x.fx.position.copy(to);x.fx.position.y=x.kind==='hit'?1:.08+p*.25;x.fx.rotation.x=-Math.PI/2;x.fx.scale.setScalar(x.kind==='hit'?1+p*1.5:1+p*2);}
  }

}

const models=new Map(),effects=[];const targetPlanes=[];
function discard(object){object.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m!==gold)m.dispose();}});object.removeFromParent();}
function clearActors(){for(const a of models.values()){discard(a.root);a.label.remove()}models.clear();for(const e of effects)discard(e.fx);effects.length=0;}
for(let row=0;row<BOARD_ROWS;row++)for(let col=0;col<BOARD_COLS;col++){
 const plane=mesh(art?art.cellGeometry(row,col):new T.PlaneGeometry(1.96,1.26),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}),scene,art?[0,0,0]:[(col-(BOARD_COLS-1)/2)*2,.015,(row-(BOARD_ROWS-1)/2)*1.3]);if(!art)plane.rotation.x=-Math.PI/2;plane.castShadow=false;plane.userData.cell={row,col};targetPlanes.push(plane);
}
for(let index=0;index<BENCH_CAPACITY;index++){
 const plane=mesh(new T.CircleGeometry(.6,16),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),scene,[(index-(BENCH_CAPACITY-1)/2)*BENCH_SLOT_SPACING,.005,BOARD_ROWS*1.3/2+1.05]);plane.rotation.x=-Math.PI/2;if(art){plane.position.copy(art.benchPosition(index));plane.scale.setScalar(.55)}plane.castShadow=false;plane.userData.reserve=index;targetPlanes.push(plane);
}
const ray=new T.Raycaster();let pointerStart=null,drag=null;
const dragGround=new T.Plane(new T.Vector3(0,1,0),-.15);
const dropMark=mesh(new T.RingGeometry(.42,.5,32),new T.MeshBasicMaterial({color:'#38a986',side:T.DoubleSide,transparent:true,opacity:.85,depthWrite:false}),scene);dropMark.rotation.x=-Math.PI/2;dropMark.visible=false;
function aim(e){const rect=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);return e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom}
function down(e){
 if(e.button!==0)return;aim(e);
 const hit=ray.intersectObjects([...models.values()].map(a=>a.root),true)[0];
 let unitId=hit?.object.userData.unitId;
 if(!unitId&&art){const rect=canvas.getBoundingClientRect();let nearest=20;for(const [id,a] of models){const p=a.root.position.clone().add(new T.Vector3(0,.7*a.root.scale.x,0)).project(camera);const d=Math.hypot(e.clientX-rect.left-(p.x+1)*rect.width/2,(e.clientY-rect.top-(1-p.y)*rect.height/2)*.7);if(d<nearest){nearest=d;unitId=id}}}
 const entry=unitId?pieceEntries.get(unitId):null;
 pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId,unitId,entry};
 if(view.editable&&entry?.team==='left')canvas.setPointerCapture(e.pointerId);
}
function cancel(){const id=pointerStart?.id;pointerStart=null;drag=null;dropMark.visible=false;canvas.style.cursor='';callbacks.onSaleHover?.(false);if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id)}
function dropTarget(e){if(callbacks.saleHitTest?.(e.clientX,e.clientY))return {kind:'sell'};if(!aim(e))return null;const hit=ray.intersectObjects(targetPlanes,false)[0];if(!hit)return null;const data=hit.object.userData;if(data.reserve!==undefined)return {kind:'bench'};if(data.cell){const cell=ownCellFromWorld(data.cell.row,data.cell.col);if(cell)return {kind:'cell',...cell}}return null}
function move(e){
 if(!pointerStart||pointerStart.id!==e.pointerId||!view.editable||pointerStart.entry?.team!=='left')return;
 if(!drag&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)<7)return;
 if(!drag)drag={unitId:pointerStart.unitId,position:models.get(pointerStart.unitId).root.position.clone()};
 const target=dropTarget(e);callbacks.onSaleHover?.(target?.kind==='sell');aim(e);const point=ray.ray.intersectPlane(dragGround,new T.Vector3());if(point)drag.position.copy(point);
 dropMark.visible=true;dropMark.position.copy(drag.position);dropMark.position.y=.12;dropMark.material.color.set(target?'#38a986':'#c7607a');canvas.style.cursor='grabbing';
}
function up(e){
 const start=pointerStart;if(!start||start.id!==e.pointerId)return;
 if(drag){const target=dropTarget(e),entry=start.entry;cancel();if(view.editable&&entry?.team==='left'&&target)callbacks.onDrop({kind:entry.reserve?'bench':'board',id:entry.piece.id},target);return;}
 cancel();if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)return;
 aim(e);const hit=ray.intersectObjects([...targetPlanes,...[...models.values()].map(a=>a.root)],true)[0];if(!hit&&!start.unitId)return;
 const data=start.unitId?{unitId:start.unitId}:hit.object.userData;
 if(data.unitId){const entry=pieceEntries.get(data.unitId);if(!entry)return;callbacks.onInspect(entry.piece);if(!view.editable||entry.team!=='left')return;if(entry.reserve)callbacks.onBench(entry.piece.id);else callbacks.onCell(entry.piece.localRow,entry.piece.localCol);}
 else if(view.editable&&data.cell){const cell=ownCellFromWorld(data.cell.row,data.cell.col);if(cell)callbacks.onCell(cell.row,cell.col);}
 else if(view.editable&&data.reserve!==undefined){const piece=view.bench[data.reserve];if(piece)callbacks.onBench(piece.id);else callbacks.onWithdraw();}
}
function leave(){if(!drag&&!canvas.hasPointerCapture(pointerStart?.id??-1))cancel()}
canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('pointerleave',leave);
// 双指捏合缩放（移动端看不清棋盘的主要痛点）
const touches=new Map();let pinchStart=0,pinchZoom=1;
function pinchDist(){const p=[...touches.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}
canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){cancel();pinchStart=pinchDist();pinchZoom=cameraZoom;e.preventDefault()}},{passive:false});
canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2&&pinchStart>0){cameraZoom=Math.max(artwork ? .78 : .55,Math.min(artwork?1:2.4,pinchZoom*pinchStart/Math.max(1,pinchDist())));resize();e.preventDefault()}},{passive:false});
function pinchEnd(e){if(e.pointerType!=='touch')return;touches.delete(e.pointerId);if(touches.size<2)pinchStart=0}
canvas.addEventListener('pointerup',pinchEnd);canvas.addEventListener('pointercancel',pinchEnd);
const pieceEntries=new Map();
const trackPlacements=makePlacementTracker();
function setView(next){
 for(const cell of trackPlacements(next)){const pos=worldPos('left',cell.row,cell.col);art?.land(pos.row,pos.col);}
 const previous=view;view=next;if(previous.timeMs!==next.timeMs||previous.battle!==next.battle)lastSync=performance.now();
 loadBoard(next.boardModel);
 if(!artwork&&(next.homePalette||next.awayPalette)){
  const home=next.homePalette||next.awayPalette, away=next.awayPalette||next.homePalette;
  const key=home.inner+'|'+away.outer+'|'+home.sky+'|'+away.sky;
  if(key!==skinKey){skinKey=key;garden?.setSkin({home:home.inner,away:away.outer});
   const sky=new T.Color(home.sky).lerp(new T.Color(away.sky),.5);scene.background=sky;scene.fog=new T.Fog(sky.clone(),22,46);}
 } else if(!artwork&&next.skinId && next.skinId!==previous.skinId){
  const n=Number(String(next.skinId).split('-').at(-1))||0; const color=palettes[n%palettes.length];
  scene.background=new T.Color(color); scene.fog=new T.Fog(color,22,46);
 }
 const key=JSON.stringify([next.battle?.battleId,next.board,next.bench,next.enemyBoard,next.enemyBench]);if(key===signature)return;signature=key;
 if(!canKeepArenaDrag(previous,next,pointerStart?.unitId))cancel();clearActors();pieceEntries.clear();
 for(const [team,pieces,reserve] of [['left',next.board,false],['right',next.enemyBoard,false],['left',next.bench,true],['right',next.enemyBench,true]])for(const piece of pieces)pieceEntries.set(reserve?'reserve-'+team+'-'+piece.id:piece.id,{piece,team,reserve});
 const base=next.battle||deploymentView(next.board,next.enemyBoard);
 battle={...base,units:[...base.units],events:[...base.events]};
 for(const [team,pieces] of [['left',next.bench],['right',next.enemyBench]])pieces.forEach((piece,index)=>{
  if(art&&team==='right')return;
  const id='reserve-'+team+'-'+piece.id;const line=deploymentView(team==='left'?[piece]:[],team==='right'?[piece]:[]).units[0];
  battle.units.push({...line,id,name:line.name+' '+starText(piece.star)});
  battle.events.push({seq:-1,timeMs:0,type:'spawn',sourceId:id,text:'',pos:{col:(index-(BENCH_CAPACITY-1)/2)*BENCH_SLOT_SPACING/2+(BOARD_COLS-1)/2,row:(team==='left'?1:-1)*(BOARD_ROWS*1.3/2+1.05)/1.3+(BOARD_ROWS-1)/2}});
 });
 battle.events.sort((a,b)=>a.timeMs-b.timeMs);
 battle.units.forEach(makeActor);
 for(const line of battle.units){const a=models.get(line.id);const piece=pieceEntries.get(line.id)?.piece;if(piece&&!line.id.startsWith('reserve-')){const risk=piece.hazardPct?` ⚠${Math.round(piece.hazardPct)}%`:'';a.label.firstElementChild.textContent=line.name+' '+starText(piece.star)+risk;}}
 buildEffects();
}
function resize(){if(!host.clientWidth||!host.clientHeight)return;const size=art?.resize(cameraZoom);renderer.setSize(size||host.clientWidth,size||host.clientHeight,false);camera.aspect=art?1:host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();placeCamera()}
const observer=new ResizeObserver(resize);observer.observe(host);resize();
function animate(now){if(disposed)return;if(document.hidden){raf=requestAnimationFrame(animate);return}garden?.update(now/1000);art?.update(now/1000,!view.battle&&view.editable);const t=view.battle?Math.min(view.battle.durationMs,(view.timeMs||0)+(view.running?Math.min(200,now-lastSync):0)):0;paint(t);renderer.render(scene,camera);raf=requestAnimationFrame(animate)}raf=requestAnimationFrame(animate);
function dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();clearBoard();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('lostpointercapture',cancel);clearActors();const geos=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m))});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer.dispose();canvas.remove();labels.remove();art?.dispose();}
 return {setView,dispose,resetCamera,rotateCamera,zoomBy};
}
