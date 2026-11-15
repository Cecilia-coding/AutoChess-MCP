import manifest from "../../../assets/pixel-mascots/manifest.json";
import type { PixelAppearance } from "../../../lib/presentation/types";

export { manifest as pixelManifest };
export const aiPixelAppearance: PixelAppearance = {
  id: "ai-mascots",
  source: "assets/pixel-mascots",
  publicPath: "/pixel-mascots/",
  assetVersion: "20261111r3",
  manifest,
  bodyScale: 3,
  boardColors: {
    background: "#e5e0f0",
    panel: "#f7f4fb",
    own: ["#bde0d5", "#cde8df"],
    enemy: ["#e9cad5", "#f2d8e0"],
    bench: "#eae3f4",
    trim: "#b6a5cb",
    text: "#4a3e5c",
  },
  boardDecor: {
    moteKind: "stars",
    moteColors: ["#7be0ff", "#fff0a8", "#c6b0ef"],
    cornerMotif: "ai",
  },
  shield: {
    file: manifest.effects.bubble.file,
    width: 64,
    height: 64,
    anchor: manifest.effects.bubble.anchor,
  },
  async runtimeFiles() {
    const { default: fx } = await import("../../../assets/pixel-mascots/effects/manifest.json");
    const { default: events } =
      await import("../../../assets/pixel-mascots/effects/events/manifest.json");
    return [
      "manifest.json",
      "effects/manifest.json",
      "effects/events/manifest.json",
      ...manifest.units.flatMap((unit) => [unit.atlas, unit.portrait]),
      manifest.effects.bubble.file,
      ...fx.units.flatMap((unit) => [unit.file, unit.attackFile, unit.symbolsFile]),
      ...events.units.map((unit) => unit.file),
    ];
  },
  loadEffects: () => import("./effects").then((module) => module.aiPixelEffects),
};
