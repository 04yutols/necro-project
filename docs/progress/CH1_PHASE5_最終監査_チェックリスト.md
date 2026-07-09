# Ch1 Phase 5 — 最終監査チェックリスト（リリースゲート）

策定: 2026-06-28 / ブランチ: `feature/2026062102`
親: [`RELEASE_CH1_設計.md`](./RELEASE_CH1_設計.md) §3 / [`CH1_REDESIGN_実装計画.md`](./CH1_REDESIGN_実装計画.md) 後続 Phase 5
位置づけ: **新規実装なし。A〜C＋Phase 2〜4 の成果を通しで検証し、Ch1 リリース可否を判定する。**

---

## 1. 自動ゲート（CI相当）
- [ ] `npx tsc --noEmit` → エラー0
- [ ] `npm test`（DB統合 `src/tests/` 除く）→ 全 suite green
- [ ] `git diff --exit-code src/data/master` → 差分なし（テストが master を mutate しない）
- [ ] `npm run build` → 成功（本番ビルド）

## 2. データ監査（`/admin/audit` FAIL=0）
`npm run dev` 起動 → `/admin/audit`（または `runMasterDataAudit()` 直叩き）で確認。
- [ ] **総合 FAIL=0**
- [ ] **G1 解放グラフ**: 野営→1-1→…→1-12→残滓 が到達可能・循環なし・孤立なし（SAFE除外）
- [ ] **G2 コード↔マスター**: `area1_node1` / `area1_a2`（武器チュート）/ `area1_a_mini`（魔神化チュート）/ `area1_node3`（残滓解放）が全て stages.json 実在
- [ ] **stage 参照整合**: 全 wave の enemyIds・unlockRequires・dropTable・area 参照 OK
- [ ] **enemy 帯**: 新4体（巨像 BOSS / 近衛霊 MINION / 女官長 ELITE / 竜骨眷属 MINION DRAGON）が tier帯・necromance規約 OK
- [ ] **story**: storyValidator で新2シーン（CH1_DEADCITY_ENTRY / CH1_FALLEN_TRUTH）の trigger/speaker/expression 参照 OK
- [ ] WARN を一読し、想定内（既存レンジ・statScale等）であることを確認

## 3. バランス（simulator / balance-designer）
- [ ] `/admin/simulator` ＋ `balance-designer` で docs/46 曲線に対し各戦闘ノードの難易度を確認
- [ ] 重点: **1-4 ミニボス（巨像＋召喚）** の手応え、**statScale 適用ノード**（a2/a_mini/b2/b3/c1/c2/c3）の後半カーブ、**c3（blood_mire_queen 0.85 下方scale）** が pre-boss として過剰でない

## 4. 実機 通しプレイ（自動で拾えない体験）
`npm run dev` で iPhone 13 Pro 相当幅 + 実機 iOS Safari 確認。
- [ ] **進行**: 野営→1-1→1-2→1-4→1-5→1-6→1-7→1-9→1-10→1-11→1-12→残滓ノード を通しクリア（unlock チェーンが順に開く）
- [ ] **マップ描画**（B でデータのみ・**見た目未検証**）: `MapCanvas`/`AreaMap` が **12ノード＋3ゾーン**を破綻なく表示（position 重なり・画面はみ出し・接続線・スクロールを確認、必要なら position 微調整）
- [ ] **表示順**: エリア一覧・next stage が play 順（sortOrder 反映）
- [ ] **チュート（Phase 3）**: 1-1基礎→1-1編成→1-2武器→**1-4魔神化バナー→1-5で魔神化スポット**→ JOB/強化タブ初訪問で吹き出し→残滓で残滓。**強制スポット中に吹き出しが重ならない（M1）**
- [ ] **物語（Phase 4）**: 1-2クリアで死都入城、1-7クリアで亡国の真実、章導入/ボス/エンディングが新フロー順で破綻なし
- [ ] **新敵（Phase 2）**: 各ノードで出現、**巨像のシールド破壊で grave_soldier 召喚**、竜骨眷属が**捕獲可能な DRAGON 味方**になる
- [ ] **iOS Safari**: BubbleHint（初usage）の位置決め・overflow+transform 分離ルール遵守、レイアウト崩れなし

## 5. 既知事項の確定（リリース前の棚卸し）
- [ ] **TECH_DEBT L-3**（BattleEngine の statScale が per-wave 非対応・召喚のみ）が記録済みで、Ch1 live は BattleCanvas 駆動のため実害なしを再確認
- [ ] **コミット衛生**: Phase 3 M1 修正（BubbleHint）が適切にコミットされている（phase3 から切り出すか確認）
- [ ] **孤児 story ファイル**（`act1_ch1_royal_capital.json`/`act1_prologue.json`/`prologue_scenes.json`）は未ロード。今回触らず、将来削除候補として認識
- [ ] **難易度★表示**: `area1_boss` の difficulty=3 が c1〜c3=4 より低い（順序は sortOrder 駆動で機能影響なし）。気になれば boss を引き上げ

## 6. リリース判定
- [ ] §1〜§4 すべて green ／ §5 棚卸し完了
- [ ] Playwright E2E（`npx playwright test`、dev server localhost:3080）green
- → 満たせば **第1章リリース版の Ch1 拡張＝完成**。バフ/デバフ等は [`RELEASE_CH2_PLUS_設計.md`](./RELEASE_CH2_PLUS_設計.md)。

---

## 付記: スコープ外（Ch2送り・本チェックでは検証しない）
バフ/デバフ基盤・支援役・敵ヒーラー・アビス・area2 本格コンテンツ。Phase 5 は **Ch1（データのみ）の完成検証**に限定する。
