import { copyFile, mkdir } from "node:fs/promises";
import { pixelAppearances } from "../packs/presentation";

// Registered packages own their source paths and runtime inventories.
const root = new URL("../", import.meta.url);
for (const appearance of pixelAppearances) {
  const source = new URL(`${appearance.source}/`, root);
  const target = new URL(`public${appearance.publicPath}`, root);
  const files = [...new Set(await appearance.runtimeFiles())];
  for (const file of files) {
    const destination = new URL(file, target);
    await mkdir(new URL(".", destination), { recursive: true });
    await copyFile(new URL(file, source), destination);
    if (file.endsWith(".json")) {
      const serverMetadata = new URL(
        `.generated/presentation-source/${appearance.source}/${file}`,
        root,
      );
      await mkdir(new URL(".", serverMetadata), { recursive: true });
      await copyFile(new URL(file, source), serverMetadata);
    }
  }
  console.log(`Prepared ${appearance.id}: ${files.length} runtime assets.`);
}
