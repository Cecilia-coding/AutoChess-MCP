import fxManifest from "../../../assets/pixel-jianghu/effects/manifest.json";
import eventsManifest from "../../../assets/pixel-jianghu/effects/events/manifest.json";
import type { BattleOutput } from "../../../lib/autochess/types";
import type { EffectCue, PixelEffectAdapter } from "../../../lib/presentation/types";

const fxByUnit = new Map(fxManifest.units.map((u) => [u.id, u]));
const eventFileByKey = new Map(eventsManifest.events.map((e) => [e.key, e.file]));

export const jianghuPixelEffects: PixelEffectAdapter = {
  compile(battle: BattleOutput): EffectCue[] {
    const templateByUnitId = new Map(battle.units.map((u) => [u.id, u.templateId]));
    const cues: EffectCue[] = [];
    const fxAnchor = fxManifest.frame.anchor;
    const fxFrames = fxManifest.frames;
    const evAnchor = eventsManifest.frame.anchor;
    const evFrames = eventsManifest.frames;

    for (const ev of battle.events) {
      const sourceTemplate = ev.sourceId ? templateByUnitId.get(ev.sourceId) : undefined;
      const fx = sourceTemplate ? fxByUnit.get(sourceTemplate) : undefined;
      const targets = ev.targetIds?.length ? ev.targetIds : ev.sourceId ? [ev.sourceId] : [];

      if (ev.type === "spawn" && ev.sourceId && !ev.sourceId.startsWith("reserve-")) {
        const file = eventFileByKey.get("spawn");
        if (file) {
          cues.push({
            file,
            unitId: ev.sourceId,
            start: ev.timeMs,
            duration: 420,
            frames: evFrames,
            anchor: evAnchor,
            scale: 1.0,
          });
        }
        continue;
      }

      if (ev.type === "attack" && ev.sourceId && fx) {
        for (const targetId of targets) {
          cues.push({
            file: fx.attackFile,
            unitId: targetId,
            fromId: fx.ranged ? ev.sourceId : undefined,
            rotate: fx.rotate,
            start: ev.timeMs + (fx.ranged ? 40 : 120),
            duration: fx.ranged ? 340 : 280,
            frames: fxFrames,
            anchor: fxAnchor,
            scale: fx.ranged ? 1.15 : 1.32,
          });
        }
        continue;
      }

      if (ev.type === "cast" && ev.sourceId && fx) {
        cues.push({
          file: fx.file,
          unitId: ev.sourceId,
          start: ev.timeMs,
          duration: 500,
          frames: fxFrames,
          anchor: fxAnchor,
          scale: 1.42,
        });
        cues.push({
          file: fx.symbolsFile,
          unitId: ev.sourceId,
          start: ev.timeMs,
          duration: 420,
          frames: fxFrames,
          anchor: fxAnchor,
          scale: 1.1,
        });
        for (const targetId of targets) {
          if (targetId === ev.sourceId) continue;
          cues.push({
            file: fx.file,
            unitId: targetId,
            fromId: fx.ranged ? ev.sourceId : undefined,
            rotate: fx.ranged ? fx.rotate : false,
            start: ev.timeMs + (fx.ranged ? 120 : 80),
            duration: 420,
            frames: fxFrames,
            anchor: fxAnchor,
            scale: 1.25,
          });
        }
        continue;
      }

      if (ev.type === "damage") {
        const file = eventFileByKey.get("hurt");
        if (file) {
          for (const targetId of targets) {
            cues.push({
              file,
              unitId: targetId,
              start: ev.timeMs,
              duration: 300,
              frames: evFrames,
              anchor: evAnchor,
              scale: 0.92,
            });
          }
        }
        continue;
      }

      if (ev.type === "heal" || ev.type === "regen") {
        const file = eventFileByKey.get("heal");
        if (file) {
          for (const targetId of targets) {
            cues.push({
              file,
              unitId: targetId,
              start: ev.timeMs,
              duration: 420,
              frames: evFrames,
              anchor: evAnchor,
              scale: 1.0,
            });
          }
        }
        continue;
      }

      if (ev.type === "shield") {
        const file = eventFileByKey.get("shield");
        if (file) {
          for (const targetId of targets) {
            cues.push({
              file,
              unitId: targetId,
              start: ev.timeMs,
              duration: 440,
              frames: evFrames,
              anchor: evAnchor,
              scale: 1.05,
            });
          }
        }
        continue;
      }

      if (ev.type === "death") {
        const file = eventFileByKey.get("death");
        const deadId = targets[0] ?? ev.sourceId;
        if (file && deadId) {
          cues.push({
            file,
            unitId: deadId,
            start: ev.timeMs,
            duration: 580,
            frames: evFrames,
            anchor: evAnchor,
            scale: 1.08,
          });
        }
      }
    }

    return cues.sort((a, b) => a.start - b.start);
  },
};
