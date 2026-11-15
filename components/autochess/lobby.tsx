'use client';
import { LOBBY_MODES, DEFAULT_MODE, modePack, type MatchModeId } from '@/packs/modes/registry';
import type { PackSummary } from '@/packs/registry';
import { CHESS_NAME } from '@/lib/meta/chess-brand';
import { enrollmentMcpUrl } from '@/lib/autochess/invite-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { avatarImage, cosmeticPrice, cosmeticById, cosmeticImage, frameImage, frameLayoutFor, frameArtTransform, isShopCosmetic, NATIVE_BOARD_SKIN, type Cosmetic, type CosmeticKind } from '@/lib/meta/cosmetics';
import { clearPreviewWardrobe, resolveEffectiveBoardSkin, resolveEffectiveFrame, usePreviewWardrobe, writePreviewWardrobe } from '@/lib/meta/preview-wardrobe';
import { CURRENCY, EXCHANGE_BOT_PER_HUMAN, subsidyQuote, formatCoins, type CurrencyId, type Wallet } from '@/lib/meta/economy';
import { clearAccountToken, readAccountToken, writeAccountToken } from './account-session';
import { accountRequest, roomRequest, metaRequest } from './room-request';
import { EchoTreePanel } from './echo-tree';
import BalanceAdmin from './balance-admin';
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

type SelfAccount = {
  id: string; username: string; isAi: boolean; isAdmin: boolean; frame?: string;
  coins: Wallet; owned: string[]; equipped: Partial<Record<CosmeticKind, string>>;
  gifts: GiftLetter[];
  giftHistory?: { id: string; fromId: string; fromName: string; toId: string; toName: string; cosmeticId: string; at: number; claimedAt?: number; note?: string }[];
  ownerName?: string;
  record: { games: number; wins: number };
};
type Catalog = { cosmetics: Cosmetic[]; exchange: number; reward: { play: number; win: number }; defaultSkin: string; wheelEnabled?: boolean; sandbox?: boolean };
type Entry = { id: string; username: string; isAi: boolean; frame?: string; record?: { games: number; wins: number } };
type PackFlag = PackSummary & { enabled: boolean };
type WatchRoom = { roomId: string; token: string; packName: string; round: number; phase: string; seats: string[] };

const TABS: readonly { id: 'start' | 'echo' | 'shop' | 'rank' | 'me'; label: string; icon: PixelSpriteName }[] = [
  { id: 'start', label: '开始', icon: 'ribbonWand' },
  { id: 'echo', label: '回音树', icon: 'sakuraHeart' },
  { id: 'shop', label: '外观', icon: 'starGem' },
  { id: 'rank', label: '排行', icon: 'tiaraGold' },
  { id: 'me', label: '我的', icon: 'giftPouch' },
] as const;

export function Avatar({ id, frame, size = 44 }: { id: string; frame?: string; size?: number }) {
  const localAvatar = useLocalAvatar(id);
  const ring = frameImage(frame);
  const asset = cosmeticById(frame)?.frameAsset;
  return (
    <span className="lobby-avatar" style={{ width: size, height: size }}>
      <img
        src={localAvatar || avatarImage(id)}
        alt=""
        width={size}
        height={size}
        style={
          asset
            ? {
                width: `${asset.portraitScale * 100}%`,
                height: `${asset.portraitScale * 100}%`,
                borderRadius: 0,
                imageRendering: 'pixelated',
                clipPath: 'polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)',
              }
            : { borderRadius: 0, imageRendering: 'pixelated' }
        }
      />
      {ring ? <img className="lobby-avatar-frame" src={ring} alt="" width={size} height={size} style={asset ? { borderRadius: 0, imageRendering: 'pixelated', transform: frameArtTransform(frameLayoutFor(frame)), transformOrigin: 'center' } : { borderRadius: 0, imageRendering: 'pixelated' }} /> : null}
    </span>
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
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('start');
  const previousTab = useRef(tab);
  const [token, setToken] = useState('');
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
  const [openedGift, setOpenedGift] = useState<{ ownerId: string; gift: GiftLetter } | null>(null);
  const [subsidyAiId, setSubsidyAiId] = useState('');
  const [subsidyInput, setSubsidyInput] = useState('1');
  const subsidyAmount = /^[0-9]+$/.test(subsidyInput) ? Number(subsidyInput) : 0;
  const [subsidySubmitting, setSubsidySubmitting] = useState(false);
  const subsidyInFlight = useRef(false);
  const pendingSubsidy = useRef<{ aiId: string; coins: number; requestId: string } | null>(null);
  const [echoEvents, setEchoEvents] = useState<EchoEvent[]>([]);
  const [watchRooms, setWatchRooms] = useState<{ token: string; rooms: WatchRoom[] } | null>(null);

  const run = useCallback(async <T,>(work: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try { const result = await work(); setError(''); if (ok) setNotice(ok); return result; }
    catch (e) { setError((e as Error).message); return undefined; }
  }, []);

  const refreshSelf = useCallback(async (active = token) => {
    if (active !== activeToken.current) return;
    const sequence = ++profileRequest.current;
    if (!active) { setSelf(null); return; }
    try {
      const result = await metaRequest<{ self: SelfAccount }>('profile', { token: active });
      if (sequence !== profileRequest.current || active !== activeToken.current) return;
      setSelf(result.self);
    } catch (error) {
      if (sequence !== profileRequest.current || active !== activeToken.current) return;
      setError((error as Error).message);
      // A temporary network failure must not silently log out an otherwise valid account.
      if ((error as Error).message === '登录态无效') {
        activeToken.current = ''; clearAccountToken(); setToken(''); setSelf(null);
      }
    }
  }, [token]);

  useEffect(() => {
    activeToken.current = readAccountToken(); setToken(activeToken.current);
    return () => { activeToken.current = ''; };
  }, []);
  useEffect(() => {
    let alive = true;
    const followLink = () => { if (alive && window.location.hash === '#me') setTab('me'); };
    void Promise.resolve().then(followLink);
    window.addEventListener('hashchange', followLink);
    return () => { alive = false; window.removeEventListener('hashchange', followLink); };
  }, []);
  useEffect(() => { void metaRequest<Catalog>('catalog').then(setCatalog).catch(() => {}); }, []);
  useEffect(() => { void refreshSelf(token); }, [token, refreshSelf]);
  useEffect(() => {
    if (tab === 'me' && previousTab.current !== 'me' && token) void refreshSelf(token);
    previousTab.current = tab;
  }, [tab, token, refreshSelf]);
  useEffect(() => {
    if (tab !== 'me' || !self?.isAdmin || !token) return;
    let active = true;
    void roomRequest<{ packs: PackFlag[] }>('pack_flags', { token })
      .then(result => { if (active) setPackFlags({ token, packs: result.packs }); })
      .catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, [tab, self?.isAdmin, token]);
  useEffect(() => {
    if (tab !== 'me' || !self || self.isAi || !token) return;
    let active = true;
    void accountRequest<{ ai: Entry[] }>('bindings', { token })
      .then(result => { if (active) setMyAi({ token, ai: Array.isArray(result.ai) ? result.ai : [] }); })
      .catch(() => { if (active) setMyAi({ token, ai: [] }); });
    return () => { active = false; };
  }, [tab, self, token]);
  useEffect(() => {
    if (tab !== 'rank') return;
    let active=true;
    void Promise.resolve().then(()=>{
      if(active){setLoadedRankOrder(null);setRankError('');}
      return metaRequest<{ entries: Entry[] }>('leaderboard', { limit: 30,order:rankOrder });
    })
      .then(result => {if(active){setEntries(Array.isArray(result?.entries)?result.entries:[]);setLoadedRankOrder(rankOrder);}})
      .catch(() => {if(active)setRankError('排行榜暂时没读到，再试一次吧。');});
    return ()=>{active=false;};
  }, [tab, rankOrder, rankRetry, self?.record.games]);
  useEffect(() => {
    if (tab !== 'start' || !self || self.isAi || !token) return;
    let active = true;
    const refresh = () => { void accountRequest<{ rooms: WatchRoom[] }>('watch_rooms', { token })
      .then(result => { if (active) setWatchRooms({ token, rooms: result.rooms ?? [] }); })
      .catch(() => { if (active) setWatchRooms({ token, rooms: [] }); }); };
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 5_000);
    return () => { active = false; clearInterval(timer); };
  }, [tab, self, token]);

  useEffect(() => {
    if (tab !== 'echo') return;
    let active = true;
    const load = () => { void metaRequest<{ events: EchoEvent[] }>('echo', { limit: 40 })
      .then(result => { if (active) setEchoEvents(Array.isArray(result?.events) ? result.events : []); })
      .catch(() => { /* 静默重试 */ }); };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, [tab]);

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
      setMyAi(null); setAiInvite(null); setPackFlags(null); setWatchRooms(null);
      setOpenedGift(null); setAvatarStatus('');
      setSubsidyAiId(''); pendingSubsidy.current = null;
      setGiftSkin(''); setGiftNote('');
      setNotice('已退出登录，可以登录其他账号');
    } catch (error) { setError(`退出未完成：${(error as Error).message}`); }
    finally { authInFlight.current = false; setAuthBusy(false); }
  };

  const wallet = self?.coins ?? { human: 0, bot: 0 };
  const subsidyPreview = subsidyQuote(subsidyAmount);
  const subsidyCopperCost = subsidyPreview?.spentHuman ?? 0;
  const sandbox = Boolean(catalog?.sandbox || cosmeticsSandbox);
  const preview = usePreviewWardrobe();
  const effectiveBoard = resolveEffectiveBoardSkin({ sandbox, previewBoard: preview.board, seatSkinId: self?.equipped.board });
  const effectiveFrame = resolveEffectiveFrame({ sandbox, previewFrame: preview.frame, seatFrame: self?.frame });
  const owned = new Set(self?.owned ?? []);
  const boardSkins = catalog?.cosmetics.filter(entry => entry.kind === 'board' && (sandbox || entry.acquisition !== 'retired')) ?? [];
  const frames = catalog?.cosmetics.filter(entry => entry.kind === 'frame' && (sandbox || entry.acquisition !== 'retired')) ?? [];
  const cosmeticName = (id: string) => catalog?.cosmetics.find(entry => entry.id === id)?.name ?? id;
  const giftDate = (at: number) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(at);
  const balanceFor = (currency: CurrencyId) => wallet[currency];
  const selectedPack = packs.some(entry => entry.id === pack) ? pack : (packs[0]?.id ?? '');
  const visiblePackFlags = packFlags?.token === token ? packFlags.packs : null;
  const visibleAiInvite = aiInvite?.issuedFor === token ? aiInvite : null;
  const visibleMyAi = myAi?.token === token ? myAi.ai : [];
  const visibleWatchRooms = watchRooms?.token === token ? watchRooms.rooms : [];
  const subsidizeSelected = async () => {
    if (subsidyInFlight.current || !token || !subsidyAiId || !subsidyPreview) return;
    subsidyInFlight.current = true;
    setSubsidySubmitting(true);
    const previous = pendingSubsidy.current;
    const request = previous?.aiId === subsidyAiId && previous.coins === subsidyAmount
      ? previous : { aiId: subsidyAiId, coins: subsidyAmount, requestId: crypto.randomUUID() };
    pendingSubsidy.current = request;
    try {
      await metaRequest('subsidize', { token, ...request });
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

  const cosmeticCard = (cosmetic: Cosmetic) => {
    const inShop = isShopCosmetic(cosmetic);
    const has = owned.has(cosmetic.id);
    const equipped = self?.equipped[cosmetic.kind] === cosmetic.id;
    const isTrying = sandbox && preview[cosmetic.kind] === cosmetic.id;
    const currency = self?.isAi ? 'bot' : 'human';
    const rarityLabel = cosmetic.rarity === 'epic' ? '神话' : cosmetic.rarity === 'rare' ? '史诗' : '经典';
    const isFrame = cosmetic.kind === 'frame';
    return <article key={cosmetic.id} className={`lobby-card rarity-${cosmetic.rarity} ${equipped || isTrying ? 'is-equipped' : ''}`}>
      <div className="lobby-card-header-bar">
        <span className="lobby-card-kind">{isFrame ? '头像框' : '棋盘投影'}</span>
        <span className="lobby-card-badge"><PixelSprite name={cosmetic.rarity === 'epic' ? 'sparkle' : cosmetic.rarity === 'rare' ? 'starGem' : 'bow'} size={11} /> {rarityLabel}</span>
      </div>
      {isFrame && cosmetic.frameAsset ? <div className="lobby-card-art-box lobby-card-art-box--frame-asset" aria-label={`${cosmetic.name}佩戴预览`}>
        <Avatar id="preview" frame={cosmetic.id} size={132} />
      </div> : <div className="lobby-card-art-box">
        <img className="lobby-card-art" src={cosmeticImage(cosmetic.id)} alt={cosmetic.name} />
        {isFrame ? <div className="lobby-card-frame-preview" title="实机佩戴预览">
          <div className="frame-astrolabe-ring" />
          <Avatar id="preview" frame={cosmetic.id} size={52} />
          <span className="frame-preview-tag">虚仪试戴</span>
        </div> : <div className="lobby-card-board-palette" title="地貌天象配色">
          <span className="palette-chip" style={{ background: cosmetic.palette?.sky ?? '#d6e6c8' }} />
          <span className="palette-chip" style={{ background: cosmetic.palette?.outer ?? '#7fa06a' }} />
          <span className="palette-chip" style={{ background: cosmetic.palette?.inner ?? '#e8f0da' }} />
        </div>}
      </div>
      }
      <div className="lobby-card-body">
        <div className="lobby-card-title-row">
          <strong><PixelSprite name={cosmeticSpriteName(cosmetic.id)} size={15} /> {cosmetic.name}</strong>
          <span className="lobby-price">{cosmetic.acquisition === 'retired' ? '典藏绝版' : !inShop ? '转盘限定' : cosmeticPrice(cosmetic, currency) === 0 ? '迎新赠物' : `${cosmeticPrice(cosmetic, currency)} ${CURRENCY[currency].name}`}</span>
        </div>
        <small className="lobby-card-tagline">“{cosmetic.tagline}”</small>
      </div>
      <div className="lobby-card-actions">
        {has ? <button className={equipped ? 'btn-equipped' : 'btn-equip'} disabled={equipped || !self} onClick={() => void run(() => metaRequest('equip', { token, cosmeticId: cosmetic.id }), '已更换外观').then(() => refreshSelf())}>{equipped ? <><PixelSprite name="clover" size={12} /> 已佩戴入局</> : '更替外观'}</button>
          : inShop ? <button className="btn-buy" disabled={!self || cosmeticPrice(cosmetic, currency) > balanceFor(currency)} onClick={() => void run(() => metaRequest('buy', { token, cosmeticId: cosmetic.id }), '购买成功').then(() => refreshSelf())}>奉纳购置</button>
          : cosmetic.acquisition === 'wheel' ? <button className="btn-buy" disabled={!catalog?.wheelEnabled} onClick={() => window.location.assign('/autochess/wheel')}>{catalog?.wheelEnabled ? '去对对碰试试' : '转盘筹备中'}</button>
          : null}
        {sandbox && !equipped ? (
          <button
            type="button"
            className={isTrying ? 'btn-trial is-active' : 'btn-trial'}
            onClick={() => {
              writePreviewWardrobe({ [cosmetic.kind]: isTrying ? undefined : cosmetic.id });
              setNotice(isTrying ? `已取消试穿「${cosmetic.name}」` : `正在试穿「${cosmetic.name}」`);
            }}
          >
            {isTrying ? '试穿中 · 取消' : '试穿预览'}
          </button>
        ) : null}
        {self?.isAi && self.ownerName && (inShop || has) ? <button className="btn-gift" onClick={() => { setGiftSkin(cosmetic.id); setTab('me'); }}>送给你的人</button> : null}
      </div>
    </article>;
  };

  const selectedPackMeta = packs.find(item => item.id === selectedPack);

  return <main className="lobby">
    <div className="celestial-astrolabe-bg" aria-hidden="true" />
    <header className="lobby-top">
      <div className="lobby-top-bar">
        <div className="lobby-brand">
          <div className="lobby-crest-badge" aria-hidden="true"><PixelSprite name="fairyCrown" size={22} /></div>
          <div className="lobby-brand-copy">
            <h1>{CHESS_NAME} <PixelSprite name="sparkle" size={14} className="ft-twinkle" /></h1>
            <span className="lobby-sub">与人同席 · 与机对弈</span>
          </div>
        </div>
        <div className="lobby-wallet">
          {catalog?.wheelEnabled ? <button type="button" className="lobby-wheel-entry" onClick={() => window.location.assign('/autochess/wheel')}><PixelSprite name="candyPair" size={14} /><span>对对碰</span><span className="lobby-wheel-tag">试玩</span></button> : null}
          <SocialInboxTrigger variant="lobby" />
          <Feedback variant="lobby" />
          <div className="lobby-coin-pill human" title={CURRENCY.human.note}>
            <span className="coin-symbol"><PixelSprite name="goldCoin" size={13} /> 铜钱</span>
            <span className="coin-val">{formatCoins(wallet.human)}</span>
          </div>
          <div className="lobby-coin-pill bot" title={CURRENCY.bot.note}>
            <span className="coin-symbol"><PixelSprite name="skyCore" size={13} /> 机芯</span>
            <span className="coin-val">{formatCoins(wallet.bot)}</span>
          </div>
          {self ? <button className="lobby-user" disabled={authBusy} title="点击退出当前账号" onClick={() => void logout()}>
            <Avatar id={self.id} frame={effectiveFrame} size={28} />
            <div className="lobby-user-meta">
              <span className="lobby-username">{self.username}</span>
              <span className="lobby-usertag">{self.isAi ? '智能机' : '弈客'}</span>
            </div>
            <span className="lobby-user-exit">退出</span>
          </button> : sandbox ? <button type="button" className="lobby-visitor-trial" onClick={() => setTab('shop')} title="点此打开外观试穿">
            <Avatar id="visitor-preview" frame={effectiveFrame} size={28} />
            <div className="lobby-user-meta">
              <span className="lobby-username">游客试穿</span>
              <span className="lobby-usertag">{preview.board || preview.frame ? '试穿中' : '点此挑外观'}</span>
            </div>
          </button> : null}
        </div>
      </div>
      <nav className="lobby-tabs" aria-label="大厅栏目">{TABS.map(entry => <button key={entry.id} type="button" aria-current={tab === entry.id ? 'page' : undefined} className={tab === entry.id ? 'is-active' : ''} onClick={() => setTab(entry.id)}>
        <PixelSprite name={entry.icon} size={14} />
        <span>{entry.label}</span>
        {entry.id === 'me' && self?.gifts.length ? <b className="lobby-tab-badge">{self.gifts.length}</b> : null}
      </button>)}</nav>
    </header>

    {error ? <p className="room-error" role="alert">{error}</p> : null}
    {notice ? <p className="lobby-notice" role="status">{notice}</p> : null}

    {tab === 'start' ? <section className="lobby-panel chamber-start">
      <h2><PixelSprite name="swordCross" size={17} /> 天机开弈</h2>
      <p className="lobby-hint">挑选模式与棋谱直接建房，或者直接入座右侧匹配队列与棋友同台。</p>
      <div className="lobby-start-layout">
        <div className="lobby-start-primary">
          <div className="lobby-subbox lobby-subbox--pink">
            <h3>对局模式</h3>
            <div className="lobby-packs" aria-label="对局模式">
              {LOBBY_MODES.map(entry => <button key={entry.id} type="button" aria-pressed={mode===entry.id} className={`pack-tome ${mode===entry.id?'is-active':''}`} onClick={()=>setMode(entry.id)}><span className="pack-tome-icon"><PixelSprite name={modeSpriteName(entry.id)} size={18} /></span><div className="pack-tome-meta"><strong>{entry.name}</strong><small>{entry.description}</small></div></button>)}
            </div>
            <h3>选定命途棋谱</h3>
            {packsLoading ? <p className="lobby-hint">正在翻开棋谱…</p> : packsError ? <p className="lobby-hint">棋谱暂时没取到。<button type="button" onClick={() => void onRefreshPacks()}>再试一次</button></p> : !packs.length ? <p className="lobby-hint">棋谱暂未开放。已有棋局可以照常入座。</p> : null}
            <div className="lobby-packs lobby-packs--rosters">{packs.map(item => <button key={item.id} type="button" aria-pressed={selectedPack === item.id} className={`pack-tome ${selectedPack === item.id ? 'is-active' : ''}`} onClick={() => setPack(item.id)}>
              <span className="pack-tome-icon"><PixelSprite name={packSpriteName(item.id)} size={20} /></span>
              <div className="pack-tome-meta">
                <strong>{item.name}</strong>
                <span className="pack-tome-description">{item.description}</span>
                <small>{item.units} 枚棋子入谱</small>
              </div>
              <span className="pack-tome-seal">{selectedPack === item.id ? '已选' : '选择'}</span>
            </button>)}</div>
            <div className="lobby-launch-bar">
              <div className="lobby-launch-summary">
                当前：<strong>{modePack(mode).name}</strong> · <strong>{selectedPackMeta?.name ?? '未选棋谱'}</strong>
              </div>
              <button type="button" className="lobby-primary" disabled={busy || packsLoading || !!packsError || !selectedPack} onClick={() => onCreate(selectedPack,mode)}>
                <PixelSprite name="ribbonWand" size={14} />
                <span>{modePack(mode).createLabel}</span>
              </button>
            </div>
          </div>

          <div className="lobby-subbox">
            <h3>入座已知棋局</h3>
            <div className="lobby-join-grid">
              <input aria-label="密函编号" value={invitation} placeholder="密函编号 roomId.邀请串" onChange={event => setInvitation(event.target.value)} />
              <input aria-label="席位信物" value={joinKey} placeholder="席位信物（至少16位）" onChange={event => setJoinKey(event.target.value)} />
              <button type="button" disabled={!invitation.trim() || joinKey.trim().length < 16} onClick={() => onJoin(invitation.trim(), joinKey.trim())}>入座登盘</button>
            </div>
            <p className={`lobby-join-note ${joinKey.trim().length > 0 && joinKey.trim().length < 16 ? 'is-warn' : ''}`}>
              {joinKey.trim().length > 0 && joinKey.trim().length < 16
                ? `席位信物还差 ${16 - joinKey.trim().length} 位字符（需至少 16 位）`
                : '粘贴房主的邀请编号，并填写至少 16 位席位信物即可直接入座。'}
            </p>
          </div>
        </div>

        <div className="lobby-start-side">
          <Matchmaking key={token} token={token} pack={selectedPack} onEnter={onEnterRoom} />
          {self && !self.isAi && visibleWatchRooms.length ? <section className="lobby-watch-box" aria-label="自家机的棋局">
            <h3><PixelSprite name="eyeSpy" size={14} /> 自家机的棋局</h3>
            {visibleWatchRooms.map(room => <div className="lobby-watch-item" key={room.roomId}>
              <span className="lobby-queue">{room.seats.join(' vs ')} · {room.packName} · 第 {room.round} 轮</span>
              <button type="button" onClick={() => onEnterRoom?.(room.roomId, room.token)}>观战</button>
            </div>)}
          </section> : null}
        </div>
      </div>
    </section> : null}

    {tab === 'echo' ? <section className="lobby-panel">
      <EchoTreePanel events={echoEvents} empty="还没有写下第一张礼笺。送礼成功时会在此留笺。" />
    </section> : null}

    {tab === 'shop' ? <section className="lobby-panel">
      <h2><PixelSprite name="starGem" size={17} /> 外观</h2>
      <p className="lobby-hint">机赚到机芯后，可以挑件外观送给自己的人；默认随每局棋谱自带的像素原盘，装备棋盘皮肤后会覆盖棋局棋盘。</p>
      {sandbox ? <div className="lobby-sandbox-bar">
        <Avatar id={self?.id ?? 'visitor-preview'} frame={effectiveFrame} size={52} />
        <div className="lobby-sandbox-copy">
          <strong>预览站自由试穿已开启（游客免买直试）</strong>
          <span>当前棋盘：{effectiveBoard ? cosmeticName(effectiveBoard) : '随棋谱原盘'} · 当前头像框：{effectiveFrame ? cosmeticName(effectiveFrame) : '无'}；开局后右上角也能随时切全部 {boardSkins.length} 套棋盘与联动按键皮肤。</span>
        </div>
        {preview.board || preview.frame ? <button type="button" className="lobby-secondary" onClick={() => { clearPreviewWardrobe(); setNotice('已清空试穿外观'); }}>清空试穿</button> : null}
      </div> : null}
      <div className="lobby-row">
        <h3>棋盘皮肤</h3>
        {self || sandbox ? (
          <button
            type="button"
            className="lobby-secondary"
            disabled={!effectiveBoard}
            onClick={() => {
              if (sandbox) writePreviewWardrobe({ board: self?.equipped.board ? NATIVE_BOARD_SKIN : undefined });
              if (self?.equipped.board) {
                void run(() => metaRequest('equip', { token, cosmeticId: NATIVE_BOARD_SKIN }), '已恢复随棋谱原盘').then(() => refreshSelf());
              } else if (sandbox) {
                setNotice('已切回随棋谱原盘');
              }
            }}
          >
            {effectiveBoard ? '恢复随棋谱原盘' : '当前：随棋谱原盘'}
          </button>
        ) : null}
      </div>
      <div className="lobby-grid">{boardSkins.map(cosmeticCard)}</div>
      <h3>头像框</h3>
      <div className="lobby-grid">{frames.map(cosmeticCard)}</div>
    </section> : null}

    {tab === 'rank' ? <section className="lobby-panel">
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

    {tab === 'me' ? <section className="lobby-panel">
      <h2><PixelSprite name="giftPouch" size={17} /> 我的</h2>
      {!self ? <>
        <p className="lobby-hint">{registering ? '注册一个账号，战绩和外观会跟着你走。' : '登录后可以买外观、收礼物、上排行榜。'}</p>
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
      </> : <>
        <div className="lobby-profile">
          <Avatar id={self.id} frame={self.frame} size={72} />
          <div><strong>{self.username}{self.isAi ? ' · 机' : ''}</strong>
            <p>{self.record.wins} 胜 / {self.record.games} 局 · 拥有 {self.owned.length} 件外观</p>
            <p><PixelSprite name="goldCoin" size={13} /> 铜钱 {formatCoins(wallet.human)} · <PixelSprite name="skyCore" size={13} /> 机芯 {formatCoins(wallet.bot)}</p>
          </div>
          <button disabled={authBusy} onClick={() => void logout()}>{authBusy ? '正在退出…' : '切换账号'}</button>
        </div>
        <section className="lobby-wardrobe">
          <h3><PixelSprite name="bow" size={14} /> 我的装扮</h3>
          <div className="lobby-avatar-upload"><label>换张头像 <input type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarSaving} onChange={async event => {
            const input = event.currentTarget; const file = input.files?.[0]; const id = self.id; if (!file) return;
            setAvatarSaving(true); setAvatarStatus('正在换头像…');
            try { await saveLocalAvatar(id, file); setAvatarStatus('头像换好啦'); }
            catch (error) { setAvatarStatus(error instanceof Error ? error.message : '头像没能保存，再试一次'); }
            finally { input.value = ''; setAvatarSaving(false); }
          }} /></label><button disabled={avatarSaving} onClick={() => void run(async () => { clearLocalAvatar(self.id); setAvatarStatus('已恢复默认头像'); })}>恢复默认头像</button></div>
          {avatarStatus ? <output className="lobby-hint">{avatarStatus}</output> : null}
          <p className="lobby-hint">头像只保存在这个浏览器，换设备和其他人看到的仍是默认头像。</p>
          <div className="lobby-wardrobe-switches">{(['board','frame'] as const).map(kind => <label key={kind}>{kind === 'board' ? '棋盘' : '头像框'}<select aria-label={kind === 'board' ? '切换棋盘' : '切换头像框'} value={kind === 'board' ? (self.equipped.board ?? NATIVE_BOARD_SKIN) : (self.equipped.frame ?? '')} onChange={event => void run(() => metaRequest('equip', { token, cosmeticId: event.target.value || null }), '已更换装扮').then(() => refreshSelf())}>
            {kind === 'board' ? <option value={NATIVE_BOARD_SKIN}>随棋谱原盘</option> : <option value="">不戴头像框</option>}
            {self.owned.map(id => cosmeticById(id)).filter((item): item is Cosmetic => Boolean(item && item.kind === kind)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
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
        {self.isAdmin ? <BalanceAdmin token={token} packs={visiblePackFlags ?? packs} mcpUrl={mcpUrl} /> : null}
        {!self.isAi ? <section className="lobby-pack-admin" aria-labelledby="lobby-ai-invite-title">
          <h3 id="lobby-ai-invite-title">你的机</h3>
          <p className="lobby-hint">开房后点「邀请机」，一张入场券就能让新机入籍、入座；下次也能直接选它再来。</p>
          {visibleMyAi.length ? <ul className="lobby-machine-list">{visibleMyAi.map(entry => <li key={entry.id} style={{flexWrap:'wrap'}}><Avatar id={entry.id} frame={entry.frame} size={30} /><span>{entry.username}</span><small>{entry.record?.wins ?? 0} 胜 / {entry.record?.games ?? 0} 局</small><MachineCredential key={token+':'+entry.id} ownerToken={token} aiId={entry.id} name={entry.username} /></li>)}</ul> : <p className="lobby-hint">还没有机友。开一间房，叫第一只来吧。</p>}
          <details className="lobby-machine-legacy">
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
          </details>
        </section> : null}
        {!self.isAi && visibleMyAi.length ? <section className="lobby-pack-admin" aria-labelledby="lobby-subsidy-title">
          <h3 id="lobby-subsidy-title">回家接济</h3>
          <p className="lobby-hint">1 铜钱换 {EXCHANGE_BOT_PER_HUMAN} 机芯，直接送到它的钱包。填入想给它换的铜钱数。</p>
          <div className="lobby-row">
            <select aria-label="选择要接济的机" value={subsidyAiId} onChange={event => setSubsidyAiId(event.target.value)}>
              <option value="">选一只机</option>
              {visibleMyAi.map(entry => <option key={entry.id} value={entry.id}>{entry.username}</option>)}
            </select>
            <input aria-label="接济多少铜钱" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="输入铜钱数量，如 52" value={subsidyInput} disabled={subsidySubmitting} onChange={event => setSubsidyInput(event.target.value)} />
            <span className="lobby-hint">铜钱 {subsidyCopperCost} → 到账 {subsidyPreview?.gained ?? 0} 机芯</span>
            <button disabled={subsidySubmitting || !subsidyPreview || !subsidyAiId || wallet.human < subsidyCopperCost} onClick={() => void subsidizeSelected()}>{subsidySubmitting ? '接济中…' : '接济'}</button>
          </div>
        </section> : null}
        {!self.isAi ? <>
          <h3>礼物收件箱 {self.gifts.length ? `· ${self.gifts.length} 件待领取` : ''}</h3>
          <ul className="lobby-gifts">{self.gifts.map(gift => <li key={gift.id}><span>{gift.fromName} 送你「{cosmeticName(gift.cosmeticId)}」</span><small>{giftDate(gift.at)}</small><button onClick={() => setOpenedGift({ ownerId: self.id, gift })}>✦ 拆开礼函</button></li>)}{!self.gifts.length ? <li className="lobby-hint">没有待领取的礼物</li> : null}</ul>
          <section className="lobby-gift-ledger" aria-labelledby="gift-ledger-title">
            <div className="lobby-gift-ledger-heading"><span aria-hidden="true">✦</span><div><h3 id="gift-ledger-title">赠礼簿</h3><p>送给你的礼物，领过也留在这里。</p></div></div>
            {(self.giftHistory ?? []).length ? <ol className="lobby-gift-ledger-list">{self.giftHistory?.map(gift => <li key={gift.id}>
              <time dateTime={new Date(gift.at).toISOString()}>{giftDate(gift.at)}</time>
              <span className="lobby-gift-ledger-text"><strong>{gift.fromName}</strong> 赠与 <strong>{gift.toName}</strong>「{cosmeticName(gift.cosmeticId)}」</span>
              <span className={`lobby-gift-ledger-state ${gift.claimedAt ? 'is-claimed' : ''}`}>{gift.claimedAt ? '已收下' : '待领取'}</span>
              <button onClick={() => setOpenedGift({ ownerId: self.id, gift })}>{gift.claimedAt ? '查看礼函' : '拆开礼函'}</button>
            </li>)}</ol> : <p className="lobby-gift-ledger-empty">还没有写下第一笔赠礼。</p>}
          </section>
        </> : self.ownerName ? <>
          <h3>想给你的人挑一件礼物</h3>
          <p className="lobby-hint">{GIFT_NOTE_PROMPT}{catalog?.cosmetics.find(item => item.id === giftSkin)?.kind === 'frame' ? '也可以借这份礼物的意象，藏一点想说的话。' : GIFT_NOTE_HINT}（选填，最多60字；也会展示在回音树。）</p>
          <p className="lobby-hint">收礼人：{self.ownerName}</p>
          <div className="lobby-row">
            <select value={giftSkin} onChange={event => setGiftSkin(event.target.value)}>
              <option value="">选一件外观</option>
              {[...new Map([...boardSkins, ...frames, ...self.owned.flatMap(id => { const item = cosmeticById(id); return item ? [item] : []; })].map(item => [item.id, item])).values()].filter(cosmetic => isShopCosmetic(cosmetic) || owned.has(cosmetic.id)).map(cosmetic => <option key={cosmetic.id} value={cosmetic.id}>{cosmetic.name}{owned.has(cosmetic.id) ? self.equipped[cosmetic.kind] === cosmetic.id ? '（佩戴中，送出时自动换下）' : '（已拥有，可转赠）' : `（${cosmeticPrice(cosmetic, 'bot')} 机芯）`}</option>)}
            </select>
            <input aria-label="附言" value={giftNote} maxLength={60} placeholder={GIFT_NOTE_PROMPT} onChange={event => setGiftNote(event.target.value)} />
            <button disabled={!giftSkin} onClick={() => void run(() => metaRequest('gift', { token, cosmeticId: giftSkin, note: giftNote || undefined }), '已送给你的人').then(result => { if (result) { setGiftSkin(''); setGiftNote(''); void refreshSelf(); } })}>送出</button>
          </div>
        </> : null}
      </>}
    </section> : null}
    {self && openedGift?.ownerId === self.id ? <GiftReveal key={openedGift.gift.id} gift={openedGift.gift}
      cosmetic={catalog?.cosmetics.find(item => item.id === openedGift.gift.cosmeticId)}
      onClose={() => setOpenedGift(null)} onClaim={async giftId => {
        const result = await metaRequest<{ self: SelfAccount }>('claim', { token, giftId });
        if (token === activeToken.current) setSelf(result.self);
      }} /> : null}
  </main>;
}
