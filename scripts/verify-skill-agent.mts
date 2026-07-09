/**
 * スキル草案エージェントのライブ統合テスト（実 Gemini API）。
 *   実行: npm run agent:verify-skill -- [jobId] [要件...]
 * 例:   npm run agent:verify-skill -- mage 水属性の全体魔法。中コスト。
 *
 * 紐付き先（職業）に合うスキルを生成し、設計書19 power 表 + owner-fit の
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

const { runSkillAgent } = await import('../src/lib/agent/skillAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const skills = readJson('skills.json');
const jobs = readJson('jobs.json');

const argv = process.argv.slice(2);
const jobId = argv[0] && jobs[argv[0]] ? argv[0] : 'mage';
const requirements = argv.slice(jobs[argv[0]] ? 1 : 0).join(' ') || '氷属性の全体魔法。中コストで複数の敵を凍てつかせる。';

const job = jobs[jobId] as Record<string, unknown>;
const owner = {
  kind: 'job' as const,
  id: jobId,
  displayName: (job.displayName as string) ?? jobId,
  category: job.category as string,
  baseAttackType: job.baseAttackType as string,
  tier: typeof job.tier === 'number' ? job.tier : 1,
};

console.log('=== スキル草案エージェント 動作確認 ===');
console.log(`紐付き先: ${owner.displayName}（${owner.category}/${owner.baseAttackType}/T${owner.tier}）`);
console.log('要件:', requirements);
console.log('');

const result = await runSkillAgent({
  requirements,
  owner,
  existingSkills: skills,
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
// owner-fit: type が職業 category に一致していること
if (result.draft && result.draft.type !== owner.category) {
  failures.push(`owner-fit 違反: type=${result.draft.type} ≠ 職業 category=${owner.category}`);
}

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: 紐付き先に合うスキル → power表 + owner-fit 検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
