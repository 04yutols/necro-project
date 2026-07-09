/**
 * シミュレータ連携エージェント（Agent E）のライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-sim-eval
 *
 * 決定論的レポート（buildSimulationReport）を作り、LLM が解釈して評定を返すことを確認する。
 * 強すぎ scenario → TOO_STRONG + power 減少推奨 / 弱すぎ scenario → TOO_WEAK を期待。失敗時 exit 1。
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

const { buildSimulationReport } = await import('../src/lib/agent/sim/simulationReport.ts');
const { runSimEvalAgent } = await import('../src/lib/agent/simEvalAgent.ts');

type SimTarget = { id: string; tier?: string; hp: number; def: number; resistances: Record<string, number> };
// 第1章相当の敵帯（MINION 低HP 〜 BOSS 高HP）
const TARGETS: SimTarget[] = [
  { id: 'grave_soldier', tier: 'MINION', hp: 15, def: 3, resistances: {} },
  { id: 'rot_hound', tier: 'MINION', hp: 14, def: 2, resistances: {} },
  { id: 'abyss_warden', tier: 'ELITE', hp: 36, def: 5, resistances: {} },
  { id: 'bone_colossus', tier: 'ELITE', hp: 72, def: 9, resistances: {} },
  { id: 'ossuary_wyrm_lord', tier: 'BOSS', hp: 90, def: 10, resistances: {} },
];

const designContext = [
  'PHYS_SINGLE / mpCost 6 / Tier1 の power 帯: 1.20〜1.55（設計書19）',
  'エネルギー効率の目安: 1 EN あたり 20〜35。',
  '1確率が高すぎる（MINION/ELITE を軒並み1確）場合は power 過剰の疑い。',
].join('\n');
const recCheckContext = { skill: { type: 'PHYSICAL', targetType: 'SINGLE', mpCost: 6, tier: 1 } };

async function evalCase(label: string, atk: number, power: number, expect: 'TOO_STRONG' | 'TOO_WEAK') {
  console.log(`\n########## ${label}（atk=${atk} power=${power}）##########`);
  const report = buildSimulationReport(
    { atk, critRate: 5, critDmg: 150 },
    { power, mpCost: 6, element: 'NONE', targetType: 'SINGLE' },
    TARGETS,
  );
  console.log(`  1確率 ${Math.round(report.summary.oneShotRate * 100)}% / 効率 ${report.summary.energyEfficiency} / 平均期待 ${report.summary.avgExpected}`);
  const res = await runSimEvalAgent({ report, designContext, recCheckContext });
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

// 強すぎ: 高 atk × 高 power（全敵1確レベル）/ 弱すぎ: 低 atk × 低 power
const strong = await evalCase('強すぎ scenario', 120, 2.5, 'TOO_STRONG');
const weak = await evalCase('弱すぎ scenario', 20, 0.6, 'TOO_WEAK');

console.log('');
if (strong && weak) {
  console.log('✅ Agent E 統合テスト合格: 決定論レポート→LLM評定（強すぎ/弱すぎを正しく評定）');
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格');
  process.exit(1);
}
