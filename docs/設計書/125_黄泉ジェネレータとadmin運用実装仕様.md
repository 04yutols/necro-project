# 125 黄泉の階層 M4: ジェネレータ・管理画面 実装仕様

> ステータス: **実装仕様（未実装）** — [`YOMI_実装計画.md`](../progress/YOMI_実装計画.md) §2 M4（M4-1〜M4-5）の実装前仕様。
> 作成: 2026-07-05 / admin-agent-dev 調査・PM整理。行番号は 2026-07-05 時点の現行コードで全数確認済み。
> 対の仕様書: [`124_黄泉DB基盤実装仕様.md`](124_黄泉DB基盤実装仕様.md)（M1）

---

## 0. 前提訂正（着手前に必ず確認 — 計画・設計書との食い違い11件）

1. **`ossuary_wyrm_lord` は現時点で hp90/def10/shieldHp34 のまま**（BAL-2 未適用）。ジェネレータは倍率しか書かないため M0 未着手でも実装・実行できるが、実際の戦闘数値が doc123 のアンカーと一致するのは M0 適用後
2. **doc122/123 のアンカー表は近似値**。実際は `EnemyScaling.ts:10-15` の `Math.floor(base * factor)`（キー毎独立切り捨て）。厳密値: BAL-2 適用後 **B10 = HP390/ATK25/DEF35、B20 = HP925/ATK50/DEF55**（±1 のズレ）。実装は §1.3 の厳密テーブルを正とする
3. **statScale>3 WARN の発火階は「B12以降」ではなく hp: B14〜B20（7階）、atk: B20 のみ**（1.09^13=3.066 で n=14 から）。def は B20 でも 2.31 で非発火
4. **`stageBalance.ts:239` の baseExp===0 WARN が全20階で出る**（黄泉は baseExp:0 規約のため。計画書に未記載だった）
5. **statScale / baseExp の WARN はどの経路でも何もブロックしない**。/admin/audit（`auditMasterData()`）と CI の `master-data-audit.mjs` はどちらもこれらのチェックを未実装。`stageBalance.ts` を呼ぶのは Agent A（本件非経由）と Agent B（audit-fix）のみで、Agent B のゲートは FAIL のみ判定
6. **CI の `data:audit`（ci.yml:44）は `--strict` なし = FAIL が何件あっても CI は常に緑**。マスターデータの内容的正しさは「/admin/audit を人間が目視で FAIL=0 確認」する運用でしか担保されていない（黄泉固有でなく既存仕様。M5 のリリース判定は手動確認が必須）
7. `master-data-audit.mjs` の `DROP_TYPES`（:37）に `WEAPON_MATERIAL` が無い（admin 側 `auditDropReference` は対応済み）。将来 `--strict` 化する際の既知ギャップ（黄泉の生成物には非影響）
8. **報酬パイプラインに「初回のみゴールド」を表現する型が存在しない**。ゴールドの唯一の経路は `goldGain = stage.rewards.baseGold`（`actions.ts:694`、毎回払い出し）で、`DropEntry`/`GuaranteedDropEntry`（`game.ts:336-348`）に GOLD 型はない。baseGold:0 規約の下では**黄泉フロアは通貨報酬を出せない** → doc122 §6.3 の「ゴールド」文言は現行型では実装不可（→ doc122 U-6 として登録）
9. **既存バランスツールは軒並み `wave.statScale` を無視する**（balance-report / progression-report / /admin/simulator / Agent E の `buildSimTargets` すべて enemies.json 生値のみ参照）。黄泉はこれらのツールから統計的に不可視（B1〜B19 が同じ生数値に見える）→ §1.8 のジェネレータ dry-run に実効ステータス出力を持たせて埋め合わせる
10. `StageForm.tsx:30` の WAVE_ROLES に UI 上 `'MINIBOSS'` があるが型・バリデータに存在せず、選ぶと監査 FAIL（既存ドリフト）。黄泉の手編集運用では**選ばない**
11. `/admin/areas/new` の自動採番は `ch2/area3` を提案してくる（`getNextAreaDraft`）。`ch1_area99` 登録時は chapter=1 / area=99 を**手動上書き**する（§2.2）

---

## 1. M4-1: `scripts/generate-yomi-floors.mjs`

### 1.1 既存慣例の踏襲

- shebang + ESM + `fileURLToPath` の rootDir 解決（`master-data-audit.mjs:1-9` と同型）。引数は `--key=value`/`--flag`（`getArgValue` ヘルパ踏襲）
- `.mjs` スクリプト群は TS を import しない慣例 → `stageBalance.ts`/`EnemyScaling.ts` は import せず、必要なチェック・計算式をスクリプト内に再実装（式が同一であることをコメントで明記）
- **既存スクリプトはすべて read-only であり、本スクリプトは「マスターデータへ書き込む最初のスクリプト」になる** → フラグなし実行は絶対に書き込まない（dry-run デフォルト）

### 1.2 CLI 契約と npm script

```jsonc
"data:generate-yomi": "node scripts/generate-yomi-floors.mjs",
```

```
node scripts/generate-yomi-floors.mjs                 # dry-run（デフォルト）: JSON+差分+実効ステータス統計を stdout へ
node scripts/generate-yomi-floors.mjs --write         # stages.json へ atomic write（未存在の yomi_bNN のみ追加）
node scripts/generate-yomi-floors.mjs --write --force # 既存 yomi_bNN を再生成値で上書き（admin手編集破棄）
node scripts/generate-yomi-floors.mjs --floors=5-10   # 対象階層のスコープ指定
node scripts/generate-yomi-floors.mjs --json          # dry-run 結果を機械可読 JSON で
```

書き込みは `writeJsonAtomic`（`admin/actions.ts:58-63`）と同じ tmp→`fs.renameSync` パターンをスクリプト内に再実装（'use server' ファイルは import 不可のため。5行程度）。

### 1.3 係数関数と厳密スケーリング表

```js
function computeStatScale(n) {
  if (n <= 1) return undefined; // B1 は省略（StageForm の「1.0 は保存時省略」仕様に合わせる）
  return {
    hp:  Number((1.09  ** (n - 1)).toFixed(4)),
    atk: Number((1.07  ** (n - 1)).toFixed(4)),
    def: Number((1.045 ** (n - 1)).toFixed(4)),
  };
}
function floorType(n) {
  if (n % 10 === 0) return 'BOSS';
  if (n % 5 === 0) return 'ELITE';
  return 'NORMAL';
}
```

全20階の倍率（4桁丸め。ランタイムは `Math.floor(base*factor)` を各キー独立適用）:

| n | type | hp | atk | def | WARN |
|---|---|---|---|---|---|
| 1 | NORMAL | 1.0000 | 1.0000 | 1.0000 | — |
| 2 | NORMAL | 1.0900 | 1.0700 | 1.0450 | — |
| 3 | NORMAL | 1.1881 | 1.1449 | 1.0920 | — |
| 4 | NORMAL | 1.2950 | 1.2250 | 1.1412 | — |
| 5 | ELITE | 1.4116 | 1.3108 | 1.1925 | — |
| 6 | NORMAL | 1.5386 | 1.4026 | 1.2462 | — |
| 7 | NORMAL | 1.6771 | 1.5007 | 1.3023 | — |
| 8 | NORMAL | 1.8280 | 1.6058 | 1.3609 | — |
| 9 | NORMAL | 1.9926 | 1.7182 | 1.4221 | — |
| 10 | **BOSS** | 2.1719 | 1.8385 | 1.4861 | — |
| 11 | NORMAL | 2.3674 | 1.9672 | 1.5530 | — |
| 12 | NORMAL | 2.5804 | 2.1049 | 1.6229 | — |
| 13 | NORMAL | 2.8127 | 2.2522 | 1.6959 | — |
| 14 | NORMAL | 3.0658 | 2.4098 | 1.7722 | hp |
| 15 | ELITE | 3.3417 | 2.5785 | 1.8519 | hp |
| 16 | NORMAL | 3.6425 | 2.7590 | 1.9353 | hp |
| 17 | NORMAL | 3.9703 | 2.9522 | 2.0224 | hp |
| 18 | NORMAL | 4.3276 | 3.1588 | 2.1134 | hp |
| 19 | NORMAL | 4.7171 | 3.3799 | 2.2085 | hp |
| 20 | **BOSS** | 5.1417 | 3.6165 | 2.3079 | hp+atk |

BAL-2 適用後のボス階厳密値（shieldHp はスケール対象外キーのため50固定）: **B10 = HP390/ATK25/DEF35/shield50、B20 = HP925/ATK50/DEF55/shield50**。

### 1.4 Ch1 エネミープール割当と WAVE テンプレ

```js
const MINION_POOL       = ['grave_soldier','rot_hound','hollow_handmaid','earthbound_grudge','bloodmire_leech','wandering_guard_wraith','dragonbone_spawn']; // 7体
const ELITE_SHIELD_POOL = ['abyss_warden','bone_colossus','cursed_head_maid'];   // shieldHp>0 の3体（SHIELD role 用）
const ELITE_CLOSER_POOL = ['abyss_warden','grave_knight','bone_colossus','cursed_head_maid']; // 4体
const BOSS_LEADIN_ENEMY = 'bone_colossus';
const BOSS_ENEMY        = 'ossuary_wyrm_lord';
```

| type | WAVE1 | WAVE2 | WAVE3 |
|---|---|---|---|
| NORMAL | WARMUP: MINION×2 | SHIELD: MINION×1 + ELITE_SHIELD×1 | ELITE: ELITE_CLOSER×1 + MINION×1 |
| ELITE (5,15) | WARMUP: MINION×2 | SHIELD: ELITE_SHIELD×1 + MINION×1 | ELITE: bone_colossus 単体 |
| BOSS (10,20) | WARMUP: MINION×2 | ELITE: bone_colossus 単体 | BOSS: ossuary_wyrm_lord 単体 |

- **1階内の全 WAVE に同一 statScale を焼き込む**（既存 Ch1 とは異なる黄泉の新規約 — 明記必須）
- 割当は決定論ローテーション（NORMAL: W1=`[MINION[idx%7], MINION[(idx+3)%7]]` / W2=SHIELD:`[MINION[(idx+1)%7], ELITE_SHIELD[idx%3]]` / W3=ELITE:`[ELITE_CLOSER[idx%4], MINION[(idx+5)%7]]`、`idx = n-1`）。**全20階の確定展開表は本書末尾の付録**。実装はこの表と一致することでロジックの正しさを検証する
- SHIELD role に shieldHp>0 の敵を含む・role=BOSS に tier=BOSS を含む（`master-data-audit.mjs:345-350` WARN 回避）ことを全階で充足済み
- `unlockRequires` の `'area1_node3'` はハードコードせず、`YomiFloors.ts` の `CH1_FINAL_NODE_ID` と**同一値であることをジェネレータの自己チェックに含める**（.mjs は TS を import しない慣例のため、定数の二重定義+検証で同期を担保）

### 1.5 報酬テーブル（型として確定・数値は M2-4 の裁量）

- 全階共通: `baseExp:0, baseGold:0, dropTable:[]`
- **通貨報酬は不可**（前提訂正 #8）→ `firstClearGuaranteed` は `MATERIAL` / `WEAPON_MATERIAL` / `RESIDUE` のみで構成
- 節目（5/10/15/20）: `RESIDUE`（`firstClearGuaranteed` は chapter ゲートを通らないため chapter=1 でも付与可）+ `WEAPON_MATERIAL` を追加
- U-3（残滓オプション設定アイテム）は未確定のためスキーマに含めない（後日 itemId 差し替え）

```js
function buildRewardsForFloor(n) {
  const milestone = [5,10,15,20].includes(n);
  const guaranteed = [{ type: 'MATERIAL', itemId: n < 5 ? 'bone_chip' : n < 10 ? 'grave_crystal' : 'ossuary_memory', quantity: milestone ? 2 : 1 + Math.floor(n/7) }];
  if (milestone) {
    guaranteed.push({ type: 'WEAPON_MATERIAL', weaponMaterialType: n < 10 ? 'IDEA_SR' : n < 20 ? 'IDEA_SSR' : 'ABYSSAL_OBSIDIAN', quantity: 1 });
    guaranteed.push({ type: 'RESIDUE', rarity: n < 10 ? 'RARE' : n < 20 ? 'EPIC' : 'LEGENDARY', quantity: 1 });
  }
  return { baseExp: 0, baseGold: 0, dropTable: [], firstClearGuaranteed: guaranteed };
}
```

### 1.6 出力サンプル（StageData 準拠・抜粋 B10）

```json
"yomi_b10": {
  "id": "yomi_b10", "name": "Yomi Depths B10", "nameJa": "黄泉の階層 B10", "nameEn": "YOMI B10",
  "chapter": 1, "chapterName": "黄泉の階層", "area": 99,
  "nodeType": "DUNGEON", "element": "DARK", "difficulty": 10, "sortOrder": 9010,
  "description": "10階層ごとのボス階。強化された死骨竜王オッサリウスが待ち構える最初の壁。",
  "waveCount": 3, "areaGimmick": "NONE", "unlockRequires": ["yomi_b09"],
  "waves": [
    { "label": "WAVE 1", "role": "WARMUP", "enemyIds": ["hollow_handmaid", "wandering_guard_wraith"], "intent": "ボス戦前の消耗。", "statScale": { "hp": 2.1719, "atk": 1.8385, "def": 1.4861 } },
    { "label": "WAVE 2", "role": "ELITE", "enemyIds": ["bone_colossus"], "intent": "強化ELITEで防壁破壊を練習させる。", "statScale": { "hp": 2.1719, "atk": 1.8385, "def": 1.4861 } },
    { "label": "WAVE 3", "role": "BOSS", "enemyIds": ["ossuary_wyrm_lord"], "intent": "最初のボス階。HP50%以下の怒りと復活を強化された数値で越える。", "statScale": { "hp": 2.1719, "atk": 1.8385, "def": 1.4861 } }
  ],
  "rewards": { "baseExp": 0, "baseGold": 0, "dropTable": [],
    "firstClearGuaranteed": [
      { "type": "MATERIAL", "itemId": "ossuary_memory", "quantity": 2 },
      { "type": "WEAPON_MATERIAL", "weaponMaterialType": "IDEA_SSR", "quantity": 1 },
      { "type": "RESIDUE", "rarity": "EPIC", "quantity": 1 }
    ] },
  "position": { "x": 200, "y": 440 }
}
```

B1 は statScale なし（1.0省略）・報酬は素材1個のみ。B5 は ELITE 型 + RARE 残滓チェスト（完全サンプルは生成スクリプトの dry-run 出力で確認）。

**全階共通の絶対ルール**:
- `isAreaBoss` は**全階で省略**（true 厳禁。`actions.ts:876` の isBossStage 判定 → 世界初回ボスログ + BOSS_KILLS 水増しの唯一の残リスク）
- `position = { x: 900000 + n*100, y: 900000 }`（**2026-07-09 改訂**: 旧規約 `y=80+(n-1)*40` は実マップ座標と衝突し audit 近接WARN+5件のノイズを生んだため、エリア自体と同じ画面外座標系へ変更。黄泉同士も100px間隔でWARNなし。§1.6 のサンプルJSON中の position は旧規約時点の値であり、この行を正とする）
- `difficulty = n`（1〜20）: StagesList のグループ内ソート `(difficulty, nodeType, id)` で B1→B20 が自然に並ぶ

### 1.7 再生成ポリシー（設計判断）

| 案 | 内容 | 評価 |
|---|---|---|
| **① 一度きり生成（推奨・採用）** | 初回のみ `--write`。以後は admin 手編集が正 | doc122 D-13/§6.1「セット追加は新階層番号の追記」と整合。誤操作は既存キー検出+`--force` 要求で防止 |
| ② `--floors=N-M` 部分再生成 | 範囲限定の再計算 | 需要が生じたら追加。`buildStageForFloor(n)` を純関数化しておき書き直しなしで拡張可能にする |
| ③ statScale のみ更新モード | 手編集の WAVE 構成・報酬を保持し係数だけ更新 | マージロジックの複雑さと巻き戻しリスクに見合わず不採用 |

既存 yomi_* 検出時は `--force` なしで abort（件数と ID を表示して exit 1）。

### 1.8 検証フロー

1. **dry-run 出力に「実効ステータス」テーブルを含める**（前提訂正 #9 の埋め合わせ。各階×各敵の `Math.floor(base*scale)` 結果 — 既存バランスツールが statScale を見ない穴をジェネレータ自身が補う）+ 自己チェック（ID形式 `/^yomi_b\d{2}$/`・重複なし・unlockRequires 鎖・enemyId 実在・isAreaBoss 不在）で FAIL 相当は非0 exit
2. `--write` 後: `npx tsc --noEmit` → `node scripts/master-data-audit.mjs --type=stages --strict` を**手動で**実行し FAIL=0 確認（CI は --strict なしのため手動必須・前提訂正 #6）→ **/admin/audit を開いて目視 FAIL=0**（実運用のリリースゲート）→ `balance:report` は `--stage=yomi_bNN` の個別指定で（`--all` は境目の無意味な比較が混ざる）→ stageGraph 到達性は /admin/audit の G1 出力で確認

---

## 2. M4-2: admin 運用手順

### 2.1 StageForm 編集（改修不要・運用注意3点）

1. `/admin/stages/yomi_bNN` → WAVE設定タブで statScale.hp/atk/def を調整 → 保存（`writeJsonAtomic` でローカルの stages.json 直接更新）→ /admin/audit で FAIL=0 確認
2. **注意①**: B1 は statScale=1.0 が保存時省略される仕様のため編集画面で全欄空欄表示（バグではない。空欄=1.0扱い）
3. **注意②**: `/admin/stages/new` の ID 自動生成は yomi_ 非対応 → 新規追加（B21+含む）はジェネレータ or ID 手入力
4. **注意③**: WAVE role の選択肢に出る `MINIBOSS` は型・バリデータ未対応の既存ドリフト。**選ばない**（選ぶと監査 FAIL）

### 2.2 `/admin/areas` での `ch1_area99` 登録

推奨値:

```json
{ "id": "ch1_area99", "chapter": 1, "area": 99, "nameJa": "黄泉の階層", "nameEn": "THE YOMI DEPTHS",
  "description": "第1章の敵を再構成した独立チャレンジタワー。B1から下り続ける。",
  "color": "#4B0082", "position": {"x": 999999, "y": 999999}, "sortOrder": 199 }
```

- `sortOrder=199` = `chapter*100+area` の既存慣例（101/202）どおり、Ch1 と Ch2 の間に並ぶ
- `position` は画面外座標（M3-0 フィルタ漏れ時の防御）
- 手順: `/admin/areas/new` → 自動提案の chapter=2/area=3 を **chapter=1 / area=99 に手動上書き**（前提訂正 #11）→ ID/sortOrder が自動追随 → 保存 → /admin/audit で areas FAIL=0

---

## 3. M4-3: StagesList 圧迫対策 → **改修不要（確定）**

- 一覧は既にエリア別グルーピング済み（`buildStageAreaStageGroups`）→ `ch1_area99` 登録で自動的に専用セクション化
- グループ内ソート `(difficulty, nodeType, id)` で B1→B20 が自然に並ぶ（difficulty=n 採用の根拠）
- エリアフィルタ chips で黄泉20件のみに絞り込み可 / 各行はデフォルト折りたたみで20件でも破綻しない

## 4. M4-4: 監査 WARN の運用 → **① 運用メモのみ（バリデータ非改修）で確定**

- 対象 WARN: statScale>3（hp: B14〜B20、atk: B20）+ baseExp=0（全20階）
- **これらの WARN はどの経路でもリリースゲートに影響しない**（/admin/audit・CI とも未実装チェック。Agent B は FAIL のみ判定）→ バリデータ改修（黄泉例外 or 閾値可変化）は複雑度に見合わず不採用
- 運用メモ（本書が正）: 「黄泉ステージを Agent A/B 経由で扱うと statScale>3 / baseExp=0 の WARN が表示されるが、高難度用途・リプレイ経済防止のための意図した設計であり無視してよい」
- **Agent B 利用時の追加ガード**: 黄泉ステージを audit-fix にかける場合、diff プレビューで `nodeType` / `isAreaBoss` が変更されていないことを目視確認する（LLM が「BOSS らしく直す」提案をしてもバリデータは咎めないため）

## 5. M4-5: 本番反映運用

- admin Server Action は `assertDev()` により**本番では動作しない** — 調整はローカル `npm run dev` の /admin で行い、ワーキングツリーの stages.json が変わる
- フロー: ローカル admin で調整 → `git diff` レビュー → tsc / jest / **/admin/audit 目視 FAIL=0** → コミット・PR → マージ → **デプロイは手動 `npm run deploy`**（= opennextjs-cloudflare build && deploy。デプロイ用 CI/CD ワークフローは存在しない）
- **運用文書の必須一文**: 「黄泉の係数調整は admin 保存だけでは本番に反映されません。コミット・マージ後、`npm run deploy` の手動実行で初めて反映されます」

## 6. シミュレータ / AI エージェント統合

### 6.1 現状ギャップ（確定事実）

/admin/simulator・Agent E（`buildSimTargets`）とも enemies.json 生値のみを参照し statScale を注入する口がない → **スケール後の黄泉フロアを直接試算する手段は現状存在しない**。

### 6.2 手動検証プリセット（現状の最善策）

| プリセット | 方法 |
|---|---|
| B1 | 各 WAVE 敵をそのまま選択（無スケールなので正確） |
| B10 | `ossuary_wyrm_lord` 選択 + カスタム防御 ON で `customDef=35` 手入力（BAL-2 適用後前提）。HP/ATK は上書き欄がないため `scaledHP ÷ 期待ダメージ` を手計算で TTK 概算 |
| B20 | 同様に `customDef=55` |

### 6.3 将来バックログ（M4 範囲外として申し送り）

`buildSimTargets` に `statScale?: EnemyStatScale` 引数を追加 + SimulatorClient に HP 上書き欄 → Agent E で黄泉フロアの直接評価が可能になる。Server Action シグネチャ変更を伴うため別チケット。

### 6.4 Agent B / E の誤動作リスク

- Agent B: 構造チェックのみで黄泉を能動的に壊す経路はない。ただし §4 の目視ガードを運用に含める
- Agent E: そもそも黄泉を入力にできない（誤評価リスク実質ゼロ。裏返しの課題は §6.1/6.3）

---

## 7. 検討事項まとめ

| 論点 | 推奨（本書で確定） |
|---|---|
| 再生成ポリシー | ① 一度きり生成 + admin 手編集（floor 単位純関数化で②への拡張余地は残す） |
| difficulty 値 | n（1〜20）そのまま |
| WARN 運用 | ① 運用メモのみ・バリデータ非改修 |
| Agent E 統合 | 現状ギャップ明記・対応は将来バックログ |
| 通貨（ゴールド）報酬 | **U-6 決定（2026-07-05）: 通貨なしで確定**。firstClearGuaranteed は素材/武器素材/残滓のみで構成（GOLD 型は新設しない） |

## 付録: 全20階の確定割当表（決定論ローテーション実行結果）

| 階 | 種別 | WAVE1 (WARMUP) | WAVE2 | WAVE3 |
|---|---|---|---|---|
| B01 | NORMAL | grave_soldier, earthbound_grudge | SHIELD: rot_hound, abyss_warden | ELITE: abyss_warden, wandering_guard_wraith |
| B02 | NORMAL | rot_hound, bloodmire_leech | SHIELD: hollow_handmaid, bone_colossus | ELITE: grave_knight, dragonbone_spawn |
| B03 | NORMAL | hollow_handmaid, wandering_guard_wraith | SHIELD: earthbound_grudge, cursed_head_maid | ELITE: bone_colossus, grave_soldier |
| B04 | NORMAL | earthbound_grudge, dragonbone_spawn | SHIELD: bloodmire_leech, abyss_warden | ELITE: cursed_head_maid, rot_hound |
| B05 | ELITE | bloodmire_leech, dragonbone_spawn | SHIELD: bone_colossus, rot_hound | ELITE: bone_colossus（単体） |
| B06 | NORMAL | wandering_guard_wraith, rot_hound | SHIELD: dragonbone_spawn, cursed_head_maid | ELITE: grave_knight, earthbound_grudge |
| B07 | NORMAL | dragonbone_spawn, hollow_handmaid | SHIELD: grave_soldier, abyss_warden | ELITE: bone_colossus, bloodmire_leech |
| B08 | NORMAL | grave_soldier, earthbound_grudge | SHIELD: rot_hound, bone_colossus | ELITE: cursed_head_maid, wandering_guard_wraith |
| B09 | NORMAL | rot_hound, bloodmire_leech | SHIELD: hollow_handmaid, cursed_head_maid | ELITE: abyss_warden, dragonbone_spawn |
| B10 | **BOSS** | hollow_handmaid, wandering_guard_wraith | ELITE: bone_colossus（単体） | BOSS: ossuary_wyrm_lord |
| B11 | NORMAL | earthbound_grudge, dragonbone_spawn | SHIELD: bloodmire_leech, bone_colossus | ELITE: bone_colossus, rot_hound |
| B12 | NORMAL | bloodmire_leech, grave_soldier | SHIELD: wandering_guard_wraith, cursed_head_maid | ELITE: cursed_head_maid, hollow_handmaid |
| B13 | NORMAL | wandering_guard_wraith, rot_hound | SHIELD: dragonbone_spawn, abyss_warden | ELITE: abyss_warden, earthbound_grudge |
| B14 | NORMAL | dragonbone_spawn, hollow_handmaid | SHIELD: grave_soldier, bone_colossus | ELITE: grave_knight, bloodmire_leech |
| B15 | ELITE | grave_soldier, hollow_handmaid | SHIELD: cursed_head_maid, bloodmire_leech | ELITE: bone_colossus（単体） |
| B16 | NORMAL | rot_hound, bloodmire_leech | SHIELD: hollow_handmaid, abyss_warden | ELITE: cursed_head_maid, dragonbone_spawn |
| B17 | NORMAL | hollow_handmaid, wandering_guard_wraith | SHIELD: earthbound_grudge, bone_colossus | ELITE: abyss_warden, grave_soldier |
| B18 | NORMAL | earthbound_grudge, dragonbone_spawn | SHIELD: bloodmire_leech, cursed_head_maid | ELITE: grave_knight, rot_hound |
| B19 | NORMAL | bloodmire_leech, grave_soldier | SHIELD: wandering_guard_wraith, abyss_warden | ELITE: bone_colossus, hollow_handmaid |
| B20 | **BOSS** | wandering_guard_wraith, rot_hound | ELITE: bone_colossus（単体） | BOSS: ossuary_wyrm_lord |

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-05 | 初版（admin-agent-dev 調査。未実装・適用は YOMI 実装計画 M4） |
| 2026-07-05 | 付録に全20階の確定割当表を追加、CH1_FINAL_NODE_ID 同期チェックの規約を明記 |
| 2026-07-09 | position 規約を画面外座標系（x:900000+n*100 / y:900000）へ改訂（実装レビュー指摘#2 の是正を反映） |
