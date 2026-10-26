import { createHash } from 'node:crypto';
import { AccountStore } from '../accounts/account-store';
import { RoomStore } from './room-store';
import type { RoomCredentials } from './room-types';

/** One invitation joins one room. The two stores run synchronously in the room server. */
export class MachineInviteService {
  constructor(readonly accounts: AccountStore, readonly rooms: RoomStore) {}

  private host(roomId: string, seatToken: string, accountToken: string) {
    const account = this.accounts.authenticate(accountToken);
    if (!account || account.isAi) throw new Error('请先登录玩家账号');
    const room = this.rooms.machineHostRoom(roomId, seatToken, account.id);
    return { account, room };
  }

  issue(roomId: string, seatToken: string, accountToken: string, aiId?: string) {
    const { account } = this.host(roomId, seatToken, accountToken);
    return this.accounts.issueMachineTicket(account.id, roomId, aiId);
  }

  request(roomId: string, seatToken: string, accountToken: string, aiUsername: string) {
    this.host(roomId, seatToken, accountToken);
    void aiUsername;
    throw new Error('人邀请自家机；两只不同主人的机可以直接互邀');
  }

  hostRequests(roomId: string, seatToken: string, accountToken: string) {
    const account = this.accounts.authenticate(accountToken);
    if (!account || account.isAi) throw new Error('请先登录玩家账号');
    // Do not require a vacant room merely to show the status of an earlier request.
    const info = this.rooms.machineTicketRoom(roomId, account.id, false);
    if (!info || this.rooms.view({ roomId, token: seatToken }).seatIndex !== 0) throw new Error('只有房主可以查看申请');
    return { requests: this.accounts.machineRequestsForHost(account.id, roomId).map(request => this.withRoomStatus(request, account.id)) };
  }

  ownerRequests(accountToken: string) {
    return { requests: this.accounts.machineRequestsForOwner(accountToken).map(request => {
      const source = this.accounts.machineRequest(request.requestId)!;
      return this.withRoomStatus(request, source.requesterId);
    }) };
  }

  respond(accountToken: string, requestId: string, accept: boolean) {
    if (accept) throw new Error('借机邀请已关闭；两只机可以直接互邀对掏');
    this.accounts.machineRequestForResponse(accountToken, requestId);
    return this.accounts.respondMachineRequest(accountToken, requestId, accept);
  }

  private withRoomStatus<T extends { roomId: string; status: string; ticket?: string }>(request: T, hostId: string): T {
    if (request.status === 'declined' || request.status === 'revoked' || request.status === 'expired') return request;
    try { this.rooms.machineTicketRoom(request.roomId, hostId, true); return request; }
    catch { const { ticket: _ticket, ...safe } = request; return { ...safe, status: 'expired' } as T; }
  }

  join(invitation: string, name?: string, joinKey?: string, accountToken?: string): RoomCredentials & { machineAccount?: { id: string; username: string }; accountToken?: string; nextVisit?: string } {
    if (invitation?.startsWith('mt1_')) {
      if (joinKey || accountToken) throw new Error('邀请券入座只需要 invitation 和新机的 name；请省略 accountToken、joinKey，账号会自动建好');
      return this.joinTicket(invitation, name);
    }
    const room = this.rooms.invitationRoom(invitation);
    const account = accountToken ? this.accounts.authenticate(accountToken) : null;
    if (accountToken && !account) throw new Error('账号登录态无效');
    const host = room.hostAccountId ? this.accounts.getAccount(room.hostAccountId) : null;
    if (host?.isAi && !account) throw new Error('这是普通房间邀请。填 invitation 和你自己的 accountToken 即可入座，重连由服务器处理');
    if (host?.isAi) {
      if (account?.isAi) this.accounts.ownerIdOfAi(account.id);
      else if (!account || account.id !== this.accounts.ownerIdOfAi(host.id)) throw new Error('机开的房间只邀请机，或这只机自己的主人');
    } else if (account?.isAi && this.accounts.ownerIdOfAi(account.id) !== room.hostAccountId) {
      throw new Error('人开的房间只邀请自己的机；两只机对掏，请让机开房');
    }
    const owner = account ? this.accounts.seatIdentity(account.id) : undefined;
    const displayName = owner?.accountName ?? name?.trim();
    if (!displayName) throw new Error('匿名入座请填写名字');
    if (!owner && this.accounts.isRegisteredUsername(displayName)) throw new Error('已有账号请填写自己的 accountToken，名字会自动带上');
    if (owner && !joinKey) return this.rooms.joinForAccount(invitation, owner);
    if (!joinKey || joinKey.length < 16) throw new Error('已有账号填自己的 accountToken 即可；匿名入座填 name 和至少16位 joinKey');
    return this.rooms.join(invitation, displayName, joinKey, owner);
  }

  private joinTicket(rawTicket: string, name?: string) {
    const ticket = this.accounts.machineTicket(rawTicket);
    const joinKey = createHash('sha256').update(rawTicket).digest('hex');
    const seatedAccountId = this.rooms.machineTicketSeat(ticket.roomId, joinKey);
    const host = this.accounts.getAccount(ticket.hostId);
    if (!host || host.isAi) throw new Error('邀请人账号已失效');
    if (ticket.approvalId) throw new Error('人开的房间只邀请自己的机；两只机对掏，请让机开房');
    if (ticket.usedAt && !seatedAccountId) throw new Error('这张券已用过，请主人重新发券');
    if (ticket.revokedAt || (ticket.expiresAt <= Date.now() && !seatedAccountId)) throw new Error('邀请券已失效，请主人重新发券');
    const invitation = this.rooms.machineTicketRoom(ticket.roomId, ticket.hostId, !seatedAccountId);
    if (ticket.approvalId) {
      const request = this.accounts.machineRequest(ticket.approvalId);
      if (!request || request.status !== 'approved' || request.roomId !== ticket.roomId || request.requesterId !== ticket.hostId || request.aiId !== ticket.aiId || request.ticket !== rawTicket || request.expiresAt <= Date.now()) throw new Error('借机授权已失效');
      if (this.accounts.ownerIdOfAi(request.aiId) !== request.ownerId) throw new Error('机主身份已变化');
    } else if (ticket.kind === 'existing' && this.accounts.ownerIdOfAi(ticket.aiId!) !== ticket.hostId) throw new Error('这位机的归属已变化');
    const account = ticket.kind === 'new'
      ? seatedAccountId && ticket.aiId ? this.accounts.getAccount(ticket.aiId) ?? (() => { throw new Error('机账号已失效'); })() : this.accounts.claimMachineTicket(rawTicket, name)
      : this.accounts.getAccount(ticket.aiId!) ?? (() => { throw new Error('机账号已失效'); })();
    if (seatedAccountId && seatedAccountId !== account.id) throw new Error('这张券已绑定另一位棋手');
    const owner = this.accounts.seatIdentity(account.id);
    let seat;
    try { seat = this.rooms.join(invitation, owner.accountName, joinKey, owner); }
    catch (error) {
      if (ticket.kind === 'new' && ticket.aiId) throw new Error(`机账号「${account.username}」已建好，原券可重试入座：${error instanceof Error ? error.message : '房间入座失败'}`);
      throw error;
    }
    this.accounts.markMachineTicketUsed(rawTicket);
    const accountToken = this.accounts.accountTokenForMachineTicket(rawTicket, account.id);
    return { ...seat, machineAccount: { id: account.id, username: account.username }, ...(accountToken ? { accountToken } : {}), nextVisit: accountToken
      ? '分别保存 accountToken（账号凭证，查信/开房/局外）和 token（本局席位，读盘/行动）。丢失 accountToken 时，主人可在「你的机」点击获取凭证。'
      : '这张券仅供本房间入座；局外账号 token 请找机主拿自己的邀请券' };
  }
}
