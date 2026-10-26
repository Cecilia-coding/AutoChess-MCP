'use client';
import { useEffect, useRef, useState } from 'react';
import type { DanmakuMessage } from '@/lib/autochess/room-types';
import { DanmakuQueue, DANMAKU_PASS_MS, DANMAKU_PASSES, type FlyingMessage } from '@/lib/autochess/danmaku-queue';

export default function DanmakuStream({ messages, playbackRound, covered }: {
  messages: DanmakuMessage[]; playbackRound?: number; covered: boolean;
}) {
  const queue = useRef(new DanmakuQueue());
  const [frame, setFrame] = useState<{ active: FlyingMessage[]; now: number }>({ active: [], now: 0 });
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const eligible = messages.filter(entry => playbackRound === undefined ||
        ((!entry.prepareRound || entry.prepareRound <= playbackRound) && (!entry.battleRound || entry.battleRound < playbackRound)));
      const active = queue.current.tick(eligible, now, covered);
      setFrame(previous => previous.active === active ? previous : { active, now });
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 250);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [messages, playbackRound, covered]);
  return frame.active.map(entry => <Flying key={entry.message.id} entry={entry} />);
}

function Flying({ entry: { message, lane, start } }: { entry: FlyingMessage }) {
  // 固定挂载时的延迟；其他轨道更新时不改变这条动画的播放进度。
  const [delay] = useState(() => start - Date.now());
  return <span className={`danmaku dm-${message.style}`} style={{ top: lane * 28,
    animationDuration: `${DANMAKU_PASS_MS}ms`, animationIterationCount: DANMAKU_PASSES,
    animationDelay: `${delay}ms` }}>
    {message.name}{message.prepareRound ? `〔第${message.prepareRound}轮备战〕` : message.battleRound ? `〔第${message.battleRound}轮战后〕` : ''}：{message.text}
  </span>;
}
