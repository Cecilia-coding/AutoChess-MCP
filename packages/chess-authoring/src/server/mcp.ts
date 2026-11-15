import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RelayHub, RelayError } from "../relay/hub.js";
import { envelopeSchema } from "../relay/protocol.js";
import { authoringGuide } from "../core/guide.js";
export function createAuthoringMcp(hub: RelayHub) {
  const server = new McpServer({ name: "autochess-authoring", version: "0.2.0" });
  const auth = { sessionId: z.string().uuid(), accessKey: z.string().min(1) };
  const output = (fn: () => unknown) => {
    try {
      const value = fn() as Record<string, unknown>;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
        structuredContent: value,
      };
    } catch (error) {
      const value = {
        error: {
          code: error instanceof RelayError ? error.code : "internal_error",
          message: error instanceof Error ? error.message : "接力失败",
        },
      };
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
        structuredContent: value,
      };
    }
  };
  server.registerTool(
    "get_authoring_guide",
    {
      description:
        "读取棋谱契约和模板。棋谱、存档和战斗运行在玩家浏览器；请让玩家开启云端接力并提供 sessionId/accessKey。",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => output(authoringGuide),
  );
  server.registerTool(
    "read_chess_session",
    {
      description:
        "读取当前编辑棋子或对局摘要，以及最近指令执行回执。网页必须保持打开；完整棋谱与存档留在玩家设备。",
      inputSchema: auth,
      annotations: { readOnlyHint: true },
    },
    async ({ sessionId, accessKey }) => output(() => hub.read(sessionId, accessKey)),
  );
  server.registerTool(
    "command_chess_session",
    {
      description:
        "逐项创作或下棋：kind=edit 可 prepare/metadata/growth/put_unit/remove_unit/select_unit/catalog_page；kind=start_trial 开局；kind=play 执行 buy/sell/move/refresh/upgrade/ready；kind=inspect_unit 查看一枚棋子。提交后返回 queued，须用 read_chess_session 等待 applied/rejected。旧修订会冲突，重试复用 requestId。服务器仅临时中转，实际操作由网页执行。",
      inputSchema: { ...auth, ...envelopeSchema.shape },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ sessionId, accessKey, ...input }) =>
      output(() => hub.submit(sessionId, accessKey, input)),
  );
  return server;
}
