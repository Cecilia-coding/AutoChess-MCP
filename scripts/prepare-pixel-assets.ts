import { copyFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { pixelAppearances } from '../packs/presentation';

export type PreparedAssetSummary = {
  id: string;
  count: number;
};

/**
 * Copy pack-declared pixel sprite atlases, manifests, and effects into `public/`
 * and `.generated/` from a single source list owned by each pack appearance.
 */
export async function preparePixelAssets(
  rootDir: URL | string = new URL('../', import.meta.url),
  options: { quiet?: boolean } = {},
): Promise<PreparedAssetSummary[]> {
  const root = typeof rootDir === 'string' ? pathToFileURL(rootDir.endsWith('/') || rootDir.endsWith('\\') ? rootDir : `${rootDir}/`) : rootDir;
  const summaries: PreparedAssetSummary[] = [];
  for (const appearance of pixelAppearances) {
    const files = [...new Set(await appearance.runtimeFiles())];
    if (!files.length) continue;
    const source = new URL(`${appearance.source}/`, root);
    const target = new URL(`public${appearance.publicPath}`, root);
    for (const file of files) {
      const destination = new URL(file, target);
      await mkdir(new URL('.', destination), { recursive: true });
      await copyFile(new URL(file, source), destination);
      if (file.endsWith('.json')) {
        const serverMetadata = new URL(
          `.generated/presentation-source/${appearance.source}/${file}`,
          root,
        );
        await mkdir(new URL('.', serverMetadata), { recursive: true });
        await copyFile(new URL(file, source), serverMetadata);
      }
    }
    summaries.push({ id: appearance.id, count: files.length });
    if (!options.quiet) console.log(`Prepared ${appearance.id}: ${files.length} runtime assets.`);
  }
  return summaries;
}

const isEntrypoint =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  await preparePixelAssets();
}
