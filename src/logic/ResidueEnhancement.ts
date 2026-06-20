import type { AbyssalResidueData, ResidueMatData } from '../types/game';

export const MAX_RESIDUE_LEVEL = 20;

export type ResidueEnhancementState = Pick<AbyssalResidueData, 'level' | 'exp' | 'maxExp'>;

function normalizePositiveInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function spendResidueMaterials(
  materials: ResidueMatData[],
  matIds: string[],
): { expGain: number; materials: ResidueMatData[] } {
  const requested = matIds.reduce((counts, id) => counts.set(id, (counts.get(id) ?? 0) + 1), new Map<string, number>());
  let expGain = 0;

  const nextMaterials = materials.flatMap((material) => {
    const consume = Math.min(requested.get(material.id) ?? 0, material.quantity);
    if (consume <= 0) return [material];

    expGain += material.expValue * consume;
    const nextQuantity = material.quantity - consume;
    return nextQuantity > 0 ? [{ ...material, quantity: nextQuantity }] : [];
  });

  return { expGain, materials: nextMaterials };
}

export function calculateResidueEnhancement(
  residue: ResidueEnhancementState,
  expGain: number,
): ResidueEnhancementState {
  let newExp = normalizePositiveInt(residue.exp) + normalizePositiveInt(expGain);
  let newLevel = Math.min(MAX_RESIDUE_LEVEL, Math.max(1, normalizePositiveInt(residue.level, 1)));
  let newMaxExp = Math.max(1, normalizePositiveInt(residue.maxExp, 800));

  while (newExp >= newMaxExp && newLevel < MAX_RESIDUE_LEVEL) {
    newExp -= newMaxExp;
    newLevel += 1;
    newMaxExp = Math.max(1, Math.floor(newMaxExp * 1.5));
  }

  if (newLevel >= MAX_RESIDUE_LEVEL) newExp = Math.min(newExp, newMaxExp);

  return { level: newLevel, exp: newExp, maxExp: newMaxExp };
}

export function applyResidueEnhancement<T extends ResidueEnhancementState>(
  residue: T,
  expGain: number,
): T {
  return {
    ...residue,
    ...calculateResidueEnhancement(residue, expGain),
  };
}
