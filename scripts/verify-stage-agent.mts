/**
 * ステージ草案エージェントのライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-stage -- [areaId] [要件...]
 * 例:   npm run agent:verify-stage -- ch1_area2 風属性のダンジョン。area1の続きで難易度6。
 *
 * エリアに紐づくステージを生成し、参照整合（敵/解放条件/ドロップ/エリア）の
 * 決定論的検証を通すことを確認する。失敗時 exit 1。
 */
import fs from 'fs';
import path from 'path';

for (const file of ['.env', '.env.local']) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { runStageAgent } = await import('../src/lib/agent/stageAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const stages = readJson('stages.json');
const enemies = readJson('enemies.json');
const items = readJson('items.json');
const materials = readJson('materials.json');
const areas = readJson('areas.json');

const argv = process.argv.slice(2);
const areaId = argv[0] && areas[argv[0]] ? argv[0] : Object.keys(areas)[0];
const requirements = argv.slice(areas[argv[0]] ? 1 : 0).join(' ') || '第1章エリアの続きとなる中盤ダンジョン。3WAVE構成で精鋭が出る。';

const area = areas[areaId] as Record<string, unknown>;

const enemyCatalog = Object.entries(enemies).map(([id, e]) => {
  const en = e as Record<string, unknown>;
  return {
    id,
    nameJa: en.nameJa as string | undefined,
    tier: en.tier as string | undefined,
    tribe: en.tribe as string | undefined,
    weaknesses: Array.isArray(en.weaknesses) ? (en.weaknesses as string[]) : undefined,
  };
});

console.log('=== ステージ草案エージェント 動作確認 ===');
console.log(`バックエンド: ${process.env.GEMINI_BACKEND ?? 'aistudio'}`);
console.log(`紐付き先エリア: ${area.nameJa}（${areaId} / ch${area.chapter}/area${area.area}）`);
console.log('要件:', requirements);
console.log('');

const result = await runStageAgent({
  requirements,
  area: { id: areaId, chapter: Number(area.chapter), area: Number(area.area), nameJa: area.nameJa as string },
  existingStages: stages,
  enemies: enemyCatalog,
  itemIds: Object.keys(items),
  materialIds: Object.keys(materials),
  areaIds: Object.keys(areas),
  maxAttempts: 3,
});

console.log('--- ログ ---');
result.log.forEach((l) => console.log(' •', l));
console.log('');
if (result.error) console.log('--- エラー ---', result.error);
console.log('--- 検証結果 ---', result.validation?.ok ? 'PASS ✅' : 'FAIL ❌');
result.validation?.findings
  .filter((f) => f.level !== 'PASS')
  .forEach((f) => console.log(`  [${f.level}] ${f.field}: ${f.message}`));
console.log('');
console.log('--- 生成された草稿 ---');
console.log(JSON.stringify(result.draft, null, 2));

// --- アサーション ---
const failures: string[] = [];
if (result.error) failures.push(`agent error: ${result.error}`);
if (!result.draft) failures.push('draft が生成されませんでした');
if (!result.validation?.ok) failures.push('決定論的検証が PASS しませんでした');
if (result.draft && (result.draft.chapter !== Number(area.chapter) || result.draft.area !== Number(area.area))) {
  failures.push(`エリア整合違反: chapter/area=${result.draft.chapter}/${result.draft.area} ≠ ${area.chapter}/${area.area}`);
}

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: エリアに紐づくステージ → 参照整合 検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
