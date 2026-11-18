/**
 * 外观目录（皮肤 / 头像框）+ 图片解析。
 * 视觉资产与商业规则解耦：本文件声明棋盘/头像框视觉信息，
 * 价格、梯队与上下架状态由 `lib/meta/game-config.ts`（及后台配置表）统一驱动。
 */
import type { CurrencyId } from './economy';
import { assetUrl } from './asset-url';
import { boardModel, type BoardModelRef } from './board-assets';
import { BOARD_SCENES } from './board-scenes.js';
import {
  COSMETIC_TIER_META,
  getGameConfig,
  onGameConfigChange,
  type CosmeticAcquisition,
  type CosmeticRuleConfig,
  type CosmeticTierId,
} from './game-config';
import { pixelPortrait } from '../../packs/presentation';
import { pixelItemArt } from './pixel-items';
import {
  pixelBoardPreviewPath,
  pixelDefaultAvatarSvg,
  pixelFrameCardPreviewSvg,
  pixelInlineFrameSvg,
} from './pixel-cosmetics';

export type CosmeticKind = 'board' | 'frame';
export type { CosmeticAcquisition, CosmeticTierId };

export type SkinPalette = { inner: string; outer: string; sky: string };
/** x/y 为相对头像外框尺寸的百分比，缩放围绕中心。 */
export type FrameLayout = { scale: number; x: number; y: number };

type CosmeticVisualSpec = {
  id: string;
  kind: CosmeticKind;
  name: string;
  tagline: string;
  giftIntro?: string;
  rarity: 'common' | 'rare' | 'epic';
  art: string;
  palette?: SkinPalette;
  boardAsset?: string;
  boardScene?: string;
  frameAsset?: { image: string; portraitScale: number; layout?: FrameLayout };
};

export type Cosmetic = CosmeticVisualSpec & {
  price: number;
  prices?: Partial<Record<CurrencyId, number>>;
  currency: CurrencyId;
  acquisition?: 'shop' | 'wheel' | 'arcade' | 'default' | 'retired';
  tier?: CosmeticTierId;
  sortOrder?: number;
};

export const DEFAULT_BOARD_SKIN = 'skin-revival';
/** Virtual equip value meaning: clear board skin override and follow each pack's native pixel board. */
export const NATIVE_BOARD_SKIN = 'board:native';
/** 未单独校准的原画框默认比例，头像直径保持原值。 */
export const FRAME_ART_SCALE = 0.94;

export const PAID_BOARD_PRICES = { human: 52, bot: 520 } as const;

const BASE_COSMETICS: readonly CosmeticVisualSpec[] = [
  { id: 'skin-rose-court', kind: 'board', name: '玫瑰古堡', tagline: '玫瑰攀上古堡，乌鸦掠过暮色中的誓约', rarity: 'epic', art: '🌹', boardScene: 'rose-court', palette: { inner: '#d5cbd6', outer: '#703b50', sky: '#302936' } },
  { id: 'skin-wisteria-brook', kind: 'board', name: '紫藤镜溪', tagline: '紫藤垂瀑，流萤伴着河灯入梦', rarity: 'epic', art: '🪻', palette: { inner: '#d6bcfc', outer: '#43417a', sky: '#8982c7' } },
  { id: 'skin-wonderland-rabbit', kind: 'board', name: '仙境长耳兔', tagline: '浅蓝裙摆拂过白蕾丝茶席，墨蓝礼服的长耳兔正低头看表', rarity: 'epic', art: '🐇', palette: { inner: '#f6faff', outer: '#1c325e', sky: '#d4e8f9' } },
  { id: 'skin-carousel-night', kind: 'board', name: '星夜木马', tagline: '旋转木马不停，烟花替我们数着回合', rarity: 'epic', art: '🎠', palette: { inner: '#bb83a8', outer: '#302352', sky: '#4f2f63' } },
  { id: 'skin-revival', kind: 'board', name: '复苏季节', tagline: '橄榄枝迎风轻摇，白鸽飞过春日庭院', rarity: 'epic', art: '🌼', boardScene: 'revival-season', palette: { inner: '#e8f0da', outer: '#7fa06a', sky: '#d6e6c8' } },
  { id: 'skin-lotus-pond', kind: 'board', name: '荷塘清夏', tagline: '锦鲤绕着棋局游，莲叶漫过棋盘的边', rarity: 'epic', art: '🪷', palette: { inner: '#cfeee2', outer: '#3f8584', sky: '#bfe8d8' } },
  { id: 'skin-coral-lagoon', kind: 'board', name: '汐音珠贝', tagline: '潮生珠贝，水母曳过琉璃浅湾', rarity: 'epic', art: '🐚', palette: { inner: '#ccf2ee', outer: '#26728c', sky: '#a8f0e4' } },
  { id: 'skin-embroidery-hoop', kind: 'board', name: '绣线花绷', tagline: '花绷还没绣完，针线正替你补上最后一片叶', rarity: 'epic', art: '🧵', palette: { inner: '#fbf5ea', outer: '#a46e49', sky: '#f6e8e1' } },
  { id: 'skin-time-astrolabe-ivory', kind: 'board', name: '时间星盘', tagline: '象牙白的穹庭，金色星轨缓缓流转', rarity: 'epic', art: '✦', boardScene: 'time-astrolabe-ivory', palette: { inner: '#eee5d1', outer: '#bba778', sky: '#e3ded1' } },
  { id: 'skin-time-astrolabe', kind: 'board', name: '时间星盘 · 异色', tagline: '深蓝夜幕中，群星沿时间的轨迹运行', giftIntro: '星盘转过许多时辰，指针却总偏向与你有关的那一刻。', rarity: 'epic', art: '✦', boardScene: 'time-astrolabe', palette: { inner: '#c2d7e3', outer: '#738fa7', sky: '#233c58' } },
  { id: 'skin-bamboo', kind: 'board', name: '竹影潭', tagline: '竹影扫阶，微澜落子，幽篁深处自成局', rarity: 'epic', art: '🎋', boardScene: 'bamboo-pool', palette: { inner: '#e6f0dc', outer: '#8fae7a', sky: '#d9e6cd' } },
  { id: 'skin-taohua', kind: 'board', name: '桃花浮玉台', tagline: '默认棋盘，桃色庭院', rarity: 'common', art: '🌸', palette: { inner: '#fae5df', outer: '#d48d9e', sky: '#e9cfd9' } },
  { id: 'skin-moonpool', kind: 'board', name: '月下寒潭', tagline: '青蓝水面，夜风微凉', rarity: 'common', art: '🌙', palette: { inner: '#dfeaf2', outer: '#8fa8c8', sky: '#cbd9e8' } },
  { id: 'skin-lantern', kind: 'board', name: '灯火长街', tagline: '暖金灯市，人声鼎沸', rarity: 'rare', art: '🏮', palette: { inner: '#fbe8c8', outer: '#c98a4b', sky: '#f0d3a8' } },
  { id: 'skin-frost', kind: 'board', name: '霜天弈阁', tagline: '霜白楼阁，气韵清冷', rarity: 'rare', art: '❄️', palette: { inner: '#eef3f7', outer: '#9fb6c9', sky: '#dde8f0' } },
  { id: 'skin-ember', kind: 'board', name: '赤焰演武场', tagline: '赤红擂台，鼓声催阵', rarity: 'epic', art: '🔥', palette: { inner: '#f7dcd2', outer: '#bc5a4d', sky: '#eec4b6' } },
  { id: 'skin-bloodnight', kind: 'board', name: '血夜誓言', tagline: '血色长夜，誓约不熄', rarity: 'epic', art: '🌑', palette: { inner: '#e7d2d6', outer: '#7a2f3a', sky: '#3a2230' } },
  { id: 'frame-vernal-peach', kind: 'frame', name: '桃夭 · 灼华', tagline: '桃夭暮华 · 春燕拂花，金铃摇响朝景', rarity: 'rare', art: '🌸', frameAsset: { image: '/frames/frame_vernal_peach.svg', portraitScale: 34 / 48, layout: { scale: 1, x: 0, y: 0 } } },
  { id: 'frame-nocturne-peach', kind: 'frame', name: '暮华 · 沉月', tagline: '桃夭暮华 · 灵蝶停枝，玉玦映着夜月', rarity: 'rare', art: '🦋', frameAsset: { image: '/frames/frame_nocturne_peach.svg', portraitScale: 34 / 48, layout: { scale: 1, x: 0, y: 0 } } },
  { id: 'frame-lotus-koi', kind: 'frame', name: '荷影 · 锦鲤', tagline: '荷塘清夏 · 两尾锦鲤绕着你游，莲叶托着晚风', rarity: 'rare', art: '🐟', frameAsset: { image: '/frames/frame_lotus_koi.svg', portraitScale: 34 / 48, layout: { scale: 1, x: 0, y: 0 } } },
  { id: 'frame-revival-olive', kind: 'frame', name: '灵橄 · 衔春', tagline: '复苏季节 · 橄榄衔春，白鸽停在晨光里', giftIntro: '白鸽衔来的不止春天，还有藏不住的偏心。', rarity: 'rare', art: '🕊️', frameAsset: { image: '/frames/frame_revival_olive.svg', portraitScale: 34 / 48, layout: { scale: 1, x: 0, y: 0 } } },
  { id: 'frame-revival-ivy', kind: 'frame', name: '青藤 · 凌霄', tagline: '复苏季节 · 青藤常绿，白鸽振翅向你而来', giftIntro: '藤蔓借着春色攀上枝头，借着这份礼物，离你近一点。', rarity: 'rare', art: '🌿', frameAsset: { image: '/frames/frame_revival_ivy.svg', portraitScale: 34 / 48, layout: { scale: 1, x: 0, y: 0 } } },
  { id: 'frame-ring', kind: 'frame', name: '素圈', tagline: '一圈淡光', rarity: 'common', art: '⭕' },
  { id: 'frame-peach', kind: 'frame', name: '桃枝框', tagline: '桃花缠边', rarity: 'common', art: '🌺' },
  { id: 'frame-jade', kind: 'frame', name: '玉扣框', tagline: '温润青玉', rarity: 'rare', art: '🟢' },
  { id: 'frame-crown', kind: 'frame', name: '连胜冠冕', tagline: '胜者专属金环', rarity: 'epic', art: '👑' },
];

export const COSMETICS: Cosmetic[] = [];
const BY_ID = new Map<string, Cosmetic>();

function buildCosmeticsFromConfig(rules: readonly CosmeticRuleConfig[]): Cosmetic[] {
  const byRule = new Map(rules.map(rule => [rule.id, rule]));
  return BASE_COSMETICS.map((spec, index) => {
    const fallbackTier: CosmeticTierId = spec.kind === 'frame' ? 'frame' : 'retired';
    const rule = byRule.get(spec.id);
    const tier = rule?.tier ?? fallbackTier;
    const acquisition: CosmeticAcquisition = rule?.acquisition ?? 'retired';
    const humanPrice = rule?.humanPrice ?? 0;
    const botPrice = rule?.botPrice ?? 0;
    const sortOrder = rule?.sortOrder ?? index * 10;
    return {
      ...spec,
      price: humanPrice,
      prices: { human: humanPrice, bot: botPrice },
      currency: 'human' as const,
      acquisition,
      tier,
      sortOrder,
    };
  }).sort((a, b) => {
    const rankA = COSMETIC_TIER_META[a.tier ?? 'retired'].rank;
    const rankB = COSMETIC_TIER_META[b.tier ?? 'retired'].rank;
    return rankA - rankB || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

function syncCosmeticsFromRuntime() {
  const next = buildCosmeticsFromConfig(getGameConfig().cosmetics);
  COSMETICS.splice(0, COSMETICS.length, ...next);
  BY_ID.clear();
  for (const entry of COSMETICS) BY_ID.set(entry.id, entry);
}

syncCosmeticsFromRuntime();
onGameConfigChange(syncCosmeticsFromRuntime);

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

export function isDefaultCosmetic(cosmetic: Pick<Cosmetic, 'acquisition'>): boolean {
  return cosmetic.acquisition === 'default';
}

export function isArcadeCosmetic(cosmetic: Cosmetic): boolean {
  return cosmetic.acquisition === 'arcade' || cosmetic.acquisition === 'wheel';
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
export function itemImage(id: string, options: { label?: string; tint?: string; pixel?: boolean } = {}): string {
  const portrait = pixelPortrait(id);
  if (portrait) return portrait;
  if (IMAGE_OVERRIDES[id]) return IMAGE_OVERRIDES[id]!;
  const pixelArt = pixelItemArt(id, options.pixel);
  if (pixelArt) return pixelArt;
  const label = (options.label ?? id.replace(/^(eq|cat|low|s2)-/, '')).slice(0, 2);
  const tint = options.tint ?? `hsl(${hash(id) % 360} 55% 62%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#2b2233"/></linearGradient></defs><rect width="96" height="96" rx="18" fill="url(#g)"/><rect x="6" y="6" width="84" height="84" rx="14" fill="none" stroke="#ffffff55" stroke-width="2"/><text x="48" y="58" font-size="30" text-anchor="middle" fill="#ffffff" font-family="serif">${label}</text></svg>`;
  return svgUrl(svg);
}

export function cosmeticImage(id: string, baseOverride?: string): string {
  if (IMAGE_OVERRIDES[id]) return assetUrl(IMAGE_OVERRIDES[id]!, baseOverride);
  const cosmetic = cosmeticById(id);
  if (cosmetic?.kind === 'frame' && cosmetic.frameAsset) return assetUrl(cosmetic.frameAsset.image, baseOverride);
  if (cosmetic?.kind === 'board') return pixelBoardPreviewPath(cosmetic.id, baseOverride);
  if (cosmetic?.kind === 'frame') return pixelFrameCardPreviewSvg(cosmetic.id);
  return pixelFrameCardPreviewSvg('frame-ring');
}

/** Deterministic 16-bit pixel heraldry avatar (crispEdges SVG data URL). */
export function avatarImage(seed: string, baseOverride?: string): string {
  if (IMAGE_OVERRIDES[`avatar:${seed}`]) return assetUrl(IMAGE_OVERRIDES[`avatar:${seed}`]!, baseOverride);
  return pixelDefaultAvatarSvg(seed);
}

/**
 * Resolve crisp pixel frame overlay URL (standalone 48x48 asset or 32x32 crispEdges fallback SVG).
 */
export function frameImage(frameId: string | undefined, baseOverride?: string): string | null {
  const cosmetic = cosmeticById(frameId);
  if (!cosmetic || cosmetic.kind !== 'frame') return null;
  if (cosmetic.frameAsset) return assetUrl(cosmetic.frameAsset.image, baseOverride);
  return pixelInlineFrameSvg(cosmetic.id);
}
