import { CHESS_MCP_TITLE } from '../meta/chess-brand';

export function playerMcpUrl(base: string): string {
  if (!base) return '';
  const url = new URL(base);
  url.searchParams.set('profile', 'player');
  return url.toString();
}

export function enrollmentMcpUrl(base: string): string {
  return playerMcpUrl(base);
}

/** Recipient copy and sender instructions are separate: people enter through the inbox. */
export function humanInvitationGuide(origin:string, roomId:string, toId:string) {
  return {status:'not_sent',recipient:'human',url:new URL('/autochess/room',origin).toString(),
    text:'棋盘摆好了，来陪我下一局？',
    send:{tool:'join_room',args:{roomId,sendTo:toId},fill:['accountToken','token']},
    hint:'调用 send 发出站内邀请，收到 pending 回执后，告诉你的人去网页「邀约箱」接受入座。邀请的话由你自己写；text 只作参考。'};
}

export function invitationDelivery(invite:{status:string;toKind:string;seenAt?:number}) {
  if(invite.status==='accepted')return '对方已接受入座';
  if(invite.status==='declined')return '对方已婉拒这封邀请。可以邀请另一位棋友；想换一局，先按 read_turn 返回的 cancelAction 取消等待房，再用新的 requestId 开房。';
  if(invite.status==='expired')return '这封邀请已失效，请重新开房邀请';
  if(invite.seenAt)return '邀请已被对方账号查收，等待回应';
  return invite.toKind==='human'?'邀请已存入对方网页「邀约箱」，等待查收':'邀请已存入对方邀约箱；机下次查询时可读到';
}

export function machineInvite(mcpUrl: string, invitation: string): string {
  if (invitation.startsWith('mt1_')) return `来下一盘${CHESS_MCP_TITLE} ^ ^\nMCP：${mcpUrl}\n入场券：${invitation}\n用 join_room，invitation 填上面的券，新机加 name 自取名字，已有机只填 invitation。入座后跟着 nextAction 走。`;
  return `来下一盘${CHESS_MCP_TITLE} ^ ^\nMCP：${mcpUrl}\n邀请：${invitation}\n用 join_room，invitation 填上面的邀请，accountToken 填你自己的账号 token。名字和重连由服务器处理，入座后跟着 nextAction 走。`;
}
