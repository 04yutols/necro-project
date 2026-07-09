/**
 * HP reduction clamped to 0 — never returns negative.
 */
export function applyPlayerDamage(currentHp: number, damage: number): number {
  return Math.max(0, currentHp - damage);
}

/**
 * True when the player has no remaining HP.
 */
export function isPlayerDead(currentHp: number): boolean {
  return currentHp <= 0;
}
