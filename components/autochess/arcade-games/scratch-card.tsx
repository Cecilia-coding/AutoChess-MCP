'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { ArcadeGameMeta, ArcadeLastRound } from '@/lib/meta/arcade';
import {
  playArcadeOutcome,
  playScratchCellReveal,
  playScratchGrain,
  playScratchSweep,
  playScratchTap,
  stopScratchGrain,
  unlockArcadeAudio,
} from '@/lib/meta/arcade-sfx';
import { SCRATCH_SYMBOLS, type ScratchCardDetail, type ScratchSymbolId } from '@/lib/meta/arcade-games/scratchcard';

const SYMBOL_MAP = Object.fromEntries(SCRATCH_SYMBOLS.map(s => [s.id, s])) as Record<ScratchSymbolId, (typeof SCRATCH_SYMBOLS)[number]>;

type FlakeParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
};

function symbolSpec(symbol: ScratchSymbolId | 'double') {
  if (symbol === 'double') return { glyph: '×2', name: '金字倍签' };
  return SYMBOL_MAP[symbol] ?? { glyph: '🪙', name: '通宝' };
}

/** 在涂膜画布上绘制带有颗粒质感、斜纹光泽与虚线格标的银膜图层。 */
function paintSilverFoil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#cfd7e6');
  grad.addColorStop(0.35, '#dfe5f0');
  grad.addColorStop(0.7, '#bbc5d8');
  grad.addColorStop(1, '#d3dbe9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 像素斜纹高光带
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  for (let x = -h; x < w + h; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 6, 0);
    ctx.lineTo(x - h + 6, h);
    ctx.lineTo(x - h, h);
    ctx.closePath();
    ctx.fill();
  }

  // 随机颗粒纹理，还原银粉涂层的粗粝砂感
  for (let i = 0; i < Math.floor((w * h) / 26); i++) {
    const px = Math.floor(Math.random() * (w / 2)) * 2;
    const py = Math.floor(Math.random() * (h / 2)) * 2;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.36)' : 'rgba(92, 104, 134, 0.2)';
    ctx.fillRect(px, py, 2, 2);
  }

  // 九宫分割虚线与格标提示
  ctx.strokeStyle = 'rgba(95, 108, 138, 0.38)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  for (let col = 1; col <= 2; col++) {
    const x = Math.round((w * col) / 3) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, h - 4);
    ctx.stroke();
  }
  for (let row = 1; row <= 2; row++) {
    const y = Math.round((h * row) / 3) + 0.5;
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(w - 4, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(72, 82, 112, 0.58)';
  ctx.font = `700 ${Math.max(9, Math.round(h / 18))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillText('✦ 划开银膜', ((c + 0.5) * w) / 3, ((r + 0.5) * h) / 3);
    }
  }
}

/** 带有像素毛刺边缘的擦除笔触，模拟硬币/手指滑动划破银膜。 */
function stampEraser(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  const r = Math.max(8, radius);
  ctx.fillRect(Math.round(x - r * 0.85), Math.round(y - r * 0.55), Math.round(r * 1.7), Math.round(r * 1.1));
  ctx.fillRect(Math.round(x - r * 0.55), Math.round(y - r * 0.85), Math.round(r * 1.1), Math.round(r * 1.7));
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.9;
    const dist = r * (0.7 + Math.random() * 0.45);
    const sx = Math.round(x + Math.cos(angle) * dist);
    const sy = Math.round(y + Math.sin(angle) * dist);
    ctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
  ctx.restore();
}

export default function ScratchCard({
  game,
  lastRound,
  spinning,
  focused,
  shouldMask,
  onRevealComplete,
  consoleDeck,
}: {
  game: ArcadeGameMeta;
  lastRound: ArcadeLastRound | null;
  spinning: boolean;
  focused?: boolean;
  shouldMask?: boolean;
  onRevealComplete?: () => void;
  consoleDeck?: ReactNode;
}) {
  const detail = (lastRound?.gameId === 'scratchcard' ? lastRound.detail : undefined) as ScratchCardDetail | undefined;
  const roundId = lastRound?.gameId === 'scratchcard' ? lastRound.roundId : '';
  const [scratched, setScratched] = useState<boolean[]>(() => Array(9).fill(false));
  const [scratching, setScratching] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const foilRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);

  const pointerActiveRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number; cssX: number; cssY: number } | null>(null);
  const moveDistRef = useRef(0);
  const lastEvalMsRef = useRef(0);
  const revealedRef = useRef<boolean[]>(Array(9).fill(false));
  const completedRef = useRef('');
  const sweepRafRef = useRef<number>(0);
  const particleRafRef = useRef<number>(0);
  const particlesRef = useRef<FlakeParticle[]>([]);

  const detailRef = useRef(detail);
  detailRef.current = detail;
  const roundRef = useRef(lastRound);
  roundRef.current = lastRound;
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;
  const onRevealCompleteRef = useRef(onRevealComplete);
  onRevealCompleteRef.current = onRevealComplete;

  const stopAnimations = useCallback(() => {
    if (sweepRafRef.current) cancelAnimationFrame(sweepRafRef.current);
    sweepRafRef.current = 0;
  }, []);

  const runParticleLoop = useCallback(() => {
    if (particleRafRef.current) return;
    const tick = () => {
      const fx = fxRef.current;
      const list = particlesRef.current;
      if (!fx || list.length === 0) {
        if (fx) fx.getContext('2d')?.clearRect(0, 0, fx.width, fx.height);
        particleRafRef.current = 0;
        return;
      }
      const fctx = fx.getContext('2d');
      if (!fctx) {
        particlesRef.current = [];
        particleRafRef.current = 0;
        return;
      }
      fctx.clearRect(0, 0, fx.width, fx.height);
      const next: FlakeParticle[] = [];
      for (const p of list) {
        p.life += 1;
        if (p.life >= p.maxLife) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.vx *= 0.98;
        fctx.globalAlpha = 1 - p.life / p.maxLife;
        fctx.fillStyle = p.color;
        fctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        next.push(p);
      }
      fctx.globalAlpha = 1;
      particlesRef.current = next;
      particleRafRef.current = requestAnimationFrame(tick);
    };
    particleRafRef.current = requestAnimationFrame(tick);
  }, []);

  const spawnFlakes = useCallback(
    (x: number, y: number, count: number, palette: readonly string[]) => {
      const fx = fxRef.current;
      if (!fx) return;
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 2.8,
          vy: -1.6 + Math.random() * 1.4,
          size: Math.random() > 0.45 ? 3 : 2,
          life: 0,
          maxLife: 16 + Math.floor(Math.random() * 16),
          color: palette[i % palette.length]!,
        });
      }
      if (particlesRef.current.length > 140) {
        particlesRef.current = particlesRef.current.slice(-140);
      }
      runParticleLoop();
    },
    [runParticleLoop],
  );

  const evaluateCoverage = useCallback(
    (forceAll = false) => {
      const foil = foilRef.current;
      const d = detailRef.current;
      if (!d) return;

      const prev = revealedRef.current;
      const next = [...prev];
      let newlyOpened = 0;

      if (forceAll || !foil) {
        for (let i = 0; i < 9; i++) {
          if (!next[i]) newlyOpened++;
          next[i] = true;
        }
      } else {
        const ctx = foil.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const w = foil.width;
        const h = foil.height;
        let imgData: ImageData;
        try {
          imgData = ctx.getImageData(0, 0, w, h);
        } catch {
          return;
        }
        const data = imgData.data;
        const cellW = w / 3;
        const cellH = h / 3;
        const marginX = Math.max(2, Math.floor(cellW * 0.1));
        const marginY = Math.max(2, Math.floor(cellH * 0.1));

        for (let idx = 0; idx < 9; idx++) {
          if (next[idx]) continue;
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const x0 = Math.floor(col * cellW) + marginX;
          const x1 = Math.ceil((col + 1) * cellW) - marginX;
          const y0 = Math.floor(row * cellH) + marginY;
          const y1 = Math.ceil((row + 1) * cellH) - marginY;

          let total = 0;
          let cleared = 0;
          for (let py = y0; py < y1; py += 2) {
            for (let px = x0; px < x1; px += 2) {
              total++;
              if ((data[(py * w + px) * 4 + 3] ?? 255) < 90) cleared++;
            }
          }

          if (total > 0 && cleared / total >= 0.36) {
            next[idx] = true;
            newlyOpened++;
            ctx.clearRect(Math.floor(col * cellW), Math.floor(row * cellH), Math.ceil(cellW), Math.ceil(cellH));
            const cell = d.cells[idx];
            if (cell) {
              playScratchCellReveal(cell.matched, cell.isDouble);
              const palette = cell.isDouble
                ? ['#ff85b3', '#ffe066', '#ffffff']
                : cell.matched
                  ? ['#ffd85a', '#ffb838', '#fff5b8']
                  : ['#cfd7e6', '#ffffff', '#94a3c4'];
              spawnFlakes(((col + 0.5) * w) / 3, ((row + 0.5) * h) / 3, cell.matched ? 14 : 7, palette);
            }
          }
        }
      }

      if (newlyOpened > 0 || forceAll) {
        revealedRef.current = next;
        setScratched(next);
        if (next.every(Boolean) && roundId && completedRef.current !== roundId) {
          completedRef.current = roundId;
          const lr = roundRef.current;
          playArcadeOutcome(Boolean(lr?.won), lr?.tier === 'jackpot' || lr?.tier === 'mega');
          onRevealCompleteRef.current?.();
        }
      }
    },
    [roundId, spawnFlakes],
  );

  useEffect(() => {
    stopAnimations();
    particlesRef.current = [];
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!roundId) {
      const blank = Array(9).fill(false);
      revealedRef.current = blank;
      setScratched(blank);
      return;
    }

    if (reduced || shouldMask === false) {
      const openAll = Array(9).fill(true);
      revealedRef.current = openAll;
      completedRef.current = roundId;
      setScratched(openAll);
      return;
    }

    const freshMask = Array(9).fill(false);
    revealedRef.current = freshMask;
    completedRef.current = '';
    setScratched(freshMask);

    const frame = requestAnimationFrame(() => {
      const board = boardRef.current;
      const foil = foilRef.current;
      const fx = fxRef.current;
      if (!board || !foil) return;
      const foilRect = foil.getBoundingClientRect();
      const rect = foilRect.width > 10 && foilRect.height > 10 ? foilRect : board.getBoundingClientRect();
      const w = Math.max(210, Math.round(rect.width * 0.5));
      const h = Math.max(120, Math.round(rect.height * 0.5));
      foil.width = w;
      foil.height = h;
      if (fx) {
        fx.width = w;
        fx.height = h;
      }
      const ctx = foil.getContext('2d', { willReadFrequently: true });
      if (ctx) paintSilverFoil(ctx, w, h);
    });

    return () => cancelAnimationFrame(frame);
  }, [roundId, shouldMask, stopAnimations]);

  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const refEl = foilRef.current ?? boardRef.current!;
    const rect = refEl.getBoundingClientRect();
    const cw = foilRef.current?.width ?? Math.max(210, Math.round(rect.width * 0.5));
    const ch = foilRef.current?.height ?? Math.max(120, Math.round(rect.height * 0.5));
    const clampedCssX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const clampedCssY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return {
      x: (clampedCssX / Math.max(1, rect.width)) * cw,
      y: (clampedCssY / Math.max(1, rect.height)) * ch,
      cssX: clampedCssX,
      cssY: clampedCssY,
    };
  }, []);

  // 通过 window 全局监听延续滑动轨迹，兼顾连贯划动与单格点击
  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
      if (!pointerActiveRef.current || !detailRef.current || spinningRef.current) return;
      const foil = foilRef.current;
      if (!foil) return;
      const ctx = foil.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const pt = toCanvasCoords(e.clientX, e.clientY);
      const prev = lastPtRef.current ?? pt;
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      const dist = Math.hypot(dx, dy);
      const cssSpeed = Math.hypot(pt.cssX - prev.cssX, pt.cssY - prev.cssY);
      moveDistRef.current += cssSpeed;

      const brushR = Math.max(11, Math.round(foil.width / 20));
      const steps = Math.max(1, Math.ceil(dist / 3));
      for (let i = 1; i <= steps; i++) {
        stampEraser(ctx, prev.x + (dx * i) / steps, prev.y + (dy * i) / steps, brushR);
      }

      if (cssSpeed >= 3) {
        playScratchGrain(cssSpeed);
        spawnFlakes(pt.x, pt.y, cssSpeed > 14 ? 3 : 1, ['#d5dce9', '#ffffff', '#94a3c4']);
      }
      lastPtRef.current = pt;

      const now = performance.now();
      if (now - lastEvalMsRef.current >= 65) {
        lastEvalMsRef.current = now;
        evaluateCoverage(false);
      }
    };

    const onUp = () => {
      stopScratchGrain();
      if (!pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      setScratching(false);
      lastPtRef.current = null;
      evaluateCoverage(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      stopScratchGrain();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, [evaluateCoverage, spawnFlakes, toCanvasCoords]);

  useEffect(() => {
    return () => {
      stopScratchGrain();
      stopAnimations();
      if (particleRafRef.current) cancelAnimationFrame(particleRafRef.current);
    };
  }, [stopAnimations]);

  const allRevealed = scratched.every(Boolean);

  const rubCellClean = useCallback(
    (idx: number) => {
      if (moveDistRef.current >= 8) return;
      const foil = foilRef.current;
      const d = detailRef.current;
      if (!d || spinningRef.current) return;
      unlockArcadeAudio();
      playScratchGrain(22);
      if (foil) {
        const ctx = foil.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const w = foil.width;
          const h = foil.height;
          ctx.clearRect(Math.floor((col * w) / 3), Math.floor((row * h) / 3), Math.ceil(w / 3), Math.ceil(h / 3));
        }
      }
      const next = [...revealedRef.current];
      if (!next[idx]) {
        next[idx] = true;
        revealedRef.current = next;
        setScratched(next);
        const cell = d.cells[idx];
        if (cell) playScratchCellReveal(cell.matched, cell.isDouble);
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const fw = foil?.width ?? 220;
        const fh = foil?.height ?? 130;
        spawnFlakes(((col + 0.5) * fw) / 3, ((row + 0.5) * fh) / 3, 10, ['#cfd7e6', '#ffffff', '#ffd85a']);
        if (next.every(Boolean) && roundId && completedRef.current !== roundId) {
          completedRef.current = roundId;
          const lr = roundRef.current;
          playArcadeOutcome(Boolean(lr?.won), lr?.tier === 'jackpot' || lr?.tier === 'mega');
          onRevealCompleteRef.current?.();
        }
      }
    },
    [roundId, spawnFlakes],
  );

  const scratchAll = () => {
    if (!roundId || spinning || allRevealed) return;
    unlockArcadeAudio();
    playScratchSweep();
    stopAnimations();

    const foil = foilRef.current;
    if (!foil) {
      evaluateCoverage(true);
      return;
    }
    const ctx = foil.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      evaluateCoverage(true);
      return;
    }

    const start = performance.now();
    const duration = 230;
    const w = foil.width;
    const h = foil.height;
    let prevPos: { x: number; y: number } | null = null;

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const x = p * w;
      const y = (0.5 + 0.42 * Math.sin(p * Math.PI * 5.2)) * h;
      if (prevPos) {
        for (let i = 1; i <= 6; i++) {
          stampEraser(
            ctx,
            prevPos.x + ((x - prevPos.x) * i) / 6,
            prevPos.y + ((y - prevPos.y) * i) / 6,
            Math.max(18, Math.round(h / 5.5)),
          );
        }
      } else {
        stampEraser(ctx, x, y, Math.max(18, Math.round(h / 5.5)));
      }
      prevPos = { x, y };
      spawnFlakes(x, y, 4, ['#d5dce9', '#ffffff', '#9aa9c9']);

      if (p < 1) {
        sweepRafRef.current = requestAnimationFrame(step);
      } else {
        sweepRafRef.current = 0;
        evaluateCoverage(true);
      }
    };
    sweepRafRef.current = requestAnimationFrame(step);
  };

  const handleBoardPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!detail || spinning || allRevealed) return;
    unlockArcadeAudio();
    playScratchTap();
    pointerActiveRef.current = true;
    setScratching(true);
    moveDistRef.current = 0;

    const pt = toCanvasCoords(e.clientX, e.clientY);
    lastPtRef.current = pt;

    const foil = foilRef.current;
    const ctx = foil?.getContext('2d', { willReadFrequently: true });
    if (foil && ctx) {
      stampEraser(ctx, pt.x, pt.y, Math.max(11, Math.round(foil.width / 20)));
      spawnFlakes(pt.x, pt.y, 4, ['#d5dce9', '#ffffff', '#94a3c4']);
    }
  };

  const lucky = detail ? symbolSpec(detail.luckySymbol) : null;
  const openCount = scratched.filter(Boolean).length;
  const tierClass = !detail || !allRevealed
    ? 'is-idle'
    : lastRound?.tier === 'jackpot' || lastRound?.tier === 'mega'
      ? 'is-jackpot'
      : lastRound?.won
        ? 'is-win'
        : 'is-bust';

  return (
    <section
      className={`arcade-cabinet arcade-cabinet--scratch ${tierClass} ${focused ? 'is-focused' : ''}`}
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
          title="查看彩券档位"
        >
          {rulesOpen ? '收起' : '? 档位'}
        </button>
      </div>

      {rulesOpen ? (
        <div className="arcade-paytable-popover">
          <table>
            <thead>
              <tr><th>图案</th><th>奖励</th><th>说明</th></tr>
            </thead>
            <tbody>
              {game.paytable.map(row => (
                <tr key={row.combo}><td>{row.combo}</td><td>{row.payout}</td><td>{row.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="arcade-scratch-ticket">
        <div className="arcade-scratch-header">
          <div className="arcade-lucky-box">
            <span className="arcade-lucky-title">本券幸运符</span>
            {spinning ? (
              <span className="arcade-lucky-val">印制银膜中…</span>
            ) : lucky ? (
              <span className="arcade-lucky-val"><strong>{lucky.glyph}</strong> {lucky.name}</span>
            ) : (
              <span className="arcade-lucky-val">购券后揭示</span>
            )}
          </div>
          {roundId && !allRevealed ? (
            <button type="button" className="arcade-scratch-all-btn" onClick={scratchAll}>
              一键全刮 ({openCount}/9)
            </button>
          ) : null}
        </div>

        <div
          ref={boardRef}
          className={`arcade-scratch-board ${detail && !allRevealed ? 'has-foil' : ''} ${scratching ? 'is-scratching' : ''}`}
          onPointerDownCapture={handleBoardPointerDown}
        >
          <div className="arcade-scratch-grid" role="group" aria-label="九宫刮刮区">
            {(detail?.cells ?? Array.from({ length: 9 }, () => null)).map((cell, idx) => {
              const revealed = Boolean(cell) && scratched[idx];
              const sym = cell ? symbolSpec(cell.symbol) : null;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`arcade-scratch-cell ${cell ? 'has-ticket' : 'is-empty'} ${revealed ? 'is-open' : 'is-foil'} ${revealed && cell?.matched ? 'is-matched' : ''} ${revealed && cell?.isDouble ? 'is-double' : ''}`}
                  disabled={!detail || spinning || revealed}
                  aria-label={
                    revealed && sym && cell
                      ? `${sym.name} ${cell.isDouble ? '倍签' : `${cell.factor}倍`}`
                      : `刮开第 ${idx + 1} 格`
                  }
                  onClick={() => rubCellClean(idx)}
                >
                  {sym && cell ? (
                    <>
                      <span className="scratch-cell-glyph" aria-hidden="true">{sym.glyph}</span>
                      <span className="scratch-cell-name">{sym.name}</span>
                      <small className="scratch-cell-factor">{cell.isDouble ? '×2 倍签' : `${cell.factor}×`}</small>
                    </>
                  ) : (
                    <span className="scratch-foil-stamp">待购券</span>
                  )}
                </button>
              );
            })}
          </div>

          {detail && !allRevealed ? (
            <canvas ref={foilRef} className="arcade-scratch-foil" aria-hidden="true" />
          ) : null}

          <canvas ref={fxRef} className="arcade-scratch-particles" aria-hidden="true" />
        </div>
      </div>

      <div className={`arcade-outcome-strip ${tierClass}`}>
        {spinning ? (
          <span>正在发新彩券…</span>
        ) : !detail ? (
          <span>挑好倍率，买一张刮刮乐亲手滑动刮开九宫！</span>
        ) : !allRevealed ? (
          <span>按住手指或鼠标在银膜上来回刮开（带沙沙声），或点「一键全刮」</span>
        ) : (
          <>
            <strong>{lastRound?.won ? '对中彩券！' : '差一点点'}</strong>
            <span>{lastRound?.outcomeLabel}</span>
          </>
        )}
      </div>

      {consoleDeck}
    </section>
  );
}
