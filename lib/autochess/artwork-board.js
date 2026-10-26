import * as T from 'three';
import { BOARD_ROWS, BOARD_COLS, BENCH_CAPACITY } from './constants';
import { makeCourtAmbience } from './board-ambience.js';

/** Fixed-view painted scenery with a shared projection for pieces and hit targets. */
export function makeArtworkBoard(host, canvas, labels, camera, scene, data) {
  const frame = document.createElement('div'); frame.className = 'arena-art-frame';
  const image = document.createElement('img'); image.src = data.image; image.alt = ''; image.draggable = false; image.className = 'arena-art-backdrop';
  const mist = document.createElement('div'); mist.className = 'arena-art-mist';
  const ns = 'http://www.w3.org/2000/svg';
  const grid = document.createElementNS(ns, 'svg'); grid.setAttribute('viewBox', `0 0 ${data.size} ${data.size}`); grid.classList.add('arena-art-grid'); grid.setAttribute('aria-hidden', 'true');
  frame.append(image, mist, grid, canvas, labels); host.append(frame); host.classList.add('is-artwork');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ambience = makeCourtAmbience(frame, canvas, data.ambience, reduced);
  const ray = new T.Raycaster(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0);
  function fromArt(x, y) {
    ray.setFromCamera(new T.Vector2(x / data.size * 2 - 1, 1 - y / data.size * 2), camera);
    return ray.ray.intersectPlane(floor, new T.Vector3());
  }
  function point(row, col) {
    const t = row / BOARD_ROWS, s = col / BOARD_COLS, [tl, tr, br, bl] = data.corners;
    return [T.MathUtils.lerp(T.MathUtils.lerp(tl[0], bl[0], t), T.MathUtils.lerp(tr[0], br[0], t), s), T.MathUtils.lerp(tl[1], bl[1], t)];
  }
  for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) {
    const polygon = document.createElementNS(ns, 'polygon');
    polygon.setAttribute('points', [[r,c],[r,c+1],[r+1,c+1],[r+1,c]].map(p => point(...p).join(',')).join(' ')); grid.append(polygon);
  }
  const shadow = new T.Mesh(new T.PlaneGeometry(90,90), new T.ShadowMaterial({opacity:.38}));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = -.015; shadow.receiveShadow = true; scene.add(shadow);
  const petals = document.createElement('div'); petals.className = 'arena-art-petals'; petals.setAttribute('aria-hidden','true'); frame.append(petals);
  for(let i=0;i<(data.particles === false ? 0 : 10);i++){const petal=document.createElement('i');petal.style.cssText=`left:${6+i*37%87}%;animation-duration:${14+i%5*2}s;animation-delay:${-i*3}s`;petals.append(petal);}
  return {
    land(row,col){ambience.land(...point(row+.5,col+.5));},
    cellPosition(row,col){return fromArt(...point(row+.5,col+.5));},
    cellGeometry(row,col){
      const positions=[[row,col],[row,col+1],[row+1,col+1],[row+1,col]].flatMap(p=>{const v=fromArt(...point(...p));return [v.x,.015,v.z];});
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex([0,1,2,0,2,3]);return geometry;
    },
    benchPosition(index){return fromArt(...data.bench.first.map((v,axis)=>T.MathUtils.lerp(v,data.bench.last[axis],index/(BENCH_CAPACITY-1))));},
    resize(zoom=1){
      const w=host.clientWidth,h=host.clientHeight,landscape=w>h&&h<600;
      const available=landscape?w-200:w;
      const size=Math.max(1,Math.min(available, h*(landscape?1.16:1.04))/Math.min(1,Math.max(.78,zoom)));
      frame.style.width=`${size}px`;frame.style.height=`${size}px`;
      frame.style.left=`${(w-size)/2}px`;frame.style.top=`${(h-size)/2-(landscape?size*.045:0)}px`;
      return size;
    },
    update(time,editable){grid.style.opacity=editable?'.8':'0';ambience.update(time,true);},
    dispose(){frame.remove();host.classList.remove('is-artwork');},
  };
}
