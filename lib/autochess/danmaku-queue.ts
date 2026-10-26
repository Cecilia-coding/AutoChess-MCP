import type { DanmakuMessage } from './room-types';

export const DANMAKU_PASS_MS = 11_000;
export const DANMAKU_PASSES = 2;
const GAP_MS = 900;
export type FlyingMessage = { message: DanmakuMessage; lane: number; start: number };

/** 同一房间的轮询只收一次；每轨独占到第二遍完整离屏。 */
export class DanmakuQueue {
  private seen = new Set<string>();
  private pending: DanmakuMessage[] = [];
  private active: FlyingMessage[] = [];
  private nextStart = 0;
  private pausedAt: number | undefined;

  tick(messages: readonly DanmakuMessage[], now: number, paused = false): FlyingMessage[] {
    for (const message of messages) {
      if (this.seen.has(message.id)) continue;
      this.seen.add(message.id); this.pending.push(message);
    }
    if (paused) { this.pausedAt ??= now; return this.active; }
    if (this.pausedAt !== undefined) {
      const delay = now - this.pausedAt;
      this.active = this.active.map(entry => ({ ...entry, start: entry.start + delay }));
      this.nextStart += delay; this.pausedAt = undefined;
    }
    const remaining = this.active.filter(entry => now < entry.start + DANMAKU_PASS_MS * DANMAKU_PASSES + GAP_MS);
    if (remaining.length !== this.active.length) this.active = remaining;
    for (let lane = 0; lane < 2 && this.pending.length; lane++) {
      if (this.active.some(entry => entry.lane === lane)) continue;
      const start = Math.max(now, this.nextStart);
      this.nextStart = start + GAP_MS;
      this.active = [...this.active, { message: this.pending.shift()!, lane, start }];
    }
    return this.active;
  }
}
