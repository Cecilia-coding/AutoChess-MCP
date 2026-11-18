'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  deleteLocalPackEntry,
  exportPackJsonFile,
  loadLocalPackShelf,
  parseImportedPackJson,
  saveLocalPackEntry,
  type LocalPackEntry,
} from '@/lib/pack-studio/browser-storage';
import { ensureCustomPackRegistered } from '@/lib/pack-studio/compiler';
import { validateCustomPack, type CustomPackV1 } from '@/lib/pack-studio/schema';
import type { StudioChangeLogEntry } from '@/lib/pack-studio/ephemeral-bridge';
import type { MatchModeId } from '@/packs/modes/registry';
import { useAutochessHost, useHostRequests } from './host-context';
import {
  DuelLabPanel,
  ItemsPanel,
  RulesPanel,
  StarterChooserPanel,
  TraitsMatrixPanel,
} from './pack-studio-panels';
import { UnitBalancePanel } from './pack-studio-units';
import { PixelSprite } from './pixel-ui/pixel-sprite';
import './pixel-ui/pack-studio.css';

type StudioTabId = 'rules' | 'traits' | 'units' | 'items' | 'duel';

const STUDIO_SUBTABS: readonly { id: StudioTabId; label: string }[] = [
  { id: 'rules', label: '① 规则与成长' },
  { id: 'traits', label: '② 羁绊交叉网' },
  { id: 'units', label: '③ 棋子与数值天平' },
  { id: 'items', label: '④ 装备池' },
  { id: 'duel', label: '⑤ 1v1 测桩 & 体检' },
];

const SESSION_STORAGE_KEY = 'autochess-room-current-v1';

export default function PackStudio({
  self,
  token,
  mcpUrl,
  onEnterRoom,
}: {
  self: { id: string; username: string; isAi: boolean; boundPartners?: { id: string; username: string; isAi: boolean }[] } | null;
  token: string;
  mcpUrl: string;
  onEnterRoom?: (roomId: string, seatToken: string) => void;
}) {
  const host = useAutochessHost();
  const { roomRequest } = useHostRequests();
  const canCollab = Boolean(!self?.isAi && (token || (host.features.authMode === 'platform' && Boolean(host.transport.roomRequest))));

  const [shelf, setShelf] = useState<LocalPackEntry[]>([]);
  const [activePack, setActivePack] = useState<CustomPackV1 | null>(null);
  const [showStarter, setShowStarter] = useState<boolean>(true);
  const [subtab, setSubtab] = useState<StudioTabId>('units');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [playMode, setPlayMode] = useState<MatchModeId>('duel');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [launching, setLaunching] = useState(false);

  // Ephemeral RAM co-creation state (never saved to server disk)
  const [collabActive, setCollabActive] = useState(false);
  const [collabRevision, setCollabRevision] = useState(0);
  const [collabHistory, setCollabHistory] = useState<StudioChangeLogEntry[]>([]);
  const collabRevRef = useRef(0);
  const pushInFlightRef = useRef(false);

  useEffect(() => {
    const loaded = loadLocalPackShelf();
    setShelf(loaded);
    if (loaded[0]) {
      setActivePack(loaded[0].pack);
      setSelectedUnitId(loaded[0].pack.units[0]?.id ?? '');
      setShowStarter(false);
    } else {
      setShowStarter(true);
    }
  }, []);

  const persistToBrowser = useCallback((nextPack: CustomPackV1) => {
    const updatedShelf = saveLocalPackEntry(nextPack);
    setShelf(updatedShelf);
    setActivePack(nextPack);
  }, []);

  const pushToBridge = useCallback(
    async (packToPush: CustomPackV1 | null, summary: string) => {
      if (!collabActive || !canCollab) return;
      pushInFlightRef.current = true;
      try {
        const res = await roomRequest<{
          ok?: boolean;
          conflict?: boolean;
          active?: boolean;
          revision?: number;
          pack?: CustomPackV1 | null;
          history?: StudioChangeLogEntry[];
        }>('studio_sync', {
          ...(token ? { token } : {}),
          mode: 'push',
          revision: collabRevRef.current,
          pack: packToPush,
          summary,
        });
        if (res.revision !== undefined) {
          collabRevRef.current = res.revision;
          setCollabRevision(res.revision);
        }
        if (res.history) setCollabHistory(res.history);
        if (res.conflict && res.pack) {
          persistToBrowser(res.pack);
          setStatusMsg(`检测到你的机刚更新了棋谱（v${res.revision}），已自动同步到本地`);
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : '共创推送失败');
      } finally {
        pushInFlightRef.current = false;
      }
    },
    [collabActive, canCollab, token, roomRequest, persistToBrowser],
  );

  // Poll ephemeral bridge while co-creation is explicitly toggled on
  useEffect(() => {
    if (!collabActive || !canCollab) return;
    const timer = window.setInterval(async () => {
      if (pushInFlightRef.current || document.hidden) return;
      try {
        const res = await roomRequest<{
          active?: boolean;
          revision?: number;
          unchanged?: boolean;
          pack?: CustomPackV1 | null;
          history?: StudioChangeLogEntry[];
        }>('studio_sync', {
          ...(token ? { token } : {}),
          mode: 'pull',
          sinceRevision: collabRevRef.current,
        });
        if (!res.active) {
          setCollabActive(false);
          collabRevRef.current = 0;
          setCollabRevision(0);
          return;
        }
        if (res.revision !== undefined && res.revision > collabRevRef.current) {
          collabRevRef.current = res.revision;
          setCollabRevision(res.revision);
          if (res.history) setCollabHistory(res.history);
          if (res.pack !== undefined && res.pack !== null) {
            persistToBrowser(res.pack);
            setShowStarter(false);
            setStatusMsg(`✦ 绑定机已同步棋谱草稿至 v${res.revision}`);
          }
        }
      } catch {
        // Ignore transient polling failures
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [collabActive, canCollab, token, roomRequest, persistToBrowser]);

  const handlePackChange = useCallback(
    (nextPack: CustomPackV1, summary: string) => {
      persistToBrowser(nextPack);
      setErrorMsg('');
      if (collabActive) void pushToBridge(nextPack, summary);
    },
    [persistToBrowser, collabActive, pushToBridge],
  );

  const handleCreateFromStarter = (created: CustomPackV1) => {
    persistToBrowser(created);
    setSelectedUnitId(created.units[0]?.id ?? '');
    setSubtab(created.units.length ? 'units' : 'traits');
    setShowStarter(false);
    setErrorMsg('');
    setStatusMsg(`已显式创建「${created.title}」（保存在浏览器本地）`);
    if (collabActive) void pushToBridge(created, `选用「${created.title}」作为新起点`);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseImportedPackJson(text, `pack-${Date.now().toString(36)}`);
      if (!parsed.ok) {
        setErrorMsg(parsed.error);
        return;
      }
      persistToBrowser(parsed.pack);
      setSelectedUnitId(parsed.pack.units[0]?.id ?? '');
      setSubtab('units');
      setShowStarter(false);
      setErrorMsg('');
      setStatusMsg(`已从文件导入「${parsed.pack.title}」（已存至浏览器本地书架）`);
      if (collabActive) void pushToBridge(parsed.pack, `导入本地文件「${parsed.pack.title}」`);
    } catch {
      setErrorMsg('读取导入文件失败');
    }
  };

  const handleHeaderImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleImportFile(file);
  };

  const toggleCollab = async () => {
    if (!canCollab || !self) return;
    setErrorMsg('');
    if (collabActive) {
      try {
        await roomRequest('studio_sync', { ...(token ? { token } : {}), mode: 'close' });
        setCollabActive(false);
        collabRevRef.current = 0;
        setCollabRevision(0);
        setCollabHistory([]);
        setStatusMsg('已关闭内存共创并释放服务端内存草稿');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : '关闭共创失败');
      }
      return;
    }

    try {
      const res = await roomRequest<{
        active?: boolean;
        revision?: number;
        pack?: CustomPackV1 | null;
        history?: StudioChangeLogEntry[];
      }>('studio_sync', {
        ...(token ? { token } : {}),
        mode: 'open',
        pack: activePack,
        summary: activePack ? `开启共创：${activePack.title}` : '开启共创并等待共同选择模版',
      });
      setCollabActive(true);
      collabRevRef.current = res.revision ?? 1;
      setCollabRevision(res.revision ?? 1);
      setCollabHistory(res.history ?? []);
      setStatusMsg('已开启绑定机内存共创（仅内存同步，关闭或 45 分钟后自动焚毁）');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '开启内存共创失败');
    }
  };

  const copyAiCoCreatePrompt = async () => {
    const endpoint = mcpUrl || '当前棋室 /mcp';
    const partners = (self?.boundPartners ?? []).map((p) => p.username).join('、') || '你的绑定机';
    const prompt = `来和我一起共创一套自走棋棋谱吧！\nMCP 地址：${endpoint}\n步骤：\n1. 用你自己的 accountToken 调用 read_turn({ accountToken, studio: true }) 查看我当前的棋谱草稿、可选起步模版与数值体检。\n2. 用 act({ accountToken, requestId, kind: 'studio', studio: { ... } }) 调用 init_from_template（显式选定 starterId / starGrowthPreset / buffFlavor）、patch（增改羁绊、棋子和数值）或 duel（实测两张牌 1v1 TTK 与伤害）。\n说明：服务端不存储我们的自定义棋谱，我会自己保存在浏览器本地或导出 JSON 分享。`;
    try {
      await navigator.clipboard.writeText(prompt);
      setStatusMsg(`已复制给「${partners}」的共创口令`);
    } catch {
      setStatusMsg('请手动复制 MCP 地址并让绑定机调用 read_turn({ accountToken, studio: true })');
    }
  };

  const launchCustomMatch = async () => {
    if (!activePack || launching) return;
    const validation = validateCustomPack(activePack);
    if (!validation.playable) {
      setErrorMsg(`还差一点才能开局：${validation.playBlockers.join('；')}`);
      return;
    }
    setLaunching(true);
    setErrorMsg('');
    try {
      ensureCustomPackRegistered(activePack);
      const created = await roomRequest<{ roomId: string; token: string }>('create_custom', {
        name: self?.username || '你',
        customPack: activePack,
        mode: playMode,
        ...(token ? { accountToken: token } : {}),
      });
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ roomId: created.roomId, token: created.token }));
      } catch {
        // Ignore private browsing storage rejection
      }
      onEnterRoom?.(created.roomId, created.token);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '开启像素试玩房失败');
    } finally {
      setLaunching(false);
    }
  };

  const validation = activePack ? validateCustomPack(activePack) : null;
  const lastLog = collabHistory[collabHistory.length - 1];

  return (
    <section className="lobby-panel ps-root" aria-label="像素棋谱工坊">
      <div className="ps-shelf-bar">
        <div className="ps-shelf-left">
          <span className="ps-local-badge">
            <PixelSprite name="craftTome" size={14} />
            浏览器本地棋谱库 · 服务端不存档
          </span>
          {shelf.length ? (
            <select
              className="ps-select"
              aria-label="切换本地保存的棋谱"
              value={activePack?.id ?? ''}
              onChange={(e) => {
                const picked = shelf.find((entry) => entry.id === e.target.value);
                if (picked) {
                  setActivePack(picked.pack);
                  setSelectedUnitId(picked.pack.units[0]?.id ?? '');
                  setShowStarter(false);
                  setStatusMsg(`已切换至「${picked.pack.title}」`);
                  if (collabActive) void pushToBridge(picked.pack, `切换草稿至「${picked.pack.title}」`);
                }
              }}
            >
              {shelf.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.pack.title}（{entry.pack.units.length}棋 · {entry.pack.traits.length}羁绊）
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="ps-btn ps-btn--butter"
            onClick={() => setShowStarter(true)}
          >
            + 新建 / 选模版
          </button>
          <label className="ps-btn" style={{ cursor: 'pointer' }}>
            导入 JSON
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleHeaderImport} />
          </label>
          {activePack ? (
            <>
              <button
                type="button"
                className="ps-btn"
                onClick={() => {
                  exportPackJsonFile(activePack);
                  setStatusMsg(`已导出「${activePack.title}.autochess-pack.json」，可发给别人导入试玩`);
                }}
              >
                导出 JSON 分享
              </button>
              <button
                type="button"
                className="ps-btn ps-btn--danger"
                onClick={() => {
                  const remaining = deleteLocalPackEntry(activePack.id);
                  setShelf(remaining);
                  if (remaining[0]) {
                    setActivePack(remaining[0].pack);
                    setSelectedUnitId(remaining[0].pack.units[0]?.id ?? '');
                  } else {
                    setActivePack(null);
                    setShowStarter(true);
                  }
                  setStatusMsg(`已从浏览器本地删除「${activePack.title}」`);
                }}
              >
                删除本地稿
              </button>
            </>
          ) : null}
        </div>

        <div className="ps-shelf-right">
          {self && !self.isAi ? (
            <button
              type="button"
              className={`ps-btn ${collabActive ? 'ps-btn--active' : ''}`}
              onClick={() => void toggleCollab()}
            >
              {collabActive ? `绑定机共创中 · v${collabRevision}（点击关闭）` : '开启绑定机内存共创'}
            </button>
          ) : null}
          {activePack && !showStarter ? (
            <>
              <select
                className="ps-select"
                aria-label="试玩人数模式"
                value={playMode}
                onChange={(e) => setPlayMode(e.target.value as MatchModeId)}
              >
                <option value="duel">弈决 2 人</option>
                <option value="standard">标准 8 人</option>
              </select>
              <button
                type="button"
                className="ps-btn ps-btn--primary"
                disabled={launching || !validation?.playable}
                title={validation?.playBlockers.join('；') || '创建纯内存试玩房（可补路人机或邀绑定机同玩）'}
                onClick={() => void launchCustomMatch()}
              >
                {launching ? '正在铺开像素棋盘…' : '上像素真棋盘试玩'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {collabActive && self && !self.isAi ? (
        <div className="ps-collab-strip">
          <div className="ps-collab-meta">
            <strong>✦ 内存共创通道已开启（v{collabRevision}）</strong>
            <span>
              绑定的机：{(self.boundPartners ?? []).map((p) => p.username).join('、') || '暂无（可去「行囊」签发入籍码绑定机）'}
            </span>
            {lastLog ? (
              <span className="ps-collab-log">
                最近改动：{lastLog.actorName} — {lastLog.summary}
              </span>
            ) : null}
          </div>
          <div className="ps-field-row">
            <button type="button" className="ps-btn" onClick={() => void copyAiCoCreatePrompt()}>
              复制给机的共创暗号
            </button>
          </div>
        </div>
      ) : null}

      {errorMsg ? <div className="ps-alert" role="alert">{errorMsg}</div> : null}
      {statusMsg ? <div className="ps-ok-banner" role="status">{statusMsg}</div> : null}

      {showStarter || !activePack ? (
        <StarterChooserPanel
          hasExistingPacks={Boolean(activePack)}
          onCancel={() => setShowStarter(false)}
          onCreatePack={handleCreateFromStarter}
          onImportFile={(file) => void handleImportFile(file)}
        />
      ) : (
        <>
          <div className="ps-subtabs" role="tablist" aria-label="工坊设计模块">
            {STUDIO_SUBTABS.map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                aria-selected={subtab === tabItem.id}
                className={`ps-subtab ${subtab === tabItem.id ? 'is-active' : ''}`}
                onClick={() => setSubtab(tabItem.id)}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {subtab === 'rules' ? (
            <RulesPanel pack={activePack} onChangePack={handlePackChange} />
          ) : subtab === 'traits' ? (
            <TraitsMatrixPanel
              pack={activePack}
              onChangePack={handlePackChange}
              onJumpToUnit={(uid) => {
                setSelectedUnitId(uid);
                setSubtab('units');
              }}
            />
          ) : subtab === 'units' ? (
            <UnitBalancePanel
              pack={activePack}
              selectedUnitId={selectedUnitId}
              onSelectUnit={setSelectedUnitId}
              onChangePack={handlePackChange}
            />
          ) : subtab === 'items' ? (
            <ItemsPanel pack={activePack} onChangePack={handlePackChange} />
          ) : (
            <DuelLabPanel pack={activePack} />
          )}
        </>
      )}
    </section>
  );
}

