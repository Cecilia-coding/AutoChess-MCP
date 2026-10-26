import { useMemo, useState } from 'react';
import { battleStatsAt, indexBattleStats } from '@/lib/autochess/battle-stats';
import type { BattleOutput, TeamId } from '@/lib/autochess/types';
import './battle-stats.css';

type Props = { output?: BattleOutput; timeMs: number; running: boolean; round?: number; opponent?: string };
export default function BattleStats({ output, timeMs, running, round, opponent }: Props) {
  const [team, setTeam] = useState<TeamId>('left');
  const index = useMemo(() => output ? indexBattleStats(output) : [], [output]);
  const tick = Math.floor(timeMs / 100) * 100;
  const rows = useMemo(() => battleStatsAt(index, tick, !running), [index, tick, running]);
  if (!output) return <p className="battle-stats-empty">开战后，这里会记录每枚棋子的输出与承伤。</p>;
  const shown = rows.filter(row => row.team === team);
  const dealtMax = Math.max(1, ...shown.map(row => row.dealt));
  const takenMax = Math.max(1, ...shown.map(row => row.taken));
  const total = shown.reduce((sum, row) => ({ dealt: sum.dealt + row.dealt, taken: sum.taken + row.taken }), { dealt: 0, taken: 0 });
  return <section className="battle-stats" aria-label="本轮战况">
    <header><b>第 {round} 轮</b><span>{running ? '交战中' : '已结算'} · {(Math.min(timeMs, output.durationMs) / 1000).toFixed(1)}s</span></header>
    <div className="battle-stats-teams" aria-label="战况阵营">
      <button type="button" aria-pressed={team === 'left'} onClick={() => setTeam('left')}>己方</button>
      <button type="button" aria-pressed={team === 'right'} onClick={() => setTeam('right')}>对方</button>
    </div>
    <p className="battle-stats-opponent">对手 · {opponent ?? '棋友'}</p>
    <div className="battle-stats-total"><span>总输出 <b>{total.dealt.toLocaleString()}</b></span><span>总承伤 <b>{total.taken.toLocaleString()}</b></span></div>
    <div className="battle-stats-labels"><span>输出</span><span>承伤</span></div>
    <ol>{shown.map((row, i) => <li key={row.id}>
      <div className="battle-stats-name"><span>{String(i + 1).padStart(2, '0')}</span><b title={row.name}>{row.name}</b></div>
      <div className="battle-stats-values">
        <span className="is-dealt" aria-label={`输出 ${row.dealt}`}><i style={{ width: `${row.dealt / dealtMax * 100}%` }} /><b>{row.dealt.toLocaleString()}</b></span>
        <span className="is-taken" aria-label={`承伤 ${row.taken}`}><i style={{ width: `${row.taken / takenMax * 100}%` }} /><b>{row.taken.toLocaleString()}</b></span>
      </div>
    </li>)}</ol>
    {!shown.length ? <p>尚未有棋子登场</p> : null}
    <small className="battle-stats-note">实际气血伤害 · 含加时承伤</small>
  </section>;
}
