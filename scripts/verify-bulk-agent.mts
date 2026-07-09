/**
 * 一括変更エージェント（Agent D）のライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-bulk
 *
 * 【非破壊保証】マスターデータをディープコピーして読み込み、NL→Spec→applyBulkSpec（メモリ内）まで。
 * saveEntry を一切呼ばず、ファイルを書き換えない（preview 相当のみ）。
 */
import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
for (const file of ['.env', '.env.local']) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { runBulkAgent } = await import('../src/lib/agent/bulkAgent.ts');
const { applyBulkSpec } = await import('../src/lib/agent/bulk/bulkEngine.ts');

function readJsonCopy(name: string): Record<string, Record<string, unknown>> {
  // ディープコピー（パース結果は元ファイルと独立。書き戻さない）
  return JSON.parse(fs.readFileSync(path.join('src/data/master', name), 'utf-8'));
}

const skills = readJsonCopy('skills.json');
const enemies = readJsonCopy('enemies.json');

// フィールドヒント（簡易）
const fieldHints = [
  `## skills\n  ${Object.keys(Object.values(skills)[0] ?? {}).join(', ')}`,
  `## enemies\n  id, tier, tribe, stats.hp, stats.atk, stats.def, stats.spd, stats.critDmg`,
].join('\n');

async function runCase(label: string, instruction: string, expectFile: string, target: Record<string, Record<string, unknown>>): Promise<boolean> {
  console.log(`\n########## ${label} ##########`);
  console.log('指示:', instruction);
  const res = await runBulkAgent({ instruction, fieldHints });
  res.log.forEach((l) => console.log('  •', l));
  if (!res.spec) { console.log('  ❌ Spec生成失敗:', res.error); return false; }
  console.log('  Spec:', JSON.stringify(res.spec));
  const changes = applyBulkSpec(target, res.spec);
  console.log(`  対象 ${changes.length} 件:`);
  changes.slice(0, 4).forEach((c) => console.log(`    ${c.id}: ${c.diff.map((d) => `${d.path} ${JSON.stringify(d.before)}→${JSON.stringify(d.after)}`).join(', ')}`));
  const ok = res.spec.file === expectFile && changes.length > 0;
  console.log('  判定:', ok ? 'PASS ✅' : `MISS ❌（file=${res.spec.file} 期待=${expectFile} / ${changes.length}件）`);
  return ok;
}

// 元データのスナップショット（実行後に不変であることを確認）
const skillsSnapshot = JSON.stringify(skills);
const enemiesSnapshot = JSON.stringify(enemies);

const c1 = await runCase(
  '全体魔法の power を下げる',
  'MAGICAL かつ targetType が ALL_ENEMIES のスキルの power を 0.1 下げる',
  'skills', skills,
);
const c2 = await runCase(
  'MINION の防御を上げる',
  'tier が MINION の敵の stats.def を 10% 上げる',
  'enemies', enemies,
);

// 非破壊チェック
const intact = JSON.stringify(skills) === skillsSnapshot && JSON.stringify(enemies) === enemiesSnapshot;
console.log('\n--- 非破壊チェック ---', intact ? 'メモリ上のコピーも不変 ✅' : '⚠ コピーが変化（applyBulkSpec は入力不変のはず）');

// --- previewBulkChangeAction の二層ゲートを実ディスク読込で到達（非破壊・保存しない）---
console.log('\n########## preview 二層ゲート（per-content + 監査・非破壊）##########');
const { previewBulkChangeAction } = await import('../src/app/admin/agents/actions.ts');
const preview = await previewBulkChangeAction('MAGICAL かつ targetType が ALL_ENEMIES のスキルの power を 0.1 下げる');
preview.log.forEach((l: string) => console.log('  •', l));
console.log('  spec:', preview.spec ? `${preview.spec.file} / op ${JSON.stringify(preview.spec.operation)}` : 'なし');
console.log(`  対象 ${preview.changes.length} 件 / per-content検証 ${preview.validations.length} 件 / 新規監査FAIL ${preview.newAuditFails.length} / 不在フィールド ${preview.missingFields.length}`);
console.log('  二層ゲート ok:', preview.ok);
const previewOk = preview.spec !== null && preview.changes.length > 0 && preview.validations.length === preview.changes.length;

console.log('');
if (c1 && c2 && intact && previewOk) {
  console.log('✅ Agent D 統合テスト合格: NL→Spec翻訳 + 決定論適用 + preview二層ゲート（ファイル非書換）');
  process.exit(0);
} else if (!previewOk) {
  console.log('❌ preview 二層ゲートが期待どおり動作しませんでした');
  process.exit(1);
} else {
  console.log('❌ 統合テスト不合格');
  process.exit(1);
}
