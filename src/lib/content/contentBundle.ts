import { validateStoryScene, type StoryCharacterLite } from '../agent/story/storyValidator';
import { validateEnemyDraft } from '../agent/enemyBalance';
import { validateJobDraft } from '../agent/jobBalance';
import { validateMonsterDraft } from '../agent/monsterBalance';
import { validateSkillDraft } from '../agent/skillBalance';
import { validateWeaponDraft } from '../agent/weaponBalance';
import { validateStageDraft } from '../agent/stageBalance';

export const CONTENT_SCOPES = ['story-character', 'story-scene', 'enemy', 'monster', 'skill', 'job', 'weapon', 'stage', 'residue-name'] as const;
export type ContentScope = (typeof CONTENT_SCOPES)[number];

export type ContentChange = {
  scope: ContentScope;
  id: string;
  packId?: string;
  data: Record<string, unknown>;
};

export type ContentBundle = {
  schemaVersion: 1;
  id: string;
  title: string;
  chapter: number;
  creativeBrief: {
    themes: string[];
    mustInclude: string[];
    avoid: string[];
  };
  changes: ContentChange[];
};

export type ContentFinding = {
  level: 'PASS' | 'WARN' | 'FAIL';
  scope: string;
  id: string;
  field: string;
  message: string;
};

/** jobs/monsters use the outer record key as ID; draft changes keep id only for validator parity. */
export function contentChangeDataForMaster(change: ContentChange): Record<string, unknown> {
  const data = { ...change.data };
  if (change.scope === 'job' || change.scope === 'monster') delete data.id;
  return data;
}

export type ContentValidationContext = {
  characters: Record<string, StoryCharacterLite>;
  storySceneIds: Set<string>;
  storyPackIds: Set<string>;
  stageIds: Set<string>;
  stages?: Record<string, unknown>;
  areaIds: Set<string>;
  items: Record<string, unknown>;
  enemies: Record<string, unknown>;
  monsters: Record<string, unknown>;
  skills: Record<string, unknown>;
  jobs: Record<string, unknown>;
  materials: Record<string, unknown>;
  residueNames: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0);
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return Object.keys(value).filter(key => !allowedSet.has(key));
}

function validateStoryCharacter(change: ContentChange, push: (level: ContentFinding['level'], field: string, message: string) => void): void {
  const data = change.data;
  for (const field of ['id', 'nameJa', 'nameEn', 'color', 'glow', 'portraitBase']) {
    if (typeof data[field] !== 'string') push('FAIL', field, `${field} は文字列である必要があります。`);
  }
  if (data.id !== change.id) push('FAIL', 'id', 'change.id と data.id は一致させてください。');
  if (!stringArray(data.expressions)) push('FAIL', 'expressions', 'expressions は1件以上の非空文字列配列である必要があります。');
  if (typeof data.color === 'string' && !/^#[0-9a-fA-F]{6}$/.test(data.color)) push('FAIL', 'color', 'color は #RRGGBB 形式で指定してください。');
  if (typeof data.portraitBase === 'string' && data.portraitBase && !data.portraitBase.startsWith('/images/story/')) {
    push('WARN', 'portraitBase', 'portraitBase は /images/story/ 配下を推奨します。');
  }
}

function validateResidueName(change: ContentChange, bundleChapter: number, push: (level: ContentFinding['level'], field: string, message: string) => void): void {
  const data = change.data;
  for (const forbidden of ['mainStat', 'subOptions', 'stats', 'power', 'effect']) {
    if (forbidden in data) push('FAIL', forbidden, `${forbidden} は残滓名称バンドルでは変更できません。性能は既存の決定論的抽選で管理します。`);
  }
  if (data.id !== change.id) push('FAIL', 'id', 'change.id と data.id は一致させてください。');
  for (const field of ['id', 'name', 'origin']) {
    if (typeof data[field] !== 'string' || data[field].trim() === '') push('FAIL', field, `${field} は非空文字列である必要があります。`);
  }
  if (!['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].includes(String(data.rarity))) {
    push('FAIL', 'rarity', 'rarity は COMMON / RARE / EPIC / LEGENDARY のいずれかです。');
  }
  if (data.chapter !== bundleChapter) push('FAIL', 'chapter', '残滓名の chapter はバンドルの chapter と一致させてください。');
  if (!stringArray(data.tags)) push('FAIL', 'tags', 'tags は1件以上の非空文字列配列である必要があります。');
}

export function validateContentBundle(bundle: unknown, ctx: ContentValidationContext): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const add = (level: ContentFinding['level'], scope: string, id: string, field: string, message: string) =>
    findings.push({ level, scope, id, field, message });

  if (!isRecord(bundle)) return [{ level: 'FAIL', scope: 'bundle', id: '?', field: 'root', message: 'バンドルはオブジェクトである必要があります。' }];
  const bundleId = typeof bundle.id === 'string' ? bundle.id : '?';
  for (const key of unknownKeys(bundle, ['schemaVersion', 'id', 'title', 'chapter', 'creativeBrief', 'changes'])) add('FAIL', 'bundle', bundleId, key, `未定義フィールドです: ${key}`);
  if (bundle.schemaVersion !== 1) add('FAIL', 'bundle', bundleId, 'schemaVersion', 'schemaVersion は 1 である必要があります。');
  if (!/^[a-z][a-z0-9_]*$/.test(bundleId)) add('FAIL', 'bundle', bundleId, 'id', 'id は snake_case で指定してください。');
  if (typeof bundle.title !== 'string' || bundle.title.trim() === '') add('FAIL', 'bundle', bundleId, 'title', 'title は非空文字列である必要があります。');
  const chapter = bundle.chapter;
  if (!Number.isInteger(chapter) || Number(chapter) < 1) add('FAIL', 'bundle', bundleId, 'chapter', 'chapter は1以上の整数である必要があります。');
  if (typeof chapter === 'number' && chapter > 1) add('WARN', 'bundle', bundleId, 'chapter', '第2章以降は DEFERRED 扱いです。通常の適用は禁止されています。');
  if (!isRecord(bundle.creativeBrief)) {
    add('FAIL', 'bundle', bundleId, 'creativeBrief', '世界観判断の根拠となる creativeBrief が必要です。');
  } else {
    for (const key of unknownKeys(bundle.creativeBrief, ['themes', 'mustInclude', 'avoid'])) add('FAIL', 'bundle', bundleId, `creativeBrief.${key}`, `未定義フィールドです: ${key}`);
    for (const field of ['themes', 'mustInclude', 'avoid']) {
      if (!Array.isArray(bundle.creativeBrief[field]) || !bundle.creativeBrief[field].every(value => typeof value === 'string')) {
        add('FAIL', 'bundle', bundleId, `creativeBrief.${field}`, `${field} は文字列配列である必要があります。`);
      }
    }
    if (!stringArray(bundle.creativeBrief.themes)) add('FAIL', 'bundle', bundleId, 'creativeBrief.themes', 'themes は1件以上必要です。');
  }
  if (!Array.isArray(bundle.changes) || bundle.changes.length === 0) {
    add('FAIL', 'bundle', bundleId, 'changes', 'changes は1件以上必要です。');
    return findings;
  }

  const changes = bundle.changes.filter(isRecord) as unknown as ContentChange[];
  if (changes.length !== bundle.changes.length) add('FAIL', 'bundle', bundleId, 'changes', 'すべての change はオブジェクトである必要があります。');
  const seen = new Set<string>();
  const proposedCharacters: Record<string, StoryCharacterLite> = { ...ctx.characters };
  const proposedSkillIds = new Set(Object.keys(ctx.skills));
  const proposedSkillMeta: Record<string, { type?: string; element?: string }> = Object.fromEntries(
    Object.entries(ctx.skills).map(([id, value]) => [id, isRecord(value) ? value : {}]),
  );
  const proposedEnemyIds = new Set(Object.keys(ctx.enemies));
  const proposedEnemyTiers: Record<string, string> = Object.fromEntries(Object.entries(ctx.enemies).map(([id, value]) => [id, isRecord(value) && typeof value.tier === 'string' ? value.tier : '']));
  const proposedItemIds = new Set(Object.keys(ctx.items));
  const proposedStageIds = new Set(ctx.stageIds);

  for (const change of changes) {
    const id = typeof change.id === 'string' ? change.id : '?';
    const scope = typeof change.scope === 'string' ? change.scope : 'unknown';
    const key = `${scope}:${id}`;
    for (const unknown of unknownKeys(change as unknown as Record<string, unknown>, ['scope', 'id', 'packId', 'data'])) add('FAIL', scope, id, unknown, `未定義フィールドです: ${unknown}`);
    if (seen.has(key)) add('FAIL', scope, id, 'id', '同一バンドル内で scope + id が重複しています。');
    seen.add(key);
    if (!(CONTENT_SCOPES as readonly string[]).includes(scope)) add('FAIL', scope, id, 'scope', `未対応scopeです: ${scope}`);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(id)) add('FAIL', scope, id, 'id', 'id は英字始まりの英数字とアンダースコアで指定してください。');
    if (!isRecord(change.data)) {
      add('FAIL', scope, id, 'data', 'data はオブジェクトである必要があります。');
      continue;
    }
    if (scope === 'story-character') {
      if (id in ctx.characters) add('FAIL', scope, id, 'id', '既存キャラクターIDと重複しています。Phase 1 は新規作成のみ対応します。');
      validateStoryCharacter(change, (level, field, message) => add(level, scope, id, field, message));
      proposedCharacters[id] = change.data as StoryCharacterLite;
    } else if (scope === 'enemy' && id in ctx.enemies) {
      add('FAIL', scope, id, 'id', '既存エネミーIDと重複しています。Content Packageは新規作成のみ対応します。');
    } else if (scope === 'enemy') {
      proposedEnemyIds.add(id);
      proposedEnemyTiers[id] = typeof change.data.tier === 'string' ? change.data.tier : '';
    } else if (scope === 'monster' && id in ctx.monsters) {
      add('FAIL', scope, id, 'id', '既存魔物IDと重複しています。Content Packageは新規作成のみ対応します。');
    } else if (scope === 'skill') {
      if (id in ctx.skills) add('FAIL', scope, id, 'id', '既存スキルIDと重複しています。Content Packageは新規作成のみ対応します。');
      proposedSkillIds.add(id);
      proposedSkillMeta[id] = change.data;
    } else if (scope === 'job' && id in ctx.jobs) {
      add('FAIL', scope, id, 'id', '既存職業IDと重複しています。Content Packageは新規作成のみ対応します。');
    } else if (scope === 'weapon') {
      if (id in ctx.items) add('FAIL', scope, id, 'id', '既存アイテムIDと重複しています。Content Packageは新規作成のみ対応します。');
      proposedItemIds.add(id);
    } else if (scope === 'stage') {
      if (ctx.stageIds.has(id)) add('FAIL', scope, id, 'id', '既存ステージIDと重複しています。Content Packageは新規作成のみ対応します。');
      proposedStageIds.add(id);
    }
  }

  for (const change of changes) {
    const { scope, id, data } = change;
    if (!isRecord(data)) continue;
    if (scope === 'story-scene') {
      if (!change.packId || !ctx.storyPackIds.has(change.packId)) add('FAIL', scope, id, 'packId', '登録済みの story packId が必要です。');
      const result = validateStoryScene(data, {
        characters: proposedCharacters,
        stageIds: ctx.stageIds,
        areaIds: ctx.areaIds,
        existingSceneIds: new Set([...ctx.storySceneIds, ...changes.filter(c => c.scope === 'story-scene' && c.id !== id).map(c => c.id)]),
      });
      for (const finding of result.findings) add(finding.level, scope, id, finding.field, finding.message);
      if (data.id !== id) add('FAIL', scope, id, 'id', 'change.id と data.id は一致させてください。');
    } else if (scope === 'enemy') {
      const result = validateEnemyDraft(data, {
        existingEnemies: ctx.enemies,
        itemIds: new Set(Object.keys(ctx.items)),
        materialIds: new Set(Object.keys(ctx.materials)),
        skillIds: proposedSkillIds,
        skillMeta: proposedSkillMeta,
      });
      for (const finding of result.findings) add(finding.level, scope, id, finding.field, finding.message);
      if (data.id !== id) add('FAIL', scope, id, 'id', 'change.id と data.id は一致させてください。');
    } else if (scope === 'monster') {
      const result = validateMonsterDraft(data, {
        existingMonsters: ctx.monsters,
        monsterIds: new Set(Object.keys(ctx.monsters)),
        expectedCost: typeof data.cost === 'number' ? data.cost : undefined,
      });
      for (const finding of result.findings) add(finding.level, scope, id, finding.field, finding.message);
      if (data.id !== id) add('FAIL', scope, id, 'id', 'change.id と data.id は一致させてください。');
    } else if (scope === 'skill') {
      const existingWithoutPackageDrafts = Object.fromEntries(Object.entries(ctx.skills));
      const result = validateSkillDraft(data, {
        existingSkills: existingWithoutPackageDrafts,
        skillIds: new Set(Object.keys(ctx.skills)),
      });
      for (const finding of result.findings) add(finding.level, scope, id, finding.field, finding.message);
      if (data.id !== id) add('FAIL', scope, id, 'id', 'change.id と data.id は一致させてください。');
    } else if (scope === 'job') {
      const result = validateJobDraft(data, {
        existingJobs: ctx.jobs,
        jobIds: new Set(Object.keys(ctx.jobs)),
        skillIds: proposedSkillIds,
        skillMeta: proposedSkillMeta,
      });
      for (const finding of result.findings) add(finding.level, scope, id, finding.field, finding.message);
      if (data.id !== id) add('FAIL', scope, id, 'id', 'change.id と data.id は一致させてください。');
    } else if (scope === 'weapon') {
      const result = validateWeaponDraft(data, { existingItems: ctx.items, itemIds: new Set(Object.keys(ctx.items)), expectedRarity: typeof data.rarity === 'string' ? data.rarity : undefined });
      for (const finding of result.findings) add(finding.level, scope, id, finding.field, finding.message);
      if (data.id !== id) add('FAIL', scope, id, 'id', 'change.id と data.id は一致させてください。');
    } else if (scope === 'stage') {
      const existingStages = ctx.stages ?? {};
      const result = validateStageDraft(data, {
        existingStages,
        stageIds: new Set([...proposedStageIds].filter(stageId => stageId !== id)),
        enemyIds: proposedEnemyIds,
        enemyTiers: proposedEnemyTiers,
        itemIds: proposedItemIds,
        materialIds: new Set(Object.keys(ctx.materials)),
        areaIds: ctx.areaIds,
      });
      for (const finding of result.findings) add(finding.level, scope, id, finding.field, finding.message);
      if (data.id !== id) add('FAIL', scope, id, 'id', 'change.id と data.id は一致させてください。');
    } else if (scope === 'residue-name') {
      if (id in ctx.residueNames) add('FAIL', scope, id, 'id', '既存の残滓名称IDと重複しています。Phase 1 は新規作成のみ対応します。');
      validateResidueName(change, Number(chapter), (level, field, message) => add(level, scope, id, field, message));
    }
  }
  if (!findings.some(finding => finding.level === 'FAIL')) add('PASS', 'bundle', bundleId, 'root', '構造・参照・決定論ゲートを通過しました。');
  return findings;
}

export function isContentBundle(value: unknown): value is ContentBundle {
  return validateContentBundleShape(value);
}

function validateContentBundleShape(value: unknown): value is ContentBundle {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.id === 'string' && Array.isArray(value.changes);
}
