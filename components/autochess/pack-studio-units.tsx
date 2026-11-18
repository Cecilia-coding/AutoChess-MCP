'use client';

import { useState } from 'react';
import { roleLabel } from '@/content/autochess/roles';
import type { Role } from '@/content/autochess/types';
import { analyzeStudioPack, analyzeStudioUnit, roleBaselineStats } from '@/lib/pack-studio/balance';
import {
  STUDIO_ROLES,
  STUDIO_SKILL_TARGETS,
  STUDIO_STAT_KEYS,
  type CustomPackV1,
  type StudioSkillEffect,
  type StudioUnitDef,
} from '@/lib/pack-studio/schema';
import {
  STUDIO_ORIGINAL_SPRITES,
  STUDIO_SPRITES,
  studioSpriteById,
  type StudioSpriteStyle,
} from '@/lib/pack-studio/sprites';

const TARGET_LABELS: Record<(typeof STUDIO_SKILL_TARGETS)[number], string> = {
  current_enemy: '当前普攻目标',
  nearest_enemies: '最近 N 名敌军',
  farthest_enemy: '最远敌方棋子',
  lowest_hp_ally: '血量最低友军',
  self: '自身',
  all_enemies: '全场敌军',
  all_allies: '全场友军',
};

const RATING_LABELS = {
  balanced: '均衡',
  overtuned: '偏强',
  undertuned: '偏弱',
} as const;

export function UnitBalancePanel({
  pack,
  selectedUnitId,
  onSelectUnit,
  onChangePack,
}: {
  pack: CustomPackV1;
  selectedUnitId: string;
  onSelectUnit: (unitId: string) => void;
  onChangePack: (next: CustomPackV1, summary: string) => void;
}) {
  const [inspectStar, setInspectStar] = useState<1 | 2 | 3>(1);
  const [spriteDrawerOpen, setSpriteDrawerOpen] = useState(false);
  const [spriteFilter, setSpriteFilter] = useState<StudioSpriteStyle>('studio');

  const analysis = analyzeStudioPack(pack);
  const selectedUnit =
    pack.units.find((u) => u.id === selectedUnitId) ?? pack.units[0] ?? null;
  const traitNameById = new Map(pack.traits.map((t) => [t.id, t.name]));

  const updateUnit = (patch: Partial<StudioUnitDef>, summary: string) => {
    if (!selectedUnit) return;
    const nextUnits = pack.units.map((u) =>
      u.id === selectedUnit.id ? { ...u, ...patch } : u,
    );
    onChangePack({ ...pack, units: nextUnits }, summary);
  };

  const addNewUnit = () => {
    const id = `u-${Date.now().toString(36).slice(-5)}`;
    const defaultSprite =
      STUDIO_ORIGINAL_SPRITES[pack.units.length % STUDIO_ORIGINAL_SPRITES.length]!;
    const role: Role = defaultSprite.suggestedRole;
    const cost: 1 | 2 | 3 | 4 | 5 = pack.units.some((u) => u.cost === 1) ? 2 : 1;
    const stats = roleBaselineStats(cost, role);
    const created: StudioUnitDef = {
      id,
      name: `新棋子${pack.units.length + 1}`,
      cost,
      role,
      spriteId: defaultSprite.id,
      factions: pack.traits.filter((t) => t.kind === 'faction').slice(0, 1).map((t) => t.id),
      jobs: pack.traits.filter((t) => t.kind === 'job').slice(0, 1).map((t) => t.id),
      stats,
      skill: {
        name: '基础招式',
        description: '对当前目标造成技能伤害',
        trigger: { kind: 'mana', maxMana: 75 },
        target: 'current_enemy',
        targetCount: 1,
        effects: [
          {
            kind: 'damage',
            damageType: role === 'caster' ? 'magic' : 'phys',
            baseByStar: [150, 260, 440],
            atkPct: 180,
          },
        ],
      },
    };
    onChangePack({ ...pack, units: [...pack.units, created] }, `新增棋子「${created.name}」`);
    onSelectUnit(id);
    setSpriteDrawerOpen(false);
  };

  const removeSelectedUnit = () => {
    if (!selectedUnit) return;
    const remaining = pack.units.filter((u) => u.id !== selectedUnit.id);
    onChangePack({ ...pack, units: remaining }, `移除棋子「${selectedUnit.name}」`);
    if (remaining[0]) onSelectUnit(remaining[0].id);
  };

  const budgetById = new Map(analysis.unitBudgets.map((b) => [b.id, b]));
  const maxHist = Math.max(1, ...Object.values(analysis.costHistogram));

  const unitAnalysis = selectedUnit
    ? analyzeStudioUnit(selectedUnit, pack.starGrowth, inspectStar)
    : null;

  const filteredSprites = STUDIO_SPRITES.filter((s) => s.style === spriteFilter);

  const toggleTrait = (field: 'factions' | 'jobs', traitId: string) => {
    if (!selectedUnit) return;
    const exists = selectedUnit[field].includes(traitId);
    const nextList = exists
      ? selectedUnit[field].filter((id) => id !== traitId)
      : [...selectedUnit[field], traitId];
    updateUnit({ [field]: nextList }, `调整「${selectedUnit.name}」羁绊`);
  };

  const updateEffectAt = (index: number, nextEffect: StudioSkillEffect) => {
    if (!selectedUnit) return;
    const effects = selectedUnit.skill.effects.map((eff, i) => (i === index ? nextEffect : eff));
    updateUnit(
      { skill: { ...selectedUnit.skill, effects } },
      `更新「${selectedUnit.name}」技能效果`,
    );
  };

  const switchEffectKind = (index: number, kind: StudioSkillEffect['kind']) => {
    if (!selectedUnit) return;
    const fallback: StudioSkillEffect =
      kind === 'damage'
        ? { kind: 'damage', damageType: 'magic', baseByStar: [160, 270, 460], atkPct: 180 }
        : kind === 'shield'
          ? { kind: 'shield', baseByStar: [160, 270, 460], hpPct: 10, durationMs: 4000 }
          : kind === 'heal'
            ? { kind: 'heal', baseByStar: [150, 250, 420], hpPct: 8 }
            : kind === 'stun'
              ? { kind: 'stun', durationMsByStar: [800, 1100, 1500] }
              : kind === 'stat_buff'
                ? { kind: 'stat_buff', stat: 'atkPct', value: 20, durationMs: 4000 }
                : { kind: 'stat_debuff', stat: 'armor', value: 20, durationMs: 4000 };
    updateEffectAt(index, fallback);
  };

  return (
    <div className="ps-panel">
      <div className="ps-units-grid">
        {/* Left column: Roster & Cost Histogram */}
        <div className="ps-box">
          <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ borderBottom: 'none', paddingBottom: 0 }}>棋子名册（{pack.units.length}）</h4>
            <button type="button" className="ps-btn ps-btn--primary" onClick={addNewUnit}>
              + 新建棋子
            </button>
          </div>
          <div className="ps-histo" aria-label="1到5费费用分布直方图">
            {([1, 2, 3, 4, 5] as const).map((cost) => (
              <div key={cost} className="ps-histo-col">
                <div
                  className="ps-histo-bar"
                  style={{ height: `${Math.max(4, Math.round((analysis.costHistogram[cost] / maxHist) * 28))}px` }}
                  title={`${cost}费：${analysis.costHistogram[cost]} 枚`}
                />
                <span>{cost}费:{analysis.costHistogram[cost]}</span>
              </div>
            ))}
          </div>
          <div className="ps-unit-rail">
            {pack.units.map((unit) => {
              const sprite = studioSpriteById(unit.spriteId);
              const budget = budgetById.get(unit.id);
              const active = selectedUnit?.id === unit.id;
              const traitLabel = [...unit.factions, ...unit.jobs]
                .map((tid) => traitNameById.get(tid))
                .filter(Boolean)
                .join('·');
              return (
                <button
                  key={unit.id}
                  type="button"
                  className={`ps-unit-row ${active ? 'is-active' : ''}`}
                  onClick={() => onSelectUnit(unit.id)}
                >
                  {sprite ? <img className="ps-sprite-thumb" src={sprite.portraitUrl} alt="" /> : null}
                  <div>
                    <strong>{unit.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--ft-muted)' }}>
                      {unit.cost}费 · {roleLabel[unit.role]}
                      {traitLabel ? ` · ${traitLabel}` : ''}
                    </div>
                  </div>
                  {budget ? (
                    <span className={`ps-budget-pill is-${budget.rating}`}>
                      {budget.budgetRatioPct}%
                    </span>
                  ) : null}
                </button>
              );
            })}
            {!pack.units.length ? (
              <p style={{ fontSize: 12, color: 'var(--ft-muted)', margin: 0 }}>
                当前还没有棋子，点右上角「+ 新建棋子」开始捏第一张牌。
              </p>
            ) : null}
          </div>
        </div>

        {/* Center column: Selected Unit Editor */}
        {selectedUnit ? (
          <div className="ps-box">
            <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
              <div className="ps-field-row">
                {studioSpriteById(selectedUnit.spriteId) ? (
                  <img
                    className="ps-sprite-thumb"
                    style={{ width: 38, height: 38 }}
                    src={studioSpriteById(selectedUnit.spriteId)!.portraitUrl}
                    alt=""
                  />
                ) : null}
                <div>
                  <strong>{selectedUnit.name}</strong>
                  <div style={{ fontSize: 11, color: 'var(--ft-muted)' }}>ID: {selectedUnit.id}</div>
                </div>
              </div>
              <div className="ps-field-row">
                <button
                  type="button"
                  className="ps-btn"
                  onClick={() => setSpriteDrawerOpen((open) => !open)}
                >
                  {spriteDrawerOpen ? '收起像素外观库' : '更换像素小人（20原创+官包）'}
                </button>
                <button type="button" className="ps-btn ps-btn--danger" onClick={removeSelectedUnit}>
                  删除棋子
                </button>
              </div>
            </div>

            {spriteDrawerOpen ? (
              <div>
                <div className="ps-field-row" style={{ marginBottom: 6 }}>
                  {([
                    { id: 'studio', label: '原创像素小人 (20)' },
                    { id: 'ai', label: '借用·AI包 (29)' },
                    { id: 'jianghu', label: '借用·江湖包 (40)' },
                  ] as const).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`ps-btn ${spriteFilter === tab.id ? 'ps-btn--active' : ''}`}
                      onClick={() => setSpriteFilter(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="ps-sprite-picker-grid">
                  {filteredSprites.map((sprite) => (
                    <button
                      key={sprite.id}
                      type="button"
                      className={`ps-sprite-option ${selectedUnit.spriteId === sprite.id ? 'is-active' : ''}`}
                      onClick={() => {
                        updateUnit(
                          { spriteId: sprite.id },
                          `将「${selectedUnit.name}」像素外观设为 ${sprite.label}`,
                        );
                        setSpriteDrawerOpen(false);
                      }}
                    >
                      <img className="ps-sprite-thumb" style={{ width: 34, height: 34 }} src={sprite.portraitUrl} alt="" />
                      <span>{sprite.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ps-field-grid">
              <label className="ps-field">
                <span>棋子名称</span>
                <input
                  className="ps-input"
                  value={selectedUnit.name}
                  maxLength={20}
                  onChange={(e) => updateUnit({ name: e.target.value || '未命名' }, '修改棋子名称')}
                />
              </label>
              <label className="ps-field">
                <span>费用</span>
                <select
                  className="ps-select"
                  value={selectedUnit.cost}
                  onChange={(e) =>
                    updateUnit(
                      { cost: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 },
                      `修改「${selectedUnit.name}」费用为 ${e.target.value} 费`,
                    )
                  }
                >
                  {[1, 2, 3, 4, 5].map((c) => (
                    <option key={c} value={c}>{c} 费</option>
                  ))}
                </select>
              </label>
              <label className="ps-field">
                <span>战术定位</span>
                <select
                  className="ps-select"
                  value={selectedUnit.role}
                  onChange={(e) =>
                    updateUnit(
                      { role: e.target.value as Role },
                      `修改「${selectedUnit.name}」定位`,
                    )
                  }
                >
                  {STUDIO_ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabel[r]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>1★ 基础六维面板</span>
              <button
                type="button"
                className="ps-btn ps-btn--butter"
                onClick={() => {
                  const base = roleBaselineStats(selectedUnit.cost, selectedUnit.role);
                  updateUnit(
                    { stats: base },
                    `将「${selectedUnit.name}」面板重置为 ${selectedUnit.cost}费${roleLabel[selectedUnit.role]}标准值`,
                  );
                }}
              >
                填入同费同定位基准值
              </button>
            </div>

            <div className="ps-field-grid">
              <label className="ps-field">
                <span>气血 HP</span>
                <input
                  type="number"
                  className="ps-input"
                  min={100}
                  max={20000}
                  step={10}
                  value={selectedUnit.stats.hp}
                  onChange={(e) =>
                    updateUnit(
                      { stats: { ...selectedUnit.stats, hp: Math.max(100, Number(e.target.value) || 100) } },
                      '调整棋子生命',
                    )
                  }
                />
              </label>
              <label className="ps-field">
                <span>攻击 ATK</span>
                <input
                  type="number"
                  className="ps-input"
                  min={5}
                  max={3000}
                  step={2}
                  value={selectedUnit.stats.atk}
                  onChange={(e) =>
                    updateUnit(
                      { stats: { ...selectedUnit.stats, atk: Math.max(5, Number(e.target.value) || 5) } },
                      '调整棋子攻击',
                    )
                  }
                />
              </label>
              <label className="ps-field">
                <span>护甲 Armor</span>
                <input
                  type="number"
                  className="ps-input"
                  min={0}
                  max={500}
                  step={5}
                  value={selectedUnit.stats.armor}
                  onChange={(e) =>
                    updateUnit(
                      { stats: { ...selectedUnit.stats, armor: Math.max(0, Number(e.target.value) || 0) } },
                      '调整棋子护甲',
                    )
                  }
                />
              </label>
              <label className="ps-field">
                <span>魔抗 MR</span>
                <input
                  type="number"
                  className="ps-input"
                  min={0}
                  max={500}
                  step={5}
                  value={selectedUnit.stats.mr}
                  onChange={(e) =>
                    updateUnit(
                      { stats: { ...selectedUnit.stats, mr: Math.max(0, Number(e.target.value) || 0) } },
                      '调整棋子魔抗',
                    )
                  }
                />
              </label>
              <label className="ps-field">
                <span>攻速 ASPD (/秒)</span>
                <input
                  type="number"
                  className="ps-input"
                  min={0.2}
                  max={4}
                  step={0.05}
                  value={selectedUnit.stats.aspd}
                  onChange={(e) =>
                    updateUnit(
                      { stats: { ...selectedUnit.stats, aspd: Math.min(4, Math.max(0.2, Number(e.target.value) || 0.7)) } },
                      '调整棋子攻速',
                    )
                  }
                />
              </label>
              <label className="ps-field">
                <span>射程 Range (格)</span>
                <input
                  type="number"
                  className="ps-input"
                  min={1}
                  max={6}
                  step={1}
                  value={selectedUnit.stats.range}
                  onChange={(e) =>
                    updateUnit(
                      { stats: { ...selectedUnit.stats, range: Math.min(6, Math.max(1, Math.round(Number(e.target.value) || 1))) } },
                      '调整棋子射程',
                    )
                  }
                />
              </label>
            </div>

            <div className="ps-field">
              <span>阵营羁绊</span>
              <div className="ps-field-row">
                {pack.traits.filter((t) => t.kind === 'faction').map((trait) => {
                  const active = selectedUnit.factions.includes(trait.id);
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      className={`ps-btn ${active ? 'ps-btn--primary' : ''}`}
                      onClick={() => toggleTrait('factions', trait.id)}
                    >
                      {active ? '✓ ' : ''}{trait.name}
                    </button>
                  );
                })}
                {!pack.traits.some((t) => t.kind === 'faction') ? (
                  <small style={{ color: 'var(--ft-muted)' }}>尚未创建阵营羁绊，可去「② 羁绊交叉网」添加</small>
                ) : null}
              </div>
            </div>

            <div className="ps-field">
              <span>职业羁绊</span>
              <div className="ps-field-row">
                {pack.traits.filter((t) => t.kind === 'job').map((trait) => {
                  const active = selectedUnit.jobs.includes(trait.id);
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      className={`ps-btn ${active ? 'ps-btn--primary' : ''}`}
                      onClick={() => toggleTrait('jobs', trait.id)}
                    >
                      {active ? '✓ ' : ''}{trait.name}
                    </button>
                  );
                })}
                {!pack.traits.some((t) => t.kind === 'job') ? (
                  <small style={{ color: 'var(--ft-muted)' }}>尚未创建职业羁绊，可去「② 羁绊交叉网」添加</small>
                ) : null}
              </div>
            </div>

            <h4>技能设计</h4>
            <div className="ps-field-grid">
              <label className="ps-field">
                <span>技能名</span>
                <input
                  className="ps-input"
                  value={selectedUnit.skill.name}
                  maxLength={24}
                  onChange={(e) =>
                    updateUnit(
                      { skill: { ...selectedUnit.skill, name: e.target.value || '技能' } },
                      '修改技能名',
                    )
                  }
                />
              </label>
              <label className="ps-field">
                <span>触发机制</span>
                <select
                  className="ps-select"
                  value={selectedUnit.skill.trigger.kind}
                  onChange={(e) => {
                    const kind = e.target.value as StudioUnitDef['skill']['trigger']['kind'];
                    const trigger =
                      kind === 'mana'
                        ? ({ kind: 'mana', maxMana: 75 } as const)
                        : kind === 'every_attacks'
                          ? ({ kind: 'every_attacks', count: 3 } as const)
                          : kind === 'battle_start'
                            ? ({ kind: 'battle_start' } as const)
                            : ({ kind: 'interval', everyMs: 3000 } as const);
                    updateUnit({ skill: { ...selectedUnit.skill, trigger } }, '更换技能触发方式');
                  }}
                >
                  <option value="mana">满蓝条施法（典型主动）</option>
                  <option value="every_attacks">第 N 次普攻被动</option>
                  <option value="battle_start">开战 0 秒瞬发被动</option>
                  <option value="interval">每隔 X 毫秒周期触发</option>
                </select>
              </label>

              {selectedUnit.skill.trigger.kind === 'mana' ? (
                <label className="ps-field">
                  <span>最大蓝条 (10~300)</span>
                  <input
                    type="number"
                    className="ps-input"
                    min={10}
                    max={300}
                    step={5}
                    value={selectedUnit.skill.trigger.maxMana}
                    onChange={(e) => {
                      const maxMana = Math.min(300, Math.max(10, Math.round(Number(e.target.value) || 75)));
                      updateUnit(
                        {
                          skill: {
                            ...selectedUnit.skill,
                            trigger: {
                              kind: 'mana',
                              maxMana,
                              ...(selectedUnit.skill.trigger.kind === 'mana' && selectedUnit.skill.trigger.startMana !== undefined
                                ? { startMana: selectedUnit.skill.trigger.startMana }
                                : {}),
                            },
                          },
                        },
                        '调整技能蓝耗',
                      );
                    }}
                  />
                </label>
              ) : selectedUnit.skill.trigger.kind === 'every_attacks' ? (
                <label className="ps-field">
                  <span>每几刀触发 (2~12)</span>
                  <input
                    type="number"
                    className="ps-input"
                    min={2}
                    max={12}
                    value={selectedUnit.skill.trigger.count}
                    onChange={(e) =>
                      updateUnit(
                        {
                          skill: {
                            ...selectedUnit.skill,
                            trigger: { kind: 'every_attacks', count: Math.min(12, Math.max(2, Math.round(Number(e.target.value) || 3))) },
                          },
                        },
                        '调整普攻被动次数',
                      )
                    }
                  />
                </label>
              ) : selectedUnit.skill.trigger.kind === 'interval' ? (
                <label className="ps-field">
                  <span>触发间隔 ms</span>
                  <input
                    type="number"
                    className="ps-input"
                    min={500}
                    max={15000}
                    step={250}
                    value={selectedUnit.skill.trigger.everyMs}
                    onChange={(e) =>
                      updateUnit(
                        {
                          skill: {
                            ...selectedUnit.skill,
                            trigger: { kind: 'interval', everyMs: Math.min(15000, Math.max(500, Math.round(Number(e.target.value) || 3000))) },
                          },
                        },
                        '调整周期触发间隔',
                      )
                    }
                  />
                </label>
              ) : null}

              <label className="ps-field">
                <span>作用目标</span>
                <select
                  className="ps-select"
                  value={selectedUnit.skill.target}
                  onChange={(e) =>
                    updateUnit(
                      { skill: { ...selectedUnit.skill, target: e.target.value as StudioUnitDef['skill']['target'] } },
                      '调整技能目标',
                    )
                  }
                >
                  {STUDIO_SKILL_TARGETS.map((tgt) => (
                    <option key={tgt} value={tgt}>{TARGET_LABELS[tgt]}</option>
                  ))}
                </select>
              </label>

              <label className="ps-field">
                <span>目标数量</span>
                <input
                  type="number"
                  className="ps-input"
                  min={1}
                  max={10}
                  value={selectedUnit.skill.targetCount}
                  onChange={(e) =>
                    updateUnit(
                      { skill: { ...selectedUnit.skill, targetCount: Math.min(10, Math.max(1, Math.round(Number(e.target.value) || 1))) } },
                      '调整目标数',
                    )
                  }
                />
              </label>
            </div>

            <label className="ps-field">
              <span>技能说明</span>
              <input
                className="ps-input"
                value={selectedUnit.skill.description}
                maxLength={160}
                onChange={(e) =>
                  updateUnit(
                    { skill: { ...selectedUnit.skill, description: e.target.value } },
                    '修改技能描述',
                  )
                }
              />
            </label>

            {selectedUnit.skill.effects.map((eff, idx) => (
              <div key={idx} className="ps-step-block" style={{ padding: 8 }}>
                <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
                  <div className="ps-field-row">
                    <strong>效果 #{idx + 1}</strong>
                    <select
                      className="ps-select"
                      value={eff.kind}
                      onChange={(e) => switchEffectKind(idx, e.target.value as StudioSkillEffect['kind'])}
                    >
                      <option value="damage">造成伤害</option>
                      <option value="shield">施加护盾</option>
                      <option value="heal">回复生命</option>
                      <option value="stun">控制眩晕</option>
                      <option value="stat_buff">属性增益</option>
                      <option value="stat_debuff">属性削弱</option>
                    </select>
                  </div>
                  {selectedUnit.skill.effects.length > 1 ? (
                    <button
                      type="button"
                      className="ps-btn ps-btn--danger"
                      onClick={() =>
                        updateUnit(
                          { skill: { ...selectedUnit.skill, effects: selectedUnit.skill.effects.filter((_, i) => i !== idx) } },
                          '移除一条技能效果',
                        )
                      }
                    >
                      删除效果
                    </button>
                  ) : null}
                </div>

                {eff.kind === 'damage' ? (
                  <div className="ps-field-grid">
                    <label className="ps-field">
                      <span>伤害类型</span>
                      <select
                        className="ps-select"
                        value={eff.damageType}
                        onChange={(e) =>
                          updateEffectAt(idx, { ...eff, damageType: e.target.value as 'phys' | 'magic' | 'true' })
                        }
                      >
                        <option value="phys">物理（算护甲）</option>
                        <option value="magic">法术（算魔抗）</option>
                        <option value="true">真实伤害</option>
                      </select>
                    </label>
                    <label className="ps-field">
                      <span>攻击力加成%</span>
                      <input
                        type="number"
                        className="ps-input"
                        min={0}
                        max={1200}
                        value={eff.atkPct}
                        onChange={(e) => updateEffectAt(idx, { ...eff, atkPct: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </label>
                    {([0, 1, 2] as const).map((starIdx) => (
                      <label key={starIdx} className="ps-field">
                        <span>{starIdx + 1}★ 基础数值</span>
                        <input
                          type="number"
                          className="ps-input"
                          min={0}
                          max={50000}
                          value={eff.baseByStar[starIdx]}
                          onChange={(e) => {
                            const next: [number, number, number] = [...eff.baseByStar];
                            next[starIdx] = Math.max(0, Number(e.target.value) || 0);
                            updateEffectAt(idx, { ...eff, baseByStar: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                ) : eff.kind === 'shield' ? (
                  <div className="ps-field-grid">
                    <label className="ps-field">
                      <span>自身生命% 盾量</span>
                      <input
                        type="number"
                        className="ps-input"
                        min={0}
                        max={100}
                        value={eff.hpPct}
                        onChange={(e) => updateEffectAt(idx, { ...eff, hpPct: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </label>
                    <label className="ps-field">
                      <span>持续 ms</span>
                      <input
                        type="number"
                        className="ps-input"
                        min={500}
                        max={20000}
                        step={500}
                        value={eff.durationMs}
                        onChange={(e) => updateEffectAt(idx, { ...eff, durationMs: Math.max(500, Number(e.target.value) || 4000) })}
                      />
                    </label>
                    {([0, 1, 2] as const).map((starIdx) => (
                      <label key={starIdx} className="ps-field">
                        <span>{starIdx + 1}★ 基础盾值</span>
                        <input
                          type="number"
                          className="ps-input"
                          min={0}
                          max={50000}
                          value={eff.baseByStar[starIdx]}
                          onChange={(e) => {
                            const next: [number, number, number] = [...eff.baseByStar];
                            next[starIdx] = Math.max(0, Number(e.target.value) || 0);
                            updateEffectAt(idx, { ...eff, baseByStar: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                ) : eff.kind === 'heal' ? (
                  <div className="ps-field-grid">
                    <label className="ps-field">
                      <span>目标最大生命%</span>
                      <input
                        type="number"
                        className="ps-input"
                        min={0}
                        max={100}
                        value={eff.hpPct}
                        onChange={(e) => updateEffectAt(idx, { ...eff, hpPct: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </label>
                    {([0, 1, 2] as const).map((starIdx) => (
                      <label key={starIdx} className="ps-field">
                        <span>{starIdx + 1}★ 基础治疗</span>
                        <input
                          type="number"
                          className="ps-input"
                          min={0}
                          max={50000}
                          value={eff.baseByStar[starIdx]}
                          onChange={(e) => {
                            const next: [number, number, number] = [...eff.baseByStar];
                            next[starIdx] = Math.max(0, Number(e.target.value) || 0);
                            updateEffectAt(idx, { ...eff, baseByStar: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                ) : eff.kind === 'stun' ? (
                  <div className="ps-field-grid">
                    {([0, 1, 2] as const).map((starIdx) => (
                      <label key={starIdx} className="ps-field">
                        <span>{starIdx + 1}★ 眩晕 ms</span>
                        <input
                          type="number"
                          className="ps-input"
                          min={100}
                          max={6000}
                          step={100}
                          value={eff.durationMsByStar[starIdx]}
                          onChange={(e) => {
                            const next: [number, number, number] = [...eff.durationMsByStar];
                            next[starIdx] = Math.min(6000, Math.max(100, Number(e.target.value) || 1000));
                            updateEffectAt(idx, { ...eff, durationMsByStar: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="ps-field-grid">
                    <label className="ps-field">
                      <span>属性词条</span>
                      <select
                        className="ps-select"
                        value={eff.stat}
                        onChange={(e) =>
                          updateEffectAt(idx, { ...eff, stat: e.target.value as StudioSkillEffect['kind'] extends never ? never : (typeof STUDIO_STAT_KEYS)[number] })
                        }
                      >
                        {STUDIO_STAT_KEYS.map((key) => (
                          <option key={key} value={key}>{key}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ps-field">
                      <span>变化值</span>
                      <input
                        type="number"
                        className="ps-input"
                        value={eff.value}
                        onChange={(e) => updateEffectAt(idx, { ...eff, value: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label className="ps-field">
                      <span>持续 ms</span>
                      <input
                        type="number"
                        className="ps-input"
                        min={500}
                        max={30000}
                        step={500}
                        value={eff.durationMs}
                        onChange={(e) => updateEffectAt(idx, { ...eff, durationMs: Math.max(500, Number(e.target.value) || 3000) })}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}

            {selectedUnit.skill.effects.length < 4 ? (
              <button
                type="button"
                className="ps-btn"
                onClick={() =>
                  updateUnit(
                    {
                      skill: {
                        ...selectedUnit.skill,
                        effects: [
                          ...selectedUnit.skill.effects,
                          { kind: 'damage', damageType: 'magic', baseByStar: [120, 200, 350], atkPct: 140 },
                        ],
                      },
                    },
                    '追加技能效果段',
                  )
                }
              >
                + 追加一条效果
              </button>
            ) : null}
          </div>
        ) : (
          <div className="ps-box">
            <h4>等待创建棋子</h4>
            <p style={{ fontSize: 13, color: 'var(--ft-muted)', margin: 0 }}>
              请在左侧点击「+ 新建棋子」，或切换到「② 羁绊交叉网」从交叉矩阵空格一键新增。
            </p>
          </div>
        )}

        {/* Right column: Numerical Designer Balance Scale */}
        <div className="ps-box">
          <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ borderBottom: 'none', paddingBottom: 0 }}>数值天平</h4>
            <div className="ps-field-row" style={{ gap: 4 }}>
              {([1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ps-btn ${inspectStar === s ? 'ps-btn--active' : ''}`}
                  style={{ padding: '3px 7px', fontSize: 12 }}
                  onClick={() => setInspectStar(s)}
                >
                  {s}★
                </button>
              ))}
            </div>
          </div>

          {selectedUnit && unitAnalysis ? (
            <>
              <div className="ps-kpi-grid">
                <div className="ps-kpi-card">
                  <span>实算气血 / 攻击</span>
                  <strong>{unitAnalysis.stats.hp} / {unitAnalysis.stats.atk}</strong>
                </div>
                <div className="ps-kpi-card">
                  <span>双抗 · 攻速 · 射程</span>
                  <strong>{unitAnalysis.stats.armor}/{unitAnalysis.stats.mr} · {unitAnalysis.stats.aspd} · {unitAnalysis.stats.range}格</strong>
                </div>
                <div className="ps-kpi-card">
                  <span>物理有效生命 EHP</span>
                  <strong>{unitAnalysis.ehpPhys}</strong>
                </div>
                <div className="ps-kpi-card">
                  <span>法术有效生命 EHP</span>
                  <strong>{unitAnalysis.ehpMagic}</strong>
                </div>
                <div className="ps-kpi-card">
                  <span>普攻秒伤 Auto DPS</span>
                  <strong>{unitAnalysis.autoDps}</strong>
                </div>
                <div className="ps-kpi-card">
                  <span>15秒综合输出估值</span>
                  <strong>{unitAnalysis.est15sOutput}</strong>
                </div>
              </div>

              <div className="ps-step-block" style={{ padding: 8 }}>
                <div className="ps-field-row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                  <span>同费同定位总预算占比</span>
                  <span className={`ps-budget-pill is-${unitAnalysis.rating}`}>
                    {unitAnalysis.budgetRatioPct}% · {RATING_LABELS[unitAnalysis.rating]}
                  </span>
                </div>
                <div className="ps-meter-track" title="82% ~ 122% 绿色虚线框为常规均衡预算带">
                  <div className="ps-meter-safe" />
                  <div
                    className="ps-meter-fill"
                    style={{ width: `${Math.min(100, Math.round(unitAnalysis.budgetRatioPct / 2))}%` }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--ft-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>身板占比 {unitAnalysis.ehpRatioPct}%</span>
                  <span>秒伤占比 {unitAnalysis.dpsRatioPct}%</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ft-ink-deep)' }}>
                  {unitAnalysis.stats.triggerSummary} · {unitAnalysis.ratingNote}
                </p>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--ft-muted)', margin: 0 }}>
              选中一枚棋子即可实时观察 1★/2★/3★ 的 EHP、普攻 DPS、首轮施法时间和同费同定位预算占比。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

