export type RandomSource = () => number;

/** FNV-1a 32-bit hash. Stable across Node.js and browser runtimes. */
export function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Small deterministic PRNG based on Mulberry32.
 * Returns values in the same [0, 1) range as Math.random().
 */
export function createSeededRandom(seed: string | number): RandomSource {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

export function deriveSeed(baseSeed: string | number, ...parts: Array<string | number>): string {
  return [String(baseSeed), ...parts.map(String)].join(':');
}
