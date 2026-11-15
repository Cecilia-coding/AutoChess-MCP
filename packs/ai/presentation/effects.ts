import fx from "../../../assets/pixel-mascots/effects/manifest.json";
import events from "../../../assets/pixel-mascots/effects/events/manifest.json";
import type { EffectCue, PixelEffectAdapter } from "../../../lib/presentation/types";

const themes = new Map(fx.units.map((unit) => [unit.id, unit]));
const overlays = new Map(events.units.map((unit) => [unit.id, unit]));

/** Pack-specific translation of authoritative battle events into disposable visual cues. */
export const aiPixelEffects: PixelEffectAdapter = {
  compile(battle) {
    const cues: EffectCue[] = [];
    const looks = new Map(battle.units.map((unit) => [unit.id, unit.templateId]));
    const shields = new Map<string, { amount: number; until: number }>();
    const expiry = new Map<string, EffectCue>();
    const overlay = (id: string, key: string, start: number, look = looks.get(id)) => {
      const unit = look ? overlays.get(look) : undefined;
      const clip = unit?.clips.find((clip) => clip.key === key);
      if (!unit || !clip) return;
      const cue: EffectCue = {
        file: unit.file,
        unitId: id,
        start,
        duration: clip.durationMs,
        frames: clip.frames,
        anchor: events.frame.anchor,
        scale: 1.42,
      };
      cues.push(cue);
      return cue;
    };
    const symbolCue = (
      targetId: string,
      symbolKey: keyof typeof fx.symbols,
      start: number,
      look = looks.get(targetId),
      duration = 680,
    ) => {
      const unit = look ? themes.get(look) : undefined;
      const sym = fx.symbols[symbolKey];
      if (!unit || !sym) return;
      cues.push({
        file: unit.symbolsFile,
        unitId: targetId,
        start,
        duration,
        frames: [sym],
        anchor: sym.anchor,
        scale: 1.35,
      });
    };
    const phase = (
      id: string,
      key: "charge" | "flight" | "impact" | "aura",
      start: number,
      duration: number,
      attack: boolean,
      target = id,
      look = looks.get(id),
    ) => {
      const unit = look ? themes.get(look) : undefined;
      if (!unit || duration <= 0) return;
      const phases = fx.phases;
      cues.push({
        file: attack && key !== "aura" ? unit.attackFile : unit.file,
        unitId: target,
        fromId: key === "flight" ? id : undefined,
        rotate: key === "flight",
        start,
        duration,
        frames: phases[key].frames,
        anchor: fx.frame.anchor,
        scale: attack ? 1.48 : key === "aura" ? 1.6 : 1.82,
      });
    };
    for (const event of battle.events) {
      for (const [id, cue] of expiry)
        if (cue.start <= event.timeMs) {
          cues.push(cue);
          expiry.delete(id);
        }
      for (const state of event.visuals ?? []) {
        const previous = looks.get(state.id);
        if (previous !== state.appearanceId) {
          if (state.appearanceId === "ai-codex")
            overlay(state.id, "gpt_codex", event.timeMs, "ai-codex");
          else if (previous === "ai-doubao")
            overlay(state.id, "doubao_restore", event.timeMs, "ai-doubao");
        }
        looks.set(state.id, state.appearanceId);
        const shield = shields.get(state.id);
        if (shield?.amount && !state.shield && event.timeMs < shield.until)
          overlay(state.id, "shield_break", event.timeMs);
        if (state.shield > 0 && state.shieldUntil > event.timeMs) {
          const unit = overlays.get(state.appearanceId),
            clip = unit?.clips.find((clip) => clip.key === "shield_expire");
          if (unit && clip)
            expiry.set(state.id, {
              file: unit.file,
              unitId: state.id,
              start: state.shieldUntil,
              duration: clip.durationMs,
              frames: clip.frames,
              anchor: events.frame.anchor,
              scale: 1.42,
            });
        } else expiry.delete(state.id);
        shields.set(state.id, { amount: state.shield, until: state.shieldUntil });
      }
      if (event.sourceId && event.type === "attack") {
        const timing = fx.timings.attack;
        phase(event.sourceId, "charge", event.timeMs - timing.impactMs, timing.launchMs, true);
        for (const target of event.targetIds ?? []) {
          phase(
            event.sourceId,
            "flight",
            event.timeMs - (timing.impactMs - timing.launchMs),
            timing.impactMs - timing.launchMs,
            true,
            target,
          );
          phase(
            event.sourceId,
            "impact",
            event.timeMs,
            timing.endMs - timing.impactMs,
            true,
            target,
          );
        }
      }
      // Target effects require actual heal/damage/shield events, not a cast's provisional target.
      if (event.type === "cast" && event.sourceId) {
        phase(event.sourceId, "charge", event.timeMs, 320, false);
        phase(event.sourceId, "aura", event.timeMs + 80, 520, false);
        if (looks.get(event.sourceId) === "ai-claude") {
          symbolCue(event.sourceId, "card", event.timeMs, "ai-claude", 720);
        }
      }
      if (event.type === "death" && event.sourceId) overlay(event.sourceId, "death", event.timeMs);
      if (event.type === "spawn" && event.sourceId) overlay(event.sourceId, "revive", event.timeMs);
      const sourceLook = event.sourceId ? looks.get(event.sourceId) : undefined;
      for (const target of event.targetIds ?? []) {
        if (event.type === "damage" && (event.value ?? 0) > 0)
          overlay(target, "hurt", event.timeMs);
        if (event.type === "damage" && event.sourceId && event.skillId && themes.has(event.skillId)) {
          if (target !== event.sourceId) {
            const flyStart = Math.max(0, event.timeMs - 210);
            const flyDur = Math.max(80, event.timeMs - flyStart);
            phase(event.sourceId, "flight", flyStart, flyDur, false, target, event.skillId);
          }
          phase(event.sourceId, "impact", event.timeMs, 540, false, target, event.skillId);
          if (event.skillId === "ai-tripo") symbolCue(target, "cube", event.timeMs, "ai-tripo");
          if (event.skillId === "ai-ernie" || event.skillId === "ai-characterai")
            symbolCue(target, "page", event.timeMs, event.skillId);
        }
        if (event.type === "heal") overlay(target, "heal", event.timeMs);
        if (event.type === "shield") overlay(target, "shield_gain", event.timeMs);
        if (event.text) {
          if (/眩晕/.test(event.text)) overlay(target, "stun", event.timeMs);
          else if (/沉默/.test(event.text)) overlay(target, "silence", event.timeMs);
          else if (/破防|破甲|护甲降低/.test(event.text))
            symbolCue(target, "armor", event.timeMs, sourceLook ?? looks.get(target));
          else if (/减速/.test(event.text))
            symbolCue(target, "slow", event.timeMs, sourceLook ?? looks.get(target));
          else if (/缴械/.test(event.text))
            symbolCue(target, "disarm", event.timeMs, sourceLook ?? looks.get(target));
          else if (event.type !== "damage" && /攻速/.test(event.text))
            symbolCue(target, "speed", event.timeMs, sourceLook ?? looks.get(target));
          else if (event.type !== "damage" && /射程/.test(event.text))
            symbolCue(target, "range", event.timeMs, sourceLook ?? looks.get(target));
          else if (event.type !== "damage" && /攻击/.test(event.text))
            symbolCue(target, "attack", event.timeMs, sourceLook ?? looks.get(target));
        }
        if (
          sourceLook === "ai-musespark" &&
          event.type === "trait" &&
          (event.value ?? 0) > 0 &&
          /回复.*内力/.test(event.text)
        ) {
          symbolCue(target, "page", event.timeMs, "ai-musespark", 650);
        }
      }
      if (event.type === "regen" && event.sourceId) overlay(event.sourceId, "heal", event.timeMs);
    }
    cues.push(...expiry.values());
    return cues.sort((a, b) => a.start - b.start);
  },
};
