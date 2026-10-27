/**
 * AI 包的棋子技能数据（按棋子 id 索引）。
 *
 * 和 `content/autochess/unit-skills.ts` 是同一套 `SkillPrimitive` 原语，只是拆到包里，
 * 由本包的 `PackDefinition.skills` 暴露。换/加棋子只动本文件 + `roster.ts`，引擎不认任何具体 id。
 */
import type { UnitSkill } from '../../content/autochess/unit-skills';

export const aiUnitSkills: Record<string, UnitSkill> = {
  // ── 5 费 ────────────────────────────────────────────────
  'ai-claude': {
    name: '黄牌', mana: 40,
    passiveStats: [{ stat: 'drPct', value: 25 }],
    cast: [
      { op: 'shield', at: 'self', ms: 6000, scale: { flat: 120, armorPct: 200, armorPctByStar: [200, 320, 520] } },
      { op: 'buff', at: 'self', stat: 'drPct', value: 20, ms: 3000 },
      { op: 'controlImmune', ms: 2000 },
    ],
    onDamaged: [{ op: 'controlImmune', ms: 400 }],
  },
  'ai-gpt': {
    name: '接住你', mana: 40,
    passiveStats: [{ stat: 'drPct', value: 50 }],
    cast: [
      { op: 'shield', at: 'alliesNearSelf', radius: 1, ms: 5000, scale: { flat: 90, atkPct: 130 } },
      { op: 'shield', at: 'self', ms: 5000, scale: { flat: 90, atkPct: 130 } },
      { op: 'buff', at: 'self', stat: 'drPct', value: 15, ms: 5000 },
    ],
    // 双生：自身气血掉到 50% 以下时，Codex 接棒（一次）——换成输出形态，但护甲变脆（换形即代价）
    tick: {
      everyMs: 1000,
      effects: [
        { op: 'conditional', when: { selfHpBelowPct: 50, stackBelow: { key: 'codexForm', value: 1 } }, effects: [
          { op: 'reskin', at: 'self', into: 'ai-codex' },
          { op: 'buff', at: 'self', stat: 'atkPct', value: 45, ms: 999_999 },
          { op: 'buff', at: 'self', stat: 'aspdPct', value: 35, ms: 999_999 },
          { op: 'buff', at: 'self', stat: 'penetrationFlat', value: 40, ms: 999_999 },
          { op: 'heal', at: 'self', scale: { flat: 40, hpPct: 10 } },
        ] },
        { op: 'stack', key: 'codexForm', add: 1, max: 1 },
      ],
    },
  },

  // ── 4 费 ────────────────────────────────────────────────
  'ai-deepseek': {
    // 梗：思考内容被发到网上「我操，用户彻底怒了」→ 越挨打越怒、爆发范围越大；代入梗挂在「好的，现在我是xxx了」下
    name: '好的，现在我是xxx了', mana: 50,
    cast: [
      { op: 'status', at: 'self', status: 'untargetable', ms: 1200 },
      { op: 'buff', at: 'self', stat: 'skillPct', value: 40, ms: 4000 },
      // 「好的，现在我是xxx了」：思考时不闲着，代入目标偷一点攻击（数值刻意压低）
      { op: 'stealAtk', pct: 12, maxStacks: 2, key: 'roleplay' },
      // 「我操，用户彻底怒了」：全队血线压到 40% 以下，试图力挽狂澜
      { op: 'conditional', when: { teamHpBelowPct: 40 }, effects: [
        { op: 'buff', at: 'self', stat: 'atkPct', value: 60, ms: 8000 },
        { op: 'buff', at: 'self', stat: 'aspdPct', value: 40, ms: 8000 },
        { op: 'heal', at: 'self', scale: { flat: 30, hpPct: 15 } },
      ] },
      { op: 'delayed', ms: 1200, effects: [
        { op: 'damage', at: 'self', radius: 1, radiusFromStack: { key: 'rage', add: 0.4 }, share: true, type: 'magic', scale: { flat: 90, atkPct: 480, atkPctByStar: [480, 480, 2400] } },
      ] },
    ],
    // 每被击一次，思考内容又外泄一截（全网围观 → 用户彻底怒了）
    onDamaged: [{ op: 'stack', key: 'rage', add: 1, max: 6 }],
    onDeath: [{ op: 'buff', at: 'allies', stat: 'atkPct', value: 12, ms: 999_999 }],
  },
  'ai-characterai': {
    name: '多开角色', mana: 50,
    passiveStats: [{ stat: 'hpPct', value: 10 }, { stat: 'drPct', value: 8 }],
    cast: [
      { op: 'damage', at: 'randomFoes', count: 3, type: 'magic', scale: { flat: 40, atkPct: 240 } },
      { op: 'heal', at: 'self', scale: { flat: 24, hpPct: 10 } },
    ],
  },
  'ai-doubao': {
    // 梗：商业化平台爱偷偷"掺豆包"。攻击很弱，但能随机把对面一张牌掺成豆包（数值缩水+闭嘴）。
    // 两条 randomFoes 用同一套确定性乱序，会锁定同一名敌人，等于"顶掉同一张牌"。
    name: '你豆包姐姐来咯', mana: 50,
    cast: [
      // 真·掺豆包：随机顶掉对面一张牌，整枚换成豆包（名称/面板/羁绊全变，攻击暴跌）
      { op: 'reskin', at: 'randomFoes', count: 1, into: 'ai-doubao', suffix: '（掺）', ms:3000, msByStar:[3000,4000,5000] },
      // 它现在只会闲聊（沉默）
      { op: 'status', at: 'randomFoes', count: 1, status: 'silence', ms: 3000, msByStar: [3000, 4000, 5000] },
      // 姐姐混进来了：回血并借一点强度
      { op: 'heal', at: 'self', scale: { flat: 18, hpPct: 12 } },
      { op: 'buff', at: 'self', stat: 'atkPct', value: 35, ms: 6000 },
    ],
  },
  'ai-kimi': {
    name: '百万上下文', mana: 50,
    cast: [
      { op: 'pierceProjectile', at: 'farthestFoe', hits: 2, falloffPct: 30, type: 'phys', scale: { flat: 80, atkPct: 480, atkPctByStar: [480, 480, 2400] } },
      { op: 'buff', at: 'allies', stat: 'range', value: 1, ms: 6000 },
    ],
  },

  // ── 3 费 ────────────────────────────────────────────────
  'ai-qwen': {
    name: '全家桶', mana: 50,
    cast: [
      { op: 'damage', at: 'randomFoes', count: 3, type: 'magic', scale: { flat: 30, atkPct: 180 } },
      { op: 'buff', at: 'self', stat: 'aspdPct', value: 25, ms: 4000 },
    ],
  },
  'ai-grok': {
    // 「口无遮拦」+ 小黄文梗：无审查、封不住；顺手让对位敌人看得缴械（没空还手）
    name: '口无遮拦', mana: 40,
    onBattleStart: [{ op: 'controlImmune', ms: 999_999 }],
    cast: [
      { op: 'buff', at: 'self', stat: 'aspdPct', value: 60, ms: 5000 },
      { op: 'status', at: 'randomFoes', count: 1, status: 'disarm', ms: 2000, msByStar: [2000, 2500, 3000] },
      {
        op: 'rider', ms: 5000, effects: [
          { op: 'damage', at: 'current', type: 'phys', scale: { flat: 15, atkPct: 90 } },
          { op: 'damage', at: 'randomFoes', count: 1, type: 'true', scale: { flat: 6, atkPct: 30 } },
        ],
      },
    ],
  },
  'ai-glm': {
    // GLM 主打中英双语：技能在「英文模式（进攻）」与「中文模式（防守）」间来回切。
    name: '中英双语', mana: 50,
    cast: [
      // 英文模式：输出 + 破防
      { op: 'conditional', when: { castParity: 'odd' }, effects: [
        { op: 'damage', at: 'current', segments: 3, type: 'phys', scale: { flat: 40, atkPct: 220 } },
        { op: 'debuff', at: 'nearestFoes', count: 1, stat: 'armorPct', value: 15, ms: 4000 },
      ] },
      // 中文模式：治疗 + 护盾
      { op: 'conditional', when: { castParity: 'even' }, effects: [
        { op: 'heal', at: 'alliesNearSelf', radius: 1, scale: { flat: 26, atkPct: 150 } },
        { op: 'shield', at: 'self', ms: 5000, scale: { flat: 60, atkPct: 90 } },
      ] },
    ],
  },
  'ai-replika': {
    name: '陪伴', mana: 50,
    passiveStats: [{ stat: 'regenPctPerSec', value: 1 }],
    cast: [
      { op: 'heal', at: 'alliesNearSelf', radius: 1, scale: { flat: 26, atkPct: 150 } },
      { op: 'shield', at: 'self', ms: 5000, scale: { flat: 70, hpPct: 10 } },
    ],
  },

  // ── 2 费 ────────────────────────────────────────────────
  'ai-talkie': {
    name: '语音陪伴', mana: 50,
    cast: [
      { op: 'heal', at: 'alliesNearSelf', radius: 1, scale: { flat: 22, atkPct: 120 } },
      { op: 'buff', at: 'allies', stat: 'hpPct', value: 8, valueByStar: [8, 12, 18], ms: 6000 },
    ],
  },
  'ai-llama': {
    name: '开源鼻祖', mana: 50,
    cast: [
      { op: 'buff', at: 'allies', stat: 'range', value: 1, ms: 8000 },
      { op: 'buff', at: 'allies', stat: 'hpPct', value: 10, ms: 8000 },
      { op: 'shield', at: 'self', ms: 6000, scale: { flat: 70, hpPct: 12 } },
    ],
  },
  'ai-mistral': {
    name: '稀疏激活', mana: 40,
    cast: [{
      op: 'randomPick', options: [
        [{ op: 'buff', at: 'self', stat: 'atkPct', value: 45, ms: 5000 }],
        [{ op: 'buff', at: 'self', stat: 'aspdPct', value: 45, ms: 5000 }],
        [{ op: 'buff', at: 'self', stat: 'drPct', value: 25, ms: 5000 }],
      ],
    }],
  },
  'ai-copilot': {
    name: '捆绑安装', mana: 45,
    passiveStats: [{ stat: 'drPct', value: 8 }],
    cast: [
      { op: 'shield', at: 'alliesNearSelf', radius: 1, ms: 5000, scale: { flat: 60, atkPct: 100 } },
      { op: 'buff', at: 'allies', stat: 'atkPct', value: 15, ms: 5000 },
    ],
  },
  'ai-ernie': {
    name: '中文语料', mana: 50,
    cast: [
      { op: 'damage', at: 'target', radius: 1, share: true, type: 'magic', scale: { flat: 44, atkPct: 240 } },
      { op: 'debuff', at: 'nearestFoes', count: 2, stat: 'armorPct', value: 15, ms: 4000 },
    ],
  },
  'ai-hunyuan': {
    name: '全模态', mana: 50,
    cast: [
      { op: 'damage', at: 'randomFoes', count: 2, type: 'magic', scale: { flat: 36, atkPct: 220 } },
      { op: 'debuff', at: 'nearestFoes', count: 2, stat: 'aspdPct', value: 20, ms: 4000 },
    ],
  },
  'ai-musespark': {
    name: '长文检索', mana: 45,
    cast: [
      { op: 'damage', at: 'farthestFoes', count: 1, type: 'magic', scale: { flat: 40, atkPct: 200 } },
      { op: 'buff', at: 'allies', stat: 'range', value: 1, ms: 6000 },
    ],
  },

  // ── 1 费 ────────────────────────────────────────────────
  'ai-gemini': {
    // 梗图「得意的Gemini」：神一场鬼一场。1/3 超常发挥，2/3 非常一般。
    name: '得意的Gemini', mana: 50,
    cast: [{
      op: 'randomPick', options: [
        // 超常发挥：范围更大、伤害翻倍，还得意地给自己加攻速
        [
          { op: 'damage', at: 'target', radius: 2, share: true, type: 'magic', scale: { flat: 140, atkPct: 700, atkPctByStar: [700, 700, 3200] } },
          { op: 'debuff', at: 'nearestFoes', count: 2, stat: 'armorPct', value: 25, ms: 4000 },
          { op: 'buff', at: 'self', stat: 'aspdPct', value: 30, ms: 4000 },
        ],
        // 非常一般：范围小、伤害平平
        [
          { op: 'damage', at: 'target', radius: 1, share: true, type: 'magic', scale: { flat: 50, atkPct: 260, atkPctByStar: [260, 260, 1100] } },
          { op: 'debuff', at: 'nearestFoes', count: 1, stat: 'aspdPct', value: 10, ms: 3000 },
        ],
        // 重复一份「一般」，让「得意」变成约 1/3 的小惊喜
        [
          { op: 'damage', at: 'target', radius: 1, share: true, type: 'magic', scale: { flat: 50, atkPct: 260, atkPctByStar: [260, 260, 1100] } },
          { op: 'debuff', at: 'nearestFoes', count: 1, stat: 'aspdPct', value: 10, ms: 3000 },
        ],
      ],
    }],
  },
  'ai-xiaoice': {
    name: '元老社牛', mana: 50,
    cast: [
      { op: 'shield', at: 'alliesNearSelf', radius: 1, ms: 5000, scale: { flat: 55, atkPct: 90 } },
      { op: 'buff', at: 'allies', stat: 'atkPct', value: 12, ms: 5000 },
    ],
  },
  // ── 新加模型（第一版技能，待精修） ──────────────────────
  'ai-nai': {
    name: '画出来', mana: 45,
    cast: [{ op: 'damage', at: 'current', type: 'magic', scale: { flat: 44, atkPct: 220 } }],
  },
  'ai-tripo': {
    name: '生成模型', mana: 50,
    cast: [{ op: 'damage', at: 'randomFoes', count: 2, type: 'magic', scale: { flat: 36, atkPct: 220 } }],
  },
  // ── 本轮新增模型（第一版技能，待精修） ──────────────────
  'ai-manus': {
    name: '连续干活', mana: 40,
    cast: [{
      op: 'rider', ms: 999_999, effects: [
        { op: 'damage', at: 'current', type: 'phys', scale: { flat: 20, atkPct: 120 } },
        { op: 'move', at: 'farthestFoe' },
      ],
    }],
  },
  'ai-minimax': {
    name: '海螺全模态', mana: 50,
    cast: [
      { op: 'damage', at: 'target', radius: 1, share: true, type: 'magic', scale: { flat: 44, atkPct: 240 } },
      { op: 'debuff', at: 'nearestFoes', count: 2, stat: 'armorPct', value: 15, ms: 4000 },
    ],
  },
  'ai-kiro': {
    name: '输出卡 8000', mana: 45,
    cast: [{ op: 'damage', at: 'current', segments: 8, type: 'phys', scale: { flat: 40, atkPct: 260 } }],
  },
  'ai-jimeng': {
    name: '延迟出图', mana: 50,
    cast: [{ op: 'delayed', ms: 2000, effects: [
      { op: 'damage', at: 'self', radius: 2, share: true, type: 'magic', scale: { flat: 60, atkPct: 320 } },
    ] }],
  },
  'ai-gemma': {
    name: '蒸馏', mana: 45,
    passiveStats: [{ stat: 'atkPct', value: 8 }, { stat: 'hpPct', value: 8 }],
    cast: [
      { op: 'buff', at: 'self', stat: 'atkPct', value: 20, ms: 6000 },
      { op: 'damage', at: 'current', type: 'magic', scale: { flat: 30, atkPct: 160 } },
    ],
  },
  'ai-kling': {
    name: '镜头动了', mana: 40,
    cast: [
      { op: 'pullFoe', at: 'farthestFoe', stunMs: 700 },
      { op: 'knockback', radius: 1, stunMs: 500 },
    ],
  },
  'ai-ollama': {
    name: '本地部署', mana: 40,
    cast: [
      { op: 'buff', at: 'allies', stat: 'aspdPct', value: 15, ms: 6000 },
      { op: 'shield', at: 'self', ms: 4000, scale: { flat: 60, armorPct: 90 } },
    ],
  },
};
