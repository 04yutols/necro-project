/**
 * 味方魔物草案エージェントのライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-monster -- [cost] [要件...]
 * 例:   npm run agent:verify-monster -- 2 火を吐く素早いドラゴン系の魔物。
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

const { runMonsterAgent } = await import('../src/lib/agent/monsterAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const monsters = readJson('monsters.json');
const argv = process.argv.slice(2);
const cost = /^\d+$/.test(argv[0] ?? '') ? Number(argv[0]) : 2;
const requirements = argv.slice(/^\d+$/.test(argv[0] ?? '') ? 1 : 0).join(' ') || '火を吐く素早いドラゴン系の魔物。氷に弱い。';

console.log('=== 味方魔物草案エージェント 動作確認 ===');
console.log(`バックエンド: ${process.env.GEMINI_BACKEND ?? 'aistudio'} / cost: ${cost}`);
console.log('要件:', requirements);
console.log('');

const result = await runMonsterAgent({ requirements, cost, existingMonsters: monsters, maxAttempts: 3 });

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
if (result.draft && result.draft.cost !== cost) failures.push(`cost 不一致: ${result.draft.cost} ≠ ${cost}`);

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: cost 帯に沿った味方魔物 → 検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
