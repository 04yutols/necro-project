# 完了済み一覧

> 設計書の完成・実装の完了・設計上の意思決定をアーカイブする。
> ここに載っているものは再設計・再確認不要。

---

## 設計書（全25冊 完成）

| No | ファイル | 内容 |
|---|---|---|
| 01 | 01_ゲームデザイン.md | ゲーム概要・コアループ・職業一覧・収益化 |
| 02 | 02_アーキテクチャ.md | ファイル構成・責務分担・ルーティング |
| 03 | 03_バトルシステム.md | ダメージ式・スキル・VFX・WAVEフロー |
| 04 | 04_データモデル.md | Prismaスキーマ・TypeScript型・マスターデータJSON |
| 05 | 05_死霊術システム.md | Lv/Rank・コスト制編成・魂石化・種族シナジー概要 |
| 06 | 06_UIコンポーネント.md | コンポーネント一覧・画面遷移 |
| 07 | 07_デザインシステム.md | Gothic-Morphism・カラートークン・タイポ |
| 08 | 08_テスト戦略.md | Jest / Playwright 方針 |
| 09 | 09_ステータスシステム.md | 8種ステータス・計算式・表示ラベル |
| 10 | 10_職業転職システム.md | 12職業・解放条件・転職UI |
| 11 | 11_深淵の残滓システム.md | 4層RNG・スコア・錬成・スタミナレス確定 |
| 12 | 12_深淵の残滓UIUX実装設計.md | 残滓UI実装仕様 |
| 13 | 13_武器システム.md | レアリティ・パッシブ・限界突破・分解 |
| 14 | 14_武器UIUX実装設計.md | 武器UI実装仕様 |
| 15 | 15_ワールド・ダンジョン・エネミー設計.md | ワールド構造・ノード進行・敵設計 |
| 16 | 16_魔神化システム.md | 12職業フォーム・Tier設計・魔神技 |
| 17 | 17_状態異常システム.md | 6種定義・発動式・AV遅延 |
| 18 | 18_種族シナジーシステム.md | 6種族・3層構造・クロス共鳴 |
| 19 | 19_スキルバランス設計書.md | power倍率基準・奥義設計・状態異常予算式 |
| 20 | 20_チュートリアル設計.md | 6フェーズ解放・4種ヒント・スキップ仕様 |
| 21 | 21_VFXアニメーションカタログ.md | CSS/PixiJS/Framer Motionカタログ・SSR/UR演出 |
| 22 | 22_ストーリー進行システム.md | 第1章13シーン台詞・UIコンポーネント仕様 |
| 23 | 23_サウンド設計.md | BGM12シーン・SE40種・AudioService実装仕様 |
| 24 | 24_パーティ編成システム詳細.md | ヘイト分散・ドラッグ並び替え・CostIndicator |
| 25 | 25_オンラインゲーム設計.md | 認証・クラウドセーブ・ランキング・世界ログ・CI/CD |

---

## コード実装済み

| システム | ファイル | 内容 |
|---|---|---|
| 職業システム Tier1/2 | `src/logic/JobSystem.ts` | 12職業・解放条件・転職 |
| 永続パッシブ蓄積 | `src/services/JobService.ts` | onLevelUp でマイルストーン累積 |
| BattleEngine | `src/logic/BattleEngine.ts` | ターン制バトル・シナジー統合済み |
| 状態異常システム | `src/logic/StatusAilmentSystem.ts` | 6種・immuneTypes・durationBonus対応 |
| 魔神化システム | `src/logic/DemonizationSystem.ts` | demonGauge / isDemonMode |
| 種族シナジーシステム | `src/logic/TribeSynergySystem.ts` | 3層・クロス共鳴・BattleEngine統合済み |
| 武器計算 | `src/logic/WeaponSystem.ts` | FinalATK・共鳴・打ち直し |
| 残滓スコア | `src/logic/ResidueScore.ts` | 5部位・スコア計算 |
| ステータス集計 | `src/logic/StatSystem.ts` | 装備・パッシブ・残滓合算 |
| 死霊術 Lv/Rank | `src/services/NecroService.ts` | RankUp転生・魂石化 |
| 軍団編成（3枠） | `src/components/legion/LegionHub.tsx` | SynergyBanner実装済み |
| NecroLab | `src/components/necro/NecroLab.tsx` | 残滓EQUIP/ENHANCE |
| エリアマップ | `src/components/map/AreaMap.tsx` | 7リージョン実装済み |
| Zustand ストア | `src/store/useGameStore.ts` | 全クライアント状態管理 |
| マスターデータ | `src/data/master/` | jobs/monsters/items/stages/skills（第1章分） |

---

## テスト基盤（2026-07-13）

| 項目 | ファイル | 内容 |
|---|---|---|
| DBテスト隔離 | `src/tests/*.integration.test.ts` | `GameManager`/`AuthService`/`SessionSecurityService` の実DB依存テストを `src/logic`・`src/services` から `src/tests/` へ移動。「ユニット＝DB不要」レイヤ分離の乖離を解消 |
| 共有テストファクトリ | `src/testing/factories.ts` | `makeCharacter`/`makeMonster`/`makeBaseStats` で `CharacterData`/`MonsterData` フルシェル生成を共通化。実マスターデータ非依存で5ファイルのローカルヘルパーを移行 |
| 進行プリセット | `src/testing/presets.ts` | `fresh`/`ch1_mid`/`ch1_cleared`/`yomi_b5`/`endgame` の5種の `useGameStore` persist スナップショットを実マスターデータから構築 |
| E2E/実機シード注入 | `tests/helpers/e2e.ts`（`seedGameState`）, `src/hooks/useDevPreset.ts` | `prepareE2EPage(page, { preset })` とブラウザの `?devPreset=<name>`（dev限定）でプリセット注入。詳細は `docs/仕様書/13_テストとCI.md` §5.5 |

詳細仕様: `docs/仕様書/13_テストとCI.md`。積み残しは `docs/progress/TECH_DEBT.md`（TI-1〜TI-5）。

---

## Codex Content Package Phase 1（2026-07-31）

| 項目 | ファイル | 内容 |
|---|---|---|
| Content Package契約 | `content/package.schema.json`, `src/lib/content/contentPackage.ts` | 6 scope、必須成果物マトリクス、依存グラフ、日英localization、provenance、状態遷移 |
| Lore Registry | `content/lore/registry.json`, `src/lib/content/loreRegistry.ts` | 人物・場所・概念、関係、時系列、確定／未確定設定の参照検証 |
| 安全な反映と復旧 | `src/lib/content/contentTransaction.ts`, `scripts/content-bundle.mts` | JSON・asset・package状態のatomic apply、hash付きsnapshot、競合検知undo |

詳細仕様: `docs/設計書/127_Codexコンテンツ制作基盤設計.md` §9。

## Codex Content Package Phase 2（2026-07-31）

| 項目 | ファイル | 内容 |
|---|---|---|
| 数値Authoring API | `src/lib/content/gameplayAuthoring.ts` | role・levelからcombat-unit、skill、weapon、residue-nameを決定論生成し、既存gateを再利用 |
| 実戦闘シミュレーション | `src/lib/content/gameplaySimulation.ts`, `src/logic/BattleEngine.ts` | 草稿master注入、決定論RNG、TTK・被ダメージ・AoE・行動順・3枠cost、StageData全WAVE評価 |
| Package adapter / CLI | `src/lib/content/gameplayPackageAdapter.ts`, `scripts/content-bundle.mts` | `artifact.request`をchanges・rationale・simulation・evidenceへ変換。enemy / monster / skill / job scopeを安全に適用 |

詳細仕様: `docs/設計書/127_Codexコンテンツ制作基盤設計.md` §10。Phase 3はVisual Asset Forge。

## Codex Content Package Phase 3（2026-08-01）

| 項目 | ファイル | 内容 |
|---|---|---|
| AssetSpec / prompt queue | `src/lib/content/assetSpec.ts`, `scripts/content-assets.mts` | 12用途、寸法・比率・透過・safe area・画風・禁止要素、標準パス、参照依存順のCodex生成job |
| Visual Asset Forge | `src/lib/content/assetForge.ts` | 原本保持、WebP最適化、クロマキーalpha、寸法・形式・容量・hash・参照・orphan検査、contact sheet |
| 実画面preview | `src/app/admin/assets/`, `src/app/api/admin/content-assets/route.ts` | DRAFT画像とcontact sheetをdevelopment管理画面で実表示 |
| ゲーム表示fallback | `src/components/story/CharacterPortrait.tsx` | 表情画像 → default画像 → 抽象プレースホルダーの順で安全に表示 |
| 実画像作例 | `content/packages/phase3-visual-example.json` | 「灰冠の葬剣」をCodex画像生成から768×1152 WebP・manifest・contact sheetまで処理 |

詳細仕様: `docs/設計書/127_Codexコンテンツ制作基盤設計.md` §11。

## Codex Content Package Phase 4（2026-08-01）

| 項目 | ファイル | 内容 |
|---|---|---|
| Skill Presentation契約 | `src/lib/presentation/skillPresentation.ts`, `content/package.schema.json` | cast / travel / impact / aftermath、multi-hit、VFX、SFX cue、accessibility、performance予算 |
| registry / 戦闘同期 | `src/data/presentation/skillPresentations.json`, `src/components/battle/SkillPresentationOverlay.tsx`, `BattleCanvas.tsx` | 専用→属性共通→全attackType fallback、damage・SFX・flash・cameraを同じscheduleで駆動 |
| WebAudio SFX | `src/lib/presentation/sfxProfiles.ts`, `src/services/AudioService.ts` | profileKey、pitch、volume、layer、再生時刻を決定論profileへ接続 |
| preview / 証跡 | `src/app/admin/effects/`, `scripts/content-present.mts` | 速度・背景・replay・reduced-motion・低負荷preview、hash付きSVG storyboard |
| Package適用 | `scripts/content-bundle.mts` | READY presentationを承認後にcreate-only registry登録し、snapshot / undo対象へ含める |
| 完成作例 | `content/packages/phase4-presentation-example.json` | 「灰冠の三葬」の3-hit、VFX/SFX、icon、localization、preview証跡を0 failで検証 |

詳細仕様: `docs/設計書/127_Codexコンテンツ制作基盤設計.md` §12。次はPhase 5 Package Orchestrator。

## Codex Content Package Phase 5（2026-08-01）

| 項目 | ファイル | 内容 |
|---|---|---|
| Request / dependency graph | `src/lib/content/packageOrchestrator.ts`, `scripts/content-orchestrate.mts` | 一依頼をtargets、必須成果物、依存edge、7工程へ展開し、statsとskillを既存決定論authoringへ接続 |
| 工程再生成・失敗伝播 | `src/lib/content/contentPackage.ts`, `content/package.schema.json` | 工程単位のattempt・artifact・finding、対象工程と下流だけの無効化、FAIL→PARTIAL / dependent BLOCKED |
| 統合read-onlyレビュー | `src/app/admin/content-packages/`, `src/app/api/admin/content-assets/route.ts` | pipeline、不足、依存、master JSON before/after、画像、演出storyboardを一画面表示 |
| Post-apply QA | `scripts/content-qa.mts`, `tests/content-package-review.spec.ts`, `scripts/content-bundle.mts` | apply後にmaster audit、tsc、Jest、Playwright、視覚回帰とfull-page証跡を自動実行 |
| release scope | planner / schema / validator / apply | 第1章だけをIN_SCOPEとし、第2章以降はpackage単位でFAIL |
| 完了作例 | `content/requests/phase5-boss-signature-weapon.request.json`, `content/packages/phase5_ash_regent_package.json` | 「亡国の王都に新しいボスと固有武器を追加」から4 target・23成果物・16依存・8画像仕様・2演出・入手導線を草案化 |

詳細仕様: `docs/設計書/127_Codexコンテンツ制作基盤設計.md` §13。次はPhase 6 Admin Review Studio。

## Codex Content Package Phase 6（2026-08-01）

| 項目 | ファイル | 内容 |
|---|---|---|
| 項目別レビュー契約 | `src/lib/content/contentReviewWorkflow.ts`, `src/lib/content/contentPackage.ts`, `content/package.schema.json` | target / change / asset / presentation / evidenceを独立承認し、対象hash変更時だけ承認失効。人間コメントと監査eventを保持 |
| Review Studio | `src/app/admin/content-packages/page.tsx`, `src/components/admin/ContentReviewControls.tsx` | semantic diff、BattleEngine指標、story試読、contact sheet、VFX/SFX、evidence、依存、監査を一画面へ統合 |
| 安全なUI操作 | `src/app/admin/content-packages/actions.ts`, `src/lib/content/contentWorkspace.ts` | dev guard、原子的package保存、理由付き工程再生成、二段階package承認、確認文字列付きapply / undo |
| 競合検出 | `src/lib/content/contentTransaction.ts` | snapshot manifestと現在hashをundo前に読み取り比較し、変更ファイルをUIへ列挙。forceは別確認を要求 |
| 回帰テスト | `src/lib/content/contentPackage.test.ts`, `src/lib/content/contentTransaction.test.ts`, `tests/content-package-review.spec.ts` | 全項目gate、部分承認失効、差し戻し監査、read-only競合検出、Review Studio統合表示を検証 |

詳細仕様: `docs/設計書/127_Codexコンテンツ制作基盤設計.md` §14。次はPhase 7 Production Quality Gate。

## Codex Content Package Phase 7（2026-08-01）

| 項目 | ファイル | 内容 |
|---|---|---|
| Production contract | `src/lib/content/productionQualityGate.ts`, `scripts/content-production-gate.mts` | 日英・alt・字幕・点滅・色覚・reduced-motion、orphan asset、未使用effectKey、存在しないSFX、未接続drop / WAVE / rewardをFAIL判定 |
| Runtime device gate | `tests/content-production-quality.spec.ts`, `MotionAccessibilityProvider.tsx`, `BattleCanvas.tsx` | Chromiumでheap・frame予算、iPhone 13 Pro WebKitでiOS Safariの横overflow、text clip、44px touch、初回転送、animationを計測 |
| Encounter統合 | `contentBundle.ts`, `contentPackage.ts`, `scripts/content-bundle.mts`, `content/package.schema.json` | encounter必須の`stage` changeをcreate-only検証・apply・snapshot / undo対象へ追加 |
| 4種の前方互換サンプル | `productionForwardSamples.ts`, `productionForwardSamples.test.ts` | story、敵／使役魔物＋skill、weapon、bossを生成→human review→atomic apply→runtime接続確認→undoまで再現 |
| Release QA | `scripts/content-qa.mts` | production contract、master audit、型、Jest、Next production build、gzip初回bundle、Playwright、視覚回帰を統合 |

詳細仕様: `docs/設計書/127_Codexコンテンツ制作基盤設計.md` §15。Content Package制作基盤ロードマップv2（Phase 1〜7）は完了。

---

## 意思決定（解決済みQ&A）

| 質問 | 決定内容 |
|---|---|
| スタミナ方針 | **完全廃止**。無制限周回。リテンションは4層RNG・残滓スコアで担保 |
| パーティ仲間 | **アルド + モンスター軍団（3スロット）のみ**。ヒューマン仲間は第1部に存在しない |
| オンライン | **オンラインゲームとして実装**。NextAuth.js v5 + クラウドセーブ + ランキング + 世界ログ |
| リリーススコープ | **第1章「亡国の王都」のみ**で一旦完成。第2章以降は先送り |
