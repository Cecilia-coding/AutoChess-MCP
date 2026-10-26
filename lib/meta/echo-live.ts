import type { EchoEvent } from './echo-tree';

/** 飘条只活在送出的当下；礼笺历史仍由回音树保存。 */
export const ECHO_LIVE_MAX_AGE_MS = 30_000;
export const ECHO_LIVE_POLL_MS = 2_000;

export class EchoLiveQueue {
  private after = Infinity;
  private offset = 0;
  private seen = new Set<string>();
  private queue: EchoEvent[] = [];

  reset(serverNow?: number, localNow = Date.now()) {
    this.after = serverNow ?? Infinity;
    this.offset = serverNow === undefined ? 0 : serverNow - localNow;
    this.seen.clear();
    this.queue = [];
  }

  private fresh(event: EchoEvent, localNow: number) {
    const age = localNow + this.offset - event.at;
    return event.at > this.after && age >= 0 && age < ECHO_LIVE_MAX_AGE_MS;
  }

  push(events: EchoEvent[], localNow = Date.now(), serverNow?: number) {
    if (serverNow !== undefined) this.offset = serverNow - localNow;
    for (const event of events) {
      if (!this.fresh(event, localNow) || this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      this.queue.push(event);
    }
  }

  take(localNow = Date.now()): EchoEvent | null {
    while (this.queue.length) {
      const event = this.queue.shift()!;
      if (this.fresh(event, localNow)) return event;
    }
    return null;
  }
}
