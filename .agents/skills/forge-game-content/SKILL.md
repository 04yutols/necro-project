---
name: forge-game-content
description: Necromance Brave の世界観に沿うストーリー、人物、戦闘ユニット、ステータス、武器、スキル、残滓、画像、VFX、SFX、登場・入手導線をContent Packageとして制作・検証・統合する。Codexで新規ゲームコンテンツ一式を企画する、既存設定との矛盾を点検する、画像や演出を作る、またはゲームへ組み込むときに使う。
---

# Forge Game Content

一つの依頼を、世界観・数値・画像・演出・接続・検証が揃ったContent Packageとして扱う。必須成果物が欠ける場合は完成と報告しない。

## Workflow

1. `references/world-bible.md`と`references/content-package.md`を全文読む。
2. `docs/progress/CH1_TODO.md`と`docs/progress/DEFERRED.md`を確認し、適用可能な章とパーティ規約を固定する。
3. 制作対象を分類する。
   - 物語人物: profile / story / portrait
   - 戦闘ユニット: enemy / monster / Aldo job。第1部に人間仲間を追加しない
   - 装備: weapon / residue name・visual。残滓性能は別承認
   - skill: mechanics / balance / icon / VFX / SFX
   - encounter: enemy / stage / background / drop / story trigger
4. `.agents/skills/data-author/SKILL.md`と必要な参照を読み、JSONと数値を作る。コード変更時は`.agents/skills/project-arch/SKILL.md`も読む。
5. bitmap画像が必要なら`references/visual-assets.md`を全文読み、`imagegen`スキルを使う。コードネイティブのSVG/CSS/Framer/PixiJS演出は画像生成へ置き換えない。
6. `creativeBrief`、必須成果物、依存関係、未決事項をContent Packageへ記録する。
7. `content/packages/example.full-content-package.json`を基にContent Packageを作る。数値草稿は`artifact.authoringKind`と`artifact.request`へ記録し、`npm run content:author -- <package.json>`でchange・数値根拠・BattleEngine証跡へ変換する。作例は`content/packages/phase2-authoring-example.json`を参照する。
8. 画像を含む場合は`content:assets:prompts`で生成キューを作る。キュー順にCodex内蔵画像生成を使い、出力を各`originalPath`へコピーしてから`content:assets:forge`と`content:assets:check`を実行する。派生画像は`referenceAssetPaths`を画像生成へ渡し、基準デザインを維持する。
9. skill演出を含む場合はREADY `presentation`へ全仕様を書き、`npm run content:present -- <package.json>`でtimeline storyboardと`presentation-preview`証跡を生成する。`/admin/effects`で速度・背景・reduced-motion・低負荷を切り替えて確認する。
10. `npm run content:validate -- <package.json>`を実行する。数値は既存balance gateと実BattleEngine、画像は`/admin/assets`の実表示とcontact sheet、VFX/SFXは`/admin/effects`とstoryboard、参照はpackage validatorで検証する。
11. `/admin/content-packages`でpackageの概要、ゲーム上の役割、数値根拠、画像contact sheet、演出、story、semantic diff、不足項目、WARNを提示する。人間が対象・差分・asset・presentation・evidenceをコメント付きで項目別承認するまで待ち、Codex自身を承認者にしない。
12. 全項目承認後、Review Studioまたは`content:transition`でVALIDATED → REVIEWED → APPROVEDを別々に記録する。REVIEWED / APPROVEDは`actor-type=human`だけが実行できる。再生成はDRAFTへ戻し、理由を監査履歴へ残す。
13. 承認後だけReview Studioの確認文字列付きapply、または`npm run content:apply -- <package.json> --approved-by=<approver>`を使う。READY presentationは`skillPresentations.json`へ登録される。必要なら競合検出結果を確認してsnapshotからundoする。
14. `npm run content:production -- <package.json>`でlocalization、accessibility、asset、effectKey、SFX、登場・入手導線を検査する。apply後は`content:qa`でproduction buildとiPhone相当のruntime計測まで実行する。

## Current automation boundary

- Content Package v2: 必須成果物、依存グラフ、Lore Registry、provenance、日英localization、状態遷移を自動検証
- 自動適用済み: `story-character` / `story-scene` / `enemy` / `monster` / `skill` / `job` / `weapon` / `stage` / `residue-name`とREADY asset
- JSON・asset・package状態を同じsnapshotへ保存し、競合検知付きundoが可能
- Phase 2 Authoring API: role・levelから8ステータス、耐性、MP、cost、成長を生成し、enemy / monster / Aldo jobの固有値へ展開
- skillはpower / MP / AoE / ailment budget / ultimate、weaponは実WeaponSystemの基礎ATK / subOptions / passive rank I〜Vを生成
- Content Package adapterがenemy / monster / skill / job / weaponの既存決定論gateを再利用し、実BattleEngineでTTK・被ダメージ・AoE価値・行動順・編成costを記録
- Phase 3 Visual Asset Forge: `AssetSpec`、標準出力パス、依存順prompt queue、原本保持、WebP最適化、alpha / 寸法 / 容量 / hash / orphan / 参照検査、contact sheet、`/admin/assets` previewを実装済み
- `CharacterPortrait`は`portraitBase/{expression}.webp` → `default.webp` → 抽象fallbackの順で表示する
- Phase 4 Skill Presentation Forge: `effectKey`専用registry、全attackType fallback、cast / travel / impact / aftermath、multi-hit damage、hit-stop / camera / flash / marker、WebAudio cue、performance / accessibility gateを実装済み
- READY presentationは承認後の`content:apply`で`src/data/presentation/skillPresentations.json`へ登録し、戦闘・`/admin/effects`から同じ仕様を解決する
- `content:present`はSVG storyboardとhash付き`presentation-preview`証跡を生成する。実機の滑らかさと造形は管理画面で人間が確認する
- Phase 5 Package Orchestrator: 一依頼を7工程と依存グラフへ展開し、工程単位で再生成できる。部分失敗はINCOMPLETE / PARTIALとして完成扱いを防ぐ
- Phase 6 Review Studio: semantic diff、BattleEngine結果、story、contact sheet、VFX/SFX、evidence、依存を一画面に統合。項目hash単位の承認失効、human-only承認、監査ログ、UI apply / undo / conflict detectionを実装済み
- Phase 7 Production Quality Gate: 日英・alt・字幕・点滅・色覚・reduced-motion、orphan asset、未使用effectKey、SFX、drop / WAVE / reward参照、iPhone相当layout・touch・load・heap・frameをrelease前にFAIL判定する
- 前方互換サンプルはstory、敵／使役魔物＋skill、weapon、boss encounterの4種で、生成→human review→atomic apply→runtime接続確認→undoを毎回再現する

## Non-negotiable rules

- 固有名詞、時系列、人物の目的、能力の代償を既存正典と整合させる。
- ステータスや効果は説明文から推測だけで確定せず、役割・目標レベル・期待TTKを根拠にする。
- 数値草稿を直接`changes`へ手書きせず、可能な限り`content:author`で生成し、`artifact.authored.rationale`と`artifact.simulation`を残す。
- `weapon`は既存weapon balance、`skill`はskill balanceを通し、未知のsystem tagやeffect key挙動を捏造しない。
- 残滓名称制作にmainStat、subOptions、抽選率を混ぜない。性能変更は独立したバランスタスクにする。
- 画像は用途、寸法、透過、safe area、表情、出力パス、参照元を記録する。
- 生成画像を直接`public/`へ置かない。Codex生成原本を`originalPath`へ保持し、READY化は`content:assets:forge`だけで行う。
- fullbody / weapon cardなどの基準画像を先に生成し、表情・bust・battle・icon・silhouette・VFX派生は`referenceAssetRefs`と`referenceAssetPaths`を渡す。
- 画像forgeのPASSは機械検査だけを意味する。造形・表情・装備・配色の一貫性はcontact sheetで人間が判断する。
- VFXはdamage timing、duration、hit-stop、camera、粒子予算、reduced-motion、SFX timingを定義する。
- presentationはelement / attackType / label、色以外のshape cue、flash 3Hz以下、低性能端末粒子数、DOM上限、targetFrameMsを省略しない。
- 専用effectKeyは`{element}_{attackType}_{specific}`、共通演出は`{element}_{attackType}`とする。未登録キーでも全6種のattackType fallbackが動くことを確認する。
- 新要素がstory、stage、enemy、drop、inventory、battle、UIのどこで体験されるか接続を示す。
- 第2章以降は`DEFERRED.md`の方針が変わるまで適用しない。

適用前スナップショットとundoを維持する。Content Package対応前の画像・コード変更を含む場合は、対象差分と復旧方法を個別に提示する。
