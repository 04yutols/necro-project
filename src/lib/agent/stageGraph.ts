export type StageGraphLevel = 'PASS' | 'WARN' | 'FAIL';

export type StageGraphFinding = {
  level: StageGraphLevel;
  id: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getUnlockRequires(stage: unknown): string[] {
  if (!isRecord(stage) || !Array.isArray(stage.unlockRequires)) return [];
  return stage.unlockRequires.filter((stageId): stageId is string => typeof stageId === 'string');
}

function isSafeStage(stage: unknown): boolean {
  return isRecord(stage) && stage.nodeType === 'SAFE';
}

function buildGraph(stages: Record<string, unknown>): {
  ids: string[];
  dependencies: Map<string, string[]>;
  children: Map<string, string[]>;
  roots: string[];
} {
  const ids = Object.keys(stages);
  const idSet = new Set(ids);
  const dependencies = new Map<string, string[]>();
  const children = new Map<string, string[]>(ids.map(id => [id, []]));
  const roots: string[] = [];

  for (const id of ids) {
    const rawDeps = getUnlockRequires(stages[id]);
    const existingDeps = rawDeps.filter(depId => idSet.has(depId));
    dependencies.set(id, existingDeps);
    if (rawDeps.length === 0) roots.push(id);
    for (const depId of existingDeps) {
      children.get(depId)?.push(id);
    }
  }

  return { ids, dependencies, children, roots };
}

function findReachabilityFindings(
  ids: string[],
  children: Map<string, string[]>,
  roots: string[],
): StageGraphFinding[] {
  if (ids.length === 0) {
    return [{ level: 'WARN', id: '__stage_graph_reachability', message: 'stages.json にステージが存在しません。' }];
  }
  if (roots.length === 0) {
    return [{ level: 'FAIL', id: '__stage_graph_reachability', message: 'unlockRequires が空のルートステージが存在しません。' }];
  }

  const reachable = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    stack.push(...(children.get(id) ?? []));
  }

  const unreachable = ids.filter(id => !reachable.has(id));
  if (unreachable.length === 0) {
    return [{
      level: 'PASS',
      id: '__stage_graph_reachability',
      message: `解放グラフ到達性 OK（${ids.length} ステージ / ルート ${roots.length} 件）。`,
    }];
  }

  return unreachable.map(id => ({
    level: 'FAIL' as const,
    id,
    message: `ルートステージから到達できません: ${id}`,
  }));
}

function findCycleFindings(ids: string[], dependencies: Map<string, string[]>): StageGraphFinding[] {
  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const cycleKeys = new Set<string>();
  const findings: StageGraphFinding[] = [];

  const visit = (id: string) => {
    const currentState = state.get(id);
    if (currentState === 'visited') return;
    if (currentState === 'visiting') return;

    state.set(id, 'visiting');
    stack.push(id);

    for (const depId of dependencies.get(id) ?? []) {
      const depState = state.get(depId);
      if (depState === 'visiting') {
        const cycleStart = stack.indexOf(depId);
        const cyclePath = [...stack.slice(Math.max(0, cycleStart)), depId];
        const key = cyclePath.join(' -> ');
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          findings.push({
            level: 'FAIL',
            id,
            message: `unlockRequires に循環があります: ${key}`,
          });
        }
        continue;
      }
      visit(depId);
    }

    stack.pop();
    state.set(id, 'visited');
  };

  ids.forEach(visit);

  if (findings.length > 0) return findings;
  return [{
    level: 'PASS',
    id: '__stage_graph_cycles',
    message: 'unlockRequires の循環はありません。',
  }];
}

function findIsolatedRootFindings(
  stages: Record<string, unknown>,
  roots: string[],
  children: Map<string, string[]>,
): StageGraphFinding[] {
  return roots
    .filter(id => !isSafeStage(stages[id]) && (children.get(id) ?? []).length === 0)
    .map(id => ({
      level: 'WARN' as const,
      id,
      message: `他ステージからも他ステージへも接続されていない初期開放の戦闘ノードです: ${id}`,
    }));
}

export function validateStageGraph(stages: Record<string, unknown>): StageGraphFinding[] {
  const { ids, dependencies, children, roots } = buildGraph(stages);
  return [
    ...findReachabilityFindings(ids, children, roots),
    ...findCycleFindings(ids, dependencies),
    ...findIsolatedRootFindings(stages, roots, children),
  ];
}
