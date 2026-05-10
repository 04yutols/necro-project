import { evaluateWeaponPassive, WeaponPassiveContext } from './WeaponPassive';
import type { CharacterData, WeaponPassive } from '../types/game';

const makePlayer = (rank = 0): CharacterData => ({
  id: 'player',
  name: 'アルド',
  currentJobId: 'warrior',
  category: 'PHYSICAL',
  stats: { hp: 5000, atk: 1000, def: 500, spd: 100, critRate: 10, critDmg: 150, effectHit: 0, effectRes: 0 },
  passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveSpdBonus: 0, passiveCritRateBonus: 0, passiveCritDmgBonus: 0, passiveHpBonus: 0 },
  equipment: {
    weapon: rank > 0 ? { id: 'w1', name: 'test', type: 'WEAPON', rarity: 'SR', rank, stats: {}, isUnique: false } as any : null,
    sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null,
  },
  baseResistances: {},
  jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
  isAwakened: false,
  clearedStages: [],
  currentEnergy: 50,
  maxEnergy: 100,
  elementDmgBoosts: {},
});

describe('evaluateWeaponPassive', () => {
  it('systemTag なしパッシブは null を返す', () => {
    const passive: WeaponPassive = { nameJa: 'テスト', descTemplate: '{value}', values: [5] };
    const ctx: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer() };
    expect(evaluateWeaponPassive(passive, ctx)).toBeNull();
  });

  it('SOUL_SHATTER: ON_SHIELD_BREAK 時のみ発動', () => {
    const passive: WeaponPassive = { nameJa: '霊魂砕き', descTemplate: '{value}', values: [0.3, 0.6], systemTag: 'SOUL_SHATTER' };

    const noBreak: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: makePlayer(), didBreakShield: false };
    expect(evaluateWeaponPassive(passive, noBreak)).toBeNull();

    const withBreak: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: makePlayer(), didBreakShield: true };
    const result = evaluateWeaponPassive(passive, withBreak);
    expect(result).not.toBeNull();
    expect(result!.bonusDamage).toBeGreaterThan(0);
  });

  it('SOUL_SHATTER: rank 0→5 でダメージ倍率が 2 倍になる', () => {
    const passive: WeaponPassive = { nameJa: '霊魂砕き', descTemplate: '{value}', values: [0.3, 0.6], systemTag: 'SOUL_SHATTER' };

    const rank0 = makePlayer(0);
    const rank5 = makePlayer(5);
    const ctx0: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: rank0, didBreakShield: true };
    const ctx5: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: rank5, didBreakShield: true };

    const r0 = evaluateWeaponPassive(passive, ctx0)!;
    const r5 = evaluateWeaponPassive(passive, ctx5)!;
    // rank5 bonus / rank0 bonus ≈ 0.6 / 0.3 = 2
    expect(r5.bonusDamage! / r0.bonusDamage!).toBeCloseTo(2, 0);
  });

  it('ACTION_VALUE: 会心時のみ avReduction を返す', () => {
    const passive: WeaponPassive = { nameJa: '早駆け', descTemplate: '{value}', values: [1, 2], systemTag: 'ACTION_VALUE' };

    const noCrit: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isCritical: false };
    expect(evaluateWeaponPassive(passive, noCrit)).toBeNull();

    const withCrit: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isCritical: true };
    const result = evaluateWeaponPassive(passive, withCrit);
    expect(result).not.toBeNull();
    expect(result!.avReduction).toBeGreaterThan(0);
  });

  it('DEMON_MODE: isDemonMode=false 時はゲージ増加を返す', () => {
    const passive: WeaponPassive = { nameJa: '魔神呼応', descTemplate: '{value}', values: [5, 10], systemTag: 'DEMON_MODE' };
    const ctx: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isDemonMode: false };
    const result = evaluateWeaponPassive(passive, ctx);
    expect(result).not.toBeNull();
    expect(result!.demonGaugeDelta).toBeGreaterThan(0);
    expect(result!.bonusDamage).toBeUndefined();
  });

  it('DEMON_MODE: condition=DEMON_ACTIVE かつ isDemonMode=true 時は bonusDamage を返す', () => {
    const passive: WeaponPassive = {
      nameJa: '魔神昂揚',
      descTemplate: '{value}',
      values: [5, 10],
      systemTag: 'DEMON_MODE',
      condition: 'DEMON_ACTIVE',
    };
    const ctxNoDemon: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isDemonMode: false };
    expect(evaluateWeaponPassive(passive, ctxNoDemon)).toBeNull();

    const ctxDemon: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isDemonMode: true };
    const result = evaluateWeaponPassive(passive, ctxDemon);
    expect(result).not.toBeNull();
    expect(result!.bonusDamage).toBeGreaterThan(0);
    expect(result!.demonGaugeDelta).toBeUndefined();
  });
});
