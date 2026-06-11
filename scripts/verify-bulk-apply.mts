/**
 * R-1/R-2 の実保存パス検証（ネットゼロ・実データを最終的に不変に保つ）。
 *   実行: npm run agent:verify-bulk-apply
 *
 * 実際の applyBulkChangeAction（saveEntry ループ + スナップショット）と
 * restoreBulkSnapshotAction（undo）を実ファイルに対して実行し、
 * 「適用 → 復元」で元に戻ることを確認する。
 *
 * 【安全策】finally で skills.json の元バイト列を必ず書き戻す（テスト/復元が壊れても原状復帰）。
 * 終了時に git diff が空であることを確認する。LLM は使わない（Spec を直接構築）。
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const SKILLS = path.join(process.cwd(), 'src/data/master/skills.json');
const original = fs.readFileSync(SKILLS, 'utf-8');

const { applyBulkChangeAction, restoreBulkSnapshotAction } = await import('../src/app/admin/agents/actions.ts');

// LLM を使わず Spec を直接構築（物理スキルの power を +0.01：小さく可逆な変更）
const spec = {
  file: 'skills' as const,
  filter: [{ field: 'type', op: '==' as const, value: 'PHYSICAL' }],
  operation: [{ field: 'power', op: 'add' as const, value: 0.01 }],
  note: 'R-1 検証用（直後に復元）',
};

const failures: string[] = [];
let snapshotId: string | null = null;

try {
  console.log('=== R-1/R-2 実保存パス検証（ネットゼロ）===');

  // 1) 実適用（saveEntry + スナップショット作成）
  const applyRes = await applyBulkChangeAction(spec);
  console.log(`適用: saved ${applyRes.savedIds.length} / failed ${applyRes.failedIds.length} / snapshot ${applyRes.snapshotId}`);
  snapshotId = applyRes.snapshotId;
  if (applyRes.savedIds.length === 0) failures.push('saveEntry が 1 件も成功していない');
  if (!applyRes.snapshotId) failures.push('スナップショットが作成されていない（R-2）');

  // 2) ファイルが実際に変化したか
  const afterApply = fs.readFileSync(SKILLS, 'utf-8');
  if (afterApply === original) failures.push('適用後もファイルが変化していない（保存パス未到達）');
  else console.log('適用後: skills.json が変化 ✅');

  // 3) スナップショットから復元（undo）
  if (snapshotId) {
    const restoreRes = await restoreBulkSnapshotAction(snapshotId);
    console.log(`復元: ok=${restoreRes.ok} / ${restoreRes.entityCount} 件 / 監査 FAIL ${restoreRes.audit?.fail}`);
    if (!restoreRes.ok) failures.push('復元(undo)に失敗');

    // 4) 復元で元の内容に戻ったか
    const afterRestore = fs.readFileSync(SKILLS, 'utf-8');
    // JSON 意味的一致で比較（整形差を吸収）
    if (JSON.stringify(JSON.parse(afterRestore)) !== JSON.stringify(JSON.parse(original))) {
      failures.push('復元後の内容が元と一致しない');
    } else {
      console.log('復元後: 元の内容に一致 ✅');
    }
  }
} catch (e) {
  failures.push(`例外: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  // 安全策: 何があっても元バイト列を書き戻す
  fs.writeFileSync(SKILLS, original, 'utf-8');
}

// 5) 最終的に git diff が空であること（ネットゼロ）
let gitClean = false;
try {
  const diff = execSync('git diff --stat src/data/master/skills.json', { encoding: 'utf-8' });
  gitClean = diff.trim() === '';
} catch {
  gitClean = false;
}
console.log('\n--- 最終 git diff（skills.json）---', gitClean ? '空 ✅（ネットゼロ）' : '⚠ 差分あり');
if (!gitClean) failures.push('終了時に git diff が残っている（ネットゼロでない）');

console.log('');
if (failures.length === 0) {
  console.log('✅ R-1/R-2 検証合格: 実 applyBulkChangeAction（保存）+ スナップショット + undo が機能し、実データはネットゼロ');
  process.exit(0);
} else {
  console.log('❌ 検証不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
