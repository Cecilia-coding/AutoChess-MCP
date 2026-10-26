import { BENCH_CAPACITY, BENCH_SLOT_SPACING } from './constants';
import * as T from 'three';

/** Scene dressing only. All playable positions still come from the combat grid.
 * 整座程序化庭院挂在一个 group 上：装备了带 GLB 的棋盘时，渲染器用 `setVisible(false)` 让位给真模型。 */
export function makePeachGarden(scene, rows, cols) {
  // 双方皮肤：内场用主场色（jade 材质），外场/亭台用客场色（rose 材质）。
  // 材质是共享对象，改色即时全场生效，不需要重建几何。
  function setSkin({ home, away } = {}) {
    if (home) jade.color.set(home);
    if (away) rose.color.set(away);
  }
  const group = new T.Group(); scene.add(group);
  const cell = 1.3, cellX = 2, w = cols * cellX, d = rows * cell;
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .7, ...extra });
  const jade = mat('#fae5df'), rose = mat('#d48d9e'), gold = mat('#ccaa71', { metalness: .55, roughness: .35 });
  const bark = mat('#765462'), pool = mat('#a9cbd0', { roughness: .25, metalness: .25 });
  const add = (geo, material, x=0, y=0, z=0, parent=group) => {
    const m = new T.Mesh(geo, material); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (a,b,c,m,x,y,z) => add(new T.BoxGeometry(a,b,c),m,x,y,z);
  function beam(a,b,r,m=bark) {
    const p=new T.Vector3(...a), q=new T.Vector3(...b), delta=q.clone().sub(p);
    const o=add(new T.CylinderGeometry(r*.7,r,delta.length(),7),m);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;
  }
  // Rounded, near-square courtyard; display spacing does not change grid rules.
  function terrace(width,depth,y,material){
    const a=width/2,b=depth/2,r=1.35,s=new T.Shape();
    s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);
    const m=add(new T.ExtrudeGeometry(s,{depth:.23,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.1,bevelThickness:.08}),material,0,y,0);m.rotation.x=-Math.PI/2;
  }
  terrace(w+1.45,d+1.45,-.54,rose);terrace(w+1.12,d+1.12,-.29,jade);
  const tiles=[mat('#f4dce4'), mat('#f7e2e8')];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    box(cellX-.025,.06,cell-.025,tiles[(r+c)%2],(c-(cols-1)/2)*cellX,.025,(r-(rows-1)/2)*cell);
  }
  for(const x of [-w/2-.1,w/2+.1])box(.025,.025,d+.23,gold,x,.017,0);
  for(const z of [-d/2-.1,d/2+.1])box(w+.23,.025,.025,gold,0,.017,z);
  const floor=add(new T.PlaneGeometry(200,200),pool,0,-.74,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  // Distinct five-petal flowers, shared across tree canopies and inlaid ornaments.
  const petalShape=new T.Shape();petalShape.moveTo(0,0);petalShape.bezierCurveTo(-.17,.12,-.2,.35,0,.4);petalShape.bezierCurveTo(.2,.35,.17,.12,0,0);
  const petalGeo=new T.ShapeGeometry(petalShape,5);
  const petalMats=['#f48cac','#ffd2e0','#fff1f1'].map(color=>mat(color,{side:T.DoubleSide}));
  const blossomGeo=new T.IcosahedronGeometry(1,1);
  let seed=39;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const dummy=new T.Object3D();
  function flower(x,y,z,scale=1,flat=false) {
    const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);if(flat)g.rotation.x=-Math.PI/2;group.add(g);
    for(let k=0;k<5;k++){const p=add(petalGeo,petalMats[k%3],0,0,0,g);p.rotation.z=k*Math.PI*2/5;p.castShadow=false;}
    add(new T.SphereGeometry(.045,5,4),gold,0,0,.02,g);return g;
  }
  // Two asymmetrical trees frame the arena; the open front preserves combat visibility.
  for(const [tx,tz] of [[w/2+1.7,-d/2-3.2]]) {
    add(new T.CylinderGeometry(.85,.95,.28,9),jade,tx,-.6,tz);
    const joints=[[tx,-.5,tz],[tx-.25,1.15,tz],[tx-1.05,2.6,tz-.15],[tx-2,4.1,tz-.3]];
    for(let i=1;i<joints.length;i++)beam(joints[i-1],joints[i],.29-i*.04);
    const crowns=[[tx-2.1,4.15,tz-.3],[tx-3.1,3.55,tz],[tx-.9,3.5,tz+.2],[tx-2,3.5,tz-1.1]];
    for(const p of crowns)beam(joints[2],p,.065);
    // Small faceted bloom clusters give volume; individual blossoms sit on the outer branches.
    const canopy=new T.InstancedMesh(blossomGeo,petalMats[0],150);canopy.castShadow=true;group.add(canopy);
    for(let i=0;i<150;i++){const center=crowns[i%4],angle=random()*Math.PI*2,rad=Math.sqrt(random())*1.12;
      dummy.position.set(center[0]+Math.cos(angle)*rad,center[1]+(random()-.45)*.75,center[2]+Math.sin(angle)*rad);
      const size=.23+random()*.24;dummy.scale.set(size*1.3,size*.72,size);dummy.rotation.set(random(),random()*3,random());dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);canopy.setColorAt(i,new T.Color(['#ee85a8','#f5a8c1','#ffd0de','#ffe1e8'][i%4]));
    }
    canopy.instanceMatrix.needsUpdate=true;
    for(let i=0;i<12;i++){const center=crowns[i%4];const g=flower(center[0]+(random()-.5)*1.5,center[1]+(random()-.3)*.6,center[2]+.5, .55+random()*.4);g.rotation.y=(random()-.5)*1.3;}
  }
  // Low jade rails leave both reserve rows open.
  for(const x of [-w/2-.36,w/2+.36]){
    for(const z of [-d/2+.25,-d/4,0,d/4,d/2-.25]){
      box(.16,.56,.16,jade,x,.18,z);add(new T.SphereGeometry(.12,8,6),gold,x,.5,z);
    }
    box(.09,.1,d-.5,jade,x,.24,0);box(.08,.06,d-.5,gold,x,.4,0);
  }
  // Reserve seats use the shared game capacity. Visual only here.
  for(const side of [-1,1])for(let i=0;i<BENCH_CAPACITY;i++){
    const x=(i-(BENCH_CAPACITY-1)/2)*BENCH_SLOT_SPACING,z=side*(d/2+1.05);
    add(new T.CylinderGeometry(.38,.46,.44,12),bark,x,-.43,z);
    add(new T.CylinderGeometry(.58,.56,.13,20),rose,x,-.15,z);
    add(new T.CylinderGeometry(.51,.51,.045,24),jade,x,-.065,z);
    flower(x,-.038,z,.65,true);
  }
  for(const x of [-w/2-.45,w/2+.45])for(const z of [-d/2-.44,d/2+.44]){
    box(.46,.18,.46,rose,x,-.02,z);box(.23,.36,.23,jade,x,.25,z);
    const lantern=add(new T.SphereGeometry(.24,8,8),mat('#ffdbb6',{emissive:'#ffb583',emissiveIntensity:.5}),x,.64,z);lantern.scale.y=1.25;
    add(new T.ConeGeometry(.34,.18,4),gold,x,.99,z).rotation.y=Math.PI/4;
    flower(x,.34,z+.13,.24);
  }
  // A broad front stair and small gold blossom inlays on the outside border.
  box(2.6,.12,.65,jade,0,-.53,d/2+.85);box(2.85,.1,.6,rose,0,-.65,d/2+1.3);
  for(const x of [-2.5,-1.25,0,1.25,2.5])flower(x,.028,-d/2-.32,.34,true);
  for(const x of [-2.5,-1.25,1.25,2.5])flower(x,.028,d/2+.32,.3,true);
  // Water rings and flowers sit outside the playable surface.
  const ripples=[];
  for(const [x,z,s] of [[-5.4,3.8,.85],[5.2,2.8,.7],[-5,-2,.55],[3.9,7,.65]]){
    const leaf=add(new T.CircleGeometry(s*.65,24),mat('#83aaa2',{side:T.DoubleSide}),x,-.716,z);leaf.rotation.x=-Math.PI/2;leaf.castShadow=false;
    flower(x,-.7,z,s,true);
    for(let i=0;i<2;i++){const ring=add(new T.RingGeometry(s*(1.1+i*.4),s*(1.1+i*.4)+.018,48),new T.MeshBasicMaterial({color:'#fff2ed',transparent:true,opacity:.38,side:T.DoubleSide}),x,-.718,z);ring.rotation.x=-Math.PI/2;ring.castShadow=false;ripples.push(ring);}
  }
  // A light scattering of fallen petals on the frame, away from health bars and faces.
  for(let i=0;i<30;i++){const side=i%2?-1:1;const p=add(petalGeo,petalMats[i%3],side*(w/2+.15+random()*.22),.032,(random()-.5)*d);p.rotation.set(-Math.PI/2,0,random()*6);p.scale.setScalar(.25+random()*.25);p.castShadow=false;}
  const falling=new T.InstancedMesh(petalGeo,mat('#ffe1eb',{side:T.DoubleSide,roughness:1,transparent:true,opacity:.78,depthWrite:false}),48);falling.castShadow=false;group.add(falling);
  // Independent paths distributed through the garden, rather than one diagonal stream.
  const drifting=Array.from({length:48},()=>({
    x:(random()-.5)*(w+2),z:(random()-.5)*(d+2),phase:random(),
    duration:19+random()*19,s:.26+random()*.22,height:3.4+random()*2,
    dx:(random()-.6)*3,dz:(random()-.5)*3,
    sway:.25+random()*.7,freq:.24+random()*.47,
    spin:(random()-.5)*1.3,tilt:random()*Math.PI*2,
  }));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function update(seconds){const t=reduced?0:seconds;
    drifting.forEach((p,i)=>{
      const progress=(t/p.duration+p.phase)%1,angle=t*p.freq+p.tilt;
      dummy.position.set(
        p.x+(progress-.5)*p.dx+Math.sin(angle)*p.sway+Math.sin(angle*.43+2)*.22,
        p.height-progress*(p.height+.55)+Math.sin(angle*1.7)*.12,
        p.z+(progress-.5)*p.dz+Math.cos(angle*.73+p.phase*9)*p.sway*.8,
      );
      dummy.rotation.set(p.tilt+Math.sin(angle*1.2)*.8,t*p.spin+p.tilt,Math.cos(angle*.9)*.7+p.tilt);
      const fade=Math.min(1,progress*12,(1-progress)*12);
      dummy.scale.set(p.s*fade,p.s*fade,p.s*fade);dummy.updateMatrix();falling.setMatrixAt(i,dummy.matrix);
    });falling.instanceMatrix.needsUpdate=true;
    ripples.forEach((r,i)=>{r.scale.setScalar(1+Math.sin(t*.8+i)*.055)});
  }
  update(0);return {update, setSkin, setVisible:(visible)=>{group.visible=visible}};
}
