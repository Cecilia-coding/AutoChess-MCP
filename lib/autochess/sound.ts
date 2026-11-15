import { soundPack } from "../../packs/presentation";
import type {
  NoiseBurstOpts,
  SfxKind,
  SfxSynthContext,
  SoundPack,
  ToneOpts,
} from "../presentation/types";
import type { BattleOutput, CombatEvent } from "./types";

export type { NoiseBurstOpts, SfxKind, SfxSynthContext, SoundPack, ToneOpts };

const STORAGE_KEY = "autochess:sfx-muted";

const COOLDOWN_MS: Record<SfxKind, number> = {
  swing: 145,
  hitLight: 130,
  hitHeavy: 130,
  hitSkill: 105,
  cast: 135,
  shield: 120,
  heal: 120,
  death: 110,
  battleStart: 300,
  roundWin: 300,
  roundLose: 300,
  roundDraw: 300,
  matchWin: 600,
  matchLose: 600,
  matchDraw: 500,
  buy: 60,
  sell: 60,
  merge: 180,
  place: 45,
  reroll: 70,
  ui: 40,
};

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let mutedState: boolean | null = null;
let unlockInstalled = false;
let activeSoundPackId: string | undefined;
const lastPlayedAt = new Map<SfxKind, number>();
const listeners = new Set<() => void>();

export function setActiveSoundPack(soundId?: string): void {
  activeSoundPackId = soundId;
}

export function getActiveSoundPackId(): string | undefined {
  return activeSoundPackId;
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

function readStoredMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isSfxMuted(): boolean {
  if (mutedState === null) mutedState = readStoredMute();
  return mutedState;
}

export function setSfxMuted(muted: boolean): void {
  mutedState = Boolean(muted);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, mutedState ? "1" : "0");
    } catch {
      /* private mode */
    }
  }
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(mutedState ? 0 : 0.48, audioCtx.currentTime, 0.015);
  }
  notifyListeners();
}

export function toggleSfxMuted(): boolean {
  const next = !isSfxMuted();
  setSfxMuted(next);
  if (!next) {
    unlockSfx();
    playSfx("ui");
  }
  return next;
}

export function subscribeSfxMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ensureContext(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, audioCtx.currentTime);
      compressor.knee.setValueAtTime(12, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.1, audioCtx.currentTime);

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(isSfxMuted() ? 0 : 0.48, audioCtx.currentTime);
      compressor.connect(masterGain);
      masterGain.connect(audioCtx.destination);
      noiseBuffer = createNoiseBuffer(audioCtx);
      // Connect synth voices to compressor -> masterGain
      (masterGain as unknown as { _entry?: DynamicsCompressorNode })._entry = compressor;
    } catch {
      return null;
    }
  }
  const entry = (masterGain as unknown as { _entry?: GainNode })?._entry ?? masterGain;
  if (!entry) return null;
  return { ctx: audioCtx, out: entry };
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.6);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function installSfxUnlock(): () => void {
  if (typeof window === "undefined" || unlockInstalled) return () => {};
  unlockInstalled = true;
  const wake = () => unlockSfx();
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("keydown", wake, { passive: true });
  return () => {
    unlockInstalled = false;
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
  };
}

export function unlockSfx(): void {
  const ready = ensureContext();
  if (!ready) return;
  if (ready.ctx.state === "suspended") {
    void ready.ctx.resume().catch(() => {});
  }
}

function jitter(base: number, pct = 0.08): number {
  return base * (1 + (Math.random() * 2 - 1) * pct);
}

function emitTone(
  ctx: AudioContext,
  out: AudioNode,
  {
    type = "triangle",
    startAt,
    duration,
    freqStart,
    freqEnd,
    gainPeak,
    attack = 0.004,
  }: ToneOpts,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freqStart), startAt);
  if (freqEnd !== undefined && freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startAt + duration);
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + Math.min(attack, duration * 0.4));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(out);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function emitNoiseBurst(
  ctx: AudioContext,
  out: AudioNode,
  {
    startAt,
    duration,
    filterType = "bandpass",
    freqStart,
    freqEnd,
    q = 1.4,
    gainPeak,
  }: NoiseBurstOpts,
) {
  if (!noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.setValueAtTime(q, startAt);
  filter.frequency.setValueAtTime(Math.max(60, freqStart), startAt);
  if (freqEnd !== undefined && freqEnd !== freqStart) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, freqEnd), startAt + duration);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + Math.min(0.004, duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(startAt, Math.random() * 0.25);
  src.stop(startAt + duration + 0.02);
}

export function playSfx(kind: SfxKind, opts?: { intensity?: number; soundId?: string }): void {
  if (isSfxMuted()) return;
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const prev = lastPlayedAt.get(kind) ?? -Infinity;
  if (nowMs - prev < COOLDOWN_MS[kind]) return;

  const ready = ensureContext();
  if (!ready) return;
  const { ctx, out } = ready;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
    if (ctx.state === "suspended") return;
  }

  lastPlayedAt.set(kind, nowMs);
  const t = ctx.currentTime + 0.004;
  const scale = Math.max(0.65, Math.min(1.25, opts?.intensity ?? 1));
  const pack = soundPack(opts?.soundId ?? activeSoundPackId);
  pack.play(kind, {
    t,
    scale,
    tone: (toneOpts) => emitTone(ctx, out, toneOpts),
    noiseBurst: (burstOpts) => emitNoiseBurst(ctx, out, burstOpts),
    jitter,
  });
}

export type BattleAudioCursor = {
  battleId: string;
  nextIndex: number;
  startPlayed: boolean;
  outcomePlayed: boolean;
  unitMaxHp: Map<string, number>;
};

export function createBattleAudioCursor(output: BattleOutput): BattleAudioCursor {
  const unitMaxHp = new Map<string, number>();
  for (const unit of output.units) {
    unitMaxHp.set(unit.id, Math.max(1, unit.maxHp));
  }
  return {
    battleId: output.battleId,
    nextIndex: 0,
    startPlayed: false,
    outcomePlayed: false,
    unitMaxHp,
  };
}

function mapEventToSfx(
  event: CombatEvent,
  unitMaxHp: Map<string, number>,
): { kind: SfxKind; intensity?: number } | null {
  switch (event.type) {
    case "attack":
      return { kind: "swing", intensity: 0.85 };
    case "cast":
      return { kind: "cast" };
    case "damage": {
      if (!event.value || event.value <= 0) return null;
      const targetId = event.targetIds?.[0];
      const maxHp = targetId ? (unitMaxHp.get(targetId) ?? 1000) : 1000;
      const ratio = event.value / maxHp;
      if (ratio >= 0.15) return { kind: "hitHeavy", intensity: Math.min(1.2, 0.9 + ratio) };
      if (event.skillId) return { kind: "hitSkill", intensity: 0.95 };
      return { kind: "hitLight", intensity: Math.min(1.1, 0.8 + ratio * 1.4) };
    }
    case "shield":
      return event.value && event.value > 0 ? { kind: "shield" } : null;
    case "heal":
      return event.value && event.value > 0 ? { kind: "heal" } : null;
    case "death":
      return { kind: "death" };
    default:
      return null;
  }
}

export function roundOutcomeSfx(outcome: "left" | "right" | "draw"): SfxKind {
  return outcome === "left" ? "roundWin" : outcome === "right" ? "roundLose" : "roundDraw";
}

export function matchOutcomeSfx(outcome: "win" | "loss" | "draw"): SfxKind {
  return outcome === "win" ? "matchWin" : outcome === "loss" ? "matchLose" : "matchDraw";
}

export function consumeBattleAudioEvents(
  output: BattleOutput,
  timeMs: number,
  cursor: BattleAudioCursor,
  trigger: (kind: SfxKind, opts?: { intensity?: number; soundId?: string }) => void = playSfx,
  opts?: { suppressOutcome?: boolean; soundId?: string },
): void {
  if (cursor.battleId !== output.battleId) {
    cursor.battleId = output.battleId;
    cursor.nextIndex = 0;
    cursor.startPlayed = false;
    cursor.outcomePlayed = false;
    cursor.unitMaxHp.clear();
    for (const unit of output.units) cursor.unitMaxHp.set(unit.id, Math.max(1, unit.maxHp));
  }

  const triggerOpts = (intensity?: number) => {
    if (opts?.soundId) {
      return intensity !== undefined ? { intensity, soundId: opts.soundId } : { soundId: opts.soundId };
    }
    return intensity !== undefined ? { intensity } : undefined;
  };

  const events = output.events;
  if (!cursor.startPlayed) {
    cursor.startPlayed = true;
    if (timeMs <= 250) trigger("battleStart", triggerOpts());
  }

  // If jumped far forward (e.g. tab backgrounded), cap burst replay to the latest 8 events.
  const pending: CombatEvent[] = [];
  while (cursor.nextIndex < events.length && events[cursor.nextIndex]!.timeMs <= timeMs) {
    pending.push(events[cursor.nextIndex]!);
    cursor.nextIndex++;
  }
  const slice = pending.length > 8 ? pending.slice(-8) : pending;
  for (const event of slice) {
    const mapped = mapEventToSfx(event, cursor.unitMaxHp);
    if (mapped) trigger(mapped.kind, triggerOpts(mapped.intensity));
  }

  if (!cursor.outcomePlayed && timeMs >= output.durationMs) {
    cursor.outcomePlayed = true;
    if (!opts?.suppressOutcome) {
      trigger(roundOutcomeSfx(output.outcome), triggerOpts());
    }
  }
}
