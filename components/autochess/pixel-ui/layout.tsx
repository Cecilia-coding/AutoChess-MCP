import {
  createContext,
  useContext,
  useState,
  useImperativeHandle,
  useEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import { PixelIcon, type PixelIconName } from "./pixel-icon";
import "./theme.css";

export function PixelPanel({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: PixelIconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pixel-panel ${className}`}>
      <h2>
        <PixelIcon name={icon} />
        {title}
      </h2>
      <div className="pixel-panel-body">{children}</div>
    </section>
  );
}

type Pocket = "left" | "right" | null;
const PocketContext = createContext<{
  pocket: Pocket;
  toggle: (panel: "left" | "right", trigger: HTMLButtonElement) => void;
} | null>(null);

/** Narrow-screen drawer toggles. Rendered inside the board bar, hidden on wide layouts. */
export function PixelPocketButtons() {
  const pockets = useContext(PocketContext);
  if (!pockets) return null;
  return (
    <div className="pixel-pocket-controls">
      <button
        type="button"
        aria-label="玩家与羁绊"
        aria-expanded={pockets.pocket === "left"}
        onClick={(e) => pockets.toggle("left", e.currentTarget)}
      >
        <PixelIcon name="crown" size={16} />
      </button>
      <button
        type="button"
        aria-label="棋子资料与背包"
        aria-expanded={pockets.pocket === "right"}
        onClick={(e) => pockets.toggle("right", e.currentTarget)}
      >
        <PixelIcon name="bag" size={16} />
      </button>
    </div>
  );
}

/** Layout slots contain UI only. Room state and combat remain with their owners. */
export type PixelWorkspaceHandle = { show: (panel: "left" | "right") => void };
export function PixelWorkspace({
  left,
  right,
  children,
  ref,
}: {
  left: ReactNode;
  right: ReactNode;
  children: ReactNode;
  ref?: Ref<PixelWorkspaceHandle>;
}) {
  const [pocket, setPocket] = useState<Pocket>(null);
  const close = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useImperativeHandle(ref, () => ({ show: setPocket }), []);
  const dismiss = () => {
    setPocket(null);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!pocket) return;
    if (close.current?.getClientRects().length) close.current.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [pocket]);
  const toggle = (panel: "left" | "right", button: HTMLButtonElement) => {
    trigger.current = button;
    setPocket((current) => (current === panel ? null : panel));
  };
  return (
    <PocketContext.Provider value={{ pocket, toggle }}>
      <div className="pixel-workspace" data-pocket={pocket ?? ""}>
        <aside className="pixel-sidebar" aria-label="玩家与羁绊面板">
          {pocket === "left" ? <PocketHeader title="玩家与羁绊" close={close} onClose={dismiss} /> : null}
          {left}
        </aside>
        <div className="pixel-center">{children}</div>
        <aside className="pixel-sidebar pixel-sidebar-right" aria-label="棋子资料与背包面板">
          {pocket === "right" ? <PocketHeader title="棋子资料与背包" close={close} onClose={dismiss} /> : null}
          {right}
        </aside>
      </div>
    </PocketContext.Provider>
  );
}

function PocketHeader({
  title,
  close,
  onClose,
}: {
  title: string;
  close: Ref<HTMLButtonElement>;
  onClose: () => void;
}) {
  return (
    <div className="pixel-pocket-head">
      <strong>{title}</strong>
      <button ref={close} type="button" className="pixel-pocket-close" onClick={onClose}>
        返回棋盘 ×
      </button>
    </div>
  );
}

/**
 * Four stacked bands, no free-floating chrome:
 *   bar (who vs who · view tools) / scene / market (shop · actions · sell) / footer (bag · status · chat)
 */
export function PixelArenaLayout({
  scene,
  header,
  tools,
  overlay,
  sceneHud,
  details,
  inventory,
  actions,
  shop,
  status,
  footer,
  trashRef,
  shopRef,
  canSellSelected,
  onSellSelected,
  ghostRef,
}: {
  scene: ReactNode;
  header?: ReactNode;
  tools?: ReactNode;
  overlay?: ReactNode;
  sceneHud?: ReactNode;
  details?: ReactNode;
  inventory?: ReactNode;
  actions: ReactNode;
  shop?: ReactNode;
  status?: ReactNode;
  footer?: ReactNode;
  trashRef?: Ref<HTMLDivElement>;
  shopRef?: Ref<HTMLDivElement>;
  canSellSelected?: boolean;
  onSellSelected?: () => void;
  ghostRef?: Ref<HTMLDivElement>;
}) {
  return (
    <section className="pixel-arena-layout">
      <header className="pixel-board-bar">
        <PixelPocketButtons />
        <div className="pixel-bar-main">{header}</div>
        {tools ? <div className="pixel-bar-tools">{tools}</div> : null}
      </header>
      <div className={`pixel-scene-row ${details ? "has-details" : ""}`}>
        <div className="pixel-scene">
          {scene}
          {sceneHud}
          {overlay ? <div className="pixel-scene-overlay">{overlay}</div> : null}
        </div>
        {details ? <div className="pixel-detail-slot">{details}</div> : null}
      </div>
      <div className="pixel-market-layout">
        {shop ? (
          <div ref={shopRef} className="pixel-shop-slot" data-sell-banner="🪙 松手出售棋子">
            {shop}
          </div>
        ) : null}
        <div className="pixel-action-cell">
          {actions}
          <div
            ref={trashRef}
            id="sell"
            role={canSellSelected ? "button" : undefined}
            tabIndex={canSellSelected ? 0 : undefined}
            onClick={canSellSelected ? onSellSelected : undefined}
            onKeyDown={
              canSellSelected
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSellSelected?.();
                    }
                  }
                : undefined
            }
            className={`pixel-sell ${canSellSelected ? "is-clickable" : ""}`}
            aria-label={canSellSelected ? "出售当前选中棋子或拖入出售" : "拖入出售棋子"}
          >
            <PixelIcon name="trash" size={13} />
            <span>{canSellSelected ? "出售选中" : "拖入出售"}</span>
          </div>
        </div>
      </div>
      <footer className="pixel-footer">
        {inventory ? <div className="pixel-inventory-slot">{inventory}</div> : null}
        <div className="pixel-status-line" role="status">
          {status}
        </div>
        {footer ? <div className="pixel-footer-extra">{footer}</div> : null}
      </footer>
      <div ref={ghostRef} className="pixel-drag-ghost" style={{ display: "none" }} aria-hidden="true">
        <img alt="" />
        <span />
      </div>
    </section>
  );
}
