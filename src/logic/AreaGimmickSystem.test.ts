import stagesData from '../data/master/stages.json';
import type { StageData } from '../types/game';
import {
  applyAreaGimmickToPlayer,
  resolveStageAreaGimmick,
} from './AreaGimmickSystem';

const stages = stagesData as Record<string, StageData>;

describe('AreaGimmickSystem', () => {
  test('resolves missing stage gimmick as NONE', () => {
    expect(resolveStageAreaGimmick(null)).toBe('NONE');
    expect(resolveStageAreaGimmick({})).toBe('NONE');
  });

  test('applies slip damage from current HP with synergy mitigation', () => {
    const result = applyAreaGimmickToPlayer({
      areaGimmick: 'SLIP_DAMAGE',
      currentHp: 1000,
      maxHp: 2000,
      defenseReducePct: 20,
    });

    expect(result.triggered).toBe(true);
    expect(result.damage).toBe(40);
    expect(result.nextHp).toBe(960);
    expect(result.statusEffects).toEqual([]);
  });

  test('applies poison for status ailment gimmick', () => {
    const result = applyAreaGimmickToPlayer({
      areaGimmick: 'STATUS_AILMENT',
      currentHp: 1000,
      maxHp: 1000,
      statusEffects: [],
    });

    expect(result.triggered).toBe(true);
    expect(result.appliedAilment).toBe('POISON');
    expect(result.statusEffects).toEqual([
      expect.objectContaining({ type: 'POISON', remainingTurns: 3, stackCount: 1 }),
    ]);
  });

  test('demon mode blocks status ailment gimmick', () => {
    const result = applyAreaGimmickToPlayer({
      areaGimmick: 'STATUS_AILMENT',
      currentHp: 1000,
      maxHp: 1000,
      isDemonMode: true,
      statusEffects: [],
    });

    expect(result.immune).toBe(true);
    expect(result.appliedAilment).toBeUndefined();
    expect(result.statusEffects).toEqual([]);
  });

  test('master stages define valid area gimmicks', () => {
    Object.entries(stages).forEach(([stageId, stage]) => {
      expect(['NONE', 'SLIP_DAMAGE', 'STATUS_AILMENT']).toContain(resolveStageAreaGimmick(stage));
      if (stage.area >= 2 && stage.nodeType !== 'SAFE') {
        if (!stage.areaGimmick) throw new Error(`${stageId} should declare an area gimmick`);
      }
    });
  });
});
