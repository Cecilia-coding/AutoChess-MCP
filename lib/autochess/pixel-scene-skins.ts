/**
 * "Living canvas" board skins:
 * - Zero rectangular box frame; organic foliage, rocks, roses, and celestial props spill across edges.
 * - Bold, large-scale central pixel paintings (mandalas, gothic crests, interlocking astrolabes,
 *   rippling mountain spring pools, moonlit koi & giant lotus islands) spanning 60%–80% of the arena,
 *   harmonized in contrast so pixel units remain crisp and readable on top.
 * - Subtle invisible intersection skeleton for the 5×8 grid + 9 thematic bench seats.
 */
import type { PixelBoard } from './pixel-board';
import {
  ART,
  Art,
  BENCH_CAPACITY,
  band,
  bayer,
  flagstone,
  hash2,
  layout,
  makeLayer,
  mix,
  rgba,
  rng,
  skeleton,
  vnoise,
  type Lay,
  type Pal,
  type Rng,
} from './pixel-scene-kit';
import { ATELIER_BACKDROP, ATELIER_SCENES } from './pixel-scene-atelier';

export type PixelSceneId =
  | 'lotus-pond'
  | 'spring-meadow'
  | 'rose-dusk'
  | 'astral-ivory'
  | 'astral-night'
  | 'bamboo-grove'
  | 'coral-lagoon'
  | 'wisteria-brook'
  | 'embroidery-hoop'
  | 'wonderland-rabbit'
  | 'carousel-night';

export const PIXEL_SCENE_IDS: readonly PixelSceneId[] = [
  'lotus-pond',
  'spring-meadow',
  'rose-dusk',
  'astral-ivory',
  'astral-night',
  'bamboo-grove',
  'coral-lagoon',
  'wisteria-brook',
  'embroidery-hoop',
  'wonderland-rabbit',
  'carousel-night',
];

type Plan = Record<string, any>;
type Scene = {
  plan(L: Lay, r: Rng): Plan;
  paint(a: Art, L: Lay, P: Plan, r: Rng): void;
  anim(a: Art, L: Lay, P: Plan, t: number): void;
};

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrap = (v: number, m: number) => ((v % m) + m) % m;
const benchSlots = (L: Lay) =>
  Array.from({ length: BENCH_CAPACITY }, (_, i) => ({ x: L.bl + i * L.bs, y: L.by }));

/* ───────────────────────── Shared Large-Scale Pixel Botanicals ───────────────────────── */

/**
 * Large sculpted ruffled lotus leaf (R = 8..28 art-px) with scalloped edge, V-cleft notch,
 * radial veins, sunlit rim, pearl water droplets, and optional occlusion mask recording.
 */
function sculptLotusPad(
  a: Art,
  cx: number,
  cy: number,
  R: number,
  notch: number,
  C: Pal,
  mask?: Uint8Array,
  seed = 1,
) {
  const ry = R * 0.76;
  const X = Math.round(cx), Y = Math.round(cy);
  const bx = Math.ceil(R + 3), by = Math.ceil(ry + 3);

  const insidePad = (dx: number, dy: number, shrink = 0) => {
    const rr = R - shrink, rry = ry - shrink * 0.78;
    if (rr <= 0.5 || rry <= 0.5) return false;
    const nx = dx / rr, ny = dy / rry;
    const ang = Math.atan2(dy / 0.76, dx);
    const wave = 1 + 0.055 * Math.sin(ang * 7 + seed) + 0.03 * Math.cos(ang * 11 - seed);
    const d2 = nx * nx + ny * ny;
    if (d2 > wave * wave) return false;
    const da = Math.atan2(Math.sin(ang - notch), Math.cos(ang - notch));
    const cleftW = 0.26 + 0.08 * (1 - Math.sqrt(Math.min(1, d2)));
    if (Math.abs(da) < cleftW && d2 > 0.05) return false;
    return true;
  };

  // Soft underwater cast shadow
  a.alpha(0.38, () => {
    a.fill(C.shadow!);
    for (let dy = -by; dy <= by; dy++) {
      for (let dx = -bx; dx <= bx; dx++) {
        if (insidePad(dx, dy, 0)) a.p(X + dx + 2, Y + dy + 3);
      }
    }
  });

  // Layered leaf body with scalloped sunlit rim & radial veins
  for (let dy = -by; dy <= by; dy++) {
    for (let dx = -bx; dx <= bx; dx++) {
      if (!insidePad(dx, dy, 0)) continue;
      const px = X + dx, py = Y + dy;
      if (mask && px >= 0 && px < a.W && py >= 0 && py < a.H) {
        mask[py * a.W + px] = 1;
      }
      const edge = !insidePad(dx, dy, 1.25);
      const inner = insidePad(dx, dy, R * 0.34);
      const core = dx * dx + (dy / 0.76) ** 2 <= Math.max(2.2, R * 0.14) ** 2;
      const litSide = dx * -0.55 + dy * -0.82 > R * 0.32;
      let col = C.pad!;
      if (edge) {
        col = litSide ? C.padRim! : C.padD!;
      } else if (core) {
        col = C.padCore!;
      } else {
        const lightVal = (-dx * 0.45 - dy * 0.75) / Math.max(1, R);
        if (lightVal > 0.22 + (bayer(px, py) - 0.5) * 0.22) col = C.padL!;
        else if (lightVal < -0.24 + (bayer(px, py) - 0.5) * 0.22) col = C.padD!;
        else if (inner) col = C.padM!;
      }
      a.p(px, py, col);
    }
  }

  // Radial lotus veins
  if (R >= 8) {
    const veins = R >= 16 ? 9 : 7;
    for (let k = 1; k < veins; k++) {
      const ang = notch + (k / veins) * TAU;
      const maxS = R * 0.84;
      for (let s = 2.2; s < maxS; s += 0.85) {
        const vx = X + Math.cos(ang) * s;
        const vy = Y + Math.sin(ang) * s * 0.76;
        a.p(vx, vy, s < maxS * 0.55 ? C.veinL! : C.vein!);
      }
    }
    a.disc(X, Y, 1.3, 1.0, C.padCore!);
    a.p(X, Y, C.veinL!);
  }

  // Pearl water droplets on large pads
  if (R >= 13) {
    const dAng = notch + 2.2 + (seed % 3) * 0.7;
    const dx = Math.round(X + Math.cos(dAng) * R * 0.42);
    const dy = Math.round(Y + Math.sin(dAng) * ry * 0.42);
    a.r(dx, dy, 2, 2, C.dropS!);
    a.r(dx - 1, dy - 1, 2, 2, C.drop!);
    a.p(dx - 1, dy - 1, '#ffffff');
  }
}

/**
 * Large multi-layered sacred lotus blossom (R = 7..15 art-px => 14..30 art-px across!).
 */
function sculptLotusBloom(
  a: Art,
  cx: number,
  cy: number,
  R: number,
  C: { deep: string; mid: string; light: string; tip: string; gold: string; pod: string },
  rot = 0,
) {
  a.alpha(0.32, () => a.disc(cx + 1, cy + 2, R * 0.95, R * 0.78, '#102e30'));
  // Outer 8 wide petals
  for (let k = 0; k < 8; k++) {
    const ang = rot + (k / 8) * TAU;
    const len = R * (jaggedAlt(k) ? 1.04 : 0.94);
    a.petal(
      cx + Math.cos(ang) * (R * 0.12),
      cy + Math.sin(ang) * (R * 0.1),
      ang,
      len,
      R * 0.34,
      C.deep,
      C.mid,
      C.light,
      0.58,
    );
  }
  // Inner 8 cupped upright petals
  for (let k = 0; k < 8; k++) {
    const ang = rot + ((k + 0.5) / 8) * TAU;
    a.petal(
      cx + Math.cos(ang) * (R * 0.08),
      cy + Math.sin(ang) * (R * 0.06) - 0.6,
      ang,
      R * 0.68,
      R * 0.25,
      C.mid,
      C.light,
      C.tip,
      0.55,
    );
  }
  // Golden stamen ring + jade seed receptacle
  const cr = Math.max(2, R * 0.26);
  a.disc(cx, cy - 0.5, cr + 1.1, (cr + 1.1) * 0.82, C.gold);
  a.disc(cx, cy - 0.5, cr * 0.72, cr * 0.6, C.pod);
  a.p(cx - 1, cy - 1, '#fffbe0');
}
const jaggedAlt = (k: number) => k % 2 === 0;

/**
 * Large multi-petal white daisy / camomile flower (R = 5..9 art-px => 11..19 art-px across).
 */
function sculptDaisy(
  a: Art,
  cx: number,
  cy: number,
  R: number,
  petals = 10,
  rot = 0,
  tint: 'white' | 'cream' | 'blush' = 'white',
) {
  const edge = tint === 'blush' ? '#d9a7b8' : tint === 'cream' ? '#d6ccb0' : '#c6d6cb';
  const body = tint === 'blush' ? '#fdebf1' : tint === 'cream' ? '#fdf8e6' : '#f8fcf7';
  const hi = '#ffffff';
  a.alpha(0.22, () => a.disc(cx + 1, cy + 1.5, R * 0.92, R * 0.84, '#2d4227'));
  for (let k = 0; k < petals; k++) {
    const ang = rot + (k / petals) * TAU;
    a.petal(
      cx + Math.cos(ang) * (R * 0.12),
      cy + Math.sin(ang) * (R * 0.12),
      ang,
      R * 1.02,
      Math.max(1.5, R * 0.28),
      edge,
      body,
      hi,
      0.48,
    );
  }
  const cr = Math.max(1.3, R * 0.24);
  a.disc(cx, cy, cr + 0.35, cr + 0.35, '#d48d2a');
  a.disc(cx, cy - 0.2, cr * 0.78, cr * 0.78, '#ffd147');
  a.p(cx - 0.5, cy - 0.6, '#fff9c4');
}

/**
 * Lush spiral-layered velvet rose blossom (R = 5..13 art-px => 11..26 art-px across!).
 */
function sculptVelvetRose(
  a: Art,
  cx: number,
  cy: number,
  R: number,
  pal: { abyss: string; deep: string; mid: string; bright: string; rim: string },
  seed = 0,
) {
  a.alpha(0.36, () => a.disc(cx + 1, cy + 2, R + 0.8, R * 0.92, '#140b18'));
  // Outer 5 ruffled petals
  for (let k = 0; k < 5; k++) {
    const ang = seed + (k / 5) * TAU;
    const px = cx + Math.cos(ang) * (R * 0.42);
    const py = cy + Math.sin(ang) * (R * 0.38);
    a.disc(px, py, R * 0.62, R * 0.56, pal.abyss);
    a.disc(px - 0.3, py - 0.4, R * 0.52, R * 0.46, pal.deep);
    a.arc(px, py, R * 0.48, R * 0.42, ang - 0.9, ang + 0.9, pal.mid);
  }
  // Middle 5 cupped petals
  for (let k = 0; k < 5; k++) {
    const ang = seed + 0.62 + (k / 5) * TAU;
    const px = cx + Math.cos(ang) * (R * 0.26);
    const py = cy + Math.sin(ang) * (R * 0.24);
    a.disc(px, py, R * 0.44, R * 0.4, pal.deep);
    a.disc(px - 0.3, py - 0.4, R * 0.34, R * 0.31, pal.mid);
    a.arc(px, py, R * 0.33, R * 0.3, ang - 1.0, ang + 0.8, pal.bright);
  }
  // Inner spiral whorl
  a.disc(cx, cy, R * 0.32, R * 0.29, pal.abyss);
  a.disc(cx, cy - 0.3, R * 0.24, R * 0.22, pal.bright);
  for (let s = 0; s < 10; s++) {
    const t = s / 10;
    const ang = seed + t * TAU * 1.65;
    const rr = t * R * 0.28;
    a.p(cx + Math.cos(ang) * rr, cy - 0.2 + Math.sin(ang) * rr * 0.88, s < 4 ? pal.rim : pal.bright);
  }
}

/** Crisp 4-point star flare of arm length `arm`. */
function starFlare(a: Art, cx: number, cy: number, arm: number, coreCol: string, glowCol: string) {
  const X = Math.round(cx), Y = Math.round(cy);
  a.fill(glowCol);
  a.r(X - arm, Y, arm * 2 + 1, 1);
  a.r(X, Y - arm, 1, arm * 2 + 1);
  if (arm >= 3) {
    a.r(X - 1, Y - 1, 3, 3);
  }
  a.fill(coreCol);
  if (arm >= 2) {
    a.r(X - Math.floor(arm * 0.45), Y, Math.floor(arm * 0.45) * 2 + 1, 1);
    a.r(X, Y - Math.floor(arm * 0.45), 1, Math.floor(arm * 0.45) * 2 + 1);
  }
  a.p(X, Y);
}

/* ═══════════════════════════ 1. 荷塘清夏 · LOTUS POND ═══════════════════════════ */

const LOTUS_PAL: Pal = {
  w0: '#164246',
  w1: '#1e585b',
  w2: '#2b7373',
  w3: '#3f918b',
  w4: '#5db0a4',
  w5: '#84ccbe',
  w6: '#b2e6d9',
  foam: '#dcf8ef',
  shadow: '#0f2f33',
  padD: '#22593c',
  pad: '#347d50',
  padM: '#4ca065',
  padL: '#77c57e',
  padRim: '#ace39b',
  padCore: '#c8f0b9',
  vein: '#296845',
  veinL: '#9ad993',
  drop: '#d7f9f2',
  dropS: '#215742',
  stem: '#296344',
  reed: '#5b8f54',
  reedL: '#92bf78',
  cattail: '#6e452c',
  cattailL: '#9c6946',
};

const LOTUS_PINK = {
  deep: '#b53f66',
  mid: '#e26f94',
  light: '#f9adc4',
  tip: '#fff0f5',
  gold: '#ffd666',
  pod: '#79b86c',
};

const LOTUS_WHITE = {
  deep: '#9eb8b2',
  mid: '#dceee8',
  light: '#f5fcfa',
  tip: '#ffffff',
  gold: '#ffd968',
  pod: '#7dc072',
};

type KoiSpec = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  lobe: number;
  period: number;
  dir: 1 | -1;
  phase: number;
  len: number;
  wid: number;
  style: 'orange' | 'kohaku' | 'gold' | 'sanke';
};

function koiPos(k: KoiSpec, sec: number) {
  const u = (sec / k.period) * TAU * k.dir + k.phase;
  return {
    x: k.cx + k.rx * Math.cos(u) + k.lobe * Math.sin(2 * u),
    y: k.cy + k.ry * Math.sin(u) + k.lobe * 0.75 * Math.sin(2 * u),
  };
}

/**
 * Plump, curved-spine animated pixel koi (22–28 art-px long, 7–9 art-px wide)
 * with pectoral/pelvic fins, undulating forked tail, Kohaku/orange markings,
 * underwater shadow, and natural occlusion underneath giant surface lotus pads!
 */
function paintCurvedKoi(a: Art, k: KoiSpec, sec: number, padMask?: Uint8Array) {
  // Dense spine sampling (~0.45 art-px per node) guarantees a 100% solid, gap-free silky body!
  const N = Math.max(36, Math.ceil(k.len * 2.4));
  const dt = (0.72 / N) * k.dir;
  const pts: { x: number; y: number; nx: number; ny: number; tx: number; ty: number }[] = [];
  for (let i = 0; i < N; i++) {
    const tSample = sec - Math.abs(dt) * i;
    const p0 = koiPos(k, tSample);
    const pAhead = koiPos(k, tSample + 0.02);
    const dx = pAhead.x - p0.x, dy = pAhead.y - p0.y;
    const dl = Math.hypot(dx, dy) || 1;
    const tx = dx / dl, ty = dy / dl;
    const nx = -ty, ny = tx;
    const u = i / (N - 1);
    const wag = Math.sin(sec * 5.0 + k.phase - u * 4.1) * (0.25 + u * u * 2.1);
    pts.push({
      x: p0.x + nx * wag,
      y: p0.y + ny * wag,
      nx,
      ny,
      tx,
      ty,
    });
  }
  const spine: typeof pts = [pts[0]!];
  const segLen = k.len / (N - 1);
  for (let i = 1; i < N; i++) {
    const prev = spine[i - 1]!;
    const raw = pts[i]!;
    const vx = raw.x - prev.x, vy = raw.y - prev.y;
    const vl = Math.hypot(vx, vy) || 1;
    const tx = -vx / vl, ty = -vy / vl;
    spine.push({
      x: prev.x + (vx / vl) * segLen,
      y: prev.y + (vy / vl) * segLen,
      nx: -ty,
      ny: tx,
      tx,
      ty,
    });
  }

  const putWaterPx = (x: number, y: number, col: string) => {
    const X = Math.round(x), Y = Math.round(y);
    if (X < 0 || X >= a.W || Y < 0 || Y >= a.H) return;
    if (padMask && padMask[Y * a.W + X]) return;
    a.c.fillStyle = col;
    a.c.fillRect(X, Y, 1, 1);
  };

  const pal =
    k.style === 'kohaku'
      ? { base: '#fff9f2', shade: '#e3dcd3', hi: '#ffffff', patch: '#e8412c', patchL: '#ff7652', fin: '#fff7f0' }
      : k.style === 'gold'
        ? { base: '#f7a828', shade: '#d48217', hi: '#fff099', patch: '#ffca45', patchL: '#fff6ba', fin: '#ffe896' }
        : k.style === 'sanke'
          ? { base: '#fff6ee', shade: '#e0d6cc', hi: '#ffffff', patch: '#f05532', patchL: '#ff8759', fin: '#fff5ec' }
          : { base: '#f76b25', shade: '#cc4914', hi: '#ffc966', patch: '#ff8e36', patchL: '#ffdb78', fin: '#ffb45c' };

  const bodyEnd = Math.floor(N * 0.82);

  // 1. Soft underwater shadow offset (+2, +3)
  a.alpha(0.3, () => {
    for (let i = 0; i < bodyEnd; i++) {
      const u = i / (bodyEnd - 1);
      const hw = k.wid * 0.48 * Math.sin(Math.pow(u, 0.58) * Math.PI);
      const s = spine[i]!;
      for (let w = -hw; w <= hw; w += 0.45) {
        putWaterPx(s.x + s.nx * w + 2, s.y + s.ny * w + 3, '#0d2c30');
      }
    }
  });

  // 2. Animated rowing pectoral & pelvic fins
  const finFlap = Math.sin(sec * 4.4 + k.phase) * 0.34;
  const pec = spine[Math.floor(bodyEnd * 0.24)]!;
  const pel = spine[Math.floor(bodyEnd * 0.58)]!;
  for (const side of [-1, 1] as const) {
    const baseAng = Math.atan2(-pec.ty, -pec.tx) + side * (1.12 + finFlap * 0.55);
    const fx0 = pec.x + pec.nx * side * (k.wid * 0.34);
    const fy0 = pec.y + pec.ny * side * (k.wid * 0.34);
    for (let r = 0.4; r <= k.wid * 0.68; r += 0.42) {
      for (let da = -0.32; da <= 0.32; da += 0.14) {
        putWaterPx(fx0 + Math.cos(baseAng + da) * r, fy0 + Math.sin(baseAng + da) * r, r > k.wid * 0.46 ? pal.hi : pal.fin);
      }
    }
    const vx0 = pel.x + pel.nx * side * (k.wid * 0.22);
    const vy0 = pel.y + pel.ny * side * (k.wid * 0.22);
    const vAng = Math.atan2(-pel.ty, -pel.tx) + side * (0.95 - finFlap * 0.35);
    for (let r = 0.4; r <= k.wid * 0.42; r += 0.45) {
      putWaterPx(vx0 + Math.cos(vAng) * r, vy0 + Math.sin(vAng) * r, pal.fin);
    }
  }

  // 3. Graceful crescent forked tail lobes tapering to delicate tips
  const tailRoot = spine[bodyEnd - 1]!;
  const tailTip = spine[N - 1]!;
  const backAng = Math.atan2(tailTip.y - tailRoot.y, tailTip.x - tailRoot.x);
  const tailLen = k.len * 0.28;
  for (const lobe of [-1, 1] as const) {
    const flutter = Math.sin(sec * 5.0 + k.phase - 3.9) * 0.16;
    const lAng = backAng + lobe * 0.42 + flutter;
    for (let s = 0; s <= tailLen; s += 0.38) {
      const u = s / tailLen;
      const lw = (1 - u) * 0.6 + Math.sin(u * Math.PI) * (k.wid * 0.24) * (1 - u * 0.35);
      const cx = tailRoot.x + Math.cos(lAng + lobe * u * 0.15) * s;
      const cy = tailRoot.y + Math.sin(lAng + lobe * u * 0.15) * s;
      const nx = -Math.sin(lAng), ny = Math.cos(lAng);
      for (let w = -lw; w <= lw; w += 0.4) {
        putWaterPx(cx + nx * w, cy + ny * w, u > 0.62 ? pal.hi : pal.fin);
      }
    }
  }

  // 4. Silky gap-free plump tapered koi body
  for (let i = bodyEnd - 1; i >= 0; i--) {
    const u = i / (bodyEnd - 1);
    const profile =
      u < 0.24
        ? 0.44 + 0.56 * Math.sin((u / 0.24) * (Math.PI / 2))
        : Math.max(0.16, Math.cos(((u - 0.24) / 0.76) * (Math.PI * 0.44)));
    const hw = k.wid * 0.5 * profile;
    const s = spine[i]!;
    for (let step = -hw; step <= hw; step += 0.38) {
      const px = s.x + s.nx * step;
      const py = s.y + s.ny * step;
      const edge = Math.abs(step) > hw - 0.55;
      const dorsal = Math.abs(step) < hw * 0.32 && u > 0.14 && u < 0.82;
      const inPatch1 = u > 0.12 && u < 0.45 && step > -hw * 0.65;
      const inPatch2 = u > 0.56 && u < 0.82 && step < hw * 0.65;
      const inkDot = k.style === 'sanke' && ((u > 0.36 && u < 0.44 && step < -0.4) || (u > 0.68 && u < 0.74 && step > 0.3));
      let col = pal.base;
      if (inkDot) col = '#27323d';
      else if (inPatch1 || inPatch2) col = dorsal ? pal.patchL : pal.patch;
      else if (edge) col = pal.shade;
      else if (dorsal) col = pal.hi;
      putWaterPx(px, py, col);
    }
  }

  // 5. Snout highlight + cute dark koi eyes
  const head = spine[Math.max(1, Math.floor(bodyEnd * 0.09))]!;
  const snout = spine[0]!;
  putWaterPx(snout.x, snout.y, pal.hi);
  for (const side of [-1, 1] as const) {
    putWaterPx(head.x + head.nx * side * (k.wid * 0.33), head.y + head.ny * side * (k.wid * 0.33), '#1a2229');
  }
}

const lotusScene: Scene = {
  plan(L, r) {
    // Giant perimeter & corner lotus pads spilling across L.gl / L.gr / L.gt so there is ZERO rectangular frame!
    const pads: { x: number; y: number; R: number; notch: number; seed: number }[] = [
      // Top-left lush cascade
      { x: L.gl - 18, y: L.gt - 4, R: 25, notch: 0.6, seed: 1 },
      { x: L.gl + 12, y: L.gt - 9, R: 19, notch: 1.4, seed: 2 },
      { x: L.gl - 26, y: L.gt + 28, R: 21, notch: -0.3, seed: 3 },
      { x: L.gl - 4, y: L.gt + 16, R: 14, notch: 0.9, seed: 4 },
      // Top-right lush cascade
      { x: L.gr + 18, y: L.gt - 2, R: 26, notch: 2.5, seed: 5 },
      { x: L.gr - 12, y: L.gt - 10, R: 18, notch: 1.9, seed: 6 },
      { x: L.gr + 26, y: L.gt + 32, R: 22, notch: 3.3, seed: 7 },
      { x: L.gr + 5, y: L.gt + 19, R: 14, notch: 2.7, seed: 8 },
      // Mid flanks overhanging inward
      { x: L.gl - 28, y: L.mid - 6, R: 23, notch: 0.2, seed: 9 },
      { x: L.gl - 10, y: L.mid + 24, R: 16, notch: -0.7, seed: 10 },
      { x: L.gr + 27, y: L.mid + 4, R: 24, notch: 3.0, seed: 11 },
      { x: L.gr + 9, y: L.mid - 26, R: 15, notch: 2.2, seed: 12 },
      // Bottom-left & bottom-right rich lotus clusters
      { x: L.gl - 20, y: L.gb - 8, R: 24, notch: -0.5, seed: 13 },
      { x: L.gl + 4, y: L.gb + 4, R: 15, notch: -1.1, seed: 14 },
      { x: L.gr + 20, y: L.gb - 6, R: 24, notch: -2.5, seed: 15 },
      { x: L.gr - 4, y: L.gb + 5, R: 15, notch: -1.9, seed: 16 },
      // Central poetic floating lotus island (harmonious scale right in the pond's heart!)
      { x: L.cx - 16, y: L.cy - 8, R: 14, notch: 2.4, seed: 17 },
      { x: L.cx + 18, y: L.cy + 12, R: 12, notch: -0.7, seed: 18 },
      { x: L.cx + 4, y: L.cy - 18, R: 8.5, notch: 1.1, seed: 19 },
    ];

    const blooms = [
      // Central sacred white-blush hero lotus
      { x: L.cx + 1, y: L.cy - 2, R: 12.5, white: true, rot: 0.2 },
      // Large perimeter pink & cream lotus blossoms
      { x: L.gl - 2, y: L.gt + 2, R: 13.5, white: false, rot: 0.1 },
      { x: L.gl - 22, y: L.gt + 44, R: 11, white: true, rot: 0.5 },
      { x: L.gr + 2, y: L.gt + 4, R: 14, white: false, rot: 0.35 },
      { x: L.gr + 20, y: L.mid - 16, R: 11.5, white: false, rot: 0.7 },
      { x: L.gl - 18, y: L.mid + 12, R: 12, white: false, rot: 0.25 },
      { x: L.gl - 6, y: L.gb - 14, R: 13, white: false, rot: 0.45 },
      { x: L.gr + 8, y: L.gb - 12, R: 13, white: true, rot: 0.15 },
      { x: L.cx - 56, y: L.gt - 8, R: 10.5, white: false, rot: 0.6 },
      { x: L.cx + 58, y: L.gt - 7, R: 10.5, white: true, rot: 0.3 },
    ];

    const koi: KoiSpec[] = [
      // 1. Big vibrant orange koi looping widely right around the central pond!
      { cx: L.cx, cy: L.cy, rx: Math.min(68, L.gw * 0.36), ry: 48, lobe: 10, period: 17, dir: 1, phase: 0.4, len: 27, wid: 8.4, style: 'orange' },
      // 2. Classic red-white Kohaku koi swimming counter-orbit across the center!
      { cx: L.cx + 4, cy: L.cy + 4, rx: Math.min(54, L.gw * 0.29), ry: 36, lobe: -8, period: 14.5, dir: -1, phase: 2.7, len: 25, wid: 7.8, style: 'kohaku' },
      // 3. Golden-amber koi weaving upper-left to lower-right
      { cx: L.cx - 18, cy: L.cy - 22, rx: Math.min(58, L.gw * 0.31), ry: 34, lobe: 7, period: 19, dir: 1, phase: 4.5, len: 22, wid: 7.0, style: 'gold' },
      // 4. Calico sanke koi cruising the lower pond
      { cx: L.cx + 16, cy: L.cy + 28, rx: Math.min(60, L.gw * 0.32), ry: 30, lobe: -6, period: 21, dir: -1, phase: 1.3, len: 22, wid: 7.0, style: 'sanke' },
    ];

    const padMask = new Uint8Array(L.W * L.H);
    void r;
    return { pads, blooms, koi, padMask };
  },

  paint(a, L, P) {
    const C = LOTUS_PAL;
    P.padMask.fill(0);

    // 1. Rich layered jade-to-moonlit-celadon pond depth field
    a.field((x, y) => {
      const nx = (x - L.cx) / Math.max(70, L.gw * 0.62);
      const ny = (y - L.cy) / (L.gh * 0.62);
      const radial = Math.hypot(nx, ny);
      const n1 = vnoise(x, y, 26, 11) * 0.55 + vnoise(x, y, 11, 29) * 0.25;
      // Luminous moonlit water clearing in the center, deep emerald toward banks
      const depth = clamp(1.38 - radial * 0.92 + (n1 - 0.4) * 0.55, 0, 1.99);
      const stops = [C.w0!, C.w1!, C.w2!, C.w3!, C.w4!, C.w5!, C.w6!];
      return stops[band(depth * 3.1, x, y, stops.length, 0.42)]!;
    });

    // 2. Central poetic water-light rings & submerged pale-jade young pads
    a.alpha(0.28, () => {
      for (const [dx, dy, R] of [
        [-38, -28, 12],
        [42, -20, 10],
        [-34, 34, 11],
        [38, 38, 13],
        [-6, 26, 9],
      ] as const) {
        a.disc(L.cx + dx, L.cy + dy, R, R * 0.76, C.w5!);
      }
    });
    a.alpha(0.45, () => {
      a.ring(L.cx, L.cy, 74, 56, C.w6!, 14, 0.2);
      a.ring(L.cx, L.cy, 52, 39, C.foam!, 10, 0.5);
      a.ring(L.cx - 10, L.cy - 4, 31, 24, C.foam!, 8, 0.1);
    });

    // 3. Subtle invisible water-glint grid skeleton (so the 5×8 battlefield is effortlessly legible)
    skeleton(a, L, C.foam!, 0.24, C.foam!);

    // 4. Mossy shore stones & swaying cattails/reeds in corners
    for (const [rx, ry, rw, rh] of [
      [16, 22, 18, 12],
      [L.W - 18, 26, 19, 13],
      [18, L.gb - 2, 16, 11],
      [L.W - 20, L.gb + 2, 17, 11],
    ] as const) {
      a.alpha(0.4, () => a.disc(rx + 1, ry + 2, rw + 1, rh + 1, C.shadow!));
      a.disc(rx, ry, rw, rh, '#3b5852');
      a.disc(rx - 2, ry - 2, rw * 0.76, rh * 0.72, '#628579');
      a.disc(rx - 4, ry - 3, rw * 0.42, rh * 0.38, '#8eb39c');
    }

    // 5. Giant sculpted lotus pads (recording into P.padMask so koi swim underneath!)
    for (const p of P.pads) {
      sculptLotusPad(a, p.x, p.y, p.R, p.notch, C, P.padMask, p.seed);
    }

    // 6. Bench: 9 lush floating lotus-leaf seats along y = L.by
    for (const [i, s] of benchSlots(L).entries()) {
      const R = Math.min(11.5, L.bs * 0.47);
      sculptLotusPad(a, s.x, s.y + 1, R, -1.57 + ((i % 3) - 1) * 0.45, C, undefined, 30 + i);
      if (i % 2 === 0) {
        // Tiny pink bud accent on alternating bench pads
        a.disc(s.x - R * 0.62, s.y - R * 0.42, 2.3, 1.9, LOTUS_PINK.mid);
        a.p(s.x - R * 0.62, s.y - R * 0.42 - 1, LOTUS_PINK.tip);
      }
    }

    // 7. Carved golden-seeded lotus pods (莲蓬) & upright pink buds
    for (const [px, py] of [
      [L.gl - 14, L.gt + 16],
      [L.gr + 15, L.gt + 20],
      [L.cx - 28, L.cy - 14],
      [L.gr + 14, L.gb - 26],
    ] as const) {
      a.stroke(px, py + 7, px + 1, py, 1.0, 0.7, C.stem!);
      a.disc(px, py, 5.2, 4.0, C.padD!);
      a.disc(px, py - 1, 4.5, 3.2, C.padL!);
      for (const [sx, sy] of [[-2, -1], [0, -2], [2, -1], [-1, 0], [1, 0]] as const) {
        a.p(px + sx, py + sy, '#ffd866');
      }
    }

    // 8. Large multi-layered pink & white sacred lotus blossoms!
    for (const b of P.blooms) {
      sculptLotusBloom(a, b.x, b.y, b.R, b.white ? LOTUS_WHITE : LOTUS_PINK, b.rot);
      // Record central blossom core into padMask too so fish swim under blooms
      const X = Math.round(b.x), Y = Math.round(b.y), br = Math.ceil(b.R * 0.85);
      for (let dy = -br; dy <= br; dy++) {
        for (let dx = -br; dx <= br; dx++) {
          if (dx * dx + dy * dy <= br * br) {
            const mx = X + dx, my = Y + dy;
            if (mx >= 0 && mx < L.W && my >= 0 && my < L.H) P.padMask[my * L.W + mx] = 1;
          }
        }
      }
    }

    // 9. Tall graceful reeds & cattails arching at upper/lower flanks
    for (const [bx, by, dir] of [
      [12, 54, 1],
      [22, 62, 1],
      [L.W - 12, 58, -1],
      [L.W - 22, 66, -1],
      [14, L.gb + 12, 1],
      [L.W - 14, L.gb + 14, -1],
    ] as const) {
      a.quad(bx, by, bx + dir * 5, by - 18, bx + dir * 11, by - 34, 1.1, 0.5, C.reed!);
      a.quad(bx + dir * 2, by, bx + dir * 8, by - 14, bx + dir * 15, by - 26, 0.9, 0.4, C.reedL!);
      // Brown velvet cattail spike
      const tx = bx + dir * 9, ty = by - 27;
      a.stroke(tx - dir * 1.5, ty + 5, tx + dir * 1, ty - 3, 1.6, 1.4, C.cattail!);
      a.stroke(tx - dir * 1.8, ty + 4, tx + dir * 0.6, ty - 2, 0.7, 0.6, C.cattailL!);
    }
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const C = LOTUS_PAL;

    // 1. Subtle expanding water ripple rings around the central island & koi wakes
    for (let i = 0; i < 4; i++) {
      const cyc = (sec * 0.38 + i * 0.25) % 1;
      const rx = 10 + cyc * 44;
      const ry = rx * 0.74;
      const cx = i % 2 === 0 ? L.cx + 2 : L.cx - 24 + i * 16;
      const cy = i % 2 === 0 ? L.cy - 2 : L.cy - 18 + i * 14;
      a.alpha((1 - cyc) * 0.36, () => a.ring(cx, cy, rx, ry, C.foam!, 8, cyc * 4));
    }

    // 2. The 4 large plump curved-spine koi swimming right through the pond & under pads!
    for (const k of P.koi as KoiSpec[]) {
      paintCurvedKoi(a, k, sec, P.padMask);
      // Tail wake ripple
      const tailP = koiPos(k, sec - 0.55);
      const wPhase = (sec * 1.4 + k.phase) % 1;
      a.alpha((1 - wPhase) * 0.3, () => {
        a.ring(tailP.x, tailP.y, 3 + wPhase * 9, 2 + wPhase * 6.5, C.foam!, 5, wPhase);
      });
    }

    // 3. Shimmering moonlight water glints
    for (let i = 0; i < 14; i++) {
      const gx = L.gl - 10 + hash2(i, 3, 71) * (L.gw + 20);
      const gy = L.gt + 4 + hash2(i, 9, 71) * (L.gh - 8);
      if (P.padMask[Math.round(gy) * L.W + Math.round(gx)]) continue;
      const blink = Math.sin(sec * 2.6 + i * 1.7);
      if (blink > 0.45) {
        a.alpha((blink - 0.45) * 1.4, () => {
          a.r(gx - 1, gy, 3, 1, C.foam!);
          a.p(gx, gy, '#ffffff');
        });
      }
    }

    // 4. Drifting pink lotus petals on the breeze
    for (let i = 0; i < 9; i++) {
      const px = wrap(hash2(i, 1, 93) * L.W + sec * (4.5 + (i % 3) * 1.5), L.W);
      const py = wrap(hash2(i, 2, 93) * (L.H - 30) + sec * 2.2 + Math.sin(sec * 1.6 + i) * 4, L.H - 24);
      a.r(px, py, 2, 1, LOTUS_PINK.light);
      a.p(px, py, LOTUS_PINK.tip);
      a.p(px + 1, py + 1, LOTUS_PINK.mid);
    }

    // 5. Iridescent turquoise damselfly flitting gracefully
    const dfU = sec * 0.45;
    const dx = L.cx + Math.cos(dfU) * 58 + Math.sin(dfU * 2.3) * 18;
    const dy = L.cy - 12 + Math.sin(dfU * 1.4) * 36;
    const wing = Math.floor(sec * 16) % 2 === 0;
    a.stroke(dx, dy, dx - 4, dy + 2, 0.6, 0.4, '#2be8d8');
    a.p(dx + 1, dy, '#ffffff');
    a.alpha(0.75, () => {
      if (wing) {
        a.line(dx - 1, dy, dx - 3, dy - 3, '#d8ffff');
        a.line(dx - 1, dy, dx + 2, dy - 3, '#d8ffff');
      } else {
        a.line(dx - 1, dy, dx - 4, dy - 1, '#d8ffff');
        a.line(dx - 1, dy, dx + 2, dy + 2, '#d8ffff');
      }
    });
  },
};

/* ═══════════════════════════ 2. 复苏季节 · SPRING MEADOW ═══════════════════════════ */

const MEADOW_PAL: Pal = {
  sky0: '#cbe2cf',
  sky1: '#e4efe0',
  sky2: '#f7f4de',
  st0: '#cdc9ae',
  st1: '#dedbc1',
  st2: '#ece7d0',
  st3: '#f7f2df',
  crack: '#aba98e',
  moss0: '#355733',
  moss1: '#4d7844',
  moss2: '#6fa05a',
  moss3: '#99c779',
  oliveD: '#496339',
  olive: '#739458',
  oliveL: '#a7c482',
  ivyD: '#274d32',
  ivy: '#3f784a',
  ivyL: '#6da86e',
  woodD: '#594432',
  wood: '#7d6249',
  urnD: '#8a684a',
  urn: '#b58f6b',
  urnL: '#dfc29f',
  gold: '#f2cf74',
  goldL: '#fff6cc',
  gem0: '#496d9c',
  gem1: '#75a2d6',
  gem2: '#abd4fa',
  gem3: '#e8f7ff',
};

function paintAmphoraBouquet(a: Art, cx: number, cy: number, C: Pal, marble = false) {
  const uD = marble ? '#6d7a72' : C.urnD!;
  const uM = marble ? '#9ca89e' : C.urn!;
  const uL = marble ? '#cdd6cc' : C.urnL!;
  // Shadow & amphora body (16×18 art-px)
  a.alpha(0.32, () => a.disc(cx + 1, cy + 8, 9, 5, '#263b24'));
  a.disc(cx, cy + 2, 7.5, 7.5, uD);
  a.disc(cx - 1, cy + 1, 6.2, 6.4, uM);
  a.disc(cx - 2.2, cy, 3.5, 4.5, uL);
  // Amphora handles & rim
  a.ring(cx - 6.5, cy - 2, 2.2, 3.2, uD);
  a.ring(cx + 6.5, cy - 2, 2.2, 3.2, uD);
  a.r(cx - 5, cy - 6, 10, 2, uD);
  a.r(cx - 4, cy - 7, 8, 2, uL);
  a.r(cx - 4, cy + 8, 8, 2, uD);

  // Overflowing lush mound of foliage & big white daisies (26×20 art-px!)
  a.disc(cx, cy - 12, 12, 8.5, C.moss0!);
  a.disc(cx - 1, cy - 13, 10.5, 7.2, C.moss1!);
  for (let k = 0; k < 9; k++) {
    const ang = -Math.PI + (k / 8) * Math.PI + (k % 2) * 0.15;
    a.petal(cx + Math.cos(ang) * 5, cy - 11 + Math.sin(ang) * 3, ang, 8.5, 2.2, C.oliveD!, C.olive!, C.oliveL!);
  }
  for (const [dx, dy, R, rot] of [
    [-6, -13, 5.8, 0.1],
    [5, -14, 6.0, 0.4],
    [0, -18, 5.4, 0.2],
    [-9, -8, 4.8, 0.5],
    [9, -9, 4.8, 0.3],
    [0, -9, 6.4, 0.0],
  ] as const) {
    sculptDaisy(a, cx + dx, cy + dy, R, 9, rot, dx > 2 ? 'cream' : 'white');
  }
}

const meadowScene: Scene = {
  plan(L, r) {
    const rx = Math.max(106, L.gw * 0.56);
    const ry = L.gh * 0.525;
    const wildflowers = [] as { x: number; y: number; kind: number }[];
    for (let i = 0; i < 64; i++) {
      const fx = 8 + r() * (L.W - 16);
      const fy = 22 + r() * (L.H - 30);
      const er = Math.hypot((fx - L.cx) / rx, (fy - (L.cy + 1)) / ry);
      if (er < 1.03) continue;
      if (Math.abs(fy - L.by) < 12 && fx > L.benchL - 8 && fx < L.benchR + 8) continue;
      wildflowers.push({ x: Math.round(fx), y: Math.round(fy), kind: i % 4 });
    }
    return {
      rx,
      ry,
      wildflowers,
      urns: [
        { x: L.cx - rx * 0.84, y: L.cy - ry * 0.72, marble: false },
        { x: L.cx + rx * 0.84, y: L.cy - ry * 0.72, marble: true },
        { x: L.cx - rx * 0.86, y: L.cy + ry * 0.68, marble: false },
        { x: L.cx + rx * 0.86, y: L.cy + ry * 0.68, marble: false },
      ],
    };
  },

  paint(a, L, P) {
    const C = MEADOW_PAL;
    const rx = P.rx as number;
    const ry = P.ry as number;
    const cy0 = L.cy + 1;

    // 1. Boundless sunlit spring meadow & smooth classical elliptical travertine sun-rotunda (zero jagged seams!)
    a.field((x, y) => {
      // Smooth gentle morning horizon arc across the top vista
      const hNorm = clamp((x - L.cx) / (L.W * 0.58), -1, 1);
      const horizonY = 13 + 5.5 * Math.cos(hNorm * Math.PI * 0.5);
      if (y < horizonY) {
        const sy = clamp(y / Math.max(1, horizonY), 0, 1);
        const sky = [C.sky0!, C.sky1!, C.sky2!];
        return sky[band(sy * 2.2, x, y, 3, 0.45)]!;
      }

      // Smooth mathematical ellipse for the sunlit limestone garden rotunda
      const er = Math.hypot((x - L.cx) / rx, (y - cy0) / ry);

      // Soft Bayer-dithered clover transition into the open sunlit spring lawn
      if (er > 0.965) {
        if (er < 1.015 && bayer(x, y) > (er - 0.965) / 0.05) {
          return C.st1!;
        }
        const mn = vnoise(x, y, 13, 41) * 0.65 + vnoise(x, y, 5, 43) * 0.35;
        const sunLift = clamp(1.18 - Math.hypot((x - L.cx) / (L.W * 0.62), (y - cy0) / (L.H * 0.62)) * 0.48, 0.65, 1.25);
        const lawn = ['#487240', '#639153', '#82b368', '#a6d483', '#c6e89c'];
        return lawn[band(mn * 3.5 * sunLift, x, y, 5, 0.42)]!;
      }

      // Clean, smooth carved classical double-ring stone curb (0.91 .. 0.965) — zero wobbles!
      if (er >= 0.91) {
        if (er < 0.926) return C.st3!;
        if (er > 0.952) return C.st0!;
        return C.st2!;
      }

      // Sun-warmed travertine flagstones inside the smooth elliptical rotunda
      const fs = flagstone(x, y, 16, 7);
      if (fs.edge < 0.54) {
        return er > 0.8 && hash2(x, y, 19) > 0.58 ? C.olive! : C.crack!;
      }
      const sun = clamp(1.34 - er * 0.46 + (fs.shade - 0.5) * 0.3, 0, 1.99);
      const stones = [C.st0!, C.st1!, C.st2!, C.st3!];
      return stones[band(sun * 2.2, x, y, 4, 0.36)]!;
    });

    // Distant soft cypress silhouettes & smooth classical ivory balustrade along the top vista
    for (const [tx, th, tw] of [
      [L.cx - 74, 11, 2.4],
      [L.cx - 65, 8, 2.0],
      [L.cx + 66, 9, 2.1],
      [L.cx + 75, 12, 2.5],
    ] as const) {
      a.petal(tx, 16, -Math.PI / 2, th, tw, C.ivyD!, C.oliveD!, C.olive!);
    }
    a.arc(L.cx, cy0, rx * 0.94, ry * 0.94, -2.18, -0.96, C.st3!, 2);

    // Wildflower drifts (white daisies, sunny buttercups & sky forget-me-nots) across the open spring lawn
    for (const wf of P.wildflowers as { x: number; y: number; kind: number }[]) {
      if (wf.kind === 0) {
        a.r(wf.x - 1, wf.y, 3, 1, '#ffffff');
        a.r(wf.x, wf.y - 1, 1, 3, '#ffffff');
        a.p(wf.x, wf.y, '#ffd24c');
      } else if (wf.kind === 1) {
        a.r(wf.x - 1, wf.y - 1, 2, 2, '#ffe473');
        a.p(wf.x - 1, wf.y - 1, '#fffbe0');
      } else if (wf.kind === 2) {
        a.r(wf.x - 1, wf.y, 3, 1, '#9ad0ff');
        a.r(wf.x, wf.y - 1, 1, 3, '#9ad0ff');
        a.p(wf.x, wf.y, '#fff6b3');
      } else {
        a.p(wf.x, wf.y, '#d6f2a7');
        a.p(wf.x + 1, wf.y - 1, '#f7fae6');
      }
    }

    // 2. Three sweeping golden sunlight spirals across the court
    for (let arm = 0; arm < 3; arm++) {
      const baseA = (arm / 3) * TAU + 0.4;
      a.alpha(0.58, () => {
        for (let s = 0; s < 170; s++) {
          const u = s / 170;
          const ang = baseA + u * TAU * 1.15;
          const srx = 18 + u * Math.min(88, L.gw * 0.47);
          const sry = 15 + u * 68;
          const px = L.cx + Math.cos(ang) * srx;
          const py = L.cy + Math.sin(ang) * sry;
          a.disc(px, py, 1.0, 1.0, C.gold!);
          a.p(px, py, C.goldL!);
        }
      });
    }

    // 3. MASSIVE CENTRAL OLIVE-AND-DAISY MANDALA (~132 × 114 art-px!) + Sky-Moonstone Cabochon!
    a.ring(L.cx, L.cy, 25, 22, C.olive!, 0, 0);
    a.ring(L.cx, L.cy, 40, 35, C.moss2!, 16, 0.3);
    const M_BRANCHES = 8;
    for (let k = 0; k < M_BRANCHES; k++) {
      const ang = (k / M_BRANCHES) * TAU;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const nx = -sn, ny = cs;
      const rEnd = k % 2 === 0 ? Math.min(62, L.gw * 0.33) : Math.min(54, L.gw * 0.29);
      const x0 = L.cx + cs * 13, y0 = L.cy + sn * 12;
      const cx1 = L.cx + cs * (rEnd * 0.52) + nx * 10;
      const cy1 = L.cy + sn * (rEnd * 0.48) + ny * 9;
      const x1 = L.cx + cs * rEnd, y1 = L.cy + sn * (rEnd * 0.88);
      a.quad(x0, y0, cx1, cy1, x1, y1, 1.1, 0.6, C.moss0!);
      a.quad(x0, y0, cx1, cy1, x1, y1, 0.6, 0.35, C.moss2!);

      const ang2 = ang + Math.PI / 8;
      const cs2 = Math.cos(ang2), sn2 = Math.sin(ang2);
      a.quad(
        L.cx + cs2 * 16,
        L.cy + sn2 * 14,
        L.cx + cs2 * 30 - sn2 * 6,
        L.cy + sn2 * 26 + cs2 * 5,
        L.cx + cs2 * 44,
        L.cy + sn2 * 38,
        0.9,
        0.45,
        C.oliveD!,
      );
      for (const rt of [22, 32, 41]) {
        a.petal(L.cx + cs2 * rt, L.cy + sn2 * (rt * 0.87), ang2 + 0.65, 7.2, 1.9, C.oliveD!, C.olive!, C.oliveL!);
        a.petal(L.cx + cs2 * rt, L.cy + sn2 * (rt * 0.87), ang2 - 0.65, 6.8, 1.8, C.ivyD!, C.ivy!, C.ivyL!);
      }

      for (const t of [0.22, 0.4, 0.58, 0.76, 0.92]) {
        const u = 1 - t;
        const bx = u * u * x0 + 2 * u * t * cx1 + t * t * x1;
        const by = u * u * y0 + 2 * u * t * cy1 + t * t * y1;
        a.petal(bx, by, ang + 0.72, 9.0 - t * 2, 2.2, C.oliveD!, C.olive!, C.oliveL!);
        a.petal(bx, by, ang - 0.72, 8.4 - t * 2, 2.1, C.ivyD!, C.ivy!, C.ivyL!);
      }
    }
    for (let k = 0; k < 8; k++) {
      const angOuter = (k / 8) * TAU + (k % 2) * 0.04;
      const rOut = k % 2 === 0 ? Math.min(50, L.gw * 0.27) : Math.min(41, L.gw * 0.22);
      sculptDaisy(
        a,
        L.cx + Math.cos(angOuter) * rOut,
        L.cy + Math.sin(angOuter) * (rOut * 0.86),
        k % 2 === 0 ? 7.6 : 6.2,
        10,
        angOuter,
        k % 2 === 0 ? 'white' : 'cream',
      );
      const angIn = ((k + 0.5) / 8) * TAU;
      sculptDaisy(a, L.cx + Math.cos(angIn) * 25, L.cy + Math.sin(angIn) * 22, 5.4, 9, angIn, 'white');
    }

    // Central faceted Sky-Moonstone Cabochon in chased silver-gold bezel (R = 13 art-px)
    a.alpha(0.35, () => a.disc(L.cx + 1, L.cy + 2, 14.5, 13, '#3c4a35'));
    a.disc(L.cx, L.cy, 13.5, 12, '#695c47');
    a.disc(L.cx, L.cy, 12.2, 10.8, '#d9cfa8');
    a.disc(L.cx, L.cy, 10.6, 9.4, C.gem0!);
    a.disc(L.cx - 1, L.cy - 1, 8.8, 7.8, C.gem1!);
    a.disc(L.cx - 2, L.cy - 2, 6.2, 5.2, C.gem2!);
    a.disc(L.cx - 3.2, L.cy - 3, 3.2, 2.4, C.gem3!);
    a.r(L.cx - 4, L.cy - 4, 2, 2, '#ffffff');
    a.p(L.cx + 3, L.cy + 2, C.gem2!);

    // 4. Invisible chisel-dot skeleton for the 5×8 grid
    skeleton(a, L, '#526b44', 0.22, '#6e8c58');

    // 5. Carved stone daisy-relief medallions positioned symmetrically along the smooth rotunda rim
    for (const [mx, my, R] of [
      [L.cx - 50, cy0 - ry * 0.91, 10.5],
      [L.cx + 50, cy0 - ry * 0.91, 10.5],
      [L.cx - rx * 0.95, L.mid, 11.5],
      [L.cx + rx * 0.95, L.mid, 11.5],
    ] as const) {
      a.alpha(0.25, () => a.disc(mx + 1, my + 1.5, R + 0.5, R + 0.5, '#314a2b'));
      a.disc(mx, my, R, R, '#788574');
      a.disc(mx, my - 0.5, R - 1.5, R - 1.5, '#d6d8c5');
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU;
        a.petal(mx, my, ang, R - 2.5, 1.9, '#8b9482', '#edeadd', '#ffffff');
      }
      a.disc(mx, my, 2.5, 2.5, '#b8a87e');
    }

    // 6. Soft flowering ivy & daisy garlands hugging the smooth elliptical curb
    for (const [a0, a1] of [
      [-2.58, -2.15],
      [-0.99, -0.56],
      [0.54, 0.96],
      [2.18, 2.6],
    ] as const) {
      a.arc(L.cx, cy0, rx * 0.935, ry * 0.935, a0, a1, C.ivy!, 2);
      for (let s = 0; s <= 4; s++) {
        const ang = a0 + ((a1 - a0) * s) / 4;
        const vx = L.cx + Math.cos(ang) * rx * 0.935;
        const vy = cy0 + Math.sin(ang) * ry * 0.935;
        a.petal(vx, vy, ang + 1.2, 5.6, 1.9, C.ivyD!, C.ivy!, C.ivyL!);
        if (s === 2) sculptDaisy(a, vx, vy, 4.6, 8, ang, 'white');
      }
    }

    // 7. Four overflowing terracotta/marble daisy amphorae nestled along the rotunda lawn
    for (const u of P.urns) {
      paintAmphoraBouquet(a, u.x, u.y, C, u.marble);
    }

    // 8. Sweeping overhanging olive tree boughs in top-left & top-right corners (with olives!)
    for (const side of [-1, 1] as const) {
      const ox = side < 0 ? 0 : L.W;
      const dir = -side;
      a.quad(ox, 4, ox + dir * 34, 10, ox + dir * 68, 24, 1.8, 0.7, C.woodD!);
      a.quad(ox, 20, ox + dir * 24, 28, ox + dir * 48, 44, 1.4, 0.6, C.wood!);
      for (let i = 0; i < 11; i++) {
        const t = (i + 1) / 12;
        const u = 1 - t;
        const bx = u * u * ox + 2 * u * t * (ox + dir * 34) + t * t * (ox + dir * 68);
        const by = u * u * 4 + 2 * u * t * 10 + t * t * 24;
        const lAng = (dir > 0 ? 0.35 : Math.PI - 0.35) + (i % 2 ? 0.65 : -0.55);
        a.petal(bx, by, lAng, 10.5, 2.2, C.oliveD!, C.olive!, C.oliveL!);
        if (i % 3 === 1) {
          a.disc(bx + dir * 2, by + 4, 2.1, 2.8, C.oliveD!);
          a.disc(bx + dir * 1.7, by + 3.7, 1.5, 2.1, '#a8b856');
          a.p(bx + dir * 1.3, by + 3, '#e8f0a8');
        }
      }
    }

    // 9. Bench: 9 smooth round travertine garden stepping-stones & daisy garlands on the meadow
    for (const [i, s] of benchSlots(L).entries()) {
      const brx = Math.min(11, L.bs * 0.45);
      a.alpha(0.28, () => a.disc(s.x + 1, s.y + 2, brx + 1, 8.5, '#2b4a26'));
      a.disc(s.x, s.y, brx, 8, C.oliveD!);
      a.disc(s.x, s.y - 0.6, brx - 1.1, 6.8, C.st1!);
      a.disc(s.x, s.y - 1, brx - 2.3, 5.6, C.st3!);
      a.ring(s.x, s.y - 0.8, brx - 1.7, 6.2, C.oliveL!, 6, i * 0.3);
      if (i % 2 === 0) {
        sculptDaisy(a, s.x - brx + 2, s.y + 4, 3.6, 7, i, 'white');
      } else {
        a.petal(s.x + brx - 3, s.y + 4, -0.5, 5, 1.6, C.oliveD!, C.olive!, C.oliveL!);
      }
    }
  },

  anim(a, L, _P, t) {
    const sec = t * 0.001;
    const C = MEADOW_PAL;

    // 1. Living moonstone shimmer & golden spiral glints
    const pulse = 0.5 + 0.5 * Math.sin(sec * 2.2);
    a.alpha(0.35 * pulse, () => a.disc(L.cx - 2, L.cy - 2, 8, 7, '#ffffff'));
    for (let arm = 0; arm < 3; arm++) {
      const u = (sec * 0.16 + arm / 3) % 1;
      const ang = (arm / 3) * TAU + 0.4 + u * TAU * 1.15;
      const sx = L.cx + Math.cos(ang) * (18 + u * Math.min(88, L.gw * 0.47));
      const sy = L.cy + Math.sin(ang) * (15 + u * 68);
      starFlare(a, sx, sy, 3, '#ffffff', C.goldL!);
    }

    // 2. Graceful white doves gliding over the sunlit garden
    for (let d = 0; d < 2; d++) {
      const u = wrap(sec * 0.065 + d * 0.52, 1);
      const bx = d === 0 ? -24 + u * (L.W + 48) : L.W + 24 - u * (L.W + 48);
      const by = (d === 0 ? L.gt + 26 : L.gb - 34) + Math.sin(u * TAU * 1.5 + d) * 14;
      const dir = d === 0 ? 1 : -1;
      const flap = Math.sin(sec * 7.5 + d * 2);
      // Soft ground shadow
      a.alpha(0.18, () => a.disc(bx + 2, by + 14, 6, 2.5, '#2b4024'));
      // Dove body & fanned tail
      a.disc(bx, by, 5.2, 2.6, '#dce6ea');
      a.disc(bx + dir * 1.5, by - 0.5, 4.2, 2.2, '#ffffff');
      a.disc(bx + dir * 5, by - 1.5, 2.2, 2.0, '#ffffff');
      a.petal(bx - dir * 4, by + 0.5, dir > 0 ? Math.PI + 0.1 : -0.1, 5.5, 2.2, '#cfdbe0', '#ffffff');
      // Animated wings
      const wAng1 = (dir > 0 ? -1.85 : -1.29) + flap * 0.45 * dir;
      const wAng2 = (dir > 0 ? 1.55 : 1.59) - flap * 0.35 * dir;
      a.petal(bx, by - 1, wAng1, 8.5, 2.6, '#cfdbe0', '#f5f9fc', '#ffffff');
      if (flap < 0.2) a.petal(bx - dir * 1, by + 1, wAng2, 6.5, 2.1, '#c4d2d9', '#eef4f7');
      a.p(bx + dir * 6, by - 2, '#313947');
      a.p(bx + dir * 7.5, by - 1.5, '#f0a84b');
    }

    // 3. Fluttering pastel butterflies & drifting white/gold petals
    const bCols = [
      ['#ffe57f', '#fff9d6'],
      ['#9fd8ff', '#eef9ff'],
      ['#f9b3cc', '#fff0f6'],
      ['#c9f09d', '#f5ffe8'],
    ] as const;
    for (let i = 0; i < 4; i++) {
      const ang = sec * (0.42 + i * 0.07) + i * 1.6;
      const bx = L.cx + Math.cos(ang) * (54 + (i % 2) * 34);
      const by = L.cy + Math.sin(ang * 1.3 + i) * (42 + (i % 2) * 24);
      const open = Math.floor(sec * 10 + i) % 2 === 0;
      const [c1, c2] = bCols[i]!;
      if (open) {
        a.r(bx - 3, by - 2, 2, 2, c1);
        a.r(bx + 2, by - 2, 2, 2, c1);
        a.p(bx - 2, by - 2, c2);
        a.p(bx + 2, by - 2, c2);
        a.r(bx - 2, by + 1, 2, 1, c1);
        a.r(bx + 1, by + 1, 2, 1, c1);
      } else {
        a.r(bx - 1, by - 3, 2, 3, c2);
      }
      a.r(bx, by - 1, 1, 3, '#4a4036');
    }
    for (let i = 0; i < 10; i++) {
      const px = wrap(hash2(i, 4, 31) * L.W + sec * (5 + (i % 3) * 1.4), L.W);
      const py = wrap(hash2(i, 8, 31) * L.H + sec * 3.1 + Math.sin(sec * 1.8 + i) * 3, L.H);
      a.r(px, py, 2, 1, i % 3 === 0 ? C.goldL! : '#ffffff');
    }
  },
};

/* ═══════════════════════════ 3. 玫瑰古堡 · ROSE COURT ═══════════════════════════ */

const ROSE_PAL: Pal = {
  sky0: '#1b1829',
  sky1: '#2d2942',
  sky2: '#4b4869',
  moon: '#dce3f5',
  st0: '#493f56',
  st1: '#615570',
  st2: '#7a6d8a',
  st3: '#9487a4',
  crack: '#2c2236',
  ironD: '#1a111f',
  iron: '#2e2036',
  ironL: '#523c5e',
  garnetD: '#4a1125',
  garnet: '#7d1e3d',
  garnetL: '#b8355c',
  thorn: '#1d1522',
  leafD: '#1d362b',
  leaf: '#2f5442',
  leafL: '#4e7d63',
  gold: '#f5cb78',
  flame: '#ff9d47',
};

const CRIMSON_ROSE = {
  abyss: '#38091a',
  deep: '#6e1430',
  mid: '#a82248',
  bright: '#de3b66',
  rim: '#ff85a3',
};

const BLUSH_ROSE = {
  abyss: '#541931',
  deep: '#8f2f52',
  mid: '#c9577d',
  bright: '#ef8cab',
  rim: '#ffd4e2',
};

function paintGothicCrossArm(a: Art, cx: number, cy: number, dx: number, dy: number, len: number, C: Pal) {
  const nx = -dy, ny = dx;
  // Shaft
  a.stroke(cx, cy, cx + dx * len, cy + dy * len, 2.4, 1.8, C.ironD!);
  a.stroke(cx, cy, cx + dx * (len - 2), cy + dy * (len - 2), 1.3, 0.9, C.garnet!);
  // Crossbar near 68% length
  const bx = cx + dx * (len * 0.68), by = cy + dy * (len * 0.68);
  const armW = len * 0.24;
  a.stroke(bx - nx * armW, by - ny * armW, bx + nx * armW, by + ny * armW, 2.1, 2.1, C.ironD!);
  a.stroke(bx - nx * (armW - 1.5), by - ny * (armW - 1.5), bx + nx * (armW - 1.5), by + ny * (armW - 1.5), 1.0, 1.0, C.garnetL!);
  // Flared trefoil spear tip
  const tx = cx + dx * len, ty = cy + dy * len;
  a.disc(tx - dx * 2, ty - dy * 2, 3.2, 3.2, C.ironD!);
  a.stroke(tx - dx * 3, ty - dy * 3, tx + dx * 3, ty + dy * 3, 2.0, 0.5, C.ironD!);
  a.disc(tx - dx * 2, ty - dy * 2, 1.6, 1.6, C.garnetL!);
}

function paintPerchedRaven(a: Art, cx: number, cy: number, faceX: 1 | -1, C: Pal) {
  // Poised heraldic raven silhouette (~18×15 art-px) facing inward toward crest
  a.stroke(cx - faceX * 2, cy + 2, cx - faceX * 10, cy + 8, 2.2, 0.8, C.ironD!); // long tail feathers
  a.disc(cx, cy, 5.2, 3.6, C.ironD!); // body
  a.disc(cx + faceX * 1, cy - 0.8, 3.8, 2.4, C.iron!); // plum wing sheen
  a.disc(cx + faceX * 4.2, cy - 3.6, 2.8, 2.5, C.ironD!); // head
  // Curved beak & ruby eye
  a.stroke(cx + faceX * 6, cy - 3.8, cx + faceX * 9, cy - 2.8, 1.2, 0.4, C.ironL!);
  a.p(cx + faceX * 4.8, cy - 4.2, '#ff4f79');
}

const roseScene: Scene = {
  plan(L) {
    const candles = [
      { x: L.gl - 17, y: L.gt + 44 },
      { x: L.gr + 17, y: L.gt + 44 },
      { x: L.gl - 17, y: L.gb - 36 },
      { x: L.gr + 17, y: L.gb - 36 },
    ];
    const cornerRoses = [
      // Top-left cascading velvet roses
      { x: 18, y: 18, R: 12.5, blush: false, s: 1 },
      { x: 38, y: 12, R: 9.0, blush: true, s: 2 },
      { x: 14, y: 40, R: 9.5, blush: false, s: 3 },
      { x: L.gl - 2, y: L.gt + 8, R: 10.5, blush: false, s: 4 },
      { x: L.gl + 14, y: L.gt - 3, R: 8.0, blush: true, s: 5 },
      // Top-right cascading velvet roses
      { x: L.W - 18, y: 18, R: 12.5, blush: false, s: 6 },
      { x: L.W - 38, y: 12, R: 9.0, blush: false, s: 7 },
      { x: L.W - 14, y: 40, R: 9.5, blush: true, s: 8 },
      { x: L.gr + 2, y: L.gt + 10, R: 10.5, blush: false, s: 9 },
      { x: L.gr - 14, y: L.gt - 3, R: 8.0, blush: false, s: 10 },
      // Bottom-left & bottom-right rich rose clusters
      { x: 18, y: L.H - 20, R: 12.0, blush: false, s: 11 },
      { x: 38, y: L.H - 14, R: 9.0, blush: true, s: 12 },
      { x: L.gl - 4, y: L.gb - 8, R: 10.0, blush: false, s: 13 },
      { x: L.W - 18, y: L.H - 20, R: 12.0, blush: false, s: 14 },
      { x: L.W - 38, y: L.H - 14, R: 9.0, blush: false, s: 15 },
      { x: L.gr + 4, y: L.gb - 8, R: 10.0, blush: true, s: 16 },
    ];
    return { candles, cornerRoses };
  },

  paint(a, L, P) {
    const C = ROSE_PAL;

    // 1. Misty moonlit Gothic castle horizon at top + refined twilight-slate flagstones
    a.field((x, y) => {
      const topParapet = L.gt - 2 + 4 * Math.sin((x / L.W) * TAU * 1.5);
      if (y < topParapet - 4) {
        const md = Math.hypot(x - (L.cx - 8), y - 9);
        if (md < 9.5) return '#e9eefc';
        const sy = clamp(y / Math.max(1, topParapet), 0, 1);
        const moonGlow = md < 38 ? (38 - md) * 0.032 : 0;
        const sky = [C.sky0!, C.sky1!, C.sky2!, '#6e7296'];
        return sky[band(sy * 1.9 + moonGlow, x, y, 4, 0.45)]!;
      }

      const leftW = L.gl - 10 + 4.5 * Math.sin(y * 0.08 + 0.9);
      const rightW = L.gr + 10 + 4.5 * Math.cos(y * 0.08 - 0.5);
      const botW = L.gb + 6 + 3.5 * Math.sin(x * 0.08);
      const dx = Math.max(leftW - x, 0, x - rightW);
      const dy = Math.max(topParapet - y, 0, y - botW);
      if (Math.hypot(dx, dy) > 2) {
        const vn = vnoise(x, y, 9, 61);
        return [C.ironD!, C.iron!, C.leafD!][band(vn * 2.6, x, y, 3, 0.4)]!;
      }

      const fs = flagstone(x, y, 16, 23);
      if (fs.edge < 0.54) return C.crack!;
      const rad = Math.hypot((x - L.cx) / 112, (y - L.cy) / 96);
      const v = clamp(1.36 - rad * 0.68 + (fs.shade - 0.5) * 0.3, 0, 1.99);
      const stones = [C.st0!, C.st1!, C.st2!, C.st3!];
      return stones[band(v * 2.1, x, y, 4, 0.36)]!;
    });

    // Distant Gothic castle spires & pointed lancet arches along top mist
    for (const [sx, sw, sh] of [
      [L.cx + 34, 7, 19],
      [L.cx + 46, 11, 15],
      [L.cx + 56, 6, 17],
      [L.cx - 44, 7, 16],
      [L.cx - 54, 5, 13],
    ] as const) {
      for (let h = 0; h < sh; h++) {
        const hw = Math.max(1, Math.round((sw * (sh - h)) / sh / 2));
        a.r(sx - hw, L.gt - 5 - h, hw * 2, 1, '#262138');
      }
    }
    for (let i = -3; i <= 3; i++) {
      const ax = L.cx + i * 14;
      for (let dy = 0; dy < 9; dy++) {
        const hw = dy < 4 ? dy + 2 : 5;
        a.r(ax - hw, L.gt - 11 + dy, hw * 2 + 1, 1, C.iron!);
        if (hw >= 2) a.r(ax - hw + 1, L.gt - 11 + dy, hw * 2 - 1, 1, C.ironD!);
      }
    }

    // 2. MASSIVE CENTRAL GOTHIC ROSE-AND-RAVEN HERALDIC CREST (~128 × 116 art-px!)
    const armX = Math.min(60, L.gw * 0.32), armY = 54;
    // Central thorny diamond ironwork lattice
    for (const off of [-9, 0, 9]) {
      a.stroke(L.cx - 20 + off * 0.4, L.cy + off, L.cx + 20 + off * 0.4, L.cy - off, 1.1, 1.1, C.ironD!);
      a.stroke(L.cx - 20 + off * 0.4, L.cy - off, L.cx + 20 + off * 0.4, L.cy + off, 1.1, 1.1, C.ironD!);
    }
    paintGothicCrossArm(a, L.cx, L.cy, 0, -1, armY, C);
    paintGothicCrossArm(a, L.cx, L.cy, 0, 1, armY, C);
    paintGothicCrossArm(a, L.cx, L.cy, -1, 0, armX, C);
    paintGothicCrossArm(a, L.cx, L.cy, 1, 0, armX, C);

    // 4 Poised Heraldic Ravens perched diagonally around the crest!
    paintPerchedRaven(a, L.cx - 24, L.cy - 24, 1, C);
    paintPerchedRaven(a, L.cx + 24, L.cy - 24, -1, C);
    paintPerchedRaven(a, L.cx - 24, L.cy + 24, 1, C);
    paintPerchedRaven(a, L.cx + 24, L.cy + 24, -1, C);

    // 8 Lush Velvet Crimson Roses nestled in the central heraldic lattice!
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * TAU + Math.PI / 8;
      const rr = k % 2 === 0 ? 22 : 26;
      sculptVelvetRose(
        a,
        L.cx + Math.cos(ang) * rr,
        L.cy + Math.sin(ang) * (rr * 0.92),
        6.6,
        k % 3 === 1 ? BLUSH_ROSE : CRIMSON_ROSE,
        k,
      );
    }
    // Central ruby-set gothic rosette hub
    a.disc(L.cx, L.cy, 6.5, 6.5, C.ironD!);
    a.disc(L.cx, L.cy, 4.5, 4.5, C.garnet!);
    a.disc(L.cx - 0.8, L.cy - 0.8, 2.4, 2.4, '#ff5c86');
    a.p(L.cx - 1, L.cy - 1, '#ffd9e4');

    // 3. Invisible skeleton ticks
    skeleton(a, L, '#cbbdd9', 0.2, '#e39eb5');

    // 4. Gnarled black thorny briar vines crawling inward from all corners & edges!
    for (const [x0, y0, cx1, cy1, x1, y1] of [
      [0, 8, L.gl - 6, L.gt + 6, L.gl + 34, L.gt + 18],
      [8, 46, L.gl - 4, L.gt + 36, L.gl + 22, L.gt + 44],
      [L.W, 8, L.gr + 6, L.gt + 6, L.gr - 34, L.gt + 18],
      [L.W - 8, 46, L.gr + 4, L.gt + 36, L.gr - 22, L.gt + 44],
      [0, L.H - 16, L.gl - 8, L.gb - 6, L.gl + 30, L.gb - 16],
      [L.W, L.H - 16, L.gr + 8, L.gb - 6, L.gr - 30, L.gb - 16],
    ] as const) {
      a.quad(x0, y0, cx1, cy1, x1, y1, 2.0, 0.6, C.thorn!);
      for (const t of [0.25, 0.5, 0.75]) {
        const u = 1 - t;
        const vx = u * u * x0 + 2 * u * t * cx1 + t * t * x1;
        const vy = u * u * y0 + 2 * u * t * cy1 + t * t * y1;
        a.petal(vx, vy, t * 5.1, 6.5, 2.0, C.leafD!, C.leaf!, C.leafL!);
      }
    }

    // 5. Giant cascading crimson & twilight-blush velvet roses breaking all 4 corners!
    for (const cr of P.cornerRoses) {
      sculptVelvetRose(a, cr.x, cr.y, cr.R, cr.blush ? BLUSH_ROSE : CRIMSON_ROSE, cr.s);
    }

    // 6. Gothic wrought-iron candelabra & ruby cross pillars along left/right flanks
    for (const c of P.candles) {
      a.stroke(c.x, c.y + 12, c.x, c.y - 4, 1.4, 1.0, C.ironD!);
      a.r(c.x - 5, c.y - 2, 11, 2, C.ironL!);
      for (const dx of [-4, 0, 4]) {
        a.r(c.x + dx - 1, c.y - 6, 2, 4, '#f2e6d8');
      }
      a.disc(c.x, c.y + 12, 4.5, 2.2, C.ironD!);
    }

    // 7. Bench: 9 Gothic carved stone raven/rose medallions (inspired directly by rose-court.png!)
    for (const [i, s] of benchSlots(L).entries()) {
      const rx = Math.min(10.8, L.bs * 0.45);
      a.alpha(0.45, () => a.disc(s.x + 1, s.y + 2, rx + 1, 9, '#120b17'));
      a.disc(s.x, s.y, rx, 8.5, C.ironD!);
      a.ring(s.x, s.y, rx - 0.8, 7.6, C.ironL!);
      a.disc(s.x, s.y - 0.5, rx - 2.2, 6.2, '#3a3047');
      if (i % 2 === 0) {
        // Pale silver gothic raven-skull mask relief
        a.disc(s.x, s.y - 2, 2.6, 2.2, '#d8d2e3');
        a.stroke(s.x, s.y - 1, s.x, s.y + 3.5, 1.5, 0.5, '#ebe6f4');
        a.p(s.x - 1, s.y - 2, C.ironD!);
        a.p(s.x + 1, s.y - 2, C.ironD!);
      } else {
        sculptVelvetRose(a, s.x, s.y - 0.5, 4.5, CRIMSON_ROSE, i);
      }
    }
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const C = ROSE_PAL;

    // 1. Warm flickering candelabra flames & halos
    for (const [i, c] of (P.candles as { x: number; y: number }[]).entries()) {
      const flick = 0.72 + 0.28 * Math.sin(sec * 8.5 + i * 2.1);
      a.alpha(0.22 * flick, () => a.disc(c.x, c.y - 7, 11, 8, C.flame!));
      for (const dx of [-4, 0, 4]) {
        const sway = Math.round(Math.sin(sec * 10 + i + dx) * 0.6);
        a.r(c.x + dx - 1 + sway, c.y - 8, 2, 2, C.flame!);
        a.p(c.x + dx + sway, c.y - 9, '#fff7cc');
      }
    }

    // 2. Subtle ruby pulse in the central Gothic crest gem
    const gemPulse = 0.4 + 0.6 * Math.abs(Math.sin(sec * 1.8));
    a.alpha(0.28 * gemPulse, () => a.disc(L.cx, L.cy, 9, 9, '#ff4778'));

    // 3. Drifting velvet crimson rose petals & dusk fireflies
    for (let i = 0; i < 12; i++) {
      const px = wrap(hash2(i, 2, 57) * L.W + sec * (5.2 + (i % 3) * 1.6), L.W);
      const py = wrap(hash2(i, 7, 57) * (L.H - 22) + sec * 3.4 + Math.sin(sec * 2 + i) * 3.5, L.H - 20);
      a.r(px, py, 2, 2, i % 3 === 0 ? BLUSH_ROSE.bright : CRIMSON_ROSE.bright);
      a.p(px, py, BLUSH_ROSE.rim);
    }
    for (let i = 0; i < 8; i++) {
      const fx = L.gl - 14 + hash2(i, 5, 83) * (L.gw + 28) + Math.sin(sec * 1.2 + i) * 6;
      const fy = L.gt + hash2(i, 9, 83) * L.gh + Math.cos(sec * 1.5 + i) * 5;
      const glow = Math.max(0, Math.sin(sec * 2.8 + i * 1.9));
      if (glow > 0.25) {
        a.alpha(glow * 0.75, () => {
          a.disc(fx, fy, 2.2, 2.2, '#ff8ca8');
          a.p(fx, fy, '#fff5d6');
        });
      }
    }

    // 4. Dusk raven gliding across the moonlit courtyard
    const ru = wrap(sec * 0.075, 1);
    if (ru < 0.72) {
      const q = ru / 0.72;
      const rx = L.W + 24 - q * (L.W + 48);
      const ry = 28 + q * 48 + Math.sin(q * TAU) * 10;
      const flap = Math.sin(sec * 9) * 0.5;
      a.disc(rx, ry, 4.5, 2.0, C.ironD!);
      a.petal(rx + 1, ry, -1.6 + flap, 9, 2.4, C.ironD!, C.iron!);
      a.petal(rx + 1, ry, 1.5 - flap, 8, 2.2, C.ironD!, C.iron!);
      a.p(rx - 4, ry - 1, '#ff5983');
    }
  },
};

/* ═══════════════ 4 & 5. 时间星盘 · ASTRAL IVORY & ASTRAL NIGHT ═══════════════ */

type AstralTheme = {
  night: boolean;
  sky0: string;
  sky1: string;
  sky2: string;
  trail: string;
  parapet0: string;
  parapet1: string;
  parapet2: string;
  st0: string;
  st1: string;
  st2: string;
  st3: string;
  crack: string;
  goldD: string;
  gold: string;
  goldL: string;
  goldHi: string;
  sapphireD: string;
  sapphire: string;
  sapphireL: string;
  moon: string;
  moonHi: string;
  skel: string;
};

const ASTRAL_NIGHT_THEME: AstralTheme = {
  night: true,
  sky0: '#0b152b',
  sky1: '#142647',
  sky2: '#213c69',
  trail: '#496da1',
  parapet0: '#172540',
  parapet1: '#283d63',
  parapet2: '#43608f',
  st0: '#1f3152',
  st1: '#2a4066',
  st2: '#37517d',
  st3: '#486696',
  crack: '#14213b',
  goldD: '#7a5926',
  gold: '#ba9043',
  goldL: '#efd07a',
  goldHi: '#fff8db',
  sapphireD: '#163169',
  sapphire: '#2959b0',
  sapphireL: '#6db2ff',
  moon: '#d8ecff',
  moonHi: '#ffffff',
  skel: '#9ec4fa',
};

const ASTRAL_IVORY_THEME: AstralTheme = {
  night: false,
  sky0: '#1c355c',
  sky1: '#2e5182',
  sky2: '#4d76ab',
  trail: '#85aad6',
  parapet0: '#273d61',
  parapet1: '#42608c',
  parapet2: '#6b8cb8',
  st0: '#cfc1a3',
  st1: '#ded2b8',
  st2: '#ece2cc',
  st3: '#f7f0df',
  crack: '#b3a384',
  goldD: '#87632a',
  gold: '#c49747',
  goldL: '#f2d279',
  goldHi: '#fffbe6',
  sapphireD: '#1e4080',
  sapphire: '#3768bd',
  sapphireL: '#7ec0ff',
  moon: '#e8f4ff',
  moonHi: '#ffffff',
  skel: '#7d6134',
};

function paintClockworkDial(a: Art, cx: number, cy: number, R: number, T: AstralTheme, withCogs: boolean) {
  // Outer double brass astrolabe ring + Roman numeral tick radial spokes
  a.ring(cx, cy, R, R * 0.92, T.goldD);
  a.ring(cx, cy, R - 1, (R - 1) * 0.92, T.goldL);
  a.ring(cx, cy, R - 6, (R - 6) * 0.92, T.gold);
  a.ring(cx, cy, R - 7, (R - 7) * 0.92, T.goldD);
  for (let h = 0; h < 12; h++) {
    const ang = (h / 12) * TAU - Math.PI / 2;
    const x0 = cx + Math.cos(ang) * (R - 6), y0 = cy + Math.sin(ang) * ((R - 6) * 0.92);
    const x1 = cx + Math.cos(ang) * (R - 2), y1 = cy + Math.sin(ang) * ((R - 2) * 0.92);
    a.line(x0, y0, x1, y1, h % 3 === 0 ? T.goldHi : T.gold);
  }
  if (withCogs) {
    // Interlocking internal brass cogwheels + rim sunburst
    for (const [gx, gy, gr] of [
      [-8, 5, 9],
      [7, -6, 7],
      [12, 10, 6],
    ] as const) {
      a.ring(cx + gx, cy + gy, gr, gr * 0.92, T.gold);
      a.disc(cx + gx, cy + gy, 2, 2, T.goldL);
    }
    const sx = cx + R * 0.62, sy = cy - R * 0.58;
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * TAU;
      a.petal(sx, sy, ang, 7, 1.4, T.goldD, T.gold, T.goldL);
    }
    a.disc(sx, sy, 3.5, 3.5, T.goldHi);
  } else {
    // 12-ray golden solar hub
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TAU;
      a.petal(cx, cy, ang, k % 2 === 0 ? 13 : 9, 1.8, T.goldD, T.gold, T.goldL);
    }
    a.disc(cx, cy, 5, 5, T.sapphireD);
    a.disc(cx - 0.5, cy - 0.5, 3.2, 3.2, T.sapphireL);
  }
}

function paintHeroCompassRose(a: Art, cx: number, cy: number, R: number, T: AstralTheme) {
  const ry = R * 0.92;
  // Sapphire & gold degree ring (studded with stars!)
  a.alpha(0.32, () => a.disc(cx + 1, cy + 2, R * 0.74, ry * 0.74, '#091224'));
  a.disc(cx, cy, R * 0.72, ry * 0.72, T.goldD);
  a.disc(cx, cy, R * 0.68, ry * 0.68, T.sapphireD);
  a.disc(cx, cy, R * 0.56, ry * 0.56, T.gold);
  a.disc(cx, cy, R * 0.52, ry * 0.52, T.night ? T.st1 : T.st2);
  a.ring(cx, cy, R * 0.7, ry * 0.7, T.goldL);
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * TAU;
    a.p(cx + Math.cos(ang) * R * 0.62, cy + Math.sin(ang) * ry * 0.62, T.goldHi);
  }

  // 4 Secondary diagonal golden star points
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * TAU + Math.PI / 4;
    a.petal(cx, cy, ang, R * 0.78, R * 0.14, T.goldD, T.gold, T.goldL, 0.72);
  }

  // 4 Principal cardinal faceted Gold + Cobalt-Sapphire Compass Points (spanning 2*R = 88 art-px!)
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * TAU;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const nx = -sn, ny = cs;
    const tipL = k % 2 === 0 ? R : R * 0.94;
    const baseW = R * 0.18;
    const steps = Math.ceil(tipL * 1.5);
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const hw = (1 - u) * baseW;
      const bx = cx + cs * (u * tipL);
      const by = cy + sn * (u * tipL * 0.94);
      for (let w = -hw; w <= hw; w += 0.45) {
        const px = bx + nx * w, py = by + ny * w;
        const border = Math.abs(w) > hw - 0.8;
        const col = border ? T.goldD : w < 0 ? (u < 0.7 ? T.goldHi : T.goldL) : T.sapphire;
        a.p(px, py, col);
      }
    }
  }

  // Central glowing sapphire cabochon in gold bezel
  a.disc(cx, cy, 8.2, 7.6, T.goldD);
  a.disc(cx, cy, 7.0, 6.5, T.goldL);
  a.disc(cx, cy, 5.4, 5.0, T.sapphireD);
  a.disc(cx - 0.8, cy - 0.8, 3.8, 3.5, T.sapphireL);
  a.r(cx - 2, cy - 2, 2, 2, '#ffffff');
}

function paintCrystalObelisk(a: Art, cx: number, by: number, h: number, T: AstralTheme) {
  // Stepped brass pedestal + tall starry sapphire crystal spire (from time-astrolabe.png!)
  a.r(cx - 7, by - 4, 14, 4, T.parapet0);
  a.r(cx - 6, by - 6, 12, 2, T.gold);
  for (let y = 0; y < h; y++) {
    const u = y / h;
    const hw = u > 0.78 ? Math.max(0.5, ((1 - u) / 0.22) * 4.5) : 4.5 - u * 1.2;
    for (let dx = -hw; dx <= hw; dx += 0.5) {
      const col = Math.abs(dx) > hw - 0.8 ? T.gold : dx < 0 ? T.sapphire : T.sapphireD;
      a.p(cx + dx, by - 6 - y, col);
    }
  }
  a.p(cx - 1, by - 14, T.goldHi);
  a.p(cx + 1, by - 21, '#ffffff');
  a.p(cx, by - 6 - h, T.goldHi);
}

function paintHourglass(a: Art, cx: number, cy: number, T: AstralTheme) {
  a.r(cx - 4, cy - 7, 9, 2, T.gold);
  a.r(cx - 4, cy + 6, 9, 2, T.gold);
  a.line(cx - 4, cy - 5, cx - 4, cy + 6, T.goldD);
  a.line(cx + 4, cy - 5, cx + 4, cy + 6, T.goldD);
  for (let dy = -5; dy <= 5; dy++) {
    const hw = Math.max(0.6, (Math.abs(dy) / 5) * 3.2);
    a.r(cx - hw, cy + dy, hw * 2 + 1, 1, dy > 1 ? T.goldL : T.sapphireL);
  }
}

function astralScene(T: AstralTheme): Scene {
  return {
    plan(L) {
      return {
        compass: { x: L.cx - 12, y: L.cy + 2, R: Math.min(44, L.gw * 0.235) },
        dialTop: { x: L.cx + 38, y: L.cy - 28, R: 35 },
        dialBot: { x: L.cx + 44, y: L.cy + 36, R: 33 },
        moon: { x: L.cx, y: 12, R: 11.5 },
      };
    },

    paint(a, L, P) {
      // 1. Star-trail observatory sky + stepped open parapet + cracked marble/slate court
      a.field((x, y) => {
        const notch = Math.abs(x - L.cx) < 28 ? 8 : Math.abs(x - L.cx) < 42 ? 4 : 0;
        const parapetTop = L.gt - 3 + notch;
        if (y < parapetTop - 6 || x < L.gl - 22 || x > L.gr + 22) {
          const md = Math.hypot(x - P.moon.x, y - P.moon.y);
          const sy = clamp(y / L.H, 0, 1);
          const sky = [T.sky0, T.sky1, T.sky2];
          return sky[band(sy * 2.2 + (md < 48 ? (48 - md) * 0.015 : 0), x, y, 3, 0.42)]!;
        }
        if (y < parapetTop + 2 || x < L.gl - 10 || x > L.gr + 10 || y > L.gb + 6) {
          const b = ((Math.floor(x / 10) + Math.floor(y / 6)) % 2) * 0.25 + vnoise(x, y, 8, 91) * 0.6;
          return [T.parapet0, T.parapet1, T.parapet2][band(b * 2.4, x, y, 3, 0.35)]!;
        }
        const fs = flagstone(x, y, 16, 37);
        if (fs.edge < 0.52) return T.crack;
        const rad = Math.hypot((x - L.cx) / 118, (y - L.cy) / 98);
        const v = clamp(1.34 - rad * 0.48 + (fs.shade - 0.5) * 0.3, 0, 1.99);
        const stones = [T.st0, T.st1, T.st2, T.st3];
        return stones[band(v * 2.2, x, y, 4, 0.36)]!;
      });

      // Billowing pixel star-clouds overlapping the outer observatory walls so edges feel dreamy & non-rectangular!
      for (const [cx, cy, _rw] of [
        [L.gl - 20, L.gt + 70, 16],
        [L.gl - 24, L.gb - 38, 18],
        [L.gr + 22, L.gt + 66, 17],
        [L.gr + 24, L.mid + 26, 16],
      ] as const) {
        a.alpha(0.85, () => {
          for (const [dx, dy, r] of [[-6, 2, 6], [0, -2, 8], [7, 1, 6]] as const) {
            a.disc(cx + dx, cy + dy, r, r * 0.72, T.parapet1);
            a.disc(cx + dx - 1, cy + dy - 1, r * 0.75, r * 0.52, T.parapet2);
          }
          a.arc(cx, cy - 2, 8, 5, -2.6, -0.5, T.goldL);
        });
      }

      // Concentric celestial star-trail rings in the upper sky + Glowing Crescent Moon!
      a.alpha(0.42, () => {
        for (const r of [20, 30, 42, 56, 72, 92, 116]) {
          a.ring(P.moon.x, P.moon.y, r, r * 0.88, T.trail, 10, r * 0.1);
        }
      });
      a.disc(P.moon.x, P.moon.y, P.moon.R, P.moon.R, T.moon, (dx, dy) => {
        return (dx - 4.2) ** 2 + (dy + 2.4) ** 2 < (P.moon.R * 0.86) ** 2;
      });
      a.disc(P.moon.x - 1, P.moon.y + 0.5, P.moon.R - 1.8, P.moon.R - 1.8, T.moonHi, (dx, dy) => {
        return (dx - 3.5) ** 2 + (dy + 2.0) ** 2 < (P.moon.R * 0.84) ** 2;
      });

      // 2. Interlocking Giant Astronomical Clockwork Dials (upper-right & lower-right)
      paintClockworkDial(a, P.dialTop.x, P.dialTop.y, P.dialTop.R, T, true);
      paintClockworkDial(a, P.dialBot.x, P.dialBot.y, P.dialBot.R, T, false);

      // 3. Sweeping Golden Starlight Comet Arcs across the court (signature of time-astrolabe.png!)
      for (const [rx, ry, a0, a1] of [
        [92, 76, 1.65, 4.55],
        [76, 63, 1.75, 4.45],
        [62, 51, 1.9, 4.25],
      ] as const) {
        a.alpha(0.75, () => a.arc(L.cx + 22, L.cy + 2, rx, ry, a0, a1, T.goldL, 1.6));
        a.arc(L.cx + 22, L.cy + 2, rx, ry, a0 + 0.1, a1 - 0.1, T.goldHi, 1);
      }
      starFlare(a, L.cx - 68, L.cy - 8, 4, '#ffffff', T.goldHi);
      starFlare(a, L.cx - 52, L.cy + 46, 4, '#ffffff', T.goldHi);
      starFlare(a, L.cx - 12, L.cy - 48, 3, '#ffffff', T.goldHi);

      // 4. HERO 8-Pointed Gold & Sapphire Compass Rose overlapping the dials!
      paintHeroCompassRose(a, P.compass.x, P.compass.y, P.compass.R, T);

      // 5. Subtle star-tick skeleton
      skeleton(a, L, T.skel, 0.22, T.goldL);

      // 6. Perimeter Astronomical Instruments: Crystal Obelisks, Golden Orrery, Hourglasses & Roman Clock!
      paintCrystalObelisk(a, L.gl - 16, L.gt + 18, 28, T);
      paintCrystalObelisk(a, L.gr + 16, L.gb - 2, 24, T);

      // Top-right Golden Planetary Orrery
      const ox = L.gr + 10, oy = L.gt + 6;
      a.disc(ox, oy + 10, 7, 3, T.goldD);
      a.ring(ox, oy, 15, 7, T.goldL);
      a.ring(ox, oy, 11, 5, T.gold);
      a.disc(ox, oy, 4, 4, T.goldHi);
      a.disc(ox - 11, oy + 2, 2, 2, T.sapphireL);

      // Flank Brass Hourglasses
      for (const hy of [L.gt + 44, L.mid, L.gb - 38]) {
        paintHourglass(a, L.gl - 16, hy, T);
        paintHourglass(a, L.gr + 16, hy, T);
      }

      // Bottom-left Roman Clock Medallion
      const clx = L.gl - 16, cly = L.gb - 6;
      a.disc(clx, cly, 13, 12, T.goldD);
      a.disc(clx, cly, 11, 10, '#d8e2f0');
      a.ring(clx, cly, 11.5, 10.5, T.goldL);
      a.line(clx, cly, clx - 4, cly - 4, T.parapet0);
      a.line(clx, cly, clx + 6, cly - 2, T.goldD);

      // 7. Bench: 9 Brass Clockwork Gear & Mechanical Songbird Medallions!
      for (const [i, s] of benchSlots(L).entries()) {
        const rx = Math.min(10.6, L.bs * 0.44);
        a.alpha(0.4, () => a.disc(s.x + 1, s.y + 2, rx + 1, 8.5, '#091121'));
        a.disc(s.x, s.y, rx, 8, T.goldD);
        a.ring(s.x, s.y, rx - 0.6, 7.4, T.goldL, 8, i * 0.2);
        a.disc(s.x, s.y, rx - 2.4, 5.6, T.parapet0);
        // Gear spokes
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * TAU + i * 0.3;
          a.line(s.x, s.y, s.x + Math.cos(ang) * (rx - 2), s.y + Math.sin(ang) * 5.2, T.gold);
        }
        a.disc(s.x, s.y, 2.4, 2.0, i % 3 === 0 ? T.sapphireL : T.goldHi);
      }
    },

    anim(a, L, P, t) {
      const sec = t * 0.001;

      // 1. Delicate rotating astrolabe hands on both giant dials!
      for (const [d, spd, col] of [
        [P.dialTop, 0.22, T.goldHi],
        [P.dialBot, -0.17, T.sapphireL],
      ] as const) {
        const ang = sec * spd;
        const tx = d.x + Math.cos(ang) * (d.R - 6);
        const ty = d.y + Math.sin(ang) * ((d.R - 6) * 0.92);
        a.line(d.x - Math.cos(ang) * 5, d.y - Math.sin(ang) * 4.5, tx, ty, col);
        a.disc(tx, ty, 1.4, 1.4, T.goldHi);
        a.disc(d.x, d.y, 2.0, 2.0, T.goldHi);
      }

      // 2. Orbiting planets on the top-right Orrery
      const ox = L.gr + 10, oy = L.gt + 6;
      const oa = sec * 0.9;
      a.disc(ox + Math.cos(oa) * 15, oy + Math.sin(oa) * 7, 2.0, 2.0, T.goldHi);
      a.disc(ox + Math.cos(-oa * 1.4) * 11, oy + Math.sin(-oa * 1.4) * 5, 1.6, 1.6, T.sapphireL);

      // 3. Traveling starlight flares along the 3 sweeping golden comet arcs
      for (let k = 0; k < 3; k++) {
        const rx = [92, 76, 62][k]!, ry = [76, 63, 51][k]!;
        const u = wrap(sec * (0.14 + k * 0.03) + k * 0.33, 1);
        const ang = 1.7 + u * 2.8;
        const sx = L.cx + 22 + Math.cos(ang) * rx;
        const sy = L.cy + 2 + Math.sin(ang) * ry;
        starFlare(a, sx, sy, 3, '#ffffff', T.goldHi);
      }

      // 4. Twinkling sky stars & periodic shooting star
      for (let i = 0; i < 14; i++) {
        const sx = i % 2 === 0 ? 4 + (i * 11) % Math.max(8, Math.floor(L.gl - 20)) : L.gr + 20 + (i * 13) % Math.max(8, Math.floor(L.W - L.gr - 22));
        const sy = 6 + ((i * 29) % (L.H - 16));
        const tw = Math.sin(sec * 2.6 + i * 1.7);
        if (tw > 0.3) starFlare(a, sx, sy, tw > 0.78 ? 2 : 1, '#ffffff', T.goldL);
      }
      const shoot = wrap(sec * 0.16, 1);
      if (shoot < 0.18) {
        const q = shoot / 0.18;
        const sx = 28 + q * 95, sy = 8 + q * 24;
        a.stroke(sx - 12, sy - 3, sx, sy, 0.5, 1.1, T.goldHi);
        a.p(sx, sy, '#ffffff');
      }
    },
  };
}

/* ═══════════════════════════ 6. 竹影潭 · BAMBOO POOL ═══════════════════════════ */

const BAMBOO_PAL: Pal = {
  mist0: '#e5f2e7',
  mist1: '#bedbc4',
  mist2: '#8eb89d',
  mtn: '#68967c',
  w0: '#1d4d44',
  w1: '#2a695d',
  w2: '#3f8a7a',
  w3: '#61ad9b',
  w4: '#8cd0be',
  w5: '#baeada',
  foam: '#e6fcf3',
  rk0: '#46574f',
  rk1: '#65786d',
  rk2: '#8ba092',
  rk3: '#b4c4b5',
  rk4: '#d5e0d2',
  moss0: '#2d5934',
  moss1: '#4c8249',
  moss2: '#75ad62',
  moss3: '#a3d483',
  culmD: '#224a2e',
  culm: '#3f7847',
  culmL: '#6ea868',
  culmHi: '#a6d991',
  orchid: '#fceAD8',
  orchidP: '#f0b89c',
  orchidC: '#d96e54',
};

function paintMossyBoulder(a: Art, cx: number, cy: number, rx: number, ry: number, C: Pal, seed = 1) {
  a.alpha(0.35, () => a.disc(cx + 2, cy + 3, rx + 1, ry + 1, '#15302a'));
  const bx = Math.ceil(rx + 2), by = Math.ceil(ry + 2);
  const X = Math.round(cx), Y = Math.round(cy);
  for (let dy = -by; dy <= by; dy++) {
    for (let dx = -bx; dx <= bx; dx++) {
      const ang = Math.atan2(dy, dx);
      const Ir = 1 + 0.1 * Math.sin(ang * 4 + seed) + 0.07 * Math.cos(ang * 7 - seed);
      const d2 = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d2 > Ir * Ir) continue;
      const px = X + dx, py = Y + dy;
      const topMoss = dy < -ry * 0.18 + Math.sin(dx * 0.35 + seed) * 3;
      if (topMoss && hash2(px, py, seed) > 0.18) {
        const mv = clamp((-dy / ry) * 1.4 + vnoise(px, py, 5, seed), 0, 1.99);
        a.p(px, py, [C.moss0!, C.moss1!, C.moss2!, C.moss3!][band(mv * 2, px, py, 4, 0.4)]!);
      } else {
        const lv = clamp((-dx * 0.5 - dy * 0.7) / Math.max(1, rx) + 0.85, 0, 1.99);
        a.p(px, py, [C.rk0!, C.rk1!, C.rk2!, C.rk3!, C.rk4!][band(lv * 2.4, px, py, 5, 0.38)]!);
      }
    }
  }
}

function paintWildOrchidCluster(a: Art, cx: number, cy: number, dir: 1 | -1, C: Pal) {
  // Arching emerald sword leaves + 3 delicate pale-apricot & ivory mountain orchids (from bamboo-pool.png!)
  for (let i = -3; i <= 3; i++) {
    const lAng = -Math.PI / 2 + i * 0.28 + dir * 0.18;
    const tx = cx + Math.cos(lAng) * 18, ty = cy + Math.sin(lAng) * 16 + 4;
    a.quad(cx, cy + 4, (cx + tx) / 2, cy - 8, tx, ty, 1.0, 0.4, i % 2 ? C.moss0! : C.moss2!);
  }
  for (const [ox, oy, R] of [
    [cx + dir * 3, cy - 9, 5.2],
    [cx - dir * 5, cy - 5, 4.6],
    [cx + dir * 8, cy - 3, 4.2],
  ] as const) {
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * TAU - 0.3;
      a.petal(ox, oy, ang, R, 1.5, C.orchidP!, C.orchid!, '#ffffff', 0.65);
    }
    a.disc(ox, oy, 1.4, 1.4, C.orchidC!);
  }
}

function paintBambooCulm(a: Art, bx: number, y0: number, y1: number, lean: number, w: number, C: Pal) {
  const steps = Math.abs(y1 - y0);
  for (let s = 0; s <= steps; s++) {
    const t = s / Math.max(1, steps);
    const y = y0 + (y1 - y0) * t;
    const x = bx + lean * t * t;
    const X = Math.round(x), Y = Math.round(y);
    a.r(X - Math.floor(w / 2), Y, w, 1, C.culm!);
    a.p(X - Math.floor(w / 2), Y, C.culmD!);
    if (w >= 3) a.p(X - Math.floor(w / 2) + 1, Y, C.culmHi!);
    if (w >= 4) a.p(X + Math.ceil(w / 2) - 1, Y, C.culmD!);
    if (s > 6 && s % 18 === 0) {
      a.r(X - Math.floor(w / 2) - 1, Y, w + 2, 1, C.culmD!);
      a.r(X - Math.floor(w / 2), Y - 1, w, 1, C.culmHi!);
    }
  }
}

function paintBambooCanopy(a: Art, cx: number, cy: number, dir: 1 | -1, count: number, C: Pal) {
  for (let i = 0; i < count; i++) {
    const ang = (dir > 0 ? 0.35 : Math.PI - 0.35) + ((i - count / 2) / count) * 1.45;
    const len = 11 + (i % 3) * 4;
    a.petal(
      cx + dir * (i % 3) * 3,
      cy + ((i * 3) % 7) - 3,
      ang,
      len,
      1.9,
      C.culmD!,
      i % 2 ? C.culm! : C.culmL!,
      C.culmHi!,
      0.68,
    );
  }
}

const bambooScene: Scene = {
  plan(L) {
    return {
      boulders: [
        // Irregular rocky spring shoreline (NO rectangle!)
        { x: L.gl - 18, y: L.gt + 6, rx: 24, ry: 15, s: 1 },
        { x: L.gl - 24, y: L.gt + 38, rx: 22, ry: 20, s: 2 },
        { x: L.gl - 26, y: L.mid + 12, rx: 24, ry: 24, s: 3 },
        { x: L.gl - 20, y: L.gb - 12, rx: 25, ry: 18, s: 4 },
        { x: L.gr + 20, y: L.gt + 8, rx: 26, ry: 16, s: 5 },
        { x: L.gr + 26, y: L.gt + 44, rx: 24, ry: 24, s: 6 },
        { x: L.gr + 24, y: L.mid + 16, rx: 25, ry: 22, s: 7 },
        { x: L.gr + 20, y: L.gb - 10, rx: 24, ry: 18, s: 8 },
        { x: L.cx, y: L.gt - 4, rx: 14, ry: 8, s: 9 },
      ],
    };
  },

  paint(a, L, P) {
    const C = BAMBOO_PAL;

    // 1. Misty layered mountain vista at top + crystal-clear emerald mountain spring pool!
    a.field((x, y) => {
      const bankTop = L.gt - 3 + 5 * Math.cos(((x - L.cx) / 90) * Math.PI);
      if (y < bankTop - 2) {
        // Distant misty mountain peaks in the valley opening (just like bamboo-pool.png!)
        const mtn1 = 16 - 9 * Math.exp(-(((x - (L.cx + 18)) / 22) ** 2)) - 6 * Math.exp(-(((x - (L.cx - 26)) / 20) ** 2));
        if (y > mtn1 && Math.abs(x - L.cx) < 76) return y > mtn1 + 4 ? C.mist2! : C.mtn!;
        return y < 9 ? C.mist0! : C.mist1!;
      }

      // Bottom natural stone ledge for bench
      if (y > L.gb + 5 + 3 * Math.sin(x * 0.08)) {
        const lv = vnoise(x, y, 12, 73) * 0.7 + vnoise(x, y, 4, 79) * 0.3;
        return [C.rk0!, C.rk1!, C.rk2!, C.rk3!, C.rk4!][band(lv * 3.8, x, y, 5, 0.4)]!;
      }

      // Crystal-clear emerald-to-moonlit-celadon mountain spring water!
      const nx = (x - L.cx) / Math.max(68, L.gw * 0.56);
      const ny = (y - (L.cy + 2)) / (L.gh * 0.56);
      const r = Math.hypot(nx, ny);
      const wn = vnoise(x, y, 18, 51) * 0.45;
      const v = clamp(1.58 - r * 1.05 + (wn - 0.22) * 0.5, 0, 1.99);
      const water = [C.w0!, C.w1!, C.w2!, C.w3!, C.w4!, C.w5!];
      return water[band(v * 2.9, x, y, 6, 0.42)]!;
    });

    // 2. Submerged river cobbles & dappled bamboo-leaf reflections in the upper shallows
    a.alpha(0.28, () => {
      for (const [sx, sy, rx, ry] of [
        [L.cx - 52, L.cy + 38, 12, 7],
        [L.cx - 32, L.cy + 52, 14, 8],
        [L.cx + 46, L.cy + 42, 13, 7],
        [L.cx - 44, L.gt + 26, 11, 6],
        [L.cx + 44, L.gt + 28, 12, 7],
      ] as const) {
        a.disc(sx, sy, rx, ry, C.w1!);
      }
      // Submerged bamboo leaf reflections (signature detail of bamboo-pool.png!)
      for (let i = 0; i < 9; i++) {
        a.petal(L.gl + 16 + i * 7, L.gt + 14 + (i % 3) * 6, 1.2 + (i % 2) * 0.3, 12, 1.8, C.w1!, C.w0!);
        a.petal(L.gr - 16 - i * 7, L.gt + 16 + (i % 3) * 6, 1.9 - (i % 2) * 0.3, 12, 1.8, C.w1!, C.w0!);
      }
    });

    // 3. MASSIVE CENTRAL CONCENTRIC SPRING RIPPLES (~126 × 102 art-px!)
    const rcx = L.cx, rcy = L.cy + 2;
    for (const [rx, ry, al] of [
      [12, 9.5, 0.72],
      [23, 18, 0.65],
      [36, 28, 0.56],
      [50, 39, 0.46],
      [64, 50, 0.36],
    ] as const) {
      a.alpha(al, () => {
        a.ring(rcx, rcy, rx, ry, C.foam!, 12, rx * 0.08);
        a.ring(rcx, rcy + 1, rx + 1.2, ry + 1, C.w5!, 9, rx * 0.13);
      });
    }

    // 4. Invisible water-glint grid skeleton
    skeleton(a, L, C.foam!, 0.23, C.foam!);

    // 5. Cove lily pads tucked near rocky banks
    for (const [px, py, R] of [
      [L.gl + 14, L.gt + 10, 8],
      [L.gl + 6, L.gt + 18, 6],
      [L.gr - 24, L.gb - 10, 7.5],
      [L.gl + 18, L.gb - 12, 6.5],
    ] as const) {
      sculptLotusPad(a, px, py, R, 0.8, {
        shadow: '#12332c',
        padD: C.moss0!,
        pad: C.moss1!,
        padM: C.moss2!,
        padL: C.moss3!,
        padRim: C.culmHi!,
        padCore: C.culmHi!,
        vein: C.moss0!,
        veinL: C.moss3!,
      });
    }

    // 6. Background bamboo stalks behind the boulders + massive mossy shoreline boulders!
    for (const [bx, lean, w] of [
      [28, 5, 3],
      [L.gl - 10, 4, 3],
      [L.W - 29, -5, 3],
      [L.gr + 10, -4, 3],
    ] as const) {
      paintBambooCulm(a, bx, L.gb, 0, lean, w, C);
    }

    for (const b of P.boulders) {
      paintMossyBoulder(a, b.x, b.y, b.rx, b.ry, C, b.s);
    }

    // Carved mossy stone lantern (石灯笼) perched on upper-right boulder!
    const lx = L.gr + 16, ly = L.gt + 16;
    a.r(lx - 4, ly + 4, 9, 2, C.rk1!);
    a.r(lx - 2, ly - 2, 5, 6, C.rk2!);
    a.r(lx - 1, ly - 1, 3, 3, '#ffe394');
    a.p(lx, ly, '#ffffff');
    for (let h = 0; h < 4; h++) a.r(lx - 6 + h, ly - 3 - h, 13 - h * 2, 1, C.rk1!);
    a.r(lx - 5, ly - 4, 10, 1, C.moss2!);

    // 7. Blooming wild mountain orchids & swaying cattails on the mossy boulders!
    paintWildOrchidCluster(a, L.gl - 12, L.mid - 4, 1, C);
    paintWildOrchidCluster(a, L.gr + 10, L.mid + 18, -1, C);
    paintWildOrchidCluster(a, L.cx + 42, L.gb - 6, -1, C);

    // 8. Foreground framing bamboo culms at far outer margins & lush overhanging bamboo canopies!
    for (const [bx, lean, w] of [
      [7, 6, 5],
      [16, 8, 4],
      [L.W - 7, -6, 5],
      [L.W - 16, -8, 4],
    ] as const) {
      paintBambooCulm(a, bx, L.H, 0, lean, w, C);
    }
    paintBambooCanopy(a, L.gl - 4, 16, 1, 13, C);
    paintBambooCanopy(a, L.gl - 12, 48, 1, 10, C);
    paintBambooCanopy(a, L.gr + 4, 18, -1, 13, C);
    paintBambooCanopy(a, L.gr + 12, 52, -1, 10, C);

    // 9. Bench: 9 sculpted mossy river-stone seats along the bottom stone ledge + creeping vines
    for (const [i, s] of benchSlots(L).entries()) {
      const rx = Math.min(11, L.bs * 0.45);
      paintMossyBoulder(a, s.x, s.y + 1, rx, 7.6, C, 20 + i);
      a.disc(s.x, s.y - 0.5, rx - 2.4, 5.0, C.rk3!);
      a.disc(s.x - 1, s.y - 1, rx - 4.2, 3.4, C.rk4!);
    }
    // Thorny/mossy foreground vine weaving across the very bottom edge (like bamboo-pool.png!)
    a.quad(0, L.H - 4, L.cx * 0.5, L.H - 12, L.cx, L.H - 3, 1.3, 0.7, C.moss0!);
    a.quad(L.W, L.H - 4, L.cx * 1.5, L.H - 12, L.cx + 10, L.H - 3, 1.3, 0.7, C.moss0!);
  },

  anim(a, L, _P, t) {
    const sec = t * 0.001;
    const C = BAMBOO_PAL;

    // 1. Live expanding spring water rings from the center of the pool!
    for (let i = 0; i < 3; i++) {
      const cyc = (sec * 0.28 + i / 3) % 1;
      const rx = 6 + cyc * 66;
      const ry = rx * 0.78;
      a.alpha((1 - cyc) * 0.52, () => {
        a.ring(L.cx, L.cy + 2, rx, ry, C.foam!, 10, cyc * 3);
      });
    }

    // 2. Gentle swaying bamboo leaf tips at the upper overhanging canopies
    const sway = Math.sin(sec * 1.8) * 0.14;
    for (let i = 0; i < 4; i++) {
      a.petal(L.gl + 2 + i * 5, 14 + i * 3, 0.55 + sway, 11, 1.7, C.culmD!, C.culmL!, C.culmHi!);
      a.petal(L.gr - 2 - i * 5, 16 + i * 3, Math.PI - 0.55 + sway, 11, 1.7, C.culmD!, C.culmL!, C.culmHi!);
    }

    // 3. Tumbling emerald bamboo leaves drifting slowly across the pool & kissing the water
    for (let i = 0; i < 8; i++) {
      const cyc = wrap(sec * (0.09 + (i % 3) * 0.02) + i * 0.17, 1);
      const lx = 26 + hash2(i, 3, 67) * (L.W - 52) + Math.sin(cyc * TAU * 1.5 + i) * 14;
      const ly = 12 + cyc * (L.gb - 12);
      const rot = sec * 1.5 + i;
      a.petal(lx, ly, rot, 6.2, 1.4, C.culmD!, C.culmL!, C.culmHi!);
      if (cyc > 0.84) {
        const rw = (cyc - 0.84) / 0.16;
        a.alpha((1 - rw) * 0.45, () => a.ring(lx + 2, ly + 1, 2 + rw * 7, 1.5 + rw * 5, C.foam!));
      }
    }
  },
};

/* ═══════════════════════════ 7. 汐音珠贝 · CORAL LAGOON ═══════════════════════════ */

const LAGOON_PAL: Pal = {
  w0: '#123a4f',
  w1: '#1a526b',
  w2: '#26728c',
  w3: '#3f9cad',
  w4: '#6ecec8',
  w5: '#a8f0e4',
  caustic: '#dcfff9',
  blushW: '#f4d3e8',
  shadow: '#0c2938',
  nacreD: '#7282a3',
  nacreM: '#a6bad6',
  nacreA: '#ccf2ee',
  nacreB: '#f5d5e8',
  nacreL: '#fff7fc',
  pearl0: '#9c5b86',
  pearl1: '#cc88b4',
  pearl2: '#f2bede',
  pearl3: '#ffe8f6',
  coralD: '#943258',
  coral: '#d65680',
  coralL: '#ff99ba',
  coralTip: '#ffe0eb',
  peachD: '#b05342',
  peach: '#eb8067',
  peachL: '#ffba9e',
  lavD: '#584485',
  lav: '#8b70c2',
  lavL: '#cab5f5',
  kelpD: '#154a47',
  kelp: '#26756b',
  kelpL: '#52ad98',
  gold: '#ffe28a',
};

function sculptScallopSeat(a: Art, cx: number, cy: number, rx: number, blush: boolean, C: Pal) {
  const ry = rx * 0.72;
  a.alpha(0.34, () => a.disc(cx + 1, cy + 2, rx + 1, ry + 1, C.shadow!));
  // 7 fluted shell ribs fanning upward from bottom hinge
  const ribs = 7;
  for (let k = 0; k < ribs; k++) {
    const u = (k / (ribs - 1)) * 2 - 1; // -1 .. 1
    const ang = -Math.PI / 2 + u * 1.12;
    const len = rx * (1.06 - Math.abs(u) * 0.14);
    const body = k % 2 === 0 ? (blush ? C.nacreB! : C.nacreA!) : C.nacreL!;
    a.petal(cx + u * 2.2, cy + ry * 0.55, ang, len, rx * 0.25, C.nacreD!, body, '#ffffff', 0.62);
  }
  // Smooth inner nacre cradle & tiny hinge pearl
  a.disc(cx, cy + 0.5, rx * 0.66, ry * 0.56, blush ? C.nacreB! : C.nacreA!);
  a.disc(cx, cy - 0.2, rx * 0.48, ry * 0.4, C.nacreL!);
  a.disc(cx, cy + ry * 0.52, 2.2, 1.8, C.pearl1!);
  a.p(cx - 0.5, cy + ry * 0.52 - 0.5, '#ffffff');
}

function sculptPearlSanctuary(a: Art, cx: number, cy: number, C: Pal) {
  // 1. Opalescent underwater sandbar & shimmering caustic rings (~124×98 art-px)
  for (const [rx, ry, al, col] of [
    [58, 45, 0.34, C.caustic!],
    [45, 35, 0.42, C.blushW!],
    [33, 26, 0.48, C.caustic!],
  ] as const) {
    a.alpha(al, () => {
      a.ring(cx, cy + 2, rx, ry, col, 10, rx * 0.1);
      a.ring(cx, cy + 3, rx + 1.4, ry + 1, C.w5!, 8, rx * 0.17);
    });
  }

  // Soft cast shadow under giant clam
  a.alpha(0.38, () => a.disc(cx + 1, cy + 12, 34, 18, C.shadow!));

  // Delicate coral & sea-lavender sprigs tucked around the clam base
  for (const [ang, len, isRose] of [
    [-2.75, 22, true],
    [-2.42, 17, false],
    [-0.39, 22, true],
    [-0.72, 17, false],
    [2.55, 19, false],
    [0.58, 19, true],
  ] as const) {
    const bx = cx + Math.cos(ang) * 24, by = cy + 4 + Math.sin(ang) * 14;
    a.petal(
      bx,
      by,
      ang,
      len,
      2.6,
      isRose ? C.coralD! : C.lavD!,
      isRose ? C.coral! : C.lav!,
      isRose ? C.coralL! : C.lavL!,
      0.55,
    );
  }

  // 2. Upper open fluted Mother-of-Pearl fan valve (9 iridescent ribs!)
  const RIBS = 9;
  const hingeY = cy + 6;
  for (let k = 0; k < RIBS; k++) {
    const u = (k / (RIBS - 1)) * 2 - 1;
    const ang = -Math.PI / 2 + u * 1.18;
    const len = 35 - Math.abs(u) * 6;
    const midCol = k % 2 === 0 ? C.nacreB! : C.nacreA!;
    a.petal(cx + u * 5.5, hingeY, ang, len, 5.4, C.nacreD!, midCol, C.nacreL!, 0.65);
  }
  // Scalloped pearl studs along the upper valve rim
  for (let k = 0; k < RIBS; k++) {
    const u = (k / (RIBS - 1)) * 2 - 1;
    const ang = -Math.PI / 2 + u * 1.18;
    const len = 34 - Math.abs(u) * 6;
    const rxp = cx + u * 5.5 + Math.cos(ang) * len;
    const ryp = hingeY + Math.sin(ang) * len;
    a.disc(rxp, ryp, 1.8, 1.6, C.nacreL!);
  }

  // 3. Lower cupped nacre shell basin cradling the pearl
  a.disc(cx, cy + 10, 31, 16, C.nacreD!);
  a.disc(cx, cy + 9, 29, 14.5, C.nacreM!);
  a.disc(cx, cy + 8, 26, 12.5, C.nacreB!);
  a.disc(cx, cy + 7.5, 21, 9.8, C.nacreA!);
  a.disc(cx, cy + 7, 16, 7.2, C.nacreL!);
  // Fluted lip wave along lower front rim
  for (let i = -4; i <= 4; i++) {
    const lx = cx + i * 6.2;
    const ly = cy + 20 - Math.abs(i) * 0.9;
    a.disc(lx, ly, 3.4, 2.1, i % 2 === 0 ? C.nacreL! : C.nacreB!);
    a.arc(lx, ly + 0.6, 3.4, 2.1, 0.2, Math.PI - 0.2, C.nacreD!);
  }

  // 4. Giant Luminous Pink-Opalescent Pearl (R = 11.5 => 23 art-px across!) + satellite dew-pearls
  const py = cy + 2;
  a.alpha(0.35, () => a.disc(cx + 1, py + 3, 13, 9.5, C.nacreD!));
  a.disc(cx, py, 11.5, 11.2, C.pearl0!);
  a.disc(cx - 0.6, py - 0.6, 10.2, 9.9, C.pearl1!);
  // Aqua-opalescent lower bounce light
  a.arc(cx + 1, py + 1, 9.2, 8.8, 0.25, 2.4, C.nacreA!, 2);
  a.disc(cx - 1.5, py - 1.5, 7.8, 7.4, C.pearl2!);
  a.disc(cx - 2.6, py - 2.6, 4.8, 4.4, C.pearl3!);
  a.r(cx - 5, py - 5, 3, 3, '#ffffff');
  a.p(cx + 4, py + 3, '#ffffff');

  // 6 tiny satellite pearls resting in the shell folds
  for (const [dx, dy, pr] of [
    [-16, 6, 2.5],
    [16, 6, 2.5],
    [-22, 2, 1.9],
    [22, 2, 1.9],
    [-10, 12, 2.0],
    [10, 12, 2.0],
  ] as const) {
    a.disc(cx + dx, cy + dy, pr, pr * 0.9, C.pearl1!);
    a.disc(cx + dx - 0.4, cy + dy - 0.4, pr * 0.65, pr * 0.6, C.pearl3!);
    a.p(cx + dx - 0.8, cy + dy - 0.8, '#ffffff');
  }
}

function sculptStaghornCoral(
  a: Art,
  bx: number,
  by: number,
  dirX: number,
  dirY: number,
  scale: number,
  cols: { d: string; m: string; l: string; tip: string },
  C: Pal,
) {
  a.alpha(0.32, () => a.disc(bx + 2, by + 3, 11 * scale, 8 * scale, C.shadow!));
  const branches = [
    [0, 0, dirX * 18, dirY * 16, 3.0, 1.8],
    [dirX * 6, dirY * 5, dirX * 22, dirY * 4, 2.3, 1.5],
    [dirX * 7, dirY * 6, dirX * 8, dirY * 22, 2.3, 1.5],
    [dirX * 12, dirY * 10, dirX * 26, dirY * 14, 1.9, 1.3],
    [dirX * 11, dirY * 11, dirX * 16, dirY * 25, 1.9, 1.3],
  ] as const;
  for (const [x0, y0, x1, y1, r0, r1] of branches) {
    a.stroke(bx + x0 * scale, by + y0 * scale, bx + x1 * scale, by + y1 * scale, r0 * scale, r1 * scale, cols.d);
    a.stroke(
      bx + x0 * scale - 0.5,
      by + y0 * scale - 0.5,
      bx + x1 * scale - 0.5,
      by + y1 * scale - 0.5,
      r0 * scale * 0.68,
      r1 * scale * 0.68,
      cols.m,
    );
    a.disc(bx + x1 * scale, by + y1 * scale, r1 * scale * 0.95, r1 * scale * 0.95, cols.l);
    a.p(bx + x1 * scale - 0.4, by + y1 * scale - 0.4, cols.tip);
  }
}

function sculptStarfish(
  a: Art,
  cx: number,
  cy: number,
  R: number,
  rot: number,
  cols: { d: string; m: string; l: string },
  C: Pal,
) {
  a.alpha(0.3, () => a.disc(cx + 1, cy + 1.5, R * 0.85, R * 0.75, C.shadow!));
  for (let k = 0; k < 5; k++) {
    const ang = rot + (k / 5) * TAU;
    a.petal(cx, cy, ang, R, R * 0.28, cols.d, cols.m, cols.l, 0.42);
    for (const s of [0.3, 0.58]) {
      a.p(cx + Math.cos(ang) * R * s, cy + Math.sin(ang) * R * s, '#fff5e6');
    }
  }
  a.disc(cx, cy, 1.8, 1.8, cols.l);
  a.p(cx, cy, '#ffffff');
}

function sculptSpiralConch(a: Art, cx: number, cy: number, R: number, dir: 1 | -1, C: Pal) {
  a.alpha(0.32, () => a.disc(cx + 1, cy + 2, R * 1.1, R * 0.75, C.shadow!));
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const sx = cx + dir * (t * R * 0.95 - R * 0.35);
    const rr = R * (0.68 - t * 0.44);
    a.disc(sx, cy - t * 1.2, rr, rr * 0.82, C.nacreD!);
    a.disc(sx - dir * 0.5, cy - t * 1.2 - 0.5, rr * 0.76, rr * 0.62, i % 2 === 0 ? C.nacreB! : C.nacreA!);
    a.disc(sx - dir * 0.8, cy - t * 1.2 - 0.8, rr * 0.42, rr * 0.34, C.nacreL!);
  }
}

function sculptTableCoral(
  a: Art,
  cx: number,
  cy: number,
  R: number,
  pal: { shadow: string; d: string; m: string; l: string; rim: string },
  seed = 1,
) {
  const ry = R * 0.74;
  const X = Math.round(cx), Y = Math.round(cy);
  const bx = Math.ceil(R + 2), by = Math.ceil(ry + 2);
  const inPlate = (dx: number, dy: number, shrink = 0) => {
    const rr = R - shrink, rry = ry - shrink * 0.76;
    if (rr <= 0.5 || rry <= 0.5) return false;
    const ang = Math.atan2(dy / 0.74, dx);
    const ruffle = 1 + 0.08 * Math.sin(ang * 6 + seed) + 0.05 * Math.cos(ang * 10 - seed);
    return (dx / rr) ** 2 + (dy / rry) ** 2 <= ruffle * ruffle;
  };
  a.alpha(0.36, () => {
    a.fill(pal.shadow);
    for (let dy = -by; dy <= by; dy++) {
      for (let dx = -bx; dx <= bx; dx++) {
        if (inPlate(dx, dy)) a.p(X + dx + 2, Y + dy + 3);
      }
    }
  });
  for (let dy = -by; dy <= by; dy++) {
    for (let dx = -bx; dx <= bx; dx++) {
      if (!inPlate(dx, dy)) continue;
      const edge = !inPlate(dx, dy, 1.35);
      const inner = inPlate(dx, dy, R * 0.45);
      const lit = -dx * 0.4 - dy * 0.8 > R * 0.22;
      const col = edge ? (lit ? pal.rim : pal.d) : inner ? pal.d : lit ? pal.l : pal.m;
      a.p(X + dx, Y + dy, col);
    }
  }
  // Delicate concentric ruffle ridges inside the table-coral fan
  a.ring(X, Y, R * 0.56, ry * 0.56, pal.rim, 7, seed);
  a.disc(X, Y, Math.max(2, R * 0.2), Math.max(1.6, ry * 0.2), pal.rim);
}

function paintSeaAnemone(a: Art, cx: number, cy: number, R: number, lav: boolean, C: Pal) {
  a.alpha(0.32, () => a.disc(cx + 1, cy + 2, R, R * 0.8, C.shadow!));
  const d = lav ? C.lavD! : C.coralD!;
  const m = lav ? C.lav! : C.coral!;
  const l = lav ? C.lavL! : C.coralL!;
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * TAU + 0.2;
    a.petal(cx, cy, ang, R, 2.0, d, m, l, 0.5);
    a.p(cx + Math.cos(ang) * (R * 0.92), cy + Math.sin(ang) * (R * 0.92), '#ffffff');
  }
  a.disc(cx, cy, R * 0.34, R * 0.3, '#ffe394');
  a.p(cx - 0.5, cy - 0.5, '#ffffff');
}

function paintMoonJelly(a: Art, cx: number, cy: number, ang: number, scale: number, sec: number, phase: number, pink: boolean) {
  const pulse = Math.sin(sec * 2.8 + phase);
  const bellW = (9.0 + pulse * 1.3) * scale;
  const bellH = (6.4 - pulse * 0.8) * scale;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const nx = -sn, ny = cs;

  const rimCol = pink ? '#ff9ed0' : '#8ce8ff';
  const bodyCol = pink ? '#d95d9e' : '#3fb0de';
  const coreCol = pink ? '#ffe8f5' : '#e6fbff';

  // Soft underwater shadow
  a.alpha(0.22, () => a.disc(cx + 2, cy + 5, bellW * 0.85, bellH * 0.75, '#0b2636'));

  // Undulating trailing translucent tentacles behind the bell
  a.alpha(0.75, () => {
    for (let t = -2; t <= 2; t++) {
      const ox = cx - cs * (bellH * 0.25) + nx * (t * bellW * 0.3);
      const oy = cy - sn * (bellH * 0.25) + ny * (t * bellW * 0.3);
      const len = (12 + (2 - Math.abs(t)) * 3.8) * scale;
      let px = ox, py = oy;
      for (let s = 1; s <= 6; s++) {
        const u = s / 6;
        const wave = Math.sin(sec * 4.2 + phase + t * 0.8 - u * 4.0) * 2.3 * scale;
        const qx = ox - cs * (len * u) + nx * wave;
        const qy = oy - sn * (len * u) + ny * wave;
        a.line(px, py, qx, qy, s < 4 ? coreCol : rimCol);
        px = qx;
        py = qy;
      }
    }
  });

  // Translucent scalloped dome bell + 4-clover moon-jelly glowing core
  a.alpha(0.68, () => a.disc(cx, cy, bellW, bellH, bodyCol));
  a.alpha(0.88, () => {
    a.disc(cx + cs * 0.8, cy + sn * 0.8, bellW * 0.82, bellH * 0.76, rimCol);
    a.disc(cx + cs * 1.5, cy + sn * 1.5, bellW * 0.56, bellH * 0.5, coreCol);
  });
  for (const [dx, dy] of [[-1.7, -0.9], [1.7, -0.9], [-1.7, 1.0], [1.7, 1.0]] as const) {
    a.p(cx + dx * scale, cy + dy * scale, '#ffffff');
  }
}

const coralLagoonScene: Scene = {
  plan(L) {
    return {
      jellies: [
        { cx: L.cx - 56, cy: L.cy - 28, rx: 22, ry: 18, speed: 0.26, phase: 0.4, scale: 1.06, pink: true },
        { cx: L.cx + 58, cy: L.cy + 24, rx: 22, ry: 18, speed: -0.22, phase: 2.1, scale: 1.0, pink: false },
        { cx: L.cx + 44, cy: L.cy - 38, rx: 20, ry: 14, speed: 0.2, phase: 4.3, scale: 0.88, pink: true },
      ],
      fish: [
        { cx: L.cx, cy: L.cy + 2, rx: 56, ry: 42, speed: 0.42, phase: 0.6, gold: false },
        { cx: L.cx, cy: L.cy + 2, rx: 49, ry: 36, speed: 0.42, phase: 0.95, gold: true },
        { cx: L.cx - 6, cy: L.cy + 4, rx: 66, ry: 48, speed: -0.34, phase: 3.2, gold: false },
        { cx: L.cx + 8, cy: L.cy - 4, rx: 72, ry: 52, speed: 0.3, phase: 5.0, gold: true },
        { cx: L.cx, cy: L.cy, rx: 42, ry: 31, speed: -0.46, phase: 1.9, gold: false },
      ],
    };
  },

  paint(a, L) {
    const C = LAGOON_PAL;

    // 1. Boundless crystal-clear mermaid pearl lagoon with soft Voronoi caustic cells (no harsh grid lines!)
    a.field((x, y) => {
      const nx = (x - L.cx) / Math.max(112, L.gw * 0.62);
      const ny = (y - (L.cy + 2)) / (L.gh * 0.58);
      const r = Math.hypot(nx, ny);
      const wn = vnoise(x, y, 17, 83) * 0.45 + vnoise(x, y, 7, 89) * 0.2;

      const depth = clamp(2.12 - r * 1.48 + (wn - 0.32) * 0.5, 0, 2.49);
      const waters = [C.w0!, C.w1!, C.w2!, C.w3!, C.w4!, C.w5!];
      let idx = band(depth * 2.35, x, y, 6, 0.44);

      // Gentle, natural Voronoi water-caustic shimmer only one step brighter in the shallow lagoon
      if (r < 0.86) {
        const cs = flagstone(x + Math.round(wn * 5), y - Math.round(wn * 5), 22, 31);
        if (cs.edge < 0.52 && bayer(x, y) < 0.55) {
          idx = Math.min(5, idx + 1);
          if (r < 0.42 && idx === 5 && bayer(x, y) < 0.28) return C.blushW!;
        }
      }
      return waters[idx]!;
    });

    // 2. Lush organic reef shoals curving around the corners & flanks (like lotus-pond's natural wreath!)
    const roseTable = { shadow: C.shadow!, d: C.coralD!, m: C.coral!, l: C.coralL!, rim: C.coralTip! };
    const lavTable = { shadow: C.shadow!, d: C.lavD!, m: C.lav!, l: C.lavL!, rim: '#efe6ff' };
    const aquaTable = { shadow: C.shadow!, d: C.kelpD!, m: C.kelp!, l: C.kelpL!, rim: '#b8f5e4' };
    const peachCols = { d: C.peachD!, m: C.peach!, l: C.peachL!, tip: '#fff2ea' };
    const roseCols = { d: C.coralD!, m: C.coral!, l: C.coralL!, tip: C.coralTip! };

    // Swaying emerald-teal sea-kelp ribbons tucked behind the coral reef
    for (const [kx, ky, dir, h] of [
      [10, 84, 1, 52],
      [22, 92, 1, 40],
      [L.W - 10, 86, -1, 52],
      [L.W - 22, 94, -1, 40],
      [12, L.H - 8, 1, 46],
      [L.W - 12, L.H - 8, -1, 46],
    ] as const) {
      a.quad(kx, ky, kx + dir * 9, ky - h * 0.5, kx + dir * 3, ky - h, 1.9, 0.6, C.kelpD!);
      a.quad(kx + dir, ky, kx + dir * 10, ky - h * 0.5, kx + dir * 4, ky - h, 1.0, 0.4, C.kelpL!);
      for (const t of [0.28, 0.55, 0.8]) {
        a.petal(kx + dir * 5 * t, ky - h * t, dir > 0 ? -0.55 : Math.PI + 0.55, 9, 2.1, C.kelpD!, C.kelp!, C.kelpL!);
      }
    }

    // Layered large ruffled Table-Corals forming a rich, boundless reef wreath around the lagoon!
    for (const [tx, ty, R, pal, s] of [
      // Top-left reef cove
      [34, 24, 20, aquaTable, 1],
      [56, 18, 15, roseTable, 2],
      [24, 46, 16, lavTable, 3],
      // Top-right reef cove
      [L.W - 34, 24, 20, aquaTable, 4],
      [L.W - 56, 18, 15, lavTable, 5],
      [L.W - 24, 46, 16, roseTable, 6],
      // Mid flanks
      [26, L.mid + 6, 17, roseTable, 7],
      [38, L.mid + 24, 13, aquaTable, 8],
      [L.W - 26, L.mid - 4, 17, lavTable, 9],
      [L.W - 38, L.mid + 16, 13, roseTable, 10],
      // Bottom-left & bottom-right reef coves
      [32, L.H - 28, 19, aquaTable, 11],
      [50, L.H - 20, 14, lavTable, 12],
      [L.W - 32, L.H - 28, 19, aquaTable, 13],
      [L.W - 50, L.H - 20, 14, roseTable, 14],
    ] as const) {
      sculptTableCoral(a, tx, ty, R, pal, s);
    }

    // 3. MASSIVE CENTRAL MOTHER-OF-PEARL SANCTUARY SHELL & GIANT OPALESCENT PEARL!
    sculptPearlSanctuary(a, L.cx, L.cy - 1, C);

    // 4. Invisible aquamarine caustic grid skeleton
    skeleton(a, L, C.caustic!, 0.23, C.blushW!);

    // 5. Branching Rose-Pink & Peach Staghorn Corals + Glowing Sea-Anemones crowning the reef tables!
    sculptStaghornCoral(a, 8, 10, 1, 1, 1.2, roseCols, C);
    sculptStaghornCoral(a, L.W - 8, 10, -1, 1, 1.2, roseCols, C);
    sculptStaghornCoral(a, 10, L.H - 10, 1, -1, 1.12, peachCols, C);
    sculptStaghornCoral(a, L.W - 10, L.H - 10, -1, -1, 1.12, roseCols, C);

    paintSeaAnemone(a, 44, 34, 9.5, false, C);
    paintSeaAnemone(a, L.W - 44, 34, 9.5, true, C);
    paintSeaAnemone(a, 34, L.mid - 14, 8.5, true, C);
    paintSeaAnemone(a, L.W - 34, L.mid + 28, 8.5, false, C);

    // 6. Iridescent spiral conches, glowing reef pearls & 5-armed sea stars!
    sculptSpiralConch(a, 54, 42, 9.5, 1, C);
    sculptSpiralConch(a, L.W - 52, L.H - 38, 9.5, -1, C);
    sculptStarfish(a, L.W - 56, 38, 8.2, 0.35, peachCols, C);
    sculptStarfish(a, 52, L.H - 38, 8.2, 0.85, roseCols, C);
    for (const [px, py] of [[74, 24], [L.W - 76, 26], [38, L.gb - 16], [L.W - 40, L.gt + 56]] as const) {
      a.disc(px, py, 3.2, 2.9, C.pearl1!);
      a.disc(px - 0.5, py - 0.5, 2.1, 1.9, C.pearl3!);
      a.p(px - 1, py - 1, '#ffffff');
    }

    // 7. Bench: 9 scalloped Mother-of-Pearl Scallop Shells along the shallow sandbar
    for (const [i, s] of benchSlots(L).entries()) {
      const brx = Math.min(11.2, L.bs * 0.46);
      sculptScallopSeat(a, s.x, s.y + 1, brx, i % 2 === 0, C);
    }
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const C = LAGOON_PAL;

    // 1. Breathing opalescent glow & expanding caustic rings from the central Giant Pearl
    const pGlow = 0.45 + 0.55 * Math.sin(sec * 2.1);
    a.alpha(0.28 * pGlow, () => a.disc(L.cx - 1, L.cy + 1, 15, 14, '#ffffff'));
    for (let i = 0; i < 3; i++) {
      const cyc = (sec * 0.3 + i / 3) % 1;
      const rx = 14 + cyc * 52;
      a.alpha((1 - cyc) * 0.42, () => a.ring(L.cx, L.cy + 2, rx, rx * 0.76, C.caustic!, 9, cyc * 3));
    }

    // 2. Iridescent Blue-Gold & Peach Reef Damselfish darting smoothly around the pearl sanctuary
    for (const f of P.fish as { cx: number; cy: number; rx: number; ry: number; speed: number; phase: number; gold: boolean }[]) {
      const u = sec * f.speed + f.phase;
      const fx = f.cx + Math.cos(u) * f.rx;
      const fy = f.cy + Math.sin(u) * f.ry + Math.sin(u * 2) * 3;
      const tx = -Math.sin(u) * f.rx * f.speed;
      const ty = Math.cos(u) * f.ry * f.speed;
      const ang = Math.atan2(ty, tx);
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const body = f.gold ? '#ffb36b' : '#4ad8ff';
      const hi = f.gold ? '#fff2b8' : '#d6fbff';
      const fin = f.gold ? '#ff6b96' : '#ffe07d';
      a.disc(fx, fy, 3.2, 2.2, body);
      a.disc(fx + cs * 1.0, fy + sn * 1.0, 2.1, 1.5, hi);
      // Forked fluttering tail
      const wag = Math.sin(sec * 12 + f.phase) * 0.45;
      a.petal(fx - cs * 2.4, fy - sn * 2.4, ang + Math.PI + 0.35 + wag, 3.8, 1.2, body, fin);
      a.petal(fx - cs * 2.4, fy - sn * 2.4, ang + Math.PI - 0.35 + wag, 3.8, 1.2, body, fin);
      a.p(fx + cs * 2.0, fy + sn * 2.0 - 0.4, '#162c40');
    }

    // 3. Three Translucent Pastel Moon-Jellyfish gliding & pulsing across the lagoon!
    for (const j of P.jellies as { cx: number; cy: number; rx: number; ry: number; speed: number; phase: number; scale: number; pink: boolean }[]) {
      const u = sec * j.speed + j.phase;
      const jx = j.cx + Math.cos(u) * j.rx;
      const jy = j.cy + Math.sin(u * 1.5) * j.ry;
      const vx = -Math.sin(u) * j.rx * j.speed;
      const vy = Math.cos(u * 1.5) * 1.5 * j.ry * j.speed;
      paintMoonJelly(a, jx, jy, Math.atan2(vy, vx), j.scale, sec, j.phase, j.pink);
    }

    // 4. Rising pearl-bubble streams & twinkling surface star-glints
    for (let i = 0; i < 14; i++) {
      const cyc = wrap(sec * (0.18 + (i % 3) * 0.05) + i * 0.21, 1);
      const bx = 24 + hash2(i, 5, 109) * (L.W - 48) + Math.sin(sec * 2.4 + i) * 2.5;
      const by = L.gb - cyc * (L.gh - 8);
      const big = i % 3 === 0;
      a.alpha((1 - cyc * 0.65) * 0.85, () => {
        if (big) {
          a.ring(bx, by, 2.1, 2.1, C.caustic!);
          a.p(bx - 1, by - 1, '#ffffff');
        } else {
          a.r(bx, by, 2, 2, C.caustic!);
          a.p(bx, by, '#ffffff');
        }
      });
    }
  },
};

/* ═══════════════════════════ 8. 紫藤镜溪 · WISTERIA BROOK ═══════════════════════════ */

const WISTERIA_PAL: Pal = {
  w0: '#16152c',
  w1: '#201f42',
  w2: '#2e2d5c',
  w3: '#43417a',
  w4: '#615da1',
  w5: '#8982c7',
  w6: '#b7aee6',
  star: '#f6efff',
  moon: '#fff7db',
  moonMid: '#ffe299',
  bank0: '#1b2238',
  bank1: '#273452',
  bank2: '#394d70',
  wis0: '#4a2d82',
  wis1: '#7652ba',
  wis2: '#a683e8',
  wis3: '#d6bcfc',
  wis4: '#f8f0ff',
  orc0: '#6b2f70',
  orc1: '#a150a3',
  orc2: '#d481d1',
  orc3: '#f5baef',
  orc4: '#fff2fd',
  vineD: '#221830',
  vine: '#3c2c52',
  leafD: '#213b4a',
  leaf: '#365e70',
  leafL: '#6193a3',
  hydB0: '#354f96',
  hydB1: '#5d80d1',
  hydB2: '#94b7fa',
  hydB3: '#dff2ff',
  woodD: '#452535',
  wood: '#754156',
  woodL: '#a8687d',
  lanPink: '#f095b2',
  lanGold: '#ffd06b',
  lanCore: '#fffbe0',
};

function sculptWisteriaRaceme(
  a: Art,
  tx: number,
  ty: number,
  len: number,
  sway: number,
  orchid: boolean,
  backLayer: boolean,
  C: Pal,
  seed: number,
) {
  const c0 = orchid ? C.orc0! : C.wis0!;
  const c1 = orchid ? C.orc1! : C.wis1!;
  const c2 = orchid ? C.orc2! : C.wis2!;
  const c3 = orchid ? C.orc3! : C.wis3!;
  const c4 = orchid ? C.orc4! : C.wis4!;

  // Delicate stem peeking between butterfly-pea florets
  a.quad(tx, ty, tx + sway * 0.45, ty + len * 0.52, tx + sway, ty + len, 0.8, 0.35, C.leaf!);

  // Individual grape-like blossom droplets with natural airy gaps toward the pendulous tip!
  const tiers = Math.max(6, Math.round(len / 2.8));
  for (let i = 0; i <= tiers; i++) {
    const u = i / tiers;
    const bx = tx + sway * (u * u);
    const by = ty + len * u;
    const widthEnv = Math.sin(Math.pow(u, 0.55) * Math.PI) * (1 - u * 0.42);
    const count = u > 0.78 ? 1 : u > 0.48 ? 2 : 3;
    for (let k = 0; k < count; k++) {
      const offX = (k - (count - 1) / 2) * (widthEnv * 5.8) + (hash2(i * 3 + k, seed, 37) - 0.5) * 1.8;
      const offY = (hash2(i * 5 + k, seed, 53) - 0.5) * 1.4;
      const fx = Math.round(bx + offX);
      const fy = Math.round(by + offY);
      if (backLayer) {
        a.r(fx - 1, fy, 3, 2, c0);
        a.r(fx - 1, fy - 1, 2, 2, c1);
        a.p(fx, fy - 1, c2);
      } else {
        const main = u < 0.28 ? c1 : u < 0.62 ? c2 : c3;
        const hi = u < 0.35 ? c2 : u < 0.72 ? c3 : c4;
        // 3×3 butterfly-pea wisteria floret droplet
        a.r(fx - 1, fy, 3, 2, c0);
        a.r(fx - 1, fy - 1, 3, 2, main);
        a.r(fx - 1, fy - 1, 2, 1, hi);
        if (u > 0.45 || k === 1) a.p(fx, fy - 1, c4);
      }
    }
  }
}

function sculptHydrangeaMound(a: Art, cx: number, cy: number, R: number, blue: boolean, C: Pal, seed: number) {
  a.alpha(0.35, () => a.disc(cx + 1, cy + 2, R + 1.5, R * 0.86 + 1, '#0e1024'));
  for (let k = 0; k < 7; k++) {
    const ang = seed + (k / 7) * TAU;
    a.petal(cx, cy + 1, ang, R * 1.22, 2.8, C.leafD!, C.leaf!, C.leafL!);
  }
  const c0 = blue ? C.hydB0! : C.wis0!;
  const c1 = blue ? C.hydB1! : C.orc1!;
  const c2 = blue ? C.hydB2! : C.orc3!;
  const c3 = blue ? C.hydB3! : C.orc4!;
  a.disc(cx, cy, R, R * 0.84, c0);
  a.disc(cx - 0.8, cy - 0.8, R * 0.85, R * 0.72, c1);
  for (let k = 0; k < 12; k++) {
    const ang = seed + k * 2.399;
    const rad = Math.sqrt((k + 0.4) / 12.5) * (R * 0.76);
    const fx = Math.round(cx + Math.cos(ang) * rad);
    const fy = Math.round(cy + Math.sin(ang) * rad * 0.82);
    const fc = k % 3 === 0 ? c3 : c2;
    a.r(fx - 2, fy, 5, 1, fc);
    a.r(fx, fy - 2, 1, 5, fc);
    a.r(fx - 1, fy - 1, 3, 3, c2);
    a.p(fx - 1, fy - 1, c3);
    a.p(fx, fy, blue ? '#fff3b0' : '#d6f5ff');
  }
}

function paintMoonBridge(a: Art, cx: number, topY: number, C: Pal) {
  const span = 44;
  a.alpha(0.24, () => {
    a.arc(cx, topY + 26, span, 11, -Math.PI + 0.25, -0.25, C.woodL!, 3);
    a.disc(cx - span + 7, topY + 22, 4, 7, C.lanGold!);
    a.disc(cx + span - 7, topY + 22, 4, 7, C.lanGold!);
  });
  for (let dx = -span; dx <= span; dx++) {
    const u = dx / span;
    const arch = Math.round((1 - u * u) * 9.5);
    const x = Math.round(cx + dx);
    const dy = Math.round(topY + 12 - arch);
    a.r(x, dy, 1, 4, C.woodD!);
    a.r(x, dy, 1, 2, C.wood!);
    a.p(x, dy - 4, C.woodL!);
    a.p(x, dy - 3, C.wood!);
    if (Math.abs(dx) % 8 === 0) {
      a.r(x, dy - 4, 1, 5, C.woodD!);
      a.p(x, dy - 5, C.lanGold!);
    }
  }
  for (const s of [-1, 1] as const) {
    const lx = cx + s * (span - 6), ly = topY + 6;
    a.alpha(0.28, () => a.disc(lx, ly, 7, 6, C.lanGold!));
    a.r(lx - 1, ly - 2, 3, 5, C.woodD!);
    a.r(lx - 1, ly - 1, 3, 3, C.lanGold!);
    a.p(lx, ly, '#ffffff');
  }
}

function paintRiverLanternSeat(a: Art, cx: number, cy: number, rx: number, idx: number, C: Pal) {
  const ry = rx * 0.7;
  a.alpha(0.26, () => a.disc(cx, cy + 4, rx * 0.95, ry * 0.82, C.lanGold!));
  a.disc(cx, cy + 1, rx, ry, C.leafD!);
  a.disc(cx - 0.6, cy + 0.4, rx * 0.86, ry * 0.76, C.leaf!);
  a.arc(cx, cy + 0.4, rx * 0.82, ry * 0.72, -2.8, -0.35, C.leafL!);

  const pink = idx % 2 === 0;
  const pEdge = pink ? '#a6466d' : C.wis1!;
  const pBody = pink ? C.lanPink! : C.wis3!;
  const pHi = pink ? '#ffe6ef' : C.wis4!;
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * TAU + 0.25;
    a.petal(cx, cy, ang, rx * 0.62, 2.1, pEdge, pBody, pHi, 0.55);
  }
  a.disc(cx, cy - 0.5, 2.8, 2.2, C.lanGold!);
  a.disc(cx, cy - 0.8, 1.6, 1.4, C.lanCore!);
  a.p(cx, cy - 1, '#ffffff');
}

function paintPaperBoat(a: Art, bx: number, by: number, C: Pal) {
  const X = Math.round(bx), Y = Math.round(by);
  // Warm golden candle reflection on the dark-violet stream
  a.alpha(0.34, () => a.disc(X, Y + 4, 8.5, 3.5, C.lanGold!));
  // Crisp origami paper boat: upturned bow & stern + central triangular peak + glowing lantern pearl
  a.r(X - 6, Y, 13, 1, '#e8e0fa');
  a.r(X - 7, Y - 1, 3, 1, '#ffffff');
  a.r(X + 5, Y - 1, 3, 1, '#ffffff');
  a.r(X - 5, Y + 1, 11, 1, '#c5b8e8');
  a.r(X - 4, Y + 2, 9, 1, '#9888c4');
  // Origami central sail peak & warm glowing candle heart
  a.r(X - 2, Y - 1, 5, 1, C.moon!);
  a.r(X - 1, Y - 2, 3, 1, '#ffffff');
  a.p(X, Y - 3, '#ffffff');
  a.r(X - 1, Y, 3, 1, C.lanGold!);
  a.p(X, Y, '#ff9e3d');
}

const wisteriaBrookScene: Scene = {
  plan(L) {
    const racemes = [
      // Back-layer deep violet wisteria curtains for rich lush depth
      { x: 16, y: 2, len: 52, sway: 5, orchid: false, back: true, s: 21 },
      { x: 30, y: 4, len: 44, sway: 4, orchid: false, back: true, s: 22 },
      { x: 44, y: 2, len: 38, sway: 3, orchid: true, back: true, s: 23 },
      { x: 58, y: 2, len: 30, sway: 3, orchid: false, back: true, s: 24 },
      { x: L.W - 16, y: 2, len: 52, sway: -5, orchid: false, back: true, s: 25 },
      { x: L.W - 30, y: 4, len: 44, sway: -4, orchid: false, back: true, s: 26 },
      { x: L.W - 44, y: 2, len: 38, sway: -3, orchid: true, back: true, s: 27 },
      { x: L.W - 58, y: 2, len: 30, sway: -3, orchid: false, back: true, s: 28 },
      // Front-layer luminous lilac & blush-orchid wisteria curtains
      { x: 9, y: 3, len: 56, sway: 6, orchid: false, back: false, s: 1 },
      { x: 22, y: 1, len: 45, sway: 4, orchid: true, back: false, s: 2 },
      { x: 36, y: 3, len: 48, sway: 5, orchid: false, back: false, s: 3 },
      { x: 50, y: 1, len: 35, sway: 3, orchid: true, back: false, s: 4 },
      { x: 64, y: 3, len: 27, sway: 3, orchid: false, back: false, s: 5 },
      { x: 78, y: 2, len: 20, sway: 2, orchid: true, back: false, s: 6 },
      { x: 91, y: 1, len: 14, sway: 2, orchid: false, back: false, s: 7 },
      { x: 14, y: 66, len: 36, sway: 4, orchid: true, back: false, s: 8 },
      { x: 27, y: 60, len: 26, sway: 3, orchid: false, back: false, s: 9 },
      { x: L.W - 9, y: 3, len: 56, sway: -6, orchid: false, back: false, s: 10 },
      { x: L.W - 22, y: 1, len: 45, sway: -4, orchid: true, back: false, s: 11 },
      { x: L.W - 36, y: 3, len: 48, sway: -5, orchid: false, back: false, s: 12 },
      { x: L.W - 50, y: 1, len: 35, sway: -3, orchid: false, back: false, s: 13 },
      { x: L.W - 64, y: 3, len: 27, sway: -3, orchid: true, back: false, s: 14 },
      { x: L.W - 78, y: 2, len: 20, sway: -2, orchid: false, back: false, s: 15 },
      { x: L.W - 91, y: 1, len: 14, sway: -2, orchid: true, back: false, s: 16 },
      { x: L.W - 14, y: 66, len: 36, sway: -4, orchid: true, back: false, s: 17 },
      { x: L.W - 27, y: 60, len: 26, sway: -3, orchid: false, back: false, s: 18 },
    ];
    const boats = [
      { yBase: L.cy - 26, amp: 13, speed: 0.055, phase: 0.16, dir: 1 as const },
      { yBase: L.cy + 24, amp: 12, speed: 0.048, phase: 0.56, dir: -1 as const },
      { yBase: L.gt + 26, amp: 8, speed: 0.042, phase: 0.81, dir: 1 as const },
    ];
    return { racemes, boats };
  },

  paint(a, L, P) {
    const C = WISTERIA_PAL;

    // 1. Boundless starry twilight Mirror-Brook with diagonal Milky-Way nebula reflection!
    a.field((x, y) => {
      // Curved mossy stream-bank coves along lower corners & mid-lower flanks
      const dBL = Math.hypot((x - 8) / 62, (y - (L.H - 8)) / 54);
      const dBR = Math.hypot((x - (L.W - 8)) / 62, (y - (L.H - 8)) / 54);
      const dML = Math.hypot((x + 6) / 36, (y - (L.mid + 26)) / 42);
      const dMR = Math.hypot((x - (L.W + 6)) / 36, (y - (L.mid + 22)) / 42);
      const bankD = Math.min(dBL, dBR, dML, dMR);
      if (bankD < 0.96) {
        const bn = vnoise(x, y, 8, 73);
        return [C.bank0!, C.bank1!, C.bank2!][band(bn * 2.5 + (0.96 - bankD), x, y, 3, 0.4)]!;
      }

      // Diagonal Milky-Way reflection band flowing across the brook
      const dx = (x - L.cx) / Math.max(96, L.gw * 0.56);
      const dy = (y - L.cy) / (L.gh * 0.56);
      const diag = Math.abs(dx * 0.78 + dy * 0.52);
      const radial = Math.hypot(dx, dy);
      const wn = vnoise(x, y, 15, 97) * 0.45 + vnoise(x, y, 6, 101) * 0.2;
      const milky = Math.exp(-(diag * diag) * 2.6) * Math.max(0, 1.15 - radial * 0.55);
      const v = clamp(0.45 + milky * 1.65 + (1 - Math.min(1.2, radial)) * 0.55 + (wn - 0.3) * 0.45, 0, 2.49);
      const waters = [C.w0!, C.w1!, C.w2!, C.w3!, C.w4!, C.w5!, C.w6!];
      return waters[band(v * 2.6, x, y, 7, 0.44)]!;
    });

    // Subtle static reflected pinpoint stars across the brook
    for (let i = 0; i < 38; i++) {
      const sx = Math.round(18 + hash2(i, 1, 131) * (L.W - 36));
      const sy = Math.round(16 + hash2(i, 2, 131) * (L.H - 36));
      a.alpha(0.55, () => a.p(sx, sy, i % 4 === 0 ? C.moon! : C.star!));
    }

    // 2. Graceful arched moonlit Garden Footbridge at the upper narrows of the brook!
    paintMoonBridge(a, L.cx, 4, C);

    // 3. MASSIVE CENTRAL WATER-REFLECTED CRESCENT MOON & FLOATING WISTERIA PETAL WHIRLPOOL (~132×106 art-px!)
    const mcx = L.cx, mcy = L.cy + 2;
    for (const [rx, ry, al] of [
      [62, 48, 0.34],
      [46, 36, 0.44],
      [31, 24, 0.55],
    ] as const) {
      a.alpha(al, () => {
        a.ring(mcx, mcy, rx, ry, C.w6!, 11, rx * 0.09);
        a.ring(mcx, mcy + 1, rx + 1.4, ry + 1, C.wis3!, 8, rx * 0.15);
      });
    }

    for (let arm = 0; arm < 2; arm++) {
      const a0 = arm * Math.PI + 0.35;
      for (let s = 0; s < 58; s++) {
        const u = s / 58;
        const ang = a0 + u * TAU * 1.1;
        const rx = 20 + u * 46;
        const ry = 16 + u * 35;
        const px = mcx + Math.cos(ang) * rx + (hash2(s, arm, 41) - 0.5) * 4;
        const py = mcy + Math.sin(ang) * ry + (hash2(s, arm, 59) - 0.5) * 3;
        const col = s % 3 === 0 ? C.wis4! : s % 2 === 0 ? C.wis3! : C.orc3!;
        a.r(px, py, 2, 1, col);
        if (s % 4 === 0) a.p(px + 1, py + 1, C.wis2!);
      }
    }

    // Large luminous water-reflected Crescent Moon (R = 18 art-px)
    a.alpha(0.28, () => a.disc(mcx - 2, mcy, 24, 20, C.w6!));
    const MR = 18;
    for (let dy = -MR; dy <= MR; dy++) {
      const rippleShift = Math.abs(dy) > MR * 0.62 ? Math.round(Math.sin(dy * 1.3) * 1.3) : 0;
      for (let dx = -MR; dx <= MR; dx++) {
        const dMain = Math.hypot(dx, dy / 0.88);
        const dCut = Math.hypot(dx - 6.8, (dy + 3.2) / 0.88);
        if (dMain <= MR && dCut > MR * 0.82) {
          const edge = dMain > MR - 1.6 || dCut < MR * 0.82 + 1.5;
          a.p(mcx + dx + rippleShift, mcy + dy, edge ? C.moonMid! : C.moon!);
        }
      }
    }
    starFlare(a, mcx + 6, mcy - 4, 4, '#ffffff', C.moon!);
    starFlare(a, mcx + 12, mcy + 3, 2, '#ffffff', C.wis4!);

    // 4. Invisible starlight-lilac grid skeleton
    skeleton(a, L, C.wis3!, 0.22, C.orc3!);

    // 5. Floating twilight water-lily pads & blooming Hydrangea + Iris coves along mid/lower banks!
    for (const [lx, ly, R] of [
      [48, L.mid + 18, 9],
      [38, L.mid + 30, 7],
      [L.W - 48, L.mid + 12, 9],
      [L.W - 38, L.mid + 26, 7],
    ] as const) {
      sculptLotusPad(a, lx, ly, R, 0.7, {
        shadow: '#0e0d22',
        padD: C.leafD!,
        pad: C.leaf!,
        padM: C.leaf!,
        padL: C.leafL!,
        padRim: '#88bfcf',
        padCore: '#88bfcf',
        vein: C.leafD!,
        veinL: C.leafL!,
      });
    }

    // Sword-like stream iris blades & glowing purple irises on the mid-flank banks
    for (const [ix, iy, dir] of [[12, L.mid + 32, 1], [L.W - 12, L.mid + 28, -1]] as const) {
      for (const aOff of [-0.35, 0, 0.35]) {
        a.quad(ix, iy, ix + dir * 6, iy - 14, ix + dir * (10 + aOff * 12), iy - 26, 1.2, 0.4, C.leafL!);
      }
      const fx = ix + dir * 9, fy = iy - 25;
      a.disc(fx, fy, 3.8, 3.2, C.wis1!);
      a.disc(fx, fy - 1, 2.8, 2.2, C.wis3!);
      a.p(fx, fy, C.lanGold!);
    }

    sculptHydrangeaMound(a, 20, L.H - 22, 13.5, true, C, 1);
    sculptHydrangeaMound(a, 44, L.H - 14, 10.5, false, C, 2);
    sculptHydrangeaMound(a, 16, L.mid + 44, 10.5, false, C, 3);
    sculptHydrangeaMound(a, 32, L.H - 34, 9.5, true, C, 7);
    sculptHydrangeaMound(a, L.W - 20, L.H - 22, 13.5, true, C, 4);
    sculptHydrangeaMound(a, L.W - 44, L.H - 14, 10.5, false, C, 5);
    sculptHydrangeaMound(a, L.W - 16, L.mid + 40, 10.5, true, C, 6);
    sculptHydrangeaMound(a, L.W - 32, L.H - 34, 9.5, false, C, 8);

    // 6. Lush leafy overarching wisteria canopy & gnarled boughs framing the top corners!
    for (const side of [-1, 1] as const) {
      const ox = side < 0 ? 0 : L.W;
      const dir = -side;
      // Rich dark foliage backdrop along the top bough so hanging racemes emerge from lush leaves
      for (let i = 0; i < 11; i++) {
        const cxp = ox + dir * (6 + i * 9);
        const cyp = 3 + (i % 2) * 3;
        a.disc(cxp, cyp, 8.5 - i * 0.35, 5.5, C.leafD!);
        a.petal(cxp, cyp + 1, (dir > 0 ? 0.55 : Math.PI - 0.55) + (i % 2) * 0.35, 10 - i * 0.3, 2.3, C.leafD!, C.leaf!, C.leafL!);
      }
      a.quad(ox, 2, ox + dir * 48, 3, ox + dir * 98, 10, 2.4, 0.7, C.vineD!);
      a.quad(ox, 22, ox + dir * 20, 38, ox + dir * 34, 66, 1.9, 0.6, C.vine!);
    }

    // 7. Cascading curtains of pendulous Lilac & Orchid Wisteria Racemes (back layer then front layer)!
    for (const rc of P.racemes) {
      sculptWisteriaRaceme(a, rc.x, rc.y, rc.len, rc.sway, rc.orchid, rc.back, C, rc.s);
    }

    // 8. Bench: 9 warm-glowing Origami Lotus River-Lanterns floating on wisteria-leaf rafts
    for (const [i, s] of benchSlots(L).entries()) {
      const brx = Math.min(11, L.bs * 0.45);
      paintRiverLanternSeat(a, s.x, s.y + 1, brx, i, C);
    }
  },

  anim(a, L, P, t) {
    const sec = t * 0.001;
    const C = WISTERIA_PAL;

    // 1. Gentle expanding water rings around the reflected Crescent Moon
    for (let i = 0; i < 3; i++) {
      const cyc = (sec * 0.26 + i / 3) % 1;
      const rx = 16 + cyc * 52;
      a.alpha((1 - cyc) * 0.38, () => a.ring(L.cx, L.cy + 2, rx, rx * 0.77, C.wis3!, 9, cyc * 3));
    }

    // 2. Three Glowing Origami Paper-Boats drifting smoothly along S-currents across the mirror-brook!
    for (const [i, b] of (P.boats as { yBase: number; amp: number; speed: number; phase: number; dir: 1 | -1 }[]).entries()) {
      const u = wrap(sec * b.speed + b.phase, 1);
      const bx = b.dir > 0 ? 48 + u * (L.W - 96) : L.W - 48 - u * (L.W - 96);
      const by = b.yBase + Math.sin(u * TAU * 1.2 + i) * b.amp;
      const wCyc = (sec * 1.1 + i * 0.33) % 1;
      a.alpha((1 - wCyc) * 0.34, () => a.ring(bx - b.dir * 7, by + 2, 3 + wCyc * 8, 2 + wCyc * 5, C.wis3!, 5, wCyc));
      paintPaperBoat(a, bx, by, C);
    }

    // 3. Fourteen Dancing Golden & Starlight-Mint Fireflies weaving through the wisteria night!
    for (let i = 0; i < 14; i++) {
      const ang = sec * (0.45 + (i % 4) * 0.08) + i * 1.9;
      const fx = 16 + hash2(i, 4, 151) * (L.W - 32) + Math.cos(ang) * 14;
      const fy = 14 + hash2(i, 9, 151) * (L.H - 34) + Math.sin(ang * 1.3 + i) * 10;
      const glow = 0.4 + 0.6 * Math.sin(sec * 3.4 + i * 1.7);
      if (glow > 0.25) {
        const mint = i % 3 === 1;
        const haloCol = mint ? '#8effdb' : C.lanGold!;
        a.alpha(glow * 0.28, () => a.disc(fx, fy, 4.2, 4.2, haloCol));
        a.alpha(Math.min(1, glow + 0.2), () => {
          a.r(fx, fy, 2, 2, haloCol);
          a.p(fx, fy, '#ffffff');
        });
      }
    }

    // 4. Two Iridescent Lavender-Blue Morpho Butterflies & drifting wisteria blossoms
    for (let b = 0; b < 2; b++) {
      const ang = sec * (0.38 + b * 0.09) + b * 2.8;
      const bx = L.cx + Math.cos(ang) * (58 + b * 22);
      const by = L.cy - 8 + Math.sin(ang * 1.4 + b) * 38;
      const open = Math.floor(sec * 10 + b) % 2 === 0;
      if (open) {
        a.r(bx - 3, by - 2, 2, 3, '#96b8ff');
        a.r(bx + 2, by - 2, 2, 3, '#96b8ff');
        a.p(bx - 2, by - 2, '#eef6ff');
        a.p(bx + 2, by - 2, '#eef6ff');
      } else {
        a.r(bx - 1, by - 3, 2, 3, '#d4bcff');
      }
      a.r(bx, by - 1, 1, 3, '#2c2240');
    }

    for (let i = 0; i < 10; i++) {
      const px = wrap(hash2(i, 3, 173) * L.W + sec * (4.2 + (i % 3) * 1.3), L.W);
      const py = wrap(hash2(i, 7, 173) * (L.H - 22) + sec * 2.8 + Math.sin(sec * 1.9 + i) * 3, L.H - 20);
      a.r(px, py, 2, 1, i % 2 === 0 ? C.wis4! : C.orc3!);
      a.p(px + 1, py + 1, C.wis2!);
    }
  },
};

/* ─────────────────────────── Registry & Entry Points ─────────────────────────── */

const SCENES: Record<PixelSceneId, Scene> = {
  'lotus-pond': lotusScene,
  'spring-meadow': meadowScene,
  'rose-dusk': roseScene,
  'astral-ivory': astralScene(ASTRAL_IVORY_THEME),
  'astral-night': astralScene(ASTRAL_NIGHT_THEME),
  'bamboo-grove': bambooScene,
  'coral-lagoon': coralLagoonScene,
  'wisteria-brook': wisteriaBrookScene,
  ...ATELIER_SCENES,
};

export const SCENE_BACKDROP: Record<PixelSceneId, string> = {
  'lotus-pond': LOTUS_PAL.w0!,
  'spring-meadow': '#639153',
  'rose-dusk': ROSE_PAL.ironD!,
  'astral-ivory': ASTRAL_IVORY_THEME.sky0,
  'astral-night': ASTRAL_NIGHT_THEME.sky0,
  'bamboo-grove': BAMBOO_PAL.w0!,
  'coral-lagoon': LAGOON_PAL.w0!,
  'wisteria-brook': WISTERIA_PAL.w0!,
  ...ATELIER_BACKDROP,
};

export function isPixelScene(id: unknown): id is PixelSceneId {
  return typeof id === 'string' && id in SCENES;
}

const planCache = new Map<string, Plan>();
function planFor(id: PixelSceneId, L: Lay): Plan {
  const key = `${id}|${L.W}|${L.H}|${L.gl.toFixed(2)}|${L.gt.toFixed(2)}|${L.cw.toFixed(2)}|${L.bl.toFixed(2)}|${L.bs.toFixed(2)}`;
  let p = planCache.get(key);
  if (!p) {
    if (planCache.size > 24) planCache.clear();
    p = SCENES[id].plan(L, rng(0x51a7 + id.length * 977));
    planCache.set(key, p);
  }
  return p;
}

/** Paint the static scenery for a living-canvas skin into world space. */
export function paintSceneStatic(ctx: CanvasRenderingContext2D, board: PixelBoard, id: PixelSceneId) {
  const L = layout(board);
  const layer = makeLayer(L.W, L.H);
  const lctx = layer.getContext('2d') as CanvasRenderingContext2D;
  const a = new Art(lctx, L.W, L.H);
  const plan = planFor(id, L);
  SCENES[id].paint(a, L, plan, rng(0xbeef + id.length * 31));
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, 0, 0, L.W * ART, L.H * ART);
  ctx.imageSmoothingEnabled = prev;
}

let animLayer: { canvas: HTMLCanvasElement; w: number; h: number } | null = null;
/** Paint the per-frame living layer (koi, petals, doves, astrolabe hands, ripples...). */
export function paintSceneAnimated(
  ctx: CanvasRenderingContext2D,
  board: PixelBoard,
  id: PixelSceneId,
  now: number,
  reduced: boolean,
) {
  const L = layout(board);
  if (!animLayer || animLayer.w !== L.W || animLayer.h !== L.H) {
    animLayer = { canvas: makeLayer(L.W, L.H), w: L.W, h: L.H };
  }
  const lctx = animLayer.canvas.getContext('2d') as CanvasRenderingContext2D;
  lctx.clearRect(0, 0, L.W, L.H);
  lctx.globalAlpha = 1;
  const a = new Art(lctx, L.W, L.H);
  SCENES[id].anim(a, L, planFor(id, L), reduced ? 4200 : now);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(animLayer.canvas, 0, 0, L.W * ART, L.H * ART);
  ctx.imageSmoothingEnabled = prev;
}

export { mix, rgba, bayer };
