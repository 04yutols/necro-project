import { createSeededRandom, deriveSeed, hashSeed } from './SeededRandom';

describe('SeededRandom', () => {
  test('returns the same sequence for the same seed', () => {
    const left = createSeededRandom('repeatable');
    const right = createSeededRandom('repeatable');
    expect(Array.from({ length: 20 }, () => left())).toEqual(Array.from({ length: 20 }, () => right()));
  });

  test('returns a different sequence for a different seed', () => {
    const left = createSeededRandom('left');
    const right = createSeededRandom('right');
    expect(Array.from({ length: 5 }, () => left())).not.toEqual(Array.from({ length: 5 }, () => right()));
  });

  test('stays inside the Math.random range', () => {
    const rng = createSeededRandom(42);
    for (let index = 0; index < 1_000; index += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  test('derives stable sub-seeds', () => {
    expect(deriveSeed('base', 'stage', 3, 'battle')).toBe('base:stage:3:battle');
    expect(hashSeed('base')).toBe(hashSeed('base'));
  });
});
