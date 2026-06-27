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
  - **孤立ノード**（誰からも参照されず自身も何も要求しない非ルート = WARN）
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
- 検証: `npx tsc --noEmit` PASS / 関連 Jest 25 tests PASS / 外部DB統合を除く既存 Jest 82 suites・762 tests PASS / `auditMasterData()` FAIL=0 / `git diff --exit-code src/data/master` PASS

---

## マイルストーン C — 設計判断の確定＋基盤実装

各項目に推奨案を置く。**★が要ユーザー承認**。承認後に同マイルストーン内で実装する。

### C1. 物語ノードの扱い（G3 解決）★
- **推奨: STORYノード型は追加せず、story registry でノード遷移時に発火**。
  - 理由: `STORY` を nodeType に足すと validator・`DungeonSystem`・MapCanvas の全てに非戦闘分岐が必要で重い。物語は既に独立システムがある。
  - 実装: 1-3 / 1-8 は stages.json に入れず、隣接ノードのクリア/入場をキーに既存ストーリーレジストリで再生。マップ上は非インタラクティブな物語マーカー表示（任意）。
  - 結果: **G3 ゲートは不要化**（`VALID_NODE_TYPES` 据え置き）。
- 対案: gacha 風に「タップする物語ノード」を出したい場合のみ `STORY` 型を追加（コスト増）。
- [ ] 方針確定 → （STORY型を採る場合のみ）`stageBalance` / `DungeonSystem` / Map に STORY 分岐＋ G3 ゲート

### C2. 残滓ノードと既存ID（G2 のデータ側解決）★
- **推奨: `area1_node3`（血泥の渡し）を現在地＝ボス直後の残滓ノードのまま据え置く**。
  - 既に `area1_node3.unlockRequires = [area1_boss]` で章末に位置 → `AbyssalResidueUnlockSystem`（`area1_node3` 参照）を **一切触らずに済む**。
  - 仕様書の「node3 を 1-11 に再配置」案は **撤回**。1-11 エリートには新ID `area1_c3` を割り当て、blood_mire_queen をそこに配置。
- [ ] 確定 → 仕様書 §1 ブループリントの 1-11 / 残滓行を本決定で上書き（下記 B の結線表が正）

### C3. ノード数の確定★
- **推奨: 戦闘ノード10 ＋ 物語ビート2 ＋ 野営1 ＋ 残滓ノード1**。
  - 戦闘: 1-1, 1-2, 1-4, 1-5, 1-6, 1-7, 1-9, 1-10, 1-11, 1-12(ボス) ＝ 10
  - 重ければ 1-6 と 1-9 を1つずつ削って8戦闘に縮小可能
- [ ] 10 で確定 or 縮小指示

### C4. 難易度スケール方式★（← A 着手時の調査で判明した新規論点）
- **問題**: 敵ステータスは固定。ステージ難易度で敵を強くする機構が無い（`DungeonSystem.ts:40` は素引き）。固定10体だけでは終盤の難易度カーブが頭打ち。
- **推奨: 軽量な per-wave スケールフィールド `enemyStatScale?: number`（既定1.0）を追加**。
  - [ ] `DungeonSystem` の敵生成で `hp/atk/def` 等に倍率適用（会心率等の%系は除外）
  - [ ] `stageBalance` の `VALID` 構造に許可＋`knownFields.ts` に登録（未知フィールドWARN回避）
  - [ ] `BattleDamage` 系への影響が無いことをテストで確認
  - 効果: 既存10体を再構成＋スケールで再戦闘ノードを量産でき、新規敵を抑えられる（仕様書の「再戦闘ノードを背骨に」が初めて成立）
- 対案: スケール無しで「新規敵を増やす／WAVE構成だけで難易度を作る」→ 新規敵が5体では足りず増える可能性

### C 完了条件
- C1〜C4 すべてユーザー承認
- （実装を伴う C1-STORY / C4 を採用した場合）該当コード＋テストグリーン、`/admin/audit` FAIL=0

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
