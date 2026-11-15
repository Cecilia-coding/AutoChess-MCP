import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { RelayHub, relayDefaults } from "../src/relay/hub.js";
import { createAuthoringApp } from "../src/server/http.js";

const state = (revision = 0) => ({
  phase: "editor" as const,
  revision,
  title: "本机私有棋谱",
  unitCount: 200,
});
const command = (requestId = "request-0001", expectedRevision = 0) => ({
  requestId,
  expectedRevision,
  command: { kind: "edit", action: { type: "metadata", name: "改名" } },
});
test("relay expires idle sessions, polling by machine cannot extend lifetime, and capacity is reclaimed", () => {
  let now = 0;
  const hub = new RelayHub({ ...relayDefaults, ttlMs: 100, maxSessions: 2 }, () => now);
  const a = hub.create(state()),
    b = hub.create(state());
  assert.equal(hub.size, 2);
  assert.throws(() => hub.create(state()), /已满/);
  now = 99;
  assert.equal(hub.read(a.sessionId, a.accessKey).expiresInMs, 1);
  now = 101;
  assert.equal(hub.size, 0);
  assert.throws(() => hub.read(a.sessionId, a.accessKey), /过期/);
  assert.doesNotThrow(() => hub.create(state()));
  assert.ok(b.sessionId);
});
test("strict small projection rejects a whole pack, oversized state and unauthorized updates", () => {
  const hub = new RelayHub({ ...relayDefaults, maxBytes: 500 });
  assert.throws(() => hub.create({ ...state(), pack: { units: [] } }), /完整棋谱/);
  assert.throws(() => hub.create({ ...state(), title: "x".repeat(1000) }), /容量/);
  const session = hub.create(state());
  assert.throws(() => hub.publish(session.sessionId, session.accessKey, state(1)), /凭据/);
  assert.throws(() => hub.read(session.sessionId, session.ownerKey), /凭据/);
  assert.equal(hub.read(session.sessionId, session.accessKey).state.revision, 0);
});
test("one pending command, optimistic revision, retry receipts and bounded history", async () => {
  const hub = new RelayHub({ ...relayDefaults, pollMs: 1 });
  const s = hub.create(state());
  assert.equal(hub.submit(s.sessionId, s.accessKey, command()).status, "queued");
  assert.throws(() => hub.submit(s.sessionId, s.accessKey, command("request-0002")), /上一条/);
  assert.deepEqual((await hub.poll(s.sessionId, s.ownerKey)).command, command());
  assert.throws(
    () =>
      hub.publish(s.sessionId, s.ownerKey, state(1), {
        requestId: "request-0001",
        error: 42 as unknown as string,
      }),
    /回执格式/,
  );
  assert.equal(hub.read(s.sessionId, s.accessKey).state.revision, 0);
  hub.publish(s.sessionId, s.ownerKey, state(1), { requestId: "request-0001" });
  assert.equal(hub.submit(s.sessionId, s.accessKey, command()).status, "applied");
  assert.throws(() => hub.submit(s.sessionId, s.accessKey, command("request-0002", 0)), /修订/);
  assert.throws(
    () => hub.submit(s.sessionId, s.accessKey, command("request-0001", 1)),
    /requestId/,
  );
  for (let revision = 1; revision <= 20; revision++) {
    const requestId = `request-${revision + 10}`;
    hub.submit(s.sessionId, s.accessKey, command(requestId, revision));
    hub.publish(s.sessionId, s.ownerKey, state(revision + 1), { requestId });
  }
  const read = hub.read(s.sessionId, s.accessKey);
  assert.equal(read.receipts.length, 8);
  assert.equal(read.pending, undefined);
  hub.close(s.sessionId, s.ownerKey);
  assert.equal(hub.size, 0);
});
test("long poll wakes for command and closes cleanly, new service has no persisted sessions", async () => {
  const hub = new RelayHub({ ...relayDefaults, pollMs: 1000 });
  const s = hub.create(state());
  const waiting = hub.poll(s.sessionId, s.ownerKey);
  hub.submit(s.sessionId, s.accessKey, command());
  assert.ok((await waiting).command);
  hub.publish(s.sessionId, s.ownerKey, state(1), { requestId: "request-0001" });
  const second = hub.poll(s.sessionId, s.ownerKey);
  hub.clear();
  assert.equal((await second).closed, true);
  assert.equal(new RelayHub().size, 0);
});
test("real HTTP browser-owner plus cloud MCP can edit; retired upload routes reject and malformed bodies recover", async (t) => {
  const hub = new RelayHub({ ...relayDefaults, pollMs: 20 });
  const server = createAuthoringApp(hub, { basePath: "/portable" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    hub.clear();
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/portable/`;
  const client = new Client({ name: "relay-black-box", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL("mcp", base)));
  t.after(() => client.close());
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  assert.deepEqual(tools, ["get_authoring_guide", "read_chess_session", "command_chess_session"]);
  const created = await fetch(`${base}api/relay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: state() }),
  });
  assert.equal(created.status, 201);
  const s = await created.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${s.ownerKey}` };
  const submitted = await client.callTool({
    name: "command_chess_session",
    arguments: { sessionId: s.sessionId, accessKey: s.accessKey, ...command() },
  });
  assert.ok(!submitted.isError);
  const polled = await fetch(`${base}api/relay/${s.sessionId}/commands`, { headers });
  assert.equal((await polled.json()).command.command.action.name, "改名");
  const ack = await fetch(`${base}api/relay/${s.sessionId}/state`, {
    method: "POST",
    headers,
    body: JSON.stringify({ state: state(1), ack: { requestId: "request-0001" } }),
  });
  assert.equal(ack.status, 200);
  const read = await client.callTool({
    name: "read_chess_session",
    arguments: { sessionId: s.sessionId, accessKey: s.accessKey },
  });
  const output = read.structuredContent as {
    state: { revision: number };
    receipts: { status: string }[];
  };
  assert.equal(output.state.revision, 1);
  assert.equal(output.receipts[0].status, "applied");
  for (const path of ["api/drafts", "api/matches", "api/preview", "api/starter"]) {
    const response = await fetch(base + path, {
      method: "POST",
      headers,
      body: JSON.stringify({ pack: { name: "不得保存" } }),
    });
    assert.equal(response.status, 410);
  }
  const oversized = await fetch(`${base}api/relay`, {
    method: "POST",
    headers,
    body: JSON.stringify({ state: { ...state(), name: "x".repeat(50000) } }),
  });
  assert.equal(oversized.status, 413);
  const malformed = await fetch(`${base}api/relay`, { method: "POST", headers, body: "{" });
  assert.equal(malformed.status, 400);
  assert.equal((await fetch(base + "health")).status, 200);
});
