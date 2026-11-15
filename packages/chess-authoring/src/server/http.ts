import express, { type ErrorRequestHandler } from "express";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authoringGuide } from "../core/guide.js";
import { RelayHub, RelayError } from "../relay/hub.js";
import { createAuthoringMcp } from "./mcp.js";

export type HttpOptions = { basePath: string; publicOrigin?: string; bodyLimit?: string };
export function createAuthoringApp(hub: RelayHub, options: HttpOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.enable("strict routing");
  const router = express.Router();
  router.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
    });
    if (
      req.headers.origin &&
      req.headers.origin !== (options.publicOrigin || `${req.protocol}://${req.get("host")}`)
    ) {
      res.status(403).json({ error: { code: "origin_rejected", message: "请从工坊入口访问。" } });
      return;
    }
    next();
  });
  router.use(express.json({ limit: options.bodyLimit ?? "40kb" }));
  const key = (req: express.Request) =>
    /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1] ?? "";
  const guide = authoringGuide();
  router.get("/health", (_req, res) =>
    res.json({
      ok: true,
      service: "autochess-authoring",
      stage: "local_execution",
      persistence: "none",
      relaySessions: hub.size,
    }),
  );
  router.get("/api/guide", (_req, res) => res.json(guide));
  router.get("/api/schema", (_req, res) => res.json(guide.schema));
  // Old cloud-persistence routes are explicitly retired; no body is written to disk.
  router.all(
    [
      "/api/drafts",
      "/api/drafts/{*rest}",
      "/api/matches",
      "/api/matches/{*rest}",
      "/api/preview",
      "/api/starter",
    ],
    (_req, res) =>
      res
        .status(410)
        .json({
          error: { code: "local_only", message: "棋谱、存档与战斗已移到玩家设备，请刷新工坊。" },
        }),
  );
  router.post("/api/relay", (req, res) => res.status(201).json(hub.create(req.body?.state)));
  router.post("/api/relay/:id/state", (req, res) =>
    res.json(hub.publish(req.params.id, key(req), req.body?.state, req.body?.ack)),
  );
  router.get("/api/relay/:id/commands", async (req, res) => {
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const value = await hub.poll(req.params.id, key(req), abort.signal);
    if (!res.destroyed) res.json(value);
  });
  router.delete("/api/relay/:id", (req, res) => res.json(hub.close(req.params.id, key(req))));
  router.post("/mcp", async (req, res) => {
    const server = createAuthoringMcp(hub);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent)
        res
          .status(500)
          .json({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: "MCP 接力失败，请重试。" },
          });
    }
  });
  router.all("/mcp", (_req, res) =>
    res.status(405).set("Allow", "POST").json({ error: "Use POST" }),
  );
  router.use(
    express.static(fileURLToPath(new URL("../../web/", import.meta.url)), { index: "index.html" }),
  );
  const prefix = options.basePath.replace(/\/$/, "");
  if (prefix) app.get(prefix, (_req, res) => res.redirect(302, `${prefix}/`));
  app.use(prefix || "/", router);
  app.use((_req, res) =>
    res.status(404).json({ error: { code: "not_found", message: "入口不存在。" } }),
  );
  const error: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof RelayError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const code =
      error?.type === "entity.too.large"
        ? "request_too_large"
        : error?.type === "entity.parse.failed"
          ? "invalid_json"
          : "internal_error";
    res
      .status(code === "request_too_large" ? 413 : code === "invalid_json" ? 400 : 500)
      .json({
        error: {
          code,
          message:
            code === "request_too_large"
              ? "中转请求过大，请只发送当前局面。"
              : code === "invalid_json"
                ? "JSON 格式有误。"
                : "接力暂时不可用，本机内容仍然保留。",
        },
      });
  };
  app.use(error);
  return app;
}
