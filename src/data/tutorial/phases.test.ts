import { ALL_PHASES, BANNER_LABELS, PHASE_STEPS } from './phases';

describe('tutorial phases', () => {
  test('defines the six chapter-one onboarding phases in order', () => {
    expect(ALL_PHASES).toEqual([
      'BATTLE_BASICS',
      'NECRO_LAB',
      'PARTY_FORMATION',
      'JOB_CHANGE',
      'ABYSSAL_RESIDUE',
      'DEMONIZATION',
    ]);
  });

  test('each phase has at least one spotlight step and a banner label', () => {
    ALL_PHASES.forEach(phase => {
      expect(PHASE_STEPS[phase].length).toBeGreaterThan(0);
      expect(BANNER_LABELS[phase]).toBeTruthy();
    });
  });

  test('all steps have stable target ids and supported tab gates', () => {
    const tabs = new Set(['BATTLE', 'LAB', 'EQUIP', 'JOB']);
    ALL_PHASES.forEach(phase => {
      PHASE_STEPS[phase].forEach(step => {
        expect(step.targetId).toMatch(/^tut-/);
        if (step.requiredTab) {
          expect(tabs.has(step.requiredTab)).toBe(true);
        }
      });
    });
  });
});
