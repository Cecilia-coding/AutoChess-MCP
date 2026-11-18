/**
 * Single source of truth for asset & internal route URLs.
 *
 * Host apps mounting AutoChess under a sub-path (e.g. `/autochess/static/`)
 * can call `configureAssetBase('/autochess/static/')` once at startup, set
 * Vite `base`, or supply `assetBase` through `AutochessHostProvider`.
 */

let configuredBase: string | null = null;

function envBaseUrl(): string {
  const viteBase = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
  if (typeof viteBase === 'string' && viteBase.trim() && viteBase !== '/') return viteBase;
  if (typeof process !== 'undefined') {
    const nextBase = process.env?.NEXT_PUBLIC_AUTOCHESS_ASSET_BASE;
    if (typeof nextBase === 'string' && nextBase.trim()) return nextBase;
  }
  return '';
}

/** Normalize a base prefix: '' for root, or '/prefix' with leading slash and no trailing slash. */
export function normalizeBasePath(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '/') return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`;
}

export function configureAssetBase(base: string | null | undefined): void {
  configuredBase = base === null || base === undefined ? null : normalizeBasePath(base);
}

export function getAssetBase(): string {
  return configuredBase !== null ? configuredBase : normalizeBasePath(envBaseUrl());
}

/**
 * Join a configured base prefix onto an app-relative or root-relative path.
 * Preserves inline `data:`, `blob:`, `http:`, `https:` URLs untouched and avoids double-prefixing.
 */
export function joinBasePath(path: string, baseOverride?: string): string {
  if (!path) return path;
  if (/^(?:data:|blob:|https?:\/\/)/i.test(path)) return path;
  const base = baseOverride !== undefined ? normalizeBasePath(baseOverride) : getAssetBase();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!base) return normalized;
  if (normalized === base || normalized.startsWith(`${base}/`)) return normalized;
  return `${base}${normalized}`;
}

/** Resolve any public static asset URL (images, sprites, frames, SVGs, fonts). */
export function assetUrl(path: string, baseOverride?: string): string {
  return joinBasePath(path, baseOverride);
}
