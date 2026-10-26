import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EchoEvent } from '../meta/echo-tree';

type EchoFile = { version: 1; events: EchoEvent[]; publishedIds?: string[] };
export type EchoPage = { events: EchoEvent[]; nextId: string | null; hasMore: boolean; cursorReset?: boolean };

const fail = (message: string): never => { throw new Error(message); };

/**
 * 回音树的持久化（单独文件 `echo-tree.json`，不与账号数据混写）。
 * 公共流是全局的；`limit` 只保留最近若干条，避免无限增长。
 */
export class EchoTreeStore {
  private events: EchoEvent[] = [];
  private publishedIds = new Set<string>();

  constructor(readonly directory: string, readonly limit = 300) {
    mkdirSync(directory, { recursive: true });
    const file = join(directory, 'echo-tree.json');
    if (!existsSync(file)) return;
    const data = JSON.parse(readFileSync(file, 'utf8')) as EchoFile;
    if (data.version !== 1) fail('ECHO_TREE_VERSION_UNSUPPORTED');
    this.events = (data.events ?? []).slice(-this.limit);
    this.publishedIds = new Set(data.publishedIds ?? (data.events ?? []).map(event => event.id));
  }

  /** 追加一条公共事件（礼物等）。返回写入的事件。 */
  publish(input: Omit<EchoEvent, 'id' | 'at'> & { id?: string; at?: number }): EchoEvent {
    const { id, at, ...rest } = input;
    if (id && this.publishedIds.has(id)) {
      const existing = this.events.find(event => event.id === id);
      return existing ?? { id, at: at ?? Date.now(), ...rest };
    }
    const event: EchoEvent = { id: id ?? randomBytes(6).toString('hex'), at: at ?? Date.now(), ...rest };
    const next = [...this.events, event].slice(-this.limit);
    const nextPublishedIds = new Set(this.publishedIds).add(event.id);
    this.persist(next, nextPublishedIds);
    this.events = next;
    this.publishedIds = nextPublishedIds;
    return event;
  }

  /** 最近 N 条（新在前）。 */
  recent(count = 40): EchoEvent[] {
    const n = Math.max(1, Math.min(200, Math.floor(count)));
    return [...this.events].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, n);
  }

  /** Current tail ID: clients can subscribe from here without replaying old notices. */
  latestId(): string | null { return this.events.at(-1)?.id ?? null; }

  /**
   * Stable pagination in publication order. A null cursor starts at the oldest retained event.
   * If the cursor has fallen outside the retention window, replay retained events and let
   * the caller deduplicate by event ID instead of silently skipping them.
   */
  pageAfter(afterId: string | null, count = 40): EchoPage {
    const n = Math.max(1, Math.min(200, Math.floor(count)));
    const index = afterId === null ? -1 : this.events.findIndex(event => event.id === afterId);
    const cursorReset = afterId !== null && index < 0;
    const start = index < 0 ? 0 : index + 1;
    const events = this.events.slice(start, start + n);
    return {
      events,
      nextId: events.at(-1)?.id ?? (cursorReset ? this.latestId() : afterId),
      hasMore: start + events.length < this.events.length,
      ...(cursorReset ? { cursorReset: true } : {}),
    };
  }

  /** 拉取更新的事件（新在前）；`after` = 上次看到的毫秒时间。调用方按 id 去重。 */
  since(after: number, count = 40): EchoEvent[] {
    const n = Math.max(1, Math.min(200, Math.floor(count)));
    return this.events.filter(event => event.at >= after).sort((a, b) => b.at - a.at).slice(0, n);
  }

  size() { return this.events.length; }

  private persist(events: EchoEvent[], publishedIds: Set<string>) {
    const file = join(this.directory, 'echo-tree.json');
    const data: EchoFile = { version: 1, events, publishedIds: [...publishedIds] };
    writeFileSync(`${file}.pending`, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${file}.pending`, file);
  }
}
