import type { CompanionPlan } from './companion';
import type { AutochessPiece } from './core';

export type RoomRefRegistry={pieceRefs?:Record<string,string>;nextPieceRef?:number};
// cN is a new namespace: legacy pN was positional and must never silently select a new piece.
// Keep tombstones in the registry so sold/consumed numbers cannot be reused after restart.
export function ensureRoomPieceRefs(seat:RoomRefRegistry & {board:AutochessPiece[];bench?:AutochessPiece[]}) {
  seat.pieceRefs ??= {};
  seat.nextPieceRef=Math.max(seat.nextPieceRef??1,...Object.values(seat.pieceRefs).map(ref=>Number(ref.slice(1))+1));
  for(const p of [...seat.board,...seat.bench??[]].sort((a,b)=>a.id.localeCompare(b.id))) {
    if(!Object.hasOwn(seat.pieceRefs,p.id))seat.pieceRefs[p.id]=`c${seat.nextPieceRef++}`;
  }
}
export function roomPieceRefs(pieces: AutochessPiece[],registry?:RoomRefRegistry) {
  const state={board:pieces,pieceRefs:{...registry?.pieceRefs},nextPieceRef:registry?.nextPieceRef};
  ensureRoomPieceRefs(state);
  return new Map(pieces.map(piece=>[piece.id,state.pieceRefs[piece.id]!]));
}
export function resolveRoomPlan(plan: CompanionPlan, pieces: AutochessPiece[],registry?:RoomRefRegistry): CompanionPlan {
  const ids = new Map([...roomPieceRefs(pieces,registry)].map(([id,ref])=>[ref,id]));
  const resolve = (ref:string)=>{
    if(/^p\d+$/.test(ref))throw Error(`旧临时编号 ${ref} 已停用，请按当前快照的 cN 永久编号操作`);
    if(/^c\d+$/.test(ref)&&!ids.has(ref))throw Error(`棋子 ${ref} 已消耗、出售或不存在；编号不会复用，请用当前快照`);
    return ids.get(ref)??ref;
  };
  return {...plan,sell:plan.sell.map(resolve),field:plan.field?.map(resolve),
    equip:plan.equip?.map(a=>({...a,piece:resolve(a.piece)})),
    unequip:plan.unequip?.map(a=>({...a,piece:resolve(a.piece)})),
    positions:plan.positions?.map(a=>({...a,piece:resolve(a.piece)}))};
}
