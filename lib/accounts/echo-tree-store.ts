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

  private visibleEvents(viewerIds?: readonly string[], includePublic = true): EchoEvent[] {
    if (!viewerIds) return this.events.filter(event => event.scope !== 'private');
    const viewers = new Set(viewerIds);
    return this.events.filter(event => {
      if (event.scope !== 'private') return includePublic;
      if (event.audienceIds?.length) return event.audienceIds.some(id => viewers.has(id));
      return viewers.has(event.from.id) || viewers.has(event.to.id);
    });
  }

  /** 最近 N 条（新在前）。 */
  recent(count = 40, viewerIds?: readonly string[]): EchoEvent[] {
    const n = Math.max(1, Math.min(200, Math.floor(count)));
    return [...this.visibleEvents(viewerIds)].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, n);
  }

  /** Current tail ID: clients can subscribe from here without replaying old notices. */
  latestId(viewerIds?: readonly string[]): string | null {
    return this.visibleEvents(viewerIds).at(-1)?.id ?? null;
  }

  /**
   * Stable pagination in publication order. A null cursor starts at the oldest retained event.
   * If the cursor has fallen outside the retention window, replay retained events and let
   * the caller deduplicate by event ID instead of silently skipping them.
   */
  pageAfter(afterId: string | null, count = 40, viewerIds?: readonly string[]): EchoPage {
    const list = this.visibleEvents(viewerIds);
    const n = Math.max(1, Math.min(200, Math.floor(count)));
    const index = afterId === null ? -1 : list.findIndex(event => event.id === afterId);
    const cursorReset = afterId !== null && index < 0;
    const start = index < 0 ? 0 : index + 1;
    const events = list.slice(start, start + n);
    return {
      events,
      nextId: events.at(-1)?.id ?? (cursorReset ? (list.at(-1)?.id ?? null) : afterId),
      hasMore: start + events.length < list.length,
      ...(cursorReset ? { cursorReset: true } : {}),
    };
  }

  /** 拉取更新的事件（新在前）；`after` = 上次看到的毫秒时间。调用方按 id 去重。 */
  since(after: number, count = 40, viewerIds?: readonly string[]): EchoEvent[] {
    const n = Math.max(1, Math.min(200, Math.floor(count)));
    return this.visibleEvents(viewerIds).filter(event => event.at >= after).sort((a, b) => b.at - a.at).slice(0, n);
  }

  /** 按指定账号视野（人 + 绑定机）读取可见回音树事件（含私人礼笺）。 */
  forAccounts(accountIds: readonly string[], query: { afterId?: string | null; since?: number; limit?: number; includePublic?: boolean } = {}): EchoPage | EchoEvent[] {
    const limit = query.limit ?? 20;
    const includePublic = query.includePublic ?? true;
    const list = this.visibleEvents(accountIds, includePublic);
    if (query.afterId !== undefined) {
      const n = Math.max(1, Math.min(200, Math.floor(limit)));
      const index = query.afterId === null ? -1 : list.findIndex(event => event.id === query.afterId);
      const cursorReset = query.afterId !== null && index < 0;
      const start = index < 0 ? 0 : index + 1;
      const events = list.slice(start, start + n);
      return {
        events,
        nextId: events.at(-1)?.id ?? (cursorReset ? (list.at(-1)?.id ?? null) : query.afterId),
        hasMore: start + events.length < list.length,
        ...(cursorReset ? { cursorReset: true } : {}),
      };
    }
    const n = Math.max(1, Math.min(200, Math.floor(limit)));
    return query.since === undefined
      ? [...list].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, n)
      : list.filter(event => event.at >= query.since!).sort((a, b) => b.at - a.at).slice(0, n);
  }

  size() { return this.events.length; }

  private persist(events: EchoEvent[], publishedIds: Set<string>) {
    const file = join(this.directory, 'echo-tree.json');
    const data: EchoFile = { version: 1, events, publishedIds: [...publishedIds] };
    writeFileSync(`${file}.pending`, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${file}.pending`, file);
  }
}
