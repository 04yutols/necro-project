/**
 * 魔神化フォーム草案エージェントのライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-demon -- [jobId] [要件...]
 * 例:   npm run agent:verify-demon -- archmage 全体に絶大な魔法ダメージ。MP過剰消費のリスク。
 *
 * 紐付き先の職業に合う魔神化を設計し、設計書16 Tier ルール + power 基準の
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

const { runDemonAgent } = await import('../src/lib/agent/demonAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const demonForms = readJson('demonForms.json');
const jobs = readJson('jobs.json');

const argv = process.argv.slice(2);
const jobId = argv[0] && jobs[argv[0]] ? argv[0] : 'archmage';
const requirements = argv.slice(jobs[argv[0]] ? 1 : 0).join(' ') || '敵全体に絶大な魔法ダメージ。MP過剰消費のリスクを背負う高火力フォーム。';

const job = jobs[jobId] as Record<string, unknown>;
const owner = {
  id: jobId,
  displayName: (job.displayName as string) ?? jobId,
  category: job.category as string,
  baseAttackType: job.baseAttackType as string,
  tier: typeof job.tier === 'number' ? job.tier : 1,
};

console.log('=== 魔神化フォーム草案エージェント 動作確認 ===');
console.log(`バックエンド: ${process.env.GEMINI_BACKEND ?? 'aistudio'}`);
console.log(`紐付き先: ${owner.displayName}（${owner.category}/${owner.baseAttackType}/T${owner.tier}）`);
console.log('要件:', requirements);
console.log('');

const result = await runDemonAgent({
  requirements,
  owner,
  existingForms: demonForms,
  jobIds: Object.keys(jobs),
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
if (result.draft && result.draft.jobId !== owner.id) failures.push(`owner-fit 違反: jobId=${result.draft.jobId} ≠ ${owner.id}`);
if (result.draft && result.draft.tier !== owner.tier) failures.push(`tier 不一致: ${result.draft.tier} ≠ 職業tier ${owner.tier}`);
// Tier2 はリスク必須
if (result.draft && owner.tier === 2) {
  const eb = result.draft.effectB as Record<string, unknown> | undefined;
  if (!eb || eb.riskType == null) failures.push('Tier2 なのにリスク(riskType)が設定されていない');
}

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: 職業に合う魔神化 → Tierルール + power基準 検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
