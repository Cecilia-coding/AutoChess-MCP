import { BENCH_CAPACITY, BOARD_COLS, BOARD_ROWS } from "./constants";

// Orthogonal front-on pixel grid leaves vertical room for front-facing pixel characters.
export const PIXEL_BOARD = {
  width: 640,
  height: 720,
  top: 100,
  rowHeight: 57,
  cellWidth: 104,
  left: 60,
  skew: 0,
  benchY: 645,
  benchLeft: 48,
  benchSpacing: 68,
};
export type PixelBoard = typeof PIXEL_BOARD;

/** Reflow cells into the viewport; sprites keep a single, uniform camera scale. */
export function fitPixelBoard(width: number, height: number) {
  const padding = 8;
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const scale = innerHeight / PIXEL_BOARD.height;
  const worldWidth = innerWidth / scale;
  const minSide = Math.min(48, worldWidth * 0.08);
  const skew = 0;
  const maxGridWidth = worldWidth - minSide * 2;
  const cellWidth = Math.min(114, maxGridWidth / BOARD_COLS);
  const gridSpan = cellWidth * BOARD_COLS;
  const benchTarget = Math.max(72, (gridSpan + 18) / BENCH_CAPACITY);
  const benchSpacing = Math.min(benchTarget, (worldWidth - minSide) / BENCH_CAPACITY);
  const board: PixelBoard = {
    width: worldWidth,
    height: PIXEL_BOARD.height,
    top: 74,
    rowHeight: 63,
    cellWidth,
    left: (worldWidth - cellWidth * BOARD_COLS) / 2,
    skew,
    benchY: 654,
    benchLeft: (worldWidth - benchSpacing * BENCH_CAPACITY) / 2 + benchSpacing / 2,
    benchSpacing,
  };
  return { board, scale, x: padding, y: padding };
}

export function pixelPoint(row: number, col: number, b: PixelBoard = PIXEL_BOARD) {
  return {
    x: b.left + (col + 0.5) * b.cellWidth + (row - BOARD_ROWS / 2) * b.skew,
    y: b.top + (row + 0.5) * b.rowHeight,
  };
}
export function pixelCell(x: number, y: number, b: PixelBoard = PIXEL_BOARD) {
  const row = Math.floor((y - b.top) / b.rowHeight);
  const col = Math.floor((x - b.left - (row - BOARD_ROWS / 2) * b.skew) / b.cellWidth);
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS ? { row, col } : null;
}
export function pixelBench(index: number, b: PixelBoard = PIXEL_BOARD) {
  return { x: b.benchLeft + index * b.benchSpacing, y: b.benchY };
}
export function pixelBenchSlot(x: number, y: number, b: PixelBoard = PIXEL_BOARD) {
  const index = Math.round((x - b.benchLeft) / b.benchSpacing);
  return Math.abs(y - b.benchY) < 35 && index >= 0 && index < BENCH_CAPACITY
    ? index
    : null;
}
