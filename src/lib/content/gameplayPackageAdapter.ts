import type { ContentChange, ContentFinding } from './contentBundle';
import type { ContentEvidence, ContentPackage } from './contentPackage';
import {
  authorCombatUnit,
  authorResidueName,
  authorSkill,
  authorWeapon,
  type CombatUnitAuthoringRequest,
  type GameplayAuthoringContext,
  type ResidueNameAuthoringRequest,
  type SkillAuthoringRequest,
  type WeaponAuthoringRequest,
} from './gameplayAuthoring';
import {
  runGameplaySimulation,
  runStageGameplaySimulation,
  type GameplaySimulationConfig,
  type GameplaySimulationTargets,
} from './gameplaySimulation';
import type { BaseStats, CharacterData, EnemyData, ItemData, JobData, MonsterData, StageData } from '../../types/game';

export type GameplayArtifact =
  | { authoringKind: 'combat-unit'; request: CombatUnitAuthoringRequest; simulationTargets?: Partial<GameplaySimulationTargets> }
  | { authoringKind: 'skill'; request: SkillAuthoringRequest; simulationTargets?: Partial<GameplaySimulationTargets> }
  | { authoringKind: 'weapon'; request: WeaponAuthoringRequest; simulationTargets?: Partial<GameplaySimulationTargets> }
  | { authoringKind: 'residue-name'; request: ResidueNameAuthoringRequest };

export type MaterializeGameplayPackageResult = {
  package: ContentPackage;
  findings: ContentFinding[];
  generatedChanges: ContentChange[];
  generatedEvidence: ContentEvidence[];
};

export type MaterializeGameplayPackageOptions = {
  kinds?: GameplayArtifact['authoringKind'][];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGameplayArtifact(value: unknown): value is GameplayArtifact {
  return isRecord(value)
    && ['combat-unit', 'skill', 'weapon', 'residue-name'].includes(String(value.authoringKind))
    && isRecord(value.request);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function firstRecord(records: Record<string, unknown>): [string, Record<string, unknown>] | undefined {
  const entry = Object.entries(records).find(([, value]) => isRecord(value));
  return entry ? [entry[0], entry[1] as Record<string, unknown>] : undefined;
}

function statsFromJob(job: Record<string, unknown> | undefined, level: number): BaseStats {
  const levels = job && isRecord(job.baseStatsByLevel) ? job.baseStatsByLevel : undefined;
  const raw: Record<string, unknown> | undefined = levels && isRecord(levels[String(level)])
    ? levels[String(level)] as Record<string, unknown>
    : undefined;
  return {
    hp: typeof raw?.hp === 'number' ? raw.hp : 180,
    atk: typeof raw?.atk === 'number' ? raw.atk : 45,
    def: typeof raw?.def === 'number' ? raw.def : 35,
    spd: typeof raw?.spd === 'number' ? raw.spd : 100,
    critRate: typeof raw?.critRate === 'number' ? raw.critRate : 5,
    critDmg: typeof raw?.critDmg === 'number' ? raw.critDmg : 150,
    effectHit: typeof raw?.effectHit === 'number' ? raw.effectHit : 0,
    effectRes: typeof raw?.effectRes === 'number' ? raw.effectRes : 0,
  };
}

function representativePlayer(
  ctx: GameplayAuthoringContext,
  level: number,
  jobOverride?: JobData,
  weapon?: ItemData,
): CharacterData {
  const jobEntry = jobOverride
    ? [jobOverride.id ?? 'draft_job', jobOverride] as const
    : firstRecord(ctx.existingJobs) ?? ['warrior', {} as Record<string, unknown>] as const;
  const job = jobEntry[1] as Record<string, unknown>;
  const stats = statsFromJob(job, level);
  const maxEnergy = isRecord(job.energyCurve) && typeof job.energyCurve.ultimateCost === 'number'
    ? job.energyCurve.ultimateCost
    : 100;
  return {
    id: 'authoring_aldo',
    name: 'アルド',
    currentJobId: jobEntry[0],
    category: job.category === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL',
    baseStats: stats,
    stats: clone(stats),
    passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveSpdBonus: 0, passiveCritRateBonus: 0, passiveCritDmgBonus: 0, passiveHpBonus: 0 },
    equipment: { weapon: weapon ?? null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
    baseResistances: {},
    jobs: [{ jobId: jobEntry[0], level, exp: 0 }],
    isAwakened: false,
    clearedStages: [],
    gold: 0,
    currentEnergy: maxEnergy,
    maxEnergy,
    elementDmgBoosts: {},
  };
}

function toMonster(id: string, value: Record<string, unknown>, fallbackCost = 1): MonsterData {
  const stats = isRecord(value.stats) ? value.stats as unknown as BaseStats : statsFromJob(undefined, 20);
  return {
    id,
    name: typeof value.nameJa === 'string' ? value.nameJa : typeof value.name === 'string' ? value.name : id,
    tribe: ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'].includes(String(value.tribe)) ? value.tribe as MonsterData['tribe'] : 'UNDEAD',
    cost: typeof value.cost === 'number' ? value.cost : fallbackCost,
    stats: clone(stats),
    resistances: isRecord(value.resistances) ? value.resistances as MonsterData['resistances'] : {},
    weaknesses: Array.isArray(value.weaknesses) ? value.weaknesses as MonsterData['weaknesses'] : undefined,
    tier: ['MINION', 'ELITE', 'BOSS'].includes(String(value.tier)) ? value.tier as MonsterData['tier'] : undefined,
    currentEnergy: typeof value.currentEnergy === 'number' ? value.currentEnergy : 30,
    maxEnergy: typeof value.maxEnergy === 'number' ? value.maxEnergy : 30,
  };
}

function representativeParty(ctx: GameplayAuthoringContext, preferred?: MonsterData): [MonsterData | null, MonsterData | null, MonsterData | null] {
  const monsters = Object.entries(ctx.existingMonsters).flatMap(([id, value]) => isRecord(value) ? [toMonster(id, value)] : []);
  const list = preferred ? [preferred, ...monsters.filter(monster => monster.id !== preferred.id)] : monsters;
  return [list[0] ?? null, list[1] ?? null, list[2] ?? null];
}

function representativeEnemy(ctx: GameplayAuthoringContext, preferred?: MonsterData): MonsterData {
  if (preferred) return preferred;
  const entry = firstRecord(ctx.existingEnemies);
  if (entry) return toMonster(entry[0], entry[1], 0);
  return toMonster('authoring_dummy', {
    name: 'Authoring Dummy', tribe: 'UNDEAD', tier: 'MINION',
    stats: { hp: 120, atk: 12, def: 10, spd: 80, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
    resistances: {},
  }, 0);
}

function runRepresentativeStageOrEncounter(
  ctx: GameplayAuthoringContext,
  config: Omit<GameplaySimulationConfig, 'enemies'>,
) {
  const stageEntry = Object.entries(ctx.existingStages ?? {}).find(([, value]) => isRecord(value) && Array.isArray(value.waves) && value.waves.length > 0) as [string, Record<string, unknown>] | undefined;
  if (stageEntry) {
    return runStageGameplaySimulation(
      { ...stageEntry[1], id: typeof stageEntry[1].id === 'string' ? stageEntry[1].id : stageEntry[0] } as unknown as StageData,
      ctx.existingEnemies as Record<string, EnemyData>,
      config,
    );
  }
  return runGameplaySimulation({ ...config, enemies: [representativeEnemy(ctx)] });
}

function evidenceStatus(findings: Array<{ level: string }>): ContentEvidence['status'] {
  if (findings.some(finding => finding.level === 'FAIL')) return 'FAIL';
  if (findings.some(finding => finding.level === 'WARN')) return 'WARN';
  return 'PASS';
}

function replaceByKey<T>(items: T[], additions: T[], key: (item: T) => string): T[] {
  const map = new Map(items.map(item => [key(item), item]));
  for (const item of additions) map.set(key(item), item);
  return [...map.values()];
}

export function materializeGameplayPackage(
  source: ContentPackage,
  ctx: GameplayAuthoringContext,
  createdAt = new Date().toISOString(),
  options: MaterializeGameplayPackageOptions = {},
): MaterializeGameplayPackageResult {
  if (source.status !== 'DRAFT') throw new Error(`Gameplay authoring only mutates DRAFT packages. Current state: ${source.status}`);
  const pkg = clone(source);
  const findings: ContentFinding[] = [];
  const changes: ContentChange[] = [];
  const evidence: ContentEvidence[] = [];
  const preparedSkills = new Map<string, ReturnType<typeof authorSkill>>();
  for (const deliverable of pkg.deliverables) {
    const artifact = deliverable.artifact;
    if (!isGameplayArtifact(artifact) || artifact.authoringKind !== 'skill') continue;
    try {
      preparedSkills.set(deliverable.id, authorSkill(artifact.request, ctx));
    } catch {
      // The normal pass below records the actionable error on the deliverable.
    }
  }
  const authoringContext: GameplayAuthoringContext = {
    ...ctx,
    existingSkills: {
      ...ctx.existingSkills,
      ...Object.fromEntries([...preparedSkills.values()].map(result => [result.id, result.changeData])),
    },
  };

  for (const deliverable of pkg.deliverables) {
    if (!deliverable.artifact || !('authoringKind' in deliverable.artifact)) continue;
    if (!isGameplayArtifact(deliverable.artifact)) {
      findings.push({ level: 'FAIL', scope: 'authoring', id: deliverable.id, field: 'artifact', message: 'artifact.authoringKindには対応するrequestオブジェクトが必要です。' });
      continue;
    }
    if (options.kinds && !options.kinds.includes(deliverable.artifact.authoringKind)) continue;
    try {
      const artifact = deliverable.artifact;
      if (artifact.authoringKind === 'combat-unit') {
        const result = authorCombatUnit(artifact.request, authoringContext);
        changes.push({ scope: result.scope, id: result.id, data: result.changeData });
        findings.push(...result.gate.findings.map(finding => ({ ...finding, scope: result.scope, id: result.id })));
        deliverable.artifact = { ...artifact, authored: { shared: result.shared, variants: result.variants, rationale: result.rationale, gate: result.gate } };

        const authoredEnemy = result.scope === 'enemy' ? toMonster(result.id, result.changeData, 0) : undefined;
        const authoredMonster = result.scope === 'monster' ? toMonster(result.id, result.changeData) : undefined;
        const authoredJob = result.scope === 'job' ? result.changeData as unknown as JobData : undefined;
        const simulation = runGameplaySimulation({
          player: representativePlayer(ctx, result.shared.level, authoredJob),
          party: representativeParty(ctx, authoredMonster),
          enemies: [representativeEnemy(ctx, authoredEnemy)],
          targets: artifact.simulationTargets,
        });
        deliverable.artifact = { ...deliverable.artifact, simulation };
        evidence.push({
          id: `${deliverable.ownerId}_balance_simulation`, ownerId: deliverable.ownerId,
          kind: 'balance-simulation', status: simulation.overall,
          summary: `BattleEngine: TTK ${simulation.metrics.ttkTurns.value}, 被ダメージ ${simulation.metrics.incomingDamagePct.value}%, AoE価値 ${simulation.metrics.aoeValue.value}, cost ${simulation.metrics.partyCost.value}`,
          createdAt,
        });
      } else if (artifact.authoringKind === 'skill') {
        const result = preparedSkills.get(deliverable.id) ?? authorSkill(artifact.request, ctx);
        changes.push({ scope: 'skill', id: result.id, data: result.changeData as unknown as Record<string, unknown> });
        findings.push(...result.gate.findings.map(finding => ({ ...finding, scope: 'skill', id: result.id })));
        const simulation = runRepresentativeStageOrEncounter(ctx, {
          player: representativePlayer(ctx, 20), party: representativeParty(ctx),
          skill: result.changeData,
          targets: artifact.simulationTargets,
        });
        deliverable.artifact = { ...artifact, authored: { budget: result.budget, rationale: result.rationale, gate: result.gate }, simulation };
        evidence.push({
          id: `${deliverable.ownerId}_skill_balance`, ownerId: deliverable.ownerId,
          kind: 'skill-balance', status: evidenceStatus([...result.gate.findings, ...simulation.findings]),
          summary: `${result.budget.classification}: power ${result.changeData.power}, MP ${result.changeData.mpCost}; BattleEngine TTK ${simulation.metrics.ttkTurns.value}, AoE価値 ${simulation.metrics.aoeValue.value}`,
          createdAt,
        });
      } else if (artifact.authoringKind === 'weapon') {
        const result = authorWeapon(artifact.request, authoringContext);
        changes.push({ scope: 'weapon', id: result.id, data: result.changeData as unknown as Record<string, unknown> });
        findings.push(...result.gate.findings.map(finding => ({ ...finding, scope: 'weapon', id: result.id })));
        const simulation = runRepresentativeStageOrEncounter(ctx, {
          player: representativePlayer(ctx, 20, undefined, result.changeData),
          party: representativeParty(ctx),
          targets: artifact.simulationTargets,
        });
        deliverable.artifact = { ...artifact, authored: { baseAtk: result.baseAtk, rationale: result.rationale, gate: result.gate }, simulation };
        evidence.push({
          id: `${deliverable.ownerId}_weapon_balance`, ownerId: deliverable.ownerId,
          kind: 'weapon-balance', status: evidenceStatus([...result.gate.findings, ...simulation.findings]),
          summary: `基礎ATK ${result.baseAtk.current}（ILv${result.baseAtk.ilv}）; BattleEngine TTK ${simulation.metrics.ttkTurns.value}`,
          createdAt,
        });
      } else {
        const result = authorResidueName(artifact.request);
        changes.push({ scope: 'residue-name', id: result.id, data: result.changeData });
        deliverable.artifact = { ...artifact, authored: { approvalBoundary: result.approvalBoundary } };
      }
    } catch (error) {
      findings.push({ level: 'FAIL', scope: 'authoring', id: deliverable.id, field: 'artifact', message: error instanceof Error ? error.message : String(error) });
    }
  }

  pkg.changes = replaceByKey(pkg.changes, changes, change => `${change.scope}:${change.id}`);
  pkg.evidence = replaceByKey(pkg.evidence, evidence, item => `${item.ownerId}:${item.kind}`);
  if (changes.length > 0 || evidence.length > 0) pkg.revision += 1;
  delete pkg.provenance.contentHash;
  return { package: pkg, findings, generatedChanges: changes, generatedEvidence: evidence };
}
