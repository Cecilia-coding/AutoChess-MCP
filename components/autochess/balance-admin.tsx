'use client';
import { useCallback, useEffect, useState } from 'react';
import { MODE_PACKS } from '@/packs/modes/registry';
import type { PackSummary } from '@/packs/registry';
import { roomRequest } from './room-request';
import { playerMcpUrl } from '@/lib/autochess/invite-copy';

type Row = { templateId: string; name: string; cost: number; games: number; pickRate: number; wins: number; draws: number; winRate: number;
  baselineRate: number | null; deltaPts: number | null; avgDamage: number; avgTaken: number; avgHealing: number; avgStar: number;
  signal: string };
type Report = { startedAt: number; retainedFrom: number; windowDays: number; fights: number; rows: Row[]; totalUnits?: number; observedUnits: number; sampleCounts: {live: number; lab: number}; lastBattleAt: number | null };
type LabRoom = { roomId: string; watchToken: string; left: { roomId: string; token: string }; right: { roomId: string; token: string } };

export default function BalanceAdmin({ token, packs, mcpUrl }: { token: string; packs: PackSummary[]; mcpUrl: string }) {
  const [pack, setPack] = useState('ai');
  const [mode, setMode] = useState('all');
  const [star, setStar] = useState(0);
  const [source, setSource] = useState<'all' | 'live' | 'lab'>('all');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [labRoom, setLabRoom] = useState<LabRoom | null>(null);
  const [labBusy, setLabBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const result = await roomRequest<Report>('balance_report', { token, pack, mode: mode === 'all' ? undefined : mode, star, source });
      setReport(result); setError('');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }, [token, pack, mode, star, source]);
  useEffect(() => { void Promise.resolve().then(refresh);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);
  const openLab = async () => {
    setLabBusy(true);
    try { setLabRoom(await roomRequest<LabRoom>('create_lab', { token, pack })); setSource('lab'); setMode('duel'); setError(''); }
    catch (cause) { setError((cause as Error).message); }
    finally { setLabBusy(false); }
  };
  const copySeat = async (seat: 'left' | 'right') => {
    if (!labRoom) return;
    const credentials = labRoom[seat];
    try { await navigator.clipboard.writeText(`来下一盘测试棋 ^ ^\n这间房已经给你留好了席位，直接下棋；不要开新房，也不要调用 join_room。\nMCP：${playerMcpUrl(mcpUrl)}\n先用 read_turn 读取这一席：roomId=${credentials.roomId}，token=${credentials.token}。随后跟着 nextAction 用 act 落子；打完每回合读战报再调整阵容。只使用棋室 MCP，不修改文件。`); }
    catch { setError('复制失败，稍后再试。'); }
  };
  const date = report ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(report.retainedFrom) : '';
  return <section className="lobby-pack-admin balance-admin" aria-labelledby="balance-admin-title">
    <h3 id="balance-admin-title">棋子强度观察</h3>
    <p className="lobby-hint">每轮战斗自动入账 · 每 30 秒更新 · 可切换实战与测试对掏。</p>
    <div className="balance-admin-filters">
      <label>样本<select value={source} onChange={event => setSource(event.target.value as 'all' | 'live' | 'lab')}><option value="all">全部样本</option><option value="live">实战</option><option value="lab">测试对掏</option></select></label>
      <label>棋谱<select value={pack} onChange={event => setPack(event.target.value)}>{packs.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label>模式<select value={mode} onChange={event => setMode(event.target.value)}><option value="all">全部模式</option>{Object.values(MODE_PACKS).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label>星级<select value={star} onChange={event => setStar(Number(event.target.value))}><option value={0}>全部星级</option><option value={1}>一星</option><option value={2}>二星</option><option value={3}>三星</option></select></label>
      <button type="button" onClick={() => void refresh()} disabled={busy}>{busy ? '统计中…' : '刷新'}</button>
    </div>
    <div className="balance-admin-lab">
      <button type="button" onClick={() => void openLab()} disabled={labBusy}>{labBusy ? '开局中…' : '开一间测试对掏'}</button>
      {labRoom ? <><span>测试房 {labRoom.roomId} · 两席已分给棋手，你在观战席</span><button type="button" onClick={() => void copySeat('left')}>复制给棋手甲</button><button type="button" onClick={() => void copySeat('right')}>复制给棋手乙</button><a href={`/autochess/room?room=${encodeURIComponent(labRoom.roomId)}#watch=${encodeURIComponent(labRoom.watchToken)}`} target="_blank" rel="noopener noreferrer">打开观战</a></> : null}
    </div>
    {error ? <p role="alert" className="lobby-hint">{error}</p> : null}
    {report ? <>
      <p className="balance-admin-summary">近 {report.windowDays} 天 · 当前 {report.fights} 场交手 · 本棋谱实战 {report.sampleCounts.live} / 测试 {report.sampleCounts.lab} · 已见 {report.observedUnits}/{report.totalUnits??report.observedUnits} 枚棋子 · 最早样本 {date}</p>
      {report.rows.length ? <div className="balance-admin-scroll"><table className="balance-admin-table" aria-label="棋子强度统计">
        <thead><tr className="balance-admin-head"><th>棋子</th><th>入阵 / 出场率</th><th>交手胜率</th><th>同费同期</th><th>场均输出 / 承伤 / 治疗</th></tr></thead>
        <tbody>{report.rows.map(row => <tr className="balance-admin-row" key={row.templateId}>
          <td className="balance-admin-unit"><b>{row.name}</b><small>{row.cost} 费 · 平均 {row.avgStar} 星</small></td>
          <td>{row.games} 场<small>{row.pickRate.toFixed(1)}%</small></td><td>{row.winRate.toFixed(1)}%</td>
          <td className={row.signal === '偏强待看' ? 'is-strong' : row.signal === '偏弱待看' ? 'is-weak' : ''}>{row.deltaPts === null ? '—' : `${row.deltaPts > 0 ? '+' : ''}${row.deltaPts.toFixed(1)} 点`}<small>{row.signal}</small></td>
          <td>{row.avgDamage.toLocaleString()} / {row.avgTaken.toLocaleString()} / {row.avgHealing.toLocaleString()}</td>
        </tr>)}</tbody></table></div> : <p className="lobby-hint">这组筛选暂无交手。切到“全部样本 / 全部模式”看看，或让棋手完成第一轮。</p>}
      <p className="lobby-hint">交手胜率看单轮输赢；出场率看这枚棋子在多少支队伍上过场。同费同期按费用、阶段和星级比较，20 场起标记强弱候选。</p>
    </> : busy ? <p className="lobby-hint">正在翻战报…</p> : null}
  </section>;
}
