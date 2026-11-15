#!/usr/bin/env node
/**
 * Lush 16-bit Pixel Avatar Frames (64×64 crisp pixel grid scaled 0.75× inside
 * viewBox="0 0 48 48" with shape-rendering="crispEdges" + SMIL frame animation).
 *
 * Why 64×64 inside 48×48?
 * - Preserves `viewBox="0 0 48 48"` and `portraitScale: 34/48` compatibility.
 * - Maps 1:1 to CSS pixels at leaderboard `size={64}` and ~2:1 at shop `size={132}`.
 * - Thick botanical/water wreaths (r = 21..30) + corner hero motifs completely
 *   conceal the square portrait corners so every frame reads as an organic wreath!
 *
 * Usage: node scripts/build-pixel-frames.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const N = 64;
const C0 = 31.5;
const TAU = Math.PI * 2;

class Grid {
  constructor() {
    this.c = new Array(N * N).fill(null);
  }
  px(x, y, col) {
    if (col === undefined) return;
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < N && y < N) this.c[y * N + x] = col;
  }
  get(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    return x >= 0 && y >= 0 && x < N && y < N ? this.c[y * N + x] : null;
  }
  rect(x, y, w, h, col) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col);
  }
  disc(cx, cy, r, col, ry = r) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (((x - cx) / (r + 0.35)) ** 2 + ((y - cy) / (ry + 0.35)) ** 2 <= 1) {
          this.px(x, y, col);
        }
      }
    }
  }
  line(x0, y0, x1, y1, col, r = 0) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.6));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (r <= 0.4) this.px(x, y, col);
      else this.disc(x, y, r, col);
    }
  }
  quad(x0, y0, cx, cy, x1, y1, col, r0 = 0.6, r1 = 0.4) {
    const approx = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
    const n = Math.max(8, Math.ceil(approx * 1.6));
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const r = r0 + (r1 - r0) * t;
      if (r <= 0.5) this.px(x, y, col);
      else this.disc(x, y, r, col);
    }
  }
  /** Shaded oriented petal or botanical leaf anchored at base (bx, by). */
  petal(bx, by, ang, len, wid, edgeCol, bodyCol, hiCol = null, pointed = 0.55) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    for (let s = 0; s <= len; s += 0.38) {
      const u = s / Math.max(0.01, len);
      const hw = Math.sin(Math.pow(u, pointed) * Math.PI) * wid;
      for (let k = -hw; k <= hw; k += 0.38) {
        const edge = Math.abs(k) > hw - 0.65 || u > 0.88 || u < 0.08;
        const lit = hiCol && !edge && (k < -hw * 0.12 || (Math.abs(k) < 0.48 && u > 0.2 && u < 0.75));
        this.px(bx + cs * s - sn * k, by + sn * s + cs * k, edge ? edgeCol : lit ? hiCol : bodyCol);
      }
    }
  }
  /** 5-lobed sculpted ivy leaf centered at (cx, cy). */
  ivyLeaf(cx, cy, R, baseAng, dark, mid, light) {
    for (const [da, lScale, wScale] of [
      [0, 1.05, 0.38],
      [-0.85, 0.86, 0.34],
      [0.85, 0.86, 0.34],
      [-1.75, 0.58, 0.28],
      [1.75, 0.58, 0.28],
    ]) {
      this.petal(cx, cy, baseAng + da, R * lScale, R * wScale, dark, mid, light, 0.62);
    }
    this.px(cx, cy, light);
  }
  /** Lush 5-petal peach / sakura blossom centered at (cx, cy). */
  blossom5(cx, cy, R, rot, edgeCol, midCol, lightCol, coreCol, stamenCol) {
    for (let k = 0; k < 5; k++) {
      const ang = rot + (k / 5) * TAU;
      this.petal(
        cx + Math.cos(ang) * 0.6,
        cy + Math.sin(ang) * 0.6,
        ang,
        R,
        R * 0.44,
        edgeCol,
        midCol,
        lightCol,
        0.48,
      );
    }
    this.disc(cx, cy, Math.max(1.1, R * 0.24), coreCol);
    this.px(cx, cy, stamenCol);
  }
  /** Clear central circular portrait window inside radius `rInner`. */
  clearAperture(rInner) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if ((x - C0) ** 2 + (y - C0) ** 2 < rInner * rInner) {
          this.c[y * N + x] = null;
        }
      }
    }
  }
  /** 1px crisp dark pixel outline around opaque pixels, skipping pixels owned by `under`. */
  outline(col, under = null) {
    const add = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (this.get(x, y) || under?.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) {
          add.push([x, y]);
        }
      }
    }
    for (const [x, y] of add) this.px(x, y, col);
    return this;
  }
  rects() {
    const out = [];
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const col = this.c[y * N + x];
        if (!col) {
          x++;
          continue;
        }
        let run = 1;
        while (x + run < N && this.c[y * N + x + run] === col) run++;
        out.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${col}"/>`);
        x += run;
      }
    }
    return out.join('');
  }
}

const onRing = (ang, r) => ({ x: C0 + Math.cos(ang) * r, y: C0 + Math.sin(ang) * r });

function animGroup(frames, tickMs, holds) {
  const ticks = holds ?? frames.map(() => 1);
  const total = ticks.reduce((a, b) => a + b, 0);
  const dur = (total * tickMs) / 1000;
  let acc = 0;
  return frames
    .map((g, i) => {
      const start = acc / total;
      const end = (acc + ticks[i]) / total;
      acc += ticks[i];
      if (!g) return '';
      const keyTimes = [0];
      const values = [start === 0 ? 1 : 0];
      if (start > 0) {
        keyTimes.push(start);
        values.push(1);
      }
      if (end < 1) {
        keyTimes.push(end);
        values.push(0);
      }
      return `<g opacity="${values[0]}">${g.rects()}<animate attributeName="opacity" values="${values.join(';')}" keyTimes="${keyTimes.map((k) => k.toFixed(4)).join(';')}" dur="${dur.toFixed(2)}s" calcMode="discrete" repeatCount="indefinite"/></g>`;
    })
    .join('');
}

function svg(staticGrid, groups) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" shape-rendering="crispEdges"><g transform="scale(0.75)">${staticGrid.rects()}${groups.join('')}</g></svg>\n`;
}

/** Paint draped golden or silver bead chain sagging between two angles on the wreath. */
function paintChain(g, a0, a1, r0, sag, colMain, colHi) {
  const p0 = onRing(a0, r0);
  const p1 = onRing(a1, r0);
  const mid = onRing((a0 + a1) * 0.5, r0 - 2);
  const cx = mid.x, cy = mid.y + sag;
  for (let i = 0; i <= 22; i++) {
    const t = i / 22, u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * cx + t * t * p1.x;
    const y = u * u * p0.y + 2 * u * t * cy + t * t * p1.y;
    g.px(x, y, i % 2 === 0 ? colHi : colMain);
  }
}

/** Paint thick intertwined woody branch wreath around r ≈ 25.5 so square corners are masked. */
function paintWoodWreath(g, barkD, barkM, barkL, skipAng = null, skipHalf = 0) {
  for (let i = 0; i < 240; i++) {
    const t = i / 240;
    const ang = t * TAU;
    if (skipAng !== null) {
      const da = Math.atan2(Math.sin(ang - skipAng), Math.cos(ang - skipAng));
      if (Math.abs(da) < skipHalf) continue;
    }
    const r1 = 25.2 + Math.sin(ang * 4 + 0.4) * 1.1;
    const r2 = 26.8 + Math.cos(ang * 5 - 0.6) * 1.2;
    const p1 = onRing(ang, r1);
    const p2 = onRing(ang, r2);
    g.disc(p1.x, p1.y, 1.35, barkD);
    g.disc(p2.x, p2.y, 1.25, barkD);
    g.px(p1.x - 0.4, p1.y - 0.4, barkM);
    g.px(p2.x - 0.4, p2.y - 0.4, barkL);
  }
}

/** Crisp 4-point pixel sparkle frame helper. */
function sparkleFrame(pts, coreCol = '#ffffff', rayCol = '#ffeaa0') {
  const f = new Grid();
  for (const [x, y, arm] of pts) {
    f.rect(x - arm, y, arm * 2 + 1, 1, rayCol);
    f.rect(x, y - arm, 1, arm * 2 + 1, rayCol);
    f.px(x, y, coreCol);
  }
  return f;
}

/* ═══════════════════ 1. 灵橄 · 衔春 (frame_revival_olive.svg) ═══════════════════ */
function buildRevivalOlive() {
  const g = new Grid();
  const P = {
    barkD: '#544332',
    barkM: '#7d654b',
    barkL: '#ab8f6e',
    olD: '#4c663b',
    olM: '#7ea160',
    olL: '#b8d694',
    ivyD: '#285235',
    ivyM: '#458052',
    ivyL: '#78b37b',
    fruitD: '#667532',
    fruit: '#a4b54c',
    fruitL: '#e6f09c',
    gold: '#cfa246',
    goldL: '#fae28c',
    out: '#2e3b25',
  };

  // Draped golden chains along upper-left, upper-right, and lower arcs
  paintChain(g, -2.55, -1.72, 23.2, 5.5, P.gold, P.goldL);
  paintChain(g, -1.45, -0.58, 23.2, 5.2, P.gold, P.goldL);
  paintChain(g, 0.55, 1.35, 24.5, 4.5, P.gold, P.goldL);
  paintChain(g, 1.85, 2.62, 24.5, 4.5, P.gold, P.goldL);

  paintWoodWreath(g, P.barkD, P.barkM, P.barkL);

  // Corner ivy cushions (masking all 4 square portrait corners cleanly!)
  for (const [ang, R] of [
    [-2.35, 5.8],
    [-0.78, 5.6],
    [0.78, 6.0],
    [2.35, 5.8],
    [-1.4, 5.0],
    [1.6, 5.2],
  ]) {
    const p = onRing(ang, 25.0);
    g.ivyLeaf(p.x, p.y, R, ang, P.ivyD, P.ivyM, P.ivyL);
  }

  // Lush lance-shaped sage olive leaves + plump golden-green olives all around the wreath
  const N_LEAVES = 28;
  for (let k = 0; k < N_LEAVES; k++) {
    const ang = (k / N_LEAVES) * TAU;
    // Leave a cozy perch clearing at upper-right (-0.65) for the hero white dove
    if (Math.abs(ang - (TAU - 0.62)) < 0.25 || Math.abs(ang + 0.62) < 0.25) continue;
    const p = onRing(ang, 25.8 + (k % 2 ? 1.2 : -1.0));
    const tan = ang + Math.PI / 2;
    g.petal(p.x, p.y, tan + 0.52, 8.2, 2.0, P.olD, P.olM, P.olL, 0.58);
    g.petal(p.x, p.y, tan - 0.48, 7.4, 1.8, P.olD, P.olL, '#dcf0be', 0.58);
    if (k % 4 === 1) {
      const fp = onRing(ang + 0.06, 26.2);
      g.disc(fp.x, fp.y, 1.8, P.fruitD, 2.3);
      g.disc(fp.x - 0.3, fp.y - 0.3, 1.2, P.fruit, 1.7);
      g.px(fp.x - 0.5, fp.y - 0.8, P.fruitL);
    }
  }

  // Tiny white jasmine/myrtle flower clusters at left & lower-right
  for (const [fx, fy] of [
    [7, 25],
    [9, 39],
    [55, 41],
    [14, 15],
  ]) {
    for (const [dx, dy] of [[-2, 0], [2, -1], [0, 2]]) {
      g.disc(fx + dx, fy + dy, 1.6, '#d9e3d5');
      g.px(fx + dx, fy + dy, '#ffffff');
      g.px(fx + dx, fy + dy + 1, P.goldL);
    }
  }

  g.outline(P.out);

  // Hero Perched White Dove at upper-right (~2 o'clock, holding golden olive sprig in beak!)
  const paintDoveFrame = (wingLift) => {
    const f = new Grid();
    const dx = 48, dy = 16;
    // Fanned tail feathers extending down-right
    f.petal(dx + 4, dy + 4, 1.05, 9.5, 2.6, '#adbcc9', '#e9f0f5', '#ffffff');
    f.petal(dx + 5, dy + 3, 0.82, 9.0, 2.2, '#adbcc9', '#f5f9fc', '#ffffff');
    // Plump dove breast & body
    f.disc(dx, dy + 1, 5.2, '#cfdbe6', 4.6);
    f.disc(dx - 0.5, dy + 0.5, 4.4, '#f5f9fc', 3.9);
    f.disc(dx - 1.2, dy, 3.2, '#ffffff', 2.8);
    // Sculpted layered wing (flutters gently on wingLift!)
    f.petal(dx - 1, dy - 1 - wingLift, 0.48 - wingLift * 0.18, 10.5, 3.4, '#9fb0bf', '#e6eef5', '#ffffff');
    f.petal(dx, dy - 2 - wingLift, 0.25 - wingLift * 0.22, 9.0, 2.5, '#b8c7d4', '#f7fbff', '#ffffff');
    if (wingLift > 0) {
      f.petal(dx - 1, dy - 3, -0.35, 8.5, 2.4, '#aebdca', '#ffffff', '#ffffff');
    }
    // Rounded head, dark eye, coral feet & golden olive sprig in beak!
    f.disc(dx - 3.5, dy - 4.5, 3.1, '#dce6ef', 2.9);
    f.disc(dx - 3.8, dy - 4.8, 2.5, '#ffffff', 2.4);
    f.px(dx - 5, dy - 5, '#262938');
    f.line(dx - 6, dy - 4, dx - 8, dy - 4, '#eba044');
    // Golden olive sprig in beak!
    f.line(dx - 8, dy - 4, dx - 13, dy - 9, '#b8862d');
    f.petal(dx - 9, dy - 5, -2.5, 4.2, 1.1, '#a67926', '#f2cf66', '#fff7bd');
    f.petal(dx - 11, dy - 7, -1.6, 4.2, 1.1, '#a67926', '#f2cf66', '#fff7bd');
    f.petal(dx - 12, dy - 8, -2.9, 3.8, 1.0, '#a67926', '#fae084', '#fffbe0');
    // Coral feet on bough
    f.px(dx - 1, dy + 5, '#d97b6c');
    f.px(dx + 1, dy + 5, '#d97b6c');
    f.outline('#5b6d7d', g);
    return f;
  };

  const d0 = paintDoveFrame(0);
  const d1 = paintDoveFrame(1.4);
  const d2 = paintDoveFrame(2.4);

  return svg(g, [
    animGroup([d0, d1, d2, d1, d0], 150, [14, 2, 2, 2, 6]),
    animGroup(
      [
        sparkleFrame([[9, 18, 2], [56, 36, 1]]),
        null,
        sparkleFrame([[12, 48, 2], [38, 6, 1]]),
        null,
      ],
      280,
      [2, 3, 2, 4],
    ),
  ]);
}

/* ═══════════════════ 2. 青藤 · 凌霄 (frame_revival_ivy.svg) ═══════════════════ */
function buildRevivalIvy() {
  const g = new Grid();
  const P = {
    barkD: '#49523e',
    barkM: '#788565',
    barkL: '#b4c29b',
    ivyD: '#173d2b',
    ivyM: '#286346',
    ivyL: '#4e966b',
    ivyHi: '#85c998',
    fernD: '#4b663e',
    fernM: '#7ea165',
    fernL: '#b5d496',
    gold: '#c7a454',
    goldL: '#f7e39c',
    silv: '#93a3b0',
    silvL: '#dce7f0',
    out: '#162e22',
  };

  // Draped silver & pale-gold chains
  paintChain(g, -2.4, -1.5, 23.0, 5.8, P.silv, P.silvL);
  paintChain(g, -0.4, 0.55, 23.5, 4.5, P.gold, P.goldL);
  paintChain(g, 0.9, 1.9, 24.5, 4.8, P.gold, P.goldL);

  paintWoodWreath(g, P.barkD, P.barkM, P.barkL);

  // Sage fern/olive fronds weaving along top & right & bottom
  for (let k = 0; k < 22; k++) {
    const ang = (k / 22) * TAU;
    if (ang > 2.05 && ang < 2.85) continue; // reserve lower-left for soaring white dove!
    const p = onRing(ang, 25.5);
    const tan = ang + Math.PI / 2;
    g.petal(p.x, p.y, tan + 0.55, 8.0, 1.8, P.fernD, P.fernM, P.fernL);
    g.petal(p.x, p.y, tan - 0.5, 7.2, 1.7, P.fernD, P.fernL, '#def2c2');
  }

  // Rich 5-lobed deep-emerald ivy leaves clustered generously (especially upper-right & all corners!)
  for (const [ang, rOff, R] of [
    [-0.95, 0, 6.8],
    [-0.65, 1.2, 7.4],
    [-0.35, -0.5, 6.4],
    [-1.45, 0.5, 5.8],
    [-2.05, 0, 5.4],
    [-2.42, 0.5, 5.8],
    [0.25, 0.6, 5.6],
    [0.68, 0.4, 6.2],
    [1.15, 0, 5.2],
    [1.72, 0.5, 6.0],
    [2.95, 0, 5.6],
  ]) {
    const p = onRing(ang, 25.2 + rOff);
    g.ivyLeaf(p.x, p.y, R, ang + 0.3, P.ivyD, P.ivyM, P.ivyL);
  }

  // Delicate white lily-of-the-valley (铃兰) bell racemes!
  for (const [bx, by, dx, dy] of [
    [40, 8, 2, -2],
    [49, 21, 2.2, 1],
    [11, 28, 1.8, 1.5],
    [39, 54, 2, -1],
  ]) {
    for (let b = 0; b < 3; b++) {
      const x = bx + dx * b, y = by + dy * b;
      g.disc(x, y, 1.5, '#cbd9d4');
      g.rect(x - 1, y - 1, 2, 2, '#ffffff');
    }
  }

  g.outline(P.out);

  // Hero Soaring White Dove at Lower-Left (~7:30 o'clock) with BOTH WINGS SPREAD WIDE!
  const paintSoaringDove = (beat) => {
    const f = new Grid();
    const cx = 16, cy = 46;
    // Fanned white tail feathers lower-left
    for (const a of [2.35, 2.65, 2.95]) {
      f.petal(cx - 2, cy + 2, a, 8.2, 2.2, '#adbcc9', '#edf3f8', '#ffffff');
    }
    // Far/right outstretched wing reaching toward center-bottom
    const rAng = -0.18 - beat * 0.16;
    f.petal(cx + 2, cy, rAng, 13.5, 3.0, '#9fb0bf', '#e6eef5', '#ffffff');
    f.petal(cx + 2, cy + 1, rAng + 0.22, 10.5, 2.4, '#b0c0cf', '#f5f9fc', '#ffffff');
    // Left/upper grand feathered wing sweeping high up the left arc!
    const lAng = -2.05 + beat * 0.16;
    f.petal(cx - 1, cy - 1, lAng, 15.5, 3.8, '#9fb0bf', '#eef5fa', '#ffffff');
    f.petal(cx - 2, cy, lAng - 0.22, 13.0, 3.0, '#aebdca', '#f7fbff', '#ffffff');
    f.petal(cx, cy - 2, lAng + 0.2, 11.5, 2.5, '#c2d0dc', '#ffffff', '#ffffff');
    // Graceful breast, head & beak facing inward-right
    f.disc(cx + 1, cy + 1, 4.2, '#dce6ef', 3.6);
    f.disc(cx + 1.2, cy + 0.6, 3.4, '#ffffff', 3.0);
    f.disc(cx + 4.2, cy - 2.2, 2.6, '#ffffff', 2.4);
    f.px(cx + 5, cy - 3, '#262938');
    f.line(cx + 6.5, cy - 2, cx + 8, cy - 1.5, '#eba044');
    f.px(cx + 1, cy + 4, '#d97b6c');
    f.outline('#5b6d7d', g);
    return f;
  };

  const w0 = paintSoaringDove(0);
  const w1 = paintSoaringDove(1);
  const w2 = paintSoaringDove(-0.7);

  return svg(g, [
    animGroup([w0, w1, w0, w2], 170, [4, 3, 4, 3]),
    animGroup(
      [
        sparkleFrame([[44, 7, 2], [56, 28, 1]]),
        null,
        sparkleFrame([[8, 22, 1], [46, 52, 2]]),
        null,
      ],
      300,
      [2, 3, 2, 3],
    ),
  ]);
}

/* ═══════════════════ 3. 桃夭 · 灼华 (frame_vernal_peach.svg) ═══════════════════ */
function buildVernalPeach() {
  const g = new Grid();
  const P = {
    barkD: '#4a2c2a',
    barkM: '#754842',
    barkL: '#a16a5e',
    pkD: '#c95b7e',
    pkM: '#f29bb6',
    pkL: '#ffd6e4',
    crD: '#bfa684',
    crM: '#f7ebd2',
    crL: '#ffffff',
    leafD: '#3b6938',
    leafM: '#6da358',
    leafL: '#a9d687',
    ribD: '#ba5979',
    ribM: '#eb8eab',
    ribL: '#ffc9da',
    gold: '#cfa042',
    goldL: '#ffe794',
    out: '#42202b',
  };

  paintChain(g, -2.2, -1.2, 23.4, 4.8, P.gold, P.goldL);
  paintChain(g, 2.1, 2.9, 24.5, 4.2, P.gold, P.goldL);
  paintWoodWreath(g, P.barkD, P.barkM, P.barkL);

  // Tender green peach leaves around the wreath & corners
  for (let k = 0; k < 20; k++) {
    const ang = (k / 20) * TAU;
    const p = onRing(ang, 25.8);
    g.petal(p.x, p.y, ang + 1.2, 7.2, 1.9, P.leafD, P.leafM, P.leafL);
    if (k % 2 === 0) g.petal(p.x, p.y, ang - 1.1, 6.4, 1.7, P.leafD, P.leafL, '#d8f2be');
  }

  // Generous clusters of 5-petal sakura-pink & cream-ivory peach blossoms covering all corners!
  for (const [ang, rOff, R, cream] of [
    [-2.35, 0, 5.8, false],
    [-2.58, 1.5, 4.6, true],
    [-2.05, -0.5, 4.8, false],
    [-1.45, 0.4, 5.0, false],
    [-1.05, 0.2, 5.4, false],
    [-0.32, 0.8, 5.2, false],
    [0.05, 0.4, 4.8, true],
    [0.38, 0.6, 5.2, false],
    [1.82, 0.5, 4.8, true],
    [2.25, 0.4, 6.0, false],
    [2.48, 1.6, 5.2, false],
    [2.68, -0.4, 4.6, true],
    [3.05, 0.5, 4.8, false],
  ]) {
    const p = onRing(ang, 25.4 + rOff);
    if (cream) g.blossom5(p.x, p.y, R, ang, P.crD, P.crM, P.crL, '#e89b48', '#fff7c2');
    else g.blossom5(p.x, p.y, R, ang, P.pkD, P.pkM, P.pkL, '#d4486e', P.goldL);
  }

  // Plush Blush-Pink Silk Ribbon Bow with flowing tails at lower-right (~4:30 o'clock, (48, 46))!
  const bx = 48, by = 46;
  // Left & right ribbon tails curving gracefully
  g.quad(bx - 1, by + 2, bx - 9, by + 13, bx - 22, by + 11, P.ribD, 2.2, 1.1);
  g.quad(bx - 1, by + 2, bx - 9, by + 12, bx - 21, by + 10, P.ribM, 1.4, 0.7);
  g.quad(bx + 2, by + 2, bx + 10, by + 8, bx + 5, by + 16, P.ribD, 2.0, 0.9);
  g.quad(bx + 2, by + 2, bx + 9, by + 8, bx + 5, by + 15, P.ribL, 1.2, 0.6);
  // Plush bow loops + knot
  g.petal(bx, by, -2.55, 8.5, 3.6, P.ribD, P.ribM, P.ribL, 0.45);
  g.petal(bx, by, 0.25, 8.5, 3.6, P.ribD, P.ribM, P.ribL, 0.45);
  g.disc(bx, by, 2.3, P.ribD);
  g.disc(bx - 0.3, by - 0.3, 1.6, P.ribL);

  g.outline(P.out);

  // Animated Swinging Golden Bell (金铃) tucked beneath the silk bow!
  const bellFrames = [-1, 0, 1, 0].map((s) => {
    const f = new Grid();
    const gx = bx - 3 + s, gy = by + 7;
    f.line(bx - 2, by + 2, gx, gy - 2, P.gold);
    f.disc(gx, gy, 2.5, P.gold, 2.3);
    f.disc(gx - 0.4, gy - 0.4, 1.7, P.goldL, 1.6);
    f.rect(gx - 2, gy + 1, 5, 1, '#9c6c22');
    f.px(gx, gy + 2, '#6e4514');
    f.outline(P.out, g);
    return f;
  });

  // Hero Azure Spring Swallow (春燕) swooping at upper-right (~2 o'clock, (48, 14))!
  const paintSwallow = (flap) => {
    const f = new Grid();
    const sx = 48, sy = 14;
    // Long scissored forked swallow tail extending upper-right
    f.line(sx + 3, sy - 1, sx + 12, sy - 7, '#275582', 0.85);
    f.line(sx + 4, sy + 1, sx + 13, sy - 2, '#275582', 0.85);
    // Streamlined azure-sapphire back & white/peach throat
    f.disc(sx, sy, 4.2, '#2f6ca3', 2.6);
    f.disc(sx - 0.5, sy - 0.5, 3.4, '#5aa2de', 2.0);
    f.disc(sx - 2, sy + 1, 2.5, '#fff7f2', 1.5);
    f.disc(sx - 3.8, sy - 0.2, 2.2, '#3a75ab', 2.0);
    f.disc(sx - 4.2, sy + 0.6, 1.4, '#f58e87', 1.1); // rufous swallow throat!
    f.px(sx - 4.5, sy - 0.8, '#141926');
    f.px(sx - 6, sy - 0.2, '#262b3b');
    // Swept pointed sapphire wings
    f.petal(sx, sy - 1, -1.65 + flap * 0.24, 11.8, 2.7, '#245280', '#4d94cf', '#a3d5ff', 0.68);
    f.petal(sx + 1, sy + 1, 0.35 - flap * 0.2, 10.6, 2.5, '#245280', '#3f81ba', '#8bc5f5', 0.68);
    f.outline('#1d3554', g);
    return f;
  };
  const sw0 = paintSwallow(0);
  const sw1 = paintSwallow(1);
  const sw2 = paintSwallow(-0.8);

  // Drifting sakura petals
  const petalFrames = [0, 1, 2, 3, 4, 5].map((i) => {
    const f = new Grid();
    const px = 42 - i * 4, py = 16 + i * 5;
    f.rect(px, py, 2, 2, P.pkM);
    f.px(px, py, P.pkL);
    const px2 = 12 + i * 2, py2 = 22 + i * 4;
    f.rect(px2, py2, 2, 1, P.pkL);
    return f;
  });

  return svg(g, [
    animGroup(bellFrames, 210),
    animGroup([sw0, sw1, sw0, sw2], 150, [4, 2, 4, 2]),
    animGroup(petalFrames, 240),
  ]);
}

/* ═══════════════════ 4. 暮华 · 沉月 (frame_nocturne_peach.svg) ═══════════════════ */
function buildNocturnePeach() {
  const g = new Grid();
  const P = {
    barkD: '#302640',
    barkM: '#534369',
    barkL: '#816f99',
    lavD: '#59588f',
    lavM: '#8f92cc',
    lavL: '#d2d6fa',
    blD: '#9c688c',
    blM: '#d9a3c4',
    blL: '#fae3f2',
    leafD: '#22424a',
    leafM: '#3b6b73',
    leafL: '#6ca1a6',
    silv: '#8fa0bd',
    silvL: '#e1ecff',
    gold: '#baa26a',
    goldL: '#f5e4b3',
    moon: '#f7ecc4',
    moonHi: '#ffffff',
    out: '#1c172b',
  };

  // Draped silver & moonlight-gold chains
  paintChain(g, -1.9, -1.05, 23.2, 5.2, P.silv, P.silvL);
  paintChain(g, -0.5, 0.55, 23.8, 4.8, P.gold, P.goldL);
  paintChain(g, 0.75, 1.75, 25.0, 5.0, P.silv, P.silvL);

  paintWoodWreath(g, P.barkD, P.barkM, P.barkL, -2.35, 0.36);

  // Twilight blue-teal pointed peach leaves (leaving top-left moon cradle open)
  for (let k = 0; k < 20; k++) {
    const ang = (k / 20) * TAU;
    const daMoon = Math.atan2(Math.sin(ang + 2.35), Math.cos(ang + 2.35));
    if (Math.abs(daMoon) < 0.36) continue;
    const p = onRing(ang, 25.8);
    g.petal(p.x, p.y, ang + 1.25, 7.4, 1.9, P.leafD, P.leafM, P.leafL);
    if (k % 2 === 1) g.petal(p.x, p.y, ang - 1.15, 6.5, 1.7, P.leafD, P.leafL, '#a8d9db');
  }

  // Glowing Crescent Moon forming the upper-left bridge (~10:30 o'clock) & masking the portrait corner!
  for (let y = 3; y <= 27; y++) {
    for (let x = 3; x <= 27; x++) {
      const r1Sq = (x - 15.2) ** 2 + (y - 15.2) ** 2;
      const r2Sq = (x - 19.6) ** 2 + (y - 11.8) ** 2;
      if (r1Sq <= 9.6 ** 2 && r2Sq > 8.0 ** 2) {
        const rim = r1Sq > 8.4 ** 2 || r2Sq < 9.0 ** 2;
        g.px(x, y, rim ? '#dfc680' : x + y < 27 ? P.moonHi : P.moon);
      }
    }
  }

  // Lush 5-petal lavender-indigo & pale moonlight-blush peach blossoms
  for (const [ang, rOff, R, blush] of [
    [-1.85, 0.8, 4.6, true],
    [-2.78, 0.8, 4.6, false],
    [-1.35, 0.2, 5.6, false],
    [-0.95, 0.6, 5.8, false],
    [-0.52, 0.4, 6.0, true],
    [-0.25, 1.4, 5.0, false],
    [0.42, 0.5, 5.2, false],
    [1.22, 0.4, 5.8, false],
    [1.68, 0.4, 5.6, true],
    [1.98, -0.3, 5.0, false],
    [2.85, 0.4, 4.8, true],
  ]) {
    const p = onRing(ang, 25.4 + rOff);
    if (blush) g.blossom5(p.x, p.y, R, ang, P.blD, P.blM, P.blL, '#7d4b73', P.moonHi);
    else g.blossom5(p.x, p.y, R, ang, P.lavD, P.lavM, P.lavL, '#434173', P.silvL);
  }

  g.outline(P.out);

  // Carved Celadon Jade Ring Pendant (玉玦) + Twin Indigo Silk Tassels at Lower-Left ((15, 49))!
  const jadeFrames = [-1, 0, 1, 0].map((sway) => {
    const f = new Grid();
    const jx = 15, jy = 49;
    // Silver suspension chains from the branch
    f.line(12, 42, jx, jy - 4, P.silvL);
    f.line(19, 44, jx, jy - 4, P.silv);
    // Carved round celadon jade ring with central hole & cleft (玉玦)
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 18 || d2 < 2.2) continue;
        if (dx > 1 && Math.abs(dy) < 1) continue; // 玦 cleft!
        f.px(jx + dx, jy + dy, dx + dy < -1 ? '#e2fcf3' : dx + dy > 2 ? '#6fa896' : '#a8decb');
      }
    }
    // Twin flowing indigo-violet silk tassels swaying gently!
    f.quad(jx - 2, jy + 4, jx - 3 + sway * 0.5, jy + 8, jx - 2 + sway, jy + 13, '#3b3c6e', 1.1, 1.4);
    f.quad(jx - 2, jy + 4, jx - 3 + sway * 0.5, jy + 8, jx - 2 + sway, jy + 12, '#6c70ad', 0.6, 0.7);
    f.quad(jx + 1, jy + 4, jx + 2 + sway * 0.5, jy + 9, jx + 3 + sway, jy + 14, '#3b3c6e', 1.1, 1.5);
    f.quad(jx + 1, jy + 4, jx + 2 + sway * 0.5, jy + 9, jx + 3 + sway, jy + 13, '#7b80bf', 0.6, 0.7);
    f.px(jx - 2, jy + 4, P.silvL);
    f.px(jx + 1, jy + 4, P.silvL);
    f.outline(P.out, g);
    return f;
  });

  // Luminous Translucent Moonlit Butterfly (灵蝶) resting & pulsing wings at ~8 o'clock ((9, 36))!
  const bflyFrames = [1.0, 0.72, 0.46, 0.72].map((open) => {
    const f = new Grid();
    const bx = 9, by = 35;
    // Left & right sculpted forewings + hindwings
    f.petal(bx, by, -2.25, 9.8 * open + 2, 3.6 * open + 0.8, '#5f8ec7', '#cbe8ff', '#ffffff', 0.45);
    f.petal(bx, by, -0.75, 9.0 * open + 2, 3.3 * open + 0.8, '#5f8ec7', '#dcf1ff', '#ffffff', 0.45);
    f.petal(bx, by + 1, 2.55, 6.8 * open + 1.5, 2.5 * open + 0.6, '#5681b8', '#b8deff', '#f0f9ff', 0.52);
    f.petal(bx + 1, by + 1, 0.55, 6.2 * open + 1.5, 2.2 * open + 0.5, '#5681b8', '#b8deff', '#f0f9ff', 0.52);
    f.line(bx - 1, by - 2, bx + 1, by + 3, '#2d3a5e');
    f.outline('#29385c', g);
    return f;
  });

  return svg(g, [
    animGroup(jadeFrames, 240),
    animGroup(bflyFrames, 200, [5, 2, 3, 2]),
    animGroup(
      [
        sparkleFrame([[24, 7, 2], [56, 20, 1]], '#ffffff', P.silvL),
        null,
        sparkleFrame([[52, 46, 2], [6, 24, 1]], '#ffffff', P.moon),
        null,
      ],
      320,
      [2, 3, 2, 3],
    ),
  ]);
}

/* ═══════════════════ 5. 荷影 · 锦鲤 (frame_lotus_koi.svg) ═══════════════════ */
function buildLotusKoi() {
  const g = new Grid();
  const P = {
    w0: '#194a4d',
    w1: '#286c6c',
    w2: '#42948c',
    w3: '#6ec2b4',
    foam: '#d7faf0',
    padD: '#1e5438',
    padM: '#368052',
    padL: '#67b874',
    padHi: '#a4e398',
    pkD: '#ba436b',
    pkM: '#eb7da1',
    pkL: '#ffd1e0',
    gold: '#ffd666',
    out: '#1c5252',
  };

  // 1. Lush swirling jade-celadon water channel ring (r = 21.8 .. 29.2) masking square corners!
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x - C0, dy = y - C0;
      const ang = Math.atan2(dy, dx);
      const rIn = 21.6 + 0.5 * Math.sin(ang * 5);
      const rOut = 28.8 + 1.1 * Math.sin(ang * 6 + 0.8) + 0.6 * Math.cos(ang * 9);
      const r = Math.hypot(dx, dy);
      if (r < rIn || r > rOut) continue;
      const u = (r - rIn) / (rOut - rIn);
      const swirl = Math.sin(ang * 4 - r * 0.55);
      let col = P.w1;
      if (u < 0.14 || u > 0.88) col = P.w0;
      else if (swirl > 0.68) col = P.foam;
      else if (swirl > 0.2) col = P.w3;
      else if (u > 0.3 && u < 0.72) col = P.w2;
      g.px(x, y, col);
    }
  }

  // Record a pad occlusion mask so the 2 animated koi genuinely swim UNDER the corner lotus pads!
  const padMask = new Uint8Array(N * N);
  const paintPad = (cx, cy, R, notch) => {
    const ry = R * 0.82;
    for (let dy = -Math.ceil(ry + 1); dy <= Math.ceil(ry + 1); dy++) {
      for (let dx = -Math.ceil(R + 1); dx <= Math.ceil(R + 1); dx++) {
        const ang = Math.atan2(dy / 0.82, dx);
        const wave = 1 + 0.06 * Math.sin(ang * 6);
        const d2 = (dx / R) ** 2 + (dy / ry) ** 2;
        if (d2 > wave * wave) continue;
        const da = Math.atan2(Math.sin(ang - notch), Math.cos(ang - notch));
        if (Math.abs(da) < 0.28 && d2 > 0.08) continue;
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        if (px >= 0 && px < N && py >= 0 && py < N) padMask[py * N + px] = 1;
        const edge = d2 > (wave - 0.16) ** 2;
        const col = edge ? (dx + dy < 0 ? P.padHi : P.padD) : dx + dy < -R * 0.35 ? P.padL : P.padM;
        g.px(px, py, col);
      }
    }
    for (let k = 1; k < 7; k++) {
      const ang = notch + (k / 7) * TAU;
      for (let s = 1.5; s < R * 0.78; s += 1) {
        g.px(cx + Math.cos(ang) * s, cy + Math.sin(ang) * s * 0.82, P.padL);
      }
    }
    g.px(cx, cy, P.padHi);
  };

  // Giant ruffled lotus pads & sacred pink lotus blooms over the 4 corners!
  paintPad(12, 50, 9.2, -0.7);
  paintPad(21, 56, 5.8, 2.1);
  paintPad(52, 13, 8.6, 2.4);
  paintPad(57, 22, 5.2, 0.5);
  paintPad(12, 13, 5.8, 0.9);
  paintPad(51, 51, 5.8, -2.2);

  // Hero multi-petal pink sacred lotus at lower-left (10, 44) & upper-right bud/pod (50, 9)
  const paintLotus = (cx, cy, R) => {
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * TAU;
      g.petal(cx, cy, ang, R, R * 0.36, P.pkD, P.pkM, P.pkL, 0.55);
    }
    for (let k = 0; k < 6; k++) {
      const ang = ((k + 0.5) / 6) * TAU;
      g.petal(cx, cy - 0.5, ang, R * 0.68, R * 0.28, P.pkM, P.pkL, '#ffffff', 0.55);
    }
    g.disc(cx, cy, 2.0, P.gold);
    for (let dy = -Math.ceil(R * 0.8); dy <= Math.ceil(R * 0.8); dy++) {
      for (let dx = -Math.ceil(R * 0.8); dx <= Math.ceil(R * 0.8); dx++) {
        if (dx * dx + dy * dy <= (R * 0.75) ** 2) {
          const px = Math.round(cx + dx), py = Math.round(cy + dy);
          if (px >= 0 && px < N && py >= 0 && py < N) padMask[py * N + px] = 1;
        }
      }
    }
  };
  paintLotus(11, 43, 7.5);
  paintLotus(51, 9, 5.8);

  // Pearl water droplets on pads
  g.rect(14, 52, 2, 2, '#ffffff');
  g.rect(53, 15, 2, 2, '#ffffff');

  g.outline(P.out);

  // 2. Two Plump Curved-Spine Pixel Koi circling smoothly in 20 SMIL frames!
  const FRAMES = 20;
  const koiFrames = [];
  for (let fIdx = 0; fIdx < FRAMES; fIdx++) {
    const f = new Grid();
    const putWater = (x, y, col) => {
      const X = Math.round(x), Y = Math.round(y);
      if (X < 0 || X >= N || Y < 0 || Y >= N) return;
      if (padMask[Y * N + X]) return;
      f.px(X, Y, col);
    };

    const S_STEPS = 26;
    for (const [fishIdx, kohaku] of [[0, false], [1, true]]) {
      const headAng = (fIdx / FRAMES) * TAU + fishIdx * Math.PI;
      const rOrbit = 25.3;
      const spine = [];
      for (let s = 0; s < S_STEPS; s++) {
        const u = s / (S_STEPS - 1);
        const a = headAng - u * 0.66;
        const wag = Math.sin(fIdx * 0.95 - u * 4.5 + fishIdx) * (u * 1.35);
        const rr = rOrbit + wag;
        spine.push({
          x: C0 + Math.cos(a) * rr,
          y: C0 + Math.sin(a) * rr,
          nx: Math.cos(a),
          ny: Math.sin(a),
          tan: a + Math.PI / 2,
        });
      }
      const pal = kohaku
        ? { base: '#fff9f5', edge: '#d9cbc3', patch: '#ef3e36', hi: '#ffffff', fin: '#fff7f2' }
        : { base: '#ff6b24', edge: '#c94512', patch: '#ffa83d', hi: '#fff099', fin: '#ffc46b' };

      // Fanned pectoral fins
      const pec = spine[5];
      for (const side of [-1, 1]) {
        for (let da = -0.3; da <= 0.3; da += 0.3) {
          const fa = pec.tan + Math.PI + side * (1.05 + da);
          for (let r = 1.2; r <= 3.8; r += 0.55) {
            putWater(pec.x + Math.cos(fa) * r, pec.y + Math.sin(fa) * r, r > 2.6 ? pal.hi : pal.fin);
          }
        }
      }
      // Flowing forked caudal tail lobes
      const tail = spine[S_STEPS - 3];
      const backA = tail.tan + Math.PI;
      for (const lobe of [-0.52, -0.25, 0.25, 0.52]) {
        for (let r = 0.5; r <= 4.8; r += 0.5) {
          putWater(
            tail.x + Math.cos(backA + lobe) * r,
            tail.y + Math.sin(backA + lobe) * r,
            r > 3.0 ? pal.hi : pal.fin,
          );
        }
      }
      // Plump solid tapered koi body (26 dense ribs -> zero gaps!)
      for (let s = S_STEPS - 3; s >= 0; s--) {
        const u = s / (S_STEPS - 3);
        const hw =
          u < 0.24
            ? 1.3 + (u / 0.24) * 1.65
            : Math.max(0.85, (1 - (u - 0.24) * 0.88) * 2.95);
        const nd = spine[s];
        for (let w = -hw; w <= hw; w += 0.35) {
          const inPatch =
            (u >= 0.12 && u <= 0.44 && w > -0.9) ||
            (u >= 0.58 && u <= 0.82 && w < 0.9);
          const col =
            Math.abs(w) > hw - 0.55
              ? pal.edge
              : inPatch
                ? pal.patch
                : Math.abs(w) < 0.65
                  ? pal.hi
                  : pal.base;
          putWater(nd.x + nd.nx * w, nd.y + nd.ny * w, col);
        }
      }
      // Cute dark koi eyes
      const hd = spine[3];
      putWater(hd.x + hd.nx * 1.6, hd.y + hd.ny * 1.6, '#142026');
      putWater(hd.x - hd.nx * 1.6, hd.y - hd.ny * 1.6, '#142026');
      // Subtle foam wake behind tail
      const wk = onRing(headAng - 0.76, rOrbit);
      putWater(wk.x, wk.y, P.foam);
    }
    koiFrames.push(f);
  }

  return svg(g, [
    animGroup(koiFrames, 145),
    animGroup(
      [
        sparkleFrame([[15, 53, 1], [34, 6, 1]], '#ffffff', P.foam),
        null,
        sparkleFrame([[54, 16, 1], [6, 33, 1]], '#ffffff', P.foam),
        null,
      ],
      320,
      [2, 3, 2, 3],
    ),
  ]);
}

/* ─────────────────────────── Build All 5 SVG Assets ─────────────────────────── */

const outDir = process.argv[2] ?? join(process.cwd(), 'public/frames');
mkdirSync(outDir, { recursive: true });

const files = [
  ['frame_revival_olive.svg', buildRevivalOlive()],
  ['frame_revival_ivy.svg', buildRevivalIvy()],
  ['frame_vernal_peach.svg', buildVernalPeach()],
  ['frame_nocturne_peach.svg', buildNocturnePeach()],
  ['frame_lotus_koi.svg', buildLotusKoi()],
];

for (const [name, content] of files) {
  writeFileSync(join(outDir, name), content, 'utf8');
  console.log(`Wrote ${name} (${(content.length / 1024).toFixed(1)} KB)`);
}
