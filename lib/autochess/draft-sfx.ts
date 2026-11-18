/**
 * 旅途选秀真实物理骰子音效播放层（基于 Kenney CC0 桌面实体骰子采样）。
 *
 * 统一受全局 `isSfxMuted()` / `subscribeSfxMuted()` 静音状态控制，并通过
 * `assetUrl()` 兼容独立部署与 `/autochess/static/` 子路径挂载。
 */
import { assetUrl } from '../meta/asset-url';
import { isSfxMuted, subscribeSfxMuted } from './sound';

export type DraftDiceCueKey = 'shake' | 'land1' | 'land2' | 'land3';

export const DRAFT_DICE_FILES: Record<DraftDiceCueKey, string> = {
  shake: '/room-sfx/dice-shake.wav',
  land1: '/room-sfx/dice-land-1.wav',
  land2: '/room-sfx/dice-land-2.wav',
  land3: '/room-sfx/dice-land-3.wav',
};

const LAND_CUES: readonly DraftDiceCueKey[] = ['land1', 'land2', 'land3'];
const SHAKE_TO_LAND_GAP_SEC = 0.215;

let audioCtx: AudioContext | null = null;
let outGain: GainNode | null = null;
let muteSubscribed = false;
let rollSeq = 0;
let activeShakeStartTime: number | null = null;
let lastLandCue: DraftDiceCueKey | undefined;

const rawCache = new Map<DraftDiceCueKey, Promise<ArrayBuffer | null>>();
const decodedCache = new Map<DraftDiceCueKey, AudioBuffer>();
const decodeCache = new Map<DraftDiceCueKey, Promise<AudioBuffer | null>>();
const activeSources = new Set<AudioBufferSourceNode>();

export function selectDiceLandCue(
  roll?: number,
  previous?: DraftDiceCueKey,
): DraftDiceCueKey {
  const index =
    typeof roll === 'number' && Number.isInteger(roll)
      ? Math.abs(roll - 1) % LAND_CUES.length
      : 0;
  const candidate = LAND_CUES[index]!;
  if (previous && candidate === previous) {
    return LAND_CUES[(index + 1) % LAND_CUES.length]!;
  }
  return candidate;
}

function stopActiveSources(): void {
  for (const src of activeSources) {
    try {
      src.stop();
    } catch {
      /* already ended */
    }
  }
  activeSources.clear();
  activeShakeStartTime = null;
}

function syncMuteGain(): void {
  const muted = isSfxMuted();
  if (muted) stopActiveSources();
  if (!outGain || !audioCtx) return;
  outGain.gain.setTargetAtTime(muted ? 0 : 0.9, audioCtx.currentTime, 0.015);
}

function ensureAudio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!muteSubscribed) {
    muteSubscribed = true;
    subscribeSfxMuted(syncMuteGain);
  }
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
      compressor.knee.setValueAtTime(12, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(3, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.002, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.12, audioCtx.currentTime);

      outGain = audioCtx.createGain();
      outGain.gain.setValueAtTime(isSfxMuted() ? 0 : 0.9, audioCtx.currentTime);
      compressor.connect(outGain);
      outGain.connect(audioCtx.destination);
      (outGain as unknown as { _entry?: DynamicsCompressorNode })._entry = compressor;
    } catch {
      return null;
    }
  }
  const entry = (outGain as unknown as { _entry?: GainNode })?._entry ?? outGain;
  if (!entry) return null;
  return { ctx: audioCtx, out: entry };
}

function fetchRaw(key: DraftDiceCueKey): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return Promise.resolve(null);
  }
  const cached = rawCache.get(key);
  if (cached) return cached;
  const promise = fetch(assetUrl(DRAFT_DICE_FILES[key]))
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .catch(() => null);
  rawCache.set(key, promise);
  return promise;
}

function loadBuffer(ctx: AudioContext, key: DraftDiceCueKey): Promise<AudioBuffer | null> {
  const ready = decodedCache.get(key);
  if (ready) return Promise.resolve(ready);
  const inflight = decodeCache.get(key);
  if (inflight) return inflight;

  const promise = fetchRaw(key)
    .then((raw) => {
      if (!raw) return null;
      return ctx.decodeAudioData(raw.slice(0));
    })
    .then((decoded) => {
      if (decoded) decodedCache.set(key, decoded);
      else decodeCache.delete(key);
      return decoded ?? null;
    })
    .catch(() => {
      decodeCache.delete(key);
      return null;
    });
  decodeCache.set(key, promise);
  return promise;
}

/** Pre-fetch (and decode when unlocked) the dice audio clips before rolling. */
export function preloadDraftDiceAudio(): void {
  if (typeof window === 'undefined') return;
  const keys = Object.keys(DRAFT_DICE_FILES) as DraftDiceCueKey[];
  const ready = audioCtx ? ensureAudio() : null;
  for (const key of keys) {
    if (ready) {
      void loadBuffer(ready.ctx, key);
    } else {
      void fetchRaw(key);
    }
  }
}

export function unlockDraftAudio(): void {
  const ready = ensureAudio();
  if (!ready) return;
  if (ready.ctx.state === 'suspended') {
    void ready.ctx.resume().catch(() => {});
  }
  preloadDraftDiceAudio();
}

function scheduleBuffer(
  ctx: AudioContext,
  out: AudioNode,
  buffer: AudioBuffer,
  when: number,
  gainValue: number,
  rate: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gainValue, Math.max(ctx.currentTime, when));
  src.connect(g);
  g.connect(out);
  activeSources.add(src);
  src.onended = () => {
    activeSources.delete(src);
    g.disconnect();
  };
  src.start(Math.max(ctx.currentTime, when));
}

/** Play immediate cup/hand dice shake on throw gesture. */
export function playDiceShake(): void {
  if (isSfxMuted()) return;
  const ready = ensureAudio();
  if (!ready) return;
  const { ctx, out } = ready;
  const seq = ++rollSeq;
  const rate = 0.985 + Math.random() * 0.03;

  const startWith = (buffer: AudioBuffer) => {
    // Only start shake if a landing result hasn't already superseded this throw.
    if (isSfxMuted() || rollSeq !== seq || ctx.state !== 'running') return;
    const startAt = ctx.currentTime + 0.002;
    activeShakeStartTime = startAt;
    scheduleBuffer(ctx, out, buffer, startAt, 0.88, rate);
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(async () => {
      const buf = await loadBuffer(ctx, 'shake');
      if (buf) startWith(buf);
    }).catch(() => {});
    return;
  }

  const cached = decodedCache.get('shake');
  if (cached) {
    startWith(cached);
    return;
  }

  void loadBuffer(ctx, 'shake').then((buf) => {
    if (buf) startWith(buf);
  });
}

/** Play weighted wooden-table dice bounce & settle right as roll result resolves. */
export function playDiceLand(roll?: number): void {
  if (isSfxMuted()) return;
  const ready = ensureAudio();
  if (!ready) return;
  const { ctx, out } = ready;
  const cue = selectDiceLandCue(roll, lastLandCue);
  lastLandCue = cue;
  const seq = ++rollSeq;
  const shakeAnchor = activeShakeStartTime;
  activeShakeStartTime = null;
  const rate = 0.98 + Math.random() * 0.04;

  const startWith = (buffer: AudioBuffer) => {
    if (isSfxMuted() || seq !== rollSeq || ctx.state !== 'running') return;
    const minFromShake = shakeAnchor !== null ? shakeAnchor + SHAKE_TO_LAND_GAP_SEC : 0;
    const startAt = Math.max(ctx.currentTime + 0.004, minFromShake);
    scheduleBuffer(ctx, out, buffer, startAt, 0.96, rate);
  };

  const cached = decodedCache.get(cue);
  if (cached && ctx.state === 'running') {
    startWith(cached);
    return;
  }

  void Promise.all([
    ctx.state === 'suspended' ? ctx.resume().catch(() => {}) : Promise.resolve(),
    loadBuffer(ctx, cue),
  ]).then(([, buf]) => {
    if (buf) startWith(buf);
  });
}
