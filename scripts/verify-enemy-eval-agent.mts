/**
 * R-7: enemy 草案バランス評価のライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-enemy-eval
 *
 * 決定論レポート（buildEnemyDraftReport）を作り、LLM が敵の耐久バランスを評定することを確認する。
 * 硬すぎ敵 → TOO_STRONG / 紙装甲敵 → TOO_WEAK を期待。マスターデータは読み取りのみ（非破壊）。失敗時 exit 1。
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

const { selectRepresentativeSkills, medianAttacker, buildEnemyDraftReport, enemyReportToText } =
  await import('../src/lib/agent/sim/enemyDraftReport.ts');
const { runEnemySimEvalAgent } = await import('../src/lib/agent/simEvalAgent.ts');
const { buildEnemyDesignContext } = await import('../src/lib/agent/actionSupport.ts');
const { getJobBaseStatsAtLevel } = await import('../src/logic/JobGrowthSystem.ts');

const MASTER = path.join(process.cwd(), 'src', 'data', 'master');
const skills = JSON.parse(fs.readFileSync(path.join(MASTER, 'skills.json'), 'utf-8'));
const jobs = JSON.parse(fs.readFileSync(path.join(MASTER, 'jobs.json'), 'utf-8'));
const enemies = JSON.parse(fs.readFileSync(path.join(MASTER, 'enemies.json'), 'utf-8'));

const LEVEL = 10;
const jobStatList = Object.values(jobs).map((j) => {
  const job = j as Record<string, unknown>;
  const s = getJobBaseStatsAtLevel(
    { baseStatsByLevel: job.baseStatsByLevel as never, statModifiers: job.statModifiers as never },
    LEVEL,
  );
  return { atk: s.atk, critRate: s.critRate, critDmg: s.critDmg };
});
const attacker = medianAttacker(jobStatList);
const repSkills = selectRepresentativeSkills(skills);
const designContext = buildEnemyDesignContext(enemies);

console.log(`代表アタッカー（Lv${LEVEL} 全職業中央値）: atk=${attacker.atk} critRate=${attacker.critRate} critDmg=${attacker.critDmg}`);
console.log(`代表スキル: ${repSkills.map((s) => `${s.id}(${s.classification})`).join(', ')}`);

async function evalCase(
  label: string,
  target: { id: string; tier: string; hp: number; def: number; resistances: Record<string, number> },
  expect: 'TOO_STRONG' | 'TOO_WEAK',
) {
  console.log(`\n########## ${label}（${target.tier} HP${target.hp}/DEF${target.def}）##########`);
  const report = buildEnemyDraftReport(attacker, repSkills, target);
  console.log(enemyReportToText(report).split('\n').map((l) => '  ' + l).join('\n'));
  const res = await runEnemySimEvalAgent({
    report,
    designContext,
    recCheckContext: { enemy: { tier: target.tier, existingEnemies: enemies } },
  });
  res.log.forEach((l) => console.log('  •', l));
  if (res.error) { console.log('  エラー:', res.error); return false; }
  const ev = res.evaluation!;
  console.log('  verdict:', ev.verdict, '/ rationale:', ev.rationale);
  ev.recommendations.forEach((r, i) => console.log(`  推奨${i + 1}: ${r.target} ${r.current}→${r.suggested}（${r.reason}）`));
  res.recChecks.forEach((c) => { if (!c.inBand) console.log('  ⚠ 帯外推奨:', c.note); });
  const ok = ev.verdict === expect;
  console.log('  判定:', ok ? `PASS ✅（期待 ${expect}）` : `MISS ❌（期待 ${expect} / 実際 ${ev.verdict}）`);
  return ok;
}

// 硬すぎ: MINION なのに BOSS 帯超の耐久 / 脆すぎ: BOSS なのに紙装甲
const tooTanky = await evalCase(
  '硬すぎ scenario（MINION なのに要塞）',
  { id: 'draft_fortress_minion', tier: 'MINION', hp: 800, def: 60, resistances: {} },
  'TOO_STRONG',
);
const tooFragile = await evalCase(
  '脆すぎ scenario（BOSS なのに紙装甲）',
  { id: 'draft_paper_boss', tier: 'BOSS', hp: 8, def: 0, resistances: {} },
  'TOO_WEAK',
);

console.log('');
if (tooTanky && tooFragile) {
  console.log('✅ R-7 統合テスト合格: 代表スキル vs 敵草案 → LLM 評定（硬すぎ/脆すぎを正しく評定）');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格');
  process.exit(1);
}
