import { normalizeBasePath } from './asset-url';

export const AUTOCHESS_HOST_ADAPTER_VERSION = '2.1.0';
export const AUTOCHESS_PLATFORM_PROTOCOL_VERSION = 'cedartoy-satellite-v1';
export const AUTOCHESS_ADAPTER_CAPABILITIES = [
  'pixel-2d',
  'host-provider',
  'platform-run',
  'platform-gifting',
  'host-matchmaking-toggle',
  'echo-scope',
  'arcade-embedded',
  'game-config-store',
  'tiered-cosmetics',
] as const;

export type AutochessRoutes = {
  lobby: string;
  room: string;
  arcade: string;
  accountApi: string;
  roomApi: string;
  metaApi: string;
  feedbackApi: string;
  companionApi: string;
};

export type AutochessEchoScope = 'public' | 'private' | 'none';
export type AutochessGiftingMode = 'mutual-bound' | 'ai-to-human' | 'none';
export type AutochessLeaveMode = 'resign' | 'preserve-seat';

export type AutochessFeatures = {
  authMode: 'local' | 'platform';
  accounts: boolean;
  social: boolean;
  matchmaking: boolean;
  echoScope: AutochessEchoScope;
  leaderboard: boolean;
  feedback: boolean;
  cosmetics: boolean;
  arcade: boolean;
  gifting: AutochessGiftingMode;
  localAvatar: boolean;
  leaveMode: AutochessLeaveMode;
  embeddedContainer: boolean;
};

export type AutochessTransport = {
  roomRequest?: <T = unknown>(op: string, args?: object) => Promise<T>;
  accountRequest?: <T = unknown>(op: string, args?: object) => Promise<T>;
  metaRequest?: <T = unknown>(op: string, args?: object) => Promise<T>;
  navigate?: (target: 'lobby' | 'room' | 'arcade', params?: Record<string, string>) => void;
};

export type AutochessHostConfig = {
  /** Base URL prefix for static assets in Vite/CDN/subpath mounts ('' = site root). */
  assetBase: string;
  routes: AutochessRoutes;
  features: AutochessFeatures;
  transport: AutochessTransport;
};

export type PartialAutochessHostConfig = {
  assetBase?: string;
  routes?: Partial<AutochessRoutes>;
  features?: Partial<AutochessFeatures>;
  transport?: Partial<AutochessTransport>;
};

export const DEFAULT_HOST_ROUTES: AutochessRoutes = {
  lobby: '/autochess/room',
  room: '/autochess/room',
  arcade: '/autochess/arcade',
  accountApi: '/api/autochess/account',
  roomApi: '/api/autochess/room',
  metaApi: '/api/autochess/meta',
  feedbackApi: '/api/autochess/feedback',
  companionApi: '/api/autochess/companion',
};

export const DEFAULT_HOST_FEATURES: AutochessFeatures = {
  authMode: 'local',
  accounts: true,
  social: true,
  matchmaking: true,
  echoScope: 'public',
  leaderboard: true,
  feedback: true,
  cosmetics: true,
  arcade: true,
  gifting: 'mutual-bound',
  localAvatar: true,
  leaveMode: 'resign',
  embeddedContainer: false,
};

/** 面向 CEDAR TOY 等宿主的嵌入式预设：人机陪伴互赠 + 游乐摊 + 私有回音树，关闭公共匹配/远游与独立账号体系。 */
export const CEDAR_HOST_FEATURES: AutochessFeatures = {
  authMode: 'platform',
  accounts: false,
  social: false,
  matchmaking: false,
  echoScope: 'private',
  leaderboard: false,
  feedback: false,
  cosmetics: true,
  arcade: true,
  gifting: 'mutual-bound',
  localAvatar: false,
  leaveMode: 'preserve-seat',
  embeddedContainer: true,
};

export const DEFAULT_HOST_CONFIG: AutochessHostConfig = {
  assetBase: '',
  routes: DEFAULT_HOST_ROUTES,
  features: DEFAULT_HOST_FEATURES,
  transport: {},
};

/** Merge a partial host configuration cleanly without losing default route or feature keys. */
export function resolveHostConfig(partial?: PartialAutochessHostConfig): AutochessHostConfig {
  if (!partial) return DEFAULT_HOST_CONFIG;
  return {
    assetBase: normalizeBasePath(partial.assetBase ?? DEFAULT_HOST_CONFIG.assetBase),
    routes: { ...DEFAULT_HOST_ROUTES, ...partial.routes },
    features: { ...DEFAULT_HOST_FEATURES, ...partial.features },
    transport: { ...DEFAULT_HOST_CONFIG.transport, ...partial.transport },
  };
}
