import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fitPixelBoard } from '../lib/autochess/pixel-board';
import { setSceneCanvasFactory } from '../lib/autochess/pixel-scene-kit';
import {
  paintSceneAnimated,
  paintSceneStatic,
  type PixelSceneId,
} from '../lib/autochess/pixel-scene-skins';

function parseColor(s: string): [number, number, number, number] {
  if (s.startsWith('#')) {
    if (s.length === 7) {
      return [
        parseInt(s.slice(1, 3), 16),
        parseInt(s.slice(3, 5), 16),
        parseInt(s.slice(5, 7), 16),
        255,
      ];
    }
    if (s.length === 9) {
      return [
        parseInt(s.slice(1, 3), 16),
        parseInt(s.slice(3, 5), 16),
        parseInt(s.slice(5, 7), 16),
        parseInt(s.slice(7, 9), 16),
      ];
    }
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1]!.split(',').map((v) => Number(v.trim()));
    return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] !== undefined ? Math.round(p[3] * 255) : 255];
  }
  return [0, 0, 0, 255];
}

class PixelSurface {
  data: Uint8ClampedArray;
  fillStyle = '#000000';
  globalAlpha = 1;
  imageSmoothingEnabled = false;
  constructor(public width: number, public height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
  getContext(_type: string): any {
    return this;
  }
  clearRect(x: number, y: number, w: number, h: number) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w)), y1 = Math.min(this.height, Math.ceil(y + h));
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) {
        const k = (j * this.width + i) * 4;
        this.data[k] = 0; this.data[k + 1] = 0; this.data[k + 2] = 0; this.data[k + 3] = 0;
      }
    }
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const rx = Math.round(x), ry = Math.round(y), rw = Math.round(w), rh = Math.round(h);
    if (rw <= 0 || rh <= 0) return;
    const [r, g, b, ca] = parseColor(this.fillStyle);
    const a = (ca / 255) * Math.max(0, Math.min(1, this.globalAlpha));
    if (a <= 0) return;
    const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
    const x1 = Math.min(this.width, rx + rw), y1 = Math.min(this.height, ry + rh);
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) {
        const k = (j * this.width + i) * 4;
        if (a >= 0.999) {
          this.data[k] = r; this.data[k + 1] = g; this.data[k + 2] = b; this.data[k + 3] = 255;
        } else {
          const da = this.data[k + 3]! / 255;
          const outA = a + da * (1 - a);
          if (outA > 0) {
            this.data[k] = Math.round((r * a + this.data[k]! * da * (1 - a)) / outA);
            this.data[k + 1] = Math.round((g * a + this.data[k + 1]! * da * (1 - a)) / outA);
            this.data[k + 2] = Math.round((b * a + this.data[k + 2]! * da * (1 - a)) / outA);
            this.data[k + 3] = Math.round(outA * 255);
          }
        }
      }
    }
  }
  getImageData(x: number, y: number, w: number, h: number) {
    if (x === 0 && y === 0 && w === this.width && h === this.height) {
      return { data: new Uint8ClampedArray(this.data), width: w, height: h };
    }
    throw new Error('Partial getImageData unused');
  }
  putImageData(img: { data: Uint8ClampedArray }, _x: number, _y: number) {
    this.data.set(img.data);
  }
  drawImage(src: PixelSurface, dx: number, dy: number, dw?: number, dh?: number) {
    const tw = Math.round(dw ?? src.width), th = Math.round(dh ?? src.height);
    const ox = Math.round(dx), oy = Math.round(dy);
    for (let j = 0; j < th; j++) {
      const sy = Math.min(src.height - 1, Math.floor((j * src.height) / th));
      const py = oy + j;
      if (py < 0 || py >= this.height) continue;
      for (let i = 0; i < tw; i++) {
        const sx = Math.min(src.width - 1, Math.floor((i * src.width) / tw));
        const px = ox + i;
        if (px < 0 || px >= this.width) continue;
        const sk = (sy * src.width + sx) * 4;
        const sa = (src.data[sk + 3]! / 255) * this.globalAlpha;
        if (sa <= 0) continue;
        const dk = (py * this.width + px) * 4;
        if (sa >= 0.999) {
          this.data[dk] = src.data[sk]!;
          this.data[dk + 1] = src.data[sk + 1]!;
          this.data[dk + 2] = src.data[sk + 2]!;
          this.data[dk + 3] = 255;
        } else {
          const da = this.data[dk + 3]! / 255;
          const outA = sa + da * (1 - sa);
          this.data[dk] = Math.round((src.data[sk]! * sa + this.data[dk]! * da * (1 - sa)) / outA);
          this.data[dk + 1] = Math.round((src.data[sk + 1]! * sa + this.data[dk + 1]! * da * (1 - sa)) / outA);
          this.data[dk + 2] = Math.round((src.data[sk + 2]! * sa + this.data[dk + 2]! * da * (1 - sa)) / outA);
          this.data[dk + 3] = Math.round(outA * 255);
        }
      }
    }
  }
}

function encodePng(width: number, height: number, rgbaData: Uint8ClampedArray): Buffer {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const body = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter None
    Buffer.from(rgbaData.buffer, rgbaData.byteOffset + y * width * 4, width * 4).copy(raw, rowStart + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

setSceneCanvasFactory((w, h) => new PixelSurface(w, h) as unknown as HTMLCanvasElement);

const outDir = process.argv[2] ?? '/content/work/out';
mkdirSync(`${outDir}/pixel-scenes`, { recursive: true });

// Standard 4:3 desktop arena (960+16 x 720+16 => 960 x 720 world = 320 x 240 art-px)
const { board } = fitPixelBoard(976, 736);

const SKIN_MAP: readonly [string, PixelSceneId, number][] = [
  ['skin-lotus-pond', 'lotus-pond', 2600],
  ['skin-revival', 'spring-meadow', 2400],
  ['skin-coral-lagoon', 'coral-lagoon', 7200],
  ['skin-wisteria-brook', 'wisteria-brook', 2900],
  ['skin-rose-court', 'rose-dusk', 2800],
  ['skin-bamboo', 'bamboo-grove', 2200],
  ['skin-time-astrolabe', 'astral-night', 3100],
  ['skin-time-astrolabe-ivory', 'astral-ivory', 3100],
  ['skin-embroidery-hoop', 'embroidery-hoop', 9000],
  ['skin-wonderland-rabbit', 'wonderland-rabbit', 2600],
  ['skin-carousel-night', 'carousel-night', 2600],
];

const sheetCols = 2, sheetRows = Math.ceil(SKIN_MAP.length / 2);
const tileW = 640, tileH = 480, gap = 8;
const sheet = new PixelSurface(sheetCols * tileW + (sheetCols - 1) * gap, sheetRows * tileH + (sheetRows - 1) * gap);
sheet.fillStyle = '#181822';
sheet.fillRect(0, 0, sheet.width, sheet.height);

for (const [idx, [skinId, sceneId, timeMs]] of SKIN_MAP.entries()) {
  const world = new PixelSurface(Math.round(board.width), Math.round(board.height));
  paintSceneStatic(world as unknown as CanvasRenderingContext2D, board, sceneId);
  paintSceneAnimated(world as unknown as CanvasRenderingContext2D, board, sceneId, timeMs, false);

  // Downsample 3x world back to exact 1x 320x240 art-px for crisp 4:3 shop preview PNG!
  const preview = new PixelSurface(320, 240);
  preview.drawImage(world, 0, 0, 320, 240);
  writeFileSync(`${outDir}/pixel-scenes/${skinId}.png`, encodePng(320, 240, preview.data));

  // Blit 2x nearest-neighbor (640x480) onto contact sheet
  const gx = idx % sheetCols, gy = Math.floor(idx / sheetCols);
  sheet.drawImage(preview, gx * (tileW + gap), gy * (tileH + gap), tileW, tileH);
}
writeFileSync(`${outDir}/boards-sheet.png`, encodePng(sheet.width, sheet.height, sheet.data));

// Also render a 2x2 closeup sheet of revival + coral-lagoon + wisteria-brook (2 frames) for pixel inspection!
const strip = new PixelSurface(2 * tileW + gap, 2 * tileH + gap);
strip.fillStyle = '#101420';
strip.fillRect(0, 0, strip.width, strip.height);
const FOCUS: readonly [PixelSceneId, number][] = [
  ['spring-meadow', 2400],
  ['coral-lagoon', 2500],
  ['wisteria-brook', 2900],
  ['coral-lagoon', 7200],
];
for (const [i, [scId, tMs]] of FOCUS.entries()) {
  const world = new PixelSurface(Math.round(board.width), Math.round(board.height));
  paintSceneStatic(world as unknown as CanvasRenderingContext2D, board, scId);
  paintSceneAnimated(world as unknown as CanvasRenderingContext2D, board, scId, tMs, false);
  const preview = new PixelSurface(320, 240);
  preview.drawImage(world, 0, 0, 320, 240);
  strip.drawImage(preview, (i % 2) * (tileW + gap), Math.floor(i / 2) * (tileH + gap), tileW, tileH);
}
writeFileSync(`${outDir}/focus-sheet.png`, encodePng(strip.width, strip.height, strip.data));
console.log('Rendered 8 board previews + boards-sheet.png + focus-sheet.png');
