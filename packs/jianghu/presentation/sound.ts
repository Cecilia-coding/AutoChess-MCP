import type { SfxKind, SfxSynthContext, SoundPack } from "../../../lib/presentation/types";

/**
 * Pentatonic (D Gong-Shang-Jue-Zhi-Yu) acoustic voices for the 夜航船 (jianghu) pack:
 * plucked strings (guzheng/pipa), night-watch clapper (woodblock), bronze gong, and war drum.
 */
function pluck(
  sfx: SfxSynthContext,
  startAt: number,
  freq: number,
  duration: number,
  peak: number,
  harmonic = true,
): void {
  sfx.tone({
    type: "triangle",
    startAt,
    duration,
    freqStart: freq * 1.016,
    freqEnd: freq * 0.996,
    gainPeak: peak,
    attack: 0.003,
  });
  if (harmonic) {
    sfx.tone({
      type: "sine",
      startAt: startAt + 0.002,
      duration: duration * 0.62,
      freqStart: freq * 2,
      freqEnd: freq * 1.99,
      gainPeak: peak * 0.36,
      attack: 0.002,
    });
  }
  sfx.noiseBurst({
    startAt,
    duration: 0.012,
    filterType: "bandpass",
    freqStart: Math.min(3400, Math.max(900, freq * 2.4)),
    q: 2.2,
    gainPeak: peak * 0.18,
  });
}

function woodblock(sfx: SfxSynthContext, startAt: number, freq: number, duration: number, peak: number): void {
  sfx.tone({
    type: "sine",
    startAt,
    duration,
    freqStart: freq * 1.16,
    freqEnd: freq * 0.96,
    gainPeak: peak,
    attack: 0.0015,
  });
  sfx.noiseBurst({
    startAt,
    duration: Math.min(0.022, duration * 0.5),
    filterType: "bandpass",
    freqStart: Math.max(400, freq * 1.85),
    freqEnd: Math.max(300, freq * 1.4),
    q: 3.4,
    gainPeak: peak * 0.38,
  });
}

function drum(
  sfx: SfxSynthContext,
  startAt: number,
  freqStart: number,
  freqEnd: number,
  duration: number,
  peak: number,
): void {
  sfx.tone({
    type: "sine",
    startAt,
    duration,
    freqStart,
    freqEnd,
    gainPeak: peak,
    attack: 0.004,
  });
  sfx.noiseBurst({
    startAt,
    duration: Math.min(0.06, duration * 0.45),
    filterType: "lowpass",
    freqStart: 880,
    freqEnd: 210,
    q: 0.9,
    gainPeak: peak * 0.32,
  });
}

function gong(sfx: SfxSynthContext, startAt: number, baseFreq: number, duration: number, peak: number): void {
  const partials: readonly [number, number, OscillatorType, number][] = [
    [1.0, 1.0, "sine", 1.0],
    [1.47, 0.58, "triangle", 0.72],
    [2.04, 0.42, "sine", 0.55],
    [2.68, 0.24, "sine", 0.38],
  ];
  for (const [ratio, amp, type, durRatio] of partials) {
    sfx.tone({
      type,
      startAt,
      duration: duration * durRatio,
      freqStart: baseFreq * ratio,
      freqEnd: baseFreq * ratio * 0.985,
      gainPeak: peak * amp,
      attack: 0.008,
    });
  }
  sfx.noiseBurst({
    startAt,
    duration: Math.min(0.18, duration * 0.35),
    filterType: "bandpass",
    freqStart: 2200,
    freqEnd: 920,
    q: 1.6,
    gainPeak: peak * 0.26,
  });
}

function pentatonicRun(
  sfx: SfxSynthContext,
  startAt: number,
  freqs: readonly number[],
  step: number,
  noteDur: number,
  lastDur: number,
  peak: number,
): void {
  freqs.forEach((freq, i) => {
    const isLast = i === freqs.length - 1;
    pluck(sfx, startAt + i * step, freq, isLast ? lastDur : noteDur, isLast ? peak * 1.15 : peak);
  });
}

export const jianghuSoundPack: SoundPack = {
  id: "jianghu-sound",
  play(kind: SfxKind, sfx: SfxSynthContext): void {
    const { t, scale, tone, noiseBurst, jitter } = sfx;

    switch (kind) {
      case "swing": {
        noiseBurst({
          startAt: t,
          duration: 0.028,
          filterType: "bandpass",
          freqStart: jitter(3000, 0.1),
          freqEnd: 1550,
          q: 1.4,
          gainPeak: 0.048 * scale,
        });
        break;
      }
      case "hitLight": {
        woodblock(sfx, t, jitter(560, 0.08), 0.032, 0.11 * scale);
        noiseBurst({
          startAt: t,
          duration: 0.018,
          filterType: "highpass",
          freqStart: jitter(3300, 0.1),
          q: 0.9,
          gainPeak: 0.068 * scale,
        });
        break;
      }
      case "hitHeavy": {
        drum(sfx, t, jitter(145, 0.06), 54, 0.115, 0.24 * scale);
        tone({
          type: "triangle",
          startAt: t,
          duration: 0.065,
          freqStart: jitter(740, 0.08),
          freqEnd: 310,
          gainPeak: 0.11 * scale,
        });
        noiseBurst({
          startAt: t,
          duration: 0.05,
          filterType: "bandpass",
          freqStart: 2700,
          freqEnd: 1100,
          q: 1.3,
          gainPeak: 0.15 * scale,
        });
        break;
      }
      case "hitSkill": {
        tone({
          type: "triangle",
          startAt: t,
          duration: 0.095,
          freqStart: jitter(587.33, 0.06),
          freqEnd: 260,
          gainPeak: 0.21 * scale,
        });
        tone({
          type: "sine",
          startAt: t + 0.014,
          duration: 0.09,
          freqStart: jitter(1174.66, 0.05),
          freqEnd: 740,
          gainPeak: 0.12 * scale,
        });
        noiseBurst({
          startAt: t,
          duration: 0.065,
          filterType: "bandpass",
          freqStart: 2100,
          freqEnd: 880,
          q: 1.8,
          gainPeak: 0.14 * scale,
        });
        break;
      }
      case "cast": {
        pentatonicRun(sfx, t, [587.33, 659.25, 880.0], 0.034, 0.095, 0.14, 0.13);
        break;
      }
      case "shield": {
        // Jade lantern ward chime: A5 + E6 + warm D5 undertone
        tone({ type: "sine", startAt: t, duration: 0.14, freqStart: 587.33, gainPeak: 0.09, attack: 0.005 });
        tone({ type: "sine", startAt: t + 0.012, duration: 0.16, freqStart: 880.0, freqEnd: 876, gainPeak: 0.14 });
        tone({ type: "sine", startAt: t + 0.028, duration: 0.14, freqStart: 1318.51, freqEnd: 1310, gainPeak: 0.08 });
        break;
      }
      case "heal": {
        // Flowing D pentatonic spring notes: D5 -> F#5 -> A5
        [587.33, 739.99, 880.0].forEach((freq, i) => {
          tone({
            type: "sine",
            startAt: t + i * 0.042,
            duration: 0.12,
            freqStart: freq,
            freqEnd: freq * 1.02,
            gainPeak: 0.11 - i * 0.01,
            attack: 0.006,
          });
        });
        break;
      }
      case "death": {
        drum(sfx, t, jitter(155, 0.05), 62, 0.18, 0.22);
        pluck(sfx, t + 0.015, jitter(293.66, 0.06), 0.14, 0.11, false);
        break;
      }
      case "battleStart": {
        // Night-watchman clapper double-tap followed by dark bronze gong
        woodblock(sfx, t, 740, 0.042, 0.14);
        woodblock(sfx, t + 0.072, 987.77, 0.048, 0.15);
        gong(sfx, t + 0.135, 196.0, 0.42, 0.16);
        break;
      }
      case "roundWin": {
        const b = t + 0.09;
        pentatonicRun(sfx, b, [587.33, 739.99, 880.0, 1174.66], 0.065, 0.11, 0.34, 0.18);
        gong(sfx, b + 0.195, 392.0, 0.38, 0.13);
        break;
      }
      case "roundLose": {
        const b = t + 0.09;
        pentatonicRun(sfx, b, [329.63, 293.66, 246.94, 220.0], 0.095, 0.12, 0.36, 0.18);
        drum(sfx, b + 0.285, 130.81, 82.41, 0.3, 0.16);
        break;
      }
      case "roundDraw": {
        const b = t + 0.09;
        woodblock(sfx, b, 440.0, 0.06, 0.14);
        pluck(sfx, b + 0.07, 587.33, 0.12, 0.15);
        woodblock(sfx, b + 0.17, 440.0, 0.1, 0.15);
        break;
      }
      case "matchWin": {
        const b = t + 0.1;
        gong(sfx, b, 146.83, 0.72, 0.18);
        pentatonicRun(
          sfx,
          b + 0.06,
          [293.66, 369.99, 440.0, 587.33, 739.99, 880.0, 1174.66],
          0.072,
          0.14,
          0.62,
          0.2,
        );
        tone({ type: "sine", startAt: b + 0.5, duration: 0.65, freqStart: 1479.98, gainPeak: 0.12, attack: 0.01 });
        break;
      }
      case "matchLose": {
        const b = t + 0.1;
        gong(sfx, b, 110.0, 0.68, 0.16);
        pentatonicRun(sfx, b + 0.08, [220.0, 196.0, 164.81, 146.83], 0.145, 0.16, 0.58, 0.21);
        drum(sfx, b + 0.52, 110.0, 68.0, 0.56, 0.24);
        break;
      }
      case "matchDraw": {
        const b = t + 0.1;
        gong(sfx, b, 196.0, 0.48, 0.14);
        pentatonicRun(sfx, b + 0.07, [587.33, 440.0, 369.99, 293.66], 0.115, 0.13, 0.4, 0.17);
        break;
      }
      case "buy": {
        // Crisp abacus beads
        woodblock(sfx, t, 880.0, 0.042, 0.14);
        woodblock(sfx, t + 0.052, 1174.66, 0.065, 0.15);
        break;
      }
      case "sell": {
        // Coins/beads settling back into the tray
        woodblock(sfx, t, 1046.5, 0.045, 0.14);
        pluck(sfx, t + 0.045, 659.25, 0.1, 0.13, true);
        break;
      }
      case "merge": {
        pentatonicRun(sfx, t, [587.33, 659.25, 739.99, 880.0, 1174.66], 0.048, 0.095, 0.28, 0.16);
        break;
      }
      case "place": {
        drum(sfx, t, jitter(235, 0.06), 112, 0.065, 0.18);
        woodblock(sfx, t, jitter(420, 0.05), 0.032, 0.08);
        break;
      }
      case "reroll": {
        [620, 740, 560].forEach((freq, i) => {
          woodblock(sfx, t + i * 0.042, jitter(freq, 0.05), 0.034, 0.11);
        });
        break;
      }
      case "ui": {
        woodblock(sfx, t, 880, 0.036, 0.1);
        break;
      }
    }
  },
};
