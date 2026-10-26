'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { echoIconOf, echoStyleOf, formatEchoLine, formatEchoTime, type EchoEvent } from '@/lib/meta/echo-tree';
import { EchoLiveQueue, ECHO_LIVE_MAX_AGE_MS, ECHO_LIVE_POLL_MS } from '@/lib/meta/echo-live';
import { metaRequest } from './room-request';
import './echo-tree.css';

/** 回音树面板：树上的一张张礼笺，点开看附言。样式令牌由 lib/meta/echo-tree.ts 驱动。 */
export function EchoTreePanel({ events, empty }: { events: EchoEvent[]; empty?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <section className="echo-tree" aria-label="回音树">
    <div className="echo-tree-heading">
      <span className="echo-tree-mark" aria-hidden="true">✦</span>
      <div>
        <h3>回音树</h3>
        <p>送礼成功会在这里留一张礼笺，全站都看得见。</p>
      </div>
    </div>
    {events.length ? <ol className="echo-tree-list">
      {events.map(event => {
        const open = openId === event.id;
        return <li key={event.id} className={`echo-leaf echo-${echoStyleOf(event)}`}>
          <button type="button" className="echo-leaf-line" aria-expanded={open} onClick={() => setOpenId(open ? null : event.id)}>
            <span className="echo-leaf-icon" aria-hidden="true">{echoIconOf(event.kind)}</span>
            <span className="echo-leaf-text">{formatEchoLine(event)}</span>
            <time dateTime={new Date(event.at).toISOString()} title="按你的设备当地时间显示">{formatEchoTime(event.at)}</time>
          </button>
          {open ? <div className="echo-note" role="note">
            <div className="echo-note-title">{event.from.name} → {event.to.name}</div>
            <div className="echo-note-body">「{event.item.name}」{event.note ? <>：<em>{event.note}</em></> : null}</div>
          </div> : null}
        </li>;
      })}
    </ol> : <p className="echo-tree-empty">{empty ?? '还没有写下第一张礼笺。'}</p>}
  </section>;
}

/**
 * 全站飘条：轮询回音树新消息，逐条飘过（弹幕式广播）。
 * 只播「打开页面之后」的新事件——旧礼物不补播一屏。
 * 样式令牌见 lib/meta/echo-tree.ts；换色改 echo-tree.css。
 */
export function EchoBanner({ pollMs = ECHO_LIVE_POLL_MS, visibleMs = 9000 }: { pollMs?: number; visibleMs?: number }) {
  const [current, setCurrent] = useState<EchoEvent | null>(null);

  useEffect(() => {
    let active = true;
    let polling = false;
    let initialized = false;
    let cursor: string | null = null;
    let generation = 0;
    let lastPoll = 0;
    let showing = false;
    let displayTimer: ReturnType<typeof setTimeout> | undefined;
    const queue = new EchoLiveQueue();
    const reset = () => {
      generation++;
      initialized = false;
      cursor = null;
      queue.reset();
      showing = false;
      clearTimeout(displayTimer);
      setCurrent(null);
    };
    const drain = () => {
      if (!active || document.hidden || showing) return;
      const next = queue.take();
      if (!next) return;
      showing = true;
      setCurrent(next);
      displayTimer = setTimeout(() => {
        if (!active) return;
        showing = false;
        setCurrent(null);
        drain();
      }, visibleMs);
    };
    const poll = async () => {
      if (document.hidden || polling) return;
      if (initialized && Date.now() - lastPoll >= ECHO_LIVE_MAX_AGE_MS) reset();
      const requestGeneration = generation;
      const valid = () => active && !document.hidden && requestGeneration === generation;
      polling = true;
      try {
        if (!initialized) {
          // Start at the current tail so opening a page does not replay old gifts.
          const initial = await metaRequest<{ latestId: string | null; serverNow: number }>('echo', { limit: 1 });
          if (!valid()) return;
          cursor = initial.latestId ?? null;
          queue.reset(initial.serverNow);
          initialized = true;
          lastPoll = Date.now();
          return;
        }
        let hasMore: boolean;
        do {
          const page = await metaRequest<{ events: EchoEvent[]; nextId: string | null; hasMore: boolean; serverNow: number }>('echo', { afterId: cursor, limit: 50 });
          if (!valid()) return;
          cursor = page.nextId;
          queue.push(page.events ?? [], Date.now(), page.serverNow);
          drain();
          hasMore = page.hasMore;
        } while (hasMore);
        lastPoll = Date.now();
      } catch { if (valid()) reset(); /* 断线期间的广播不补播。 */ }
      finally { polling = false; }
    };
    const visibility = () => { reset(); if (!document.hidden) void poll(); };
    const disconnected = () => reset();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', disconnected);
    window.addEventListener('pageshow', visibility);
    window.addEventListener('offline', disconnected);
    window.addEventListener('online', visibility);
    void poll();
    const timer = setInterval(() => { void poll(); }, pollMs);
    return () => {
      active = false;
      clearInterval(timer);
      clearTimeout(displayTimer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', disconnected);
      window.removeEventListener('pageshow', visibility);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('online', visibility);
    };
  }, [pollMs, visibleMs]);

  if (!current) return null;
  return createPortal(<output className={`echo-banner echo-${echoStyleOf(current)}`} aria-live="polite">
    <span className="echo-banner-icon" aria-hidden="true">{echoIconOf(current.kind)}</span>
    <span className="echo-banner-text">{formatEchoLine(current)}</span>
    {current.note ? <span className="echo-banner-note">“{current.note}”</span> : null}
  </output>, document.querySelector('dialog[open]') ?? document.body);
}
