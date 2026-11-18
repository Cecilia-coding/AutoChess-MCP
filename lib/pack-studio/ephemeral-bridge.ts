import { z } from 'zod';
import type { AccountStore, PublicAccount } from '../accounts/account-store';
import {
  analyzeStudioPack,
  simulateStudioDuel,
  type StudioPackAnalysis,
} from './balance';
import {
  customPackSchema,
  studioItemSchema,
  studioTraitSchema,
  studioUnitSchema,
  validateCustomPack,
  type CustomPackV1,
  type StudioBuffFlavor,
  type StudioItemDef,
  type StudioTraitDef,
  type StudioUnitDef,
} from './schema';
import { STUDIO_SPRITES } from './sprites';
import { STAR_GROWTH_PRESETS, type StarGrowthPresetId } from './star-curves';
import {
  STUDIO_STARTER_OPTIONS,
  createPackFromStarter,
  type StudioStarterId,
} from './templates';

const MAX_STUDIO_SESSIONS = 64;
const SESSION_TTL_MS = 45 * 60 * 1000;
const MAX_HISTORY_ENTRIES = 16;
const MAX_RECEIPTS = 24;

export type StudioChangeLogEntry = {
  revision: number;
  at: number;
  actorId: string;
  actorName: string;
  actorIsAi: boolean;
  summary: string;
};

type StudioMemorySession = {
  ownerId: string;
  ownerName: string;
  revision: number;
  updatedAt: number;
  expiresAt: number;
  pack: CustomPackV1 | null;
  history: StudioChangeLogEntry[];
  receipts: Map<string, unknown>;
};

export type BrowserStudioSyncInput =
  | { mode: 'status' }
  | { mode: 'open'; pack: CustomPackV1 | null; summary?: string }
  | { mode: 'pull'; sinceRevision?: number }
  | { mode: 'push'; revision: number; pack: CustomPackV1 | null; summary?: string }
  | { mode: 'close' };

export type StudioPatchPayload = {
  title?: string;
  subtitle?: string;
  authorNote?: string;
  buffFlavor?: StudioBuffFlavor;
  terms?: CustomPackV1['terms'];
  starGrowth?: CustomPackV1['starGrowth'];
  upsertTraits?: StudioTraitDef[];
  removeTraitIds?: string[];
  upsertUnits?: StudioUnitDef[];
  removeUnitIds?: string[];
  upsertItems?: StudioItemDef[];
  removeItemIds?: string[];
  replacePack?: CustomPackV1;
};

export type StudioMcpCommand =
  | {
      action: 'init_from_template';
      revision: number;
      starterId: StudioStarterId;
      title: string;
      subtitle?: string;
      starGrowthPreset: StarGrowthPresetId;
      buffFlavor: StudioBuffFlavor;
      summary: string;
    }
  | {
      action: 'patch';
      revision: number;
      summary: string;
      patch: StudioPatchPayload;
    }
  | {
      action: 'duel';
      leftUnitId: string;
      leftStar: 1 | 2 | 3;
      leftItemIds?: string[];
      rightUnitId: string;
      rightStar: 1 | 2 | 3;
      rightItemIds?: string[];
      seed?: number;
    };

export const studioMcpCommandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('init_from_template'),
    revision: z.number().int().min(0),
    starterId: z.enum(['blank', 'compact-12', 'standard-20']),
    title: z.string().trim().min(1).max(32),
    subtitle: z.string().trim().max(100).optional(),
    starGrowthPreset: z.enum(['classic_180', 'high_cost_chase', 'compact_165', 'custom']),
    buffFlavor: z.enum(['tech', 'classic']),
    summary: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal('patch'),
    revision: z.number().int().min(0),
    summary: z.string().trim().min(1).max(100),
    patch: z.object({
      title: z.string().trim().min(1).max(32).optional(),
      subtitle: z.string().trim().max(100).optional(),
      authorNote: z.string().trim().max(240).optional(),
      buffFlavor: z.enum(['tech', 'classic']).optional(),
      terms: customPackSchema.shape.terms.optional(),
      starGrowth: customPackSchema.shape.starGrowth.optional(),
      upsertTraits: z.array(studioTraitSchema).max(24).optional(),
      removeTraitIds: z.array(z.string().min(1).max(48)).max(24).optional(),
      upsertUnits: z.array(studioUnitSchema).max(60).optional(),
      removeUnitIds: z.array(z.string().min(1).max(48)).max(60).optional(),
      upsertItems: z.array(studioItemSchema).max(48).optional(),
      removeItemIds: z.array(z.string().min(1).max(48)).max(48).optional(),
      replacePack: customPackSchema.optional(),
    }),
  }),
  z.object({
    action: z.literal('duel'),
    leftUnitId: z.string().min(1).max(48),
    leftStar: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    leftItemIds: z.array(z.string().min(1).max(48)).max(2).optional(),
    rightUnitId: z.string().min(1).max(48),
    rightStar: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    rightItemIds: z.array(z.string().min(1).max(48)).max(2).optional(),
    seed: z.number().int().min(1).max(0x7fffffff).optional(),
  }),
]);

function upsertById<T extends { id: string }>(
  list: readonly T[],
  upserts: readonly T[] | undefined,
  removeIds: readonly string[] | undefined,
): T[] {
  const removeSet = new Set(removeIds ?? []);
  const map = new Map<string, T>();
  for (const item of list) {
    if (!removeSet.has(item.id)) map.set(item.id, item);
  }
  for (const item of upserts ?? []) {
    if (!removeSet.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function summarizeReport(pack: CustomPackV1 | null): {
  validation: ReturnType<typeof validateCustomPack> | null;
  analysis: StudioPackAnalysis | null;
} {
  if (!pack) return { validation: null, analysis: null };
  const validation = validateCustomPack(pack);
  const analysis = analyzeStudioPack(pack);
  return {
    validation: { ...validation, pack: null },
    analysis,
  };
}

/**
 * 纯内存棋谱共创桥（严禁读写磁盘）：
 * 仅在人类于浏览器工坊显式开启「与绑定机内存共创」时暂存活动草稿，供已绑定机友经 MCP 协同设计。
 */
export class EphemeralStudioBridge {
  private sessions = new Map<string, StudioMemorySession>();

  constructor(private accounts: Pick<AccountStore, 'authenticate' | 'ownerIdOfAi'>) {}

  private pruneExpired(now = Date.now()) {
    for (const [ownerId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) this.sessions.delete(ownerId);
    }
  }

  private resolveActorAndOwner(token: unknown): { actor: PublicAccount; ownerId: string } {
    const actor = this.accounts.authenticate(token);
    if (!actor) throw new Error('登录态无效，请传入有效的 accountToken');
    const ownerId = actor.isAi ? this.accounts.ownerIdOfAi(actor.id) : actor.id;
    return { actor, ownerId };
  }

  private recordReceipt(session: StudioMemorySession, requestId: string, payload: unknown) {
    if (session.receipts.size >= MAX_RECEIPTS) {
      const oldest = session.receipts.keys().next().value;
      if (oldest) session.receipts.delete(oldest);
    }
    session.receipts.set(requestId, payload);
  }

  private pushHistory(session: StudioMemorySession, actor: PublicAccount, summary: string) {
    session.history.push({
      revision: session.revision,
      at: Date.now(),
      actorId: actor.id,
      actorName: actor.username,
      actorIsAi: actor.isAi,
      summary: summary.trim().slice(0, 100),
    });
    if (session.history.length > MAX_HISTORY_ENTRIES) {
      session.history.splice(0, session.history.length - MAX_HISTORY_ENTRIES);
    }
  }

  syncFromBrowser(token: unknown, input: BrowserStudioSyncInput) {
    this.pruneExpired();
    const { actor, ownerId } = this.resolveActorAndOwner(token);
    if (actor.isAi) throw new Error('仅人类棋谱工坊页面可开关或推拉本地内存桥');

    const now = Date.now();
    if (input.mode === 'close') {
      const existed = this.sessions.delete(ownerId);
      return { ok: true, active: false, closed: existed };
    }

    if (input.mode === 'status') {
      const session = this.sessions.get(ownerId);
      return {
        ok: true,
        active: Boolean(session),
        revision: session?.revision ?? 0,
        history: session?.history ?? [],
      };
    }

    if (input.mode === 'open') {
      let pack: CustomPackV1 | null = null;
      if (input.pack !== null) {
        const parsed = customPackSchema.safeParse(input.pack);
        if (!parsed.success) {
          throw new Error(`棋谱结构无效：${parsed.error.issues[0]?.message ?? '格式错误'}`);
        }
        pack = parsed.data;
      }
      if (!this.sessions.has(ownerId) && this.sessions.size >= MAX_STUDIO_SESSIONS) {
        const oldestKey = this.sessions.keys().next().value;
        if (oldestKey) this.sessions.delete(oldestKey);
      }
      const existing = this.sessions.get(ownerId);
      const session: StudioMemorySession = {
        ownerId,
        ownerName: actor.username,
        revision: (existing?.revision ?? 0) + 1,
        updatedAt: now,
        expiresAt: now + SESSION_TTL_MS,
        pack,
        history: existing ? [...existing.history] : [],
        receipts: new Map(),
      };
      this.pushHistory(session, actor, input.summary || (pack ? `开启共创并载入「${pack.title}」` : '开启共创（尚未选择起步模板）'));
      this.sessions.set(ownerId, session);
      return {
        ok: true,
        active: true,
        revision: session.revision,
        expiresAt: session.expiresAt,
        pack: session.pack,
        history: session.history,
      };
    }

    const session = this.sessions.get(ownerId);
    if (!session) {
      return { ok: true, active: false, revision: 0, pack: null, history: [] };
    }
    session.expiresAt = now + SESSION_TTL_MS;

    if (input.mode === 'pull') {
      const unchanged = input.sinceRevision !== undefined && input.sinceRevision === session.revision;
      return {
        ok: true,
        active: true,
        revision: session.revision,
        expiresAt: session.expiresAt,
        ...(unchanged ? { unchanged: true } : { pack: session.pack }),
        history: session.history,
      };
    }

    // mode === 'push'
    if (input.revision !== session.revision) {
      return {
        ok: false,
        conflict: true,
        active: true,
        revision: session.revision,
        pack: session.pack,
        history: session.history,
      };
    }
    let nextPack: CustomPackV1 | null = null;
    if (input.pack !== null) {
      const parsed = customPackSchema.safeParse(input.pack);
      if (!parsed.success) {
        throw new Error(`棋谱结构无效：${parsed.error.issues[0]?.message ?? '格式错误'}`);
      }
      nextPack = parsed.data;
    }
    session.pack = nextPack;
    session.revision += 1;
    session.updatedAt = now;
    this.pushHistory(session, actor, input.summary || '玩家在界面调整了棋谱');
    return {
      ok: true,
      active: true,
      revision: session.revision,
      expiresAt: session.expiresAt,
      pack: session.pack,
      history: session.history,
    };
  }

  readForMcp(token: unknown) {
    this.pruneExpired();
    const { ownerId } = this.resolveActorAndOwner(token);
    const session = this.sessions.get(ownerId);
    if (!session) {
      return {
        active: false,
        note: '人类棋友尚未在网页端「工坊」开启内存共创开关。请先提醒对方打开「工坊 → 开启与绑定机内存共创」。本工坊完全不落地服务端文件，草稿仅在开启期间驻留内存。',
      };
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    const { validation, analysis } = summarizeReport(session.pack);
    return {
      active: true,
      ownerName: session.ownerName,
      revision: session.revision,
      expiresAt: session.expiresAt,
      storagePolicy: 'memory-only（人类浏览器本地保存/导出，服务端不存档）',
      pack: session.pack,
      validation,
      analysis,
      history: session.history,
      catalogs: {
        starters: STUDIO_STARTER_OPTIONS,
        starGrowthPresets: STAR_GROWTH_PRESETS.map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.subtitle,
        })),
        buffFlavors: [
          { id: 'tech', label: '算力科技词条' },
          { id: 'classic', label: '奇谭古风词条' },
        ],
        sprites: STUDIO_SPRITES.map((s) => ({
          id: s.id,
          name: s.label,
          style: s.style,
          suggestedRole: s.suggestedRole,
        })),
      },
      guide: {
        init: '当 pack=null 或要切换全新模板时，调用 init_from_template 并显式传入 starterId、starGrowthPreset、buffFlavor 与 title（严禁省略选择）。',
        patch: '修改棋谱用 patch，传入当前 revision、summary 与 upsertUnits/upsertTraits/upsertItems 等增量字段；棋子面板会自动被数值分析器评估 EHP/DPS/Budget%。',
        duel: '测桩对比两枚棋子强度与 TTK 用 duel，不改动草稿也无需 revision。',
      },
    };
  }

  actForMcp(token: unknown, rawCommand: unknown, requestId?: string) {
    this.pruneExpired();
    const { actor, ownerId } = this.resolveActorAndOwner(token);
    const session = this.sessions.get(ownerId);
    if (!session) {
      throw new Error('共创会话未开启或已过期，请人类棋友在「工坊」重新开启「与绑定机内存共创」');
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;

    if (requestId && session.receipts.has(requestId)) {
      return session.receipts.get(requestId);
    }

    const parsedCmd = studioMcpCommandSchema.safeParse(rawCommand);
    if (!parsedCmd.success) {
      throw new Error(`工坊指令格式错误：${parsedCmd.error.issues[0]?.message ?? '参数不合法'}`);
    }
    const cmd = parsedCmd.data;

    if (cmd.action === 'duel') {
      if (!session.pack) throw new Error('当前尚无棋谱草稿，无法运行 1v1 测桩');
      const duel = simulateStudioDuel(session.pack, {
        leftUnitId: cmd.leftUnitId,
        leftStar: cmd.leftStar,
        leftItemIds: cmd.leftItemIds,
        rightUnitId: cmd.rightUnitId,
        rightStar: cmd.rightStar,
        rightItemIds: cmd.rightItemIds,
        seed: cmd.seed,
      });
      return { ok: true, action: 'duel', revision: session.revision, duel };
    }

    if (cmd.revision !== session.revision) {
      throw new Error(
        `棋谱版本已更新（传入 revision=${cmd.revision}，当前 revision=${session.revision}），请先 read_turn(studio=true) 获取最新草稿`,
      );
    }

    let nextPack: CustomPackV1;
    if (cmd.action === 'init_from_template') {
      const localId = `pack-${Date.now().toString(36)}`;
      nextPack = createPackFromStarter({
        starterId: cmd.starterId,
        id: localId,
        title: cmd.title,
        subtitle: cmd.subtitle,
        starGrowthPreset: cmd.starGrowthPreset,
        buffFlavor: cmd.buffFlavor,
      });
    } else {
      const p = cmd.patch;
      if (p.replacePack) {
        nextPack = p.replacePack;
      } else {
        if (!session.pack) {
          throw new Error('当前还没有基础棋谱草稿，请先调用 init_from_template 显式选择起步方式');
        }
        nextPack = {
          ...session.pack,
          ...(p.title !== undefined ? { title: p.title } : {}),
          ...(p.subtitle !== undefined ? { subtitle: p.subtitle } : {}),
          ...(p.authorNote !== undefined ? { authorNote: p.authorNote } : {}),
          ...(p.buffFlavor !== undefined ? { buffFlavor: p.buffFlavor } : {}),
          ...(p.terms !== undefined ? { terms: p.terms } : {}),
          ...(p.starGrowth !== undefined ? { starGrowth: p.starGrowth } : {}),
          traits: upsertById(session.pack.traits, p.upsertTraits, p.removeTraitIds),
          units: upsertById(session.pack.units, p.upsertUnits, p.removeUnitIds),
          items: upsertById(session.pack.items, p.upsertItems, p.removeItemIds),
        };
      }
    }

    const validation = validateCustomPack(nextPack);
    if (!validation.validSchema || !validation.pack) {
      throw new Error(`棋谱校验未通过：${validation.errors.join('；')}`);
    }

    session.pack = validation.pack;
    session.revision += 1;
    session.updatedAt = Date.now();
    this.pushHistory(session, actor, cmd.summary);

    const analysis = analyzeStudioPack(session.pack);
    const reply = {
      ok: true,
      revision: session.revision,
      summary: cmd.summary,
      playable: validation.playable,
      playBlockers: validation.playBlockers,
      warnings: validation.warnings,
      analysisSummary: {
        unitCount: analysis.unitCount,
        factionCount: analysis.factionCount,
        jobCount: analysis.jobCount,
        emptyMatrixCells: analysis.emptyMatrixCells,
        outliers: analysis.outliers,
        systemNotes: analysis.systemNotes,
      },
      history: session.history.slice(-5),
    };
    if (requestId) this.recordReceipt(session, requestId, reply);
    return reply;
  }

  activeSessionCount(): number {
    this.pruneExpired();
    return this.sessions.size;
  }
}

