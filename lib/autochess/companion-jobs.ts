import type { CompanionSnapshot } from './companion-prompt';

export type DecisionResult = { response: string; totalTokens: number | null; model: string; elapsedMs: number };
export type DecisionJob = {
  gameId: string; round: number; status: 'queued' | 'running' | 'ready' | 'failed' | 'cancelled';
  createdAt: number; startedAt?: number; finishedAt?: number; result?: DecisionResult; code?: string;
};
type Entry = { job: DecisionJob; snapshot: CompanionSnapshot; signature: string; controller: AbortController };
const RETAIN_MS = 30 * 60_000;

/** Jobs belong to the game, never to a polling HTTP connection. */
export class CompanionJobs {
  private entries = new Map<string, Entry>();
  private cancelled = new Map<string, number>();
  private active = false;
  constructor(private decide: (snapshot: CompanionSnapshot, signal: AbortSignal) => Promise<DecisionResult>) {}
  private key(gameId: string, round: number) { return `${gameId}:${round}`; }
  private prune() {
    const cutoff = Date.now() - RETAIN_MS;
    for (const [key, entry] of this.entries) if (entry.job.finishedAt && entry.job.finishedAt < cutoff) this.entries.delete(key);
    for (const [key, time] of this.cancelled) if (time < cutoff) this.cancelled.delete(key);
  }
  get(gameId: string, round: number): DecisionJob | undefined {
    const job = this.entries.get(this.key(gameId, round))?.job;
    return job ? structuredClone(job) : undefined;
  }
  start(gameId: string, snapshot: CompanionSnapshot): DecisionJob {
    this.prune();
    const key = this.key(gameId, snapshot.round);
    if (this.cancelled.has(gameId) || this.cancelled.has(key)) throw new Error('GAME_CANCELLED');
    const signature = JSON.stringify(snapshot);
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.signature !== signature) throw new Error('SNAPSHOT_CONFLICT');
      return this.get(gameId, snapshot.round)!;
    }
    if (this.entries.size >= 256) throw new Error('QUEUE_FULL');
    const job: DecisionJob = { gameId, round: snapshot.round, status: 'queued', createdAt: Date.now() };
    this.entries.set(key, { job, snapshot: structuredClone(snapshot), signature, controller: new AbortController() });
    void this.pump();
    return this.get(gameId, snapshot.round)!;
  }
  cancel(gameId: string, round?: number) {
    this.prune();
    this.cancelled.set(round === undefined ? gameId : this.key(gameId, round), Date.now());
    for (const entry of this.entries.values()) {
      if (entry.job.gameId !== gameId || (round !== undefined && entry.job.round !== round)) continue;
      entry.job.status = 'cancelled'; entry.job.finishedAt = Date.now(); delete entry.job.result;
      entry.controller.abort();
    }
  }
  private async pump() {
    if (this.active) return;
    const entry = [...this.entries.values()].find(entry => entry.job.status === 'queued');
    if (!entry) return;
    this.active = true;
    entry.job.status = 'running'; entry.job.startedAt = Date.now();
    try {
      const result = await this.decide(entry.snapshot, entry.controller.signal);
      if (!entry.controller.signal.aborted) { entry.job.result = result; entry.job.status = 'ready'; }
    } catch (error) {
      if (!entry.controller.signal.aborted) {
        entry.job.status = 'failed';
        entry.job.code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'CURSOR_EXEC_FAILED';
      }
    } finally {
      entry.job.finishedAt = Date.now(); this.active = false;
      void this.pump();
    }
  }
}
