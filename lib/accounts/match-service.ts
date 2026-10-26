import { fail, type AccountStore } from './account-store';
import type { MatchQueue } from './matchmaking';
import type { RoomStore } from '../autochess/room-store';
import type { MatchOptions, MatchResult } from '../meta/matchmaking';

/** A player receives only the token for the seat bound to their own account. */
export type MatchSeekResult = MatchResult;

export type MatchServiceDeps = {
  accounts: AccountStore;
  queue: MatchQueue;
  rooms: RoomStore;
  pack: () => string | undefined;
  travelSeats?: number;
  validatePack?: (pack: string) => void;
};

/** People and machines share opt-in queues. Internal-bot practice remains explicit. */
export class MatchService {
  constructor(private deps: MatchServiceDeps) {}

  seek(token: unknown, opts: MatchOptions = {}): MatchSeekResult {
    const account = this.deps.accounts.authenticate(token);
    if (!account) fail('登录态无效');
    const active = this.active(account.id, 'queue') ?? this.active(account.id, 'travel');
    if (active) { this.deps.queue.removeAccountIds([account.id]); return active; }
    if (this.deps.rooms.socialRoom(account.id)) fail('你已有未结束的棋局；用 read_turn(accountToken) 找 currentRoom，等待房按 cancelAction 取消后再匹配；已开局可继续或 resign 认输');
    if (opts.practice) {
      if (!account.isAi) fail('内置机练习入口仅供机账号');
      if (this.deps.queue.entry(token)) fail('请先退出匹配队列');
      return this.openTravel(account, opts);
    }
    const seatSize = opts.seatSize ?? (opts.mode === 'duel' ? 2 : 8);
    if (opts.mode && opts.mode !== (seatSize === 2 ? 'duel' : 'standard')) fail('1v1 用 duel/2席，八人用 standard/8席');
    const pack = opts.pack ?? this.deps.pack() ?? 'ai';
    this.deps.validatePack?.(pack);
    const entry = this.deps.queue.entry(token, true);
    if (entry && (entry.seatSize !== seatSize || entry.pack !== pack)) fail('已在另一条队列中，请先退出再换模式或棋谱');
    if (!entry) this.deps.queue.enqueue(token, seatSize, pack);
    this.tick();
    return this.active(account.id, 'queue') ?? this.deps.queue.view(token)!;
  }

  status(token: unknown): MatchSeekResult | null {
    const account = this.deps.accounts.authenticate(token);
    if (!account) fail('登录态无效');
    const active = (this.active(account.id, 'queue') ?? this.active(account.id, 'travel'));
    if (active) { this.deps.queue.removeAccountIds([account.id]); return active; }
    this.deps.queue.entry(token, true);
    // A process may have stopped after both queue entries were saved but before pairing them.
    this.tick();
    const recovered = this.active(account.id, 'queue');
    if (recovered) return recovered;
    return this.deps.queue.view(token);
  }

  cancel(token: unknown) {
    const account = this.deps.accounts.authenticate(token);
    if (!account) fail('登录态无效');
    if ((this.active(account.id, 'queue') ?? this.active(account.id, 'travel'))) fail('棋局已经开场，不能取消；请继续或在棋局里认输');

    this.deps.queue.cancel(token);
  }

  /** A failed room creation leaves the queue intact; a failed queue write reuses the same persisted room. */
  tick(): void {
    for (const proposal of this.deps.queue.previewMatches()) {
      const alreadySeated = proposal.people.filter(person => this.deps.rooms.activeMatchSeat(person.id, 'queue') || this.deps.rooms.socialRoom(person.id));
      if (alreadySeated.length) {
        this.deps.queue.removeAccountIds(alreadySeated.map(person => person.id));
        continue;
      }
      try { this.deps.validatePack?.(proposal.pack); }
      catch { this.deps.queue.removeAccountIds(proposal.people.map(person=>person.id)); continue; }
      const room = this.deps.rooms.createMatched(proposal.requestKey,
        proposal.people.map(person => this.deps.accounts.seatIdentity(person.id)), proposal.pack, proposal.seatSize);
      if (room.phase === 'finished') { this.deps.queue.renewMatch(proposal); continue; }
      this.deps.queue.commitMatch(proposal);
    }
  }

  tables(pack?: string) { return this.deps.queue.tables(pack ?? this.deps.pack() ?? 'ai'); }

  private active(accountId: string, kind: 'queue' | 'travel'): MatchSeekResult | null {
    const seat = this.deps.rooms.activeMatchSeat(accountId, kind);
    return seat ? { status: 'matched', roomId: seat.roomId, token: seat.token,
      seatSize: seat.seatSize, travel: kind === 'travel' } : null;
  }

  /** AI travel is a single active room, recovered from the room journal after a server restart. */
  private openTravel(account: { id: string; username: string }, opts: { seatSize?: number; mode?: string }): MatchSeekResult {
    const current = this.deps.rooms.activeMatchSeat(account.id, 'travel');
    if (current) {
      if (current.phase === 'waiting') this.deps.rooms.start({ roomId: current.roomId, token: current.token });
      return this.active(account.id, 'travel')!;
    }
    const seatSize = Math.max(2, Math.min(16, Math.floor(opts.seatSize ?? this.deps.travelSeats ?? 2)));
    const created = this.deps.rooms.create(account.username, this.deps.pack(), seatSize,
      { accountId: account.id, accountName: account.username }, opts.mode ?? 'standard', 'travel');
    this.deps.rooms.start({ roomId: created.roomId, token: created.token });
    return this.active(account.id, 'travel')!;
  }
}
