import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(root, "dist");
if (dirname(dist) !== resolve(root)) throw new Error("Invalid generated output path");
rmSync(dist, { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [fileURLToPath(import.meta.resolve("typescript/bin/tsc")), "-p", "tsconfig.json"],
  { cwd: root, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await import("./build-web.mjs");
