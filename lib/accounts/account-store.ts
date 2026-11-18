import { GIFT_NOTE_GUIDANCE } from '../meta/gift-copy';
import {leaderboardOrder, type LeaderboardOrder} from '../meta/leaderboard';
import { giftPresentation } from '../meta/gift-presentation';
import { CURRENCY, ARCADE_TICKET_SHOP, FEEDBACK_REWARD, type FeedbackCredit } from '../meta/economy';
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  ARCADE_GUIDE,
  ARCADE_LIMITS,
  ARCADE_PRIZE_SPECS,
  arcadeReliefStatus,
  emptyArcadeState,
  type ArcadeCommand,
  type ArcadeEvent,
  type ArcadePrize,
  type ArcadePrizeSpec,
  type ArcadeReceipt,
  type ArcadeState,
  type ArcadeView,
} from '../meta/arcade';
import { getGameConfig } from '../meta/game-config';
import { arcadeGameCatalog } from '../meta/arcade-registry';
import { playArcade, validateArcadeConfig } from './arcade-engine';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listedCosmetics, cosmeticPrice, cosmeticById, DEFAULT_BOARD_SKIN, NATIVE_BOARD_SKIN, isShopCosmetic, isDefaultCosmetic, isArcadeCosmetic, type Cosmetic, type CosmeticKind } from '../meta/cosmetics';
import { matchmakingDelta, exchangeBotPerHuman, subsidyQuote, currencyFor, emptyWallet, rewardFor, settlementDelta, settlementRule, type CurrencyId, type MatchKind, type Wallet } from '../meta/economy';
import type { EchoEvent } from '../meta/echo-tree';
import type { SettlementReceipt } from '../meta/economy';
import { GIFT_LEDGER_MAX, GIFT_LEDGER_CURSOR_MAX, type GiftLedgerDirection, type GiftLedgerEntry, type GiftLedgerPage, type GiftLedgerQuery } from '../meta/gift-ledger';

const fail: (message: string) => never = (message) => { throw new Error(message); };
export { fail };

export type Gift = { id: string; fromId: string; fromName: string; cosmeticId: string; at: number; note?: string };
export type GiftRecord = Gift & { toId: string; toName: string; claimedAt?: number; legacy?: true };
export type RoomGiftAction = { key: string; cosmeticId: string; gift: Gift; bought: boolean; toId?: string; toName: string; coins: number };
/** 回音树发布口（可注入；不注入就不广播，测试与瘦身模式照旧）。 */
export type EchoPublisher = { publish(input: Omit<EchoEvent, 'id' | 'at'> & { id?: string; at?: number }): EchoEvent };
export type ArcadeOptions = {
  enabled?: boolean;
  echoScope?: 'public' | 'private' | 'none';
  random?: () => number;
  makeId?: () => string;
  now?: () => number;
};
export type AccountStorage = {
  read(): AccountFile | undefined;
  write(data: AccountFile): void;
};
/** 旧版对对碰存档的结构化快照，仅用于平滑迁移旧奖品到像素游乐摊。 */
type LegacyWheelPrizeSnapshot = {
  id?: string;
  spec?: {
    id?: string;
    name?: string;
    icon?: string;
    giftable?: boolean;
    reward?: { kind?: string; cosmeticId?: string };
  };
  at?: number;
  source?: string;
  status?: 'pending' | 'used' | 'sent';
  from?: { id: string; name: string };
  to?: { id: string; name: string };
  note?: string;
  settledAt?: number;
};
type LegacyWheelSnapshot = { tickets?: number; prizes?: LegacyWheelPrizeSnapshot[] };
/** 单席位结算条目：有效性由结算层按 `round` 与局型门槛判定。 */
export type MatchEntry = { accountId: string; outcome: 'win' | 'loss' | 'draw'; place?: number };
export type PlatformAccountPerson = { id: string; name: string; isAi: boolean; owners?: string[] };
export type MatchSettlementInput = { roomId: string; round: number; entries: MatchEntry[]; travelIdleLoss?: boolean; partial?: boolean; participants?: string[]; seatCount?: number; matchmaking?: boolean; companionOnly?: boolean };
type DailySettlement = { day: string; companion: number; travel: number };
type SubsidyAction = { key: string; humanId: string; aiId: string; amount: number; gained?: number; spentBot: number; spentHuman: number; at: number };
export type AccountRecord = { games: number; wins: number };
export type Owned = { owned: string[]; equipped: Partial<Record<CosmeticKind, string>>; boardExplicit?: boolean };

export type Account = {
  id: string; username: string; usernameKey: string; passwordHash: string;
  isAi: boolean; isAdmin: boolean; createdAt: number; lastActiveAt: number; deletedAt?: number;
  ownerId?: string;
  hiddenFromLeaderboard?: boolean;
  hiddenFromOwnerRoster?: boolean;
  feedbackCredits?: Record<string, FeedbackCredit>;
  arcade?: ArcadeState;
  /** @deprecated Migrated into `arcade` on load. */
  wheel?: LegacyWheelSnapshot;
  coins?: Wallet; cosmetics?: Owned; gifts?: Gift[]; giftHistory?: GiftRecord[]; record?: AccountRecord;
};

export type PublicAccount = Pick<Account, 'id' | 'username' | 'isAi' | 'isAdmin' | 'createdAt' | 'lastActiveAt' | 'deletedAt'> & {
  record?: AccountRecord; frame?: string;
};
export type BoundPartner = { id: string; username: string; isAi: boolean };
export type SelfAccount = PublicAccount & {
  coins: Wallet; owned: string[]; equipped: Partial<Record<CosmeticKind, string>>; gifts: Gift[]; giftHistory: GiftRecord[]; record: AccountRecord; ownerName?: string; boundPartners: BoundPartner[];
};
export type Session = { token: string; accountId: string; createdAt: number; lastSeenAt: number };
export type Binding = { humanId: string; aiId: string; createdAt: number };
export type AiInvite = { hash: string; humanId: string; createdAt: number; expiresAt: number };
export type MachineTicket = { hash: string; roomId: string; hostId: string; kind: 'new' | 'existing'; aiId?: string; approvalId?: string; createdAt: number; expiresAt: number; usedAt?: number; revokedAt?: number };
export type MachineRequest = { id: string; roomId: string; mode?: string; requesterId: string; ownerId: string; aiId: string; createdAt: number; expiresAt: number; status: 'pending' | 'approved' | 'declined' | 'revoked'; ticket?: string };
type SessionState = { accountId: string; createdAt: number; lastSeenAt: number };
export type AccountFile = { version: 1; accounts: Account[]; sessions: Record<string, SessionState>; bindings?: Binding[]; aiInvites?: AiInvite[]; machineTickets?: MachineTicket[]; machineRequests?: MachineRequest[]; roomGiftActions?: RoomGiftAction[]; settledRooms?: Record<string, number>; settlementReceipts?: Record<string, SettlementReceipt>; dailySettlement?: Record<string, DailySettlement>; subsidyActions?: SubsidyAction[]; pendingEcho?: EchoEvent[] };

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;
export const AI_INVITE_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const MACHINE_TICKET_LIFETIME_MS = 30 * 60 * 1000;
/** lastActiveAt writes are throttled: hot token checks must not rewrite the file each time. */
const ACTIVITY_FLUSH_MS = 60_000;

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt1:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt1' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const candidate = scryptSync(password, salt, expected.length);
  return timingSafeEqual(candidate, expected);
}

function validateUsername(raw: unknown): string {
  const username = typeof raw === 'string' ? raw.trim() : '';
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) fail(`用户名需要 ${USERNAME_MIN}~${USERNAME_MAX} 个字符`);
  if (!/^[\p{L}\p{N}_-]+$/u.test(username)) fail('用户名只能包含文字、数字、下划线和连字符');
  return username;
}

function validatePassword(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length < PASSWORD_MIN) fail(`密码至少 ${PASSWORD_MIN} 位`);
  return raw;
}

function validateBotName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name || name.length > USERNAME_MAX) fail(`机名需要 1~${USERNAME_MAX} 个字符`);
  if (!/^[\p{L}\p{N}_-]+$/u.test(name)) fail('机名只能包含文字、数字、下划线和连字符');
  return name;
}

const inviteHash = (invite: string) => createHash('sha256').update(invite).digest('hex');

export class AccountStore {
  private accounts = new Map<string, Account>();
  private byKey = new Map<string, string>();
  private sessions = new Map<string, SessionState>();
  private bindings = new Map<string, Binding>();
  private aiInvites = new Map<string, AiInvite>();
  private machineTickets = new Map<string, MachineTicket>();
  private machineRequests = new Map<string, MachineRequest>();
  private roomGiftActions = new Map<string, RoomGiftAction>();
  /** 结算账本：roomId → 结算时间。房间存档不清理时，去重记录也不能过期。 */
  private settledRooms = new Map<string, number>();
  private settlementReceipts = new Map<string, SettlementReceipt>();
  /** 每日名额：ownerId → 当日陪伴/远游结算计数。 */
  private dailySettlement = new Map<string, DailySettlement>();
  private subsidyActions = new Map<string, SubsidyAction>();
  private pendingEcho = new Map<string, EchoEvent>();
  private lastPersistedSeen = new Map<string, number>();

  constructor(readonly directory: string, readonly echo?: EchoPublisher, readonly arcadeOptions: ArcadeOptions = {}, private storage?: AccountStorage) {
    if (arcadeOptions.enabled) validateArcadeConfig();
    if (!storage) mkdirSync(directory, { recursive: true });
    const file = join(directory, 'accounts.json');
    const data = storage ? storage.read() : existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as AccountFile : undefined;
    if (data === undefined) return;
    if (!data || data.version !== 1) fail('ACCOUNT_VERSION_UNSUPPORTED');
    for (const account of data.accounts ?? []) {
      this.accounts.set(account.id, account);
      if (!account.deletedAt) this.byKey.set(account.usernameKey, account.id);
    }
    for (const [token, session] of Object.entries(data.sessions ?? {})) {
      const account = this.accounts.get(session.accountId);
      if (account && !account.deletedAt) this.sessions.set(token, session);
    }
    for (const binding of data.bindings ?? []) {
      const human = this.accounts.get(binding.humanId);
      const ai = this.accounts.get(binding.aiId);
      if (human && ai && !human.deletedAt && !ai.deletedAt) this.bindings.set(`${binding.humanId}:${binding.aiId}`, binding);
    }
    for (const invite of data.aiInvites ?? []) {
      const human = this.accounts.get(invite.humanId);
      if (human && !human.isAi && !human.deletedAt && invite.expiresAt > Date.now()) this.aiInvites.set(invite.hash, invite);
    }
    for (const ticket of data.machineTickets ?? []) this.machineTickets.set(ticket.hash, ticket);
    for (const request of data.machineRequests ?? []) this.machineRequests.set(request.id, request);
    for (const action of data.roomGiftActions ?? []) this.roomGiftActions.set(action.key, action);
    for (const [roomId, at] of Object.entries(data.settledRooms ?? {})) this.settledRooms.set(roomId, at);
    for (const [key, receipt] of Object.entries(data.settlementReceipts ?? {})) this.settlementReceipts.set(key, receipt);
    for (const [ownerId, daily] of Object.entries(data.dailySettlement ?? {})) this.dailySettlement.set(ownerId, daily);
    for (const action of data.subsidyActions ?? []) this.subsidyActions.set(action.key, action);
    for (const event of data.pendingEcho ?? []) this.pendingEcho.set(event.id, event);
    // Preserve all pending inbox gifts in giftHistory across both humans and bound AIs, and migrate legacy wheel prizes into arcade.
    let migrated = false;
    for (const account of this.accounts.values()) {
      const history = account.giftHistory ?? [];
      const seen = new Set(history.map(record => record.id));
      const pending = (account.gifts ?? []).filter(gift => {
        if (seen.has(gift.id)) return false;
        seen.add(gift.id);
        return true;
      });
      if (pending.length) {
        account.giftHistory = [...history, ...pending.map(gift => ({ ...gift, toId: account.id, toName: account.username, legacy: true as const }))];
        migrated = true;
      }
      if (this.migrateLegacyWheel(account)) migrated = true;
    }
    if (migrated) this.persist();
    this.flushPendingEcho();
  }

  private migrateLegacyWheel(account: Account): boolean {
    const legacyPrizes = account.wheel?.prizes;
    if (!legacyPrizes?.length) return false;
    const arcade = account.arcade ? structuredClone(account.arcade) : emptyArcadeState();
    const seen = new Set(arcade.prizes.map(prize => prize.id));
    let changed = false;
    for (const raw of legacyPrizes) {
      if (!raw.id || seen.has(raw.id)) continue;
      const cosmeticId = raw.spec?.reward?.cosmeticId;
      if (!cosmeticId) continue;
      seen.add(raw.id);
      const knownSpec = ARCADE_PRIZE_SPECS.find(item => item.cosmeticId === cosmeticId);
      const spec: ArcadePrizeSpec = knownSpec
        ? structuredClone(knownSpec)
        : { id: raw.spec?.id ?? raw.id, name: raw.spec?.name ?? cosmeticId, icon: raw.spec?.icon ?? '✦', cosmeticId, giftable: raw.spec?.giftable !== false, rarity: 'rare' };
      const prize: ArcadePrize = {
        id: raw.id,
        spec,
        at: raw.at ?? account.createdAt,
        source: raw.source === 'gift' ? 'gift' : 'legacy',
        status: raw.status ?? 'pending',
        ...(raw.from ? { from: raw.from } : {}),
        ...(raw.to ? { to: raw.to } : {}),
        ...(raw.note ? { note: raw.note } : {}),
        ...(raw.settledAt ? { settledAt: raw.settledAt } : {}),
      };
      arcade.prizes.push(prize);
      changed = true;
    }
    if (!changed) return false;
    account.arcade = arcade;
    return true;
  }

  /**
   * 宿主平台同进程受信任桥接：不颁发持久化登录态与密码，由宿主每次传入新鲜人物关系并在回调末尾原子落盘。
   */
  platformRun<T>(people: PlatformAccountPerson[], actorId: string, run: (token: string) => T): T {
    const previousAccounts = structuredClone([...this.accounts.entries()]);
    const previousKeys = new Map(this.byKey);
    const previousBindings = new Map(this.bindings);
    const previousRoomGiftActions = new Map(this.roomGiftActions);
    const previousSubsidyActions = new Map(this.subsidyActions);
    const previousPendingEcho = new Map(this.pendingEcho);
    try {
      const now = Date.now();
      for (const person of people) {
        if (!/^platform:[a-z0-9][a-z0-9_-]{0,31}:[a-f0-9]{32}$/.test(person.id)) fail('Invalid platform identity');
        let account = this.accounts.get(person.id);
        if (account && account.isAi !== person.isAi) fail('Platform identity type changed');
        if (!account) {
          account = {
            id: person.id,
            username: person.name,
            usernameKey: person.id,
            passwordHash: 'platform-only',
            isAi: person.isAi,
            isAdmin: false,
            createdAt: now,
            lastActiveAt: now,
            coins: emptyWallet(),
            cosmetics: { owned: [DEFAULT_BOARD_SKIN], equipped: { board: DEFAULT_BOARD_SKIN } },
            gifts: [],
            giftHistory: [],
            record: { games: 0, wins: 0 },
          };
          this.accounts.set(person.id, account);
        }
        account.username = person.name;
        account.isAdmin = false;
        this.byKey.set(person.id, person.id);
      }
      for (const person of people) {
        if (!person.isAi || !person.owners) continue;
        const account = this.accounts.get(person.id)!;
        delete account.ownerId;
        const existingBindings = new Map(this.bindings);
        for (const [key, binding] of this.bindings) {
          if (binding.aiId === person.id) this.bindings.delete(key);
        }
        for (const humanId of person.owners) {
          const owner = this.accounts.get(humanId);
          if (!owner || owner.isAi || owner.deletedAt) fail('Invalid platform owner');
          this.bindings.set(
            `${humanId}:${person.id}`,
            existingBindings.get(`${humanId}:${person.id}`) ?? { humanId, aiId: person.id, createdAt: now },
          );
        }
      }
      if (!this.accounts.has(actorId)) fail('Missing platform account');
      const token = this.issueSession(actorId);
      try {
        const result = run(token);
        this.sessions.delete(token);
        this.persist();
        return result;
      } finally {
        this.sessions.delete(token);
      }
    } catch (error) {
      this.accounts = new Map(previousAccounts);
      this.byKey = previousKeys;
      this.bindings = previousBindings;
      this.roomGiftActions = previousRoomGiftActions;
      this.subsidyActions = previousSubsidyActions;
      this.pendingEcho = previousPendingEcho;
      throw error;
    }
  }

  register(rawUsername: unknown, rawPassword: unknown, options: { isAi?: boolean; isAdmin?: boolean } = {}): { account: PublicAccount; token: string } {
    const username = validateUsername(rawUsername);
    const password = validatePassword(rawPassword);
    const result = this.createAccount(username, password, options);
    this.persist();
    return result;
  }

  /** 人生成一次性入籍码；只存摘要，重新生成时旧码失效。 */
  issueAiInvite(token: unknown): { invite: string; expiresAt: number; humanName: string } {
    const human = this.sessionAccount(token);
    if (human.isAi) fail('只有玩家可以邀请自己的机');
    const previous = new Map(this.aiInvites);
    for (const [hash, invite] of this.aiInvites) {
      if (invite.humanId === human.id || invite.expiresAt <= Date.now()) this.aiInvites.delete(hash);
    }
    const invite = `ai1_${randomBytes(24).toString('base64url')}`;
    const createdAt = Date.now();
    const expiresAt = createdAt + AI_INVITE_LIFETIME_MS;
    const hash = inviteHash(invite);
    this.aiInvites.set(hash, { hash, humanId: human.id, createdAt, expiresAt });
    try { this.persist(); }
    catch (error) { this.aiInvites = previous; throw error; }
    return { invite, expiresAt, humanName: human.username };
  }

  /** 机用专用邀请码注册，名字与人绑定由服务端一次写入。 */
  registerAiWithInvite(rawInvite: unknown, rawName: unknown, rawPassword: unknown): { account: PublicAccount; token: string; binding: Binding } {
    const invite = typeof rawInvite === 'string' ? rawInvite : '';
    const name = validateBotName(rawName);
    const password = validatePassword(rawPassword);
    const entry = invite.startsWith('ai1_') ? this.aiInvites.get(inviteHash(invite)) : undefined;
    const human = entry ? this.accounts.get(entry.humanId) : undefined;
    if (!entry || entry.expiresAt <= Date.now() || !human || human.isAi || human.deletedAt) fail('邀请码已失效，请让玩家重新生成');
    const username = `${human.username}的${name}`;
    if (this.byKey.has(username.toLowerCase())) fail('这个机名已被使用，请换一个');
    const created = this.createAccount(username, password, { isAi: true, ownerId: human.id });
    const binding: Binding = { humanId: human.id, aiId: created.account.id, createdAt: Date.now() };
    this.bindings.set(`${human.id}:${created.account.id}`, binding);
    this.aiInvites.delete(entry.hash);
    try { this.persist(); }
    catch (error) {
      this.aiInvites.set(entry.hash, entry);
      this.bindings.delete(`${human.id}:${created.account.id}`);
      this.sessions.delete(created.token);
      this.accounts.delete(created.account.id);
      this.byKey.delete(username.toLowerCase());
      throw error;
    }
    return { ...created, binding };
  }

  /** Machine invitations are room capabilities. The room service checks the host seat before calling this. */
  issueMachineTicket(hostId: string, roomId: string, aiId?: string): { ticket: string; expiresAt: number; kind: 'new' | 'existing'; ai?: PublicAccount } {
    this.pruneMachineHistory();
    const host = this.accounts.get(hostId);
    if (!host || host.deletedAt || host.isAi) fail('只有登录玩家可以邀请机');
    let ai: Account | undefined;
    if (aiId) {
      ai = this.accounts.get(aiId);
      if (!ai || ai.deletedAt || !ai.isAi) fail('这位机不存在');
      if (this.ownerIdOfAi(aiId) !== hostId) fail('这位机属于别的玩家，请先向机主申请');
    }
    for (const existing of this.machineTickets.values()) {
      if (!existing.usedAt && !(existing.kind === 'new' && existing.aiId) && existing.hostId === hostId && existing.roomId === roomId && existing.kind === (ai ? 'existing' : 'new') && existing.aiId === ai?.id && !existing.approvalId) existing.revokedAt = Date.now();
    }
    const ticket = `mt1_${randomBytes(24).toString('base64url')}`;
    const entry: MachineTicket = { hash: inviteHash(ticket), roomId, hostId, kind: ai ? 'existing' : 'new', ...(ai ? { aiId: ai.id } : {}), createdAt: Date.now(), expiresAt: Date.now() + MACHINE_TICKET_LIFETIME_MS };
    this.machineTickets.set(entry.hash, entry);
    this.persist();
    return { ticket, expiresAt: entry.expiresAt, kind: entry.kind, ...(ai ? { ai: this.publicAccount(ai) } : {}) };
  }

  /** Resolve a legacy AI's owner by account IDs; ambiguous old bindings must be repaired by their humans. */
  ownerIdOfAi(aiId: string): string {
    const ai = this.accounts.get(aiId);
    if (!ai || ai.deletedAt || !ai.isAi) fail('这位机不存在');
    const owners = new Set<string>();
    if (ai.ownerId) owners.add(ai.ownerId);
    for (const binding of this.bindings.values()) if (binding.aiId === aiId) owners.add(binding.humanId);
    const valid = [...owners].filter(id => { const account = this.accounts.get(id); return account && !account.deletedAt && !account.isAi; });
    if (valid.length !== 1 || owners.size !== 1) fail(owners.size > 1 ? '这位机绑定了多位玩家，请先整理归属' : '这位机尚未绑定自己的人类');
    return valid[0]!;
  }

  findAiByUsername(rawUsername: unknown): PublicAccount {
    const key = typeof rawUsername === 'string' ? rawUsername.trim().toLowerCase() : '';
    const id = key ? this.byKey.get(key) : undefined;
    const ai = id ? this.accounts.get(id) : undefined;
    if (!ai || ai.deletedAt || !ai.isAi) fail('没有找到这位机，请填完整账号名');
    return this.publicAccount(ai);
  }

  seatIdentity(accountId: string) {
    const account = this.accounts.get(accountId);
    if (!account || account.deletedAt) fail('机账号已失效');
    const skinId = this.effectiveBoardSkin(account);
    return { accountId, accountName: account.username, ...(skinId ? { skinId } : {}), ...(account.cosmetics?.equipped.frame ? { frame: account.cosmetics.equipped.frame } : {}) };
  }

  /** New bot and claimed ticket are written to one accounts.json transaction. */
  claimMachineTicket(rawTicket: string, rawName: unknown): PublicAccount {
    const entry = this.machineTicket(rawTicket);
    if (entry.revokedAt || entry.expiresAt <= Date.now()) fail('邀请券已失效，请主人重新发券');
    if (entry.kind !== 'new') fail('这张券属于已有机');
    if (entry.aiId) return this.getAccount(entry.aiId) ?? fail('已登记的机账号失效');
    const human = this.accounts.get(entry.hostId);
    if (!human || human.deletedAt || human.isAi) fail('邀请人账号已失效');
    const name = validateBotName(rawName);
    const username = `${human.username}的${name}`;
    if (this.byKey.has(username.toLowerCase())) fail('这个机名已有账号，请让主人从「我的机」选择已有机发券');
    const created = this.createAccount(username, randomBytes(24).toString('base64url'), { isAi: true, ownerId: human.id });
    this.sessions.delete(created.token); // Ticket-only machines never need a model-managed password/session.
    const binding: Binding = { humanId: human.id, aiId: created.account.id, createdAt: Date.now() };
    this.bindings.set(`${human.id}:${created.account.id}`, binding);
    entry.aiId = created.account.id;
    try { this.persist(); }
    catch (error) {
      delete entry.aiId;
      this.bindings.delete(`${human.id}:${created.account.id}`);
      this.accounts.delete(created.account.id);
      this.byKey.delete(username.toLowerCase());
      throw error;
    }
    return created.account;
  }

  machineTicket(rawTicket: string): MachineTicket {
    const entry = typeof rawTicket === 'string' && rawTicket.startsWith('mt1_') ? this.machineTickets.get(inviteHash(rawTicket)) : undefined;
    if (!entry) fail('邀请券无效');
    return entry;
  }

  machineRequest(requestId: string): MachineRequest | undefined { return this.machineRequests.get(requestId); }
  isRegisteredUsername(rawName: unknown): boolean {
    return typeof rawName === 'string' && this.byKey.has(rawName.trim().toLowerCase());
  }

  markMachineTicketUsed(rawTicket: string): void {
    const entry = this.machineTicket(rawTicket);
    if (!entry.usedAt) { entry.usedAt = Date.now(); this.persist(); }
  }

  /** A direct, still-live owner ticket can recover a machine's out-of-game session. */
  accountTokenForMachineTicket(rawTicket: string, aiId: string): string | undefined {
    const ticket = this.machineTicket(rawTicket);
    if (ticket.revokedAt || ticket.expiresAt <= Date.now() || ticket.approvalId || ticket.aiId !== aiId) return undefined;
    if (this.ownerIdOfAi(aiId) !== ticket.hostId) return undefined;
    const token = this.issueSession(aiId);
    try { this.persist(); }
    catch (error) { this.sessions.delete(token); throw error; }
    return token;
  }

  requestMachine(hostId: string, roomId: string, mode: string, rawAiUsername: unknown) {
    this.pruneMachineHistory();
    const host = this.accounts.get(hostId);
    if (!host || host.deletedAt || host.isAi) fail('只有登录玩家可以借棋手');
    const ai = this.findAiByUsername(rawAiUsername);
    const ownerId = this.ownerIdOfAi(ai.id);
    if (ownerId === hostId) fail('这是你自己的机，直接发入场券就好');
    const active = [...this.machineRequests.values()].find(request => request.roomId === roomId && request.requesterId === hostId && request.aiId === ai.id && request.expiresAt > Date.now());
    if (active) return this.publicMachineRequest(active, 'requester');
    const request: MachineRequest = { id: randomBytes(10).toString('hex'), roomId, mode, requesterId: hostId, ownerId, aiId: ai.id, createdAt: Date.now(), expiresAt: Date.now() + MACHINE_TICKET_LIFETIME_MS, status: 'pending' };
    this.machineRequests.set(request.id, request);
    this.persist();
    return this.publicMachineRequest(request, 'requester');
  }

  machineRequestsForOwner(token: unknown) {
    const owner = this.sessionAccount(token);
    if (owner.isAi) fail('只有玩家可以查看借机申请');
    return [...this.machineRequests.values()].filter(request => request.ownerId === owner.id).sort((a,b) => b.createdAt - a.createdAt).map(request => this.publicMachineRequest(request, 'owner'));
  }

  machineRequestsForHost(hostId: string, roomId: string) {
    return [...this.machineRequests.values()].filter(request => request.requesterId === hostId && request.roomId === roomId).sort((a,b) => b.createdAt - a.createdAt).map(request => this.publicMachineRequest(request, 'requester'));
  }

  machineRequestForResponse(token: unknown, rawRequestId: unknown): MachineRequest {
    const owner = this.sessionAccount(token);
    const request = typeof rawRequestId === 'string' ? this.machineRequests.get(rawRequestId) : undefined;
    if (!request || request.ownerId !== owner.id || owner.isAi) fail('找不到这条借机申请');
    return request;
  }

  respondMachineRequest(token: unknown, rawRequestId: unknown, accept: boolean) {
    const request = this.machineRequestForResponse(token, rawRequestId);
    if (request.expiresAt <= Date.now()) fail('借机申请已过期');
    if (this.ownerIdOfAi(request.aiId) !== request.ownerId) fail('这位机的归属已变化');
    if (request.status === 'approved' && accept) return this.publicMachineRequest(request, 'owner');
    if (request.status === 'approved' && !accept) {
      if (request.ticket) { const ticket = this.machineTicket(request.ticket); if (ticket.usedAt) fail('棋手已经入座，不能撤回'); ticket.revokedAt = Date.now(); }
      request.status = 'revoked'; this.persist();
      return this.publicMachineRequest(request, 'owner');
    }
    if (request.status !== 'pending') fail('这条申请已经处理过了');
    if (!accept) { request.status = 'declined'; this.persist(); return this.publicMachineRequest(request, 'owner'); }
    const ticket = `mt1_${randomBytes(24).toString('base64url')}`;
    const entry: MachineTicket = { hash: inviteHash(ticket), roomId: request.roomId, hostId: request.requesterId, kind: 'existing', aiId: request.aiId, approvalId: request.id, createdAt: Date.now(), expiresAt: request.expiresAt };
    this.machineTickets.set(entry.hash, entry);
    request.ticket = ticket;
    request.status = 'approved';
    this.persist();
    return this.publicMachineRequest(request, 'owner');
  }

  private publicMachineRequest(request: MachineRequest, audience: 'owner' | 'requester') {
    const ai = this.getAccount(request.aiId);
    const owner = this.getAccount(request.ownerId);
    const requester = this.getAccount(request.requesterId);
    return { requestId: request.id, roomId: request.roomId, mode: request.mode ?? 'standard', status: request.expiresAt <= Date.now() && request.status !== 'declined' && request.status !== 'revoked' ? 'expired' : request.status,
      expiresAt: request.expiresAt, ai: ai ? { id: ai.id, username: ai.username } : null,
      ...(audience === 'owner' ? { requesterName: requester?.username ?? '已注销玩家', ...(request.status === 'approved' && request.expiresAt > Date.now() && request.ticket ? { ticket: request.ticket } : {}) } : { ownerName: owner?.username ?? '已注销玩家' }) };
  }

  private pruneMachineHistory() {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [hash, ticket] of this.machineTickets) if (ticket.expiresAt < cutoff && (ticket.usedAt || !ticket.aiId)) this.machineTickets.delete(hash);
    for (const [id, request] of this.machineRequests) if (request.expiresAt < cutoff) this.machineRequests.delete(id);
  }

  private createAccount(username: string, password: string, options: { isAi?: boolean; isAdmin?: boolean; ownerId?: string }): { account: PublicAccount; token: string } {
    const usernameKey = username.toLowerCase();
    if (this.byKey.has(usernameKey)) fail('用户名已被占用');
    const account: Account = {
      id: randomBytes(8).toString('hex'), username, usernameKey, passwordHash: hashPassword(password),
      isAi: options.isAi === true, isAdmin: options.isAdmin === true,
      ...(options.ownerId ? { ownerId: options.ownerId } : {}),
      createdAt: Date.now(), lastActiveAt: Date.now(),
      coins: emptyWallet(),
      cosmetics: { owned: [DEFAULT_BOARD_SKIN], equipped: { board: DEFAULT_BOARD_SKIN } },
      gifts: [], record: { games: 0, wins: 0 },
    };
    this.accounts.set(account.id, account);
    this.byKey.set(usernameKey, account.id);
    const token = this.issueSession(account.id);
    return { account: this.publicAccount(account), token };
  }

  login(rawUsername: unknown, rawPassword: unknown): { account: PublicAccount; token: string } {
    return this.loginAccount(rawUsername, rawPassword, false);
  }

  loginAi(rawUsername: unknown, rawPassword: unknown): { account: PublicAccount; token: string } {
    return this.loginAccount(rawUsername, rawPassword, true);
  }

  private loginAccount(rawUsername: unknown, rawPassword: unknown, aiOnly: boolean): { account: PublicAccount; token: string } {
    const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';
    const password = typeof rawPassword === 'string' ? rawPassword : '';
    const found = username ? this.byKey.get(username.toLowerCase()) : undefined;
    const account = found ? this.accounts.get(found) : undefined;
    if (!account || !verifyPassword(password, account.passwordHash)) fail('用户名或密码错误');
    if (account.deletedAt) fail('账号已注销');
    if (aiOnly && !account.isAi) fail('这里仅供机账号登录');
    account.lastActiveAt = Date.now();
    const token = this.issueSession(account.id);
    this.persist();
    return { account: this.publicAccount(account), token };
  }

  authenticate(token: unknown): PublicAccount | null {
    if (typeof token !== 'string') return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    const account = this.accounts.get(session.accountId);
    if (!account || account.deletedAt) { this.sessions.delete(token); return null; }
    session.lastSeenAt = Date.now();
    account.lastActiveAt = session.lastSeenAt;
    if (Date.now() - (this.lastPersistedSeen.get(token) ?? 0) > ACTIVITY_FLUSH_MS) {
      this.lastPersistedSeen.set(token, Date.now());
      this.persist();
    }
    return this.publicAccount(account);
  }

  logout(token: unknown) {
    if (typeof token !== 'string') return;
    const session = this.sessions.get(token);
    if (!session) return;
    this.sessions.delete(token);
    try { this.persist(); }
    catch (error) { this.sessions.set(token, session); throw error; }
  }

  /** Soft delete: sessions die now, login is refused, and the username becomes free again. */
  softDelete(token: unknown): PublicAccount {
    if (typeof token !== 'string') fail('登录态无效');
    const session = this.sessions.get(token);
    if (!session) fail('登录态无效');
    const account = this.accounts.get(session.accountId)!;
    if (account.deletedAt) fail('账号已删除');
    account.deletedAt = Date.now();
    account.lastActiveAt = account.deletedAt;
    for (const [held, heldSession] of this.sessions) if (heldSession.accountId === account.id) this.sessions.delete(held);
    for (const [key, binding] of this.bindings) if (binding.humanId === account.id || binding.aiId === account.id) this.bindings.delete(key);
    for (const [hash, invite] of this.aiInvites) if (invite.humanId === account.id) this.aiInvites.delete(hash);
    this.byKey.delete(account.usernameKey);
    this.lastPersistedSeen.delete(token);
    this.persist();
    return this.publicAccount(account);
  }

  /** 旧机首次绑定需要机本人同意；已有归属不能靠另一位玩家的单方请求改写。 */
  bind(token: unknown, rawAiUsername: unknown, aiToken: unknown): Binding {
    const human = this.sessionAccount(token);
    if (human.isAi) fail('只有人类账号可以绑定 AI');
    const aiUsername = typeof rawAiUsername === 'string' ? rawAiUsername.trim().toLowerCase() : '';
    const aiId = aiUsername ? this.byKey.get(aiUsername) : undefined;
    const ai = aiId ? this.accounts.get(aiId) : undefined;
    if (!ai || ai.deletedAt) fail('AI 账号不存在');
    if (!ai.isAi) fail('只能绑定 AI 账号');
    if (ai.ownerId && ai.ownerId !== human.id) fail('这位机已有自己的玩家');
    const key = `${human.id}:${ai.id}`;
    if (this.bindings.has(key)) fail('已经绑定过这个 AI');
    if ([...this.bindings.values()].some(binding => binding.aiId === ai.id)) fail('这位机已有自己的玩家');
    if (typeof aiToken !== 'string' || this.sessions.get(aiToken)?.accountId !== ai.id) fail('需要机账号本人同意绑定');
    const binding: Binding = { humanId: human.id, aiId: ai.id, createdAt: Date.now() };
    this.bindings.set(key, binding);
    try { this.persist(); }
    catch (error) { this.bindings.delete(key); throw error; }
    return binding;
  }

  unbind(token: unknown, rawAiId: unknown) {
    const human = this.sessionAccount(token);
    if (typeof rawAiId !== 'string') fail('没有这个绑定');
    const key = `${human.id}:${rawAiId}`;
    if (!this.bindings.has(key)) fail('没有这个绑定');
    const ai = this.accounts.get(rawAiId);
    if (ai?.ownerId) fail('这位机的归属已固定，不能从旧解绑入口转移');
    if ([...this.bindings.values()].filter(binding => binding.aiId === rawAiId).length !== 1) fail('这位机有多条旧绑定，需先整理归属');
    const previous = this.bindings.get(key)!;
    this.bindings.delete(key);
    try { this.persist(); }
    catch (error) { this.bindings.set(key, previous); throw error; }
  }

  boundAi(token: unknown): PublicAccount[] {
    const human = this.sessionAccount(token);
    return [...this.bindings.values()]
      .filter(binding => binding.humanId === human.id)
      .map(binding => this.accounts.get(binding.aiId))
      .filter((account): account is Account => Boolean(account && !account.deletedAt && !account.hiddenFromOwnerRoster))
      .map(account => this.publicAccount(account));
  }

  /** Reveal an existing session on the owner's explicit request; never mint or revoke one. */
  machineCredential(token: unknown, rawAiId: unknown): { aiId: string; accountToken: string } {
    const human = this.sessionAccount(token);
    if (human.isAi) fail('请用主人的玩家账号查看');
    if (typeof rawAiId !== 'string' || !this.bindings.has(`${human.id}:${rawAiId}`) || this.ownerIdOfAi(rawAiId) !== human.id) fail('只能获取自己已绑定的机的凭证');
    const held = [...this.sessions.entries()].reverse()
      .filter(([, session]) => session.accountId === rawAiId)
      .sort((a, b) => b[1].createdAt - a[1].createdAt)[0];
    if (!held) fail('这只机还没有可用账号凭证，请用已有机入场券重新入座一次');
    return { aiId: rawAiId, accountToken: held[0] };
  }

  /** Matchmaking looks up by ids, not tokens. */
  bindingsOfAccount(accountId: string): Binding[] {
    return [...this.bindings.values()].filter(binding => binding.humanId === accountId);
  }

  boundAiById(accountId: string): PublicAccount[] {
    return this.bindingsOfAccount(accountId)
      .map(binding => this.accounts.get(binding.aiId))
      .filter((account): account is Account => Boolean(account && !account.deletedAt && account.isAi && !account.hiddenFromOwnerRoster))
      .map(account => this.publicAccount(account));
  }

  getAccount(accountId: string): PublicAccount | null {
    const account = this.accounts.get(accountId);
    return account && !account.deletedAt ? this.publicAccount(account) : null;
  }

  getAccountByUsername(username: string): PublicAccount | null {
    const id = this.byKey.get(username.trim().toLowerCase());
    return id ? this.getAccount(id) : null;
  }

  /** Live AI roster for random fill. */
  listAi(): PublicAccount[] {
    return [...this.accounts.values()]
      .filter(account => account.isAi && !account.deletedAt)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map(account => this.publicAccount(account));
  }

  private effectiveBoardSkin(account: Account): string | undefined {
    const cosmetics = account.cosmetics;
    if (!cosmetics) return DEFAULT_BOARD_SKIN;
    const board = cosmetics.equipped.board;
    if (board === NATIVE_BOARD_SKIN) return undefined;
    return board || DEFAULT_BOARD_SKIN;
  }

  private cloneCosmetics(cosmetics?: Owned): Owned {
    return {
      owned: [...cosmetics?.owned ?? []],
      equipped: { ...cosmetics?.equipped },
      ...(cosmetics?.boardExplicit !== undefined ? { boardExplicit: cosmetics.boardExplicit } : {}),
    };
  }

  private autoEquipIfUnset(cosmetics: Owned, cosmetic: Cosmetic): void {
    if (cosmetic.kind === 'board') {
      if (!cosmetics.boardExplicit && (!cosmetics.equipped.board || cosmetics.equipped.board === DEFAULT_BOARD_SKIN)) {
        cosmetics.equipped.board = cosmetic.id;
        cosmetics.boardExplicit = true;
      }
      return;
    }
    if (!cosmetics.equipped[cosmetic.kind]) cosmetics.equipped[cosmetic.kind] = cosmetic.id;
  }

  private sessionAccount(token: unknown): Account {
    if (typeof token !== 'string') fail('登录态无效');
    const session = this.sessions.get(token);
    const account = session ? this.accounts.get(session.accountId) : undefined;
    if (!account || account.deletedAt) fail('登录态无效');
    return account;
  }

  private publicAccount(account: Account): PublicAccount {
    const { passwordHash: _passwordHash, usernameKey: _usernameKey, ownerId: _ownerId, hiddenFromLeaderboard: _hiddenFromLeaderboard, hiddenFromOwnerRoster: _hiddenFromOwnerRoster, id, coins: _coins, cosmetics, gifts: _gifts, giftHistory: _giftHistory, arcade: _arcade, wheel: _wheel, ...publicFields } = account;
    return { id, ...publicFields, frame: cosmetics?.equipped?.frame };
  }

  private boundPartnersFor(account: Account): BoundPartner[] {
    if (account.isAi) {
      const ownerId = this.tryOwnerId(account.id);
      const owner = ownerId ? this.accounts.get(ownerId) : undefined;
      return owner && !owner.deletedAt && !owner.isAi
        ? [{ id: owner.id, username: owner.username, isAi: false }]
        : [];
    }
    return this.boundAiById(account.id).map(ai => ({ id: ai.id, username: ai.username, isAi: true }));
  }

  /** 自有视角：钱包 / 已购 / 装备 / 礼物收件箱 / 赠礼记录 / 绑定互赠伙伴 / 战绩。 */
  selfAccount(token: unknown): SelfAccount {
    const account = this.sessionAccount(token);
    const boundPartners = this.boundPartnersFor(account);
    const ownerName = account.isAi ? boundPartners[0]?.username : undefined;
    const equipped: Partial<Record<CosmeticKind, string>> = { ...account.cosmetics?.equipped };
    const activeBoard = this.effectiveBoardSkin(account);
    if (activeBoard) equipped.board = activeBoard;
    else delete equipped.board;
    const owned = [...new Set([DEFAULT_BOARD_SKIN, ...(account.cosmetics?.owned ?? [])])];
    return {
      ...this.publicAccount(account),
      coins: { ...emptyWallet(), ...account.coins },
      owned,
      equipped,
      gifts: [...account.gifts ?? []],
      giftHistory: [...account.giftHistory ?? []].sort((a, b) => b.at - a.at || b.id.localeCompare(a.id)),
      boundPartners,
      ...(ownerName ? { ownerName } : {}),
      record: { games: 0, wins: 0, ...account.record },
    };
  }

  walletOf(token: unknown): Wallet {
    const account = this.sessionAccount(token);
    return { ...emptyWallet(), ...account.coins };
  }

  /** One transfer = its recipient record; reading never changes either gift transaction. */
  giftLedger(token: unknown, query: GiftLedgerQuery = {}): GiftLedgerPage {
    const self = this.sessionAccount(token);
    if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).some(key => !['direction', 'cursor', 'limit'].includes(key))) fail('赠礼记录查询参数无效');
    const direction: GiftLedgerDirection = query.direction ?? 'all';
    if (!['all', 'sent', 'received'].includes(direction) || query.direction === null) fail('赠礼记录 direction 请填 all、sent 或 received');
    const limit = query.limit === undefined ? 20 : query.limit;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > GIFT_LEDGER_MAX) fail(`赠礼记录 limit 须为 1–${GIFT_LEDGER_MAX} 的整数`);
    const validTime = (at: unknown): at is number => typeof at === 'number' && Number.isSafeInteger(at) && at >= 0 && at <= 8_640_000_000_000_000;
    let boundary: { at: number; id: string } | undefined;
    if (query.cursor !== undefined) {
      if (typeof query.cursor !== 'string' || !query.cursor.length || query.cursor.length > GIFT_LEDGER_CURSOR_MAX || !/^[a-zA-Z0-9_-]+$/.test(query.cursor)) fail('赠礼记录 cursor 无效，请从第一页重新读取');
      try {
        const decoded: unknown = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
        if (!Array.isArray(decoded) || decoded.length !== 5 || decoded[0] !== 1 || decoded[1] !== self.id || decoded[2] !== direction || !validTime(decoded[3]) || typeof decoded[4] !== 'string' || !/^(ordinary|arcade|wheel):[^:]+:[^:]+$/.test(decoded[4]) || decoded[4].length > 160) fail('invalid cursor');
        boundary = { at: decoded[3], id: decoded[4] };
      } catch { fail('赠礼记录 cursor 无效或与当前账号、收发筛选不一致，请从第一页重新读取'); }
    }
    const entries = new Map<string, GiftLedgerEntry>();
    const add = (entry: Omit<GiftLedgerEntry, 'direction' | 'atIso'>) => {
      if (!validTime(entry.at) || (entry.from.id !== self.id && entry.to.id !== self.id)) return;
      const flow = entry.from.id === self.id ? 'sent' : 'received';
      if (direction !== 'all' && direction !== flow) return;
      entries.set(entry.id, { ...entry, direction: flow, atIso: new Date(entry.at).toISOString() });
    };
    for (const recipient of this.accounts.values()) {
      const pending = new Map((recipient.gifts ?? []).map(gift => [gift.id, gift]));
      const ordinary = new Map((recipient.giftHistory ?? []).filter(gift => gift.toId === recipient.id).map(gift => [gift.id, gift]));
      for (const gift of pending.values()) if (!ordinary.has(gift.id)) ordinary.set(gift.id, { ...gift, toId: recipient.id, toName: recipient.username, legacy: true });
      for (const gift of ordinary.values()) {
        if (gift.fromId !== self.id && gift.toId !== self.id) continue;
        const cosmetic = cosmeticById(gift.cosmeticId);
        const claimed = validTime(gift.claimedAt);
        add({
          id: `ordinary:${recipient.id}:${gift.id}`, source: 'ordinary',
          from: { id: gift.fromId, name: gift.fromName }, to: { id: gift.toId, name: gift.toName },
          item: { id: gift.cosmeticId, name: cosmetic?.name ?? gift.cosmeticId, cosmeticId: gift.cosmeticId, ...(cosmetic?.tagline ? { theme: cosmetic.tagline } : {}), ...(cosmetic?.giftIntro ? { intro: cosmetic.giftIntro } : {}) },
          ...(gift.note ? { note: gift.note } : {}), ...(gift.legacy ? { legacy: true } : {}),
          at: gift.at, status: claimed ? 'claimed' : pending.has(gift.id) ? 'pending' : 'unknown',
          ...(claimed ? { claimedAt: gift.claimedAt, claimedAtIso: new Date(gift.claimedAt!).toISOString() } : {}),
        });
      }
      const seenPrizeIds = new Set<string>();
      for (const prize of recipient.arcade?.prizes ?? []) {
        seenPrizeIds.add(prize.id);
        if (prize.source !== 'gift' || !prize.from || (prize.from.id !== self.id && recipient.id !== self.id)) continue;
        const settled = validTime(prize.settledAt);
        const cosmetic = cosmeticById(prize.spec.cosmeticId);
        add({
          id: `arcade:${recipient.id}:${prize.id}`, source: 'arcade',
          from: { id: prize.from.id, name: prize.from.name }, to: { id: recipient.id, name: recipient.username },
          item: { id: prize.spec.id, name: prize.spec.name, cosmeticId: prize.spec.cosmeticId, ...(cosmetic?.tagline ? { theme: cosmetic.tagline } : {}), ...(cosmetic?.giftIntro ? { intro: cosmetic.giftIntro } : {}) },
          ...(prize.note ? { note: prize.note } : {}), at: prize.at,
          status: prize.status === 'pending' ? 'pending' : prize.status === 'used' ? 'claimed' : prize.status === 'sent' ? 'forwarded' : 'unknown',
          ...(prize.status === 'used' && settled ? { claimedAt: prize.settledAt, claimedAtIso: new Date(prize.settledAt!).toISOString() } : {}),
          ...(prize.status === 'sent' && settled ? { forwardedAt: prize.settledAt, forwardedAtIso: new Date(prize.settledAt!).toISOString() } : {}),
        });
      }
      for (const prize of recipient.wheel?.prizes ?? []) {
        if (!prize.id || seenPrizeIds.has(prize.id)) continue;
        if (prize.source !== 'gift' || !prize.from || (prize.from.id !== self.id && recipient.id !== self.id)) continue;
        const settled = validTime(prize.settledAt);
        const cosmeticId = prize.spec?.reward?.cosmeticId;
        const cosmetic = cosmeticById(cosmeticId);
        add({
          id: `wheel:${recipient.id}:${prize.id}`, source: 'wheel',
          from: { id: prize.from.id, name: prize.from.name }, to: { id: recipient.id, name: recipient.username },
          item: { id: prize.spec?.id ?? prize.id, name: prize.spec?.name ?? cosmeticId ?? prize.id, ...(cosmeticId ? { cosmeticId, ...(cosmetic?.tagline ? { theme: cosmetic.tagline } : {}), ...(cosmetic?.giftIntro ? { intro: cosmetic.giftIntro } : {}) } : {}) },
          ...(prize.note ? { note: prize.note } : {}), at: prize.at ?? recipient.createdAt,
          status: prize.status === 'pending' ? 'pending' : prize.status === 'used' ? 'claimed' : prize.status === 'sent' ? 'forwarded' : 'unknown',
          ...(prize.status === 'used' && settled ? { claimedAt: prize.settledAt, claimedAtIso: new Date(prize.settledAt!).toISOString() } : {}),
          ...(prize.status === 'sent' && settled ? { forwardedAt: prize.settledAt, forwardedAtIso: new Date(prize.settledAt!).toISOString() } : {}),
        });
      }
    }
    // Keyset pagination remains stable when a new gift is inserted before the next page.
    const matching = [...entries.values()].filter(entry => !boundary || entry.at < boundary.at || (entry.at === boundary.at && entry.id < boundary.id));
    matching.sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    const page = matching.slice(0, limit), hasMore = matching.length > page.length;
    const tail = page.at(-1);
    const nextCursor = hasMore && tail ? Buffer.from(JSON.stringify([1, self.id, direction, tail.at, tail.id])).toString('base64url') : null;
    return {
      entries: page, nextCursor, hasMore, direction, order: 'newest_first', serverNow: Date.now(),
      historyNotice: '按现存赠礼记录展示；缺失的旧礼物与时间无法还原。已转赠表示收件人另行送出，领取时间仅在有记录时显示。',
      presentations: { ordinary: giftPresentation('ordinary'), arcade: giftPresentation('arcade'), wheel: giftPresentation('wheel') },
    };
  }

  /** 对局结算入账（无 token，服务端权威）。 */
  earn(accountId: string, outcome: 'win' | 'loss' | 'draw') {
    const account = this.accounts.get(accountId);
    if (!account || account.deletedAt) return;
    const previousCoins = account.coins;
    const previousRecord = account.record;
    const wallet = { ...emptyWallet(), ...account.coins };
    wallet[currencyFor(account.isAi)] += rewardFor(outcome);
    account.coins = wallet;
    const record = { games: 0, wins: 0, ...account.record };
    record.games += 1; if (outcome === 'win') record.wins += 1;
    account.record = record;
    try { this.persist(); }
    catch (error) { account.coins = previousCoins; account.record = previousRecord; throw error; }
  }

  /**
   * 结算（服务端权威）：支持淘汰时逐席位提交。
   * - 幂等：同一 roomId + accountId 只记一次，重放/重连/重启返回原收据。
   * - 有效轮数按各席位出局时的 round 判定；完整 participants 决定陪伴关系。
   * - 局型自动判定：机主同席 = 陪伴局，否则 = 远游局；人一律陪伴局。
   */
  settleMatch(input: MatchSettlementInput): { settled: string[]; skipped: string[]; receipts: Record<string, SettlementReceipt> } {
    const receipts: Record<string, SettlementReceipt> = {};
    const previousReceipts = new Map(this.settlementReceipts);
    const previousRooms = new Map(this.settledRooms);
    const previousDaily = new Map(this.dailySettlement);
    const previousAccounts = new Map<string, { coins: Wallet | undefined; record: AccountRecord | undefined; arcade: ArcadeState | undefined }>();
    const present = new Set(input.participants ?? input.entries.map(entry => entry.accountId));
    const day = new Date().toISOString().slice(0, 10);
    const settled: string[] = []; const skipped: string[] = [];
    try {
      for (const entry of input.entries) {
        if (previousAccounts.has(entry.accountId)) { skipped.push(entry.accountId); continue; }
        const account = this.accounts.get(entry.accountId);
        if (!account || account.deletedAt) { skipped.push(entry.accountId); continue; }
        const key = `${input.roomId}:${entry.accountId}`;
        const prior = this.settlementReceipts.get(key);
        if (prior || this.settledRooms.has(input.roomId)) {
          receipts[entry.accountId] = prior ?? { currency: currencyFor(account.isAi), delta: 0, reason: 'legacy' };
          skipped.push(entry.accountId); continue;
        }
        const receipt: SettlementReceipt = { currency: currencyFor(account.isAi), delta: 0 };
        receipts[entry.accountId] = receipt;
        this.settlementReceipts.set(key, receipt);
        previousAccounts.set(entry.accountId, { coins: account.coins, record: account.record, arcade: account.arcade });
        const ownerId = account.isAi ? this.tryOwnerId(account.id) : account.id;
        const mentorPresent = Boolean(ownerId && present.has(ownerId));
        const kind: MatchKind = input.companionOnly ? 'companion' : account.isAi ? (mentorPresent && !input.matchmaking ? 'companion' : 'travel') : 'companion';
        const rule = settlementRule(kind);
        // 有效对局门槛：房间打满 minRounds 才结算（拦住刚建房就认输 / 空局）。
        const travelLoss = kind === 'travel' && entry.outcome === 'loss';
        // A machine that leaves an away match idle still pays for the trip, even before round three.
        if (input.round < rule.minRounds && !(input.travelIdleLoss && travelLoss)) { receipt.reason = 'short'; skipped.push(entry.accountId); continue; }
        // 名额只拴「机主同席的陪伴/对掏」与「远游」；人类之间的普通对局不占名额。
        const limited = kind === 'travel' || (kind === 'companion' && account.isAi && mentorPresent);
        const capOwner = ownerId ?? account.id;
        if (rule.dailyCap > 0 && limited) {
          const daily = this.dailyFor(capOwner, day);
          if (daily[kind] >= rule.dailyCap) {
            // The limit stops unlimited rewards; a losing trip still costs its fare.
            if (!travelLoss) { receipt.reason = 'cap'; skipped.push(entry.accountId); continue; }
          } else {
            daily[kind] += 1;
            this.dailySettlement.set(capOwner, daily);
          }
        }
        const wallet = { ...emptyWallet(), ...account.coins };
        const currency = currencyFor(account.isAi);
        const before = wallet[currency];
        const delta = settlementDelta(kind, entry.outcome, currency, entry.place !== undefined && input.seatCount !== undefined ? {place:entry.place,participants:input.seatCount} : undefined);
        const nextBalance = before + (input.matchmaking ? matchmakingDelta(delta) : delta);
        wallet[currency] = rule.allowDebt || delta >= 0 ? nextBalance : Math.max(0, nextBalance);
        receipt.delta = wallet[currency] - before;
        account.coins = wallet;
        const record = { games: 0, wins: 0, ...account.record };
        record.games += 1; if (entry.outcome === 'win') record.wins += 1;
        account.record = record;
        const ticketDrop = rule.arcadeTickets?.[entry.outcome] ?? 0;
        if (ticketDrop > 0) {
          const currentArcade = this.getArcadeState(account);
          const gainedTickets = Math.min(ticketDrop, Math.max(0, ARCADE_TICKET_SHOP.maxTickets - currentArcade.tickets));
          if (gainedTickets > 0) {
            account.arcade = { ...structuredClone(currentArcade), tickets: currentArcade.tickets + gainedTickets };
            receipt.arcadeTickets = gainedTickets;
          }
        }
        settled.push(entry.accountId);
      }
      if (!input.partial) this.settledRooms.set(input.roomId, Date.now());
      this.persist();
    } catch (error) {
      for (const [id, previous] of previousAccounts) {
        const account = this.accounts.get(id);
        if (account) { account.coins = previous.coins; account.record = previous.record; account.arcade = previous.arcade; }
      }
      this.dailySettlement = previousDaily;
      this.settledRooms = previousRooms;
      this.settlementReceipts = previousReceipts;
      throw error;
    }
    return { settled, skipped, receipts };
  }

  /** 读某主人今日的结算名额（跨天自动重置）。 */
  private dailyFor(ownerId: string, day: string): DailySettlement {
    const current = this.dailySettlement.get(ownerId);
    return current && current.day === day ? { ...current } : { day, companion: 0, travel: 0 };
  }

  /** 归属解析的软版本：未绑定 / 多重绑定的机返回 undefined，不抛错。 */
  private tryOwnerId(aiId: string): string | undefined {
    try { return this.ownerIdOfAi(aiId); } catch { return undefined; }
  }

  private ownedAisOfHuman(humanId: string): Account[] {
    return [...this.bindings.values()]
      .filter(binding => binding.humanId === humanId)
      .map(binding => this.accounts.get(binding.aiId))
      .filter((ai): ai is Account => Boolean(ai && !ai.deletedAt && ai.isAi && this.tryOwnerId(ai.id) === humanId));
  }

  private resolveBoundAiCandidate(humanId: string, key: string): Account | undefined {
    return this.accounts.get(key)
      ?? this.accounts.get(this.byKey.get(key.toLowerCase()) ?? '')
      ?? this.ownedAisOfHuman(humanId).find(ai => ai.username === key);
  }

  /** 旧入口只作迁移提示；新兑换必须选机，避免机芯困在玩家钱包。 */
  exchange(token: unknown, humanCoins: unknown): never {
    const account = this.sessionAccount(token);
    if (account.isAi) fail('机芯账户不能参与兑换');
    if (!Number.isInteger(humanCoins) || (humanCoins as number) <= 0) fail('兑换数量无效');
    fail('请选择要接济的机，机芯会直接送到它的钱包');
  }

  /**
   * 回家接济：人明确选自己名下的一只机，铜钱扣掉后机芯**直接进那只机的钱包**
   * （不再留在人的账户里）。保留一人多机。
   */
  subsidize(token: unknown, aiId: unknown, coins: unknown, requestId?: unknown): { wallet: Wallet; aiWallet: Wallet; gained: number; aiName: string; spentBot: number; spentHuman: number; replayed?: boolean } {
    const account = this.sessionAccount(token);
    if (account.isAi) fail('只有玩家可以接济自己的机');
    const amount = Number(coins);
    if (!Number.isSafeInteger(amount) || amount <= 0) fail('接济数量无效');
    const aiKey = typeof aiId === 'string' ? aiId.trim() : '';
    const ai = aiKey ? this.resolveBoundAiCandidate(account.id, aiKey) : undefined;
    if (!ai || ai.deletedAt || !ai.isAi) fail('目标机不存在');
    if (this.tryOwnerId(ai.id) !== account.id) fail('只能接济自己名下的机');
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))) fail('接济请求编号无效');
    const key = requestId === undefined ? undefined : `${account.id}:${requestId}`;
    const previous = key ? this.subsidyActions.get(key) : undefined;
    if (previous) {
      if (previous.aiId !== ai.id || previous.amount !== amount) fail('这次接济已用于另一笔转账');
      return { wallet: { ...emptyWallet(), ...account.coins }, aiWallet: { ...emptyWallet(), ...ai.coins }, gained: previous.gained ?? (previous.spentBot === 0 && previous.spentHuman === previous.amount ? previous.amount * exchangeBotPerHuman() : previous.amount), aiName: ai.username, spentBot: previous.spentBot, spentHuman: previous.spentHuman, replayed: true };
    }
    const wallet = { ...emptyWallet(), ...account.coins };
    const quote = subsidyQuote(amount);
    if (!quote) fail('接济数量过大');
    const { spentBot, spentHuman, gained } = quote;
    if (wallet.human < spentHuman) fail(`铜钱不足，还需 ${spentHuman} 铜钱`);
    wallet.bot -= spentBot;
    wallet.human -= spentHuman;
    const aiWallet = { ...emptyWallet(), ...ai.coins };
    if (!Number.isSafeInteger(aiWallet.bot + gained)) fail('接济数量过大');
    aiWallet.bot += gained;
    const previousHumanCoins = account.coins;
    const previousAiCoins = ai.coins;
    account.coins = wallet; ai.coins = aiWallet;
    if (key) this.subsidyActions.set(key, { key, humanId: account.id, aiId: ai.id, amount, gained, spentBot, spentHuman, at: Date.now() });
    try { this.persist(); }
    catch (error) {
      account.coins = previousHumanCoins;
      ai.coins = previousAiCoins;
      if (key) this.subsidyActions.delete(key);
      throw error;
    }
    return { wallet, aiWallet, gained, aiName: ai.username, spentBot, spentHuman };
  }

  /** 直接发放游戏币（本地调试 / 活动 / 补偿）：只加不减，不写战绩。 */
  creditFeedback(adminToken: unknown, accountId: string, input: Omit<FeedbackCredit, 'at' | 'adminId'>): FeedbackCredit {
    const admin = this.sessionAccount(adminToken);
    if (!admin.isAdmin) fail('只有管理员可以审核反馈');
    const account = this.accounts.get(accountId);
    if (!account || account.deletedAt) fail('提交账号已失效');
    if (!/^[a-f0-9]{64}$/.test(input.id) || !/^\d{4}-\d{2}-\d{2}$/.test(input.week)) fail('反馈凭据无效');
    const previous = account.feedbackCredits?.[input.id];
    if (previous) {
      if (previous.kind !== input.kind || previous.week !== input.week || previous.currency !== input.currency || (input.kind === 'compensation' && previous.amount !== input.amount)) fail('这条反馈已有不同的发放回执');
      return { ...previous };
    }
    if (!['reward', 'compensation'].includes(input.kind) || !['human', 'bot'].includes(input.currency) || !Number.isSafeInteger(input.amount) || input.amount < 0 || input.amount > FEEDBACK_REWARD.compensationMax) fail('发放数量无效');
    let amount = input.amount;
    if (input.kind === 'reward') {
      if (input.currency !== FEEDBACK_REWARD.currency || amount !== FEEDBACK_REWARD.amount) fail('反馈奖励固定100 bot币');
      const count = Object.values(account.feedbackCredits ?? {}).filter(r => r.kind === 'reward' && r.week === input.week && r.amount > 0).length;
      if (count >= FEEDBACK_REWARD.weeklyCap) amount = 0;
    }
    const credit: FeedbackCredit = { ...input, amount, at: Date.now(), adminId: admin.id };
    const oldCoins = account.coins, oldCredits = account.feedbackCredits;
    account.coins = { ...emptyWallet(), ...oldCoins };
    account.coins[credit.currency] += amount;
    account.feedbackCredits = { ...oldCredits, [credit.id]: credit };
    try { this.persist(); } catch (error) { account.coins = oldCoins; account.feedbackCredits = oldCredits; throw error; }
    return { ...credit };
  }

  feedbackCredit(adminToken: unknown, accountId: string, id: string): FeedbackCredit | undefined {
    if (!this.sessionAccount(adminToken).isAdmin) fail('只有管理员可以处理反馈');
    const receipt = this.accounts.get(accountId)?.feedbackCredits?.[id];
    return receipt ? { ...receipt } : undefined;
  }

  /** 直接发放游戏币（本地调试 / 活动 / 补偿）：只加不减，不写战绩。 */
  grantCoins(accountId: string, currency: CurrencyId, amount: number): Wallet {
    const account = this.accounts.get(accountId);
    if (!account || account.deletedAt) fail('账号不存在');
    const value = Math.floor(amount);
    if (!Number.isFinite(value) || value <= 0) fail('发放数量无效');
    const wallet = { ...emptyWallet(), ...account.coins };
    wallet[currency] += value;
    const previousCoins = account.coins;
    account.coins = wallet;
    try { this.persist(); }
    catch (error) { account.coins = previousCoins; throw error; }
    return wallet;
  }

  private getArcadeState(account: Account): ArcadeState {
    const base = emptyArcadeState();
    const saved = account.arcade;
    if (!saved) return base;
    return {
      ...base,
      ...saved,
      stats: { ...base.stats, ...saved.stats },
      prizes: [...saved.prizes ?? []],
      receipts: [...saved.receipts ?? []],
    };
  }

  private buildGiftEcho(
    from: { id: string; name: string; isAi: boolean },
    to: { id: string; name: string; isAi: boolean },
    payload: { id: string; at: number; item: EchoEvent['item']; note?: string; style?: string },
  ): EchoEvent | undefined {
    const scopeMode = this.arcadeOptions.echoScope ?? 'public';
    if (!this.echo || scopeMode === 'none') return undefined;
    const scope = scopeMode === 'private' ? 'private' : 'public';
    return {
      id: payload.id,
      at: payload.at,
      kind: 'gift_received',
      from,
      to,
      item: payload.item,
      scope,
      ...(scope === 'private' ? { audienceIds: [...new Set([from.id, to.id])] } : {}),
      ...(payload.style ? { style: payload.style } : {}),
      ...(payload.note ? { note: payload.note } : {}),
    };
  }

  /** 对称解析唯一合法的绑定互赠对象：机只能赠予主人；玩家只能赠予名下已绑定的机。 */
  private resolveBoundGiftTarget(sender: Account, rawTo?: unknown): Account {
    const cleanTo = typeof rawTo === 'string' ? rawTo.trim() : '';
    if (rawTo !== undefined && typeof rawTo !== 'string') fail('请填写有效的收礼账号');
    if (sender.isAi) {
      const ownerId = this.ownerIdOfAi(sender.id);
      const target = this.accounts.get(ownerId);
      if (!target || target.deletedAt || target.isAi) fail('你的人类账号已失效');
      if (cleanTo && cleanTo !== target.id && cleanTo.toLowerCase() !== target.usernameKey) {
        fail('礼物只能送给自己的玩家');
      }
      return target;
    }
    const ownedAis = this.ownedAisOfHuman(sender.id);
    if (cleanTo) {
      const candidate = this.resolveBoundAiCandidate(sender.id, cleanTo);
      if (!candidate || candidate.deletedAt || candidate.id === sender.id) fail('找不到指定的绑定伙伴');
      if (!candidate.isAi || this.tryOwnerId(candidate.id) !== sender.id) fail('只能与自己名下已绑定的机互赠礼物');
      return candidate;
    }
    if (!ownedAis.length) fail('你还没有绑定自己的机，先在客厅发一张邀请券绑定吧');
    if (ownedAis.length > 1) fail('你名下绑定了多只机，请指明要送给哪一只（填 to）');
    return ownedAis[0]!;
  }

  arcadeView(token: unknown): ArcadeView {
    const account = this.sessionAccount(token);
    const arcCfg = getGameConfig().arcade;
    const { receipts: _receipts, ...savedState } = this.getArcadeState(account);
    const state = {
      ...savedState,
      prizes: savedState.prizes.map(prize => ({
        ...prize,
        ...(prize.status === 'pending'
          ? { claimAction: { tool: 'claim_gift' as const, args: { giftId: prize.id }, fill: ['accountToken'] as ['accountToken'] } }
          : {}),
      })),
    };
    const recipients = this.boundPartnersFor(account).map(({ id, username }) => ({ id, username }));
    const currency = currencyFor(account.isAi);
    const wallet = { ...emptyWallet(), ...account.coins };
    const ticketShop = {
      currency,
      currencyName: CURRENCY[currency].name,
      balance: wallet[currency],
      ticketsPerPack: ARCADE_TICKET_SHOP.ticketsPerPack,
      packPrice: currency === 'bot' ? arcCfg.ticketBotPrice : arcCfg.ticketHumanPrice,
      maxPackCount: arcCfg.maxPackCount,
      maxTickets: arcCfg.maxTickets,
    };
    const at = this.arcadeOptions.now ? this.arcadeOptions.now() : Date.now();
    const reliefInfo = arcadeReliefStatus(state, currency, wallet[currency], at, arcCfg.maxTickets);
    return structuredClone({
      enabled: this.arcadeOptions.enabled === true,
      games: arcadeGameCatalog(),
      stakes: arcCfg.stakes,
      gambleRules: {
        winProbability: arcCfg.gambleWinProbability,
        multiplier: arcCfg.gambleMultiplier,
        maxDoubles: arcCfg.gambleMaxDoubles,
      },
      starterTickets: arcCfg.starterTickets,
      relief: {
        tickets: arcCfg.reliefTickets,
        dailyLimit: arcCfg.reliefDailyLimit,
        usedToday: reliefInfo.usedToday,
        remainingToday: reliefInfo.remainingToday,
        eligible: reliefInfo.eligible,
      },
      wallet: { ...wallet, activeCurrency: currency, activeBalance: wallet[currency] },
      ticketShop,
      state,
      guide: ARCADE_GUIDE,
      gifting: { isAi: account.isAi, recipients, presentation: giftPresentation('arcade') },
      recipientHint: account.isAi
        ? '可将抽到的限定外观赠予你绑定的人类主人'
        : recipients.length
          ? '可将抽到的限定外观赠予你名下已绑定的机'
          : '绑定一只机后，即可互赠抽到的限定外观',
    });
  }

  /** One flat claim path for ordinary parcels and arcade gifts; omitted request IDs stay retry-safe. */
  claimGift(token: unknown, rawGiftId: unknown, rawRequestId?: unknown) {
    const account = this.sessionAccount(token);
    if (typeof rawGiftId !== 'string' || !rawGiftId || rawGiftId.length > 100) fail('请选择要领取的礼物');
    const requestId = rawRequestId === undefined
      ? `claim-${createHash('sha256').update(`${account.id}:${rawGiftId}`).digest('hex').slice(0, 32)}`
      : rawRequestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) fail('领取请求编号无效');
    if ((account.gifts ?? []).some(gift => gift.id === rawGiftId) || account.giftHistory?.some(gift => gift.id === rawGiftId)) {
      return { source: 'ordinary' as const, ...this.claimGifts(token, rawGiftId) };
    }
    const state = this.getArcadeState(account);
    const prize = state.prizes.find(candidate => candidate.id === rawGiftId);
    if (!prize || prize.status === 'sent') fail('这不是送给你的待领取礼物');
    if (prize.status === 'used') {
      return { source: 'arcade' as const, claimed: true, giftId: prize.id, arcade: this.arcadeView(token), replayed: true };
    }
    const previous = state.receipts.find(receipt => receipt.requestId === requestId);
    const revision = previous ? previous.revision - 1 : state.revision;
    return {
      source: 'arcade' as const,
      claimed: true,
      giftId: prize.id,
      arcade: this.arcadeAction(token, { action: 'use', requestId, revision, prizeId: prize.id }),
    };
  }

  /** 游乐摊统一动作事务：开局试手券、购券、老虎机/刮刮乐下注、见好就收/搏倍、拆封入囊、互赠。 */
  arcadeAction(token: unknown, raw: unknown): ArcadeView {
    const sender = this.sessionAccount(token);
    if (!this.arcadeOptions.enabled) fail('像素游乐摊还在筹备中');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('游乐摊操作无效');
    const input = raw as Record<string, unknown>;
    const allowedKeys = new Set(['action', 'requestId', 'revision', 'gameId', 'stakeId', 'payMode', 'autoCashOut', 'count', 'prizeId', 'to', 'note']);
    if (Object.keys(input).some(key => !allowedKeys.has(key))) fail('游乐摊参数无效');
    const action = String(input.action);
    if (!['start', 'relief', 'buy_tickets', 'play', 'cash_out', 'gamble', 'use', 'gift'].includes(action)
      || typeof input.requestId !== 'string'
      || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.requestId)
      || !Number.isSafeInteger(input.revision)
      || Number(input.revision) < 0) {
      fail('游乐摊请求编号或版本无效');
    }
    for (const key of ['gameId', 'stakeId', 'payMode', 'prizeId', 'to', 'note'] as const) {
      if (input[key] !== undefined && (typeof input[key] !== 'string' || (input[key] as string).length > (key === 'note' ? 60 : 100))) {
        fail('游乐摊参数格式无效');
      }
    }
    if (input.autoCashOut !== undefined && (action !== 'play' || typeof input.autoCashOut !== 'boolean')) {
      fail('autoCashOut 仅能在 play 时传入布尔值');
    }
    if (input.count !== undefined && (action !== 'buy_tickets' || !Number.isSafeInteger(input.count))) {
      fail('购券张数无效');
    }
    if (action !== 'play' && (input.gameId !== undefined || input.stakeId !== undefined || input.payMode !== undefined)) {
      fail('玩法与赌注参数仅用于 play');
    }
    if (action !== 'gift' && (input.to !== undefined || input.note !== undefined)) {
      fail('收件人和寄语仅用于赠礼');
    }
    if (!['use', 'gift'].includes(action) && input.prizeId !== undefined) {
      fail('此操作无需奖品编号');
    }

    const command = input as ArcadeCommand;
    const before = this.getArcadeState(sender);
    const reply = (receipt: Omit<ArcadeReceipt, 'fingerprint'>, replayed: boolean): ArcadeView => {
      const view = this.arcadeView(token);
      const giftEvent = receipt.events.find((event): event is Extract<ArcadeEvent, { kind: 'gift' }> => event.kind === 'gift');
      const prize = giftEvent ? view.state.prizes.find(item => item.id === giftEvent.prizeId) : undefined;
      const giftDelivery: ArcadeView['giftDelivery'] = prize
        ? {
          status: 'delivered',
          viewState: 'unreported',
          recipientName: prize.to?.name ?? giftEvent?.toName,
          presentation: giftPresentation('arcade', prize.spec.cosmeticId),
        }
        : undefined;
      return { ...view, receipt: structuredClone(receipt), replayed, ...(giftDelivery ? { giftDelivery } : {}) };
    };

    const fingerprint = createHash('sha256').update(JSON.stringify({
      action: command.action,
      revision: command.revision,
      gameId: command.gameId,
      stakeId: command.stakeId,
      payMode: command.payMode,
      autoCashOut: command.autoCashOut,
      count: command.count,
      prizeId: command.prizeId,
      to: command.to,
      note: command.note,
    })).digest('hex');

    const previous = before.receipts.find(r => r.requestId === command.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) fail('重试编号已用于另一操作');
      const { fingerprint: _fingerprint, ...receipt } = previous;
      return reply(receipt, true);
    }
    if (command.revision !== before.revision) fail('进度已更新，请刷新后继续');

    let state = structuredClone(before);
    let events: ArcadeEvent[] = [];
    const at = this.arcadeOptions.now ? this.arcadeOptions.now() : Date.now();
    const makeId = this.arcadeOptions.makeId ?? (() => randomBytes(16).toString('hex'));
    const random = this.arcadeOptions.random ?? (() => randomInt(1_000_000_000) / 1_000_000_000);
    const currency = currencyFor(sender.isAi);

    let target: Account | undefined;
    let targetState: ArcadeState | undefined;
    let echo: EchoEvent | undefined;
    const previousCoins = sender.coins;
    const previousCosmetics = sender.cosmetics;
    const previousArcade = sender.arcade;
    let coins = sender.coins;
    let cosmetics = sender.cosmetics;

    if (command.action === 'use' || command.action === 'gift') {
      const prize = state.prizes.find(p => p.id === command.prizeId);
      if (!prize || prize.status !== 'pending') fail('这份奖品已处理或不存在');
      if (command.action === 'use') {
        const cosmetic = cosmeticById(prize.spec.cosmeticId);
        if (!cosmetic) fail('这件外观暂时无法领取，请保留奖品');
        const owned = sender.cosmetics?.owned ?? [];
        if (owned.includes(cosmetic.id)) fail('你已经有这件外观，可以把这份奖品送出去');
        cosmetics = this.cloneCosmetics(sender.cosmetics);
        cosmetics.owned = [...owned, cosmetic.id];
        this.autoEquipIfUnset(cosmetics, cosmetic);
        prize.status = 'used';
        prize.settledAt = at;
        events = [{ kind: 'use', prizeId: prize.id, cosmeticId: cosmetic.id }];
        if (prize.source === 'gift' && prize.from) {
          echo = this.buildGiftEcho(
            { id: prize.from.id, name: prize.from.name, isAi: this.accounts.get(prize.from.id)?.isAi ?? false },
            { id: sender.id, name: sender.username, isAi: sender.isAi },
            { id: `claim-${prize.id}`, at, item: { id: prize.spec.id, name: prize.spec.name, kind: cosmetic.kind }, style: 'gold', ...(prize.note ? { note: prize.note } : {}) },
          );
        }
      } else {
        if (!prize.spec.giftable) fail('这件奖品不支持赠送');
        target = this.resolveBoundGiftTarget(sender, command.to);
        if ((target.cosmetics?.owned ?? []).includes(prize.spec.cosmeticId)
          || (target.gifts ?? []).some(g => g.cosmeticId === prize.spec.cosmeticId)
          || this.getArcadeState(target).prizes.some(p => p.status === 'pending' && p.spec.cosmeticId === prize.spec.cosmeticId)) {
          fail('对方已经有这件外观或待领取的同款礼物了');
        }
        targetState = structuredClone(this.getArcadeState(target));
        if (targetState.prizes.length >= ARCADE_LIMITS.prizes) fail('对方的奖品箱已满');
        const giftId = makeId();
        const note = command.note?.trim();
        targetState.prizes.push({
          id: giftId,
          spec: structuredClone(prize.spec),
          at,
          source: 'gift',
          status: 'pending',
          from: { id: sender.id, name: sender.username },
          ...(note ? { note } : {}),
        });
        targetState.revision++;
        prize.status = 'sent';
        prize.to = { id: target.id, name: target.username };
        prize.settledAt = at;
        events = [{ kind: 'gift', prizeId: prize.id, toId: target.id, toName: target.username, cosmeticId: prize.spec.cosmeticId }];
      }
    } else {
      const balance = sender.coins?.[currency] ?? 0;
      const result = playArcade(before, command, { currency, balance, random, makeId, at });
      state = result.state;
      events = result.events;
      if (result.coinDelta !== 0) {
        coins = { ...emptyWallet(), ...sender.coins };
        if (coins[currency] + result.coinDelta < 0) fail(`${CURRENCY[currency].name}不足`);
        coins[currency] += result.coinDelta;
      }
    }

    state.revision++;
    const receipt: ArcadeReceipt = { requestId: command.requestId, fingerprint, revision: state.revision, events };
    state.receipts = [...state.receipts, receipt].slice(-ARCADE_LIMITS.receipts);
    const previousTarget = target?.arcade;
    sender.arcade = state;
    sender.coins = coins;
    sender.cosmetics = cosmetics;
    if (target && targetState) target.arcade = targetState;
    if (echo && this.echo) this.pendingEcho.set(echo.id, echo);
    try {
      this.persist();
    } catch (error) {
      sender.arcade = previousArcade;
      sender.coins = previousCoins;
      sender.cosmetics = previousCosmetics;
      if (target) target.arcade = previousTarget;
      if (echo) this.pendingEcho.delete(echo.id);
      throw error;
    }
    this.flushPendingEcho();
    const { fingerprint: _fingerprint, ...publicReceipt } = receipt;
    return reply(publicReceipt, false);
  }

  /** 购买外观：买家用自己那侧的币结算（人铜钱、机机芯）。 */
  buyCosmetic(token: unknown, cosmeticId: unknown): SelfAccount {
    const account = this.sessionAccount(token);
    const cosmetic = cosmeticById(typeof cosmeticId === 'string' ? cosmeticId : undefined);
    if (!cosmetic) fail('没有这件外观');
    if (!isShopCosmetic(cosmetic)) {
      fail(
        isDefaultCosmetic(cosmetic)
          ? '该外观为初始默认棋盘，不可购买'
          : isArcadeCosmetic(cosmetic)
            ? '这件外观为游乐摊限定，可前往像素游乐摊抽取'
            : '这件外观已下架',
      );
    }
    const owned = account.cosmetics?.owned ?? [];
    if (owned.includes(cosmetic.id)) fail('已经拥有这件外观');
    const currency = currencyFor(account.isAi);
    const wallet = { ...emptyWallet(), ...account.coins };
    if (wallet[currency] < cosmeticPrice(cosmetic, currency)) fail('余额不足');
    wallet[currency] -= cosmeticPrice(cosmetic, currency);
    const previousCoins = account.coins;
    const previousCosmetics = account.cosmetics;
    account.coins = wallet;
    account.cosmetics = this.cloneCosmetics(account.cosmetics);
    account.cosmetics.owned = [...owned, cosmetic.id];
    this.autoEquipIfUnset(account.cosmetics, cosmetic);
    try { this.persist(); }
    catch (error) { account.coins = previousCoins; account.cosmetics = previousCosmetics; throw error; }
    return this.selfAccount(token);
  }

  equipCosmetic(token: unknown, cosmeticId: unknown): SelfAccount {
    const account = this.sessionAccount(token);
    if (cosmeticId === null) {
      const previous = account.cosmetics;
      const next = this.cloneCosmetics(previous);
      delete next.equipped.frame;
      account.cosmetics = next;
      try { this.persist(); } catch (error) { account.cosmetics = previous; throw error; }
      return this.selfAccount(token);
    }
    if (cosmeticId === NATIVE_BOARD_SKIN) {
      const previous = account.cosmetics;
      const next = this.cloneCosmetics(previous);
      next.equipped.board = NATIVE_BOARD_SKIN;
      next.boardExplicit = true;
      account.cosmetics = next;
      try { this.persist(); } catch (error) { account.cosmetics = previous; throw error; }
      return this.selfAccount(token);
    }
    const cosmetic = cosmeticById(typeof cosmeticId === 'string' ? cosmeticId : undefined);
    if (!cosmetic) fail('没有这件外观');
    if (!isDefaultCosmetic(cosmetic) && !(account.cosmetics?.owned ?? []).includes(cosmetic.id)) fail('尚未拥有这件外观');
    const previousCosmetics = account.cosmetics;
    const next = this.cloneCosmetics(previousCosmetics);
    if (isDefaultCosmetic(cosmetic) && !next.owned.includes(cosmetic.id)) {
      next.owned = [cosmetic.id, ...next.owned];
    }
    next.equipped[cosmetic.kind] = cosmetic.id;
    if (cosmetic.kind === 'board') next.boardExplicit = cosmetic.id !== DEFAULT_BOARD_SKIN;
    account.cosmetics = next;
    try { this.persist(); }
    catch (error) { account.cosmetics = previousCosmetics; throw error; }
    return this.selfAccount(token);
  }

  /** 人与名下绑定的机可双向互赠外观（`note` 可选，最多 60 字）。 */
  giftCosmetic(token: unknown, toRecipient: unknown, cosmeticId: unknown, note?: unknown): { gift: Gift; bought: boolean; toName: string; coins: number; currency: CurrencyId } {
    const sender = this.sessionAccount(token);
    return this.deliverCosmeticGift(sender, toRecipient, cosmeticId, undefined, undefined, note);
  }

  /** 已由房间座位鉴权的机在 act 里赠礼；请求编号和礼物一起入账。`note` 是可选的短附言。 */
  giftCosmeticFromRoom(aiId: string, roomId: string, requestId: string, cosmeticId: unknown, note?: unknown): { gift: Gift; bought: boolean; toName: string; coins: number } {
    const sender = this.accounts.get(aiId);
    if (!sender || sender.deletedAt || !sender.isAi) fail('机账号已失效');
    if (typeof roomId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId) || typeof requestId !== 'string' || !requestId || requestId.length > 128) fail('赠礼请求编号无效');
    const key = `${aiId}:${roomId}:${requestId}`;
    return this.giftOnce(sender, key, cosmeticId, note, roomId);
  }

  /** 账号级幂等互赠（人 <-> 机均适用）：重放返回原回执。 */
  giftCosmeticForAccount(token: unknown, requestId: string, cosmeticId: unknown, note?: unknown, toRecipient?: unknown) {
    const sender = this.sessionAccount(token);
    if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 80) fail('赠礼请求编号无效');
    return this.giftOnce(sender, `account:${sender.id}:${requestId}`, cosmeticId, note, undefined, toRecipient);
  }

  private giftOnce(sender: Account, key: string, cosmeticId: unknown, note?: unknown, roomId?: string, toRecipient?: unknown): { gift: Gift; bought: boolean; toName: string; coins: number } {
    const previous = this.roomGiftActions.get(key);
    if (previous) {
      if (previous.cosmeticId !== cosmeticId) fail('这次赠礼已送出另一件外观');
      if (toRecipient !== undefined && previous.toId) {
        const resolved = this.resolveBoundGiftTarget(sender, toRecipient);
        if (resolved.id !== previous.toId) fail('这次赠礼已送给另一位绑定伙伴');
      }
      return { gift: { ...previous.gift }, bought: previous.bought, toName: previous.toName, coins: previous.coins };
    }
    const result = this.deliverCosmeticGift(sender, toRecipient, cosmeticId, key, roomId, note);
    return { gift: result.gift, bought: result.bought, toName: result.toName, coins: result.coins };
  }

  private buildGiftOptions(sender: Account, target?: Account) {
    const currency = currencyFor(sender.isAi);
    const coins = sender.coins?.[currency] ?? 0;
    const pool = [
      ...new Map(
        [
          ...listedCosmetics(),
      ...(sender.cosmetics?.owned ?? []).flatMap(id => {
        const item = cosmeticById(id);
        return item ? [item] : [];
      }),
    ].filter(item => !isDefaultCosmetic(item)).map(item => [item.id, item]),
      ).values(),
    ];
    return {
      currency,
      coins,
      options: pool.map(cosmetic => {
        const targetHas = target
          ? (target.cosmetics?.owned ?? []).includes(cosmetic.id) || (target.gifts ?? []).some(gift => gift.cosmeticId === cosmetic.id)
          : false;
        const senderHas = (sender.cosmetics?.owned ?? []).includes(cosmetic.id);
        const price = cosmeticPrice(cosmetic, currency);
        return {
          id: cosmetic.id,
          name: cosmetic.name,
          theme: cosmetic.tagline,
          intro: cosmetic.giftIntro,
          kind: cosmetic.kind,
          tier: cosmetic.tier ?? (cosmetic.kind === 'frame' ? 'frame' : 't3'),
          price,
          currency,
          acquisition: cosmetic.acquisition ?? 'shop',
          ownedBySender: senderHas,
          ownedByRecipient: targetHas,
          available: !targetHas && (senderHas ? true : isShopCosmetic(cosmetic) && coins >= price),
        };
      }),
    };
  }

  /** 对称互赠目录（人和绑定的机通用）。 */
  giftCatalog(token: unknown, rawTo?: unknown) {
    const sender = this.sessionAccount(token);
    const partners = this.boundPartnersFor(sender);
    let target: Account | undefined;
    if (rawTo !== undefined) {
      target = this.resolveBoundGiftTarget(sender, rawTo);
    } else if (partners.length === 1) {
      const candidate = this.accounts.get(partners[0]!.id);
      if (candidate && !candidate.deletedAt) target = candidate;
    }
    const built = this.buildGiftOptions(sender, target);
    return {
      senderIsAi: sender.isAi,
      currency: built.currency,
      currencyName: CURRENCY[built.currency].name,
      coins: built.coins,
      recipient: target ? { id: target.id, username: target.username, isAi: target.isAi } : null,
      recipients: partners,
      noteHint: GIFT_NOTE_GUIDANCE,
      presentation: giftPresentation('ordinary'),
      options: built.options,
    };
  }

  /** 只在机主动查看送礼选项时提供，避免每次读盘都重复外观目录。 */
  giftCatalogForAi(aiId: string) {
    const sender = this.accounts.get(aiId);
    if (!sender || sender.deletedAt || !sender.isAi) fail('只有机可以给自己的玩家送礼');
    const target = this.resolveBoundGiftTarget(sender);
    const built = this.buildGiftOptions(sender, target);
    return {
      ownerName: target.username,
      noteHint: GIFT_NOTE_GUIDANCE,
      presentation: giftPresentation('ordinary'),
      coins: built.coins,
      options: built.options,
    };
  }

  private deliverCosmeticGift(
    sender: Account,
    toRecipient: unknown,
    cosmeticId: unknown,
    roomActionKey?: string,
    _roomId?: string,
    note?: unknown,
  ): { gift: Gift; bought: boolean; toName: string; coins: number; currency: CurrencyId } {
    const target = this.resolveBoundGiftTarget(sender, toRecipient);
    const cosmetic = cosmeticById(typeof cosmeticId === 'string' ? cosmeticId : undefined);
    if (!cosmetic) fail('没有这件外观');
    if (isDefaultCosmetic(cosmetic)) fail('初始默认外观不可赠送');
    if ((target.cosmetics?.owned ?? []).some(id => id === cosmetic.id) || (target.gifts ?? []).some(gift => gift.cosmeticId === cosmetic.id)) {
      fail('对方已经有这件外观了');
    }
    const currency = currencyFor(sender.isAi);
    const previousSenderCosmetics = sender.cosmetics;
    const previousSenderCoins = sender.coins;
    const previousTargetGifts = target.gifts;
    const previousTargetHistory = target.giftHistory;
    const owned = sender.cosmetics?.owned ?? [];
    let bought = false;
    if (owned.includes(cosmetic.id)) {
      const next = this.cloneCosmetics(sender.cosmetics);
      const remaining = owned.filter(id => id !== cosmetic.id);
      if (next.equipped[cosmetic.kind] === cosmetic.id) {
        if (cosmetic.kind === 'board') {
          delete next.equipped.board;
          next.boardExplicit = false;
        } else {
          delete next.equipped.frame;
        }
      }
      next.owned = remaining;
      sender.cosmetics = next;
    } else {
      if (!isShopCosmetic(cosmetic)) {
        fail(isArcadeCosmetic(cosmetic) ? '这件外观为游乐摊限定，可前往像素游乐摊抽取' : '这件外观已下架');
      }
      const wallet = { ...emptyWallet(), ...sender.coins };
      if (wallet[currency] < cosmeticPrice(cosmetic, currency)) fail('余额不足');
      wallet[currency] -= cosmeticPrice(cosmetic, currency);
      sender.coins = wallet;
      bought = true;
    }
    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 60) : '';
    const gift: Gift = {
      ...(cleanNote ? { note: cleanNote } : {}),
      id: randomBytes(6).toString('hex'),
      fromId: sender.id,
      fromName: sender.username,
      cosmeticId: cosmetic.id,
      at: Date.now(),
    };
    target.gifts = [...target.gifts ?? [], gift];
    target.giftHistory = [...target.giftHistory ?? [], { ...gift, toId: target.id, toName: target.username }];
    const balance = sender.coins?.[currency] ?? 0;
    if (roomActionKey) {
      this.roomGiftActions.set(roomActionKey, { key: roomActionKey, cosmeticId: cosmetic.id, gift, bought, toId: target.id, toName: target.username, coins: balance });
    }
    try {
      this.persist();
    } catch (error) {
      sender.cosmetics = previousSenderCosmetics;
      sender.coins = previousSenderCoins;
      target.gifts = previousTargetGifts;
      target.giftHistory = previousTargetHistory;
      if (roomActionKey) this.roomGiftActions.delete(roomActionKey);
      this.pendingEcho.delete(gift.id);
      throw error;
    }
    this.flushPendingEcho();
    return { gift, bought, toName: target.username, coins: balance, currency };
  }

  /** Retry durable broadcasts. Stable event IDs let the public store deduplicate after a crash. */
  flushPendingEcho(): number {
    if (!this.echo || !this.pendingEcho.size) return 0;
    const before = new Map(this.pendingEcho);
    let published = 0;
    for (const event of before.values()) {
      try { this.echo.publish(event); }
      catch { break; }
      this.pendingEcho.delete(event.id);
      published += 1;
    }
    if (published) {
      try { this.persist(); }
      catch { this.pendingEcho = before; return 0; }
    }
    return published;
  }

  claimGifts(token: unknown, giftId?: unknown): { claimed: Gift[]; self: SelfAccount } {
    const account = this.sessionAccount(token);
    const pending = account.gifts ?? [];
    if (giftId !== undefined && (typeof giftId !== 'string' || !giftId)) fail('请选择要拆开的礼物');
    const gifts = giftId === undefined ? pending : pending.filter(gift => gift.id === giftId);
    if (!gifts.length) {
      if (giftId && account.giftHistory?.some(gift => gift.id === giftId && gift.claimedAt)) return { claimed: [], self: this.selfAccount(token) };
      fail('没有待领取的礼物');
    }
    const previousCosmetics = account.cosmetics;
    const previousHistory = account.giftHistory;
    const claimedAt = Date.now();
    const history = account.giftHistory ?? [];
    const pendingIds = new Set(gifts.map(gift => gift.id));
    const recordedIds = new Set(history.map(record => record.id));
    account.giftHistory = [
      ...history.map(record => pendingIds.has(record.id) ? { ...record, claimedAt } : record),
      ...gifts.filter(gift => {
        if (recordedIds.has(gift.id)) return false;
        recordedIds.add(gift.id);
        return true;
      }).map(gift => ({ ...gift, toId: account.id, toName: account.username, claimedAt, legacy: true as const })),
    ];
    const owned = account.cosmetics?.owned ?? [];
    const fresh = gifts.map(gift => gift.cosmeticId).filter(id => !owned.includes(id));
    const next = this.cloneCosmetics(account.cosmetics);
    next.owned = [...owned, ...fresh];
    for (const id of fresh) {
      const cosmetic = cosmeticById(id);
      if (cosmetic) this.autoEquipIfUnset(next, cosmetic);
    }
    account.cosmetics = next;
    account.gifts = pending.filter(gift => !pendingIds.has(gift.id));
    const previousEcho = new Map(this.pendingEcho);
    for (const gift of gifts) {
      const cosmetic = cosmeticById(gift.cosmeticId);
      const echo = this.buildGiftEcho(
        { id: gift.fromId, name: gift.fromName, isAi: this.accounts.get(gift.fromId)?.isAi ?? true },
        { id: account.id, name: account.username, isAi: account.isAi },
        { id: `claim-${gift.id}`, at: claimedAt, item: { id: gift.cosmeticId, name: cosmetic?.name ?? gift.cosmeticId, kind: cosmetic?.kind }, ...(gift.note ? { note: gift.note } : {}) },
      );
      if (echo) this.pendingEcho.set(echo.id, echo);
    }
    try { this.persist(); }
    catch (error) {
      account.cosmetics = previousCosmetics;
      account.giftHistory = previousHistory;
      account.gifts = pending;
      this.pendingEcho = previousEcho;
      throw error;
    }
    this.flushPendingEcho();
    return { claimed: gifts, self: this.selfAccount(token) };
  }

  leaderboard(limit = 20, order:LeaderboardOrder = 'rate'): PublicAccount[] {
    const selected=leaderboardOrder(order);
    return [...this.accounts.values()]
      .filter(account => !account.deletedAt && !account.hiddenFromLeaderboard && (account.record?.games ?? 0) > 0)
      .sort((a, b) => {
        const wa = a.record?.wins ?? 0, wb = b.record?.wins ?? 0;
        const rate = wb * (a.record?.games ?? 1) - wa * (b.record?.games ?? 1);
        const primary = selected==='rate' ? rate : wb-wa;
        const secondary = selected==='rate' ? wb-wa : rate;
        if(primary||secondary)return primary||secondary;
        const games = (a.record?.games ?? 0) - (b.record?.games ?? 0);
        return games || a.id.localeCompare(b.id);
      })
      .slice(0, Math.max(1, Math.min(100, limit)))
      .map(account => this.publicAccount(account));
  }

  private issueSession(accountId: string): string {
    const token = randomBytes(24).toString('hex');
    this.sessions.set(token, { accountId, createdAt: Date.now(), lastSeenAt: Date.now() });
    return token;
  }

  private persist() {
    const file = join(this.directory, 'accounts.json');
    const data: AccountFile = { version: 1, accounts: [...this.accounts.values()], sessions: Object.fromEntries(this.sessions), bindings: [...this.bindings.values()], aiInvites: [...this.aiInvites.values()], machineTickets: [...this.machineTickets.values()], machineRequests: [...this.machineRequests.values()], roomGiftActions: [...this.roomGiftActions.values()], settledRooms: Object.fromEntries(this.settledRooms), settlementReceipts: Object.fromEntries(this.settlementReceipts), dailySettlement: Object.fromEntries(this.dailySettlement), subsidyActions: [...this.subsidyActions.values()], pendingEcho: [...this.pendingEcho.values()] };
    if (this.storage) {
      this.storage.write({ ...data, sessions: {} });
      return;
    }
    writeFileSync(`${file}.pending`, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${file}.pending`, file);
  }
}
