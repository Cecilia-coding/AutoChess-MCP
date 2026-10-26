export function hash32(a: number, b = 0, c = 0): number {
  let h = (a + 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (c >>> 0), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function hashString(seed: number, text: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

export type Rng = {
  next(): number;
  int(n: number): number;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n: number) {
      if (n <= 1) return 0;
      return Math.floor(this.next() * n);
    },
  };
}
