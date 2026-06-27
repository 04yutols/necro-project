import { validateStageGraph } from './stageGraph';

function levels(stages: Record<string, unknown>) {
  return validateStageGraph(stages).map(finding => finding.level);
}

describe('validateStageGraph', () => {
  test('passes a normal linear chain', () => {
    const findings = validateStageGraph({
      a: { id: 'a', unlockRequires: [] },
      b: { id: 'b', unlockRequires: ['a'] },
      c: { id: 'c', unlockRequires: ['b'] },
    });

    expect(findings.filter(finding => finding.level === 'FAIL')).toHaveLength(0);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'PASS', id: '__stage_graph_reachability' }),
      expect.objectContaining({ level: 'PASS', id: '__stage_graph_cycles' }),
    ]));
  });

  test('fails when a stage is unreachable from any root', () => {
    const findings = validateStageGraph({
      a: { id: 'a', unlockRequires: [] },
      b: { id: 'b', unlockRequires: ['a'] },
      c: { id: 'c', unlockRequires: ['missing_stage'] },
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'FAIL', id: 'c' }),
    ]));
  });

  test('fails when unlockRequires contains a cycle', () => {
    const findings = validateStageGraph({
      root: { id: 'root', unlockRequires: [] },
      a: { id: 'a', unlockRequires: ['root', 'b'] },
      b: { id: 'b', unlockRequires: ['a'] },
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'FAIL', message: expect.stringContaining('a -> b -> a') }),
    ]));
  });

  test('warns on isolated root nodes', () => {
    const findings = validateStageGraph({
      a: { id: 'a', unlockRequires: [] },
      b: { id: 'b', unlockRequires: ['a'] },
      camp: { id: 'camp', unlockRequires: [] },
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'WARN', id: 'camp' }),
    ]));
    expect(levels({ a: { unlockRequires: [] }, b: { unlockRequires: ['a'] }, camp: { unlockRequires: [] } }))
      .not.toContain('FAIL');
  });
});
