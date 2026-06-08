/**
 * Agent A ライブ統合テスト / 動作確認スクリプト（実 Gemini API を叩く）。
 *   実行: npm run agent:verify  （= npx tsx scripts/verify-enemy-agent.mts）
 *
 * LangGraph は ESM-only 依存（uuid 等）を持ち jest(CommonJS)では読み込めないため、
 * フルグラフのライブ検証はこのスクリプトが担う。決定論的バリデータ単体は
 * src/lib/agent/enemyBalance.test.ts の jest ユニットテストで網羅する。
 *
 * アサーション: 草稿生成 → 決定論的検証 PASS → スケール規約遵守 を確認し、
 * 失敗時は exit code 1 で終了する（CI/手動の合否判定に使える）。
 */
import fs from 'fs';
import path from 'path';

// .env を手動ロード（dotenv 非依存）
for (const file of ['.env', '.env.local']) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { runEnemyAgent } = await import('../src/lib/agent/enemyAgent.ts');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const enemies = readJson('enemies.json');
const items = readJson('items.json');
const materials = readJson('materials.json');
const skills = readJson('skills.json');

const requirements =
  process.argv.slice(2).join(' ') ||
  'area1_boss の前座になる ICE 弱点の高DEF ELITE アンデッド。氷スキルの価値を示す重い壁。';

console.log('=== Agent A 動作確認 ===');
console.log('要件:', requirements);
console.log('既存エネミー数:', Object.keys(enemies).length);
console.log('');

const skillCatalog = Object.entries(skills).map(([id, s]) => {
  const sk = s as Record<string, unknown>;
  return {
    id,
    nameJa: typeof sk.name === 'string' ? sk.name : undefined,
    element: typeof sk.element === 'string' ? sk.element : undefined,
    type: typeof sk.type === 'string' ? sk.type : undefined,
    targetType: typeof sk.targetType === 'string' ? sk.targetType : undefined,
    mpCost: typeof sk.mpCost === 'number' ? sk.mpCost : undefined,
  };
});

const result = await runEnemyAgent({
  requirements,
  existingEnemies: enemies,
  itemIds: Object.keys(items),
  materialIds: Object.keys(materials),
  skills: skillCatalog,
  designContext: '（検証用: tier 帯は既存データから自動算出）',
  maxAttempts: 3,
});

console.log('--- ログ ---');
result.log.forEach((l) => console.log(' •', l));
console.log('');
console.log('--- 試行回数 ---', result.attempts);
if (result.error) console.log('--- エラー ---', result.error);
console.log('');
console.log('--- 検証結果 ---', result.validation?.ok ? 'PASS ✅' : 'FAIL ❌');
result.validation?.findings
  .filter((f) => f.level !== 'PASS')
  .forEach((f) => console.log(`  [${f.level}] ${f.field}: ${f.message}`));
console.log('');
console.log('--- 生成された草稿 ---');
console.log(JSON.stringify(result.draft, null, 2));

// --- 味方化（necromance）設計の確認表示 ---
const necro = result.draft?.necromance as Record<string, unknown> | undefined;
if (necro) {
  console.log('');
  console.log('--- 味方化（necromance）設計 ---');
  console.log('  captureRate:', necro.captureRate, '/ allyCost:', necro.allyCost);
  console.log('  allyStats:', JSON.stringify(necro.allyStats));
  console.log('  skillIds:', JSON.stringify(necro.skillIds));
}

// --- アサーション（統合テスト合否判定） ---
const failures: string[] = [];
if (result.error) failures.push(`agent error: ${result.error}`);
if (!result.draft) failures.push('draft が生成されませんでした');
if (!result.validation?.ok) failures.push('決定論的検証が PASS しませんでした');
if (result.attempts < 1 || result.attempts > 3) failures.push(`attempts が範囲外: ${result.attempts}`);
const cd = (result.draft?.stats as Record<string, number> | undefined)?.critDmg;
if (cd !== undefined && cd < 100) failures.push(`critDmg スケール誤り: ${cd}`);
// 味方化設計が組み込まれていること
if (!necro) failures.push('necromance セクションが生成されませんでした');
if (necro && !necro.allyStats) failures.push('allyStats が未設計');
const allySkills = necro?.skillIds;
if (!Array.isArray(allySkills) || allySkills.length === 0) {
  failures.push('味方スキル(skillIds)が未設定（味方が通常攻撃しかできない）');
}

console.log('');
if (failures.length === 0) {
  console.log('✅ 統合テスト合格: 敵性能＋味方化設計（ステータス/コスト/スキル）→ 決定論的検証 PASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
