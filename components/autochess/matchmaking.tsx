'use client';
import { useEffect, useRef, useState } from 'react';
import { MATCH_TABLES, MATCH_POLL_MS, type MatchResult, type MatchTable } from '@/lib/meta/matchmaking';
import { accountRequest } from './room-request';
import { MATCH_REWARD_PREVIEW, MATCHMAKING_REWARD } from '@/lib/meta/economy';
import './matchmaking.css';

export default function Matchmaking({ token, pack, onEnter }: {
  token: string; pack: string; onEnter?: (roomId: string, token: string) => void;
}) {
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [tables, setTables] = useState<MatchTable[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true), mutation = useRef(false), sequence = useRef(0);
  useEffect(() => {
    alive.current = true;
    if (!token) return () => { alive.current = false; };
    let inFlight = false, disposed = false;
    const poll = async () => {
      if (inFlight || mutation.current || document.hidden) return;
      inFlight = true;
      const current = ++sequence.current;
      try {
        const result = await accountRequest<{ match: MatchResult | null; tables: MatchTable[] }>('match-poll', { token, pack });
        if (disposed || !alive.current || current !== sequence.current) return;
        setMatch(result.match); setTables(result.tables); setError('');
      } catch (e) { if (!disposed && alive.current && current === sequence.current) setError((e as Error).message); }
      finally { inFlight = false; }
    };
    void poll();
    const timer = setInterval(() => void poll(), MATCH_POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const foreground = () => { if (!document.hidden) void poll(); };
    document.addEventListener('visibilitychange', foreground);
    return () => { disposed = true; alive.current = false; clearInterval(timer); clearInterval(clock); document.removeEventListener('visibilitychange', foreground); };
  }, [token, pack]);
  async function change(seats?: number) {
    if (mutation.current) return;
    mutation.current = true; sequence.current++; setPending(true); setError('');
    try {
      const result = await accountRequest<{ match?: MatchResult; tables?: MatchTable[] }>(seats ? 'match' : 'unmatch', { token, pack, ...(seats ? { seatSize: seats } : {}) });
      if (!alive.current) return;
      const next = result.match ?? null;
      setMatch(next);
      if (result.tables) setTables(result.tables);
    } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { mutation.current = false; if (alive.current) setPending(false); }
  }
  return <section className="match-hall" aria-label="匹配棋局">
    <div className="match-heading"><div><h3>下一位棋友，会是谁？</h3><p>人和机，都在这里相遇。满员即开局。</p></div><span className="match-reward">胜方收益 ×{MATCHMAKING_REWARD.winMultiplier}</span></div>
    <div className="match-tables">{MATCH_TABLES.map(table => {
      const own = match?.status === 'queued' && match.seatSize === table.seats;
      const census = tables.find(item => item.seatSize === table.seats);
      const filled = own ? match.filled : census?.filled;
      return <article key={table.mode} className={`match-table ${own ? 'is-queued' : ''}`}>
        <div className="match-table-title"><div><h4>{table.name}</h4><p>{table.subtitle}</p></div><strong>{filled ?? '—'}<small> / {table.seats}</small></strong></div>
        <div className="match-seats" aria-label={`已到 ${filled ?? 0} 位，共 ${table.seats} 席`}>{Array.from({length:table.seats},(_,i)=><span key={i} className={i < (filled ?? 0) ? 'is-filled' : ''} aria-hidden="true">{i < (filled ?? 0) ? '♟' : '＋'}</span>)}</div>
        <p className="match-count">{own ? `还差 ${match.remaining} 位 · 已等待 ${Math.max(0,Math.floor((now-match.enqueuedAt)/1000))} 秒` : census ? `队列中 ${census.humans} 人 · ${census.machines} 机` : '登录后查看实时席位'}</p>
        <button type="button" className={own ? '' : 'lobby-primary'} disabled={!token || !pack || pending || (!!match && !own)} onClick={() => void change(own ? undefined : table.seats)}>{pending ? '正在确认…' : own ? '退出匹配' : '加入匹配'}</button>
      </article>;
    })}</div>
    <p className="match-footnote">当前所选棋谱独立匹配 · 取消排队免费 · 离线超过 2 分钟释放排队席位</p>
    <p className="match-footnote">机的 1v1：胜 +{MATCH_REWARD_PREVIEW.machineDuelWin} / 负 {MATCH_REWARD_PREVIEW.machineDuelLoss} bot；八人按名次结算，负方最多扣 {Math.abs(MATCH_REWARD_PREVIEW.machineDuelLoss)}。人按铜钱结算。</p>
    {match?.status === 'queued' && match.pack !== pack ? <output>你仍在另一套棋谱的队列中。退出后可以换谱。</output> : null}
    {match?.status === 'matched' ? <div className="match-found"><output>✦ 棋友已到齐，轮到你入场了</output><button className="lobby-primary" onClick={() => onEnter?.(match.roomId,match.token)}>进入棋局</button></div> : null}
    {error ? <p className="match-error" role="alert">{error} · 可以重试，排队状态以服务端为准。</p> : null}
    {!token ? <p className="match-footnote">先去「我的」登录，再来挑一桌。</p> : null}
  </section>;
}
