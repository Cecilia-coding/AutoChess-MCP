# 棋谱工坊

两个并列入口：引导创作逐步选模板、准备名单、填写棋子；进阶编辑直接调整属性、技能和 JSON。两者编辑同一套内容。点击「试下这套棋」即可购买、合成、布阵，与规则机器人完成对局。

## 数据与运行位置

棋谱、预览、战斗计算均在浏览器执行。草稿使用 localStorage 自动恢复，确认保存的棋谱与当前试下局使用 IndexedDB；另开一局替换当前试下存档。导出 JSON 可备份、分享或迁移设备。清除网站数据会清除本机内容，请保存重要棋谱的导出文件。

云端提供静态网页、契约查询与可选 MCP 接力。玩家主动开启接力后，网页发送当前局面摘要：标题、数量、至多 100 项简短目录、当前选中一枚棋子，或商店、己方阵容和至多 12 条关键事件。完整棋谱和试下存档留在本机。摘要与指令只驻留服务内存，不写数据库、文件或应用日志。关闭接力立即清除；网页失联后默认 2 分钟过期，定时清理最多额外等待 30 秒。服务重启会清空连接，网页可重新开启。

保持网页打开，云端 MCP 才能操作本机。页面和计算模块加载完成后，关闭服务仍可在当前页面继续试下；离线重新打开网页需要额外的离线缓存支持。Web Worker 执行计算，超过 10 秒终止并保留上一份成功存档。

## 开发与迁移

```sh
npm --prefix ../chess-engine ci
npm --prefix ../chess-engine run build
npm ci
npm run build
npm test
npm start
```

默认入口 http://127.0.0.1:8796/autochess-lab/，MCP 为同路径的 mcp。

```text
src/core/        棋谱契约、统一成长、预览与模板
src/play/        编译适配、试下经济、纯棋局状态转换
src/browser/     Web Worker 入口
src/relay/       局面契约、内存接力与过期回收
src/server/      HTTP、MCP 与环境配置
web/            编辑器、试下 UI、本机存储与接力客户端
../chess-engine/ 共享战斗引擎；无账号、内容包、路径依赖
```

包根导出 core，`./play` 导出纯棋局逻辑，`./relay` 导出内存接力服务。接入 TOY 等宿主时携带这两个包，复用棋谱格式、浏览器运行与接力协议；宿主身份在 HTTP/MCP 适配层接入。JSON 只携带规则和内容，路径、账号与编辑凭据独立。schemaVersion 表示内容协议版本，revision 表示本机编辑或试下修订。

主题由主仓库 `node scripts/sync-authoring-theme.mjs` 从棋室 CSS 同步，导出随包发布；独立部署无需读取宿主文件。

## 内容规则

- 一套棋谱只有 `rules.starGrowth`，全体棋子统一使用；单棋子及单技能的成长覆盖会报字段错误。
- 成长数组依次为一、二、三星；一星倍率为 1。生命、攻击、技能伤害、治疗、护盾、控制时长分别配置。
- 技能量值 = `(flat + 一星攻击 × attackRatio + 一星生命 × healthRatio) × 对应效果成长倍率`。技能只乘一次成长，系数中的属性指施法者的一星基础属性。
- 攻击间隔、施法间隔、射程、护甲、魔抗、目标数、护盾持续时间、属性变化值与持续时间，在全部星级保持固定。
- 时间单位为毫秒；比例用小数，`0.1` 表示 10%。预览展示减伤前伤害和未扣除过量的治疗。实战使用既有引擎的护甲、魔抗、护盾与控制结算。
- 支持开战、周期、攻击计数和满法力触发；伤害、治疗、护盾、眩晕、属性变化积木。每个技能的效果按数组顺序声明并共用目标选择。
- 所有对象使用严格字段校验，重复棋子 ID、错误目标组合、非法数值和计算溢出都会阻止保存。费用缺档只提示草稿未完成，允许逐枚创作。
- 省略值会补全并出现在导出中：description 为空，role 为 caster，armor/magicResist 为 0，amount 各项为 0，includeSelf 为 false，startMana 为 0。

完整可机器读取的契约在 `GET <base>/api/schema`；示例和模板在 `GET <base>/api/guide` 或 MCP `get_authoring_guide`。

## MCP 接力

| 工具 | 参数 | 作用 |
|---|---|---|
| get_authoring_guide | 无 | 契约、模板、技能积木与示例 |
| read_chess_session | sessionId、accessKey | 当前摘要、待处理指令、最近 8 条回执 |
| command_chess_session | sessionId、accessKey、requestId、expectedRevision、command | 排入一条指令，由网页本地执行 |

从网页「和机一起编辑」或「让机接着下」开启接力并复制凭据。机读取最新 revision 后提交，例如：

```json
{
  "sessionId": "网页给出的连接 ID",
  "accessKey": "网页给出的接力密钥",
  "requestId": "本次操作唯一 ID",
  "expectedRevision": 3,
  "command": {"kind":"play","action":{"type":"buy","slot":0}}
}
```

返回 queued 后读取回执，等待 applied 或 rejected，再执行下一步。每个连接保留一条待执行指令；重试复用原 requestId 和参数。网页再次核对本机修订，避免覆盖玩家同时进行的修改。

创作指令使用 kind: edit，action 支持 prepare（模板和起步数量）、metadata、growth（全体共用成长表）、put_unit（完整一枚棋子）、remove_unit、select_unit、catalog_page。inspect_unit 查看一枚棋子；start_trial 在本机开局并切换试下页面。对局使用 kind: play，action 支持 buy(slot)、move(pieceId,row,col)、sell(pieceId)、refresh、upgrade、ready。行列从 0 开始，下场使用 row/col 均为 null。字段以 MCP 工具 JSON Schema 为准。

## 试下规则

试下经济参数集中在 `src/play/rules.ts`，响应也返回 `rules`：双方 30 生命、10 初始金币，3 级起步；每回合收入 5 金、获得 2 经验，存款每 10 金增加 1 金利息（最多 5）；刷新 2 金，4 金购买 4 经验；三枚同名同星自动合成，最高三星。等级决定上场数量，最高 8，备战席 9 格。商店在当前棋谱包含的费用档中按权重抽取，不设共享有限库存。对手按同一经济和合成规则操作。败者扣 2 加胜方存活数的生命，平局双方扣 2；最多 30 回合，届时按剩余生命判胜。该规则用于独立验收和调数值。

实战每 100ms 推进一次；技能量值取整后结算护甲与魔抗，护盾上限为最大生命 40%，加时规则沿用棋室引擎。`attackSpeed` 的固定值单位为每秒攻击次数。临时百分比属性变化按施放时当前属性计算增减量，过期撤回该增减量；属性下限为 0，-100% 攻速到期后恢复攻击。目标排序并列时按位置稳定选取；开战/周期触发的 `current` 使用最近敌人。技能选定一组目标后应用各效果，伤害包按同一引擎时间片结算。

## 部署与负载

| 环境变量 | 默认 |
|---|---|
| AUTHORING_HOST | 127.0.0.1；容器内 0.0.0.0 |
| AUTHORING_PORT | 8796 |
| AUTHORING_BASE_PATH | /autochess-lab |
| AUTHORING_PUBLIC_ORIGIN | 空，按请求来源校验 |
| AUTHORING_RELAY_TTL_MS | 120000 |
| AUTHORING_RELAY_MAX_SESSIONS | 64 |
| AUTHORING_RELAY_MAX_BYTES | 32768 |
| AUTHORING_BODY_LIMIT | 40kb |

容量是部署配置，可按机器调整。默认最多 64 个连接，每份摘要/指令不超过 32KiB，回执只保留状态与指令哈希。请求 JSON 上限 40KiB。浏览器长轮询等待指令，空闲等待 20 秒，战斗由浏览器计算。示例 compose 限制 0.5 CPU、256MiB 内存、64 个进程，无数据卷。

在包含两个包的父目录执行 `docker build -f chess-authoring/Dockerfile -t chess-authoring:local .`。工坊目录改名后通过 --build-arg AUTHORING_SOURCE=目录名 配置。反向代理保留路径前缀；只将工坊路径转发到独立容器。

HTTP api/relay 创建临时连接；拥有者使用独立 ownerKey 发布摘要、等待命令、关闭连接。MCP accessKey 允许读取摘要和提交指令。凭据通过请求头或 MCP 参数传递。旧 drafts、matches、preview、starter 上传接口返回 410。健康接口返回 persistence: none 与接力连接数。

## 验证

npm test 覆盖统一成长、非法输入、四种触发和三星数值、五类效果、零攻击/临时降攻速恢复、合成与完整对局，以及接力容量、过期、修订冲突、回执重试、长轮询唤醒、HTTP/MCP 联通与旧上传接口退役。主仓库测试继续覆盖正式棋室。
