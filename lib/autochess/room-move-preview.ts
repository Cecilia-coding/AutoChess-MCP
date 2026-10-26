import type { RoomAction, RoomView } from './room-types';
export type PendingRoomMove={roomId:string;round:number;revision:number;action:Extract<RoomAction,{kind:'move'}>};

// Keep server state authoritative; paint only a legal move at the version it was sent against.
export function previewRoomMove(view:RoomView,pending:PendingRoomMove|null):RoomView {
  const self=view.self;
  if(!pending||!self||self.ready||view.phase==='finished'||pending.roomId!==view.id||pending.round!==view.round||pending.revision!==self.revision)return view;
  const {piece:id,row,col}=pending.action;
  if(!Number.isInteger(row)||row<0||row>3||!Number.isInteger(col)||col<0||col>4)return view;
  const board=self.board.map(p=>({...p})),bench=(self.bench??[]).map(p=>({...p}));
  const piece=[...board,...bench].find(p=>p.id===id);if(!piece)return view;
  const occupant=board.find(p=>p.localRow===row&&p.localCol===col);
  const reserve=bench.findIndex(p=>p.id===id);
  if(reserve>=0){
    if(occupant){bench[reserve]=occupant;board[board.indexOf(occupant)]={...piece,localRow:row,localCol:col};}
    else {if(board.length>=self.capacity)return view;bench.splice(reserve,1);board.push({...piece,localRow:row,localCol:col});}
  }else{
    if(occupant&&occupant.id!==id){occupant.localRow=piece.localRow;occupant.localCol=piece.localCol;}
    piece.localRow=row;piece.localCol=col;
  }
  return {...view,self:{...self,board,bench},seats:view.seats.map((seat,i)=>i===view.seatIndex?{...seat,board,bench}:seat)};
}
