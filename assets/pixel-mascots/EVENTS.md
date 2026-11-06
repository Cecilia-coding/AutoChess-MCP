# 被动、状态与局外事件

按当前 `packs/ai/skills.ts` 和 `packs/ai/hazards.ts` 补齐角色视觉范围：29 个角色的普攻，28 个主动技能及分支，Codex 被动换形，技能表中全部 `passiveStats`、`onDamaged`、`onDeath`、`onBattleStart`、`tick`，DeepSeek 条件救场/偷攻击，Grok 与 Manus 追加攻击，以及四类角色风控事件。

另提供 10 类所有角色可使用的接收方状态效果。共 36 类事件、317 段角色配色动画，每段 8 帧。通用「重新入场」可用于新回合、复活事件或预览重置，不代表所有角色拥有复活技能。

这次依旧只修改 `assets/pixel-mascots/`。这是可接入素材与视觉演示；正式游戏的触发条件、概率、目标、持续时间和数值没有改动。

## 文件和格式

| 文件 | 用途 |
| --- | --- |
| `preview/events.js` | 无 DOM 依赖的事件查询、状态姿态和绘制 API |
| `effects/events/ai-*.png` | 每角色一张透明事件图集，一行一个事件、每行 8 帧 |
| `effects/events/manifest.json` | 事件键、所属角色、触发说明、帧矩形和时长 |
| `effects/events/coverage.json` | 与当前技能源码核对的覆盖清单；新增源码钩子会让校验失败 |
| `effects/events/contact-sheet.png` | 专属事件的静态总览 |

每帧 128×128，锚点 `(64,64)`。PNG 是叠加特效，不含角色身体；根据 `PixelEvents.actor()` 的可选姿态提示绘制身体后，再叠加特效。跨目标连线、传火和追击由 `draw()` 根据传入坐标绘制，无法烘焙为固定目标位置的 PNG。

## 接入方式

按顺序加载 `mascots.js`、`renderer.js`、`effects.js`、`skills.js`、`events.js`。

```js
// 引擎确认事件后创建视觉实例；不要每帧重置 startedAt。
const ageMs = visualClockMs - startedAt;
const event = PixelEvents.get('ai-deepseek', 'deepseek_open');
if (ageMs < event.durationMs) {
  PixelEvents.draw(ctx, 'ai-deepseek', 'deepseek_open', {
    ageMs, source: actorCenter, allies: actualAffectedAllies,
    foes: [], scale: 2, reducedMotion: prefersReducedMotion
  });
}
```

- `list(id)`：该角色的专属和通用事件。`get(id,key)` 会拒绝不存在或不属于该角色的事件。
- `drawLocal(ctx,id,key,{x,y,scale,ageMs,stacks,reducedMotion})`：只画本地叠加效果，用于卡片或 PNG 重导出。`stacks` 控制 DeepSeek 怒气格，限制在 1～6。
- `draw(ctx,id,key,{source,allies,foes,...})`：包含传火、偷攻击、追加攻击等跨目标连线。目标数组来自正式引擎。
- `actor(id,key,ageMs)`：给预览返回 `id/hp/opacity` 提示。正式客户端优先使用自己的真实状态，不可拿此返回值修改战斗数据。

`durationMs` 是一次视觉演示长度，不是技能 buff/status 的持续时间。例如 Claude 受击免控实际为 400 ms，演示会放慢为 1200 ms 方便看；客户端应按实际免控开始/结束事件控制持续标记。动画过期返回空，不会自动复活、重新换形或恢复库存。

`gpt_codex` 的换形姿态由 GPT 过渡到 Codex。`doubao_restore` 在预览中以 Muse 充当被掺的原角色，正式接入必须恢复引擎保存的原始角色，不能固定恢复成 Muse。价格标签由事件的实际 delta 决定；当前棋谱使用 +1 / −1，本包给这两个分支各一段动画。

## 覆盖内容

- **Claude**：常驻减伤、受击免控、查 IP 扫描/通过/封号、三星免查；封号展示离场与装备回收袋。
- **GPT / Codex**：黑白防御层、半血换形，配增攻、攻速、破甲标记。
- **DeepSeek**：怒气格与思考外泄、低队伍血量救场、偷攻击、阵亡向友军传火、波峰涨价/波谷折扣。
- **Character.AI / Replika / Copilot / Gemma**：人设记忆、持续恢复、常驻减伤、攻击与生命底力。
- **Grok / Manus**：开场免控、普攻追加追击、追加攻击后换目标路径。需要绑定每次真实触发的 rider 事件。
- **GLM / Gemini**：售罄/可购买、罢工离场/归队。
- **豆包**：临时换形与沉默到期后的还原过程。
- **所有角色**：受击、治疗、获得护盾、护盾破裂、护盾到期、沉默、眩晕、倒下、重新入场、增益结束。

基础受击/治疗等 10 类事件在 29 套角色配色中均有导出。没有独立常驻被动的角色继续使用自己的主动技能与通用状态，不给它们虚构新技能。

## 预览和轮播

在「被动、受击，还有那些小意外」中选事件、点击演示；勾选「循环看」可反复播放。事件预览不会改变血量、商店、封号记录或技能次数。

「全角色轮播」按角色依次播放普攻、所有技能分支和专属事件，最后展示通用事件。可以暂停、调速、跳到下一个；手动切换角色或出招会停止轮播。事件结束、切换角色和重置都会清理旧效果。

## 重导出和检查

```sh
npm run export:events
npm run check
```

检查包含技能源码钩子和被动属性覆盖、四类风控 ID、所有导出帧非空/透明/无边缘裁切、GPT/Codex 黑白约束、事件到期、循环、切换清理、完整轮播与移动端布局。

覆盖范围是当前 AI 棋谱的角色技能和角色风控；不包括其他棋谱、装备、羁绊或未来新增内容。`coverage.json` 记录当前范围，不能替代未来源码变更后的复核。
