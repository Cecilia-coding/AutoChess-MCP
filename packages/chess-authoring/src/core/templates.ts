import type { ChessPackInput } from "./schema.js";

export const growthPresets = {
  endurance: {
    name: "持久作战",
    health: [1, 2, 8],
    attack: [1, 1, 1],
    damage: [1, 1, 1],
    healing: [1, 1, 1],
    shield: [1, 1, 1],
    controlDuration: [1, 1, 1],
  },
  balanced: {
    name: "均衡成长",
    health: [1, 1.8, 3.24],
    attack: [1, 1.5, 2.25],
    damage: [1, 1.5, 2.25],
    healing: [1, 1.5, 2.25],
    shield: [1, 1.5, 2.25],
    controlDuration: [1, 1, 1],
  },
  skill: {
    name: "技能驱动",
    health: [1, 1.8, 3.24],
    attack: [1, 1, 1],
    damage: [1, 1.8, 3.24],
    healing: [1, 1.8, 3.24],
    shield: [1, 1.8, 3.24],
    controlDuration: [1, 1, 1],
  },
} as const;

/** Demonstration content only. Never installed into the existing pack registry. */
export const examplePack: ChessPackInput = {
  schemaVersion: "1",
  name: "春日棋谱",
  description: "持续作战与相互保护的创作示例",
  rules: {
    baseTemplate: "standard_v1",
    starGrowth: {
      health: [1, 2, 8],
      attack: [1, 1, 1],
      damage: [1, 1, 1],
      healing: [1, 1, 1],
      shield: [1, 1, 1],
      controlDuration: [1, 1, 1],
    },
    skillStatBasis: "one_star",
  },
  units: [
    {
      id: "spring_guard",
      name: "芽卫",
      cost: 1,
      role: "tank",
      stats: {
        health: 900,
        attack: 45,
        attackIntervalMs: 1400,
        range: 1,
        armor: 30,
        magicResist: 20,
      },
      skill: {
        name: "新叶护身",
        trigger: { type: "battle_start" },
        target: { team: "self", selector: "nearest", count: 1 },
        effects: [{ type: "shield", amount: { flat: 100, healthRatio: 0.1 }, durationMs: 6000 }],
      },
    },
    {
      id: "spring_healer",
      name: "春芽",
      cost: 2,
      role: "support",
      stats: { health: 600, attack: 30, attackIntervalMs: 1200, range: 3 },
      skill: {
        name: "回春",
        trigger: { type: "interval", intervalMs: 5000 },
        target: { team: "ally", selector: "lowest_health_ratio", count: 1, includeSelf: true },
        effects: [{ type: "heal", amount: { flat: 120 } }],
      },
    },
    {
      id: "spring_archer",
      name: "青弦",
      cost: 3,
      role: "ranged",
      stats: { health: 650, attack: 60, attackIntervalMs: 1000, range: 4 },
      skill: {
        name: "穿叶",
        trigger: { type: "every_attacks", count: 3 },
        target: { team: "enemy", selector: "current", count: 1 },
        effects: [{ type: "damage", damageType: "physical", amount: { flat: 20, attackRatio: 2 } }],
      },
    },
  ],
};

export const contractNotes = {
  stage: "authoring_trial",
  growth: "成长表仅属于 rules；全体棋子共用。一星倍率为 1，数组依次对应一、二、三星。",
  amount:
    "(flat + 一星施法者攻击 × attackRatio + 一星施法者生命 × healthRatio) × 对应效果星级倍率；只乘一次。",
  ratio: "系数与百分比使用小数：200% = 2，10% = 0.1。",
  timing:
    "时间统一为毫秒。护盾持续时间、属性变化数值与持续时间、攻击间隔、施法间隔、目标数量在所有星级保持不变。",
  evaluation:
    "预览给出减伤前伤害、未扣除过量治疗的治疗量、护盾初始值。控制时长使用 controlDuration 成长表。",
  defaults:
    "省略 description 为空字符串，role 为 caster，armor/magicResist 为 0；amount 缺省项为 0，includeSelf 为 false，startMana 为 0。保存和导出包含这些补全值。",
  template:
    "standard_v1 确定三档星级、1–5费和固定基础属性口径。独立试下局支持商店、合成、布阵和既有引擎战斗；完整试下规则由棋局响应 rules 返回。",
  portability:
    "棋谱 JSON 只含规则和内容。草稿 ID、访问密钥、修订号、存储路径和宿主身份由接入层管理。",
};
