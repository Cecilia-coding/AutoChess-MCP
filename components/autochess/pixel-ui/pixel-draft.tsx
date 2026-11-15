import type { DraftReward } from "@/lib/autochess/core";
import type { Tile } from "@/lib/game/board";
import { itemImage } from "@/lib/meta/cosmetics";
import { goldAmount, type PackTerms } from "@/packs/terms";
import { PixelIcon } from "./pixel-icon";

export type ActiveDraft = {
  round: number;
  sourceRound?: number;
  track: DraftReward[];
  position: number;
  roll?: number;
  landing?: number;
};

const PIP_COORDS: Record<number, readonly [number, number][]> = {
  1: [[7, 7]],
  2: [
    [4, 4],
    [10, 10],
  ],
  3: [
    [4, 4],
    [7, 7],
    [10, 10],
  ],
  4: [
    [4, 4],
    [10, 4],
    [4, 10],
    [10, 10],
  ],
  5: [
    [4, 4],
    [10, 4],
    [7, 7],
    [4, 10],
    [10, 10],
  ],
  6: [
    [4, 3.5],
    [10, 3.5],
    [4, 7],
    [10, 7],
    [4, 10.5],
    [10, 10.5],
  ],
};

function PixelDie({ value, rolling }: { value?: number; rolling: boolean }) {
  const pips = value !== undefined ? (PIP_COORDS[value] ?? PIP_COORDS[1]!) : null;
  return (
    <div
      className={`room-dice-face pixel-die-box ${rolling ? "is-rolling" : ""} ${value !== undefined ? "is-landed" : ""}`}
      aria-label={value === undefined ? "骰子" : `骰点 ${value}`}
    >
      <svg width="52" height="52" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
        {/* Outer plum pixel border & bottom bevel */}
        <rect x="1" y="1" width="14" height="14" fill="#5e4c7a" />
        <rect x="2" y="2" width="12" height="11" fill="#fffdf9" />
        <rect x="2" y="13" width="12" height="1" fill="#dfd5ee" />
        <rect x="2" y="2" width="12" height="1" fill="#ffffff" />
        {/* Corner notches */}
        <rect x="1" y="1" width="1" height="1" fill="#faf8fd" />
        <rect x="14" y="1" width="1" height="1" fill="#faf8fd" />
        <rect x="1" y="14" width="1" height="1" fill="#faf8fd" />
        <rect x="14" y="14" width="1" height="1" fill="#faf8fd" />
        {pips ? (
          pips.map(([cx, cy], idx) =>
            value === 1 ? (
              <g key={idx}>
                <rect x={cx - 1} y={cy - 2} width="4" height="4" fill="#d96b8a" />
                <rect x={cx} y={cy - 1} width="2" height="2" fill="#f7a8be" />
              </g>
            ) : (
              <rect key={idx} x={cx - 0.5} y={cy - 1} width="2" height="2" fill="#46385c" />
            ),
          )
        ) : (
          /* Crisp pixel question mark before rolling */
          <g fill="#8c75b5">
            <rect x="6" y="4" width="4" height="1" />
            <rect x="5" y="5" width="2" height="1" />
            <rect x="9" y="5" width="2" height="2" />
            <rect x="7" y="7" width="2" height="2" />
            <rect x="7" y="10" width="2" height="2" fill="#d96b8a" />
          </g>
        )}
      </svg>
      <span className="pixel-die-caption">{value === undefined ? "待投掷" : `${value} 点`}</span>
    </div>
  );
}

function RewardGlyph({ reward, large = false }: { reward?: DraftReward; large?: boolean }) {
  if (!reward) return null;
  if (reward.kind === "unit") {
    return (
      <img
        className={`pixel-draft-art ${large ? "is-large" : ""}`}
        src={itemImage(reward.unitId, { label: reward.label })}
        alt=""
      />
    );
  }
  if (reward.kind === "item") {
    return (
      <img
        className={`pixel-draft-art ${large ? "is-large" : ""}`}
        src={itemImage(reward.itemId, { label: reward.label, pixel: true })}
        alt=""
      />
    );
  }
  const sz = large ? 22 : 13;
  if (reward.kind === "gold") {
    return (
      <span className={`pixel-draft-emblem is-gold ${large ? "is-large" : ""}`}>
        <PixelIcon name="coin" size={sz} />
      </span>
    );
  }
  if (reward.kind === "heal") {
    return (
      <span className={`pixel-draft-emblem is-heal ${large ? "is-large" : ""}`}>
        <PixelIcon name="heart" size={sz} />
      </span>
    );
  }
  if (reward.kind === "mishap") {
    return (
      <span className={`pixel-draft-emblem is-mishap ${large ? "is-large" : ""}`}>
        <PixelIcon name="bolt" size={sz} />
      </span>
    );
  }
  const uniqueIcon =
    reward.uniqueId === "field-cap" ? "crown" : reward.uniqueId === "star-token" ? "star" : "bag";
  return (
    <span className={`pixel-draft-emblem is-unique ${large ? "is-large" : ""}`}>
      <PixelIcon name={uniqueIcon} size={sz} />
    </span>
  );
}

export function formatDraftReward(
  reward: DraftReward | undefined,
  terms: PackTerms,
): { label: string; detail: string } | undefined {
  if (!reward) return undefined;
  if (reward.kind === "gold") {
    return {
      label: goldAmount(terms, reward.amount),
      detail: `立即获得${terms.gold.name}`,
    };
  }
  return { label: reward.label, detail: reward.detail };
}

function stepDistance(from: number, to: number, total: number) {
  return ((to - from) % total + total) % total;
}

export function PixelDraft({
  draft,
  tiles,
  terms,
  intro,
  busy,
  onClose,
  onAct,
}: {
  draft: ActiveDraft;
  tiles: readonly Tile[];
  terms: PackTerms;
  intro?: string;
  busy: boolean;
  onClose: () => void;
  onAct: () => void;
}) {
  const activeIdx = draft.landing ?? draft.position;
  const landed = draft.landing !== undefined ? draft.track[draft.landing] : undefined;
  const landedCopy = formatDraftReward(landed, terms);
  const total = tiles.length || 18;
  const idleIntro =
    intro ?? `棋子招募、行囊装备、${terms.gold.name}补给或小小奇遇，都藏在这圈像素旅途里。`;

  return (
    <div className="pixel-draft-backdrop" role="presentation">
      <section className="room-draft pixel-draft-modal" aria-label="旅途选秀">
        <header className="room-draft-header pixel-draft-header">
          <div className="pixel-draft-title-wrap">
            <span className="room-draft-kicker pixel-draft-kicker">
              <PixelIcon name="dice" size={12} />
              <span>旅途棋盘 · 第 {draft.round} 轮</span>
            </span>
            <h2>旅途选秀</h2>
            <p>每轮一次掷骰寻宝，落点已锁定；领取后直接回到棋盘排布阵容。</p>
          </div>
          <button type="button" className="pixel-draft-back" onClick={onClose}>
            暂回棋盘 ×
          </button>
        </header>

        <div className="board-grid pixel-draft-grid">
          {tiles.map((tile, i) => {
            const reward = draft.track[i];
            const rewardCopy = formatDraftReward(reward, terms);
            const isActive = activeIdx === i;
            const isStart = draft.position === i && draft.landing !== undefined && draft.landing !== i;
            const dist = draft.roll !== undefined ? stepDistance(draft.position, i, total) : 0;
            const isTrail = draft.roll !== undefined && dist > 0 && dist < draft.roll;

            return (
              <article
                key={tile.id}
                data-kind={reward?.kind ?? tile.type}
                className={`board-tile pixel-draft-tile ${tile.type} ${isActive ? "active" : ""} ${isStart ? "is-start" : ""} ${isTrail ? "is-trail" : ""}`}
                style={{ gridRow: tile.coordinate[0], gridColumn: tile.coordinate[1] }}
              >
                <div className="pixel-tile-head">
                  <span className="tile-number">{String(i + 1).padStart(2, "0")}</span>
                  {isActive ? (
                    <em className="pixel-tile-tag is-active">
                      {draft.landing !== undefined ? "落点" : "起点"}
                    </em>
                  ) : isStart ? (
                    <em className="pixel-tile-tag is-start">起</em>
                  ) : null}
                </div>
                <div className="pixel-tile-mid">
                  <RewardGlyph reward={reward} />
                  <div className="pixel-tile-copy">
                    <strong>{tile.name}</strong>
                    <small title={rewardCopy?.detail}>{rewardCopy?.label}</small>
                  </div>
                </div>
              </article>
            );
          })}

          <div className="board-center pixel-draft-center">
            <span className="room-draft-state pixel-draft-state">
              {draft.roll === undefined
                ? "✦ 等待掷骰 · 沿环路前进 1–6 步"
                : `✦ 掷出 ${draft.roll} 点 · 抵达 #${String((draft.landing ?? 0) + 1).padStart(2, "0")} ${tiles[draft.landing ?? 0]?.name ?? ""}`}
            </span>

            <div className="pixel-draft-stage">
              <PixelDie value={draft.roll} rolling={busy && draft.roll === undefined} />
              {landed ? (
                <>
                  <span className="pixel-stage-arrow" aria-hidden="true">
                    ▸
                  </span>
                  <div className="pixel-landed-pedestal" data-kind={landed.kind}>
                    <RewardGlyph reward={landed} large />
                  </div>
                </>
              ) : null}
            </div>

            <h3>{landedCopy ? landedCopy.label : "下一站，会遇见什么？"}</h3>
            <p>{landedCopy ? landedCopy.detail : idleIntro}</p>

            <button
              type="button"
              className={`room-draft-primary pixel-primary ${landed?.kind === "mishap" ? "is-mishap" : ""}`}
              disabled={busy}
              onClick={onAct}
            >
              <PixelIcon
                name={draft.roll === undefined ? "dice" : landed?.kind === "mishap" ? "bolt" : "star"}
                size={14}
              />
              <span>
                {busy
                  ? "正在结算…"
                  : draft.roll === undefined
                    ? "掷骰子 · 出发"
                    : landed?.kind === "mishap"
                      ? "接受遭遇 · 返回棋盘"
                      : "领取奖励 · 返回棋盘"}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
