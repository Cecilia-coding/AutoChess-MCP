import { createAuthoringApp } from "./http.js";
import { RelayHub, relayDefaults } from "../relay/hub.js";
const positive = (key: string, fallback: number) => {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${key}`);
  return value;
};
const port = positive("AUTHORING_PORT", 8796);
if (port > 65535) throw new Error("Invalid AUTHORING_PORT");
const basePath = process.env.AUTHORING_BASE_PATH ?? "/autochess-lab";
if (!/^\/[a-zA-Z0-9/_-]*$/.test(basePath)) throw new Error("Invalid AUTHORING_BASE_PATH");
const hub = new RelayHub({
  ...relayDefaults,
  ttlMs: positive("AUTHORING_RELAY_TTL_MS", relayDefaults.ttlMs),
  maxSessions: positive("AUTHORING_RELAY_MAX_SESSIONS", relayDefaults.maxSessions),
  maxBytes: positive("AUTHORING_RELAY_MAX_BYTES", relayDefaults.maxBytes),
});
const cleanup = setInterval(() => hub.sweep(), 30000);
cleanup.unref();
const app = createAuthoringApp(hub, {
  basePath,
  publicOrigin: process.env.AUTHORING_PUBLIC_ORIGIN,
  bodyLimit: process.env.AUTHORING_BODY_LIMIT,
});
const server = app.listen(port, process.env.AUTHORING_HOST ?? "127.0.0.1", () =>
  console.log(`Local-first workshop listening on ${port}${basePath}/`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(cleanup);
    hub.clear();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
