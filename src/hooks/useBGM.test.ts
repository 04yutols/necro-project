import { resolveScene } from './useBGM';

describe('resolveScene', () => {
  test('uses boss battle BGM for Yomi milestone boss floors', () => {
    expect(resolveScene({ currentTab: 'BATTLE', isInBattle: true, activeStageId: 'yomi_b10' })).toBe('BATTLE_BOSS');
    expect(resolveScene({ currentTab: 'BATTLE', isInBattle: true, activeStageId: 'yomi_b20' })).toBe('BATTLE_BOSS');
  });

  test('keeps non-boss Yomi floors on normal battle BGM', () => {
    expect(resolveScene({ currentTab: 'BATTLE', isInBattle: true, activeStageId: 'yomi_b09' })).toBe('BATTLE_NORMAL');
    expect(resolveScene({ currentTab: 'BATTLE', isInBattle: true, activeStageId: 'yomi_b11' })).toBe('BATTLE_NORMAL');
  });

  test('keeps existing boss id convention intact', () => {
    expect(resolveScene({ currentTab: 'BATTLE', isInBattle: true, activeStageId: 'area1_boss' })).toBe('BATTLE_BOSS');
  });
});
