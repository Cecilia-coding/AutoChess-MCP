/**
 * 像素游乐摊实录拟音引擎（Web Audio API + 真实物理采样）。
 * 全部素材为自然纸面摩擦、卡纸揭晓、机械棘爪与真实铜钱碰撞声，避免合成电子蜂鸣音；
 * 统一受全局 `isSfxMuted()` 静音开关控制，并通过 `assetUrl` 兼容独立运行与 `/autochess/static/` 子路径。
 */
import { isSfxMuted, subscribeSfxMuted } from '../autochess/sound';
import { assetUrl } from './asset-url';

const SFX_FILES = {
  'scratch-loop': '/arcade-sfx/scratch-loop.wav',
  'scratch-tap': '/arcade-sfx/scratch-tap.mp3',
  'scratch-sweep': '/arcade-sfx/scratch-sweep.wav',
  'card-pop': '/arcade-sfx/card-pop.mp3',
  'cell-lucky': '/arcade-sfx/cell-lucky.mp3',
  'lever-click': '/arcade-sfx/lever-click.mp3',
  'reel-tick': '/arcade-sfx/reel-tick.mp3',
  'reel-lock': '/arcade-sfx/reel-lock.mp3',
  'coins-win': '/arcade-sfx/coins-win.mp3',
  'soft-thud': '/arcade-sfx/soft-thud.mp3',
} as const;

type SfxKey = keyof typeof SFX_FILES;

let ctx: AudioContext | null = null;
let outGain: GainNode | null = null;
let compNode: DynamicsCompressorNode | null = null;
let muteSubscribed = false;

const buffers = new Map<SfxKey, AudioBuffer>();
const pending = new Map<SfxKey, Promise<AudioBuffer | null>>();

let lastTickMs = 0;

// 刮刮乐连续划动状态：单一连续循环声轨，按手指移速平滑调制音量与通透度
let scratchSource: AudioBufferSourceNode | null = null;
let scratchFilter: BiquadFilterNode | null = null;
let scratchGain: GainNode | null = null;
let scratchIdleFadeTimer: ReturnType<typeof setTimeout> | null = null;
let scratchIdleStopTimer: ReturnType<typeof setTimeout> | null = null;
let scratchStarting = false;

function clearScratchTimers(): void {
  if (scratchIdleFadeTimer !== null) {
    clearTimeout(scratchIdleFadeTimer);
    scratchIdleFadeTimer = null;
  }
  if (scratchIdleStopTimer !== null) {
    clearTimeout(scratchIdleStopTimer);
    scratchIdleStopTimer = null;
  }
}

function disposeScratchLoop(): void {
  const src = scratchSource;
  scratchSource = null;
  scratchFilter = null;
  scratchGain = null;
  scratchStarting = false;
  if (!src) return;
  try {
    src.stop();
  } catch {
    // ignore already stopped
  }
  try {
    src.disconnect();
  } catch {
    // ignore
  }
}

function ensureAudio(): { ctx: AudioContext; out: AudioNode } | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!ctx) {
    try {
      ctx = new Ctor();
      compNode = ctx.createDynamicsCompressor();
      compNode.threshold.setValueAtTime(-14, ctx.currentTime);
      compNode.knee.setValueAtTime(16, ctx.currentTime);
      compNode.ratio.setValueAtTime(3.2, ctx.currentTime);

      outGain = ctx.createGain();
      outGain.gain.setValueAtTime(isSfxMuted() ? 0 : 0.78, ctx.currentTime);
      compNode.connect(outGain);
      outGain.connect(ctx.destination);
    } catch {
      return null;
    }
  }

  if (!muteSubscribed) {
    muteSubscribed = true;
    subscribeSfxMuted(() => {
      if (isSfxMuted()) stopScratchGrain();
      if (ctx && outGain) {
        outGain.gain.setTargetAtTime(isSfxMuted() ? 0 : 0.78, ctx.currentTime, 0.015);
      }
    });
  }

  if (!ctx || !compNode || !outGain) return null;
  outGain.gain.setTargetAtTime(isSfxMuted() ? 0 : 0.78, ctx.currentTime, 0.015);
  return { ctx, out: compNode };
}

function loadSample(key: SfxKey): Promise<AudioBuffer | null> {
  const cached = buffers.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const audio = ensureAudio();
  if (!audio || typeof fetch === 'undefined') return Promise.resolve(null);

  const task = (async () => {
    try {
      const res = await fetch(assetUrl(SFX_FILES[key]));
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const decoded = await audio.ctx.decodeAudioData(arr);
      buffers.set(key, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, task);
  return task;
}

function preloadArcadeSfx(): void {
  for (const key of Object.keys(SFX_FILES) as SfxKey[]) {
    void loadSample(key);
  }
}

/** 在用户手势内同步唤醒音频上下文并预加载真实物理采样，避免首次落指卡顿。 */
export function unlockArcadeAudio(): void {
  const ready = ensureAudio();
  if (!ready) return;
  if (ready.ctx.state === 'suspended') {
    void ready.ctx.resume().catch(() => {});
  }
  preloadArcadeSfx();
}

function playSample(
  key: SfxKey,
  {
    delay = 0,
    gain = 0.45,
    rate = 1,
    maxDuration,
    lowpassHz,
  }: {
    delay?: number;
    gain?: number;
    rate?: number;
    maxDuration?: number;
    lowpassHz?: number;
  } = {},
): void {
  if (isSfxMuted()) return;
  const audio = ensureAudio();
  if (!audio) return;
  if (audio.ctx.state === 'suspended') {
    void audio.ctx.resume().catch(() => {});
  }

  const trigger = (buf: AudioBuffer) => {
    if (isSfxMuted() || audio.ctx.state !== 'running') return;
    const t = audio.ctx.currentTime + delay;
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(Math.max(0.5, Math.min(2, rate)), t);

    const amp = audio.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(Math.max(0.01, gain), t + 0.008);

    if (lowpassHz !== undefined) {
      const lp = audio.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(lowpassHz, t);
      lp.Q.setValueAtTime(0.65, t);
      src.connect(lp);
      lp.connect(amp);
    } else {
      src.connect(amp);
    }

    amp.connect(audio.out);
    src.start(t);
    if (maxDuration !== undefined) {
      const stopAt = t + maxDuration;
      amp.gain.setTargetAtTime(0.0001, Math.max(t + 0.01, stopAt - 0.03), 0.012);
      src.stop(stopAt + 0.02);
    }
  };

  const cached = buffers.get(key);
  if (cached) {
    trigger(cached);
    return;
  }

  // 若样本仍在首次解码（约数毫秒），解锁即刻补播瞬态操作音，避免完全吞音
  void loadSample(key).then(buf => {
    if (buf && delay === 0) trigger(buf);
  });
}

function modulateScratchLoop(speedPx: number): void {
  const audio = ensureAudio();
  if (!audio || !scratchSource || !scratchGain || !scratchFilter) return;

  const norm = Math.max(0.14, Math.min(1.25, speedPx / 28));
  const t = audio.ctx.currentTime;
  const targetGain = Math.min(0.54, 0.20 + norm * 0.27);
  const targetCutoff = 1950 + norm * 1250;
  // 控制音高微调范围，杜绝高频扫频带来的电音感，只随指速微调沙沙明亮度
  const targetRate = 0.96 + Math.min(norm, 1.1) * 0.08;

  scratchGain.gain.setTargetAtTime(targetGain, t, 0.022);
  scratchFilter.frequency.setTargetAtTime(targetCutoff, t, 0.032);
  scratchSource.playbackRate.setTargetAtTime(targetRate, t, 0.045);

  clearScratchTimers();
  scratchIdleFadeTimer = setTimeout(() => {
    if (scratchGain && ctx) {
      scratchGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.028);
    }
    scratchIdleStopTimer = setTimeout(() => {
      disposeScratchLoop();
    }, 180);
  }, 75);
}

/** 刮刮乐刚落指/指尖轻触卡面的纸张轻叩声。 */
export function playScratchTap(): void {
  playSample('scratch-tap', {
    gain: 0.34,
    rate: 0.95 + Math.random() * 0.12,
  });
}

/** 刮刮乐连续滑动时的连续「沙沙」纸面摩擦声（无电子颗粒截断），随移速平滑淡入淡出。 */
export function playScratchGrain(speedPx: number): void {
  if (isSfxMuted()) {
    stopScratchGrain();
    return;
  }
  const audio = ensureAudio();
  if (!audio) return;
  if (audio.ctx.state === 'suspended') {
    void audio.ctx.resume().catch(() => {});
  }

  if (scratchSource && scratchGain && scratchFilter) {
    modulateScratchLoop(speedPx);
    return;
  }

  const cached = buffers.get('scratch-loop');
  if (cached) {
    const src = audio.ctx.createBufferSource();
    src.buffer = cached;
    src.loop = true;

    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(0.45, audio.ctx.currentTime);
    filter.frequency.setValueAtTime(2400, audio.ctx.currentTime);

    const amp = audio.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, audio.ctx.currentTime);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(audio.out);

    const offset = Math.random() * Math.max(0.05, cached.duration * 0.6);
    src.start(audio.ctx.currentTime, offset);

    scratchSource = src;
    scratchFilter = filter;
    scratchGain = amp;
    modulateScratchLoop(speedPx);
    return;
  }

  if (!scratchStarting) {
    scratchStarting = true;
    void loadSample('scratch-loop').finally(() => {
      scratchStarting = false;
    });
  }
}

/** 手指抬起、切出画面或静音时平滑收拢「沙沙」循环摩擦声，杜绝突兀截断咔嗒声。 */
export function stopScratchGrain(): void {
  clearScratchTimers();
  if (!scratchGain || !ctx) {
    disposeScratchLoop();
    return;
  }
  scratchGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.018);
  scratchIdleStopTimer = setTimeout(() => {
    disposeScratchLoop();
  }, 110);
}

/** 点击「一键全刮」时的舒展卡纸快扫唰声。 */
export function playScratchSweep(): void {
  stopScratchGrain();
  playSample('scratch-sweep', {
    gain: 0.48,
    rate: 1.04,
  });
}

/** 单个格子银膜彻底刮开时的纸面轻弹与幸运铜钱微响。 */
export function playScratchCellReveal(matched: boolean, isDouble: boolean): void {
  playSample('card-pop', {
    gain: isDouble ? 0.34 : matched ? 0.3 : 0.25,
    rate: matched ? 1.04 : 0.94 + Math.random() * 0.1,
  });
  if (isDouble) {
    playSample('cell-lucky', { delay: 0.04, gain: 0.44, rate: 1.16 });
  } else if (matched) {
    playSample('cell-lucky', { delay: 0.035, gain: 0.36, rate: 1.0 });
  }
}

/** 老虎机真实机械棘爪拉杆声。 */
export function playSlotLeverPull(): void {
  playSample('lever-click', {
    gain: 0.48,
    rate: 0.96 + Math.random() * 0.08,
  });
}

/** 老虎机滚轴转动时的轻柔物理卡齿节拍声。 */
export function playSlotTick(suspense = false): void {
  if (isSfxMuted()) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastTickMs < 48) return;
  lastTickMs = now;
  playSample('reel-tick', {
    gain: suspense ? 0.24 : 0.17,
    rate: suspense ? 1.12 + Math.random() * 0.06 : 0.94 + Math.random() * 0.12,
  });
}

/** 单个滚轴锁定的温润沉响，两轴同图听牌时附带轻微铜钱期待响。 */
export function playSlotReelLock(index: number, suspense = false): void {
  const rates = [0.92, 1.0, 1.08];
  playSample('reel-lock', {
    gain: 0.42,
    rate: rates[index % 3] ?? 1.0,
  });
  if (suspense) {
    playSample('cell-lucky', { delay: 0.055, gain: 0.22, rate: 1.08 });
  }
}

/** 游乐摊整轮结算结果提示音（真实铜钱倾泻欢呼 / 落空闷响）。 */
export function playArcadeOutcome(won: boolean, jackpot = false): void {
  if (jackpot) {
    playSample('coins-win', { gain: 0.56, rate: 1.0 });
    playSample('cell-lucky', { delay: 0.18, gain: 0.36, rate: 1.18 });
    playSample('cell-lucky', { delay: 0.34, gain: 0.32, rate: 1.28 });
    return;
  }
  if (won) {
    playSample('coins-win', { gain: 0.46, rate: 1.02 });
    return;
  }
  playSample('soft-thud', { gain: 0.32, rate: 0.95 });
}

/** 搏倍加注结算音。 */
export function playGambleStinger(won: boolean): void {
  if (won) {
    playSample('coins-win', { gain: 0.48, rate: 1.08 });
  } else {
    playSample('soft-thud', { gain: 0.34, rate: 0.88 });
  }
}
