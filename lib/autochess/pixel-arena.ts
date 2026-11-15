import { deploymentView, ownCellFromWorld } from "./arena-view";
import { frameAt, type UnitFrame } from "./frame";
import { pixelPose, loopPhase } from "./pixel-animation";
import {
  PIXEL_BOARD,
  fitPixelBoard,
  pixelPoint as boardPoint,
  pixelCell as boardCell,
  pixelBench as boardBench,
  pixelBenchSlot as boardBenchSlot,
} from "./pixel-board";
import { pixelAppearance } from "../../packs/presentation";
import { applyBoardSkinToAppearance } from "../meta/pixel-board-skins";
import type { PixelAppearance, PixelEffectAdapter, EffectCue } from "../presentation/types";
import { hexAlpha, paintAnimatedBoardAccents, paintStaticBoardScene, paintTranslucentDragGrid, type AnimatedAnchor } from "./pixel-board-decor";
import { BENCH_CAPACITY, BOARD_ROWS, BOARD_COLS, HALF_ROWS } from "./constants";
import { canKeepArenaDrag } from "./arena-drag-state.js";
import { itemImage } from "../meta/cosmetics";
import type { BattleOutput, Combatant, CombatEvent } from "./types";
import type { ItemPreviewTarget, Props } from "../../components/autochess/arena-types";

type Point = { x: number; y: number };
type Entry = { piece: Combatant; reserve: boolean; enemy: boolean; index: number };
type Callbacks = Pick<Props, "onCell" | "onBench" | "onWithdraw" | "onDrop"> & {
  onInspect: (piece: Combatant) => void;
  saleHitTest: (x: number, y: number) => boolean;
  onSaleHover: (active: boolean) => void;
  onDragGhost?: (
    info: { templateId: string; name: string; x: number; y: number; overSell: boolean } | null,
  ) => void;
};

/** Canvas-only rendering; combat and economy remain in the shared engine. */
export type StarTierVisual = {
  stars: 1 | 2 | 3;
  scale: number;
  ring: null | {
    rx: number;
    ry: number;
    outer: string;
    inner: string;
    pulse: boolean;
    cornerTicks: boolean;
  };
  crestBg: string;
  crestDivider: string;
  starFill: string;
  starCore: string;
  barFrame: string;
  barHighlight: string;
  labelBorder: string;
};

const STAR_TIER_VISUALS: Record<1 | 2 | 3, StarTierVisual> = {
  1: {
    stars: 1,
    scale: 1,
    ring: null,
    crestBg: "#473c4e",
    crestDivider: "#72647d",
    starFill: "#ded3c3",
    starCore: "#fffaf2",
    barFrame: "#3b314a",
    barHighlight: "#ffffff40",
    labelBorder: "#b6a4cddb",
  },
  2: {
    stars: 2,
    scale: 1.1,
    ring: {
      rx: 15,
      ry: 8,
      outer: "#4f9ec7",
      inner: "#e0f6ff",
      pulse: false,
      cornerTicks: false,
    },
    crestBg: "#214663",
    crestDivider: "#5ba8d6",
    starFill: "#7be0ff",
    starCore: "#ffffff",
    barFrame: "#30648a",
    barHighlight: "#8ae5ff",
    labelBorder: "#458eb8",
  },
  3: {
    stars: 3,
    scale: 1.2,
    ring: {
      rx: 18,
      ry: 9,
      outer: "#f2be5c",
      inner: "#fff8dc",
      pulse: true,
      cornerTicks: true,
    },
    crestBg: "#57370f",
    crestDivider: "#d99b38",
    starFill: "#ffd24c",
    starCore: "#fffdf0",
    barFrame: "#9e6b14",
    barHighlight: "#ffd24c",
    labelBorder: "#c78618",
  },
};

/** Resolve deterministic visual tokens (scale, ground seal, badge palette) for a 1–3★ unit. */
export function starTierVisual(star: number): StarTierVisual {
  const tier: 1 | 2 | 3 = star >= 3 ? 3 : star === 2 ? 2 : 1;
  return STAR_TIER_VISUALS[tier];
}

/** Paint a razor-sharp 5x5 pixel five-point star at integer canvas coordinates. */
function drawPixelStar(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  fill: string,
  core: string,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(sx + 2, sy, 1, 3);
  ctx.fillRect(sx + 1, sy + 1, 3, 2);
  ctx.fillRect(sx, sy + 2, 5, 1);
  ctx.fillRect(sx + 1, sy + 3, 1, 1);
  ctx.fillRect(sx + 3, sy + 3, 1, 1);
  ctx.fillRect(sx, sy + 4, 1, 1);
  ctx.fillRect(sx + 4, sy + 4, 1, 1);
  ctx.fillStyle = core;
  ctx.fillRect(sx + 2, sy + 1, 1, 2);
}

export function createArena(
  host: HTMLDivElement,
  callbacks: Callbacks,
  _artwork?: unknown,
  _options: { standalone?: boolean } = { standalone: true },
) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "像素棋盘");
  canvas.dataset.renderer = "pixel-2d";
  canvas.tabIndex = 0;
  host.append(canvas);
  const context = canvas.getContext("2d");
  if (!context) {
    canvas.remove();
    throw new Error("浏览器无法创建 2D 棋盘");
  }
  const ctx = context;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const images = new Map<string, HTMLImageElement>();
  let disposed = false,
    raf = 0,
    view: Props | undefined,
    output: BattleOutput | undefined;
  let signature = "",
    lastSync = performance.now(),
    zoom = 1,
    width = 1,
    height = 1;
  let transform = { scale: 1, x: 0, y: 0 };
  let board = PIXEL_BOARD;
  const pixelPoint = (row: number, col: number) => boardPoint(row, col, board);
  const pixelCell = (x: number, y: number) => boardCell(x, y, board);
  const pixelBench = (index: number) => boardBench(index, board);
  const pixelBenchSlot = (x: number, y: number) => boardBenchSlot(x, y, board);
  let pan = { x: 0, y: 0 };
  let entries = new Map<string, Entry>();
  let baseAppearance: PixelAppearance | undefined,
    currentSkinId: string | undefined,
    appearance: PixelAppearance | undefined,
    effectAdapter: PixelEffectAdapter | undefined;
  let cues: EffectCue[] = [],
    appearanceGeneration = 0;
  let motions = new Map<string, CombatEvent[]>();
  let drawn: { id: string; point: Point }[] = [];
  /** Displayed HP fraction that lags behind real HP (visual only). */
  const trails = new Map<string, number>();
  let lastPaint = performance.now(),
    frameDt = 0;
  const px = () => {
    const size = Math.min(appearance?.bodyScale ?? 3, board.cellWidth / 24, board.benchSpacing / 22);
    const density = transform.scale * Math.min(devicePixelRatio || 1, 2);
    // Snap the sprite pixels, never the whole board: rounding the camera down
    // used to discard a large portion of the available scene.
    return Math.max(1, Math.round(size * density)) / density;
  };
  let pointer: {
    id: number;
    start: Point;
    grabOffset: Point;
    unitId?: string;
    dragging: boolean;
    outsideCanvas: boolean;
    point: Point;
    client: Point;
    panStart: Point;
    panning: boolean;
  } | null = null;
  let externalPreview: Point | null = null;
  let itemPreview: ItemPreviewTarget = null;
  const touches = new Map<number, Point>();
  let pinchDistance = 0,
    pinchZoom = 1;
  const image = (file: string) => {
    if (!images.has(file)) {
      const asset = new Image();
      const direct = file.startsWith("data:") || file.startsWith("/") || file.startsWith("http");
      const suffix = !direct && appearance?.assetVersion ? `?v=${appearance.assetVersion}` : "";
      asset.src = direct ? file : (appearance?.publicPath ?? "") + file + suffix;
      images.set(file, asset);
    }
    const asset = images.get(file)!;
    return asset.complete && asset.naturalWidth > 0 ? asset : null;
  };
  const cancel = () => {
    const id = pointer?.id;
    pointer = null;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    callbacks.onSaleHover(false);
    callbacks.onDragGhost?.(null);
    canvas.style.cursor = "";
  };
  function setView(next: Props) {
    const nextBase = pixelAppearance(next.appearanceId);
    const nextSkin = next.skinId;
    if (nextBase !== baseAppearance) {
      baseAppearance = nextBase;
      currentSkinId = nextSkin;
      appearance = nextBase ? applyBoardSkinToAppearance(nextBase, nextSkin) : undefined;
      images.clear();
      effectAdapter = undefined;
      cues = [];
      signature = "";
      const generation = ++appearanceGeneration;
      nextBase
        ?.loadEffects()
        .then((adapter) => {
          if (disposed || generation !== appearanceGeneration) return;
          effectAdapter = adapter;
          cues = output ? adapter.compile(output) : [];
        })
        .catch((error) => console.error("Appearance effects failed to load", error));
    } else if (nextSkin !== currentSkinId) {
      currentSkinId = nextSkin;
      appearance = nextBase ? applyBoardSkinToAppearance(nextBase, nextSkin) : undefined;
    }
    if (
      pointer?.unitId &&
      !pointer.panning &&
      view?.editable &&
      !canKeepArenaDrag(view, next, pointer.unitId)
    )
      cancel();
    if (view?.timeMs !== next.timeMs || view?.battle !== next.battle) lastSync = performance.now();
    view = next;
    const key = JSON.stringify([
      next.battle?.battleId,
      next.board,
      next.bench,
      next.enemyBoard,
      next.enemyBench,
    ]);
    if (signature === key) return;
    signature = key;
    const base = next.battle ?? deploymentView(next.board, next.enemyBoard);
    output = { ...base, units: [...base.units], events: [...base.events] };
    entries = new Map();
    motions = new Map();
    trails.clear();
    for (const [enemy, reserve, pieces] of [
      [false, false, next.board],
      [true, false, next.enemyBoard],
      [false, true, next.bench],
    ] as const) {
      pieces.forEach((piece, index) => {
        const id = reserve ? `reserve-left-${piece.id}` : piece.id;
        entries.set(id, { piece, index, enemy, reserve });
        if (reserve) {
          const line = deploymentView([piece], []).units[0]!;
          output!.units.push({ ...line, id });
          output!.events.push({
            seq: -1,
            timeMs: 0,
            type: "spawn",
            sourceId: id,
            pos: { row: 0, col: 0 },
            text: "",
          });
        }
      });
    }
    output.events.sort((a, b) => a.timeMs - b.timeMs || a.seq - b.seq);
    cues = effectAdapter?.compile(output) ?? [];
    for (const event of output.events)
      if (event.sourceId && event.pos && (event.type === "move" || event.type === "spawn")) {
        const list = motions.get(event.sourceId) ?? [];
        list.push(event);
        motions.set(event.sourceId, list);
      }
  }
  function location(id: string, time: number) {
    const entry = entries.get(id);
    if (entry?.reserve) return { ...pixelBench(entry.index), moving: false, lift: 0 };
    const list = motions.get(id) ?? [];
    let index = 0;
    while (index + 1 < list.length && list[index + 1]!.timeMs <= time) index++;
    const current = list[index];
    if (!current?.pos) return { x: 0, y: 0, moving: false, lift: 0 };
    const to = pixelPoint(current.pos.row, current.pos.col);
    const moving = current.type === "move" && time >= current.timeMs && time - current.timeMs < 300;
    if (moving && index > 0 && !reduced) {
      const before = list[index - 1]!.pos!;
      const from = pixelPoint(before.row, before.col);
      const q = Math.max(0, Math.min(1, (time - current.timeMs) / 300));
      const ease = q * q * (3 - 2 * q);
      // A short hop per step reads as a footstep instead of an ice-skate glide.
      const lift = Math.sin(q * Math.PI) * px() * 3;
      return { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, moving, lift };
    }
    return { ...to, moving, lift: 0 };
  }
  function resize() {
    const sizeChanged = Math.abs(width - host.clientWidth) > 2 || Math.abs(height - host.clientHeight) > 2;
    if (sizeChanged && !pointer?.dragging) {
      cancel();
      zoom = 1;
      pan = { x: 0, y: 0 };
    }
    width = host.clientWidth;
    height = host.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const fitted = fitPixelBoard(width, height);
    board = fitted.board;
    if (zoom <= 1.04) {
      zoom = 1;
      pan = { x: 0, y: 0 };
    } else {
      const scaledW = board.width * fitted.scale * zoom;
      const scaledH = board.height * fitted.scale * zoom;
      const maxPanX = Math.max(0, (scaledW - width) / 2);
      const maxPanY = Math.max(0, (scaledH - height) / 2);
      pan = {
        x: Math.max(-maxPanX, Math.min(maxPanX, pan.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, pan.y)),
      };
    }
    const scale = fitted.scale * zoom;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    transform = {
      scale,
      x: snap((width - board.width * scale) / 2 + pan.x),
      y: snap((height - board.height * scale) / 2 + pan.y),
    };
    canvas.dataset.zoom = String(zoom);
    canvas.dataset.panX = String(pan.x);
    canvas.dataset.panY = String(pan.y);
    canvas.dataset.transformX = String(transform.x);
    canvas.dataset.transformY = String(transform.y);
    canvas.dataset.boardWidth = String(board.width * scale);
    canvas.dataset.boardHeight = String(board.height * scale);
    canvas.dispatchEvent(new CustomEvent("viewchange", { detail: { zoom } }));
  }
  function zoomAt(next: number, anchor: Point = { x: width / 2, y: height / 2 }) {
    const world = {
      x: (anchor.x - transform.x) / transform.scale,
      y: (anchor.y - transform.y) / transform.scale,
    };
    const clamped = Math.max(1, Math.min(3, next));
    zoom = clamped <= 1.04 ? 1 : clamped;
    resize();
    if (zoom > 1) {
      pan.x += anchor.x - (transform.x + world.x * transform.scale);
      pan.y += anchor.y - (transform.y + world.y * transform.scale);
      resize();
    }
  }
  const fillNotched = (x: number, y: number, w: number, h: number, step: number, color: string) => {
    const rx = Math.round(x),
      ry = Math.round(y),
      rw = Math.round(w),
      rh = Math.round(h),
      s = Math.max(1, Math.round(step));
    ctx.fillStyle = color;
    if (rw <= s * 2 || rh <= s * 2) {
      ctx.fillRect(rx, ry, Math.max(1, rw), Math.max(1, rh));
      return;
    }
    ctx.fillRect(rx + s, ry, rw - s * 2, rh);
    ctx.fillRect(rx, ry + s, rw, rh - s * 2);
  };
  let sceneCache: {
    key: string;
    canvas: HTMLCanvasElement;
    anchors: AnimatedAnchor[];
  } | null = null;
  let dragGridAlpha = 0;
  let lastGridFadeAt = 0;
  function paintBackgroundLayer(dpr: number): AnimatedAnchor[] {
    const cacheKey = `${Math.round(board.width * 10)}|${Math.round(board.height * 10)}|${dpr}|${appearance?.id ?? ""}|${currentSkinId ?? ""}`;
    if (!sceneCache || sceneCache.key !== cacheKey) {
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.max(1, Math.ceil(board.width * dpr));
      offscreen.height = Math.max(1, Math.ceil(board.height * dpr));
      const octx = offscreen.getContext("2d");
      let anchors: AnimatedAnchor[] = [];
      if (octx) {
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.imageSmoothingEnabled = false;
        anchors = paintStaticBoardScene(octx, board, appearance);
      }
      sceneCache = { key: cacheKey, canvas: offscreen, anchors };
    }
    ctx.drawImage(sceneCache.canvas, 0, 0, board.width, board.height);

    const occupiedBench = new Set<number>();
    for (const entry of entries.values()) {
      if (entry.reserve && !entry.enemy) occupiedBench.add(entry.index);
    }
    ctx.textAlign = "center";
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = hexAlpha(appearance?.boardColors?.text ?? "#7c6c96", 0.52);
    for (let i = 0; i < BENCH_CAPACITY; i++) {
      if (occupiedBench.has(i)) continue;
      const p = pixelBench(i);
      ctx.fillText(String(i + 1), Math.round(p.x), Math.round(p.y + 3));
    }
    return sceneCache.anchors;
  }
  function unitLift(unit: UnitFrame, time: number, lift = 0) {
    const castAge =
      unit.acting === "cast" && unit.attackAt !== undefined ? time - unit.attackAt : Infinity;
    const castHop =
      !reduced && unit.alive && castAge >= 0 && castAge < 320
        ? Math.sin((castAge / 320) * Math.PI) * px() * 2.4
        : 0;
    return lift + castHop;
  }
  function drawUnit(unit: UnitFrame, point: Point, time: number, moving: boolean, lift = 0) {
    const entry = entries.get(unit.id);
    const character = appearance?.manifest.units.find(
      (character) => character.id === (unit.appearanceId ?? entry?.piece.templateId),
    );
    const selected = entry?.piece.id === view?.selectedId;
    const itemHover =
      !entry?.enemy && entry?.piece.id && entry.piece.id === itemPreview?.unitId
        ? itemPreview
        : null;
    const itemArmed =
      !itemHover && Boolean(view?.editable && view?.armedItemId && entry && !entry.enemy);
    const star = entry?.piece.star ?? 1;
    const starStyle = starTierVisual(star);
    const size = px();
    const unitSize = size * starStyle.scale;
    const grid = (v: number) => Math.round(v / size) * size;
    const x = Math.round(point.x),
      y = Math.round(point.y);
    const totalLift = unitLift(unit, time, lift);
    // Soft plum-tinted pixel ground shadow that shrinks while airborne.
    const squash = 1 - Math.min(0.42, totalLift / (size * 8));
    ctx.fillStyle = appearance?.boardTheme?.shadow ?? "#4d3f63";
    ctx.globalAlpha = unit.alive ? 0.22 : 0.1;
    for (const [w, dy] of [
      [8, -1],
      [12, 0],
      [8, 1],
    ] as const) {
      const half = grid((w * size * squash) / 2);
      ctx.fillRect(x - half, y + dy * size - 1, half * 2, size);
    }
    ctx.globalAlpha = 1;
    // Star-tier ground seal (none for 1★, crisp silver-azure seal for 2★, pulsing gold halo + corners for 3★)
    if (unit.alive && starStyle.ring) {
      const ring = starStyle.ring;
      const shimmer = ring.pulse && !reduced ? Math.sin(performance.now() / 260) * 1.5 : 0;
      const rx = Math.round(ring.rx + shimmer);
      const top = y - Math.floor(ring.ry / 2);
      ctx.strokeStyle = ring.outer;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - rx, top, rx * 2, ring.ry);
      ctx.strokeStyle = ring.inner;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - rx + 1.5, top + 1.5, rx * 2 - 3, ring.ry - 3);
      if (ring.cornerTicks) {
        ctx.fillStyle = ring.inner;
        ctx.fillRect(x - rx - 1, top - 1, 2, 2);
        ctx.fillRect(x + rx - 1, top - 1, 2, 2);
        ctx.fillRect(x - rx - 1, top + ring.ry - 1, 2, 2);
        ctx.fillRect(x + rx - 1, top + ring.ry - 1, 2, 2);
      }
    }
    if (selected || itemHover || itemArmed) {
      const pulse = reduced ? 0 : Math.floor(performance.now() / 320) % 2 ? size : 0;
      const l = x - 30 - pulse,
        t = y - 54 - pulse,
        r = x + 30 + pulse,
        b = y + 10 + pulse,
        arm = itemHover ? 12 : 10;
      const bracketFill = itemHover
        ? itemHover.valid
          ? "#72d6b3"
          : "#e3849e"
        : itemArmed
          ? "#95dec2"
          : "#ffe082";
      if (itemHover) {
        ctx.fillStyle = itemHover.valid ? "#7fd4b630" : "#e3849e2b";
        ctx.fillRect(l + 2, t + 2, r - l - 4, b - t - 4);
      }
      for (const [cx, cy, sx, sy] of [
        [l, t, 1, 1],
        [r, t, -1, 1],
        [l, b, 1, -1],
        [r, b, -1, -1],
      ] as const) {
        ctx.fillStyle = "#4d3d66";
        ctx.fillRect((sx > 0 ? cx : cx - arm) - 1, (sy > 0 ? cy : cy - 3) - 1, arm + 2, 5);
        ctx.fillRect((sx > 0 ? cx : cx - 3) - 1, (sy > 0 ? cy : cy - arm) - 1, 5, arm + 2);
        ctx.fillStyle = bracketFill;
        ctx.fillRect(sx > 0 ? cx : cx - arm, sy > 0 ? cy : cy - 3, arm, 3);
        ctx.fillRect(sx > 0 ? cx : cx - 3, sy > 0 ? cy : cy - arm, 3, arm);
      }
    }
    const hitAge = unit.hitAt === undefined ? Infinity : time - unit.hitAt;
    const shake = !reduced && unit.alive && hitAge >= 0 && hitAge < 160
      ? (Math.floor(hitAge / 40) % 2 ? size : -size)
      : 0;
    const deathAge = unit.deathAt === undefined ? 0 : time - unit.deathAt;
    const fade = unit.alive ? 1 : Math.max(0.3, Math.min(1, 1 - (deathAge - 700) / 500));
    const atlas = character ? image(character.atlas) : null;
    if (atlas && appearance) {
      const { frame } = pixelPose(
        appearance.manifest.clips,
        unit,
        time,
        moving,
        reduced,
        loopPhase(unit.id),
      );
      const anchor = appearance.manifest.frame.anchor;
      const dx = x + shake - anchor.x * unitSize,
        dy = y - grid(totalLift) - anchor.y * unitSize;
      ctx.globalAlpha = fade;
      ctx.drawImage(
        atlas,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        dx,
        dy,
        frame.w * unitSize,
        frame.h * unitSize,
      );
      if (!reduced && hitAge >= 0 && hitAge < 90) {
        // Additive redraw brightens only opaque sprite pixels: a one-beat hit flash.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.6 * (1 - hitAge / 90);
        ctx.drawImage(
          atlas,
          frame.x,
          frame.y,
          frame.w,
          frame.h,
          dx,
          dy,
          frame.w * unitSize,
          frame.h * unitSize,
        );
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (unit.alive && (unit.shield ?? 0) > 0 && appearance.shield) {
        const shield = appearance.shield,
          bubble = image(shield.file);
        if (bubble)
          ctx.drawImage(
            bubble,
            x + shake - shield.anchor.x * unitSize,
            y - grid(totalLift) - shield.anchor.y * unitSize,
            shield.width * unitSize,
            shield.height * unitSize,
          );
      }
    } else {
      const boxW = Math.round(34 * starStyle.scale);
      const boxH = Math.round(32 * starStyle.scale);
      ctx.fillStyle = character?.color ?? "#dfd4ed";
      ctx.fillRect(x - Math.round(boxW / 2), y - boxH - 2 - totalLift, boxW, boxH);
      ctx.fillStyle = "#3c3347";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(unit.name.slice(0, 2), x, y - 12 - totalLift);
    }
    if (unit.alive) {
      const frac = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
      let trail = trails.get(unit.id) ?? frac;
      trail = frac >= trail ? frac : Math.max(frac, trail - frameDt * 0.7);
      trails.set(unit.id, trail);
      const bx = x - 24,
        by = y + 8;
      ctx.fillStyle = starStyle.barFrame;
      ctx.fillRect(bx, by, 48, 9);
      if (starStyle.stars >= 2) {
        ctx.fillStyle = starStyle.barHighlight;
        ctx.fillRect(bx + 1, by, 46, 1);
      }
      ctx.fillStyle = "#ebe4f5";
      ctx.fillRect(bx + 1, by + 1, 46, 4);
      ctx.fillStyle = "#ffe29a";
      ctx.fillRect(bx + 1 + Math.round(46 * frac), by + 1, Math.round(46 * (trail - frac)), 4);
      ctx.fillStyle = unit.team === "right" ? "#ef8ca3" : "#6dd1ae";
      ctx.fillRect(bx + 1, by + 1, Math.round(46 * frac), 4);
      ctx.fillStyle = "#ffffff66";
      ctx.fillRect(bx + 1, by + 1, Math.round(46 * frac), 1);
      ctx.fillStyle = "#d9d0e8";
      ctx.fillRect(bx + 1, by + 6, 46, 2);
      ctx.fillStyle = "#7cc0f0";
      ctx.fillRect(
        bx + 1,
        by + 6,
        Math.round(46 * Math.max(0, Math.min(1, unit.mana / Math.max(1, unit.maxMana)))),
        2,
      );

    }
  }
  function drawUnitLabel(unit: UnitFrame, point: Point, time: number, lift = 0) {
    if (!unit.alive) return;
    const entry = entries.get(unit.id);
    const selected = entry?.piece.id === view?.selectedId;
    const itemHover =
      !entry?.enemy && entry?.piece.id && entry.piece.id === itemPreview?.unitId
        ? itemPreview
        : null;
    const size = px();
    const grid = (v: number) => Math.round(v / size) * size;
    const x = Math.round(point.x),
      y = Math.round(point.y);
    const totalLift = unitLift(unit, time, lift);
    const fontPx = Math.round(Math.max(11, Math.min(13, 9.5 / Math.min(1, transform.scale))));
    ctx.save();
    ctx.font = `700 ${fontPx}px ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const starStyle = starTierVisual(entry?.piece.star ?? 1);
    const starSpanW = starStyle.stars * 5 + (starStyle.stars - 1) * 2;
    const crestW = starSpanW + 6;
    const label = unit.name;
    const slotWidth = entry?.reserve ? board.benchSpacing - 4 : board.cellWidth - 6;
    const maxW = Math.max(58, Math.round(slotWidth));
    const maxTextW = Math.max(20, maxW - crestW - 10);
    const textW = Math.min(maxTextW, Math.ceil(ctx.measureText(label).width));
    const pillW = crestW + textW + 10;
    const pillH = fontPx + 4;
    const pillX = Math.round(x - pillW / 2);
    const shielded = (unit.shield ?? 0) > 0 && Boolean(appearance?.shield);
    const headTop = Math.round(
      y - grid(totalLift) - (shielded ? 25.5 : 21.5) * size * starStyle.scale,
    );
    const equippedIds = entry?.piece.itemIds ?? [];
    const pillY = entry?.reserve
      ? Math.round(y + 19)
      : Math.max(equippedIds.length ? 19 : 13, headTop - pillH - 2);
    const tierBorder = starStyle.stars >= 2 ? starStyle.labelBorder : null;
    const [borderColor, fillColor, textColor] = itemHover
      ? itemHover.valid
        ? ["#4ea889", "#e3fbf2f5", "#1f3d32"]
        : ["#cc5c7d", "#fde6eef5", "#541c2d"]
      : selected
        ? ["#cf9b3e", "#fff5d6f2", "#3b2d1f"]
        : entry?.reserve
          ? [tierBorder ?? "#b6a4cddb", "#faf7fee8", "#392e4a"]
          : unit.team === "right"
            ? [tierBorder ?? "#cca0b0db", "#fff6f9e6", "#422f3c"]
            : [tierBorder ?? "#86bcabdb", "#f3fcf8e6", "#2c423b"];
    ctx.fillStyle = borderColor;
    ctx.fillRect(pillX, pillY, pillW, pillH);
    ctx.fillStyle = fillColor;
    ctx.fillRect(pillX + 1, pillY + 1, pillW - 2, pillH - 2);
    ctx.fillStyle = starStyle.crestBg;
    ctx.fillRect(pillX + 1, pillY + 1, crestW, pillH - 2);
    ctx.fillStyle = starStyle.crestDivider;
    ctx.fillRect(pillX + 1 + crestW, pillY + 1, 1, pillH - 2);
    ctx.fillStyle = "#ffffff55";
    ctx.fillRect(pillX + 1, pillY + 1, pillW - 2, 1);
    const starStartX = pillX + 1 + Math.round((crestW - starSpanW) / 2);
    const starY = Math.round(pillY + (pillH - 5) / 2);
    for (let s = 0; s < starStyle.stars; s++) {
      drawPixelStar(
        ctx,
        starStartX + s * 7,
        starY,
        starStyle.starFill,
        starStyle.starCore,
      );
    }
    const nameCenterX = pillX + 2 + crestW + (textW + 7) / 2;
    ctx.fillStyle = textColor;
    ctx.fillText(label, nameCenterX, pillY + pillH / 2 + 0.5, maxTextW);
    if (equippedIds.length) {
      const iconSz = 15;
      const gap = 2;
      const count = Math.min(2, equippedIds.length);
      const totalW = count * iconSz + (count - 1) * gap;
      const startX = Math.round(x - totalW / 2);
      const badgeY = entry?.reserve
        ? Math.max(3, headTop - iconSz - 1)
        : Math.max(2, pillY - iconSz - 1);
      for (let i = 0; i < count; i++) {
        const itemId = equippedIds[i]!;
        const bx = startX + i * (iconSz + gap);
        const iconImg = image(itemImage(itemId, { pixel: true }));
        ctx.fillStyle = "#46385c";
        ctx.fillRect(bx, badgeY, iconSz, iconSz);
        ctx.fillStyle = "#fcfafe";
        ctx.fillRect(bx + 1, badgeY + 1, iconSz - 2, iconSz - 2);
        if (iconImg) {
          ctx.drawImage(iconImg, bx + 1, badgeY + 1, iconSz - 2, iconSz - 2);
        } else {
          ctx.fillStyle = "#f2c15a";
          ctx.fillRect(bx + 4, badgeY + 4, iconSz - 8, iconSz - 8);
        }
      }
    }
    ctx.restore();
  }
  function effects(time: number, units: Map<string, UnitFrame>) {
    if (!output) return;
    const pixelRatio = px() / 3;
    for (const cue of cues) {
      const progress = (time - cue.start) / cue.duration;
      if (progress < 0 || progress >= 1) continue;
      const atlas = image(cue.file);
      if (!atlas) continue;
      const frame =
        cue.frames[
          Math.min(
            cue.frames.length - 1,
            Math.floor((reduced ? 0.5 : progress) * cue.frames.length),
          )
        ]!;
      const to = location(cue.unitId, time),
        from = cue.fromId ? location(cue.fromId, time) : to;
      const arcHeight = cue.fromId && !reduced ? 24 : 0;
      const arc = arcHeight ? Math.sin(progress * Math.PI) * arcHeight : 0;
      const p = {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress - 24 - arc,
      };
      const drawScale = cue.scale * pixelRatio;
      if (cue.fromId && !reduced) {
        // Pastel comet sparkle trail along flight arc
        for (let k = 1; k <= 3; k++) {
          const tp = progress - k * 0.07;
          if (tp <= 0) continue;
          const tx = from.x + (to.x - from.x) * tp;
          const ty = from.y + (to.y - from.y) * tp - 24 - Math.sin(tp * Math.PI) * arcHeight;
          const sz = Math.max(2, Math.round((4 - k) * pixelRatio * 1.4));
          ctx.fillStyle = appearance?.boardTheme?.sparkTrail ?? "#3b314a99";
          ctx.fillRect(Math.round(tx - sz / 2) - 1, Math.round(ty - sz / 2) - 1, sz + 2, sz + 2);
          ctx.fillStyle = k === 1 ? "#fffdf7" : (appearance?.boardTheme?.sparkCore ?? "#f5d7ff");
          ctx.fillRect(Math.round(tx - sz / 2), Math.round(ty - sz / 2), sz, sz);
        }
      }
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      if (cue.rotate && cue.fromId) {
        const vx = to.x - from.x;
        const vy = to.y - from.y - arcHeight * Math.PI * Math.cos(progress * Math.PI);
        if (Math.hypot(vx, vy) > 2) ctx.rotate(Math.atan2(vy, vx));
      }
      ctx.drawImage(
        atlas,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        Math.round(-cue.anchor.x * drawScale),
        Math.round(-cue.anchor.y * drawScale),
        frame.w * drawScale,
        frame.h * drawScale,
      );
      ctx.restore();
    }
    const life = 780;
    for (const event of output.events) {
      const age = time - event.timeMs;
      if (
        age < 0 ||
        age > life ||
        !event.targetIds?.length ||
        !event.value ||
        !["damage", "heal", "shield"].includes(event.type)
      )
        continue;
      const id = event.targetIds[0]!,
        to = location(id, time);
      const maxHp = units.get(id)?.maxHp ?? 1000;
      const big = event.type === "damage" && event.value >= maxHp * 0.15;
      const rise = 1 - Math.pow(1 - Math.min(1, age / 320), 3);
      const pop = reduced ? 1 : age < 110 ? 1 + 0.45 * (1 - age / 110) : 1;
      const q = age / life;
      // Scatter by sequence so simultaneous hits do not stack into one smudge.
      const jitter = (((event.seq * 7919) % 5) - 2) * 7;
      ctx.save();
      ctx.globalAlpha = q < 0.62 ? 1 : 1 - (q - 0.62) / 0.38;
      ctx.font = `bold ${Math.round((big ? 22 : 16) * pop)}px monospace`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#362b47";
      const text = `${event.type === "damage" ? "−" : "+"}${Math.round(event.value)}`;
      const tx = Math.round(to.x + 18 + jitter),
        ty = Math.round(to.y - 46 - rise * 24);
      ctx.strokeText(text, tx, ty);
      ctx.fillStyle =
        event.type === "heal"
          ? "#88ecc0"
          : event.type === "shield"
            ? "#9ee0ff"
            : big
              ? "#ffcf70"
              : event.skillId
                ? "#f7b2ea"
                : "#fffaf0";
      ctx.fillText(text, tx, ty);
      ctx.restore();
    }
  }
  function paint(now: number) {
    if (disposed) return;
    frameDt = Math.min(0.1, Math.max(0, (now - lastPaint) / 1000));
    lastPaint = now;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = appearance?.boardColors.background ?? "#e5e0f0";
    ctx.fillRect(0, 0, width, height);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    ctx.imageSmoothingEnabled = false;
    const anchors = paintBackgroundLayer(dpr);
    paintAnimatedBoardAccents(ctx, board, appearance, anchors, now, reduced);
    drawn = [];
    if (view && output) {
      const time = view.battle
        ? Math.min(
            output.durationMs,
            view.timeMs + (view.running ? Math.min(200, now - lastSync) : 0),
          )
        : now;
      const frame = frameAt(output, view.battle ? time : 0);
      const dragFoot = pointer?.dragging
        ? {
            x: pointer.point.x + pointer.grabOffset.x,
            y: pointer.point.y + pointer.grabOffset.y,
          }
        : null;
      const previewFoot = dragFoot && !pointer?.outsideCanvas ? dragFoot : externalPreview;
      const hoverDrop = previewFoot ? resolveWorldDrop(previewFoot) : null;
      const isPlacingPiece = Boolean(
        view?.editable && ((pointer?.dragging && !pointer.outsideCanvas) || externalPreview),
      );
      const fadeDt = lastGridFadeAt > 0 ? Math.max(0, Math.min(80, now - lastGridFadeAt)) : 16;
      lastGridFadeAt = now;
      if (reduced) {
        dragGridAlpha = isPlacingPiece ? 1 : 0;
      } else {
        const fadeStep = fadeDt / (isPlacingPiece ? 130 : 160);
        dragGridAlpha = isPlacingPiece
          ? Math.min(1, dragGridAlpha + fadeStep)
          : Math.max(0, dragGridAlpha - fadeStep);
      }
      if (dragGridAlpha > 0.01) {
        paintTranslucentDragGrid(
          ctx,
          board,
          appearance,
          dragGridAlpha,
          hoverDrop?.kind === "cell"
            ? { row: hoverDrop.worldRow, col: hoverDrop.worldCol }
            : null,
        );
      }
      const actors = frame.units
        .map((unit) => {
          const p = location(unit.id, view!.battle ? time : 0);
          return {
            unit,
            p:
              pointer?.dragging && pointer.unitId === unit.id && dragFoot
                ? { ...dragFoot, moving: false, lift: px() * 4 }
                : p,
          };
        })
        .sort((a, b) => Number(a.unit.alive) - Number(b.unit.alive) || a.p.y - b.p.y);
      if (hoverDrop?.kind === "cell") {
        const c = pixelPoint(hoverDrop.worldRow, hoverDrop.worldCol);
        fillNotched(
          Math.round(c.x - board.cellWidth / 2) + 2,
          Math.round(c.y - board.rowHeight / 2) + 2,
          Math.round(board.cellWidth) - 4,
          Math.round(board.rowHeight) - 4,
          2,
          "#ffffff78",
        );
      } else if (hoverDrop?.kind === "bench") {
        const leftX = Math.round(board.benchLeft - board.benchSpacing / 2);
        const spanW = Math.round(board.benchSpacing * BENCH_CAPACITY);
        fillNotched(leftX, board.benchY - 33, spanW, 67, 3, "#4da888");
        fillNotched(leftX + 2, board.benchY - 31, spanW - 4, 63, 2, "#b5ebd754");
      }
      for (const { unit, p } of actors) {
        if (pointer?.dragging && pointer.outsideCanvas && pointer.unitId === unit.id) continue;
        drawUnit(unit, p, time, p.moving, p.lift);
        drawn.push({ id: unit.id, point: p });
      }
      for (const { unit, p } of actors) {
        if (pointer?.dragging && pointer.outsideCanvas && pointer.unitId === unit.id) continue;
        drawUnitLabel(unit, p, time, p.lift);
      }
      if (view.battle) effects(time, new Map(frame.units.map((unit) => [unit.id, unit])));
      if (hoverDrop?.kind === "cell") {
        const p = pixelPoint(hoverDrop.worldRow, hoverDrop.worldCol);
        const hx = Math.round(p.x - board.cellWidth / 2) + 1;
        const hy = Math.round(p.y - board.rowHeight / 2) + 1;
        const hw = Math.round(board.cellWidth) - 2;
        const hh = Math.round(board.rowHeight) - 2;
        const arm = 10;
        ctx.fillStyle = "#3a9c7a";
        for (const [bx, by, sx, sy] of [
          [hx, hy, 1, 1],
          [hx + hw, hy, -1, 1],
          [hx, hy + hh, 1, -1],
          [hx + hw, hy + hh, -1, -1],
        ] as const) {
          ctx.fillRect(sx > 0 ? bx + 2 : bx - arm, sy > 0 ? by : by - 3, arm - 2, 3);
          ctx.fillRect(sx > 0 ? bx : bx - 3, sy > 0 ? by + 2 : by - arm, 3, arm - 2);
          ctx.fillRect(sx > 0 ? bx + 1 : bx - 4, sy > 0 ? by + 1 : by - 4, 3, 3);
        }
      }
    }
    raf = requestAnimationFrame(paint);
  }
  function clientToWorld(clientX: number, clientY: number): Point {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    };
  }
  function local(event: PointerEvent): Point {
    return clientToWorld(event.clientX, event.clientY);
  }
  function resolveWorldDrop(foot: Point) {
    const ownTop = board.top + HALF_ROWS * board.rowHeight - 16;
    const ownBottom = board.top + BOARD_ROWS * board.rowHeight + 18;
    if (foot.y >= ownTop && foot.y <= ownBottom) {
      const clampedY = Math.max(
        board.top + HALF_ROWS * board.rowHeight + 2,
        Math.min(board.top + BOARD_ROWS * board.rowHeight - 2, foot.y),
      );
      const worldRow = Math.max(
        HALF_ROWS,
        Math.min(BOARD_ROWS - 1, Math.floor((clampedY - board.top) / board.rowHeight)),
      );
      const rawCol = (foot.x - board.left - (worldRow - BOARD_ROWS / 2) * board.skew) / board.cellWidth;
      if (rawCol >= -0.35 && rawCol < BOARD_COLS + 0.35) {
        const worldCol = Math.max(0, Math.min(BOARD_COLS - 1, Math.floor(rawCol)));
        const own = ownCellFromWorld(worldRow, worldCol);
        if (own) return { kind: "cell" as const, worldRow, worldCol, ...own };
      }
    }
    const benchLeftEdge = board.benchLeft - board.benchSpacing * 0.65;
    const benchRightEdge = board.benchLeft + (BENCH_CAPACITY - 0.35) * board.benchSpacing;
    if (
      foot.y > ownBottom &&
      foot.y <= board.height + 40 &&
      foot.x >= benchLeftEdge &&
      foot.x <= benchRightEdge
    ) {
      return { kind: "bench" as const };
    }
    return null;
  }
  function hit(point: Point) {
    const direct = [...drawn]
      .reverse()
      .find(
        (unit) =>
          Math.abs(point.x - unit.point.x) < Math.min(board.cellWidth * 0.52, 16 * px()) &&
          point.y >= unit.point.y - 28 * px() &&
          point.y <= unit.point.y + 24,
      )?.id;
    if (direct || !view?.editable) return direct;
    const slot = pixelBenchSlot(point.x, point.y);
    if (slot !== null && view.bench[slot]) return `reserve-left-${view.bench[slot]!.id}`;
    const cell = pixelCell(point.x, point.y);
    const own = cell && ownCellFromWorld(cell.row, cell.col);
    if (own) {
      const piece = view.board.find((p) => p.localRow === own.row && p.localCol === own.col);
      if (piece) return piece.id;
    }
    return undefined;
  }
  function down(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.cancelable) event.preventDefault();
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic or detached pointer */
    }
    if (touches.size > 1) {
      cancel();
      const points = [...touches.values()];
      pinchDistance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
      pinchZoom = zoom;
      return;
    }
    const point = local(event);
    const unitId = hit(point);
    const origin = unitId ? location(unitId, 0) : null;
    const grabOffset = origin
      ? {
          x: Math.max(-26, Math.min(26, origin.x - point.x)),
          y: Math.max(-8, Math.min(46, origin.y - point.y)),
        }
      : { x: 0, y: 0 };
    pointer = {
      id: event.pointerId,
      start: point,
      grabOffset,
      point,
      unitId,
      dragging: false,
      outsideCanvas: false,
      client: { x: event.clientX, y: event.clientY },
      panStart: { ...pan },
      panning: false,
    };
  }
  function move(event: PointerEvent) {
    if (touches.has(event.pointerId))
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size > 1 && pinchDistance > 0) {
      const points = [...touches.values()];
      const dist = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
      const ratio = dist / pinchDistance;
      if (pinchZoom <= 1.04 && ratio < 1.1) return;
      const rect = canvas.getBoundingClientRect();
      zoomAt(pinchZoom * ratio, {
        x: (points[0]!.x + points[1]!.x) / 2 - rect.left,
        y: (points[0]!.y + points[1]!.y) / 2 - rect.top,
      });
      return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    if (event.cancelable) event.preventDefault();
    pointer.point = local(event);
    const entry = pointer.unitId ? entries.get(pointer.unitId) : undefined;
    const dx = event.clientX - pointer.client.x,
      dy = event.clientY - pointer.client.y;
    if (
      zoom > 1.05 &&
      (!view?.editable || !entry || entry.enemy) &&
      (pointer.panning || Math.hypot(dx, dy) > 18)
    ) {
      pointer.panning = true;
      pan = { x: pointer.panStart.x + dx, y: pointer.panStart.y + dy };
      resize();
      canvas.style.cursor = "grabbing";
      return;
    }
    if (view?.editable && entry && !entry.enemy && Math.hypot(dx, dy) > 5) {
      pointer.dragging = true;
    }
    if (pointer.dragging && entry) {
      const overSell = callbacks.saleHitTest(event.clientX, event.clientY);
      callbacks.onSaleHover(overSell);
      const rect = canvas.getBoundingClientRect();
      const outside =
        overSell ||
        event.clientY > rect.bottom - 18 ||
        event.clientY < rect.top + 8 ||
        event.clientX < rect.left + 8 ||
        event.clientX > rect.right - 8;
      pointer.outsideCanvas = outside;
      if (outside) {
        const unitMeta = appearance?.manifest.units.find(
          (u) => u.id === entry.piece.templateId,
        );
        callbacks.onDragGhost?.({
          templateId: entry.piece.templateId,
          name: unitMeta?.name ?? entry.piece.templateId,
          x: event.clientX,
          y: event.clientY,
          overSell,
        });
      } else {
        callbacks.onDragGhost?.(null);
      }
      canvas.style.cursor = "grabbing";
    }
  }
  function up(event: PointerEvent) {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinchDistance = 0;
    if (!pointer || pointer.id !== event.pointerId) return;
    const current = pointer,
      point = local(event),
      entry = current.unitId ? entries.get(current.unitId) : undefined;
    const sale = callbacks.saleHitTest(event.clientX, event.clientY);
    cancel();
    if (current.panning) return;
    if (current.dragging && entry && !entry.enemy && view?.editable) {
      const foot = {
        x: point.x + current.grabOffset.x,
        y: point.y + current.grabOffset.y,
      };
      const worldDrop = resolveWorldDrop(foot);
      const target = sale
        ? { kind: "sell" as const }
        : worldDrop?.kind === "cell"
          ? { kind: "cell" as const, row: worldDrop.row, col: worldDrop.col }
          : worldDrop?.kind === "bench"
            ? { kind: "bench" as const }
            : null;
      if (target)
        callbacks.onDrop({ kind: entry.reserve ? "bench" : "board", id: entry.piece.id }, target);
      return;
    }
    if (
      Math.hypot(event.clientX - current.client.x, event.clientY - current.client.y) > 10
    )
      return;
    if (entry) {
      callbacks.onInspect(entry.piece);
      if (view?.editable && !entry.enemy) {
        if (entry.reserve) callbacks.onBench(entry.piece.id);
        else callbacks.onCell(entry.piece.localRow, entry.piece.localCol);
      }
    } else if (view?.editable) {
      const cell = pixelCell(point.x, point.y),
        own = cell && ownCellFromWorld(cell.row, cell.col);
      if (own) callbacks.onCell(own.row, own.col);
      else if (pixelBenchSlot(point.x, point.y) !== null) callbacks.onWithdraw();
    }
  }
  function pointerCancel(event: PointerEvent) {
    touches.delete(event.pointerId);
    pinchDistance = 0;
    cancel();
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", pointerCancel);
  function wheel(event: WheelEvent) {
    event.preventDefault();
    cancel();
    const rect = canvas.getBoundingClientRect();
    zoomAt(zoom * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.0025), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }
  canvas.addEventListener("wheel", wheel, { passive: false });
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  raf = requestAnimationFrame(paint);
  function screenPoint(point: Point) {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + transform.x + point.x * transform.scale,
      y: r.top + transform.y + point.y * transform.scale };
  }
  return {
    setView,
    resetCamera() {
      zoom = 1;
      pan = { x: 0, y: 0 };
      resize();
    },
    rotateCamera() {},
    zoomBy(factor: number) {
      cancel();
      zoomAt(zoom / factor);
    },
    screenPoint,
    screenCell: (row: number, col: number) => screenPoint(pixelPoint(row, col)),
    screenBench: (index: number) => screenPoint(pixelBench(index)),
    dropAtClient(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      )
        return null;
      const worldDrop = resolveWorldDrop(clientToWorld(clientX, clientY));
      if (!worldDrop) return null;
      return worldDrop.kind === "cell"
        ? { kind: "cell" as const, row: worldDrop.row, col: worldDrop.col }
        : { kind: "bench" as const };
    },
    previewClient(point: { x: number; y: number } | null) {
      if (!point) {
        externalPreview = null;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (
        point.x < rect.left ||
        point.x > rect.right ||
        point.y < rect.top ||
        point.y > rect.bottom
      ) {
        externalPreview = null;
        return;
      }
      externalPreview = clientToWorld(point.x, point.y);
    },
    unitAtClient(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      )
        return null;
      const pt = clientToWorld(clientX, clientY);
      const directId = hit(pt);
      if (directId) {
        const directEntry = entries.get(directId);
        if (directEntry && !directEntry.enemy) {
          return {
            id: directEntry.piece.id,
            zone: directEntry.reserve ? ("bench" as const) : ("board" as const),
          };
        }
      }
      const worldDrop = resolveWorldDrop(pt);
      if (worldDrop?.kind === "cell" && view) {
        const piece = view.board.find(
          (p) => p.localRow === worldDrop.row && p.localCol === worldDrop.col,
        );
        if (piece) return { id: piece.id, zone: "board" as const };
      }
      if (worldDrop?.kind === "bench" && view) {
        const slot = pixelBenchSlot(pt.x, pt.y);
        if (slot !== null && view.bench[slot]) {
          return { id: view.bench[slot]!.id, zone: "bench" as const };
        }
      }
      let best: { id: string; zone: "board" | "bench"; dist: number } | null = null;
      for (const item of drawn) {
        const entry = entries.get(item.id);
        if (!entry || entry.enemy) continue;
        const d = Math.hypot(pt.x - item.point.x, pt.y - (item.point.y - 18));
        if (d <= 42 && (!best || d < best.dist)) {
          best = {
            id: entry.piece.id,
            zone: entry.reserve ? "bench" : "board",
            dist: d,
          };
        }
      }
      return best ? { id: best.id, zone: best.zone } : null;
    },
    previewItem(target: ItemPreviewTarget) {
      itemPreview = target;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      cancel();
      observer.disconnect();
      sceneCache = null;
      images.clear();
      canvas.remove();
    },
  };
}
