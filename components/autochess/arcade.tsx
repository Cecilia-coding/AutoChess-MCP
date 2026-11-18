'use client';
/* oxlint-disable next/no-img-element -- Pre-generated pixel cosmetics use native img/data URLs. */
/* oxlint-disable next/no-html-link-for-pages -- Host platforms may customize lobby routes. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ARCADE_STARTER_TICKETS,
  type ArcadeCommand,
  type ArcadeLastRound,
  type ArcadePayMode,
  type ArcadePrize,
  type ArcadeStakeId,
  type ArcadeView,
} from '@/lib/meta/arcade';
import { arcadeGameCatalog } from '@/lib/meta/arcade-registry';
import { playArcadeOutcome, playGambleStinger, unlockArcadeAudio } from '@/lib/meta/arcade-sfx';
import { cosmeticImage } from '@/lib/meta/cosmetics';
import { CURRENCY } from '@/lib/meta/economy';
import { GIFT_NOTE_PROMPT } from '@/lib/meta/gift-copy';
import { isSfxMuted, subscribeSfxMuted, toggleSfxMuted } from '@/lib/autochess/sound';
import { readAccountToken } from './account-session';
import { useAutochessHost, useHostRequests } from './host-context';
import { newRequestId } from './request-id';
import { ArcadeGameStage } from './arcade-games';
import ArcadeReward from './arcade-reward';
import { PixelSprite } from './pixel-ui/pixel-sprite';
import './pixel-ui/fairytale-outer.css';
import './arcade.css';

function prizeStatusText(prize: ArcadePrize) {
  if (prize.status === 'used') return '已收入行囊';
  if (prize.status === 'sent') return `已赠予 ${prize.to?.name ?? '伙伴'}`;
  return prize.from?.name ? `来自 ${prize.from.name}` : '待决定自用或转赠';
}

const STAGE_CATALOG = arcadeGameCatalog();
const DEFAULT_GAME_ID = STAGE_CATALOG[0]?.id ?? 'slot-machine';

function resolveStageFromLocation(initialStage?: string): string {
  if (initialStage && STAGE_CATALOG.some(item => item.id === initialStage)) return initialStage;
  if (typeof window === 'undefined') return DEFAULT_GAME_ID;
  const raw = new URLSearchParams(window.location.search).get('game') ?? '';
  return STAGE_CATALOG.some(item => item.id === raw) ? raw : DEFAULT_GAME_ID;
}

export default function Arcade({
  embedded = false,
  initialStage,
  onStageChange,
  onJumpLogin,
}: {
  embedded?: boolean;
  initialStage?: string;
  onStageChange?: (stageId: string) => void;
  onJumpLogin?: () => void;
} = {}) {
  const host = useAutochessHost();
  const { navigate } = useHostRequests();
  const [token, setToken] = useState<string | null>(null);
  const [stageMode, setStageMode] = useState<string>(() => resolveStageFromLocation(initialStage));
  const [muted, setMuted] = useState<boolean>(false);

  useEffect(() => {
    if (initialStage && STAGE_CATALOG.some(item => item.id === initialStage)) {
      setStageMode(initialStage);
    }
  }, [initialStage]);

  useEffect(() => {
    if (embedded) return;
    const syncStage = () => setStageMode(resolveStageFromLocation(initialStage));
    syncStage();
    window.addEventListener('popstate', syncStage);
    return () => window.removeEventListener('popstate', syncStage);
  }, [embedded, initialStage]);

  useEffect(() => {
    setMuted(isSfxMuted());
    return subscribeSfxMuted(() => setMuted(isSfxMuted()));
  }, []);

  useEffect(() => {
    const sync = () => setToken(readAccountToken());
    sync();
    window.addEventListener('chess-account-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('chess-account-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const switchStage = (nextMode: string) => {
    setStageMode(nextMode);
    onStageChange?.(nextMode);
    if (embedded || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('game', nextMode);
    window.history.replaceState(null, '', url.toString());
  };

  const platformBridged = host.features.authMode === 'platform' && Boolean(host.transport.accountRequest);
  const Shell = embedded ? 'div' : 'main';

  return (
    <Shell className={`arcade-page${embedded ? ' arcade-page--embedded' : ''}${host.features.embeddedContainer ? ' autochess-embed' : ''}`}>
      <header className="arcade-topbar" aria-label="游乐机台顶栏">
        <div className="arcade-topbar-left">
          {!embedded ? (
            <a
              className="arcade-link"
              href={host.routes.lobby}
              onClick={event => {
                if (host.transport.navigate) {
                  event.preventDefault();
                  navigate('lobby');
                }
              }}
            >
              ← 大厅
            </a>
          ) : null}
          <div className="arcade-mode-tabs" role="tablist" aria-label="切换机台">
            {STAGE_CATALOG.map(entry => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={stageMode === entry.id}
                className={`arcade-mode-tab ${stageMode === entry.id ? 'is-active' : ''}`}
                onClick={() => switchStage(entry.id)}
              >
                <PixelSprite name={entry.id === 'slot-machine' ? 'tiaraGold' : 'ticket'} size={13} />
                <span>{entry.id === 'slot-machine' ? '老虎机' : '刮刮乐'}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="arcade-topbar-right">
          <button
            type="button"
            className={`arcade-sfx-btn ${muted ? 'is-muted' : ''}`}
            aria-pressed={!muted}
            title={muted ? '开启音效' : '静音'}
            onClick={() => toggleSfxMuted()}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {!host.features.arcade ? (
        <p className="arcade-status-banner">当前站点已关闭像素游乐摊入口。</p>
      ) : token === null && !platformBridged ? (
        <output className="arcade-status-banner">正在启动像素机台…</output>
      ) : token || platformBridged ? (
        <ArcadeAccount key={token || 'platform'} token={token ?? ''} stageMode={stageMode} />
      ) : (
        <p className="arcade-status-banner">
          先在棋室登录你的账号，再来玩老虎机和刮刮乐（新客送 {ARCADE_STARTER_TICKETS} 张试玩券）。{' '}
          {onJumpLogin ? (
            <button type="button" className="arcade-link" onClick={onJumpLogin}>
              去登录
            </button>
          ) : (
            <a className="arcade-link" href={`${host.routes.lobby}#me`}>
              去登录
            </a>
          )}
        </p>
      )}
    </Shell>
  );
}

function ArcadeAccount({
  token,
  stageMode,
}: {
  token: string;
  stageMode: string;
}) {
  const host = useAutochessHost();
  const { accountRequest } = useHostRequests();
  const [view, setView] = useState<ArcadeView | null>(null);
  const [roundsByGame, setRoundsByGame] = useState<Record<string, ArcadeLastRound>>({});
  const [freshRoundIds, setFreshRoundIds] = useState<string[]>([]);
  const [revealedScratchIds, setRevealedScratchIds] = useState<string[]>([]);
  const [stakeByGame, setStakeByGame] = useState<Record<string, ArcadeStakeId>>({});
  const [payByGame, setPayByGame] = useState<Record<string, ArcadePayMode>>({});
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [lootOpen, setLootOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [spinningGame, setSpinningGame] = useState<string | null>(null);
  const [scratchRevealed, setScratchRevealed] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<ArcadeCommand | null>(null);
  const [giftId, setGiftId] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [openedPrize, setOpenedPrize] = useState<ArcadePrize | null>(null);

  const alive = useRef(true);
  const locked = useRef(false);
  const sequence = useRef(0);
  const autoStartTried = useRef(false);
  const giftFormRef = useRef<HTMLDivElement>(null);

  const valid = useCallback(
    () => (host.features.authMode === 'platform' ? alive.current : alive.current && readAccountToken() === token),
    [host.features.authMode, token],
  );

  const applyView = useCallback((next: ArcadeView) => {
    setView(next);
    const lr = next.state.lastRound;
    if (lr) {
      setRoundsByGame(prev => (prev[lr.gameId]?.roundId === lr.roundId ? prev : { ...prev, [lr.gameId]: lr }));
    }
    if (next.state.prizes.some(p => p.status === 'pending')) {
      setLootOpen(true);
    }
    const nextRecipients = next.gifting?.recipients ?? [];
    setTo(current => current || (nextRecipients.length === 1 ? nextRecipients[0]!.id : ''));
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const next = await accountRequest<ArcadeView>('arcade', { token });
      if (!valid() || seq !== sequence.current) return;
      applyView(next);
      setError('');
    } catch (e) {
      if (valid() && seq === sequence.current) setError((e as Error).message);
    }
  }, [accountRequest, applyView, token, valid]);

  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(refresh);
    return () => {
      alive.current = false;
      sequence.current++;
    };
  }, [refresh]);

  const execute = useCallback(
    async (command: ArcadeCommand, reportFailure = false): Promise<ArcadeView | undefined> => {
      if (locked.current) return undefined;
      locked.current = true;
      sequence.current++;
      setBusy(true);
      setError('');
      if (command.action === 'play') setSpinningGame(command.gameId ?? null);
      try {
        const next = await accountRequest<ArcadeView>('arcade_action', { token, command });
        if (!valid()) return undefined;
        setRetry(null);
        if (command.action === 'gift') {
          setGiftId('');
          setNote('');
        }
        const nextRound = next.state.lastRound;
        if (command.action === 'play' && nextRound) {
          setFreshRoundIds(prev => (prev.includes(nextRound.roundId) ? prev : [...prev.slice(-12), nextRound.roundId]));
        }
        if (command.action === 'play' && command.gameId === 'scratchcard') {
          setScratchRevealed(false);
        } else if (command.action === 'play') {
          setScratchRevealed(true);
        } else if (command.action === 'gamble') {
          playGambleStinger(Boolean(next.state.pendingGamble));
        } else if (command.action === 'cash_out') {
          playArcadeOutcome(true, false);
        }
        applyView(next);
        return next;
      } catch (e) {
        if (valid()) {
          setError((e as Error).message);
          setRetry(command);
        }
        if (reportFailure) throw e;
        return undefined;
      } finally {
        locked.current = false;
        if (valid()) {
          setBusy(false);
          setSpinningGame(null);
        }
      }
    },
    [accountRequest, applyView, token, valid],
  );

  useEffect(() => {
    if (!view || view.state.starterClaimed || view.state.pendingGamble || autoStartTried.current || retry || busy) return;
    autoStartTried.current = true;
    void execute({ action: 'start', requestId: newRequestId(), revision: view.state.revision });
  }, [view, retry, busy, execute]);

  const handleScratchReveal = useCallback((roundId?: string) => {
    setScratchRevealed(true);
    if (roundId) {
      setRevealedScratchIds(prev => (prev.includes(roundId) ? prev : [...prev, roundId]));
    }
  }, []);

  function act(action: ArcadeCommand['action'], fields: Partial<ArcadeCommand> = {}) {
    if (!view || retry || locked.current) return;
    unlockArcadeAudio();
    void execute({ action, requestId: newRequestId(), revision: view.state.revision, ...fields });
  }

  if (!view) {
    return (
      <output className="arcade-status-banner">
        {error || '正在搬出像素机台…'}{' '}
        <button type="button" onClick={() => void refresh()}>
          重试
        </button>
      </output>
    );
  }
  if (!view.enabled) return <p className="arcade-status-banner">像素游乐摊正在整理摊位，请稍后再来。</p>;

  const { state, games, stakes, ticketShop, wallet, relief } = view;
  const disabled = busy || Boolean(retry);
  const currencyName = CURRENCY[wallet.activeCurrency].name;
  const pendingPrizes = state.prizes.filter(p => p.status === 'pending');
  const settledPrizes = state.prizes.filter(p => p.status !== 'pending');
  const selectedGift = pendingPrizes.find(p => p.id === giftId && p.spec.giftable);
  const recipients = view.gifting?.recipients ?? [];
  const targetRecipient = to || (recipients.length === 1 ? recipients[0]!.id : '');
  const showPendingGamble = Boolean(
    state.pendingGamble && (state.lastRound?.gameId !== 'scratchcard' || scratchRevealed || state.pendingGamble.doublesUsed > 0),
  );
  const activeGame = games.find(item => item.id === stageMode) ?? games[0]!;

  const claimPrize = async (id: string) => {
    if (locked.current) throw Error('上一笔还在处理，请稍候。');
    if (retry && (retry.action !== 'use' || retry.prizeId !== id)) {
      throw Error('请先处理或放弃上一笔未完成的请求。');
    }
    const command: ArcadeCommand = retry ?? { action: 'use', prizeId: id, revision: state.revision, requestId: newRequestId() };
    const next = await execute(command, true);
    if (!next || next.state.prizes.find(p => p.id === id)?.status !== 'used') {
      throw Error('暂未确认放入行囊，请稍候重试。');
    }
  };

  const stake = stakes.find(s => s.id === (stakeByGame[activeGame.id] ?? 'small')) ?? stakes[0]!;
  const coinCost = wallet.activeCurrency === 'bot' ? stake.botCost : stake.humanCost;
  const explicitPay = payByGame[activeGame.id];
  const payMode: ArcadePayMode =
    state.tickets >= stake.ticketCost && (explicitPay !== 'coin' || wallet.activeBalance < coinCost)
      ? 'ticket'
      : wallet.activeBalance >= coinCost && (explicitPay !== 'ticket' || state.tickets < stake.ticketCost)
        ? 'coin'
        : state.tickets > 0
          ? 'ticket'
          : explicitPay ?? 'coin';
  const canAffordPlay = payMode === 'ticket' ? state.tickets >= stake.ticketCost : wallet.activeBalance >= coinCost;
  const roundForGame = roundsByGame[activeGame.id] ?? (state.lastRound?.gameId === activeGame.id ? state.lastRound : null);
  const isFreshRound = Boolean(roundForGame && freshRoundIds.includes(roundForGame.roundId));
  const shouldMaskScratch = Boolean(
    activeGame.id === 'scratchcard' &&
      roundForGame &&
      isFreshRound &&
      !revealedScratchIds.includes(roundForGame.roundId),
  );
  const scratchAwaitingReveal = Boolean(shouldMaskScratch);

  const needsStarter = !state.starterClaimed && !state.pendingGamble;
  const needsRelief = state.starterClaimed && !state.pendingGamble && !canAffordPlay && relief.eligible;

  let ctaLabel = '';
  let ctaDisabled = disabled || Boolean(spinningGame);
  let onCta = () =>
    act('play', {
      gameId: activeGame.id,
      stakeId: stake.id,
      payMode,
      autoCashOut,
    });

  if (spinningGame === activeGame.id) {
    ctaLabel = activeGame.id === 'slot-machine' ? '转动中…' : '出票中…';
    ctaDisabled = true;
  } else if (needsStarter) {
    ctaLabel = `领 ${view.starterTickets} 张试玩券`;
    onCta = () => act('start');
  } else if (scratchAwaitingReveal) {
    ctaLabel = '划开银膜看奖';
    ctaDisabled = true;
  } else if (state.pendingGamble) {
    ctaLabel = showPendingGamble ? '请先结算上方搏倍' : '先刮完再结算';
    ctaDisabled = true;
  } else if (needsRelief) {
    ctaLabel = `领 ${relief.tickets} 张低保券 (剩${relief.remainingToday})`;
    onCta = () => act('relief');
  } else if (!canAffordPlay) {
    ctaLabel = relief.remainingToday <= 0 ? '今日低保已领完 · 余额不足' : payMode === 'ticket' ? '游乐券不足' : `${currencyName}不足`;
    ctaDisabled = true;
  } else {
    const costText = payMode === 'ticket' ? `${stake.ticketCost}券` : `${coinCost}${currencyName}`;
    ctaLabel = activeGame.id === 'slot-machine' ? `拉杆开转 (-${costText})` : `买一张 (-${costText})`;
  }

  const canPullSpin = Boolean(
    activeGame.id === 'slot-machine' &&
      !ctaDisabled &&
      !needsStarter &&
      !needsRelief &&
      canAffordPlay &&
      !state.pendingGamble &&
      !scratchAwaitingReveal,
  );

  return (
    <>
      {openedPrize ? (
        <ArcadeReward key={openedPrize.id} prize={openedPrize} onClaim={claimPrize} onClose={() => setOpenedPrize(null)} />
      ) : null}

      <section className="arcade-wallet-strip" aria-label="随身筹码栏">
        <div className="arcade-hud-chip is-ticket">
          <PixelSprite name="ticket" size={13} />
          <strong>{state.tickets}</strong>
          <small>券</small>
          <button
            type="button"
            className="arcade-chip-btn"
            aria-expanded={shopOpen}
            onClick={() => setShopOpen(open => !open)}
          >
            {shopOpen ? '收起' : '+买券'}
          </button>
        </div>

        <div className="arcade-hud-chip is-coin">
          <PixelSprite name={wallet.activeCurrency === 'bot' ? 'skyCore' : 'goldCoin'} size={13} />
          <strong>{wallet.activeBalance}</strong>
          <small>{currencyName}</small>
        </div>

        {pendingPrizes.length > 0 || settledPrizes.length > 0 ? (
          <button
            type="button"
            className={`arcade-chip-btn ${pendingPrizes.length ? 'is-mint' : ''}`}
            aria-expanded={lootOpen}
            onClick={() => setLootOpen(open => !open)}
          >
            <PixelSprite name="giftPouch" size={12} />
            <span>战利品{pendingPrizes.length ? ` (${pendingPrizes.length})` : ''}</span>
          </button>
        ) : null}
      </section>

      {shopOpen ? (
        <div className="arcade-ticket-drawer" aria-label="购券柜台">
          <span>{ticketShop.packPrice} {ticketShop.currencyName}/张</span>
          <div className="arcade-ticket-shop-actions">
            {[1, 5, 10].map(count => (
              <button
                key={count}
                type="button"
                disabled={disabled || ticketShop.balance < ticketShop.packPrice * count || state.tickets + count > ticketShop.maxTickets}
                onClick={() => act('buy_tickets', { count })}
              >
                +{count}张 ({ticketShop.packPrice * count})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="arcade-error" role="alert">
          {error}
        </p>
      ) : null}

      {retry ? (
        <div className="arcade-retry-box" role="alert">
          <span>上一笔请求未确认，可原单安全重试（不重复扣费）。</span>
          <div className="arcade-ticket-shop-actions">
            <button type="button" disabled={busy} onClick={() => void execute(retry)}>
              安全重试
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRetry(null);
                setError('');
                void refresh();
              }}
            >
              刷新
            </button>
          </div>
        </div>
      ) : null}

      <div className="arcade-cabinets-grid is-single" role="region" aria-label="游乐机台">
        <ArcadeGameStage
          key={activeGame.id}
          game={activeGame}
          lastRound={roundForGame}
          spinning={spinningGame === activeGame.id}
          focused
          isFreshRound={isFreshRound}
          shouldMaskScratch={shouldMaskScratch}
          canPullSpin={canPullSpin}
          onPullSpin={onCta}
          onRevealComplete={activeGame.id === 'scratchcard' ? () => handleScratchReveal(roundForGame?.roundId) : undefined}
          consoleDeck={
            <div className="arcade-cabinet-console" aria-label={`${activeGame.name} 投币操作台`}>
              {showPendingGamble && state.pendingGamble ? (
                <div className="arcade-gamble-bar is-inline" aria-live="polite" aria-label="搏倍风险决策">
                  <div className="arcade-gamble-info">
                    <strong>
                      待收彩金：{state.pendingGamble.currentCoins} {CURRENCY[state.pendingGamble.currency].name}
                    </strong>
                    <small>
                      胜率 {Math.round(state.pendingGamble.winProbability * 100)}%（第 {state.pendingGamble.doublesUsed + 1}/{state.pendingGamble.maxDoubles} 搏 · 失手归零）
                    </small>
                  </div>
                  <div className="arcade-gamble-actions">
                    <button type="button" className="arcade-cashout-btn" disabled={disabled} onClick={() => act('cash_out')}>
                      落袋 +{state.pendingGamble.currentCoins}
                    </button>
                    <button
                      type="button"
                      className="arcade-double-btn"
                      disabled={disabled || state.pendingGamble.doublesUsed >= state.pendingGamble.maxDoubles}
                      onClick={() => act('gamble')}
                    >
                      搏 ×2 → {state.pendingGamble.currentCoins * 2}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="arcade-stake-row">
                {stakes.map(entry => {
                  const active = entry.id === stake.id;
                  const cost =
                    payMode === 'ticket'
                      ? `${entry.ticketCost}券`
                      : `${wallet.activeCurrency === 'bot' ? entry.botCost : entry.humanCost}${currencyName}`;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`arcade-stake-chip ${active ? 'is-active' : ''}`}
                      aria-pressed={active}
                      disabled={disabled || Boolean(state.pendingGamble)}
                      onClick={() => setStakeByGame(prev => ({ ...prev, [activeGame.id]: entry.id }))}
                      title={`限定外观掉率 ×${entry.cosmeticRateBoost}`}
                    >
                      <strong>{entry.label}</strong>
                      <small>{cost}{entry.cosmeticRateBoost > 1 ? ` · ×${entry.cosmeticRateBoost}` : ''}</small>
                    </button>
                  );
                })}
              </div>

              <div className="arcade-console-action-row">
                <div className="arcade-paymode-mini">
                  <button
                    type="button"
                    className={payMode === 'ticket' ? 'is-active' : ''}
                    aria-pressed={payMode === 'ticket'}
                    disabled={disabled || Boolean(state.pendingGamble)}
                    onClick={() => setPayByGame(prev => ({ ...prev, [activeGame.id]: 'ticket' }))}
                  >
                    券({state.tickets})
                  </button>
                  <button
                    type="button"
                    className={payMode === 'coin' ? 'is-active' : ''}
                    aria-pressed={payMode === 'coin'}
                    disabled={disabled || Boolean(state.pendingGamble)}
                    onClick={() => setPayByGame(prev => ({ ...prev, [activeGame.id]: 'coin' }))}
                  >
                    币({coinCost})
                  </button>
                </div>

                <label className="arcade-checkbox" title="赢钱后直接进钱包，跳过搏倍">
                  <input
                    type="checkbox"
                    checked={autoCashOut}
                    disabled={disabled || Boolean(state.pendingGamble)}
                    onChange={event => setAutoCashOut(event.target.checked)}
                  />
                  <span>自动落袋</span>
                </label>

                <button
                  type="button"
                  className={`arcade-play-btn ${needsRelief || needsStarter ? 'is-relief' : ''}`}
                  disabled={ctaDisabled}
                  onClick={onCta}
                >
                  {ctaLabel}
                </button>
              </div>
            </div>
          }
        />
      </div>

      {lootOpen && (pendingPrizes.length > 0 || settledPrizes.length > 0) ? (
        <section className={`arcade-loot-dock ${pendingPrizes.length ? 'has-loot' : ''}`} aria-label="游乐摊战利品箱">
          <div className="arcade-loot-head">
            <div className="arcade-loot-title">
              <PixelSprite name="giftPouch" size={15} />
              <strong>战利品箱</strong>
              <small>{pendingPrizes.length ? `${pendingPrizes.length} 件待处理` : view.recipientHint}</small>
            </div>
            <button type="button" className="arcade-chip-btn" onClick={() => setLootOpen(false)}>收起</button>
          </div>

          {pendingPrizes.length ? (
            <div className="arcade-prizes">
              {pendingPrizes.map(prize => (
                <article key={prize.id} className="arcade-prize-card">
                  <div className="arcade-prize-head">
                    <img
                      className="arcade-prize-thumb"
                      src={cosmeticImage(prize.spec.cosmeticId, host.assetBase)}
                      alt={prize.spec.name}
                    />
                    <div>
                      <strong>{prize.spec.name}</strong>
                      <div><small>{prizeStatusText(prize)}</small></div>
                    </div>
                  </div>
                  {prize.note ? <small>“{prize.note}”</small> : null}
                  <div className="arcade-prize-actions">
                    <button type="button" disabled={disabled} onClick={() => setOpenedPrize(prize)}>
                      拆开礼盒
                    </button>
                    {prize.spec.giftable && host.features.gifting !== 'none' ? (
                      <button
                        type="button"
                        disabled={disabled || recipients.length === 0}
                        title={recipients.length === 0 ? '先绑定伙伴才可转赠' : '赠给绑定伙伴'}
                        onClick={() => {
                          setGiftId(prize.id);
                          giftFormRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        }}
                      >
                        转赠伙伴
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {selectedGift ? (
            <div ref={giftFormRef} className="arcade-gift-form">
              <strong>送出「{selectedGift.spec.name}」</strong>
              <div className="arcade-gift-row">
                {recipients.length > 1 ? (
                  <select aria-label="选择收礼伙伴" value={targetRecipient} onChange={event => setTo(event.target.value)}>
                    <option value="">选择收礼伙伴</option>
                    {recipients.map(r => (
                      <option key={r.id} value={r.id}>{r.username}</option>
                    ))}
                  </select>
                ) : recipients.length === 1 ? (
                  <span>收礼：<strong>{recipients[0]!.username}</strong></span>
                ) : (
                  <span>未绑定伙伴</span>
                )}
                <input
                  aria-label="附言"
                  maxLength={60}
                  value={note}
                  placeholder={GIFT_NOTE_PROMPT}
                  onChange={event => setNote(event.target.value)}
                />
                <button
                  type="button"
                  disabled={disabled || !targetRecipient}
                  onClick={() =>
                    act('gift', {
                      prizeId: selectedGift.id,
                      to: targetRecipient,
                      ...(note.trim() ? { note: note.trim() } : {}),
                    })
                  }
                >
                  寄出
                </button>
                <button type="button" disabled={disabled} onClick={() => setGiftId('')}>取消</button>
              </div>
            </div>
          ) : null}

          {settledPrizes.length ? (
            <details className="arcade-prize-history">
              <summary>已处理记录（{settledPrizes.length}）</summary>
              <ul>
                {settledPrizes.map(prize => (
                  <li key={prize.id}><strong>{prize.spec.name}</strong> · {prizeStatusText(prize)}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
