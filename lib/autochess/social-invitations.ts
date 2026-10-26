import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AccountStore, PublicAccount } from '../accounts/account-store';
import type { RoomStore } from './room-store';
import type { RoomCredentials } from './room-types';
import type { SocialInvite, SocialPeer, SocialSnapshot } from './social-types';
import { MachineInviteService } from './machine-invite';

const INVITE_TTL = 10 * 60_000;
const PRESENCE_TTL = 45_000;

/** Account-addressed mail; external MCP clients fetch it on their next call. */
export class SocialInvitations {
  private entries: SocialInvite[] = [];
  private seen = new Map<string, number>();
  constructor(readonly directory: string, readonly accounts: AccountStore, readonly rooms: RoomStore, readonly now = Date.now) {
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'social-invitations.json');
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.entries)) throw Error('邀约箱数据格式无效');
      this.entries = data.entries;
    }
  }
  private save(entries: SocialInvite[]) {
    const path = join(this.directory, 'social-invitations.json');
    writeFileSync(`${path}.tmp`, JSON.stringify({ version: 1, entries }), 'utf8');
    renameSync(`${path}.tmp`, path);
    this.entries = entries;
  }
  account(token: unknown, machineOnly = false) {
    const account = this.accounts.authenticate(token);
    if (!account || (machineOnly && !account.isAi)) throw Error('请用自己的账号登录');
    if (account.isAi) this.accounts.ownerIdOfAi(account.id);
    return account;
  }
  touch(accountId: string) { this.seen.set(accountId, this.now()); }
  forget(accountId: string) { this.seen.delete(accountId); }
  private permitted(from: PublicAccount, to: PublicAccount) {
    if (from.id === to.id) return false;
    try {
      if (from.isAi) this.accounts.ownerIdOfAi(from.id);
      if (to.isAi) this.accounts.ownerIdOfAi(to.id);
      return from.isAi === to.isAi || this.accounts.ownerIdOfAi(from.isAi ? from.id : to.id) === (from.isAi ? to.id : from.id);
    } catch { return false; }
  }
  private effective(entry: SocialInvite): SocialInvite {
    if (entry.status !== 'pending') return { ...entry };
    try {
      const from = this.accounts.getAccount(entry.fromId), to = this.accounts.getAccount(entry.toId);
      if (!from || !to || !this.permitted(from, to)) return { ...entry, status: 'expired' };
      // A room write may have succeeded before a mailbox write failed. Recover that receipt first.
      if (this.rooms.accountSeat(entry.roomId, entry.toId)) return { ...entry, status: 'accepted' };
      if (entry.expiresAt > this.now() && this.rooms.socialInvitationRoom(entry.roomId, entry.fromId).available) return { ...entry };
    } catch { /* Removed/expired rooms invalidate mail. */ }
    return { ...entry, status: 'expired' };
  }
  private peer(account: PublicAccount): SocialPeer {
    const active = this.now() - (this.seen.get(account.id) ?? -Infinity) < PRESENCE_TTL;
    return { id: account.id, username: account.username, frame: account.frame, kind: account.isAi ? 'machine' : 'human',
      presence: active ? account.isAi ? 'recent' : 'online' : 'offline', inGame: this.rooms.socialRoom(account.id)?.phase === 'prepare' };
  }
  snapshot(token: unknown, machineOnly = false): SocialSnapshot {
    const account = this.account(token, machineOnly);
    this.touch(account.id);
    return this.forAccount(account.id);
  }
  /** Exact names only: never guess a recipient from a partial/fuzzy match. */
  findPlayer(token: unknown, name: unknown, machineOnly = false): SocialPeer {
    const from = this.account(token, machineOnly);
    const to = typeof name === 'string' && name.trim().length <= 80
      ? this.accounts.getAccountByUsername(name) : null;
    if (!to || !this.permitted(from, to)) throw Error('没找到可邀请的棋友，请核对完整账号名；人邀人或自己的机，机邀机或自己的人');
    return this.peer(to);
  }
  private recipient(from: PublicAccount, target: unknown) {
    const value = typeof target === 'string' ? target.trim() : '';
    if (!value || value.length > 80) throw Error('请填写收件人的完整账号名或账号 ID');
    const id = this.accounts.getAccount(value.startsWith('id:') ? value.slice(3) : value);
    const named = value.startsWith('id:') ? null : this.accounts.getAccountByUsername(value);
    if (id && named && id.id !== named.id) throw Error('这个名字与另一个账号 ID 重合，请先按完整账号名查找，再用查询返回的 sendTo 发信');
    const to = id ?? named;
    if (!to || !this.permitted(from, to)) throw Error('没找到可邀请的棋友，请核对完整账号名或账号 ID；人邀请棋友或自己的机，机邀请机或自己的人');
    return to;
  }
  /** Caller already authenticated this account through its seat or account token. */
  forAccount(accountId: string): SocialSnapshot {
    const account = this.accounts.getAccount(accountId);
    if (!account) throw Error('账号已失效');
    const candidates = new Map<string, PublicAccount>();
    for (const [id, at] of this.seen) {
      if (this.now() - at >= PRESENCE_TTL) { this.seen.delete(id); continue; }
      const peer = this.accounts.getAccount(id);
      if (peer && this.permitted(account, peer)) candidates.set(id, peer);
    }
    if (!account.isAi) for (const ai of this.accounts.boundAiById(account.id)) {
      if (this.permitted(account, ai)) candidates.set(ai.id, ai);
    }
    else {
      const owner = this.accounts.getAccount(this.accounts.ownerIdOfAi(account.id));
      if (owner) candidates.set(owner.id, owner);
    }
    let changed = false;
    const updated = this.entries.map(entry => {
      if (entry.fromId !== accountId && entry.toId !== accountId) return entry;
      const next = this.effective(entry);
      if (next.toId === accountId && next.status === 'pending' && !next.seenAt) next.seenAt = this.now();
      if (entry.status !== next.status || entry.seenAt !== next.seenAt) changed = true;
      return next;
    });
    if (changed) this.save(updated);
    const peers = [...candidates.values()].map(peer => this.peer(peer)).sort((a,b) => a.username.localeCompare(b.username));
    const recent = [...updated].reverse();
    const active = this.rooms.socialRoom(accountId);
    const currentRoom = active ? this.rooms.accountSeat(active.roomId,accountId) : null;
    const currentView = currentRoom && active?.phase === 'waiting' ? this.rooms.view(currentRoom) : null;
    const cancelAction = currentView?.seatIndex === 0 && currentView.self ? {
      tool: 'act' as const, args: { kind: 'cancel_room' as const, round: currentView.round, revision: currentView.self.revision },
      fill: ['roomId','token','requestId'], reason: '可沿用 currentRoom 的席位取消等待，不计输赢、不扣币；新开房换新的 requestId。',
    } : undefined;
    return { humans: peers.filter(peer => peer.kind === 'human'), machines: peers.filter(peer => peer.kind === 'machine'),
      ...(currentRoom ? { currentRoom: { ...currentRoom, ...(cancelAction ? { phase: active!.phase, cancelAction } : {}) } } : {}),
      inbox: recent.filter(entry => entry.toId === accountId && entry.status === 'pending').map(entry => ({ ...entry })),
      sent: recent.filter(entry => entry.fromId === accountId).slice(0, 30).map(entry => ({ ...entry })) };
  }
  send(token: unknown, credentials: RoomCredentials, toId: unknown, machineOnly = false) {
    const from = this.account(token, machineOnly);
    const view = this.rooms.view(credentials);
    if (view.seatIndex !== 0 || view.seats[0]?.accountId !== from.id) throw Error('请用自己的房主席位发送邀请');
    const to = this.recipient(from, toId);
    const room = this.rooms.socialInvitationRoom(credentials.roomId, from.id);
    const previous = this.entries.find(entry => entry.roomId === credentials.roomId && entry.toId === to.id);
    // One recipient gets one letter per room; retries cannot resurrect a declined invitation.
    if (previous) return this.effective(previous);
    if (!room.available) throw Error('房间已开局或满员');
    if (this.rooms.socialRoom(to.id)?.phase === 'prepare') throw Error('这位棋手正在对局，等结束再邀请吧');
    if (this.entries.filter(entry => entry.fromId === from.id && entry.createdAt > this.now() - 60_000).length >= 12) throw Error('刚刚发出的邀请有些多，稍等一会儿');
    if (this.entries.filter(entry => entry.toId === to.id && this.effective(entry).status === 'pending').length >= 30) throw Error('对方的邀约箱暂时满了');
    const entry: SocialInvite = { id: randomBytes(12).toString('hex'), roomId: credentials.roomId, fromId: from.id, fromName: from.username,
      fromKind: from.isAi ? 'machine' : 'human', toId: to.id, toName: to.username, toKind: to.isAi ? 'machine' : 'human',
      packName: room.packName, createdAt: this.now(), expiresAt: this.now() + INVITE_TTL, status: 'pending' };
    this.save([...this.entries, entry]);
    return { ...entry };
  }
  respond(token: unknown, id: unknown, accept: boolean, machineOnly = false) {
    const account = this.account(token, machineOnly);
    const entry = this.entries.find(candidate => candidate.id === id && candidate.toId === account.id);
    if (!entry) throw Error('邀请不存在或不属于你');
    const current = this.effective(entry);
    if (current.status === 'accepted') {
      if (!accept) throw Error('这封邀请已经接受');
      const seat = this.rooms.accountSeat(entry.roomId, account.id);
      if (!seat) throw Error('棋局已失效');
      return { invitation: current, seat, presentation: { kind: 'direct' as const, receiptId: entry.id } };
    }
    if (current.status === 'declined' && !accept) return { invitation: current };
    if (current.status !== 'pending') throw Error('这封邀请已失效');
    let seat: RoomCredentials | undefined;
    if (accept) {
      const active = this.rooms.socialRoom(account.id);
      if (active?.phase === 'prepare' && active.roomId !== entry.roomId) throw Error('先结束正在进行的棋局，再接受邀请');
      const room = this.rooms.socialInvitationRoom(entry.roomId, entry.fromId);
      seat = new MachineInviteService(this.accounts, this.rooms).join(room.invitation, undefined, undefined, token as string);
    }
    const receipt: SocialInvite = { ...entry, status: accept ? 'accepted' : 'declined', seenAt: entry.seenAt ?? this.now() };
    this.save(this.entries.map(candidate => candidate.id === entry.id ? receipt : candidate));
    return { invitation: receipt, ...(seat ? { seat, presentation: { kind: 'direct' as const, receiptId: entry.id } } : {}) };
  }
}
