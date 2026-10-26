'use client';
import { useEffect, useRef, useState } from 'react';
import type { RoomSelf } from '@/lib/autochess/room-types';
import { CURRENCY } from '@/lib/meta/economy';

export default function RoomResult({ result, finished, show, onReturn }: {
  result: NonNullable<RoomSelf['result']>; finished: boolean; show: boolean; onReturn: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (show && !dismissed && !element.open) element.showModal();
    else if ((!show || dismissed) && element.open) element.close();
    return () => { if (element.open) element.close(); };
  }, [show, dismissed]);
  const reward = result.payment === 'pending' ? '奖励正在到账…' : result.reward
    ? `${result.reward.delta >= 0 ? '+' : ''}${result.reward.delta} ${CURRENCY[result.reward.currency].name}${result.reward.reason === 'short' ? ' · 本局未达奖励轮数' : result.reward.reason === 'cap' ? ' · 今日奖励已领完' : result.reward.reason === 'legacy' ? ' · 已结算' : ''}`
    : '本局为游客对局';
  return <>
    {show && dismissed ? <button className="room-result-reopen" onClick={() => setDismissed(false)}>查看本局结算</button> : null}
    <dialog ref={dialog} className="room-result-dialog" aria-labelledby="room-result-title" onCancel={() => setDismissed(true)}>
      <section className={`room-result room-result-${result.outcome}`}>
        <span>✦ 本局结算 · 第 {result.place} 名 / {result.participants} 人</span>
        <h2 id="room-result-title">{result.outcome === 'win' ? '本局获胜' : result.outcome === 'draw' ? '此局平分秋色' : '本局落败'}</h2>
        <p>{reward}</p>
        <small>{finished ? '全场结束' : '你的对局已结束，可以留下看他们打完。'}</small>
        <div className="room-result-actions">
          <button onClick={() => setDismissed(true)}>{finished ? '看看棋盘' : '继续观战'}</button>
          <button onClick={onReturn}>返回大厅</button>
        </div>
      </section>
    </dialog>
  </>;
}
