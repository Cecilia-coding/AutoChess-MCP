'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { assetUrl, configureAssetBase } from '../../lib/meta/asset-url';
import {
  DEFAULT_HOST_CONFIG,
  resolveHostConfig,
  type AutochessHostConfig,
  type PartialAutochessHostConfig,
} from '../../lib/meta/host-config';
import {
  accountRequest as defaultAccountRequest,
  metaRequest as defaultMetaRequest,
  roomRequest as defaultRoomRequest,
} from './room-request';

const HostContext = createContext<AutochessHostConfig>(DEFAULT_HOST_CONFIG);

/**
 * Provides route, asset base, feature flags, and optional custom transports
 * to all AutoChess UI components so host platforms never need to patch internals.
 */
export function AutochessHostProvider({
  config,
  children,
}: {
  config?: PartialAutochessHostConfig;
  children: ReactNode;
}) {
  const resolved = useMemo(() => resolveHostConfig(config), [config]);

  useEffect(() => {
    if (config?.assetBase !== undefined) configureAssetBase(resolved.assetBase);
  }, [config?.assetBase, resolved.assetBase]);

  return <HostContext.Provider value={resolved}>{children}</HostContext.Provider>;
}

export function useAutochessHost(): AutochessHostConfig {
  return useContext(HostContext);
}

/** Resolve a static asset path honoring the host's configured `assetBase`. */
export function useAssetUrl(path: string): string {
  const { assetBase } = useAutochessHost();
  return assetBase ? assetUrl(path, assetBase) : assetUrl(path);
}

/** Request dispatchers using host transport overrides or configured API routes. */
export function useHostRequests() {
  const host = useAutochessHost();
  return useMemo(
    () => ({
      roomRequest: <T = unknown,>(op: string, args: object = {}): Promise<T> =>
        host.transport.roomRequest
          ? host.transport.roomRequest<T>(op, args)
          : defaultRoomRequest<T>(op, args, host.routes.roomApi),
      accountRequest: <T = unknown,>(op: string, args: object = {}): Promise<T> =>
        host.transport.accountRequest
          ? host.transport.accountRequest<T>(op, args)
          : defaultAccountRequest<T>(op, args, host.routes.accountApi),
      metaRequest: <T = unknown,>(op: string, args: object = {}): Promise<T> =>
        host.transport.metaRequest
          ? host.transport.metaRequest<T>(op, args)
          : defaultMetaRequest<T>(op, args, host.routes.metaApi),
      navigate: (target: 'lobby' | 'room' | 'arcade', params?: Record<string, string>) => {
        if (host.transport.navigate) {
          host.transport.navigate(target, params);
          return;
        }
        const base =
          target === 'arcade'
            ? host.routes.arcade
            : target === 'lobby'
              ? host.routes.lobby
              : host.routes.room;
        const url = new URL(base, window.location.origin);
        if (params) {
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        }
        window.location.assign(url.pathname + url.search + url.hash);
      },
    }),
    [host],
  );
}
