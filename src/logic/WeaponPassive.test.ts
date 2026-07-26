import { evaluateWeaponPassive, WeaponPassiveContext } from './WeaponPassive';
import type { CharacterData, WeaponPassive } from '../types/game';
import { makeBaseStats, makeCharacter } from '../testing/factories';

const makePlayer = (rank = 0): CharacterData => makeCharacter({
  id: 'player',
  name: 'アルド',
  stats: makeBaseStats({ hp: 5000, atk: 1000, def: 500, critRate: 10 }),
  equipment: {
    weapon: rank > 0 ? { id: 'w1', name: 'test', type: 'WEAPON', rarity: 'SR', rank, stats: {}, isUnique: false } as any : null,
    sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null,
  },
  jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
  currentEnergy: 50,
});

describe('evaluateWeaponPassive', () => {
  it('systemTag なしパッシブは null を返す', () => {
    const passive: WeaponPassive = { nameJa: 'テスト', descTemplate: '{value}', values: [5] };
    const ctx: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer() };
    expect(evaluateWeaponPassive(passive, ctx)).toBeNull();
  });

  it('SOUL_SHATTER: ON_SHIELD_BREAK 時のみ発動', () => {
    const passive: WeaponPassive = { nameJa: '霊魂砕き', descTemplate: '{value}', values: [0.3, 0.4, 0.5, 0.6, 0.7], systemTag: 'SOUL_SHATTER' };

    const noBreak: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: makePlayer(), didBreakShield: false };
    expect(evaluateWeaponPassive(passive, noBreak)).toBeNull();

    const withBreak: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: makePlayer(), didBreakShield: true };
    const result = evaluateWeaponPassive(passive, withBreak);
    expect(result).not.toBeNull();
    expect(result!.bonusDamage).toBeGreaterThan(0);
  });

  it('SOUL_SHATTER: rank 1/5 は values の Rank1/Rank5 を直接参照する', () => {
    const passive: WeaponPassive = { nameJa: '霊魂砕き', descTemplate: '{value}', values: [0.3, 0.4, 0.5, 0.6, 0.7], systemTag: 'SOUL_SHATTER' };

    const rank1 = makePlayer(1);
    const rank5 = makePlayer(5);
    const ctx1: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: rank1, didBreakShield: true };
    const ctx5: WeaponPassiveContext = { trigger: 'ON_SHIELD_BREAK', actor: rank5, didBreakShield: true };

    const r1 = evaluateWeaponPassive(passive, ctx1)!;
    const r5 = evaluateWeaponPassive(passive, ctx5)!;
    expect(r1.bonusDamage).toBe(300);
    expect(r5.bonusDamage).toBe(700);
  });

  it('ACTION_VALUE: 会心時のみ avReduction を返す', () => {
    const passive: WeaponPassive = { nameJa: '早駆け', descTemplate: '{value}', values: [1, 2, 3, 4, 5], systemTag: 'ACTION_VALUE' };

    const noCrit: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isCritical: false };
    expect(evaluateWeaponPassive(passive, noCrit)).toBeNull();

    const withCrit: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isCritical: true };
    const result = evaluateWeaponPassive(passive, withCrit);
    expect(result).not.toBeNull();
    expect(result!.avReduction).toBeGreaterThan(0);

    const rank5: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(5), isCritical: true };
    expect(evaluateWeaponPassive(passive, rank5)!.avReduction).toBe(5);
  });

  it('DEMON_MODE: isDemonMode=false 時はゲージ増加を返す', () => {
    const passive: WeaponPassive = { nameJa: '魔神呼応', descTemplate: '{value}', values: [5, 8, 11, 14, 20], systemTag: 'DEMON_MODE' };
    const ctx: WeaponPassiveContext = { trigger: 'ON_ATTACK', actor: makePlayer(), isDemonMode: false };
    const result = evaluateWeaponPassive(passive, ctx);
    expect(result).not.toBeNull();
    expect(result!.demonGaugeDelta).toBeGreaterThan(0);
    expect(result!.bonusDamage).toBeUndefined();

    const rank5 = evaluateWeaponPassive(passive, { trigger: 'ON_ATTACK', actor: makePlayer(5), isDemonMode: false });
    expect(rank5!.demonGaugeDelta).toBe(20);
  });

  it('DEMON_MODE: condition=DEMON_ACTIVE かつ isDemonMode=true 時は bonusDamage を返す', () => {
    const passive: WeaponPassive = {
      nameJa: '魔神昂揚',
      descTemplate: '{value}',
      values: [5, 8, 11, 14, 20],
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
