import demonFormsData from '../data/master/demonForms.json';
import type { DemonFormData, DemonRiskType } from '../types/game';
import {
  DEMON_ACTION_LIMIT,
  activateDemonMode,
  canActivateDemonMode,
  clampDemonGauge,
  consumeDemonAction,
  getDemonActionHitCount,
  getDemonDamageMultiplier,
  getDemonIncomingDamageMultiplier,
  getDemonRiskLabel,
  isDemonStatusImmune,
  markDemonUltimateUsed,
  shouldBypassDefense,
  shouldIgnoreResistance,
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

  test('clampDemonGauge clamps to [0, 100] and rounds', () => {
    expect(clampDemonGauge(-10)).toBe(0);
    expect(clampDemonGauge(0)).toBe(0);
    expect(clampDemonGauge(50)).toBe(50);
    expect(clampDemonGauge(99.7)).toBe(100);
    expect(clampDemonGauge(100)).toBe(100);
    expect(clampDemonGauge(150)).toBe(100);
  });

  test('activateDemonMode returns inactive state for null form or insufficient gauge', () => {
    const nullForm = activateDemonMode(null, 100);
    expect(nullForm.isDemonMode).toBe(false);
    expect(nullForm.gauge).toBe(100);
    expect(nullForm.actionsRemaining).toBe(0);

    const lowGauge = activateDemonMode(DEMON_FORMS.berserker, 50);
    expect(lowGauge.isDemonMode).toBe(false);
    expect(lowGauge.gauge).toBe(50);
  });

  test('AV割り込み: getDemonActionHitCount by form and attack type', () => {
    // TRIPLE_HIT (berserker) — physical×3, non-physical×1
    expect(getDemonActionHitCount(DEMON_FORMS.berserker, 'SLASH')).toBe(3);
    expect(getDemonActionHitCount(DEMON_FORMS.berserker, 'STRIKE')).toBe(3);
    expect(getDemonActionHitCount(DEMON_FORMS.berserker, 'PROJECTILE')).toBe(3);
    expect(getDemonActionHitCount(DEMON_FORMS.berserker, 'MAGIC')).toBe(1);
    expect(getDemonActionHitCount(DEMON_FORMS.berserker, 'SUMMON')).toBe(1);

    // MIRAGE_CHAIN (rogue) — physical×2, non-physical×1
    expect(getDemonActionHitCount(DEMON_FORMS.rogue, 'SLASH')).toBe(2);
    expect(getDemonActionHitCount(DEMON_FORMS.rogue, 'PROJECTILE')).toBe(2);
    expect(getDemonActionHitCount(DEMON_FORMS.rogue, 'MAGIC')).toBe(1);

    // MIRAGE_CHAIN (trickster) — same rule
    expect(getDemonActionHitCount(DEMON_FORMS.trickster, 'SLASH')).toBe(2);
    expect(getDemonActionHitCount(DEMON_FORMS.trickster, 'MAGIC')).toBe(1);

    // Other effects (warrior, archmage) — always 1
    expect(getDemonActionHitCount(DEMON_FORMS.warrior, 'SLASH')).toBe(1);
    expect(getDemonActionHitCount(DEMON_FORMS.archmage, 'MAGIC')).toBe(1);

    // null form — always 1
    expect(getDemonActionHitCount(null, 'SLASH')).toBe(1);
  });

  test('魔神技: MAGIC_OVERDRIVE adds 0.35 bonus only for MAGIC/SUMMON', () => {
    // archmage has MAGIC_OVERDRIVE flag; atk=1.5
    // MAGIC: 1 + 1.5 + 0.35 = 2.85
    // SLASH: 1 + 1.5 + 0    = 2.5
    const magicMult = getDemonDamageMultiplier(DEMON_FORMS.archmage, 'MAGIC');
    const slashMult = getDemonDamageMultiplier(DEMON_FORMS.archmage, 'SLASH');
    expect(magicMult).toBeCloseTo(2.85, 5);
    expect(slashMult).toBeCloseTo(2.5, 5);
    expect(magicMult - slashMult).toBeCloseTo(0.35, 5);

    // null form → always 1
    expect(getDemonDamageMultiplier(null, 'MAGIC')).toBe(1);
  });

  test('shouldBypassDefense detects IGNORE_DEF flag in ultimateSkill', () => {
    expect(shouldBypassDefense(null)).toBe(false);
    expect(shouldBypassDefense(DEMON_FORMS.dark_knight)).toBe(true);   // IGNORE_DEF, SHIELD_REND
    expect(shouldBypassDefense(DEMON_FORMS.berserker)).toBe(true);     // IGNORE_DEF
    expect(shouldBypassDefense(DEMON_FORMS.warrior)).toBe(false);      // SHIELD_REND only
    expect(shouldBypassDefense(DEMON_FORMS.archmage)).toBe(false);     // IGNORE_RESISTANCE only
  });

  test('shouldIgnoreResistance detects IGNORE_RESISTANCE flag in effectA', () => {
    expect(shouldIgnoreResistance(null)).toBe(false);
    expect(shouldIgnoreResistance(DEMON_FORMS.archmage)).toBe(true);   // MAGIC_OVERDRIVE, IGNORE_RESISTANCE
    expect(shouldIgnoreResistance(DEMON_FORMS.berserker)).toBe(false); // empty flags
    expect(shouldIgnoreResistance(DEMON_FORMS.warrior)).toBe(false);   // DARK_EDGE only
  });

  test('getDemonRiskLabel returns correct Japanese label for each risk type', () => {
    expect(getDemonRiskLabel('SELF_DAMAGE')).toBe('自傷');
    expect(getDemonRiskLabel('ENERGY_DRAIN')).toBe('過剰消費');
    expect(getDemonRiskLabel('GLASS_CANNON')).toBe('紙装甲');
    expect(getDemonRiskLabel('SETUP_DEPENDENT')).toBe('仕込み依存');
    expect(getDemonRiskLabel(null as unknown as DemonRiskType)).toBe('なし');
  });
});
