/**
 * 職業草案エージェントのライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-job -- [tier] [要件...]
 * 例:   npm run agent:verify-job -- 2 雷を操る素早い物理アタッカー。会心特化。
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

const { runJobAgent } = await import('../src/lib/agent/jobAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const jobs = readJson('jobs.json');
const skills = readJson('skills.json');
const argv = process.argv.slice(2);
const tier = argv[0] === '1' || argv[0] === '2' ? Number(argv[0]) : 2;
const requirements = argv.slice(argv[0] === '1' || argv[0] === '2' ? 1 : 0).join(' ') || '雷を操る素早い物理アタッカー。会心に特化し、耐久は低い。';

const skillCatalog = Object.entries(skills).map(([id, s]) => {
  const sk = s as Record<string, unknown>;
  return { id, nameJa: sk.name as string | undefined, type: sk.type as string | undefined, element: sk.element as string | undefined, targetType: sk.targetType as string | undefined };
});

console.log('=== 職業草案エージェント 動作確認 ===');
console.log(`バックエンド: ${process.env.GEMINI_BACKEND ?? 'aistudio'} / Tier: ${tier}`);
console.log('要件:', requirements);
console.log('');

const result = await runJobAgent({ requirements, tier, existingJobs: jobs, skills: skillCatalog, maxAttempts: 3 });

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
if (result.draft && result.draft.tier !== tier) failures.push(`tier 不一致: ${result.draft.tier} ≠ ${tier}`);
if (result.draft && 'baseStatsByLevel' in result.draft) failures.push('baseStatsByLevel は出力すべきでない（フォームが補間）');

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: Tier に沿った職業 → statModifiers/skills整合 検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
