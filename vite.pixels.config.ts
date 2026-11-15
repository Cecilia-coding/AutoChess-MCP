import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  define: { "process.env.CHESS_RP": '"0"', "process.env.CHESS_PACK": '"ai"' },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 18903, strictPort: true, open: "/dev/pixels.html" },
});
