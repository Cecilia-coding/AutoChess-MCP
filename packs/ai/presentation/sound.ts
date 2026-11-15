import type { SfxKind, SfxSynthContext, SoundPack } from "../../../lib/presentation/types";

/** Original arcade / fairy-chime synth palette preserved for the AI pack. */
export const aiSoundPack: SoundPack = {
  id: "ai-sound",
  play(kind: SfxKind, { t, scale, tone, noiseBurst, jitter }: SfxSynthContext): void {
    switch (kind) {
      case "swing": {
        noiseBurst({
          startAt: t,
          duration: 0.026,
          filterType: "highpass",
          freqStart: jitter(3400, 0.12),
          freqEnd: 2000,
          q: 0.9,
          gainPeak: 0.045 * scale,
        });
        break;
      }
      case "hitLight": {
        tone({
          type: "sine",
          startAt: t,
          duration: 0.028,
          freqStart: jitter(720, 0.1),
          freqEnd: 340,
          gainPeak: 0.11 * scale,
          attack: 0.0015,
        });
        noiseBurst({
          startAt: t,
          duration: 0.018,
          filterType: "highpass",
          freqStart: jitter(3800, 0.1),
          q: 0.8,
          gainPeak: 0.075 * scale,
        });
        break;
      }
      case "hitHeavy": {
        tone({
          type: "triangle",
          startAt: t,
          duration: 0.095,
          freqStart: jitter(175, 0.05),
          freqEnd: 65,
          gainPeak: 0.25 * scale,
        });
        tone({
          type: "sawtooth",
          startAt: t,
          duration: 0.06,
          freqStart: jitter(420),
          freqEnd: 130,
          gainPeak: 0.09 * scale,
        });
        noiseBurst({
          startAt: t,
          duration: 0.055,
          filterType: "bandpass",
          freqStart: 3200,
          freqEnd: 1300,
          q: 1.0,
          gainPeak: 0.16 * scale,
        });
        break;
      }
      case "hitSkill": {
        tone({
          type: "triangle",
          startAt: t,
          duration: 0.09,
          freqStart: jitter(620),
          freqEnd: 210,
          gainPeak: 0.24 * scale,
        });
        tone({
          type: "sine",
          startAt: t + 0.015,
          duration: 0.09,
          freqStart: jitter(960),
          freqEnd: 420,
          gainPeak: 0.14 * scale,
        });
        noiseBurst({
          startAt: t,
          duration: 0.06,
          filterType: "highpass",
          freqStart: 1900,
          freqEnd: 950,
          q: 1.2,
          gainPeak: 0.18 * scale,
        });
        break;
      }
      case "cast": {
        const notes = [523.25, 698.46, 987.77];
        notes.forEach((freq, i) => {
          tone({
            type: "sine",
            startAt: t + i * 0.032,
            duration: 0.085,
            freqStart: jitter(freq, 0.03),
            freqEnd: freq * 1.08,
            gainPeak: 0.14,
          });
        });
        break;
      }
      case "shield": {
        tone({
          type: "sine",
          startAt: t,
          duration: 0.11,
          freqStart: 784,
          freqEnd: 1175,
          gainPeak: 0.15,
        });
        tone({
          type: "triangle",
          startAt: t + 0.02,
          duration: 0.08,
          freqStart: 1568,
          freqEnd: 1320,
          gainPeak: 0.07,
        });
        break;
      }
      case "heal": {
        tone({
          type: "sine",
          startAt: t,
          duration: 0.1,
          freqStart: 587.33,
          freqEnd: 783.99,
          gainPeak: 0.13,
        });
        tone({
          type: "sine",
          startAt: t + 0.045,
          duration: 0.12,
          freqStart: 880,
          freqEnd: 1046.5,
          gainPeak: 0.11,
        });
        break;
      }
      case "death": {
        tone({
          type: "triangle",
          startAt: t,
          duration: 0.17,
          freqStart: jitter(390, 0.06),
          freqEnd: 105,
          gainPeak: 0.24,
        });
        noiseBurst({
          startAt: t,
          duration: 0.08,
          filterType: "lowpass",
          freqStart: 950,
          freqEnd: 240,
          gainPeak: 0.15,
        });
        break;
      }
      case "battleStart": {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          tone({
            type: "square",
            startAt: t + i * 0.055,
            duration: 0.1,
            freqStart: freq,
            gainPeak: 0.09,
          });
        });
        break;
      }
      case "roundWin": {
        const b = t + 0.1;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const dur = i === 3 ? 0.28 : 0.085;
          tone({
            type: "triangle",
            startAt: b + i * 0.068,
            duration: dur,
            freqStart: freq,
            gainPeak: i === 3 ? 0.25 : 0.2,
          });
          tone({
            type: "square",
            startAt: b + i * 0.068,
            duration: dur * 0.75,
            freqStart: freq * 2,
            gainPeak: i === 3 ? 0.09 : 0.055,
          });
        });
        break;
      }
      case "roundLose": {
        const b = t + 0.1;
        [349.23, 329.63, 293.66, 233.08].forEach((freq, i) => {
          const dur = i === 3 ? 0.3 : 0.095;
          tone({
            type: "triangle",
            startAt: b + i * 0.085,
            duration: dur,
            freqStart: freq,
            freqEnd: i === 3 ? 196 : undefined,
            gainPeak: i === 3 ? 0.25 : 0.2,
          });
          tone({
            type: "sawtooth",
            startAt: b + i * 0.085,
            duration: dur * 0.85,
            freqStart: freq,
            freqEnd: i === 3 ? 196 : undefined,
            gainPeak: 0.085,
          });
        });
        break;
      }
      case "roundDraw": {
        const b = t + 0.1;
        [587.33, 440, 587.33].forEach((freq, i) => {
          tone({
            type: "triangle",
            startAt: b + i * 0.085,
            duration: i === 2 ? 0.18 : 0.08,
            freqStart: freq,
            gainPeak: 0.17,
          });
        });
        break;
      }
      case "matchWin": {
        const b = t + 0.12;
        [392, 523.25, 659.25].forEach((freq, i) => {
          tone({
            type: "square",
            startAt: b + i * 0.085,
            duration: 0.09,
            freqStart: freq,
            gainPeak: 0.1,
          });
          tone({
            type: "triangle",
            startAt: b + i * 0.085,
            duration: 0.1,
            freqStart: freq,
            gainPeak: 0.24,
          });
        });
        const hitAt = b + 0.3;
        tone({ type: "triangle", startAt: hitAt, duration: 0.78, freqStart: 261.63, gainPeak: 0.22 });
        [523.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
          tone({
            type: i >= 2 ? "square" : "triangle",
            startAt: hitAt + i * 0.055,
            duration: i === 3 ? 0.68 : 0.48,
            freqStart: freq,
            gainPeak: i >= 2 ? 0.11 : 0.25,
          });
        });
        tone({ type: "sine", startAt: hitAt + 0.2, duration: 0.56, freqStart: 1567.98, gainPeak: 0.15 });
        break;
      }
      case "matchLose": {
        const b = t + 0.12;
        [392, 369.99, 349.23, 329.63].forEach((freq, i) => {
          tone({
            type: "triangle",
            startAt: b + i * 0.135,
            duration: 0.13,
            freqStart: freq,
            gainPeak: 0.24,
          });
          tone({
            type: "sawtooth",
            startAt: b + i * 0.135,
            duration: 0.11,
            freqStart: freq,
            gainPeak: 0.095,
          });
        });
        const tailAt = b + 0.56;
        tone({
          type: "triangle",
          startAt: tailAt,
          duration: 0.56,
          freqStart: 261.63,
          freqEnd: 196,
          gainPeak: 0.28,
        });
        tone({
          type: "sawtooth",
          startAt: tailAt,
          duration: 0.5,
          freqStart: 261.63,
          freqEnd: 196,
          gainPeak: 0.1,
        });
        tone({
          type: "sine",
          startAt: tailAt,
          duration: 0.62,
          freqStart: 130.81,
          freqEnd: 98,
          gainPeak: 0.24,
        });
        break;
      }
      case "matchDraw": {
        const b = t + 0.12;
        tone({ type: "triangle", startAt: b, duration: 0.56, freqStart: 261.63, gainPeak: 0.18 });
        [523.25, 783.99, 659.25, 523.25].forEach((freq, i) => {
          tone({
            type: "triangle",
            startAt: b + i * 0.11,
            duration: i === 3 ? 0.34 : 0.12,
            freqStart: freq,
            gainPeak: 0.2,
          });
        });
        break;
      }
      case "buy": {
        tone({ type: "square", startAt: t, duration: 0.06, freqStart: 987.77, gainPeak: 0.08 });
        tone({ type: "square", startAt: t + 0.055, duration: 0.11, freqStart: 1318.5, gainPeak: 0.09 });
        break;
      }
      case "sell": {
        tone({ type: "triangle", startAt: t, duration: 0.06, freqStart: 1174.66, gainPeak: 0.15 });
        tone({ type: "triangle", startAt: t + 0.05, duration: 0.09, freqStart: 880, gainPeak: 0.14 });
        break;
      }
      case "merge": {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
          tone({
            type: "triangle",
            startAt: t + i * 0.05,
            duration: i === 4 ? 0.24 : 0.09,
            freqStart: freq,
            gainPeak: 0.17,
          });
        });
        break;
      }
      case "place": {
        tone({
          type: "triangle",
          startAt: t,
          duration: 0.055,
          freqStart: jitter(320, 0.06),
          freqEnd: 150,
          gainPeak: 0.18,
        });
        break;
      }
      case "reroll": {
        [480, 620, 540].forEach((freq, i) => {
          tone({
            type: "triangle",
            startAt: t + i * 0.032,
            duration: 0.04,
            freqStart: freq,
            freqEnd: freq * 1.15,
            gainPeak: 0.11,
          });
        });
        break;
      }
      case "ui": {
        tone({
          type: "sine",
          startAt: t,
          duration: 0.05,
          freqStart: 740,
          freqEnd: 920,
          gainPeak: 0.11,
        });
        break;
      }
    }
  },
};
