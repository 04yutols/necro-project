/**
 * エリア草案エージェントのライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-area -- [要件...]
 * 例:   npm run agent:verify-area -- 第3章の凍てつく霊峰エリア。
 * 失敗時 exit 1。
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

const { runAreaAgent } = await import('../src/lib/agent/areaAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const areas = readJson('areas.json');
const requirements = process.argv.slice(2).join(' ') || '第3章の舞台となる凍てつく霊峰エリア。氷と死霊の領域。';

console.log('=== エリア草案エージェント 動作確認 ===');
console.log(`バックエンド: ${process.env.GEMINI_BACKEND ?? 'aistudio'}`);
console.log('既存エリア:', Object.keys(areas).join(', '));
console.log('要件:', requirements);
console.log('');

const result = await runAreaAgent({ requirements, existingAreas: areas, maxAttempts: 3 });

console.log('--- ログ ---');
result.log.forEach((l) => console.log(' •', l));
if (result.error) console.log('--- エラー ---', result.error);
console.log('--- 検証結果 ---', result.validation?.ok ? 'PASS ✅' : 'FAIL ❌');
result.validation?.findings.filter((f) => f.level !== 'PASS').forEach((f) => console.log(`  [${f.level}] ${f.field}: ${f.message}`));
console.log('--- 生成された草稿 ---');
console.log(JSON.stringify(result.draft, null, 2));

const failures: string[] = [];
if (result.error) failures.push(`agent error: ${result.error}`);
if (!result.draft) failures.push('draft が生成されませんでした');
if (!result.validation?.ok) failures.push('決定論的検証が PASS しませんでした');
if (result.draft && result.draft.id !== `ch${result.draft.chapter}_area${result.draft.area}`) {
  failures.push(`id 規約違反: ${result.draft.id}`);
}
if (result.draft && Object.keys(areas).includes(String(result.draft.id))) {
  failures.push(`既存IDと重複: ${result.draft.id}`);
}

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: id規約・重複回避・配色 検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
