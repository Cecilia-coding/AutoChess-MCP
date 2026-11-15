import { pixelAvatarImage } from "@/lib/meta/pixel-items";
import { PixelIcon } from "./pixel-icon";

export type RankedSeat = {
  id: string;
  accountId?: string;
  name: string;
  hp: number;
  bot?: boolean;
  ready?: boolean;
  index: number;
};

export function PixelHpRail({
  ranking,
  selfIndex,
  enemyIndex,
  maxHp,
  levelText,
  xpText,
  xpPct,
  capText,
  bountyText,
}: {
  ranking: readonly RankedSeat[];
  selfIndex: number;
  enemyIndex?: number;
  maxHp: number;
  levelText?: string;
  xpText?: string;
  xpPct?: number;
  capText?: string;
  bountyText?: string | null;
}) {
  return (
    <aside className="room-ranking pixel-hp-rail" aria-label="当前排名">
      <div className="pixel-hp-rail-head">
        <PixelIcon name="heart" size={11} />
        <span>血量</span>
        <small>{ranking.length}</small>
      </div>

      <div className="pixel-hp-stack" role="list">
        {ranking.map((seat, rank) => {
          const isSelf = seat.index === selfIndex;
          const isEnemy = enemyIndex !== undefined && seat.index === enemyIndex;
          const dead = seat.hp <= 0;
          const pct = Math.max(0, Math.min(100, (seat.hp / Math.max(1, maxHp)) * 100));
          const avatarSrc = pixelAvatarImage(seat.accountId ?? seat.id, {
            bot: seat.bot,
            self: isSelf,
          });
          return (
            <div
              key={seat.id}
              role="listitem"
              className={`pixel-hp-card rank-${rank + 1} ${isSelf ? "is-self" : ""} ${isEnemy ? "is-enemy" : ""} ${dead ? "is-dead" : ""}`}
              title={`${seat.name}${seat.bot ? "（人机）" : ""} · ${seat.hp}/${maxHp} 血`}
            >
              <div className="pixel-hp-card-top">
                <div className="pixel-hp-avatar-wrap">
                  <img className="pixel-hp-avatar" src={avatarSrc} alt="" draggable={false} />
                  <em className={`pixel-hp-badge ${isEnemy ? "is-vs" : ""}`}>
                    {isEnemy ? <PixelIcon name="sword" size={9} /> : rank + 1}
                  </em>
                </div>
                <div className="pixel-hp-meta">
                  <span className="pixel-hp-name">
                    {isSelf ? "我" : seat.name}
                    {seat.bot && !isSelf ? <i>机</i> : null}
                  </span>
                  <b className="pixel-hp-num">{seat.hp}</b>
                </div>
              </div>
              <div className="pixel-hp-bar" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {levelText ? (
        <div className="pixel-hp-mini-pod" aria-label="当前等级与上阵上限">
          <div className="pixel-hp-mini-row">
            <b>{levelText}</b>
            {capText ? <span>{capText}</span> : null}
          </div>
          {xpText ? (
            <>
              <div className="pixel-hp-mini-xp">
                <small>XP</small>
                <small>{xpText}</small>
              </div>
              <div className="pixel-hp-mini-xpbar" aria-hidden="true">
                <i style={{ width: `${xpPct ?? 0}%` }} />
              </div>
            </>
          ) : null}
          {bountyText ? <div className="pixel-hp-bounty">{bountyText}</div> : null}
        </div>
      ) : null}
    </aside>
  );
}

/**
 * Ultra-compact vertical pixel avatar + HP strip docked inside the top-left
 * corner of `.pixel-scene` on narrow mobile screens where `.pixel-sidebar` is hidden.
 */
export function PixelHpSceneStrip({
  ranking,
  selfIndex,
  enemyIndex,
  maxHp,
}: {
  ranking: readonly RankedSeat[];
  selfIndex: number;
  enemyIndex?: number;
  maxHp: number;
}) {
  return (
    <div className="pixel-hp-scene-strip" aria-label="玩家简易血量">
      {ranking.map((seat) => {
        const isSelf = seat.index === selfIndex;
        const isEnemy = enemyIndex !== undefined && seat.index === enemyIndex;
        const dead = seat.hp <= 0;
        const pct = Math.max(0, Math.min(100, (seat.hp / Math.max(1, maxHp)) * 100));
        const avatarSrc = pixelAvatarImage(seat.accountId ?? seat.id, {
          bot: seat.bot,
          self: isSelf,
        });
        return (
          <div
            key={seat.id}
            className={`pixel-hp-chip ${isSelf ? "is-self" : ""} ${isEnemy ? "is-enemy" : ""} ${dead ? "is-dead" : ""}`}
          >
            <img src={avatarSrc} alt="" draggable={false} />
            <div className="pixel-hp-chip-info">
              <b>{seat.hp}</b>
              <span>
                <i style={{ width: `${pct}%` }} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
