# 黄泉の階層 実装計画書

> ステータス: **v1.0（調査反映済み・レビュー可）**
> 作成: 2026-07-04 / PM統合ドキュメント
> 設計の正: [`docs/設計書/122_無限ダンジョン設計.md`](../設計書/122_無限ダンジョン設計.md)（v2.1）
> リリース: **Ch2 リリースに同梱**（Ch2 本編作業と並走可能・新戦闘プリミティブ非依存）

**決定サマリ（doc122 §9.1）**: 独立階層型チャレンジタワー / B1〜B20（Ch1エネミープール+statScale焼き込み）/ 1階=3WAVE本編互換 / 専用タブ（LAB解放ゲート方式）/ 報酬は初クリアのみ / ランキングは最深到達階層（`bestDungeonFloor`）/ DungeonRunなし・SEC-8既存流用

---

## 0. マイルストーン全体像

```
M0 前提是正（BAL-1/BAL-2） ──┐
                              ├─→ M2 マスターデータ生成（20階） ─→ M5 テスト・監査
M1 DB・ランキング基盤 ────────┤        ↑ M4 ジェネレータ・admin
                              └─→ M3 プレイヤーUI（タブ/MAP除外） ──┘
```

- M0 と M1 は独立・並行可。M2 は M0（バランス前提確定）と M4-1（ジェネレータ）に依存
- M3 は M1 のスキーマ確定後に着手可（M2 と並行）
- 各マイルストーン末尾に検証ゲート: `npx tsc --noEmit` + 関連 jest + 該当バリデータ

## 1. データ規約（M2-1 確定事項）

| 項目 | 規約 | 根拠 |
|---|---|---|
| ステージ ID | **`yomi_b01`〜`yomi_b20`**（ゼロ埋め2桁・B21以降は `yomi_b21`… と連番）。階層導出パーサは `/^yomi_b(\d+)$/` で共通化（`src/logic/YomiFloors.ts` 新設） | `normalizeManagedId`（`/^[a-z][a-z0-9_]*$/`）合格・既存 ID/ALIAS と衝突なし |
| chapter / area | `chapter: 1` / `area: 99` → `areas.json` に **`ch1_area99`「黄泉の階層」を必ず登録**（未登録は admin 監査・`data:audit`・CI が FAIL: `admin/actions.ts:339-353`, `master-data-audit.mjs:314-315`） | 落とし穴 #1 |
| nodeType | **全階 `'DUNGEON'`（ボス階も）**。ボス性は敵 tier=BOSS と WAVE role で表現 | `nodeType:'BOSS'`/`isAreaBoss` にすると BOSS_KILLS ランキング水増し + 階クリアごとに世界初回 BOSS_CLEARED ログが飛ぶ（`actions.ts:876,892-898`）。DUNGEON なら監査 WARN も出ない |
| sortOrder | 9000 + 階層番号（既存 Ch1 の 0〜230 台と分離） | マップ進行計算との混入防止と併用 |
| unlockRequires | `yomi_b01` ← **Ch1最終メインノード（現行 `area1_node3`）**、`yomi_bNN` ← `yomi_b(NN-1)` の一本鎖。**B1 の unlockRequires を空にしない**（空=初期解放 + stageGraph isolated-root WARN）。参照は定数 `CH1_FINAL_NODE_ID` に集約し、Ch1背骨変更時に1行で追随 | U-1決定（2026-07-04）+ 落とし穴 #4 |
| rewards | `baseExp: 0` / `baseGold: 0` / `dropTable: []`。**報酬はすべて `firstClearGuaranteed` に集約**（初回のみガードは `RewardService.ts:317` で実装済み）。**U-6 決定（2026-07-05）: 通貨報酬なし・素材/武器素材/残滓のみで確定**（GOLD 型の新設はしない） | リプレイ経済インフレ防止 + doc125 前提訂正#8 |
| 節目チェストの残滓 | `firstClearGuaranteed` に置く（**無フィルタ**）。`dropTable` は chapter>=2 残滓ゲート（`AbyssalResidueUnlockSystem.ts:17`）で剥がれるため使わない | 落とし穴 #10 |
| statScale | doc122 §6.1 の式で各階3WAVEに焼き込み。B1 は 1.0（保存時は省略される仕様: `StageForm statScaleValueForJson`） | — |

## 2. マイルストーン別タスク

### M0: 前提是正（TECH_DEBT 起票済み・本件データ制作の前提）

> **数値案確定済み（2026-07-04）**: [`123_残滓スケール再設計とCh1敵EHP是正.md`](../設計書/123_残滓スケール再設計とCh1敵EHP是正.md) — BAL-1 は FLAT系3種・コード5箇所のみ、BAL-2 は ossuary_wyrm_lord 単体（hp180/def24/shield50）。実装時はこの数値を適用する。

| # | タスク | 内容 | 担当 | 規模 |
|---|---|---|---|---|
| M0-1 | BAL-1 残滓スケール再設計 | `RewardService.ts:41,69` の `MAIN_STAT_POOLS`/`SUB_OPTION_POOL` を doc46 の JRPG スケールへ再設計（プレイヤーピーク ATK 目標から逆算）→ 実装 → 既存テスト更新 | balance-designer（数値案）→ battle-engine-dev（実装） | 中 |
| M0-2 | BAL-2 敵HP逆転是正 | `ossuary_wyrm_lord`(90) / `gravewarden_colossus`(95) / `blood_mire_queen`(150) の EHP 序列を doc71 基準に是正。Ch1 Phase 2 新規敵作業と合流 | balance-designer → data-author → master-data-validator | 小 |

**受入条件**: 関連 jest green / doc71「ボス EHP ≥ 直前精鋭1.2倍」成立 / simulator で Ch1 導線の TTK 劣化なし

### M1: DB・ランキング基盤（M0 と並行可）

> **実装仕様確定済み（2026-07-04）**: [`124_黄泉DB基盤実装仕様.md`](../設計書/124_黄泉DB基盤実装仕様.md) — 全差分・YomiFloors.ts 完全ソース・適用順・ロールバック・テスト計画。実装時はこの仕様に従う（行番号は検証済み）。

| # | タスク | 内容（ファイル:行） | 担当 | 規模 |
|---|---|---|---|---|
| M1-1 | `bestDungeonFloor` 列 | `prisma/schema.prisma:176 PlayerStats` に `bestDungeonFloor Int @default(0)` → `prisma generate` → Neon dev ブランチ `migrate dev` | db-expert | 小 |
| M1-2 | `DUNGEON_FLOOR` 型・API | `src/types/online.ts:1` 追加 / `src/app/api/ranking/route.ts:5 RANKING_TYPES` 追加（未列挙は RESIDUE_SCORE フォールバックのため追加漏れに注意） | db-expert | 小 |
| M1-3 | RankingService 拡張 | `getRanking`（`:115`）に `bestDungeonFloor desc` 分岐 / `recordStageClear`（`:188`）に `YomiFloors` パーサ経由の `max(現値, 階層)` 更新 / **`invalidate`（`:251-259`）に `ranking:DUNGEON_FLOOR:global:{limit}` 追加**（ハードコードのため足し忘れるとキャッシュが永遠に無効化されない） | db-expert | 小 |
| M1-4 | `YomiFloors.ts` 新設 | `isYomiStage(id)` / `getYomiFloorNumber(id)` / `isYomiArea(chapter, area)` の pure 関数 + co-located `.test.ts`。M1-3 と M3-0 の共通判定を一元化 | battle-engine-dev | 小 |
| ~~M1-5~~ | ~~playerState v4~~ | **削除（U-7 決定 2026-07-05）**: `dungeonMilestonesClaimed` の参照箇所が消滅したため v4 昇格ごと見送り。M1 の実装範囲は M1-1〜M1-4 のみ（doc124 §5 はアーカイブ） | — | 0 |

**受入条件**: マイグレーション追加のみ / 既存 jest green / `DUNGEON_FLOOR` API が空データで正常応答 / v3 セーブが v4 へ無損失移行

### M2: マスターデータ生成（依存: M0, M4-1）

| # | タスク | 内容 | 担当 | 規模 |
|---|---|---|---|---|
| M2-1 | データ規約 | **§1 で確定済み**（残: U-1 の B1 接続ノードのみ） | — | 完 |
| M2-2 | `ch1_area99` エリア登録 | `areas.json` に「黄泉の階層」エリア追加（admin の areas 管理画面から可能） | data-author | 小 |
| M2-3 | 20階データ生成 | M4-1 のジェネレータで B1〜B20 を生成 → `stages.json` へ列挙。§6.2 テンプレ（通常/精鋭/ボス階）+ Ch1 エネミープール割当 + §6.1 係数焼き込み | battle-engine-dev（実行）+ balance-designer（割当レビュー） | 中 |
| M2-4 | 報酬データ | 各階 `firstClearGuaranteed`（ゴールド・強化素材）+ 節目 5/10/15/20 階チェスト（確定残滓+素材で仮置き。**U-3 のアイテムは itemId 参照で後差し替え**） | data-author + balance-designer | 中 |
| M2-5 | 検証 | `/admin/audit` FAIL=0（目視・実質のリリースゲート）/ stageGraph 到達性 / enemyBalance / **TTK 検証はジェネレータ dry-run の実効ステータス表 + simulator の customDef 手入力で実施**（既存ツールは statScale を読まないため直接試算不可 → doc125 §6。**U-2: Ch2 想定装備水準でも検証**） | master-data-validator + balance-designer | 中 |

**受入条件**: B1→B20 一本鎖 / バリデータ FAIL=0（statScale>3 の WARN は B12 以降想定内 → M4-4 の運用合意に従う）/ B10「壁」・B20「ギリギリ」が実測で成立（外れたら admin で係数調整 → 再実測）

### M3: プレイヤー UI（依存: M1。M2 と並行可）

> **実装仕様確定済み（2026-07-05）**: [`126_黄泉プレイヤーUI実装仕様.md`](../設計書/126_黄泉プレイヤーUI実装仕様.md)。主な確定・訂正:
> - **M3-0 の注入点は `WorldMapSystem.buildWorldAreas` 1箇所が本丸**（DungeonSystem は無改修が正。下表の4箇所列挙は「問題の層」の指摘であり修正箇所ではない）+ **第5の露出経路 `story/index.ts getAreaUnlockIdsForClearedStage` を新規発見**（黄泉データ投入で StoryRegistry.test.ts:72 が確実に FAIL する実バグ → M3-0 で修正）
> - **バトル復帰動線の差分が必要**（`finishBattle` の MAP ハードコード → `isYomiStage(activeStageId)` 分岐。M3-2 と同一PR）
> - 7タブは iPhone 13 Pro で無調整成立（54.6px/タブ）。タブ名 `YOMI`・アイコン `Layers`
> - **節目チェストは表示専用で確定推奨** → M1-5 `dungeonMilestonesClaimed` が実質不要に（**U-7 要裁定**）

| # | タスク | 内容（ファイル:行） | 担当 | 規模 |
|---|---|---|---|---|
| M3-0 | **MAP 混入防止フィルタ** | `WorldMapSystem.buildWorldAreas:92-97`（黄泉エリア除外）/ `AreaMap.tsx:1029,1101`（描画対象除外）/ `DungeonSystem.getNextAvailableStage:108`（CURRENT 選定除外）/ `getStageLineSegments:112`（`area1_boss→yomi_b01` の解放線を描かない）。判定は `YomiFloors.ts` を使用 | battle-engine-dev | 小〜中 |
| M3-1 | 解放ゲート | `src/logic/YomiUnlockSystem.ts` 新設（`AbyssalResidueUnlockSystem` と同型・**clearedStages ベース**）。⚠️ `CH1_CLEARED` ストーリーフラグは使用禁止（`useStoryStore` クライアント専用・端末間非同期のため） | battle-engine-dev | 小 |
| M3-2 | 専用タブ | `useGameStore:341` tab union に `'YOMI'` / `BottomNavBar.tsx:8-15 TABS` 追加 + `isLocked`（`:29` LAB 方式）/ `page.tsx renderMainContent` に case + ロック時フォールバック画面 | necro-ui-builder | 中 |
| M3-3 | 階層選択スクリーン | 降下型階層リスト（Gothic-Morphism・黄泉テーマ）。解放済み階/最深到達/節目チェスト受取状態を表示。挑戦は既存 `requestStageStart` 流用。iOS 分離ルール遵守 | necro-ui-builder | 中〜大 |
| M3-4 | リザルト表示 | 既存 ResultScreen 流用（改修最小。任意で到達階表示）。報酬 0 表示の見え方確認（baseGold=0 でもクラッシュ・NaN なしは確認済み） | necro-ui-builder | 小 |
| M3-5 | ランキング表示 | `WorldLogPanel.tsx:15-19 RANKING_LABEL` にラベル追加 + `:101` 付近に `<RankingMiniBoard type="DUNGEON_FLOOR" />` | necro-ui-builder | 小 |
| M3-6 | 世界ログ節目配信 | 10 階刻み到達のみ WorldLog 配信（サーバ側フィルタ・`WorldEventService` 拡張）。ボス階を DUNGEON 扱いにしたため世界初回ボスログは発生しない（=これが唯一の黄泉世界ログ） | battle-engine-dev | 小 |

**受入条件**: iPhone 13 Pro 想定で 100dvh 崩れなし / タブ 7 個時のレイアウト実機確認 / MAP に黄泉エリア・ノード・解放線が一切出ない / ストーリー・チュートリアルの誤発火なし（調査済み: 未登録 ID は安全）

### M4: ジェネレータ・管理画面

> **実装仕様確定済み（2026-07-05）**: [`125_黄泉ジェネレータとadmin運用実装仕様.md`](../設計書/125_黄泉ジェネレータとadmin運用実装仕様.md) — CLI契約・厳密スケーリング表・エネミー割当・再生成ポリシー（一度きり生成で確定）・ch1_area99登録手順。**M4-3 StagesList は改修不要と確定**（既存エリア別グルーピングで充足）、**M4-4 は運用メモのみで確定**（WARNはどの経路でもブロックしないことを確認済み）。

| # | タスク | 内容 | 担当 | 規模 |
|---|---|---|---|---|
| M4-1 | 階層ジェネレータ | `scripts/generate-yomi-floors.mjs` 新設（慣例: `scripts/*.mjs` + npm script `data:generate-yomi`）。§6.1 係数・§6.2 テンプレ・§1 規約から決定論的に 20 ステージ JSON を生成。**一度きりのオーサリング支援** — 生成後は `stages.json` が正、admin で個別調整 | battle-engine-dev | 中 |
| M4-2 | admin 動作確認 | **StageForm は改修不要**（per-wave statScale / firstClearGuaranteed / unlockRequires 編集済み対応を確認済み）。注意2点を運用手順化: ① statScale=1.0 は編集画面で空欄表示（仕様）② 「新規ステージ」の ID 自動生成は yomi_ 非対応（`generateStageMasterId` は area 系のみ）→ 黄泉の追加はジェネレータ or ID 手入力 | admin-agent-dev | 小 |
| M4-3 | StagesList 圧迫対策 | 黄泉 20 件のフィルタ/グルーピング表示（エリア別グルーピングが既にあれば確認のみ） | admin-agent-dev | 小 |
| M4-4 | 監査 WARN 運用合意 | statScale>3 WARN（B12 以降で必発・`stageBalance.ts:74`）の扱いを「黄泉は許容」と監査運用に明文化（許容リスト or 運用メモ） | PM + master-data-validator | 小 |
| M4-5 | 本番反映運用の明文化 | admin 保存は `stages.json` への atomic write（`admin/actions.ts:58-63`）だが、**本番は静的 import のため再ビルド/再デプロイ必須**。「黄泉の係数調整は次回デプロイで反映」を運用ドキュメント化 | PM | 小 |

### M5: テスト・監査・リリース判定

| # | タスク | 内容 | 担当 | 規模 |
|---|---|---|---|---|
| M5-1 | jest | `YomiFloors` / `YomiUnlockSystem` / RankingService 分岐 / playerState v4 移行の co-located テスト。**`.test.ts` のみ（`.test.tsx` は jest 対象外**: `testMatch:['**/*.test.ts']`） | 各実装担当 + test-runner | 中 |
| M5-2 | E2E | `tests/yomi-progression.spec.ts`: タブ解放 → B1 挑戦 → クリア → B2 解放 → 節目チェスト（CI 未組込のためローカル実行） | test-runner | 中 |
| M5-3 | データ品質ゲート | ⚠️ CI の `data:audit` は `--strict` なしのため **FAIL があっても常に緑**（doc125 前提訂正#6）。実質のゲートは (1) `node scripts/master-data-audit.mjs --type=stages --strict` の**手動実行** FAIL=0 と (2) `/admin/audit` の目視 FAIL=0。master 非破壊チェック（`ci.yml:41`）はコミット済みデータなら問題なし | test-runner | 小 |
| M5-4 | セキュリティ監査 | 変更 Server Actions（初クリア報酬・ランキング・節目ログ）の sec-audit（SEC-2/3/8 観点） | sec-auditor | 小 |
| M5-5 | レビュー・実機 | code-reviewer + iOS 実機通し（タブ → 階層選択 → 戦闘 → リザルト → MAP 非混入確認） | code-reviewer / ios-debugger | 中 |

**リリース判定**: `/admin/audit` FAIL=0 / tsc・jest green / E2E green / 実機で B1→B20 通し / Ch2 本編と同梱デプロイ

---

## 3. 実装上の落とし穴（調査確定・実装者必読）

1. **専用エリア未登録は CI FAIL**（`data:audit`）。登録すると今度はワールドマップに出現 → **登録 + MAP 除外フィルタの両方が必須**（M2-2 + M3-0）
2. **`yomi_b01` の unlockRequires を空にしない**（初期解放化 + isolated-root WARN）
3. **リプレイ経済**: base 報酬と dropTable は再挑戦でも毎回付与される。黄泉は `firstClearGuaranteed` 集約で対処（§1）
4. **ボス階は nodeType:'DUNGEON'**（BOSS_KILLS 水増し・世界初回ボスログスパム防止）
5. **`CH1_CLEARED` フラグ（useStoryStore）をゲートに使わない**（クライアント専用・非同期）
6. **残滓の chapter ゲート**: dropTable の残滓は chapter>=2 でしか落ちない。節目残滓は firstClearGuaranteed へ
7. **`RankingService.invalidate` はハードコード** — DUNGEON_FLOOR キー追加漏れ厳禁
8. **admin 調整は本番再デプロイまで反映されない**（静的 import）
9. **admin の新規 ID 自動生成は yomi_ 非対応** — ジェネレータ or 手入力
10. **statScale>3 WARN は hp: B14〜B20 / atk: B20 で必発**（B12以降ではない）。加えて **baseExp=0 WARN が全20階で発生**。ただし**これらの WARN はどの経路でもリリースゲートをブロックしない**ことを確認済み → 運用メモで許容（doc125 §4）。また **CI の data:audit は --strict なしで常に緑** — マスターデータ品質は手動の `--strict` 実行 + /admin/audit 目視 FAIL=0 でしか担保されない
11. **jest は `.test.ts` のみ**。story/tutorial トリガーは未登録 ID に安全（誤発火なし・追加レジストリ不要）

## 4. 未決事項（U）の解決計画

| ID | 内容 | 状態 |
|---|---|---|
| U-1 | ~~解放条件ノード~~ → **決定（2026-07-04）: Ch1クリア = Ch1最終メインノード（現行 `area1_node3`）クリアで解放**。clearedStages ベース・LAB（`isAbyssalResidueUnlocked`）と同一条件。`YomiUnlockSystem` は定数 `CH1_FINAL_NODE_ID` を参照 | 確定 |
| U-2 | Ch2 装備水準での難度検証 | M2-5 で実測 |
| U-3 | 残滓オプション設定アイテム仕様 | **本計画から分離**（BLK-1 解消後に別設計書）。M2-4 は仮置き・itemId 差し替え式 |
| U-4 | シーズン後付け担保 | 何も実装しない（doc122 §7.5 アーカイブ参照のみ）で確定 |
| U-5 | 専用カレンシーなし | 異議なければ確定扱い |
| U-6 | 初クリア報酬の通貨 | **決定（2026-07-05）: 通貨なし・素材/武器素材/残滓のみ** |
| U-7 | `dungeonMilestonesClaimed`（M1-5）の要否 | **決定（2026-07-05）: M1-5 削除・playerState v4 昇格見送り** |

## 5. リスクと対策

| リスク | 対策 |
|---|---|
| BAL-1 是正が難航し M2 遅延 | M1/M3/M4 は BAL-1 非依存で先行。M2 のみブロック |
| 難度アンカーが実測で外れる（U-2） | 係数は焼き込み + admin 個別調整可能。データ修正のみで吸収（ただし本番反映は再デプロイ・落とし穴8） |
| タブ 7 個でレイアウト圧迫 | M3-2 で早期実機確認。破綻時は D-14 再議論（MAP 内入口へ変更） |
| MAP 除外フィルタの漏れ（新画面追加時に黄泉が混入） | 判定を `YomiFloors.ts` に一元化し、直接 `chapter/area` 比較を書かない規約 |
| ランキング更新経路のパーサ不一致 | ID 形式 `/^yomi_b(\d+)$/` を §1 で単一定義。ジェネレータ・パーサ・テストで同一定数を参照 |

## 6. 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-04 | 骨格ドラフト（調査反映欄あり） |
| 2026-07-04 | **v1.0**: 実装ギャップ調査（admin パイプライン・MAP 影響・ゲート・トリガー・報酬経路・ランキング UI・テスト慣例・ID 命名）を反映して全欄確定。M3-0 MAP 除外フィルタ追加、M4 を実態に合わせ再構成、落とし穴11件を明文化 |
| 2026-07-05 | 仕様書 doc125（M4）/doc126（M3）確定を反映。**U-6 決定（通貨なし）・U-7 決定（M1-5 削除）**。全マイルストーンの実装仕様が確定し、残る未決はゼロ |
