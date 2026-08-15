# Codexコンテンツ制作基盤ロードマップ v2

> 再策定: 2026-07-31  
> 目標: 世界観テキストだけでなく、数値、画像、VFX、SFX、入手導線、ゲーム内表示、検証までをCodex内で制作・統合できるようにする。

## ゴールと完成条件

ユーザーが「この世界観で新しいキャラクター／武器／スキル／残滓／敵／ステージを作って」と依頼したとき、Codexが次を一つの **Content Package** として扱える状態を完成形とする。

1. 企画・世界観・固有名詞
2. ゲームデータ・ステータス・成長曲線・効果
3. 立ち絵・表情差分・アイコン・武器絵・背景などの画像
4. スキルVFX・アニメーションタイムライン・SFX
5. ストーリー、ステージ、敵、ドロップなどへの入手・登場導線
6. 日本語／英語、アクセシビリティ、低負荷・reduced-motion対応
7. 決定論検証、バランスシミュレーション、画像検査、プレビュー、回帰テスト
8. 人間レビュー、承認証跡、適用、undo

いずれかの必須要素が欠ける場合は「完成」ではなく `DRAFT` または `BLOCKED` と表示する。

## 現状診断

| 領域 | 現状 | 判定 |
|---|---|---|
| 世界観・ストーリー草案 | world bible、story agent、story validatorあり | 部分対応 |
| 武器数値 | weapon agent、weapon balance、シミュレーション基盤あり | 部分対応 |
| 敵・魔物・職業・スキル数値 | 個別agentと決定論ゲートあり | 部分対応 |
| 残滓 | 名称マスターは制作可能。性能は既存RNGが所有 | 意図的に分離 |
| キャラクター画像 | 実画像はほぼなく、`CharacterPortrait`は抽象プレースホルダー | 未対応 |
| 武器・スキル・残滓画像 | 絵文字／CSS表現が中心。画像manifestなし | 未対応 |
| スキルVFX | `属性 × attackType`共通フォールバックあり。`effectKey`専用registryなし | 部分対応 |
| SFX/BGM | WebAudioによる共通プロシージャル音あり。個別SFX registryなし | 部分対応 |
| 複合コンテンツ一括生成 | 4 scopeのcreate-only bundleのみ | 不足 |
| ゲーム内プレビュー | 専用のキャラクター／画像／VFXレビュー画面なし | 未対応 |

## Phase 0 — 安全なテキスト／JSON基盤（実装済み）

- [x] リポジトリ共有スキル`forge-game-content`
- [x] 世界観正典と`creativeBrief`
- [x] story-character / story-scene / weapon / residue-name bundle
- [x] create-only、参照・重複・武器バランス検証
- [x] 人間承認、スナップショット、失敗時ロールバック
- [x] 残滓名称と性能RNGの責務分離

## Phase 1 — Content Package契約（実装済み）

すべての後続工程が同じ成果物を扱えるよう、最初に契約を固定する。

- [x] `content/package.schema.json`を作成する
- [x] package状態を`DRAFT / VALIDATED / REVIEWED / APPROVED / APPLIED / BLOCKED`で管理する
- [x] scopeを追加する
  - `character-profile`: 人物設定、口調、関係、物語上の役割
  - `combat-unit`: enemy / monster / Aldo jobの戦闘値と成長
  - `skill`: 数値・対象・状態異常・AI使用条件
  - `asset`: 立ち絵、表情、スプライト、アイコン、背景、VFXテクスチャ
  - `skill-presentation`: VFX、SFX、ヒット時刻、カメラ演出
  - `acquisition-link`: stage / enemy / drop / storyへの接続
- [x] package内の依存グラフと必須成果物を検証する
- [x] アセットを含むスナップショット／undo方式を決定・実装する
- [x] 内容のハッシュ、生成元、プロンプト、参照画像、承認者を記録するprovenanceを定義する
- [x] Lore Registry（人物関係、時系列、固有名詞、確定／未確定設定）を構造化する
- [x] 日英テキストと画像altを`localization`成果物として必須条件へ組み込む

完了条件: 不足成果物と参照切れを、ファイル適用前に一覧化できる。**達成済み。**

実装:

- 契約: `content/package.schema.json`
- ランタイム検証・状態遷移: `src/lib/content/contentPackage.ts`
- Lore Registry: `content/lore/registry.json` / `src/lib/content/loreRegistry.ts`
- JSON・asset共通snapshot / undo: `src/lib/content/contentTransaction.ts`
- CLI: `content:validate` / `content:transition` / `content:apply` / `content:undo`
- 作例: `content/packages/example.full-content-package.json`（不足を示すDRAFT）/ `content/packages/phase1-smoke.json`（完全な最小構成）

Phase 1ではContent Packageの契約と安全な反映を完成させた。`combat-unit`や`skill`のartifact payloadを実マスターデータへ変換し、実BattleEngineで評価するAuthoring APIはPhase 2で実装する。

## Phase 2 — 数値・メカニクス制作（実装済み）

- [x] `combat-unit`の共通Authoring APIを作る
- [x] 8ステータス、耐性、MP、コスト、成長曲線を役割・レベル帯から生成する
- [x] playable / enemy / necromanced monsterで共有する値と固有値を分離する
- [x] スキル威力、MP、範囲、状態異常予算、奥義をまとめて生成する
- [x] 武器の基礎ATK、サブオプション、passive A/B、rank I〜Vを生成する
- [x] 残滓は名称・テーマ制作と性能RNG調整を別承認にする
- [x] stage TTK、被ダメージ、AoE価値、行動順、編成コストをシミュレータで評価する
- [x] 敵／武器／スキル／職業の既存個別agentをContent Package adapter経由で再利用する
- [x] 数値変更理由と目標帯をpackageへ記録する

完了条件: 合成データではなく実BattleEngineで代表編成を流し、目標帯外をFAILまたはWARNにできる。**達成済み。**

実装:

- 共通生成API: `src/lib/content/gameplayAuthoring.ts`
- Content Package adapter: `src/lib/content/gameplayPackageAdapter.ts`
- 実BattleEngine / StageDataシミュレーション: `src/lib/content/gameplaySimulation.ts`
- 草稿master注入・決定論RNG: `src/logic/BattleEngine.ts`
- 対応change scope: `enemy` / `monster` / `skill` / `job` / `weapon` / `residue-name`
- CLI: `npm run content:author -- <package.json>`
- 作例: `content/packages/phase2-authoring-example.json`

Authoring結果はDRAFT packageの`changes`、`deliverables[].artifact.authored`、`deliverables[].artifact.simulation`、`evidence`へ保存する。値の大きな目標帯逸脱はFAIL、近い逸脱はWARNとなり、人間のREVIEWED / APPROVEDを経ない限りapplyできない。

> 第1部の戦闘パーティはアルド＋使役魔物3体のため、人間の新プレイアブルキャラクターは生成しない。人物は`character-profile`、戦闘参加はenemy / monster / Aldo jobとして扱う。

## Phase 3 — Visual Asset Forge（実装済み）

- [x] `AssetSpec`を定義する（用途、寸法、aspect ratio、透過、safe area、表情、画風、禁止要素）
- [x] Codexの画像生成機能を使うasset workflowを`forge-game-content`へ接続する
- [x] 標準出力パスを固定する
  - `public/images/generated/characters/{id}/`
  - `public/images/generated/weapons/{id}/`
  - `public/images/generated/residues/{id}/`
  - `public/images/generated/skills/{effectKey}/`
  - `public/images/generated/backgrounds/{id}/`
- [x] キャラクターの全身立ち絵、会話用表情、バストアップ、バトル用表示を同一デザインから生成する
- [x] 武器のアイコン、カードアート、シルエットを同一デザインから生成する
- [x] スキル／残滓アイコンと必要なVFXテクスチャ・マスクを生成する
- [x] 寸法、形式、alpha、容量、命名、孤立ファイル、参照切れを検査する
- [x] contact sheetを生成し、表情・装備・配色の一貫性を人間が確認する
- [x] WebP最適化と原本保持ポリシーを決める
- [x] `CharacterPortrait`を抽象プレースホルダーから実画像優先＋fallbackへ変更する

完了条件: 画像を生成して終わらず、manifest、参照、最適化、実画面プレビューまで自動で通る。**達成済み。**

実装:

- 画像契約・標準パス・prompt builder: `src/lib/content/assetSpec.ts`
- 原本保持・WebP・クロマキーalpha・検査・contact sheet: `src/lib/content/assetForge.ts`
- CLI: `content:assets:prompts` / `content:assets:forge` / `content:assets:check`
- 実画面: `/admin/assets`、`CharacterPortrait`の実画像優先fallback
- 参照依存順: fullbody → expression / bust / battle、weapon card → icon / silhouette、skill icon → VFX texture / mask
- 実画像作例: `content/packages/phase3-visual-example.json`

## Phase 4 — Skill Presentation Forge（VFX / Animation / SFX）

- [x] `effectKey` → 専用演出のregistryを`BattleCanvas`から分離する
- [x] `SkillPresentationSpec`を定義する
  - cast / travel / impact / aftermath
  - 各duration、damage timing、multi-hit timing
  - hit-stop、camera shake、screen flash、target marker
  - particle budget、blend mode、色、VFX texture
  - SFX profile、pitch、layer、再生時刻
- [x] CSS / SVG / Framer Motionを標準、PixiJSを高粒子演出だけに使う
- [x] 共通VFX fallbackと専用VFXの解決順を実装する
- [x] `SUMMON` / `HEAL`を含む全attackTypeを実装する
- [x] WebAudioベースの個別SFX profile registryを実装する
- [x] `/admin/effects`にeffectKey単体プレビュー、速度変更、背景切替、replayを実装する
- [x] reduced-motion、点滅抑制、色覚依存回避を検証する
- [x] 低性能端末の粒子数・DOM数・フレーム時間ゲートを追加する
- [x] スクリーンショット／動画による視覚回帰証跡を保存する

完了条件: 新しいskill packageだけで、ダメージ発生時刻と視聴覚演出が同期した専用演出を登録できる。**達成済み。**

実装:

- registry / fallback / timeline / gate: `src/lib/presentation/skillPresentation.ts`
- 戦闘同期: `SkillPresentationOverlay`と`BattleCanvas`（damage・SFX・flash・cameraを共通scheduleで駆動）
- WebAudio profile: `src/lib/presentation/sfxProfiles.ts`、`AudioService.playPresentationSfx`
- 実画面: `/admin/effects`（effectKey、速度、背景、replay、reduced-motion、低負荷）
- Package登録: READY presentationを承認後applyで`src/data/presentation/skillPresentations.json`へcreate-only登録
- 視覚証跡: `content:present`がhash付きSVG storyboardを生成
- 完成作例: `content/packages/phase4-presentation-example.json`

## Phase 5 — Package Orchestrator

- [x] 1つの依頼から必要成果物の依存グラフを自動作成する
- [x] lore → stats → skill → assets → presentation → acquisitionの順で生成する
- [x] 各工程を独立再生成できるようにする（画像だけ、数値だけ、VFXだけ）
- [x] 部分失敗をpackage状態へ反映し、完成扱いを防ぐ
- [x] JSONと画像の差分を一つのレビュー画面へまとめる
- [x] 適用後にマスター監査、型、Jest、Playwright、視覚回帰を自動実行する
- [x] 第1章release scopeと第2章DEFERREDをpackage単位で強制する

完了条件: 「亡国の王都に新しいボスと固有武器を追加」の一依頼から、必要成果物を漏れなく草案化できる。**達成済み。**

実装:

- request → package / dependency graph: `src/lib/content/packageOrchestrator.ts`, `scripts/content-orchestrate.mts`
- 工程状態: `LORE / STATS / SKILLS / ASSETS / PRESENTATION / ACQUISITION / VALIDATION`と`PLANNED / RUNNING / INCOMPLETE / PARTIAL / READY`
- 独立再生成: `content:orchestrate -- --regenerate=ASSETS|STATS|PRESENTATION <package>`。対象工程と下流だけを無効化する
- read-only統合レビュー: `/admin/content-packages`（pipeline、不足、依存、master JSON before/after、画像、演出証跡）
- 適用後QA: `content:apply`から`content:qa`を自動実行し、master audit、TypeScript、Jest、Playwright、視覚基準比較、full-page証跡を保存
- release scope: chapter 2+はschema・validator・planner・applyのpackage境界すべてでFAIL
- 完了作例: `content/requests/phase5-boss-signature-weapon.request.json` → `content/packages/phase5_ash_regent_package.json`

## Phase 6 — Admin Review Studio（実装済み）

- [x] `/admin/content-packages`に進捗、依存グラフ、不足項目、semantic diffを表示する
- [x] 数値シミュレーション、画像contact sheet、VFX preview、ストーリー試読を同じ画面に置く
- [x] 対象・master差分・asset・presentation・evidenceの項目別承認とpackage全体承認を分離する
- [x] 承認者、コメント、生成履歴、再生成理由を監査ログ化する
- [x] apply / undo / conflict detectionをUIから実行する

完了条件: JSONを直接開かずに品質判断と反映ができる。**達成済み。**

実装:

- レビュー契約・内容ハッシュ・承認失効: `src/lib/content/contentReviewWorkflow.ts`, `src/lib/content/contentPackage.ts`
- dev専用server actions: `src/app/admin/content-packages/actions.ts`
- Review Studio: `/admin/content-packages`（semantic master diff、BattleEngine指標、story、contact sheet、VFX/SFX、証跡、依存、監査）
- 人間ゲート: 項目承認完了 → `REVIEWED` → `APPROVED` → 確認文字列付きapply。Codex / automationは項目承認と全体承認を実行できない
- 再生成: DRAFTの工程を理由付きで再実行し、内容ハッシュが変わった項目だけ`PENDING`へ戻す
- 復旧: snapshot manifestを読み取り専用検査し、適用後変更をUIへ列挙。通常undoと明示的force undoを分離する

## Phase 7 — Production Quality Gate（実装済み）

- [x] 端末別レイアウト、iOS Safari、60fps、メモリ、初回ロード容量を計測する
- [x] 画像alt、字幕、点滅、reduced-motion、色覚対応を監査する
- [x] 日本語／英語の欠落とUIオーバーフローを検出する
- [x] orphan asset、未使用effectKey、存在しないSFX、未接続dropをFAILにする
- [x] サンプルpackageを最低4種作り、前方テストする
  - 物語人物＋シーン
  - 敵／使役魔物＋スキル
  - 武器＋専用画像＋入手導線
  - ボス＋背景＋専用VFX/SFX＋報酬

完了条件: 4サンプルすべてが「生成 → レビュー → 適用 → ゲーム内確認 → undo」を再現可能に通る。**達成済み。**

実装:

- package本番監査: `src/lib/content/productionQualityGate.ts`, `scripts/content-production-gate.mts`
- 端末runtime監査: `tests/content-production-quality.spec.ts`（Chromium性能・heap＋iPhone 13 Pro WebKit、layout、44px touch、初回転送、frame p95、long frame、console、reduced-motion）
- 全体motion fallback: `MotionAccessibilityProvider`, `globals.css`, `BattleCanvas`のambient animation抑制
- encounter apply: `stage` change scopeをschema、validator、atomic applyへ追加
- 4種の前方互換サンプル: `src/lib/content/productionForwardSamples.ts`
- 全ライフサイクル回帰: `src/lib/content/productionForwardSamples.test.ts`
- release QA: `content:qa`がproduction contract、master audit、型、Jest、Next production build、gzip初回bundle、Playwright、視覚回帰を一括実行

## 実装優先順位

1. ~~Phase 1 Content Package契約~~（完了）
2. ~~Phase 2 数値・メカニクス~~（完了）
3. ~~Phase 3 Visual Asset Forge~~（完了）
4. ~~Phase 4 Skill Presentation Forge~~（完了）
5. ~~Phase 5 Orchestrator~~（完了）
6. ~~Phase 6 Review Studio~~（完了）
7. ~~Phase 7 Production Gate~~（完了）

Phase 7でContent Package制作基盤のロードマップv2は完了した。以後は4種の前方互換テストとproduction gateを基準に、新規コンテンツを同じ工程へ追加する。

## 変えない原則

- LLMの自己評価だけで適用しない。
- 数値はBattleEngineと決定論ゲート、画像と演出は実画面プレビュー、人間は世界観と魅力を判断する。
- 新規コンテンツのために第1部のパーティ規約やDEFERRED境界を破らない。
- 生成物には出所、プロンプト、参照、ハッシュ、承認履歴を残す。
