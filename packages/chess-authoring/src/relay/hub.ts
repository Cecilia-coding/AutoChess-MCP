import { randomUUID, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import {
  summarySchema,
  envelopeSchema,
  type RelaySummary,
  type RelayEnvelope,
} from "./protocol.js";
export class RelayError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
type Receipt = {
  requestId: string;
  status: "queued" | "applied" | "rejected";
  error?: string;
  revision?: number;
};
type Session = {
  id: string;
  ownerKey: string;
  machineKey: string;
  state: RelaySummary;
  seenAt: number;
  pending?: RelayEnvelope;
  receipts: Map<string, { encoded: string; receipt: Receipt }>;
  notify?: () => void;
};
export type RelayOptions = { ttlMs: number; maxSessions: number; maxBytes: number; pollMs: number };
export const relayDefaults: RelayOptions = {
  ttlMs: 120000,
  maxSessions: 64,
  maxBytes: 32768,
  pollMs: 20000,
};
export class RelayHub {
  private sessions = new Map<string, Session>();
  constructor(
    readonly options: RelayOptions = relayDefaults,
    private now = () => Date.now(),
  ) {}
  private equal(a: string, b: string) {
    const left = Buffer.from(a),
      right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
  sweep() {
    for (const [id, session] of this.sessions)
      if (this.now() - session.seenAt > this.options.ttlMs) {
        session.notify?.();
        this.sessions.delete(id);
      }
  }
  get size() {
    this.sweep();
    return this.sessions.size;
  }
  private get(id: string, key: string, owner: boolean) {
    this.sweep();
    const session = this.sessions.get(id);
    if (!session || !this.equal(key, owner ? session.ownerKey : session.machineKey))
      throw new RelayError(
        404,
        "session_unavailable",
        "连接已关闭、过期或凭据不匹配，请在网页重新开启接力。",
      );
    return session;
  }
  private summary(input: unknown) {
    if (Buffer.byteLength(JSON.stringify(input) ?? "") > this.options.maxBytes)
      throw new RelayError(413, "summary_too_large", "临时局面超过中转容量，请减少展开内容。");
    const parsed = summarySchema.safeParse(input);
    if (!parsed.success)
      throw new RelayError(
        422,
        "invalid_summary",
        "中转只接受当前局面摘要，不接受完整棋谱或存档。",
      );
    return parsed.data;
  }
  create(input: unknown) {
    this.sweep();
    if (this.sessions.size >= this.options.maxSessions)
      throw new RelayError(429, "relay_full", "接力连接已满，请稍后再试。本地创作和试下仍可使用。");
    const state = this.summary(input);
    const session: Session = {
      id: randomUUID(),
      ownerKey: randomBytes(32).toString("base64url"),
      machineKey: randomBytes(32).toString("base64url"),
      state,
      seenAt: this.now(),
      receipts: new Map(),
    };
    this.sessions.set(session.id, session);
    return {
      sessionId: session.id,
      ownerKey: session.ownerKey,
      accessKey: session.machineKey,
      expiresAfterMs: this.options.ttlMs,
    };
  }
  read(id: string, key: string) {
    const session = this.get(id, key, false);
    return {
      sessionId: id,
      state: session.state,
      pending: session.pending?.requestId,
      receipts: [...session.receipts.values()].map((entry) => entry.receipt),
      expiresInMs: Math.max(0, this.options.ttlMs - (this.now() - session.seenAt)),
    };
  }
  publish(id: string, key: string, input: unknown, ack?: { requestId: string; error?: string }) {
    const session = this.get(id, key, true);
    const state = this.summary(input);
    if (
      ack &&
      (typeof ack.requestId !== "string" ||
        (ack.error !== undefined && typeof ack.error !== "string"))
    )
      throw new RelayError(422, "invalid_ack", "指令回执格式有误。");
    if (ack && session.pending?.requestId !== ack.requestId)
      throw new RelayError(409, "unknown_command", "待执行指令已变更，请重新读取连接。");
    session.state = state;
    session.seenAt = this.now();
    if (ack) {
      const previous = session.receipts.get(ack.requestId)!;
      previous.receipt = {
        requestId: ack.requestId,
        status: ack.error ? "rejected" : "applied",
        ...(ack.error ? { error: ack.error.slice(0, 500) } : {}),
        revision: state.revision,
      };
      session.pending = undefined;
    }
    return { ok: true };
  }
  submit(id: string, key: string, input: unknown) {
    const session = this.get(id, key, false);
    if (Buffer.byteLength(JSON.stringify(input) ?? "") > this.options.maxBytes)
      throw new RelayError(413, "command_too_large", "指令过大，请逐枚修改棋子。");
    const parsed = envelopeSchema.safeParse(input);
    if (!parsed.success)
      throw new RelayError(422, "invalid_command", "指令格式有误，请按 MCP 工具格式逐项操作。");
    const command = parsed.data;
    const encoded = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    const previous = session.receipts.get(command.requestId);
    if (previous) {
      if (previous.encoded !== encoded)
        throw new RelayError(409, "request_id_reused", "同一 requestId 只能重试原指令。");
      return previous.receipt;
    }
    if (session.pending)
      throw new RelayError(409, "command_pending", "上一条指令尚未由网页执行，请先读取状态。");
    if (command.expectedRevision !== session.state.revision)
      throw new RelayError(409, "revision_conflict", "局面已更新，请先读取当前修订。");
    const receipt: Receipt = { requestId: command.requestId, status: "queued" };
    session.receipts.set(command.requestId, { encoded, receipt });
    while (session.receipts.size > 8)
      session.receipts.delete(session.receipts.keys().next().value!);
    session.pending = command;
    session.notify?.();
    return receipt;
  }
  async poll(id: string, key: string, signal?: AbortSignal) {
    const session = this.get(id, key, true);
    session.seenAt = this.now();
    if (!session.pending && !signal?.aborted)
      await new Promise<void>((resolve) => {
        session.notify?.();
        let timer: ReturnType<typeof setTimeout>;
        const done = () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", done);
          if (session.notify === done) session.notify = undefined;
          resolve();
        };
        timer = setTimeout(done, this.options.pollMs);
        session.notify = done;
        signal?.addEventListener("abort", done, { once: true });
      });
    if (!this.sessions.has(id)) return { closed: true };
    return { command: session.pending ?? null };
  }
  close(id: string, key: string) {
    const session = this.get(id, key, true);
    session.notify?.();
    this.sessions.delete(id);
    return { ok: true };
  }
  clear() {
    for (const session of this.sessions.values()) session.notify?.();
    this.sessions.clear();
  }
}
