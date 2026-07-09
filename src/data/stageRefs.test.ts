import stagesData from './master/stages.json';
import {
  CODE_REFERENCED_STAGE_IDS,
  validateCodeReferencedStageIds,
} from './stageRefs';

describe('stageRefs', () => {
  test('all code-referenced stage IDs exist in current master stages', () => {
    const stageIds = new Set(Object.keys(stagesData));
    const findings = validateCodeReferencedStageIds(stageIds);

    expect(findings.filter(finding => finding.level === 'FAIL')).toHaveLength(0);
    expect(CODE_REFERENCED_STAGE_IDS.map(ref => ref.id)).toEqual(expect.arrayContaining([
      'area1_node1',
      'area1_a2',
      'area1_a_mini',
      'area1_node3',
    ]));
    expect(CODE_REFERENCED_STAGE_IDS.map(ref => ref.id)).not.toContain('tutorial_battle_01');
  });

  test('detects missing stage IDs', () => {
    const findings = validateCodeReferencedStageIds(new Set(['area1_node1']));

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'FAIL', id: 'area1_a2' }),
      expect.objectContaining({ level: 'FAIL', id: 'area1_a_mini' }),
      expect.objectContaining({ level: 'FAIL', id: 'area1_node3' }),
    ]));
  });

  test('keeps every referencing path in finding messages even for duplicate IDs', () => {
    const findings = validateCodeReferencedStageIds(new Set());
    const node1Findings = findings.filter(finding => finding.id === 'area1_node1');

    expect(node1Findings).toHaveLength(2);
    expect(node1Findings.map(finding => finding.message).join('\n')).toContain('TUTORIAL_BATTLE_STAGE_IDS');
    expect(node1Findings.map(finding => finding.message).join('\n')).toContain('PARTY_FORMATION');
  });
});
