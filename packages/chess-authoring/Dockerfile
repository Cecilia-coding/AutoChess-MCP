FROM node:22-bookworm-slim AS build
ARG AUTHORING_SOURCE=chess-authoring
WORKDIR /chess-engine
COPY chess-engine/package.json chess-engine/package-lock.json ./
RUN npm ci --ignore-scripts
COPY chess-engine/tsconfig.json ./
COPY chess-engine/src ./src
RUN npm run build
WORKDIR /app
COPY ${AUTHORING_SOURCE}/package.json ${AUTHORING_SOURCE}/package-lock.json ./
RUN npm ci --ignore-scripts
COPY ${AUTHORING_SOURCE}/tsconfig.json ./
COPY ${AUTHORING_SOURCE}/src ./src
COPY ${AUTHORING_SOURCE}/test ./test
COPY ${AUTHORING_SOURCE}/scripts ./scripts
COPY ${AUTHORING_SOURCE}/web ./web
RUN npm run build && npm test

FROM node:22-bookworm-slim
ARG AUTHORING_SOURCE=chess-authoring
WORKDIR /app
ENV NODE_ENV=production AUTHORING_HOST=0.0.0.0 AUTHORING_PORT=8796
COPY --from=build /chess-engine/package.json /chess-engine/package.json
COPY --from=build /chess-engine/dist /chess-engine/dist
COPY ${AUTHORING_SOURCE}/package.json ${AUTHORING_SOURCE}/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/web ./web
USER node
EXPOSE 8796
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8796'+(process.env.AUTHORING_BASE_PATH||'/autochess-lab')+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server/main.js"]
