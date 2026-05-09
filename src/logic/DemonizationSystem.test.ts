import demonFormsData from '../data/master/demonForms.json';
import type { DemonFormData } from '../types/game';
import {
  DEMON_ACTION_LIMIT,
  activateDemonMode,
  canActivateDemonMode,
  consumeDemonAction,
  getDemonActionHitCount,
  getDemonDamageMultiplier,
  getDemonIncomingDamageMultiplier,
  isDemonStatusImmune,
  markDemonUltimateUsed,
} from './DemonizationSystem';

const DEMON_FORMS = demonFormsData as Record<string, DemonFormData>;

describe('DemonizationSystem', () => {
  test('activates only at full gauge and consumes the gauge', () => {
    expect(canActivateDemonMode(99, false)).toBe(false);
    expect(canActivateDemonMode(100, false)).toBe(true);

    const state = activateDemonMode(DEMON_FORMS.berserker, 100);
    expect(state.isDemonMode).toBe(true);
    expect(state.gauge).toBe(0);
    expect(state.actionsRemaining).toBe(DEMON_ACTION_LIMIT);
    expect(state.ultimateUsed).toBe(false);
  });

  test('counts down by player actions and grants status immunity only while active', () => {
    let state = activateDemonMode(DEMON_FORMS.warrior, 100);
    expect(isDemonStatusImmune(state)).toBe(true);

    state = consumeDemonAction(state);
    state = consumeDemonAction(state);
    expect(state.isDemonMode).toBe(true);
    expect(state.actionsRemaining).toBe(1);

    state = consumeDemonAction(state);
    expect(state.isDemonMode).toBe(false);
    expect(isDemonStatusImmune(state)).toBe(false);
  });

  test('applies job-specific Effect B and risks', () => {
    expect(getDemonActionHitCount(DEMON_FORMS.berserker, 'SLASH')).toBe(3);
    expect(getDemonIncomingDamageMultiplier(DEMON_FORMS.berserker)).toBe(2);
    expect(getDemonActionHitCount(DEMON_FORMS.archmage, 'MAGIC')).toBe(1);
    expect(getDemonIncomingDamageMultiplier(DEMON_FORMS.archmage)).toBe(1);
  });

  test('resolves Effect A damage multipliers and one-use ultimate state', () => {
    const berserkerMult = getDemonDamageMultiplier(DEMON_FORMS.berserker, 'SLASH');
    const archmageMult = getDemonDamageMultiplier(DEMON_FORMS.archmage, 'MAGIC');
    expect(berserkerMult).toBeGreaterThan(2);
    expect(archmageMult).toBeGreaterThan(2);

    const state = markDemonUltimateUsed(activateDemonMode(DEMON_FORMS.archmage, 100));
    expect(state.ultimateUsed).toBe(true);
  });
});
