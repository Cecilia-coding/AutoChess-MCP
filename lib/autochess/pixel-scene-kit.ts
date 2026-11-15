/**
 * Low-resolution pixel painting kit for "living canvas" board skins.
 * Everything is drawn on an art-pixel canvas (1 art px = ART world units) and
 * blitted with nearest-neighbour scaling, so scenery shares the chunky pixel
 * grain of the character sprites while allowing large-scale central compositions.
 */
import { BENCH_CAPACITY, BOARD_COLS, BOARD_ROWS, HALF_ROWS } from './constants';
import type { PixelBoard } from './pixel-board';

export const ART = 3;

type Ctx = CanvasRenderingContext2D;
export type Pal = Record<string, string>;
export type Rng = () => number;

type CanvasLike = HTMLCanvasElement;
let canvasFactory: (w: number, h: number) => CanvasLike = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
/** Allows tests / offline renderers to supply their own canvas. */
export function setSceneCanvasFactory(factory: (w: number, h: number) => CanvasLike) {
  canvasFactory = factory;
}
export function makeLayer(w: number, h: number): CanvasLike {
  return canvasFactory(Math.max(1, w), Math.max(1, h));
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;

const rgbCache = new Map<string, [number, number, number]>();
export function rgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    v = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    rgbCache.set(hex, v);
  }
  return v;
}
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const A = rgb(a), B = rgb(b);
  const c = (i: number) => Math.round(A[i]! + (B[i]! - A[i]!) * k).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}
export function rgba(hex: string, a: number) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

export type Lay = {
  W: number; H: number;
  gl: number; gt: number; gr: number; gb: number; gw: number; gh: number;
  cw: number; rh: number; mid: number;
  by: number; bl: number; bs: number; benchL: number; benchR: number;
  cx: number; cy: number;
  /** horizontal margin left/right of the grid (art px) */
  mL: number; mR: number;
};

export function layout(board: PixelBoard): Lay {
  const gl = board.left / ART, gt = board.top / ART;
  const cw = board.cellWidth / ART, rh = board.rowHeight / ART;
  const gw = cw * BOARD_COLS, gh = rh * BOARD_ROWS;
  const W = Math.ceil(board.width / ART), H = Math.ceil(board.height / ART);
  const bl = board.benchLeft / ART, bs = board.benchSpacing / ART;
  return {
    W, H, gl, gt, gw, gh, gr: gl + gw, gb: gt + gh, cw, rh,
    mid: gt + HALF_ROWS * rh,
    by: board.benchY / ART, bl, bs,
    benchL: bl - bs / 2, benchR: bl + bs * (BENCH_CAPACITY - 0.5),
    cx: gl + gw / 2, cy: gt + gh / 2,
    mL: gl, mR: W - (gl + gw),
  };
}

export const inGrid = (L: Lay, x: number, y: number, pad = 0) =>
  x >= L.gl - pad && x <= L.gr + pad && y >= L.gt - pad && y <= L.gb + pad;
export const inBench = (L: Lay, x: number, y: number, pad = 0) =>
  x >= L.benchL - pad && x <= L.benchR + pad && y >= L.by - 12 - pad && y <= L.by + 10 + pad;

export class Art {
  constructor(public readonly c: Ctx, public readonly W: number, public readonly H: number) {}
  fill(col: string) { this.c.fillStyle = col; }
  p(x: number, y: number, col?: string) {
    if (col) this.c.fillStyle = col;
    this.c.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  r(x: number, y: number, w: number, h: number, col?: string) {
    if (col) this.c.fillStyle = col;
    this.c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  /** Filled ellipse snapped to whole art pixels. */
  disc(cx: number, cy: number, rx: number, ry: number, col?: string, skip?: (dx: number, dy: number) => boolean) {
    if (col) this.c.fillStyle = col;
    if (rx <= 0 || ry <= 0) return;
    const X = Math.round(cx), Y = Math.round(cy);
    const R = Math.floor(ry + 0.5);
    for (let dy = -R; dy <= R; dy++) {
      const t = dy / (ry + 0.5);
      const hw = Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, 1 - t * t)));
      if (!skip) {
        if (hw >= 0) this.c.fillRect(X - hw, Y + dy, hw * 2 + 1, 1);
      } else {
        for (let dx = -hw; dx <= hw; dx++) if (!skip(dx, dy)) this.c.fillRect(X + dx, Y + dy, 1, 1);
      }
    }
  }
  ring(cx: number, cy: number, rx: number, ry: number, col?: string, dash = 0, phase = 0) {
    if (col) this.c.fillStyle = col;
    if (rx <= 0 || ry <= 0) return;
    const n = Math.max(16, Math.ceil(Math.max(rx, ry) * 8));
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (dash && Math.floor((i / n) * dash * 2 + phase) % 2) continue;
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      const k = (x + 512) * 4096 + (y + 512);
      if (seen.has(k)) continue;
      seen.add(k);
      this.c.fillRect(x, y, 1, 1);
    }
  }
  /** Partial elliptical arc from angle a0 to a1 with optional pixel thickness. */
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, col?: string, thick = 1) {
    if (col) this.c.fillStyle = col;
    const span = Math.abs(a1 - a0);
    const n = Math.max(12, Math.ceil(Math.max(rx, ry) * span * 1.6));
    const seen = new Set<number>();
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const px = cx + Math.cos(a) * rx;
      const py = cy + Math.sin(a) * ry;
      if (thick <= 1) {
        const x = Math.round(px), y = Math.round(py);
        const k = (x + 512) * 4096 + (y + 512);
        if (!seen.has(k)) { seen.add(k); this.c.fillRect(x, y, 1, 1); }
      } else {
        this.disc(px, py, (thick - 0.4) * 0.55, (thick - 0.4) * 0.55);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, col?: string) {
    if (col) this.c.fillStyle = col;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4000; guard++) {
      this.c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Round-brushed pixel segment with variable start/end radius. */
  stroke(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, col?: string) {
    if (col) this.c.fillStyle = col;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist * 1.6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const rr = r0 + (r1 - r0) * t;
      if (rr <= 0.6) this.p(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      else this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rr, rr);
    }
  }
  /** Smooth quadratic Bezier brush stroke for organic vines, boughs, and ribbons. */
  quad(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, r0: number, r1: number, col?: string) {
    if (col) this.c.fillStyle = col;
    const approx = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
    const steps = Math.max(8, Math.ceil(approx * 1.5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const rr = r0 + (r1 - r0) * t;
      if (rr <= 0.65) this.p(x, y);
      else this.disc(x, y, rr, rr);
    }
  }
  /** Oriented, shaded botanical leaf or flower petal anchored at its base (bx, by). */
  petal(
    bx: number,
    by: number,
    ang: number,
    len: number,
    wid: number,
    edgeCol: string,
    bodyCol: string,
    lightCol?: string,
    pointed = 0.5,
  ) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const step = 0.42;
    for (let s = 0; s <= len; s += step) {
      const u = s / Math.max(0.01, len);
      const profile = Math.sin(Math.pow(u, pointed) * Math.PI);
      const hw = profile * wid;
      for (let k = -hw; k <= hw; k += step) {
        const px = bx + cs * s - sn * k;
        const py = by + sn * s + cs * k;
        const edge = Math.abs(k) > hw - 0.75 || u > 0.9 || u < 0.08;
        const lit = lightCol && !edge && (k < -hw * 0.15 || (Math.abs(k) < 0.55 && u > 0.18 && u < 0.78));
        this.p(px, py, edge ? edgeCol : lit ? lightCol : bodyCol);
      }
    }
  }
  /** Sprite from character rows, top-left anchored. '.' and unknown chars are transparent. */
  spr(rows: readonly string[], pal: Pal, x: number, y: number, flip = false) {
    const X = Math.round(x), Y = Math.round(y);
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]!;
      const n = row.length;
      for (let i = 0; i < n; i++) {
        const ch = row[flip ? n - 1 - i : i]!;
        const col = pal[ch];
        if (!col) continue;
        this.c.fillStyle = col;
        this.c.fillRect(X + i, Y + j, 1, 1);
      }
    }
  }
  /** Sprite anchored at bottom-centre. */
  sprB(rows: readonly string[], pal: Pal, cx: number, by: number, flip = false) {
    const w = rows[0]?.length ?? 0;
    this.spr(rows, pal, Math.round(cx) - Math.floor(w / 2), Math.round(by) - rows.length + 1, flip);
  }
  sprC(rows: readonly string[], pal: Pal, cx: number, cy: number, flip = false) {
    const w = rows[0]?.length ?? 0;
    this.spr(rows, pal, Math.round(cx) - Math.floor(w / 2), Math.round(cy) - Math.floor(rows.length / 2), flip);
  }
  alpha<T>(a: number, fn: () => T): T {
    const prev = this.c.globalAlpha;
    this.c.globalAlpha = prev * a;
    try { return fn(); } finally { this.c.globalAlpha = prev; }
  }
  /** Per-pixel field fill via ImageData: fn returns a hex colour or null (keep). */
  field(fn: (x: number, y: number) => string | null) {
    const img = this.c.getImageData(0, 0, this.W, this.H);
    const d = img.data;
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const col = fn(x, y);
        if (!col) continue;
        const [r, g, b] = rgb(col);
        const k = (y * this.W + x) * 4;
        d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
      }
    }
    this.c.putImageData(img, 0, 0);
  }
}

/** Ordered-dither between bands: v is a continuous band index. Hard bands with a dithered seam. */
export function band(v: number, x: number, y: number, n: number, seam = 0.34): number {
  const f = Math.floor(v);
  const frac = v - f;
  const k = Math.max(0, Math.min(1, (frac - (0.5 - seam / 2)) / seam));
  const idx = f + (bayer(x, y) < k ? 1 : 0);
  return Math.max(0, Math.min(n - 1, idx));
}

/** Blue-noise-ish scatter: rejection sampling with a minimum distance. */
export function scatter(
  r: Rng,
  tries: number,
  minD: number,
  region: { x: number; y: number; w: number; h: number },
  accept: (x: number, y: number) => boolean,
  existing: { x: number; y: number }[] = [],
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const all = [...existing];
  for (let i = 0; i < tries; i++) {
    const x = region.x + r() * region.w, y = region.y + r() * region.h;
    if (!accept(x, y)) continue;
    let ok = true;
    for (const q of all) {
      if ((q.x - x) ** 2 + (q.y - y) ** 2 < minD * minD) { ok = false; break; }
    }
    if (!ok) continue;
    const pt = { x: Math.round(x), y: Math.round(y) };
    out.push(pt);
    all.push(pt);
  }
  return out;
}

/** Smooth value noise in [0,1]. */
export function vnoise(x: number, y: number, scale: number, seed = 0): number {
  const fx = x / scale, fy = y / scale;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Voronoi flagstone cell query: returns `{ edge, shade }` where `edge` near 0
 * lies along organic mortar cracks between irregular hand-cut stone slabs.
 */
export function flagstone(x: number, y: number, scale: number, seed = 0): { edge: number; shade: number } {
  const fx = x / scale, fy = y / scale;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  let d1 = 99, d2 = 99, cellShade = 0.5;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const px = cx + 0.16 + hash2(cx, cy, seed) * 0.68;
      const py = cy + 0.16 + hash2(cx, cy, seed + 17) * 0.68;
      const d = Math.hypot(fx - px, fy - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cellShade = hash2(cx, cy, seed + 53);
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return { edge: (d2 - d1) * scale, shade: cellShade };
}

/** Pack circles of varying radius; `radius` decides size, `accept` filters positions. */
export function packCircles(
  r: Rng,
  tries: number,
  region: { x: number; y: number; w: number; h: number },
  radius: (x: number, y: number) => number,
  accept: (x: number, y: number, R: number) => boolean,
  existing: { x: number; y: number; R: number }[] = [],
  gap = 1,
): { x: number; y: number; R: number }[] {
  const out: { x: number; y: number; R: number }[] = [];
  const all = [...existing];
  for (let i = 0; i < tries; i++) {
    const x = region.x + r() * region.w, y = region.y + r() * region.h;
    const R = radius(x, y);
    if (R <= 0 || !accept(x, y, R)) continue;
    let ok = true;
    for (const q of all) {
      const dx = q.x - x, dy = (q.y - y) * 1.5;
      if (dx * dx + dy * dy < (q.R + R + gap) ** 2 * 0.72) { ok = false; break; }
    }
    if (!ok) continue;
    const c = { x: Math.round(x), y: Math.round(y), R };
    out.push(c);
    all.push(c);
  }
  return out;
}

/** Distance (art px) from a point to the grid rectangle; 0 inside. */
export function gridDist(L: Lay, x: number, y: number) {
  const dx = Math.max(L.gl - x, 0, x - L.gr);
  const dy = Math.max(L.gt - y, 0, y - L.gb);
  return Math.hypot(dx, dy);
}

/** Faint skeleton: tiny ticks at each cell intersection plus a whisper-soft halfway seam. */
export function skeleton(a: Art, L: Lay, col: string, alpha: number, midCol?: string) {
  a.alpha(alpha, () => {
    a.fill(col);
    for (let j = 0; j <= BOARD_ROWS; j++) {
      for (let i = 0; i <= BOARD_COLS; i++) {
        const x = Math.round(L.gl + i * L.cw), y = Math.round(L.gt + j * L.rh);
        const edge = i === 0 || i === BOARD_COLS || j === 0 || j === BOARD_ROWS;
        a.r(x, y, 1, 1);
        if (!edge) { a.r(x - 1, y, 3, 1); a.r(x, y - 1, 1, 3); }
      }
    }
  });
  if (midCol) {
    a.alpha(alpha * 0.85, () => {
      a.fill(midCol);
      const y = Math.round(L.mid);
      for (let x = Math.round(L.gl) + 4; x < L.gr - 3; x += 5) a.r(x, y, 2, 1);
    });
  }
}

export { BENCH_CAPACITY, BOARD_COLS, BOARD_ROWS, HALF_ROWS };
