/**
 * 各コンテンツの「既知トップレベルフィールド」集合と未知フィールド検出（LLM 不使用の純関数）。
 *
 * 設計書 106 R-3: per-content バリデータは未知フィールドを拒否しなかったため、
 * 一括変更の `set` や LLM 生成が無関係なフィールド（タイプミス/幻覚）を紛れ込ませても気付けなかった。
 * ここで「既知フィールドに無いトップレベルキー」を WARN として検出する。
 *
 * 方針: 実データ + 型上の正当なオプションフィールドの**上位集合**にし、誤検出（正当フィールドへの WARN）を避ける。
 * 危険なのは "powr" / "foobar" のような明確なゴミなので、WARN（FAIL ではない）で十分。
 */

export const KNOWN_TOP_LEVEL_FIELDS: Record<string, readonly string[]> = {
  enemies: [
    'id', 'name', 'nameJa', 'nameEn', 'tier', 'tribe', 'stats', 'resistances', 'weaknesses',
    'shieldHp', 'maxShieldHp', 'gimmicks', 'necromance', 'dropTable', 'battle', 'description',
  ],
  skills: [
    'id', 'name', 'mpCost', 'power', 'type', 'element', 'attackType', 'targetType', 'effectKey',
    'description', 'ailmentType', 'ailmentBaseRate', 'healSelfPct', 'isUltimate', 'flags', 'ailments',
  ],
  stages: [
    'id', 'name', 'nameJa', 'nameEn', 'chapter', 'chapterName', 'area', 'nodeType', 'element',
    'difficulty', 'sortOrder', 'description', 'waveCount', 'areaGimmick', 'unlockRequires', 'waves',
    'rewards', 'position', 'isAreaBoss',
  ],
  jobs: [
    'id', 'name', 'displayName', 'nameEn', 'title', 'tier', 'category', 'baseAttackType', 'role',
    'description', 'unlock', 'statModifiers', 'energyCurve', 'baseStatsByLevel', 'levelBonuses', 'skills',
  ],
  items: [
    'id', 'name', 'type', 'rarity', 'weaponRarity', 'archetype', 'rank', 'ilv', 'isUnique', 'stats',
    'subOptions', 'passiveA', 'passiveB', 'flavor', 'icon', 'quantity', 'battleUsable', 'battleEffect',
    // 第一発見者システム等の正当なオプション
    'resistances', 'specialEffect', 'discovererId', 'discovererName', 'serialNo', 'discoveredAt',
  ],
  materials: ['id', 'name', 'quantity', 'expValue', 'rarity'],
  monsters: [
    'id', 'name', 'tribe', 'cost', 'stats', 'resistances',
    // 実行時 MonsterData の正当なオプション（マスター雛形には通常無いが許容）
    'masterId', 'skillIds', 'tier', 'weaknesses', 'equipment', 'equippedResidues', 'equippedShardId',
    'spiritCore', 'elementDmgBoosts', 'currentEnergy', 'maxEnergy',
  ],
  demonForms: ['jobId', 'formName', 'tier', 'concept', 'effectA', 'effectB', 'ultimateSkill', 'visual'],
  areas: ['id', 'chapter', 'area', 'nameJa', 'nameEn', 'description', 'color', 'position', 'sortOrder'],
};

export type UnknownFieldFinding = { level: 'WARN'; field: string; message: string };

/**
 * entity のトップレベルキーのうち、scope の既知フィールドに無いものを WARN で返す。
 * scope が未登録なら検査しない（空配列）。
 */
export function findUnknownFields(entity: unknown, scope: string): UnknownFieldFinding[] {
  const allowed = KNOWN_TOP_LEVEL_FIELDS[scope];
  if (!allowed || typeof entity !== 'object' || entity === null || Array.isArray(entity)) return [];
  const allowedSet = new Set(allowed);
  const findings: UnknownFieldFinding[] = [];
  for (const key of Object.keys(entity as Record<string, unknown>)) {
    if (key.startsWith('__')) continue; // メタ用プレフィックスは無視
    if (!allowedSet.has(key)) {
      findings.push({
        level: 'WARN',
        field: key,
        message: `未知のフィールド "${key}" があります（${scope} のスキーマに存在しません。タイプミス/不要フィールドの可能性）。`,
      });
    }
  }
  return findings;
}
