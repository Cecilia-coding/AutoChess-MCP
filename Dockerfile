FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/lib ./lib
COPY --from=build /app/content ./content
COPY --from=build /app/packs ./packs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./
RUN mkdir -p /data/accounts /data/rooms && chown -R node:node /data
ENV NODE_ENV=production CHESS_DISABLE_CURSOR=1 CHESS_ROOM_DATA=/data/rooms CHESS_ACCOUNT_DATA=/data/accounts CHESS_GATEWAY_HOST=0.0.0.0
EXPOSE 8792
USER node
# Required at runtime: -e CHESS_PUBLIC_ORIGIN=<browser-visible-origin>
CMD ["sh", "-eu", "-c", "case \"${CHESS_PUBLIC_ORIGIN:-}\" in *[![:space:]]*) ;; *) echo 'CHESS_PUBLIC_ORIGIN is required for the public gateway' >&2; exit 64;; esac; exec node scripts/chess-cloud.mjs"]
