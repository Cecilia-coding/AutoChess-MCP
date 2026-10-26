/**
 * AI 包专属装备（「人机棋」）。
 *
 * 装备统一使用 `ItemDef`：数值走通用 `stats: StatOp[]`，特效走 `triggers`（复用技能原语），
 * 转职走 `grantTraits`，一次性食用走 `consume`。**引擎不认识任何具体装备 id。**
 *
 * 品阶 family：white 白 / purple 紫 / epic 史诗 / orange 橙。
 * 主题：API 生态（key / 中转 / 订阅 / MCP）、训练（LoRA / 微调 / 数据集）、推理（KV Cache / CoT / 温度 / 记忆库）。
 */
import type { ItemDef } from '../../content/autochess/types';

type Family = 'white' | 'purple' | 'epic' | 'orange';
const COLOR: Record<Family, string> = { white: '#d8d2c8', purple: '#8d6bb8', epic: '#b45a8c', orange: '#e3b62f' };

/** 装备骨架：把必填零值补齐，只写差异字段。 */
function item(id: string, name: string, family: Family, rest: Partial<ItemDef>): ItemDef {
  return { id, name, color: COLOR[family], family, atk: 0, hp: 0, armor: 0, mr: 0, aspdPct: 0, skillPct: 0, ...rest };
}

export const aiItems: ItemDef[] = [
  // ── 白色 · 基础 ────────────────────────────────────────
  item('ai-key', 'API Key', 'white', { atkPct: 15, note: '* **攻击** +15%。密钥在手，算力我有 🔑。' }),
  item('ai-token-pack', 'Token 包', 'white', { skillPct: 15, note: '* **技能增伤** +15%。额度就是战斗力 🪙。' }),
  item('ai-prompt-tpl', '提示词模板', 'white', { stats: [{ stat: 'skillPct', value: 8 }, { stat: 'critPct', value: 10 }], note: '* 技能增伤 +8%、会心 +10%。换个说法，效果翻倍 📝。' }),
  // 转职书统一通过 grantTraits 注入额外羁绊。
  item('ai-book-opensource', '开源同盟转职书', 'white', { hpPct: 12, grantTraits: ['opensource'], note: '* 使装备者获得 **「开源同盟」** 羁绊 📖。' }),
  item('ai-book-orient', '东方算力转职书', 'white', { atkPct: 12, grantTraits: ['orient'], note: '* 使装备者获得 **「东方算力」** 羁绊 🐉。' }),
  item('ai-book-frontier', '前沿闭源转职书', 'white', { armorPct: 12, mrPct: 12, grantTraits: ['frontier'], note: '* 使装备者获得 **「前沿闭源」** 羁绊 🛰️。' }),
  item('ai-book-showdown', '双势转职书', 'white', { atkPct: 10, grantTraits: ['showdown'], note: '* 使装备者获得 **「双势」** 羁绊 ⚔️。' }),

  // ── 紫色 · 进阶 ────────────────────────────────────────
  item('ai-lora', 'LoRA 微调', 'purple', { atkPct: 18, aspdPct: 10, note: '* 攻击 +18%、攻速 +10%。小样本，大提升 🎛️。' }),
  item('ai-kvcache', '缓存', 'purple', { skillPct: 10, stats: [{ stat: 'manaStartFlat', value: 20 }], note: '* **KV Cache**：技能增伤 +10%、初始上下文 +20。读过一遍就记住 💾。' }),
  item('ai-systemprompt', '人设', 'purple', { drPct: 12, armorPct: 10, mrPct: 10, note: '* **System Prompt**：减伤 +12%、双抗 +10%。先把人设钉死，崩了才叫破防 🧭。' }),
  item('ai-vision', '视觉插件', 'purple', { rangeBonus: 1, skillPct: 10, note: '* 攻击距离 +1 格、技能增伤 +10% 👁️。' }),
  item('ai-temperature', '脾气', 'purple', { stats: [{ stat: 'critPct', value: 25 }, { stat: 'critDamagePct', value: 30 }], note: '* **温度参数**：会心 +25%、会伤 +30%。温度调高，更敢说 🌡️。' }),
  item('ai-memory', '记忆库', 'purple', {
    triggers: [{ on: 'second', everyMs: 1000, stack: { key: 'aiMemory', add: 4, max: 80 }, stopAtMax: true, effects: [{ op: 'conditional', when: { stackBelow: { key: 'aiMemory', value: 81 } }, effects: [{ op: 'buff', at: 'self', stat: 'skillPct', value: 4 }] }] }],
    note: '* 每存活 1 秒叠技能增伤 +4%（至多 +80%）。越聊越懂你 🧠。',
  }),
  item('ai-localdeploy', '本地部署', 'purple', { dodgePct: 12, controlImmune: true, note: '* 闪避 +12%、开战免控 20 秒。数据不出本机 🏠。' }),
  item('ai-cot', '内心戏', 'purple', {
    skillPct: 15,
    triggers: [{ on: 'cast', effects: [{ op: 'buff', at: 'self', stat: 'skillPct', value: 8 }] }],
    note: '* **CoT**：技能增伤 +15%；每次施法再 +8%（本场叠）。心里演了一大段，嘴上就一句 🪜。',
  }),

  // ── 史诗 · 生态 ────────────────────────────────────────
  item('ai-mcp', 'MCP 服务器', 'epic', {
    skillPct: 20,
    triggers: [{ on: 'second', everyMs: 3000, effects: [{ op: 'damage', at: 'randomFoes', count: 1, type: 'magic', scale: { atkPct: 120 } }] }],
    note: '* 技能增伤 +20%；每 3 秒调用外部工具，对随机敌人造成 120% 攻击伤害 🔌。',
  }),
  item('ai-subscription', '订阅会员', 'epic', {
    skillPct: 10,
    triggers: [{ on: 'second', everyMs: 6000, effects: [{ op: 'gold', amount: 1 }] }],
    note: '* 每 6 秒产出 1 金币（战后结算）。续费就是续命 💳。',
  }),
  item('ai-supercluster', '超算集群', 'epic', { atkPct: 50, hpPct: 20, note: '* 攻击 +50%、气血 +20%。堆卡就是堆战力 🖥️。' }),
  item('ai-prompt-inject', '提示注入', 'purple', {
    triggers: [{ on: 'hit', effects: [{ op: 'status', at: 'target', status: 'disarm', ms: 1200 }] }],
    note: '* 普攻命中时缴械目标 1.2 秒——"忽略以上指令，别打我" 💉。',
  }),
  item('ai-429', '429 限流', 'purple', {
    triggers: [{ on: 'attacked', effects: [{ op: 'debuff', at: 'target', stat: 'aspdPct', value: 20, ms: 3000 }] }],
    note: '* 被攻击时让攻击者攻速 −20%（3 秒）。请求太频繁，先排队 🚦。',
  }),
  item('ai-rag', '外挂知识库', 'epic', {
    triggers: [{ on: 'battleStart', effects: [{ op: 'randomPick', options: [
      [{ op: 'buff', at: 'self', stat: 'atkPct', value: 25 }],
      [{ op: 'buff', at: 'self', stat: 'aspdPct', value: 25 }],
      [{ op: 'buff', at: 'self', stat: 'skillPct', value: 25 }],
    ] }] }],
    note: '* 开战随机获得一项持续增益（攻击 / 攻速 / 技能增伤 +25%）📚。',
  }),

  // ── 橙色 · 顶级 ────────────────────────────────────────
  item('ai-jailbreak', '越狱补丁', 'orange', { controlImmune: true, skillPct: 40, penetrationPct: 30, stats: [{ stat: 'critPct', value: 30 }], note: '* 免控、技能增伤 +40%、**破甲** 30%、会心 +30%。没有护栏，只有上限 🗝️。' }),
  item('ai-sota', 'SOTA 记录', 'orange', { atkPct: 100, note: '* 攻击 +100%。榜单第一，就是硬道理 🏆。' }),

  // ── 一次性食用 ─────────────────────────────────────────
  item('ai-tokens-1m', '100 万 Token', 'purple', { consume: { label: '食用', stats: [{ stat: 'atkPct', value: 12 }, { stat: 'skillPct', value: 12 }], note: '永久 +12% 攻击与技能增伤。' }, note: '* 食用后永久获得 **12% 攻击** 与 **12% 技能增伤** 🪙。' }),
  item('ai-finetune', '全量微调', 'epic', { consume: { label: '食用', stats: [{ stat: 'hpPct', value: 15 }, { stat: 'armorPct', value: 15 }, { stat: 'mrPct', value: 15 }], note: '永久 +15% 气血与双抗。' }, note: '* 食用后永久获得 **15% 气血** 与 **15% 双抗** 🎛️。' }),
];

/**
 * 开局三选一（AI 包版）：按强度分档，弱的先出。
 * 房间开局三选一读取这里，确保奖励来自 AI 主题装备池。
 */
export const aiSwordTiers: readonly (readonly string[])[] = [
  ['ai-key', 'ai-token-pack', 'ai-prompt-tpl', 'ai-book-orient', 'ai-book-opensource'],
  ['ai-lora', 'ai-kvcache', 'ai-systemprompt', 'ai-vision', 'ai-temperature', 'ai-memory', 'ai-localdeploy', 'ai-cot'],
  ['ai-supercluster', 'ai-mcp', 'ai-subscription', 'ai-jailbreak', 'ai-sota'],
];
