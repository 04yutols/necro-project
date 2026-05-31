import { applyPlayerDamage, isPlayerDead } from './PlayerDefeat';

describe('applyPlayerDamage', () => {
  test('normal damage reduces HP', () => {
    expect(applyPlayerDamage(800, 200)).toBe(600);
  });

  test('exact-kill damage returns 0', () => {
    expect(applyPlayerDamage(200, 200)).toBe(0);
  });

  test('overkill damage clamps to 0, never negative', () => {
    expect(applyPlayerDamage(100, 9999)).toBe(0);
  });

  test('zero damage leaves HP unchanged', () => {
    expect(applyPlayerDamage(500, 0)).toBe(500);
  });

  test('sequential hits track HP correctly', () => {
    let hp = 300;
    hp = applyPlayerDamage(hp, 50);  // 250
    hp = applyPlayerDamage(hp, 100); // 150
    hp = applyPlayerDamage(hp, 150); // 0
    expect(hp).toBe(0);
  });

  test('partial damage leaves survivor HP', () => {
    expect(applyPlayerDamage(100, 99)).toBe(1);
  });
});

describe('isPlayerDead', () => {
  test('returns false when HP is positive', () => {
    expect(isPlayerDead(1)).toBe(false);
    expect(isPlayerDead(800)).toBe(false);
  });

  test('returns true when HP is exactly 0', () => {
    expect(isPlayerDead(0)).toBe(true);
  });

  test('returns true after a lethal applyPlayerDamage', () => {
    expect(isPlayerDead(applyPlayerDamage(100, 100))).toBe(true);
  });

  test('returns false after a non-lethal applyPlayerDamage', () => {
    expect(isPlayerDead(applyPlayerDamage(100, 99))).toBe(false);
  });
});
