import { mkdirSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, AccountStore } from './account-store';
import { MATCH_LEASE_MS, MATCH_POLL_MS, MATCH_TABLES, type QueueView, type MatchTable } from '../meta/matchmaking';

export type QueueEntry = { accountId: string; username: string; seatSize: number; enqueuedAt: number; pack: string; expiresAt: number };
export type MatchProposal = { humans: { id: string; username: string }[]; ai: { id: string; username: string }[]; people: { id: string; username: string }[]; seatSize: number; pack: string; requestKey: string };
type MatchFile = { version: 1 | 2; queue: QueueEntry[] };

export class MatchQueue {
  private queue: QueueEntry[] = [];
  constructor(readonly directory: string, readonly accounts: AccountStore, private now = Date.now) {
    mkdirSync(directory, { recursive: true });
    const file = join(directory, 'matchmaking.json');
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf8')) as MatchFile;
      if (data.version !== 1 && data.version !== 2) fail('MATCH_QUEUE_VERSION_UNSUPPORTED');
      // Legacy entries lack roster selection and presence leases; clients can rejoin explicitly.
      this.queue = data.version === 2 ? (data.queue ?? []).filter(entry => this.valid(entry)) : [];
    }
  }
  private valid(entry: QueueEntry) {
    return entry.expiresAt > this.now() && Boolean(this.accounts.getAccount(entry.accountId));
  }
  private save(queue: QueueEntry[]) {
    const file = join(this.directory, 'matchmaking.json');
    writeFileSync(`${file}.pending`, JSON.stringify({ version: 2, queue }), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${file}.pending`, file);
    this.queue = queue;
  }
  private prune() {
    const alive = this.queue.filter(entry => this.valid(entry));
    if (alive.length !== this.queue.length) this.save(alive);
  }
  private account(token: unknown) { return this.accounts.authenticate(token) ?? fail('登录态无效'); }
  enqueue(token: unknown, rawSeatSize: unknown, pack = 'ai'): QueueEntry {
    const account = this.account(token), seatSize = Number(rawSeatSize);
    if (!MATCH_TABLES.some(table => table.seats === seatSize)) fail('匹配支持 2 人弈决或 8 人局');
    this.prune();
    if (this.queue.some(entry => entry.accountId === account.id)) fail('已在匹配队列中');
    const entry: QueueEntry = { accountId: account.id, username: account.username, seatSize, pack, enqueuedAt: this.now(), expiresAt: this.now() + MATCH_LEASE_MS };
    this.save([...this.queue, entry]);
    return entry;
  }
  cancel(token: unknown) { this.removeAccountIds([this.account(token).id]); }
  entry(token: unknown, touch = false): QueueEntry | null {
    const account = this.account(token);
    this.prune();
    let entry = this.queue.find(item => item.accountId === account.id);
    if (entry && touch && entry.expiresAt - this.now() < MATCH_LEASE_MS - 15_000) {
      entry = { ...entry, expiresAt: this.now() + MATCH_LEASE_MS };
      this.save(this.queue.map(item => item.accountId === account.id ? entry! : item));
    }
    return entry ?? null;
  }
  private group(entry: QueueEntry) { return this.queue.filter(item => item.pack === entry.pack && item.seatSize === entry.seatSize); }
  positionOf(token: unknown): number {
    const entry = this.entry(token) ?? fail('不在匹配队列中');
    return this.group(entry).findIndex(item => item.accountId === entry.accountId);
  }
  view(token: unknown): QueueView | null {
    const entry = this.entry(token);
    if (!entry) return null;
    const group = this.group(entry), position = group.findIndex(item => item.accountId === entry.accountId);
    const filled = Math.min(entry.seatSize, group.length - Math.floor(position / entry.seatSize) * entry.seatSize);
    return { status: 'queued', position, seatSize: entry.seatSize, mode: entry.seatSize === 2 ? 'duel' : 'standard', pack: entry.pack, filled, remaining: entry.seatSize - filled, enqueuedAt: entry.enqueuedAt, expiresAt: entry.expiresAt, pollAfterMs: MATCH_POLL_MS };
  }
  tables(pack: string): MatchTable[] {
    this.prune();
    return MATCH_TABLES.map(table => {
      const group = this.queue.filter(entry => entry.pack === pack && entry.seatSize === table.seats);
      return { mode: table.mode, seatSize: table.seats, waiting: group.length, filled: Math.min(table.seats, group.length), humans: group.filter(entry => !this.accounts.getAccount(entry.accountId)?.isAi).length, machines: group.filter(entry => this.accounts.getAccount(entry.accountId)?.isAi).length };
    });
  }
  size() { this.prune(); return this.queue.length; }
  previewMatches(): MatchProposal[] {
    this.prune();
    const taken = new Set<string>(), proposals: MatchProposal[] = [];
    for (const host of this.queue) {
      if (taken.has(host.accountId)) continue;
      const group = this.group(host).filter(entry => !taken.has(entry.accountId)).slice(0, host.seatSize);
      if (group.length < host.seatSize) continue;
      for (const entry of group) taken.add(entry.accountId);
      const people = group.map(entry => ({ id: entry.accountId, username: this.accounts.getAccount(entry.accountId)!.username }));
      proposals.push({ people, humans: people.filter(p => !this.accounts.getAccount(p.id)!.isAi), ai: people.filter(p => this.accounts.getAccount(p.id)!.isAi), seatSize: host.seatSize, pack: host.pack,
        requestKey: group.map(entry => `${entry.accountId}:${entry.enqueuedAt}`).join('|') });
    }
    return proposals;
  }
  commitMatch(proposal: MatchProposal) {
    if (!this.previewMatches().some(item => item.requestKey === proposal.requestKey)) fail('匹配队列已变化，请重新配对');
    this.removeAccountIds(proposal.people.map(person => person.id));
  }
  renewMatch(proposal: MatchProposal) {
    const ids = new Set(proposal.people.map(person => person.id));
    const at = Math.max(this.now(), ...this.queue.filter(entry => ids.has(entry.accountId)).map(entry => entry.enqueuedAt + 1));
    this.save(this.queue.map(entry => ids.has(entry.accountId) ? { ...entry, enqueuedAt: at } : entry));
  }
  removeAccountIds(ids: readonly string[]) {
    const selected = new Set(ids), remaining = this.queue.filter(entry => !selected.has(entry.accountId));
    if (remaining.length !== this.queue.length) this.save(remaining);
  }
  tryMatch(): MatchProposal[] {
    const proposals = this.previewMatches();
    for (const proposal of proposals) this.commitMatch(proposal);
    return proposals;
  }
}
