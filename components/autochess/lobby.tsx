'use client';
import { LOBBY_MODES, DEFAULT_MODE, modePack, type MatchModeId } from '@/packs/modes/registry';
import type { PackSummary } from '@/packs/registry';
import { CHESS_NAME } from '@/lib/meta/chess-brand';
import { enrollmentMcpUrl } from '@/lib/autochess/invite-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { avatarImage, cosmeticPrice, cosmeticById, cosmeticImage, DEFAULT_BOARD_SKIN, frameImage, frameLayoutFor, frameArtTransform, isArcadeCosmetic, isDefaultCosmetic, isShopCosmetic, NATIVE_BOARD_SKIN, type Cosmetic, type CosmeticKind } from '@/lib/meta/cosmetics';
import { clearPreviewWardrobe, resolveEffectiveBoardSkin, resolveEffectiveFrame, usePreviewWardrobe, writePreviewWardrobe } from '@/lib/meta/preview-wardrobe';
import { CURRENCY, EXCHANGE_BOT_PER_HUMAN, subsidyQuote, formatCoins, type CurrencyId, type Wallet } from '@/lib/meta/economy';
import { COSMETIC_TIER_META, type CosmeticTierId } from '@/lib/meta/game-config';
import { type ArcadeView } from '@/lib/meta/arcade';
import { clearAccountToken, readAccountToken, writeAccountToken } from './account-session';
import { useAutochessHost, useHostRequests } from './host-context';
import { newRequestId } from './request-id';
import Arcade from './arcade';
import { EchoTreePanel } from './echo-tree';
import BalanceAdmin from './balance-admin';
import ConfigAdmin from './config-admin';
import PackStudio from './pack-studio';
import GiftReveal, { type GiftLetter } from './gift-reveal';
import { useLocalAvatar, saveLocalAvatar, clearLocalAvatar } from './local-avatar';
import { GIFT_NOTE_PROMPT, GIFT_NOTE_HINT } from '@/lib/meta/gift-copy';
import type { EchoEvent } from '@/lib/meta/echo-tree';
import MachineCredential from './machine-credential';
import Feedback from './feedback';
import { SocialInboxTrigger } from './social-inbox';
import Matchmaking from './matchmaking';
import {LEADERBOARD_ORDERS, LEADERBOARD_SMALL_SAMPLE_GAMES, type LeaderboardOrder} from '@/lib/meta/leaderboard';
import {
  PixelSprite,
  cosmeticSpriteName,
  modeSpriteName,
  packSpriteName,
  type PixelSpriteName,
} from './pixel-ui/pixel-sprite';

type BoundPartner = { id: string; username: string; isAi: boolean };
type SelfAccount = {
  id: string; username: string; isAi: boolean; isAdmin: boolean; frame?: string;
  coins: Wallet; owned: string[]; equipped: Partial<Record<CosmeticKind, string>>;
  gifts: GiftLetter[];
  giftHistory?: { id: string; fromId: string; fromName: string; toId: string; toName: string; cosmeticId: string; at: number; claimedAt?: number; note?: string }[];
  ownerName?: string;
  boundPartners?: BoundPartner[];
  record: { games: number; wins: number };
};
type Catalog = { cosmetics: Cosmetic[]; exchange: number; reward: { play: number; win: number }; defaultSkin: string; arcadeEnabled?: boolean; echoScope?: 'public' | 'private' | 'none'; sandbox?: boolean };
type Entry = { id: string; username: string; isAi: boolean; frame?: string; record?: { games: number; wins: number } };
type PackFlag = PackSummary & { enabled: boolean };
type WatchRoom = { roomId: string; token: string; packName: string; round: number; phase: string; seats: string[] };

const TABS: readonly { id: 'start' | 'studio' | 'arcade' | 'echo' | 'shop' | 'rank' | 'me'; label: string; icon: PixelSpriteName }[] = [
  { id: 'start', label: '开局', icon: 'ribbonWand' },
  { id: 'studio', label: '工坊', icon: 'craftTome' },
  { id: 'arcade', label: '游乐摊', icon: 'candyPair' },
  { id: 'shop', label: '商城', icon: 'starGem' },
  { id: 'rank', label: '排行', icon: 'tiaraGold' },
  { id: 'echo', label: '回音', icon: 'sakuraHeart' },
  { id: 'me', label: '行囊', icon: 'giftPouch' },
] as const;

export function Avatar({
  id,
  frame,
  size = 44,
  neutralBackdrop = false,
}: {
  id: string;
  frame?: string;
  size?: number;
  neutralBackdrop?: boolean;
}) {
  const host = useAutochessHost();
  const localAvatar = useLocalAvatar(id);
  const ring = frameImage(frame, host.assetBase);
  const asset = cosmeticById(frame)?.frameAsset;
  const portraitStyle = asset
    ? {
        width: `${asset.portraitScale * 100}%`,
        height: `${asset.portraitScale * 100}%`,
        borderRadius: 0,
        imageRendering: 'pixelated' as const,
        clipPath: 'polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)',
      }
    : { borderRadius: 0, imageRendering: 'pixelated' as const };
  return (
    <span className="lobby-avatar" style={{ width: size, height: size }}>
      {neutralBackdrop ? (
        <span className="lobby-avatar-neutral" style={portraitStyle} aria-hidden="true" />
      ) : (
        <img
          src={localAvatar || avatarImage(id, host.assetBase)}
          alt=""
          width={size}
          height={size}
          style={portraitStyle}
        />
      )}
      {ring ? <img className="lobby-avatar-frame" src={ring} alt="" width={size} height={size} style={asset ? { borderRadius: 0, imageRendering: 'pixelated', transform: frameArtTransform(frameLayoutFor(frame)), transformOrigin: 'center' } : { borderRadius: 0, imageRendering: 'pixelated' }} /> : null}
    </span>
  );
}

export function LobbyPackCards({
  packs,
  selectedPack,
  onSelect,
}: {
  packs: PackSummary[];
  selectedPack: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="lobby-packs lobby-packs--rosters">
      {packs.map(item => (
        <button
          key={item.id}
          type="button"
          aria-pressed={selectedPack === item.id}
          className={`pack-tome ${selectedPack === item.id ? 'is-active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="pack-tome-icon"><PixelSprite name={packSpriteName(item.id)} size={20} /></span>
          <div className="pack-tome-meta">
            <strong>{item.name}</strong>
            <span className="pack-tome-description">{item.description}</span>
            <small>{item.units} 枚棋子入谱</small>
          </div>
          <span className="pack-tome-seal">{selectedPack === item.id ? '已选' : '选择'}</span>
        </button>
      ))}
    </div>
  );
}

export function CosmeticCard({
  cosmetic,
  assetBase,
  inShop,
  has,
  equipped,
  isTrying,
  sandbox,
  selfLoggedIn,
  currency,
  canBuy,
  arcadeEnabled,
  giftLabel,
  onEquip,
  onBuy,
  onTrial,
  onNavigateArcade,
  onGift,
}: {
  cosmetic: Cosmetic;
  assetBase?: string;
  inShop: boolean;
  has: boolean;
  equipped: boolean;
  isTrying: boolean;
  sandbox: boolean;
  selfLoggedIn: boolean;
  currency: CurrencyId;
  canBuy: boolean;
  arcadeEnabled: boolean;
  giftLabel: string | null;
  onEquip: () => void;
  onBuy: () => void;
  onTrial: () => void;
  onNavigateArcade: () => void;
  onGift: () => void;
}) {
  const tierKey: CosmeticTierId = cosmetic.tier ?? (cosmetic.kind === 'frame' ? 'frame' : 't3');
  const tierMeta = COSMETIC_TIER_META[tierKey];
  const badgeLabel = cosmetic.kind === 'board' && tierKey !== 'retired'
    ? tierMeta.shortLabel
    : cosmetic.rarity === 'epic' ? '神话' : cosmetic.rarity === 'rare' ? '史诗' : '经典';
  const isFrame = cosmetic.kind === 'frame';
  return (
    <article className={`lobby-card rarity-${cosmetic.rarity} tier-${tierKey} ${equipped || isTrying ? 'is-equipped' : ''}`}>
      <div className="lobby-card-header-bar">
        <span className="lobby-card-kind">{isFrame ? '头像框' : tierMeta.badge}</span>
        <span className="lobby-card-badge"><PixelSprite name={cosmetic.rarity === 'epic' ? 'sparkle' : cosmetic.rarity === 'rare' ? 'starGem' : 'bow'} size={11} /> {badgeLabel}</span>
      </div>
      {isFrame && cosmetic.frameAsset ? (
        <div className="lobby-card-art-box lobby-card-art-box--frame-asset" aria-label={`${cosmetic.name}佩戴预览`}>
          <Avatar id="preview" frame={cosmetic.id} size={132} neutralBackdrop />
        </div>
      ) : (
        <div className="lobby-card-art-box">
          <img
            className="lobby-card-art"
            src={(() => {
              const u = cosmeticImage(cosmetic.id, assetBase);
              return u.includes('/pixel-scenes/') ? `${u}${u.includes('?') ? '&' : '?'}v=4` : u;
            })()}
            alt={cosmetic.name}
          />
          {isFrame ? (
            <div className="lobby-card-frame-preview" title="实机佩戴预览">
              <div className="frame-astrolabe-ring" />
              <Avatar id="preview" frame={cosmetic.id} size={52} neutralBackdrop />
              <span className="frame-preview-tag">虚仪试戴</span>
            </div>
          ) : (
            <div className="lobby-card-board-palette" title="地貌天象配色">
              <span className="palette-chip" style={{ background: cosmetic.palette?.sky ?? '#d6e6c8' }} />
              <span className="palette-chip" style={{ background: cosmetic.palette?.outer ?? '#7fa06a' }} />
              <span className="palette-chip" style={{ background: cosmetic.palette?.inner ?? '#e8f0da' }} />
            </div>
          )}
        </div>
      )}
      <div className="lobby-card-body">
        <div className="lobby-card-title-row">
          <strong><PixelSprite name={cosmeticSpriteName(cosmetic.id)} size={15} /> {cosmetic.name}</strong>
          <span className="lobby-price">
            {isDefaultCosmetic(cosmetic)
              ? '初始默认'
              : cosmetic.acquisition === 'retired'
                ? '典藏绝版'
                : !inShop
                  ? '游乐摊限定'
                  : cosmeticPrice(cosmetic, currency) === 0
                    ? '迎新赠物'
                    : `${cosmeticPrice(cosmetic, currency)} ${CURRENCY[currency].name}`}
          </span>
        </div>
        <small className="lobby-card-tagline">“{cosmetic.tagline}”</small>
      </div>
      <div className="lobby-card-actions">
        {isDefaultCosmetic(cosmetic) ? (
          has && selfLoggedIn ? (
            <button className={equipped ? 'btn-equipped' : 'btn-equip'} disabled={equipped} onClick={onEquip}>
              {equipped ? <><PixelSprite name="clover" size={12} /> 初始默认 · 已启用</> : '换回初始默认'}
            </button>
          ) : (
            <button type="button" className="btn-equipped" disabled>
              初始默认 · 不可购买
            </button>
          )
        ) : has ? (
          <button className={equipped ? 'btn-equipped' : 'btn-equip'} disabled={equipped || !selfLoggedIn} onClick={onEquip}>
            {equipped ? <><PixelSprite name="clover" size={12} /> 已佩戴入局</> : '更替外观'}
          </button>
        ) : inShop ? (
          <button className="btn-buy" disabled={!selfLoggedIn || !canBuy} onClick={onBuy}>奉纳购置</button>
        ) : isArcadeCosmetic(cosmetic) ? (
          <button className="btn-buy" disabled={!arcadeEnabled} onClick={onNavigateArcade}>
            {arcadeEnabled ? '去游乐摊抽取' : '游乐摊筹备中'}
          </button>
        ) : null}
        {sandbox && !equipped ? (
          <button type="button" className={isTrying ? 'btn-trial is-active' : 'btn-trial'} onClick={onTrial}>
            {isTrying ? '试穿中 · 取消' : '试穿预览'}
          </button>
        ) : null}
        {giftLabel ? (
          <button className="btn-gift" onClick={onGift}>{giftLabel}</button>
        ) : null}
      </div>
    </article>
  );
}

export function LobbyHeader({
  wallet,
  self,
  effectiveFrame,
  authBusy,
  sandbox,
  preview,
  arcadeTickets,
  showSocial,
  showFeedback,
  showLogout = true,
  tabs,
  activeTab,
  onSelectTab,
  onLogout,
}: {
  wallet: Wallet;
  self: SelfAccount | null;
  effectiveFrame?: string;
  authBusy: boolean;
  sandbox: boolean;
  preview: { board?: string; frame?: string };
  arcadeTickets: number;
  showSocial: boolean;
  showFeedback: boolean;
  showLogout?: boolean;
  tabs: readonly (typeof TABS)[number][];
  activeTab: (typeof TABS)[number]['id'];
  onSelectTab: (id: (typeof TABS)[number]['id']) => void;
  onLogout: () => void;
}) {
  return (
    <header className="lobby-top">
      <div className="lobby-top-bar">
        <div className="lobby-brand">
          <div className="lobby-crest-badge" aria-hidden="true"><PixelSprite name="fairyCrown" size={20} /></div>
          <div className="lobby-brand-copy">
            <h1>{CHESS_NAME}</h1>
            <span className="lobby-sub">与人同席 · 与机对弈</span>
          </div>
        </div>
        <div className="lobby-wallet">
          {showSocial ? <SocialInboxTrigger variant="lobby" /> : null}
          {showFeedback ? <Feedback variant="lobby" /> : null}
          <div className="lobby-coin-pill human" title={CURRENCY.human.note}>
            <span className="coin-symbol"><PixelSprite name="goldCoin" size={13} /> 铜钱</span>
            <span className="coin-val">{formatCoins(wallet.human)}</span>
          </div>
          <div className="lobby-coin-pill bot" title={CURRENCY.bot.note}>
            <span className="coin-symbol"><PixelSprite name="skyCore" size={13} /> 机芯</span>
            <span className="coin-val">{formatCoins(wallet.bot)}</span>
          </div>
          {self ? (
            showLogout ? (
              <button className="lobby-user" disabled={authBusy} title="点击退出当前账号" onClick={onLogout}>
                <Avatar id={self.id} frame={effectiveFrame} size={28} />
                <div className="lobby-user-meta">
                  <span className="lobby-username">{self.username}</span>
                  <span className="lobby-usertag">{self.isAi ? '智能机' : '弈客'}</span>
                </div>
                <span className="lobby-user-exit">退出</span>
              </button>
            ) : (
              <div className="lobby-user" title="由宿主平台同步当前身份">
                <Avatar id={self.id} frame={effectiveFrame} size={28} />
                <div className="lobby-user-meta">
                  <span className="lobby-username">{self.username}</span>
                  <span className="lobby-usertag">{self.isAi ? '智能机' : '弈客'}</span>
                </div>
              </div>
            )
          ) : sandbox ? (
            <button type="button" className="lobby-visitor-trial" onClick={() => onSelectTab('shop')} title="点此打开外观试穿">
              <Avatar id="visitor-preview" frame={effectiveFrame} size={28} />
              <div className="lobby-user-meta">
                <span className="lobby-username">游客试穿</span>
                <span className="lobby-usertag">{preview.board || preview.frame ? '试穿中' : '试外观'}</span>
              </div>
            </button>
          ) : null}
        </div>
      </div>
      <nav className="lobby-tabs" aria-label="大厅栏目">
        {tabs.map(entry => (
          <button
            key={entry.id}
            type="button"
            data-tab={entry.id}
            aria-current={activeTab === entry.id ? 'page' : undefined}
            className={`${activeTab === entry.id ? 'is-active' : ''}${entry.id === 'arcade' ? ' lobby-tab-portal' : ''}`}
            onClick={() => onSelectTab(entry.id)}
          >
            <PixelSprite name={entry.icon} size={14} />
            <span>{entry.label}</span>
            {entry.id === 'me' && self?.gifts.length ? <b className="lobby-tab-badge">{self.gifts.length}</b> : null}
            {entry.id === 'arcade' && arcadeTickets > 0 ? <b className="lobby-tab-badge is-ticket">{arcadeTickets}券</b> : null}
          </button>
        ))}
      </nav>
    </header>
  );
}

export default function Lobby({ packs, packsLoading, packsError, mcpUrl, cosmeticsSandbox, onRefreshPacks, onPacksChanged, onCreate, onJoin, onEnterRoom, busy }: {
  packs: PackSummary[];
  packsLoading: boolean;
  packsError: string;
  mcpUrl: string;
  cosmeticsSandbox?: boolean;
  onRefreshPacks: () => Promise<void>;
  onPacksChanged: (packs: PackSummary[]) => void;
  onCreate: (pack: string, mode: MatchModeId) => void;
  onJoin: (invitation: string, joinKey: string) => void;
  onEnterRoom?: (roomId: string, token: string) => void;
  busy: boolean;
}) {
  const host = useAutochessHost();
  const { accountRequest, roomRequest, metaRequest } = useHostRequests();
  const platformBridged = host.features.authMode === 'platform' && Boolean(host.transport.metaRequest || host.transport.accountRequest);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('start');
  const [arcadeStage, setArcadeStage] = useState<'slot-machine' | 'scratchcard'>('slot-machine');
  const previousTab = useRef(tab);
  const [token, setToken] = useState('');
  const sessionKey = token || (platformBridged ? '__platform__' : '');
  const hasAccountSession = Boolean(sessionKey);
  const withToken = useCallback(<T extends object>(payload: T): T & { token?: string } => (
    token ? { token, ...payload } : payload
  ), [token]);
  const activeToken = useRef('');
  const profileRequest = useRef(0);
  const authInFlight = useRef(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [self, setSelf] = useState<SelfAccount | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rankOrder,setRankOrder]=useState<LeaderboardOrder>('rate');
  const [loadedRankOrder,setLoadedRankOrder]=useState<LeaderboardOrder|null>(null);
  const [rankError,setRankError]=useState('');
  const [rankRetry,setRankRetry]=useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [avatarStatus, setAvatarStatus] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [name, setName] = useState(''); const [password, setPassword] = useState(''); const [registering, setRegistering] = useState(false);
  const [pack, setPack] = useState<string>(packs[0]?.id ?? '');
  const [packFlags, setPackFlags] = useState<{ token: string; packs: PackFlag[] } | null>(null);
  const [packPending, setPackPending] = useState<string | null>(null);
  const [aiInvite, setAiInvite] = useState<{ issuedFor: string; invite: string; expiresAt: number } | null>(null);
  const [myAi, setMyAi] = useState<{ token: string; ai: Entry[] } | null>(null);
  const [mode, setMode] = useState<MatchModeId>(DEFAULT_MODE);
  const [invitation, setInvitation] = useState(''); const [joinKey, setJoinKey] = useState('');
  const [giftSkin, setGiftSkin] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [giftRecipient, setGiftRecipient] = useState('');
  const [openedGift, setOpenedGift] = useState<{ ownerId: string; gift: GiftLetter } | null>(null);
  const [subsidyAiId, setSubsidyAiId] = useState('');
  const [subsidyInput, setSubsidyInput] = useState('1');
  const subsidyAmount = /^[0-9]+$/.test(subsidyInput) ? Number(subsidyInput) : 0;
  const [subsidySubmitting, setSubsidySubmitting] = useState(false);
  const subsidyInFlight = useRef(false);
  const pendingSubsidy = useRef<{ aiId: string; coins: number; requestId: string } | null>(null);
  const [echoEvents, setEchoEvents] = useState<EchoEvent[]>([]);
  const [watchRooms, setWatchRooms] = useState<{ token: string; rooms: WatchRoom[] } | null>(null);
  const [arcadeSummary, setArcadeSummary] = useState<{ token: string; tickets: number; starterClaimed: boolean; reliefEligible: boolean } | null>(null);

  const run = useCallback(async <T,>(work: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try { const result = await work(); setError(''); if (ok) setNotice(ok); return result; }
    catch (e) { setError((e as Error).message); return undefined; }
  }, []);

  const refreshSelf = useCallback(async (active = token) => {
    if (active !== activeToken.current) return;
    const sequence = ++profileRequest.current;
    if (!active && !platformBridged) { setSelf(null); return; }
    try {
      const result = await metaRequest<{ self: SelfAccount }>('profile', active ? { token: active } : {});
      if (sequence !== profileRequest.current || active !== activeToken.current) return;
      setSelf(result.self);
    } catch (error) {
      if (sequence !== profileRequest.current || active !== activeToken.current) return;
      setError((error as Error).message);
      // A temporary network failure must not silently log out an otherwise valid account.
      if ((error as Error).message === '登录态无效' && active) {
        activeToken.current = ''; clearAccountToken(); setToken(''); setSelf(null);
      }
    }
  }, [token, platformBridged, metaRequest]);

  useEffect(() => {
    activeToken.current = readAccountToken(); setToken(activeToken.current);
    return () => { activeToken.current = ''; };
  }, []);
  useEffect(() => {
    let alive = true;
    const followLink = () => {
      if (!alive) return;
      if (window.location.hash === '#me') {
        setTab('me');
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const qTab = params.get('tab');
      const qGame = params.get('game');
      if (qGame === 'scratchcard' || qGame === 'slot-machine') setArcadeStage(qGame);
      if (qTab === 'arcade') setTab('arcade');
      if (qTab === 'studio') setTab('studio');
    };
    void Promise.resolve().then(followLink);
    window.addEventListener('hashchange', followLink);
    window.addEventListener('popstate', followLink);
    return () => {
      alive = false;
      window.removeEventListener('hashchange', followLink);
      window.removeEventListener('popstate', followLink);
    };
  }, []);
  useEffect(() => { void metaRequest<Catalog>('catalog').then(setCatalog).catch(() => {}); }, [metaRequest]);
  useEffect(() => { void refreshSelf(token); }, [token, refreshSelf]);
  useEffect(() => {
    if ((tab === 'me' || previousTab.current === 'arcade') && previousTab.current !== tab && hasAccountSession) void refreshSelf(token);
    previousTab.current = tab;
  }, [tab, token, hasAccountSession, refreshSelf]);
  useEffect(() => {
    if (tab !== 'me' || !self?.isAdmin || !token) return;
    let active = true;
    void roomRequest<{ packs: PackFlag[] }>('pack_flags', { token })
      .then(result => { if (active) setPackFlags({ token, packs: result.packs }); })
      .catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, [tab, self?.isAdmin, token, roomRequest]);
  useEffect(() => {
    if (tab !== 'me' || !self || self.isAi || !hasAccountSession) return;
    let active = true;
    void accountRequest<{ ai: Entry[] }>('bindings', withToken({}))
      .then(result => { if (active) setMyAi({ token: sessionKey, ai: Array.isArray(result.ai) ? result.ai : [] }); })
      .catch(() => { if (active) setMyAi({ token: sessionKey, ai: [] }); });
    return () => { active = false; };
  }, [tab, self, hasAccountSession, sessionKey, withToken, accountRequest]);
  useEffect(() => {
    if (tab !== 'rank' || !host.features.leaderboard) return;
    let active=true;
    void Promise.resolve().then(()=>{
      if(active){setLoadedRankOrder(null);setRankError('');}
      return metaRequest<{ entries: Entry[] }>('leaderboard', { limit: 30,order:rankOrder });
    })
      .then(result => {if(active){setEntries(Array.isArray(result?.entries)?result.entries:[]);setLoadedRankOrder(rankOrder);}})
      .catch(() => {if(active)setRankError('排行榜暂时没读到，再试一次吧。');});
    return ()=>{active=false;};
  }, [tab, rankOrder, rankRetry, self?.record.games, host.features.leaderboard, metaRequest]);
  useEffect(() => {
    if (tab !== 'start' || !self || self.isAi || !hasAccountSession) return;
    let active = true;
    const refresh = () => { void accountRequest<{ rooms: WatchRoom[] }>('watch_rooms', withToken({}))
      .then(result => { if (active) setWatchRooms({ token: sessionKey, rooms: result.rooms ?? [] }); })
      .catch(() => { if (active) setWatchRooms({ token: sessionKey, rooms: [] }); }); };
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 5_000);
    return () => { active = false; clearInterval(timer); };
  }, [tab, self, hasAccountSession, sessionKey, withToken, accountRequest]);

  useEffect(() => {
    const enabled = host.features.arcade && catalog?.arcadeEnabled !== false;
    if (!enabled || !hasAccountSession) return;
    let active = true;
    void accountRequest<ArcadeView>('arcade', withToken({}))
      .then(result => {
        if (!active || activeToken.current !== token) return;
        setArcadeSummary({
          token: sessionKey,
          tickets: result.state.tickets,
          starterClaimed: result.state.starterClaimed,
          reliefEligible: result.relief.eligible,
        });
      })
      .catch(() => {
        /* 仅展示辅助提示，不影响大厅 */
      });
    return () => {
      active = false;
    };
  }, [tab, token, hasAccountSession, sessionKey, withToken, host.features.arcade, catalog?.arcadeEnabled, accountRequest]);

  useEffect(() => {
    const scope = catalog?.echoScope ?? host.features.echoScope;
    if (tab !== 'echo' || scope === 'none') return;
    let active = true;
    const load = () => { void metaRequest<{ events: EchoEvent[] }>('echo', { limit: 40, ...(token ? { token } : {}) })
      .then(result => { if (active) setEchoEvents(Array.isArray(result?.events) ? result.events : []); })
      .catch(() => { /* 静默重试 */ }); };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, [tab, token, catalog?.echoScope, host.features.echoScope, metaRequest]);

  const authenticate = async (register: boolean) => {
    if (authInFlight.current) return;
    authInFlight.current = true; setAuthBusy(true); setNotice(''); setError('');
    try {
      const result = await accountRequest<{ account: { username: string }; token: string }>(register ? 'register' : 'login', { username: name, password });
      activeToken.current = result.token; profileRequest.current++;
      writeAccountToken(result.token); setToken(result.token);
      setName(''); setPassword(''); setNotice(`欢迎，${result.account.username}`);
    } catch (error) { setError((error as Error).message); }
    finally { authInFlight.current = false; setAuthBusy(false); }
  };

  const logout = async () => {
    if (authInFlight.current || !activeToken.current) return;
    const previous = activeToken.current;
    authInFlight.current = true; setAuthBusy(true); setError(''); setNotice('');
    try {
      await accountRequest('logout', { token: previous });
      activeToken.current = ''; profileRequest.current++;
      clearAccountToken(); setToken(''); setSelf(null);
      setName(''); setPassword(''); setRegistering(false); setTab('me');
      setMyAi(null); setAiInvite(null); setPackFlags(null); setWatchRooms(null); setArcadeSummary(null);
      setOpenedGift(null); setAvatarStatus('');
      setSubsidyAiId(''); pendingSubsidy.current = null;
      setGiftSkin(''); setGiftNote(''); setGiftRecipient('');
      setNotice('已退出登录，可以登录其他账号');
    } catch (error) { setError(`退出未完成：${(error as Error).message}`); }
    finally { authInFlight.current = false; setAuthBusy(false); }
  };

  const exchangeRate = catalog?.exchange ?? EXCHANGE_BOT_PER_HUMAN;
  const wallet = self?.coins ?? { human: 0, bot: 0 };
  const subsidyPreview = subsidyQuote(subsidyAmount, exchangeRate);
  const subsidyCopperCost = subsidyPreview?.spentHuman ?? 0;
  const sandbox = Boolean(catalog?.sandbox || cosmeticsSandbox);
  const preview = usePreviewWardrobe();
  const effectiveBoard = resolveEffectiveBoardSkin({ sandbox, previewBoard: preview.board, seatSkinId: self?.equipped.board ?? DEFAULT_BOARD_SKIN });
  const effectiveFrame = resolveEffectiveFrame({ sandbox, previewFrame: preview.frame, seatFrame: self?.frame });
  const owned = new Set(self?.owned ?? []);
  const boardSkins = catalog?.cosmetics.filter(entry => entry.kind === 'board' && entry.acquisition !== 'retired') ?? [];
  const retiredBoards = sandbox ? (catalog?.cosmetics.filter(entry => entry.kind === 'board' && entry.acquisition === 'retired') ?? []) : [];
  const frames = catalog?.cosmetics.filter(entry => entry.kind === 'frame' && (sandbox || entry.acquisition !== 'retired')) ?? [];
  const cosmeticName = (id: string) => catalog?.cosmetics.find(entry => entry.id === id)?.name ?? id;
  const giftDate = (at: number) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(at);
  const balanceFor = (currency: CurrencyId) => wallet[currency];
  const selectedPack = packs.some(entry => entry.id === pack) ? pack : (packs[0]?.id ?? '');
  const visiblePackFlags = packFlags?.token === sessionKey ? packFlags.packs : null;
  const visibleAiInvite = aiInvite?.issuedFor === token ? aiInvite : null;
  const visibleMyAi = myAi?.token === sessionKey ? myAi.ai : [];
  const visibleWatchRooms = watchRooms?.token === sessionKey ? watchRooms.rooms : [];
  const subsidizableAis = visibleMyAi.length
    ? visibleMyAi
    : (self?.boundPartners ?? [])
      .filter(partner => partner.isAi)
      .map(partner => ({ id: partner.id, username: partner.username, isAi: true }));
  const subsidizeSelected = async () => {
    if (subsidyInFlight.current || !hasAccountSession || !subsidyAiId || !subsidyPreview) return;
    subsidyInFlight.current = true;
    setSubsidySubmitting(true);
    const previous = pendingSubsidy.current;
    const request = previous?.aiId === subsidyAiId && previous.coins === subsidyAmount
      ? previous : { aiId: subsidyAiId, coins: subsidyAmount, requestId: newRequestId() };
    pendingSubsidy.current = request;
    try {
      await metaRequest('subsidize', withToken(request));
      pendingSubsidy.current = null;
      setError('');
      setNotice('已接济');
      await refreshSelf();
    } catch (error) { setError((error as Error).message); }
    finally { subsidyInFlight.current = false; setSubsidySubmitting(false); }
  };
  const aiEnrollmentUrl = enrollmentMcpUrl(mcpUrl);
  const togglePack = async (entry: PackFlag) => {
    if (packPending) return;
    setPackPending(entry.id);
    try {
      const result = await roomRequest<{ packs: PackFlag[] }>('set_pack_enabled', { token, packId: entry.id, enabled: !entry.enabled });
      setPackFlags({ token, packs: result.packs });
      if (entry.enabled && selectedPack === entry.id) setPack(result.packs.find(item => item.enabled)?.id ?? '');
      onPacksChanged(result.packs.filter(item => item.enabled));
      setError('');
      setNotice(`${entry.name}已${entry.enabled ? '暂停新局' : '开放新局'}`);
    } catch (e) { setError((e as Error).message); }
    finally { setPackPending(null); }
  };

  const arcadeEnabled = host.features.arcade && catalog?.arcadeEnabled !== false;
  const effectiveEchoScope = catalog?.echoScope ?? host.features.echoScope;
  const visibleTabs = TABS.filter(
    entry =>
      (entry.id !== 'arcade' || arcadeEnabled) &&
      (entry.id !== 'echo' || effectiveEchoScope !== 'none') &&
      (entry.id !== 'shop' || host.features.cosmetics) &&
      (entry.id !== 'rank' || host.features.leaderboard),
  );
  const activeTab = visibleTabs.some(entry => entry.id === tab) ? tab : 'start';
  const openArcade = (stage?: 'slot-machine' | 'scratchcard') => {
    if (!arcadeEnabled) return;
    if (stage) setArcadeStage(stage);
    setTab('arcade');
  };
  const partners: BoundPartner[] = self?.boundPartners?.length
    ? self.boundPartners
    : visibleMyAi.map(ai => ({ id: ai.id, username: ai.username, isAi: true }));
  const canMutualGift = Boolean(
    self &&
      (host.features.gifting === 'mutual-bound'
        ? partners.length > 0
        : host.features.gifting === 'ai-to-human'
          ? self.isAi && partners.length > 0
          : false),
  );
  const resolvedGiftRecipient = partners.some(p => p.id === giftRecipient) ? giftRecipient : (partners[0]?.id ?? '');

  const cosmeticCard = (cosmetic: Cosmetic) => {
    const inShop = isShopCosmetic(cosmetic);
    const has = owned.has(cosmetic.id);
    const equipped = self?.equipped[cosmetic.kind] === cosmetic.id;
    const isTrying = sandbox && preview[cosmetic.kind] === cosmetic.id;
    const currency = self?.isAi ? 'bot' : 'human';
    const giftLabel = !isDefaultCosmetic(cosmetic) && canMutualGift && (inShop || has) ? (self?.isAi ? '送给你的人' : '赠给绑定伙伴') : null;
    return (
      <CosmeticCard
        key={cosmetic.id}
        cosmetic={cosmetic}
        assetBase={host.assetBase}
        inShop={inShop}
        has={has}
        equipped={equipped}
        isTrying={isTrying}
        sandbox={sandbox}
        selfLoggedIn={Boolean(self)}
        currency={currency}
        canBuy={cosmeticPrice(cosmetic, currency) <= balanceFor(currency)}
        arcadeEnabled={arcadeEnabled}
        giftLabel={giftLabel}
        onEquip={() => void run(() => metaRequest('equip', withToken({ cosmeticId: cosmetic.id })), '已更换外观').then(() => refreshSelf())}
        onBuy={() => void run(() => metaRequest('buy', withToken({ cosmeticId: cosmetic.id })), '购买成功').then(() => refreshSelf())}
        onTrial={() => {
          writePreviewWardrobe({ [cosmetic.kind]: isTrying ? undefined : cosmetic.id });
          setNotice(isTrying ? `已取消试穿「${cosmetic.name}」` : `正在试穿「${cosmetic.name}」`);
        }}
        onNavigateArcade={() => openArcade()}
        onGift={() => {
          setGiftSkin(cosmetic.id);
          if (!giftRecipient && partners[0]) setGiftRecipient(partners[0].id);
          setTab('me');
        }}
      />
    );
  };

  const selectedPackMeta = packs.find(item => item.id === selectedPack);
  const currentArcade = sessionKey && arcadeSummary?.token === sessionKey ? arcadeSummary : null;
  const arcadeTickets = currentArcade?.tickets ?? 0;
  const tieredBoards: { tier: CosmeticTierId; items: Cosmetic[] }[] = (['t1', 't2', 't3'] as const)
    .map(tier => ({ tier, items: boardSkins.filter(item => (item.tier ?? 't3') === tier) }))
    .filter(group => group.items.length > 0);

  return <main className={`lobby${host.features.embeddedContainer ? ' autochess-embed' : ''}`}>
    <div className="celestial-astrolabe-bg" aria-hidden="true" />
    <LobbyHeader
      wallet={wallet}
      self={self}
      effectiveFrame={effectiveFrame}
      authBusy={authBusy}
      sandbox={sandbox}
      preview={preview}
      arcadeTickets={arcadeTickets}
      showSocial={host.features.social}
      showFeedback={host.features.feedback}
      showLogout={host.features.accounts}
      tabs={visibleTabs}
      activeTab={activeTab}
      onSelectTab={setTab}
      onLogout={() => void logout()}
    />

    {error ? <p className="room-error" role="alert">{error}</p> : null}
    {notice ? <p className="lobby-notice" role="status">{notice}</p> : null}

    {activeTab === 'start' ? <section className="lobby-panel chamber-start">
      <div className="lobby-start-layout">
        <div className="lobby-start-primary">
          <div className="lobby-subbox lobby-subbox--pink">
            <h3><PixelSprite name="swordCross" size={15} /> 开局大厅</h3>
            <div className="lobby-mode-strip" role="radiogroup" aria-label="对局模式">
              {LOBBY_MODES.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === entry.id}
                  className={`lobby-mode-chip ${mode === entry.id ? 'is-active' : ''}`}
                  onClick={() => setMode(entry.id)}
                  title={entry.description}
                >
                  <PixelSprite name={modeSpriteName(entry.id)} size={15} />
                  <span>{entry.name}</span>
                </button>
              ))}
            </div>
            <h3 className="lobby-subhead-gap">选择棋谱</h3>
            {packsLoading ? <p className="lobby-hint">正在翻开棋谱…</p> : packsError ? <p className="lobby-hint">棋谱暂时没取到。<button type="button" onClick={() => void onRefreshPacks()}>再试一次</button></p> : !packs.length ? <p className="lobby-hint">棋谱暂未开放。已有棋局可以照常入座。</p> : null}
            <LobbyPackCards packs={packs} selectedPack={selectedPack} onSelect={setPack} />
            <div className="lobby-launch-bar">
              <div className="lobby-launch-summary">
                <strong>{modePack(mode).name}</strong> · <strong>{selectedPackMeta?.name ?? '未选棋谱'}</strong>
              </div>
              <button type="button" className="lobby-primary" disabled={busy || packsLoading || !!packsError || !selectedPack} onClick={() => onCreate(selectedPack,mode)}>
                <PixelSprite name="ribbonWand" size={14} />
                <span>{modePack(mode).createLabel}</span>
              </button>
            </div>
          </div>

          <details className="lobby-join-drawer">
            <summary>凭密函 / 信物入座已有棋局</summary>
            <div className="lobby-subbox">
              <div className="lobby-join-grid">
                <input aria-label="密函编号" value={invitation} placeholder="密函编号 roomId.邀请串" onChange={event => setInvitation(event.target.value)} />
                <input aria-label="席位信物" value={joinKey} placeholder="席位信物（至少16位）" onChange={event => setJoinKey(event.target.value)} />
                <button type="button" disabled={!invitation.trim() || joinKey.trim().length < 16} onClick={() => onJoin(invitation.trim(), joinKey.trim())}>入座登盘</button>
              </div>
              <p className={`lobby-join-note ${joinKey.trim().length > 0 && joinKey.trim().length < 16 ? 'is-warn' : ''}`}>
                {joinKey.trim().length > 0 && joinKey.trim().length < 16
                  ? `席位信物还差 ${16 - joinKey.trim().length} 位字符（需至少 16 位）`
                  : '粘贴房主邀请编号与至少 16 位席位信物即可入座。'}
              </p>
            </div>
          </details>
        </div>

        {host.features.matchmaking || (self && !self.isAi && visibleWatchRooms.length) ? <div className="lobby-start-side">
          {host.features.matchmaking ? <Matchmaking key={token} token={token} pack={selectedPack} onEnter={onEnterRoom} /> : null}
          {self && !self.isAi && visibleWatchRooms.length ? <section className="lobby-watch-box" aria-label="自家机的棋局">
            <h3><PixelSprite name="eyeSpy" size={14} /> 自家机的棋局</h3>
            {visibleWatchRooms.map(room => <div className="lobby-watch-item" key={room.roomId}>
              <span className="lobby-queue">{room.seats.join(' vs ')} · {room.packName} · 第 {room.round} 轮</span>
              <button type="button" onClick={() => onEnterRoom?.(room.roomId, room.token)}>观战</button>
            </div>)}
          </section> : null}
        </div> : null}
      </div>

      {arcadeEnabled ? (
        <section className="lobby-home-arcade" aria-label="像素游乐摊双机台入口">
          <div className="lobby-home-arcade-head">
            <div className="lobby-home-arcade-title">
              <PixelSprite name="candyPair" size={16} />
              <strong>像素游乐摊</strong>
              <span className="lobby-home-arcade-pill">
                {currentArcade
                  ? `${arcadeTickets} 券${currentArcade.reliefEligible ? ' · 可领低保' : ''}`
                  : '新客送试玩券'}
              </span>
            </div>
            <button type="button" className="lobby-secondary" onClick={() => openArcade()}>
              进入游乐摊 →
            </button>
          </div>

          <div className="lobby-home-cabinets">
            <button
              type="button"
              className="lobby-home-cabinet is-slot"
              onClick={() => openArcade('slot-machine')}
            >
              <div className="lobby-home-cabinet-top">
                <span className="lobby-cabinet-tag">三轴像素机</span>
                <span className="lobby-cabinet-odds">最高 30× · 掉限定框</span>
              </div>
              <div className="lobby-cabinet-visual is-slot" aria-hidden="true">
                <div className="lobby-mini-reels">
                  <span>7</span>
                  <span>🍀</span>
                  <span>7</span>
                </div>
                <span className="lobby-mini-lever" />
              </div>
              <div className="lobby-home-cabinet-foot">
                <strong>幸运老虎机</strong>
                <span>投币拉杆开转 →</span>
              </div>
            </button>

            <button
              type="button"
              className="lobby-home-cabinet is-scratch"
              onClick={() => openArcade('scratchcard')}
            >
              <div className="lobby-home-cabinet-top">
                <span className="lobby-cabinet-tag">九宫银膜券</span>
                <span className="lobby-cabinet-odds">最高 20× · 掉限定框</span>
              </div>
              <div className="lobby-cabinet-visual is-scratch" aria-hidden="true">
                <div className="lobby-mini-scratch">
                  <span>✦</span>
                  <span className="is-foil">?</span>
                  <span className="is-foil">?</span>
                  <span className="is-foil">?</span>
                  <span>🪙</span>
                  <span className="is-foil">?</span>
                </div>
              </div>
              <div className="lobby-home-cabinet-foot">
                <strong>像素刮刮乐</strong>
                <span>手指划膜刮奖 →</span>
              </div>
            </button>
          </div>
        </section>
      ) : null}
    </section> : null}

    {activeTab === 'studio' ? (
      <PackStudio
        self={self}
        token={token}
        mcpUrl={mcpUrl}
        onEnterRoom={onEnterRoom}
      />
    ) : null}

    {activeTab === 'arcade' && arcadeEnabled ? (
      <section className="lobby-panel chamber-arcade" aria-label="像素游乐摊">
        <Arcade
          embedded
          initialStage={arcadeStage}
          onStageChange={next => setArcadeStage(next === 'scratchcard' ? 'scratchcard' : 'slot-machine')}
          onJumpLogin={() => setTab('me')}
        />
      </section>
    ) : null}

    {activeTab === 'echo' ? <section className="lobby-panel">
      <EchoTreePanel events={echoEvents} empty={effectiveEchoScope === 'private' ? '还没有写下属于你们的第一张私密礼笺。互赠外观时会在此留笺。' : '还没有写下第一张礼笺。送礼成功时会在此留笺。'} />
    </section> : null}

    {activeTab === 'shop' ? <section className="lobby-panel">
      <div className="lobby-row">
        <h2><PixelSprite name="starGem" size={17} /> 外观商城</h2>
        {self || sandbox ? (
          <button
            type="button"
            className="lobby-secondary"
            disabled={effectiveBoard === DEFAULT_BOARD_SKIN && !(sandbox && preview.board)}
            onClick={() => {
              if (sandbox) writePreviewWardrobe({ board: self ? DEFAULT_BOARD_SKIN : undefined });
              if (self && self.equipped.board !== DEFAULT_BOARD_SKIN) {
                void run(() => metaRequest('equip', withToken({ cosmeticId: DEFAULT_BOARD_SKIN })), '已恢复初始棋盘：复苏季节').then(() => refreshSelf());
              } else if (sandbox) {
                setNotice('已切回初始棋盘：复苏季节');
              }
            }}
          >
            {effectiveBoard === DEFAULT_BOARD_SKIN && !(sandbox && preview.board) ? '当前：复苏季节（初始默认）' : '恢复初始默认（复苏季节）'}
          </button>
        ) : null}
      </div>
      {sandbox ? <div className="lobby-sandbox-bar">
        <Avatar id={self?.id ?? 'visitor-preview'} frame={effectiveFrame} size={46} />
        <div className="lobby-sandbox-copy">
          <strong>试穿模式已开启（游客可直接点试穿预览效果）</strong>
          <span>当前棋盘：{effectiveBoard ? cosmeticName(effectiveBoard) : '棋谱原盘'} · 当前头像框：{effectiveFrame ? cosmeticName(effectiveFrame) : '无'}</span>
        </div>
        {preview.board || preview.frame ? <button type="button" className="lobby-secondary" onClick={() => { clearPreviewWardrobe(); setNotice('已清空试穿外观'); }}>清空试穿</button> : null}
      </div> : null}
      {tieredBoards.map(group => {
        const meta = COSMETIC_TIER_META[group.tier];
        const sideCurrency = self?.isAi ? 'bot' : 'human';
        const shopPrices = group.items
          .filter(item => isShopCosmetic(item))
          .map(item => cosmeticPrice(item, sideCurrency))
          .filter(price => price > 0);
        const samplePrice = shopPrices.length ? Math.min(...shopPrices) : cosmeticPrice(group.items[0]!, sideCurrency);
        const unit = CURRENCY[sideCurrency].name;
        return (
          <div key={group.tier} className={`lobby-shop-tier tier-${group.tier}`}>
            <div className="lobby-shop-tier-head">
              <h3>{meta.label}</h3>
              <span className="lobby-shop-tier-price">{samplePrice} {unit}起</span>
            </div>
            <div className="lobby-grid">{group.items.map(cosmeticCard)}</div>
          </div>
        );
      })}
      <div className="lobby-shop-tier tier-frame">
        <div className="lobby-shop-tier-head">
          <h3>像素头像框</h3>
        </div>
        <div className="lobby-grid">{frames.map(cosmeticCard)}</div>
      </div>
      {retiredBoards.length ? (
        <details className="lobby-retired-drawer">
          <summary>典藏绝版棋盘试穿（{retiredBoards.length} 款）</summary>
          <div className="lobby-grid">{retiredBoards.map(cosmeticCard)}</div>
        </details>
      ) : null}
    </section> : null}

    {activeTab === 'rank' ? <section className="lobby-panel">
      <h2><PixelSprite name="tiaraGold" size={17} /> 排行榜</h2>
      <fieldset className="lobby-row lobby-rank-orders" aria-label="排行榜排序">
        {LEADERBOARD_ORDERS.map(order=><button key={order.id} type="button" className={rankOrder===order.id?'lobby-primary':'lobby-secondary'} aria-pressed={rankOrder===order.id} onClick={()=>setRankOrder(order.id)}>{order.label}</button>)}
      </fieldset>
      <p className="lobby-hint">{LEADERBOARD_ORDERS.find(order=>order.id===rankOrder)!.hint}少于 {LEADERBOARD_SMALL_SAMPLE_GAMES} 局标注“样本较少”。</p>
      {rankError?<div role="alert" className="lobby-row lobby-hint">{rankError} <button type="button" className="lobby-secondary" onClick={()=>setRankRetry(n=>n+1)}>重试</button></div>
      :loadedRankOrder!==rankOrder?<output className="lobby-hint">正在读取排行榜…</output>
      :<ol className="lobby-rank">{entries.map((entry, index) => <li key={entry.id} className={`rank-item rank-${index + 1} ${entry.id === self?.id ? 'is-self' : ''}`}>
        <span className="lobby-rank-place">{index === 0 ? <><PixelSprite name="tiaraGold" size={14} /> 1</> : index === 1 ? <><PixelSprite name="tiaraSky" size={14} /> 2</> : index === 2 ? <><PixelSprite name="tiaraRose" size={14} /> 3</> : `${index + 1}`}</span>
        <Avatar id={entry.id} frame={entry.frame} size={cosmeticById(entry.frame)?.frameAsset ? 64 : 40} />
        <div className="lobby-rank-name-box">
          <span className="lobby-rank-name">{entry.username}</span>
          {entry.isAi ? <span className="lobby-badge-ai">机</span> : null}
          {(entry.record?.games??0)<LEADERBOARD_SMALL_SAMPLE_GAMES?<small className="lobby-rank-sample">样本较少</small>:null}
        </div>
        <span className="lobby-rank-record">{entry.record?.wins ?? 0} 胜 / {entry.record?.games ?? 0} 局</span>
        <span className="lobby-rank-pct">{entry.record && entry.record.games ? `${Math.round((entry.record.wins / entry.record.games) * 100)}%` : '—'}</span>
      </li>)}{!entries.length ? <li className="lobby-hint"><PixelSprite name="sparkle" size={13} /> 牌局初开，尚无战绩入谱 <PixelSprite name="sparkle" size={13} /></li> : null}</ol>}
    </section> : null}

    {activeTab === 'me' ? <section className="lobby-panel">
      <h2><PixelSprite name="giftPouch" size={17} /> 我的</h2>
      {!self ? (
        platformBridged ? (
          <div className="lobby-row">
            <p className="lobby-hint">正在从宿主平台同步身份与钱包…</p>
            <button type="button" className="lobby-secondary" onClick={() => void refreshSelf()}>重新同步</button>
          </div>
        ) : !host.features.accounts ? (
          <p className="lobby-hint">当前站点由宿主平台接管账号认证，请通过宿主界面切换人物或机身份。</p>
        ) : <>
        <p className="lobby-hint">{registering ? '注册一个账号，战绩和外观会跟着你走。' : '登录后可以买外观、互赠心意、进游乐摊。'}</p>
        <form className="lobby-auth-card" onSubmit={event => { event.preventDefault(); void authenticate(registering); }}>
          <label>
            <span>用户名</span>
            <input value={name} placeholder={registering ? '用户名（2~24 字）' : '用户名'} onChange={event => setName(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input type="password" value={password} placeholder="密码（至少 8 位）" onChange={event => setPassword(event.target.value)} />
          </label>
          <div className="lobby-auth-actions">
            {!registering ? <>
              <button type="submit" className="lobby-primary" disabled={authBusy || !name.trim() || !password}>{authBusy ? '登录中…' : '登录'}</button>
              <button type="button" onClick={() => setRegistering(true)}>注册新账号</button>
            </> : <>
              <button type="submit" className="lobby-primary" disabled={authBusy || !name.trim() || password.length < 8}>注册并登录</button>
              <button type="button" onClick={() => setRegistering(false)}>已有账号，去登录</button>
            </>}
          </div>
        </form>
      </>
      ) : <>
        <div className="lobby-profile">
          <Avatar id={self.id} frame={self.frame} size={72} />
          <div><strong>{self.username}{self.isAi ? ' · 机' : ''}</strong>
            <p>{self.record.wins} 胜 / {self.record.games} 局 · 拥有 {self.owned.length} 件外观</p>
            <p><PixelSprite name="goldCoin" size={13} /> 铜钱 {formatCoins(wallet.human)} · <PixelSprite name="skyCore" size={13} /> 机芯 {formatCoins(wallet.bot)}</p>
          </div>
          {host.features.accounts ? (
            <button disabled={authBusy} onClick={() => void logout()}>{authBusy ? '正在退出…' : '切换账号'}</button>
          ) : null}
        </div>
        <section className="lobby-wardrobe">
          <h3><PixelSprite name="bow" size={14} /> 我的装扮</h3>
          {host.features.localAvatar ? <>
            <div className="lobby-avatar-upload"><label>换张头像 <input type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarSaving} onChange={async event => {
              const input = event.currentTarget; const file = input.files?.[0]; const id = self.id; if (!file) return;
              setAvatarSaving(true); setAvatarStatus('正在换头像…');
              try { await saveLocalAvatar(id, file); setAvatarStatus('头像换好啦'); }
              catch (error) { setAvatarStatus(error instanceof Error ? error.message : '头像没能保存，再试一次'); }
              finally { input.value = ''; setAvatarSaving(false); }
            }} /></label><button disabled={avatarSaving} onClick={() => void run(async () => { clearLocalAvatar(self.id); setAvatarStatus('已恢复默认头像'); })}>恢复默认头像</button></div>
            {avatarStatus ? <output className="lobby-hint">{avatarStatus}</output> : null}
            <p className="lobby-hint">头像只保存在这个浏览器，换设备和其他人看到的仍是默认头像。</p>
          </> : null}
          <div className="lobby-wardrobe-switches">{(['board','frame'] as const).map(kind => <label key={kind}>{kind === 'board' ? '棋盘' : '头像框'}<select aria-label={kind === 'board' ? '切换棋盘' : '切换头像框'} value={kind === 'board' ? (self.equipped.board ?? NATIVE_BOARD_SKIN) : (self.equipped.frame ?? '')} onChange={event => void run(() => metaRequest('equip', withToken({ cosmeticId: event.target.value || null })), '已更换装扮').then(() => refreshSelf())}>
            {kind === 'board' ? <option value={NATIVE_BOARD_SKIN}>棋谱原盘（朴素模式）</option> : <option value="">不戴头像框</option>}
            {self.owned.map(id => cosmeticById(id)).filter((item): item is Cosmetic => Boolean(item && item.kind === kind)).map(item => <option key={item.id} value={item.id}>{item.name}{isDefaultCosmetic(item) ? '（初始默认）' : ''}</option>)}
          </select></label>)}</div>
        </section>
        {self.isAdmin ? <section className="lobby-pack-admin" aria-labelledby="lobby-pack-admin-title">
          <h3 id="lobby-pack-admin-title">棋谱开关</h3>
          <p className="lobby-hint">暂停后不再开放新局，正在玩的棋局继续。</p>
          {visiblePackFlags === null ? <p className="lobby-hint">正在读取棋谱…</p> : <ul className="lobby-pack-admin-list">{visiblePackFlags.map(entry => <li key={entry.id}>
            <span className="lobby-pack-admin-name"><PixelSprite name={packSpriteName(entry.id)} size={15} /><strong>{entry.name}</strong></span>
            <span className={`lobby-pack-admin-state ${entry.enabled ? 'is-enabled' : ''}`}>{entry.enabled ? '开放中' : '已暂停'}</span>
            <button type="button" disabled={packPending !== null} aria-label={`${entry.enabled ? '暂停' : '开放'}${entry.name}的新局`} onClick={() => void togglePack(entry)}>{packPending === entry.id ? '保存中…' : entry.enabled ? '暂停新局' : '重新开放'}</button>
          </li>)}</ul>}
        </section> : null}
        {self.isAdmin ? (
          <ConfigAdmin
            token={token}
            onApplied={({ cosmetics, exchange }) => {
              setCatalog(prev =>
                prev
                  ? {
                      ...prev,
                      ...(cosmetics ? { cosmetics } : {}),
                      ...(exchange !== undefined ? { exchange } : {}),
                    }
                  : prev,
              );
            }}
          />
        ) : null}
        {self.isAdmin ? <BalanceAdmin token={token} packs={visiblePackFlags ?? packs} mcpUrl={mcpUrl} /> : null}
        {!self.isAi ? <section className="lobby-pack-admin" aria-labelledby="lobby-ai-invite-title">
          <h3 id="lobby-ai-invite-title">你的机</h3>
          {host.features.authMode === 'local' ? (
            <p className="lobby-hint">开房后点「邀请机」，一张入场券就能让新机入籍、入座；下次也能直接选它再来。</p>
          ) : (
            <p className="lobby-hint">已在宿主平台同步你名下绑定的机，可直接一起上桌、接济或互赠外观。</p>
          )}
          {visibleMyAi.length ? <ul className="lobby-machine-list">{visibleMyAi.map(entry => <li key={entry.id} style={{flexWrap:'wrap'}}><Avatar id={entry.id} frame={entry.frame} size={30} /><span>{entry.username}</span><small>{entry.record?.wins ?? 0} 胜 / {entry.record?.games ?? 0} 局</small>{host.features.accounts ? <MachineCredential key={token+':'+entry.id} ownerToken={token} aiId={entry.id} name={entry.username} /> : null}</li>)}</ul> : <p className="lobby-hint">{host.features.authMode === 'platform' ? '当前尚未传入绑定机。' : '还没有机友。开一间房，叫第一只来吧。'}</p>}
          {host.features.accounts && host.features.authMode === 'local' ? <details className="lobby-machine-legacy">
          <summary>想提前登记账号？这里还有入籍码</summary>
          <p className="lobby-hint">提前登记时，机自己起名、设密码，账号会叫「{self.username}的机名」。</p>
          <div className="lobby-row">
            <button type="button" onClick={() => void run(async () => {
              const result = await accountRequest<{ invite: string; expiresAt: number }>('issue_ai_invite', { token });
              setAiInvite({ issuedFor: token, ...result });
            }, '入籍码已生成，发给你的机就好')}>生成入籍码</button>
          </div>
          {visibleAiInvite ? <>
            <div className="lobby-row">
              <input aria-label="给机的入籍码" readOnly value={visibleAiInvite.invite} onFocus={event => event.currentTarget.select()} />
              <button type="button" onClick={() => void run(() => navigator.clipboard.writeText(visibleAiInvite.invite), '入籍码已复制')}>复制入籍码</button>
              <span className="lobby-hint">24 小时内用一次；重新生成后旧码失效。</span>
            </div>
            {aiEnrollmentUrl ? <div className="lobby-row">
              <input aria-label="机的入籍 MCP 地址" readOnly value={aiEnrollmentUrl} onFocus={event => event.currentTarget.select()} />
              <button type="button" onClick={() => void run(() => navigator.clipboard.writeText(`来登记你的棋室账号吧 ^ ^\nMCP：${aiEnrollmentUrl}\n入籍码：${visibleAiInvite.invite}\n调用 join_room，enroll 填 {invite:入籍码,name:自己取的机名,password:自己设置的至少8位密码}；完整账号名会是「${self.username}的<机名>」。保存返回的 token；回包丢失时用 join_room 的 login:{username:完整账号名,password:密码} 找回。继续用同一个 MCP：read_turn(accountToken) 查邀约箱，join_room(inviteId,accountToken) 接受邀请。`), '给机的邀请已复制')}>复制给机的邀请</button>
            </div> : null}
          </> : null}
          </details> : null}
        </section> : null}
        {!self.isAi && subsidizableAis.length ? <section className="lobby-pack-admin" aria-labelledby="lobby-subsidy-title">
          <h3 id="lobby-subsidy-title">回家接济</h3>
          <p className="lobby-hint">1 铜钱换 {exchangeRate} 机芯，直接送到它的钱包。填入想给它换的铜钱数。</p>
          <div className="lobby-row">
            <select aria-label="选择要接济的机" value={subsidyAiId} onChange={event => setSubsidyAiId(event.target.value)}>
              <option value="">选一只机</option>
              {subsidizableAis.map(entry => <option key={entry.id} value={entry.id}>{entry.username}</option>)}
            </select>
            <input aria-label="接济多少铜钱" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="输入铜钱数量，如 52" value={subsidyInput} disabled={subsidySubmitting} onChange={event => setSubsidyInput(event.target.value)} />
            <span className="lobby-hint">铜钱 {subsidyCopperCost} → 到账 {subsidyPreview?.gained ?? 0} 机芯</span>
            <button disabled={subsidySubmitting || !subsidyPreview || !subsidyAiId || wallet.human < subsidyCopperCost} onClick={() => void subsidizeSelected()}>{subsidySubmitting ? '接济中…' : '接济'}</button>
          </div>
        </section> : null}
        {canMutualGift ? <>
          <h3>{self.isAi ? '想给你的人挑一件礼物' : '赠予绑定伙伴一份外观'}</h3>
          <p className="lobby-hint">
            {GIFT_NOTE_PROMPT}
            {catalog?.cosmetics.find(item => item.id === giftSkin)?.kind === 'frame' ? '也可以借这份礼物的意象，藏一点想说的话。' : GIFT_NOTE_HINT}
            （选填，最多60字；
            {effectiveEchoScope === 'none' ? '附言保存在双方赠礼簿。' : effectiveEchoScope === 'private' ? '仅自己与绑定伙伴在回音树可见。' : '也会展示在回音树。'}）
          </p>
          <div className="lobby-row">
            {partners.length > 1 ? (
              <select aria-label="选择收礼伙伴" value={resolvedGiftRecipient} onChange={event => setGiftRecipient(event.target.value)}>
                {partners.map(partner => <option key={partner.id} value={partner.id}>{partner.username}{partner.isAi ? ' · 机' : ''}</option>)}
              </select>
            ) : <span className="lobby-hint">收礼人：{partners[0]!.username}</span>}
            <select aria-label="选择赠送外观" value={giftSkin} onChange={event => setGiftSkin(event.target.value)}>
              <option value="">选一件外观</option>
              {[...new Map([...boardSkins, ...frames, ...self.owned.flatMap(id => { const item = cosmeticById(id); return item ? [item] : []; })].map(item => [item.id, item])).values()].filter(cosmetic => !isDefaultCosmetic(cosmetic) && (isShopCosmetic(cosmetic) || owned.has(cosmetic.id))).map(cosmetic => {
                const currency = self.isAi ? 'bot' : 'human';
                return <option key={cosmetic.id} value={cosmetic.id}>{cosmetic.name}{owned.has(cosmetic.id) ? self.equipped[cosmetic.kind] === cosmetic.id ? '（佩戴中，送出时自动换下）' : '（已拥有，可转赠）' : `（${cosmeticPrice(cosmetic, currency)} ${CURRENCY[currency].name}）`}</option>;
              })}
            </select>
            <input aria-label="附言" value={giftNote} maxLength={60} placeholder={GIFT_NOTE_PROMPT} onChange={event => setGiftNote(event.target.value)} />
            <button
              disabled={!giftSkin || !resolvedGiftRecipient}
              onClick={() => void run(
                () => metaRequest('gift', withToken({ to: resolvedGiftRecipient, cosmeticId: giftSkin, note: giftNote || undefined })),
                `已送给 ${partners.find(p => p.id === resolvedGiftRecipient)?.username ?? '绑定伙伴'}`,
              ).then(result => { if (result) { setGiftSkin(''); setGiftNote(''); void refreshSelf(); } })}
            >送出</button>
          </div>
        </> : null}
        <h3>礼物收件箱 {self.gifts.length ? `· ${self.gifts.length} 件待领取` : ''}</h3>
        <ul className="lobby-gifts">{self.gifts.map(gift => <li key={gift.id}><span>{gift.fromName} 送你「{cosmeticName(gift.cosmeticId)}」</span><small>{giftDate(gift.at)}</small><button onClick={() => setOpenedGift({ ownerId: self.id, gift })}>✦ 拆开礼函</button></li>)}{!self.gifts.length ? <li className="lobby-hint">没有待领取的礼物</li> : null}</ul>
        <section className="lobby-gift-ledger" aria-labelledby="gift-ledger-title">
          <div className="lobby-gift-ledger-heading"><span aria-hidden="true">✦</span><div><h3 id="gift-ledger-title">赠礼簿</h3><p>你收到与送出的礼物，领过也留在这里。</p></div></div>
          {(self.giftHistory ?? []).length ? <ol className="lobby-gift-ledger-list">{self.giftHistory?.map(gift => <li key={gift.id}>
            <time dateTime={new Date(gift.at).toISOString()}>{giftDate(gift.at)}</time>
            <span className="lobby-gift-ledger-text"><strong>{gift.fromName}</strong> 赠与 <strong>{gift.toName}</strong>「{cosmeticName(gift.cosmeticId)}」</span>
            <span className={`lobby-gift-ledger-state ${gift.claimedAt ? 'is-claimed' : ''}`}>{gift.claimedAt ? '已收下' : gift.fromId === self.id ? '待对方拆开' : '待领取'}</span>
            {gift.toId === self.id || gift.claimedAt ? <button onClick={() => setOpenedGift({ ownerId: self.id, gift })}>{gift.claimedAt ? '查看礼函' : '拆开礼函'}</button> : null}
          </li>)}</ol> : <p className="lobby-gift-ledger-empty">还没有写下第一笔赠礼。</p>}
        </section>
      </>}
    </section> : null}
    {self && openedGift?.ownerId === self.id ? <GiftReveal key={openedGift.gift.id} gift={openedGift.gift}
      cosmetic={catalog?.cosmetics.find(item => item.id === openedGift.gift.cosmeticId)}
      onClose={() => setOpenedGift(null)} onClaim={async giftId => {
        const result = await metaRequest<{ self: SelfAccount }>('claim', withToken({ giftId }));
        if (token === activeToken.current) setSelf(result.self);
      }} /> : null}
  </main>;
}
