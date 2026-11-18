'use client';
import type { ReactNode } from 'react';
import type { ArcadeGameMeta, ArcadeLastRound } from '@/lib/meta/arcade';
import SlotCabinet from './slot-cabinet';
import ScratchCard from './scratch-card';

/**
 * 游乐摊游玩台面插件分发器（骨架 + 功能包）。
 * 新增玩法包时只需在此映射 game.id 对应的客户端展示组件。
 */
export function ArcadeGameStage({
  game,
  lastRound,
  spinning,
  focused,
  isFreshRound,
  shouldMaskScratch,
  canPullSpin,
  onPullSpin,
  onRevealComplete,
  consoleDeck,
}: {
  game: ArcadeGameMeta;
  lastRound: ArcadeLastRound | null;
  spinning: boolean;
  focused?: boolean;
  isFreshRound?: boolean;
  shouldMaskScratch?: boolean;
  canPullSpin?: boolean;
  onPullSpin?: () => void;
  onRevealComplete?: () => void;
  consoleDeck?: ReactNode;
}) {
  if (game.id === 'slot-machine') {
    return (
      <SlotCabinet
        game={game}
        lastRound={lastRound}
        spinning={spinning}
        focused={focused}
        isFreshRound={isFreshRound}
        canPullSpin={canPullSpin}
        onPullSpin={onPullSpin}
        consoleDeck={consoleDeck}
      />
    );
  }
  if (game.id === 'scratchcard') {
    return (
      <ScratchCard
        game={game}
        lastRound={lastRound}
        spinning={spinning}
        focused={focused}
        shouldMask={shouldMaskScratch}
        onRevealComplete={onRevealComplete}
        consoleDeck={consoleDeck}
      />
    );
  }
  return (
    <div className={`arcade-cabinet is-idle ${focused ? 'is-focused' : ''}`}>
      <div className="arcade-cabinet-marquee">
        <span className="arcade-marquee-badge">{game.badge}</span>
        <strong>{game.name}</strong>
        <small>{game.subtitle}</small>
      </div>
      <div className="arcade-outcome-strip is-idle">
        <span>{lastRound?.gameId === game.id ? lastRound.outcomeLabel : game.tagline}</span>
      </div>
      {consoleDeck}
    </div>
  );
}
