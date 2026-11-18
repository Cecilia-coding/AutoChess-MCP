import { aiPixelAppearance } from "./ai/presentation/appearance";
import { aiSoundPack } from "./ai/presentation/sound";
import { resolveUnitSpriteId } from "./ephemeral-registry";
import { jianghuPixelAppearance } from "./jianghu/presentation/appearance";
import { jianghuSoundPack } from "./jianghu/presentation/sound";
import { studioOriginalsAppearance, studioPixelAppearance } from "./studio-appearance";
import type { PixelAppearance, SoundPack } from "../lib/presentation/types";
import { assetUrl } from "../lib/meta/asset-url";

/** One registration point for optional appearance & audio packages. No battle rules live here. */
export const pixelAppearances: readonly PixelAppearance[] = [
  studioOriginalsAppearance,
  aiPixelAppearance,
  jianghuPixelAppearance,
  studioPixelAppearance,
];
export const soundPacks: readonly SoundPack[] = [aiSoundPack, jianghuSoundPack];
export function soundPack(id?: string): SoundPack {
  return soundPacks.find((pack) => pack.id === id) ?? aiSoundPack;
}
export function pixelAppearance(id?: string) {
  return pixelAppearances.find((pack) => pack.id === id);
}
export function pixelPortrait(id: string) {
  const lookupId = resolveUnitSpriteId(id);
  for (const pack of pixelAppearances) {
    const unit = pack.manifest.units.find((unit) => unit.id === lookupId);
    if (unit) {
      if (unit.portrait.startsWith("/")) return assetUrl(unit.portrait);
      const q = pack.assetVersion ? `?v=${pack.assetVersion}` : "";
      return assetUrl(pack.publicPath + unit.portrait + q);
    }
  }
}
