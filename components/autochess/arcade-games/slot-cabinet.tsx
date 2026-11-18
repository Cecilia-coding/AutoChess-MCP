'use client';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { ArcadeGameMeta, ArcadeLastRound } from '@/lib/meta/arcade';
import {
  playArcadeOutcome,
  playSlotLeverPull,
  playSlotReelLock,
  playSlotTick,
  unlockArcadeAudio,
} from '@/lib/meta/arcade-sfx';
import { SLOT_SYMBOLS, type SlotSpinDetail, type SlotSymbolId } from '@/lib/meta/arcade-games/slot-machine';

const IDLE_REELS: [SlotSymbolId, SlotSymbolId, SlotSymbolId] = ['seven', 'clover', 'seven'];
const SYMBOL_MAP = Object.fromEntries(SLOT_SYMBOLS.map(s => [s.id, s])) as Record<SlotSymbolId, (typeof SLOT_SYMBOLS)[number]>;
const CYCLE: SlotSymbolId[] = SLOT_SYMBOLS.map(s => s.id);
const SUSPENSE_SYMBOLS = new Set<SlotSymbolId>(['seven', 'star', 'clover']);

export default function SlotCabinet({
  game,
  lastRound,
  spinning,
  focused,
  isFreshRound,
  canPullSpin,
  onPullSpin,
  consoleDeck,
}: {
  game: ArcadeGameMeta;
  lastRound: ArcadeLastRound | null;
  spinning: boolean;
  focused?: boolean;
  isFreshRound?: boolean;
  canPullSpin?: boolean;
  onPullSpin?: () => void;
  consoleDeck?: ReactNode;
}) {
  const detail = (lastRound?.gameId === 'slot-machine' ? lastRound.detail : undefined) as SlotSpinDetail | undefined;
  const targetReels = detail?.reels ?? IDLE_REELS;
  const roundId = lastRound?.gameId === 'slot-machine' ? lastRound.roundId : '';

  const [lockedCount, setLockedCount] = useState(3);
  const [tick, setTick] = useState(0);
  const [leverPull, setLeverPull] = useState(0);
  const [suspenseActive, setSuspenseActive] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const animatedRoundRef = useRef('');
  const dragStartYRef = useRef<number | null>(null);
  const pulledThisDragRef = useRef(false);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!spinning && !roundId) {
      setLockedCount(3);
      setSuspenseActive(false);
      return;
    }
    if (reduced) {
      setLockedCount(spinning ? 0 : 3);
      setSuspenseActive(false);
      return;
    }
    if (spinning) {
      setLockedCount(0);
      setSuspenseActive(false);
      const iv = setInterval(() => {
        setTick(n => (n + 1) % CYCLE.length);
        playSlotTick(false);
      }, 65);
      return () => clearInterval(iv);
    }

    if (roundId && isFreshRound && animatedRoundRef.current !== roundId) {
      animatedRoundRef.current = roundId;
      const tease = targetReels[0] === targetReels[1] && SUSPENSE_SYMBOLS.has(targetReels[0]);
      setLockedCount(0);
      setSuspenseActive(false);

      let localSuspense = false;
      const iv = setInterval(() => {
        setTick(n => (n + 1) % CYCLE.length);
        playSlotTick(localSuspense);
      }, 60);

      const t1 = setTimeout(() => {
        setLockedCount(1);
        playSlotReelLock(0, false);
      }, 95);
      const t2 = setTimeout(() => {
        setLockedCount(2);
        localSuspense = tease;
        setSuspenseActive(tease);
        playSlotReelLock(1, tease);
      }, 270);
      const t3 = setTimeout(
        () => {
          clearInterval(iv);
          setLockedCount(3);
          setSuspenseActive(false);
          playSlotReelLock(2, false);
          playArcadeOutcome(Boolean(lastRound?.won), lastRound?.tier === 'jackpot' || lastRound?.tier === 'mega');
        },
        tease ? 780 : 470,
      );

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearInterval(iv);
      };
    }

    setLockedCount(3);
    setSuspenseActive(false);
  }, [spinning, roundId, isFreshRound, targetReels, lastRound?.won, lastRound?.tier]);

  const fireLever = () => {
    if (!canPullSpin || spinning) return;
    unlockArcadeAudio();
    playSlotLeverPull();
    setLeverPull(1);
    setTimeout(() => setLeverPull(0), 210);
    onPullSpin?.();
  };

  const handleLeverPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canPullSpin || spinning) return;
    unlockArcadeAudio();
    dragStartYRef.current = e.clientY;
    pulledThisDragRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleLeverPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStartYRef.current === null || pulledThisDragRef.current) return;
    const dy = Math.max(0, e.clientY - dragStartYRef.current);
    const pct = Math.min(1, dy / 52);
    setLeverPull(pct);
    if (pct >= 0.65) {
      pulledThisDragRef.current = true;
      dragStartYRef.current = null;
      fireLever();
    }
  };

  const handleLeverPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragStartYRef.current = null;
    if (!pulledThisDragRef.current) setLeverPull(0);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleLeverClick = () => {
    if (pulledThisDragRef.current) {
      pulledThisDragRef.current = false;
      return;
    }
    fireLever();
  };

  const settling = !spinning && lockedCount < 3;
  const tierClass = !lastRound || lastRound.gameId !== 'slot-machine' || settling
    ? 'is-idle'
    : lastRound.tier === 'jackpot' || lastRound.tier === 'mega'
      ? 'is-jackpot'
      : lastRound.won
        ? 'is-win'
        : 'is-bust';

  return (
    <section
      className={`arcade-cabinet arcade-cabinet--slot ${tierClass} ${focused ? 'is-focused' : ''}`}
      aria-label={game.name}
    >
      <div className="arcade-cabinet-marquee">
        <span className="arcade-marquee-badge">{game.badge}</span>
        <strong>{game.name}</strong>
        <small>{game.subtitle}</small>
        <button
          type="button"
          className="arcade-info-toggle"
          aria-expanded={rulesOpen}
          onClick={() => setRulesOpen(v => !v)}
          title="查看赔率表"
        >
          {rulesOpen ? '收起' : '? 赔率'}
        </button>
      </div>

      {rulesOpen ? (
        <div className="arcade-paytable-popover">
          <table>
            <thead>
              <tr><th>组合</th><th>奖励</th><th>说明</th></tr>
            </thead>
            <tbody>
              {game.paytable.map(row => (
                <tr key={row.combo}><td>{row.combo}</td><td>{row.payout}</td><td>{row.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="arcade-slot-stage">
        <div className="arcade-slot-reels" role="status" aria-live="polite" aria-label="老虎机滚轴结果">
          {targetReels.map((symbolId, idx) => {
            const isSpinningReel = spinning || idx >= lockedCount;
            const shownId = isSpinningReel ? CYCLE[(tick + idx * 2) % CYCLE.length]! : symbolId;
            const spec = SYMBOL_MAP[shownId] ?? SYMBOL_MAP.coin;
            const danger = !isSpinningReel && (shownId === 'bomb' || shownId === 'skull');
            const highlight = !isSpinningReel && !settling && lastRound?.gameId === 'slot-machine' && lastRound.won && !danger;
            const justLocked = !spinning && idx < lockedCount && lockedCount < 3;
            const suspense = suspenseActive && idx === 2 && isSpinningReel;
            return (
              <div
                key={idx}
                className={`arcade-reel ${isSpinningReel ? 'is-spinning' : 'is-locked'} ${justLocked ? 'is-landed' : ''} ${suspense ? 'is-suspense' : ''} ${danger ? 'is-danger' : ''} ${highlight ? 'is-highlight' : ''}`}
              >
                <span className="arcade-reel-glyph" aria-hidden="true">{spec.glyph}</span>
                <span className="arcade-reel-name">
                  {suspense ? '冲刺锁轴!' : isSpinningReel ? '转动中…' : spec.name}
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={`arcade-slot-lever ${leverPull > 0.25 ? 'is-pulled' : ''} ${!canPullSpin || spinning ? 'is-disabled' : ''}`}
          disabled={!canPullSpin || spinning}
          title={canPullSpin ? '点击或向下拖拽拉杆开转' : '当前不可拉杆'}
          aria-label="拉下老虎机拉杆开转"
          onPointerDown={handleLeverPointerDown}
          onPointerMove={handleLeverPointerMove}
          onPointerUp={handleLeverPointerUp}
          onClick={handleLeverClick}
          onPointerCancel={() => {
            dragStartYRef.current = null;
            setLeverPull(0);
          }}
        >
          <span className="arcade-lever-track">
            <span
              className="arcade-lever-knob"
              style={{ transform: `translateY(${Math.round(leverPull * 54)}px)` }}
            />
          </span>
          <small className="arcade-lever-label">{spinning ? '转' : '拉杆'}</small>
        </button>
      </div>

      <div className={`arcade-outcome-strip ${tierClass}`}>
        {spinning || settling ? (
          <span>{suspenseActive ? '前两格已对齐！第三轴高能悬念中…' : '滚轴疾转中，祈祷别见炸弹与骷髅…'}</span>
        ) : lastRound?.gameId === 'slot-machine' ? (
          <>
            <strong>{detail?.hitLine ?? '本轮结算'}</strong>
            <span>{lastRound.outcomeLabel}</span>
          </>
        ) : (
          <span>下拉右侧拉杆或点下方绿色按钮即可开转！</span>
        )}
      </div>

      {consoleDeck}
    </section>
  );
}
