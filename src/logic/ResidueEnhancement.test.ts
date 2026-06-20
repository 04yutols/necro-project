import {
  applyResidueEnhancement,
  calculateResidueEnhancement,
  spendResidueMaterials,
} from './ResidueEnhancement';
import type { AbyssalResidueData, ResidueMatData } from '../types/game';

const residueFixture: AbyssalResidueData = {
  id: 'residue-1',
  name: '試験用の残滓',
  itemId: 'head',
  rarity: 'RARE',
  mainStat: { type: 'ATK%', value: 6 },
  subOptions: [],
  level: 1,
  exp: 750,
  maxExp: 800,
};

const materialFixtures: ResidueMatData[] = [
  { id: 'mat-common', name: '記憶片', quantity: 2, expValue: 120, rarity: 'COMMON' },
  { id: 'mat-rare', name: '深層記憶', quantity: 1, expValue: 360, rarity: 'RARE' },
];

describe('ResidueEnhancement', () => {
  test('calculates multiple residue level-ups in one enhancement', () => {
    const enhanced = calculateResidueEnhancement(residueFixture, 1800);

    expect(enhanced).toEqual({
      level: 3,
      exp: 550,
      maxExp: 1800,
    });
  });

  test('clamps residue exp at the level 20 cap', () => {
    const enhanced = calculateResidueEnhancement({
      level: 19,
      exp: 1000,
      maxExp: 1000,
    }, 5000);

    expect(enhanced).toEqual({
      level: 20,
      exp: 1500,
      maxExp: 1500,
    });
  });

  test('spends available material units and reports over-requested units', () => {
    const spent = spendResidueMaterials(materialFixtures, [
      'mat-common',
      'mat-common',
      'mat-common',
      'mat-rare',
    ]);

    expect(spent).toMatchObject({
      expGain: 600,
      requestedCount: 4,
      consumedCount: 3,
      missingCount: 1,
    });
    expect(spent.materials).toEqual([]);
  });

  test('reports zero exp for unowned material ids without mutating inventory', () => {
    const spent = spendResidueMaterials(materialFixtures, ['missing-mat']);

    expect(spent).toMatchObject({
      expGain: 0,
      requestedCount: 1,
      consumedCount: 0,
      missingCount: 1,
    });
    expect(spent.materials).toEqual(materialFixtures);
  });

  test('applies enhancement while preserving residue identity fields', () => {
    const enhanced = applyResidueEnhancement(residueFixture, 100);

    expect(enhanced).toMatchObject({
      id: residueFixture.id,
      name: residueFixture.name,
      itemId: residueFixture.itemId,
      rarity: residueFixture.rarity,
      level: 2,
      exp: 50,
      maxExp: 1200,
    });
  });
});
