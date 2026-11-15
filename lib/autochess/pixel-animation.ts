import type { SpriteClip } from "../presentation/types";
import type { UnitFrame } from "./frame";

/** Stable per-unit phase so a full board does not bob in lockstep. */
export function loopPhase(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % 1000;
}

/** Sampling is a pure function of replay time: seeking never leaves stale poses. */
export function pixelPose(
  clips: Record<string, SpriteClip>,
  unit: UnitFrame,
  timeMs: number,
  moving: boolean,
  reducedMotion = false,
  loopOffset = 0,
) {
  const age = (at?: number) => (at === undefined ? Infinity : timeMs - at);
  const hp = unit.hp / Math.max(1, unit.maxHp);
  const mood =
    age(unit.shockAt) < 650 ? "shock" : hp > 0.5 ? "happy" : hp > 0.2 ? "serious" : "cry";
  const action =
    age(unit.hitAt) < 240 ? "hurt" : age(unit.attackAt) < 850 ? "attack" : moving ? "walk" : "idle";
  const key = unit.alive ? `${mood}/${action}` : "dead";
  const clip = clips[key] ?? clips["happy/idle"]!;
  const elapsed = !unit.alive
    ? age(unit.deathAt)
    : action === "hurt"
      ? age(unit.hitAt)
      : action === "attack"
        ? age(unit.attackAt)
        : timeMs + loopOffset;
  const duration = clip.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  let remaining = reducedMotion
    ? 0
    : clip.loop
      ? elapsed % duration
      : Math.min(elapsed, duration - 1);
  for (const frame of clip.frames) {
    if (remaining < frame.durationMs) return { key, frame };
    remaining -= frame.durationMs;
  }
  return { key, frame: clip.frames.at(-1)! };
}
