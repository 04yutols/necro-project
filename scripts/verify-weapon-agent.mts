/**
 * 武器草案エージェントのライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-weapon -- [rarity] [要件...]
 * 例:   npm run agent:verify-weapon -- SSR 闇属性特化の魔法剣。会心ダメージを盛る。
 *
 * 対象レアリティの構成（サブオプション枠・パッシブ2スロット）に沿った武器を生成し、
 * 設計書13/92 の決定論的検証を通すことを確認する。失敗時 exit 1。
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

const { runWeaponAgent } = await import('../src/lib/agent/weaponAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const items = readJson('items.json');
const argv = process.argv.slice(2);
const RARITIES = ['R', 'SR', 'SSR', 'UR'];
const rarity = argv[0] && RARITIES.includes(argv[0]) ? argv[0] : 'SSR';
const requirements = argv.slice(RARITIES.includes(argv[0]) ? 1 : 0).join(' ') || '闇属性に特化した魔法剣。会心ダメージを伸ばし、魔神化と噛み合う。';

console.log('=== 武器草案エージェント 動作確認 ===');
console.log(`バックエンド: ${process.env.GEMINI_BACKEND ?? 'aistudio'}`);
console.log(`対象レアリティ: ${rarity}`);
console.log('要件:', requirements);
console.log('');

const result = await runWeaponAgent({
  requirements,
  rarity,
  existingItems: items,
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
if (result.draft && result.draft.rarity !== rarity) failures.push(`レアリティ不一致: ${result.draft.rarity} ≠ ${rarity}`);

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: レアリティ構成に沿った武器 → 設計書13/92 検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
