import type { DropEntry, ElementType, EnemyData, StageData } from '../types/game';

export type StageProgressState = 'SAFE' | 'CLEARED' | 'AVAILABLE' | 'LOCKED';

export interface StageWaveSummary {
  label: string;
  role: StageData['waves'][number]['role'];
  intent: string;
  enemies: EnemyData[];
}

export function getStageList(stages: Record<string, StageData>): StageData[] {
  return Object.values(stages).sort((a, b) => {
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.id.localeCompare(b.id);
  });
}

export function isStageUnlocked(stage: StageData, clearedStages: string[]): boolean {
  if (stage.nodeType === 'SAFE') return true;
  if (stage.unlockRequires.length === 0) return true;
  return stage.unlockRequires.every(stageId => clearedStages.includes(stageId));
}

export function getStageProgressState(stage: StageData, clearedStages: string[]): StageProgressState {
  if (stage.nodeType === 'SAFE') return 'SAFE';
  if (clearedStages.includes(stage.id)) return 'CLEARED';
  return isStageUnlocked(stage, clearedStages) ? 'AVAILABLE' : 'LOCKED';
}

export function getStageWaveSummaries(
  stage: StageData,
  enemies: Record<string, EnemyData>
): StageWaveSummary[] {
  return stage.waves.map(wave => ({
    label: wave.label,
    role: wave.role,
    intent: wave.intent,
    enemies: wave.enemyIds.map(enemyId => enemies[enemyId]).filter(Boolean),
  }));
}

export function getStageEnemies(stage: StageData, enemies: Record<string, EnemyData>): EnemyData[] {
  const seen = new Set<string>();
  return getStageWaveSummaries(stage, enemies).flatMap(wave => wave.enemies).filter(enemy => {
    if (seen.has(enemy.id)) return false;
    seen.add(enemy.id);
    return true;
  });
}

export function getPrimaryWeaknesses(stage: StageData, enemies: Record<string, EnemyData>): ElementType[] {
  const score = new Map<ElementType, number>();
  getStageEnemies(stage, enemies).forEach(enemy => {
    const weight = enemy.tier === 'BOSS' ? 4 : enemy.tier === 'ELITE' ? 2 : 1;
    enemy.weaknesses.forEach(element => {
      score.set(element, (score.get(element) ?? 0) + weight);
    });
  });
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([element]) => element);
}

function dropKey(drop: DropEntry): string {
  return `${drop.type ?? 'UNKNOWN'}:${drop.itemId ?? drop.monsterId ?? drop.rarity ?? 'ANY'}:${drop.isHidden ? 'H' : 'V'}`;
}

export function getStageDropTable(stage: StageData, enemies: Record<string, EnemyData>): DropEntry[] {
  const allDrops = [
    ...stage.rewards.dropTable,
    ...getStageEnemies(stage, enemies).flatMap(enemy => enemy.dropTable),
  ];
  const byKey = new Map<string, DropEntry>();
  allDrops.forEach(drop => {
    const key = dropKey(drop);
    const current = byKey.get(key);
    if (!current || drop.rate > current.rate) byKey.set(key, drop);
  });
  return [...byKey.values()].sort((a, b) => {
    const rarityRank = (rarity?: string) => ({ UR: 5, LR: 4, SSR: 3, SR: 2, R: 1, EPIC: 3, RARE: 2, COMMON: 0 }[rarity ?? ''] ?? 0);
    return rarityRank(b.rarity) - rarityRank(a.rarity) || b.rate - a.rate;
  });
}

export function getVisibleDropTable(stage: StageData, enemies: Record<string, EnemyData>): DropEntry[] {
  return getStageDropTable(stage, enemies).filter(drop => !drop.isHidden);
}

export function getHiddenDropCount(stage: StageData, enemies: Record<string, EnemyData>): number {
  return getStageDropTable(stage, enemies).filter(drop => drop.isHidden).length;
}

export function getNextAvailableStage(stages: Record<string, StageData>, clearedStages: string[]): StageData | null {
  return getStageList(stages).find(stage => getStageProgressState(stage, clearedStages) === 'AVAILABLE') ?? null;
}

export function getStageLineSegments(stages: Record<string, StageData>): Array<{ from: StageData; to: StageData }> {
  const stageMap = new Map(Object.values(stages).map(stage => [stage.id, stage]));
  return Object.values(stages).flatMap(stage =>
    stage.unlockRequires
      .map(requiredId => {
        const from = stageMap.get(requiredId);
        return from ? { from, to: stage } : null;
      })
      .filter((segment): segment is { from: StageData; to: StageData } => Boolean(segment))
  );
}
