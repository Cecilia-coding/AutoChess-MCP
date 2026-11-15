import { build } from "esbuild";
await build({
  entryPoints: ["src/browser/worker.ts"],
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  outfile: "web/runtime.js",
  minify: true,
  legalComments: "none",
});
