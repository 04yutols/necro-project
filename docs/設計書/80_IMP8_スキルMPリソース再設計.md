# 80. IMP-8 スキルMPリソース再設計

> 作成日: 2026-05-31
> 対象: バトル中のスキル消費リソース、表示名称、職業マスターデータ、種族シナジー
> 関連: [09_ステータスシステム.md](09_ステータスシステム.md), [18_種族シナジーシステム.md](18_種族シナジーシステム.md), [47_SP成長設計.md](47_SP成長設計.md)

## 1. 背景

現行実装は、スキル用リソースを「エネルギー / EN / SP」と表示し、通常攻撃、スキル使用、防壁破壊、BEASTシナジーで回収する充填ゲージとして扱っている。

しかし、プレイヤーが期待する仕様はRPGで一般的なMPである。MPはスキルを使うために消費し、通常攻撃を挟むだけでは自然回復しない。現行仕様では魔神化用のソウルゲージとスキル用の充填ゲージが並立し、役割も分かりにくい。

また、コマンド名が「術」になっており、物理スキルを含む一覧を開く操作としては意味が狭い。

## 2. 目的

- プレイヤー向け名称を「スキル」と「MP」に統一する。
- MPを、ステージ開始時に満タンで付与され、スキル使用時に消費される有限リソースにする。
- 通常攻撃やスキル使用による暗黙のMP回復を廃止する。
- 魔神化用ソウルゲージとMPの責務を明確に分離する。

## 3. 採用仕様

### 3.1 表示名称

| 対象 | 旧表示 | 新表示 |
|---|---|---|
| バトルコマンド | 術 | スキル |
| スキル選択見出し | 術・スキル選択 | スキル選択 |
| スキル消費リソース | EN / SP / エネルギー | MP |
| ホーム画面ステータス | ENERGY | MP |

職業名の「闇術師」、フレーバーテキストの「炎術」など、世界観上の用語は変更しない。操作名とシステム用語だけを統一する。

### 3.2 MPライフサイクル

| タイミング | MP変化 |
|---|---|
| キャラクター作成時 | `maxEnergy` まで満タン |
| ステージ開始時 | `maxEnergy` まで満タン |
| WAVE切り替え時 | 現在値を維持 |
| 通常攻撃時 | 変化なし |
| スキル使用時 | `mpCost` を1回だけ消費 |
| AoEスキル使用時 | 命中対象数に関係なく `mpCost` を1回だけ消費 |
| スキル使用後 | 自動回復なし |
| 防壁破壊時 | MP回復なし。魔神化ゲージ加算だけを維持 |
| BEAST × 3 シナジー | MP回復なし。SPD +30だけを維持 |
| `RESTORE_ENERGY` アイテム使用時 | 明示的にMP回復 |
| 魔神化 `ENERGY_DRAIN` リスク | MP追加消費として維持 |

このゲームには宿屋や拠点回復フローがまだ存在しないため、MPはステージ単位で満タンに戻す。ステージ内の複数WAVEでは有限リソースとして管理する。

### 3.3 内部名の互換維持

保存形式と既存呼び出しへの影響を抑えるため、次の内部識別子は今回リネームしない。

| 内部識別子 | 扱い |
|---|---|
| `currentEnergy`, `maxEnergy` | MPのランタイム値として維持 |
| `energyCurve.baseMaxEnergy` | 最大MPとして維持 |
| `energyCurve.spGrowthPerLevel` | レベルごとの最大MP成長値として維持 |
| `RESTORE_ENERGY` | MP回復アイテムの内部効果IDとして維持 |
| `ENERGY_DRAIN` | MP追加消費リスクの内部効果IDとして維持 |
| `BattleLog.playerSp` | 互換用ログフィールドとして維持し、意味をMPへ変更 |

### 3.4 廃止する充填パラメータ

`jobs.json` と `JobData.energyCurve` から次のフィールドを削除する。

| フィールド | 廃止理由 |
|---|---|
| `energyRegen` | 通常攻撃でMPを回収しないため不要 |
| `initialSpPct` | ステージ開始時MPを常に満タンにするため不要 |

`EnergySystem.calculateInitialEnergy()` は互換APIとして残し、`calculateMaxEnergy()` と同じ値を返す。

### 3.5 バランス値の扱い

今回の変更はリソース挙動の修正であり、職業ごとの `baseMaxEnergy`, `spGrowthPerLevel`, スキルの `mpCost` は変更しない。物理職・魔法職間の最大MPと消費MPの再調整は、実プレイ結果を見て別のバランス調整として行う。

## 4. 実装対象

| ファイル | 変更内容 |
|---|---|
| `src/logic/EnergySystem.ts` | 初期MPを最大MPと同値にし、通常攻撃回復APIを削除 |
| `src/logic/BattleEngine.ts` | 通常攻撃、スキル使用後、防壁破壊、BEASTシナジーのMP回復を削除 |
| `src/logic/TribeSynergySystem.ts` | `energyPerTurn` とBEAST × 3のMP回復表示を削除 |
| `src/types/game.ts` | 充填パラメータ削除とMPコメントへの更新 |
| `src/data/master/jobs.json` | `energyRegen`, `initialSpPct` を全職業から削除 |
| `src/components/battle/BattleCanvas.tsx` | MP表示、スキル表示、暗黙回復削除 |
| `src/components/home/HomeHero.tsx` | `ENERGY` 表示を `MP` へ変更 |
| `src/components/legion/LegionHub.tsx` | ステータス詳細の `EN` 表示を `MP` へ変更 |
| `src/data/tutorial/phases.ts` | チュートリアル文言をスキル / MPへ変更 |
| `.agents/skills/project-arch/SKILL.md` | 今後のUI規約を「スキル」へ更新 |

## 5. テスト設計

### 5.1 Unit Test

| 対象 | 確認内容 |
|---|---|
| `EnergySystem.test.ts` | Lv1・高レベルとも初期MPが最大MPと一致する |
| `BattleEngine.test.ts` | 通常攻撃でMPが増えない |
| `BattleEngine.test.ts` | 単体・AoEスキルで `mpCost` だけが1回消費される |
| `BattleEngine.test.ts` | 防壁破壊でMPが回復しない |
| `TribeSynergySystem.test.ts` | BEAST × 3はSPD +30だけを返す |
| `useGameStore.party.test.ts` | ローカル初期プレイヤーが満タンMPで初期化される |

### 5.2 E2E

| 対象 | 確認内容 |
|---|---|
| モバイルバトル画面 | コマンドが「スキル」、見出しが「スキル選択」になる |
| モバイルバトル画面 | 初期MPが満タンで表示される |
| モバイルバトル画面 | スキル使用後にMPがコスト分だけ減る |

### 5.3 回帰確認

- `npx tsc --noEmit`
- `npm test -- --runInBand`
- `npm run build`
- `npm run data:audit`
- 関連Playwright spec
- `git diff --check`

## 6. 旧設計書との関係

本設計は、次の旧仕様を上書きする。

- `09_ステータスシステム.md` の「MPを廃止しエネルギーゲージへ置換」
- `18_種族シナジーシステム.md` の「BEAST × 3でエネルギー +15/ターン」
- `47_SP成長設計.md` の「初期SP率」「通常攻撃SP回収」

旧設計書は変更履歴として保持し、実装時点の正は本設計書とする。
