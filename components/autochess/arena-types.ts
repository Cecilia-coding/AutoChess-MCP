import type { MutableRefObject, ReactNode } from "react";
import type { BattleOutput, Combatant } from "@/lib/autochess/types";
import type { BoardModelRef } from "@/lib/meta/board-assets";
import type { PackTerms } from "@/packs/terms";

export type ClientDropTarget = { kind: "cell"; row: number; col: number } | { kind: "bench" } | null;
export type ClientUnitTarget = { id: string; zone: "board" | "bench" } | null;
export type ItemPreviewTarget = { unitId: string; valid: boolean } | null;

export type Props = {
  renderer?: "pixel-2d" | "3d";
  appearanceId?: string;
  board: Combatant[];
  bench: Combatant[];
  enemyBoard: Combatant[];
  enemyBench: Combatant[];
  opponentName: string;
  skinId?: string;
  visiting?: boolean;
  battle: BattleOutput | null;
  timeMs: number;
  running: boolean;
  editable: boolean;
  /** 双方棋盘皮肤（渲染层只认颜色，不认 id）。 */
  homePalette?: { inner: string; outer: string; sky: string };
  awayPalette?: { inner: string; outer: string; sky: string };
  /** 本视角玩家的棋盘 3D 模型（有就用真模型，没有落回程序化庭院 + palette）。 */
  boardModel?: BoardModelRef;
  terms: PackTerms;
  selectedId?: string;
  onCell: (row: number, col: number) => void;
  onBench: (id: string) => void;
  onWithdraw: () => void;
  onDrop: (
    source: { kind: "board" | "bench"; id: string },
    target: { kind: "cell"; row: number; col: number } | { kind: "bench" | "sell" },
  ) => void;
  controls: ReactNode;
  inventory: ReactNode;
  topPanel: ReactNode;
  notice: string;
  inspectorActions: (piece: Combatant) => ReactNode;
  onUnequipPiece?: (pieceId: string, itemId: string) => void;
  onDismiss: () => void;
  onInspect: () => void;
  shopOpen: boolean;
  shopEnabled: boolean;
  onShopToggle: () => void;
  /** Pixel layout only: content of the board bar (matchup, stage). */
  hud?: ReactNode;
  /** Pixel layout only: embedded trailing icon slots in the board bar (inbox, feedback, menu). */
  hudTools?: ReactNode;
  /** Pixel layout only: lift inspected piece to docked right panel when available. */
  inspectedPieceId?: string | null;
  onInspectChange?: (pieceId: string | null) => void;
  /** Pixel layout only: non-interactive layer above the canvas (danmaku). */
  overlay?: ReactNode;
  /** Pixel layout only: compact in-scene HUD (e.g. mobile left vertical pixel HP strip). */
  sceneHud?: ReactNode;
  /** Pixel layout only: trailing footer content (danmaku composer). */
  footer?: ReactNode;
  /** Pixel layout only: latest room log line, shown in the footer status. */
  log?: string;
  /** Optional imperative lookup to resolve a screen point onto a board cell or bench slot (e.g. shop card drag-to-deploy). */
  dropAtClientRef?: MutableRefObject<((clientX: number, clientY: number) => ClientDropTarget) | null>;
  /** Optional imperative preview highlight while dragging a shop card over the arena. */
  previewClientRef?: MutableRefObject<((point: { x: number; y: number } | null) => void) | null>;
  /** Optional imperative lookup to resolve an own unit under a screen point (for drag-to-equip). */
  unitAtClientRef?: MutableRefObject<((clientX: number, clientY: number) => ClientUnitTarget) | null>;
  /** Optional imperative highlight of an own unit while dragging an item over the arena. */
  previewItemRef?: MutableRefObject<((target: ItemPreviewTarget) => void) | null>;
  /** Optional armed item id when user clicks an item in backpack to 1-tap equip onto a unit. */
  armedItemId?: string | null;
};
