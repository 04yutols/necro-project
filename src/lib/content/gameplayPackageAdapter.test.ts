import type { ContentPackage } from './contentPackage';
import { materializeGameplayPackage } from './gameplayPackageAdapter';

const pkg: ContentPackage = {
  schemaVersion: 2,
  id: 'phase2_adapter_test',
  title: 'Phase 2 adapter test',
  revision: 1,
  chapter: 1,
  status: 'DRAFT',
  brief: { playerExperience: '試験', themes: ['亡国'], mustInclude: [], avoid: [] },
  targets: [{ id: 'phase2_adapter_skill', kind: 'skill', loreRefs: [] }],
  lore: { registryRefs: [], entries: [], relationships: [], timelineEvents: [] },
  deliverables: [{
    id: 'phase2_adapter_mechanics', ownerId: 'phase2_adapter_skill', scope: 'skill', kind: 'mechanics',
    required: true, state: 'READY', outputRefs: [],
    artifact: {
      authoringKind: 'skill',
      request: {
        id: 'phase2_adapter_skill', name: '黒霧斬り', description: '黒霧をまとった斬撃。',
        type: 'PHYSICAL', targetType: 'SINGLE', element: 'DARK', attackType: 'SLASH',
        ownerKind: 'job', ownerId: 'warrior', tier: 1, potency: 'MID',
      },
      simulationTargets: {
        ttkTurns: { min: 1, max: 20 }, incomingDamagePct: { min: 0, max: 100 },
        aoeValue: { min: 0, max: 1.2 }, partyCost: { min: 0, max: 6 },
      },
    },
  }],
  dependencies: [], changes: [], assets: [], presentation: [], localization: [], evidence: [],
  provenance: {
    createdAt: '2026-07-31T00:00:00.000Z', createdBy: { name: 'test', type: 'codex' },
    generator: { name: 'jest' }, prompts: [], references: [], hashAlgorithm: 'sha256',
  },
  review: { history: [], blockers: [] },
};

const ctx = {
  existingEnemies: {
    grave_soldier: { name: 'Grave Soldier', tribe: 'UNDEAD', tier: 'MINION', stats: { hp: 50, atk: 5, def: 5, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: {} },
  },
  existingMonsters: {},
  existingSkills: {},
  existingItems: {},
  existingJobs: { warrior: { name: 'Warrior', displayName: '戦士', tier: 1, category: 'PHYSICAL', baseAttackType: 'SLASH' } },
  materials: {},
};

describe('gameplayPackageAdapter', () => {
  test('materializes request artifacts into changes, rationale, and BattleEngine evidence', () => {
    const result = materializeGameplayPackage(pkg, ctx, '2026-07-31T01:00:00.000Z');

    expect(result.package.status).toBe('DRAFT');
    expect(result.package.revision).toBe(2);
    expect(result.generatedChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'skill', id: 'phase2_adapter_skill' }),
    ]));
    expect(result.generatedEvidence[0]).toEqual(expect.objectContaining({
      ownerId: 'phase2_adapter_skill', kind: 'skill-balance', createdAt: '2026-07-31T01:00:00.000Z',
    }));
    expect(result.package.deliverables[0].artifact).toHaveProperty('authored.rationale');
    expect(result.package.deliverables[0].artifact).toHaveProperty('simulation.engine', 'BattleEngine');
  });

  test('refuses to rewrite a reviewed package', () => {
    expect(() => materializeGameplayPackage({ ...pkg, status: 'REVIEWED' }, ctx)).toThrow('only mutates DRAFT');
  });

  test('resolves an enemy reference to a skill authored later in the same package', () => {
    const linked: ContentPackage = {
      ...pkg,
      targets: [
        { id: 'phase2_linked_enemy', kind: 'combat-unit', loreRefs: [] },
        ...pkg.targets,
      ],
      deliverables: [
        {
          id: 'phase2_linked_enemy_stats', ownerId: 'phase2_linked_enemy', scope: 'combat-unit', kind: 'stats',
          required: true, state: 'READY', outputRefs: [],
          artifact: {
            authoringKind: 'combat-unit',
            request: {
              kind: 'ENEMY', id: 'phase2_linked_enemy', name: 'Linked Enemy', description: '同一package参照試験。',
              role: 'STRIKER', level: 10, tribe: 'UNDEAD', tier: 'MINION', cost: 1, maxEnergy: 30,
              skillIds: ['phase2_adapter_skill'], weaknesses: ['LIGHT'], resistances: ['DARK'],
            },
            simulationTargets: { ttkTurns: { min: 1, max: 50 }, incomingDamagePct: { min: 0, max: 100 }, aoeValue: { min: 0, max: 2 }, partyCost: { min: 0, max: 6 } },
          },
        },
        ...pkg.deliverables,
      ],
    };
    const result = materializeGameplayPackage(linked, ctx, '2026-07-31T01:00:00.000Z');

    expect(result.generatedChanges.map(change => change.id)).toEqual(expect.arrayContaining(['phase2_linked_enemy', 'phase2_adapter_skill']));
    expect(result.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'FAIL', field: 'necromance.skillIds' }),
    ]));
  });
});
