# 人机棋（`packs/ai`）

默认棋谱把 AI 模型与产品人格化成自走棋棋子。当前共有 **28 枚商店棋子**，另有 GPT 半血后触发的隐藏形态 **Codex**；隐藏形态不会进入商店或公开棋子计数。

## 主题词汇扩展

| 通用概念 | 人机棋叫法 |
|---|---|
| 金币 | Token |
| 利息 | 余热算力 |
| 经验 / 人口 | 参数规模（7B → 405B） |
| 蓝条 | 上下文长度（Context Window） |
| 刷新商店 | Regenerate |
| 1★ / 2★ / 3★ | INT4 / FP16 / FP32 |

这些映射集中在 `terms.ts`，Web 界面通过棋谱术语适配层统一读取。MCP 协议继续使用稳定的 `gold`、`level`、`star` 字段，主题文案不会改变 Agent 客户端的数据契约。

## 当前费用分布

| 费用 | 数量 | 棋子 |
|---|---:|---|
| 5 | 3 | Claude、GPT、Gemini |
| 4 | 5 | DeepSeek、Kimi、Grok、GLM、Manus |
| 3 | 6 | Qwen、Doubao、Copilot、Muse Spark、MiniMax、Kiro |
| 2 | 7 | Character.AI、Replika、Talkie、Llama、Mistral、Hunyuan、即梦 |
| 1 | 7 | Xiaoice、ERNIE、Nai、Tripo、Gemma、Kling、Ollama |

## 已接入棋局的特色机制

- **GPT → Codex**：半血换形，攻击、破甲与攻速提高，护甲下降。
- **Doubao 掺水**：临时替换敌人的名称、面板与羁绊并施加沉默，到期完整恢复。
- **Claude 查 IP**：阵容构成与历史命中次数会改变离场风险，三星免疫。
- **DeepSeek 错峰定价**：每回合可能涨价或降价。
- **GLM 限量 Coding Plan**：可能在当前回合售罄，早期概率更高。
- **Gemini 官方活动**：二星与三星可能临时缺席一回合。

风控判定由房间种子、座位、棋子、事件和回合共同派生；同一场棋可以复现。数值集中在 `hazards.ts`，房间接线位于 `lib/autochess/hazards.ts` 与 `room-store.ts`。

## 文件边界

| 文件 | 作用 |
|---|---|
| `roster.ts` | 商店棋子、隐藏形态、基础面板、羁绊和技能说明 |
| `traits.ts` | 阵营与职业羁绊的文案、档位和实际数值 |
| `skills.ts` | 基于通用 `SkillPrimitive` 的技能数据 |
| `items.ts` | AI 主题装备、转职与开局装备池 |
| `hazards.ts` | 查 IP、错峰定价、官方活动、限量售罄等回合事件 |
| `maneuvers.ts` | 可供扩展使用的持久标记模板；当前商店棋子未挂载 |
| `terms.ts` | 主题词汇源数据 |
| `index.ts` | 用 `definePack` 汇总本包所有数据 |

## 添加一枚棋子

1. 在 `roster.ts` 增加一条 `defineUnit(...)`。
2. 在 `skills.ts` 用现有技能原语登记同 id 技能。
3. 复用已有羁绊；如需新羁绊，只在 `traits.ts` 用 `defineTrait(...)` 同时声明文案、档位和数值。
4. 需要回合外风险时，在 `hazards.ts` 添加数据工厂；只有新增判定维度时才扩展通用 handler。

AI 棋谱使用自己的装备与开局三选一。默认 `hexes` 为空，不会串入其他棋谱的心悟；设置 `CHESS_RP=1` 后，才会加入可选 RP 梗扩展。
