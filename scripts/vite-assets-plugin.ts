import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { preparePixelAssets } from './prepare-pixel-assets';

/**
 * Ensure pixel assets exist in `public/` and `.generated/` whenever Vite runs,
 * even when an external platform invokes `vite build` without npm lifecycle scripts.
 */
export function autochessAssetsPlugin(options: { rootDir?: string; quiet?: boolean } = {}): Plugin {
  let prepared = false;
  const runOnce = async (root: string) => {
    if (prepared) return;
    prepared = true;
    await preparePixelAssets(options.rootDir ?? resolve(root), { quiet: options.quiet ?? true });
  };

  return {
    name: 'autochess-prepare-pixel-assets',
    async buildStart() {
      await runOnce(process.cwd());
    },
    async configureServer(server) {
      await runOnce(server.config.root);
    },
  };
}
