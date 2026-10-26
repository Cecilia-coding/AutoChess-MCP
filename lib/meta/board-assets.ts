/**
 * 棋盘 3D 资产清单——**数据，不是代码**。
 *
 * 加一块棋盘只做三件事：
 *   1. 把 `.glb` 放进项目根的「棋盘」目录；
 *   2. 在 `BOARD_ASSETS` 加一条（key → 文件名 + 摆放参数）；
 *   3. 在 `COSMETICS` 里给外观挂 `boardAsset: '<key>'`。
 *
 * 渲染器只认 `boardModel()` 解析出的 `{ url, placement }`，不认识任何具体棋盘；
 * 摆放参数（fit/scale/rotationY/offsetY）改了不用动渲染器代码。
 * 本模块必须保持同构（浏览器 + 服务端都能 import），不要引 node:fs / node:path。
 */

export type BoardPlacement = {
  /** 自动缩放的基准尺寸（取模型水平最大边缩放到这个大小），默认 10.5。 */
  fit?: number;
  /** 在自动缩放之上的额外倍数，默认 1。 */
  scale?: number;
  /** 绕 X 轴旋转（弧度），用来把竖着的浮雕放倒。 */
  rotationX?: number;
  /** 绕 Y 轴旋转（弧度），对齐棋盘长边与 8 行方向。 */
  rotationY?: number;
  /** 绕 Z 轴旋转（弧度）。 */
  rotationZ?: number;
  /** 只在垂直方向压扁（Y 轴额外倍数），把起伏地形压成平棋盘，默认 1。 */
  flatten?: number;
  /** 居中后的水平微调。 */
  offsetX?: number;
  /** 居中后的前后微调。 */
  offsetZ?: number;
  /** 落地后的垂直微调。 */
  offsetY?: number;
  /**
   * 可行走面相对模型底部的高度（世界单位）。**不填时自动逐格测量地形**，
   * 起伏的 AI 生成棋盘会让棋子贴着真实地表；只有模型面是纯平面、
   * 想强制抬到固定高度时才需要显式填这个值。
   */
  surfaceY?: number;
};

export type BoardAsset = { file: string; placement: BoardPlacement };

/** 源文件所在目录（相对项目根）。 */
export const BOARD_DIR = '棋盘';

export const BOARD_ASSETS: Record<string, BoardAsset> = {};

export function boardAsset(key: string | undefined): BoardAsset | undefined {
  return key ? BOARD_ASSETS[key] : undefined;
}

/** 浏览器端加载地址（由 app/api/autochess/board 路由按 key 流式返回源文件）。 */
export function boardAssetUrl(key: string): string {
  return `/api/autochess/board?key=${encodeURIComponent(key)}`;
}

export type BoardModelRef = { key: string; url: string; placement: BoardPlacement };

export function boardModel(key: string | undefined): BoardModelRef | undefined {
  const asset = boardAsset(key);
  if (!asset || !key) return undefined;
  return { key, url: boardAssetUrl(key), placement: asset.placement };
}
