import { useSyncExternalStore } from 'react';
import { NATIVE_BOARD_SKIN } from './cosmetics';

export type PreviewWardrobe = {
  board?: string;
  frame?: string;
};

const STORAGE_KEY = 'autochess.previewWardrobe.v1';
const CHANGE_EVENT = 'autochess-preview-wardrobe';
const EMPTY_WARDROBE: PreviewWardrobe = {};

let cachedRaw: string | null | undefined;
let cachedSnapshot: PreviewWardrobe = EMPTY_WARDROBE;

function sanitize(parsed: unknown): PreviewWardrobe {
  if (!parsed || typeof parsed !== 'object') return EMPTY_WARDROBE;
  const record = parsed as Record<string, unknown>;
  const board = typeof record.board === 'string' && record.board ? record.board : undefined;
  const frame = typeof record.frame === 'string' && record.frame ? record.frame : undefined;
  if (!board && !frame) return EMPTY_WARDROBE;
  return { ...(board ? { board } : {}), ...(frame ? { frame } : {}) };
}

/** Read visitor cosmetic trial choices from localStorage with SSR-safe stable snapshots. */
export function readPreviewWardrobe(): PreviewWardrobe {
  if (typeof window === 'undefined') return EMPTY_WARDROBE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_WARDROBE;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = EMPTY_WARDROBE;
    return cachedSnapshot;
  }
  try {
    cachedSnapshot = sanitize(JSON.parse(raw));
  } catch {
    cachedSnapshot = EMPTY_WARDROBE;
  }
  return cachedSnapshot;
}

/** Merge trial wardrobe overrides and notify active listeners in Lobby and Room. */
export function writePreviewWardrobe(patch: Partial<PreviewWardrobe>): void {
  if (typeof window === 'undefined') return;
  const current = readPreviewWardrobe();
  const nextBoard = 'board' in patch ? patch.board : current.board;
  const nextFrame = 'frame' in patch ? patch.frame : current.frame;
  const next: PreviewWardrobe = {
    ...(nextBoard ? { board: nextBoard } : {}),
    ...(nextFrame ? { frame: nextFrame } : {}),
  };
  const encoded = next.board || next.frame ? JSON.stringify(next) : '';
  cachedRaw = encoded || null;
  cachedSnapshot = next.board || next.frame ? next : EMPTY_WARDROBE;
  try {
    if (encoded) window.localStorage.setItem(STORAGE_KEY, encoded);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Keep in-memory snapshot active when browser storage is restricted.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Reset all visitor trial overrides back to account/native defaults. */
export function clearPreviewWardrobe(): void {
  writePreviewWardrobe({ board: undefined, frame: undefined });
}

export function subscribePreviewWardrobe(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePreviewWardrobe(): PreviewWardrobe {
  return useSyncExternalStore(
    subscribePreviewWardrobe,
    readPreviewWardrobe,
    () => EMPTY_WARDROBE,
  );
}

/** Resolve active board skin ID honoring preview trial overrides only when sandbox is enabled. */
export function resolveEffectiveBoardSkin(options: {
  sandbox?: boolean;
  previewBoard?: string;
  seatSkinId?: string;
}): string | undefined {
  if (!options.sandbox) return options.seatSkinId;
  if (options.previewBoard === NATIVE_BOARD_SKIN) return undefined;
  return options.previewBoard || options.seatSkinId;
}

/** Resolve active frame ID honoring preview trial overrides only when sandbox is enabled. */
export function resolveEffectiveFrame(options: {
  sandbox?: boolean;
  previewFrame?: string;
  seatFrame?: string;
}): string | undefined {
  if (!options.sandbox) return options.seatFrame;
  return options.previewFrame || options.seatFrame;
}
