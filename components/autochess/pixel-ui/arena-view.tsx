import type { Ref, ReactNode } from "react";
import type { Props } from "../arena-types";
import type { Combatant } from "../../../lib/autochess/types";
import { findUnit } from "../../../content/autochess/units";
import { BENCH_CAPACITY } from "../../../lib/autochess/constants";
import { starLabel } from "../../../packs/terms";
import { PixelArenaLayout } from "./layout";
import { PixelIcon } from "./pixel-icon";

export function PixelArenaView({
  view,
  host,
  trash,
  shopSlot,
  ghost,
  canSellSelected,
  onSellSelected,
  inspector,
  onInspect,
  fullscreen,
  onFullscreen,
  onZoom,
  onReset,
  error,
  notice,
}: {
  view: Props;
  host: Ref<HTMLDivElement>;
  trash: Ref<HTMLDivElement>;
  shopSlot?: Ref<HTMLDivElement>;
  ghost?: Ref<HTMLDivElement>;
  canSellSelected?: boolean;
  onSellSelected?: () => void;
  inspector?: ReactNode;
  onInspect: (piece: Combatant) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onZoom: (factor: number) => void;
  onReset: () => void;
  error: string;
  notice: string;
}) {
  const phase = view.running ? "战斗进行中" : view.editable ? "布阵阶段" : "观战";
  return (
    <PixelArenaLayout
      scene={<div ref={host} className="pixel-canvas-host" aria-label="像素棋盘" />}
      header={
        view.hud ?? (
          <strong className="pixel-phase">
            <PixelIcon name="sword" size={14} />
            {phase}
          </strong>
        )
      }
      tools={
        <>
          <details className="pixel-enemy-reserve">
            <summary title="侦察对面备战席">
              <PixelIcon name="eye" size={12} />
              <span className="pixel-hud-slot-label">侦察</span>
              <b>{view.enemyBench.length}</b>/{BENCH_CAPACITY}
            </summary>
            <div>
              {view.enemyBench.length ? (
                view.enemyBench.map((piece) => (
                  <button key={piece.id} type="button" onClick={() => onInspect(piece)}>
                    {findUnit(piece.templateId)?.name} {starLabel(view.terms, piece.star)}
                  </button>
                ))
              ) : (
                <span>对方备战席为空</span>
              )}
            </div>
          </details>
          <div className="pixel-view-controls" role="group" aria-label="棋盘视图">
            <button type="button" className="pixel-zoom" aria-label="缩小棋盘" title="缩小棋盘" onClick={() => onZoom(1.2)}>
              <PixelIcon name="minus" size={12} />
            </button>
            <button type="button" className="pixel-zoom" aria-label="放大棋盘" title="放大棋盘" onClick={() => onZoom(1 / 1.2)}>
              <PixelIcon name="plus" size={12} />
            </button>
            <button type="button" aria-label="重置视图" title="重置视角" onClick={onReset}>
              <PixelIcon name="refresh" size={12} />
            </button>
            <button type="button" className="pixel-fullscreen-btn" aria-label={fullscreen ? "退出全屏" : "全屏"} title={fullscreen ? "退出全屏" : "全屏模式"} onClick={onFullscreen}>
              <PixelIcon name="frame" size={12} />
            </button>
          </div>
          {view.hudTools}
        </>
      }
      overlay={view.overlay}
      sceneHud={view.sceneHud}
      details={inspector}
      actions={view.controls}
      shop={view.topPanel}
      inventory={view.inventory}
      trashRef={trash}
      shopRef={shopSlot}
      ghostRef={ghost}
      canSellSelected={canSellSelected}
      onSellSelected={onSellSelected}
      footer={view.footer}
      status={
        error ? (
          <>
            <span role="alert">{error}</span>
            <button type="button" onClick={() => window.location.reload()}>
              重新加载
            </button>
          </>
        ) : (
          notice || view.log || "拖入己方格子布阵 · 点击棋子查看详情 · 双指放大查看细节"
        )
      }
    />
  );
}
