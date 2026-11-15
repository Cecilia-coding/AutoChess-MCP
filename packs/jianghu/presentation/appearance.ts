import manifest from "../../../assets/pixel-jianghu/manifest.json";
import type { PixelAppearance } from "../../../lib/presentation/types";

export { manifest as jianghuPixelManifest };

export const jianghuPixelAppearance: PixelAppearance = {
  id: "jianghu-pixels",
  source: "assets/pixel-jianghu",
  publicPath: "/pixel-jianghu/",
  assetVersion: "20261114r1",
  manifest,
  bodyScale: 3,
  boardColors: {
    background: "#e8e2d8",
    panel: "#f5f0e7",
    own: ["#c4d6cd", "#d1e0d8"],
    enemy: ["#dec7cc", "#e7d5d9"],
    bench: "#eae3d8",
    trim: "#9c8d7d",
    text: "#332a38",
  },
  boardTheme: {
    plinthShadow: "#3d334029",
    plinthDark: "#4e4552",
    plinthLight: "#827485",
    plinthJoint: "#5c505e",
    frameDark: "#544957",
    frameInnerLine: "#d6ccb8",
    bevelLight: "#fbf7ef",
    gridRim: "#695d6e",
    gridInnerBevel: "#ddd4c6",
    ownRim: "#6a9487",
    enemyRim: "#a66e7b",
    ownPlaque: ["#2d594e", "#6d9689", "#e5f0ec"],
    enemyPlaque: ["#753d4b", "#ab7784", "#f5e8eb"],
    midBar: "#5c4f61",
    midSegments: ["#d9b266", "#f7ecd2"],
    midClasp: ["#5c4f61", "#ebd08f", "#a6546c"],
    benchRim: "#786c7c",
    benchAccents: ["#89b0a3", "#c996a4"],
    benchBar: "#8e8191",
    shadow: "#382e3b",
  },
  boardDecor: {
    moteKind: "fireflies",
    moteColors: ["#ffe49e", "#9fe0c5", "#f2b895"],
    cornerMotif: "jianghu",
  },
  shield: {
    file: manifest.effects.ward.file,
    width: manifest.effects.ward.width,
    height: manifest.effects.ward.height,
    anchor: manifest.effects.ward.anchor,
  },
  async runtimeFiles() {
    const { default: fx } = await import("../../../assets/pixel-jianghu/effects/manifest.json");
    const { default: events } =
      await import("../../../assets/pixel-jianghu/effects/events/manifest.json");
    return [
      "manifest.json",
      "effects/manifest.json",
      "effects/events/manifest.json",
      ...manifest.units.flatMap((unit) => [unit.atlas, unit.portrait]),
      manifest.effects.ward.file,
      ...fx.units.flatMap((unit) => [unit.file, unit.attackFile, unit.symbolsFile]),
      ...events.events.map((ev) => ev.file),
    ];
  },
  loadEffects: () => import("./effects").then((module) => module.jianghuPixelEffects),
};
