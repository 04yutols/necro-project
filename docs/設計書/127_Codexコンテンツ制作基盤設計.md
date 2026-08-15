# 127 — Codexフルスタックコンテンツ制作基盤設計

> 初版: 2026-07-30  
> 再設計: 2026-07-31  
> Phase 3追記: 2026-08-01  
> ロードマップ: [CODEX_CONTENT_ROADMAP.md](../progress/CODEX_CONTENT_ROADMAP.md)

## 1. 再設計理由

初版はストーリー、物語人物、武器、残滓名称のJSONを安全に反映する範囲だった。次の領域は未統合であり、「Codexだけでゲームに必要な要素を完成させる」という目標には不足していた。

- 戦闘キャラクターのステータス、成長曲線、スキルセット
- 立ち絵、表情、武器絵、アイコン、背景、VFXテクスチャ
- `effectKey`ごとの専用VFX、アニメーション、SFX
- ストーリーやドロップへの登場・入手導線
- 実画面プレビュー、視覚回帰、アクセシビリティ、性能検査

このため、制作単位を「JSON変更の束」から **Content Package** へ拡張する。

## 2. Content Package

Content Packageは、一つの企画をゲーム内体験へ変換するための成果物と証跡をまとめた単位である。

```text
ContentPackage
├─ brief                 世界観、目的、対象章、禁止事項
├─ lore                  人物、関係、時系列、名称、台詞
├─ gameplay              stats、growth、skill、AI、drop
├─ assets                portrait、sprite、icon、weapon、background、texture
├─ presentation          VFX、animation timeline、SFX、camera、hit timing
├─ integration           story、stage、enemy、inventory、UIへの参照
├─ localization          ja / en、字幕、alt
├─ evidence              sim、screenshots、visual diff、tests
├─ provenance            prompts、references、hashes、generator
└─ review                status、reviewer、comments、approval
```

## 3. コンテンツ別の最低完成条件

| 種類 | 必須データ | 必須ビジュアル | 必須演出・接続 |
|---|---|---|---|
| 物語人物 | profile、口調、関係、表情一覧 | 立ち絵＋使用表情 | 登場scene、portrait参照 |
| 戦闘ユニット | 8stats、耐性、MP、成長、skill、role | バトル表示、アイコン | turn、AI、被弾、撃破、入手／登場導線 |
| 武器 | rarity、archetype、sub、passive A/B、flavor | icon＋カード／詳細画像 | drop、inventory、equip、passive動作 |
| スキル | power、MP、target、element、ailment、effectKey | skill icon、必要なtexture | VFX、SFX、damage timing、AI利用、battle test |
| 残滓 | 名称、rarity、origin、tags | slot iconまたは共通rarity visual | 性能RNG、drop、equip表示。名称制作と性能変更は別承認 |
| 敵／ボス | stats、resistance、skill、gimmick、drop | sprite、portrait/icon | WAVE、専用VFX/SFX、報酬、TTK検証 |
| ステージ | waves、gimmick、reward、story trigger | background、map node | unlock graph、battle、story、result |

## 4. 現在利用できる基盤

- 文章・JSON生成: 管理画面Agent A〜E、`data-author`、`forge-game-content`
- 数値検証: enemy / skill / weapon / job / monster等の`*Balance.ts`
- バトル評価: simulation report、enemy draft report、実BattleEngine
- 画像生成: Codex内蔵画像生成 → 原本保持 → WebP最適化 → manifest / contact sheet / 実画面previewを実装済み
- VFX: `BattleCanvas`の`属性 × attackType`共通overlay。専用`effectKey` registryは未実装
- 音: `AudioService`の属性別WebAudio合成。個別skill SFX registryは未実装
- 画像表示: `CharacterPortrait`は表情画像、default画像、抽象fallbackの順で解決する。`/admin/assets`でpackage画像を一覧表示する
- 反映: create-only bundle、承認者必須、スナップショット、ロールバック

## 5. 目標アーキテクチャ

```text
User request
   ↓
Package Planner ──→ Lore Registry / release scope
   ↓ dependency graph
Data Authors ──→ deterministic validators ──→ Battle simulator
   ↓
Asset Forge ──→ image manifest ──→ dimension/alpha/size/contact-sheet QA
   ↓
Presentation Forge ──→ effect registry / SFX registry ──→ effect preview
   ↓
Package Validator ──→ missing artifact / broken reference / performance gate
   ↓
Admin Review Studio ──→ human approval
   ↓
Transactional Apply ──→ tests / screenshots / visual regression / undo
```

## 6. 技術方針

### 6.1 数値

- `src/types/game.ts`を正典とする。
- 新規数値は既存の個別balance gateを再利用し、最終的に実BattleEngineで評価する。
- 目標レベル、役割、期待TTK、想定編成をpackageへ残す。
- 物語人物と戦闘ユニットを分離する。第1部では新しい人間仲間を生成しない。

### 6.2 画像

- bitmap生成はCodexの画像生成機能を使用する。
- 出力ごとに`AssetSpec`とprovenanceを保存する。
- 表情差分は別人化を防ぐため同じ基準画像から派生させる。
- 原本は`content/packages/{packageId}/originals/`、最適化WebPは`optimized/`、レビュー画像は`reviews/`へ保持する。
- 画像の存在だけで合格にせず、実コンポーネントへ表示して確認する。

### 6.3 VFX

- 通常VFXはCSS / SVG / Framer Motionで実装する。
- 高粒子数や背景Canvasが必要な場合だけPixiJSを使う。
- `BattleCanvas`からeffect registryを分離し、`effectKey`で専用演出、未登録時は共通VFXへfallbackする。
- damage timingを演出のimpact時刻へ同期する。
- 60fps、reduced-motion、点滅頻度、色覚依存を検証する。

### 6.4 SFX / BGM

- skill SFXは既存WebAudioをパラメータ化し、再現可能なprofileとして管理する。
- 完成音源が必要な場合も参照先をmanifest化し、欠落時はpackageを完成扱いにしない。
- BGM・ボイスはストーリー／大型packageの任意拡張とし、必須に指定された場合だけblocking artifactにする。

### 6.5 反映と復旧

- JSONと画像を同じpackage revisionで扱う。
- 既存ファイルはatomic write、画像はcontent hash付き配置を基本とする。
- apply前に対象ファイルと置換対象アセットをsnapshotする。
- Codexは草案作成者になれるが自己承認者にはならない。

## 7. 第1部制約

仕組みは将来コンテンツを制作できる一般形にするが、現在の適用先は第1章だけである。

- パーティはアルド＋使役魔物3体。
- 人間人物に戦闘statsを付けてプレイアブル化しない。
- 第2章以降のstory / stage / enemyは`DEFERRED.md`の方針が変わるまでapplyしない。
- 将来用scopeやschemaを作ることと、将来コンテンツそのものを実装することを区別する。

## 8. 初版Phase 0の扱い

既存の`story-character / story-scene / weapon / residue-name` bundleは破棄せず、Content Packageのdata change layerとして内包する。安全性と既存テストを維持しながら段階的にschemaを拡張する。

## 9. Phase 1 実装仕様

### 9.1 ファイル構成

| ファイル | 役割 |
|---|---|
| `content/package.schema.json` | Content Package v2のJSON Schema |
| `src/lib/content/contentPackage.ts` | 型、完全性マトリクス、参照・依存・状態・hash検証 |
| `content/lore/registry.json` | 確定／未確定設定、人物関係、時系列の正規化データ |
| `src/lib/content/loreRegistry.ts` | Lore RegistryのID・関係・時系列参照検証 |
| `src/lib/content/contentTransaction.ts` | JSON・画像・package本体のatomic apply / snapshot / undo |
| `scripts/content-bundle.mts` | v1 bundleとv2 packageを扱う共通CLI |

### 9.2 参照形式

package内参照は次の名前空間を使う。

```text
target:{id}
deliverable:{id}
change:{scope}:{id}
asset:{id}
presentation:{id}
localization:{id}
evidence:{id}
lore:{id}
relationship:{id}
timeline:{id}
```

`dependencies[].relation = REQUIRES`だけを有向必須依存として循環検出する。`USES`と`INTEGRATES`も参照切れはFAILにするが、循環判定には使わない。

### 9.3 完全性判定

`targets[].kind`ごとに必須成果物マトリクスを固定した。対象は物語人物、戦闘ユニット、武器、スキル、深淵の残滓、encounterである。

- `DRAFT / BLOCKED`: 不足成果物はWARN。構造破損、参照切れ、依存循環、hash不一致はFAIL
- `VALIDATED / REVIEWED / APPROVED / APPLIED`: 不足成果物もFAIL
- すべてのtargetにLore参照、日英名、日英画像altを要求
- `READY asset`にstaging file、出力先、形式、寸法、alpha、safe area、bytes、sha256を要求
- `READY presentation`にcast / travel / impact / aftermath、damage timing、VFX、SFX、reduced-motionを要求

### 9.4 状態遷移と人間承認

```text
DRAFT → VALIDATED → REVIEWED → APPROVED → APPLIED
  └──────────────→ BLOCKED ─────────────→ DRAFT
VALIDATED / REVIEWED / APPROVED → DRAFT
```

`REVIEWED`と`APPROVED`のactorTypeは`human`に限定する。Codexまたはautomationによる自己承認はvalidatorが拒否する。`APPLIED`はCLIによる実適用とsnapshot作成が同時に成功した場合だけ記録する。

### 9.5 provenanceと改変検知

`provenance`は作成者、generator/model/version、prompt本文、参照ファイル・画像・URL・依頼を保持する。`VALIDATED`遷移時に、review・status・evidenceを除く制作内容のcanonical JSONからsha256を生成する。検証後に内容が書き換わった場合はhash不一致でFAILになり、`DRAFT`へ戻して再検証する必要がある。

### 9.6 apply / undo

v2 packageのREADY assetは`content/packages/`配下をstaging sourceとし、画像は`public/images/generated/`、音声は`public/audio/generated/`へ適用する。apply前に既存JSON、置換対象asset、package本体を同じ`.content-snapshots/{packageId}__{timestamp}/`へ保存し、`manifest.json`へ適用前後hashを記録する。

undo時は現在のhashが適用直後hashと一致することを先に確認する。適用後に別編集がある場合は競合として停止し、明示的な`--force`なしでは上書きしない。

```bash
npm run content:validate -- content/packages/phase1-smoke.json
npm run content:transition -- content/packages/phase1-smoke.json --to=VALIDATED
npm run content:transition -- content/packages/phase1-smoke.json --to=REVIEWED --actor=<reviewer> --actor-type=human --comment='<comment>'
npm run content:transition -- content/packages/phase1-smoke.json --to=APPROVED --actor=<approver> --actor-type=human
npm run content:apply -- content/packages/phase1-smoke.json --approved-by=<approver>
npm run content:undo -- .content-snapshots/<snapshot-directory>
```

### 9.7 Phase 1の境界

Content Packageの不足検出、状態、承認、assetを含む復旧は実装済み。この時点ではVisual Asset Forgeと専用VFX/SFX registryをPhase 3 / 4の対象としていた。

## 10. Phase 2 実装仕様

### 10.1 Authoring API

`src/lib/content/gameplayAuthoring.ts`を数値制作の共通入口とする。

- combat-unit: `STRIKER / TANK / CONTROLLER / SUPPORT`とtarget levelから8ステータス、耐性、MP、cost、成長checkpointを生成する
- variant: 共有値からenemy、味方monster、Aldo job固有のmaster形へ展開する。人間仲間は生成しない
- skill: 設計書19の分類・Tier・MP帯からpowerを選び、AoE、状態異常budget、ultimateCostを同時設計する
- weapon: `WeaponSystem`のrarity × archetype × ILv式で基礎ATKを算出し、レアリティ別subOption枠とpassive A/BのRank I〜Vを作る
- residue-name: name / rarity / origin / themesだけを作り、性能値は既存の決定論RNGへ委譲する

生成後は既存の`enemyBalance / monsterBalance / skillBalance / jobBalance / weaponBalance`を必ず通す。独自の緩いvalidatorへ置き換えない。

### 10.2 Package adapter

READY deliverableへ次の要求を置く。

```json
{
  "artifact": {
    "authoringKind": "combat-unit | skill | weapon | residue-name",
    "request": {},
    "simulationTargets": {}
  }
}
```

`npm run content:author -- <package.json>`はDRAFTだけを処理し、次を同時に更新する。

1. 実マスター形式の`changes`
2. 数値根拠・目標帯・個別gate結果の`artifact.authored`
3. 実戦闘詳細の`artifact.simulation`
4. 人間レビュー用要約の`evidence`

enemy / monster / skill / jobを新しいchange scopeとして追加した。job / monster草稿はvalidator用の`id`を持つが、apply時にはmaster規約どおりキーIDへ正規化して内部`id`を除去する。

### 10.3 BattleEngineシミュレーション

`src/lib/content/gameplaySimulation.ts`は`BattleEngine`そのものを使用する。草稿skillをファイルへ仮適用せず評価できるよう、`BattleEngine`へread-only master providerとRNGを注入できる依存点を追加した。通常ゲームは従来どおり`MasterDataService.getInstance()`と`Math.random`を使う。

AuthoringではRNGを固定し、次を測定する。

- 単体・StageData全WAVEのTTK（行動回数）
- 敵反撃による累積被ダメージ率
- 3体候補へ同一アクションを流したAoE単体比
- `TurnOrderSystem`によるplayer / ally / enemyの行動順
- アルド＋monster 3 slotの合計編成cost

各metricは目標帯内をPASS、帯域幅25%以内の逸脱をWARN、それ以上をFAILにする。FAILでも自動補正や承認はせず、DRAFTへ証跡を残して役割・目標・数値を再検討する。

### 10.4 運用例

```bash
cp content/packages/phase2-authoring-example.json content/packages/<new-package>.json
npm run content:author -- content/packages/<new-package>.json
npm run content:validate -- content/packages/<new-package>.json
```

作例は数値工程だけをREADYにし、Phase 3の画像とPhase 4のVFX/SFXを未完WARNとして可視化する。数値工程完了をコンテンツ一式の完成とは扱わない。

## 11. Phase 3 実装仕様

### 11.1 AssetSpec

`src/lib/content/assetSpec.ts`を画像制作契約の正本とする。各image assetは用途、variant、寸法、aspect ratio、透過方式、safe area、表情、effectKey、consistency group、画材・配色・光・雰囲気・材質、必須要素、禁止要素、容量上限を持つ。

対応用途はcharacter fullbody / expression / bust / battle、weapon icon / card / silhouette、residue icon、skill icon、VFX texture / mask、backgroundである。用途から次の配信先を一意に算出する。

```text
public/images/generated/characters/{ownerId}/
public/images/generated/weapons/{ownerId}/
public/images/generated/residues/{ownerId}/
public/images/generated/skills/{effectKey}/
public/images/generated/backgrounds/{ownerId}/
```

### 11.2 Codex画像生成との境界

`content:assets:prompts`はworld/theme/safe area/style/negativeを含む生成jobを`reviews/asset-prompts.json`へ保存し、`referenceAssetRefs`をトポロジカル順に並べる。Codexは内蔵画像生成へjob promptを渡し、結果を`originalPath`へコピーする。ゲームや管理画面から外部画像APIを呼ばず、APIキーをリポジトリへ持ち込まない。

基準画像からの派生順は次とする。

```text
character-fullbody -> expression / bust / battle
weapon-card        -> icon / silhouette
skill-icon         -> VFX texture / mask
```

派生jobは`referenceAssetPaths`を持つ。画像生成時に参照画像を入力し、顔、比率、装備、配色、素材を変更しない制約を繰り返す。

### 11.3 Forgeと品質ゲート

`src/lib/content/assetForge.ts`と`scripts/content-assets.mts`が次を実行する。

1. 原本パス、拡張子、参照asset、循環を検査
2. EXIF回転、指定寸法へのcontain、OPAQUE flattenまたはalpha維持
3. CHROMA_KEYなら`#00ff00`をsoft matte / despillしてalpha化
4. 容量内に収まるまでWebP qualityを段階調整
5. width / height / alpha / bytes / sha256をmanifestへ記録
6. originals / optimizedのorphanを列挙
7. contact sheetと`asset-quality` evidenceを生成
8. optimized画像、contact sheet、package JSONを失敗時復元付きで一括更新

機械PASSは造形品質の承認ではない。contact sheetで表情、装備、シルエット、palette、材質、safe areaを人間が確認し、CodexはREVIEWED / APPROVEDへ自己遷移しない。

### 11.4 実画面表示

`/admin/assets`はDRAFTを含む全packageの原本または最適化画像、状態、用途、寸法、alpha、容量、prompt参照、contact sheetを表示する。画像APIはdevelopment限定で、manifestに記録された`content/packages/`配下のファイルだけを配信する。

`CharacterPortrait`は`portraitBase/{expression}.webp`、`portraitBase/default.webp`、`portraitBase.webp`を順に試し、存在しない場合だけ従来の抽象表示へfallbackする。

### 11.5 作例とコマンド

```bash
npm run content:assets:prompts -- content/packages/phase3-visual-example.json
# Codex imagegenの出力をjob.originalPathへ保存
npm run content:assets:forge -- content/packages/phase3-visual-example.json
npm run content:assets:check -- content/packages/phase3-visual-example.json
npm run content:validate -- content/packages/phase3-visual-example.json
```

作例「灰冠の葬剣」は1024×1536の生成原本を保持し、768×1152のWebP、hash付きmanifest、contact sheet、`/admin/assets`表示まで通す。package全体は武器数値・icon・入手導線が未完のためDRAFTを維持する。

## 12. Phase 4 実装仕様

### 12.1 SkillPresentationSpecと解決順

`src/lib/presentation/skillPresentation.ts`を演出契約の正本とする。仕様は`effectKey`、element、attackType、labelに加え、cast / travel / impact / aftermath、damage timings、renderer、色・blend・texture、particle / DOM予算、hit-stop、camera shake、screen flash、target marker、SFX cue、reduced-motion、低性能端末予算を持つ。

解決順は次で固定する。

```text
適用済み専用effectKey
→ 内蔵専用effectKey
→ {element}_{attackType}
→ 全6 attackTypeの共通fallback
```

標準rendererはCSS / SVG / Framer Motionとし、64粒子超の高粒子演出だけPixiJSを検討する。`SUMMON`は門と召喚紋、`HEAL`は生命環を形状手掛かりとして持ち、色だけで効果を判別させない。

### 12.2 戦闘同期とSFX

`createPresentationSchedule`が速度倍率を含む唯一の時計を返す。`BattleCanvas`はこのscheduleからdamage / multi-hit、SFX cue、screen flash、camera shake、overlay終了を予約する。`SkillPresentationOverlay`も同じspecとplaybackRateを使うため、表示とダメージが別の定数へ分岐しない。

SFXは`src/lib/presentation/sfxProfiles.ts`のWebAudio profileを使う。各cueはprofileKey、atMs、pitch、volume、CAST / TRAVEL / IMPACT / AFTERMATH layerを持ち、`AudioService.playPresentationSfx`がtone / noise / filterを合成する。

### 12.3 Accessibility / performance gate

READY presentationは次を満たす。

- flashは3Hz以下、screen opacityが強い場合はWARN
- `colorIndependent = true`かつ非空のshape cue
- reduced-motion modeとreduced particle scale
- low-device particle budgetは通常particle budget以下
- DOM budgetはmax DOM nodes以下、target frameは16.6ms以上
- 64粒子以下のPixiJS、64粒子超のDOM rendererはWARN

実行時はOSのreduced-motionとhardwareConcurrencyを検出し、静的glyphまたは粒子削減へ落とす。iOS Safari規約に従い、overflow layerとtransform layerを分離する。

### 12.4 Preview、証跡、Package適用

`/admin/effects`はmaster skillとregistryをまとめて表示し、effectKey、0.5〜2倍速、亡国の王都／深淵／明背景、replay、reduced-motion、低負荷を切り替える。timeline、damage、SFX、粒子・DOM・frame予算も同時表示する。

```bash
npm run content:present -- content/packages/<package>.json
npm run content:validate -- content/packages/<package>.json
```

`content:present`はREADY presentationを検査し、`content/packages/{packageId}/reviews/presentation-preview.svg`とsha256付き`presentation-preview` evidenceを作る。APPROVED packageをapplyするとREADY presentationを`src/data/presentation/skillPresentations.json`へcreate-onlyで登録し、skill JSON・asset・packageと同じsnapshot / undo対象に含める。既存effectKeyの上書きはFAILとする。

作例`phase4-presentation-example.json`は専用キー`dark_magic_ashen_crown`を持つ「灰冠の三葬」を定義し、3-hit damage、4層SFX、SVG VFX、reduced-motion、低負荷予算、icon、日英localization、storyboard証跡を0 failで検証する。

## 13. Phase 5 実装仕様

### 13.1 一依頼からのPackage計画

`ContentOrchestrationRequest`をCodex agentと自動処理の境界にする。依頼本文、章、brief、Lore proposal、targetごとのauthoring request、AssetSpec、presentation blueprint、登場・入手導線を一つのrequest JSONへ記録する。`createOrchestratedContentPackage`はtarget kind別の完全性マトリクスを引き、deliverable、日英名・alt、evidence placeholder、target間・成果物間dependencyを自動生成する。

標準工程は次のDAGで固定する。

```text
LORE → STATS → SKILLS ─┬→ PRESENTATION ─┐
   └────────→ ASSETS ──┘                 ├→ VALIDATION
              STATS → SKILLS → ACQUISITION ┘
```

数値は`materializeGameplayPackage`を`combat-unit / weapon / residue-name`と`skill`へ分割実行する。画像はAssetSpecと参照順つきprompt queue、演出は専用effectKeyを持つSkillPresentationSpec、入手はstage / wave / drop / owner / story triggerの構造化草案へ変換する。

### 13.2 工程状態と独立再生成

各stageは`PENDING / RUNNING / PASS / WARN / FAIL / BLOCKED`、package pipelineは`PLANNED / RUNNING / INCOMPLETE / PARTIAL / READY`を持つ。attempt、開始・完了時刻、artifact refs、summary、findingsをpackageへ保存する。

```bash
npm run content:orchestrate -- content/requests/<request>.json
npm run content:orchestrate -- content/packages/<package>.json --regenerate=STATS
npm run content:orchestrate -- content/packages/<package>.json --regenerate=ASSETS
npm run content:orchestrate -- content/packages/<package>.json --regenerate=PRESENTATION
```

再生成は指定工程とその下流だけをPENDINGへ戻す。例えばASSETS再生成はLORE / STATS / SKILLS / ACQUISITIONを保持し、ASSETS / PRESENTATION / VALIDATIONだけを無効化する。工程例外はstage FAIL、依存先BLOCKED、pipeline PARTIALとして残り、VALIDATED以降へ遷移できない。画像原本待ちやWARN証跡はINCOMPLETEとして残し、草案作成と完成を区別する。

### 13.3 統合read-onlyレビュー

`/admin/content-packages`はPhase 5時点では書き込み操作を持たない。次を同じ画面へ表示する。

- 元依頼、release scope、7工程の状態・要約・attempt
- 現マスターとpackage changeのJSON before / after
- AssetSpec、原本または最適化画像、出力先、生成待ち状態
- 完成を止めるdeliverable / evidence
- package dependency edgeとpresentation storyboard

項目別承認、コメント、生成履歴操作、UI apply / undoはPhase 6（§14）で追加済みである。

### 13.4 Post-apply QA

Content Packageのapplyがatomic transactionを完了した後、`content:qa`を既定で自動実行する。

1. `data:audit`
2. `tsc --noEmit`
3. 全Jest
4. Next.js development serverを既存利用または一時起動
5. Playwrightの統合レビューsmoke
6. pipeline panelの画像基準比較とfull-page screenshot保存

結果は`content/packages/{packageId}/reviews/post-apply-qa.json`へ、画面証跡は`content-package-review.png`へ保存する。QA失敗時は適用済みであることを明示して非0終了し、apply時に作成済みのsnapshotからundoできる。緊急時だけ`--skip-qa`を明示できるが、release前に`content:qa`を再実行する。

### 13.5 Release scopeと作例

現行release scopeは第1章だけである。request plannerはchapter 2+を作成せず、JSON Schemaはchapter最大1、validatorはchapter 2+をFAIL、package applyは`--allow-deferred`でも迂回できない。将来scopeを解禁するときは4境界を同時に変更する。

作例は`phase5-boss-signature-weapon.request.json`の「亡国の王都に新しいボスと固有武器を追加」である。1依頼からcombat-unit、skill、weapon、encounterの4 target、23 deliverable、16 dependency edge、3 master change、8 AssetSpec / prompt、2 presentation、stage / wave / drop / story導線を作る。実画像と一部証跡がない間は意図どおりINCOMPLETEを維持する。

## 14. Phase 6 実装仕様

### 14.1 レビュー単位と承認失効

Review StudioはContent Packageを対象、master差分、asset、presentation、evidenceの単位へ分ける。各`review.items[]`は`ref`、状態、対象内容のSHA-256、reviewer、reviewedAt、commentを持つ。承認対象のpayloadだけをcanonical化してhashを計算するため、工程再生成後は変更された項目だけ`PENDING`へ戻り、無関係な承認は維持される。

`APPROVED`は対象成果物がREADY、evidenceがPASSまたはWARNの場合だけ選べる。未完成でも`CHANGES_REQUESTED`は記録でき、修正指示を次の生成工程へ渡せる。`review.items`が存在するpackageは全項目の最新hashがAPPROVEDになるまでREVIEWEDへ遷移できない。旧packageの読み取り互換は維持するが、Review Studioから次状態へ進む時点で項目レビューを初期化する。

### 14.2 人間ゲートと監査

項目承認、REVIEWED、APPROVEDはhuman actorだけが実行する。項目判断とpackage遷移は別操作であり、全項目承認がそのままゲーム反映を意味しない。`review.audit[]`は初期化、承認、差し戻し、hash変更によるリセット、工程再生成、undoを担当者・日時・コメント・対象refとともに追記する。package状態は従来の`review.history[]`を正本とし、画面では両履歴を時系列に統合する。

### 14.3 Review Studio

development限定の`/admin/content-packages`は次を一画面で表示する。

1. 7工程の進捗、attempt、release scope
2. 世界観対象とLore根拠
3. JSONを露出しないfield単位のcurrent / proposed semantic diff
4. BattleEngineのTTK、被ダメージ、AoE、cost、行動順
5. story scene台詞、Lore timeline、story trigger
6. optimized asset、contact sheet、生成仕様
7. VFX storyboard、damage timing、SFX profile、粒子予算
8. evidence、不足項目、依存グラフ、監査履歴

各カードからコメント付き承認または差し戻しを実行できる。package上部のHuman GateはDRAFT検証、REVIEWED、APPROVED、工程再生成、apply、undoを扱う。再生成はDRAFT限定、applyはAPPROVED履歴のactor一致と`APPLY {packageId}`、undoは`UNDO {packageId}`を要求する。

### 14.4 apply / undo / conflict detection

UI applyは既存のatomic transactionとpost-apply QAを呼び出し、master、asset、presentation、package状態を同じsnapshotへ保存する。undo前にはmanifestの`appliedHash`と現在ファイルを読み取り専用比較し、適用後変更をファイル単位で表示する。競合がある通常undoは書き込み前に停止し、人間が差分を確認して`FORCE UNDO {packageId}`を明示した場合だけ強制復旧する。復旧snapshotは削除せず監査根拠として保持する。

実装正本は`src/lib/content/contentReviewWorkflow.ts`、`src/lib/content/contentTransaction.ts`、`src/app/admin/content-packages/actions.ts`、`src/app/admin/content-packages/page.tsx`である。

## 15. Phase 7 実装仕様

### 15.1 Production contract gate

`src/lib/content/productionQualityGate.ts`をリリース品質の純関数正本とする。Content Packageについて、日英名・画像alt・SFX字幕、人物の目的／恐れ／価値観／口調、story sceneの日英台詞とモバイル文字数、画像のmanifest参照、派生元、未登録media、生成先orphan、skillとpresentationの`effectKey`、SFX profile、色以外のshape cue、flash 3Hz以下、reduced-motion、stage / enemy / item / material参照を検査する。

`npm run content:production -- <package.json>`は構造validatorとproduction contractを合成し、`--require-applied`でAPPLIED以外をrelease不可にする。`--write-report`は`content/packages/{id}/reviews/production-quality.json`へ全findingを保存する。

encounter targetはステージ草案だけでは完成しないため、`stage`をContent Packageのcreate-only change scopeへ昇格した。`validateStageDraft`でarea、unlock、WAVE enemy、BOSS tier、reward item / materialをpackage内の新規enemy / weaponも含めて検証し、`stages.json`、package、asset、presentationと同じsnapshotへ適用・復旧する。

### 15.2 Runtime device gate

`tests/content-production-quality.spec.ts`はiPhone 13 Pro相当のviewport / user agentと`prefers-reduced-motion: reduce`でホームから最初の戦闘まで操作する。Chromiumではheapを含む性能予算、WebKitではiOS Safari固有のlayout・animation・操作を検証し、それぞれJSON証跡へ保存する。

- document横overflow、意図しないtext clip、44px未満の操作対象
- production初回route bundleのgzip容量と、画像・APIなど実測transfer
- JS heap使用量と操作後増加
- requestAnimationFrameのp95と34ms超long frame数
- console errorとreduced-motion中の長時間transform animation

上限は初回転送1.5MB、heap 128MB、heap増加16MB、frame p95 25ms、34ms超frame 2件、touch 44pxで固定する。Framer Motionはrootの`MotionConfig reducedMotion="user"`、CSSはOS設定時の全体fallback、`BattleCanvas`のambient animationは`useReducedMotion`で明示停止する。

### 15.3 前方互換ライフサイクル

`createProductionForwardSamples()`は次の4種類を決定論的な完全Content Packageとして生成する。

1. 物語人物＋日英シーン＋立ち絵／表情
2. enemyを冥約後に使役できるcombat-unit＋専用skill / VFX / SFX
3. weapon＋一覧／詳細画像＋stage drop＋装備接続
4. BOSS enemy＋stage WAVE＋背景＋専用VFX / SFX＋reward＋story trigger

Jestは各packageをDRAFT生成、構造・production検証、VALIDATED、全項目human review、REVIEWED、APPROVED、atomic apply、runtime manifestと参照の接続確認、snapshot conflict検査、undoまで通す。これは実コンテンツをmasterへ残すfixtureではなく、将来schemaやgateを拡張しても全工程が再現できることを保証する前方テストである。

### 15.4 Release QA

apply後の`content:qa`は次を単一reportへまとめる。

1. APPLIED必須のproduction contract
2. master audit、TypeScript、全Jest（4種ライフサイクルを含む）
3. Next.js production build
4. `/layout`、`/page`、polyfillのroute manifestを基にしたgzip初回bundle
5. Review Studio視覚回帰とiPhone相当runtime Playwright

新しい開発・CI環境では初回だけ`npx playwright install webkit`を実行する。browser未導入はiOS Safari未検証としてQAをFAILさせ、自動skipしない。

結果は`post-apply-qa.json`、`production-quality.json`、`production-runtime-chromium.json`、`production-runtime-webkit.json`、`content-package-review.png`へ保存する。どれか一つでもFAILならrelease不可とし、既存snapshotからundoできる状態を維持する。
