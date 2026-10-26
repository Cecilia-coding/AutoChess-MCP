/**
 * 外观目录（皮肤 / 头像框）+ 图片解析。
 * 数据驱动：加一件新外观 = 在 COSMETICS 里加一条；换真图 = 在 IMAGE_OVERRIDES 登记 id → url。
 * 头像算法灵感来自 laurentpayot/minidenticons（MIT）：确定性镜像网格，本项目自写、零依赖。
 */
import type { CurrencyId } from './economy';
import { boardModel, type BoardModelRef } from './board-assets';
import { BOARD_SCENES } from './board-scenes.js';

export type CosmeticKind = 'board' | 'frame';

export type SkinPalette = { inner: string; outer: string; sky: string };
/** x/y 为相对头像外框尺寸的百分比，缩放围绕中心。 */
export type FrameLayout = { scale: number; x: number; y: number };

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  tagline: string;
  giftIntro?: string;
  price: number;
  /** 按币种报价；缺省沿用 price，兼容旧外观。 */
  prices?: Partial<Record<CurrencyId, number>>;
  /** 结算币种：实际按买家身份使用铜钱或机芯。 */
  currency: CurrencyId;
  /** 省略沿用商城；wheel 只展示，抽取开放前不能购买或代购赠送。 */
  acquisition?: 'shop' | 'wheel' | 'retired';
  rarity: 'common' | 'rare' | 'epic';
  art: string;
  /** 没有 3D 模型时的配色（棋盘地面/天幕），也作为模型加载前的兜底。 */
  palette?: SkinPalette;
  /** 棋盘 3D 模型：指向 board-assets 的 key；没有就只用 palette。 */
  boardAsset?: string;
  /** 原画场景 id；旧配色棋盘继续使用庭院。 */
  boardScene?: string;
  /** 自带动效的透明头像框；portraitScale 为中间头像相对框体的直径。 */
  frameAsset?: { image: string; portraitScale: number; layout?: FrameLayout };
};

export const DEFAULT_BOARD_SKIN = 'skin-revival';
/** 未单独校准的原画框默认比例，头像直径保持原值。 */
export const FRAME_ART_SCALE = .94;

export const PAID_BOARD_PRICES = { human: 52, bot: 520 } as const;

export const COSMETICS: Cosmetic[] = [
  { id: 'skin-rose-court', kind: 'board', name: '玫瑰古堡', tagline: '玫瑰攀上古堡，乌鸦掠过暮色中的誓约', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', rarity: 'epic', art: '🌹', boardScene: 'rose-court', palette: { inner: '#d5cbd6', outer: '#703b50', sky: '#302936' } },
  { id: 'skin-revival', kind: 'board', name: '复苏季节', tagline: '橄榄枝迎风轻摇，白鸽飞过春日庭院', price: 0, currency: 'human', rarity: 'epic', art: '🌼', boardScene: 'revival-season', palette: { inner: '#e8f0da', outer: '#7fa06a', sky: '#d6e6c8' } },
  { id: 'skin-time-astrolabe-ivory', kind: 'board', name: '时间星盘', tagline: '象牙白的穹庭，金色星轨缓缓流转', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', rarity: 'epic', art: '✦', boardScene: 'time-astrolabe-ivory', palette: { inner: '#eee5d1', outer: '#bba778', sky: '#e3ded1' } },
  { id: 'skin-time-astrolabe', kind: 'board', name: '时间星盘 · 异色', tagline: '深蓝夜幕中，群星沿时间的轨迹运行', giftIntro: '星盘转过许多时辰，指针却总偏向与你有关的那一刻。', price: 0, currency: 'human', acquisition: 'wheel', rarity: 'epic', art: '✦', boardScene: 'time-astrolabe', palette: { inner: '#c2d7e3', outer: '#738fa7', sky: '#233c58' } },
  { id: 'skin-taohua', kind: 'board', name: '桃花浮玉台', tagline: '默认棋盘，桃色庭院', price: 0, currency: 'human', acquisition: 'retired', rarity: 'common', art: '🌸', palette: { inner: '#fae5df', outer: '#d48d9e', sky: '#e9cfd9' } },
  { id: 'skin-moonpool', kind: 'board', name: '月下寒潭', tagline: '青蓝水面，夜风微凉', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', acquisition: 'retired', rarity: 'common', art: '🌙', palette: { inner: '#dfeaf2', outer: '#8fa8c8', sky: '#cbd9e8' } },
  { id: 'skin-bamboo', kind: 'board', name: '竹影潭', tagline: '竹影扫阶，微澜落子，幽篁深处自成局', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', rarity: 'epic', art: '🎋', boardScene: 'bamboo-pool', palette: { inner: '#e6f0dc', outer: '#8fae7a', sky: '#d9e6cd' } },
  { id: 'skin-lantern', kind: 'board', name: '灯火长街', tagline: '暖金灯市，人声鼎沸', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', acquisition: 'retired', rarity: 'rare', art: '🏮', palette: { inner: '#fbe8c8', outer: '#c98a4b', sky: '#f0d3a8' } },
  { id: 'skin-frost', kind: 'board', name: '霜天弈阁', tagline: '霜白楼阁，气韵清冷', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', acquisition: 'retired', rarity: 'rare', art: '❄️', palette: { inner: '#eef3f7', outer: '#9fb6c9', sky: '#dde8f0' } },
  { id: 'skin-ember', kind: 'board', name: '赤焰演武场', tagline: '赤红擂台，鼓声催阵', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', acquisition: 'retired', rarity: 'epic', art: '🔥', palette: { inner: '#f7dcd2', outer: '#bc5a4d', sky: '#eec4b6' } },
  { id: 'skin-bloodnight', kind: 'board', name: '血夜誓言', tagline: '血色长夜，誓约不熄', price: PAID_BOARD_PRICES.human, prices: PAID_BOARD_PRICES, currency: 'human', acquisition: 'retired', rarity: 'epic', art: '🌑', palette: { inner: '#e7d2d6', outer: '#7a2f3a', sky: '#3a2230' } },
  { id: 'frame-ring', kind: 'frame', name: '素圈', tagline: '一圈淡光', price: 0, currency: 'human', acquisition: 'retired', rarity: 'common', art: '⭕' },
  { id: 'frame-peach', kind: 'frame', name: '桃枝框', tagline: '桃花缠边', price: 40, currency: 'human', acquisition: 'retired', rarity: 'common', art: '🌺' },
  { id: 'frame-jade', kind: 'frame', name: '玉扣框', tagline: '温润青玉', price: 90, currency: 'human', acquisition: 'retired', rarity: 'rare', art: '🟢' },
  { id: 'frame-crown', kind: 'frame', name: '连胜冠冕', tagline: '胜者专属金环', price: 200, currency: 'human', acquisition: 'retired', rarity: 'epic', art: '👑' },
  { id: 'frame-revival-olive', kind: 'frame', name: '灵橄 · 衔春', tagline: '复苏季节 · 橄榄衔春，白鸽停在晨光里', giftIntro: '白鸽衔来的不止春天，还有藏不住的偏心。', price: 0, currency: 'human', acquisition: 'wheel', rarity: 'rare', art: '🕊️', frameAsset: { image: '/frames/frame_revival_olive.svg', portraitScale: 620 / 1024, layout: { scale: .87, x: 0, y: -.5 } } },
  { id: 'frame-revival-ivy', kind: 'frame', name: '青藤 · 凌霄', tagline: '复苏季节 · 青藤常绿，白鸽振翅向你而来', giftIntro: '藤蔓借着春色攀上枝头，借着这份礼物，离你近一点。', price: 0, currency: 'human', acquisition: 'wheel', rarity: 'rare', art: '🌿', frameAsset: { image: '/frames/frame_revival_ivy.svg', portraitScale: 620 / 1024, layout: { scale: .87, x: 0, y: -.8 } } },
  { id: 'frame-vernal-peach', kind: 'frame', name: '桃夭 · 灼华', tagline: '桃夭暮华 · 春燕拂花，金铃摇响朝景', price: 52, prices: { human: 52, bot: 520 }, currency: 'human', rarity: 'rare', art: '🌸', frameAsset: { image: '/frames/frame_vernal_peach.svg', portraitScale: 620 / 1024, layout: { scale: .86, x: 0, y: .7 } } },
  { id: 'frame-nocturne-peach', kind: 'frame', name: '暮华 · 沉月', tagline: '桃夭暮华 · 灵蝶停枝，玉玦映着夜月', price: 52, prices: { human: 52, bot: 520 }, currency: 'human', rarity: 'rare', art: '🦋', frameAsset: { image: '/frames/frame_nocturne_peach.svg', portraitScale: 630 / 1024, layout: { scale: .88, x: -.8, y: 2.9 } } },
];

const BY_ID = new Map(COSMETICS.map(entry => [entry.id, entry]));

export function cosmeticById(id: string | undefined): Cosmetic | null {
  return id ? BY_ID.get(id) ?? null : null;
}

export function frameLayoutFor(id: string | undefined): FrameLayout {
  return { ...(cosmeticById(id)?.frameAsset?.layout ?? { scale: FRAME_ART_SCALE, x: 0, y: 0 }) };
}

/** 编辑器与正式头像共用变换顺序，位移不随框体缩放。 */
export function frameArtTransform(layout: FrameLayout): string {
  return `translate(${layout.x}%, ${layout.y}%) scale(${layout.scale})`;
}

export function cosmeticsOfKind(kind: CosmeticKind): Cosmetic[] {
  return COSMETICS.filter(entry => entry.kind === kind);
}

export function skinPalette(id: string | undefined): SkinPalette {
  return cosmeticById(id)?.palette ?? cosmeticById(DEFAULT_BOARD_SKIN)!.palette!;
}

export function cosmeticPrice(cosmetic: Cosmetic, currency: CurrencyId): number {
  return cosmetic.prices?.[currency] ?? cosmetic.price;
}

export function listedCosmetics(): Cosmetic[] {
  return COSMETICS.filter(entry => entry.acquisition !== 'retired');
}

export function isShopCosmetic(cosmetic: Cosmetic): boolean {
  return cosmetic.acquisition === undefined || cosmetic.acquisition === 'shop';
}

export function boardSceneFor(id: string | undefined) {
  const selected = cosmeticById(id);
  const cosmetic = selected?.kind === 'board' ? selected : cosmeticById(DEFAULT_BOARD_SKIN)!;
  const sceneId = cosmetic.boardScene ?? 'garden';
  return BOARD_SCENES.find(scene => scene.id === sceneId) ?? BOARD_SCENES[0]!;
}

/** 公共场景与当前场地主人已装备的场景；购买款及限定款通过装备入局。 */
export function playableBoardScenes(id: string | undefined) {
  const equipped = boardSceneFor(id);
  return BOARD_SCENES.filter(scene => scene.id === equipped.id || !COSMETICS.some(c => c.boardScene === scene.id && (c.price > 0 || !isShopCosmetic(c))));
}

/** 该外观对应的 3D 棋盘模型（没有模型/不是棋盘就返回 undefined，调用方落回 palette）。 */
export function boardModelFor(id: string | undefined): BoardModelRef | undefined {
  return boardModel(cosmeticById(id)?.boardAsset);
}

/** 真图接入点：登记了就用真图，没有就落回确定性 SVG 占位。 */
export const IMAGE_OVERRIDES: Record<string, string> = {};

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 确定性 SVG 卡片：任意 id 都有图，分类配色 + 首字，离线可用。 */
export function itemImage(id: string, options: { label?: string; tint?: string } = {}): string {
  if (IMAGE_OVERRIDES[id]) return IMAGE_OVERRIDES[id]!;
  const label = (options.label ?? id.replace(/^(eq|cat|low|s2)-/, '')).slice(0, 2);
  const tint = options.tint ?? `hsl(${hash(id) % 360} 55% 62%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#2b2233"/></linearGradient></defs><rect width="96" height="96" rx="18" fill="url(#g)"/><rect x="6" y="6" width="84" height="84" rx="14" fill="none" stroke="#ffffff55" stroke-width="2"/><text x="48" y="58" font-size="30" text-anchor="middle" fill="#ffffff" font-family="serif">${label}</text></svg>`;
  return svgUrl(svg);
}

export function cosmeticImage(id: string): string {
  if (IMAGE_OVERRIDES[id]) return IMAGE_OVERRIDES[id]!;
  const cosmetic = cosmeticById(id);
  if (cosmetic?.kind === 'frame' && cosmetic.frameAsset) return cosmetic.frameAsset.image;
  if (cosmetic?.boardScene) {
    const image = BOARD_SCENES.find(scene => scene.id === cosmetic.boardScene)?.artwork?.image;
    if (image) return image;
  }
  const palette = cosmetic?.palette;
  const art = cosmetic?.art ?? '✦';
  const name = cosmetic?.name ?? id;
  const isFrame = cosmetic?.kind === 'frame';
  const bg = palette?.sky ?? (isFrame ? '#f3edf8' : `hsl(${hash(id) % 360} 32% 86%)`);
  const ground = palette?.outer ?? (isFrame ? '#c6b5d2' : '#8f7e91');
  const accent = cosmetic?.rarity === 'epic' ? '#b38848' : cosmetic?.rarity === 'rare' ? '#8a486b' : '#5e7262';

  // 古典双线卡牌画芯 (Muted Codex Frame / Loci Card)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110" role="img">
    <defs>
      <linearGradient id="g_${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${bg}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${ground}" stop-opacity="0.25"/>
      </linearGradient>
      <radialGradient id="halo_${id}" cx="50%" cy="45%" r="42%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="160" height="110" rx="14" fill="url(#g_${id})"/>
    <rect x="5" y="5" width="150" height="100" rx="10" fill="none" stroke="${accent}" stroke-width="1" stroke-opacity="0.4"/>
    <rect x="8" y="8" width="144" height="94" rx="8" fill="none" stroke="${accent}" stroke-width="0.5" stroke-dasharray="4 2" stroke-opacity="0.3"/>
    <circle cx="80" cy="50" r="32" fill="url(#halo_${id})"/>
    <circle cx="80" cy="50" r="28" fill="none" stroke="${accent}" stroke-width="0.8" stroke-opacity="0.35"/>
    <text x="80" y="58" font-size="32" text-anchor="middle" dominant-baseline="central">${art}</text>
    <path d="M 60 88 L 100 88" stroke="${accent}" stroke-width="0.8" stroke-opacity="0.5"/>
    <circle cx="80" cy="88" r="1.8" fill="${accent}"/>
    <text x="80" y="100" font-size="11" text-anchor="middle" fill="#2b2338" font-family="'Huiwen-Mincho', serif" letter-spacing="1">${name}</text>
  </svg>`;
  return svgUrl(svg);
}

/** 确定性头像：低饱和柔雾古籍色调，融入典雅同心圆与印记 */
export function avatarImage(seed: string): string {
  if (IMAGE_OVERRIDES[`avatar:${seed}`]) return IMAGE_OVERRIDES[`avatar:${seed}`]!;
  const h = hash(seed || 'anon');
  // 低饱和古籍调色盘（暮紫墨、烟粉灰玫瑰、暗流金、冷青墨、深绯墨）
  const codexColors = [
    { fg: '#3b2f4a', bg: '#f4eff8', ring: '#cfc2dc' },
    { fg: '#8a486b', bg: '#faedf3', ring: '#e2bccf' },
    { fg: '#7d6232', bg: '#faf5ea', ring: '#e4d3b0' },
    { fg: '#365349', bg: '#edf4f1', ring: '#bcd4cb' },
    { fg: '#42556b', bg: '#edf2f7', ring: '#c2d2e2' },
    { fg: '#6b3d43', bg: '#f8eeee', ring: '#dfbec3' },
  ];
  const theme = codexColors[h % codexColors.length]!;
  const bits: boolean[] = [];
  for (let i = 0; i < 15; i += 1) bits.push(((h >>> (i % 31)) & 1) === 1);
  let cells = '';
  for (let row = 0; row < 5; row += 1) for (let col = 0; col < 3; col += 1) {
    if (!bits[row * 3 + col]) continue;
    const mirror = 4 - col;
    cells += `<rect x="${14 + col * 14}" y="${14 + row * 14}" width="12" height="12" rx="3.5" fill="${theme.fg}" fill-opacity="0.88"/>`;
    if (mirror !== col) cells += `<rect x="${14 + mirror * 14}" y="${14 + row * 14}" width="12" height="12" rx="3.5" fill="${theme.fg}" fill-opacity="0.88"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">
    <rect width="96" height="96" rx="22" fill="${theme.bg}"/>
    <circle cx="48" cy="48" r="41" fill="none" stroke="${theme.ring}" stroke-width="1.2" stroke-dasharray="3 3"/>
    <circle cx="48" cy="48" r="37" fill="none" stroke="${theme.fg}" stroke-width="0.6" stroke-opacity="0.25"/>
    ${cells}
  </svg>`;
  return svgUrl(svg);
}

/**
 * 头像框：高阶古籍矢量精雕（根据稀有度与款式输出精细镂空框与四角星芒）
 */
export function frameImage(frameId: string | undefined): string | null {
  const cosmetic = cosmeticById(frameId);
  if (!cosmetic || cosmetic.kind !== 'frame') return null;
  if (cosmetic.frameAsset) return cosmetic.frameAsset.image;

  if (frameId === 'frame-crown') {
    // 连胜冠冕：T5 神话暗流金双重镂空框，顶饰梯队星芒与流金角标
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">
      <defs>
        <linearGradient id="gold_edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fdf4d8"/>
          <stop offset="35%" stop-color="#c49e5d"/>
          <stop offset="70%" stop-color="#8a6125"/>
          <stop offset="100%" stop-color="#d9b66d"/>
        </linearGradient>
      </defs>
      <!-- 双层金线框 -->
      <rect x="2" y="2" width="92" height="92" rx="22" fill="none" stroke="url(#gold_edge)" stroke-width="2.5"/>
      <rect x="5.5" y="5.5" width="85" height="85" rx="18" fill="none" stroke="#f6e7c1" stroke-width="0.8" stroke-dasharray="6 3"/>
      <!-- 四角古铜暗流金角饰 -->
      <path d="M 6 18 L 6 6 L 18 6" fill="none" stroke="#c49e5d" stroke-width="2"/>
      <path d="M 90 18 L 90 6 L 78 6" fill="none" stroke="#c49e5d" stroke-width="2"/>
      <path d="M 6 78 L 6 90 L 18 90" fill="none" stroke="#c49e5d" stroke-width="2"/>
      <path d="M 90 78 L 90 90 L 78 90" fill="none" stroke="#c49e5d" stroke-width="2"/>
      <!-- 冠冕顶星 -->
      <path d="M 48 0 L 51 4 L 48 8 L 45 4 Z" fill="#fef2cb"/>
      <circle cx="48" cy="4" r="1.2" fill="#8a6125"/>
      <path d="M 39 2 L 41 5 L 39 8 L 37 5 Z" fill="#c49e5d"/>
      <path d="M 57 2 L 59 5 L 57 8 L 55 5 Z" fill="#c49e5d"/>
      <!-- 底部胜者徽记 -->
      <circle cx="48" cy="92" r="3" fill="#c49e5d" stroke="#fef2cb" stroke-width="0.8"/>
    </svg>`;
    return svgUrl(svg);
  }

  if (frameId === 'frame-jade') {
    // 玉扣框：温润墨玉碧环 + 暗金合扣
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">
      <defs>
        <linearGradient id="jade_grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#72a893"/>
          <stop offset="60%" stop-color="#3b6957"/>
          <stop offset="100%" stop-color="#24483a"/>
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="91" height="91" rx="22" fill="none" stroke="url(#jade_grad)" stroke-width="3"/>
      <rect x="6.5" y="6.5" width="83" height="83" rx="17" fill="none" stroke="#d5ede3" stroke-width="1" stroke-opacity="0.7"/>
      <!-- 金扣咬角 -->
      <circle cx="10" cy="10" r="3.2" fill="#c49e5d" stroke="#fff" stroke-width="0.6"/>
      <circle cx="86" cy="10" r="3.2" fill="#c49e5d" stroke="#fff" stroke-width="0.6"/>
      <circle cx="10" cy="86" r="3.2" fill="#c49e5d" stroke="#fff" stroke-width="0.6"/>
      <circle cx="86" cy="86" r="3.2" fill="#c49e5d" stroke="#fff" stroke-width="0.6"/>
    </svg>`;
    return svgUrl(svg);
  }

  if (frameId === 'frame-peach') {
    // 桃枝框：烟粉灰玫瑰红双线 + 纤细花蔓
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">
      <defs>
        <linearGradient id="peach_grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e89cb8"/>
          <stop offset="70%" stop-color="#9d4b6c"/>
          <stop offset="100%" stop-color="#692b43"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="92" height="92" rx="22" fill="none" stroke="url(#peach_grad)" stroke-width="2.2"/>
      <rect x="6" y="6" width="84" height="84" rx="18" fill="none" stroke="#fdecf2" stroke-width="0.8" stroke-dasharray="4 2"/>
      <!-- 桃花角标 -->
      <circle cx="8" cy="8" r="2.8" fill="#e89cb8"/>
      <circle cx="88" cy="8" r="2.8" fill="#e89cb8"/>
      <circle cx="8" cy="88" r="2.8" fill="#e89cb8"/>
      <circle cx="88" cy="88" r="2.8" fill="#e89cb8"/>
      <path d="M 48 3 L 50 6 L 48 9 L 46 6 Z" fill="#e89cb8"/>
    </svg>`;
    return svgUrl(svg);
  }

  // 默认 frame-ring 或基础款：素圈（素月流银，极细双线与四角星芒）
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">
    <rect x="2.5" y="2.5" width="91" height="91" rx="22" fill="none" stroke="#bfaecc" stroke-width="1.8"/>
    <rect x="6" y="6" width="84" height="84" rx="18" fill="none" stroke="#ede5f5" stroke-width="0.9" stroke-dasharray="5 3"/>
    <circle cx="48" cy="4" r="1.8" fill="#8a486b"/>
    <circle cx="48" cy="92" r="1.8" fill="#8a486b"/>
    <circle cx="4" cy="48" r="1.8" fill="#8a486b"/>
    <circle cx="92" cy="48" r="1.8" fill="#8a486b"/>
  </svg>`;
  return svgUrl(svg);
}
