/**
 * ストーリーシーン生成エージェント（Agent C）のライブ統合テスト（実 Gemini / Vertex）。
 *   実行: npm run agent:verify-story
 *
 * 指示から 3 案を生成し、各案が構造妥当（speaker/expression/参照）であることを確認する。失敗時 exit 1。
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

const { runStoryAgent } = await import('../src/lib/agent/storyAgent.ts');
const { buildStoryContext } = await import('../src/lib/agent/story/storyContext.ts');

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

const characters = readJson('src/data/story/characters.json') as Record<string, { nameJa?: string; expressions?: string[] }>;
const ch1 = (readJson('src/data/story/act1_ch1_royal_capital.json') as { scenes: unknown[] }).scenes as Record<string, unknown>[];
const stages = readJson('src/data/master/stages.json') as Record<string, unknown>;
const areas = readJson('src/data/master/areas.json') as Record<string, unknown>;

const allScenes = ch1 as never[];
const storyContext = buildStoryContext({ characters, allScenes, packScenes: allScenes, insertAfterId: 'CH1_OPEN' });

const validationContext = {
  characters,
  stageIds: new Set(Object.keys(stages)),
  areaIds: new Set(Object.keys(areas)),
  existingSceneIds: new Set(ch1.map((s) => s.id as string)),
};

const skeleton = {
  id: 'CH1_ALDO_REFLECT',
  type: 'MONOLOGUE',
  trigger: { type: 'STAGE_CLEAR', stageId: 'area1_node1' },
  isSkippable: true,
  archiveTitle: '廃城前の追憶',
  archiveChapter: 1,
};

console.log('=== ストーリーシーン生成エージェント 動作確認 ===');
console.log(`バックエンド: ${process.env.GEMINI_BACKEND ?? 'aistudio'}`);
console.log('指示: アルドが廃城の前で、亡くした友ライン を思い出すモノローグ。喪失と前進。');
console.log('');

const result = await runStoryAgent({
  mode: 'new',
  brief: 'アルドが廃城の前で、亡くした友ラインを思い出すモノローグ。喪失を噛みしめつつ前へ進む決意。',
  skeleton,
  storyContext,
  validationContext: validationContext as never,
  candidateCount: 3,
  maxAttempts: 3,
});

result.log.forEach((l) => console.log(' •', l));
if (result.error) console.log('エラー:', result.error);
console.log(`\n--- 構造妥当な候補: ${result.candidates.length}案（除外 ${result.rejected}）---`);
result.candidates.forEach((c, i) => {
  console.log(`\n[案${i + 1}]`);
  for (const ln of (c.scene.lines as { speaker: string | null; text: string; expression?: string }[])) {
    console.log(`  ${ln.speaker ?? 'ナレ'}${ln.expression ? `(${ln.expression})` : ''}: ${ln.text}`);
  }
});

const failures: string[] = [];
if (result.error) failures.push(`agent error: ${result.error}`);
if (result.candidates.length === 0) failures.push('構造妥当な候補が0件');
// 各候補が FAIL 0 であること（runStoryAgent は ok のみ返すが二重確認）
for (const c of result.candidates) {
  if (!c.validation.ok) failures.push('候補に構造FAILが残存');
}

console.log('');
if (failures.length === 0) {
  console.log(`✅ Agent C 統合テスト合格: ${result.candidates.length}案が構造妥当（speaker/expression/参照OK）`);
  process.exit(0);
} else {
  console.log('❌ 統合テスト不合格:');
  failures.forEach((f) => console.log('  -', f));
  process.exit(1);
}
