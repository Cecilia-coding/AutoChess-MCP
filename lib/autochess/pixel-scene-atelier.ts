/**
 * Atelier living-canvas skins (same method as 荷塘清夏): the 5×8 grid is an invisible
 * skeleton, one big central painting owns the arena, and themed props spill across the
 * edges so the board boundary is never the picture boundary.
 *
 *  - 绣线花绷 embroidery-hoop  : a giant wooden hoop on blush gingham, satin-stitch peony
 *                                 wreath still being sewn (animated needle), spools, pins,
 *                                 gold scissors, tape measure, 9 button seats.
 *  - 晚霞云海 sunset-cloudsea  : enemy half is the dusk sky, own half is a sea of clouds,
 *                                 the sun sets exactly on the midline; cloud towers break the
 *                                 edges; balloons, birds and a little cloud whale drift by.
 *  - 星夜木马 carousel-night   : a night-fair carousel platform with a mirrored centre drum,
 *                                 8 prancing horses orbiting, ferris wheel, striped tent,
 *                                 cotton-candy cart, string lights, fireworks, 9 teacup seats.
 */
import {
  Art,
  BENCH_CAPACITY,
  band,
  bayer,
  flagstone,
  hash2,
  mix,
  skeleton,
  vnoise,
  type Lay,
  type Pal,
  type Rng,
} from './pixel-scene-kit';

type Plan = Record<string, any>;
export type AtelierScene = {
  plan(L: Lay, r: Rng): Plan;
  paint(a: Art, L: Lay, P: Plan, r: Rng): void;
  anim(a: Art, L: Lay, P: Plan, t: number): void;
};

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrap = (v: number, m: number) => ((v % m) + m) % m;
const slots = (L: Lay) => Array.from({ length: BENCH_CAPACITY }, (_, i) => ({ x: L.bl + i * L.bs, y: L.by }));
/** Scale for big central compositions (desktop grid = 190 art px wide). */
const kOf = (L: Lay) => clamp(L.gw / 190, 0.55, 1.15);

/** Disc whose outer rim dissolves with an ordered dither (soft pixel glow edges). */
function ditherDisc(a: Art, cx: number, cy: number, rx: number, ry: number, col: string, soft = 0.25) {
  a.disc(cx, cy, rx, ry, col, (dx, dy) => {
    const rr = Math.hypot(dx / (rx + 0.5), dy / (ry + 0.5));
    if (rr < 1 - soft) return false;
    return bayer(dx + 64, dy + 64) < (rr - (1 - soft)) / soft;
  });
}

type Thread = { d: string; b: string; l: string; h: string };

/* ═══════════════════════════ 1. 绣线花绷 · EMBROIDERY HOOP ═══════════════════════════ */

export const EMB: Pal = {
  gin0: '#f6e8e1', gin1: '#f0d8d1', gin2: '#e6c4c0', shadow: '#d2b0a6',
  lin0: '#fbf5ea', lin1: '#f2e9d9', lin2: '#e9dcc7', linShade: '#dccbb2',
  woodD: '#7a4c33', wood: '#a46e49', woodM: '#c08a5c', woodL: '#dcaa78', woodHi: '#f3d2a2',
  brassD: '#8d6823', brass: '#c99c3f', brassL: '#f4da8c',
  rose: '#dc6782', roseD: '#a6405c', roseL: '#f49fb2', roseHi: '#fdd5de',
  sage: '#7fa676', sageD: '#557c52', sageL: '#b2d2a4',
  butter: '#f0c65b', butterD: '#c2922e', butterL: '#fbe6a6',
  lilac: '#a98cd2', lilacD: '#7a5fa9', lilacL: '#d6c6f0',
  sky: '#8cb7da', skyD: '#5e8bb4', skyL: '#bcd8ee',
  peach: '#f2a283', peachD: '#c4705a', peachL: '#fcd2bd',
  steel: '#c6cad6', steelD: '#858aa0', steelL: '#f4f6fa',
  lace: '#fffdf8', laceD: '#e7dacb',
  ink: '#5a3d36',
};

const T_ROSE: Thread = { d: EMB.roseD!, b: EMB.rose!, l: EMB.roseL!, h: EMB.roseHi! };
const T_SAGE: Thread = { d: EMB.sageD!, b: EMB.sage!, l: EMB.sageL!, h: '#ddecd3' };
const T_BUTTER: Thread = { d: EMB.butterD!, b: EMB.butter!, l: EMB.butterL!, h: '#fff7da' };
const T_LILAC: Thread = { d: EMB.lilacD!, b: EMB.lilac!, l: EMB.lilacL!, h: '#f1e9fc' };
const T_SKY: Thread = { d: EMB.skyD!, b: EMB.sky!, l: EMB.skyL!, h: '#ebf5fc' };
const T_PEACH: Thread = { d: EMB.peachD!, b: EMB.peach!, l: EMB.peachL!, h: '#fff1e8' };
const T_CREAM: Thread = { d: '#c9b28f', b: '#f7ecd6', l: '#fffaf0', h: '#ffffff' };

function satinPetal(a: Art, bx: number, by: number, ang: number, len: number, wid: number, T: Thread) {
  a.petal(bx, by, ang, len, wid, T.d, T.b, T.l, 0.62);
  if (len < 4) return;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  a.alpha(0.6, () => {
    for (const k of [-wid * 0.38, wid * 0.18]) {
      a.line(
        bx + cs * len * 0.25 - sn * k * 0.5, by + sn * len * 0.25 + cs * k * 0.5,
        bx + cs * len * 0.76 - sn * k, by + sn * len * 0.76 + cs * k,
        T.h,
      );
    }
  });
}

function satinLeaf(a: Art, bx: number, by: number, ang: number, len: number, wid: number, T: Thread = T_SAGE) {
  a.petal(bx, by, ang, len, wid, T.d, T.b, T.l, 0.55);
  a.line(bx, by, bx + Math.cos(ang) * len * 0.78, by + Math.sin(ang) * len * 0.78, T.d);
}

function knot(a: Art, x: number, y: number, T: Thread) {
  a.r(x, y, 2, 2, T.b);
  a.p(x, y, T.h);
  a.p(x + 1, y + 1, T.d);
}

function stitchFlower(a: Art, cx: number, cy: number, R: number, T: Thread, centre: Thread, n = 5, rot = 0) {
  for (let i = 0; i < n; i++) satinPetal(a, cx, cy, rot + (i * TAU) / n, R, R * 0.44, T);
  a.disc(cx, cy, Math.max(1, R * 0.3) + 0.6, Math.max(1, R * 0.3) + 0.6, centre.d);
  a.disc(cx, cy, Math.max(1, R * 0.3), Math.max(1, R * 0.3), centre.b);
  a.p(cx - 1, cy - 1, centre.h);
}

/** Lazy-daisy loop stitches: hollow petals showing the linen through the loop. */
function lazyDaisy(a: Art, cx: number, cy: number, R: number, T: Thread, centre: Thread, n = 6, rot = 0) {
  for (let i = 0; i < n; i++) {
    const ang = rot + (i * TAU) / n;
    const bx = cx + Math.cos(ang) * 1.3, by = cy + Math.sin(ang) * 1.3;
    a.petal(bx, by, ang, R, R * 0.34, T.b, EMB.lin0!, undefined, 0.6);
    a.p(bx + Math.cos(ang) * R * 0.95, by + Math.sin(ang) * R * 0.95, T.d);
  }
  knot(a, cx - 1, cy - 1, centre);
}

function satinPeony(a: Art, cx: number, cy: number, R: number, rot: number) {
  const outer: Thread = { d: EMB.roseD!, b: EMB.rose!, l: EMB.roseL!, h: EMB.roseHi! };
  const mid: Thread = { d: EMB.rose!, b: EMB.roseL!, l: EMB.roseHi!, h: '#fff3f6' };
  const inner: Thread = { d: EMB.roseL!, b: EMB.roseHi!, l: '#fff4f7', h: '#ffffff' };
  for (let i = 0; i < 9; i++) satinPetal(a, cx, cy, rot + (i * TAU) / 9, R, R * 0.46, outer);
  for (let i = 0; i < 7; i++) satinPetal(a, cx, cy, rot + 0.35 + (i * TAU) / 7, R * 0.68, R * 0.4, mid);
  for (let i = 0; i < 5; i++) satinPetal(a, cx, cy, rot + 0.9 + (i * TAU) / 5, R * 0.42, R * 0.33, inner);
  for (const [dx, dy] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1], [0, -2], [2, 0], [-2, 0]] as const) {
    knot(a, cx + dx - 0.5, cy + dy - 0.5, T_BUTTER);
  }
}

function paintSpool(a: Art, cx: number, by: number, h: number, w: number, T: Thread) {
  const fl = Math.max(2, Math.round(h * 0.13));
  const fw = w / 2 + 1.6;
  a.alpha(0.4, () => a.disc(cx + 2, by + 1, fw + 2, 2.6, EMB.shadow!));
  a.disc(cx, by - 1, fw, 2.2, EMB.woodD!);
  a.r(cx - fw, by - fl - 1, fw * 2 + 1, fl, EMB.wood!);
  a.disc(cx, by - fl - 1, fw, 2.2, EMB.woodM!);
  const top = Math.round(by - h + fl + 1), bot = Math.round(by - fl - 1);
  const x0 = Math.round(cx - w / 2), x1 = Math.round(cx + w / 2);
  for (let y = top; y <= bot; y++) {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      const shade = u < 0.24 ? T.l : u > 0.76 ? T.d : T.b;
      const wind = (y * 2 + Math.floor(x * 0.5)) % 4 === 0;
      a.p(x, y, wind ? mix(shade, T.d, 0.35) : shade);
    }
  }
  a.r(x0 + 1, top, 1, bot - top, T.h);
  a.r(cx - fw, by - h, fw * 2 + 1, fl, EMB.wood!);
  a.disc(cx, by - h, fw, 2.2, EMB.woodL!);
  a.disc(cx, by - h, 1.6, 1, EMB.woodD!);
}

function paintPincushion(a: Art, cx: number, cy: number, R: number) {
  const red = '#e0546f', redD = '#9c3048', redL = '#f47c94';
  a.alpha(0.38, () => a.disc(cx + 3, cy + R * 0.9, R * 1.05, R * 0.36, EMB.shadow!));
  a.disc(cx, cy, R + 1, R * 0.92 + 1, redD);
  a.disc(cx, cy + R * 0.38, R * 0.7 + 1, R * 0.76 + 1, redD);
  a.disc(cx, cy, R, R * 0.92, red);
  a.disc(cx, cy + R * 0.38, R * 0.7, R * 0.76, red);
  a.disc(cx - R * 0.3, cy - R * 0.22, R * 0.5, R * 0.42, redL);
  a.disc(cx - R * 0.42, cy - R * 0.38, R * 0.17, R * 0.13, '#ffc6d2');
  for (let i = 0; i < 22; i++) {
    const ang = hash2(i, 1, 41) * TAU, rr = Math.sqrt(hash2(i, 2, 41)) * R * 0.82;
    const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.9 + R * 0.12;
    a.p(x, y, '#ffe28c');
    a.p(x, y + 1, redD);
  }
  for (let i = 0; i < 5; i++) satinLeaf(a, cx, cy - R * 0.78, -Math.PI / 2 + (i - 2) * 0.72, R * 0.58, R * 0.24);
  const heads = [EMB.sky!, EMB.butter!, EMB.lilac!, '#ffffff', EMB.sage!];
  const pins = [[-0.62, -0.3, -2.5], [0.5, -0.52, -0.95], [0.78, 0.12, -0.25], [-0.72, 0.36, 2.75], [0.12, -0.7, -1.7]] as const;
  for (const [i, [ox, oy, ang]] of pins.entries()) {
    const sx = cx + ox * R * 0.8, sy = cy + oy * R * 0.8;
    const ex = sx + Math.cos(ang) * R * 0.7, ey = sy + Math.sin(ang) * R * 0.7;
    a.line(sx, sy, ex, ey, EMB.steelD!);
    a.disc(ex, ey, 1.6, 1.6, heads[i]!);
    a.p(ex - 0.6, ey - 0.6, '#ffffff');
  }
}

function paintScissors(a: Art, cx: number, ty: number, len: number) {
  const D = EMB.brassD!, B = EMB.brass!, Lt = EMB.brassL!;
  a.alpha(0.35, () => {
    a.stroke(cx + 3, ty + 15, cx + 5, ty + len + 2, 2.2, 0.8, EMB.shadow!);
    a.disc(cx + 3, ty + 7, 9, 4.5, EMB.shadow!);
  });
  for (const s of [-1, 1] as const) {
    const hx = cx + s * 4.6, hy = ty + 5;
    a.arc(hx, hy, 4.2, 3.6, 0, TAU, D, 2.6);
    a.arc(hx, hy, 4.2, 3.6, 0, TAU, B, 1.4);
    a.arc(hx, hy, 4.2, 3.6, Math.PI * 1.0, Math.PI * 1.55, Lt, 1);
    a.stroke(hx - s * 2.2, hy + 3.2, cx - s * 0.4, ty + 13, 1.5, 1.1, D);
    a.stroke(hx - s * 2.2, hy + 3.2, cx - s * 0.4, ty + 13, 0.9, 0.6, B);
  }
  // little stork-like curl on the bow
  a.arc(cx, ty + 9, 2, 1.6, Math.PI * 0.1, Math.PI * 0.9, Lt);
  for (const s of [-1, 1] as const) {
    a.stroke(cx - s * 0.6, ty + 13, cx + s * 1.4, ty + len, 1.9, 0.5, D);
    a.stroke(cx - s * 0.6, ty + 13, cx + s * 1.4, ty + len, 1.1, 0.2, s < 0 ? B : mix(B, Lt, 0.5));
  }
  a.line(cx - 0.4, ty + 15, cx + 0.8, ty + len - 4, Lt);
  a.disc(cx, ty + 13, 1.7, 1.7, D);
  a.p(cx, ty + 13, Lt);
}

function paintThimble(a: Art, cx: number, by: number) {
  a.alpha(0.38, () => a.disc(cx + 2, by + 1, 7, 2.4, EMB.shadow!));
  a.r(cx - 5, by - 9, 11, 9, EMB.steelD!);
  a.disc(cx, by - 9, 5, 3.4, EMB.steelD!);
  a.r(cx - 4, by - 9, 9, 8, EMB.steel!);
  a.disc(cx, by - 9, 4, 2.6, EMB.steel!);
  a.r(cx - 3, by - 10, 2, 8, EMB.steelL!);
  for (let y = by - 11; y < by - 3; y += 2) for (let x = cx - 3 + ((y >> 1) & 1); x <= cx + 3; x += 2) a.p(x, y, EMB.steelD!);
  a.r(cx - 5, by - 2, 11, 2, EMB.brass!);
  a.r(cx - 5, by - 2, 11, 1, EMB.brassL!);
}

function paintYarnBall(a: Art, cx: number, cy: number, R: number, T: Thread) {
  a.alpha(0.38, () => a.disc(cx + 3, cy + R * 0.85, R * 1.05, R * 0.33, EMB.shadow!));
  // knitting needles
  a.stroke(cx - R * 1.5, cy - R * 1.2, cx + R * 1.1, cy + R * 0.5, 1.1, 1.1, EMB.butterD!);
  a.stroke(cx - R * 1.5, cy - R * 1.2, cx + R * 1.1, cy + R * 0.5, 0.5, 0.5, EMB.butterL!);
  a.disc(cx - R * 1.5, cy - R * 1.2, 2, 2, EMB.rose!);
  a.disc(cx, cy, R + 1, R + 1, T.d);
  a.disc(cx, cy, R, R, T.b);
  for (let i = 0; i < 7; i++) {
    const ang = -0.6 + i * 0.27;
    a.arc(cx + Math.cos(ang) * R * 0.3, cy + Math.sin(ang) * R * 0.3, R * 0.95, R * 0.42, ang + 0.4, ang + 2.4, i % 2 ? T.l : T.d);
  }
  for (let i = 0; i < 4; i++) a.arc(cx, cy, R * (0.4 + i * 0.15), R * 0.9, -1.9, -0.6, T.l);
  a.disc(cx - R * 0.42, cy - R * 0.45, R * 0.22, R * 0.16, T.h);
  a.stroke(cx - R * 1.6 + 1, cy - R * 1.2 + 1, cx + R * 0.6, cy - R * 0.2, 0.5, 0.5, EMB.butter!);
}

function paintDoily(a: Art, x: number, y: number, R: number) {
  a.alpha(0.3, () => a.disc(x + 2, y + 2, R + 2, R + 2, EMB.shadow!));
  const n = Math.max(12, Math.round(R * 0.9));
  for (let i = 0; i < n; i++) {
    const ang = (i * TAU) / n;
    a.disc(x + Math.cos(ang) * R, y + Math.sin(ang) * R, R * 0.17, R * 0.17, EMB.lace!);
  }
  a.disc(x, y, R, R, EMB.lace!);
  for (let i = 0; i < n; i++) {
    const ang = ((i + 0.5) * TAU) / n;
    a.disc(x + Math.cos(ang) * R * 0.86, y + Math.sin(ang) * R * 0.86, 1.2, 1.2, EMB.laceD!);
  }
  a.ring(x, y, R * 0.7, R * 0.7, EMB.laceD!, 26);
  for (let i = 0; i < 8; i++) a.petal(x, y, (i * TAU) / 8 + 0.2, R * 0.6, R * 0.17, EMB.laceD!, EMB.lace!, undefined, 0.6);
  a.disc(x, y, R * 0.15, R * 0.15, EMB.laceD!);
}

function paintTape(a: Art, chain: readonly (readonly [number, number])[], width: number) {
  // chain: p0, c0, p1, c1, p2 … (quadratic segments)
  let idx = 0;
  for (let s = 0; s + 2 < chain.length; s += 2) {
    const [x0, y0] = chain[s]!, [cx, cy] = chain[s + 1]!, [x1, y1] = chain[s + 2]!;
    const approx = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
    const steps = Math.ceil(approx * 1.8);
    for (let i = 0; i <= steps; i++, idx++) {
      const t = i / steps, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
      const m = Math.hypot(tx, ty) || 1;
      const nx = -ty / m, ny = tx / m;
      for (let w = -width / 2; w <= width / 2; w += 0.5) {
        const edge = Math.abs(w) > width / 2 - 0.7;
        const tickLen = idx % 18 === 0 ? width * 0.75 : idx % 6 === 0 ? 2.2 : 0;
        const tick = tickLen > 0 && w > width / 2 - tickLen - 0.3 && !edge;
        a.p(x + nx * w, y + ny * w, edge ? EMB.butterD! : tick ? EMB.ink! : w < -width * 0.15 ? EMB.butterL! : EMB.butter!);
      }
    }
  }
  const [ex, ey] = chain[chain.length - 1]!;
  a.r(ex - 3, ey - 3, 6, 6, EMB.steelD!);
  a.r(ex - 2, ey - 2, 4, 4, EMB.steel!);
}

function paintButton(a: Art, cx: number, cy: number, R: number, T: Thread, thread: Thread, shadow = true) {
  const ry = R * 0.86;
  if (shadow) a.alpha(0.42, () => a.disc(cx + 1.5, cy + 2, R + 0.5, ry + 0.5, EMB.shadow!));
  a.disc(cx, cy, R, ry, T.d);
  a.disc(cx, cy, R - 1, ry - 1, T.b);
  a.disc(cx + 0.4, cy + 0.4, R * 0.66, ry * 0.66, mix(T.b, T.d, 0.22));
  a.arc(cx, cy, R - 1.2, ry - 1.2, Math.PI * 1.02, Math.PI * 1.48, T.h);
  a.arc(cx, cy, R - 1.2, ry - 1.2, Math.PI * 0.1, Math.PI * 0.42, T.d);
  const o = Math.max(1.4, R * 0.27), oy = o * 0.86;
  a.line(cx - o, cy - oy, cx + o, cy + oy, thread.b);
  a.line(cx + o, cy - oy, cx - o, cy + oy, thread.b);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const hx = cx + sx * o, hy = cy + sy * oy;
    if (R >= 7) {
      a.r(hx - 0.5, hy - 0.5, 2, 2, T.d);
      a.p(hx + 0.5, hy + 0.5, thread.d);
    } else a.p(hx, hy, T.d);
  }
}

function paintStitchButterfly(a: Art, x: number, y: number, open: boolean, faceLeft: boolean) {
  const w = open ? 1 : 0.42;
  const f = faceLeft ? -1 : 1;
  a.petal(x, y, -Math.PI / 2 - 0.85 * f, 6, 3.3 * w, EMB.lilacD!, EMB.lilac!, EMB.lilacL!, 0.6);
  a.petal(x, y, -Math.PI / 2 + 0.85 * f, 6, 3.3 * w, EMB.lilacD!, EMB.lilac!, EMB.lilacL!, 0.6);
  a.petal(x, y + 1, Math.PI / 2 + 0.7, 4.2, 2.4 * w, EMB.roseD!, EMB.rose!, EMB.roseL!, 0.6);
  a.petal(x, y + 1, Math.PI / 2 - 0.7, 4.2, 2.4 * w, EMB.roseD!, EMB.rose!, EMB.roseL!, 0.6);
  a.r(x, y - 2, 1, 5, EMB.ink!);
  a.p(x - 1, y - 4, EMB.ink!);
  a.p(x + 1, y - 4, EMB.ink!);
}

/** Flower ornaments placed along the wreath (shared by static paint and the live-sewing animation). */
function wreathPoint(H: Plan, t: number) {
  const wv = Math.sin(t * 14) * 1.6;
  const x = H.x + Math.cos(t) * (H.wrx + wv), y = H.y + Math.sin(t) * (H.wry + wv);
  const tan = Math.atan2(Math.cos(t) * H.wry, -Math.sin(t) * H.wrx);
  return { x, y, tan };
}

function wreathOrnament(a: Art, H: Plan, t: number, idx: number, k: number) {
  const { x, y, tan } = wreathPoint(H, t);
  const side = idx % 2 === 0 ? 1 : -1;
  satinLeaf(a, x, y, tan + side * 0.95, 7.2 * k, 2.5 * k);
  if (idx % 4 === 1) satinLeaf(a, x, y, tan - side * 1.25, 5.2 * k, 2 * k, { ...T_SAGE, b: EMB.sageL!, l: '#d6ead0' });
  const ox = x + Math.cos(tan - side * Math.PI / 2) * 4.5 * k;
  const oy = y + Math.sin(tan - side * Math.PI / 2) * 4.5 * k;
  switch (idx % 6) {
    case 1: stitchFlower(a, ox, oy, 5.6 * k, T_ROSE, T_BUTTER, 5, t); break;
    case 3: lazyDaisy(a, ox, oy, 5 * k, T_LILAC, T_BUTTER, 6, t * 2); break;
    case 4: for (const [dx, dy] of [[0, 0], [2, -1], [1, 2], [-2, 1]] as const) knot(a, ox + dx, oy + dy, T_BUTTER); break;
    case 5: stitchFlower(a, ox, oy, 3.8 * k, T_SKY, T_CREAM, 5, t * 3); break;
    default: break;
  }
}

const embroideryScene: AtelierScene = {
  plan(L) {
    const k = kOf(L);
    const rx = Math.min(L.gw * 0.51 + 1, 100);
    const ry = Math.min(L.gh * 0.47, 80);
    const hoop = { x: L.cx, y: L.cy + 2, rx, ry, wrx: rx * 0.74, wry: ry * 0.74 };
    const a0 = -0.3;
    const gap = 0.95;
    const a1 = a0 + TAU - gap;
    const ornamentTs: number[] = [];
    for (let t = a0 + 0.08; t < a0 + TAU - 0.05; t += 0.22) ornamentTs.push(t);
    return {
      k, hoop, a0, a1, gap, ornamentTs,
      spoolTR: { x: L.gr + 10, y: 26 },
    };
  },

  paint(a, L, P) {
    const C = EMB;
    const H = P.hoop;
    const k = P.k as number;
    const avg = (H.rx + H.ry) / 2;

    // 1. Gingham tablecloth · fabric overhang · double wooden hoop · stretched linen
    a.field((x, y) => {
      const nx = (x - H.x) / H.rx, ny = (y - H.y) / H.ry;
      const d = Math.hypot(nx, ny);
      const dpx = (d - 1) * avg;
      const ang = Math.atan2(ny, nx);
      const over = 8 + 3 * Math.sin(ang * 3 + 0.7) + 1.6 * Math.sin(ang * 7 + 2.1);
      if (dpx < 0) {
        let v = 0;
        if ((y % 2 === 0 && hash2(x >> 1, y, 3) > 0.62) || (x % 2 === 0 && hash2(x, y >> 1, 5) > 0.7)) v = 1;
        if (vnoise(x, y * 4, 9, 7) > 0.8) v = 1;
        if (dpx > -3.5) v = dpx > -1.5 ? 3 : 2;
        return [C.lin0!, C.lin1!, C.lin2!, C.linShade!][v]!;
      }
      if (dpx < 9.5) {
        const inner = dpx < 4.5;
        if (!inner && dpx < 4.95) return C.woodD!;
        const u = inner ? dpx / 4.5 : (dpx - 4.95) / 4.55;
        const light = -(nx * 0.55 + ny * 0.83) / Math.max(0.001, d);
        const grain = Math.sin(ang * 46 + (inner ? 0 : 1.3) + vnoise(x, y, 5, 3) * 2) > 0.82 ? -0.55 : 0;
        const s = Math.sin(clamp(u, 0, 1) * Math.PI) * 1.6 + light * 0.95 + grain + (hash2(x, y, 9) - 0.5) * 0.25;
        const stops = [C.woodD!, C.wood!, C.woodM!, C.woodL!, C.woodHi!];
        return stops[band(1.25 + s, x, y, 5, 0.4)]!;
      }
      if (dpx < 9.5 + over) {
        const edge = 9.5 + over - dpx;
        if (edge < 1.6 && hash2(x, y, 13) > 0.45) return C.lin2!;
        if (dpx < 11) return C.linShade!;
        return y % 2 === 0 && hash2(x >> 1, y, 3) > 0.6 ? C.lin2! : C.lin1!;
      }
      const s = 7;
      const gx = Math.floor((x + 2) / s) % 2 === 0, gy = Math.floor((y + 3) / s) % 2 === 0;
      let col = gx && gy ? C.gin2! : gx || gy ? C.gin1! : C.gin0!;
      if (gx && gy && (x + y) % 2 === 0) col = mix(col, C.gin1!, 0.5);
      if (dpx < 9.5 + over + 2.5) col = mix(col, C.shadow!, 0.5);
      return col;
    });

    // 2. Invisible board skeleton (tiny chalk ticks)
    skeleton(a, L, '#b49a82', 0.5, C.roseL!);

    // 3. Cross-stitch border band + running stitch
    const rr = 0.915;
    const per = Math.PI * (H.rx + H.ry) * rr;
    const nx = Math.floor(per / 7);
    for (let i = 0; i < nx; i++) {
      const ang = (i / nx) * TAU;
      const x = Math.round(H.x + Math.cos(ang) * H.rx * rr), y = Math.round(H.y + Math.sin(ang) * H.ry * rr);
      const T = i % 3 === 0 ? T_ROSE : T_SAGE;
      a.p(x - 1, y - 1, T.b); a.p(x + 1, y - 1, T.b); a.p(x, y, T.d); a.p(x - 1, y + 1, T.b); a.p(x + 1, y + 1, T.b);
    }
    a.ring(H.x, H.y, H.rx * 0.855, H.ry * 0.855, C.butterD!, 46);

    // 4. Blue washable-pen transfer pattern inside the unfinished gap
    a.alpha(0.9, () => {
      const n = Math.ceil(P.gap * H.wrx * 1.4);
      for (let i = 0; i <= n; i += 2) {
        const p = wreathPoint(H, P.a1 + (P.gap * i) / n);
        a.p(p.x, p.y, C.skyL!);
      }
      for (const t of P.ornamentTs as number[]) {
        if (t <= P.a1) continue;
        const p = wreathPoint(H, t);
        a.petal(p.x, p.y, p.tan + 0.95, 7.2 * k, 2.5 * k, C.skyL!, C.lin0!, undefined, 0.55);
      }
    });

    // 5. Finished satin-stitch wreath (vine + leaves + flowers)
    const n = Math.ceil((P.a1 - P.a0) * H.wrx * 1.4);
    for (let i = 0; i <= n; i++) {
      const p = wreathPoint(H, P.a0 + ((P.a1 - P.a0) * i) / n);
      a.p(p.x, p.y, C.sageD!);
    }
    for (const [idx, t] of (P.ornamentTs as number[]).entries()) {
      if (t > P.a1) continue;
      wreathOrnament(a, H, t, idx, k);
    }

    // 6. Central satin peony bouquet
    const cx = H.x, cy = H.y + 1;
    const ck = k * 1.45;
    for (const [ang, len] of [[0.95, 17], [2.2, 17], [0.3, 15], [2.85, 15], [1.57, 13], [-0.25, 12], [-2.9, 12]] as const) {
      satinLeaf(a, cx, cy, ang, len * ck, 3.4 * ck);
    }
    for (const [ang, len] of [[-0.75, 12], [-2.4, 12], [-1.57, 10]] as const) satinLeaf(a, cx, cy, ang, len * ck, 2.8 * ck, { ...T_SAGE, b: EMB.sageL!, l: '#d6ead0' });
    lazyDaisy(a, cx - 15 * ck, cy - 15 * ck, 6 * ck, T_LILAC, T_BUTTER, 6, 0.3);
    lazyDaisy(a, cx + 16 * ck, cy - 14 * ck, 6 * ck, T_LILAC, T_BUTTER, 6, 0.8);
    stitchFlower(a, cx - 22 * ck, cy + 4 * ck, 7.6 * ck, T_PEACH, T_BUTTER, 5, 0.4);
    stitchFlower(a, cx + 22 * ck, cy + 4 * ck, 7.6 * ck, T_PEACH, T_BUTTER, 5, 1.1);
    stitchFlower(a, cx - 8 * ck, cy + 17 * ck, 4.2 * ck, T_SKY, T_CREAM, 5, 0.2);
    stitchFlower(a, cx + 9 * ck, cy + 17 * ck, 4.2 * ck, T_SKY, T_CREAM, 5, 0.9);
    satinPeony(a, cx, cy - 2, 15 * ck, 0.2);
    // satin ribbon bow tying the bouquet
    const bwy = cy + 13 * ck;
    satinPetal(a, cx, bwy, Math.PI - 0.32, 9 * ck, 3.6 * ck, T_SKY);
    satinPetal(a, cx, bwy, 0.32, 9 * ck, 3.6 * ck, T_SKY);
    satinPetal(a, cx, bwy, Math.PI / 2 + 0.45, 11 * ck, 1.8 * ck, T_SKY);
    satinPetal(a, cx, bwy, Math.PI / 2 - 0.45, 11 * ck, 1.8 * ck, T_SKY);
    a.disc(cx, bwy, 2.2 * ck, 1.8 * ck, EMB.skyD!);
    a.disc(cx, bwy, 1.5 * ck, 1.2 * ck, EMB.sky!);
    for (const [dx, dy] of [[-30, -6], [30, -8], [-26, 16], [27, 15], [-4, -24], [6, -25], [-34, 6], [35, 4]] as const) {
      knot(a, cx + dx * ck, cy + dy * ck, dx % 2 === 0 ? T_LILAC : T_BUTTER);
    }

    // 7. Brass tension screw at the top of the hoop
    const sx = H.x, sy = H.y - H.ry - 5;
    a.r(sx - 7, sy - 2, 14, 7, C.brassD!);
    a.r(sx - 6, sy - 1, 12, 5, C.brass!);
    a.r(sx - 6, sy - 1, 12, 1, C.brassL!);
    a.disc(sx, sy - 4, 4, 2.6, C.brassD!);
    a.disc(sx, sy - 4, 3, 1.8, C.brass!);
    a.r(sx - 2, sy - 5, 4, 1, C.brassL!);
    a.r(sx - 10, sy, 3, 3, C.brass!);
    a.r(sx + 7, sy, 3, 3, C.brass!);

    // 8. Edge props: lace doily + spools (TL), pincushion + rose spool (TR), tape measure (L),
    //    scissors (R), thimble + spools (BL), yarn ball (BR), loose buttons
    paintDoily(a, L.gl - 36, 20, 21);
    paintSpool(a, L.gl - 44, 50, 24, 14, T_LILAC);
    paintSpool(a, L.gl - 22, 40, 19, 11, T_SAGE);
    paintPincushion(a, L.gr + 32, 40, 15);
    paintSpool(a, P.spoolTR.x, P.spoolTR.y + 10, 20, 12, T_ROSE);
    paintTape(a, [
      [L.gl - 50, 62], [L.gl - 14, 92], [L.gl - 38, 122], [L.gl - 62, 150], [L.gl - 30, 172],
    ], 6);
    paintScissors(a, L.gr + 30, L.mid - 16, 44);
    paintThimble(a, L.gl - 46, L.gb + 4);
    paintSpool(a, L.gl - 26, L.gb + 2, 18, 11, T_BUTTER);
    paintYarnBall(a, L.gr + 34, L.gb - 6, 13, T_LILAC);
    for (const [bx, by, R, T, th] of [
      [L.gl - 50, 92, 4, T_SKY, T_CREAM],
      [L.gr + 46, 76, 3.5, T_BUTTER, T_ROSE],
      [L.gr + 18, L.gb + 10, 4, T_PEACH, T_SAGE],
      [L.gl - 8, 12, 3.5, T_ROSE, T_CREAM],
      [L.gr + 50, L.mid + 30, 3, T_SAGE, T_BUTTER],
    ] as const) paintButton(a, bx, by, R, T, th);

    // 9. Bench: 9 big sewing buttons
    const BT = [T_ROSE, T_SAGE, T_BUTTER, T_LILAC, T_SKY, T_PEACH, T_CREAM, T_ROSE, T_LILAC];
    const TH = [T_CREAM, T_ROSE, T_LILAC, T_BUTTER, T_ROSE, T_SAGE, T_ROSE, T_BUTTER, T_CREAM];
    for (const [i, s] of slots(L).entries()) {
      paintButton(a, s.x, s.y + 1, Math.min(9.5, L.bs * 0.42), BT[i]!, TH[i]!);
    }
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const H = P.hoop;
    const k = P.k as number;

    // 1. Live sewing: the vine grows through the transfer pattern, then the hoop is "re-hooped"
    const cyc = 16;
    const p = clamp((sec % cyc) / 13, 0, 1);
    const head = P.a1 + P.gap * 0.88 * p;
    const n = Math.ceil((head - P.a1) * H.wrx * 1.4);
    for (let i = 0; i <= n; i++) {
      const q = wreathPoint(H, P.a1 + ((head - P.a1) * i) / Math.max(1, n));
      a.p(q.x, q.y, EMB.sageD!);
    }
    for (const [idx, tt] of (P.ornamentTs as number[]).entries()) {
      if (tt <= P.a1 || tt > head) continue;
      wreathOrnament(a, H, tt, idx, k);
    }
    const tip = wreathPoint(H, head);
    const dip = Math.sin(sec * 7) * 2.2;
    const na = -1.05;
    const nx0 = tip.x + Math.cos(na) * dip, ny0 = tip.y + Math.sin(na) * dip;
    const nx1 = nx0 + Math.cos(na) * 12, ny1 = ny0 + Math.sin(na) * 12;
    // thread to the rose spool
    const sx = P.spoolTR.x, sy = P.spoolTR.y + 2;
    const sag = 10 + Math.sin(sec * 1.3) * 3;
    a.quad(nx1, ny1, (nx1 + sx) / 2 + 4, (ny1 + sy) / 2 + sag, sx, sy, 0.5, 0.5, EMB.rose!);
    a.line(nx0, ny0, nx1, ny1, EMB.steelD!);
    a.line(nx0 - 1, ny0, nx1 - 1, ny1, EMB.steelL!);
    a.p(nx1 - 0.5, ny1 + 1.5, EMB.lin0!);
    if (Math.sin(sec * 3.1) > 0.7) a.p(nx0 + Math.cos(na) * 6, ny0 + Math.sin(na) * 6 - 1, '#ffffff');

    // 2. Running-stitch glints marching around the hoop
    a.alpha(0.85, () => a.ring(H.x, H.y, H.rx * 0.855, H.ry * 0.855, EMB.butterL!, 46, sec * 1.4));

    // 3. Embroidered butterfly that came alive
    const bu = sec * 0.32;
    const bx = H.x + Math.cos(bu) * (H.rx + 14) + Math.sin(bu * 2.7) * 12;
    const by = H.y - 6 + Math.sin(bu * 1.3) * (H.ry * 0.92);
    paintStitchButterfly(a, bx, by, Math.floor(sec * 9) % 2 === 0, Math.sin(bu) > 0);

    // 4. Sequins & brass glints
    for (let i = 0; i < 9; i++) {
      const gx = hash2(i, 5, 17) < 0.5 ? hash2(i, 1, 17) * (L.gl - 8) : L.gr + 8 + hash2(i, 1, 17) * (L.mR - 10);
      const gy = 10 + hash2(i, 2, 17) * (L.H - 40);
      const s = Math.sin(sec * 2.3 + i * 1.9);
      if (s < 0.55) continue;
      a.alpha((s - 0.55) * 2.2, () => {
        a.p(gx, gy, '#ffffff');
        a.p(gx - 1, gy, EMB.butterL!); a.p(gx + 1, gy, EMB.butterL!);
        a.p(gx, gy - 1, EMB.butterL!); a.p(gx, gy + 1, EMB.butterL!);
      });
    }
    const sc = Math.sin(sec * 1.7);
    if (sc > 0.6) a.alpha(sc - 0.6, () => { a.p(L.gr + 29, L.mid - 10, '#ffffff'); a.p(H.x - 4, H.y - H.ry - 9, '#ffffff'); });

    // 5. Yarn tail drifting from the ball
    const yx = L.gr + 34, yy = L.gb - 6;
    a.quad(yx - 10, yy + 6, yx - 22, yy + 14 + Math.sin(sec * 1.2) * 3, yx - 34 + Math.sin(sec * 0.9) * 4, yy + 10, 0.5, 0.5, EMB.lilac!);
  },
};

/* ═══════════════════════════ 2. 晚霞云海 · SUNSET CLOUD SEA ═══════════════════════════ */

export const SUN: Pal = {
  s0: '#4a3e7c', s1: '#5d4c8e', s2: '#77599d', s3: '#9767a8', s4: '#b975aa', s5: '#d686a9',
  s6: '#ec9ca7', s7: '#f6b2a0', s8: '#fbc99c', s9: '#ffdcac', s10: '#ffeec6',
  sun0: '#fffbf0', sun1: '#fff1c6', sun2: '#ffdd98', sun3: '#ffc47f',
  streak: '#b46a9c', streakD: '#8a5390', streakL: '#f6a9a8',
  c0: '#6c5591', c1: '#8a6aa4', c2: '#a980b1', c3: '#c899bb', c4: '#e2b2c3', c5: '#f4cdcd', c6: '#ffe4d6', c7: '#fff4ea',
  glow: '#ffe6b8', star: '#fff5e6', moon: '#fff1d0', moonD: '#e8c9a8',
  bird: '#4a3a6a',
};

type Lobe = { x: number; y: number; R: number };

function makeTower(r: Rng, baseX: number, baseY: number, topY: number, maxR: number, minR: number, lean: number): Lobe[] {
  const lobes: Lobe[] = [];
  let y = baseY;
  while (y > topY) {
    const t = (baseY - y) / Math.max(1, baseY - topY);
    const R = maxR + (minR - maxR) * t;
    const n = t < 0.3 ? 3 : t < 0.7 ? 2 : 1;
    for (let m = 0; m < n; m++) {
      lobes.push({
        x: baseX + (m - (n - 1) / 2) * R * 0.95 + (r() - 0.5) * R * 0.9 + lean * t * 10 + Math.sin(t * 5 + baseX) * 3,
        y: y + (r() - 0.5) * R * 0.5,
        R: R * (0.7 + r() * 0.5),
      });
    }
    y -= R * (0.55 + r() * 0.3);
  }
  return lobes;
}

function paintCumulus(a: Art, lobes: readonly Lobe[], sunX: number, sunY: number, pal: readonly string[], flat = 0.86) {
  const [p0, p1, p2, p3, p4] = pal as [string, string, string, string, string];
  for (const l of lobes) a.disc(l.x, l.y, l.R + 1, l.R * flat + 1, p0);
  for (const l of lobes) a.disc(l.x, l.y, l.R, l.R * flat, p1);
  for (const l of lobes) {
    const dx = clamp((sunX - l.x) / 90, -1, 1);
    a.disc(l.x + dx * l.R * 0.12, l.y - l.R * 0.12 * flat, l.R * 0.9, l.R * 0.78 * flat, p2);
  }
  for (const l of lobes) {
    const dx = clamp((sunX - l.x) / 90, -1, 1);
    a.disc(l.x + dx * l.R * 0.24, l.y - l.R * 0.26 * flat, l.R * 0.66, l.R * 0.54 * flat, p3);
  }
  const top = Math.min(...lobes.map(l => l.y - l.R));
  for (const l of lobes) {
    const dx = clamp((sunX - l.x) / 90, -1, 1);
    const mid = -Math.PI / 2 + dx * 0.9;
    a.arc(l.x + dx * l.R * 0.12, l.y - l.R * 0.12 * flat, l.R * 0.9, l.R * 0.78 * flat, mid - 0.55, mid + 0.55, l.y - l.R < top + 14 ? p4 : mix(p3, p4, 0.5));
  }
  void sunY;
}

function paintStreak(a: Art, x: number, y: number, len: number, th: number, body: string, rim: string, top?: string) {
  for (let i = 0; i <= len; i++) {
    const u = i / len;
    const w = th * Math.pow(Math.sin(u * Math.PI), 0.6);
    if (w < 0.5) {
      if (bayer(i, Math.round(y)) < 0.5) a.p(x + i, y, body);
      continue;
    }
    const y0 = Math.round(y - w * 0.6), y1 = Math.round(y + w * 0.4);
    a.r(x + i, y0, 1, y1 - y0 + 1, body);
    a.p(x + i, y1, rim);
    if (top && i % 3 !== 0) a.p(x + i, y0, top);
  }
}

function crescent(a: Art, cx: number, cy: number, R: number, ox: number, oy: number, col: string, shade: string) {
  const r2 = (R + 0.5) ** 2;
  for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) {
    for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
      if (dx * dx + dy * dy > r2) continue;
      if ((dx - ox) ** 2 + (dy - oy) ** 2 <= r2 * 0.9) continue;
      const edge = (dx - ox) ** 2 + (dy - oy) ** 2 <= r2 * 1.3;
      a.p(cx + dx, cy + dy, edge ? shade : col);
    }
  }
}

function paintBalloon(a: Art, x: number, y: number, s: number, A: string, B: string, D: string) {
  const rx = 7 * s, ry = 8.5 * s, skirt = 3.5 * s;
  for (let dy = Math.round(-ry); dy <= Math.round(ry + skirt); dy++) {
    let hw: number;
    if (dy <= ry * 0.2) {
      const tt = dy / ry;
      hw = rx * Math.sqrt(Math.max(0, 1 - tt * tt));
    } else {
      const u = (dy - ry * 0.2) / (ry * 0.8 + skirt);
      hw = rx * 0.98 * (1 - u * 0.74);
    }
    const H = Math.floor(hw);
    for (let dx = -H; dx <= H; dx++) {
      const g = Math.floor(((dx / (hw + 0.01)) + 1) * 2.5);
      let col = g % 2 === 0 ? A : B;
      if (Math.abs(dx) >= H || dy === Math.round(-ry)) col = D;
      else {
        const lit = -(dx / rx) * 0.7 - (dy / ry) * 0.45;
        if (lit > 0.5) col = mix(col, '#ffffff', 0.4);
        else if (lit < -0.4) col = mix(col, D, 0.35);
      }
      a.p(x + dx, y + dy, col);
    }
  }
  const by = y + ry + skirt;
  a.line(x - rx * 0.28, by, x - 1.5 * s, by + 4 * s, '#6a4a60');
  a.line(x + rx * 0.28, by, x + 1.5 * s, by + 4 * s, '#6a4a60');
  a.r(x - 2 * s, by + 4 * s, 4 * s + 1, Math.max(2, 3 * s), '#8a5a3c');
  a.r(x - 2 * s, by + 4 * s, 4 * s + 1, 1, '#d29a68');
}

function paintCloudWhale(a: Art, x0: number, y0: number, sec: number, s = 1) {
  const O = '#6a5190', Bd = '#b49ad0', Be = '#e6d6f2', Hi = '#dcc9ef';
  const flap = Math.sin(sec * 1.6) * 2.5;
  const X = (d: number) => x0 + d * s, Y = (d: number) => y0 + d * s;
  // tail fluke
  a.quad(X(-18), Y(0), X(-25), Y(-2), X(-29), Y(-6 + flap), 2.4 * s, 1.2 * s, O);
  a.quad(X(-18), Y(0), X(-25), Y(-2), X(-29), Y(-6 + flap), 1.6 * s, 0.6 * s, Bd);
  a.petal(X(-29), Y(-6 + flap), -2.5, 6.5 * s, 2.4 * s, O, Bd, Hi, 0.6);
  a.petal(X(-29), Y(-6 + flap), -0.75, 6.5 * s, 2.4 * s, O, Bd, Hi, 0.6);
  // body
  a.disc(X(0), Y(0), 21 * s, 7.6 * s, O);
  a.disc(X(11), Y(-0.6), 9.6 * s, 8.4 * s, O);
  a.disc(X(0), Y(0), 20 * s, 6.8 * s, Bd);
  a.disc(X(11), Y(-0.6), 8.8 * s, 7.6 * s, Bd);
  a.disc(X(3), Y(3.4), 15 * s, 3 * s, Be);
  a.disc(X(-2), Y(-3.6), 13 * s, 2.1 * s, Hi);
  // fin
  a.petal(X(5), Y(4), 2.1, 6 * s, 2.2 * s, O, Bd, Hi, 0.6);
  // face
  a.r(X(14), Y(-1), 2, 2, '#3a2a52');
  a.p(X(14), Y(-1), '#ffffff');
  a.r(X(13), Y(2), 3, 1, '#f3a2bf');
  a.line(X(17), Y(2), X(19.5), Y(1), O);
  // throat grooves
  for (let i = 0; i < 3; i++) a.line(X(6 - i * 3), Y(4.2), X(10 - i * 3), Y(5.2), mix(Be, O, 0.3));
}

const sunsetScene: AtelierScene = {
  plan(L, r) {
    const k = kOf(L);
    const Hz = L.mid;
    const sun = { x: L.cx, y: Hz - 2, R: 31 * k };
    const towerL = makeTower(r, L.gl - 30, Hz + 22, 22, 17, 8, 0.6);
    const towerR = makeTower(r, L.gr + 30, Hz + 26, 30, 17, 8, -0.5);
    const rows: { y: number; R: number; j: number; puffs: Lobe[] }[] = [];
    let y = Hz + 1.5, j = 0;
    while (y < L.H + 14) {
      const R = 3.2 + j * 1.75;
      const puffs: Lobe[] = [];
      let x = -R + r() * R;
      while (x < L.W + R) {
        puffs.push({ x, y: y + (r() - 0.5) * R * 0.45, R: R * (0.6 + r() * 0.8) });
        x += R * (0.75 + r() * 0.7);
      }
      rows.push({ y, R, j, puffs });
      y += R * 0.55 + 1.3;
      j++;
    }
    const streaks = [
      { x: L.cx - 92, y: Hz - 14, len: 70, th: 2.6 },
      { x: L.cx + 18, y: Hz - 9, len: 64, th: 2.2 },
      { x: L.cx - 40, y: Hz - 24, len: 58, th: 2.0 },
      { x: L.cx + 34, y: Hz - 34, len: 46, th: 1.8 },
      { x: L.gl - 6, y: 46, len: 52, th: 1.8 },
      { x: L.cx + 10, y: 30, len: 60, th: 1.6 },
      { x: L.gr - 40, y: 58, len: 44, th: 1.5 },
    ];
    const stars = Array.from({ length: 40 }, (_, i) => ({ x: hash2(i, 3, 61) * L.W, y: 3 + Math.pow(hash2(i, 4, 61), 1.6) * 44 }));
    return { k, Hz, sun, towerL, towerR, rows, streaks, stars };
  },

  paint(a, L, P) {
    const C = SUN;
    const { Hz, sun } = P;
    const k = P.k as number;
    const sky = [C.s0!, C.s1!, C.s2!, C.s3!, C.s4!, C.s5!, C.s6!, C.s7!, C.s8!, C.s9!, C.s10!];
    const sea = [C.c0!, C.c1!, C.c2!, C.c3!, C.c4!];

    // 1. Dusk sky gradient with sun glow (above the midline) · cloud-sea base (below)
    a.field((x, y) => {
      if (y < Hz) {
        const g = Math.max(0, 1 - Math.hypot((x - sun.x) / 125, (y - sun.y) / 72));
        const v = Math.pow(y / Hz, 1.05) * 8.1 + g * g * 2.4 + (vnoise(x, y, 30, 5) - 0.5) * 0.35;
        return sky[band(v, x, y, sky.length, 0.45)]!;
      }
      const v = 3.6 - ((y - Hz) / (L.H - Hz)) * 2.6;
      return sea[band(v, x, y, sea.length, 0.5)]!;
    });

    // 2. Stars & a slim moon high in the violet
    for (const s of P.stars as { x: number; y: number }[]) {
      const dim = s.y / 50;
      a.p(s.x, s.y, mix(C.star!, C.s1!, dim * 0.8));
    }
    crescent(a, L.cx - 62 * k, 15, 5.5, 2.4, -1.4, C.moon!, C.moonD!);

    // 3. Setting sun with dithered corona
    a.alpha(0.5, () => ditherDisc(a, sun.x, sun.y, sun.R * 1.9, sun.R * 1.55, C.s9!, 0.5));
    a.alpha(0.6, () => ditherDisc(a, sun.x, sun.y, sun.R * 1.35, sun.R * 1.2, C.s10!, 0.45));
    ditherDisc(a, sun.x, sun.y, sun.R, sun.R, C.sun3!, 0.12);
    ditherDisc(a, sun.x, sun.y, sun.R * 0.84, sun.R * 0.84, C.sun2!, 0.2);
    ditherDisc(a, sun.x, sun.y - 1, sun.R * 0.64, sun.R * 0.64, C.sun1!, 0.25);
    ditherDisc(a, sun.x - 2, sun.y - 3, sun.R * 0.36, sun.R * 0.36, C.sun0!, 0.3);

    // 4. Long sunset streak clouds (violet bodies with peach under-light)
    for (const s of P.streaks as { x: number; y: number; len: number; th: number }[]) {
      const h = clamp(s.y / Hz, 0, 1);
      const body = mix(C.streakD!, C.streak!, h);
      const rim = mix(C.s5!, C.streakL!, h);
      paintStreak(a, s.x, s.y, s.len * k, s.th, body, rim, h > 0.7 ? mix(body, C.s4!, 0.4) : undefined);
    }

    // 5. Horizon light line
    for (let x = 0; x < L.W; x++) {
      const g = Math.max(0, 1 - Math.abs(x - sun.x) / 150);
      if (bayer(x, 1) < 0.35 + g * 0.65) a.p(x, Hz, g > 0.5 ? C.sun1! : C.s9!);
    }

    // 6. Towering cumulus at both flanks, lit from the sun side
    paintCumulus(a, P.towerL, sun.x, sun.y, [C.c0!, C.c1!, C.c3!, C.c5!, C.c7!]);
    paintCumulus(a, P.towerR, sun.x, sun.y, [C.c0!, C.c1!, C.c3!, C.c5!, C.c7!]);

    // 7. The cloud sea, row by row toward the viewer, with a glittering sun road
    for (const row of P.rows as { y: number; R: number; j: number; puffs: Lobe[] }[]) {
      const far = clamp(1 - row.j / 10, 0, 1);
      const pal = [
        mix(C.c1!, C.c2!, far), mix(C.c2!, C.c3!, far), mix(C.c3!, C.c4!, far), mix(C.c4!, C.c5!, far), C.c6!,
      ];
      const roadOf = (x: number) => Math.max(0, 1 - Math.abs(x - sun.x) / (14 + row.j * 4.5)) * 0.65;
      for (const l of row.puffs) a.disc(l.x, l.y, l.R + 0.8, l.R * 0.58 + 0.8, pal[0]!);
      for (const l of row.puffs) a.disc(l.x, l.y, l.R, l.R * 0.58, pal[1]!);
      for (const l of row.puffs) {
        const dx = clamp((sun.x - l.x) / 80, -1, 1);
        a.disc(l.x + dx * l.R * 0.08, l.y - l.R * 0.13, l.R * 0.93, l.R * 0.45, pal[2]!);
      }
      for (const l of row.puffs) {
        const dx = clamp((sun.x - l.x) / 80, -1, 1);
        const road = roadOf(l.x);
        a.disc(l.x + dx * l.R * 0.16, l.y - l.R * 0.25, l.R * 0.68, l.R * 0.28, mix(pal[3]!, C.glow!, road));
      }
      for (const l of row.puffs) {
        const dx = clamp((sun.x - l.x) / 80, -1, 1);
        const road = roadOf(l.x);
        a.arc(l.x + dx * l.R * 0.08, l.y - l.R * 0.13, l.R * 0.93, l.R * 0.45, Math.PI * 1.22 + dx * 0.35, Math.PI * 1.78 + dx * 0.35, mix(pal[4]!, C.sun1!, road));
      }
    }

    // 8. Skeleton (soft sky chalk) — enemy in the sky, us on the clouds
    skeleton(a, L, '#fff2ea', 0.32, C.sun1!);

    // 9. Bench: 9 plump sunset cloud cushions
    for (const [i, s] of slots(L).entries()) {
      const R = Math.min(10, L.bs * 0.43);
      a.alpha(0.45, () => a.disc(s.x + 1, s.y + R * 0.55, R * 1.05, R * 0.32, C.c0!));
      const lobes: Lobe[] = [
        { x: s.x - R * 0.5, y: s.y + 1, R: R * 0.55 },
        { x: s.x + R * 0.52, y: s.y + 1.5, R: R * 0.5 },
        { x: s.x - R * 0.05, y: s.y - R * 0.18, R: R * 0.68 },
      ];
      paintCumulus(a, lobes, i < 4 ? s.x + 40 : s.x - 40, s.y - 40, ['#a85a7c', '#f9c3c4', '#ffdcd2', '#fff0e6', '#ffffff'], 0.8);
      a.arc(s.x - R * 0.05, s.y - R * 0.18, R * 0.68, R * 0.54, Math.PI * 1.15, Math.PI * 1.85, '#ffd98a');
    }
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const C = SUN;
    const { Hz, sun } = P;
    const k = P.k as number;

    // 1. Slow god-rays fanning from the sun
    a.alpha(0.1, () => {
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI + 0.18 + i * 0.34 + Math.sin(sec * 0.15 + i) * 0.04;
        const len = 60 + (i % 3) * 18;
        a.line(sun.x, sun.y, sun.x + Math.cos(ang) * len, sun.y + Math.sin(ang) * len * 0.8, C.sun1!);
      }
    });

    // 2. Twinkling stars
    for (const [i, s] of (P.stars as { x: number; y: number }[]).entries()) {
      const b = Math.sin(sec * (1.3 + (i % 5) * 0.3) + i * 2.1);
      if (b < 0.75 || s.y > 36) continue;
      a.alpha((b - 0.75) * 4, () => {
        a.p(s.x, s.y, '#ffffff');
        a.p(s.x - 1, s.y, C.star!); a.p(s.x + 1, s.y, C.star!);
        a.p(s.x, s.y - 1, C.star!); a.p(s.x, s.y + 1, C.star!);
      });
    }

    // 3. Wisps drifting across the sky
    for (let i = 0; i < 3; i++) {
      const wx = wrap(hash2(i, 1, 81) * L.W + sec * (2 + i * 0.7), L.W + 60) - 30;
      const wy = 20 + i * 22 + Math.sin(sec * 0.2 + i) * 2;
      a.alpha(0.55, () => paintStreak(a, wx, wy, 26 + i * 6, 1.4, C.s4!, C.s6!));
    }

    // 4. Hot-air balloons in the dusk sky
    const b1x = wrap(sec * 3.1 + 30, L.W + 60) - 30;
    paintBalloon(a, b1x, 44 + Math.sin(sec * 0.7) * 3, 1, '#f58fa8', '#fff1e2', '#a8486a');
    const b2x = L.W + 20 - wrap(sec * 1.7 + 90, L.W + 40);
    paintBalloon(a, b2x, 72 + Math.sin(sec * 0.9 + 2) * 2, 0.6, '#b9a2ea', '#ffe39a', '#6d56a6');
    const b3x = wrap(sec * 2.2 + 210, L.W + 50) - 25;
    paintBalloon(a, b3x, 22 + Math.sin(sec * 0.6 + 4) * 2, 0.45, '#8fd9c8', '#fff6e6', '#3e8a7c');

    // 5. A flock of birds
    const per = 34;
    const u = (sec % per) / per;
    const fx = L.W + 20 - u * (L.W + 60), fy = 52 + Math.sin(u * TAU) * 6;
    for (let i = 0; i < 5; i++) {
      const ox = fx + Math.abs(i - 2) * 6, oy = fy + (i - 2) * 3 + Math.abs(i - 2) * 2;
      const up = Math.floor(sec * 7 + i) % 2 === 0;
      a.line(ox - 3, oy - (up ? 2 : 0), ox, oy, C.bird!);
      a.line(ox, oy, ox + 3, oy - (up ? 2 : 0), C.bird!);
    }

    // 6. The little cloud whale swimming through the cloud sea
    const wper = 48;
    const wu = ((sec + 14) % wper) / wper;
    const wx = -45 + wu * (L.W + 90);
    const ws = 1.35 * k;
    const wy = Hz + 50 * k + Math.sin(sec * 0.8) * 2;
    paintCloudWhale(a, wx, wy, sec, ws);
    for (let i = -3; i <= 3; i++) {
      const px = wx + 2 * ws + i * 10 * ws + Math.sin(sec * 1.6 + i) * 0.8;
      const pr = (9 - Math.abs(i) * 0.8) * ws;
      a.disc(px, wy + 8 * ws, pr + 0.7, pr * 0.46 + 0.7, C.c2!);
      a.disc(px, wy + 8 * ws, pr, pr * 0.46, C.c3!);
      a.disc(px, wy + 7.2 * ws, pr * 0.85, pr * 0.3, C.c4!);
    }
    const sp = (sec + 14) % 9;
    if (sp < 2.2) {
      for (let i = 0; i < 4; i++) {
        const q = sp / 2.2;
        const r = 1 + q * (2 + i * 0.6);
        a.alpha(1 - q, () => a.disc(wx + 9 * ws + (i - 1.5) * 3 * q * 2, wy - 9 * ws - q * 12 - i, r, r * 0.8, '#fff6f2'));
      }
    }

    // 7. Glitter along the sun road on the cloud tops
    for (let i = 0; i < 12; i++) {
      const gy = Hz + 4 + hash2(i, 2, 91) * (L.H - Hz - 30);
      const spread = 10 + (gy - Hz) * 0.25;
      const gx = sun.x + (hash2(i, 3, 91) - 0.5) * 2 * spread;
      const s = Math.sin(sec * 3 + i * 1.7);
      if (s < 0.6) continue;
      a.alpha((s - 0.6) * 2.5, () => { a.r(gx - 1, gy, 3, 1, C.sun1!); a.p(gx, gy, '#ffffff'); });
    }
  },
};

/* ═══════════════════════════ 3. 星夜木马 · CAROUSEL NIGHT ═══════════════════════════ */

export const CAR: Pal = {
  n0: '#130f26', n1: '#1b1533', n2: '#241c42', n3: '#302352', n4: '#3e2a5e',
  g1: '#4f2f63', g2: '#663868', g3: '#80446c',
  pf0: '#5a3a6c', pf1: '#7a4f82', pf2: '#9d6993', pf3: '#bb83a8', pf4: '#d9a6c0',
  gold: '#e2a94b', goldL: '#ffd98a', goldD: '#a46d2a', goldHi: '#fff3c6',
  sk: '#8e2f5c', skD: '#5d1c41', skL: '#c34b7f',
  mir0: '#f6eaff', mir1: '#c8b3ec', mir2: '#8a74c2',
  pink: '#f26b9b', pinkL: '#ffb3cd', pinkD: '#b63f6d',
  cream: '#fff3e8', creamD: '#e5c8bc',
  mint: '#8fe0c8', mintD: '#459c86', lilac: '#b59ce6', lilacD: '#7a60b0', butter: '#ffd27a', butterD: '#b98a2e',
  bulb: '#ffe08a', bulbHi: '#fffbe6', bulbOff: '#7d5e4c',
  star: '#fff0d8', outline: '#2e1b3e',
};

type HorseStyle = { body: string; shade: string; mane: string; maneD: string; saddle: string };
const HORSES: HorseStyle[] = [
  { body: '#fff6f0', shade: '#e3cbd6', mane: '#f58fb3', maneD: '#c45684', saddle: '#b59ce6' },
  { body: '#e4d8ff', shade: '#b8a6e4', mane: '#ffd27a', maneD: '#c49432', saddle: '#f26b9b' },
  { body: '#d7f6ec', shade: '#a6d9c8', mane: '#c7a6f2', maneD: '#8a6ac2', saddle: '#ffd27a' },
  { body: '#ffe1ea', shade: '#e8b3c4', mane: '#fff3e0', maneD: '#d9bfa8', saddle: '#8fe0c8' },
];

function paintCarouselHorse(a: Art, x: number, y: number, dir: 1 | -1, S: HorseStyle, gallop: number) {
  const O = CAR.outline!;
  const X = (dx: number) => x + dx * dir;
  const leg = Math.sin(gallop) * 1.2;
  const parts = (pass: 0 | 1) => {
    const g = pass === 0 ? 1 : 0;
    const c = (col: string) => (pass === 0 ? O : col);
    // back legs
    a.stroke(X(-3.5), y - 7, X(-5 - leg), y - 2.5, 1.1 + g, 0.9 + g, c(S.shade));
    a.stroke(X(-2), y - 7, X(-2.5 + leg * 0.5), y - 2, 1.1 + g, 0.9 + g, c(S.body));
    // front legs, prancing
    a.stroke(X(3.5), y - 8, X(6.5), y - 6 - leg, 1.1 + g, 0.9 + g, c(S.shade));
    a.stroke(X(4.5), y - 8, X(7), y - 9.5 + leg, 1.1 + g, 0.9 + g, c(S.body));
    // tail
    a.quad(X(-5.5), y - 10, X(-9), y - 11, X(-8.5), y - 5.5, 1.3 + g, 0.7 + g, c(S.mane));
    // body
    a.disc(X(0), y - 9.5, 5.6 + g, 3.3 + g, c(S.body));
    // neck & head
    a.stroke(X(3.2), y - 11, X(5.6), y - 15.5, 2 + g, 1.6 + g, c(S.body));
    a.disc(X(7.2), y - 15.8, 2.6 + g, 1.8 + g, c(S.body));
    a.disc(X(8.8), y - 14.8, 1.6 + g, 1.3 + g, c(S.body));
    a.p(X(5.6), y - 18.3 - g, c(S.body));
  };
  parts(0);
  parts(1);
  // shading on belly
  a.r(x - 4, y - 7.5, 8, 1, S.shade);
  // mane along the neck
  a.stroke(X(2.6), y - 12.4, X(5), y - 17.2, 1.1, 0.9, S.mane);
  a.p(X(4.2), y - 13.6, S.maneD);
  a.p(X(3.4), y - 12.6, S.maneD);
  // saddle & blanket
  a.disc(X(-0.5), y - 12, 2.8, 1.3, S.saddle);
  a.r(x - 2, y - 11, 4, 2, mix(S.saddle, O, 0.25));
  a.p(X(-0.5), y - 12.8, CAR.goldHi!);
  // bridle & eye
  a.line(X(6.4), y - 16.4, X(8.8), y - 14.2, CAR.gold!);
  a.p(X(7.4), y - 16.4, O);
  a.p(X(9.8), y - 14.4, mix(S.body, O, 0.5));
}

function paintDrum(a: Art, D: Plan, shimmer: number) {
  const { x, y, w, h } = D;
  const C = CAR;
  a.disc(x, y + 1, w + 5, (w + 5) * 0.42, C.goldD!);
  a.disc(x, y, w + 4, (w + 4) * 0.4, C.gold!);
  a.arc(x, y, w + 4, (w + 4) * 0.4, Math.PI * 1.05, Math.PI * 1.6, C.goldL!);
  const top = Math.round(y - h);
  for (let dx = -Math.round(w); dx <= Math.round(w); dx++) {
    const u = dx / w;
    const light = Math.sqrt(Math.max(0, 1 - u * u));
    const ang = Math.asin(clamp(u, -1, 1)) / Math.PI + 0.5;
    const f = wrap(ang * 6 + shimmer, 1);
    const yb = Math.round(y - 1 + light * 2);
    let col = Math.floor(ang * 6 + shimmer) % 2 === 0 ? C.mir0! : C.mir1!;
    col = mix(col, C.mir2!, (1 - light) * 0.75);
    const divider = f < 0.12;
    for (let yy = top; yy <= yb; yy++) {
      let c2 = divider ? (light > 0.5 ? C.gold! : C.goldD!) : col;
      if (!divider && Math.abs(f - 0.55) < 0.07 && light > 0.35 && (yy & 3) !== 0) c2 = '#ffffff';
      a.p(x + dx, yy, c2);
    }
  }
  // crown band with bulbs and scallops
  a.r(x - w - 2, top - 5, w * 2 + 5, 5, C.goldD!);
  a.r(x - w - 2, top - 5, w * 2 + 5, 3, C.gold!);
  a.r(x - w - 2, top - 5, w * 2 + 5, 1, C.goldL!);
  for (let dx = -w; dx <= w; dx += 4) {
    a.disc(x + dx, top, 1.6, 1.4, C.pink!);
    a.p(x + dx, top - 3, C.bulbHi!);
  }
  // striped canopy cone
  const ch = Math.round(h * 0.62);
  const cw = w + 5;
  for (let j = 0; j <= ch; j++) {
    const hw = (j / ch) * cw;
    const yy = top - 5 - ch + j;
    for (let dx = -Math.floor(hw); dx <= Math.floor(hw); dx++) {
      const s = Math.floor(((dx / (hw + 0.01)) + 1) * 3.5);
      let col = s % 2 === 0 ? C.pink! : C.cream!;
      if (dx / (hw + 0.01) > 0.45) col = mix(col, C.pinkD!, 0.35);
      if (Math.abs(dx) >= Math.floor(hw)) col = C.pinkD!;
      a.p(x + dx, yy, col);
    }
  }
  a.disc(x, top - 6 - ch, 1.8, 1.8, C.gold!);
  a.p(x, top - 9 - ch, C.goldHi!);
  a.r(x - 1, top - 8 - ch, 3, 1, C.goldL!);
}

function paintStripedTent(a: Art, ax: number, ay: number, baseY: number, hw: number) {
  const C = CAR;
  const roofH = baseY - ay;
  for (let j = 0; j <= roofH; j++) {
    const u = j / roofH;
    const w = hw * Math.pow(u, 0.75);
    for (let dx = -Math.floor(w); dx <= Math.floor(w); dx++) {
      const s = Math.floor(((dx / (w + 0.01)) + 1) * 4);
      let col = s % 2 === 0 ? C.pink! : C.cream!;
      if (dx > w * 0.35) col = mix(col, C.pinkD!, 0.35);
      a.p(ax + dx, ay + j, col);
    }
  }
  // valance scallops
  for (let dx = -hw; dx <= hw; dx += 6) {
    a.disc(ax + dx + 3, baseY + 1, 3.2, 2.6, Math.round((dx + hw) / 6) % 2 ? C.pink! : C.cream!);
    a.p(ax + dx + 3, baseY + 3, C.gold!);
  }
  a.r(ax - hw, baseY - 1, hw * 2, 2, C.gold!);
  // walls with door
  const wallH = 22;
  for (let dx = -hw + 3; dx <= hw - 3; dx++) {
    const s = Math.floor((dx + hw) / 5) % 2 === 0;
    for (let yy = baseY + 3; yy < baseY + wallH; yy++) a.p(ax + dx, yy, s ? mix(C.pink!, C.n4!, 0.35) : mix(C.cream!, C.n4!, 0.35));
  }
  for (let yy = baseY + 4; yy < baseY + wallH; yy++) {
    const half = Math.round(((yy - baseY - 4) / (wallH - 4)) * 7);
    a.r(ax - half, yy, half * 2 + 1, 1, '#2a1638');
  }
  a.r(ax - 1, baseY + 6, 3, wallH - 7, mix('#ffcf7a', '#2a1638', 0.35));
  // pole
  a.r(ax, ay - 12, 1, 12, C.goldD!);
  a.p(ax, ay - 13, C.goldHi!);
}

function paintCandyCart(a: Art, x: number, by: number) {
  const C = CAR;
  a.alpha(0.45, () => a.disc(x + 2, by + 2, 20, 3.5, '#0c0818'));
  // awning poles
  a.r(x - 15, by - 40, 1, 28, C.goldD!);
  a.r(x + 14, by - 40, 1, 28, C.goldD!);
  // body
  a.r(x - 17, by - 16, 34, 13, C.pinkD!);
  a.r(x - 16, by - 15, 32, 11, C.pink!);
  for (let i = -14; i <= 14; i += 6) a.r(x + i, by - 15, 2, 11, C.pinkL!);
  a.r(x - 17, by - 17, 34, 2, C.gold!);
  // sign
  a.r(x - 7, by - 12, 14, 5, C.cream!);
  a.disc(x, by - 9.5, 2, 1.6, C.pink!);
  // wheels
  for (const wx of [x - 11, x + 11]) {
    a.disc(wx, by - 2, 4, 4, C.goldD!);
    a.disc(wx, by - 2, 3, 3, C.cream!);
    a.p(wx, by - 2, C.goldD!);
  }
  // cotton candy puffs on sticks
  for (const [dx, col, colL] of [[-8, C.pinkL!, '#ffe0ec'], [0, C.lilac!, '#e8dcff'], [8, C.mint!, '#dcfff3']] as const) {
    a.r(x + dx, by - 26, 1, 9, C.cream!);
    a.disc(x + dx, by - 29, 4.6, 4, mix(col, C.outline!, 0.3));
    a.disc(x + dx, by - 29, 4, 3.4, col);
    a.disc(x + dx - 1.2, by - 30.4, 2, 1.6, colL);
  }
  // scalloped awning
  for (let dx = -18; dx <= 16; dx++) {
    const s = Math.floor((dx + 18) / 4) % 2 === 0;
    for (let yy = by - 46; yy < by - 39; yy++) a.p(x + dx, yy, s ? C.cream! : C.pink!);
  }
  for (let dx = -18; dx <= 14; dx += 4) a.disc(x + dx + 2, by - 39, 2, 1.6, Math.floor((dx + 18) / 4) % 2 === 0 ? C.cream! : C.pink!);
  a.r(x - 18, by - 47, 35, 1, C.gold!);
}

function paintTeacup(a: Art, cx: number, cy: number, R: number, T: { d: string; b: string; l: string }) {
  const C = CAR;
  a.alpha(0.5, () => a.disc(cx + 1.5, cy + 3, R + 1, R * 0.5 + 1, '#0c0818'));
  a.disc(cx, cy + 3, R + 1, R * 0.5 + 1, C.goldD!);
  a.disc(cx, cy + 3, R, R * 0.5, C.cream!);
  a.ring(cx, cy + 3, R * 0.8, R * 0.38, C.creamD!);
  const cr = R * 0.66, cry = cr * 0.5;
  // cup wall
  a.disc(cx, cy + 1.2, cr + 1, cry + 4.2, T.d);
  a.disc(cx, cy + 0.9, cr, cry + 3.6, T.b);
  a.r(cx - cr * 0.6, cy + 1, 1, 3, T.l);
  a.arc(cx + cr + 1.4, cy, 2, 2, -Math.PI / 2, Math.PI / 2, T.d, 2);
  // rim + interior
  a.disc(cx, cy - 1.4, cr + 0.5, cry + 0.5, C.cream!);
  a.disc(cx, cy - 1.1, cr - 0.9, cry - 0.7, mix(T.d, C.outline!, 0.35));
  a.disc(cx - cr * 0.25, cy - 1.4, cr * 0.42, cry * 0.32, mix(T.l, T.d, 0.4));
  a.p(cx, cy + cry + 0.6, C.goldHi!);
  a.p(cx - 2, cy + cry + 0.4, T.l);
  a.p(cx + 2, cy + cry + 0.4, T.l);
}

const carouselScene: AtelierScene = {
  plan(L) {
    const k = kOf(L);
    const rx = Math.min(L.gw * 0.48, 92);
    const plat = { x: L.cx, y: L.cy + 8, rx, ry: Math.max(rx * 0.58, L.gh * 0.3) };
    const drum = { x: plat.x, y: plat.y - 2, w: Math.round(15 * k), h: Math.round(37 * k) };
    const ring = { rx: rx * 0.7, ry: plat.ry * 0.7 };
    const wheel = { x: L.gr + 40, y: 46, R: 37 };
    const swags: { x0: number; x1: number; y: number; sag: number }[] = [];
    const span = L.W / 4;
    for (let i = 0; i < 4; i++) swags.push({ x0: i * span - 4, x1: (i + 1) * span + 4, y: 1, sag: 11 });
    const stars = Array.from({ length: 34 }, (_, i) => ({ x: hash2(i, 3, 63) * L.W, y: 6 + hash2(i, 4, 63) * 34 }));
    return { k, plat, drum, ring, wheel, swags, stars };
  },

  paint(a, L, P) {
    const C = CAR;
    const { plat, wheel } = P;

    // 1. Night fairground with a warm light pool around the carousel
    a.field((x, y) => {
      const g = 1 - Math.hypot((x - plat.x) / (plat.rx * 1.6), (y - plat.y) / (plat.ry * 2));
      if (y < 40 && g < 0.15) {
        const v = (y / 40) * 2 + vnoise(x, y, 24, 2) * 0.4;
        return [C.n0!, C.n1!, C.n2!][band(v, x, y, 3, 0.5)]!;
      }
      const v = clamp(g, 0, 1) * 4.6 + 1 + (vnoise(x, y, 18, 4) - 0.5) * 0.5;
      const stops = [C.n1!, C.n2!, C.n3!, C.g1!, C.g2!, C.g3!];
      let col = stops[band(v, x, y, stops.length, 0.45)]!;
      const fs = flagstone(x, y * 1.6, 10, 8);
      if (fs.edge < 0.9 && g < 0.95) col = mix(col, C.n0!, 0.35);
      else if (fs.shade > 0.75) col = mix(col, C.n4!, 0.25);
      return col;
    });

    // 2. Stars & a crescent moon between the light strings
    for (const s of P.stars as { x: number; y: number }[]) a.p(s.x, s.y, mix(C.star!, C.n1!, 0.35 + hash2(s.x | 0, s.y | 0, 1) * 0.4));
    crescent(a, L.cx + 44, 15, 5, 2.2, -1.2, '#fff0cc', '#e6c49a');

    // 3. Ferris wheel legs (wheel itself turns in the anim layer)
    for (const s of [-1, 1] as const) {
      a.stroke(wheel.x, wheel.y, wheel.x + s * 22, wheel.y + 70, 1.4, 1.6, '#4a3466');
      a.stroke(wheel.x, wheel.y, wheel.x + s * 22, wheel.y + 70, 0.6, 0.7, '#6d4f8e');
    }
    a.r(wheel.x - 26, wheel.y + 69, 52, 3, '#3a2852');

    // 4. Striped tent peeking in at the top-left
    paintStripedTent(a, L.gl - 38, 4, 44, 32);

    // 5. Carousel platform: shadow · skirt · plank floor · gold rim
    a.alpha(0.5, () => a.disc(plat.x + 3, plat.y + 11, plat.rx + 4, plat.ry + 5, '#0c0818'));
    for (let dx = -Math.round(plat.rx); dx <= Math.round(plat.rx); dx++) {
      const ye = plat.y + plat.ry * Math.sqrt(Math.max(0, 1 - (dx / plat.rx) ** 2));
      for (let yy = 0; yy < 8; yy++) {
        const seam = (dx + 400) % 7 === 0;
        let col = yy < 1 ? C.gold! : yy > 6 ? C.goldD! : seam ? C.skD! : yy < 3 ? C.skL! : C.sk!;
        if (Math.abs(dx) > plat.rx * 0.92 && yy > 0 && yy < 7) col = C.skD!;
        a.p(plat.x + dx, ye + yy, col);
      }
    }
    for (let dy = -Math.ceil(plat.ry); dy <= Math.ceil(plat.ry); dy++) {
      for (let dx = -Math.ceil(plat.rx); dx <= Math.ceil(plat.rx); dx++) {
        const nx = dx / plat.rx, ny = dy / plat.ry;
        const r = Math.hypot(nx, ny);
        if (r > 1) continue;
        const x = plat.x + dx, y = plat.y + dy;
        let col: string;
        if (r > 0.95) col = ny < -0.2 || nx < -0.6 ? C.goldL! : r > 0.985 ? C.goldD! : C.gold!;
        else if (r > 0.9) col = C.pf0!;
        else {
          const ang = Math.atan2(ny, nx);
          const sec = (ang + Math.PI) / (TAU / 24);
          const fr = sec - Math.floor(sec);
          if (fr < 0.07 && r > 0.24) col = C.pf1!;
          else col = Math.floor(sec) % 2 === 0 ? C.pf2! : C.pf3!;
          if (r > 0.5 && r < 0.545) col = (Math.floor(sec * 2) % 2 === 0) ? C.gold! : C.pf1!;
          if (r < 0.24) col = r < 0.2 ? C.pf4! : C.goldD!;
          if (ny < -0.3 && r < 0.9 && bayer(x, y) < 0.18) col = mix(col, C.pf4!, 0.5);
          if (ny > 0.55 && bayer(x, y) < 0.2) col = mix(col, C.pf0!, 0.5);
        }
        a.p(x, y, col);
      }
    }

    // 6. Skeleton chalk
    skeleton(a, L, '#3c2350', 0.5, C.goldL!);

    // 7. Central mirrored drum (static frame; the anim layer re-draws it over back horses)
    paintDrum(a, P.drum, 0);

    // 8. Cotton candy cart & balloon post
    paintCandyCart(a, L.gl - 30, L.gb + 2);
    a.r(L.gr + 30, L.gb - 2, 2, 10, C.goldD!);
    a.disc(L.gr + 31, L.gb + 8, 4, 1.6, C.goldD!);

    // 9. Light-string wires
    for (const s of P.swags as { x0: number; x1: number; y: number; sag: number }[]) {
      for (let x = s.x0; x <= s.x1; x++) {
        const u = (x - s.x0) / (s.x1 - s.x0);
        a.p(x, s.y + Math.sin(u * Math.PI) * s.sag, '#3a2852');
      }
    }

    // 10. Confetti & a dropped ticket
    for (let i = 0; i < 70; i++) {
      const x = hash2(i, 1, 33) * L.W, y = 42 + hash2(i, 2, 33) * (L.H - 46);
      if (Math.hypot((x - plat.x) / (plat.rx + 6), (y - plat.y - 3) / (plat.ry + 10)) < 1) continue;
      const cols = [C.pink!, C.mint!, C.butter!, C.lilac!, C.pinkL!];
      a.p(x, y, cols[i % cols.length]!);
      if (i % 4 === 0) a.p(x + 1, y, cols[(i + 1) % cols.length]!);
    }
    const tx = L.gr + 12, ty = L.gb + 12;
    a.r(tx, ty, 9, 5, C.butterD!);
    a.r(tx + 1, ty + 1, 7, 3, C.butter!);
    a.p(tx + 3, ty + 2, C.pinkD!);
    a.p(tx + 5, ty + 2, C.pinkD!);

    // 11. Bench: 9 teacup-ride seats
    const cups = [
      { d: C.pinkD!, b: C.pink!, l: C.pinkL! },
      { d: C.mintD!, b: C.mint!, l: '#d6f8ee' },
      { d: C.lilacD!, b: C.lilac!, l: '#e5dbfb' },
      { d: C.butterD!, b: C.butter!, l: '#fff0c4' },
      { d: '#4a7fb8', b: '#9cc8f0', l: '#ddefff' },
    ];
    for (const [i, s] of slots(L).entries()) paintTeacup(a, s.x, s.y, Math.min(10, L.bs * 0.43), cups[i % cups.length]!);
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const C = CAR;
    const { plat, ring, wheel, drum } = P;
    const k = P.k as number;

    // 1. Ferris wheel slowly turning
    const wa = sec * 0.18;
    a.ring(wheel.x, wheel.y, wheel.R, wheel.R, '#9a6fc4');
    a.ring(wheel.x, wheel.y, wheel.R - 1, wheel.R - 1, '#6d4f8e');
    a.ring(wheel.x, wheel.y, wheel.R * 0.55, wheel.R * 0.55, '#6d4f8e', 18);
    for (let i = 0; i < 10; i++) {
      const ang = wa + (i * TAU) / 10;
      const ex = wheel.x + Math.cos(ang) * wheel.R, ey = wheel.y + Math.sin(ang) * wheel.R;
      a.line(wheel.x, wheel.y, ex, ey, '#5a4078');
      const on = Math.sin(sec * 3 + i * 1.3) > -0.2;
      a.p(ex, ey, on ? [C.bulbHi!, C.pinkL!, C.mint!][i % 3]! : C.bulbOff!);
      if (i % 2 === 0) {
        const gx = ex, gy = ey + 3;
        a.line(ex, ey, gx, gy - 1, '#6d4f8e');
        const gc = [C.pink!, C.mint!, C.butter!, C.lilac!, C.pinkL!][(i / 2) % 5]!;
        a.r(gx - 2, gy - 1, 5, 4, mix(gc, C.outline!, 0.35));
        a.r(gx - 1, gy - 1, 3, 3, gc);
        a.p(gx, gy, '#fff4d0');
      }
    }
    a.disc(wheel.x, wheel.y, 3, 3, C.goldD!);
    a.disc(wheel.x, wheel.y, 2, 2, C.gold!);

    // 2. Pennant fluttering on the tent pole
    const px = L.gl - 38, py = -8;
    for (let i = 0; i < 9; i++) {
      const wv = Math.sin(sec * 5 - i * 0.6) * (i / 9) * 1.6;
      const hh = Math.round(3.5 * (1 - i / 9));
      a.r(px + 1 + i, py + 1 + wv, 1, Math.max(1, hh), i % 3 === 2 ? C.butter! : C.mint!);
    }

    // 3. Rim & skirt bulbs chasing round the platform
    const step = Math.floor(sec * 7);
    const nb = 36;
    for (let i = 0; i < nb; i++) {
      const ang = (i * TAU) / nb;
      const x = plat.x + Math.cos(ang) * plat.rx * 0.975, y = plat.y + Math.sin(ang) * plat.ry * 0.975;
      const on = (i + step) % 3 === 0;
      a.p(x, y, on ? C.bulbHi! : C.bulbOff!);
      if (on) a.alpha(0.35, () => a.disc(x, y, 1.6, 1.4, C.bulb!));
    }
    for (let dx = -plat.rx + 5; dx <= plat.rx - 5; dx += 7) {
      const ye = plat.y + plat.ry * Math.sqrt(Math.max(0, 1 - (dx / plat.rx) ** 2)) + 4;
      const on = (Math.round(dx / 7) + step) % 2 === 0;
      a.p(plat.x + dx, ye, on ? C.bulbHi! : C.bulbOff!);
    }

    // 4. Horses orbiting — back half, then the drum, then the front half
    const spin = sec * 0.42;
    const hs = Array.from({ length: 8 }, (_, i) => {
      const th = (i * TAU) / 8 + spin;
      return {
        i, th,
        x: plat.x + Math.cos(th) * ring.rx,
        y: plat.y + Math.sin(th) * ring.ry,
        back: Math.sin(th) < 0,
        dir: (Math.sin(th) < 0 ? 1 : -1) as 1 | -1,
      };
    }).sort((p, q) => p.y - q.y);
    const drawHorse = (h: (typeof hs)[number]) => {
      const S0 = HORSES[h.i % HORSES.length]!;
      const S = h.back
        ? { body: mix(S0.body, C.n3!, 0.28), shade: mix(S0.shade, C.n3!, 0.3), mane: mix(S0.mane, C.n3!, 0.25), maneD: S0.maneD, saddle: mix(S0.saddle, C.n3!, 0.25) }
        : S0;
      const bob = Math.sin(sec * 2.4 + h.i * 0.8) * 2.6 * k;
      const pTop = h.y - 30 * k;
      a.r(h.x, pTop, 1, h.y - pTop, h.back ? C.goldD! : C.gold!);
      a.p(h.x, pTop - 1, C.goldHi!);
      a.alpha(0.35, () => a.disc(h.x, h.y + 0.5, 4, 1.3, C.outline!));
      paintCarouselHorse(a, h.x, h.y - 2 - bob, h.dir, S, sec * 6 + h.i);
      a.r(h.x, h.y - 13 - bob, 1, 4, h.back ? C.goldD! : C.goldL!);
    };
    for (const h of hs) if (h.back) drawHorse(h);
    paintDrum(a, drum, sec * 0.42 * 6 / TAU * 3);
    for (const h of hs) if (!h.back) drawHorse(h);

    // 5. Music notes floating up from the crown
    const NOTE = ['..#.', '..##', '..#.', '..#.', '###.', '##..'];
    for (let i = 0; i < 3; i++) {
      const q = wrap(sec * 0.28 + i / 3, 1);
      const nx = drum.x + Math.sin(q * 5 + i * 2) * 10 + (i - 1) * 8;
      const ny = drum.y - drum.h - 26 - q * 26;
      a.alpha(Math.sin(q * Math.PI) * 0.9, () => a.spr(NOTE, { '#': [C.pinkL!, C.butter!, C.mint!][i]! }, nx, ny));
    }

    // 6. Light strings twinkling
    for (const [si, s] of (P.swags as { x0: number; x1: number; y: number; sag: number }[]).entries()) {
      for (let x = s.x0 + 4, n = 0; x < s.x1 - 2; x += 8, n++) {
        const u = (x - s.x0) / (s.x1 - s.x0);
        const y = s.y + Math.sin(u * Math.PI) * s.sag + 2;
        const col = [C.bulb!, C.pinkL!, C.mint!, C.lilac!][(n + si) % 4]!;
        const b = Math.sin(sec * 2.6 + n * 1.1 + si);
        a.r(x, y - 1, 1, 1, '#3a2852');
        a.r(x - 0.5, y, 2, 2, b > -0.3 ? col : mix(col, C.n1!, 0.6));
        if (b > 0.5) a.alpha(0.3, () => a.disc(x + 0.5, y + 1, 2.6, 2.6, col));
      }
    }

    // 7. Balloon bouquet tugging at its post
    const bx = L.gr + 31, by = L.gb - 2;
    const balloons = [
      { dx: -9, dy: -38, col: C.pink!, heart: true },
      { dx: 0, dy: -46, col: C.lilac!, heart: false },
      { dx: 9, dy: -37, col: C.mint!, heart: false },
      { dx: -3, dy: -30, col: C.butter!, heart: false },
      { dx: 6, dy: -27, col: C.pinkL!, heart: true },
    ];
    for (const [i, b] of balloons.entries()) {
      const sx = bx + b.dx + Math.sin(sec * 1.1 + i) * 1.6, sy = by + b.dy + Math.sin(sec * 1.4 + i * 2) * 1.2;
      a.quad(bx, by, bx + b.dx * 0.4, by + b.dy * 0.5, sx, sy + 5, 0.5, 0.5, '#d9c6ea');
      const D = mix(b.col, C.outline!, 0.35);
      if (b.heart) {
        a.disc(sx - 2, sy - 1, 2.8, 2.6, D); a.disc(sx + 2, sy - 1, 2.8, 2.6, D);
        a.disc(sx, sy + 1.5, 3.4, 3, D);
        a.disc(sx - 2, sy - 1, 2, 1.9, b.col); a.disc(sx + 2, sy - 1, 2, 1.9, b.col);
        a.disc(sx, sy + 1.4, 2.6, 2.3, b.col);
        a.p(sx - 2.5, sy - 2, '#ffffff');
      } else {
        a.disc(sx, sy, 4.4, 5.2, D);
        a.disc(sx, sy, 3.6, 4.4, b.col);
        a.r(sx - 2, sy - 3, 1, 2, '#ffffff');
        a.p(sx, sy + 5, D);
      }
    }

    // 8. Fireworks blooming over the fair
    const fper = 4.6;
    for (let f = 0; f < 2; f++) {
      const tt = sec + f * 2.3;
      const cycle = Math.floor(tt / fper);
      const q = (tt % fper) / fper;
      if (q > 0.55) continue;
      const fx = L.gl + 10 + hash2(cycle, f, 7) * (L.gw - 60);
      const fy = 14 + hash2(cycle, f, 8) * 24;
      const col = [C.pinkL!, C.butter!, C.mint!, C.lilac!][(cycle + f) % 4]!;
      const p = q / 0.55;
      const rad = 3 + p * 13;
      a.alpha(1 - p, () => {
        for (let i = 0; i < 14; i++) {
          const ang = (i * TAU) / 14 + cycle;
          const x = fx + Math.cos(ang) * rad, y = fy + Math.sin(ang) * rad * 0.85 + p * p * 4;
          a.p(x, y, col);
          a.p(fx + Math.cos(ang) * rad * 0.7, fy + Math.sin(ang) * rad * 0.6 + p * p * 3, '#fff6e0');
        }
      });
    }

    // 9. Twinkling stars
    for (const [i, s] of (P.stars as { x: number; y: number }[]).entries()) {
      const b = Math.sin(sec * (1.1 + (i % 4) * 0.35) + i * 1.9);
      if (b < 0.8) continue;
      a.alpha((b - 0.8) * 5, () => {
        a.p(s.x, s.y, '#ffffff');
        a.p(s.x - 1, s.y, C.star!); a.p(s.x + 1, s.y, C.star!); a.p(s.x, s.y - 1, C.star!); a.p(s.x, s.y + 1, C.star!);
      });
    }
  },
};

export const ATELIER_SCENES = {
  'embroidery-hoop': embroideryScene,
  'sunset-cloudsea': sunsetScene,
  'carousel-night': carouselScene,
} as const;

export const ATELIER_BACKDROP = {
  'embroidery-hoop': EMB.gin0!,
  'sunset-cloudsea': SUN.c2!,
  'carousel-night': CAR.n1!,
} as const;
