/**
 * 監査修正エージェント用 scope レジストリ（LLM 不使用の純関数群）。
 *
 * 各 scope（enemies/skills/...）について:
 *  - file: マスターデータのキー
 *  - buildContext(all, id, entity): per-content バリデータのコンテキストを構築（対象 id は自己除外）
 *  - validate(patched, ctx): per-content バリデータを呼び、{ ok, findings } を返す
 *
 * これにより監査修正グラフ本体を scope 非依存にする。Agent A 系の既存バリデータをそのまま再利用する。
 */

import { validateEnemyDraft } from '../enemyBalance';
import { validateSkillDraft, type SkillOwner } from '../skillBalance';
import { validateDemonFormDraft, type DemonJobOwner } from '../demonBalance';
import { validateStageDraft } from '../stageBalance';
import { validateWeaponDraft } from '../weaponBalance';
import { validateMaterialDraft } from '../materialBalance';
import { validateJobDraft } from '../jobBalance';
import { validateAreaDraft } from '../areaBalance';
import { validateMonsterDraft } from '../monsterBalance';

/** マスターデータ全体（プレーンな record。Server Action 側で getAllMasterData() から渡す）。 */
export type MasterData = Record<string, Record<string, Record<string, unknown>>>;

export type ScopeValidationFinding = { level: string; field: string; message: string };
export type ScopeValidationResult = { ok: boolean; findings: ScopeValidationFinding[] };

export type ScopeEntry = {
  /** マスターデータのファイルキー（= scope）。 */
  file: string;
  /** per-content バリデータのコンテキストを構築。対象 id は重複チェックから除外する。 */
  buildContext: (all: MasterData, id: string, entity: Record<string, unknown>) => unknown;
  /** パッチ済みエンティティを検証。 */
  validate: (patched: unknown, ctx: unknown) => ScopeValidationResult;
  /** プロンプト用: このコンテンツの参照可能IDヒント（参照切れ修正用）。 */
  referenceHint: (all: MasterData) => string;
};

// --- helpers ---
function omit(coll: Record<string, unknown> | undefined, id: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(coll ?? {})) if (k !== id) out[k] = v;
  return out;
}
function keysExcept(coll: Record<string, unknown> | undefined, id: string): Set<string> {
  return new Set(Object.keys(coll ?? {}).filter((k) => k !== id));
}
function skillMetaOf(skills: Record<string, Record<string, unknown>> | undefined): Record<string, { element?: string; type?: string; targetType?: string }> {
  const meta: Record<string, { element?: string; type?: string; targetType?: string }> = {};
  for (const [id, s] of Object.entries(skills ?? {})) {
    meta[id] = {
      element: typeof s.element === 'string' ? s.element : undefined,
      type: typeof s.type === 'string' ? s.type : undefined,
      targetType: typeof s.targetType === 'string' ? s.targetType : undefined,
    };
  }
  return meta;
}
function enemyTiersOf(enemies: Record<string, Record<string, unknown>> | undefined): Record<string, string> {
  const t: Record<string, string> = {};
  for (const [id, e] of Object.entries(enemies ?? {})) if (typeof e.tier === 'string') t[id] = e.tier;
  return t;
}
/** スキルの owner を jobs から逆引き（このスキルを習得する職業）。 */
function deriveSkillOwner(all: MasterData, skillId: string): SkillOwner | undefined {
  for (const [jid, job] of Object.entries(all.jobs ?? {})) {
    const skills = Array.isArray(job.skills) ? (job.skills as Record<string, unknown>[]) : [];
    if (skills.some((s) => s.skillId === skillId)) {
      return {
        kind: 'job',
        id: jid,
        displayName: (job.displayName as string) ?? jid,
        category: job.category as string | undefined,
        baseAttackType: job.baseAttackType as string | undefined,
        tier: typeof job.tier === 'number' ? job.tier : 1,
      };
    }
  }
  return undefined;
}

export const SCOPE_REGISTRY: Record<string, ScopeEntry> = {
  enemies: {
    file: 'enemies',
    buildContext: (all, id) => ({
      existingEnemies: omit(all.enemies, id),
      itemIds: new Set(Object.keys(all.items ?? {})),
      materialIds: new Set(Object.keys(all.materials ?? {})),
      skillIds: new Set(Object.keys(all.skills ?? {})),
      skillMeta: skillMetaOf(all.skills),
    }),
    validate: (p, ctx) => validateEnemyDraft(p, ctx as never),
    referenceHint: (all) =>
      `武器: ${Object.keys(all.items ?? {}).join(', ')}\n素材: ${Object.keys(all.materials ?? {}).join(', ')}\nスキル: ${Object.keys(all.skills ?? {}).join(', ')}`,
  },

  skills: {
    file: 'skills',
    buildContext: (all, id) => ({
      existingSkills: omit(all.skills, id),
      skillIds: keysExcept(all.skills, id),
      owner: deriveSkillOwner(all, id),
    }),
    validate: (p, ctx) => validateSkillDraft(p, ctx as never),
    referenceHint: () => '（スキルは他マスターを参照しません）',
  },

  demonForms: {
    file: 'demonForms',
    buildContext: (all, id, entity) => {
      const jobId = typeof entity.jobId === 'string' ? entity.jobId : id;
      const job = all.jobs?.[jobId];
      const owner: DemonJobOwner | undefined = job
        ? {
            id: jobId,
            displayName: (job.displayName as string) ?? jobId,
            category: job.category as string | undefined,
            baseAttackType: job.baseAttackType as string | undefined,
            tier: typeof job.tier === 'number' ? job.tier : 1,
          }
        : undefined;
      return {
        existingForms: omit(all.demonForms, id),
        jobIds: new Set(Object.keys(all.jobs ?? {})),
        owner,
      };
    },
    validate: (p, ctx) => validateDemonFormDraft(p, ctx as never),
    referenceHint: (all) => `職業: ${Object.keys(all.jobs ?? {}).join(', ')}`,
  },

  stages: {
    file: 'stages',
    buildContext: (all, id) => ({
      existingStages: omit(all.stages, id),
      stageIds: keysExcept(all.stages, id),
      enemyIds: new Set(Object.keys(all.enemies ?? {})),
      enemyTiers: enemyTiersOf(all.enemies),
      itemIds: new Set(Object.keys(all.items ?? {})),
      materialIds: new Set(Object.keys(all.materials ?? {})),
      areaIds: new Set(Object.keys(all.areas ?? {})),
    }),
    validate: (p, ctx) => validateStageDraft(p, ctx as never),
    referenceHint: (all) =>
      `敵: ${Object.keys(all.enemies ?? {}).join(', ')}\nエリア: ${Object.keys(all.areas ?? {}).join(', ')}\n武器: ${Object.keys(all.items ?? {}).join(', ')}\n素材: ${Object.keys(all.materials ?? {}).join(', ')}`,
  },

  items: {
    file: 'items',
    buildContext: (all, id, entity) => ({
      existingItems: omit(all.items, id),
      itemIds: keysExcept(all.items, id),
      expectedRarity: typeof entity.rarity === 'string' ? entity.rarity : undefined,
    }),
    validate: (p, ctx) => validateWeaponDraft(p, ctx as never),
    referenceHint: () => '（武器は他マスターを参照しません）',
  },

  materials: {
    file: 'materials',
    buildContext: (all, id) => ({
      existingMaterials: omit(all.materials, id),
      materialIds: keysExcept(all.materials, id),
    }),
    validate: (p, ctx) => validateMaterialDraft(p, ctx as never),
    referenceHint: () => '（素材は他マスターを参照しません）',
  },

  jobs: {
    file: 'jobs',
    buildContext: (all, id) => ({
      existingJobs: omit(all.jobs, id),
      jobIds: keysExcept(all.jobs, id),
      skillIds: new Set(Object.keys(all.skills ?? {})),
      skillMeta: skillMetaOf(all.skills),
    }),
    validate: (p, ctx) => validateJobDraft(p, ctx as never),
    referenceHint: (all) => `スキル: ${Object.keys(all.skills ?? {}).join(', ')}`,
  },

  areas: {
    file: 'areas',
    buildContext: (all, id) => ({
      existingAreas: omit(all.areas, id),
      areaIds: keysExcept(all.areas, id),
    }),
    validate: (p, ctx) => validateAreaDraft(p, ctx as never),
    referenceHint: () => '（エリアは他マスターを参照しません）',
  },

  monsters: {
    file: 'monsters',
    buildContext: (all, id, entity) => ({
      existingMonsters: omit(all.monsters, id),
      monsterIds: keysExcept(all.monsters, id),
      expectedCost: typeof entity.cost === 'number' ? entity.cost : undefined,
    }),
    validate: (p, ctx) => validateMonsterDraft(p, ctx as never),
    referenceHint: () => '（味方魔物は他マスターを参照しません）',
  },
};

export function getScopeEntry(scope: string): ScopeEntry | undefined {
  return SCOPE_REGISTRY[scope];
}
