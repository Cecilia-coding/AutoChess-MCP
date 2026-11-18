import { placementOutcome } from '../meta/economy';
import { getGameConfig } from '../meta/game-config';
import {
  drawSeatBuffOffer,
  rarityIdFromHexRarity,
  rollRoundBuffRarity,
  supplyFamilyForRound,
} from '../meta/journey-buffs';
import type { MatchSettlementInput, AccountStore } from '../accounts/account-store';
import { isLobbyMode, LOBBY_MODES } from '../../packs/modes/registry';
import { BENCH_CAPACITY } from './constants';
import { botField, botBuyOrder, botStrength } from './room-bot';
import { permanentFreeRefreshesPerRound, roomShopPrice, roomRefreshPrice } from './room-economy';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compactHex, findHex, hexPickRarity, makeHexOffer, scoreHex, withHexes, getHex, immediateHexGold, pickBestHex, shopBanFromHex, shopBanned, delayedGoldBonus, winGoldPerStreak, deathGoldChance, freeRefreshGrant, grantUnitFromNote } from '../../content/autochess/hexes';
import { drawSwords, swordTierForRound } from '../../content/autochess/items';
import { autochessCostOf, findUnit, getUnit } from '../../content/autochess/units';
import { getItem as getCatalogItem } from '../../content/autochess/items';
import { simulateBattle } from './combat';
import { applyCompanionPlan, parseCompanionPlan } from './companion';
import { ensureRoomPieceRefs, resolveRoomPlan, roomPieceRefs } from './room-refs';
import { makeCatchupDraft, makeCatchupShop, recordCatchup } from './catchup';
import { settleLossBounty } from './loss-bounty';
import { battleHpLoss } from './round-settlement';
import { addAndMerge, deliverUnitToRoster, equipFromRoster, makeDraftTrack, makeInitialPieces, makePiece, nextStar, replaceFromBench, rollDraft, sellFromRoster, shouldDraft, skillDraftDue, unequipFromRoster } from './core';
import { MAX_LEVEL, START_LEVEL, addXp, fieldCapacityForLevel, stageOfRound, winStreakGold, xpBuyAmount, xpBuyCost, xpPerRound } from './level';
import { DEFAULT_PACK_ID, isPackId, isRuntimePackId, listEphemeralPackIds, PACK_LIST, packHexes, packItems, packKitItems, packMeta, packOpening, packRoster, parsePackId, unregisterEphemeralPack, type AnyPackId, type PackId } from '../../packs/registry';
import { ensureCustomPackRegistered } from '../pack-studio/compiler';
import { validateCustomPack, type CustomPackV1 } from '../pack-studio/schema';
import { boardSkinId, matchRules, parseMatchMode, type MatchModeId } from './match-rules';
import { createRng, hash32, hashString } from './rng';
import { recurringGrantPool, type RecurringRosterUnit } from './hex-recurring';
import { openItemBoxes } from './hex-items';
import { hazardChancePct, hazardsAt, rollHazard, rollPrice } from './hazards';
import { planManeuvers } from './maneuvers';
import { uniqueTraitCounts } from './stats';
import { BalanceTelemetryStore } from './balance-telemetry';
import type { HexGrant, MysteryBox, RecurringGrant, UnitManeuver } from '../../content/autochess/types';
import { matchupFor, pairLiving, type Matchup } from './pairing';
import type { RoomCredentials, RoomMutation, RoomSelf, RoomView, RoomBattle, RoomVenue, DanmakuMessage } from './room-types';
import { DANMAKU_STYLES } from './room-types';

const BOT_NAMES = ['路人甲', '路人乙', '路人丙', '路人丁', '路人戊', '路人己', '路人庚', '路人辛', '路人壬', '路人癸', '路人子', '路人丑', '路人寅', '路人卯'];
/** 房间闲置上限：超过这段时间没有任何操作就自动结束（掉线判负），不留下隔夜还在打的局。 */
const ROOM_IDLE_KILL_MS = 60 * 60 * 1000;
const PLATFORM_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const PLATFORM_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
type Seat = RoomSelf & { actorType?: 'human' | 'ai' | 'guest'; actorKey?: string; activeAt?: number; token: string; say: string; bot?: boolean; accountId?: string; accountName?: string; skinId?: string; frame?: string };
type Room = {
  version: 1; id: string; invite: string; watch: string; seed: number; revision: number; round: number;
  /** Persistence clock; only standalone upstream rooms use it as their idle clock. */
  updatedAt?: number;
  mode?: MatchModeId; pack: AnyPackId; seatCount: number; pairings: Matchup[]; lastOpponent: (number | undefined)[];
  matchKind?: 'queue' | 'travel'; matchKey?: string;
  /** 仅存内存试玩房（自定义工坊开局）：绝不写入磁盘房间文件、遥测或货币账本。 */
  memoryOnly?: boolean;
  customPack?: CustomPackV1;
  /** 管理员发起的测试对掏单独记账。 */
  telemetrySource?: 'lab';
  /** 机开房请求的幂等键；断线重试返回原房间与原席位。 */
  machineCreate?: { accountId: string; requestId: string };
  /** 宿主平台私人房间元数据：等待房主 start，不复用路人房的 1 小时闲置强杀逻辑。 */
  platformCreate?: { accountId: string; requestId: string; signature: string };
  platformStart?: string;
  platformTimes?: { created: number; started?: number; finished?: number };
  lastActionAt?: number;
  terminalAt?: number;
  preserved?: boolean;
  wake?: { round: number; sequence: number; requestedAt: number; receivedId?: string; receivedAt?: number };
  phase: RoomView['phase']; seats: Seat[]; finalBattles?: Record<number, RoomBattle>; battle?: RoomBattle; battleAt?: number; winner?: RoomView['winner']; log: string[];
  receipts: Record<string, string>; joinKey?: string; joinKeys: Record<string, number>; cursor: { enabled: boolean; status: string };
  danmaku?: DanmakuMessage[];
  /** 结算账本标记：本局已提交给局外结算的时间戳，防止重复入账。 */
  settled?: number; finishReason?: 'idle' | 'cancelled'
};
/** 局外结算回调：淘汰时逐席位提交，传完整参赛账号判定陪伴关系。 */
export type RoomRecorder = { settle(input: MatchSettlementInput): ReturnType<AccountStore['settleMatch']> | void };
export type SeatOwner = { actorType?: 'human' | 'ai' | 'guest'; actorKey?: string; accountId: string; accountName: string; skinId?: string; frame?: string };
export type RoomAppearanceResolver = (accountId: string) => { skinId?: string; frame?: string } | undefined;
const secret = () => randomBytes(18).toString('hex');
const fail = (message: string): never => { throw new Error(message); };
export class RoomStore {
  private rooms = new Map<string, Room>();
  private seen = new Map<string, number>();
  private listeners = new Set<() => void>();
  private telemetry: BalanceTelemetryStore;
  constructor(
    readonly directory: string,
    private recorder?: RoomRecorder,
    private packAvailability?: { isEnabled(id: PackId): boolean },
    private appearance?: RoomAppearanceResolver,
  ) {
    mkdirSync(directory, { recursive: true });
    this.telemetry = new BalanceTelemetryStore(directory);
    for (const file of readdirSync(directory).filter(x => /^[a-f0-9]{12}\.json$/.test(x))) {
      const room = JSON.parse(readFileSync(join(directory, file), 'utf8')) as Room;
      if (room.platformCreate && file !== `${room.id}.json`) throw new Error('ROOM_ID_MISMATCH');
      if (!room.updatedAt) { try { room.updatedAt = statSync(join(directory, file)).mtimeMs; } catch { room.updatedAt = 0; } }
      if (room.version !== 1) throw new Error('ROOM_VERSION_UNSUPPORTED');
      // Removed content may leave historical rooms behind. Keep their files intact,
      // but do not let one unavailable pack prevent every current room from loading.
      if (room.pack && !isPackId(room.pack)) continue;
      room.pack = parsePackId(room.pack);
      room.mode = parseMatchMode(room.mode);
      room.seatCount = matchRules(room.mode, room.seatCount).seatCount;
      // Rebuild stale opening offers from the room's current pack and discard choices outside known hex/buff definitions.
      room.seats.forEach((seat, index) => {
        if (seat.swordOffer) seat.swordOffer = this.openingOffer(room, index, seat.swordOffer.round);
        if (seat.hexOffer?.choices.some((choice) => !findHex(choice.id, room.pack))) delete seat.hexOffer;
      });
      room.pairings ??= [];
      room.lastOpponent ??= [];
      room.joinKeys ??= room.joinKey ? { [room.joinKey]: 1 } : {};
      for (const seat of room.seats) if (seat.draft) {
        seat.draft.sourceRound ??= seat.draft.round;
        seat.draft.round = room.round;
        for (const reward of seat.draft.track) {
          if (reward.kind === 'unique' && reward.uniqueId === 'twin-kit') reward.detail = `获得${packKitItems(room.pack).map(id => getCatalogItem(id).name).join('与')}；整局唯一`;
        }
      }
      for (const seat of room.seats) this.restoreShopBan(seat, room);
      // 存档兼容：任何棋谱改版后都可能留下已删除棋子，统一清掉，避免 getUnit 抛错卡住房间。
      for (const seat of room.seats) {
        seat.board = (seat.board ?? []).filter((piece) => findUnit(piece.templateId));
        seat.bench = (seat.bench ?? []).filter((piece) => findUnit(piece.templateId));
        seat.shop = (seat.shop ?? []).map((id) => (id && findUnit(id) ? id : null));
      }
      // 战斗回放快照（battle.boards/benches 与 output.units）里也可能留着已删棋子，一并清掉。
      if (room.battle) {
        room.battle.boards = room.battle.boards.map((board) => board.filter((piece) => findUnit(piece.templateId)));
        room.battle.benches = room.battle.benches.map((bench) => bench.filter((piece) => findUnit(piece.templateId)));
        room.battle.output.units = room.battle.output.units.filter((unit) => findUnit(unit.templateId));
        for (const fight of room.battle.fights ?? []) {
          fight.output.units = fight.output.units.filter((unit) => findUnit(unit.templateId));
        }
      }
      for (const seat of room.seats) ensureRoomPieceRefs(seat);
      if (!room.platformCreate) this.reapIdle(room);
      this.rooms.set(room.id, room);
      // 房间先写成、统计尚未落盘时重启，可用最近一轮战报补回；旧历史不冒充完整样本。
      if (!room.memoryOnly && isPackId(room.pack) && room.battle && room.battleAt && room.battleAt >= this.telemetry.startedAt) {
        try { this.telemetry.recordBattle({ pack: room.pack, mode: room.mode!, battle: room.battle, botSeats: room.seats.map(seat => !!seat.bot), at: room.battleAt, source: room.telemetrySource ?? 'live' }); } catch { /* 战局仍可恢复 */ }
      }
    }
    this.cleanup();
  }
  private load(id: string) {
    let room = this.rooms.get(id) ?? fail('房间不存在');
    if (room.customPack && !isRuntimePackId(room.pack)) {
      ensureCustomPackRegistered(room.customPack);
    }
    if (room.platformCreate) room = this.maintainPlatformRoom(room) ?? fail('房间不存在');
    for (const seat of room.seats) this.restoreShopBan(seat, room);
    this.reapIdle(room);
    if (!room.memoryOnly && !(room.platformCreate && room.finishReason === 'idle') && room.seats.some(seat => seat.result?.payment === 'pending')) { this.recordResults(room); this.persist(room); }
    return room;
  }
  /** 维护并清理平台私人房及过期纯内存试玩房，并回收未被引用的运行时棋谱。 */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    const MEMORY_FINISHED_TTL_MS = 30 * 60 * 1000;
    for (const room of Array.from(this.rooms.values())) {
      if (room.platformCreate && !this.maintainPlatformRoom(room)) removed += 1;
      if (room.memoryOnly) {
        const lastAt = room.terminalAt ?? room.updatedAt ?? 0;
        const staleFinished = room.phase === 'finished' && now - lastAt > MEMORY_FINISHED_TTL_MS;
        const staleIdle = now - (room.updatedAt ?? 0) > ROOM_IDLE_KILL_MS;
        if (staleFinished || staleIdle) {
          this.rooms.delete(room.id);
          for (const key of this.seen.keys()) if (key.startsWith(`${room.id}:`)) this.seen.delete(key);
          removed += 1;
        }
      }
    }
    const activePacks = new Set(Array.from(this.rooms.values()).map(room => room.pack));
    for (const runtimeId of listEphemeralPackIds()) {
      if (!activePacks.has(runtimeId)) unregisterEphemeralPack(runtimeId);
    }
    return removed;
  }
  private maintainPlatformRoom(original: Room): Room | undefined {
    const now = Date.now();
    let room = original;
    const history = [
      room.updatedAt,
      room.lastActionAt,
      room.terminalAt,
      room.platformTimes?.created,
      room.platformTimes?.started,
      room.platformTimes?.finished,
      ...room.seats.map(seat => seat.activeAt),
    ].filter(validTime);
    const firstAction = Math.max(0, ...[room.platformTimes?.created, room.platformTimes?.started].filter(validTime));
    const needsAction = !validTime(room.lastActionAt) || room.lastActionAt < firstAction;
    const needsTerminal = room.phase === 'finished' && (needsAction || !validTime(room.terminalAt)
      || room.terminalAt < Math.max(firstAction, validTime(room.lastActionAt) ? room.lastActionAt : 0));
    if (needsAction || needsTerminal) {
      room = structuredClone(room);
      if (needsAction) room.lastActionAt = Math.max(now, ...history);
      if (needsTerminal) room.terminalAt = Math.max(now, ...history, room.lastActionAt!);
      this.persist(room);
    }
    if (room.phase === 'finished') {
      if (room.preserved !== undefined && room.preserved !== false) return room;
      if (now - room.terminalAt! < PLATFORM_RETENTION_MS) return room;
      if (room.seats.some(seat => seat.result?.payment === 'pending')) return room;
      try { unlinkSync(join(this.directory, `${room.id}.json`)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      this.rooms.delete(room.id);
      for (const key of this.seen.keys()) if (key.startsWith(`${room.id}:`)) this.seen.delete(key);
      for (const notify of this.listeners) notify();
      return undefined;
    }
    if (now - room.lastActionAt! < PLATFORM_IDLE_MS) return room;
    room = structuredClone(room);
    room.phase = 'finished';
    room.winner = 'draw';
    room.finishReason = 'idle';
    room.terminalAt = now;
    room.revision++;
    room.cursor = { enabled: false, status: '棋局结束' };
    room.log.push('私人棋局闲置满 7 天，已归档为和局，不计战绩与收益。');
    this.assignResults(room, true);
    this.persist(room);
    return room;
  }
  /** 掉线判负：闲置超过上限的房间直接结束（正在进行中的活跃房间不受影响）。 */
  private reapIdle(room: Room) {
    if (room.phase === 'finished') {
      if (this.recordFinish(room)) this.persist(room);
      return;
    }
    if (room.platformCreate) return;
    if (Date.now() - (room.updatedAt ?? 0) < ROOM_IDLE_KILL_MS) return;
    room.phase = 'finished';
    room.finishReason = 'idle';
    if (room.matchKind === 'travel' && room.seats.length > 1) {
      // The travelling AI owns seat zero; leaving an active trip is a loss, not a free draw.
      room.winner = room.seats.findIndex((seat, index) => index > 0 && seat.hp > 0);
      if (room.winner < 0) room.winner = 1;
      room.log.push(`远游棋局闲置超过 ${ROOM_IDLE_KILL_MS / 60000} 分钟，远游棋手超时判负。`);
    } else {
      room.winner = 'draw';
      room.log.push(`棋局闲置超过 ${ROOM_IDLE_KILL_MS / 60000} 分钟，已作废，不计战绩与收益。`);
    }
    room.cursor.enabled = false; room.cursor.status = '棋局结束';
    this.assignResults(room, true);
    this.recordFinish(room);
    this.persist(room);
  }
  /** Retry after a transient account-store failure, including after a process restart. */
  private recordFinish(room: Room): boolean {
    if (room.memoryOnly || !this.recorder || room.settled || room.finishReason === 'cancelled' || (room.finishReason === 'idle' && room.matchKind !== 'travel')) return false;
    this.assignResults(room, true);
    this.recordResults(room);
    if (room.seats.some(seat => seat.accountId && seat.result?.payment === 'pending')) return false;
    room.settled = Date.now(); return true;
  }
  /** 同轮出局按扣血前气血、席位序稳定排序；已经落定的名次永不重排。 */
  private assignResults(room: Room, final = false, beforeHp?: number[]) {
    const pending = room.seats.map((seat, index) => ({ seat, index })).filter(({ seat }) => !seat.result);
    const ranked = pending.sort((a, b) => (room.finishReason === 'idle' && room.matchKind === 'travel' ? Number(a.index === 0) - Number(b.index === 0) : 0) || b.seat.hp - a.seat.hp || (beforeHp?.[b.index] ?? 0) - (beforeHp?.[a.index] ?? 0) || a.index - b.index);
    ranked.forEach(({ seat }, i) => {
      if (!final && seat.hp > 0) return;
      const place = i + 1;
      seat.result = {
        place, participants: room.seats.length, round: room.round,
        outcome: room.finishReason === 'idle' ? (room.winner === 'draw' ? 'draw' : room.seats.indexOf(seat) === room.winner ? 'win' : 'loss') : placementOutcome(place, room.seats.length),
        payment: !room.memoryOnly && seat.accountId && seat.actorType !== 'guest' && this.recorder && !(room.finishReason === 'idle' && room.matchKind !== 'travel') ? 'pending' : 'guest'
      };
      seat.ready = true;
    });
  }
  private recordResults(room: Room) {
    if (!this.recorder) return;
    // 使用完整参赛账号判定陪伴/远游，逐席位结算仍保留各自出局轮次。
    const participants = room.seats.flatMap(seat => seat.accountId ? [seat.accountId] : []);
    for (const seat of room.seats) {
      const result = seat.result;
      if (!seat.accountId || !result || result.payment !== 'pending') continue;
      try {
        const reply = this.recorder.settle({
          roomId: room.id, round: result.round, partial: true, participants, seatCount: result.participants,
          entries: [{ accountId: seat.accountId, outcome: result.outcome, place: result.place }], matchmaking: room.matchKind === 'queue',
          ...(room.platformCreate && room.matchKind !== 'queue' ? { companionOnly: true } : {}),
          ...(room.matchKind === 'travel' && room.finishReason === 'idle' ? { travelIdleLoss: true } : {})
        });
        result.reward = reply?.receipts[seat.accountId]; result.payment = 'paid';
      } catch { /* 下一次读盘重试；账本按房间和账号去重。 */ }
    }
  }

  private persist(room: Room) {
    room.updatedAt = Date.now();
    if (room.platformCreate && room.phase === 'finished') room.terminalAt ??= room.updatedAt;
    if (room.platformTimes && room.phase === 'finished' && !room.finishReason) room.platformTimes.finished ??= room.updatedAt;
    for (const seat of room.seats) ensureRoomPieceRefs(seat);
    if (room.memoryOnly) {
      if (room.phase === 'finished') room.terminalAt ??= room.updatedAt;
      this.rooms.set(room.id, room);
      for (const notify of this.listeners) notify();
      return;
    }
    const file = join(this.directory, `${room.id}.json`);
    try {
      const fd = openSync(`${file}.pending`, 'w', 0o600);
      try {
        writeFileSync(fd, JSON.stringify(room), 'utf8');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(`${file}.pending`, file);
    } catch (error) {
      try { unlinkSync(`${file}.pending`); } catch { /* 保留原有存档 */ }
      throw error;
    }
    this.rooms.set(room.id, room);
    if (room.battle && room.battleAt && room.battleAt >= this.telemetry.startedAt && !isRuntimePackId(room.pack)) {
      try { this.telemetry.recordBattle({ pack: room.pack as PackId, mode: room.mode!, battle: room.battle, botSeats: room.seats.map(seat => !!seat.bot), at: room.battleAt, source: room.telemetrySource ?? 'live' }); }
      catch { /* 统计落盘失败不影响落子；下次写盘或重启会补记。 */ }
    }
    for (const notify of this.listeners) notify();
  }
  balanceReport(input: Parameters<BalanceTelemetryStore['report']>[0] = {}) { return this.telemetry.report(input); }
  /** 席位 token 误放到账号栏时，只恢复同一邀请中的原席位。 */
  resumeInvitationSeat(invitation: string, token: string): RoomCredentials | undefined {
    const info = this.invitationRoom(invitation);
    const room = this.load(info.roomId);
    return room.seats.some(seat => seat.token === token) ? { roomId: room.id, token } : undefined;
  }
  private auth(room: Room, token: string) {
    const index = room.seats.findIndex(seat => seat.token === token);
    if (index < 0) fail('席位凭证无效');
    this.seen.set(`${room.id}:${index}`, Date.now());
    return index;
  }
  private roster(room: Room) { return packRoster(room.pack); }
  /** 开局三选一：池与标签都由所在包声明；包没声明就没有这一步（不串包）。 */
  private openingOffer(room: Room, index: number, round = 1): RoomSelf['swordOffer'] {
    const opening = packOpening(room.pack);
    if (!opening) return undefined;
    const tier = opening.tiers[swordTierForRound(round)] ?? opening.tiers[0] ?? [];
    const choices = drawSwords(tier, 3, createRng(hash32(room.seed, index, 9001)));
    return choices.length ? { round, label: opening.label, choices } : undefined;
  }
  /**
   * 回合开始结算「风控」（数据驱动）：ban 封号离场 / strike 罢工缺席 / soldout 售罄 / price 价格波动。
   * 棋子用 `UnitDef.hazard` 声明，引擎按具名效果解释。
   */
  /** RP 梗包「回合级效果」：回合初结算、持续几轮，到期保留触发标记（数据来自 HexDef.roundEffect）。 */
  private applyRoundEffects(room: Room, seat: Seat) {
    const pool = [...seat.board, ...(seat.bench ?? [])];
    const windows = (seat.roundFx ??= {});
    // 「连本带利」到期：把窗口内累计的花费连本带利返还
    if (seat.cashbackUntil !== undefined && room.round > seat.cashbackUntil) {
      if (seat.cashbackSpent) seat.gold! += seat.cashbackSpent;
      delete seat.cashbackUntil; delete seat.cashbackSpent;
    }
    for (const id of seat.hexes ?? []) {
      const fx = getHex(id, room.pack).roundEffect;
      if (!fx) continue;
      const until = windows[id];
      if (until !== undefined && room.round > until) continue; // 保留结束轮，避免同一心悟再次启动。
      if (until !== undefined) {
        if (fx.kind === 'freeRefresh') seat.freeRefreshes = { hex: id, until, perRound: fx.perRound, left: fx.perRound };
        continue;
      }
      const end = room.round + fx.rounds - 1;
      windows[id] = end;
      switch (fx.kind) {
        case 'stat': {
          if (!pool.length) break;
          const targets = fx.pick === 'all' ? pool : [pool[Math.abs(room.seed + room.round * 31) % pool.length]!];
          for (const piece of targets) piece.tempStats = [...(piece.tempStats ?? []), { stat: fx.stat, value: fx.value, untilRound: end }];
          break;
        }
        case 'freeRefresh': seat.freeRefreshes = { hex: id, until: end, perRound: fx.perRound, left: fx.perRound }; break;
        case 'noHpLoss': seat.noHpUntil = Math.max(seat.noHpUntil ?? 0, end); break;
        case 'cashback': seat.cashbackUntil = Math.max(seat.cashbackUntil ?? 0, end); break;
        case 'infect': {
          if (!pool.length) break;
          const roll = Math.abs(room.seed + room.round * 97) % 100;
          if (roll < fx.chance) { const target = pool[roll % pool.length]!; target.tempStats = [...(target.tempStats ?? []), { stat: 'atkPct', value: -fx.value, untilRound: end, tag: 'infect' }]; }
          break;
        }
        case 'foeManaSlow': break; // 在战斗配对时施加给对手
      }
    }
    for (const piece of pool) if (piece.tempStats?.length) piece.tempStats = piece.tempStats.filter((s) => room.round <= s.untilRound);
    // 「极其」繁殖：带感染的棋子会把感染传给另一枚随机棋子（限时自愈，与永久 safety 不同）
    const infected = pool.filter((piece) => piece.tempStats?.some((s) => s.tag === 'infect'));
    if (infected.length && pool.length > infected.length && Math.abs(room.seed + room.round * 131) % 100 < 30) {
      const target = pool[Math.abs(room.seed + room.round * 131) % pool.length]!;
      target.tempStats = [...(target.tempStats ?? []), { stat: 'atkPct', value: -8, untilRound: room.round + 2, tag: 'infect' }];
    }
  }

  /** RP 梗包「连本带利」：窗口内逐笔记录买棋和刷新的实际支出。 */
  private trackCashback(room: Room, seat: Seat, spent: number) {
    if (seat.cashbackUntil === undefined || room.round > seat.cashbackUntil) return;
    if (spent > 0) seat.cashbackSpent = (seat.cashbackSpent ?? 0) + spent;
  }

  /** RP 梗包「慢点吃」：该席位生效期间施加给对手的内力回复减速值（0 = 无）。 */
  private foeManaSlow(seat: Seat, round: number): number {
    let value = 0;
    for (const id of seat.hexes ?? []) {
      const fx = getHex(id).roundEffect;
      if (fx?.kind === 'foeManaSlow' && (seat.roundFx?.[id] ?? 0) >= round) value = Math.max(value, fx.value);
    }
    return value;
  }

  private seatHazardModifiers(seat: Seat, packId: AnyPackId) {
    let chanceScalePct = 100;
    let forcePriceTrough = false;
    let ignoreSoldOut = false;
    let banFullRefundBonusGold: number | undefined;
    let strikeBonusGold = 0;
    for (const id of seat.hexes ?? []) {
      const mod = findHex(id, packId)?.hazardModifiers;
      if (!mod) continue;
      if (mod.chanceScalePct !== undefined) chanceScalePct = Math.round((chanceScalePct * mod.chanceScalePct) / 100);
      if (mod.forcePriceTrough) forcePriceTrough = true;
      if (mod.ignoreSoldOut) ignoreSoldOut = true;
      if (mod.banFullRefundBonusGold !== undefined) {
        banFullRefundBonusGold = Math.max(banFullRefundBonusGold ?? 0, mod.banFullRefundBonusGold);
      }
      if (mod.strikeBonusGold) strikeBonusGold += mod.strikeBonusGold;
    }
    return { chanceScalePct, forcePriceTrough, ignoreSoldOut, banFullRefundBonusGold, strikeBonusGold };
  }

  private resolveHazards(room: Room, seat: Seat, timing: 'roundStart' | 'roundEnd' = 'roundStart') {
    const field = timing === 'roundEnd' ? this.fieldedForBattle(seat) : seat.board;
    const pieces = [...field, ...(seat.bench ?? [])];
    const fieldIds = new Set(field.map(piece => piece.id));
    const counts = uniqueTraitCounts(field);
    const banCounts = { ...seat.banCounts };
    const priorBanCounts = { ...banCounts };
    const mods = this.seatHazardModifiers(seat, room.pack);
    const immunePieces = new Set(seat.hazardImmunePieceIds ?? []);
    const banned: NonNullable<RoomSelf['roundHazards']>['banned'] = timing === 'roundStart' ? [...(seat.roundHazards?.banned ?? [])] : [];
    const struck: string[] = []; const soldOut: string[] = []; const priceDelta: Record<string, number> = {};
    const removed = new Set<string>();
    for (const piece of pieces) {
      const def = getUnit(piece.templateId);
      const hazards = hazardsAt(def.hazard, timing);
      delete piece.hazardPct;
      if (!hazards.length) continue;
      for (const hazard of hazards) {
        const zone = fieldIds.has(piece.id) ? 'field' as const : 'bench' as const;
        const ctx = {
          pieceId: piece.id, zone,
          seed: room.seed, round: room.round, seatId: seat.id, unitId: piece.templateId, star: piece.star,
          hitCounts: { [`${piece.templateId}:${hazard.id}`]: priorBanCounts[piece.templateId] ?? 0 },
          alliedTraitCount: (trait: string) => counts.get(trait) ?? 0,
        };
        if (hazard.effect === 'price') {
          const delta = mods.forcePriceTrough ? (hazard.price?.troughDelta ?? 0) : rollPrice(hazard, ctx).delta;
          priceDelta[piece.templateId] = (priceDelta[piece.templateId] ?? 0) + delta;
          continue;
        }
        if (hazard.effect === 'soldout') {
          if (mods.ignoreSoldOut) continue;
          if (rollHazard(hazard, ctx, mods.chanceScalePct).hit) {
            soldOut.push(piece.templateId);
            room.log.push(`${seat.name} 的 ${def.name} 本回合售罄`);
          }
          continue;
        }
        if (immunePieces.has(piece.id)) continue;
        // 展示用：本回合该棋子的风控理论概率（不含运气）
        piece.hazardPct = Math.max(piece.hazardPct ?? 0, hazardChancePct(hazard, ctx, mods.chanceScalePct));
        const roll = rollHazard(hazard, ctx, mods.chanceScalePct);
        if (!roll.hit) continue;
        if (hazard.effect === 'ban') {
          if (removed.has(piece.id)) break;
          removed.add(piece.id);
          const returnedItems = [...piece.itemIds];
          (seat.inventory ??= []).push(...returnedItems);
          banCounts[piece.templateId] = (banCounts[piece.templateId] ?? 0) + 1;
          const copies = piece.star === 1 ? 1 : piece.star === 2 ? 3 : 9;
          const refundGold = mods.banFullRefundBonusGold !== undefined
            ? autochessCostOf(def) * copies + mods.banFullRefundBonusGold
            : (hazard.refundGold ?? 0);
          if (refundGold) seat.gold! += refundGold;
          banned.push({ round: room.round, zone, pieceId: piece.id, templateId: piece.templateId, name: def.name, chancePct: roll.chancePct, ...(returnedItems.length ? { returnedItems } : {}), ...(refundGold ? { refundGold } : {}) });
          room.log.push(`${seat.name} 的 ${def.name} 被封号离场（查IP ${roll.chancePct.toFixed(0)}%）${refundGold ? `，赔付返还 ${refundGold} 金` : ''}${returnedItems.length ? `，${returnedItems.length} 件装备已退回背包` : ''}`);
        } else if (hazard.effect === 'strike') {
          struck.push(piece.id);
          if (mods.strikeBonusGold > 0) seat.gold! += mods.strikeBonusGold;
          room.log.push(`${seat.name} 的 ${def.name} 罢工缺席（${roll.chancePct.toFixed(0)}%）${mods.strikeBonusGold > 0 ? `，赔付补偿 ${mods.strikeBonusGold} 金` : ''}`);
        }
      }
    }
    if (removed.size) {
      seat.board = seat.board.filter((piece) => !removed.has(piece.id));
      seat.bench = (seat.bench ?? []).filter((piece) => !removed.has(piece.id));
      this.recomputeCapacity(room, seat);
    }
    seat.banCounts = banCounts;
    seat.roundHazards = timing === 'roundEnd'
      ? { round: room.round, struck: seat.roundHazards?.struck ?? [], soldOut: seat.roundHazards?.soldOut ?? [], priceDelta: seat.roundHazards?.priceDelta ?? {}, banned }
      : { round: room.round, banned, struck, soldOut, priceDelta };
  }
  /** 上场棋子（剔除本回合「罢工」缺席的）。 */
  private fieldedForBattle(seat: Seat) {
    const struck = new Set(seat.roundHazards?.struck ?? []);
    return struck.size ? seat.board.filter((piece) => !struck.has(piece.id)) : seat.board;
  }
  /** 赢下交手时结算「监管」（数据驱动）：给对手随机棋子叠 safety，跨回合持久，卖掉即清除。 */
  private applyManeuvers(room: Room, seat: Seat, opponent: Seat) {
    if ((opponent.hexes ?? []).some((id) => findHex(id, room.pack)?.immuneSafety)) return;
    const sources: { sourceKey: string; maneuver: UnitManeuver }[] = [];
    for (const piece of seat.board) {
      const maneuver = getUnit(piece.templateId).maneuver?.[0];
      if (maneuver) sources.push({ sourceKey: `${seat.id}:${piece.id}`, maneuver });
    }
    if (!sources.length) return;
    const plans = planManeuvers({
      sources, trigger: 'roundWin', foePieceIds: opponent.board.map((piece) => piece.id),
      currentStacks: (id) => opponent.board.find((piece) => piece.id === id)?.safetyStacks ?? 0,
      seed: room.seed, round: room.round,
    });
    for (const plan of plans) {
      const target = opponent.board.find((piece) => piece.id === plan.targetPieceId);
      if (!target) continue;
      target.safetyStacks = (target.safetyStacks ?? 0) + plan.stacks;
      room.log.push(`${seat.name} 的监管给 ${opponent.name} 的 ${getUnit(target.templateId).name} 盖了 ${plan.stacks} 层 safety`);
    }
  }
  private makeSeat(room: Room, index: number, name: string, owner?: SeatOwner): Seat {
    const piece = makeInitialPieces(room.seed, this.roster(room), room.seatCount).pieces[index]!;
    const rules = matchRules(room.mode);
    return {
      id: `seat-${index}`, name: name.trim().slice(0, owner ? 49 : 24) || '棋友', hp: rules.startHp, gold: getGameConfig().pacing.startGold, board: [],
      bench: [{ ...piece, id: `${room.id}-opening-${index}` }], inventory: [], uniqueRewards: [], hexes: [],
      level: START_LEVEL, xp: 0, winStreak: 0, capacity: fieldCapacityForLevel(START_LEVEL),
      swordOffer: this.openingOffer(room, index, room.round),
      token: secret(), revision: 0, ready: false, shop: [], say: '',
      ...(owner ? {
        actorType: owner.actorType,
        actorKey: owner.actorKey,
        activeAt: Date.now(),
        accountId: owner.accountId,
        accountName: owner.accountName,
        ...(owner.skinId ? { skinId: owner.skinId } : {}),
        ...(owner.frame ? { frame: owner.frame } : {}),
      } : {})
    };
  }
  private newRoom(pack?: string, seats?: number, mode = 'standard'): Room {
    const packId = parsePackId(pack ?? process.env.CHESS_PACK);
    if (this.packAvailability && !this.packAvailability.isEnabled(packId)) fail('这套棋谱暂未开放');
    if (!isLobbyMode(mode)) fail('未知对局模式');
    const seatCount = matchRules(mode, seats).seatCount;
    const room: Room = {
      version: 1, id: randomBytes(6).toString('hex'), invite: secret(), watch: secret(), seed: randomInt(1, 0x7fffffff), revision: 0,
      mode: parseMatchMode(mode), pack: packId, seatCount, pairings: [], lastOpponent: [], joinKeys: {}, round: 1, phase: 'waiting', seats: [], receipts: {}, log: [`房间已创建，等待棋友入座。· ${packMeta(packId).name} · ${seatCount}人`], cursor: { enabled: false, status: '尚未邀请' }
    };
    return room;
  }
  create(name = '你', pack?: string, seats?: number, owner?: SeatOwner, mode = 'standard', matchKind?: 'travel', telemetrySource?: 'lab') {
    const room = this.newRoom(pack, seats, mode);
    if (matchKind) room.matchKind = matchKind;
    if (telemetrySource) room.telemetrySource = telemetrySource;
    room.seats.push(this.makeSeat(room, 0, name, owner)); this.persist(room);
    return { roomId: room.id, token: room.seats[0]!.token, invitation: `${room.id}.${room.invite}`, watchToken: room.watch };
  }
  /** 创建自定义工坊内存试玩房：不写磁盘、不进公共遥测、不结算公共货币。 */
  createCustom(name = '你', rawPack: unknown, seats?: number, owner?: SeatOwner, mode = 'duel') {
    const validation = validateCustomPack(rawPack);
    const customPack = validation.pack;
    if (!validation.playable || !customPack) {
      return fail(`自定义棋谱尚未满足开局要求：${validation.playBlockers.join('；')}`);
    }
    if (!isLobbyMode(mode)) return fail('未知对局模式');
    const { runtimePackId } = ensureCustomPackRegistered(customPack);
    const seatCount = matchRules(mode, seats).seatCount;
    const room: Room = {
      version: 1,
      id: randomBytes(6).toString('hex'),
      invite: secret(),
      watch: secret(),
      seed: randomInt(1, 0x7fffffff),
      revision: 0,
      mode: parseMatchMode(mode),
      pack: runtimePackId as AnyPackId,
      seatCount,
      pairings: [],
      lastOpponent: [],
      joinKeys: {},
      round: 1,
      phase: 'waiting',
      seats: [],
      receipts: {},
      memoryOnly: true,
      customPack,
      log: [`内存试玩房已创建（不写服务端存档）。· ${customPack.title} · ${seatCount}人`],
      cursor: { enabled: false, status: '尚未邀请' },
    };
    room.seats.push(this.makeSeat(room, 0, name, owner));
    this.persist(room);
    this.cleanup();
    return { roomId: room.id, token: room.seats[0]!.token, invitation: `${room.id}.${room.invite}`, watchToken: room.watch };
  }
  createForMachine(owner: SeatOwner, requestId: string, pack?: string) {
    const packId = parsePackId(pack ?? DEFAULT_PACK_ID);
    const repeated = [...this.rooms.values()].find(room => room.machineCreate?.accountId === owner.accountId && room.machineCreate.requestId === requestId);
    if (repeated?.phase === 'finished') fail('这次开房对应的棋局已结束；新开一局请换新的 requestId');
    const waiting = repeated ?? [...this.rooms.values()].find(room => room.machineCreate?.accountId === owner.accountId && room.phase === 'waiting'
      && Date.now() - (room.updatedAt ?? 0) < ROOM_IDLE_KILL_MS && room.pack === packId);
    if (waiting) return { roomId: waiting.id, token: waiting.seats[0]!.token, invitation: `${waiting.id}.${waiting.invite}`, watchToken: waiting.watch };
    const room = this.newRoom(packId, 2, 'duel');
    room.machineCreate = { accountId: owner.accountId, requestId };
    room.seats.push(this.makeSeat(room, 0, owner.accountName, owner));
    this.persist(room);
    return { roomId: room.id, token: room.seats[0]!.token, invitation: `${room.id}.${room.invite}`, watchToken: room.watch };
  }
  /** 仅受信任宿主调用：操作编号跨重启幂等，且支持私人等候与人机伴随对弈。 */
  createForPlatform(owner: SeatOwner, requestId: string, pack?: string, mode = 'standard', seats?: number, household: SeatOwner[] = []) {
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) fail('操作编号无效');
    if (!isLobbyMode(mode)) fail('未知或未开放的对局模式');
    if (seats !== undefined && (!Number.isInteger(seats) || seats < 2 || seats > 16 || seats % 2 !== 0)) fail('人数须为 2–16 的偶数');
    if (mode === 'duel' && seats !== undefined && seats !== 2) fail('弈决固定双人');
    const packId = parsePackId(pack ?? DEFAULT_PACK_ID);
    const count = matchRules(mode, seats).seatCount;
    if (household.length >= count || new Set([owner.accountId, ...household.map(person => person.accountId)]).size !== household.length + 1) {
      fail('家庭席位重复或超出房间人数');
    }
    const signature = JSON.stringify([packId, mode, count, ...household.map(person => person.accountId).sort()]);
    const repeated = [...this.rooms.values()].find(room => room.platformCreate?.accountId === owner.accountId && room.platformCreate.requestId === requestId);
    if (repeated && repeated.platformCreate!.signature !== signature) fail('操作编号已用于不同开房参数');
    const startHouseholdDuel = (room: Room) => {
      if (owner.actorType !== 'human' || mode !== 'duel' || household.length !== 1 || household[0]!.actorType !== 'ai'
        || room.seatCount !== 2 || room.seats.length !== 2 || room.phase !== 'waiting') return;
      const startId = 'household-' + createHash('sha256').update(requestId).digest('hex');
      this.start({ roomId: room.id, token: room.seats[0]!.token }, startId);
    };
    if (repeated) {
      startHouseholdDuel(repeated);
      return { roomId: repeated.id, invitation: `${repeated.id}.${repeated.invite}`, duplicate: true as const };
    }
    const room = this.newRoom(packId, count, mode);
    room.platformCreate = { accountId: owner.accountId, requestId, signature };
    room.platformTimes = { created: Date.now() };
    room.lastActionAt = room.platformTimes.created;
    room.seats.push(this.makeSeat(room, 0, owner.accountName, owner));
    for (const person of household) {
      const seat = this.makeSeat(room, room.seats.length, person.accountName, person);
      delete seat.activeAt;
      room.seats.push(seat);
    }
    this.persist(room);
    startHouseholdDuel(room);
    return { roomId: room.id, invitation: `${room.id}.${room.invite}` };
  }
  /** 仅返回调用方本人入座的平台私人房，不暴露公共列表。 */
  platformRooms(accountId: string) {
    this.cleanup();
    return [...this.rooms.values()]
      .filter(room => room.platformCreate && room.seats.some(seat => seat.accountId === accountId))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 40)
      .map(room => ({
        roomId: room.id,
        pack: room.pack,
        packName: packMeta(room.pack).name,
        mode: room.mode,
        phase: room.phase,
        round: room.round,
        seats: room.seats.length,
        capacity: room.seatCount,
        updatedAt: room.updatedAt,
      }));
  }
  /** 只读汇总统计：不返回任何房间 ID、玩家昵称或逐房明细。 */
  platformStats(since: number, until = Date.now()) {
    const humans = new Set<string>();
    const ais = new Set<string>();
    let created = 0, started = 0, finished = 0;
    const inside = (at?: number) => at !== undefined && at >= since && at < until;
    for (const room of this.rooms.values()) {
      if (!room.platformTimes) continue;
      created += Number(inside(room.platformTimes.created));
      started += Number(inside(room.platformTimes.started));
      finished += Number(inside(room.platformTimes.finished));
      for (const seat of room.seats) {
        if (!inside(seat.activeAt) || !seat.actorKey) continue;
        if (seat.actorType === 'human') humans.add(seat.actorKey);
        if (seat.actorType === 'ai') ais.add(seat.actorKey);
      }
    }
    return { active_humans: humans.size, active_machines: ais.size, created, started, finished };
  }
  /** 管理统计面板：按公开棋谱与模式统计已开赛的私人局。 */
  platformPlayBreakdown(since: number, until = Date.now()) {
    const modes = LOBBY_MODES.map(mode => ({ id: mode.id, name: mode.name }));
    const packs = PACK_LIST.map(pack => ({
      id: pack.id,
      name: pack.displayName,
      started: 0,
      by_mode: Object.fromEntries(modes.map(mode => [mode.id, 0])) as Record<string, number>,
    }));
    const packMap = new Map(packs.map(pack => [pack.id, pack]));
    const modeIds: Set<string> = new Set(modes.map(mode => mode.id));
    let started = 0;
    for (const room of this.rooms.values()) {
      const at = room.platformTimes?.started;
      if (at === undefined || at < since || at >= until) continue;
      const row = packMap.get(room.pack);
      const mode = room.mode ?? 'standard';
      if (!row || !modeIds.has(mode)) continue;
      row.started++;
      row.by_mode[mode] = (row.by_mode[mode] ?? 0) + 1;
      started++;
    }
    return { started, modes, packs };
  }
  /** 凭邀请加入平台私人房；不自动开局，保持等待房主 start。 */
  joinForPlatform(invitation: string, owner: SeatOwner) {
    const info = this.invitationRoom(invitation);
    const original = this.load(info.roomId);
    if (!original.platformCreate) fail('不是平台私人房间');
    const existing = original.seats.find(seat => seat.accountId === owner.accountId);
    if (existing) return { roomId: original.id, token: existing.token, duplicate: true as const };
    if (original.phase !== 'waiting' || original.seats.length >= original.seatCount) fail('房间已开局或满员');
    const room = structuredClone(original);
    const index = room.seats.length;
    const seat = this.makeSeat(room, index, owner.accountName, owner);
    room.seats.push(seat);
    room.lastActionAt = Date.now();
    room.revision++;
    room.log.push(`${seat.name} 已入座。`);
    this.persist(room);
    return { roomId: room.id, token: seat.token };
  }
  /** Matchmaking seats both people in one write. The server's bystanders fill the other slots. */
  createMatched(requestKey: string, people: SeatOwner[], pack?: string, seats?: number) {
    const existing = [...this.rooms.values()].find(room => room.matchKind === 'queue' && room.matchKey === requestKey);
    if (existing) return {
      roomId: existing.id, phase: existing.phase, seats: people.map(person => ({
        accountId: person.accountId,
        token: existing.seats.find(seat => seat.accountId === person.accountId)?.token ?? fail('匹配席位丢失')
      }))
    };
    if (new Set(people.map(person => person.accountId)).size !== people.length) fail('同一账号不能占两个席位');
    if (people.length !== seats || (seats !== 2 && seats !== 8)) fail('匹配满员后才能开局');
    const room = this.newRoom(pack, seats, seats === 2 ? 'duel' : 'standard');
    room.matchKind = 'queue'; room.matchKey = requestKey;
    for (const person of people) room.seats.push(this.makeSeat(room, room.seats.length, person.accountName, person));
    while (room.seats.length < room.seatCount) {
      const index = room.seats.length;
      const bot = this.makeSeat(room, index, BOT_NAMES[index - 2] ?? `棋手${index + 1}`);
      bot.bot = true; room.seats.push(bot);
    }
    room.phase = 'prepare'; this.pairRound(room); this.autoReadyBots(room);
    room.revision++; room.log.push('匹配完成，全员已入座。'); this.persist(room);
    return {
      roomId: room.id, phase: room.phase, seats: people.map(person => ({
        accountId: person.accountId,
        token: room.seats.find(seat => seat.accountId === person.accountId)!.token
      }))
    };
  }
  /** Only trusted server code calls this after authenticating the account requesting its own seat. */
  activeMatchSeat(accountId: string, kind: 'queue' | 'travel') {
    const active = [...this.rooms.values()].filter(room => {
      this.reapIdle(room);
      return room.phase !== 'finished' && room.matchKind === kind;
    }).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    for (const room of active) {
      const seat = room.seats.find(candidate => candidate.accountId === accountId);
      if (seat) return { roomId: room.id, token: seat.token, seatSize: room.seatCount, phase: room.phase };
    }
    return null;
  }
  /** The caller has authenticated a human and supplied only that human's bound machine account IDs. */
  watchableForMachines(machineIds: readonly string[]) {
    const owned = new Set(machineIds);
    if (!owned.size) return [];
    return [...this.rooms.values()].filter(room => room.phase !== 'finished' && room.seats.some(seat => seat.accountId && owned.has(seat.accountId)))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 20)
      .map(room => ({
        roomId: room.id, token: room.watch, packName: packMeta(room.pack).name,
        round: room.round, phase: room.phase, seats: room.seats.map(seat => seat.name)
      }));
  }
  /** Only the registered human occupying seat zero may invite a machine. */
  socialRoom(accountId: string) {
    const rooms = [...this.rooms.values()].filter(room => {
      if (!room.seats.some(seat => seat.accountId === accountId && seat.hp > 0)) return false;
      this.reapIdle(room);
      return room.phase !== 'finished';
    });
    const room = rooms.sort((a, b) => Number(b.phase === 'prepare') - Number(a.phase === 'prepare') || (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    return room ? { roomId: room.id, phase: room.phase } : null;
  }
  accountSeat(roomId: string, accountId: string) {
    const room = this.load(roomId);
    const seat = room.seats.find(candidate => candidate.accountId === accountId);
    return seat ? { roomId, token: seat.token } : null;
  }
  socialInvitationRoom(roomId: string, hostAccountId: string) {
    const room = this.load(roomId);
    if (room.seats[0]?.accountId !== hostAccountId) fail('邀请人的房主身份已变化');
    return { invitation: `${room.id}.${room.invite}`, available: room.phase === 'waiting' && room.seats.filter(seat => !seat.bot).length < 2, packName: packMeta(room.pack).name };
  }
  machineHostRoom(roomId: string, seatToken: string, accountId: string) {
    const room = this.load(roomId);
    if (room.seats[0]?.token !== seatToken || !accountId || room.seats[0]?.accountId !== accountId) fail('请用本人账号创建房间后邀请机');
    if (room.phase !== 'waiting' || room.seats.filter(seat => !seat.bot).length >= 2) fail('房间已开局或满员');
    return { roomId: room.id, hostAccountId: accountId, hostName: room.seats[0].name, mode: room.mode ?? 'standard' };
  }
  /** Recheck the room when a ticket is redeemed; approval never reserves a seat. */
  machineTicketRoom(roomId: string, hostAccountId: string, requireVacancy: boolean) {
    const room = this.load(roomId);
    if (!hostAccountId || room.seats[0]?.accountId !== hostAccountId) fail('邀请券的房主身份已变化');
    if (requireVacancy && (room.phase !== 'waiting' || room.seats.filter(seat => !seat.bot).length >= 2)) fail('房间已开局或满员');
    return `${room.id}.${room.invite}`;
  }
  machineTicketSeat(roomId: string, joinKey: string): string | undefined {
    const room = this.load(roomId);
    const index = room.joinKeys[joinKey];
    return index === undefined ? undefined : room.seats[index]?.accountId;
  }
  invitationRoom(invitation: string) {
    const [id, code] = typeof invitation === 'string' ? invitation.split('.') : [];
    const room = this.load(id!);
    if (code !== room.invite) fail('房间邀请无效');
    return { roomId: room.id, hostAccountId: room.seats[0]?.accountId, phase: room.phase, isPlatform: Boolean(room.platformCreate) };
  }
  /** Called only after the server authenticates the account and checks invitation policy. */
  joinForAccount(invitation: string, owner: SeatOwner) {
    const info = this.invitationRoom(invitation);
    const room = this.load(info.roomId);
    const existing = room.seats.find(seat => seat.accountId === owner.accountId);
    if (existing) return { roomId: room.id, token: existing.token };
    const key = createHash('sha256').update(`account-join:${room.id}:${owner.accountId}`).digest('hex');
    return this.join(invitation, owner.accountName, key, owner);
  }
  join(invitation: string, name: string, joinKey: string, owner?: SeatOwner) {
    const [id, code] = invitation.split('.'); const original = this.load(id!);
    if (code !== original.invite || joinKey.length < 16) fail('邀请或重连标识无效');
    const known = original.joinKeys[joinKey] ?? (original.joinKey === joinKey ? 1 : undefined);
    if (known !== undefined) {
      const seat = original.seats[known];
      if (!seat || seat.accountId !== owner?.accountId) fail('重连标识已绑定另一位棋手');
      return { roomId: original.id, token: seat.token };
    }
    if (owner?.accountId && original.seats.some(seat => !seat.bot && seat.accountId === owner.accountId)) fail('该账号已经在这间房入座');
    const humans = original.seats.filter(seat => !seat.bot).length;
    if (humans >= 2 || original.phase !== 'waiting') fail('房间已满');
    const room = structuredClone(original);
    room.seats.push(this.makeSeat(room, 1, name, owner)); room.joinKey = joinKey; room.joinKeys[joinKey] = 1;
    while (room.seats.length < room.seatCount) {
      const index = room.seats.length;
      const bot = this.makeSeat(room, index, BOT_NAMES[index - 2] ?? `棋手${index + 1}`);
      bot.bot = true; room.seats.push(bot);
    }
    room.phase = 'prepare'; this.pairRound(room); this.autoReadyBots(room);
    room.revision++; room.log.push(`${room.seats[1]!.name} 已入座。${room.seatCount > 2 ? `补位至 ${room.seatCount} 人。` : ''}`); this.persist(room);
    return { roomId: room.id, token: room.seats[1]!.token };
  }
  /** 单人开局：把剩余席位补成路人机并进入备战（房主不想等人时用）。 */
  start(credentials: RoomCredentials, platformRequestId?: string) {
    const room = structuredClone(this.load(credentials.roomId));
    if (this.auth(room, credentials.token) !== 0) fail('只有房主可以开局');
    if (room.platformCreate) {
      if (!platformRequestId || !/^[a-zA-Z0-9_-]{8,80}$/.test(platformRequestId)) fail('平台开局需要操作编号');
      if (room.platformStart === platformRequestId) return this.view(credentials);
    }
    if (room.phase !== 'waiting') fail('已经开局了');
    if (room.platformCreate) {
      room.platformStart = platformRequestId;
      const startedAt = Date.now();
      room.lastActionAt = startedAt;
      if (room.platformTimes) room.platformTimes.started = startedAt;
      room.seats[0]!.activeAt = startedAt;
    }
    const missing = room.seatCount - room.seats.length;
    while (room.seats.length < room.seatCount) {
      const index = room.seats.length;
      const bot = this.makeSeat(room, index, BOT_NAMES[index - 1] ?? `棋手${index + 1}`);
      bot.bot = true; room.seats.push(bot);
    }
    room.phase = 'prepare'; this.pairRound(room); this.autoReadyBots(room);
    room.revision++; room.log.push(missing ? `房主开局，补位至 ${room.seatCount} 人（其余为路人机）。` : '房主开局，已入座的棋友开始备战。');
    this.persist(room);
    return this.view(credentials);
  }
  view({ roomId, token }: RoomCredentials): RoomView {
    const room = this.load(roomId);
    const index = token === room.watch ? undefined : this.auth(room, token);
    const venue = index === undefined ? undefined : this.venueOf(room, index);
    const battle = index === undefined ? room.battle : room.finalBattles?.[index] ?? room.battle;
    const fight = index === undefined ? undefined : battle?.fights?.find(entry => !entry.ghost && (entry.left === index || entry.right === index))
      ?? battle?.fights?.find(entry => entry.left === index || entry.right === index);
    const rules = matchRules(room.mode);
    const pacingCfg = getGameConfig().pacing;
    return structuredClone({
      id: room.id, revision: room.revision, round: room.round, phase: room.phase,
      ...(room.finishReason === 'cancelled' ? { cancelled: true } : {}),
      mode: room.mode ?? 'standard', maxHp: rules.startHp,
      pacing: {
        xpBuyCost: pacingCfg.xpBuyCost,
        xpBuyAmount: pacingCfg.xpBuyAmount,
        shopRefreshCost: pacingCfg.shopRefreshCost,
        interestCap: rules.interestCap,
        roundBaseIncome: rules.income,
      },
      pack: room.pack, packName: packMeta(room.pack).name,
      ...(room.customPack ? { customPack: room.customPack } : {}),
      ...(room.memoryOnly ? { ephemeral: true } : {}),
      seatCount: room.seatCount, opponentIndex: venue?.opponent, venue,
      wake: { requestedAt: room.wake?.requestedAt, receivedAt: room.wake?.receivedAt, status: room.phase === 'finished' ? '棋局结束' : room.seats[1]?.ready ? '机已就绪' : room.wake?.round === room.round ? (room.wake.receivedAt ? '客户端已收到，等待机落子' : '催促已登记，等待客户端接收') : '等待轮次事件' },
      seats: room.seats.map((seat, i) => ({
        id: seat.id, name: seat.name, hp: seat.hp, board: withHexes(seat.board, seat.hexes), bench: withHexes(seat.bench ?? [], seat.hexes),
        result: seat.result ? { place: seat.result.place, outcome: seat.result.outcome } : undefined, ready: seat.ready, say: seat.say, bot: seat.bot, accountId: seat.accountId, skinId: seat.skinId, frame: seat.frame, ...(seat.accountId ? this.appearance?.(seat.accountId) : {}), online: (i === 1 && room.cursor.enabled && room.cursor.status.startsWith('正在思考')) || Date.now() - (this.seen.get(`${room.id}:${i}`) ?? 0) < 45_000
      })),
      ...(index === undefined ? {} : { seatIndex: index, self: this.privateSeat(room.seats[index]!) }),
      battle: battle ? { ...battle, output: { ...(fight?.output ?? battle.output), seed: 0 } } : undefined, winner: room.winner, log: room.log.slice(-15), cursor: room.cursor,
      danmaku: room.danmaku ?? []
    });
  }
  /** 弹幕上限与样式令牌：新增样式 = room-types 的 DANMAKU_STYLES 加一项 + UI CSS 类。 */
  private static readonly DANMAKU_KEEP = 30;
  private static readonly DANMAKU_TEXT_MAX = 60;

  private appendDanmaku(room: Room, index: number, text: string, style: string, prepareRound?: number, battleRound?: number) {
    room.danmaku = [...room.danmaku ?? [], {
      id: randomBytes(6).toString('hex'), index, name: room.seats[index]!.name,
      text, style: (DANMAKU_STYLES as readonly string[]).includes(style) ? style : 'default', at: Date.now(), prepareRound, battleRound,
    }].slice(-RoomStore.DANMAKU_KEEP);
  }

  private postDanmaku(room: Room, index: number, action: { text?: string; style?: string; battleRound?: number }) {
    const text = typeof action.text === 'string' ? action.text.trim() : '';
    if (!text) fail('弹幕不能为空');
    if (text.length > RoomStore.DANMAKU_TEXT_MAX) fail(`弹幕最长 ${RoomStore.DANMAKU_TEXT_MAX} 字`);
    this.appendDanmaku(room, index, text, typeof action.style === 'string' ? action.style : 'default', undefined, action.battleRound === room.battle?.round ? action.battleRound : undefined);
  }

  private venueOf(room: Room, index: number): RoomVenue | undefined {
    const match = matchupFor(room.pairings, index);
    if (!match) return undefined;
    const opponent = match.left === index ? match.right : match.left;
    return { host: match.host, opponent, skinId: boardSkinId(match.host), visiting: match.host !== index, ghost: match.ghost };
  }
  private pairRound(room: Room) {
    const living = room.seats.map((seat, index) => seat.hp > 0 ? index : -1).filter(index => index >= 0);
    room.pairings = pairLiving(living, room.seed, room.round, room.lastOpponent);
  }
  private autoReadyBots(room: Room) {
    room.seats.forEach((seat, index) => {
      if (!seat.bot || seat.hp <= 0 || seat.ready) return;
      if (seat.draft && seat.draft.roll === undefined) {
        seat.draft.roll = rollDraft(room.seed + index * 409, seat.draft.sourceRound ?? seat.draft.round);
        seat.draft.landing = (seat.draft.position + seat.draft.roll) % seat.draft.track.length;
      }
      if (seat.swordOffer) this.pickSword(seat, seat.swordOffer.choices[0]!);
      if (seat.draft) this.claim(room, seat);
      if (seat.hexOffer) {
        const bestInitial = pickBestHex(seat.hexOffer.choices.map((choice) => getHex(choice.id, room.pack)));
        const rarityId = seat.hexOffer.rarityId ?? rarityIdFromHexRarity(seat.hexOffer.rarity);
        const minScore = rarityId === 'common' ? 20 : rarityId === 'rare' ? 32 : 48;
        if (
          bestInitial &&
          scoreHex(bestInitial) < minScore &&
          seat.hexOffer.rerollCost !== null &&
          seat.hexOffer.rerollCost !== undefined &&
          (seat.gold ?? 0) >= seat.hexOffer.rerollCost + 24
        ) {
          this.rerollHex(room, seat);
        }
        const pick = pickBestHex(seat.hexOffer.choices.map((choice) => getHex(choice.id, room.pack)));
        if (pick) this.claimHex(room, seat, pick.id);
      }
      while (seat.itemOffer) {
        const item = seat.itemOffer.boxes[seat.itemOffer.boxIndex]?.[0];
        if (!item) break;
        this.pickItem(seat, item);
      }
      this.manageBot(room, seat);
      seat.ready = true; seat.say = '……';
    });
  }
  private manageBot(room: Room, seat: Seat) {
    const arrange = () => {
      const result = applyCompanionPlan({
        board: seat.board, bench: seat.bench!, gold: seat.gold!, shop: [], capacity: seat.capacity,
        idPrefix: 'unused', inventory: seat.inventory, plan: { say: '布阵', sell: [], buy: [], field: botField(seat) }
      });
      if (result) { seat.board = result.board; seat.bench = result.bench; }
    };
    arrange();
    // 留下买棋预算，再用多余金币扩大人口；每轮最多买两次经验。
    const buyXpCost = xpBuyCost();
    for (let i = 0; i < 2 && (seat.level ?? START_LEVEL) < MAX_LEVEL && seat.gold! >= buyXpCost + 6; i++) this.buyXp(room, seat, 1);
    arrange();
    if (!shopBanned(seat.shopBanUntil, room.round)) {
      for (let refresh = 0; refresh <= 2; refresh++) {
        for (let step = 0; step < 5; step++) {
          const slot = botBuyOrder(seat).find(slot => {
            const trial = addAndMerge(seat.board, seat.bench!, makePiece(getUnit(seat.shop[slot]!), 'bot-trial'));
            return trial.bench.length <= BENCH_CAPACITY;
          });
          if (slot === undefined) break;
          this.apply(room, seat, {
            roomId: room.id, token: seat.token, round: room.round, revision: seat.revision,
            requestId: `bot-${room.round}-${seat.shopRefresh ?? 0}-${slot}`, action: { kind: 'buy', index: slot }
          });
          arrange();
        }
        if (refresh === 2 || room.round < 2 || !seat.shop.length || seat.gold! < roomRefreshPrice(seat, room.round) + 4 || seat.bench!.length >= BENCH_CAPACITY) break;
        this.refreshShop(room, seat);
      }
    }
    // 优先给上场主力装配；复用同名/两件上限和掉落池校验。
    for (const item of seat.inventory!.slice()) {
      for (const piece of [...seat.board].sort((a, b) => botStrength(b) - botStrength(a))) {
        const result = equipFromRoster(seat.board, seat.bench!, seat.inventory!, piece.id, item, packItems(room.pack));
        if (result) { Object.assign(seat, result); break; }
      }
    }
    this.recomputeCapacity(room, seat);
    arrange();
  }
  private privateSeat(seat: Seat): RoomSelf {
    const { token: _token, say: _say, actorKey: _actorKey, actorType: _actorType, activeAt: _activeAt, ...safe } = seat;
    return safe;
  }
  invite(credentials: RoomCredentials) {
    const room = this.load(credentials.roomId); if (this.auth(room, credentials.token) !== 0) fail('只有房主可以邀请');
    return { invitation: `${room.id}.${room.invite}`, watchToken: room.watch };
  }
  cursorState(credentials: RoomCredentials, enabled: boolean, status: string) {
    const room = structuredClone(this.load(credentials.roomId));
    if (this.auth(room, credentials.token) !== 0) fail('只有房主可以控制本机棋手');
    room.cursor = room.phase === 'finished' ? { enabled: false, status: '棋局结束' } : { enabled, status }; room.revision++; this.persist(room);
  }
  localCursorRooms() { return [...this.rooms.values()].filter(r => r.cursor.enabled && r.phase !== 'finished').map(r => ({ roomId: r.id, token: r.seats[0]!.token })); }
  poke(credentials: RoomCredentials) {
    this.invite(credentials); const room = structuredClone(this.load(credentials.roomId));
    if (room.phase !== 'prepare' || !room.seats[1] || room.seats[1].ready) fail('当前不需要催促棋友');
    if (room.wake && Date.now() - room.wake.requestedAt < 30_000) return this.view(credentials);
    room.wake = { round: room.round, sequence: (room.wake?.sequence ?? 0) + 1, requestedAt: Date.now() };
    room.revision++; this.persist(room); return this.view(credentials);
  }
  wakeEvent(credentials: RoomCredentials) {
    const view = this.view(credentials); if (!view.self) fail('观战席不能订阅行动事件');
    const room = this.load(credentials.roomId);
    const ended = view.phase === 'finished' || view.self!.hp <= 0;
    const event = ended ? {
      id: `${room.id}:${view.seatIndex}:finished`, roomId: room.id, round: view.round, revision: view.self!.revision,
      result: view.self!.result, reason: view.phase === 'finished' ? 'match_finished' : 'seat_eliminated', message: '棋局结束，请根据最终战报回应玩家并复盘。'
    } : view.phase === 'prepare' && !view.self!.ready && view.self!.hp > 0 ? {
      id: `${room.id}:${view.seatIndex}:${view.round}:${view.self!.revision}:${view.seatIndex === 1 ? room.wake?.sequence ?? 0 : 0}`,
      roomId: room.id, round: view.round, revision: view.self!.revision,
      reason: 'turn_required', message: '轮到你了。附带turn快照时直接按nextAction操作，否则read_turn。'
    } : null;
    return { event, after: view.revision, finished: ended };
  }
  acknowledgeWake(credentials: RoomCredentials, eventId: string) {
    const current = this.wakeEvent(credentials); if (current.event?.id !== eventId) fail('唤醒事件已过期，请重新读取');
    const room = structuredClone(this.load(credentials.roomId));
    if (this.auth(room, credentials.token) === 1 && room.wake && room.wake.round === room.round && room.wake.receivedId !== eventId) {
      room.wake.receivedId = eventId; room.wake.receivedAt = Date.now(); room.revision++; this.persist(room);
    }
    return { accepted: true, meaning: '客户端收到，不代表已完成落子' };
  }
  async waitWake(credentials: RoomCredentials, afterEvent?: string, ms = 25_000) {
    const start = Date.now(); let state = this.wakeEvent(credentials);
    while (!state.finished && (!state.event || state.event.id === afterEvent) && Date.now() - start < ms) {
      await this.wait(credentials, state.after, Math.min(25_000, ms - (Date.now() - start))); state = this.wakeEvent(credentials);
    }
    return { ...state, event: state.event?.id === afterEvent ? null : state.event };
  }
  mutate(input: RoomMutation): RoomView {
    const original = this.load(input.roomId); const index = this.auth(original, input.token);
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId)) fail('操作编号无效');
    const key = `${index}:${input.requestId}`;
    const signature = createHash('sha256').update(JSON.stringify([input.round, input.revision, input.action])).digest('hex');
    if (original.receipts[key]) {
      if (original.receipts[key] !== signature) fail('操作编号已用于不同操作');
      return this.view(input);
    }
    if (original.phase === 'finished' && input.action.kind !== 'danmaku') fail('棋局已经结束');
    const room = structuredClone(original); const seat = room.seats[index]!;
    if (input.action.kind !== 'danmaku') {
      seat.activeAt = Date.now();
      if (room.platformCreate) room.lastActionAt = seat.activeAt;
    }
    if (input.action.kind === 'danmaku') {
      this.postDanmaku(room, index, input.action);
      room.revision++; room.receipts[key] = signature;
      this.persist(room); return this.view(input);
    }
    if (input.round !== room.round || input.revision !== seat.revision) fail(`棋局已更新：操作必须使用当前 room.round=${room.round} 和 self.revision=${seat.revision}，不要使用 sourceRound 或房间 revision。请 read_turn 后重新操作。`);
    if (seat.hp <= 0) fail('本局已结算，可以继续观战或再开一局');
    if (input.action.kind === 'cancel_room') {
      if (index !== 0) fail('只有房主可以取消等待房');
      if (room.phase !== 'waiting') fail('棋局已经开始；继续下棋，或用 resign 认输');
      room.phase = 'finished'; room.finishReason = 'cancelled';
      room.cursor.enabled = false; room.cursor.status = '房主已取消等待';
      room.log.push('房主取消了等待房，不计战绩与收益。');
    } else if (input.action.kind === 'resign') {
      seat.hp = 0; seat.bounty = { bank: 0, streak: 0 }; seat.ready = true;
      room.log.push(`${seat.name} 认输。`);
      this.assignResults(room); this.recordResults(room);
      if (!this.maybeFinish(room)) {
        this.autoReadyBots(room);
        if (room.phase === 'prepare' && this.livingSeats(room).length >= 2 && this.livingSeats(room).every(entry => entry.ready)) this.battle(room);
      }
    } else {
      if (input.action.kind === 'unready') {
        if (room.phase !== 'prepare' || seat.hp <= 0) fail('当前不能重新备战');
        seat.ready = false; seat.revision++; room.revision++; room.receipts[key] = signature;
        this.persist(room); return this.view(input);
      }
      if (seat.ready) fail('本轮已经就绪，等待对方');
      if (room.phase !== 'prepare') fail('棋局尚未开局，请等待棋友入座或先开始棋局');
      this.apply(room, seat, input);
      if (seat.hp <= 0) { this.assignResults(room); this.recordResults(room); this.maybeFinish(room); }
      if (room.phase === 'prepare' && this.livingSeats(room).length >= 2 && this.livingSeats(room).every(entry => entry.ready)) this.battle(room);
    }
    seat.revision++; room.revision++; room.receipts[key] = signature;
    if (input.action.kind === 'plan' && seat.lastPlan) seat.lastPlan.revision = seat.revision;
    this.persist(room); return this.view(input);
  }
  private apply(room: Room, seat: Seat, input: RoomMutation) {
    const action = input.action; const board = seat.board; const bench = seat.bench!; const inventory = seat.inventory!;
    const roster = [...board, ...bench];
    if (action.kind === 'buy') {
      if (shopBanned(seat.shopBanUntil, room.round)) fail('养精蓄锐生效中，不能买棋');
      const id = seat.shop[action.index]; if (!Number.isInteger(action.index) || !id) fail('货位已售出或不存在');
      const unit = getUnit(id!); const cost = roomShopPrice(seat, unit); if (seat.gold! < cost) fail('金币不足');
      const result = addAndMerge(board, bench, makePiece(unit, `${room.id}-${seat.id}-${input.requestId}`));
      if (result.bench.length > BENCH_CAPACITY) fail('备战区已满');
      seat.board = result.board; seat.bench = result.bench; inventory.push(...result.returnedItems); seat.gold! -= cost; seat.shop[action.index] = null;
      this.trackCashback(room, seat, cost);
    } else if (action.kind === 'sell') {
      const result = sellFromRoster(board, bench, action.piece); if (!result) fail('棋子不存在');
      seat.board = result!.board; seat.bench = result!.bench; seat.gold! += result!.gold; inventory.push(...result!.returnedItems);
    } else if (action.kind === 'move') {
      if (!Number.isInteger(action.row) || action.row < 0 || action.row > 3 || !Number.isInteger(action.col) || action.col < 0 || action.col > 4) fail('不能放到这格');
      const piece = roster.find(p => p.id === action.piece); if (!piece) fail('棋子不存在');
      const occupant = board.find(p => p.localRow === action.row && p.localCol === action.col);
      if (bench.some(p => p.id === piece!.id)) {
        if (occupant) Object.assign(seat, replaceFromBench(board, bench, piece!.id, occupant.id));
        else { if (!getUnit(piece!.templateId).ally && board.filter(p => !getUnit(p.templateId).ally).length >= seat.capacity) fail('上场人数已满'); seat.bench = bench.filter(p => p.id !== piece!.id); seat.board.push({ ...piece!, localRow: action.row, localCol: action.col }); }
      } else {
        if (occupant && occupant.id !== piece!.id) { occupant.localRow = piece!.localRow; occupant.localCol = piece!.localCol; }
        piece!.localRow = action.row; piece!.localCol = action.col;
      }
    } else if (action.kind === 'withdraw') {
      const piece = board.find(p => p.id === action.piece); if (!piece || bench.length >= BENCH_CAPACITY) fail('无法下场：棋子不在场上或备战区已满');
      seat.board = board.filter(p => p.id !== action.piece); bench.push(piece!);
    } else if (action.kind === 'equip') {
      const result = equipFromRoster(board, bench, inventory, action.piece, action.item, packItems(room.pack)); if (!result) fail('无法装配'); Object.assign(seat, result);
      this.recomputeCapacity(room, seat);
    } else if (action.kind === 'consume') {
      // 一次性食用/使用：永久属性记在棋子身上，道具从背包移除
      const piece = roster.find(p => p.id === action.piece); if (!piece) throw new Error('棋子不存在');
      const index = inventory.indexOf(action.item); if (index < 0) throw new Error('背包里没有这件道具');
      const effect = getCatalogItem(action.item)?.consume; if (!effect) throw new Error('这件道具不能食用或使用');
      piece.consumed = [...(piece.consumed ?? []), action.item];
      inventory.splice(index, 1);
    } else if (action.kind === 'unequip') {
      const result = unequipFromRoster(board, bench, action.piece, action.item); if (!result.removed) fail('没有这件装备');
      seat.board = result.board; seat.bench = result.bench; inventory.push(action.item);
      this.recomputeCapacity(room, seat);
    } else if (action.kind === 'roll' || action.kind === 'roll_and_claim') {
      if (!seat.draft || (action.kind === 'roll' && seat.draft.roll !== undefined)) fail('本轮不能再次掷骰');
      const draft = seat.draft!;
      if (draft.roll === undefined) {
        draft.roll = rollDraft(room.seed + Number(seat.id.at(-1)) * 409, draft.sourceRound ?? draft.round);
        draft.landing = (draft.position + draft.roll) % draft.track.length;
      }
      if (action.kind === 'roll_and_claim') this.claim(room, seat);
    } else if (action.kind === 'claim') {
      this.claim(room, seat);
    } else if (action.kind === 'buy_xp') {
      this.buyXp(room, seat, action.times ?? 1);
    } else if (action.kind === 'refresh') {
      this.refreshShop(room, seat);
    } else if (action.kind === 'pick_hex') {
      this.claimHex(room, seat, action.hex);
    } else if (action.kind === 'reroll_hex') {
      this.rerollHex(room, seat);
    } else if (action.kind === 'pick_item') {
      this.pickItem(seat, action.item);
    } else if (action.kind === 'pick_sword') {
      this.pickSword(seat, action.item);
    } else if (action.kind === 'plan') {
      if (action.plan.refresh && action.plan.buy?.length) fail('请先刷新查看新商店，再按新货位购买');
      if (seat.draft) fail('请先掷骰并领取本轮选秀');
      if (seat.swordOffer) {
        const swordChoice = action.plan.sword ?? seat.swordOffer.choices[0]!;
        this.pickSword(seat, swordChoice);
      }
      if (seat.hexOffer) {
        const hexChoice = action.plan.hex;
        if (typeof hexChoice !== 'string') fail('请先选择心悟：plan.hex 必须是本轮三选一');
        this.claimHex(room, seat, hexChoice!);
      }
      if (seat.itemOffer) {
        const itemChoice = action.plan.item;
        if (typeof itemChoice !== 'string') throw new Error('请先选择装备宝箱：plan.item 必须是当前箱候选之一');
        this.pickItem(seat, itemChoice);
      }
      if (typeof action.plan.buyXp === 'number' && action.plan.buyXp > 0) this.buyXp(room, seat, action.plan.buyXp);
      let formatReason = '';
      const parsed = parseCompanionPlan(JSON.stringify(action.plan), reason => { formatReason = reason; }); if (!parsed) fail(formatReason || 'plan 无法解析，请按工具字段填写');
      // Refresh through the same economy path as the human UI, then return the new offer.
      for (let i = 0; i < (parsed!.refresh ?? 0); i++)this.refreshShop(room, seat);
      parsed!.refresh = undefined;
      const liveBoard = seat.board; const liveBench = seat.bench!; const liveInventory = seat.inventory!;
      const liveRoster = [...liveBoard, ...liveBench];
      const beforeRefs = roomPieceRefs(liveRoster, seat);
      const plan = resolveRoomPlan(parsed!, liveRoster, seat);
      let invalidReason = '';
      const result = applyCompanionPlan({
        board: liveBoard, bench: liveBench, inventory: liveInventory, gold: seat.gold!, shop: seat.shop.map(id => id ? getUnit(id) : undefined) as ReturnType<typeof getUnit>[],
        capacity: seat.capacity, idPrefix: `${room.id}-${seat.id}-${input.requestId}-`, plan: plan!, recoverPositions: true, shopLocked: shopBanned(seat.shopBanUntil, room.round),
        priceOf: unit => roomShopPrice(seat, unit),
        loot: packItems(room.pack),
        refreshShop: () => this.rollShopOffer(room, seat).shop, onInvalid: reason => invalidReason = reason
      });
      if (!result) fail(invalidReason || '计划无法执行，请检查金币、棋子引用与站位');
      seat.board = result!.board; seat.bench = result!.bench; seat.inventory = result!.inventory; seat.gold = result!.gold;
      this.trackCashback(room, seat, result!.purchaseSpent);
      this.recomputeCapacity(room, seat);
      ensureRoomPieceRefs(seat);
      const afterRefs = roomPieceRefs([...seat.board, ...seat.bench], seat);
      const references = Object.entries(result!.resolvedRefs).filter(([from, to]) => from !== to && (beforeRefs.has(from) || from.startsWith('shop:'))).map(([from, to]) => {
        const piece = [...seat.board, ...seat.bench!].find(p => p.id === to)!;
        return { from: beforeRefs.get(from) ?? from, to: afterRefs.get(to)!, templateId: piece.templateId, star: piece.star, zone: seat.board.some(p => p.id === to) ? 'fielded' as const : 'benched' as const };
      });
      seat.lastPlan = {
        requestId: input.requestId, round: room.round, adjustments: result!.adjustments, references,
        merged: references.filter(r => !r.from.startsWith('shop:')),
        invalidated: [...beforeRefs].filter(([id]) => !afterRefs.has(id)).map(([, ref]) => ref),
        positionsApplied: seat.board.map(p => ({ piece: afterRefs.get(p.id)!, row: p.localRow, col: p.localCol }))
      };
      for (const i of plan!.buy) seat.shop[i] = null;
      seat.say = plan!.say; seat.ready = action.ready !== false && !seat.itemOffer;
      const spoken = plan!.say?.trim();
      if (spoken && spoken !== '……') this.appendDanmaku(room, room.seats.indexOf(seat), spoken.slice(0, RoomStore.DANMAKU_TEXT_MAX), 'default', room.round);
    } else if (action.kind === 'ready') {
      if (seat.draft) fail('请先完成选秀');
      if (seat.swordOffer) fail(`请先选择${seat.swordOffer.label}`);
      if (seat.hexOffer) fail('请先选择心悟');
      if (seat.itemOffer) fail('请先选完装备宝箱');
      if (!seat.board.length) fail('请至少上场一名棋子');
      seat.ready = true;
    } else fail('未知操作');
  }
  /** 上阵人口由等级与心悟的人口增益决定。 */
  private recomputeCapacity(room: Room, seat: Seat) {
    seat.capacity = Math.min(10, fieldCapacityForLevel(seat.level ?? START_LEVEL, seat.bonusCap ?? 0));
  }
  /** 每轮利息：每 10 金 +1，上限默认 4；可由经济 Buff 调整上限或改为固定津贴。 */
  private roundInterest(room: Room, seat: Seat): number {
    let cap = matchRules(room.mode).interestCap;
    let flat = 0;
    for (const hexId of seat.hexes ?? []) {
      const hex = getHex(hexId, room.pack);
      if (hex.interestCap !== undefined) cap = hex.interestCap;
      if (hex.roundIncome) {
        const ladder = hex.roundIncome;
        flat += ladder[stageOfRound(room.round)] ?? ladder[Math.max(...Object.keys(ladder).map(Number))] ?? 0;
      }
    }
    if (cap <= 0) return flat;
    return flat + Math.min(cap, Math.floor((seat.gold ?? 0) / 10));
  }
  /** 金币买经验：按后台配置每笔 `xpBuyCost` 金换 `xpBuyAmount + xpPerBuyBonus` 点；金币不足或满级即停。 */
  private buyXp(room: Room, seat: Seat, times: number) {
    const want = Math.max(1, Math.min(8, Math.trunc(times) || 1));
    const cost = xpBuyCost();
    const baseAmount = xpBuyAmount();
    let xpBonus = 0;
    for (const id of seat.hexes ?? []) xpBonus += findHex(id, room.pack)?.xpPerBuyBonus ?? 0;
    let bought = 0;
    for (let index = 0; index < want; index += 1) {
      if ((seat.level ?? START_LEVEL) >= MAX_LEVEL) break;
      if ((seat.gold ?? 0) < cost) break;
      seat.gold! -= cost;
      const progress = addXp(seat.level ?? START_LEVEL, seat.xp ?? 0, baseAmount + xpBonus);
      seat.level = progress.level; seat.xp = progress.xp; bought += 1;
    }
    if (bought === 0) {
      if ((seat.level ?? START_LEVEL) >= MAX_LEVEL) throw new Error(`已经满级（${MAX_LEVEL} 级）`);
      throw new Error(`金币不足，买一次经验需要 ${cost} 金`);
    }
    this.recomputeCapacity(room, seat);
  }
  private rollShopOffer(room: Room, seat: Seat) {
    if (!seat.shop.length || room.round < 2) fail('现在没有商店');
    const index = room.seats.indexOf(seat);
    seat.shopRefresh = (seat.shopRefresh ?? 0) + 1;
    const offer = makeCatchupShop(room.seed + index * 409, room.round - 1, [...seat.board, ...seat.bench!], seat.catchup, seat.shopRefresh, this.roster(room), seat.level ?? START_LEVEL);
    seat.shop = offer.shop.map(u => u.id); seat.catchup = offer.state;
    return offer;
  }
  private rerollHex(room: Room, seat: Seat) {
    const offer = seat.hexOffer;
    if (!offer) {
      fail('当前没有可重投的选秀');
      return;
    }
    const buffCfg = getGameConfig().buffs;
    const rerollsUsed = offer.rerollsUsed ?? 0;
    const maxRerolls = buffCfg.rerollCosts.length;
    if (rerollsUsed >= maxRerolls) fail(`本轮选秀最多重投 ${maxRerolls} 次`);
    const cost = buffCfg.rerollCosts[rerollsUsed] ?? 0;
    if ((seat.gold ?? 0) < cost) fail(`重投选秀需要 ${cost} 金，当前金币不足`);
    seat.gold = (seat.gold ?? 0) - cost;
    this.trackCashback(room, seat, cost);
    const rarityId = offer.rarityId ?? rarityIdFromHexRarity(offer.rarity);
    const seatIndex = room.seats.indexOf(seat);
    seat.hexOffer = drawSeatBuffOffer({
      seed: room.seed,
      seatIndex: seatIndex >= 0 ? seatIndex : 0,
      round: room.round,
      packId: room.pack,
      rarity: rarityId,
      ownedIds: seat.hexes ?? [],
      excludeIds: offer.choices.map((c) => c.id),
      rerollIndex: rerollsUsed + 1,
      config: buffCfg,
    });
  }
  private claimHex(room: Room, seat: Seat, hexId: string) {
    const offer = seat.hexOffer;
    if (!offer) {
      fail('现在不能选心悟');
      return;
    }
    if (!offer.choices.some((choice) => choice.id === hexId)) fail('该奇遇词条不在本轮三选一中');
    const hex = getHex(hexId, room.pack);
    seat.hexes = [...new Set([...(seat.hexes ?? []), hex.id])];
    const gold = immediateHexGold(hex);
    if (gold) seat.gold = (seat.gold ?? 0) + gold;
    if (hex.immediateXp) {
      const progress = addXp(seat.level ?? START_LEVEL, seat.xp ?? 0, hex.immediateXp);
      seat.level = progress.level; seat.xp = progress.xp;
      this.recomputeCapacity(room, seat);
    }
    if (hex.bonusFieldCap) {
      seat.bonusCap = (seat.bonusCap ?? 0) + hex.bonusFieldCap;
      this.recomputeCapacity(room, seat);
    }
    if (hex.immediateFreeRefreshes) {
      const prevLeft = seat.freeRefreshes && seat.freeRefreshes.until >= room.round ? seat.freeRefreshes.left : 0;
      const keepUntil = Math.max(seat.freeRefreshes?.until ?? 0, room.round);
      const keepPerRound = seat.freeRefreshes && seat.freeRefreshes.until > room.round ? seat.freeRefreshes.perRound : 0;
      seat.freeRefreshes = { hex: hex.id, until: keepUntil, perRound: keepPerRound, left: prevLeft + hex.immediateFreeRefreshes };
    }
    const grantUnitId = grantUnitFromNote(hex, this.roster(room));
    if (grantUnitId) {
      const granted = deliverUnitToRoster(seat.board, seat.bench!, seat.gold!, grantUnitId, `${room.id}-${seat.id}-hex-${hex.id}`, hex.grantUnitStar ?? 1);
      seat.board = granted.board; seat.bench = granted.bench; seat.gold = granted.gold; seat.inventory!.push(...granted.returnedItems);
    }
    if (hex.grantRandomCostUnit) {
      const { cost, count, star } = hex.grantRandomCostUnit;
      const allPool = this.roster(room);
      const exact = allPool.filter((unit) => autochessCostOf(unit) === cost);
      const candidates = exact.length ? exact : allPool.filter((unit) => autochessCostOf(unit) > 0 && autochessCostOf(unit) <= cost);
      for (let index = 0; index < count; index += 1) {
        const pick = candidates[createRng(hash32(room.seed, room.round, index + 211)).int(Math.max(1, candidates.length))];
        if (!pick) continue;
        const granted = deliverUnitToRoster(seat.board, seat.bench!, seat.gold!, pick.id, `${room.id}-${seat.id}-hex-${hex.id}-cost${cost}-${index}`, star ?? 1);
        seat.board = granted.board; seat.bench = granted.bench; seat.gold = granted.gold; seat.inventory!.push(...granted.returnedItems);
      }
    }
    if (hex.starUpHighestUnit) {
      const { count, grantHazardImmunity } = hex.starUpHighestUnit;
      const boardSet = new Set(seat.board.map((p) => p.id));
      const candidates = [...seat.board, ...(seat.bench ?? [])]
        .filter((p) => p.star < 3 && !getUnit(p.templateId).ally)
        .sort((a, b) => {
          const costDiff = autochessCostOf(getUnit(b.templateId)) - autochessCostOf(getUnit(a.templateId));
          if (costDiff !== 0) return costDiff;
          const boardDiff = Number(boardSet.has(b.id)) - Number(boardSet.has(a.id));
          if (boardDiff !== 0) return boardDiff;
          return b.star - a.star;
        });
      let upgraded = 0;
      for (const piece of candidates.slice(0, count)) {
        piece.star = nextStar(piece.star);
        upgraded += 1;
        if (grantHazardImmunity) {
          seat.hazardImmunePieceIds = [...new Set([...(seat.hazardImmunePieceIds ?? []), piece.id])];
          delete piece.hazardPct;
        }
      }
      if (upgraded === 0) seat.gold = (seat.gold ?? 0) + 8;
    }
    // 直接发装备与按品阶发放装备。
    for (const itemId of hex.grantItems ?? []) seat.inventory!.push(itemId);
    this.grantHexEquipment(room, seat, hex.id, hex);
    if (hex.mysteryBox) this.settleMysteryBox(room, seat, hex.id, hex.mysteryBox);
    // Resolve one-off random unit grants.
    if (hex.grantRandomUnits) {
      const pool = this.roster(room).filter((unit) => autochessCostOf(unit) > 0);
      for (let index = 0; index < hex.grantRandomUnits; index += 1) {
        const pick = pool[createRng(hash32(room.seed, room.round, index + 97)).int(Math.max(1, pool.length))];
        if (!pick) continue;
        const granted = deliverUnitToRoster(seat.board, seat.bench!, seat.gold!, pick.id, `${room.id}-${seat.id}-hex-${hex.id}-${index}`);
        seat.board = granted.board; seat.bench = granted.bench; seat.gold = granted.gold; seat.inventory!.push(...granted.returnedItems);
      }
    }
    if (hex.hazardModifiers?.forcePriceTrough || hex.hazardModifiers?.ignoreSoldOut) {
      seat.roundHazards ??= { round: room.round, struck: [], soldOut: [], priceDelta: {} };
      if (hex.hazardModifiers.ignoreSoldOut) seat.roundHazards.soldOut = [];
      if (hex.hazardModifiers.forcePriceTrough) {
        for (const unit of this.roster(room)) {
          for (const h of hazardsAt(unit.hazard, 'roundStart')) {
            if (h.effect === 'price') seat.roundHazards.priceDelta[unit.id] = h.price?.troughDelta ?? 0;
          }
        }
      }
    }
    const ban = shopBanFromHex(hex, room.round);
    if (ban) {
      seat.shopBanUntil = Math.max(seat.shopBanUntil ?? 0, ban.untilRound);
      if (ban.gold) seat.hexPayouts = [...(seat.hexPayouts ?? []), { round: ban.payoutRound, gold: ban.gold, hex: ban.hex }];
    }
    const bonus = delayedGoldBonus(hex, room.round);
    if (bonus) seat.hexPayouts = [...(seat.hexPayouts ?? []), bonus];
    const refresh = freeRefreshGrant(hex, room.round);
    if (refresh) seat.freeRefreshes = { ...refresh, left: refresh.perRound };
    if (winGoldPerStreak(hex)) seat.hexWinTally = [...(seat.hexWinTally ?? []).filter(tally => tally.hex !== hex.id), { hex: hex.id, wins: 0 }];
    this.settleRecurringHexGrants(room, seat, 'claim');
    delete seat.hexOffer;
  }
  /**
   * 发放心悟附带的装备：按品阶随机（grantTierItems）与「多选一」宝箱（itemBoxes）。
   * 宝箱只登记 itemOffer，棋手选完前不能就绪；引擎不认识具体心悟。
   */
  private grantHexEquipment(room: Room, seat: Seat, hexId: string, payload: Pick<HexGrant, 'grantTierItems' | 'itemBoxes'>) {
    const loot = packItems(room.pack);
    if (payload.grantTierItems) {
      const { family, count } = payload.grantTierItems;
      const pool = loot.filter((item) => item.family === family);
      for (let index = 0; index < count; index += 1) {
        const pick = pool[createRng(hash32(room.seed, room.round, index + 31)).int(Math.max(1, pool.length))];
        if (pick) seat.inventory!.push(pick.id);
      }
    }
    if (payload.itemBoxes?.length) {
      const boxes = openItemBoxes({
        grants: payload.itemBoxes,
        loot,
        rng: createRng(hash32(room.seed, room.round, hashString(0, `${hexId}:box`))),
      });
      if (boxes.length) seat.itemOffer = { round: room.round, source: hexId, family: payload.itemBoxes[0]!.family, boxes, boxIndex: 0 };
    }
  }
  /**
   * 神秘宝匣系：三档共享 `counter` 计数，第 `doubleAt` 次奖励翻倍，第 `fortuneAt` 次改发鸿运宝匣。
   * 每次随机抽一份金币/装备/棋子，引擎不认识具体宝匣名。
   */
  private settleMysteryBox(room: Room, seat: Seat, hexId: string, box: MysteryBox) {
    const count = (seat.hexCounters?.[box.counter] ?? 0) + 1;
    seat.hexCounters = { ...seat.hexCounters, [box.counter]: count };
    const rng = createRng(hash32(room.seed, room.round, hashString(count, `${hexId}:mystery`)));
    const fortune = box.fortuneAt !== undefined && count >= box.fortuneAt && box.fortune;
    const reward = fortune ? fortune : box.rewards[rng.int(Math.max(1, box.rewards.length))]!;
    const factor = !fortune && box.doubleAt !== undefined && count >= box.doubleAt ? 2 : 1;
    if (reward.gold) seat.gold! += reward.gold * factor;
    if (reward.items) {
      this.grantHexEquipment(room, seat, hexId, {
        grantTierItems: { family: reward.items.family, count: reward.items.count * factor },
      });
    }
    if (reward.units) {
      const roster = this.roster(room).filter((unit) => autochessCostOf(unit) > 0);
      for (let index = 0; index < reward.units * factor; index += 1) {
        const pick = roster[createRng(hash32(room.seed, room.round, hashString(count * 97 + index, hexId))).int(Math.max(1, roster.length))];
        if (!pick) continue;
        const granted = deliverUnitToRoster(seat.board, seat.bench!, seat.gold!, pick.id, `${room.id}-${seat.id}-hex-${hexId}-${count}-${index}`);
        seat.board = granted.board; seat.bench = granted.bench; seat.gold = granted.gold; seat.inventory!.push(...granted.returnedItems);
      }
    }
  }
  /** 旗手气血类 Buff（背水残甲 / 残甲锻锋）：降到阈值以下时一次性发放，hexFlags 防重复。 */
  private settleHpTriggeredHexes(room: Room, seat: Seat) {
    for (const hexId of seat.hexes ?? []) {
      const trigger = getHex(hexId, room.pack).onHpBelow;
      if (!trigger || (seat.hexFlags ?? []).includes(hexId)) continue;
      if (seat.hp > trigger.hp) continue;
      seat.hexFlags = [...new Set([...(seat.hexFlags ?? []), hexId])];
      if (trigger.gold) seat.gold = (seat.gold ?? 0) + trigger.gold;
      this.grantHexEquipment(room, seat, hexId, trigger);
    }
  }
  /** 开局三选一：选中一件进背包，选完删除。 */
  private pickSword(seat: Seat, itemId: string) {
    const offer = seat.swordOffer;
    if (!offer) throw new Error('现在没有开局三选一可选');
    if (!offer.choices.includes(itemId)) throw new Error(`这件${offer.label}不在三选一里`);
    seat.inventory!.push(itemId);
    delete seat.swordOffer;
  }
  /** 装备宝箱多选一：选中当前箱的一件，推进到下一箱；选完删除。 */
  private pickItem(seat: Seat, itemId: string) {
    const offer = seat.itemOffer;
    if (!offer) throw new Error('现在没有装备宝箱可选');
    const box = offer.boxes[offer.boxIndex];
    if (!box?.includes(itemId)) throw new Error('这件装备不在当前宝箱里');
    seat.inventory!.push(itemId);
    if (offer.boxIndex + 1 >= offer.boxes.length) delete seat.itemOffer;
    else offer.boxIndex += 1;
  }
  /**
   * 心悟的「每回合再给」：按数据声明的时机（领取 / 回合初 / 战斗结算后）与候选池结算。
   * The engine interprets RecurringGrant data without checking choice ids.
   */
  private settleRecurringHexGrants(room: Room, seat: Seat, timing: RecurringGrant['timing']) {
    const owned = seat.hexes ?? [];
    if (!owned.length) return;
    const roster: RecurringRosterUnit[] = this.roster(room).map((unit) => ({
      id: unit.id, factions: unit.factions, jobs: unit.jobs, cost: autochessCostOf(unit),
    }));
    for (const hexId of owned) {
      for (const grant of getHex(hexId, room.pack).recurringGrants ?? []) {
        if (grant.timing !== timing) continue;
        const rng = createRng(hash32(room.seed, room.round, hashString(0, `${hexId}:${timing}`)));
        for (let index = 0; index < Math.max(0, grant.count); index += 1) {
          const pool = recurringGrantPool(grant, seat.board, roster);
          if (pool.length) {
            const pick = pool[rng.int(pool.length)]!;
            const granted = deliverUnitToRoster(seat.board, seat.bench!, seat.gold!, pick, `${room.id}-${seat.id}-hex-${hexId}-${room.round}-${index}`);
            seat.board = granted.board; seat.bench = granted.bench; seat.gold = granted.gold; seat.inventory!.push(...granted.returnedItems);
            continue;
          }
          if (grant.fallbackGold) seat.gold! += grant.fallbackGold;
        }
      }
    }
  }
  private restoreShopBan(seat: Seat, room: Room) {
    const round = room.round;
    if (seat.shopBanUntil !== undefined) return;
    const first = matchRules(room.mode).hexPicks[0]?.round ?? 3;
    if (round > first + 2) return;
    for (const id of seat.hexes ?? []) {
      const hex = getHex(id, room.pack);
      const ban = shopBanFromHex(hex, first);
      if (!ban) continue;
      seat.shopBanUntil = ban.untilRound;
      if (ban.gold && !(seat.hexPayouts ?? []).some(entry => entry.hex === ban.hex)) {
        seat.hexPayouts = [...(seat.hexPayouts ?? []), { round: ban.payoutRound, gold: ban.gold, hex: ban.hex }];
      }
    }
  }
  private payHexPayouts(seat: Seat, round: number) {
    const pending = seat.hexPayouts ?? [];
    const due = pending.filter(entry => entry.round <= round);
    if (!due.length) return;
    const paid = due.filter(entry => entry.minGold === undefined || seat.gold! >= entry.minGold);
    seat.gold! += paid.reduce((sum, entry) => sum + entry.gold, 0);
    seat.hexPayouts = pending.filter(entry => entry.round > round);
  }
  /** 抢占先机 charges never cost gold; 物美价廉-style hexes cut the first paid refresh each round. */
  /** 塞翁失马 (per own death, seeded roll) and 胜绩累资 (win tally). Hex ids resolve via note parsers only. */
  private settleHexEconomy(room: Room, seat: Seat, index: number, output: { units: { id: string; team: string; survivingHp: number }[] }, team: 'left' | 'right', won: boolean) {
    const boardIds = new Set(seat.board.map(piece => piece.id));
    const deaths = output.units.filter(unit => unit.team === team && boardIds.has(unit.id) && unit.survivingHp <= 0).length;
    const rng = deaths ? createRng(hash32(room.seed, room.round, 917 + index)) : null;
    let earned = 0;
    for (const hexId of seat.hexes ?? []) {
      const chance = deathGoldChance(getHex(hexId, room.pack));
      if (chance && rng) for (let i = 0; i < deaths; i++) if (rng.next() * 100 < chance.pct) earned += chance.gold;
      const tally = (seat.hexWinTally ?? []).find(entry => entry.hex === hexId);
      if (won && tally) {
        const rule = winGoldPerStreak(getHex(hexId, room.pack));
        if (rule) {
          const wins = tally.wins + 1;
          if (wins >= rule.wins) { earned += rule.gold; tally.wins = 0; } else tally.wins = wins;
        }
      }
    }
    if (earned) seat.gold! += earned;
    return earned;
  }
  private refreshShop(room: Room, seat: Seat) {
    const used = seat.shopRefresh ?? 0;
    const permFree = used < permanentFreeRefreshesPerRound(seat.hexes);
    const free = !permFree && seat.freeRefreshes && room.round <= seat.freeRefreshes.until && seat.freeRefreshes.left > 0
      ? seat.freeRefreshes
      : undefined;
    const cost = roomRefreshPrice(seat, room.round);
    if (seat.gold! < cost) fail(`刷新要 ${cost} 金`);
    this.rollShopOffer(room, seat);
    if (free) free.left -= 1;
    else if (!permFree) seat.gold! -= cost;
    if (cost > 0) {
      let paidRollXp = 0;
      for (const id of seat.hexes ?? []) paidRollXp += findHex(id, room.pack)?.xpPerPaidRefresh ?? 0;
      if (paidRollXp > 0) {
        const progress = addXp(seat.level ?? START_LEVEL, seat.xp ?? 0, paidRollXp);
        seat.level = progress.level; seat.xp = progress.xp;
        this.recomputeCapacity(room, seat);
      }
    }
    this.trackCashback(room, seat, cost);
  }
  private claim(room: Room, seat: Seat) {
    const draft = seat.draft; if (!draft || draft.landing === undefined) fail('请先掷骰');
    const reward = draft!.track[draft!.landing!]!;
    const beforeHp = seat.hp, beforeGold = seat.gold!, beforeInventory = seat.inventory!.length, beforeRoster = JSON.stringify([seat.board, seat.bench, seat.uniqueRewards, seat.capacity]);
    seat.draftPosition = draft!.landing;
    if (reward.kind === 'gold') seat.gold! += reward.amount;
    if (reward.kind === 'heal') seat.hp = Math.min(matchRules(room.mode).startHp, seat.hp + reward.amount);
    if (reward.kind === 'mishap') seat.hp = Math.max(1, seat.hp - reward.hpLoss);
    if (reward.kind === 'item') { seat.inventory!.push(reward.itemId); seat.lastSkillRound = draft!.sourceRound ?? draft!.round; }
    if (reward.kind === 'unit') {
      const unit = getUnit(reward.unitId); const merged = addAndMerge(seat.board, seat.bench!, makePiece(unit, `${room.id}-${seat.id}-draft-${draft!.round}`));
      if (merged.bench.length <= BENCH_CAPACITY) { seat.board = merged.board; seat.bench = merged.bench; seat.inventory!.push(...merged.returnedItems); }
      else seat.gold! += autochessCostOf(unit);
    }
    if (reward.kind === 'unique') {
      if (seat.uniqueRewards!.includes(reward.uniqueId)) fail('此奖励不能重复领取');
      seat.uniqueRewards!.push(reward.uniqueId);
      if (reward.uniqueId === 'field-cap') { seat.bonusCap = (seat.bonusCap ?? 0) + 1; this.recomputeCapacity(room, seat); }
      if (reward.uniqueId === 'twin-kit') { seat.inventory!.push(...packKitItems(room.pack)); seat.lastSkillRound = draft!.sourceRound ?? draft!.round; }
      if (reward.uniqueId === 'star-token') {
        const target = [...seat.board, ...seat.bench!].sort((a, b) => autochessCostOf(getUnit(b.templateId)) - autochessCostOf(getUnit(a.templateId)))[0];
        if (target) target.star = nextStar(target.star);
      }
    }
    seat.draftLabel = `骰点 ${draft!.roll} · ${reward.label}`; delete seat.draft;
    seat.lastDraft = {
      round: room.round, kind: reward.kind, label: seat.draftLabel, hpDelta: seat.hp - beforeHp, goldDelta: seat.gold! - beforeGold,
      noop: seat.hp === beforeHp && seat.gold === beforeGold && seat.inventory!.length === beforeInventory && JSON.stringify([seat.board, seat.bench, seat.uniqueRewards, seat.capacity]) === beforeRoster, lethal: seat.hp <= 0
    };
  }
  private livingSeats(room: Room) { return room.seats.filter(seat => seat.hp > 0); }
  private livingIndices(room: Room) { return room.seats.map((seat, index) => seat.hp > 0 ? index : -1).filter(index => index >= 0); }
  private maybeFinish(room: Room) {
    const living = this.livingIndices(room);
    const rules = matchRules(room.mode);
    if (living.length > rules.finishWhenLiving && room.round < rules.hardRoundCap) return false;
    const pool = living.length ? living : room.seats.map((_, index) => index);
    const best = pool.reduce((winner, index) => room.seats[index]!.hp > room.seats[winner]!.hp ? index : winner);
    const top = room.seats[best]!.hp;
    const tied = pool.filter(index => room.seats[index]!.hp === top);
    room.phase = 'finished';
    room.winner = living.length === 0 || (tied.length > 1 && top > 0) ? 'draw' : best;
    room.cursor.enabled = false; room.cursor.status = '棋局结束';
    this.assignResults(room, true);
    this.recordFinish(room);
    return true;
  }
  private battle(room: Room) {
    const round = room.round; const rules = matchRules(room.mode);
    const beforeHp = room.seats.map(seat => seat.hp);
    const boards = room.seats.map(s => structuredClone(withHexes(s.board, s.hexes)));
    const benches = room.seats.map(s => structuredClone(withHexes(s.bench ?? [], s.hexes)));
    if (!room.pairings.length) this.pairRound(room);
    const losses = room.seats.map(() => 0); const payouts = room.seats.map(() => 0);
    const fights: NonNullable<RoomBattle['fights']> = [];
    const minLivingHp = Math.min(...room.seats.filter((seat) => seat.hp > 0).map((seat) => seat.hp));
    for (const match of room.pairings) {
      const left = room.seats[match.left]!; const right = room.seats[match.right]!;
      const leftField = withHexes(this.fieldedForBattle(left), left.hexes);
      const rightField = withHexes(this.fieldedForBattle(right), right.hexes);
      // RP 梗包「慢点吃，没人跟你抢」：本席位生效期间，对手内力回复变慢
      const slowLeft = this.foeManaSlow(left, round); const slowRight = this.foeManaSlow(right, round);
      if (slowRight) for (const c of leftField) c.tempStats = [...(c.tempStats ?? []), { stat: 'manaRegenPct', value: -slowRight, untilRound: round }];
      if (slowLeft) for (const c of rightField) c.tempStats = [...(c.tempStats ?? []), { stat: 'manaRegenPct', value: -slowLeft, untilRound: round }];
      const output = simulateBattle({
        battleId: `${room.id}-${round}-${match.left}-${match.right}`, seed: room.seed + round * 997 + match.left * 31 + match.right,
        left: leftField, right: rightField,
        playerHpLowest: { left: left.hp <= minLivingHp, right: right.hp <= minLivingHp },
        playerLevel: { left: left.level ?? START_LEVEL, right: right.level ?? START_LEVEL }
      });
      fights.push({ left: match.left, right: match.right, host: match.host, ghost: match.ghost, output });
      const damage = battleHpLoss(output, round, rules.lossDamageScale ?? 1);
      const apply = (index: number, team: 'left' | 'right') => {
        const seat = room.seats[index]!;
        const rawLoss = team === 'left' ? damage.left : damage.right;
        // RP 梗包「睡吧，我守着」：限时回合内不扣气血
        const loss = seat.noHpUntil !== undefined && room.round <= seat.noHpUntil ? 0 : rawLoss;
        losses[index] = loss; seat.hp = Math.max(0, seat.hp - loss);
        const outcome = output.outcome === 'draw' ? 'draw' : output.outcome === (team === 'left' ? 'left' : 'right') ? 'win' : 'loss';
        const bounty = settleLossBounty(seat.bounty, outcome, seat.hp); seat.bounty = bounty.state; seat.gold! += bounty.payout; payouts[index] = bounty.payout;
        // 连胜额外金币（连败的上涨仍由 loss-bounty 的赏金池负责）
        if (outcome === 'win' && seat.hp > 0) {
          seat.winStreak = (seat.winStreak ?? 0) + 1;
          const streakGold = winStreakGold(seat.winStreak);
          if (streakGold > 0) { seat.gold! += streakGold; payouts[index] += streakGold; }
        } else if (outcome !== 'draw') seat.winStreak = 0;
        // Settle gold produced by item triggers recorded in battle events.
        const gold = output.events.filter((event) => event.skillId === 'item-gold').reduce((sum, event) => sum + (event.value ?? 0), 0);
        if (gold > 0 && team === 'left') { seat.gold! += gold; payouts[index] += gold; }
      };
      apply(match.left, 'left');
      if (!match.ghost) apply(match.right, 'right');
      room.lastOpponent[match.left] = match.right;
      if (!match.ghost) room.lastOpponent[match.right] = match.left;
    }
    const livingHp = room.seats.map(seat => seat.hp).filter(hp => hp > 0).sort((a, b) => a - b);
    const median = livingHp[Math.floor(livingHp.length / 2)] ?? 0;
    room.seats.forEach((seat, index) => {
      const fight = fights.find(entry => !entry.ghost && (entry.left === index || entry.right === index)) ?? fights.find(entry => entry.left === index);
      const team = fight ? fight.left === index ? 'left' as const : 'right' as const : null;
      const won = team !== null && fight!.output.outcome !== 'draw' && fight!.output.outcome === team;
      const lost = fight ? fight.output.outcome === (fight.left === index ? 'right' : 'left') : false;
      seat.catchup = recordCatchup(seat.catchup, lost, seat.board.length, seat.capacity, seat.hp, median);
      // 监管（safety 合规税）：赢下交手便给对手随机棋子叠层
      if (won && fight && !fight.ghost) {
        const oppIndex = fight.left === index ? fight.right : fight.left;
        const opp = room.seats[oppIndex];
        if (opp && opp !== seat) this.applyManeuvers(room, seat, opp);
      }
      if (team) payouts[index] += this.settleHexEconomy(room, seat, index, fight!.output, team, won);
    });
    for (const [index, seat] of room.seats.entries()) {
      if (fights.some(f => !f.ghost && (f.left === index || f.right === index)) || fights.some(f => f.left === index)) this.resolveHazards(room, seat, 'roundEnd');
    }
    for (const seat of room.seats) {
      if (seat.hp <= 0) continue;
      this.settleHpTriggeredHexes(room, seat);
      this.settleRecurringHexGrants(room, seat, 'roundEnd');
    }
    const lines = fights.map(fight => {
      const a = room.seats[fight.left]!.name; const b = room.seats[fight.right]!.name;
      const result = fight.output.outcome === 'draw' ? '平局' : `${fight.output.outcome === 'left' ? a : b} 胜`;
      return fight.ghost ? `${a} 对阵 ${b}的棋盘 · ${result} · ${a} −${losses[fight.left]}` : `${a} vs ${b} · ${result}`;
    });
    room.battle = { round, output: fights[0]!.output, boards, benches, losses, payouts, fights };
    room.seats.forEach((seat, index) => {
      if (!seat.bot && beforeHp[index]! > 0 && seat.hp <= 0) {
        room.finalBattles ??= {}; room.finalBattles[index] = structuredClone(room.battle!);
      }
    });
    room.battleAt = Date.now();
    if (!room.memoryOnly && isPackId(room.pack)) {
      try { this.telemetry.recordBattle({ pack: room.pack, mode: room.mode!, battle: room.battle, botSeats: room.seats.map(seat => !!seat.bot), at: room.battleAt, source: room.telemetrySource ?? 'live' }); } catch { /* 下次落盘重试最近一轮。 */ }
    }
    room.log.push(`第 ${round} 轮：${lines.join('；')}`);
    this.assignResults(room, false, beforeHp); this.recordResults(room);
    if (this.maybeFinish(room)) return;
    room.round++; room.phase = 'prepare'; this.pairRound(room);
    const buffCfg = getGameConfig().buffs;
    const roundRarity = buffCfg.enabled ? rollRoundBuffRarity(room.seed, room.round, room.pack, buffCfg) : null;
    room.seats.forEach((seat, i) => {
      if (seat.hp <= 0) { seat.ready = true; return; }
      const seed = room.seed + i * 409;
      const interest = this.roundInterest(room, seat);
      seat.ready = false; seat.revision++; seat.gold! += rules.income + interest; this.payHexPayouts(seat, room.round);
      // 每轮自然获得经验（含运营 Buff 加成），等级决定人口
      let roundXpBonus = 0;
      for (const id of seat.hexes ?? []) roundXpBonus += findHex(id, room.pack)?.roundXpBonus ?? 0;
      const progress = addXp(seat.level ?? START_LEVEL, seat.xp ?? 0, xpPerRound() + roundXpBonus);
      seat.level = progress.level; seat.xp = progress.xp;
      this.recomputeCapacity(room, seat);
      if (seat.freeRefreshes) {
        if (room.round <= seat.freeRefreshes.until && seat.freeRefreshes.perRound > 0) seat.freeRefreshes.left = seat.freeRefreshes.perRound;
        else delete seat.freeRefreshes;
      }
      this.settleRecurringHexGrants(room, seat, 'roundStart');
      // 回合开始事件按棋谱包声明；战后事件在交手结束后结算。
      this.resolveHazards(room, seat);
      // 回合级限时效果
      this.applyRoundEffects(room, seat);
      const offer = makeCatchupShop(seed, round, [...seat.board, ...seat.bench!], seat.catchup, 0, this.roster(room), seat.level ?? START_LEVEL); seat.shop = offer.shop.map(u => u.id); seat.catchup = offer.state; seat.shopRefresh = 0;
      const soldOut = seat.roundHazards?.soldOut ?? [];
      if (soldOut.length) seat.shop = seat.shop.map((id) => (id && soldOut.includes(id) ? null : id));
      if (buffCfg.enabled) {
        delete seat.draft;
        if (roundRarity) {
          seat.hexOffer = drawSeatBuffOffer({
            seed: room.seed,
            seatIndex: i,
            round: room.round,
            packId: room.pack,
            rarity: roundRarity,
            ownedIds: seat.hexes ?? [],
            config: buffCfg,
          });
        } else {
          delete seat.hexOffer;
        }
        if (buffCfg.supplyRounds.includes(room.round) && !seat.itemOffer) {
          const family = supplyFamilyForRound(room.round);
          const boxes = openItemBoxes({
            grants: [{ family, options: 3, count: 1 }],
            loot: packItems(room.pack),
            rng: createRng(hash32(room.seed, room.round, 9401 + i)),
          });
          if (boxes.length) seat.itemOffer = { round: room.round, source: '旅途补给', family, boxes, boxIndex: 0 };
        }
      } else {
        const hexChoices = makeHexOffer(seed, room.round, seat.hexes ?? [], packHexes(room.pack), rules);
        if (hexChoices.length) seat.hexOffer = { round: room.round, rarity: hexPickRarity(room.round, rules)!, choices: hexChoices.map(compactHex) };
        else delete seat.hexOffer;
        if (shouldDraft(seed, round, seat.lastSkillRound ?? 0)) {
          const blocked = new Set(seat.uniqueRewards); if (seat.capacity >= 8) blocked.add('field-cap');
          const position = seat.draftPosition ?? 0;
          const original = makeDraftTrack(seed, round, blocked, skillDraftDue(round, seat.lastSkillRound ?? 0) ? position : undefined, this.roster(room), packItems(room.pack));
          const assisted = makeCatchupDraft(original, seed, round, position, [...seat.board, ...seat.bench!], seat.inventory!, seat.catchup, packItems(room.pack));
          seat.catchup = assisted.state; seat.draft = { round: room.round, sourceRound: round, track: assisted.track, position };
        }
      }
    });
    this.autoReadyBots(room);
    this.assignResults(room); this.recordResults(room);
    if (this.livingSeats(room).length <= rules.finishWhenLiving && this.maybeFinish(room)) return;
    if (this.livingSeats(room).every(seat => seat.bot && seat.ready)) this.battle(room);
  }
  async wait(credentials: RoomCredentials, after: number, ms = 25_000, signal?: AbortSignal) {
    if (signal?.aborted || this.view(credentials).revision > after) return this.view(credentials);
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); this.listeners.delete(check); signal?.removeEventListener('abort', finish); resolve(); };
      const check = () => {
        const room = this.rooms.get(credentials.roomId);
        if (!room || (room.platformCreate ? room.revision : this.load(credentials.roomId).revision) > after) finish();
      };
      const timer = setTimeout(finish, Math.min(25_000, Math.max(0, ms)));
      this.listeners.add(check);
      signal?.addEventListener('abort', finish, { once: true });
      check();
    });
    return this.view(credentials);
  }
}
