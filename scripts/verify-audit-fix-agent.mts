/**
 * 監査修正エージェント（Agent B）のライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-audit-fix
 *
 * 既存エンティティを意図的に壊し → Agent B に修正させ → 二層ゲート（per-content + 監査）で
 * 当該 FAIL が解消されることを確認する。失敗時 exit 1。
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

const { auditMasterData, getAllMasterData } = await import('../src/app/admin/actions.ts');
const { runAuditFixAgent } = await import('../src/lib/agent/auditFixAgent.ts');

type Entity = Record<string, unknown>;
const clone = (o: unknown) => JSON.parse(JSON.stringify(o)) as Entity;
const failKey = (f: { scope: string; id: string; message: string }) => `${f.scope}|${f.id}|${f.message}`;

// 壊し方の定義（runMasterDataAudit が実際に FAIL を出す壊し方を使う）
const CASES: { scope: string; id: string; desc: string; break: (e: Entity) => Entity }[] = [
  {
    scope: 'enemies', id: 'grave_soldier', desc: 'necromance.skillIds を存在しないスキル参照に破壊',
    break: (e) => {
      const n = (e.necromance as Record<string, unknown>) ?? {};
      n.skillIds = ['skill_does_not_exist'];
      e.necromance = n;
      return e;
    },
  },
  {
    scope: 'enemies', id: 'rot_hound', desc: 'dropTable の itemId を存在しない参照に破壊',
    break: (e) => {
      const drops = Array.isArray(e.dropTable) ? (e.dropTable as Record<string, unknown>[]) : [];
      if (drops[0]) drops[0].itemId = 'phantom_item_xxx';
      e.dropTable = drops;
      return e;
    },
  },
];

const allRaw = await getAllMasterData();

let allPass = true;
for (const c of CASES) {
  console.log(`\n########## ${c.scope}/${c.id} — ${c.desc} ##########`);
  const real = (allRaw as Record<string, Record<string, Entity>>)[c.scope]?.[c.id];
  if (!real) { console.log('  対象が存在しないためスキップ'); continue; }

  const broken = c.break(clone(real));
  // 壊した状態を baseline に反映
  const baseline = await auditMasterData({ [c.scope]: { [c.id]: broken } } as never);
  const targetFindings = baseline.filter((f) => f.level === 'FAIL' && f.scope === c.scope && f.id === c.id);
  const baselineFailKeys = new Set(baseline.filter((f) => f.level === 'FAIL').map(failKey));
  console.log('  注入した FAIL:', targetFindings.map((f) => f.message).join(' / ') || '(なし)');
  if (targetFindings.length === 0) { console.log('  ⚠ 壊しが FAIL を生まなかったためスキップ'); continue; }

  const result = await runAuditFixAgent({
    scope: c.scope,
    entityId: c.id,
    findings: targetFindings,
    currentEntity: broken,
    all: allRaw as never,
    auditFn: (override) => auditMasterData(override as never),
    baselineFailKeys,
    maxAttempts: 3,
  });

  result.log.forEach((l) => console.log('  •', l));
  console.log('  diff:', result.diff.map((d) => `${d.path}: ${JSON.stringify(d.before)}→${JSON.stringify(d.after)}`).join(', '));
  console.log('  結果:', result.ok ? 'PASS ✅' : 'FAIL ❌');

  const okMinimal = result.diff.length > 0 && result.diff.length <= 3; // 最小変更
  if (!result.ok) { allPass = false; console.log('  → 修正が検証を通らなかった'); }
  if (!okMinimal) { console.log(`  → 変更が最小でない可能性（diff ${result.diff.length}件）`); }
}

console.log('');
if (allPass) {
  console.log('✅ 監査修正エージェント 統合テスト合格: 壊したデータを修正→二層ゲートPASS');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格');
  process.exit(1);
}
