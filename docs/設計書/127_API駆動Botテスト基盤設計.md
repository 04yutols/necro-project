# 127 — API駆動Botテスト基盤設計

> 作成日: 2026-07-27  
> 対象: `src/logic/BattleEngine.ts` / `src/logic/BotSimulation.ts` / `src/app/api/admin/bot-simulate/route.ts` / `scripts/run-bot-batch.mts`  
> 関連: `08_テスト戦略.md` / `28_RewardService設計.md` / `71_IMP3_敵ボスバランス手動調整手順.md` / `72_IMP7_ステージ難易度導線手動調整手順.md` / `73_ドロップ経済手動調整手順.md`

---

## 1. 目的

画面操作を行わず、外部BotがHTTP APIを継続的に呼び出して、実マスターデータと実戦闘・報酬ロジックを大量試行する。

主な調査対象:

- ステージ・職業・育成プロファイル・行動方針ごとのクリア率
- ターン数、行動数、主人公・軍団の残HP、生存使役魔数、与ダメージ、被ダメージの分布
- 全滅、上限ターン到達、極端な一撃死、長期戦の検出
- 設定ドロップ率と実測ドロップ率の差
- レアリティ、残滓、素材、武器、ネクロマンスの出現分布
- 同一seedでの不具合再現

## 2. 非目的

- VFX、アニメーション、レイアウトの検証
- 本番プレイヤーの所持品・進行・ランキングを利用した負荷試験
- Botによるマスターデータの自動書き換え
- LLMに数値計算や合否判定を委ねること

数値集計と判定は決定論的コードで行う。LLM評価は将来、集計済みレポートの説明用途に限って接続できる。

## 3. 設計原則

1. **UI非依存**: React / Zustand / PixiJS / Framer Motionを読み込まない。
2. **実ロジック使用**: `BattleEngine`、`RewardService`、`MasterDataService`を直接使用し、計算式をBot側へ複製しない。
3. **決定的再現**: 戦闘・ドロップにseed付き乱数を注入し、`seed + scenario + iteration`で1試行を再現する。
4. **無副作用**: Prisma、ランキング、世界ログ、第一発見、プレイヤーセーブを更新しない。
5. **短時間API**: APIは単一シナリオを最大500回ずつ処理し、全体反復は外部バッチが担当する。
6. **統計と個票を分離**: APIは集計値、チャンク結合用の数値系列、限定サンプルを返し、バッチがシナリオ横断レポートを生成する。

## 4. 全体構成

```text
scripts/run-bot-batch.mts
  ├─ GET  /api/admin/bot-simulate       カタログ取得
  └─ POST /api/admin/bot-simulate       シナリオをチャンク実行
          ↓
      BotSimulation
        ├─ SeededRandom
        ├─ MasterDataService singleton
        ├─ BattleEngine
        ├─ RewardService
        ├─ JobGrowth / Energy / NecroGrowth
        └─ 統計集計・Wilson 95%信頼区間
          ↓
      JSONレスポンス
          ↓
artifacts/bot-tests/<run-id>/
  ├─ report.json
  ├─ summary.csv
  └─ drops.csv
```

## 5. API仕様

### 5.1 `GET /api/admin/bot-simulate`

Botが実行可能なカタログを取得する。

```json
{
  "stages": [{ "id": "area1_node1", "chapter": 1, "difficulty": 1 }],
  "profiles": ["starter", "ch1_mid", "ch1_end", "endgame"],
  "policies": ["basic_only", "skill_first", "weakness_first"],
  "limits": { "maxIterations": 500, "maxSampleRuns": 20 }
}
```

### 5.2 `POST /api/admin/bot-simulate`

単一シナリオを複数回実行する。

```json
{
  "stageId": "area1_node1",
  "profile": "ch1_mid",
  "policy": "weakness_first",
  "jobId": "mage",
  "iterations": 100,
  "seed": "nightly-2026-07-27:0",
  "maxRounds": 200,
  "firstClear": false,
  "sampleRuns": 3
}
```

`jobId`はプロファイルの職業だけを上書きする。Botバッチはステージ・プロファイル・方針・職業の直積をチャンク単位で送信する。

### 5.3 レスポンス

```json
{
  "scenario": {},
  "difficulty": {
    "runs": 100,
    "wins": 82,
    "losses": 16,
    "timeouts": 2,
    "clearRate": 0.82,
    "clearRate95": { "low": 0.733, "high": 0.88 },
    "rounds": { "mean": 18.2, "p50": 17, "p95": 31 },
    "actions": { "mean": 48.1, "p50": 46, "p95": 78 },
    "remainingHpPct": { "mean": 42.4, "p50": 39.5, "p95": 88 }
  },
  "series": { "outcomes": [], "rounds": [], "actions": [] },
  "drops": [{
    "key": "WEAPON:bleed_reaver:SR",
    "configuredRate": 0.12,
    "observedRate": 0.11,
    "observedRate95": { "low": 0.062, "high": 0.187 },
    "dropCount": 11
  }],
  "samples": []
}
```

## 6. Botプロファイル

| 名前 | 職業Lv | ネクロLv | 武器帯 | 用途 |
|---|---:|---:|---|---|
| `starter` | 1 | 1 | R | 初回到達時の最低戦力 |
| `ch1_mid` | 8 | 8 | R | 第1章中盤の標準戦力 |
| `ch1_end` | 15 | 30 | SSR | 第1章終盤の標準戦力 |
| `endgame` | 50 | 200 | UR | 高育成での過剰戦力・黄泉確認 |

軍団は実在する `goblin / skeleton / zombie` の3枠を使用し、`applyNecroToMonster`でネクロLv補正を適用する。主人公は `getJobBaseStatsAtLevel` と `calculateEnergyState` から構築する。

## 7. 行動方針

| 方針 | 主人公 | 使役魔 | 魔神化 |
|---|---|---|---|
| `basic_only` | 通常攻撃のみ | 通常攻撃のみ | 使用しない |
| `skill_first` | 使用可能な最高威力スキル | 使用可能な最高威力スキル | ゲージ満タンで発動し魔神技を優先 |
| `weakness_first` | 弱点属性を優先し、次に最高威力 | 弱点属性を優先 | ゲージ満タンで発動し魔神技を優先 |

ターゲットは生存敵のうち、BOSS → ELITE → MINION、同Tierでは残HPが低い順を基本とする。

## 8. 戦闘試行

1. プロファイルから主人公と3枠軍団を生成する。
2. ステージの各WAVEを実マスターから生成し、`statScale`を適用する。
3. 行動方針に従って主人公と生存使役魔の行動を決定する。
4. `BattleEngine`へアクションを渡す。
5. 召喚敵を現在WAVEへ追加する。
6. 敵全滅で次WAVE、主人公HP 0で敗北、`maxRounds`到達でtimeoutとする。
7. 勝敗に関係なくドロップ試行は独立seedで行う。ただし通常の総合レポートでは勝利試行だけを獲得報酬として数える。

戦闘seedと報酬seedは分離し、戦闘ターン数の変化がドロップ列へ影響しないようにする。

## 9. 乱数注入

`BattleDamage`はすでに`rng`を受け取れるが、`BattleEngine`内には直接`Math.random()`を使う箇所が残っている。コンストラクタへ任意の`rng`を追加し、以下を同じ乱数源へ統一する。

- 会心判定
- ヘイト対象抽選
- 状態異常付与・抵抗
- 麻痺の行動スキップ

既存呼び出しは既定値`Math.random`により互換を維持する。

## 10. ドロップ統計

- 実生成は`RewardService.processStageDropTable`と`processStageNecromance`を使う。
- 初回確定と周回抽選は`firstClear`で分離する。
- プロファイルの既所持魔物と同一試行内の確定獲得魔物を捕獲候補から除外し、本番の重複抑止順序を再現する。
- 1回以上得た試行数をhit数、総獲得個数をdropCountとする。
- 実測率の95%信頼区間はWilson score intervalで算出する。
- 設定率が実測95%信頼区間から外れた項目を警告対象にできる。
- 低確率品は固定試行数だけで断定せず、信頼区間幅を併記する。

## 11. セキュリティと環境分離

- 既定ではdevelopment/testのみ有効。
- productionでは`BOT_TEST_API_ENABLED=true`がない限り404を返す。
- `BOT_TEST_API_TOKEN`設定時は`Authorization: Bearer ...`を必須にする。
- productionで有効化する場合、token未設定は起動不可とする。
- リクエストあたりの試行数、サンプル数、最大ターン数を制限する。
- Prisma、Server Action、ランキング、Pusherを呼ばない。
- APIレスポンスへ認証情報、環境変数、プレイヤーデータを含めない。

## 12. 出力とCI利用

Botバッチは実行日時、基準URL、seed、対象マトリクス、シナリオ結果を`report.json`へ保存する。CSVは表計算・可視化向けの平坦な形式とする。

初期CI判定は任意指定とし、次をサポートする。

- `--min-clear-rate=<0..1>`: いずれかのシナリオが下回ればexit 2
- `--max-p95-rounds=<n>`: 勝利シナリオのP95が超過すればexit 2
- API・入力・出力エラーはexit 1

統計揺らぎでCIが不安定にならないよう、固定seedを必須記録し、少数試行の結果を厳格ゲートへ使わない。

### 12.1 実行例

ターミナル1:

```bash
npm run dev
```

ターミナル2（小規模スモーク）:

```bash
npm run bot:test -- \
  --stages=area1_node1 \
  --profiles=starter \
  --policies=weakness_first \
  --jobs=mage \
  --iterations=20 \
  --chunk-size=10 \
  --seed=local-smoke
```

第1章の網羅実行:

```bash
npm run bot:test -- \
  --stages=chapter1 \
  --profiles=starter,ch1_mid,ch1_end \
  --policies=basic_only,skill_first,weakness_first \
  --jobs=warrior,mage,dark_priest,rogue \
  --iterations=1000 \
  --chunk-size=100 \
  --seed=ch1-balance-v1
```

`BOT_TEST_API_TOKEN`は`.env` / `.env.local`から読み込むほか、`--token=...`でも指定できる。成果物は既定で`artifacts/bot-tests/<run-id>/`へ生成され、Git追跡対象外となる。

## 13. テスト方針

- `SeededRandom.test.ts`: 同seed同系列、異seed別系列、値域
- `BattleEngine.test.ts`: 注入乱数が会心・ヘイト・状態異常へ届くこと
- `BotSimulation.test.ts`: 勝利・敗北・timeout、再現性、全WAVE、ドロップ集計、Wilson区間
- API route test: 認証、入力上限、未知ID、正常レスポンス
- `npx tsc --noEmit`
- 対象Jestテスト
- dev serverに対するバッチスモーク

## 14. 制約と今後

- 初期版の戦闘順序は`BattleEngine`のアクション単位フローを正本とする。
- 本節で将来対象としていた黄泉、共通`BattleSession`、任意ビルド感度、履歴・差分、管理画面、Redis分散worker、定期実行は2026-07-27に実装済み。拡張後の正本は [128_API駆動Botテスト運用拡張設計.md](128_API駆動Botテスト運用拡張設計.md) とする。
