import { calculatePartyTribeSynergy, getActiveSynergies } from './TribeSynergySystem';
import type { MonsterData } from '../types/game';

const BASE_STATS = { hp: 100, atk: 10, def: 10, spd: 50, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 0 };

function makeMonster(tribe: MonsterData['tribe'], id = tribe): MonsterData {
  return { id, name: id, tribe, cost: 1, stats: BASE_STATS, resistances: {} };
}

describe('calculatePartyTribeSynergy', () => {
  it('空パーティ → 全フィールド undefined', () => {
    const b = calculatePartyTribeSynergy([]);
    expect(Object.keys(b)).toHaveLength(0);
  });

  it('UNDEAD×2 → Layer1: hpRegenPct=2', () => {
    const b = calculatePartyTribeSynergy([makeMonster('UNDEAD'), makeMonster('UNDEAD')]);
    expect(b.hpRegenPct).toBe(2);
    expect(b.ailmentImmune).toBeUndefined();
  });

  it('UNDEAD×3 → Layer2: hpRegenPct=5, ailmentImmune', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('UNDEAD'), makeMonster('UNDEAD'), makeMonster('UNDEAD'),
    ]);
    expect(b.hpRegenPct).toBe(5);
    expect(b.ailmentImmune).toContain('POISON');
    expect(b.ailmentImmune).toContain('BLEED');
  });

  it('BEAST×2 → spdBonus=15 (Layer1のみ)', () => {
    const b = calculatePartyTribeSynergy([makeMonster('BEAST'), makeMonster('BEAST')]);
    expect(b.spdBonus).toBe(15);
    expect(b.energyPerTurn).toBeUndefined();
  });

  it('BEAST×3 → Layer2: spdBonus=30, energyPerTurn=15', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('BEAST'), makeMonster('BEAST'), makeMonster('BEAST'),
    ]);
    expect(b.spdBonus).toBe(30);
    expect(b.energyPerTurn).toBe(15);
  });

  it('HUMANOID×3 → critRateBonus=10, critDmgBonus=30', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('HUMANOID'), makeMonster('HUMANOID'), makeMonster('HUMANOID'),
    ]);
    expect(b.critRateBonus).toBe(10);
    expect(b.critDmgBonus).toBe(30);
  });

  it('DRAGON×3 → elementDmgBonus=25, demonGaugePerTurn=5', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('DRAGON'), makeMonster('DRAGON'), makeMonster('DRAGON'),
    ]);
    expect(b.elementDmgBonus).toBe(25);
    expect(b.demonGaugePerTurn).toBe(5);
  });

  it('ORC×3 → defenseReducePct=25, absorbDmgPct=10', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('ORC'), makeMonster('ORC'), makeMonster('ORC'),
    ]);
    expect(b.defenseReducePct).toBe(25);
    expect(b.absorbDmgPct).toBe(10);
  });

  it('UNDEAD+DEMON クロス共鳴 → ailmentDurationBonus=1, effectHitBonus=10', () => {
    const b = calculatePartyTribeSynergy([makeMonster('UNDEAD'), makeMonster('DEMON')]);
    expect(b.ailmentDurationBonus).toBe(1);
    expect(b.effectHitBonus).toBe(10);
  });

  it('DEMON(2)+DRAGON(1) → darkDmgBonus=10 (Layer1) + fireDarkDmgBonus=20 (Cross)', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('DEMON', 'DEMON_1'), makeMonster('DEMON', 'DEMON_2'), makeMonster('DRAGON'),
    ]);
    expect(b.darkDmgBonus).toBe(10);
    expect(b.fireDarkDmgBonus).toBe(20);
  });

  it('1+1+1 で2クロス共鳴同時発動 (UNDEAD+DEMON, DEMON+DRAGON)', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('UNDEAD'), makeMonster('DEMON'), makeMonster('DRAGON'),
    ]);
    expect(b.ailmentDurationBonus).toBe(1);
    expect(b.effectHitBonus).toBe(10);
    expect(b.fireDarkDmgBonus).toBe(20);
  });

  it('BEAST+DRAGON クロス共鳴 → avBonus=-20, elementDmgBonus+10', () => {
    const b = calculatePartyTribeSynergy([makeMonster('BEAST'), makeMonster('DRAGON')]);
    expect(b.avBonus).toBe(-20);
    expect(b.elementDmgBonus).toBe(10);
  });

  it('UNDEAD×2 + DEMON(1) → Layer1 + クロス共鳴の両方を享受', () => {
    const b = calculatePartyTribeSynergy([
      makeMonster('UNDEAD', 'U1'), makeMonster('UNDEAD', 'U2'), makeMonster('DEMON'),
    ]);
    expect(b.hpRegenPct).toBe(2);
    expect(b.effectHitBonus).toBe(10);
    expect(b.ailmentDurationBonus).toBe(1);
  });
});

describe('getActiveSynergies', () => {
  it('空パーティ → 空配列', () => {
    expect(getActiveSynergies([])).toHaveLength(0);
  });

  it('UNDEAD×3 → Layer2 エントリ1件', () => {
    const synergies = getActiveSynergies([
      makeMonster('UNDEAD'), makeMonster('UNDEAD'), makeMonster('UNDEAD'),
    ]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].layer).toBe(2);
    expect(synergies[0].key).toBe('UNDEAD_FULL');
    expect(synergies[0].name).toBe('骸軍の不滅陣');
  });

  it('UNDEAD×2 + DEMON → Layer1 + Layer3 クロス共鳴', () => {
    const synergies = getActiveSynergies([
      makeMonster('UNDEAD', 'U1'), makeMonster('UNDEAD', 'U2'), makeMonster('DEMON'),
    ]);
    const keys = synergies.map(s => s.key);
    expect(keys).toContain('UNDEAD_PART');
    expect(keys).toContain('CROSS_UNDEAD_DEMON');
  });

  it('1+1+1 の3種族 → 各クロス共鳴のみ', () => {
    const synergies = getActiveSynergies([
      makeMonster('DEMON'), makeMonster('DRAGON'), makeMonster('BEAST'),
    ]);
    const keys = synergies.map(s => s.key);
    expect(keys).toContain('CROSS_DEMON_DRAGON');
    expect(keys).toContain('CROSS_BEAST_DRAGON');
    expect(synergies.every(s => s.layer === 3)).toBe(true);
  });
});
