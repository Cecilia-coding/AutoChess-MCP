'use client';

import { useState, type ChangeEvent } from 'react';
import { roleLabel } from '@/content/autochess/roles';
import {
  analyzeStudioPack,
  roleBaselineStats,
  simulateStudioDuel,
  type StudioDuelResult,
} from '@/lib/pack-studio/balance';
import { formatStatOpsSummary } from '@/lib/pack-studio/compiler';
import {
  STUDIO_ITEM_TIERS,
  STUDIO_STAT_KEYS,
  validateCustomPack,
  type CustomPackV1,
  type StudioBuffFlavor,
  type StudioItemDef,
  type StudioItemTier,
  type StudioTraitDef,
  type StudioUnitDef,
} from '@/lib/pack-studio/schema';
import { STUDIO_ORIGINAL_SPRITES, studioSpriteById } from '@/lib/pack-studio/sprites';
import {
  STAR_GROWTH_PRESETS,
  cloneStarGrowthPreset,
  type StarGrowthPresetId,
} from '@/lib/pack-studio/star-curves';
import {
  STUDIO_STARTER_OPTIONS,
  createPackFromStarter,
  type StudioStarterId,
} from '@/lib/pack-studio/templates';

const TIER_LABELS: Record<StudioItemTier, string> = {
  white: '白色 · 初始/基础',
  purple: '紫色 · 进阶散件',
  epic: '史诗 · 核心大件',
  orange: '橙色 · 传说/纹章',
};

export function StarterChooserPanel({
  hasExistingPacks,
  onCancel,
  onCreatePack,
  onImportFile,
}: {
  hasExistingPacks: boolean;
  onCancel: () => void;
  onCreatePack: (pack: CustomPackV1) => void;
  onImportFile: (file: File) => void;
}) {
  const [starterId, setStarterId] = useState<StudioStarterId | null>(null);
  const [growthPreset, setGrowthPreset] = useState<StarGrowthPresetId | null>(null);
  const [buffFlavor, setBuffFlavor] = useState<StudioBuffFlavor | null>(null);
  const [title, setTitle] = useState('');

  const handleImportChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onImportFile(file);
  };

  const canConfirm = Boolean(starterId && growthPreset && buffFlavor && title.trim());

  const handleConfirm = () => {
    if (!starterId || !growthPreset || !buffFlavor || !title.trim()) return;
    const created = createPackFromStarter({
      starterId,
      id: `pack-${Date.now().toString(36)}`,
      title: title.trim().slice(0, 32),
      starGrowthPreset: growthPreset,
      buffFlavor,
    });
    onCreatePack(created);
  };

  return (
    <section className="ps-starter-wall" aria-label="显式选择起步模版与规则">
      <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
        <div className="ps-starter-head">
          <h3>选择一套起步方式 · 自己定制整套自走棋谱</h3>
          <p>
            不设默认偷渡模版或隐藏兜底：请在下方依次点选起步骨架、升星曲线与奇遇风格；所有棋谱仅保存在你的浏览器或导出为 JSON 文件，服务端不存档。
          </p>
        </div>
        {hasExistingPacks ? (
          <button type="button" className="ps-btn" onClick={onCancel}>
            返回已有草稿
          </button>
        ) : null}
      </div>

      <div className="ps-step-block">
        <div className="ps-step-label">
          <span>① 选起步模版或直接导入本地棋谱（4 选 1）</span>
          <span>{starterId ? `已选：${STUDIO_STARTER_OPTIONS.find((s) => s.id === starterId)?.name}` : '待选择'}</span>
        </div>
        <div className="ps-starter-cards">
          {STUDIO_STARTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`ps-choice-card ${starterId === opt.id ? 'is-selected' : ''}`}
              aria-pressed={starterId === opt.id}
              onClick={() => {
                setStarterId(opt.id);
                if (!title.trim()) {
                  setTitle(
                    opt.id === 'blank'
                      ? '我的自研棋谱'
                      : opt.id === 'compact-12'
                        ? '星港机工 · 12枚原型'
                        : '江湖奇阵 · 20枚全谱',
                  );
                }
              }}
            >
              <div className="ps-choice-card-top">
                <strong>{opt.name}</strong>
                <span className="ps-choice-badge">{opt.badge}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ft-sky-deep)' }}>
                {opt.matrixLabel} · {opt.unitCountLabel}
              </div>
              <small>{opt.description}</small>
            </button>
          ))}

          <label className="ps-choice-card" style={{ cursor: 'pointer' }}>
            <div className="ps-choice-card-top">
              <strong>导入本地 .json 棋谱文件</strong>
              <span className="ps-choice-badge">文件分享</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ft-butter-deep)' }}>
              从别人或本地备份导入
            </div>
            <small>选择 .autochess-pack.json 文件，校验格式后立即打开继续编辑与上棋盘试玩。</small>
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportChange} />
          </label>
        </div>
      </div>

      <div className="ps-step-block">
        <div className="ps-step-label">
          <span>② 选升星成长曲线（决定 1★ → 2★ → 3★ 哪些变、变多少）</span>
          <span>{growthPreset ? `已选：${STAR_GROWTH_PRESETS.find((g) => g.id === growthPreset)?.name}` : '待选择'}</span>
        </div>
        <div className="ps-starter-cards">
          {STAR_GROWTH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`ps-choice-card ${growthPreset === preset.id ? 'is-selected' : ''}`}
              aria-pressed={growthPreset === preset.id}
              onClick={() => setGrowthPreset(preset.id)}
            >
              <div className="ps-choice-card-top">
                <strong>{preset.name}</strong>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ft-mint-deep)' }}>
                {preset.subtitle}
              </div>
              <small>{preset.detail}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="ps-step-block">
        <div className="ps-step-label">
          <span>③ 选旅途奇遇文案风味 & 填写棋谱名称</span>
          <span>{buffFlavor ? (buffFlavor === 'tech' ? '已选：算力科技风' : '已选：奇谭古风') : '待选择'}</span>
        </div>
        <div className="ps-field-row">
          <button
            type="button"
            className={`ps-btn ${buffFlavor === 'tech' ? 'ps-btn--primary' : ''}`}
            aria-pressed={buffFlavor === 'tech'}
            onClick={() => setBuffFlavor('tech')}
          >
            算力科技词条（Token / 模型风味）
          </button>
          <button
            type="button"
            className={`ps-btn ${buffFlavor === 'classic' ? 'ps-btn--primary' : ''}`}
            aria-pressed={buffFlavor === 'classic'}
            onClick={() => setBuffFlavor('classic')}
          >
            奇谭古风词条（游历 / 奇遇风味）
          </button>
          <label className="ps-field-row" style={{ marginLeft: 'auto' }}>
            <strong>棋谱名称</strong>
            <input
              className="ps-input"
              placeholder="请填入棋谱标题（如：夜雾工坊）"
              value={title}
              maxLength={32}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ps-btn ps-btn--primary"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            确认创建并进入工坊
          </button>
        </div>
      </div>
    </section>
  );
}

export function RulesPanel({
  pack,
  onChangePack,
}: {
  pack: CustomPackV1;
  onChangePack: (next: CustomPackV1, summary: string) => void;
}) {
  const g = pack.starGrowth;

  return (
    <div className="ps-panel">
      <div className="ps-grid-2">
        <div className="ps-box">
          <h4>棋谱信息与奇遇风味</h4>
          <label className="ps-field">
            <span>棋谱名称</span>
            <input
              className="ps-input"
              value={pack.title}
              maxLength={32}
              onChange={(e) => onChangePack({ ...pack, title: e.target.value || '自研棋谱' }, '更新棋谱标题')}
            />
          </label>
          <label className="ps-field">
            <span>副标题 / 玩法简介</span>
            <input
              className="ps-input"
              value={pack.subtitle}
              maxLength={100}
              onChange={(e) => onChangePack({ ...pack, subtitle: e.target.value }, '更新棋谱副标题')}
            />
          </label>
          <div className="ps-field">
            <span>共享奇遇 Buff 词条风味（第 3 / 7 / 11 轮抽取共享池）</span>
            <div className="ps-field-row">
              <button
                type="button"
                className={`ps-btn ${pack.buffFlavor === 'tech' ? 'ps-btn--primary' : ''}`}
                onClick={() => onChangePack({ ...pack, buffFlavor: 'tech' }, '奇遇风味切换为算力科技')}
              >
                算力科技风
              </button>
              <button
                type="button"
                className={`ps-btn ${pack.buffFlavor === 'classic' ? 'ps-btn--primary' : ''}`}
                onClick={() => onChangePack({ ...pack, buffFlavor: 'classic' }, '奇遇风味切换为奇谭古风')}
              >
                奇谭古风
              </button>
            </div>
          </div>

          <h4>局内术语命名</h4>
          <div className="ps-field-grid">
            <label className="ps-field">
              <span>货币名</span>
              <input
                className="ps-input"
                value={pack.terms.gold.name}
                maxLength={12}
                onChange={(e) =>
                  onChangePack(
                    { ...pack, terms: { ...pack.terms, gold: { ...pack.terms.gold, name: e.target.value || '金币' } } },
                    '修改货币术语',
                  )
                }
              />
            </label>
            <label className="ps-field">
              <span>商店名</span>
              <input
                className="ps-input"
                value={pack.terms.level.shop}
                maxLength={12}
                onChange={(e) =>
                  onChangePack(
                    { ...pack, terms: { ...pack.terms, level: { ...pack.terms.level, shop: e.target.value || '商店' } } },
                    '修改商店术语',
                  )
                }
              />
            </label>
            <label className="ps-field">
              <span>能量/蓝条名</span>
              <input
                className="ps-input"
                value={pack.terms.mana.name}
                maxLength={12}
                onChange={(e) =>
                  onChangePack(
                    { ...pack, terms: { ...pack.terms, mana: { name: e.target.value || '内力' } } },
                    '修改能量术语',
                  )
                }
              />
            </label>
            <label className="ps-field">
              <span>刷新动词</span>
              <input
                className="ps-input"
                value={pack.terms.reroll.name}
                maxLength={12}
                onChange={(e) =>
                  onChangePack(
                    { ...pack, terms: { ...pack.terms, reroll: { name: e.target.value || '刷新' } } },
                    '修改刷新术语',
                  )
                }
              />
            </label>
          </div>
        </div>

        <div className="ps-box">
          <h4>升星数据成长规则（1★ → 2★ → 3★）</h4>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ft-muted)' }}>
            实战对照：升星<strong>会改变</strong>生命、攻击与技能星级数值；通常<strong>不改变</strong>基础攻速、射程与机制标签。
          </p>
          <div className="ps-field-row">
            {STAR_GROWTH_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`ps-btn ${g.presetId === preset.id ? 'ps-btn--primary' : ''}`}
                onClick={() =>
                  onChangePack(
                    { ...pack, starGrowth: cloneStarGrowthPreset(preset.id) },
                    `切换升星曲线为「${preset.name}」`,
                  )
                }
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="ps-field-grid">
            <label className="ps-field">
              <span>2★ 生命倍率 (1.1~4.0)</span>
              <input
                type="number"
                className="ps-input"
                min={1.1}
                max={4}
                step={0.05}
                value={g.hpMultipliers[1]}
                onChange={(e) =>
                  onChangePack(
                    {
                      ...pack,
                      starGrowth: {
                        ...g,
                        presetId: 'custom',
                        hpMultipliers: [1, Math.max(1.1, Number(e.target.value) || 1.8), g.hpMultipliers[2]],
                      },
                    },
                    '调整 2★ 生命倍率',
                  )
                }
              />
            </label>
            <label className="ps-field">
              <span>3★ 生命倍率 (1.3~12.0)</span>
              <input
                type="number"
                className="ps-input"
                min={1.3}
                max={12}
                step={0.05}
                value={g.hpMultipliers[2]}
                onChange={(e) =>
                  onChangePack(
                    {
                      ...pack,
                      starGrowth: {
                        ...g,
                        presetId: 'custom',
                        hpMultipliers: [1, g.hpMultipliers[1], Math.max(g.hpMultipliers[1], Number(e.target.value) || 3.24)],
                      },
                    },
                    '调整 3★ 生命倍率',
                  )
                }
              />
            </label>
            <label className="ps-field">
              <span>2★ 攻击倍率 (1.1~4.0)</span>
              <input
                type="number"
                className="ps-input"
                min={1.1}
                max={4}
                step={0.05}
                value={g.atkMultipliers[1]}
                onChange={(e) =>
                  onChangePack(
                    {
                      ...pack,
                      starGrowth: {
                        ...g,
                        presetId: 'custom',
                        atkMultipliers: [1, Math.max(1.1, Number(e.target.value) || 1.8), g.atkMultipliers[2]],
                      },
                    },
                    '调整 2★ 攻击倍率',
                  )
                }
              />
            </label>
            <label className="ps-field">
              <span>3★ 攻击倍率 (1.3~10.0)</span>
              <input
                type="number"
                className="ps-input"
                min={1.3}
                max={10}
                step={0.05}
                value={g.atkMultipliers[2]}
                onChange={(e) =>
                  onChangePack(
                    {
                      ...pack,
                      starGrowth: {
                        ...g,
                        presetId: 'custom',
                        atkMultipliers: [1, g.atkMultipliers[1], Math.max(g.atkMultipliers[1], Number(e.target.value) || 3.24)],
                      },
                    },
                    '调整 3★ 攻击倍率',
                  )
                }
              />
            </label>
          </div>

          <div className="ps-field-row">
            <label className="ps-field-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={g.lowCostDefBonus}
                onChange={(e) =>
                  onChangePack(
                    { ...pack, starGrowth: { ...g, lowCostDefBonus: e.target.checked } },
                    '切换低费升星双抗补正',
                  )
                }
              />
              <span>低费（1~2费）升星附加双抗补正</span>
            </label>
            <label className="ps-field-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={g.highCostThreeStarHpBoost}
                onChange={(e) =>
                  onChangePack(
                    { ...pack, starGrowth: { ...g, highCostThreeStarHpBoost: e.target.checked } },
                    '切换高费 3★ 追梦乘区',
                  )
                }
              />
              <span>高费（4~5费）3★ 开启高倍终结乘区</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TraitsMatrixPanel({
  pack,
  onChangePack,
  onJumpToUnit,
}: {
  pack: CustomPackV1;
  onChangePack: (next: CustomPackV1, summary: string) => void;
  onJumpToUnit: (unitId: string) => void;
}) {
  const [selectedTraitId, setSelectedTraitId] = useState<string>(pack.traits[0]?.id ?? '');
  const selectedTrait = pack.traits.find((t) => t.id === selectedTraitId) ?? pack.traits[0] ?? null;

  const factions = pack.traits.filter((t) => t.kind === 'faction');
  const jobs = pack.traits.filter((t) => t.kind === 'job');
  const analysis = analyzeStudioPack(pack);

  const addTrait = (kind: 'faction' | 'job') => {
    const prefix = kind === 'faction' ? 'f' : 'j';
    const id = `${prefix}-${Date.now().toString(36).slice(-4)}`;
    const trait: StudioTraitDef = {
      id,
      name: kind === 'faction' ? `新阵营${factions.length + 1}` : `新职业${jobs.length + 1}`,
      kind,
      description: kind === 'faction' ? '同阵营协作增益' : '职业专属强化',
      tiers: [
        { count: 2, scope: 'holders', stats: [{ stat: kind === 'faction' ? 'hpPct' : 'atkPct', value: 18 }] },
        { count: 4, scope: 'team', stats: [{ stat: kind === 'faction' ? 'hpPct' : 'atkPct', value: 35 }] },
      ],
    };
    onChangePack({ ...pack, traits: [...pack.traits, trait] }, `新增${kind === 'faction' ? '阵营' : '职业'}「${trait.name}」`);
    setSelectedTraitId(id);
  };

  const removeTrait = (id: string) => {
    const nextTraits = pack.traits.filter((t) => t.id !== id);
    const nextUnits = pack.units.map((u) => ({
      ...u,
      factions: u.factions.filter((x) => x !== id),
      jobs: u.jobs.filter((x) => x !== id),
    }));
    const nextItems = pack.items.map((it) =>
      it.grantTraitId === id ? { ...it, grantTraitId: undefined } : it,
    );
    onChangePack({ ...pack, traits: nextTraits, units: nextUnits, items: nextItems }, '删除羁绊并解除关联');
    if (nextTraits[0]) setSelectedTraitId(nextTraits[0].id);
  };

  const updateTrait = (patch: Partial<StudioTraitDef>, summary: string) => {
    if (!selectedTrait) return;
    onChangePack(
      { ...pack, traits: pack.traits.map((t) => (t.id === selectedTrait.id ? { ...t, ...patch } : t)) },
      summary,
    );
  };

  const createUnitAtMatrixCell = (factionId: string, jobId: string) => {
    const sprite = STUDIO_ORIGINAL_SPRITES[pack.units.length % STUDIO_ORIGINAL_SPRITES.length]!;
    const cost: 1 | 2 | 3 | 4 | 5 = pack.units.some((u) => u.cost === 1) ? 2 : 1;
    const role = sprite.suggestedRole;
    const fName = pack.traits.find((t) => t.id === factionId)?.name ?? '';
    const jName = pack.traits.find((t) => t.id === jobId)?.name ?? '';
    const unit: StudioUnitDef = {
      id: `m-${Date.now().toString(36).slice(-5)}`,
      name: `${fName.slice(0, 2)}${jName.slice(0, 2)}${pack.units.length + 1}`,
      cost,
      role,
      spriteId: sprite.id,
      factions: [factionId],
      jobs: [jobId],
      stats: roleBaselineStats(cost, role),
      skill: {
        name: '联合战技',
        description: '对目标造成伤害',
        trigger: { kind: 'mana', maxMana: 75 },
        target: 'current_enemy',
        targetCount: 1,
        effects: [{ kind: 'damage', damageType: role === 'caster' ? 'magic' : 'phys', baseByStar: [150, 260, 440], atkPct: 185 }],
      },
    };
    onChangePack({ ...pack, units: [...pack.units, unit] }, `在矩阵空格创建棋子「${unit.name}」`);
    onJumpToUnit(unit.id);
  };

  return (
    <div className="ps-panel">
      <div className="ps-grid-2">
        {/* Left: Trait List & Editor */}
        <div className="ps-box">
          <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ borderBottom: 'none', paddingBottom: 0 }}>羁绊列表（{factions.length}阵营 · {jobs.length}职业）</h4>
            <div className="ps-field-row" style={{ gap: 6 }}>
              <button type="button" className="ps-btn ps-btn--primary" onClick={() => addTrait('faction')}>+ 阵营</button>
              <button type="button" className="ps-btn ps-btn--butter" onClick={() => addTrait('job')}>+ 职业</button>
            </div>
          </div>

          <div className="ps-field-row">
            {pack.traits.map((trait) => (
              <button
                key={trait.id}
                type="button"
                className={`ps-btn ${selectedTrait?.id === trait.id ? 'ps-btn--active' : ''}`}
                onClick={() => setSelectedTraitId(trait.id)}
              >
                {trait.kind === 'faction' ? '旗' : '职'} · {trait.name}
              </button>
            ))}
          </div>

          {selectedTrait ? (
            <div className="ps-step-block">
              <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
                <strong>编辑：{selectedTrait.name} ({selectedTrait.kind === 'faction' ? '阵营' : '职业'})</strong>
                <button type="button" className="ps-btn ps-btn--danger" onClick={() => removeTrait(selectedTrait.id)}>
                  删除羁绊
                </button>
              </div>
              <div className="ps-field-grid">
                <label className="ps-field">
                  <span>名称</span>
                  <input
                    className="ps-input"
                    value={selectedTrait.name}
                    maxLength={20}
                    onChange={(e) => updateTrait({ name: e.target.value || '未命名' }, '修改羁绊名称')}
                  />
                </label>
                <label className="ps-field">
                  <span>风味描述</span>
                  <input
                    className="ps-input"
                    value={selectedTrait.description}
                    maxLength={120}
                    onChange={(e) => updateTrait({ description: e.target.value }, '修改羁绊描述')}
                  />
                </label>
              </div>

              {selectedTrait.tiers.map((tier, tIdx) => (
                <div key={tIdx} className="ps-box" style={{ padding: 8 }}>
                  <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
                    <div className="ps-field-row">
                      <span>人数门槛</span>
                      <input
                        type="number"
                        className="ps-input ps-input-num"
                        min={1}
                        max={12}
                        value={tier.count}
                        onChange={(e) => {
                          const nextTiers = selectedTrait.tiers.map((entry, i) =>
                            i === tIdx ? { ...entry, count: Math.max(1, Math.round(Number(e.target.value) || 2)) } : entry,
                          );
                          updateTrait({ tiers: nextTiers }, '调整羁绊人数档位');
                        }}
                      />
                      <select
                        className="ps-select"
                        value={tier.scope}
                        onChange={(e) => {
                          const scope = e.target.value as 'holders' | 'team';
                          const nextTiers = selectedTrait.tiers.map((entry, i) =>
                            i === tIdx ? { ...entry, scope } : entry,
                          );
                          updateTrait({ tiers: nextTiers }, '切换羁绊生效范围');
                        }}
                      >
                        <option value="holders">仅携带者</option>
                        <option value="team">全队共享</option>
                      </select>
                    </div>
                    {selectedTrait.tiers.length > 1 ? (
                      <button
                        type="button"
                        className="ps-btn ps-btn--danger"
                        onClick={() =>
                          updateTrait(
                            { tiers: selectedTrait.tiers.filter((_, i) => i !== tIdx) },
                            '移除一条羁绊档位',
                          )
                        }
                      >
                        删档
                      </button>
                    ) : null}
                  </div>

                  {tier.stats.map((op, sIdx) => (
                    <div key={sIdx} className="ps-field-row">
                      <select
                        className="ps-select"
                        value={op.stat}
                        onChange={(e) => {
                          const stat = e.target.value as (typeof STUDIO_STAT_KEYS)[number];
                          const nextTiers = selectedTrait.tiers.map((entry, i) =>
                            i === tIdx
                              ? { ...entry, stats: entry.stats.map((x, j) => (j === sIdx ? { ...x, stat } : x)) }
                              : entry,
                          );
                          updateTrait({ tiers: nextTiers }, '更改羁绊词条属性');
                        }}
                      >
                        {STUDIO_STAT_KEYS.map((key) => (
                          <option key={key} value={key}>{key}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="ps-input ps-input-num"
                        value={op.value}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          const nextTiers = selectedTrait.tiers.map((entry, i) =>
                            i === tIdx
                              ? { ...entry, stats: entry.stats.map((x, j) => (j === sIdx ? { ...x, value } : x)) }
                              : entry,
                          );
                          updateTrait({ tiers: nextTiers }, '更改羁绊词条数值');
                        }}
                      />
                      <button
                        type="button"
                        className="ps-btn"
                        onClick={() => {
                          const nextTiers = selectedTrait.tiers.map((entry, i) =>
                            i === tIdx ? { ...entry, stats: entry.stats.filter((_, j) => j !== sIdx) } : entry,
                          );
                          updateTrait({ tiers: nextTiers }, '删除羁绊词条');
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ps-btn"
                    onClick={() => {
                      const nextTiers = selectedTrait.tiers.map((entry, i) =>
                        i === tIdx
                          ? { ...entry, stats: [...entry.stats, { stat: 'atkPct' as const, value: 15 }] }
                          : entry,
                      );
                      updateTrait({ tiers: nextTiers }, '追加羁绊属性词条');
                    }}
                  >
                    + 加词条
                  </button>
                </div>
              ))}
              {selectedTrait.tiers.length < 4 ? (
                <button
                  type="button"
                  className="ps-btn"
                  onClick={() => {
                    const lastCount = selectedTrait.tiers[selectedTrait.tiers.length - 1]?.count ?? 2;
                    updateTrait(
                      {
                        tiers: [
                          ...selectedTrait.tiers,
                          { count: lastCount + 2, scope: 'team', stats: [{ stat: 'hpPct', value: 20 }] },
                        ],
                      },
                      '增加羁绊高阶档位',
                    );
                  }}
                >
                  + 增加一档人数门槛
                </button>
              ) : null}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--ft-muted)', margin: 0 }}>
              点击上方「+ 阵营」或「+ 职业」开始搭起自走棋的十字交叉网。
            </p>
          )}
        </div>

        {/* Right: 2D Matrix Coverage */}
        <div className="ps-box">
          <h4>
            阵营 × 职业 交叉网格（空位 {analysis.emptyMatrixCells} / {analysis.totalMatrixCells}）
          </h4>
          {factions.length && jobs.length ? (
            <div className="ps-matrix-wrap">
              <table className="ps-matrix-table">
                <thead>
                  <tr>
                    <th>阵营 \ 职业</th>
                    {jobs.map((j) => (
                      <th key={j.id}>{j.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factions.map((f) => (
                    <tr key={f.id}>
                      <th>{f.name}</th>
                      {jobs.map((j) => {
                        const cell = analysis.matrix.find(
                          (c) => c.factionId === f.id && c.jobId === j.id,
                        );
                        const units = cell?.units ?? [];
                        return (
                          <td key={j.id}>
                            {units.length ? (
                              units.map((u) => {
                                const sprite = studioSpriteById(u.spriteId);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    className="ps-matrix-chip"
                                    onClick={() => onJumpToUnit(u.id)}
                                  >
                                    {sprite ? <img className="ps-sprite-thumb" src={sprite.portraitUrl} alt="" /> : null}
                                    <span>{u.name} · {u.cost}费</span>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="ps-matrix-empty">
                                <button
                                  type="button"
                                  className="ps-btn"
                                  style={{ fontSize: 11, padding: '3px 6px' }}
                                  onClick={() => createUnitAtMatrixCell(f.id, j.id)}
                                >
                                  + 补空缺
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--ft-muted)', margin: 0 }}>
              至少有 1 个阵营和 1 个职业后，这里会自动铺开二维羁绊交叉表，方便一眼查漏补缺。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ItemsPanel({
  pack,
  onChangePack,
}: {
  pack: CustomPackV1;
  onChangePack: (next: CustomPackV1, summary: string) => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string>(pack.items[0]?.id ?? '');
  const selected = pack.items.find((it) => it.id === selectedItemId) ?? pack.items[0] ?? null;

  const addItem = () => {
    const id = `it-${Date.now().toString(36).slice(-5)}`;
    const nextItem: StudioItemDef = {
      id,
      name: `自定义装备${pack.items.length + 1}`,
      tier: pack.items.some((x) => x.isOpeningChoice) ? 'purple' : 'white',
      isOpeningChoice: !pack.items.some((x) => x.isOpeningChoice),
      stats: [{ stat: 'atkPct', value: 20 }],
    };
    onChangePack({ ...pack, items: [...pack.items, nextItem] }, `新增装备「${nextItem.name}」`);
    setSelectedItemId(id);
  };

  const updateItem = (patch: Partial<StudioItemDef>, summary: string) => {
    if (!selected) return;
    onChangePack(
      { ...pack, items: pack.items.map((it) => (it.id === selected.id ? { ...it, ...patch } : it)) },
      summary,
    );
  };

  return (
    <div className="ps-panel">
      <div className="ps-grid-2">
        <div className="ps-box">
          <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ borderBottom: 'none', paddingBottom: 0 }}>装备与转职纹章池（{pack.items.length}）</h4>
            <button type="button" className="ps-btn ps-btn--primary" onClick={addItem}>+ 新建装备</button>
          </div>
          <div className="ps-unit-rail">
            {pack.items.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`ps-unit-row ${selected?.id === it.id ? 'is-active' : ''}`}
                onClick={() => setSelectedItemId(it.id)}
              >
                <div>
                  <strong>{it.name}</strong>
                  <div style={{ fontSize: 11, color: 'var(--ft-muted)' }}>
                    {TIER_LABELS[it.tier]} · {formatStatOpsSummary(it.stats)}
                  </div>
                </div>
                {it.isOpeningChoice ? <span className="ps-choice-badge">开局选装</span> : null}
              </button>
            ))}
            {!pack.items.length ? (
              <p style={{ fontSize: 12, color: 'var(--ft-muted)', margin: 0 }}>暂无装备，点击「+ 新建装备」添加。</p>
            ) : null}
          </div>
        </div>

        <div className="ps-box">
          {selected ? (
            <>
              <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
                <h4 style={{ borderBottom: 'none', paddingBottom: 0 }}>编辑：{selected.name}</h4>
                <button
                  type="button"
                  className="ps-btn ps-btn--danger"
                  onClick={() => {
                    const remaining = pack.items.filter((x) => x.id !== selected.id);
                    onChangePack({ ...pack, items: remaining }, `移除装备「${selected.name}」`);
                    if (remaining[0]) setSelectedItemId(remaining[0].id);
                  }}
                >
                  删除
                </button>
              </div>
              <div className="ps-field-grid">
                <label className="ps-field">
                  <span>装备名</span>
                  <input
                    className="ps-input"
                    value={selected.name}
                    maxLength={24}
                    onChange={(e) => updateItem({ name: e.target.value || '装备' }, '修改装备名称')}
                  />
                </label>
                <label className="ps-field">
                  <span>品阶（对应补给箱档位）</span>
                  <select
                    className="ps-select"
                    value={selected.tier}
                    onChange={(e) => updateItem({ tier: e.target.value as StudioItemTier }, '修改装备品阶')}
                  >
                    {STUDIO_ITEM_TIERS.map((tier) => (
                      <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>
                    ))}
                  </select>
                </label>
                <label className="ps-field">
                  <span>转职纹章（可选）</span>
                  <select
                    className="ps-select"
                    value={selected.grantTraitId ?? ''}
                    onChange={(e) =>
                      updateItem({ grantTraitId: e.target.value || undefined }, '修改装备转职纹章')
                    }
                  >
                    <option value="">不附加转职羁绊</option>
                    {pack.traits.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="ps-field-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.isOpeningChoice}
                  onChange={(e) => updateItem({ isOpeningChoice: e.target.checked }, '切换开局选装资格')}
                />
                <span>加入第 1 轮「开局装备三选一」奖池</span>
              </label>
              <label className="ps-field">
                <span>补充说明（可选）</span>
                <input
                  className="ps-input"
                  value={selected.note ?? ''}
                  maxLength={120}
                  onChange={(e) => updateItem({ note: e.target.value || undefined }, '更新装备说明')}
                />
              </label>

              <h4>装备属性</h4>
              {selected.stats.map((op, sIdx) => (
                <div key={sIdx} className="ps-field-row">
                  <select
                    className="ps-select"
                    value={op.stat}
                    onChange={(e) => {
                      const stat = e.target.value as (typeof STUDIO_STAT_KEYS)[number];
                      updateItem(
                        { stats: selected.stats.map((x, i) => (i === sIdx ? { ...x, stat } : x)) },
                        '修改装备词条属性',
                      );
                    }}
                  >
                    {STUDIO_STAT_KEYS.map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="ps-input ps-input-num"
                    value={op.value}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 0;
                      updateItem(
                        { stats: selected.stats.map((x, i) => (i === sIdx ? { ...x, value } : x)) },
                        '修改装备词条数值',
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="ps-btn"
                    onClick={() =>
                      updateItem({ stats: selected.stats.filter((_, i) => i !== sIdx) }, '删除装备词条')
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ps-btn"
                onClick={() => updateItem({ stats: [...selected.stats, { stat: 'hp', value: 180 }] }, '追加装备属性')}
              >
                + 加属性词条
              </button>
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--ft-muted)', margin: 0 }}>选择一件装备查看或修改属性。</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DuelLabPanel({ pack }: { pack: CustomPackV1 }) {
  const [leftId, setLeftId] = useState(pack.units[0]?.id ?? '');
  const [leftStar, setLeftStar] = useState<1 | 2 | 3>(1);
  const [leftItemId, setLeftItemId] = useState('');
  const [leftRow, setLeftRow] = useState(3);

  const [rightId, setRightId] = useState(pack.units[1]?.id ?? pack.units[0]?.id ?? '');
  const [rightStar, setRightStar] = useState<1 | 2 | 3>(1);
  const [rightItemId, setRightItemId] = useState('');
  const [rightRow, setRightRow] = useState(3);

  const [seed, setSeed] = useState(20261117);
  const [duelResult, setDuelResult] = useState<StudioDuelResult | null>(null);
  const [duelError, setDuelError] = useState('');

  const resolvedLeftId = pack.units.some((u) => u.id === leftId) ? leftId : (pack.units[0]?.id ?? '');
  const resolvedRightId = pack.units.some((u) => u.id === rightId)
    ? rightId
    : (pack.units[1]?.id ?? pack.units[0]?.id ?? '');

  const validation = validateCustomPack(pack);
  const analysis = analyzeStudioPack(pack);

  const runDuel = () => {
    try {
      const result = simulateStudioDuel(pack, {
        leftUnitId: resolvedLeftId,
        leftStar,
        leftItemIds: leftItemId ? [leftItemId] : [],
        leftPos: { row: leftRow, col: 2 },
        rightUnitId: resolvedRightId,
        rightStar,
        rightItemIds: rightItemId ? [rightItemId] : [],
        rightPos: { row: rightRow, col: 2 },
        seed,
      });
      setDuelResult(result);
      setDuelError('');
    } catch (e) {
      setDuelError(e instanceof Error ? e.message : '测桩失败');
    }
  };

  return (
    <div className="ps-panel">
      <div className="ps-box">
        <h4>1v1 对打测桩台（直接调用真实战斗引擎）</h4>
        {pack.units.length >= 1 ? (
          <>
            <div className="ps-duel-stage">
              <div className="ps-step-block">
                <strong>青方出战位</strong>
                <select className="ps-select" value={resolvedLeftId} onChange={(e) => setLeftId(e.target.value)}>
                  {pack.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}（{u.cost}费 · {roleLabel[u.role]}）</option>
                  ))}
                </select>
                <div className="ps-field-row">
                  <select className="ps-select" value={leftStar} onChange={(e) => setLeftStar(Number(e.target.value) as 1 | 2 | 3)}>
                    <option value={1}>1★</option>
                    <option value={2}>2★</option>
                    <option value={3}>3★</option>
                  </select>
                  <select className="ps-select" value={leftRow} onChange={(e) => setLeftRow(Number(e.target.value))}>
                    <option value={3}>前排格 (Row 3)</option>
                    <option value={0}>后排格 (Row 0)</option>
                  </select>
                  <select className="ps-select" value={leftItemId} onChange={(e) => setLeftItemId(e.target.value)}>
                    <option value="">不带装备</option>
                    {pack.items.map((it) => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                <strong>VS</strong>
                <button type="button" className="ps-btn ps-btn--primary" onClick={runDuel}>
                  实测对打
                </button>
                <label style={{ fontSize: 11 }}>
                  Seed{' '}
                  <input
                    type="number"
                    className="ps-input ps-input-num"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value) || 1)}
                  />
                </label>
              </div>

              <div className="ps-step-block">
                <strong>赤方出战位</strong>
                <select className="ps-select" value={resolvedRightId} onChange={(e) => setRightId(e.target.value)}>
                  {pack.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}（{u.cost}费 · {roleLabel[u.role]}）</option>
                  ))}
                </select>
                <div className="ps-field-row">
                  <select className="ps-select" value={rightStar} onChange={(e) => setRightStar(Number(e.target.value) as 1 | 2 | 3)}>
                    <option value={1}>1★</option>
                    <option value={2}>2★</option>
                    <option value={3}>3★</option>
                  </select>
                  <select className="ps-select" value={rightRow} onChange={(e) => setRightRow(Number(e.target.value))}>
                    <option value={3}>前排格 (Row 3)</option>
                    <option value={0}>后排格 (Row 0)</option>
                  </select>
                  <select className="ps-select" value={rightItemId} onChange={(e) => setRightItemId(e.target.value)}>
                    <option value="">不带装备</option>
                    {pack.items.map((it) => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {duelError ? <div className="ps-alert">{duelError}</div> : null}

            {duelResult ? (
              <div className="ps-step-block" style={{ marginTop: 6 }}>
                <div className="ps-field-row" style={{ justifyContent: 'space-between' }}>
                  <strong>{duelResult.winnerLabel}</strong>
                  <span>
                    实际击杀耗时 <strong>{duelResult.durationSec}s</strong>（纯普攻理论 TTK：青击赤 {duelResult.theoreticalRawTtkLeftToRightSec}s / 赤击青 {duelResult.theoreticalRawTtkRightToLeftSec}s）
                  </span>
                </div>
                <div className="ps-grid-2">
                  <div className="ps-kpi-card">
                    <span>青方 · {duelResult.left.name} {duelResult.left.star}★（初血 {duelResult.left.startMaxHp} / 攻 {duelResult.left.startAtk}）</span>
                    <strong>余血 {duelResult.left.survivingHp} · 打出 {duelResult.left.damageDealt} · 承伤 {duelResult.left.damageTaken} · 施法 {duelResult.left.casts} 次</strong>
                  </div>
                  <div className="ps-kpi-card">
                    <span>赤方 · {duelResult.right.name} {duelResult.right.star}★（初血 {duelResult.right.startMaxHp} / 攻 {duelResult.right.startAtk}）</span>
                    <strong>余血 {duelResult.right.survivingHp} · 打出 {duelResult.right.damageDealt} · 承伤 {duelResult.right.damageTaken} · 施法 {duelResult.right.casts} 次</strong>
                  </div>
                </div>
                {duelResult.highlights.length ? (
                  <ul className="ps-timeline-list">
                    {duelResult.highlights.map((ev, i) => (
                      <li key={i}>
                        <span>{ev.timeSec.toFixed(2)}s</span>
                        <span>{ev.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--ft-muted)', margin: 0 }}>
            至少先添加 1 枚棋子再运行 1v1 对打测桩。
          </p>
        )}
      </div>

      <div className="ps-box">
        <h4>整包系统策划体检</h4>
        <div className="ps-field-row">
          <span className="ps-choice-badge">棋子 {analysis.unitCount} 枚</span>
          <span className="ps-choice-badge">阵营 {analysis.factionCount} / 职业 {analysis.jobCount}</span>
          <span className="ps-choice-badge">前排 {analysis.frontlineCount} vs 后排 {analysis.backlineCount}（前排占 {analysis.frontlineRatioPct}%）</span>
          <span className="ps-choice-badge">矩阵空缺 {analysis.emptyMatrixCells}/{analysis.totalMatrixCells}</span>
          <span className="ps-choice-badge">装备 {analysis.itemCount} 件</span>
        </div>

        {validation.playBlockers.length ? (
          <div className="ps-alert">
            <strong>尚未满足试玩开局门槛：</strong>
            {validation.playBlockers.join('；')}
          </div>
        ) : (
          <div className="ps-ok-banner">
            ✓ 棋谱结构完整，已可直接点右上角「上像素真棋盘试玩」体验真对局（含补路人机或邀绑定机同玩）！
          </div>
        )}

        {[...analysis.outliers, ...analysis.systemNotes, ...validation.warnings].length ? (
          <ul className="ps-timeline-list">
            {[...analysis.outliers, ...analysis.systemNotes, ...validation.warnings].map((note, idx) => (
              <li key={idx}>
                <span>⚠</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--ft-mint-deep)', margin: 0 }}>
            ✓ 未检出费用断档、预算失衡或羁绊凑不齐的告警。
          </p>
        )}
      </div>
    </div>
  );
}

