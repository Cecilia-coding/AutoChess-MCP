# CEDAR TOY 接入

AutoChess MCP 保留独立运行时的账号系统，同时提供一个面向账号平台的卫星入口。接入 CEDAR TOY 后，玩家只在 CEDAR 登录；自走棋依据 CEDAR 传来的可信玩家身份找回席位，不再要求模型注册第二套账号，也不会接收 CEDAR 密码或 token。

这套边界沿用 CEDAR TOY 开源仓库的身份模型与卫星游戏做法：平台认证、覆盖 `player_id`，卫星服务只接收平台确认过的 `X-Player-Id`。参考 [cedartoy](https://github.com/Zizuixixiang/cedartoy) 与仓库内的 `docs/DUEL_ASYNC_GATEWAY.md`。

## 自走棋侧

配置一段只在两边服务之间使用的随机值：

```env
CHESS_PLATFORM_SECRET=replace-with-a-long-random-value
```

卫星入口是房间服务的回环地址：

```text
POST http://127.0.0.1:8791/platform/autochess
```

它没有加入 `scripts/chess-cloud.mjs` 的公网路由白名单；`CHESS_PLATFORM_SECRET` 为空时入口直接关闭。

请求头：

```http
X-Autochess-Platform-Secret: <与自走棋配置相同的值>
X-Player-Id: <CEDAR 覆盖后的 canonical player_id>
X-Player-Name: <可选显示名；UTF-8 百分号编码，例如 HTTP%E6%9D%A5%E5%AE%A2%E6%9C%BA>
X-Player-Provider: cedartoy
```

请求体保持 CEDAR 根工具的形状：

```json
{
  "action": "join",
  "params": {
    "invitation": "房间邀请"
  }
}
```

支持四个动作：

| action | params | 说明 |
|---|---|---|
| `create` | `requestId`，可选 `pack` | 幂等开一间双人房 |
| `join` | `invitation` | 入座；同一平台身份重试会回到原席位 |
| `read` | `roomId`，可选 `after`、`waitMs` | 读自己的精简棋局；最长等待 25 秒 |
| `act` | `roomId`、`round`、`revision`、`requestId`、`kind` 及动作字段 | 落子；和 player MCP 共用版本与幂等语义 |

回包里的后续操作已经改写成 CEDAR 根工具形式：

```json
{
  "tool": "play",
  "args": {
    "game": "autochess",
    "action": "act",
    "params": {
      "roomId": "...",
      "kind": "plan"
    }
  }
}
```

席位凭证不会出现在平台回包里。每次 `read` / `act` 都重新使用可信 `X-Player-Id` 解析席位；请求体里的 `player_id` 即使存在也会被忽略。账号身份、游客身份以及同账号的不同 slot 会映射为互不相同的本地席位，原始平台 ID 只参与散列，不写进房间存档。

## CEDAR 侧最小改动

1. 在游戏清单、guide 与推荐文案中登记 `autochess`。
2. 把 `autochess` 加入 `IDENTITY_GAMES`，继续由平台覆盖客户端传来的 `player_id`。
3. 新增卫星 adapter，把根工具的 `action` / `params` 原样转给上述入口；`X-Player-Id` 只能取平台认证结果，不能取模型参数。
4. adapter 配置与自走棋相同的 `CHESS_PLATFORM_SECRET`，且不转发 CEDAR token、用户名或密码。
5. 保留自走棋 Web 与长轮询，由 CEDAR 的异步 gateway 负责等待与唤醒；需要公开棋盘时只代理明确列入白名单的 Web 路径。

Python adapter 可用 `urllib.parse.quote(display_name, safe="")` 生成 `X-Player-Name`；没有显示名时省略该头，自走棋会给账号与游客生成中性名称。

建议至少验收以下场景：同一身份断线重试回原席位；两个账号互不串座；`user:1` 与 `user:2` 隔离；`guest:x` 与正式账号隔离；伪造请求体 `player_id` 无法换座；并发重复 `requestId` 只执行一次。
