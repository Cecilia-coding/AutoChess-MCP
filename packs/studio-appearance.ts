import aiManifest from "../assets/pixel-mascots/manifest.json";
import jianghuManifest from "../assets/pixel-jianghu/manifest.json";
import studioManifest from "../assets/pixel-studio/manifest.json";
import type { BattleOutput } from "../lib/autochess/types";
import type { EffectCue, PixelAppearance, PixelEffectAdapter } from "../lib/presentation/types";
import { resolveUnitSpriteId } from "./ephemeral-registry";
import { aiPixelAppearance } from "./ai/presentation/appearance";
import { jianghuPixelAppearance } from "./jianghu/presentation/appearance";

const STUDIO_ORIGINALS_VERSION = "20261118r1";

function makeAssetPrefix(publicPath: string, assetVersion?: string): (path: string) => string {
  const ver = assetVersion ? `?v=${assetVersion}` : "";
  return (path: string) => (path.startsWith("/") ? path : `${publicPath}${path}${ver}`);
}

const stPrefix = makeAssetPrefix("/pixel-studio/", STUDIO_ORIGINALS_VERSION);
const aiPrefix = makeAssetPrefix(aiPixelAppearance.publicPath, aiPixelAppearance.assetVersion);
const jhPrefix = makeAssetPrefix(jianghuPixelAppearance.publicPath, jianghuPixelAppearance.assetVersion);

const aiUnitIds = new Set(aiManifest.units.map((unit) => unit.id));
const jhUnitIds = new Set(jianghuManifest.units.map((unit) => unit.id));
const studioEffectProxyById = new Map(
  studioManifest.units.map((unit) => [unit.id, unit.effectKind] as const),
);

const EFFECT_PROXY_TO_JH: Record<string, string> = {
  shield_guard: "jh-escort",
  melee_slash: "jh-hauler",
  ranged_bolt: "jh-storeman",
  arcane_orb: "jh-boatgirl",
  holy_heal: "jh-clerk",
};

function mapUnits(
  units: readonly { id: string; name: string; atlas: string; portrait: string; color: string }[],
  prefix: (path: string) => string,
) {
  return units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    atlas: prefix(unit.atlas),
    portrait: prefix(unit.portrait),
    color: unit.color,
  }));
}

export const studioOriginalsAppearance: PixelAppearance = {
  id: "studio-originals",
  source: "assets/pixel-studio",
  publicPath: "/pixel-studio/",
  assetVersion: STUDIO_ORIGINALS_VERSION,
  manifest: studioManifest,
  bodyScale: 3,
  boardColors: aiPixelAppearance.boardColors,
  boardDecor: aiPixelAppearance.boardDecor,
  async runtimeFiles() {
    return [
      "manifest.json",
      ...studioManifest.units.flatMap((unit) => [unit.atlas, unit.portrait]),
    ];
  },
  loadEffects: () => import("./jianghu/presentation/effects").then((m) => m.jianghuPixelEffects),
};

const studioUnits = [
  ...mapUnits(studioManifest.units, stPrefix),
  ...mapUnits(aiManifest.units, aiPrefix),
  ...mapUnits(jianghuManifest.units, jhPrefix),
];

function prefixCue(cue: EffectCue, prefixFn: (file: string) => string): EffectCue {
  return { ...cue, file: prefixFn(cue.file) };
}

export const studioPixelAppearance: PixelAppearance = {
  id: "studio-pixels",
  source: "packs/studio-appearance",
  publicPath: "/",
  manifest: {
    frame: studioManifest.frame,
    clips: studioManifest.clips,
    units: studioUnits,
  },
  bodyScale: 3,
  boardColors: aiPixelAppearance.boardColors,
  boardDecor: aiPixelAppearance.boardDecor,
  shield: {
    file: aiPrefix(aiManifest.effects.bubble.file),
    width: 64,
    height: 64,
    anchor: aiManifest.effects.bubble.anchor,
  },
  async runtimeFiles() {
    // Reuses assets copied by studio-originals, ai-mascots, and jianghu-pixels.
    return [];
  },
  async loadEffects(): Promise<PixelEffectAdapter> {
    const [aiEffects, jhEffects] = await Promise.all([
      aiPixelAppearance.loadEffects(),
      jianghuPixelAppearance.loadEffects(),
    ]);
    return {
      compile(battle: BattleOutput): EffectCue[] {
        const resolvedByUnit = new Map<string, string>();
        const normalizedUnits = battle.units.map((unit) => {
          const spriteId = resolveUnitSpriteId(unit.templateId);
          resolvedByUnit.set(unit.id, spriteId);
          const effectKind = studioEffectProxyById.get(spriteId);
          const mappedTemplate = effectKind
            ? (EFFECT_PROXY_TO_JH[effectKind] ?? "jh-hauler")
            : spriteId;
          return mappedTemplate === unit.templateId ? unit : { ...unit, templateId: mappedTemplate };
        });

        const unitFamilyById = new Map<string, "ai" | "jh">();
        for (const unit of normalizedUnits) {
          if (aiUnitIds.has(unit.templateId)) unitFamilyById.set(unit.id, "ai");
          else if (jhUnitIds.has(unit.templateId)) unitFamilyById.set(unit.id, "jh");
        }

        const aiOnlyUnits = normalizedUnits.filter((unit) => unitFamilyById.get(unit.id) === "ai");
        const jhOnlyUnits = normalizedUnits.filter((unit) => unitFamilyById.get(unit.id) === "jh");

        const normalizedEvents = battle.events.map((ev) => {
          const srcSprite = ev.sourceId ? resolvedByUnit.get(ev.sourceId) : undefined;
          const visuals = ev.visuals?.map((v) => ({
            ...v,
            appearanceId: resolveUnitSpriteId(v.appearanceId),
          }));
          const skillId =
            ev.type === "damage" && srcSprite && aiUnitIds.has(srcSprite)
              ? srcSprite
              : ev.skillId;
          return {
            ...ev,
            ...(skillId !== ev.skillId ? { skillId } : {}),
            ...(visuals ? { visuals } : {}),
          };
        });

        const aiEvents = normalizedEvents.filter((ev) => {
          if (ev.type === "attack" || ev.type === "cast") {
            return ev.sourceId ? unitFamilyById.get(ev.sourceId) === "ai" : false;
          }
          if (ev.type === "damage" && ev.skillId && aiUnitIds.has(ev.skillId)) return true;
          const targetId = ev.targetIds?.[0] ?? ev.sourceId;
          return targetId ? unitFamilyById.get(targetId) === "ai" : false;
        });

        const jhEvents = normalizedEvents.filter((ev) => {
          if (ev.type === "attack" || ev.type === "cast") {
            return ev.sourceId ? unitFamilyById.get(ev.sourceId) === "jh" : false;
          }
          const targetId = ev.targetIds?.[0] ?? ev.sourceId;
          return targetId ? unitFamilyById.get(targetId) === "jh" : false;
        });

        const cues: EffectCue[] = [
          ...aiEffects
            .compile({ ...battle, units: aiOnlyUnits, events: aiEvents })
            .map((cue) => prefixCue(cue, aiPrefix)),
          ...jhEffects
            .compile({ ...battle, units: jhOnlyUnits, events: jhEvents })
            .map((cue) => prefixCue(cue, jhPrefix)),
        ];
        return cues.sort((a, b) => a.start - b.start);
      },
    };
  },
};
