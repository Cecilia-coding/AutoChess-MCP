import { aiPixelAppearance } from "./ai/presentation/appearance";
import { aiSoundPack } from "./ai/presentation/sound";
import { jianghuPixelAppearance } from "./jianghu/presentation/appearance";
import { jianghuSoundPack } from "./jianghu/presentation/sound";
import type { PixelAppearance, SoundPack } from "../lib/presentation/types";

/** One registration point for optional appearance & audio packages. No battle rules live here. */
export const pixelAppearances: readonly PixelAppearance[] = [aiPixelAppearance, jianghuPixelAppearance];
export const soundPacks: readonly SoundPack[] = [aiSoundPack, jianghuSoundPack];
export function soundPack(id?: string): SoundPack {
  return soundPacks.find((pack) => pack.id === id) ?? aiSoundPack;
}
export function pixelAppearance(id?: string) {
  return pixelAppearances.find((pack) => pack.id === id);
}
export function pixelPortrait(id: string) {
  for (const pack of pixelAppearances) {
    const unit = pack.manifest.units.find((unit) => unit.id === id);
    if (unit) {
      const q = pack.assetVersion ? `?v=${pack.assetVersion}` : "";
      return pack.publicPath + unit.portrait + q;
    }
  }
}
