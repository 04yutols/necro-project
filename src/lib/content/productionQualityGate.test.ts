import phase4Fixture from '../../../content/packages/phase4-presentation-example.json';
import phase3Fixture from '../../../content/packages/phase3-visual-example.json';
import {
  auditContentProductionQuality,
  auditRuntimeQualityMetrics,
  type ProductionQualityContext,
} from './productionQualityGate';
import type { ContentPackage } from './contentPackage';

const sfxProfileKeys = new Set(['rune_cast', 'spectral_flight', 'abyss_impact', 'blade_cut']);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function context(overrides: Partial<ProductionQualityContext> = {}): ProductionQualityContext {
  return {
    sfxProfileKeys,
    stageIds: new Set(['area1_node1']),
    enemyIds: new Set(['grave_soldier']),
    itemIds: new Set(),
    materialIds: new Set(['dark_essence']),
    ...overrides,
  };
}

describe('production quality gate', () => {
  test('SFXを伴う演出に日英字幕を必須化する', () => {
    const pkg = clone(phase4Fixture) as ContentPackage;
    const findings = auditContentProductionQuality(pkg, context({ repositoryFiles: new Set(pkg.assets.map(item => item.sourcePath).filter((item): item is string => Boolean(item))) }));
    expect(findings.some(item => item.level === 'FAIL' && item.field === 'subtitle.ja')).toBe(true);
    expect(findings.some(item => item.level === 'FAIL' && item.field === 'subtitle.en')).toBe(true);

    pkg.localization.push(
      { id: 'phase4_subtitle_ja', ownerId: 'phase4_ashen_crown', locale: 'ja', kind: 'subtitle', text: '灰の刃が三度鳴り、王冠が砕ける。' },
      { id: 'phase4_subtitle_en', ownerId: 'phase4_ashen_crown', locale: 'en', kind: 'subtitle', text: 'Three ash blades ring out as the crown breaks.' },
    );
    const complete = auditContentProductionQuality(pkg, context({ repositoryFiles: new Set(pkg.assets.map(item => item.sourcePath).filter((item): item is string => Boolean(item))) }));
    expect(complete.filter(item => item.level === 'FAIL')).toEqual([]);
  });

  test('存在しないSFX profileと未登録mediaをFAILにする', () => {
    const pkg = clone(phase4Fixture) as ContentPackage;
    pkg.localization.push(
      { id: 'phase4_subtitle_ja', ownerId: 'phase4_ashen_crown', locale: 'ja', kind: 'subtitle', text: '三度の衝撃音。' },
      { id: 'phase4_subtitle_en', ownerId: 'phase4_ashen_crown', locale: 'en', kind: 'subtitle', text: 'Three impacts.' },
    );
    pkg.presentation[0].sfx!.cues[0].profileKey = 'missing_profile';
    const findings = auditContentProductionQuality(pkg, context({ packageMediaFiles: new Set(['content/packages/phase4_presentation_example/assets/orphan.png']) }));
    expect(findings.some(item => item.field.includes('profileKey') && item.message.includes('missing_profile'))).toBe(true);
    expect(findings.some(item => item.field === 'orphan' && item.message.includes('orphan.png'))).toBe(true);
  });

  test('武器drop-sourceが実itemとstageへ接続されていない場合はFAILにする', () => {
    const pkg = clone(phase3Fixture) as ContentPackage;
    pkg.deliverables.push({
      id: 'codex_ash_blade_drop', ownerId: 'codex_ash_blade', scope: 'acquisition-link', kind: 'drop-source', required: true, state: 'READY', outputRefs: [],
      artifact: { stageId: 'missing_stage', itemId: 'different_weapon' },
    });
    const findings = auditContentProductionQuality(pkg, context());
    expect(findings.some(item => item.category === 'ACQUISITION' && item.field === 'stageId')).toBe(true);
    expect(findings.some(item => item.category === 'ACQUISITION' && item.field === 'drop-source')).toBe(true);
  });

  test('端末計測のload・frame・memory・overflow違反を列挙する', () => {
    const findings = auditRuntimeQualityMetrics({
      id: 'iphone', viewportWidth: 390, documentWidth: 410, clippedTextCount: 2, undersizedTargetCount: 1,
      initialTransferBytes: 2_000_000, heapUsedBytes: 140 * 1024 * 1024, heapGrowthBytes: 20 * 1024 * 1024,
      frameP95Ms: 30, longFrameCount: 4, consoleErrorCount: 1, reducedMotionViolations: 2,
    });
    expect(findings.filter(item => item.level === 'FAIL')).toHaveLength(10);
  });
});
