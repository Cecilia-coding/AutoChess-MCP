import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createRef } from "react";
import {
  PixelArenaLayout,
  PixelPanel,
  PixelWorkspace,
  type PixelWorkspaceHandle,
} from "../components/autochess/pixel-ui/layout";
import { PixelIcon } from "../components/autochess/pixel-ui/pixel-icon";
import { aiRoster } from "../packs/ai/roster";
import { aiPixelAppearance } from "../packs/ai/presentation/appearance";
import { unitSkill } from "../content/autochess/unit-skills";

export function mountPreviewLayout() {
  const workspace = createRef<PixelWorkspaceHandle>();
  const portrait = (id: string) =>
    aiPixelAppearance.publicPath +
    aiPixelAppearance.manifest.units.find((u) => u.id === id)!.portrait;
  const shop = ["ai-claude", "ai-kimi", "ai-musespark", "ai-grok", "ai-replika"];
  flushSync(() =>
    createRoot(document.getElementById("root")!).render(
      <main className="pixel-game">
        <PixelWorkspace
          ref={workspace}
          left={
            <>
              <div className="pixel-identity">
                <div className="pixel-brand">
                  <PixelIcon name="sword" size={30} />
                  <div>
                    <h1>模型乱斗</h1>
                    <small>AUTOCHESS · PIXEL ARENA</small>
                  </div>
                </div>
                <span className="pixel-room-label">本地试棋室</span>
                <div className="pixel-wallet">
                  <span>
                    <PixelIcon name="coin" />
                    <b id="gold">20</b>
                  </span>
                  <span className="pixel-level">
                    <PixelIcon name="crown" />
                    阵容 <b id="army-count">4</b>
                  </span>
                </div>
              </div>
              <PixelPanel title="对局席位" icon="crown">
                {[
                  ["01", "我方", "100"],
                  ["02", "陪练阵容", "100"],
                ].map(([rank, name, hp], i) => (
                  <div className={`pixel-player ${i === 0 ? "is-self" : ""}`} key={rank}>
                    <span className="place">{rank}</span>
                    <strong>{name}</strong>
                    <span className="life">
                      <PixelIcon name="heart" /> {hp}
                    </span>
                  </div>
                ))}
                <p className="pixel-description">自由布阵 · 真实战斗回放</p>
              </PixelPanel>
              <PixelPanel title="阵容羁绊" icon="star">
                <div id="traits" />
              </PixelPanel>
              <PixelPanel title="试棋设置" icon="frame">
                <div className="pixel-preview-tools">
                  <label htmlFor="character" className="pixel-description">
                    替换第一枚备战棋子
                  </label>
                  <select id="character" aria-label="预览角色" />
                  <button id="reset">
                    <PixelIcon name="refresh" size={14} />
                    重置棋局
                  </button>
                  <a href="/assets/pixel-mascots/preview/index.html" className="pixel-description">
                    角色与特效图鉴 ↗
                  </a>
                  <div className="pixel-replay-settings">
                    <span id="time">备战</span>
                    <input
                      id="seek"
                      aria-label="回放进度"
                      type="range"
                      min="0"
                      max="45000"
                      defaultValue="0"
                    />
                    <span>本地预览 · 棋局不保存</span>
                  </div>
                </div>
              </PixelPanel>
            </>
          }
          right={
            <>
              <PixelPanel title="棋子资料" icon="scroll">
                <div className="pixel-profile-art">
                  <img id="profile-art" src={portrait("ai-musespark")} alt="" />
                </div>
                <div className="pixel-profile-title">
                  <strong id="profile-name">Muse</strong>
                  <span id="profile-star">1 星</span>
                </div>
                <div className="pixel-attributes">
                  <div>
                    生命
                    <b id="profile-hp" />
                  </div>
                  <div>
                    攻击
                    <b id="profile-atk" />
                  </div>
                  <div>
                    护甲
                    <b id="profile-armor" />
                  </div>
                  <div>
                    射程
                    <b id="profile-range" />
                  </div>
                </div>
                <div className="pixel-skill-title">
                  <PixelIcon name="star" size={15} />
                  <strong id="profile-skill" />
                </div>
                <p id="profile-note" className="pixel-description" />
              </PixelPanel>
              <PixelPanel title="装备背包" icon="bag">
                <div className="pixel-bag-grid">
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} />
                  ))}
                </div>
                <p className="pixel-description">暂无待装配装备</p>
              </PixelPanel>
              <PixelPanel title="对局记录" icon="scroll">
                <div id="journal" className="pixel-journal">
                  <p>拖动备战棋子进入己方格子，然后开始试战。</p>
                </div>
              </PixelPanel>
            </>
          }
        >
          <PixelArenaLayout
            scene={<div id="arena" />}
            header={
              <strong className="pixel-phase">
                <PixelIcon name="sword" size={14} />
                <span id="stage-label">布阵阶段</span>
              </strong>
            }
            tools={
              <div className="pixel-view-controls" role="group" aria-label="棋盘视图">
                <button id="zoom-out" className="pixel-zoom" aria-label="缩小棋盘">
                  <PixelIcon name="minus" size={12} />
                </button>
                <output id="zoom-level">100%</output>
                <button id="zoom-in" className="pixel-zoom" aria-label="放大棋盘">
                  <PixelIcon name="plus" size={12} />
                </button>
                <button id="fit" aria-label="重置视图">
                  <PixelIcon name="frame" size={12} />
                </button>
              </div>
            }
            actions={
              <>
                <button id="deploy">返回布阵</button>
                <button id="play">
                  <PixelIcon name="pause" size={14} />
                  <span>播放</span>
                </button>
                <button id="battle" className="pixel-primary">
                  <PixelIcon name="sword" size={16} />
                  开始试战
                </button>
              </>
            }
            shop={
              <>
                <div className="pixel-shop-heading">
                  <PixelIcon name="bag" size={17} />
                  <strong>招募商店</strong>
                  <span className="pixel-shop-balance">
                    <PixelIcon name="coin" size={12} />
                    <b data-preview-gold>20</b>
                  </span>
                  <span>
                    备战区 <b id="bench-count">3</b>/9
                  </span>
                  <div className="pixel-shop-tools">
                    <button id="refresh-shop">
                      <PixelIcon name="refresh" size={13} />
                      刷新 · 2
                    </button>
                  </div>
                </div>
                <div className="pixel-shop-grid">
                  {shop.map((id) => {
                    const unit = aiRoster.find((u) => u.id === id)!;
                    return (
                      <button
                        className="pixel-shop-card"
                        data-template={id}
                        data-cost={unit.cost}
                        key={id}
                      >
                        <img src={portrait(id)} alt="" />
                        <strong>{unit.name}</strong>
                        <span className="pixel-price">
                          <PixelIcon name="coin" size={12} />
                          {unit.cost}
                        </span>
                        <small>{unitSkill(id)?.name}</small>
                      </button>
                    );
                  })}
                </div>
              </>
            }
            status={<span id="status">滚轮或双指缩放 · 拖动空白处平移 · 点击棋子查看资料</span>}
          />
        </PixelWorkspace>
      </main>,
    ),
  );
  return { showInfo: () => workspace.current?.show("right") };
}
