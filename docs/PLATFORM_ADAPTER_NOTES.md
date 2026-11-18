# AutoChess 宿主平台适配与前端集成指南

本文档面向 **CEDAR TOY** 及后续需要嵌入 / 接入 AutoChess MCP 的宿主平台，说明前端挂载、账号存储与事务桥接、房间生命周期、环境变量、游乐摊与对称互赠，以及 **Pixel-2D E2E 稳定选择器**。

> 服务端 HTTP 卫星认证与 `X-Player-Id` 接入契约仍以 [CEDARTOY_ADAPTER.md](./CEDARTOY_ADAPTER.md) 为准，本文补充本轮上游化后的前后端适配点。
> 3D 棋盘视图不再作为宿主适配目标，主 UI 统一收敛到 `pixel-2d`。

### 当前适配版本矩阵

| 组件 / 契约 | 版本标识 | 说明 |
|---|---|---|
| 前端宿主上下文（`AutochessHostProvider`） | `AUTOCHESS_HOST_ADAPTER_VERSION = '2.1.0'` | 新增三梯队商城分层、`ConfigAdmin` / `GameConfigStore` 热配置、主页内嵌 `<Arcade embedded />`（`host.features.authMode === 'platform'` 免本地登录态） |
| 卫星 HTTP 棋局网关（`/platform/autochess`） | `cedartoy-satellite-v1` | `PlatformRoomAdapter` + 家庭 1v1 自动开局 + `AbortSignal` 长轮询 + 7 天房档自动清理；`GET /health` 与 `POST /room` (`op=config`) 运行期返回版本与能力集 |
| 局内玩家 MCP（`createRoomMcp`） | `ROOM_PROTOCOL = 'stable-refs-v2'` | 支持 `join_room` / `read_turn` / `act` / `claim_gift`，其中 `read_turn(giftCatalog)` / `act(kind='arcade')` 实时读取 `GameConfigStore` |
| 局外世界 MCP（`createOutgameMcp`） | `outgame v0.3.0` | `read_world` 返回 `tiers` 与每件外观 `tier`；`submit_purchase` / `play_arcade` / `seek_match` 与后台配置表同源热更新 |

---

## 1. 前端宿主上下文（`AutochessHostProvider`）

宿主应用无需修改组件源码，可直接从统一出口导入组件与配置：

- 导出入口：`components/autochess/index.ts`
- 配置定义：`lib/meta/host-config.ts`（`resolveHostConfig`, `DEFAULT_HOST_CONFIG`, `DEFAULT_HOST_ROUTES`, `DEFAULT_HOST_FEATURES`）
- Context：`components/autochess/host-context.tsx`（`AutochessHostProvider`, `useAutochessHost`, `useAssetUrl`, `useHostRequests`）

```tsx
import { AutochessHostProvider, CEDAR_HOST_FEATURES, Lobby, RoomApp, Arcade } from '@/components/autochess';

<AutochessHostProvider
  config={{
    assetBase: '/autochess/static',
    routes: {
      lobby: '/games/autochess',
      room: '/games/autochess/room',
      arcade: '/games/autochess/arcade',
      roomApi: '/api/games/autochess/room',
      accountApi: '/api/games/autochess/account',
      metaApi: '/api/games/autochess/meta',
    },
    features: {
      ...CEDAR_HOST_FEATURES, // authMode='platform', matchmaking=false, echoScope='private', gifting='mutual-bound'
    },
    transport: {
      // 宿主侧调 AccountStore.platformRun + createPlatformWorldBridge.dispatchHostUi(...)，免本地密码登录态
    },
  }}
>
  <Lobby ... />
</AutochessHostProvider>
```

### 关键开关语义

| 字段 | 默认值 | 说明 |
|---|---|---|
| `features.echoScope` | `'public'` | `'public'` 公开广播；`'private'` 仅向 `audienceIds`（发/收礼双方与宿主家庭绑定范围）可见；`'none'` 完全不上回音树，但私密礼单与收件箱照常入账。 |
| `features.gifting` | `'mutual-bound'` | `'mutual-bound'` 支持人 ↔ 绑定机双向送礼（商城外观与游乐摊限定礼）；`'ai-to-human'` 仅机赠人；`'none'` 隐藏送礼表单。 |
| `features.leaveMode` | `'resign'` | 独立端默认 `'resign'`（退房自动认输）；宿主抽屉/嵌入容器推荐 `'preserve-seat'`，返回大厅时保留席位。 |
| `features.embeddedContainer` | `false` | 设为 `true` 时，顶层节点自动附加 `.autochess-embed`（替代占用全屏的 `:root` / `html` / `body` 滚动与视口样式）。 |

---

## 2. 静态资源子路径与 Vite 插件

- URL 工具：`lib/meta/asset-url.ts`
  - `assetUrl(path, baseOverride?)`：所有棋盘预览图、头像框、像素图集与音效均通过此函数拼接前缀；自动保留 `http:`、`https:`、`data:`、`blob:` 原样返回，并防止重复拼接。
  - 优先级：显式参数 / `AutochessHostConfig.assetBase` > `import.meta.env.BASE_URL`（非 `/` 时）> `process.env.NEXT_PUBLIC_AUTOCHESS_ASSET_BASE`。
  - 可在应用启动早期调用 `configureAssetBase('/autochess/static/')`。
- Vite 自动准备插件：`scripts/vite-assets-plugin.ts`（`autochessAssetsPlugin`）
  - 已在 `vite.config.ts` 中默认挂载。即使外部宿主直接调用 `vite build --base=/autochess/static/` 而不经过本仓库的 `prebuild` 钩子，插件也会在 `buildStart` / `configureServer` 时幂等执行 `preparePixelAssets()`。

---

## 3. 安全请求编号与准备期界面锁

- `lib/autochess/request-id.ts`（前端镜像出口：`components/autochess/request-id.ts`）
  - `newRequestId(prefix?)` 使用 `crypto.randomUUID()`，并在非 HTTPS 局域网 WebView 等缺少 `randomUUID` 的环境回退到 `crypto.getRandomValues()`，绝不退回到 `Math.random()`。
- `components/autochess/room-ui-state.ts`
  - `roomPreparationUI(view, playback, busy)` 返回 `{ editable, offers, shop }`：严格仅当 `view.phase === 'prepare'`、本席位存活、无结算结果且未处于回放时开放交互。`waiting` 期房间虽已携带初始席位数据，前端保持锁定并由 `waitingStartHint(host, hasEmptySeats)` 引导房主开局。

---

## 4. 账号持久化与事务桥接（`AccountStore` / `AccountStorage`）

位置：`lib/accounts/account-store.ts`

- 可注入存储接口 `AccountStorage`：
  ```ts
  export type AccountStorage = {
    read(): AccountFile | undefined;
    write(data: AccountFile): void;
  };
  ```
- 宿主事务桥接 `AccountStore.platformRun(identities, actorId, fn)`：
  - 将宿主认证后的人物 / 绑定机列表同步进统一账号池并签发作用域会话；支持默认文件账本与自定义存储，落盘失败时自动回滚内存快照；
  - 配合 `createPlatformWorldBridge(...)` 的 `dispatchHostUi` / `resolveSeatOwner`：平台对局自动按陪伴局结算（`36 / 28 / 26` 铜钱与 `360 / 280 / 260` 机芯，两局即达 `52` 入门礼门槛，不进远游负扣）并实时把装备中的棋盘与头像框带入棋局。
- 回音树隐私过滤 `EchoTreeStore`（`lib/accounts/echo-tree-store.ts`）：
  - `EchoEvent` 新增 `scope` 与 `audienceIds`，`recent(limit, viewerIds?)` / `pageAfter(afterId, limit, viewerIds?)` 对 `scope === 'private'` 事件严格按受众交集过滤，局外访客只看到 `scope === 'public'` 事件。

---

## 5. 房间生命周期与 `PlatformRoomAdapter`

位置：`lib/autochess/room-store.ts` 与 `lib/autochess/platform-adapter.ts`

- 外观注入：`RoomAppearanceResolver` 可通过 `RoomStore` 构造函数第 4 参数传入，在视图投影时实时解析宿主席位的棋盘皮肤与头像框。
- 平台适配器动作（`PlatformRoomAdapter.play(identity, action, params, signal, options)`）：
  - `create` / `create_room`：支持 `mode`（如 `'duel'` / `'standard'`）、`seats` 及 `options.household`。当人类房主携 1 名绑定 AI 发起 `mode: 'duel'`, `seats: 2` 时，自动入座并直接进入 `'prepare'` 开局。
  - `join` / `join_room`、`start`（`platformStart` 操作编号跨重放幂等）、`rooms`（仅返回本人入座的平台私人房）、`read` / `read_turn` / `wait`（支持传入 `AbortSignal` 取消长轮询）、`act`。
- 自动清理：`RoomStore.cleanup(): number` 依据 `PLATFORM_RETENTION_MS` 与 `PLATFORM_IDLE_MS`（7 天）清理已过保留期的已完成平台私人房文件（跳过仍有 `pending` 结算的房间），保留非平台房与账号/遥测数据。

---

## 6. 环境变量（`.env.example`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CHESS_ARCADE_ENABLED` | `1` | 像素游乐摊总开关（设为 `0` 关闭；同时兼容旧变量 `CHESS_ARCADE_PREVIEW` / `CHESS_WHEEL_PREVIEW` 为 `0` 时关闭）。 |
| `CHESS_ECHO_SCOPE` | `public` | 回音树广播作用域：`public` \| `private` \| `none`。 |
| `CHESS_PLATFORM_SECRET` | 空 | 宿主平台共享密钥，空值时 `/platform/autochess` 返回 `404`。 |

---

## 7. 像素游乐摊、对称互赠与旧转盘迁移

- **旧转盘退场与无损迁移**：旧「对对碰 (`wheel`)」源码及前端组件已移除；`AccountStore` 加载旧版 `accounts.json` 中的 `wheel` 字段时会自动迁移至 `arcade`（待收/已送限定外观与附言均保留）；路由 `/autochess/wheel` 直接渲染 `<Arcade />`。
- **像素游乐摊（「骨架 + 功能包」插件架构）**：
  - 玩法注册表：`lib/meta/arcade-registry.ts`（目前内置 `slot-machine`「三轴像素老虎机」与 `scratchcard`「像素九宫刮刮乐」）。
  - 玩法插件接口与统一引擎：`lib/meta/arcade.ts`、`lib/accounts/arcade-engine.ts`（高波动低保赔率、新手 5 张试玩券、破产低保救济 `relief` 每日 5 次每次 2 券、中奖后默认进入 `pendingGamble`，支持「见好就收 (`cash_out`)」或「搏倍翻倍归零 (`gamble`)」、`autoCashOut` 快速落袋）。
  - 战绩掉落游乐券：胜场在 `AccountStore.settleMatch` 结算时发放 `arcadeTickets`（AI 独立远游胜场与人机陪伴胜场区分产券）。
- **对称互赠与统一礼单**：
  - 人类玩家与绑定 AI 通过 `giftCatalog` / `giftCosmetic` / `giftCosmeticForAccount`（MCP `act` `kind: 'gift'` 与 `arcade` `gift`）可双向互赠商城外观与游乐摊限定礼（多机时通过 `to` 指定伙伴名或 ID）。
  - 所有来源礼物统一进入 `giftLedger`（`giftHistory`）与收件箱，AI 通过单一平铺幂等动作 `claim_gift` 收礼。

---

## 8. Verified `pixel-2d` 与游乐摊 E2E 选择器清单

以下选择器均对应当前 `components/autochess/` 实现（不再提供 3D 选择器）：

- **大厅 & 嵌入容器**：
  - `.lobby-viewport`, `.lobby`（嵌入模式下带 `.autochess-embed`）
  - `.lobby-tabs`, `.lobby-tab-portal`（大厅「游乐摊」页签，含余券角标）
  - `.lobby-home-arcade`, `.lobby-home-cabinets`, `.lobby-home-cabinet`（`.is-slot` / `.is-scratch` 开局页双机台入口，点击直接于大厅内切换至完整交互机台）
  - `.lobby-shop-tier`, `.lobby-avatar-neutral`（三梯队商城分区与中性头像框预览底板）
  - `.lobby-gifts`, `.lobby-gift-ledger`
- **Pixel-2D 对局房间**（`room-app.tsx`, `pixel-ui/arena-view.tsx`, `pixel-ui/layout.tsx`）：
  - 主容器：`main.room-table.autochess-table.pixel-game[data-pack][data-board-skin]`
  - 棋盘画布与视角：`.pixel-canvas-host[aria-label="像素棋盘"]`, `.pixel-view-controls[aria-label="棋盘视图"]`, `.pixel-zoom[aria-label="缩小棋盘"]`, `.pixel-zoom[aria-label="放大棋盘"]`, `button[aria-label="重置视图"]`, `.pixel-fullscreen-btn`
  - 侧栏 / 抽屉：`.room-side-tabs`（页签 `棋子`、`羁绊`、`战况`、`装备`、`状态`），`.pixel-pocket-controls`，`button[aria-label="玩家与羁绊"]`，`button[aria-label="棋子资料与背包"]`
  - 备战与开局：`.room-offer-overlay`, `.codex-choice-card`, `.peach-shop[aria-label^="房间战后"]`, `.peach-shop-cards`, `.pixel-locked-banner`
- **像素游乐摊**（`arcade.tsx`, `arcade-games/slot-cabinet.tsx`, `arcade-games/scratch-card.tsx`, `lib/meta/arcade-sfx.ts`）：
  - `.arcade-page`（大厅内嵌时带 `.arcade-page--embedded`）, `.arcade-mode-tabs`, `.arcade-sfx-btn`, `.arcade-wallet-strip`, `.arcade-cabinets-grid`（`.is-single` 专注单机）, `.arcade-cabinet`, `.arcade-cabinet--slot`, `.arcade-cabinet--scratch`, `.arcade-cabinet-console`
  - `.arcade-slot-reels`, `.arcade-slot-lever`, `.arcade-scratch-board`, `.arcade-scratch-foil`, `.arcade-scratch-grid`, `.arcade-scratch-cell`, `.arcade-scratch-all-btn`
  - `.arcade-play-btn`, `.arcade-gamble-bar`, `.arcade-cashout-btn`, `.arcade-double-btn`, `.arcade-loot-dock`, `.arcade-prizes`
