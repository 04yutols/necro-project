import { calculateResidueScore, getResidueScoreGrade, getResidueSlotId, isResidueSlotCompatible } from './ResidueScore';
import type { AbyssalResidueData } from '../types/game';

const residue: AbyssalResidueData = {
  id: 'r-test',
  name: 'Test Residue',
  itemId: 'legs',
  rarity: 'EPIC',
  mainStat: { type: 'CRIT_RATE', value: 10 },
  subOptions: [
    { type: 'CRIT_DMG', value: 12 },
    { type: 'ATK%', value: 8 },
    { type: 'HP%', value: 5 },
    { type: 'DEF_FLAT', value: 20 },
  ],
  level: 20,
  exp: 0,
  maxExp: 8000,
};

describe('ResidueScore', () => {
  test('calculates the practical score from offensive substats', () => {
    expect(calculateResidueScore(residue)).toBe(49);
  });

  test('maps score into the configured grade bands', () => {
    expect(getResidueScoreGrade(19.9).grade).toBe('C');
    expect(getResidueScoreGrade(20).grade).toBe('B');
    expect(getResidueScoreGrade(35).grade).toBe('A');
    expect(getResidueScoreGrade(50).grade).toBe('S');
    expect(getResidueScoreGrade(65).grade).toBe('SS');
  });

  test('resolves residue slot ids from itemId', () => {
    expect(getResidueSlotId(residue)).toBe('legs');
    expect(isResidueSlotCompatible(residue, 4)).toBe(true);
    expect(isResidueSlotCompatible(residue, 0)).toBe(false);
  });
});
