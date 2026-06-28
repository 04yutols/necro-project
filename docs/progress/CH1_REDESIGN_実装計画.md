# 第1章 ステージ拡張 — 設計＆実装計画

策定日: 2026-06-27 / ブランチ: `feature/2026062102`
設計仕様（What）: [`CH1_REDESIGN_ステージ拡張仕様.md`](./CH1_REDESIGN_ステージ拡張仕様.md)
本書（How / 順序）: マイルストーン **A → C → B**（ユーザー決定）→ 後続フェーズ

---

## 0. 進行順と根拠

| 順 | マイルストーン | 内容 | なぜこの順か |
|---|---|---|---|
| **A** | 検証ゲート整備 | G1 解放チェーングラフ健全性 / G2 コード↔マスター stage ID 相互参照 | 既存ノードを再配置する前に「壊れたら検知できる網」を張る。G2が無いとチュート発火・残滓解放が黙って壊れる |
| **C** | 設計判断の確定＋基盤実装 | 物語ノードの扱い / 残滓ノード / ノード数 / **難易度スケール方式** | Bでステージを組む前に、データモデル（nodeType・スケールフィールド）と参照方針を固定する必要がある |
| **B** | ステージ背骨（JSON） | 新規戦闘ノード作成＋既存4ノード再配置、通しプレイ可能化 | A の網と C の確定の上に積むので事故らない |
| 後続 | 新規敵 → チュート再配線 → 物語 → 最終監査 | 仕様書 §6 Phase 2〜5 | Bの背骨が通った後 |

> **G3（STORYノード型）は A ではなく C で扱う**。型を足すか否かは C1 の設計判断そのものなので、決めてから実装する。

---

## マイルストーン A — 検証ゲート整備

**ゴール**: 多ノード章で壊れやすい2点を `/admin/audit` で機械検知できるようにする。データ変更は無し（純粋なツール追加）。

### A1. G1 — 解放チェーングラフ健全性
- [x] `src/lib/agent/stageGraph.ts`（新規・純関数）に `validateStageGraph(stages): StageGraphFinding[]` を実装
  - ルート（`unlockRequires: []`）からの **到達可能性**（未到達ノード = FAIL）
  - **循環検出**（DFS、`A→B→A` = FAIL）
  - **孤立ノード**（誰からも参照されず自身も何も要求しない戦闘ルート = WARN、SAFEルートは除外）
  - dangling 参照は既存 `stageBalance` がノード単位で見るので、ここはグラフ全体の健全性に限定
- [x] `src/app/admin/actions.ts` の `auditMasterData`（`:235` 付近）にグラフ検査を組み込み、`scope:'stages'` の findings として `/admin/audit` に出す
- [x] `src/lib/agent/stageGraph.test.ts`：到達不能・循環・正常チェーンの3系統

### A2. G2 — コード↔マスター stage ID 相互参照
- [x] コード内ハードコード stage ID を **各モジュールから named export** に整理
  - `src/logic/AbyssalResidueUnlockSystem.ts`：`ABYSSAL_RESIDUE_UNLOCK_STAGE_ID`（既に export 済み）
  - `src/data/tutorial/triggers.ts`：`TUTORIAL_BATTLE_STAGE_IDS` ＋ `getTutorialPhaseAfterClear` 内の生文字列（`area1_node1/node2/boss`）を `TUTORIAL_CHAIN_STAGE_IDS` 定数に抽出
- [x] `src/data/stageRefs.ts`（新規）で上記を集約：`CODE_REFERENCED_STAGE_IDS: { id; referencedBy }[]`
- [x] `auditMasterData` に「`CODE_REFERENCED_STAGE_IDS` の各 id が stages.json に存在するか」を追加（欠落 = **FAIL**、`referencedBy` をメッセージに出す）
- [x] `src/data/stageRefs.test.ts`：存在/欠落の検出

### A 完了条件
- [x] `npx tsc --noEmit` クリーン
- [x] 新規 `*.test.ts` グリーン ＋ 既存テスト非破壊
- [x] `/admin/audit` に G1/G2 の結果が表示され、現状データで **FAIL=0**（＝今の参照が全部生きている確認）

実装証跡（2026-06-27）:
- 詳細設計: `docs/設計書/121_CH1再設計マイルストーンA検証ゲート設計.md`
- 追加実装: `src/lib/agent/stageGraph.ts`, `src/data/stageRefs.ts`, `src/app/admin/actions.ts`
- 追加テスト: `src/lib/agent/stageGraph.test.ts`, `src/data/stageRefs.test.ts`
- 検証: `npx tsc --noEmit` PASS / 関連 Jest 26 tests PASS / 外部DB統合を除く既存 Jest 82 suites・763 tests PASS / `auditMasterData()` FAIL=0 / `git diff --exit-code src/data/master` PASS
- 監査補足: Phase A 着手時点で、G1/G2とは別に既存 `auditMasterData()` が敵10体の `necromance.allyStats.mp` 欠落を FAIL にしていた。`allyStats` は `BaseStats` 由来の8項目で `mp` を持たないため、既存監査バグとして `BASE_STAT_KEYS` / `JOB_STAT_KEYS` を分離して併修正した。G1/G2 自体の `gateFailCount` は 0。

---

## マイルストーン C — 設計判断の確定＋基盤実装

各項目に推奨案を置く。**★が要ユーザー承認**。承認後に同マイルストーン内で実装する。

### C1. 物語ノードの扱い（G3 解決）★
- **推奨: STORYノード型は追加せず、story registry でノード遷移時に発火**。
  - 理由: `STORY` を nodeType に足すと validator・`DungeonSystem`・MapCanvas の全てに非戦闘分岐が必要で重い。物語は既に独立システムがある。
  - 実装: 1-3 / 1-8 は stages.json に入れず、隣接ノードのクリア/入場をキーに既存ストーリーレジストリで再生。マップ上は非インタラクティブな物語マーカー表示（任意）。
  - 結果: **G3 ゲートは不要化**（`VALID_NODE_TYPES` 据え置き）。
- 対案: gacha 風に「タップする物語ノード」を出したい場合のみ `STORY` 型を追加（コスト増）。
- [x] **決定（2026-06-27）**: 推奨案で確定。既存の `STAGE_ENTER` / `STAGE_CLEAR` トリガー（`src/data/story/index.ts`）で隣接戦闘ノードに紐付ける。**STORY型は追加しない → G3ゲートは不要のまま**。1-3/1-8 は stages.json に入れない。

### C2. 残滓ノードと既存ID（G2 のデータ側解決）★
- **推奨: `area1_node3`（血泥の渡し）を現在地＝ボス直後の残滓ノードのまま据え置く**。
  - 既に `area1_node3.unlockRequires = [area1_boss]` で章末に位置 → `AbyssalResidueUnlockSystem`（`area1_node3` 参照）を **一切触らずに済む**。
  - 仕様書の「node3 を 1-11 に再配置」案は **撤回**。1-11 エリートには新ID `area1_c3` を割り当て、blood_mire_queen をそこに配置。
- [x] **決定（2026-06-27）**: 承認。`area1_node3` 据え置き、1-11 は新ID `area1_c3`、`AbyssalResidueUnlockSystem` 不変。

### C3. ノード数の確定★
- **推奨: 戦闘ノード10 ＋ 物語ビート2 ＋ 野営1 ＋ 残滓ノード1**。
  - 戦闘: 1-1, 1-2, 1-4, 1-5, 1-6, 1-7, 1-9, 1-10, 1-11, 1-12(ボス) ＝ 10
  - 重ければ 1-6 と 1-9 を1つずつ削って8戦闘に縮小可能
- [x] **決定（2026-06-27）**: 戦闘ノード**10で確定**。報酬・EXPカーブは **B で実装**。マップ描画（`MapCanvas`/`AreaMap` の10ノード＋3ゾーン対応）は **C で方針決定 → B で実装**。

### C4. 難易度スケール方式★ — 決定（2026-06-28）
- **問題**: 敵ステータス固定・スケール機構なし（`DungeonSystem.ts:40` 素引き）。敵カーブ/level基盤も無い（`BalanceConfig.ts` は player L1 のみ、敵に `level` 無し）。プレイヤーは章を通して ATK ~3倍（Lv＋武器ilv）に伸びるため、固定敵は後半で陳腐化する。
- **WAVE制の前提（実装確認済み）**: WAVE進行は `state.wave++` のみで **HP/エネルギーを回復しない**（`BattleEngine.ts:1237`）。1本のバーで3WAVEを戦う**消耗戦** → 難易度はステージの"弧"＋リソース消耗に宿る（DQの単発エンカウント＋戦闘間回復とは別物）。
- **決定した方針**:
  1. **章内（ストーリー）の難易度カーブの主軸は新規敵**。WAVE＝消耗戦なので敵は**機能（役割）で足す** — SHIELD / 持続ハラサー / **ヒーラー・支援（標的優先を強制し戦闘を伸ばす＝消耗増）** / エリート（WAVE3スパイク）/ AoE。数値違いの色替えより機能差を優先。
  2. **M2 スケールを補助として導入**。形は per-wave `statScale?: { hp?: number; atk?: number; def?: number }`（各キー省略=1.0、オブジェクト省略=無スケール）。対象は **hp/atk/def のみ**（spd=AV順・%系・耐性は不変）。適用は**戦闘インスタンス生成時に clone してから**（MasterDataService singleton 汚染防止）。**M2はM1を内包**（3キー同値＝一律倍率）。
  3. **M2 の用途は2つに限定**: ① **エリア/難易度ティア跨ぎの旧敵再利用**（ch2＋・後述アビス）、② **章内は intra-stage の最終WAVEスパイク**のみ。**章内のメインカーブをM2で作らない**。
- **将来用途メモ（スコープ外）**: やり込み高難易度「**アビス**」（3WAVEステージを反復クリアするコンテンツ）で固定ロスターを難易度ティア毎にM2スケールするのが本命のROI。→ M2は**汎用プリミティブ**として実装し、アビス側がそのまま消費できる形にする。**アビスのステージ/UIは作らない（先送り）**。実装は上限FAILを設けず、過大倍率は WARN 程度に留める（アビスの高倍率を阻害しない）。
- **variant / 新敵 / scale の使い分け（ロスター運用指針）**: variant敵＝挙動/正体が違う（耐性・スキル・種族・捕獲可能な別モンスター）。scale＝同じ敵の別サイズ。「ステしか違わない variant」を量産しない / 「本当は耐性を変えたい所を一律scaleでごまかさない」。

### C4 実装詳細（M2 `statScale` 基盤実装）

着手可（C4決定済み）。**全 materialization 点に同一ヘルパを通す**のが必須要件。

**① 型** — `src/types/game.ts` の `StageWaveData` に `statScale?: { hp?: number; atk?: number; def?: number }`（各キー省略=1.0、オブジェクト省略=無スケール・後方互換）。

**② 共有ヘルパ（drift防止の核）** — 新規 `src/logic/EnemyScaling.ts` に pure fn `applyEnemyStatScale(enemy: EnemyData, statScale?): EnemyData`。**clone してから** hp/atk/def に倍率→`Math.floor`。spd / %系（critRate等）/ 耐性は不変。`ENEMIES[id]`（MasterDataService singleton）を絶対に mutate しない。

**③ 適用サイト（全実体化点で②を通す）**

| 経路 | 箇所 |
|---|---|
| サーバ戦闘 | `GameManager`（`new BattleEngine(player, monsterList)` の monsterList 構築時） |
| クライアント戦闘 | `BattleCanvas.tsx:375`（`wave.enemyIds.map(id => ENEMIES[id])`） |
| シミュレータ | `src/lib/agent/sim/` の敵生成 |

- ⚠️ クライアント/サーバで**同一スケール必須**（不一致だと stage-attempt トークンの戦闘結果検証が崩れ、正当プレイが弾かれる）。

**④ validator / knownFields**
- `stageBalance.ts`: `statScale` を `{hp?,atk?,def?}` 数値(>0)で検証。過大倍率（目安 >3）は **WARN 止まり**（FAILにしない＝将来アビスの高倍率を阻害しない）。
- `knownFields.ts`: `stages` の wave 既知フィールドに `statScale` 登録（未知フィールドWARN回避）。

**⑤ 管理画面 UI（`src/components/admin/forms/StageForm.tsx`）**
- `WaveRow` 型（`:49`）に statScale 用フィールド（form 上は hp/atk/def の数値3項目）を追加。
- **デシリアライズ**（`:140-144` の raw→WaveRow パース）で既存 `wave.statScale` を読み込む。
- **シリアライズ**（`:74-78` の保存用 wavesData 構築）で statScale を出力。**全キー1.0/空なら `statScale` ごと省略**（JSONを汚さない・後方互換）。
- 新規 wave デフォルト（`:130`）は statScale 無し（=1.0）。
- **wave エディタ UI**（`:468-479` の role/敵編成の隣）に hp/atk/def スケールの数値入力3つを追加。`updateWave(idx, …)` で更新、プレースホルダ 1.0。
- 保存は既存フローで `validateStageDraft`（④）を通るため、**④と⑤はセットで実装**。

**⑥ テスト**
- `EnemyScaling.test.ts`: master非破壊（clone不変性）／省略時1.0／`Math.floor`／spd・%系・耐性不変。
- `stageBalance`: statScale バリデーション（不正値FAIL／過大倍率WARN）。
- 既存 battle / simulator / StageForm テスト非破壊。

**関所**: `npx tsc --noEmit` / 上記テスト green / `/admin/audit` FAIL=0 → **C 完了**。

### C6. Chapter2 解放への波及（検証済み）
- [x] **決定（2026-06-27）**: チェーンは線形・`area1_node3` 終端を維持（`area2_gate.unlockRequires=[area1_node3]` は不変で安全）。**ch2 は別エリアにする方針**のため波及問題なし。

### C 完了条件
- C1 / C2 / C3 / C4 / C6 **すべて確定済み（2026-06-28）**。
- C4 の基盤実装（M2 `statScale`）コード＋テストグリーン、`/admin/audit` FAIL=0 をもって **C 完了**とする。

---

## マイルストーン B — ステージ背骨（JSON）

**ゴール**: 章を最後まで通しプレイ可能にする。新規敵・物語・チュート再配線は後続なので、ここでは **既存敵の再構成（＋C4のスケール）** で全戦闘ノードを成立させる。

### B1. 新規戦闘ノード作成（`/admin/stages/new` 経由＝保存時に `validateStageDraft`）
- [ ] `area1_a2`(1-2) / `area1_a_mini`(1-4) / `area1_b2`(1-6) / `area1_b3`(1-7) / `area1_c1`(1-9) / `area1_c2`(1-10) / `area1_c3`(1-11)
- [ ] 各ノード: `chapter:1 / area:1`、`nodeType:DUNGEON`、3WAVE、最終WAVE は `role:ELITE`（1-4/1-10/1-11）
- [ ] WAVE は既存敵で構成、難所は `enemyStatScale` で調整（C4採用時）
- [ ] `position.x/y` を 3ゾーンに沿って配置

### B2. 既存ノードの unlockRequires 再結線（リニアチェーン）
| ノード | ID | unlockRequires |
|---|---|---|
| 1-1 | `area1_node1` | `[]`（不変） |
| 1-2 | `area1_a2` | `[area1_node1]` |
| 1-4 | `area1_a_mini` | `[area1_a2]` |
| 1-5 | `area1_node2` | `[area1_a_mini]` ← **変更**（旧 `[area1_node1]`） |
| 1-6 | `area1_b2` | `[area1_node2]` |
| 1-7 | `area1_b3` | `[area1_b2]` |
| 1-9 | `area1_c1` | `[area1_b3]` |
| 1-10 | `area1_c2` | `[area1_c1]` |
| 1-11 | `area1_c3` | `[area1_c2]` |
| 1-12 | `area1_boss` | `[area1_c3]` ← **変更**（旧 `[area1_node2]`） |
| 残滓 | `area1_node3` | `[area1_boss]`（不変） |

> 既存IDの再配置は **2件のみ**（node2 / boss の unlockRequires 変更）。node1 / node3 は不変。残滓解放コード（`area1_node3`）に触れない。
> B向け申し送り: 現行 `stages.json` には `area2_gate` が存在し、`area1_node3` から到達可能。B の再結線後も Chapter 2 ゲートの解放条件が崩れていないことを A1 グラフ検査と通しプレイで確認する。

### B 完了条件
- 全新規ノードで `validateStageDraft` PASS
- **A1 グラフ検査で到達可能・循環なし**、**A2 で `area1_node1/node2/boss/node3` が全て存在**
- `/admin/audit` **FAIL=0**
- 実機で 1-1 → 残滓ノードまで通しクリア可能
- `npx tsc --noEmit` ＋ 既存テスト非破壊（テストが master を mutate しないこと＝CI `git diff --exit-code src/data/master`）

---

## 後続フェーズ（B完了後 / 仕様書 §6 準拠）

- **Phase 2 新規敵**: `gravewarden_colossus`(ミニボス) / `wandering_guard_wraith` / `cursed_head_maid` / `dragonbone_spawn` を `/admin/enemies/new` or `enemyAgent` 草稿 → `enemyBalance` → 該当WAVEへ差し込み → simulator で docs/46 曲線確認
- **Phase 3 チュート再配線**: `triggers.ts`/`phases.ts` を新ノードID対応・`DEMONIZATION` を 1-4 前倒し・`JOB_CHANGE`/`WEAPON_ENHANCE` を BubbleHint 化・`WEAPON_EQUIP` 統合。`useTutorialTrigger.test.ts` 更新＋ A2 ゲート再確認
- **Phase 4 物語**: C1 の方針で 1-3 / 1-8 ＋章導入・締めを実装、`storyValidator`
- **Phase 5 最終監査**: `/admin/audit` FAIL=0、simulator 全ノード、`tsc`/`jest`/Playwright

---

## 全体の関所（毎マイルストーン共通）
1. `npx tsc --noEmit`
2. 関連 `jest` グリーン＋既存非破壊
3. （データ変更時）`/admin/audit` FAIL=0
4. テストが `src/data/master` を mutate しない（CI 非破壊チェック）

## リスク / ロールバック
- 各マイルストーンは独立コミット。B は既存4ノードの `unlockRequires` 2件のみ変更のため revert 容易。
- 最大リスクは「再配置でチュート/残滓が無言で壊れる」→ **A2 がこれを FAIL で顕在化**（本計画で A を最優先にした理由）。
