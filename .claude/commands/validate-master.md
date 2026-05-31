マスターデータ JSON を一括検証します。$ARGUMENTS

$ARGUMENTS がある場合は指定ファイルのみ検証する（例: `enemies`、`skills`）。
$ARGUMENTS がない場合は全ファイルを検証する。

## 対象ファイル

```
src/data/master/enemies.json
src/data/master/skills.json
src/data/master/stages.json
src/data/master/items.json
src/data/master/demonForms.json
src/data/master/jobs.json
```

## Step 1: TypeScript 型チェック

```bash
npx tsc --noEmit 2>&1 | grep "master\|MasterData"
```

MasterDataService を経由した型エラーを検出する。

## Step 2: enemies.json — バランス異常チェック

```bash
node -e "
const data = require('./src/data/master/enemies.json');
const entries = Object.values(data);
const byTier = { BOSS: [], ELITE: [], NORMAL: [] };
for (const e of entries) {
  const tier = e.tier || 'NORMAL';
  if (byTier[tier]) byTier[tier].push({ id: e.id, hp: e.stats?.hp, atk: e.stats?.atk });
}
console.log('BOSS:', JSON.stringify(byTier.BOSS));
console.log('ELITE:', JSON.stringify(byTier.ELITE));
console.log('NORMAL (first 3):', JSON.stringify(byTier.NORMAL.slice(0,3)));
"
```

確認項目:
- BOSS の hp/atk が同エリアの ELITE より高いか
- stats フィールドが全エネミーに存在するか
- skillIds が定義されている場合、skills.json に存在するか

## Step 3: skills.json — 必須フィールド確認

```bash
node -e "
const skills = require('./src/data/master/skills.json');
const required = ['id','name','mpCost','power','type','element','attackType','targetType'];
let errors = 0;
for (const [id, s] of Object.entries(skills)) {
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
let errors = 0;
const stageIds = new Set(Object.keys(stages));
for (const [id, s] of Object.entries(stages)) {
  // unlockRequires の参照チェック
  for (const req of (s.unlockRequires || [])) {
    if (!stageIds.has(req)) {
      console.log('INVALID unlockRequires in', id, ': \"' + req + '\" not found');
      errors++;
    }
  }
}
if (!errors) console.log('stages.json: OK (' + Object.keys(stages).length + ' stages)');
"
```

## Step 5: demonForms.json — jobId 参照チェック

```bash
node -e "
const forms = require('./src/data/master/demonForms.json');
const jobs = require('./src/data/master/jobs.json');
const jobIds = new Set(Object.keys(jobs));
let errors = 0;
for (const [id, f] of Object.entries(forms)) {
  if (f.jobId && !jobIds.has(f.jobId)) {
    console.log('INVALID jobId in', id, ': \"' + f.jobId + '\" not in jobs.json');
    errors++;
  }
  if (!f.effectA) { console.log('MISSING effectA in', id); errors++; }
  if (!f.effectB) { console.log('MISSING effectB in', id); errors++; }
}
if (!errors) console.log('demonForms.json: OK (' + Object.keys(forms).length + ' forms)');
"
```

## Step 6: jobs.json — スキル参照チェック

```bash
node -e "
const jobs = require('./src/data/master/jobs.json');
const skills = require('./src/data/master/skills.json');
const skillIds = new Set(Object.keys(skills));
let errors = 0;
let tier1 = 0, tier2 = 0;
for (const [id, j] of Object.entries(jobs)) {
  if (j.tier === 1) tier1++; else if (j.tier === 2) tier2++;
  for (const sid of (j.skills || [])) {
    if (!skillIds.has(sid)) {
      console.log('INVALID skillId in', id, ': \"' + sid + '\" not in skills.json');
      errors++;
    }
  }
}
console.log('jobs.json: Tier1=' + tier1 + ', Tier2=' + tier2 + ' (expected Tier1=4, Tier2=8)');
if (!errors) console.log('jobs.json: cross-reference OK');
"
```

## 結果の出力形式

```
## マスターデータ検証結果

TypeScript: ✅ OK / ❌ <N>件のエラー
enemies.json: ✅ OK / ⚠️ <問題の詳細>
skills.json: ✅ <N>件 OK / ⚠️ <問題の詳細>
stages.json: ✅ OK / ⚠️ <問題の詳細>
demonForms.json: ✅ OK / ⚠️ <問題の詳細>
jobs.json: Tier1=4, Tier2=8 ✅ / ⚠️ <問題の詳細>

合計 <X> 件の問題を検出。
```
