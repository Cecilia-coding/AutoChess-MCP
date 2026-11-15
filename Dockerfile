FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Build, then drop build-only / unused packages so the flattened runtime image stays small
# (vps4 imports releases as a flattened filesystem; keep the footprint lean).
RUN npm run build && rm -rf \
  node_modules/@rolldown/binding-*-musl \
  node_modules/three/examples \
  node_modules/three/src \
  node_modules/typescript \
  node_modules/@types \
  node_modules/oxlint* \
  node_modules/@oxlint* \
  node_modules/oxfmt* \
  node_modules/@oxfmt* \
  node_modules/@img/sharp-wasm32 \
  node_modules/@tailwindcss \
  node_modules/tailwindcss \
  node_modules/terser \
  node_modules/webpack \
  node_modules/lucide-react \
  node_modules/@vercel/og \
  node_modules/satori \
  node_modules/@resvg \
  node_modules/harfbuzzjs \
  node_modules/@shuding

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/lib ./lib
COPY --from=build /app/content ./content
COPY --from=build /app/packs ./packs
COPY --from=build /app/packages/chess-engine ./packages/chess-engine
COPY --from=build /app/.generated/presentation-source/ ./
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  && mkdir -p /data/accounts /data/rooms && chown -R node:node /data
ENV NODE_ENV=production CHESS_DISABLE_CURSOR=1 CHESS_COSMETICS_SANDBOX=1 CHESS_ROOM_DATA=/data/rooms CHESS_ACCOUNT_DATA=/data/accounts CHESS_GATEWAY_HOST=0.0.0.0
EXPOSE 8792
USER node
# Required at runtime: -e CHESS_PUBLIC_ORIGIN=<browser-visible-origin>
CMD ["sh", "-eu", "-c", "case \"${CHESS_PUBLIC_ORIGIN:-}\" in *[![:space:]]*) ;; *) echo 'CHESS_PUBLIC_ORIGIN is required for the public gateway' >&2; exit 64;; esac; exec node scripts/chess-cloud.mjs"]
