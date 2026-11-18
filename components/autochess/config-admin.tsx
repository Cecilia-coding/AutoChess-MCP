'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COSMETICS,
  type Cosmetic,
} from '@/lib/meta/cosmetics';
import {
  BUFF_CATEGORY_META,
  BUFF_RARITY_META,
  BUFF_SCOPE_LABELS,
  BUFF_STAGE_LABELS,
  buffArchetypeById,
  formatBuffText,
  type BuffCategoryId,
  type BuffPackCopy,
  type BuffRarityId,
  type BuffRuleConfig,
  type BuffScopeId,
  type BuffStageId,
  type BuffStageWeights,
} from '@/lib/meta/journey-buffs';
import {
  COSMETIC_TIER_META,
  computeDefeatDamage,
  type ArcadeConfig,
  type CosmeticAcquisition,
  type CosmeticRuleConfig,
  type CosmeticTierId,
  type DamageStageRule,
  type EconomyConfig,
  type GameConfigData,
  type GameConfigSectionId,
  type OddsConfig,
  type PacingConfig,
} from '@/lib/meta/game-config';
import { useHostRequests } from './host-context';

type AdminConfigResponse = {
  config: GameConfigData;
  defaults: GameConfigData;
  updatedAt: number;
  customized: boolean;
};

type SaveConfigResponse = {
  ok: boolean;
  config: GameConfigData;
  updatedAt: number;
  customized: boolean;
  cosmetics?: Cosmetic[];
  exchange?: number;
};

const SUB_TABS: readonly { id: GameConfigSectionId; label: string }[] = [
  { id: 'cosmetics', label: '外观分层定价表' },
  { id: 'pacing', label: '局内节奏与扣血表' },
  { id: 'buffs', label: '选秀与 Buff 表' },
  { id: 'economy', label: '经济与结算表' },
  { id: 'arcade', label: '游乐摊与门票表' },
  { id: 'odds', label: '玩法权重与赔率表' },
] as const;

type PacingScalarKey = Exclude<keyof PacingConfig, 'damageStages'>;
const PACING_SCALAR_ROWS: readonly {
  key: PacingScalarKey;
  label: string;
  note: string;
  min: number;
  max: number;
  step?: string;
}[] = [
  { key: 'standardStartHp', label: '多人局初始血量', note: '8 人标准局起步血量（决定运营容错血池）', min: 20, max: 500 },
  { key: 'duelStartHp', label: '弈决 1v1 初始血量', note: '1v1 单挑模式起始血量', min: 20, max: 500 },
  { key: 'duelDamageScale', label: '弈决 1v1 扣血系数', note: '控制 1v1 局长的败场扣血倍率（0.1 ~ 3.0）', min: 0.1, max: 3, step: '0.05' },
  { key: 'drawDamageRatio', label: '平局底伤折算比例', note: '平局双方各自扣当前阶段底伤的倍数（0=不扣）', min: 0, max: 2, step: '0.05' },
  { key: 'startGold', label: '开局初始金币', note: '第 1 轮入座初始持金', min: 0, max: 100 },
  { key: 'roundBaseIncome', label: '每轮基础工资', note: '每回合结算发放的固定工资（不含利息/连胜）', min: 0, max: 50 },
  { key: 'baseInterestCap', label: '默认利息上限', note: '每存 10 金 +1 息，常规最高几息（可被经济 Buff 改动）', min: 0, max: 30 },
  { key: 'shopRefreshCost', label: '商店单次刷新花费', note: '无免费次数时刷新一次商店的金币价', min: 0, max: 20 },
  { key: 'xpPerRound', label: '每轮自然经验', note: '每次进入准备回合自动获得的经验', min: 0, max: 20 },
  { key: 'xpBuyCost', label: '买经验金币单价', note: '每次购买升级经验消耗几金', min: 1, max: 30 },
  { key: 'xpBuyAmount', label: '单次买经验点数', note: '每次买经验基础获得多少点（与扩容等 Buff 叠加）', min: 1, max: 30 },
  { key: 'winStreakCap', label: '连胜额外金币上限', note: '第 2 连胜起逐级增加，每轮最多额外发几金', min: 0, max: 20 },
  { key: 'lossBountyPerLossCap', label: '连败单次入池上限', note: '连败赏金单局战败最多存进赏金池几金', min: 0, max: 20 },
  { key: 'lossBountyBankCap', label: '连败赏金池总上限', note: '收菜赢下对局时一次性最高可提现的赏金上限', min: 0, max: 100 },
] as const;

const BUFF_STAGE_ROWS: readonly { key: 'stage1' | 'stage2' | 'stage3'; label: string }[] = [
  { key: 'stage1', label: '前期阶段（第 1 轮选秀）' },
  { key: 'stage2', label: '中期阶段（第 2 轮选秀）' },
  { key: 'stage3', label: '后期阶段（第 3+ 轮选秀）' },
] as const;

const BUFF_RARITY_KEYS: readonly BuffRarityId[] = ['common', 'rare', 'legendary'] as const;
const BUFF_STAGE_IDS: readonly BuffStageId[] = [1, 2, 3] as const;

function parseIntList(
  raw: string,
  min: number,
  max: number,
  options?: { sortUnique?: boolean; maxLen?: number },
): number[] {
  const tokens = raw.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  const parsed: number[] = [];
  for (const token of tokens) {
    const n = Number(token);
    if (!Number.isInteger(n) || n < min || n > max) continue;
    parsed.push(n);
  }
  const normalized = options?.sortUnique ? [...new Set(parsed)].sort((a, b) => a - b) : parsed;
  return options?.maxLen !== undefined ? normalized.slice(0, options.maxLen) : normalized;
}

const ECONOMY_ROWS: readonly { key: keyof EconomyConfig; label: string; note: string; step?: string }[] = [
  { key: 'exchangeBotPerHuman', label: '铜钱→机芯兑换率', note: '1 铜钱可兑换多少机芯' },
  { key: 'companionMinRounds', label: '陪伴局结算最小轮数', note: '低于此轮数不结算奖励' },
  { key: 'companionHumanWin', label: '陪伴局 · 人类胜场铜钱', note: '含与人/陪伴自家机对局' },
  { key: 'companionHumanDraw', label: '陪伴局 · 人类平局铜钱', note: '平局发放铜钱' },
  { key: 'companionHumanLoss', label: '陪伴局 · 人类负场铜钱', note: '参与保底铜钱' },
  { key: 'companionBotWin', label: '陪伴局 · 机胜场机芯', note: '机主同席胜场机芯' },
  { key: 'companionBotDraw', label: '陪伴局 · 机平局机芯', note: '机主同席平局机芯' },
  { key: 'companionBotLoss', label: '陪伴局 · 机负场机芯', note: '机主同席负场机芯' },
  { key: 'companionWinTickets', label: '陪伴局 · 胜场掉游乐券', note: '仅胜场掉落' },
  { key: 'companionDailyCap', label: '陪伴局每日上限', note: '0 为不限；按主人合计' },
  { key: 'travelMinRounds', label: '远游局最小轮数', note: '机独自远游最低有效轮数' },
  { key: 'travelWinnerFirst', label: '远游局 · 胜圈第1名机芯', note: '机远游头名奖励' },
  { key: 'travelWinnerLast', label: '远游局 · 胜圈末位机芯', note: '多人远游前半区末位' },
  { key: 'travelLoserFirst', label: '远游局 · 败圈首位机芯', note: '后半区最高名次（可负）' },
  { key: 'travelLoserLast', label: '远游局 · 榜尾机芯', note: '后半区垫底结算（可负）' },
  { key: 'travelWinTickets', label: '远游局 · 胜场掉游乐券', note: '远游获胜额外掉券' },
  { key: 'travelDailyCap', label: '远游局每日上限', note: '0 为不限' },
  { key: 'matchmakingWinMultiplier', label: '匹配赛胜场倍率', note: '在基础结算上的乘数', step: '0.05' },
  { key: 'matchmakingLossMultiplier', label: '匹配赛负场倍率', note: '负场扣分乘数', step: '0.05' },
  { key: 'feedbackRewardBot', label: '反馈采纳奖励机芯', note: '管理员采纳奖励额' },
  { key: 'feedbackWeeklyCap', label: '每周反馈奖励上限次数', note: '每账号每周可获次上限' },
] as const;

type ArcadeScalarKey = Exclude<keyof ArcadeConfig, 'stakes' | 'drops'>;
const ARCADE_SCALAR_ROWS: readonly { key: ArcadeScalarKey; label: string; note: string; step?: string }[] = [
  { key: 'starterTickets', label: '新号迎新试玩券', note: '首次进入游乐摊免费发放' },
  { key: 'ticketHumanPrice', label: '单张游乐券（铜钱价）', note: '大厅购券消耗铜钱' },
  { key: 'ticketBotPrice', label: '单张游乐券（机芯价）', note: '机购券消耗机芯' },
  { key: 'maxTickets', label: '游乐券持有上限', note: '超出上限时不再发放' },
  { key: 'maxPackCount', label: '单次最大购券张数', note: '一次买券最大输入值' },
  { key: 'reliefTickets', label: '每日低保每次发券', note: '零钱零券时可领救济券' },
  { key: 'reliefDailyLimit', label: '每日低保领取次数上限', note: '按自然日（UTC）计' },
  { key: 'gambleWinProbability', label: '搏倍成功概率', note: '0.05 ~ 0.95（如 0.48 = 48%）', step: '0.01' },
  { key: 'gambleMultiplier', label: '每次搏倍倍数', note: '默认 2（翻倍）' },
  { key: 'gambleMaxDoubles', label: '连续搏倍上限次数', note: '连胜达此次数自动落袋' },
] as const;

const SLOT_PAYOUT_ROWS: readonly { key: keyof OddsConfig['slotPayouts']; label: string; step?: string }[] = [
  { key: 'seven3', label: '7·7·7 三连倍率', step: '0.5' },
  { key: 'star3', label: '✦·✦·✦ 三连倍率', step: '0.5' },
  { key: 'clover3', label: '🍀·🍀·🍀 三连倍率', step: '0.5' },
  { key: 'coin3', label: '🪙·🪙·🪙 三连倍率', step: '0.5' },
  { key: 'seven2', label: '双 7 倍率', step: '0.1' },
  { key: 'star2', label: '双星倍率', step: '0.1' },
  { key: 'clover2', label: '双草倍率', step: '0.1' },
  { key: 'coin2', label: '双钱倍率', step: '0.1' },
  { key: 'seven3Chance', label: '7·7·7 外观掉率 (0~1)', step: '0.01' },
  { key: 'star3Chance', label: '✦·✦·✦ 外观掉率 (0~1)', step: '0.01' },
  { key: 'clover3Chance', label: '🍀·🍀·🍀 外观掉率 (0~1)', step: '0.01' },
  { key: 'coin3Chance', label: '🪙·🪙·🪙 外观掉率 (0~1)', step: '0.01' },
  { key: 'seven2Chance', label: '双 7 外观掉率 (0~1)', step: '0.01' },
] as const;

function BuffPackCopyEditor({
  packKey,
  packLabel,
  copy,
  params,
  onChange,
}: {
  packKey: 'ai' | 'jianghu';
  packLabel: string;
  copy: BuffPackCopy;
  params: Record<string, number>;
  onChange: (next: BuffPackCopy) => void;
}) {
  return (
    <div className={`config-buff-copy-card is-${packKey}`}>
      <div className="config-buff-copy-head">
        <span className="config-buff-pack-tag">{packLabel}</span>
        <input
          type="text"
          className="config-buff-name-input"
          maxLength={40}
          aria-label={`${packLabel} 词条名称`}
          value={copy.name}
          onChange={e => onChange({ ...copy, name: e.target.value })}
        />
      </div>
      <textarea
        className="config-buff-desc-input"
        rows={2}
        maxLength={220}
        aria-label={`${packLabel} 描述模板`}
        value={copy.desc}
        onChange={e => onChange({ ...copy, desc: e.target.value })}
      />
      <p className="config-buff-preview">生效预览：{formatBuffText(copy.desc, params)}</p>
    </div>
  );
}

export default function ConfigAdmin({
  token,
  onApplied,
}: {
  token: string;
  onApplied?: (result: { cosmetics?: Cosmetic[]; exchange?: number }) => void;
}) {
  const { metaRequest } = useHostRequests();
  const [subTab, setSubTab] = useState<GameConfigSectionId>('cosmetics');
  const [savedConfig, setSavedConfig] = useState<GameConfigData | null>(null);
  const [draft, setDraft] = useState<GameConfigData | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [customized, setCustomized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [buffScheduleText, setBuffScheduleText] = useState({
    buffRounds: '3, 7, 11',
    supplyRounds: '5, 9',
    rerollCosts: '2, 4',
  });
  const [buffScopeFilter, setBuffScopeFilter] = useState<'all' | BuffScopeId>('all');
  const [buffRarityFilter, setBuffRarityFilter] = useState<'all' | BuffRarityId>('all');
  const [buffCategoryFilter, setBuffCategoryFilter] = useState<'all' | BuffCategoryId>('all');
  const [buffQuery, setBuffQuery] = useState('');

  const metaById = useMemo(() => new Map(COSMETICS.map(item => [item.id, item])), []);

  const syncBuffScheduleText = useCallback((cfg: GameConfigData) => {
    setBuffScheduleText({
      buffRounds: cfg.buffs.buffRounds.join(', '),
      supplyRounds: cfg.buffs.supplyRounds.join(', '),
      rerollCosts: cfg.buffs.rerollCosts.join(', '),
    });
  }, []);

  const loadConfig = useCallback(async () => {
    setBusy(true);
    try {
      const res = await metaRequest<AdminConfigResponse>('admin_config_get', { token });
      setSavedConfig(res.config);
      setDraft(structuredClone(res.config));
      syncBuffScheduleText(res.config);
      setUpdatedAt(res.updatedAt);
      setCustomized(res.customized);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }, [metaRequest, syncBuffScheduleText, token]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const dirty = useMemo(
    () => Boolean(savedConfig && draft && JSON.stringify(savedConfig) !== JSON.stringify(draft)),
    [savedConfig, draft],
  );

  const saveConfig = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await metaRequest<SaveConfigResponse>('admin_config_save', { token, config: draft });
      setSavedConfig(res.config);
      setDraft(structuredClone(res.config));
      syncBuffScheduleText(res.config);
      setUpdatedAt(res.updatedAt);
      setCustomized(res.customized);
      setError('');
      setNotice('配置表已保存并即时生效');
      onApplied?.({ cosmetics: res.cosmetics, exchange: res.exchange });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetSection = async (section: GameConfigSectionId | 'all') => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await metaRequest<SaveConfigResponse>('admin_config_reset', { token, section });
      setSavedConfig(res.config);
      setDraft(structuredClone(res.config));
      syncBuffScheduleText(res.config);
      setUpdatedAt(res.updatedAt);
      setCustomized(res.customized);
      setError('');
      setNotice(section === 'all' ? '已恢复全套默认配置' : '当前配置表已恢复默认');
      onApplied?.({ cosmetics: res.cosmetics, exchange: res.exchange });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateCosmeticRule = (id: string, patch: Partial<CosmeticRuleConfig>) => {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cosmetics: prev.cosmetics.map(row => (row.id === id ? { ...row, ...patch } : row)),
      };
    });
  };

  const updateBuffRule = (id: string, updater: (rule: BuffRuleConfig) => BuffRuleConfig) => {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        buffs: {
          ...prev.buffs,
          items: prev.buffs.items.map(row => (row.id === id ? updater(row) : row)),
        },
      };
    });
  };

  const updateStageWeight = (stageKey: 'stage1' | 'stage2' | 'stage3', rarity: BuffRarityId, value: number) => {
    setDraft(prev => {
      if (!prev) return prev;
      const current = prev.buffs.stageWeights[stageKey];
      const nextWeights: BuffStageWeights = {
        ...current,
        [rarity]: Math.max(0, Math.min(10_000, Math.trunc(value) || 0)),
      };
      if (nextWeights.common + nextWeights.rare + nextWeights.legendary <= 0) {
        return prev;
      }
      return {
        ...prev,
        buffs: {
          ...prev.buffs,
          stageWeights: {
            ...prev.buffs.stageWeights,
            [stageKey]: nextWeights,
          },
        },
      };
    });
  };

  const filteredBuffItems = useMemo(() => {
    if (!draft) return [];
    const q = buffQuery.trim().toLowerCase();
    return draft.buffs.items.filter(row => {
      if (buffScopeFilter !== 'all' && row.scope !== buffScopeFilter) return false;
      if (buffRarityFilter !== 'all' && row.rarity !== buffRarityFilter) return false;
      if (buffCategoryFilter !== 'all' && row.category !== buffCategoryFilter) return false;
      if (!q) return true;
      const haystack = [
        row.id,
        row.copy.ai?.name ?? '',
        row.copy.ai?.desc ?? '',
        row.copy.jianghu?.name ?? '',
        row.copy.jianghu?.desc ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [buffCategoryFilter, buffQuery, buffRarityFilter, buffScopeFilter, draft]);

  if (!draft) {
    return (
      <section className="lobby-pack-admin config-admin" aria-labelledby="config-admin-title">
        <h3 id="config-admin-title">后台数值配置表</h3>
        {error ? <p role="alert" className="lobby-hint">{error}</p> : <p className="lobby-hint">正在读取配置表…</p>}
      </section>
    );
  }

  const slotTotalWeight = draft.odds.slotSymbols.reduce((s, item) => s + Math.max(0, Number(item.weight) || 0), 0) || 1;
  const scratchTotalWeight = draft.odds.scratchTiers.reduce((s, item) => s + Math.max(0, Number(item.weight) || 0), 0) || 1;
  const updatedText = updatedAt ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(updatedAt) : '内置默认';

  return (
    <section className="lobby-pack-admin config-admin" aria-labelledby="config-admin-title">
      <div className="config-admin-head">
        <div>
          <h3 id="config-admin-title">后台数值配置表</h3>
          <p className="lobby-hint">
            状态：{customized ? `已自定义（${updatedText}）` : '内置默认'} · 修改保存后对商城、局内节奏与扣血、选秀 Buff、结算与游乐摊即时热生效，无需重启服务。
          </p>
        </div>
        <div className="config-admin-actions">
          {dirty ? <span className="config-dirty-badge">未保存修改</span> : null}
          <button type="button" className="lobby-primary" disabled={busy || !dirty} onClick={() => void saveConfig()}>
            {busy ? '保存中…' : '保存并生效'}
          </button>
          <button
            type="button"
            className="lobby-secondary"
            disabled={busy || !dirty}
            onClick={() => {
              if (!savedConfig) return;
              const clone = structuredClone(savedConfig);
              setDraft(clone);
              syncBuffScheduleText(clone);
            }}
          >
            撤销改动
          </button>
          <button type="button" className="lobby-secondary" disabled={busy} onClick={() => void resetSection(subTab)}>
            恢复本表默认
          </button>
        </div>
      </div>

      <div className="config-subtabs" role="tablist" aria-label="后台配置表分类">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            className={subTab === tab.id ? 'is-active' : ''}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="room-error">{error}</p> : null}
      {notice ? <p role="status" className="lobby-notice">{notice}</p> : null}

      {subTab === 'cosmetics' ? (
        <div className="config-table-scroll">
          <table className="config-table" aria-label="外观商城分层定价表">
            <thead>
              <tr>
                <th>外观</th>
                <th>类别</th>
                <th>所属梯队</th>
                <th>上架渠道</th>
                <th>铜钱价格</th>
                <th>机芯价格</th>
                <th>排序</th>
              </tr>
            </thead>
            <tbody>
              {draft.cosmetics.map(row => {
                const info = metaById.get(row.id);
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{info?.name ?? row.id}</strong>
                      <small className="config-cell-id">{row.id}</small>
                    </td>
                    <td>{info?.kind === 'frame' ? '头像框' : '棋盘'}</td>
                    <td>
                      <select
                        aria-label={`${info?.name ?? row.id} 梯队`}
                        value={row.tier}
                        onChange={e => {
                          const tier = e.target.value as CosmeticTierId;
                          const tierDef = COSMETIC_TIER_META[tier];
                          updateCosmeticRule(row.id, {
                            tier,
                            acquisition: tier === 'retired' ? 'retired' : row.acquisition === 'retired' ? 'shop' : row.acquisition,
                            humanPrice: tierDef.defaultHumanPrice,
                            botPrice: tierDef.defaultBotPrice,
                          });
                        }}
                      >
                        {Object.values(COSMETIC_TIER_META).map(meta => (
                          <option key={meta.id} value={meta.id}>{meta.shortLabel}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`${info?.name ?? row.id} 渠道`}
                        value={row.acquisition}
                        onChange={e => {
                          const acq = e.target.value as CosmeticAcquisition;
                          updateCosmeticRule(
                            row.id,
                            acq === 'default' ? { acquisition: acq, humanPrice: 0, botPrice: 0 } : { acquisition: acq },
                          );
                        }}
                      >
                        <option value="shop">商城直购</option>
                        <option value="default">初始默认(禁购禁送)</option>
                        <option value="arcade">游乐摊限定</option>
                        <option value="retired">典藏下架</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        aria-label={`${info?.name ?? row.id} 铜钱价格`}
                        value={row.humanPrice}
                        onChange={e => {
                          const v = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                          updateCosmeticRule(row.id, { humanPrice: v, botPrice: v * draft.economy.exchangeBotPerHuman });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        aria-label={`${info?.name ?? row.id} 机芯价格`}
                        value={row.botPrice}
                        onChange={e => updateCosmeticRule(row.id, { botPrice: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        aria-label={`${info?.name ?? row.id} 排序`}
                        value={row.sortOrder}
                        onChange={e => updateCosmeticRule(row.id, { sortOrder: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'economy' ? (
        <div className="config-table-scroll">
          <table className="config-table" aria-label="局外经济与对局结算表">
            <thead>
              <tr>
                <th>配置项</th>
                <th>说明</th>
                <th>当前值</th>
              </tr>
            </thead>
            <tbody>
              {ECONOMY_ROWS.map(row => (
                <tr key={row.key}>
                  <td><strong>{row.label}</strong></td>
                  <td><small>{row.note}</small></td>
                  <td>
                    <input
                      type="number"
                      step={row.step ?? '1'}
                      aria-label={row.label}
                      value={draft.economy[row.key]}
                      onChange={e => {
                        const raw = Number(e.target.value);
                        setDraft(prev => prev ? {
                          ...prev,
                          economy: { ...prev.economy, [row.key]: Number.isFinite(raw) ? raw : 0 },
                        } : prev);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'arcade' ? (
        <div className="config-arcade-stack">
          <div className="config-table-scroll">
            <table className="config-table" aria-label="游乐摊基础参数表">
              <thead>
                <tr>
                  <th>参数</th>
                  <th>说明</th>
                  <th>数值</th>
                </tr>
              </thead>
              <tbody>
                {ARCADE_SCALAR_ROWS.map(row => (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong></td>
                    <td><small>{row.note}</small></td>
                    <td>
                      <input
                        type="number"
                        step={row.step ?? '1'}
                        aria-label={row.label}
                        value={draft.arcade[row.key]}
                        onChange={e => {
                          const raw = Number(e.target.value);
                          setDraft(prev => prev ? {
                            ...prev,
                            arcade: { ...prev.arcade, [row.key]: Number.isFinite(raw) ? raw : 0 },
                          } : prev);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="config-table-scroll">
            <table className="config-table" aria-label="游乐摊下注档位表">
              <thead>
                <tr>
                  <th>档位</th>
                  <th>角标</th>
                  <th>游乐券</th>
                  <th>铜钱</th>
                  <th>机芯</th>
                  <th>外观倍率</th>
                </tr>
              </thead>
              <tbody>
                {draft.arcade.stakes.map((stake, idx) => (
                  <tr key={stake.id}>
                    <td>
                      <input
                        type="text"
                        maxLength={16}
                        value={stake.label}
                        onChange={e => setDraft(prev => prev ? {
                          ...prev,
                          arcade: {
                            ...prev.arcade,
                            stakes: prev.arcade.stakes.map((s, i) => i === idx ? { ...s, label: e.target.value } : s),
                          },
                        } : prev)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        maxLength={12}
                        value={stake.badge}
                        onChange={e => setDraft(prev => prev ? {
                          ...prev,
                          arcade: {
                            ...prev.arcade,
                            stakes: prev.arcade.stakes.map((s, i) => i === idx ? { ...s, badge: e.target.value } : s),
                          },
                        } : prev)}
                      />
                    </td>
                    {(['ticketCost', 'humanCost', 'botCost', 'cosmeticRateBoost'] as const).map(field => (
                      <td key={field}>
                        <input
                          type="number"
                          step={field === 'cosmeticRateBoost' ? '0.1' : '1'}
                          value={stake[field]}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setDraft(prev => prev ? {
                              ...prev,
                              arcade: {
                                ...prev.arcade,
                                stakes: prev.arcade.stakes.map((s, i) => i === idx ? { ...s, [field]: Number.isFinite(val) ? val : 0 } : s),
                              },
                            } : prev);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {subTab === 'odds' ? (
        <div className="config-arcade-stack">
          <div className="config-table-scroll">
            <table className="config-table" aria-label="老虎机符号权重表">
              <thead>
                <tr>
                  <th>符号</th>
                  <th>权重</th>
                  <th>单轴占比</th>
                </tr>
              </thead>
              <tbody>
                {draft.odds.slotSymbols.map((sym, idx) => (
                  <tr key={sym.id}>
                    <td><strong>{sym.glyph} {sym.name}</strong></td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={sym.weight}
                        onChange={e => {
                          const w = Math.max(1, Math.trunc(Number(e.target.value) || 1));
                          setDraft(prev => prev ? {
                            ...prev,
                            odds: {
                              ...prev.odds,
                              slotSymbols: prev.odds.slotSymbols.map((s, i) => i === idx ? { ...s, weight: w } : s),
                            },
                          } : prev);
                        }}
                      />
                    </td>
                    <td>{((sym.weight / slotTotalWeight) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="config-table-scroll">
            <table className="config-table" aria-label="老虎机连线倍率与外观掉率表">
              <thead>
                <tr>
                  <th>连线档位</th>
                  <th>数值</th>
                </tr>
              </thead>
              <tbody>
                {SLOT_PAYOUT_ROWS.map(row => (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong></td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={row.step ?? '0.1'}
                        value={draft.odds.slotPayouts[row.key]}
                        onChange={e => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setDraft(prev => prev ? {
                            ...prev,
                            odds: {
                              ...prev.odds,
                              slotPayouts: { ...prev.odds.slotPayouts, [row.key]: val },
                            },
                          } : prev);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="config-table-scroll">
            <table className="config-table" aria-label="刮刮乐档位权重表">
              <thead>
                <tr>
                  <th>档位</th>
                  <th>权重</th>
                  <th>概率</th>
                  <th>倍率</th>
                  <th>外观掉率</th>
                </tr>
              </thead>
              <tbody>
                {draft.odds.scratchTiers.map((tier, idx) => (
                  <tr key={tier.id}>
                    <td><strong>{tier.name}</strong></td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={tier.weight}
                        onChange={e => {
                          const w = Math.max(1, Math.trunc(Number(e.target.value) || 1));
                          setDraft(prev => prev ? {
                            ...prev,
                            odds: {
                              ...prev.odds,
                              scratchTiers: prev.odds.scratchTiers.map((t, i) => i === idx ? { ...t, weight: w } : t),
                            },
                          } : prev);
                        }}
                      />
                    </td>
                    <td>{((tier.weight / scratchTotalWeight) * 100).toFixed(2)}%</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        disabled={tier.id === 'bust'}
                        value={tier.multiplier}
                        onChange={e => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setDraft(prev => prev ? {
                            ...prev,
                            odds: {
                              ...prev.odds,
                              scratchTiers: prev.odds.scratchTiers.map((t, i) => i === idx ? { ...t, multiplier: val } : t),
                            },
                          } : prev);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step="0.01"
                        value={tier.cosmeticBaseChance}
                        onChange={e => {
                          const val = Math.max(0, Math.min(1, Number(e.target.value) || 0));
                          setDraft(prev => prev ? {
                            ...prev,
                            odds: {
                              ...prev.odds,
                              scratchTiers: prev.odds.scratchTiers.map((t, i) => i === idx ? { ...t, cosmeticBaseChance: val } : t),
                            },
                          } : prev);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {subTab === 'pacing' ? (() => {
        const earlyLossTotal = [1, 2, 3, 4].reduce((sum, r) => sum + computeDefeatDamage(r, 2, 1, draft.pacing), 0);
        const duelEarlyLossTotal = [1, 2, 3, 4].reduce(
          (sum, r) => sum + computeDefeatDamage(r, 2, draft.pacing.duelDamageScale, draft.pacing),
          0,
        );
        const updateStage = (stageId: DamageStageRule['id'], patch: Partial<DamageStageRule>) => {
          setDraft(prev => prev ? {
            ...prev,
            pacing: {
              ...prev.pacing,
              damageStages: prev.pacing.damageStages.map(stage => (stage.id === stageId ? { ...stage, ...patch } : stage)),
            },
          } : prev);
        };
        return (
          <div className="config-arcade-stack">
            <div className="config-pacing-runway">
              <strong>运营容错实时试算</strong>
              <span>
                标准多人局（{draft.pacing.standardStartHp} 血）：前 4 轮连败（按对手场均剩 2 子）累计扣 <b>{earlyLossTotal}</b> 血 → 第 5 轮剩 <b>{Math.max(0, draft.pacing.standardStartHp - earlyLossTotal)}</b> 血；
              </span>
              <span>
                弈决 1v1（{draft.pacing.duelStartHp} 血 × {draft.pacing.duelDamageScale}）：前 4 轮累计扣 <b>{duelEarlyLossTotal}</b> 血 → 剩 <b>{Math.max(0, draft.pacing.duelStartHp - duelEarlyLossTotal)}</b> 血；默认利息上限 +{draft.pacing.baseInterestCap} 金/轮。
              </span>
            </div>

            <div className="config-table-scroll">
              <table className="config-table" aria-label="败场扣血曲线表">
                <thead>
                  <tr>
                    <th>阶段名称</th>
                    <th>截至回合</th>
                    <th>基础底伤</th>
                    <th>每存活附加</th>
                    <th>存活附加封顶</th>
                    <th>每轮额外递增</th>
                    <th>单败扣血预览（1~5存活）</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.pacing.damageStages.map((stage, idx) => {
                    const prevMax = idx > 0 ? (draft.pacing.damageStages[idx - 1]?.maxRound ?? 0) : 0;
                    const startRound = prevMax + 1;
                    const sampleMin = computeDefeatDamage(startRound, 1, 1, draft.pacing);
                    const sampleMax = computeDefeatDamage(
                      stage.id === 'overtime' ? startRound : Math.max(startRound, stage.maxRound),
                      5,
                      1,
                      draft.pacing,
                    );
                    return (
                      <tr key={stage.id}>
                        <td>
                          <input
                            type="text"
                            maxLength={24}
                            aria-label={`${stage.id} 阶段名称`}
                            value={stage.label}
                            onChange={e => updateStage(stage.id, { label: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={prevMax + 1}
                            max={999}
                            aria-label={`${stage.label} 截至回合`}
                            value={stage.maxRound}
                            onChange={e => updateStage(stage.id, { maxRound: Math.max(1, Math.min(999, Math.trunc(Number(e.target.value) || 1))) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={`${stage.label} 基础底伤`}
                            value={stage.baseDamage}
                            onChange={e => updateStage(stage.id, { baseDamage: Math.max(0, Math.min(100, Math.trunc(Number(e.target.value) || 0))) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            step="0.5"
                            aria-label={`${stage.label} 每存活附加`}
                            value={stage.perSurvivor}
                            onChange={e => {
                              const raw = Number(e.target.value);
                              updateStage(stage.id, { perSurvivor: Number.isFinite(raw) ? Math.max(0, Math.min(20, raw)) : 0 });
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            aria-label={`${stage.label} 存活附加封顶`}
                            value={stage.survivorCap}
                            onChange={e => updateStage(stage.id, { survivorCap: Math.max(0, Math.min(50, Math.trunc(Number(e.target.value) || 0))) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            aria-label={`${stage.label} 每轮额外递增`}
                            value={stage.extraPerRound}
                            onChange={e => updateStage(stage.id, { extraPerRound: Math.max(0, Math.min(20, Math.trunc(Number(e.target.value) || 0))) })}
                          />
                        </td>
                        <td>
                          <small>
                            R{startRound}{stage.id === 'overtime' ? '+' : `~${Math.max(startRound, stage.maxRound)}`}：<b>{sampleMin}~{sampleMax}</b> 血
                          </small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="config-table-scroll">
              <table className="config-table" aria-label="局内运营与血量参数表">
                <thead>
                  <tr>
                    <th>参数项</th>
                    <th>策划作用说明</th>
                    <th>当前数值</th>
                  </tr>
                </thead>
                <tbody>
                  {PACING_SCALAR_ROWS.map(row => (
                    <tr key={row.key}>
                      <td><strong>{row.label}</strong></td>
                      <td><small>{row.note}</small></td>
                      <td>
                        <input
                          type="number"
                          min={row.min}
                          max={row.max}
                          step={row.step ?? '1'}
                          aria-label={row.label}
                          value={draft.pacing[row.key]}
                          onChange={e => {
                            const raw = Number(e.target.value);
                            const clamped = Number.isFinite(raw)
                              ? Math.max(row.min, Math.min(row.max, row.step ? raw : Math.trunc(raw)))
                              : row.min;
                            setDraft(prev => prev ? {
                              ...prev,
                              pacing: { ...prev.pacing, [row.key]: clamped },
                            } : prev);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })() : null}

      {subTab === 'buffs' ? (
        <div className="config-arcade-stack">
          <div className="config-table-scroll">
            <table className="config-table" aria-label="选秀节奏与重投表">
              <thead>
                <tr>
                  <th>选秀参数</th>
                  <th>格式与说明</th>
                  <th>当前配置</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>启用奇遇三选一选秀</strong></td>
                  <td><small>开启后在指定回合弹出 3 选 1 同品阶奇遇卡；全员品阶同步，词条各自独立抽取。</small></td>
                  <td>
                    <label className="config-buff-toggle">
                      <input
                        type="checkbox"
                        aria-label="启用奇遇三选一选秀"
                        checked={draft.buffs.enabled}
                        onChange={e => setDraft(prev => prev ? {
                          ...prev,
                          buffs: { ...prev.buffs, enabled: e.target.checked },
                        } : prev)}
                      />
                      <span>{draft.buffs.enabled ? '已启用' : '已关闭'}</span>
                    </label>
                  </td>
                </tr>
                <tr>
                  <td><strong>奇遇选秀触发回合</strong></td>
                  <td><small>逗号分隔整数（1–40），如 <code>3, 7, 11</code>。当前生效：[{draft.buffs.buffRounds.join(', ') || '无'}]</small></td>
                  <td>
                    <input
                      type="text"
                      className="config-buff-wide-input"
                      aria-label="奇遇选秀触发回合"
                      placeholder="3, 7, 11"
                      value={buffScheduleText.buffRounds}
                      onChange={e => {
                        const raw = e.target.value;
                        setBuffScheduleText(prev => ({ ...prev, buffRounds: raw }));
                        const parsed = parseIntList(raw, 1, 40, { sortUnique: true, maxLen: 20 });
                        setDraft(prev => prev ? { ...prev, buffs: { ...prev.buffs, buffRounds: parsed } } : prev);
                      }}
                    />
                  </td>
                </tr>
                <tr>
                  <td><strong>装备补给箱触发回合</strong></td>
                  <td><small>替代旧地图踩箱的回合制装备三选一（1–40），留空关闭。当前生效：[{draft.buffs.supplyRounds.join(', ') || '关闭'}]</small></td>
                  <td>
                    <input
                      type="text"
                      className="config-buff-wide-input"
                      aria-label="装备补给箱触发回合"
                      placeholder="5, 9"
                      value={buffScheduleText.supplyRounds}
                      onChange={e => {
                        const raw = e.target.value;
                        setBuffScheduleText(prev => ({ ...prev, supplyRounds: raw }));
                        const parsed = parseIntList(raw, 1, 40, { sortUnique: true, maxLen: 20 });
                        setDraft(prev => prev ? { ...prev, buffs: { ...prev.buffs, supplyRounds: parsed } } : prev);
                      }}
                    />
                  </td>
                </tr>
                <tr>
                  <td><strong>每轮付费重投金币阶梯</strong></td>
                  <td><small>最多 5 次（每次 0–50 金），如 <code>2, 4</code> 表示最多换 2 批。当前：[{draft.buffs.rerollCosts.join(', ') || '禁止重投'}]</small></td>
                  <td>
                    <input
                      type="text"
                      className="config-buff-wide-input"
                      aria-label="每轮付费重投金币阶梯"
                      placeholder="2, 4"
                      value={buffScheduleText.rerollCosts}
                      onChange={e => {
                        const raw = e.target.value;
                        setBuffScheduleText(prev => ({ ...prev, rerollCosts: raw }));
                        const parsed = parseIntList(raw, 0, 50, { sortUnique: false, maxLen: 5 });
                        setDraft(prev => prev ? { ...prev, buffs: { ...prev.buffs, rerollCosts: parsed } } : prev);
                      }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="config-table-scroll">
            <table className="config-table" aria-label="选秀阶段稀有度权重表">
              <thead>
                <tr>
                  <th>选秀阶段</th>
                  <th>普通权重</th>
                  <th>稀世权重</th>
                  <th>传说权重</th>
                  <th>同房随机占比预览</th>
                </tr>
              </thead>
              <tbody>
                {BUFF_STAGE_ROWS.map(row => {
                  const weights = draft.buffs.stageWeights[row.key];
                  const total = weights.common + weights.rare + weights.legendary || 1;
                  return (
                    <tr key={row.key}>
                      <td><strong>{row.label}</strong></td>
                      {BUFF_RARITY_KEYS.map(rarityKey => (
                        <td key={rarityKey}>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            aria-label={`${row.label} ${BUFF_RARITY_META[rarityKey].shortLabel}权重`}
                            value={weights[rarityKey]}
                            onChange={e => updateStageWeight(row.key, rarityKey, Number(e.target.value))}
                          />
                        </td>
                      ))}
                      <td>
                        <small>
                          普通 {((weights.common / total) * 100).toFixed(0)}% · 稀世 {((weights.rare / total) * 100).toFixed(0)}% · 传说 {((weights.legendary / total) * 100).toFixed(0)}%
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="config-buff-toolbar">
            <label>
              <span>归属包</span>
              <select
                aria-label="按归属包筛选"
                value={buffScopeFilter}
                onChange={e => setBuffScopeFilter(e.target.value as 'all' | BuffScopeId)}
              >
                <option value="all">全部词条</option>
                <option value="shared">双包通用</option>
                <option value="ai">AI铲铲专属</option>
                <option value="jianghu">夜航船专属</option>
              </select>
            </label>
            <label>
              <span>稀有度</span>
              <select
                aria-label="按稀有度筛选"
                value={buffRarityFilter}
                onChange={e => setBuffRarityFilter(e.target.value as 'all' | BuffRarityId)}
              >
                <option value="all">全部稀有度</option>
                {BUFF_RARITY_KEYS.map(key => (
                  <option key={key} value={key}>{BUFF_RARITY_META[key].shortLabel}</option>
                ))}
              </select>
            </label>
            <label>
              <span>分类</span>
              <select
                aria-label="按分类筛选"
                value={buffCategoryFilter}
                onChange={e => setBuffCategoryFilter(e.target.value as 'all' | BuffCategoryId)}
              >
                <option value="all">全部分类</option>
                {(['economy', 'combat', 'artifact'] as const).map(key => (
                  <option key={key} value={key}>{BUFF_CATEGORY_META[key].label}</option>
                ))}
              </select>
            </label>
            <label className="config-buff-search">
              <span>搜索</span>
              <input
                type="search"
                aria-label="搜索 Buff 词条"
                placeholder="搜 ID / 词条名 / 文案关键词…"
                value={buffQuery}
                onChange={e => setBuffQuery(e.target.value)}
              />
            </label>
            <span className="config-buff-count">
              当前显示 {filteredBuffItems.length} / {draft.buffs.items.length} 条
            </span>
          </div>

          <div className="config-table-scroll">
            <table className="config-table config-buff-table" aria-label="奇遇词条配置表">
              <thead>
                <tr>
                  <th>启用 / 词条</th>
                  <th>品阶 · 类型 · 阶段 · 权重</th>
                  <th>数值参数</th>
                  <th>分开包装文案（支持 {'{参数名}'} 插值）</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuffItems.map(row => {
                  const arch = buffArchetypeById(row.id);
                  const primaryName = row.copy.ai?.name ?? row.copy.jianghu?.name ?? row.id;
                  const showAi = (row.scope === 'shared' || row.scope === 'ai') && row.copy.ai;
                  const showJianghu = (row.scope === 'shared' || row.scope === 'jianghu') && row.copy.jianghu;
                  return (
                    <tr key={row.id} className={row.enabled ? '' : 'is-disabled'}>
                      <td>
                        <label className="config-buff-enable">
                          <input
                            type="checkbox"
                            aria-label={`启用 ${primaryName}`}
                            checked={row.enabled}
                            onChange={e => updateBuffRule(row.id, cur => ({ ...cur, enabled: e.target.checked }))}
                          />
                          <strong>{primaryName}</strong>
                        </label>
                        <small className="config-cell-id">{row.id} · {BUFF_SCOPE_LABELS[row.scope]}</small>
                        <span className={`config-rarity-badge is-${row.rarity}`}>
                          {BUFF_RARITY_META[row.rarity].shortLabel} · {BUFF_CATEGORY_META[row.category].label}
                        </span>
                      </td>
                      <td>
                        <div className="config-buff-meta-grid">
                          <label>
                            <span>稀有度</span>
                            <select
                              aria-label={`${primaryName} 稀有度`}
                              value={row.rarity}
                              onChange={e => updateBuffRule(row.id, cur => ({ ...cur, rarity: e.target.value as BuffRarityId }))}
                            >
                              {BUFF_RARITY_KEYS.map(key => (
                                <option key={key} value={key}>{BUFF_RARITY_META[key].shortLabel}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>分类</span>
                            <select
                              aria-label={`${primaryName} 分类`}
                              value={row.category}
                              onChange={e => updateBuffRule(row.id, cur => ({ ...cur, category: e.target.value as BuffCategoryId }))}
                            >
                              {(['economy', 'combat', 'artifact'] as const).map(key => (
                                <option key={key} value={key}>{BUFF_CATEGORY_META[key].label}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>权重</span>
                            <input
                              type="number"
                              min={1}
                              max={10000}
                              aria-label={`${primaryName} 权重`}
                              value={row.weight}
                              onChange={e => {
                                const weight = Math.max(1, Math.min(10_000, Math.trunc(Number(e.target.value) || 1)));
                                updateBuffRule(row.id, cur => ({ ...cur, weight }));
                              }}
                            />
                          </label>
                          <div className="config-buff-stages" role="group" aria-label={`${primaryName} 出现阶段`}>
                            {BUFF_STAGE_IDS.map(stageId => {
                              const active = row.stages.includes(stageId);
                              return (
                                <label key={stageId}>
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={e => {
                                      updateBuffRule(row.id, cur => {
                                        const next = e.target.checked
                                          ? [...new Set([...cur.stages, stageId])].sort((a, b) => a - b)
                                          : cur.stages.filter(s => s !== stageId);
                                        return next.length ? { ...cur, stages: next } : cur;
                                      });
                                    }}
                                  />
                                  <span>{BUFF_STAGE_LABELS[stageId]}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                      <td>
                        {arch?.params.length ? (
                          <div className="config-buff-params">
                            {arch.params.map(spec => (
                              <label key={spec.key} className="config-buff-param-item">
                                <span>{spec.label} <code>{'{' + spec.key + '}'}</code></span>
                                <input
                                  type="number"
                                  min={spec.min}
                                  max={spec.max}
                                  step={spec.step ?? 1}
                                  aria-label={`${primaryName} ${spec.label}`}
                                  value={row.params[spec.key] ?? spec.defaultValue}
                                  onChange={e => {
                                    const raw = Number(e.target.value);
                                    const clamped = Number.isFinite(raw)
                                      ? Math.max(spec.min, Math.min(spec.max, spec.step && spec.step < 1 ? raw : Math.trunc(raw)))
                                      : spec.defaultValue;
                                    updateBuffRule(row.id, cur => ({
                                      ...cur,
                                      params: { ...cur.params, [spec.key]: clamped },
                                    }));
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        ) : (
                          <span className="config-cell-id">纯规则机制（无数值槽）</span>
                        )}
                      </td>
                      <td>
                        <div className="config-buff-copy-grid">
                          {showAi && row.copy.ai ? (
                            <BuffPackCopyEditor
                              packKey="ai"
                              packLabel="AI铲铲"
                              copy={row.copy.ai}
                              params={row.params}
                              onChange={nextCopy =>
                                updateBuffRule(row.id, cur => ({ ...cur, copy: { ...cur.copy, ai: nextCopy } }))
                              }
                            />
                          ) : null}
                          {showJianghu && row.copy.jianghu ? (
                            <BuffPackCopyEditor
                              packKey="jianghu"
                              packLabel="夜航船"
                              copy={row.copy.jianghu}
                              params={row.params}
                              onChange={nextCopy =>
                                updateBuffRule(row.id, cur => ({ ...cur, copy: { ...cur.copy, jianghu: nextCopy } }))
                              }
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

