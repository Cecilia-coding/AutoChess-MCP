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
| 3 | 6 | Qwen、Doubao、Copilot、Muse、MiniMax、Kiro |
| 2 | 7 | Character.AI、Replika、Talkie、Llama、Mistral、Hunyuan、即梦 |
| 1 | 7 | Xiaoice、ERNIE、Nai、Tripo、Gemma、Kling、Ollama |

## 已接入棋局的特色机制

- **Muse 填个邀请码**：3 费辅助，独立作坊 / 长上下文 / 智能体；45 点上下文施法，为上下文比例最低的两名其他队友各回复 10/20/30 点，自己获得 5/10/15 点邀请奖励，均受各自上限限制。奖励用于战斗上下文。内部 ID `ai-musespark` 延续已有存档。
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

## 像素棋盘

本包通过 `presentation: { renderer: 'pixel-2d', appearanceId: 'ai-mascots' }` 选择 Canvas 2D 棋盘与外观包。浅斜角格子配正面像素角色，使用独立坐标与点击映射；其他棋谱沿用原来的 3D 场景。29 个角色含隐藏 Codex，头像、图集和动画时长统一读取 manifest。

- `presentation/appearance.ts`：素材目录、公开地址、图集、尺寸、棋盘配色和运行文件清单。
- `presentation/effects.ts`：把真实战斗事件编译成特效帧，不修改结算数据。
- `packs/presentation.ts`：外观唯一注册入口。新增外观在自己的包内声明，再注册并指定 `appearanceId`。
- `lib/autochess/pixel-arena.ts`：通用绘制、坐标、缩放、拖拽；不包含模型名称或专属技能判断。
- `components/autochess/pixel-ui`：独立的 RPG 界面布局、主题与手绘像素图标；预览和正式棋室共用。

`prepare:assets` 遍历注册表，生成 `public` 素材和容器所需的 `.generated/presentation-source` 元数据。新增包无需修改构建脚本或 Docker 的素材路径。

动作、表情、护盾与外形由战斗事件驱动。新回放携带实际外形、血量、上下文及护盾状态，支持暂停和回退；历史回放没有这些字段时仍可播放基础动作与血条。

已接入专属普攻、施法蓄力、真实技能命中、治疗、护盾获得/破裂/到期、入场、阵亡、换形和 Muse 邀请奖励。素材图鉴还包含战后风险与其他被动的演示；战后风险尚未接入棋盘的战斗回放事件流。

运行 `npm run preview:pixels` 可用真实战斗引擎查看角色、布阵和回放，预览数据仅保存在页面内存中。
预览支持滚轮、双指及按钮缩放、空白处平移、全景复位；商店购买与刷新使用本地试棋金币。`assets/pixel-mascots/preview/index.html` 保留全角色和特效图鉴。

移动端由 `PixelWorkspace` 管理收起的信息面板，棋盘和主要操作适应 `100dvh` 与安全区。竖屏卡牌横滑、横屏右侧招募；布局规则放在公共像素 UI，外观包只配置视觉素材。缩放、出售与开战分别嵌入棋盘角落、备战区和招募区，不设置独立的上下工具条。
