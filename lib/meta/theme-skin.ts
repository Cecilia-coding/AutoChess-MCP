/**
 * 棋盘与前端界面主题皮肤规范（Theme & Skin Architecture）。
 *
 * 核心设计原则：
 * 1. 结构清晰、数据驱动：增加新皮肤只需在此登记配置并在 CSS 中挂载对应的 token。
 * 2. 界面与 3D 棋盘联动：包含 3D 调色板、天幕雾气、GLB 资产 key、半透明玻璃与强调色。
 * 3. 意象化视觉系统：主题可定义专属图标、植物装饰、花押符标（fleuron）与主副色。
 */

export interface SkinPalette {
  inner: string;
  outer: string;
  sky: string;
}

export interface SkinThemeTokens {
  primaryGreen: string;
  primaryGreenHover: string;
  primaryGreenSoft: string;
  riceWhite: string;
  riceWhiteSoft: string;
  daisyGold: string;
  daisyWhite: string;
  inkMain: string;
  inkMuted: string;
  inkSubtle: string;
  glassBg: string;
  glassBgHeavy: string;
  glassBgHover: string;
  glassBorder: string;
  glassBorderSubtle: string;
  glassBorderHighlight: string;
  glassShadow: string;
  popoverShadow: string;
}

export interface SkinTheme {
  id: string;
  name: string;
  englishTitle: string;
  tagline: string;
  imagery: string;
  boardAssetKey?: string;
  palette: SkinPalette;
  themeClass: string;
  tokens: SkinThemeTokens;
}

export const THEME_REVIVAL_SEASON: SkinTheme = {
  id: 'skin-revival',
  name: '复苏季节',
  englishTitle: 'Saison de Renaissance',
  tagline: '常青藤蔓，初绽雏菊 · 四时春生',
  imagery: '常青藤（藤蔓）与雏菊',
  boardAssetKey: 'revival-season',
  palette: {
    inner: '#e8f0da', // 清新浅绿内圈地面
    outer: '#7fa06a', // 嫩绿草木外圈
    sky: '#d6e6c8',   // 柔雾晨光淡青天幕
  },
  themeClass: 'skin-revival-season',
  tokens: {
    primaryGreen: '#3b6647',
    primaryGreenHover: '#2e5338',
    primaryGreenSoft: '#eef6ec',
    riceWhite: '#faf9f4',
    riceWhiteSoft: '#f5f3e9',
    daisyGold: '#cca046',
    daisyWhite: '#ffffff',
    inkMain: '#202e23',
    inkMuted: '#5e7262',
    inkSubtle: '#8fa493',
    glassBg: 'rgba(251, 250, 244, 0.78)',
    glassBgHeavy: 'rgba(251, 250, 244, 0.90)',
    glassBgHover: 'rgba(255, 255, 255, 0.92)',
    glassBorder: 'rgba(135, 172, 142, 0.38)',
    glassBorderSubtle: 'rgba(135, 172, 142, 0.20)',
    glassBorderHighlight: 'rgba(255, 255, 255, 0.85)',
    glassShadow: '0 10px 32px rgba(35, 52, 38, 0.09), 0 2px 8px rgba(35, 52, 38, 0.04)',
    popoverShadow: '0 20px 60px rgba(25, 42, 28, 0.16), 0 4px 16px rgba(25, 42, 28, 0.06)',
  },
};

export const REGISTERED_THEMES: Record<string, SkinTheme> = {
  'skin-revival': THEME_REVIVAL_SEASON,
};

export const DEFAULT_THEME_ID = 'skin-revival';

export function getSkinTheme(skinId?: string): SkinTheme {
  return (skinId && REGISTERED_THEMES[skinId]) || THEME_REVIVAL_SEASON;
}
