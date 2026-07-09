# Ch1 Phase 3 — チュートリアル再配線 設計＆実装計画

策定: 2026-06-28 / ブランチ: `feature/2026062102`
親: [`RELEASE_CH1_設計.md`](./RELEASE_CH1_設計.md) §1-C / [`CH1_REDESIGN_実装計画.md`](./CH1_REDESIGN_実装計画.md) 後続 Phase 3
位置づけ: B の新フロー（野営→1-1…→1-12→残滓）に合わせ、**チュートの発火位置を再キー＋一部を BubbleHint へ格下げ**。

---

## 0. スコープ（Ch1 鉄則）
チュートモジュール（`src/data/tutorial/` ＋ `src/hooks/useTutorialTrigger.ts`）と該当画面2つへの**ロジック/データ/配線のみ**。新戦闘プリミティブ無し。
**現状の問題（B申し送り②）**: チュートは旧ID（node1/node2/boss クリア）キーのまま → 再配置後 WEAPON_EQUIP/JOB_CHANGE が中盤、強化/魔神化が最終ノードでズレ発火。これを正す。

**確定事項（2026-06-28）**: ① 「WEAPON_EQUIP統合」＝装備は強制フェーズ据え置き・強化(enhance)のみ BubbleHint 格下げ（物理マージしない）。② JOB_CHANGE / WEAPON_ENHANCE は `TutorialPhase` 型ごと全削除（残骸 enum を残さない・pre-release で移行不要）。→ 未決定の分岐なし、着手可。

---

## 1. 目標のチュートマップ（仕様書 §3 準拠）

| 発火 | フェーズ/ヒント | 形態 | 現状からの変更 |
|---|---|---|---|
| 1-1 戦闘開始（area1_node1） | `BATTLE_BASICS` | 強制スポット | 変更なし |
| 1-1 クリア | `PARTY_FORMATION` | 強制スポット | 変更なし |
| **1-2 クリア（area1_a2）** | `WEAPON_EQUIP`（武器） | 強制スポット | **再キー**（旧 area1_node2） |
| **1-4 ミニボスクリア（area1_a_mini）** | `DEMONIZATION`（魔神化）★前倒し | バナー＋次戦闘でスポット | **再キー＋前倒し**（旧 area1_boss） |
| JOBタブ初訪問 | 転職ヒント | **BubbleHint** | **強制→格下げ**（JOB_CHANGE 廃止） |
| EQUIP強化タブ初訪問 | 強化ヒント | **BubbleHint** | **強制→格下げ**（WEAPON_ENHANCE 廃止） |
| 残滓ノードクリア（area1_node3） | `ABYSSAL_RESIDUE` | 強制スポット | 変更なし |

結果の**強制フェーズ**は 5 つ: `BATTLE_BASICS / PARTY_FORMATION / WEAPON_EQUIP / DEMONIZATION / ABYSSAL_RESIDUE`。

---

## 2. 変更点（詳細）

### 2-1. 強制チェーンの再キー＋再順序（`src/data/tutorial/triggers.ts`）
- `TUTORIAL_CHAIN_STAGE_IDS` を更新:
  - `PARTY_FORMATION: 'area1_node1'`（不変）
  - `WEAPON_EQUIP: 'area1_a2'`（旧 area1_node2）
  - `DEMONIZATION: 'area1_a_mini'`（旧 area1_boss）
  - **`JOB_CHANGE` / `WEAPON_ENHANCE` のエントリ削除**
- `getTutorialPhaseAfterClear` のチェーンを再順序:
  `PARTY_FORMATION → WEAPON_EQUIP → DEMONIZATION → ABYSSAL_RESIDUE`
  - DEMONIZATION の前提を `hasCompleted('WEAPON_ENHANCE')` → **`hasCompleted('WEAPON_EQUIP')`** に変更
  - JOB_CHANGE / WEAPON_ENHANCE の分岐を削除
- `CLEAR_TUTORIAL_CHAIN_PHASES` から JOB_CHANGE / WEAPON_ENHANCE を除去（残り4）

### 2-2. JOB_CHANGE / WEAPON_ENHANCE を強制フェーズから廃止（`src/data/tutorial/phases.ts`）
- `TutorialPhase` 型・`PHASE_STEPS`・`ALL_PHASES`・`BANNER_LABELS` から両者を削除
  → `ALL_PHASES` が5要素になり、`useTutorialTrigger` の「全フェーズ完了→completeTutorial」判定が新セットで成立
- 旧 PHASE_STEPS の文言は BubbleHint 用テキストへ移植（下記）

### 2-3. BubbleHint 化（既存 `BubbleHint.tsx` の初usage）
`BubbleHint` は `isHintViewed(hint.id)` で初回のみ表示する自己完結コンポーネント（`viewedHints` 永続）。ホスト画面に設置するだけで「タブ初訪問ヒント」になる。
- **転職ヒント**: `src/components/job/JobChangeScreen.tsx` に `<BubbleHint hint={{ id:'hint_job_change', targetId:'tut-job-rail', position:'below', ... }}/>` を設置（文言＝旧 TUT_J_01〜03 を1吹き出しに凝縮）
- **強化ヒント**: `src/components/legion/LegionHub.tsx` の強化タブ周りに `<BubbleHint hint={{ id:'hint_weapon_enhance', targetId:'tut-weapon-enhance-tab', ... }}/>`（文言＝旧 TUT_H_01/02）
- targetId（`tut-job-rail` / `tut-weapon-enhance-tab` 等）は既存実在を確認済み。

### 2-4. G2 / stageRefs 自動追従（確認のみ）
`src/data/stageRefs.ts` は `TUTORIAL_CHAIN_STAGE_IDS` から `CODE_REFERENCED_STAGE_IDS` を導出 → 2-1 の再キーで参照先が `area1_a2` / `area1_a_mini` に変わる。両ノードは B で実在するので **G2 audit は緑のまま**（A2 を入れた狙い通り、再キーの妥当性が自動検証される）。`stageRefs.test.ts` の期待IDを更新。

---

## 3. 触るファイル
| ファイル | 変更 |
|---|---|
| `src/data/tutorial/triggers.ts` | チェーン再キー・再順序・CLEAR_TUTORIAL_CHAIN_PHASES |
| `src/data/tutorial/phases.ts` | JOB_CHANGE/WEAPON_ENHANCE 削除（型/steps/ALL_PHASES/labels） |
| `src/components/job/JobChangeScreen.tsx` | 転職 BubbleHint 設置 |
| `src/components/legion/LegionHub.tsx` | 強化 BubbleHint 設置 |
| `src/data/stageRefs.test.ts` | 期待ID更新（area1_a2 / area1_a_mini） |
| `src/hooks/useTutorialTrigger.test.ts` / `src/store/useTutorialStore.test.ts` | チェーン順序・ALL_PHASES 変更に追随 |

---

## 4. テスト / 関所
- `useTutorialTrigger.test.ts`: 新チェーン（1-1→1-2→1-4→残滓）で正しいフェーズが返る／JOB_CHANGE・WEAPON_ENHANCE は返らない
- `useTutorialStore.test.ts`: ALL_PHASES 5要素で completeTutorial 判定
- `stageRefs.test.ts`: コード参照IDが area1_a2/area1_a_mini を含み、全て stages.json に存在（FAIL=0）
- `npx tsc --noEmit` / 全 jest green / `/admin/audit` FAIL=0（G2 がコード参照の生存を担保）
- 実機: 1-1基礎→1-1編成→1-2武器→1-4魔神化バナー→1-5で魔神化スポット、JOB/強化タブ初訪問で吹き出し、残滓ノードで残滓

---

## 5. 留意点
- **魔神化のゲージ可用性**: DEMONIZATION スポットは 1-4 クリア後の次戦闘（1-5）で出る。スポット中に実際に魔神化できるよう、1-5 開始までにゲージが溜まる導線か確認（演出タイミングのみ・構造問題ではない）。
- **BubbleHint 初usage**: プロジェクト初の BubbleHint 設置。位置決め（targetId の DOM 存在・スクロール位置）を実機で確認。iOS Safari の overflow+transform 分離ルール遵守。
- **セーブ互換**: 旧 `completedPhases` に `JOB_CHANGE`/`WEAPON_ENHANCE` が残っていても、型から消えても実害なし（未参照の文字列として無視）。pre-release につき移行処理不要。
- **A2 の真価**: 本フェーズの再キーは「存在しない stage を参照したら audit FAIL」で守られる。再キー後に `/admin/audit` FAIL=0 を必ず確認。

---

## 6. 実装・検証証跡（2026-06-28）

### 実装内容
- `TutorialPhase` / `PHASE_STEPS` / `ALL_PHASES` / `BANNER_LABELS` から `JOB_CHANGE` / `WEAPON_ENHANCE` を削除し、強制フェーズを5つへ縮約。
- `TUTORIAL_CHAIN_STAGE_IDS` を `PARTY_FORMATION: area1_node1` / `WEAPON_EQUIP: area1_a2` / `DEMONIZATION: area1_a_mini` へ再キー。
- クリア後チェーンを `PARTY_FORMATION → WEAPON_EQUIP → DEMONIZATION → ABYSSAL_RESIDUE` に再順序化し、DEMONIZATION の前提を `WEAPON_EQUIP` 完了へ変更。
- `JobChangeScreen` に `hint_job_change`、`LegionHub` の武器GEARタブ列に `hint_weapon_enhance` の `BubbleHint` を設置。
- `stageRefs` / チュートリアル / ストア関連テストを新チェーンへ更新。

### 検証結果
| コマンド | 結果 |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test -- --runInBand src/data/tutorial/phases.test.ts src/data/tutorial/triggers.test.ts src/hooks/useTutorialTrigger.test.ts src/store/useTutorialStore.test.ts src/data/stageRefs.test.ts` | PASS: 5 suites / 30 tests |
| `npm test -- --runInBand` | PASS: 88 suites / 785 tests |
| `npm run data:audit` | PASS: 0 fail / 13 warn |
| `NODE_ENV=development npx tsx -e 'import { runMasterDataAudit } from "./src/app/admin/actions"; ...'` | PASS: `/admin/audit` 相当 0 FAIL（PASS 352 / WARN 17） |
| `git diff --check` | PASS |

補足: 本番コード（test除外）で `JOB_CHANGE` / `WEAPON_ENHANCE` の残存参照がないことを `rg -n "JOB_CHANGE\|WEAPON_ENHANCE" src --glob '!*.test.ts'` で確認済み。
