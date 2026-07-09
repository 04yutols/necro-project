マスターデータ JSON を一括検証します。$ARGUMENTS

$ARGUMENTS がある場合は指定ファイルのみ検証する（例: `enemies`、`skills`）。
$ARGUMENTS がない場合は全ファイルを検証する。

## 対象ファイル（src/data/master/ の 9 ファイル）

```
areas.json  demonForms.json  enemies.json  items.json  jobs.json
materials.json  monsters.json  skills.json  stages.json
```

キー規則: enemies / items / stages / skills / materials / areas は「キー = 内部 `id`」。
jobs / monsters / demonForms はキー自体が ID（オブジェクト内に `id` なし。demonForms はキー = `jobId`）。

## Step 1: TypeScript 型チェック

```bash
npx tsc --noEmit 2>&1 | grep "master\|MasterData"
```

MasterDataService を経由した型エラーを検出する。

## Step 2: enemies.json — バランス・参照チェック

```bash
node -e "
const enemies = require('./src/data/master/enemies.json');
const skills = require('./src/data/master/skills.json');
const items = require('./src/data/master/items.json');
const materials = require('./src/data/master/materials.json');
const monsters = require('./src/data/master/monsters.json');
const skillIds = new Set(Object.keys(skills));
const itemIds = new Set([...Object.keys(items), ...Object.keys(materials)]);
const byTier = { BOSS: [], ELITE: [], MINION: [] };
let errors = 0;
for (const [key, e] of Object.entries(enemies)) {
  if (e.id !== key) { console.log('KEY MISMATCH:', key, '!=', e.id); errors++; }
  if (!e.stats) { console.log('MISSING stats:', key); errors++; }
  (byTier[e.tier] ?? (byTier[e.tier] = [])).push(key + ':hp' + e.stats?.hp + (e.shieldHp ? '/sh' + e.shieldHp : ''));
  for (const d of (e.dropTable || [])) {
    if (d.itemId && !itemIds.has(d.itemId)) { console.log('INVALID dropTable.itemId in', key, ':', d.itemId); errors++; }
    if (d.monsterId && !monsters[d.monsterId]) { console.log('INVALID dropTable.monsterId in', key, ':', d.monsterId); errors++; }
  }
  for (const sid of (e.necromance?.skillIds || [])) {
    if (!skillIds.has(sid)) { console.log('INVALID necromance.skillId in', key, ':', sid); errors++; }
  }
}
console.log(JSON.stringify(byTier));
if (!errors) console.log('enemies.json: OK (' + Object.keys(enemies).length + ' enemies)');
"
```

確認項目:
- BOSS の hp が同エリアの ELITE より高いか（第1章基準: MINION 12-46 / ELITE 36-72 / BOSS 90-150）
- dropTable の itemId / monsterId、necromance.skillIds の参照が切れていないか

## Step 3: skills.json — 必須フィールド確認

```bash
node -e "
const skills = require('./src/data/master/skills.json');
const required = ['id','name','mpCost','power','type','element','attackType','targetType'];
let errors = 0;
for (const [id, s] of Object.entries(skills)) {
  if (s.id !== id) { console.log('KEY MISMATCH:', id, '!=', s.id); errors++; }
  const missing = required.filter(f => s[f] === undefined || s[f] === null);
  if (missing.length) { console.log('MISSING in', id, ':', missing.join(', ')); errors++; }
  if (s.power <= 0) { console.log('INVALID power in', id, ':', s.power); errors++; }
}
if (!errors) console.log('skills.json: OK (' + Object.keys(skills).length + ' skills)');
"
```

## Step 4: stages.json — クロスリファレンス

```bash
node -e "
const stages = require('./src/data/master/stages.json');
const enemies = require('./src/data/master/enemies.json');
const areas = require('./src/data/master/areas.json');
const items = require('./src/data/master/items.json');
const materials = require('./src/data/master/materials.json');
const monsters = require('./src/data/master/monsters.json');
const itemIds = new Set([...Object.keys(items), ...Object.keys(materials)]);
const stageIds = new Set(Object.keys(stages));
const areaPairs = new Set(Object.values(areas).map(a => a.chapter + '-' + a.area));
let errors = 0;
for (const [id, s] of Object.entries(stages)) {
  if (s.id !== id) { console.log('KEY MISMATCH:', id, '!=', s.id); errors++; }
  for (const req of (s.unlockRequires || [])) {
    if (!stageIds.has(req)) { console.log('INVALID unlockRequires in', id, ':', req); errors++; }
  }
  if (s.waveCount !== (s.waves || []).length) { console.log('waveCount mismatch in', id); errors++; }
  for (const w of (s.waves || [])) for (const eid of (w.enemyIds || [])) {
    if (!enemies[eid]) { console.log('INVALID enemyId in', id, ':', eid); errors++; }
  }
  for (const d of (s.rewards?.dropTable || [])) {
    if (d.itemId && !itemIds.has(d.itemId)) { console.log('INVALID rewards.itemId in', id, ':', d.itemId); errors++; }
    if (d.monsterId && !monsters[d.monsterId]) { console.log('INVALID rewards.monsterId in', id, ':', d.monsterId); errors++; }
  }
  if (!areaPairs.has(s.chapter + '-' + s.area)) { console.log('NO AREA for', id, ': ch' + s.chapter + ' area' + s.area); errors++; }
}
if (!errors) console.log('stages.json: OK (' + Object.keys(stages).length + ' stages)');
"
```

## Step 5: demonForms.json — jobId 対応チェック

```bash
node -e "
const forms = require('./src/data/master/demonForms.json');
const jobs = require('./src/data/master/jobs.json');
const jobIds = new Set(Object.keys(jobs));
let errors = 0;
for (const [key, f] of Object.entries(forms)) {
  if (f.jobId !== key) { console.log('KEY MISMATCH:', key, '!=', f.jobId); errors++; }
  if (!jobIds.has(key)) { console.log('INVALID jobId:', key, 'not in jobs.json'); errors++; }
  if (!f.effectA) { console.log('MISSING effectA in', key); errors++; }
  if (!f.effectB) { console.log('MISSING effectB in', key); errors++; }
  if (!f.ultimateSkill) { console.log('MISSING ultimateSkill in', key); errors++; }
}
for (const jid of jobIds) if (!forms[jid]) { console.log('MISSING demonForm for job:', jid); errors++; }
if (!errors) console.log('demonForms.json: OK (' + Object.keys(forms).length + ' forms, jobs と 1:1)');
"
```

## Step 6: jobs.json — スキル参照・Tier 構成チェック

注意: `skills` は `{ level, skillId }` オブジェクトの配列（文字列配列ではない）。

```bash
node -e "
const jobs = require('./src/data/master/jobs.json');
const skills = require('./src/data/master/skills.json');
const stages = require('./src/data/master/stages.json');
const skillIds = new Set(Object.keys(skills));
let errors = 0, tier1 = 0, tier2 = 0;
for (const [id, j] of Object.entries(jobs)) {
  if (j.tier === 1) tier1++; else if (j.tier === 2) tier2++;
  for (const s of (j.skills || [])) {
    if (!skillIds.has(s.skillId)) { console.log('INVALID skillId in', id, ':', s.skillId); errors++; }
  }
  for (const u of (j.unlock?.jobs || [])) {
    if (!jobs[u.jobId]) { console.log('INVALID unlock.jobId in', id, ':', u.jobId); errors++; }
  }
  if (j.unlock?.clearedStageId && !stages[j.unlock.clearedStageId]) {
    console.log('INVALID unlock.clearedStageId in', id, ':', j.unlock.clearedStageId); errors++;
  }
}
console.log('jobs.json: Tier1=' + tier1 + ', Tier2=' + tier2 + ' (expected Tier1=4, Tier2=8)');
if (!errors) console.log('jobs.json: cross-reference OK');
"
```

## Step 7: areas / materials / monsters / items — キー整合チェック

```bash
node -e "
let errors = 0;
for (const f of ['areas', 'materials', 'items']) {
  const data = require('./src/data/master/' + f + '.json');
  for (const [key, v] of Object.entries(data)) {
    if (v.id !== key) { console.log('KEY MISMATCH in ' + f + '.json:', key, '!=', v.id); errors++; }
  }
  console.log(f + '.json: ' + Object.keys(data).length + ' entries');
}
const monsters = require('./src/data/master/monsters.json');
for (const [key, m] of Object.entries(monsters)) {
  if (!m.name || !m.tribe || !m.stats || m.cost == null) { console.log('MISSING fields in monsters.json:', key); errors++; }
}
console.log('monsters.json: ' + Object.keys(monsters).length + ' entries');
if (!errors) console.log('key consistency: OK');
"
```

## 結果の出力形式

```
## マスターデータ検証結果

TypeScript: ✅ OK / ❌ <N>件のエラー
enemies.json: ✅ <N>体 OK / ⚠️ <問題の詳細>
skills.json: ✅ <N>件 OK / ⚠️ <問題の詳細>
stages.json: ✅ <N>件 OK / ⚠️ <問題の詳細>
demonForms.json: ✅ <N>形態 OK / ⚠️ <問題の詳細>
jobs.json: Tier1=4, Tier2=8 ✅ / ⚠️ <問題の詳細>
areas/materials/monsters/items: ✅ OK / ⚠️ <問題の詳細>

合計 <X> 件の問題を検出。
```
