/**
 * Atelier living-canvas skins (same method as 荷塘清夏): the 5×8 grid is an invisible
 * skeleton, one big central painting owns the arena, and themed props spill across the
 * edges so the board boundary is never the picture boundary.
 *
 *  - 绣线花绷 embroidery-hoop    : a giant wooden hoop on blush gingham, satin-stitch peony
 *                                   wreath still being sewn (animated needle), spools, pins,
 *                                   gold scissors, tape measure, 9 button seats.
 *  - 仙境怀表兔 wonderland-rabbit : an enchanted Wonderland glade built around a giant open
 *                                   brass-and-porcelain pocket watch tied with an Alice-blue
 *                                   ribbon; Sir White Rabbit in a crimson heart waistcoat checks
 *                                   his swinging watch while half-painted roses, Cheshire Cat,
 *                                   playing cards, polka-dot mushrooms, teapot & Drink-Me potion
 *                                   spill organically across the edges; 9 tea-party cup seats.
 *  - 星夜木马 carousel-night     : a night-fair carousel platform with a mirrored centre drum,
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

/* ═══════════════════════ 2. 仙境怀表兔 · WONDERLAND RABBIT ═══════════════════════ */

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

export const WON: Pal = {
  // Classic Alice Pinafore Baby-Blue & Milk-White Gingham-Damask Tablecloth
  cl0: '#d4e8f9', cl1: '#e3f1fc', cl2: '#f1f8ff', cl3: '#c1dcf3', cl4: '#add0ee',
  shadow: '#7ea4cc',
  // Midnight Ink-Navy (墨蓝 — grounding Lolita velvet, ribbons, watch hands & outlines)
  nv0: '#132240', nv1: '#1c325e', nv2: '#294882', nv3: '#3c65ab',
  // Classic Alice Blue & Wedgewood / Cornflower Blue (蓝色 · 浅蓝色)
  bl0: '#5386c4', bl1: '#78aee3', bl2: '#a6d0f7', bl3: '#d4ebfc', blHi: '#eef7ff',
  // Crisp Apron Eyelet-Lace & Bone-China White (白色)
  wh0: '#ffffff', wh1: '#f6faff', wh2: '#e5effa', wh3: '#cbddf2',
  // Moonlit Champagne-Silver (subtle antique watch crown, key & porcelain rim)
  svD: '#64779c', sv: '#96a9cc', svL: '#cdd9ed',
  gdD: '#8a754c', gd: '#bfa775', gdL: '#e6d4a8', gdHi: '#fff9e8',
  // Snowy Long-Eared Bunny fur & whisper-soft inner-ear blush
  furO: '#172a4f', fur0: '#ffffff', fur1: '#f2f7fd', fur2: '#d5e4f5',
  earD: '#d48da8', ear: '#f4bdd2', earHi: '#fde6ef',
  // Crystal "DRINK ME" sapphire-sky potion
  potD: '#2a6fb0', pot: '#6bc0f5', potHi: '#dcf4ff',
};

const SUIT_HEART = [
  '.hh...hh.',
  'hHHh.hhhh',
  'hHHhhhhhh',
  'hhhhhhhhd',
  '.hhhhhhd.',
  '..hhhhd..',
  '...hhd...',
  '....d....',
];
const SUIT_SPADE = [
  '....s....',
  '...sss...',
  '..sSSss..',
  '.sSSssss.',
  'ssssssssd',
  '.ss.s.sd.',
  '....s....',
  '...sds...',
];
const SUIT_CLUB = [
  '...ccc...',
  '..cCCcc..',
  '...ccc...',
  '.cc.c.cc.',
  'cCCcccccd',
  '.cc.c.cd.',
  '....c....',
  '...cdc...',
];
const SUIT_DIAMOND = [
  '...d...',
  '..dDd..',
  '.dDDdd.',
  'dDDdddd',
  '.ddddd.',
  '..ddd..',
  '...d...',
];
const SUIT_CROWN = [
  '.g...g...g.',
  'gGg.gGg.gGg',
  'ggggggggggg',
  '.ggghbhggg.',
  '.dddddddddd',
];

/** Lush Midnight Ink-Navy & Sapphire Botanical Rose-Leaf Hedge in upper corners (with pointed leaves!). */
function paintNavyFoliageMound(
  a: Art,
  lobes: readonly { x: number; y: number; R: number }[],
  side: 'L' | 'R',
) {
  const C = WON;
  const dir = side === 'L' ? 1 : -1;
  a.alpha(0.35, () => {
    for (const l of lobes) a.disc(l.x + 1.5, l.y + 2.8, l.R + 1, l.R * 0.82 + 1, C.shadow!);
  });
  // Pointed storybook rose leaves & trailing ivy sprigs jutting organically out from the hedge!
  for (const [i, l] of lobes.entries()) {
    for (let p = 0; p < 3; p++) {
      const baseAng = side === 'L' ? 0.15 + p * 0.52 + (i % 2) * 0.18 : Math.PI - (0.15 + p * 0.52 + (i % 2) * 0.18);
      const lx = l.x + Math.cos(baseAng) * (l.R * 0.62);
      const ly = l.y + Math.sin(baseAng) * (l.R * 0.54);
      a.petal(lx, ly, baseAng, l.R * 0.72, l.R * 0.34, C.nv0!, C.nv1!, C.nv3!, 0.52);
    }
  }
  for (const l of lobes) a.disc(l.x, l.y, l.R, l.R * 0.8, C.nv0!);
  for (const l of lobes) a.disc(l.x - dir * 1.2, l.y - 1.2, l.R * 0.88, l.R * 0.7, C.nv1!);
  for (const l of lobes) a.disc(l.x - dir * 2.2, l.y - 2.4, l.R * 0.64, l.R * 0.5, C.nv2!);
  // Delicate sapphire leaf-vein highlights & tiny baby-blue forget-me-not buds
  for (const [i, l] of lobes.entries()) {
    const vx = l.x + dir * (l.R * 0.25), vy = l.y + l.R * 0.18;
    a.line(vx - dir * 4, vy - 2, vx + dir * 3, vy + 2, C.nv3!);
    if (i % 2 === 1) {
      const bx = l.x + dir * (l.R * 0.48), by = l.y + l.R * 0.36;
      a.p(bx, by - 1, C.bl2!); a.p(bx - 1, by, C.bl2!); a.p(bx + 1, by, C.bl2!); a.p(bx, by + 1, C.bl2!);
      a.p(bx, by, C.wh0!);
    }
  }
}

/** Cupped Classic Alice Briar Rose in Pure Lace-White, Baby-Blue, or Midnight Ink-Navy (crisp spiral petals!). */
function paintAliceRose(a: Art, cx: number, cy: number, R: number, tone: 'white' | 'sky' | 'navy', seed = 0) {
  const C = WON;
  const P = tone === 'white'
    ? { edge: C.nv2!, deep: C.bl0!, mid: '#cde3f8', lit: '#f2f8ff', rim: '#ffffff', core: C.bl1! }
    : tone === 'sky'
      ? { edge: C.nv1!, deep: C.nv3!, mid: C.bl0!, lit: C.bl2!, rim: C.wh0!, core: C.nv2! }
      : { edge: C.nv0!, deep: C.nv1!, mid: C.nv2!, lit: C.bl0!, rim: C.bl2!, core: C.wh0! };
  a.alpha(0.35, () => a.disc(cx + 1.4, cy + 2, R + 1, R * 0.88 + 1, C.nv0!));
  // 4 pointed sapphire-navy rose leaves tucked behind
  for (let i = 0; i < 4; i++) {
    const ang = seed + 0.4 + (i * TAU) / 4;
    a.petal(cx, cy, ang, R * 1.28, R * 0.38, C.nv0!, C.nv2!, C.bl0!, 0.52);
  }
  // Outer 5 cupped petals with crisp dark-blue/cornflower petal crevices
  for (let k = 0; k < 5; k++) {
    const ang = seed + (k / 5) * TAU;
    const px = cx + Math.cos(ang) * R * 0.44, py = cy + Math.sin(ang) * R * 0.4;
    a.disc(px, py, R * 0.62, R * 0.56, P.edge);
  }
  for (let k = 0; k < 5; k++) {
    const ang = seed + (k / 5) * TAU;
    const px = cx + Math.cos(ang) * R * 0.42, py = cy + Math.sin(ang) * R * 0.38;
    a.disc(px, py, R * 0.52, R * 0.46, P.mid);
    a.disc(px - 0.4, py - 0.5, R * 0.38, R * 0.33, P.lit);
    a.arc(px, py, R * 0.48, R * 0.42, ang - 0.9, ang + 0.9, P.rim);
  }
  // Deep cupped inner rose bowl
  a.disc(cx, cy - 0.2, R * 0.52, R * 0.46, P.deep);
  // Inner 4 spiral petals
  for (let k = 0; k < 4; k++) {
    const ang = seed + 0.55 + (k / 4) * TAU;
    const px = cx + Math.cos(ang) * R * 0.24, py = cy - 0.3 + Math.sin(ang) * R * 0.21;
    a.disc(px, py, R * 0.31, R * 0.27, P.lit);
    a.arc(px, py, R * 0.29, R * 0.25, ang - 1.15, ang + 0.95, P.rim);
  }
  // Crisp spiral rosebud heart
  a.disc(cx, cy - 0.5, R * 0.2, R * 0.18, P.core);
  a.arc(cx, cy - 0.5, R * 0.17, R * 0.15, -0.5, Math.PI * 1.15, P.rim);
}

/** Scalloped Ruffled White Eyelet-Lace Tea Doily (for vignettes & under the Long-Eared Bunny). */
function paintEyeletDoily(a: Art, cx: number, cy: number, rx: number, ry: number, navyCenter = false) {
  const C = WON;
  a.alpha(0.32, () => a.disc(cx + 1.5, cy + 2.2, rx + 2, ry + 2, C.shadow!));
  const N = 16;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * TAU;
    const lx = cx + Math.cos(ang) * rx * 0.9, ly = cy + Math.sin(ang) * ry * 0.9;
    a.disc(lx, ly, rx * 0.24, ry * 0.26, C.bl1!);
    a.disc(lx, ly - 0.3, rx * 0.2, ry * 0.22, C.wh0!);
    a.p(lx, ly, C.nv2!);
  }
  a.disc(cx, cy, rx * 0.88, ry * 0.88, C.wh2!);
  a.disc(cx, cy - 0.4, rx * 0.82, ry * 0.82, C.wh0!);
  if (navyCenter) {
    // Rich Midnight Ink-Navy velvet cushion center so snowy white bunny pops 100%!
    a.disc(cx, cy - 0.4, rx * 0.68, ry * 0.68, C.nv0!);
    a.disc(cx, cy - 0.6, rx * 0.62, ry * 0.62, C.nv1!);
    a.ring(cx, cy - 0.6, rx * 0.54, ry * 0.54, C.bl1!, 14);
  } else {
    a.ring(cx, cy - 0.4, rx * 0.64, ry * 0.64, C.bl2!, 14);
  }
}

/** 12 o'clock pocket-watch silver-champagne bow ring + Double-Layered Ink-Navy & Baby-Blue Coquette Bow! */
function paintAliceWatchBow(a: Art, cx: number, topY: number, k: number) {
  const C = WON;
  // Moonlit silver-champagne pocket-watch bow ring & crown
  const ry0 = topY - 12 * k;
  a.alpha(0.3, () => a.arc(cx + 1.5, ry0 + 2, 9.5 * k, 6.8 * k, 0, TAU, C.shadow!, 2.8 * k));
  a.arc(cx, ry0, 9.5 * k, 6.8 * k, 0, TAU, C.nv1!, 3.2 * k);
  a.arc(cx, ry0, 9.5 * k, 6.8 * k, 0, TAU, C.gdL!, 1.9 * k);
  a.arc(cx, ry0, 9.5 * k, 6.8 * k, Math.PI * 1.05, Math.PI * 1.75, C.wh0!, 1);
  const cyCrown = topY - 6 * k;
  a.disc(cx, cyCrown, 6.4 * k, 3.0 * k, C.nv1!);
  a.disc(cx, cyCrown, 5.4 * k, 2.2 * k, C.gdL!);
  a.r(cx - 2.5 * k, cyCrown - 1.8 * k, 4 * k, 1, C.wh0!);

  const by = topY - 1 * k;
  // 1. Streaming Midnight Ink-Navy satin ribbon tails draping left & right!
  for (const s of [-1, 1] as const) {
    a.alpha(0.3, () => a.quad(cx, by + 2, cx + s * 19 * k, by + 4 * k, cx + s * 36 * k, by + 14 * k, 4.2 * k, 3.0 * k, C.shadow!));
    a.quad(cx, by, cx + s * 19 * k, by + 2.2 * k, cx + s * 36 * k, by + 12 * k, 4.2 * k, 3.0 * k, C.nv0!);
    a.quad(cx, by, cx + s * 19 * k, by + 1.8 * k, cx + s * 35.5 * k, by + 11.5 * k, 3.2 * k, 2.1 * k, C.nv1!);
    a.quad(cx, by - 0.6, cx + s * 18 * k, by + 1.0 * k, cx + s * 33 * k, by + 10 * k, 1.3 * k, 0.8 * k, C.nv3!);
    // Crisp white lace trim along ribbon tail
    a.quad(cx, by - 1.5, cx + s * 18 * k, by + 0.1 * k, cx + s * 34 * k, by + 9.2 * k, 0.7, 0.6, C.wh0!);
  }
  // 2. Outer Midnight Ink-Navy velvet bow loops (wider under-layer)
  for (const s of [-1, 1] as const) {
    const lx = cx + s * 12.2 * k, ly = by - 1.2 * k;
    a.disc(lx, ly, 11.8 * k, 6.2 * k, C.nv0!);
    a.disc(lx, ly, 10.8 * k, 5.2 * k, C.nv1!);
    a.arc(lx, ly, 10.6 * k, 5.0 * k, -Math.PI * 0.85, Math.PI * 0.85, C.wh0!);
  }
  // 3. Inner Puffed Alice Baby-Blue satin bow loops + white picot sheen!
  for (const s of [-1, 1] as const) {
    const lx = cx + s * 10.2 * k, ly = by - 1.6 * k;
    a.disc(lx, ly, 9.2 * k, 4.6 * k, C.nv2!);
    a.disc(lx, ly, 8.2 * k, 3.8 * k, C.bl1!);
    a.disc(lx - s * 1.2 * k, ly - 1.0 * k, 5.5 * k, 2.2 * k, C.bl2!);
    a.r(lx - 2 * k, ly - 2.1 * k, 4 * k, 1, C.wh0!);
    a.line(cx + s * 3 * k, by - 1.2, cx + s * 6.8 * k, by - 2 * k, C.nv2!);
  }
  // Central satin knot + sapphire pearl brooch
  a.disc(cx, by - 1.2, 4.6 * k, 4.0 * k, C.nv0!);
  a.disc(cx, by - 1.4, 3.6 * k, 3.1 * k, C.bl2!);
  a.disc(cx, by - 1.4, 1.8 * k, 1.6 * k, C.nv1!);
  a.p(cx - 0.6, by - 2.0, C.wh0!);
}

/**
 * Hero Classic-Alice Long-Eared Bunny (长耳兔, ~62 art-px tall on desktop!):
 * Ultra-long silky bunny ears (one graceful plumed S-arch high ear + one 27px ribbon-tied lop ear
 * cascading over a dark Midnight Ink-Navy velvet capelet for 100% crisp silhouette contrast!),
 * Alice-Blue pleated skirt + crisp white ruffled pinafore apron, big sparkling Sapphire-Ink eyes,
 * and a swinging silver-champagne pocket watch!
 */
function paintAliceLongEarRabbit(a: Art, cx: number, by: number, s: number, sec: number) {
  const C = WON;
  const bob = Math.sin(sec * 2.2) * 0.65 * s;
  const earSway = Math.sin(sec * 2.1) * 1.4 * s;
  const lopSway = Math.cos(sec * 1.9) * 1.3 * s;
  const swing = Math.sin(sec * 3.0) * 2.1 * s;
  const blink = (sec % 4.8) > 4.64;
  const X = (d: number) => cx + d * s;
  const Y = (d: number) => by + d * s - bob;

  // Midnight Ink-Navy velvet & white eyelet-lace cushion under the bunny
  if (s >= 0.95) {
    paintEyeletDoily(a, cx - 1.2 * s, by - 0.8 * s, 17.2 * s, 6.4 * s, true);
  } else {
    a.alpha(0.38, () => a.disc(cx + 1, by + 1, 12.5 * s, 4.2 * s, C.nv1!));
  }

  // 1. ULTRA-LONG Plumed Back Ear (graceful high S-arch sweeping up 25px with rounded teardrop tip!)
  const bex0 = X(2.2), bey0 = Y(-26.2);
  const bex1 = X(3.0 + earSway * 0.35), bey1 = Y(-38.0);
  const bex2 = X(-4.2 + earSway), bey2 = Y(-46.2);
  a.quad(bex0, bey0, bex1, bey1, bex2, bey2, 3.8 * s, 3.4 * s, C.furO!);
  a.disc(bex2, bey2, 3.4 * s, 3.0 * s, C.furO!);
  a.quad(bex0, bey0, bex1, bey1, bex2, bey2, 2.8 * s, 2.5 * s, C.fur0!);
  a.disc(bex2, bey2, 2.5 * s, 2.1 * s, C.fur0!);
  a.quad(X(2.4), Y(-27.5), X(3.0 + earSway * 0.3), Y(-36.8), X(-2.8 + earSway * 0.8), Y(-43.8), 1.4 * s, 1.1 * s, C.ear!);

  // 2. Fluffy snowy snowball tail peeking out behind coat on left
  a.disc(X(-10.4), Y(-7.6), 4.6 * s, 4.2 * s, C.furO!);
  a.disc(X(-10.4), Y(-7.8), 3.7 * s, 3.3 * s, C.fur2!);
  a.disc(X(-10.9), Y(-8.5), 2.6 * s, 2.3 * s, C.fur0!);

  // 3. Snowy rabbit hind paws
  for (const [fx, fy, rx] of [[-3.8, -1.6, 4.8], [4.8, -1.5, 5.2]] as const) {
    a.disc(X(fx), by + fy * s, rx * s, 2.5 * s, C.furO!);
    a.disc(X(fx), by + (fy - 0.2) * s, (rx - 0.9) * s, 1.7 * s, C.fur0!);
    a.p(X(fx + rx * 0.5), by + fy * s, C.fur2!);
  }

  // 4. Classic-Alice Pleated Blue Dress-Skirt + Deep Midnight Ink-Navy Velvet Capelet + White Apron!
  // Flared Alice-Blue lower skirt + crisp white lace petticoat hem
  a.disc(X(0.2), Y(-6.8), 10.2 * s, 4.8 * s, C.furO!);
  a.disc(X(0.2), Y(-6.6), 9.3 * s, 3.9 * s, C.wh0!);
  a.disc(X(0.2), Y(-7.8), 9.0 * s, 4.2 * s, C.bl0!);
  a.disc(X(0.4), Y(-8.2), 8.2 * s, 3.6 * s, C.bl1!);
  // Rich dark Midnight Ink-Navy velvet shoulder-capelet & coat (gives 100% contrast behind white lop ear!)
  a.disc(X(-0.4), Y(-12.2), 9.2 * s, 7.6 * s, C.furO!);
  a.disc(X(-0.8), Y(-12.2), 8.3 * s, 6.8 * s, C.nv0!);
  a.disc(X(-0.2), Y(-12.6), 7.2 * s, 5.8 * s, C.nv1!);
  // Crisp Snowy-White Ruffled Pinafore Apron on chest/front
  a.disc(X(3.5), Y(-10.8), 5.0 * s, 6.6 * s, C.wh0!);
  a.disc(X(3.3), Y(-7.8), 4.2 * s, 3.4 * s, C.fur1!);
  a.line(X(0.2), Y(-16.2), X(-0.8), Y(-5.2), C.bl2!);
  for (const byOff of [-13.4, -10.4, -7.4]) {
    a.r(X(1.3), Y(byOff), Math.max(1, 1.5 * s), Math.max(1, 1.5 * s), C.nv1!);
    a.p(X(1.3), Y(byOff), C.gdHi!);
  }

  // 5. Sweet Doll-Like Snowy Bunny Head & Plump Cheeks (3/4 view facing right)
  a.disc(X(0.8), Y(-22.8), 8.9 * s, 7.5 * s, C.furO!);
  a.disc(X(5.2), Y(-21.2), 5.5 * s, 4.6 * s, C.furO!);
  a.disc(X(0.8), Y(-22.8), 7.9 * s, 6.5 * s, C.fur0!);
  a.disc(X(5.2), Y(-21.2), 4.6 * s, 3.7 * s, C.fur0!);
  a.arc(X(1.2), Y(-22.4), 7.2 * s, 5.6 * s, Math.PI * 0.36, Math.PI * 0.88, C.fur2!);
  // Soft pastel sakura cheek blush
  a.disc(X(2.9), Y(-20.2), 2.5 * s, 1.5 * s, C.ear!);
  // Big luminous Midnight-Sapphire / Ink-Blue Eye + Eyelash + Dual Catchlights!
  if (blink) {
    a.line(X(2.8), Y(-23.4), X(5.8), Y(-23.4), C.nv0!);
  } else {
    a.line(X(2.4), Y(-25.4), X(5.8), Y(-24.8), C.nv0!);
    a.disc(X(4.3), Y(-23.6), 2.2 * s, 2.7 * s, C.nv0!);
    a.disc(X(4.5), Y(-23.0), 1.4 * s, 1.6 * s, C.bl0!);
    a.r(X(3.5), Y(-24.8), Math.max(1, 1.3 * s), Math.max(1, 1.3 * s), C.wh0!);
    a.p(X(4.8), Y(-22.4), C.bl3!);
  }
  // Dainty soft-pink bunny nose
  a.disc(X(8.9), Y(-21.9), 1.3 * s, 1.0 * s, C.earD!);
  a.p(X(8.7), Y(-22.2), C.wh0!);

  // 6. Ruffled White Eyelet-Lace Collar & Baby-Blue Satin Bow at throat!
  a.disc(X(2.2), Y(-17.0), 6.2 * s, 2.4 * s, C.fur2!);
  a.disc(X(2.2), Y(-17.2), 5.6 * s, 2.0 * s, C.wh0!);
  for (const dir of [-1, 1] as const) {
    a.disc(X(3.5 + dir * 3.1), Y(-16.6), 3.0 * s, 2.0 * s, C.nv0!);
    a.disc(X(3.5 + dir * 3.1), Y(-16.8), 2.2 * s, 1.4 * s, C.bl2!);
  }
  a.disc(X(3.5), Y(-16.7), 1.6 * s, 1.5 * s, C.nv2!);
  a.p(X(3.3), Y(-17.1), C.wh0!);

  // 7. SIGNATURE 27px ULTRA-LONG SILKY LOP EAR (cascading over the dark Ink-Navy capelet + Alice Bow!)
  const ex0 = X(-1.6), ey0 = Y(-26.8);
  const ex1 = X(-9.0 + lopSway * 0.5), ey1 = Y(-19.2);
  const ex2 = X(-6.4 + lopSway), ey2 = Y(-6.8);
  a.quad(ex0, ey0, ex1, ey1, ex2, ey2, 3.7 * s, 4.6 * s, C.furO!);
  a.disc(ex2, ey2, 4.5 * s, 4.0 * s, C.furO!);
  a.quad(ex0, ey0, ex1, ey1, ex2, ey2, 2.7 * s, 3.5 * s, C.fur0!);
  a.disc(ex2, ey2, 3.5 * s, 3.0 * s, C.fur0!);
  // Soft inner-ear blush & powder-blue silk shading inside the long lop ear
  a.quad(X(-2.2), Y(-25.0), X(-7.8 + lopSway * 0.5), Y(-18.8), X(-6.0 + lopSway), Y(-8.2), 1.2 * s, 1.8 * s, C.fur2!);
  a.quad(X(-2.0), Y(-25.2), X(-6.8 + lopSway * 0.4), Y(-20.2), X(-6.2 + lopSway * 0.6), Y(-14.0), 0.9 * s, 1.1 * s, C.ear!);
  // Crisp Midnight Ink-Navy & Alice Baby-Blue Coquette Ribbon Bow tied onto the lop ear!
  const bx = X(-2.8), byEar = Y(-26.6);
  for (const dir of [-1, 1] as const) {
    a.disc(bx + dir * 2.9 * s, byEar, 2.8 * s, 1.9 * s, C.nv0!);
    a.disc(bx + dir * 2.9 * s, byEar - 0.2 * s, 2.0 * s, 1.2 * s, C.bl2!);
  }
  a.disc(bx, byEar, 1.6 * s, 1.4 * s, C.wh0!);
  a.p(bx, byEar, C.bl0!);

  // 8. Extended snowy paw holding the swinging Silver-Sapphire Pocket Watch!
  const px = X(11.2), py = Y(-14.6);
  a.stroke(X(5.5), Y(-13.8), px, py, 2.8 * s, 2.3 * s, C.furO!);
  a.stroke(X(5.5), Y(-13.8), px, py, 1.9 * s, 1.6 * s, C.fur0!);
  const wx = px + swing + 1.6 * s, wy = py + 6.4 * s;
  a.line(px + 1 * s, py, wx, wy - 3.8 * s, C.nv1!);
  a.line(px + 0.5 * s, py, wx - 0.4 * s, wy - 3.8 * s, C.gdHi!);
  a.disc(wx, wy, 4.7 * s, 4.7 * s, C.nv0!);
  a.disc(wx, wy, 3.8 * s, 3.8 * s, C.gdL!);
  a.disc(wx, wy, 2.7 * s, 2.7 * s, C.wh0!);
  a.line(wx, wy, wx + Math.cos(sec * 2) * 1.9 * s, wy + Math.sin(sec * 2) * 1.9 * s, C.nv1!);
  a.p(wx - 1.5 * s, wy - 1.9 * s, C.wh0!);
}

/** Cute Baby Lop-Eared Bunny peeking out of a Blue-and-White Bone-China Teacup in the top-right corner! */
function paintTeacupLopBunny(a: Art, cx: number, cy: number, k: number, sec: number) {
  const C = WON;
  const peek = Math.sin(sec * 2.0) * 0.8 * k;
  const earWig = Math.sin(sec * 2.8) * 1.1 * k;
  const by = cy - 1.4 * k - peek;

  // Saucer shadow + Blue-and-White saucer
  a.alpha(0.35, () => a.disc(cx + 1.2, cy + 7.5 * k, 12 * k, 4.0 * k, C.nv0!));
  a.disc(cx, cy + 7 * k, 11.4 * k, 3.6 * k, C.nv1!);
  a.disc(cx, cy + 6.6 * k, 10.4 * k, 2.9 * k, C.wh0!);
  a.ring(cx, cy + 6.6 * k, 7.8 * k, 2.1 * k, C.bl1!);

  // Back of teacup rim
  a.disc(cx, cy + 1.5 * k, 8.8 * k, 2.6 * k, C.nv1!);
  a.disc(cx, cy + 1.5 * k, 7.8 * k, 2.0 * k, C.bl3!);

  // Peeking Baby Lop Bunny head + TWO long drooping snowy lop ears draping down over the cup sides!
  for (const dir of [-1, 1] as const) {
    const ex2 = cx + dir * (11.2 * k + earWig * dir), ey2 = by + 7.2 * k;
    a.quad(cx + dir * 3.8 * k, by - 4.8 * k, cx + dir * (10.2 * k + earWig * dir), by - 1.2 * k, ex2, ey2, 2.8 * k, 3.4 * k, C.furO!);
    a.disc(ex2, ey2, 3.2 * k, 2.8 * k, C.furO!);
    a.quad(cx + dir * 3.8 * k, by - 4.8 * k, cx + dir * (9.9 * k + earWig * dir), by - 1.2 * k, ex2, ey2, 1.9 * k, 2.4 * k, C.fur0!);
    a.disc(ex2, ey2, 2.3 * k, 2.0 * k, C.fur0!);
    a.quad(cx + dir * 4.2 * k, by - 4.0 * k, cx + dir * (9.0 * k + earWig * dir), by - 0.8 * k, cx + dir * (10.0 * k + earWig * dir), by + 5.2 * k, 0.9 * k, 1.1 * k, C.ear!);
  }
  a.disc(cx, by - 1.8 * k, 6.8 * k, 5.5 * k, C.furO!);
  a.disc(cx, by - 1.8 * k, 5.8 * k, 4.6 * k, C.fur0!);
  // Baby bunny ink-navy eyes & blush
  for (const dir of [-1, 1] as const) {
    a.disc(cx + dir * 2.4 * k, by - 2.3 * k, 1.3 * k, 1.6 * k, C.nv0!);
    a.p(cx + dir * 2.4 * k - 0.4, by - 3.0 * k, C.wh0!);
    a.disc(cx + dir * 3.8 * k, by - 0.8 * k, 1.3 * k, 0.9 * k, C.ear!);
  }
  a.p(cx, by - 1.2 * k, C.earD!);

  // Front Wedgewood Blue-and-White teacup bowl + handle + tiny snow paws gripping the rim!
  a.arc(cx + 8.4 * k, cy + 3.8 * k, 2.7 * k, 2.7 * k, -Math.PI / 2, Math.PI / 2, C.nv1!, 2.2 * k);
  a.arc(cx + 8.4 * k, cy + 3.8 * k, 2.7 * k, 2.7 * k, -Math.PI / 2, Math.PI / 2, C.wh0!, 1.1 * k);
  for (let dy = 0; dy <= Math.ceil(5.6 * k); dy++) {
    const t = dy / (5.6 * k);
    const hw = (8.5 - t * 2.2) * k;
    for (let dx = -Math.floor(hw); dx <= Math.floor(hw); dx++) {
      const edge = Math.abs(dx) >= Math.floor(hw) || dy === Math.ceil(5.6 * k);
      const rim = dy <= 1;
      const floral = !edge && !rim && Math.abs(dy - 2.8 * k) < 1.1 * k && Math.abs(dx) % 3 < 2;
      const col = edge ? C.nv1! : rim ? C.bl2! : floral ? C.bl0! : dx > hw * 0.45 ? C.wh2! : C.wh0!;
      a.p(cx + dx, cy + 1.6 * k + dy, col);
    }
  }
  for (const dir of [-1, 1] as const) {
    a.disc(cx + dir * 3.6 * k, cy + 1.6 * k, 2.1 * sClamp(k), 1.5 * sClamp(k), C.furO!);
    a.disc(cx + dir * 3.6 * k, cy + 1.4 * k, 1.4 * sClamp(k), 1.0 * sClamp(k), C.fur0!);
  }
}

function sClamp(k: number) {
  return Math.max(0.75, k);
}

/** Oversized tilted Classic Ink-Navy & Wedgewood-Blue Playing Cards (A♠ & Q♦)! */
function paintAliceCardPair(a: Art, cx: number, cy: number, k = 1) {
  const C = WON;
  const drawCard = (ox: number, oy: number, tilt: number, diamond: boolean) => {
    const hw = 7.4 * k, hh = 10.4 * k;
    const cs = Math.cos(tilt), sn = Math.sin(tilt);
    a.alpha(0.32, () => {
      for (let v = -hh; v <= hh; v += 0.8) {
        for (let u = -hw; u <= hw; u += 0.8) {
          a.p(ox + u * cs - v * sn + 2, oy + u * sn + v * cs * 0.88 + 2.5, C.shadow!);
        }
      }
    });
    for (let v = -hh; v <= hh; v += 0.55) {
      for (let u = -hw; u <= hw; u += 0.55) {
        const edge = Math.abs(u) > hw - 0.9 || Math.abs(v) > hh - 0.9;
        const innerRim = !edge && (Math.abs(u) > hw - 2.1 && Math.abs(v) > hh - 2.1);
        const col = edge ? C.nv1! : innerRim ? C.bl2! : (u + v > 3 ? C.wh2! : C.wh0!);
        a.p(ox + u * cs - v * sn, oy + u * sn + v * cs * 0.88, col);
      }
    }
    const suitCol = diamond ? C.bl0! : C.nv0!;
    for (const s of [-1, 1] as const) {
      const pu = s * (hw - 2.6 * k), pv = s * (hh - 2.8 * k);
      a.r(ox + pu * cs - pv * sn - 0.5, oy + pu * sn + pv * cs * 0.88 - 0.5, 2, 2, suitCol);
    }
    if (diamond) {
      a.sprC(SUIT_DIAMOND, { d: C.bl0!, D: C.bl3! }, ox, oy);
    } else {
      a.sprC(SUIT_SPADE, { s: C.nv1!, S: C.nv3!, d: C.nv0! }, ox, oy);
    }
  };
  drawCard(cx - 5.2 * k, cy - 2 * k, -0.24, false);
  drawCard(cx + 5.2 * k, cy + 2 * k, 0.2, true);
}

/** 2-Tier Silver & Blue-Porcelain Afternoon-Tea Pastry Stand (macarons, cream puffs & blueberries)! */
function paintAliceTeaStand(a: Art, cx: number, by: number, k = 1) {
  const C = WON;
  a.alpha(0.32, () => a.disc(cx + 1.5, by + 2, 14 * k, 4.2 * k, C.shadow!));
  // Pedestal foot
  a.disc(cx, by + 1 * k, 6.2 * k, 2.2 * k, C.nv1!);
  a.disc(cx, by + 0.6 * k, 5.2 * k, 1.6 * k, C.svL!);
  // Lower porcelain tier plate + scalloped blue rim
  const y1 = by - 3.5 * k;
  a.disc(cx, y1 + 0.8 * k, 13.8 * k, 4.8 * k, C.nv1!);
  a.disc(cx, y1, 12.8 * k, 4.1 * k, C.wh0!);
  a.ring(cx, y1, 10.6 * k, 3.2 * k, C.bl1!);
  // Dainty Alice-blue macarons & white cream puffs on lower tier!
  for (const [dx, dy, c0, c1] of [
    [-7.5, -0.8, C.nv2!, C.bl2!],
    [-2.5, 0.8, C.bl0!, C.wh0!],
    [3.2, 0.6, C.nv1!, C.bl1!],
    [7.8, -0.6, C.bl0!, C.wh0!],
  ] as const) {
    a.disc(cx + dx * k, y1 + dy * k, 3.0 * k, 2.0 * k, c0);
    a.disc(cx + dx * k, y1 + (dy - 0.6) * k, 2.4 * k, 1.4 * k, c1);
    a.p(cx + dx * k - 0.5, y1 + (dy - 1.1) * k, C.wh0!);
  }
  // Central silver spindle
  a.r(cx - 1.2 * k, y1 - 10.5 * k, 2.4 * k, 9.5 * k, C.nv1!);
  a.r(cx - 0.5 * k, y1 - 10.5 * k, 1.2 * k, 9.5 * k, C.wh0!);
  // Upper porcelain tier plate
  const y2 = y1 - 10.5 * k;
  a.disc(cx, y2 + 0.7 * k, 10.2 * k, 3.6 * k, C.nv1!);
  a.disc(cx, y2, 9.3 * k, 3.0 * k, C.wh0!);
  a.ring(cx, y2, 7.4 * k, 2.2 * k, C.bl1!);
  // Frosted blueberry cream tartlet on top tier
  a.disc(cx - 3.2 * k, y2 - 1.2 * k, 2.8 * k, 2.0 * k, C.bl1!);
  a.disc(cx - 3.2 * k, y2 - 2.0 * k, 2.0 * k, 1.3 * k, C.wh0!);
  a.disc(cx + 3.0 * k, y2 - 1.2 * k, 2.8 * k, 2.0 * k, C.nv2!);
  a.disc(cx + 3.0 * k, y2 - 2.0 * k, 2.0 * k, 1.3 * k, C.bl3!);
  // Silver ring handle at top + tiny navy bow
  a.arc(cx, y2 - 7.2 * k, 2.8 * k, 2.6 * k, 0, TAU, C.nv1!, 1.8 * k);
  a.arc(cx, y2 - 7.2 * k, 2.8 * k, 2.6 * k, 0, TAU, C.gdL!, 1.0 * k);
  a.r(cx - 0.6 * k, y2 - 4.8 * k, 1.4 * k, 3.2 * k, C.nv1!);
}

/** Wedgewood Blue-and-White Bone-China Teapot + Jauntily Stacked Tilted Teacups! */
function paintBlueWhiteTeaStack(a: Art, cx: number, by: number, k = 1) {
  const C = WON;
  a.alpha(0.32, () => a.disc(cx + 1.5, by + 2, 14 * k, 4.2 * k, C.shadow!));
  // Lace-edged bone-china saucer
  a.disc(cx, by, 13 * k, 4.2 * k, C.nv1!);
  a.disc(cx, by - 0.5, 12 * k, 3.5 * k, C.wh0!);
  a.ring(cx, by - 0.5, 9.5 * k, 2.6 * k, C.bl1!);

  // Plump White Bone-China Teapot with Wedgewood-Blue floral band & Ink-Navy trim!
  const py = by - 7.5 * k;
  a.quad(cx - 8 * k, py + 1 * k, cx - 14 * k, py - 2 * k, cx - 15 * k, py - 8 * k, 2.5 * k, 1.5 * k, C.nv1!);
  a.quad(cx - 8 * k, py + 0.8 * k, cx - 13.6 * k, py - 2 * k, cx - 14.6 * k, py - 7.8 * k, 1.6 * k, 0.9 * k, C.wh0!);
  a.arc(cx + 9 * k, py - 0.5 * k, 4.2 * k, 5.2 * k, -Math.PI * 0.55, Math.PI * 0.55, C.nv1!, 2.4 * k);
  a.arc(cx + 9 * k, py - 0.5 * k, 4.2 * k, 5.2 * k, -Math.PI * 0.55, Math.PI * 0.55, C.bl2!, 1.3 * k);

  a.disc(cx, py, 10.6 * k, 7.6 * k, C.nv1!);
  a.disc(cx, py, 9.6 * k, 6.7 * k, C.wh0!);
  a.disc(cx + 1.5 * k, py + 1.2 * k, 7.8 * k, 4.8 * k, C.wh2!);
  a.disc(cx - 2.0 * k, py - 1.2 * k, 6.4 * k, 4.4 * k, C.wh0!);
  // Blue-and-white cameo & floral shoulder band on teapot belly
  a.r(cx - 8 * k, py - 4.8 * k, 16 * k, 1.4 * k, C.bl1!);
  a.disc(cx + 0.5 * k, py + 0.5 * k, 4.4 * k, 3.3 * k, C.bl1!);
  a.disc(cx + 0.5 * k, py + 0.5 * k, 3.4 * k, 2.4 * k, C.wh0!);
  a.r(cx - 0.5 * k, py - 0.4 * k, 2, 2, C.nv1!);

  // Two tilted Alice-Blue & Ink-Navy teacups balanced atop the teapot!
  const cup1Y = py - 9.8 * k;
  a.disc(cx + 1 * k, cup1Y + 2 * k, 7.2 * k, 2.0 * k, C.nv1!);
  a.disc(cx + 1 * k, cup1Y, 6.2 * k, 3.8 * k, C.nv1!);
  a.disc(cx + 1 * k, cup1Y - 0.3 * k, 5.3 * k, 3.1 * k, C.bl1!);
  a.disc(cx - 0.8 * k, cup1Y - 1 * k, 2.5 * k, 1.5 * k, C.bl3!);
  a.disc(cx + 1 * k, cup1Y - 2.6 * k, 5.4 * k, 1.6 * k, C.wh0!);
  a.arc(cx + 6.5 * k, cup1Y - 0.4 * k, 2 * k, 2 * k, -1.4, 1.4, C.wh0!, 1.6);

  const cup2Y = cup1Y - 6.6 * k;
  a.disc(cx - 1.5 * k, cup2Y, 5.2 * k, 3.3 * k, C.nv0!);
  a.disc(cx - 1.5 * k, cup2Y - 0.3 * k, 4.4 * k, 2.6 * k, C.nv2!);
  a.disc(cx - 2.8 * k, cup2Y - 0.8 * k, 2.0 * k, 1.2 * k, C.bl2!);
  a.disc(cx - 1.5 * k, cup2Y - 2.2 * k, 4.5 * k, 1.5 * k, C.wh0!);
  a.disc(cx - 1.5 * k, cup2Y - 2.1 * k, 3.2 * k, 0.9 * k, C.bl1!);
}

/** "DRINK ME" glowing crystal sky-sapphire bottle + Blueberry Cream Cake + Silver-Gold Key on Eyelet Doily! */
function paintDrinkMeVignette(a: Art, cx: number, cy: number, k = 1) {
  const C = WON;
  paintEyeletDoily(a, cx, cy + 4 * k, 17 * k, 13 * k, false);

  // 1. Faceted "DRINK ME" sky-sapphire potion bottle
  const bx = cx - 6.5 * k, by = cy + 5 * k;
  a.alpha(0.3, () => a.disc(bx + 1.5, by + 1, 6.5 * k, 2.4 * k, C.shadow!));
  a.r(bx - 5 * k, by - 11 * k, 10 * k, 11 * k, C.nv1!);
  a.r(bx - 4 * k, by - 10 * k, 8 * k, 9.5 * k, C.wh0!);
  a.r(bx - 4 * k, by - 7.5 * k, 8 * k, 7 * k, C.potD!);
  a.r(bx - 3.2 * k, by - 7 * k, 6.4 * k, 6 * k, C.pot!);
  a.r(bx - 3 * k, by - 9.5 * k, 1.6 * k, 8 * k, C.wh0!);
  a.disc(bx, by - 7.5 * k, 3.8 * k, 1.2 * k, C.potHi!);
  // Bottle neck + stopper
  a.r(bx - 2.2 * k, by - 15 * k, 4.4 * k, 4 * k, C.nv2!);
  a.r(bx - 1.4 * k, by - 14.5 * k, 2.8 * k, 3.5 * k, C.wh0!);
  a.r(bx - 2.8 * k, by - 15.2 * k, 5.6 * k, 1.2 * k, C.wh0!);
  a.disc(bx, by - 16.8 * k, 2.2 * k, 2.0 * k, C.nv1!);
  a.disc(bx - 0.4 * k, by - 17.0 * k, 1.3 * k, 1.2 * k, C.gdL!);
  // Ink-Navy ribbon + fluttering white "DRINK ME" tag!
  a.r(bx - 2.4 * k, by - 12.2 * k, 4.8 * k, 1.4 * k, C.nv1!);
  a.line(bx + 2 * k, by - 11.8 * k, bx + 6 * k, by - 13.5 * k, C.nv1!);
  a.r(bx + 5 * k, by - 15 * k, 8.5 * k, 5.2 * k, C.nv1!);
  a.r(bx + 5.6 * k, by - 14.4 * k, 7.3 * k, 4 * k, C.wh0!);
  a.r(bx + 6.6 * k, by - 13.2 * k, 5 * k, 1, C.bl0!);
  a.r(bx + 6.6 * k, by - 11.6 * k, 3.6 * k, 1, C.nv2!);

  // 2. Alice Blue & White Cream Petit-Four Cake (right-front on doily)
  const kx = cx + 6.5 * k, ky = cy + 7.5 * k;
  a.alpha(0.3, () => a.disc(kx + 1, ky + 1, 6.2 * k, 2.4 * k, C.shadow!));
  a.r(kx - 5 * k, ky - 5 * k, 10 * k, 5 * k, C.nv2!);
  a.r(kx - 4.2 * k, ky - 4.5 * k, 8.4 * k, 4 * k, C.bl2!);
  a.disc(kx, ky - 5 * k, 5.5 * k, 2.4 * k, C.wh2!);
  a.disc(kx, ky - 5.4 * k, 4.8 * k, 1.9 * k, C.wh0!);
  for (const dx of [-3.5, 0, 3.5]) a.disc(kx + dx * k, ky - 3.6 * k, 1.5 * k, 1.5 * k, C.wh0!);
  a.disc(kx, ky - 7.2 * k, 2.0 * k, 1.8 * k, C.nv1!);
  a.p(kx - 0.5 * k, ky - 7.7 * k, C.bl3!);

  // 3. Ornate silver-champagne keyhole key at front!
  const gx = cx - 1 * k, gy = cy + 12.8 * k;
  a.arc(gx - 5.5 * k, gy, 3.0 * k, 2.4 * k, 0, TAU, C.nv1!, 1.8 * k);
  a.arc(gx - 5.5 * k, gy, 3.0 * k, 2.4 * k, 0, TAU, C.gdL!, 1);
  a.r(gx - 2.8 * k, gy - 0.8 * k, 9.5 * k, 2 * k, C.nv1!);
  a.r(gx - 2.8 * k, gy - 0.5 * k, 9.2 * k, 1.2 * k, C.gdHi!);
  a.r(gx + 3.8 * k, gy + 0.8 * k, 1.4 * k, 2.2 * k, C.gdL!);
  a.r(gx + 5.6 * k, gy + 0.8 * k, 1.4 * k, 1.6 * k, C.gdL!);
}

/** Pale-Blue & Lace-White Morpho Butterfly fluttering around the Alice tea-table! */
function paintAliceButterfly(a: Art, x: number, y: number, open: boolean, faceLeft: boolean) {
  const C = WON;
  const w = open ? 1 : 0.45;
  const f = faceLeft ? -1 : 1;
  a.petal(x, y, -Math.PI / 2 - 0.82 * f, 6.2, 3.5 * w, C.nv1!, C.bl2!, C.wh0!, 0.55);
  a.petal(x, y, -Math.PI / 2 + 0.82 * f, 6.2, 3.5 * w, C.nv1!, C.bl2!, C.wh0!, 0.55);
  a.petal(x, y + 1, Math.PI / 2 + 0.72, 4.4, 2.5 * w, C.nv1!, C.bl1!, C.bl3!, 0.55);
  a.petal(x, y + 1, Math.PI / 2 - 0.72, 4.4, 2.5 * w, C.nv1!, C.bl1!, C.bl3!, 0.55);
  a.r(x - 0.5, y - 1.5, 1.5, 4, C.nv0!);
  a.p(x, y - 1, C.wh0!);
}

/** Bone-China & Alice-Blue Porcelain Teacup on a Lace Saucer (for the 9 bench seats). */
function paintWonderCupSeat(
  a: Art,
  cx: number,
  cy: number,
  R: number,
  glaze: { d: string; b: string; l: string; pip: string },
) {
  const C = WON;
  a.alpha(0.32, () => a.disc(cx + 1.5, cy + 3, R + 1, R * 0.5 + 1, C.shadow!));
  // Lace-rimmed white bone-china saucer
  a.disc(cx, cy + 2.8, R + 1, R * 0.5 + 1, C.nv1!);
  a.disc(cx, cy + 2.5, R, R * 0.48, C.wh0!);
  a.ring(cx, cy + 2.5, R * 0.8, R * 0.36, C.bl1!);
  const cr = R * 0.68, cry = cr * 0.48;
  a.arc(cx + cr + 1.2, cy - 0.2, 2.1, 2.1, -Math.PI / 2, Math.PI / 2, C.nv1!, 2);
  a.arc(cx + cr + 1.2, cy - 0.2, 2.1, 2.1, -Math.PI / 2, Math.PI / 2, C.wh0!, 1);
  a.disc(cx, cy + 0.9, cr + 0.9, cry + 4.0, glaze.d);
  a.disc(cx, cy + 0.6, cr, cry + 3.4, glaze.b);
  a.r(cx - cr * 0.55, cy + 0.4, 1.5, 2.8, glaze.l);
  a.disc(cx, cy - 1.5, cr + 0.5, cry + 0.5, C.wh0!);
  a.disc(cx, cy - 1.5, cr - 0.3, cry - 0.1, C.bl3!);
  a.disc(cx, cy - 1.2, cr - 1.2, Math.max(0.8, cry - 0.7), '#78a8de');
  a.p(cx - cr * 0.3, cy - 1.4, C.wh0!);
  a.r(cx - 0.5, cy + 1.2, 2, 2, glaze.pip);
}

/**
 * Grand Wedgewood-Blue & Bone-China White Layered Tea-Rose & Alice Ribbon Medallion inside the central dial!
 * Large (~44px across) porcelain centerpiece + Blue-Rose Garland (`r = 0.60`), kept in airy pastel contrast
 * (L > 74%) so chess units standing in the center pop cleanly and clock hands pivot right out of the rose heart!
 */
function paintAliceCameoMedallion(a: Art, W: { x: number; y: number; rx: number; ry: number }, k: number) {
  const C = WON;
  // 1. Delicate Blue-Rose & Forget-Me-Not Garland along r = 0.60
  const grx = W.rx * 0.60, gry = W.ry * 0.60;
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU;
    const am = (a0 + a1) * 0.5;
    const wob = 1 + 0.035 * Math.sin(i * 3.1);
    const x0 = W.x + Math.cos(a0) * grx, y0 = W.y + Math.sin(a0) * gry;
    const xm = W.x + Math.cos(am) * grx * wob, ym = W.y + Math.sin(am) * gry * wob;
    const x1 = W.x + Math.cos(a1) * grx, y1 = W.y + Math.sin(a1) * gry;
    a.quad(x0, y0, xm, ym, x1, y1, 0.95, 0.95, '#92bbe5');
    const leafAng = am + (i % 2 ? 0.65 : -0.65);
    a.petal(xm, ym, leafAng, 4.5 * k, 1.6 * k, '#73a1d4', '#a6cef5', '#dceeff', 0.55);
  }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU + Math.PI / 8;
    const bx = W.x + Math.cos(ang) * grx, by = W.y + Math.sin(ang) * gry;
    if (i % 2 === 0) {
      a.disc(bx, by, 3.8 * k, 3.4 * k, '#6ca1db');
      a.disc(bx - 0.3, by - 0.3, 2.7 * k, 2.3 * k, '#a8d2f7');
      a.p(bx - 0.6, by - 0.6, C.wh0!);
    } else {
      a.disc(bx, by, 3.6 * k, 3.2 * k, '#86b3e0');
      a.disc(bx - 0.3, by - 0.3, 2.5 * k, 2.1 * k, C.wh0!);
      a.p(bx, by, '#6ca1db');
    }
    const ma = ang + Math.PI / 8;
    a.disc(W.x + Math.cos(ma) * grx, W.y + Math.sin(ma) * gry, 1.4 * k, 1.4 * k, '#6896cc');
  }

  // 2. Wedgewood-Blue & Pearl-White Eyelet-Lace Roundel (r = 0.40)
  const crx = W.rx * 0.40, cry = W.ry * 0.40;
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * TAU;
    const lx = W.x + Math.cos(ang) * crx, ly = W.y + Math.sin(ang) * cry;
    a.disc(lx, ly, 3.0 * k, 2.7 * k, '#8db9e6');
    a.disc(lx, ly - 0.2, 2.3 * k, 2.0 * k, C.wh0!);
  }
  a.disc(W.x, W.y, crx * 0.94, cry * 0.94, '#83b4e6');
  a.disc(W.x, W.y - 0.4, crx * 0.87, cry * 0.87, '#9ec9f2');
  a.ring(W.x, W.y, crx * 0.85, cry * 0.85, C.wh0!, 18);

  // 3. Flowing Porcelain-White & Baby-Blue Coquette Ribbon Bow tucked beneath the central Rose!
  const ryBow = W.y + cry * 0.56;
  for (const s of [-1, 1] as const) {
    a.quad(W.x, ryBow, W.x + s * 8 * k, ryBow + 4 * k, W.x + s * 13 * k, ryBow + 9.5 * k, 2.2 * k, 1.4 * k, '#699cd6');
    a.quad(W.x, ryBow, W.x + s * 7.8 * k, ryBow + 3.8 * k, W.x + s * 12.6 * k, ryBow + 9.0 * k, 1.4 * k, 0.8 * k, C.wh0!);
    a.disc(W.x + s * 6.4 * k, ryBow - 0.5 * k, 5.6 * k, 3.0 * k, '#699cd6');
    a.disc(W.x + s * 6.4 * k, ryBow - 0.7 * k, 4.6 * k, 2.2 * k, C.wh0!);
  }
  // 4. Four porcelain-lace leaf sprigs radiating from the central Tea-Rose
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * TAU) / 4;
    a.petal(W.x, W.y, ang, crx * 0.82, cry * 0.24, '#6d9fd6', '#b8dcfb', C.wh0!, 0.55);
  }

  // 5. Large Layered Bone-China White & Ice-Sapphire Central Briar Rose (r ≈ 0.28 of dial!)
  const R = Math.min(crx, cry) * 0.68;
  for (let p = 0; p < 8; p++) {
    const ang = (p / 8) * TAU;
    const px = W.x + Math.cos(ang) * R * 0.48, py = W.y + Math.sin(ang) * R * 0.44;
    a.disc(px, py, R * 0.52, R * 0.48, '#71a3db');
    a.disc(px, py - 0.3, R * 0.44, R * 0.40, C.wh0!);
  }
  a.disc(W.x, W.y, R * 0.60, R * 0.56, '#7db0e6');
  for (let p = 0; p < 6; p++) {
    const ang = 0.26 + (p / 6) * TAU;
    const px = W.x + Math.cos(ang) * R * 0.28, py = W.y + Math.sin(ang) * R * 0.26;
    a.disc(px, py, R * 0.34, R * 0.31, '#daedff');
    a.arc(px, py, R * 0.32, R * 0.29, ang - 1.0, ang + 1.0, C.wh0!);
  }
  a.disc(W.x, W.y, R * 0.26, R * 0.24, '#6b9fd9');
  a.ring(W.x, W.y, R * 0.22, R * 0.20, C.wh0!, 10);
}

const wonderlandScene: AtelierScene = {
  plan(L) {
    const k = kOf(L);
    const rx = Math.min(L.gw * 0.485, 92);
    const ry = Math.min(L.gh * 0.43, 72);
    const watch = { x: L.cx, y: L.cy + 5, rx, ry };
    const topL = [
      { x: -4, y: 8, R: 25 },
      { x: 22, y: 4, R: 23 },
      { x: 46, y: 7, R: 20 },
      { x: 64, y: 9, R: 15 },
      { x: 8, y: 34, R: 21 },
      { x: 33, y: 28, R: 18 },
    ];
    const topR = [
      { x: L.W + 4, y: 10, R: 26 },
      { x: L.W - 22, y: 5, R: 24 },
      { x: L.W - 46, y: 8, R: 20 },
      { x: L.W - 64, y: 10, R: 15 },
      { x: L.W - 10, y: 36, R: 22 },
      { x: L.W - 33, y: 28, R: 18 },
    ];
    return { k, watch, topL, topR };
  },

  paint(a, L, P) {
    const C = WON;
    const W = P.watch;
    const k = P.k as number;
    const avg = (W.rx + W.ry) / 2;

    // 1. Classic Alice Baby-Blue Gingham-Damask Tablecloth + Ruffled White Apron-Lace Skirt + Ink-Navy Watch Rim!
    a.field((x, y) => {
      const nx = (x - W.x) / W.rx, ny = (y - W.y) / W.ry;
      const d = Math.hypot(nx, ny);
      const dpx = (d - 1) * avg;
      const ang = Math.atan2(ny, nx);

      // Inside the Porcelain Pocket-Watch Tea-Dial
      if (dpx < 0) {
        if (dpx > -2.0) return dpx > -0.9 ? C.nv1! : C.bl3!;
        // Soft Alice Baby-Blue enamel chapter ring (r = 0.79 .. 0.97)
        if (d > 0.79) {
          if (Math.abs(d - 0.795) < 0.014) return C.bl0!;
          const sheen = -(nx * 0.55 + ny * 0.8);
          return sheen > 0.25 ? C.blHi! : sheen < -0.25 ? C.bl2! : C.bl3!;
        }
        // Crisp Bone-China White & Ice-Blue Harlequin Diamond Dial (low contrast for crystal unit clarity!)
        const u = Math.floor((x - W.x + y - W.y + 400) / 14);
        const v = Math.floor((x - W.x - (y - W.y) + 400) / 14);
        const harlequin = (u + v) % 2 === 0;
        let col = harlequin ? C.wh0! : C.wh1!;
        if (!harlequin && bayer(x, y) < 0.35) col = mix(C.wh1!, C.bl3!, 0.55);
        if (d > 0.74) col = mix(col, C.wh2!, 0.45);
        return col;
      }

      // Sculpted Midnight Ink-Navy & Wedgewood-Blue Enamel Rim (with silver-pearl inner bead!)
      const bezelW = 7.4;
      if (dpx < bezelW) {
        if (dpx > bezelW - 1.1) return C.nv0!;
        if (dpx < 1.3) return bayer(x, y) < 0.5 ? C.gdHi! : C.gdL!;
        const u = (dpx - 1.3) / (bezelW - 2.4);
        const light = -(nx * 0.58 + ny * 0.81) / Math.max(0.001, d);
        const s = Math.sin(clamp(u, 0, 1) * Math.PI) * 1.4 + light * 0.95;
        const stops = [C.nv0!, C.nv1!, C.nv2!, C.nv3!, C.bl1!];
        return stops[band(1.25 + s, x, y, stops.length, 0.36)]!;
      }

      // Ruffled 24-Scallop White Apron Eyelet-Lace Skirt radiating around the Ink-Navy Rim!
      const scallop = 0.5 + 0.5 * Math.cos(ang * 24);
      const laceW = bezelW + 6.4 + 3.4 * scallop;
      if (dpx < laceW) {
        if (dpx > laceW - 1.0) return C.bl0!;
        // Dainty ink-blue eyelet hole inside each lace lobe
        const holeAng = Math.round((ang * 24) / TAU) * (TAU / 24);
        const hx = W.x + Math.cos(holeAng) * (W.rx + bezelW + 5.2);
        const hy = W.y + Math.sin(holeAng) * (W.ry + bezelW + 5.2);
        if (Math.hypot(x - hx, y - hy) < 1.35) return C.nv2!;
        return dpx < bezelW + 2.2 ? C.wh2! : C.wh0!;
      }

      // Outer Classic Alice Baby-Blue & Milk-White Woven Gingham-Damask Tablecloth!
      const gx = Math.floor(x / 8) % 2 === 0;
      const gy = Math.floor(y / 8) % 2 === 0;
      let col = gx && gy ? C.cl2! : gx || gy ? C.cl1! : C.cl0!;
      // Subtle linen weave texture + dreamy cornflower corner vignette
      if ((x + y) % 2 === 0 && !gx && !gy) col = mix(col, C.cl3!, 0.38);
      const cornerDist = Math.hypot((x - L.cx) / (L.W * 0.55), (y - L.cy) / (L.H * 0.58));
      if (cornerDist > 0.88) {
        col = mix(col, C.cl4!, clamp((cornerDist - 0.88) * 0.85, 0, 0.55));
      }
      // Soft periwinkle shadow cast by the ruffled white lace skirt
      const shOff = nx * 2.0 + ny * 3.0;
      if (dpx < laceW + 2.8 + Math.max(0, shOff)) {
        col = mix(col, C.shadow!, 0.38);
      }
      return col;
    });

    // 2. Minute ticks & 12 Ink-Navy / Wedgewood-Blue Suit Medallions around the chapter ring!
    for (let i = 0; i < 48; i++) {
      const ang = (i / 48) * TAU - Math.PI / 2;
      const major = i % 4 === 0;
      const r0 = major ? 0.945 : 0.952;
      a.p(W.x + Math.cos(ang) * W.rx * r0, W.y + Math.sin(ang) * W.ry * r0, major ? C.nv1! : C.bl0!);
    }
    for (let h = 0; h < 12; h++) {
      const ang = (h / 12) * TAU - Math.PI / 2;
      const hx = W.x + Math.cos(ang) * W.rx * 0.885;
      const hy = W.y + Math.sin(ang) * W.ry * 0.885;
      if (h % 3 === 0) {
        a.disc(hx, hy, 5.8 * k, 5.0 * k, C.nv2!);
        a.disc(hx, hy, 4.8 * k, 4.1 * k, C.wh0!);
        if (h === 0) a.sprC(SUIT_CROWN, { g: C.nv2!, G: C.bl2!, h: C.wh0!, b: C.bl0!, d: C.nv0! }, hx, hy);
        else if (h === 3) a.sprC(SUIT_SPADE, { s: C.nv1!, S: C.nv3!, d: C.nv0! }, hx, hy);
        else if (h === 6) a.sprC(SUIT_HEART, { h: C.bl0!, H: C.bl3!, d: C.nv1! }, hx, hy);
        else a.sprC(SUIT_CLUB, { c: C.nv1!, C: C.nv3!, d: C.nv0! }, hx, hy);
      } else if (k >= 0.75) {
        a.sprC(SUIT_DIAMOND, { d: h % 2 ? C.bl0! : C.nv2!, D: h % 2 ? C.bl3! : C.bl2! }, hx, hy);
      } else {
        a.disc(hx, hy, 1.5, 1.5, h % 2 ? C.bl0! : C.nv2!);
      }
    }

    // 3. Central Wedgewood-Blue & Bone-China White Layered Tea-Rose Medallion + Garland!
    paintAliceCameoMedallion(a, W, k);

    // 4. Invisible 5×8 chessboard skeleton (soft Wedgewood-blue ticks + Cornflower midline)
    skeleton(a, L, '#7aa4d1', 0.42, C.bl0!);

    // 5. 12 o'clock Double-Layered Midnight Ink-Navy & Baby-Blue Coquette Satin Bow!
    paintAliceWatchBow(a, W.x, W.y - W.ry - 6, k * 1.06);

    // 6. Dainty woven card-suit watermarks & white pearls scattered softly on the Alice gingham cloth
    for (let i = 0; i < 36; i++) {
      const gx = 8 + hash2(i, 1, 79) * (L.W - 16);
      const gy = 40 + hash2(i, 2, 79) * (L.H - 68);
      if (Math.hypot((gx - W.x) / (W.rx + 22), (gy - W.y) / (W.ry + 22)) < 1) continue;
      if (i % 4 === 0) {
        a.p(gx, gy - 1, C.wh0!); a.p(gx - 1, gy, C.wh0!); a.p(gx + 1, gy, C.wh0!); a.p(gx, gy + 1, C.wh0!);
        a.p(gx, gy, C.bl0!);
      } else {
        a.p(gx, gy - 1, C.bl1!); a.p(gx - 1, gy, C.bl1!); a.p(gx + 1, gy, C.bl1!); a.p(gx, gy + 1, C.bl1!);
      }
    }

    // 7. Lush Midnight Ink-Navy Rose-Leaf Hedges & Briar-Rose Garlands in upper corners!
    paintNavyFoliageMound(a, P.topL, 'L');
    paintNavyFoliageMound(a, P.topR, 'R');

    const rosesTL: readonly [number, number, number, 'white' | 'sky' | 'navy', number][] = L.mL >= 32
      ? [
          [14, 15, 9.8, 'white', 0.2],
          [35, 12, 10.4, 'sky', 0.9],
          [56, 15, 9.0, 'white', 1.7],
          [16, 36, 9.4, 'navy', 2.4],
          [39, 31, 9.8, 'white', 0.5],
        ]
      : [
          [12, 14, 7.6, 'white', 0.4],
          [29, 10, 7.2, 'sky', 1.3],
        ];
    for (const [rx, ry, R, tone, sd] of rosesTL) paintAliceRose(a, rx, ry, R, tone, sd);

    // Right corner roses framing the Teacup Lop Bunny (anchored to L.W so wide screens stay 100% cohesive!)
    const rosesTR: readonly [number, number, number, 'white' | 'sky' | 'navy', number][] = L.mR >= 32
      ? [
          [L.W - 56, 14, 9.2, 'white', 0.6],
          [L.W - 38, 32, 8.4, 'navy', 1.2],
          [L.W - 14, 41, 9.4, 'sky', 1.9],
        ]
      : [[L.W - 34, 11, 6.8, 'white', 0.8]];
    for (const [rx, ry, R, tone, sd] of rosesTR) paintAliceRose(a, rx, ry, R, tone, sd);

    // 8. Flank Classic Alice Blue-and-White Tea-Party Vignettes
    if (L.mL >= 32) {
      const leftX = Math.max(27, L.gl - 33);
      const rightX = Math.min(L.W - 26, L.gr + 34);
      // Cluster of Ink-Navy & Sky Briar Roses tucked above the Hero Long-Eared Bunny
      paintAliceRose(a, leftX - 9, 60, 8.6, 'navy', 1.1);
      paintAliceRose(a, leftX + 6, 65, 7.4, 'white', 2.2);
      // Bottom-left: Ruffled White Eyelet Doily + "DRINK ME" Sky-Sapphire Bottle + Blue Cake + Key
      paintDrinkMeVignette(a, leftX, L.gb - 11, 1.16);
      // Upper-mid right: Oversized Ink-Navy & Wedgewood A♠ & Q♦ Playing Cards
      paintAliceCardPair(a, rightX, 68, 1.25);
      // Mid-right: 2-Tier Silver & Blue-Porcelain Afternoon-Tea Pastry Stand
      paintAliceTeaStand(a, rightX, L.mid + 27, 1.18);
      // Bottom-right: Wedgewood Blue-and-White Bone-China Teapot & Stacked Teacups
      paintBlueWhiteTeaStack(a, rightX, L.gb + 4, 1.18);
    } else {
      // Compact mobile viewport: keep upper-left clear for HP strip; place cards & teapot on right!
      paintAliceCardPair(a, L.W - 15, 52, 0.66);
      paintBlueWhiteTeaStack(a, L.W - 16, L.gb + 4, 0.64);
    }

    // 9. Bench: 9 Bone-China & Alice-Blue Porcelain Teacups on White Lace Saucers!
    const glazes = [
      { d: C.nv2!, b: C.bl1!, l: C.blHi!, pip: C.wh0! },
      { d: C.bl0!, b: C.wh0!, l: C.wh0!, pip: C.nv1! },
      { d: C.nv0!, b: C.nv2!, l: C.bl2!, pip: C.wh0! },
      { d: C.nv2!, b: C.bl2!, l: C.wh0!, pip: C.nv1! },
    ];
    for (const [i, s] of slots(L).entries()) {
      paintWonderCupSeat(a, s.x, s.y, Math.min(10, L.bs * 0.43), glazes[i % glazes.length]!);
    }
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const C = WON;
    const W = P.watch;
    const k = P.k as number;

    // 1. Ornate Midnight Ink-Navy Spade-Filigree Pocket-Watch Hands sweeping around center!
    const hrAng = -Math.PI / 2 + 0.65 + sec * 0.045;
    const mnAng = -Math.PI / 2 - 0.52 + sec * 0.22;
    const scAng = -Math.PI / 2 + 2.1 + sec * 0.95;

    const drawNavyHand = (ang: number, rLen: number, thick: number) => {
      const ex = W.x + Math.cos(ang) * W.rx * rLen;
      const ey = W.y + Math.sin(ang) * W.ry * rLen;
      const mx = W.x + Math.cos(ang) * W.rx * (rLen * 0.68);
      const my = W.y + Math.sin(ang) * W.ry * (rLen * 0.68);
      a.alpha(0.24, () => a.stroke(W.x + 1, W.y + 1.5, ex + 1, ey + 1.5, thick, 0.7, C.shadow!));
      a.stroke(W.x, W.y, ex, ey, thick, 0.6, C.nv0!);
      a.stroke(W.x, W.y, ex, ey, Math.max(0.6, thick - 0.6), 0.4, C.nv2!);
      a.disc(mx, my, thick + 1.0, thick + 0.8, C.nv0!);
      a.disc(mx, my, Math.max(0.8, thick), Math.max(0.8, thick - 0.1), C.wh0!);
    };
    drawNavyHand(hrAng, 0.48, 1.8 * k);
    drawNavyHand(mnAng, 0.69, 1.4 * k);

    // Slender Cornflower-Blue second hand + pearl center arbor
    const sx0 = W.x - Math.cos(scAng) * W.rx * 0.16, sy0 = W.y - Math.sin(scAng) * W.ry * 0.16;
    const sx1 = W.x + Math.cos(scAng) * W.rx * 0.74, sy1 = W.y + Math.sin(scAng) * W.ry * 0.74;
    a.line(sx0, sy0, sx1, sy1, C.bl0!);
    a.disc(sx0, sy0, 1.8 * k, 1.6 * k, C.bl1!);
    a.disc(W.x, W.y, 3.4 * k, 3.0 * k, C.nv0!);
    a.disc(W.x, W.y, 2.3 * k, 2.0 * k, C.gdL!);
    a.p(W.x - 0.6, W.y - 0.6, C.wh0!);

    // 2. HERO Classic-Alice Long-Eared Bunny (~62 art-px tall! Silky 27px lop ear swaying, sapphire eyes blinking!)
    if (L.mL >= 32) {
      const rx = Math.max(28, L.gl - 28), rby = L.mid + 32;
      paintAliceLongEarRabbit(a, rx, rby, 1.32, sec);
      // Floating ice-blue diamond pip puffing gently above the pocket watch
      const hp = wrap(sec * 0.42, 1);
      a.alpha(Math.sin(hp * Math.PI) * 0.9, () => {
        const hx = rx + 15 + Math.sin(hp * 5) * 2, hy = rby - 32 - hp * 12;
        a.r(hx, hy - 1, 1, 3, C.nv2!);
        a.r(hx - 1, hy, 3, 1, C.nv2!);
        a.p(hx, hy, C.wh0!);
      });
    } else {
      // Mobile portrait: stand Long-Eared Bunny in lower-left (100% clear of upper-left HP pills!)
      paintAliceLongEarRabbit(a, 16, L.gb - 2, 0.82, sec);
    }

    // 3. Cute Baby Lop-Eared Bunny peeking & wiggling floppy ears in the top-right Blue-and-White Teacup!
    const cupX = L.mR >= 32 ? L.W - 28 : L.W - 18;
    const cupY = L.mR >= 32 ? 22 : 18;
    paintTeacupLopBunny(a, cupX, cupY, L.mR >= 32 ? 1.12 : 0.72, sec);

    // 4. Rising crystal bubbles inside the "DRINK ME" bottle + silver key star-glint!
    if (L.mL >= 32) {
      const leftX = Math.max(27, L.gl - 33);
      const bx = leftX - 7.5, by = L.gb - 6;
      for (let i = 0; i < 3; i++) {
        const bq = wrap(sec * 0.65 + i * 0.33, 1);
        a.p(bx + (i - 1) * 1.8, by - 1 - bq * 6.5, C.wh0!);
      }
      if (Math.sin(sec * 2.6) > 0.55) {
        const kx = leftX + 3.5, ky = L.gb + 3.8;
        a.r(kx - 2, ky, 5, 1, C.wh0!);
        a.r(kx, ky - 2, 1, 5, C.wh0!);
      }
    }

    // 5. Fragrant white tea steam curling above the Wedgewood Bone-China Teapot Stack!
    const tx = L.mR >= 32 ? Math.min(L.W - 26, L.gr + 32) : L.W - 16;
    const ty = L.mR >= 32 ? L.gb - 28 : L.gb - 12;
    for (let i = 0; i < 3; i++) {
      const sq = wrap(sec * 0.36 + i / 3, 1);
      const sx = tx + Math.sin(sq * TAU + i) * 3.5;
      const sy = ty - sq * 14;
      a.alpha(Math.sin(sq * Math.PI) * 0.78, () => {
        a.disc(sx, sy, 1.6 + sq, 1.2 + sq * 0.7, C.wh0!);
      });
    }

    // 6. Two Pale-Blue & Lace-White Morpho Butterflies orbiting the Ruffled Lace Watch Rim!
    for (let i = 0; i < 2; i++) {
      const bu = sec * (0.28 + i * 0.07) + i * 3.1;
      const bx = W.x + Math.cos(bu) * (W.rx * 0.95 + 10) + Math.sin(bu * 2.3) * 7;
      const by = W.y - 4 + Math.sin(bu * 1.3) * (W.ry * 0.88);
      paintAliceButterfly(a, bx, by, Math.floor(sec * 9 + i) % 2 === 0, Math.sin(bu) > 0);
    }

    // 7. Drifting Ice-Blue & Ink-Navy Sparkles & Diamonds
    for (let i = 0; i < 10; i++) {
      const px = wrap(hash2(i, 4, 53) * L.W + Math.sin(sec * 0.8 + i) * 6, L.W);
      const py = wrap(hash2(i, 7, 53) * (L.H - 34) - sec * (2.0 + (i % 3) * 0.7), L.H - 28);
      if (i % 2 === 0) {
        const s = Math.sin(sec * 2.8 + i * 1.7);
        if (s > 0.45) {
          a.alpha((s - 0.45) * 1.8, () => {
            a.r(px - 1, py, 3, 1, C.wh0!);
            a.r(px, py - 1, 1, 3, C.wh0!);
            a.p(px, py, C.bl1!);
          });
        }
      } else {
        a.alpha(0.75, () => {
          a.r(px, py, 2, 2, i % 4 === 1 ? C.nv2! : C.bl1!);
          a.p(px, py, C.wh0!);
        });
      }
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
  'wonderland-rabbit': wonderlandScene,
  'carousel-night': carouselScene,
} as const;

export const ATELIER_BACKDROP = {
  'embroidery-hoop': EMB.gin0!,
  'wonderland-rabbit': WON.cl0!,
  'carousel-night': CAR.n1!,
} as const;
