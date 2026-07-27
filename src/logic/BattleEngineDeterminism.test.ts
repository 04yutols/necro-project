import { BattleEngine } from './BattleEngine';
import { createSeededRandom } from './SeededRandom';
import { makeBaseStats, makeCharacter, makeMonster } from '../testing/factories';

describe('BattleEngine deterministic RNG injection', () => {
  test('replays critical and hate-target rolls with the same seed', () => {
    const makeFixture = () => ({
      player: makeCharacter({ stats: makeBaseStats({ critRate: 50 }) }),
      party: [
        makeMonster({ id: 'front' }),
        makeMonster({ id: 'middle' }),
        makeMonster({ id: 'back' }),
      ],
      target: makeMonster({ id: 'enemy', name: 'Enemy', stats: makeBaseStats({ hp: 999, atk: 10 }) }),
    });
    const leftFixture = makeFixture();
    const rightFixture = makeFixture();
    const left = new BattleEngine(leftFixture.player, leftFixture.party, 'NONE', undefined, undefined, createSeededRandom('same'));
    const right = new BattleEngine(rightFixture.player, rightFixture.party, 'NONE', undefined, undefined, createSeededRandom('same'));

    const leftLogs = left.simulateAction('PHYSICAL_ATTACK', leftFixture.target);
    const rightLogs = right.simulateAction('PHYSICAL_ATTACK', rightFixture.target);

    expect(leftLogs.map(log => ({ action: log.action, target: log.targetName, damage: log.damage, critical: log.isCritical })))
      .toEqual(rightLogs.map(log => ({ action: log.action, target: log.targetName, damage: log.damage, critical: log.isCritical })));
  });
});
