import fs from 'fs';
import path from 'path';
import {
  createOrchestratedContentPackage,
  invalidateContentPipelineStage,
  runContentPipelineStage,
  type ContentOrchestrationRequest,
} from './packageOrchestrator';

function request(): ContentOrchestrationRequest {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/requests/phase5-boss-signature-weapon.request.json'), 'utf8')) as ContentOrchestrationRequest;
}

const emptyGameplay = {
  existingEnemies: {}, existingMonsters: {}, existingSkills: {}, existingItems: {}, existingJobs: {}, existingStages: {}, materials: {},
};

describe('Package Orchestrator', () => {
  it('expands one boss + signature weapon request into the complete target graph', () => {
    const pkg = createOrchestratedContentPackage(request(), '2026-08-01T00:00:00.000Z');
    expect(pkg.targets.map(target => target.kind)).toEqual(['combat-unit', 'skill', 'weapon', 'encounter']);
    expect(pkg.deliverables).toHaveLength(23);
    expect(pkg.assets).toHaveLength(8);
    expect(pkg.presentation).toHaveLength(2);
    expect(pkg.dependencies.length).toBeGreaterThan(0);
    expect(pkg.orchestration?.stages.map(stage => stage.id)).toEqual(['LORE', 'STATS', 'SKILLS', 'ASSETS', 'PRESENTATION', 'ACQUISITION', 'VALIDATION']);
    const knownTargets = new Set(pkg.targets.map(target => `target:${target.id}`));
    for (const dependency of pkg.dependencies.filter(item => item.from.startsWith('target:') || item.to.startsWith('target:'))) {
      expect(knownTargets.has(dependency.from) || dependency.from.startsWith('deliverable:')).toBe(true);
      expect(knownTargets.has(dependency.to) || dependency.to.startsWith('deliverable:')).toBe(true);
    }
  });

  it('blocks Chapter 2+ request planning at the package boundary', () => {
    const deferred = request();
    deferred.chapter = 2;
    expect(() => createOrchestratedContentPackage(deferred)).toThrow('第2章以降はDEFERRED');
  });

  it('records a partial failure and blocks dependent stages', () => {
    const pkg = createOrchestratedContentPackage(request(), '2026-08-01T00:00:00.000Z');
    const result = runContentPipelineStage(pkg, 'STATS', { gameplay: emptyGameplay }, '2026-08-01T00:01:00.000Z');
    expect(result.stage.state).toBe('FAIL');
    expect(result.package.orchestration?.state).toBe('PARTIAL');
    expect(result.package.orchestration?.stages.find(stage => stage.id === 'SKILLS')?.state).toBe('BLOCKED');
    expect(result.package.orchestration?.stages.find(stage => stage.id === 'ASSETS')?.state).toBe('PENDING');
  });

  it('invalidates only the selected stage and its downstream consumers', () => {
    const pkg = createOrchestratedContentPackage(request(), '2026-08-01T00:00:00.000Z');
    if (!pkg.orchestration) throw new Error('missing orchestration');
    for (const stage of pkg.orchestration.stages) stage.state = 'PASS';
    pkg.orchestration.state = 'READY';
    const next = invalidateContentPipelineStage(pkg, 'ASSETS');
    const states = Object.fromEntries(next.orchestration?.stages.map(stage => [stage.id, stage.state]) ?? []);
    expect(states).toMatchObject({ LORE: 'PASS', STATS: 'PASS', SKILLS: 'PASS', ASSETS: 'PENDING', PRESENTATION: 'PENDING', ACQUISITION: 'PASS', VALIDATION: 'PENDING' });
    expect(next.orchestration?.state).toBe('INCOMPLETE');
  });
});
